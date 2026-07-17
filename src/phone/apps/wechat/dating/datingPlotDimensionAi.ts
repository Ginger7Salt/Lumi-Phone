import { openAiCompatibleChat } from '../newFriendsPersona/ai'
import {
  buildDatingCharUserPerspectiveDirective,
  expandCharUserPlaceholders,
} from '../charUserPlaceholders'
import type { ApiConfig, ApiConfigCore } from '../../api/types'
import { splitDatingAssistantOutput } from './plotCoT'
import {
  DATING_AI_MAX_OUTPUT_TOKENS,
  type CharacterInfo,
  type NarrativePerspective,
  type PlotDimensionKind,
} from './types'

export const PLOT_DIMENSION_LABELS: Record<PlotDimensionKind, string> = {
  parallel: '平行事件',
  if: 'IF线',
}

function buildDimensionSystemPrompt(
  kind: PlotDimensionKind,
  character: CharacterInfo,
  opts: {
    godPerspective: boolean
    mainCharacterOffstage: boolean
    perspective: NarrativePerspective
    playerIdentityCardName?: string | null
  },
): string {
  const charName = character.realName.trim() || '对方'
  const userName = String(opts.playerIdentityCardName ?? '').trim() || '用户'
  const cuDirective =
    kind === 'parallel' ? '' : buildDatingCharUserPerspectiveDirective(charName, userName)

  const modeNote =
    kind === 'parallel'
      ? `【平行事件·叙述立场】本任务是锚点正文的**屏外同步切片**：用第三人称旁白写「另一边」正在发生的事；**不是**锚点内任何角色的视角，也**不是**对玩家的第二人称互动。`
      : opts.godPerspective
        ? `本轮存档为上帝视角：写屏外可见场景，玩家不得与约会对象同场同框。`
        : opts.mainCharacterOffstage
          ? `本轮存档为主角色缺席：约会主角色 ${charName} 不得出场、不得被写成在场互动对象。`
          : `本轮存档为角色视角：须与锚点剧情的人称、关系阶段一致。`

  const taskBlock =
    kind === 'parallel'
      ? `【任务·平行事件·同步铁律】锚点正文描写的是**某一剧情时刻 T** 正在发生的事。你必须写 **T 同一时刻** 在**完全另一处**同时发生的事。
- **时间锁**：与锚点**同时发生**（与此同时 / 同一时刻 / 另一边）。**禁止**写锚点之前或之后；禁止续写、闪回、后果收束。
- **空间锁**：地点/线程须与锚点场景**物理分离**（不同房间、不同楼层、不同建筑、不同城市等），不得与锚点同框同场。
- **人物锁（最高优先级）**：先识别锚点正文中**已出场、在场、正在互动或被描写当下言行**的全部角色（含玩家、约会对象 ${charName}、所有具名/可核对 NPC）。
  - 平行事件正文**不得**让上述任一角色：出场、开口对白、在场被描写、实时通话/同框连线、或以「正在锚点里做什么」被平行场景人物直接目击。
  - **只允许**锚点 cast **以外**的其他人物/群体在别处同时发生什么（真正的屏外 elsewhere）。
  - 锚点内角色**不知道**本切片内容；本切片也**不得**写成他们全知旁观或复述锚点细节。
- **因果锁**：不得改写锚点已定事实；平行切片不得替代主线正文。`
      : `【任务·IF线】从锚点剧情节点出发，写一段**假设分歧**后的虚构分支片段（「若当时……」）。
- 明确是 IF/假设线想象，**不影响**主线已定 canon；勿写成主线已发生事实。
- 须点出或暗示分歧点（一句即可），再展开该分支下的一小段剧情。`

  const perspectiveRule =
    kind === 'parallel'
      ? `人称：第三人称旁白写**锚点 cast 以外**的同步场景；禁止用「你」指玩家；禁止 ${charName} 及锚点正文已出现角色出场。`
      : opts.perspective === 'first'
        ? '人称：第一人称（我/我们）为主。'
        : opts.perspective === 'third'
          ? '人称：第三人称旁观为主。'
          : '人称：第二人称（你）代入玩家为主；旁白指玩家须用「你」。'

  const raw = `${cuDirective}你是线下约会「${PLOT_DIMENSION_LABELS[kind]}」辅助写手。
${modeNote}
${perspectiveRule}
${taskBlock}

【禁止 MBTI 出戏】旁白与对白中禁止写出 ENFP/INFJ 等四字母或「快乐修勾」「INFJ 清冷感」等类型学套话。

【输出铁律】
- **禁止**输出 \`<thinking>\`、思维链、JSON、Markdown 围栏或任何解释性前后缀。
- **只输出**一段可直接阅读的剧情正文。
- 对白用弯引号 “…” 或半角直引号 "..." 写在段落内；**禁止**日式直角引号「…」；禁止 PlotDirectionOptions / HTML / 选项串。`

  return expandCharUserPlaceholders(raw, { charName, userName })
}

