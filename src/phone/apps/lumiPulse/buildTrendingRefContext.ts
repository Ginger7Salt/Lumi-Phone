import {
  formatRecentAiRoundsPrivateChatByCharacter,
  formatRecentOfflinePlotsAiRoundsReference,
} from '../wechat/memory/recentAiRoundsReferencePrompt'
import { loadPulseCharacterPersonaContext } from './pulseProfilePersona'

const REF_TOTAL_MAX_CHARS = 18_000
const REF_PER_CHAR_MIN = 2_400
/** 单角色人设块上限（档案+世界书+用户身份） */
const PERSONA_PER_CHAR_MAX = 6_500

export type TrendingRefCharacter = {
  characterId: string
  name: string
}

/**
 * 热搜演化上下文：所选角色的人设/世界书/（可选）用户身份 +（可选）近期私聊与线下约会剧情。
 * 人设始终注入；剧情轮数 = 0 时跳过对应剧情块。
 */
export async function buildTrendingRefContext(params: {
  refCharacters: TrendingRefCharacter[]
  chatRefRounds: number
  datingRefRounds: number
  /** 是否注入绑定用户身份；默认 true */
  includePlayerIdentity?: boolean
}): Promise<string> {
  const chars = params.refCharacters
    .map((c) => ({
      characterId: c.characterId.trim(),
      name: c.name.trim() || '角色',
    }))
    .filter((c) => c.characterId)
  if (!chars.length) return ''

  const chatRounds = Math.max(0, Math.floor(params.chatRefRounds))
  const datingRounds = Math.max(0, Math.floor(params.datingRefRounds))
  const includePlayerIdentity = params.includePlayerIdentity !== false

  const perCap = Math.max(
    REF_PER_CHAR_MIN,
    Math.floor(REF_TOTAL_MAX_CHARS / Math.max(1, chars.length)),
  )
  const personaCap = Math.min(PERSONA_PER_CHAR_MAX, Math.floor(perCap * 0.62))
  const plotCap = Math.max(600, perCap - personaCap)

  const blocks = await Promise.all(
    chars.map(async (c) => {
      const halfPlot = Math.floor(plotCap / 2)
      const [{ personaSummary }, chatBlock, datingBlock] = await Promise.all([
        loadPulseCharacterPersonaContext(c.characterId, {
          bioMaxChars: Math.floor(personaCap * 0.35),
          worldBookMaxChars: Math.floor(personaCap * 0.4),
          worldBackgroundMaxChars: Math.floor(personaCap * 0.25),
          includeBoundPlayerIdentity: includePlayerIdentity,
        }),
        chatRounds > 0
          ? formatRecentAiRoundsPrivateChatByCharacter({
              characterId: c.characterId,
              retainAiRounds: chatRounds,
              maxChars: halfPlot,
            })
          : Promise.resolve(''),
        datingRounds > 0
          ? formatRecentOfflinePlotsAiRoundsReference(
              c.characterId,
              c.name,
              halfPlot,
              null,
              datingRounds,
            )
          : Promise.resolve(''),
      ])

      const persona = personaSummary.trim().slice(0, personaCap)
      const plot = [chatBlock, datingBlock].filter(Boolean).join('\n\n').trim()

      const parts: string[] = []
      if (persona) {
        parts.push(persona)
      } else {
        parts.push(
          `【参考角色：${c.name}】\n（未读到可用的角色档案 / 世界书；禁止凭空编造该角色人设）`,
        )
      }
      if (plot) {
        parts.push(`【近期剧情参考｜该角色】\n${plot}`)
      } else if (chatRounds > 0 || datingRounds > 0) {
        parts.push(`【近期剧情参考｜该角色】\n（该角色近期暂无私聊或线下剧情可引用）`)
      }
      return parts.join('\n\n')
    }),
  )

  return blocks.filter(Boolean).join('\n\n——\n\n').trim()
}
