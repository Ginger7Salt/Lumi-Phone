import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { Character } from '../wechat/newFriendsPersona/types'
import { formatWorldBackgroundForPrompt } from '../wechat/newFriendsPersona/worldBackgroundFormat'
import { buildWorldBookText } from '../wechat/wechatChatAi'

/** 加载主要角色人设摘要，供微博个人主页 AI 生成使用 */
export async function loadPulseCharacterPersonaContext(characterId: string): Promise<{
  character: Character | null
  personaSummary: string
}> {
  const cid = characterId.trim()
  if (!cid) return { character: null, personaSummary: '' }

  const character = await personaDb.getCharacter(cid)
  if (!character) return { character: null, personaSummary: '' }

  let worldBackgroundBlock = ''
  if (character.worldBackgroundEnabled !== false && character.worldBackgroundId?.trim()) {
    const wb = await personaDb.getWorldBackground(character.worldBackgroundId.trim())
    const block = formatWorldBackgroundForPrompt(wb)
    if (block.trim()) worldBackgroundBlock = block
  }

  const worldBook = buildWorldBookText(character, 2400)
  const lines = [
    `姓名：${character.name?.trim() || '未命名'}`,
    character.wechatNickname?.trim() ? `微博/社交昵称气质参考：${character.wechatNickname.trim()}` : '',
    character.identity?.trim() ? `身份：${character.identity.trim()}` : '',
    character.mbti?.trim() ? `MBTI：${character.mbti.trim()}` : '',
    worldBackgroundBlock ? `【世界背景】\n${worldBackgroundBlock}` : '',
    worldBook ? `【世界书人设】\n${worldBook}` : '',
  ].filter(Boolean)

  return { character, personaSummary: lines.join('\n') }
}
