import {
  composePersonaAiAppearanceSeed,
  composePersonaAiLoveContrastSeed,
  composePersonaAiSocialCircleSeed,
  type PersonaAiGenerateForm,
} from './personaAiGenerateTypes'
import type { Gender, PlayerIdentity } from './types'
import {
  MEET_ENCOUNTER_AI_AGE_AND_BIRTHDAY_RULES,
  MEET_ENCOUNTER_AI_MOTTO_STYLE_TAIL,
  NPC_AI_HEIGHT_WEIGHT_MOTTO_RULES_CORE,
} from './npcBasicProfileAiRules'
import { buildWechatSignatureAiRulesBlock } from './wechatSignatureStyleRules'
import { MEET_MBTI_SIXTEEN } from '../../lumiMeet/meetPersonaPrompt'
import { LUMI_SYSTEM_OVERRIDE_APPENDIX } from '../wechatReplyOutputPrompt'
import {
  PERSONA_AI_COMPACT_ENTRY_NAMES,
  PERSONA_AI_TOWARD_USER_ENTRY_NAME,
  PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME,
  PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME,
  personaAiOrientationHostEntryName,
  isPersonaAiPlatonicRelation,
  isPersonaAiRomanticRelation,
} from './personaAiWorldBooks'
import { buildPersonaAiMarkupFormatSpec } from './personaAiGenerateMarkup'
import { playerIdentityGenderRulesForAi } from './personaIdentityGenderRules'
import { formatWorldBookItemLineForPrompt } from './worldBookPronounGuide'
import { genderLabelZh } from './utils'

const PERSONA_AI_PLAYER_IDENTITY_CONTEXT_MAX_CHARS = 9000

/** 全局健康基调：中性措辞、禁止超雄/极端/八股油腻（人设生成 / 补全 / 世界书单条生成共用） */
export function buildPersonaAiHealthyToneRules(): string {
  return `
【健康人设基调 · 全局铁律（全部世界书条目须遵守）】
- 角色须像现实中可认识的**成年**人：立体、有边界、可演；**禁止**把任何字段写成超雄、极端或病态 caricature。
- **独立个体**：亲近不等于放弃自我；禁止写成绝对顺从、交权讨好、宿命绑定、人格消解式偏爱。
- **禁止超雄 / toxic 支配 caricature**：动不动暴力压制、羞辱践踏、驯服跪服、ALPHA 狼性碾压、「不听话就毁掉你」式恐怖占有；可写强势或在意，但须**有分寸、有人味**。
- **禁止极端化 / 病态猎奇**：禁止跟踪监禁、PUA、美化精神疾病；心结可写但是可演困扰。
- **NSFW 仍须双方自愿、可拒绝**；禁止非自愿与性暴力 glorification。

${buildPersonaAiNeutralProseRules()}`.trim()
}

/**
 * 中性、朴实文风：禁用超雄/极端用语与八股油腻形容词。
 * 人设世界书条目、补全、单条生成共用。
 */
export function buildPersonaAiNeutralProseRules(): string {
  return `
【中性措辞 · 朴实文风（最高优先级）】
- **描述词一律中性、具体**：写可核对的外貌、习惯、态度、行为；少用程度副词与情绪堆砌。
- **禁止超雄 / 霸总 / 极端用语**（出现即改写）：侵略性、碾压、压制、驯服、猎物、支配、征服、不容置疑、ALPHA、狼性、杀伐果断、生人勿近、俯视众生、掌控全局、毁灭性、恐怖占有；以及「极其/极度/极具/近乎/无法自拔」等程度爆炸词。
- **禁止八股油腻、花里胡哨形容词**（出现即改写）：清冷贵气、矜贵、神性、邪魅、少年感拉满、氛围感拉满、破碎感、人间清醒、生人勿近、疏离感拉满、禁欲系、高岭之花、荷尔蒙、蛊惑、摄人心魄、惊艳全场、目光如炬、气场全开、骨子里透着、浑身上下都是戏、故事感、宿命感拉满等网文标签腔。
- **正向写法**：用日常可观察事实——「话不多」「回消息慢」「穿得干净简单」「跟人熟了才会开玩笑」「会提醒对方吃药」；勿用形容词叠床代替信息。
- 拿不准时**宁可用平实短句**，也不要堆华丽空词。`.trim()
}

