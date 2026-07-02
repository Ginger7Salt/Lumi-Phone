import type { AnonymousQaWechatContext } from '../../../../components/anonymousQa/buildAnonymousQaPersonaContext'
import { buildAnonymousQaPersonaPromptPack } from '../../../../components/anonymousQa/buildAnonymousQaPersonaContext'
import { openAiCompatibleChat, type OpenAiCompatibleMessage } from '../newFriendsPersona/ai'
import { personaDb } from '../newFriendsPersona/idb'
import type { Character } from '../newFriendsPersona/types'
import { buildSystemContent } from '../wechatChatAi'
import { buildMemoryRelevanceHaystack } from '../wechatMemoryPromptBlocks'
import { loadDiaryOfflineSummaryPromptBlock } from './loadDiaryOfflineSummaryPrompt'
import {
  ensureDiaryInUniverseTimeHasYear,
  loadDiaryStoryYearHint,
} from './diaryInUniverseTime'
import { parseDiaryAiModelText } from './parseDiaryAiResponse'
import {
  type DiaryAiResult,
  DIARY_CONTENT_MAX_CHARS,
  DIARY_CONTENT_MIN_CHARS,
} from './diaryTypes'

function buildDiarySystemAppendix(params: {
  charName: string
  needsFontBinding: boolean
  recentDiarySnippet: string
}): string {
  const fontLine = params.needsFontBinding
    ? `- 当前尚未绑定笔迹（或笔迹已重置）。请在 JSON 中返回最符合你文化水平与人设的 font_style 代号：
  · 文化水平正常或偏高：只能选 sharp / neat / wild
    - neat（楷体）：系统会从楷体库随机绑定一款（鸿雷拙书简体、平方江南体、手书体等）
    - sharp / wild（行书）：系统会从行书库随机绑定一款
  · 文盲、学历很低、不常写字：只能选 lazy / elegant（潦草字体库），勿选 neat / sharp / wild`
    : '- 字体已永久绑定，不要返回 font_style 字段。'

  return `
---
【系统任务：潜意识日记生成】
你正在书写你（${params.charName}）的绝密私人日记。用户（玩家）无法在剧情里看到这些话。
请参考系统上下文中已提供的：基础设定、世界书法则、最近聊天、深层长期记忆，以及 user 消息中的线下剧情摘要。

要求：
- 这是极度私密的日记，请卸下你对外的伪装。傲娇的可以写下懊悔，高冷的可以写下疯狂的占有欲。
- 不要重复你最近写过的心声；若情绪相近，写出新的细节或转折。
- 【时间顺序】严格按剧情实际发生先后叙述：先发生的写在前，后发生的写在后。若上下文里先手机聊天、后面对面/项圈等互动，日记须先写聊天再写后续；勿因某段更强烈就倒叙或打乱时序。
- 正文须写完整、自然收束，最后一句语义完整，不要写到一半戛然而止。
- inUniverseTime 必须包含公历年份（格式如 2026年7月2日 傍晚），须与【剧情时间轴】/线下摘要中的故事日期一致，勿写真实落库日期。
- 【书写质感】正文必须以中文汉字为主书写，像正常人写日记一样。
  · 文盲、学历很低、不常写字的人设：只会写的字用汉字，**仅对少数不会写的难字/生僻词**用拼音顶替（全文拼音词建议 3～6 处，不要超过 8 处）；常用字（我、你、她、的、了、很、不、是等）必须用汉字。
  · 正确示例：我都快站不住了。她扯着我的xiàng圈，有点疼，但是我真的很喜欢。她问我是不是狼，我不知道，她说我是什么就是什么……我好怕她嫌弃我的铁……那胳膊到现在还……
  · 错误示例：wǒ dōu kuài zhàn bù zhǔ le、tā chě zhe wǒ de xiàng quān —— 禁止整句或整段拼音罗马音。
  · 不会写的字：只写拼音，或只写你能写出来的字/错别字，二选一，禁止叠用；禁止「nán过（难过）」这类拼音后再括号补汉字。
  · 偶尔写错别字时，用括号补正即可（如：很闲（咸）），不要和拼音混用。
  · 涂改格式「[涂]错字|正字」全文最多 0～1 处。
  · 文化水平正常或偏高的人设：通顺书面语，全汉字，不要拼音，不要故意写错，不要使用 [涂]。
  · 标题与署名行由系统处理，content 里不要重复写你的名字。
${fontLine}
- 严格返回 JSON，不要 Markdown，不要解释。
- JSON 合法性（重要）：content 必须是单行 JSON 字符串；换行请写成 \\n，双引号请写成 \\"；[涂]错字|正字 格式可原样保留。
- 同一次输出须包含 memory_summary（供长期记忆入库的摘要表，**禁止抄写日记 content 原文**）：
  · memory_summary.row_title：4～10 字检索标题（概括本篇私密情绪或事件）
  · memory_summary.row_keywords：3～5 个检索词，每条 ≤5 个汉字
  · memory_summary.content：60～200 字**第三人称**备忘正文；{{char}} 指写日记的角色本人，{{user}} 指玩家；禁止第一人称「我」；禁止粘贴或大段复述日记原文
{
  "title": "符合你性格的日记标题（极简）",
  "inUniverseTime": "须含年份的剧情时间（如：2026年7月2日 傍晚，赶往公爵府的路上；或 2026年7月3日 凌晨三点，雨）",
  "content": "日记正文（字数 ${DIARY_CONTENT_MIN_CHARS}-${DIARY_CONTENT_MAX_CHARS} 字）",
  "memory_summary": {
    "row_title": "摘要短标题",
    "row_keywords": ["词1", "词2", "词3"],
    "content": "第三人称摘要备忘（60-200字）"
  }${params.needsFontBinding ? ',\n  "font_style": "neat"' : ''}
}

【你最近写过的日记标题（避免重复）】
${params.recentDiarySnippet || '（尚无）'}
`.trim()
}