export async function generateDatingPlotDimensionAi(params: {
  kind: PlotDimensionKind
  character: CharacterInfo
  anchorPlotBody: string
  tailContext: string
  writingGuide: string
  lengthTargetChars: number
  godPerspective: boolean
  mainCharacterOffstage: boolean
  perspective: NarrativePerspective
  apiConfig: ApiConfigCore | null
  playerIdentityCardName?: string | null
}): Promise<string> {
  const {
    kind,
    character,
    anchorPlotBody,
    tailContext,
    writingGuide,
    lengthTargetChars,
    godPerspective,
    mainCharacterOffstage,
    perspective,
    apiConfig,
    playerIdentityCardName,
  } = params
  const target = Math.max(1, Math.round(Number(lengthTargetChars) || 500))
  const minChars = Math.max(1, Math.round(target * 0.85))
  const maxChars = Math.round(target * 1.15)
  const guide = String(writingGuide ?? '').trim()

  if (!apiConfig?.apiUrl || !apiConfig?.apiKey || !apiConfig?.modelId) {
    await new Promise((r) => window.setTimeout(r, 280))
    const label = PLOT_DIMENSION_LABELS[kind]
    const hint = guide ? `（引导：${guide.slice(0, 48)}）` : ''
    return `[占位·${label}]${hint}\n\n与此同时，另一栋楼的走廊里，几个与此无关的工作人员正压低声音交换着只属于他们那一角的讯息。`
  }

  const system = buildDimensionSystemPrompt(kind, character, {
    godPerspective,
    mainCharacterOffstage,
    perspective,
    playerIdentityCardName,
  })

  const parallelUserBlock =
    kind === 'parallel'
      ? `【平行事件·执行清单】
1. 从下方锚点正文列出「已在场/已出场」角色名单（含玩家与 ${character.realName.trim() || '约会对象'}）。
2. 正文只写**名单之外**的其他人在**另一地点**、与锚点**同一时刻**的同步切片。
3. 禁止锚点 cast 出场、对白、被目击、实时通话同框；禁止写锚点之前/之后。
4. 锚点内角色不知晓本切片（屏外非全知信息，不是他们的视角）。

`
      : ''

  const userRaw =
    `角色：${character.realName}\n标签：${character.identityTags.join('、') || '无'}\n人设摘要：${character.prompt.slice(0, 900)}\n\n` +
    `【近端剧情摘录（仅供承接语气，勿复述）】\n${tailContext.slice(0, 2400)}\n\n` +
    `【锚点剧情正文（本${PLOT_DIMENSION_LABELS[kind]}的参照节点）】\n${anchorPlotBody.slice(0, 4200)}\n\n` +
    parallelUserBlock +
    `【篇幅】正文约 ${minChars}～${maxChars} 汉字。\n` +
    (guide ? `【用户写作引导·须优先服从】\n${guide.slice(0, 480)}\n` : '【用户写作引导】（未填写，按锚点自然延伸即可）\n') +
    `请直接输出正文。`

  const user = expandCharUserPlaceholders(userRaw, {
    charName: character.realName.trim() || '对方',
    userName: String(playerIdentityCardName ?? '').trim() || '用户',
  })

  const raw = await openAiCompatibleChat(
    apiConfig as ApiConfig,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: kind === 'if' ? 0.78 : 0.68, max_tokens: DATING_AI_MAX_OUTPUT_TOKENS },
  )

  const split = splitDatingAssistantOutput(raw)
  const body = (split.content || split.logicPass || raw).trim()
  if (!body) throw new Error(`${PLOT_DIMENSION_LABELS[kind]}生成失败：模型未返回正文`)
  return body
}
