import { buildProducerContextBlock, useSimulatorStore } from '../sandbox/starMaker/useSimulatorStore'

/**
 * 微信私聊 AI 偏置：当对话人设与金牌制作人旗下艺人关联时，注入艺人上下文。
 */
export function loadStarMakerAgencyReplyBias(characterId: string): string {
  const id = characterId?.trim()
  if (!id) return ''
  const artist = useSimulatorStore.getState().findArtistByCharacterId(id)
  if (!artist) return ''
  return buildProducerContextBlock(artist)
}
