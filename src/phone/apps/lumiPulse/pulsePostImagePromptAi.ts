import type { ApiConfig } from '../api/types'
import type { Character, PlayerIdentity } from '../wechat/newFriendsPersona/types'
import { openAiCompatibleChatLenient } from '../wechat/newFriendsPersona/ai'
import { buildDatingPlotImagePromptCastBlock } from '../wechat/dating/datingPlotImageCot'
import {
  generateDatingPlotImagePrompts,
  type DatingPlotImagePromptGenResult,
} from '../wechat/dating/datingPlotImagePromptAi'
import { parseDatingPlotImageModelOutput } from '../wechat/dating/datingPlotImageParse'

/** 占位中文是否更像手机随手拍 / 自拍 / 对镜（走线上角色发图模版） */
export function isPulsePhoneStyleImageBrief(description: string): boolean {
  const t = description.trim()
  if (!t) return false
  return /自拍|对镜|镜子|镜前|手机拍|随手拍|前置|后置摄像头|朋友圈风|晒图|比耶|剪刀手|举杯自拍|怼脸|拍自己|镜中|mirror\s*selfie|selfie/i.test(
    t,
  )
}

function buildPulsePhoneFeedImagePromptSystem(count: number): string {
  return `你是微博/线上角色发图 prompt 生成器（与私聊/朋友圈「角色发图」同一套手机画面逻辑）。
输入是**给用户看的通俗中文画面描述**（占位文案），不是生图提示词。
任务：把它扩写成恰好 ${count} 组 「<imgthink>推演 + <image>全英文 comma-separated tags」；英文 tags 才发往生图 API。

【硬性】
- <image> 内**只写英文 tags**，禁止中文、禁止自然语言整句。
- 占位描述里的「对镜自拍 / 比耶 / 拿着××」是意图，须译成可见像素事实（mirror selfie shot, peace sign, holding strawberry milk carton 等）。
- **禁止**把占位描述原样当 prompt；禁止 masterpiece / best quality / 8k 等注水词。
- 有参考图倾向时写 reference character；无参考图写 1boy/1girl + 必要外观 tag（勿另编重大外貌）。
- 自拍/对镜：须含 selfie shot 或 mirror selfie shot；默认 upper body，除非描述明确怼脸。
- 非自拍的随手拍：只写画面内容；可像手机抓拍，但不要写 phone visible / holding phone 元描述。
- 多人写清 left/center/right；禁止 fused bodies。

【输出格式】
<imgthink>中文短推演</imgthink>
<image>english, comma, separated, tags</image>
共恰好 ${count} 组。禁止 JSON、禁止前后解释。`
}

/** 微博线上发图风：通俗中文占位 → 英文 character_media tags */
export async function generatePulsePhoneFeedImagePrompts(params: {
  apiConfig: ApiConfig
  description: string
  character?: Character | null
  playerIdentity?: PlayerIdentity | null
  playerDisplayName?: string
  narrativeContext?: string
}): Promise<DatingPlotImagePromptGenResult> {
  const body = params.description.trim().slice(0, 1200)
  if (!body) return { prompts: [], imgThinks: [] }

  const castBlock = buildDatingPlotImagePromptCastBlock(
    params.character,
    params.playerIdentity,
    params.playerDisplayName,
  )
  const narrative = params.narrativeContext?.trim().slice(0, 1200) ?? ''

  const user = `【Cast / DNA 参考】
${castBlock}

${narrative ? `【帖文语境】\n${narrative}\n\n` : ''}【通俗画面描述（占位，禁止照抄硬译）】
${body}

请输出恰好 1 组：<imgthink>…</imgthink> + <image>英文 tags</image>。`

  const raw = await openAiCompatibleChatLenient(
    params.apiConfig,
    [
      { role: 'system', content: buildPulsePhoneFeedImagePromptSystem(1) },
      { role: 'user', content: user },
    ],
    { temperature: 0.72 },
  )

  return parseDatingPlotImageModelOutput(raw, 1)
}

/** 微博电影镜头风：通俗中文占位 → 英文 dating_plot tags */
export async function generatePulseCinematicFeedImagePrompts(params: {
  apiConfig: ApiConfig
  description: string
  character?: Character | null
  playerIdentity?: PlayerIdentity | null
  playerDisplayName?: string
  narrativeContext?: string
}): Promise<DatingPlotImagePromptGenResult> {
  return generateDatingPlotImagePrompts({
    apiConfig: params.apiConfig,
    plotBody: params.description,
    inputKind: 'visual_brief',
    narrativeContext: params.narrativeContext,
    character: params.character,
    playerIdentity: params.playerIdentity,
    playerDisplayName: params.playerDisplayName,
    count: 1,
  })
}