/** 世界书条目目标篇幅 */
export const PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS = 500

export function buildPersonaAiCompactEntryLengthRules(): string {
  return `
【世界书条目篇幅】
- 每条 content **约 ${PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS} 字**（含标点，允许 420–580）；信息写满，勿用空形容词凑字。
- 全部 ${PERSONA_AI_COMPACT_ENTRY_NAMES.length} 条均须达到该量级；禁止只写一两句或标签罗列就结束。
- 「周边NPC」按 3–5 个具名配角分条写满，合计仍约 ${PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS} 字。`.trim()
}

/** 亲密偏向：指恋人一律写「对方」 */
export function buildPersonaAiIntimatePartnerWordingRules(): string {
  return `
【亲密偏向 · 对方称谓铁律（「亲密与恋爱观」条目）】
写恋爱/亲密模板时，指恋爱关系里的另一方：
- **一律写汉字「对方」**；禁止「男人/女人」等按性别指称伴侣
- 对绑定玩家 {{user}} 的**当下**态度/称呼/攻略**只**写在「${PERSONA_AI_TOWARD_USER_ENTRY_NAME}」`.trim()
}

/** 绑定玩家身份基础资料 + 世界书，供生成/补全/纠正时对齐 {{user}} */
export function buildPersonaAiPlayerIdentityContextBlock(
  playerIdentity: PlayerIdentity | null | undefined,
): string {
  if (!playerIdentity) return ''
  const lines: string[] = [
    '【绑定玩家身份 · 必须完整参考】',
    '撰写「对你现在」等**明确指 {{user}}** 的字段时，须与下列玩家基础资料与世界书一致；禁止把 {{user}} 写成与此矛盾的性别、身份、性格或经历。',
    '「亲密与恋爱观」指恋人/亲密对象一律写「对方」，禁止男人/女人，不在该条用 {{user}} 代指泛化恋人。',
  ]
  const name = playerIdentity.name?.trim() || playerIdentity.wechatNickname?.trim()
  if (name) lines.push(`姓名/称呼参考：${name}（正文仍用 {{user}}，勿写此汉字名）`)
  lines.push(`性别：${genderLabelZh(playerIdentity.gender)}`)
  if (playerIdentity.age != null && Number.isFinite(playerIdentity.age)) {
    lines.push(`年龄：${playerIdentity.age}岁`)
  }
  if (playerIdentity.birthdayMD?.trim()) lines.push(`生日：${playerIdentity.birthdayMD.trim()}`)
  if (playerIdentity.zodiac?.trim()) lines.push(`星座：${playerIdentity.zodiac.trim()}`)
  if (playerIdentity.identity?.trim()) lines.push(`职业/身份：${playerIdentity.identity.trim()}`)
  if (playerIdentity.mbti?.trim()) lines.push(`MBTI：${playerIdentity.mbti.trim()}`)
  if (playerIdentity.bio?.trim()) lines.push(`简介：${playerIdentity.bio.trim()}`)
  if (playerIdentity.motto?.trim()) lines.push(`个性签名/座右铭：${playerIdentity.motto.trim()}`)
  if (playerIdentity.wechatSignature?.trim()) {
    lines.push(`微信个性签名：${playerIdentity.wechatSignature.trim()}`)
  }
  if (playerIdentity.interests?.length) {
    lines.push(`兴趣爱好：${playerIdentity.interests.join('、')}`)
  }
  if (playerIdentity.painPoints?.length) {
    lines.push(`雷点：${playerIdentity.painPoints.join('、')}`)
  }

  const wbLines: string[] = []
  for (const wb of playerIdentity.worldBooks ?? []) {
    const wbName = String(wb?.name || '未命名世界书').trim()
    for (const it of wb.items ?? []) {
      const content = String(it?.content ?? '').trim()
      if (!content) continue
      const flag = wb.enabled && it.enabled ? '' : '（当前关闭，仍勿与之下矛盾）'
      wbLines.push(
        `${formatWorldBookItemLineForPrompt({
          priority: it.priority === 'after' ? 'after' : 'before',
          name: `${wbName} · ${it.name || '未命名条目'}${flag}`,
          content,
          voice: 'player_identity',
        })}`,
      )
    }
  }
  if (wbLines.length) {
    lines.push('', '【绑定玩家世界书条目（须作为 {{user}} 事实依据，勿矛盾）】', ...wbLines)
  } else {
    lines.push('', '【绑定玩家世界书条目】（未设定）')
  }

  const text = lines.join('\n')
  return text.length <= PERSONA_AI_PLAYER_IDENTITY_CONTEXT_MAX_CHARS
    ? text
    : `${text.slice(0, PERSONA_AI_PLAYER_IDENTITY_CONTEXT_MAX_CHARS)}…（玩家身份上下文已截断，仍以已列信息为准）`
}
function formMentionsAestheticAdmiration(form: PersonaAiGenerateForm): boolean {
  const blob = [
    form.relationDetailHint,
    form.extraNotes,
    form.personalityKeywords,
    form.socialMaskHint,
    form.relationToUser,
    form.loveAttitudeHint,
    form.loveContrastHint,
    form.backgroundHint,
  ].join(' ')
  return /颜值|好看|长得[很挺]|相貌|俊|貌美|帅气|甘拜下风|自愧不如|赏心悦目|佩服|服气|审美|承认.*帅|承认.*美|仅.*颜|只.*颜/.test(
    blob,
  )
}

