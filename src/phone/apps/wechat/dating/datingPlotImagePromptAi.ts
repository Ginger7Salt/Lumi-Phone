import type { ApiConfig } from '../../api/types'
import type { Character, PlayerIdentity } from '../newFriendsPersona/types'
import { openAiCompatibleChatLenient } from '../newFriendsPersona/ai'
import {
  buildDatingPlotImagePromptCastBlock,
  buildDatingPlotImagePromptSystem,
  buildDatingPlotImagePromptSystemForVisualBrief,
  formatDatingPlotVisualHistory,
} from './datingPlotImageCot'
import { parseDatingPlotImageModelOutput } from './datingPlotImageParse'

export type DatingPlotImagePromptGenResult = {
  prompts: string[]
  /** 已从最终链路剥离，不展示给用户 */
  imgThinks: string[]
}

export async function generateDatingPlotImagePrompts(params: {
  apiConfig: ApiConfig
  plotBody: string
  character?: Character | null
  playerIdentity?: PlayerIdentity | null
  playerDisplayName?: string
  count: number
  /** 最近几条配图 prompt，用于视觉连续性 */
  recentVisualPrompts?: string[]
  /**
   * plot_body：约会剧情正文忠实视觉化（默认）
   * visual_brief：中文画面意图备忘 → 电影镜头扩写（微博配图等）
   */
  inputKind?: 'plot_body' | 'visual_brief'
  /** visual_brief 时可附带帖文等叙事语境 */
  narrativeContext?: string
}): Promise<DatingPlotImagePromptGenResult> {
  const count = Math.max(1, Math.min(6, Math.round(params.count)))
  const body = params.plotBody.trim().slice(0, 2800)
  if (!body) return { prompts: [], imgThinks: [] }

  const inputKind = params.inputKind ?? 'plot_body'
  const system =
    inputKind === 'visual_brief'
      ? buildDatingPlotImagePromptSystemForVisualBrief(count)
      : buildDatingPlotImagePromptSystem(count)
  const castBlock = buildDatingPlotImagePromptCastBlock(
    params.character,
    params.playerIdentity,
    params.playerDisplayName,
  )
  const visualHistory = formatDatingPlotVisualHistory(params.recentVisualPrompts ?? [])
  const narrative = params.narrativeContext?.trim().slice(0, 1800) ?? ''

  const user =
    inputKind === 'visual_brief'
      ? `【Cast DNA（若有参考图 / DNA 须锁定）】
${castBlock}

【上文配图记录（视觉连续性参考）】
${visualHistory}

${narrative ? `【叙事语境（帖文/相关正文，供取材情绪与场景，勿写成自拍 POV）】\n${narrative}\n\n` : ''}【画面意图备忘（中文粗描述，禁止照抄硬译；须按电影镜头扩写）】
${body}

请输出恰好 ${count} 组：<imgthink>推演</imgthink> + <image>英文 tags</image>。`
      : `【Cast DNA（约会主角 + 玩家 + 多人规则）】
${castBlock}

【上文配图记录（视觉连续性参考）】
${visualHistory}

【本段剧情正文（只准视觉化下文已写内容）】
${body}

请输出恰好 ${count} 组：<imgthink>推演</imgthink> + <image>英文 tags</image>。`

  const raw = await openAiCompatibleChatLenient(
    params.apiConfig,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: inputKind === 'visual_brief' ? 0.78 : 0.68 },
  )

  const parsed = parseDatingPlotImageModelOutput(raw, count)
  if (!parsed.prompts.length) {
    console.warn('[dating] plot image prompt parse yielded 0 tags; imgthink blocks=', parsed.imgThinks.length)
  }
  return parsed
}