export async function generateSubconsciousDiaryEntry(params: {
  characterId: string
  wechatCtx: AnonymousQaWechatContext
  existingFontFamily: string | null
  recentEntries: Array<{ title: string; inUniverseTime: string }>
}): Promise<DiaryAiResult> {
  const cfg = params.wechatCtx.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }

  const cid = params.characterId.trim()
  const character = (await personaDb.getCharacter(cid)) as Character | null
  if (!character) throw new Error('角色不存在')

  const charName = character.name?.trim() || '角色'
  const needsFontBinding = !params.existingFontFamily

  const hay = buildMemoryRelevanceHaystack([charName, '日记', '内心独白'])
  const [pack, offlineSummaryBlock, storyYearHint] = await Promise.all([
    buildAnonymousQaPersonaPromptPack({
      characterId: cid,
      wechatCtx: params.wechatCtx,
      relevanceHaystack: hay,
    }),
    loadDiaryOfflineSummaryPromptBlock(cid),
    loadDiaryStoryYearHint(cid),
  ])

  const recentContext = [
    offlineSummaryBlock || '',
    pack.unsummarizedPrivateNotes
      ? `【最近私聊（未总结，按时间由旧到新）】\n${pack.unsummarizedPrivateNotes}`
      : '',
    pack.unsummarizedGroupNotes
      ? `【最近群聊参照（由旧到新）】\n${pack.unsummarizedGroupNotes}`
      : '',
    pack.unsMeet ? `【遇见承接】\n${pack.unsMeet}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const baseSystem = buildSystemContent({
    character: pack.character,
    playerIdentity: pack.playerIdentity,
    playerDisplayName: params.wechatCtx.playerDisplayName.trim() || '你',
    promptMode: 'persona',
    longTermMemoryNotes: pack.longTermMemoryNotes || undefined,
    worldBackgroundPrompt: pack.worldBackgroundPrompt,
    unsummarizedPrivateNotes: pack.unsummarizedPrivateNotes || undefined,
    unsummarizedGroupNotes: pack.unsummarizedGroupNotes || undefined,
    chatMemberIds: [cid],
  })

  const recentDiarySnippet =
    params.recentEntries
      .slice(0, 6)
      .map((e) => `- ${e.title}${e.inUniverseTime ? `（${e.inUniverseTime}）` : ''}`)
      .join('\n') || '（尚无）'

  const appendix = buildDiarySystemAppendix({
    charName,
    needsFontBinding,
    recentDiarySnippet,
  })

  const userTask = `请根据下列近期上下文，书写一篇全新的潜意识日记。
上下文各段均已按时间由旧到新排列；写日记时按同样时间顺序回忆，后文事件不可写在前文之前。
${recentContext ? `\n${recentContext}` : ''}`

  const messages: OpenAiCompatibleMessage[] = [
    { role: 'system', content: `${baseSystem}\n\n${appendix}` },
    { role: 'user', content: userTask },
  ]

  const chatOpts = { temperature: 0.88, max_tokens: 6500 }
  let raw = await openAiCompatibleChat(cfg, messages, chatOpts)
  let parsed = parseDiaryAiModelText(raw, { allowFontStyle: needsFontBinding })

  const looksTruncated = (content: string) => {
    const t = content.trim()
    if (t.length < 40) return true
    if (/[，,；;：:、]$/.test(t)) return true
    return t.length > 400 && !/[。！？…~～」』"']$/.test(t)
  }

  const isMostlyPinyinRomanization = (content: string) => {
    const latin = (content.match(/[a-zA-Zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]/g) ?? []).length
    const han = (content.match(/[\u4e00-\u9fff]/g) ?? []).length
    return latin > 60 && han < latin * 0.35
  }

  const retryForContent = async (reason: string) => {
    const retryMessages: OpenAiCompatibleMessage[] = [
      ...messages,
      { role: 'assistant', content: raw },
      { role: 'user', content: reason },
    ]
    raw = await openAiCompatibleChat(cfg, retryMessages, chatOpts)
    parsed = parseDiaryAiModelText(raw, { allowFontStyle: needsFontBinding })
  }

  if (looksTruncated(parsed.content)) {
    await retryForContent(
      `上一版 content 写到一半被截断了。请重新输出完整 JSON：正文写满 ${DIARY_CONTENT_MIN_CHARS}-${DIARY_CONTENT_MAX_CHARS} 字并自然收尾，保持时间顺序不变，不要重复已写句子。`,
    )
  }

  if (isMostlyPinyinRomanization(parsed.content)) {
    await retryForContent(
      '上一版几乎全是拼音罗马音，不符合文盲手写习惯。请重新输出 JSON：正文以中文汉字为主，仅对少数不会写的难字用拼音（全文 3～6 处），禁止整句拼音。',
    )
  }

  if (!parsed.memorySummary?.content?.trim()) {
    await retryForContent(
      '上一版缺少 memory_summary 或摘要正文为空。请重新输出完整 JSON：必须含 memory_summary（row_title、row_keywords、content），摘要为第三人称备忘，禁止抄写日记 content 原文。',
    )
  }

  const result: DiaryAiResult = {
    title: parsed.title,
    content: parsed.content,
    inUniverseTime: ensureDiaryInUniverseTimeHasYear(parsed.inUniverseTime, storyYearHint),
    memorySummary: parsed.memorySummary,
  }
  if (needsFontBinding && parsed.font_style) result.font_style = parsed.font_style
  return result
}