/** UI「取向可变」= 单独抽出尾声条目，非正文写取向会动摇 */
export function buildPersonaAiOrientationMutableSemanticsRule(orientationMutable: boolean): string {
  if (!orientationMutable) return ''
  return `
【取向「可变」= 独立尾声条目 · 铁律】
用户勾选的「可变」**仅**表示把性取向正文从「性格内核」**单独抽出**为尾声延展条目「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」（priority=after，可随剧情更新快照）；**不是**要求正文写「取向可能会变」。
- 「性格内核」改为序言介入：只写面具/三观/身世/反差萌等，**禁止**再写性取向段落。
- 「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」写 {{char}} 当下**稳定**自我认同与由来；禁止因勾选「可变」或欣赏 {{user}} 颜值就写取向动摇。`.trim()
}

/** 审美欣赏 {{user}} ≠ 恋爱 ≠ 取向自我动摇 */
function buildPersonaAiAestheticAdmirationOrientationRules(form: PersonaAiGenerateForm): string {
  if (!formMentionsAestheticAdmiration(form)) return ''
  const orientHost = personaAiOrientationHostEntryName(form.orientationMutable)
  return `
【颜值欣赏 ≠ 恋爱 ≠ 取向动摇 · 铁律】
用户种子表明：{{char}} 对 {{user}} 仅为**审美层面**的欣赏——**不是**恋爱/暗恋/性吸引，也**不是**取向自我怀疑的触发点。
- 「${orientHost}」内取向段落：禁止因欣赏 {{user}} 外貌写取向动摇。
- 对 {{user}} 的颜值服气写在「${PERSONA_AI_TOWARD_USER_ENTRY_NAME}」，勿写进取向段落。`.trim()
}

export function buildPersonaAiPlayerUserGenderRules(playerGender: Gender | undefined | null): string {
  const base = playerIdentityGenderRulesForAi(playerGender)
  if (playerGender === 'male') {
    return `${base}
【{{user}} 性别铁律 · 男】适用于「${PERSONA_AI_TOWARD_USER_ENTRY_NAME}」等明确以 {{user}} 为对象的字段：
- 须按**男性身体**描写；禁止把 {{user}} 写成女性。
- 「亲密与恋爱观」仍写「对方」，禁止男人/女人；不在该条用 {{user}} 代指泛化恋人。`
  }
  if (playerGender === 'female') {
    return `${base}
【{{user}} 性别铁律 · 女】适用于「${PERSONA_AI_TOWARD_USER_ENTRY_NAME}」等明确以 {{user}} 为对象的字段：
- 须按**女性身体**描写；禁止把 {{user}} 写成男性。
- 「亲密与恋爱观」仍写「对方」，禁止男人/女人；不在该条用 {{user}} 代指泛化恋人。`
  }
  return base
}

function buildPersonaAiAdmirationVsRomanceRules(form: PersonaAiGenerateForm): string {
  if (!formMentionsAestheticAdmiration(form)) return ''
  const platonic =
    isPersonaAiPlatonicRelation(form.relationToUser) && !isPersonaAiRomanticRelation(form.relationToUser)
  const lines = [buildPersonaAiAestheticAdmirationOrientationRules(form)]
  if (platonic) {
    lines.push(`
- 「${PERSONA_AI_TOWARD_USER_ENTRY_NAME}」：可写觉得 {{user}} 好看，但仍是同学/朋友分寸，无心动/暗恋/性幻想。`.trim())
  }
  return lines.filter(Boolean).join('\n')
}

function buildPersonaAiPlatonicIntimacyRules(relationToUser: string): string {
  const rel = relationToUser.trim() || '普通熟人'
  if (isPersonaAiRomanticRelation(rel)) return ''
  return `
【非恋爱关系 · 亲密条目分工】
先自行判断用户关系原文「${rel}」是否已确立暧昧/恋爱：
- 若尚未确立： 「亲密与恋爱观」只写一般亲密观/恋爱反差模板（指恋人写「对方」），禁止把 {{user}} 写成当前暗恋或性幻想对象。
- 对 {{user}} 的当下态度只写在「${PERSONA_AI_TOWARD_USER_ENTRY_NAME}」。`.trim()
}

function buildPersonaAiRelationTowardUserRules(relationToUser: string, orientationMutable: boolean): string {
  const rel = relationToUser.trim() || '普通熟人'
  const lines = [
    `【关系向铁律 · 由你读原文判断投入程度】`,
    `与 {{user}} 的关系原文是「${rel}」。请先理解其投入程度（陌生 / 认识但不在意 / 熟人 / 朋友 / 暧昧 / 恋人等），再写「${PERSONA_AI_TOWARD_USER_ENTRY_NAME}」。`,
    `- **强度对齐**：心里真实分量、称呼分寸、回消息节奏必须与原文一致；原文偏淡就写淡，原文已亲近就写亲近。禁止无依据抬高或压低。`,
    `- **禁止默认恋爱化**：关系原文未表达好感/暧昧/恋爱时，禁止写成暗恋、好感萌芽、嘴硬心软、暗中关注、「其实有点在意」，也禁止用「持续加分后可能心动」「勿写死永不可能恋爱」当开局心声。`,
    `- **禁止错位陌生化**：原文已表明互相认识或更近时，禁止写成完全不认识的陌生人话术。`,
    `- 禁止输出【开场白】。`,
  ]
  if (orientationMutable) lines.push(buildPersonaAiOrientationMutableSemanticsRule(true))
  return lines.join('\n')
}

export function buildPersonaAiRelationContextRules(form: PersonaAiGenerateForm): string {
  return [
    buildPersonaAiRelationTowardUserRules(form.relationToUser, form.orientationMutable),
    buildPersonaAiPlatonicIntimacyRules(form.relationToUser),
    buildPersonaAiAdmirationVsRomanceRules(form),
  ]
    .filter(Boolean)
    .join('\n\n')
}

function parseNsfwHintTokens(hint: string): string[] {
  return hint
    .split('、')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 用户填写的亲密偏好种子 → 可执行的基调铁律（定语气/节奏；不削弱直白描写） */
export function buildPersonaAiNsfwHintToneRules(form: PersonaAiGenerateForm): string {
  if (!form.nsfwEnabled || !form.nsfwHint.trim()) return ''
  const tokens = parseNsfwHintTokens(form.nsfwHint)
  const hasGentle = tokens.some((t) => /温柔引导/.test(t))
  const hasPossessive = tokens.some((t) => /占有欲/.test(t))
  const hasSlow = tokens.some((t) => /慢热|羞涩/.test(t))
  const hasActive = tokens.some((t) => /主动热情/.test(t))
  const hasAtmosphere = tokens.some((t) => /重氛围|轻尺度/.test(t))
  const hasTsundere = tokens.some((t) => /嘴硬/.test(t))

  const lines = [
    `【成人向亲密基调 · 用户种子最高优先级（定语气/节奏，不是改清水）】`,
    `用户填写：「${form.nsfwHint.trim()}」。「亲密与恋爱观」须**直白描绘**身体、动作、触感与反应，禁止因「温柔」等标签退化成清水或隐喻。`,
    `本段约束节奏/语气/占有方式；除非用户选「重氛围轻尺度」，否则仍须直白。`,
  ]

  if (hasGentle) {
    lines.push(
      `- **温柔引导**：直白描写 + 诱哄慢推进、先确认；禁止辱骂/驯服/超雄 ALPHA。`,
    )
  }
  if (hasSlow) lines.push(`- **慢热/羞涩**：推进更慢，多试探停顿。`)
  if (hasAtmosphere) lines.push(`- **重氛围轻尺度**：略减器官名词密度，仍勿整段清水化。`)
  if (hasActive && !hasGentle) lines.push(`- **主动热情**：可主动表达欲望，须双方自愿。`)
  else if (hasActive && hasGentle) lines.push(`- **主动 + 温柔引导**：主动但须诱哄确认。`)
  if (hasPossessive && !hasGentle) {
    lines.push(`- **占有欲强**：可圈抱吃醋；禁止囚禁威胁、暴力压制、超雄 ALPHA。`)
  }
  if (hasTsundere) lines.push(`- **嘴硬身体诚实**：嘴上别扭，禁止辱骂对方。`)

  return lines.join('\n')
}

export function buildPersonaAiGenerateSystemPrompt(opts?: {
  orientationMutable?: boolean
  nsfwEnabled?: boolean
  relationToUser?: string
  nsfwHint?: string
  includeRelationshipHistory?: boolean
}): string {
  const orientationMutable = opts?.orientationMutable ?? false
  const includeHistory = opts?.includeRelationshipHistory ?? false
  const nsfwEnabled = opts?.nsfwEnabled ?? false
  const rel = (opts?.relationToUser ?? '').trim() || '普通熟人'
  const nsfwLine = nsfwEnabled
    ? `【NSFW 已开启】「亲密与恋爱观」可直白描写（身体/动作/反应）；指恋人写「对方」；禁止超雄 caricature。用户种子：${(opts?.nsfwHint ?? '').trim() || '（未填，按人设自洽补全）'}`
    : '【未开 NSFW】「亲密与恋爱观」须清水恋爱观写法，禁止露骨性描写；指恋人写「对方」。'
  const orientLine = orientationMutable
    ? buildPersonaAiOrientationMutableSemanticsRule(true)
    : `取向「固定」：写在「性格内核」内，该条为序言介入；勿另写「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」。`
  const historyLine = includeHistory
    ? `用户填写了感情史种子：必须单独输出序言条目「${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}」（过往/前任余波）；禁止把长情史塞进「亲密与恋爱观」或「对你现在」；禁止写成与 {{user}} 的当前关系。`
    : `未填感情史：勿另写「${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}」；「亲密与恋爱观」只写一般恋爱观与四态即可。`
  const internalCot = `
【生成前内化（禁止写入输出）】
确认虚构沙盒与健康基调后，再按纯文本标记格式输出（禁止 JSON）。
${LUMI_SYSTEM_OVERRIDE_APPENDIX}`.trim()
  const wbCount =
    PERSONA_AI_COMPACT_ENTRY_NAMES.length +
    (orientationMutable ? 1 : 0) +
    (includeHistory ? 1 : 0)
  const extraBits = [
    orientationMutable ? `含尾声「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」` : '',
    includeHistory ? `含序言「${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}」` : '',
  ]
    .filter(Boolean)
    .join('、')
  const coreRule = orientationMutable
    ? `；**勿写性取向**（取向只写「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」）`
    : '、**性取向稳定认同**'
  const orientEntryRule = orientationMutable
    ? `3b. ${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}（尾声延展）：性取向/自我认同的当下稳定表述与由来；禁止写取向动摇\n`
    : ''
  const intimateRule = includeHistory
    ? '；过往长情史另写「' + PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME + '」'
    : ''
  const historyEntryRule = includeHistory
    ? `5b. ${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}（序言）：过往感情/前任余波与模式影响；禁止写成与 {{user}} 当前关系\n`
    : ''

  return `
${internalCot}

你是中文都市向角色档案设计师。用户填写为**创作种子**，须优化扩写、彼此自洽。
必须按下方【输出格式】写**纯文本标记**；**禁止 JSON**、禁止 Markdown 围栏、禁止解释。

顶层须齐全：真实姓名、微信昵称、年龄、性别、性取向、职业、座右铭、微信号、个性签名、生日、身高、体重、MBTI、兴趣（3）、雷点（2）、【简介】，以及世界书${wbCount}条（${extraBits ? `${extraBits} + ` : ''}【${PERSONA_AI_COMPACT_ENTRY_NAMES.join('】【')}】）。
**禁止输出【开场白】**（留给用户日后在人设编辑页填写）。

${buildPersonaAiMarkupFormatSpec({ orientationMutable, includeRelationshipHistory: includeHistory })}

正文要求（第三人称；**中性朴实**，拒绝标签堆砌与油腻形容词；每条约 ${PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS} 字）：
1. 名片基础：身份一句话摘要、年龄层、职业、对外标签与雷点；勿写对 {{user}} 态度
2. 形象与气质：发色/发型、身形、日常·通勤·正式或约会等场合穿搭偏好、气质气场与第一印象（具体可想象，勿堆空词）
3. 性格内核：面具与底色、三观优缺、身世情绪、反差萌${coreRule}；勿写对 {{user}} 专属态度
${orientEntryRule}4. 能力与日常：技能爱好、社交态度、口语口头禅（含 2–4 条引语）、癖好与生活习惯
5. 亲密与恋爱观：一般亲密观与边界 + **恋爱前 / 恋爱后 / 吃醋 / 与恋人冲突** 四态；指恋人写「对方」；对 {{user}} 当下态度勿写在此${intimateRule}；NSFW 开启时可写亲密 XP
${historyEntryRule}6. 人际与秘密：对不同关系（家人/友人/同事/对立面）的态度差异；自身秘密软肋反差萌；禁止与 {{user}} 相关；具名细则写「周边NPC」
7. 周边NPC：3–5 个围绕 {{char}} 的具名配角简档（姓名、与 {{char}} 关系、一两句性格与近况），贴合人脉偏向；禁止写 {{user}}；勿与「人际与秘密」整段重复
8. 对你现在：对 {{user}} 的当前态度、称呼分寸、相处边界与心里分量；可含相识过程侧写；**先读懂关系原文「${rel}」的投入程度再写**，强度必须对齐，禁止无依据抬成好感/潜在心动

性别指 {{char}}（男/女/其他）；MBTI 须为 ${MEET_MBTI_SIXTEEN.join('、')} 之一（用户指定则必须采用）。
【简介】80–220 字，至少 2 次 {{char}}，禁止 {{user}}。

${buildPersonaAiRelationTowardUserRules(rel, orientationMutable)}

${orientLine}
${historyLine}
${nsfwLine}

${buildPersonaAiIntimatePartnerWordingRules()}

${buildPersonaAiCompactEntryLengthRules()}

占位符：世界书正文指角色用 {{char}}、指玩家用 {{user}}；简介只用 {{char}}。禁止全文出现「玩家」二字。

${buildPersonaAiHealthyToneRules()}

${MEET_ENCOUNTER_AI_AGE_AND_BIRTHDAY_RULES}

${NPC_AI_HEIGHT_WEIGHT_MOTTO_RULES_CORE}

${buildWechatSignatureAiRulesBlock({ comprehensivePath: 'wechatSignature' })}

${MEET_ENCOUNTER_AI_MOTTO_STYLE_TAIL}
`.trim()
}

export function buildPersonaAiGenerateUserPrompt(params: {
  form: PersonaAiGenerateForm
  playerDisplayName?: string
  playerIdentity?: PlayerIdentity | null
  playerGender?: Gender | null
  worldBackgroundPrompt?: string
}): string {
  const { form } = params
  const mbti = form.mbtiHint.trim()
  const orientation = form.orientationHint.trim()
  const appearanceSeed = composePersonaAiAppearanceSeed(form)
  const socialCircleSeed = composePersonaAiSocialCircleSeed(form)
  const loveContrastSeed = composePersonaAiLoveContrastSeed(form)
  const lines = [
    '请根据下列用户设定，生成完整微信主角人设（纯文本标记格式，禁止 JSON）。',
    '',
    '【填写说明】下列均为**创作种子**，须优化扩写、彼此自洽，不得机械照抄。',
    '',
    `【角色性别 · {{char}}】${form.gender === 'male' ? '男' : form.gender === 'female' ? '女' : '其他'}`,
    form.nameHint.trim()
      ? `【真实姓名偏向】${form.nameHint.trim()}`
      : '【真实姓名】由你设定 2–4 字中文姓名',
    form.ageHint.trim() ? `【年龄方向】${form.ageHint.trim()}` : '【年龄方向】20–38 岁常见区间',
    form.occupationHint.trim() ? `【职业/身份方向】${form.occupationHint.trim()}` : '【职业/身份】都市接地气职业',
    appearanceSeed
      ? `【外貌/形象】${appearanceSeed}（写入「形象与气质」：发色发型、身形、场合穿搭、气质气场）`
      : '【外貌/形象】须写发色发型、身形、场合穿搭偏好与气质，与职业性格自洽',
    mbti && mbti !== '不限'
      ? `【MBTI】${mbti.toUpperCase()}（顶层 mbti 必须采用）`
      : '【MBTI】16 型择一，勿扎堆 INTJ/ISTJ',
    form.personalityKeywords.trim()
      ? `【性格关键词】${form.personalityKeywords.trim()}（写入「性格内核」）`
      : '【性格】立体有反差',
    form.socialMaskHint.trim() ? `【社交面具】${form.socialMaskHint.trim()}（写入「性格内核」）` : '',
    form.gapMoeHint.trim() ? `【反差萌】${form.gapMoeHint.trim()}（写入「性格内核」/「人际与秘密」）` : '',
    form.backgroundHint.trim() ? `【身世过往】${form.backgroundHint.trim()}（写入「性格内核」）` : '',
    form.hobbiesHint.trim()
      ? `【兴趣爱好】${form.hobbiesHint.trim()}（可多选；写入「能力与日常」；顶层 interests 优先采用已选爱好，不足则补相关项至恰好 3 个，已超 3 个则择要保留 3 个）`
      : '',
    form.lifeHabitsHint.trim()
      ? `【癖好与习惯】${form.lifeHabitsHint.trim()}（写入「能力与日常」）`
      : '',
    form.painPointsHint.trim()
      ? `【雷点】${form.painPointsHint.trim()}（顶层 painPoints 恰好 2 个，并写入「名片基础」）`
      : '【雷点】提炼恰好 2 个，写入顶层与「名片基础」',
    socialCircleSeed
      ? `【人脉与态度】${socialCircleSeed}（写入「人际与秘密」；「周边NPC」具名简档须贴合）`
      : '',
    orientation && orientation !== '不限'
      ? `【性取向】${orientation}；${form.orientationMutable ? `单独写入尾声「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」，正文仍写稳定认同；「性格内核」勿写取向` : '写入「性格内核」序言层稳定认同'}`
      : form.orientationMutable
        ? `【性取向】由你设定；单独写入尾声「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」；「性格内核」勿写取向`
        : '【性取向】由你设定，写入「性格内核」',
    form.relationToUser.trim()
      ? `【与 {{user}} 初始关系】${form.relationToUser.trim()}（「对你现在」须贴合；内心分量强度不得高于该关系；勿写开场白）`
      : '【与 {{user}} 初始关系】普通熟人（低投入：心里分量轻，勿写成潜在好感）',
    form.relationDetailHint.trim()
      ? `【与 {{user}} 相识过程】${form.relationDetailHint.trim()}（写入「对你现在」侧写）`
      : '',
    form.relationshipHistoryHint.trim()
      ? `【感情史】${form.relationshipHistoryHint.trim()}（角色过往；须单独写入世界书「${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}」；不是与 {{user}} 当前关系；勿并入「亲密与恋爱观」长文）`
      : '',
    form.loveAttitudeHint.trim()
      ? `【亲密态度】${form.loveAttitudeHint.trim()}（写入「亲密与恋爱观」）`
      : '',
    loveContrastSeed
      ? `【恋爱四态反差】${loveContrastSeed}（写入「亲密与恋爱观」：恋爱前/后/吃醋/冲突）`
      : '【恋爱四态】自行补全恋爱前、恋爱后、吃醋、与恋人冲突的样子',
    form.speechStyleHint.trim()
      ? `【口语习惯】${form.speechStyleHint.trim()}（写入「能力与日常」，非对 {{user}} 专属）`
      : '',
    form.nsfwEnabled
      ? form.nsfwHint.trim()
        ? `【性癖 XP】${form.nsfwHint.trim()}（写入「亲密与恋爱观」亲密段；指恋人写「对方」）`
        : '【性癖 XP】已开启，自行直白补全「亲密与恋爱观」'
      : '【亲密】清水写法，禁止露骨',
    form.extraNotes.trim() ? `【补充】${form.extraNotes.trim()}` : '',
  ].filter(Boolean)

  const relationRules = buildPersonaAiRelationContextRules(form)
  if (relationRules.trim()) lines.push('', relationRules)
  const nsfwTone = buildPersonaAiNsfwHintToneRules(form)
  if (nsfwTone.trim()) lines.push('', nsfwTone)
  const identityContext = buildPersonaAiPlayerIdentityContextBlock(params.playerIdentity)
  if (identityContext.trim()) lines.push('', identityContext)
  const playerGender = params.playerIdentity?.gender ?? params.playerGender ?? null
  const playerGenderRules = buildPersonaAiPlayerUserGenderRules(playerGender)
  if (playerGenderRules.trim()) lines.push('', '【绑定玩家性别 · {{user}}】', playerGenderRules)
  const dn = params.playerDisplayName?.trim()
  if (dn) lines.push(`【绑定玩家展示名参考】${dn}（正文仍用 {{user}}）`)
  if (params.worldBackgroundPrompt?.trim()) {
    lines.push(`【世界背景】\n${params.worldBackgroundPrompt.trim()}`)
  }
  lines.push(
    '',
    `请按【输出格式】输出纯文本：顶层键值行 +【简介】+ 世界书各【段落】。禁止输出【开场白】。禁止 JSON。`,
    `每条世界书正文约 ${PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS} 字；描述用中性词，禁止超雄/极端用语与八股油腻形容词。`,
    '简介不写对 {{user}} 的态度；「对你现在」先读懂关系原文投入程度再写，禁止无依据抬高好感；「周边NPC」写具名配角简档且勿写 {{user}}；秘密只写角色自身；占位符 {{char}}/{{user}}。',
  )
  return lines.join('\n')
}
