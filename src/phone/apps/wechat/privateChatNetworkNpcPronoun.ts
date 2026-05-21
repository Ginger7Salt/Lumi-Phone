import { personaDb } from './newFriendsPersona/idb'
import type { Character, Gender } from './newFriendsPersona/types'
import { genderLabelZh } from './newFriendsPersona/utils'

function thirdPersonPronounForGender(g: Gender | null | undefined): '他' | '她' | '其' {
  if (g === 'female') return '她'
  if (g === 'male') return '他'
  return '其'
}

/** 私聊对象所属人脉档案根 id（NPC 用 generatedForCharacterId，主角用自身 id 且名下有 NPC）。 */
export async function resolvePrivateChatNetworkRootId(
  character: Character | null | undefined,
): Promise<string | null> {
  const cid = character?.id?.trim()
  if (!cid) return null
  const gen = character?.generatedForCharacterId?.trim()
  if (gen) return gen
  try {
    const npcs = await personaDb.listNpcsFor(cid)
    if (npcs.length > 0) return cid
  } catch {
    /* ignore */
  }
  return null
}

/**
 * 私聊：同人脉圈第三人他/她表，避免模型把用户本人人称（她）套到司予等男性 NPC 上。
 */
export async function buildPrivateChatNetworkNpcPronounBlock(params: {
  character: Character | null | undefined
  /** 由调用方注入 {@link buildWeChatPlayerThirdPersonPronounIronRule}，避免模块循环依赖 */
  playerThirdPersonRule?: string
}): Promise<string> {
  const selfId = params.character?.id?.trim() || ''
  const rootId = await resolvePrivateChatNetworkRootId(params.character)
  if (!rootId) return ''

  type Row = { name: string; gender: Gender; pronoun: '他' | '她' | '其'; isSelf: boolean }
  const rows: Row[] = []

  try {
    const root = await personaDb.getCharacter(rootId)
    if (root?.id?.trim() && root.id.trim() !== selfId) {
      const nm = (root.name || root.wechatNickname || '').trim() || '档案主角'
      rows.push({
        name: nm,
        gender: root.gender,
        pronoun: thirdPersonPronounForGender(root.gender),
        isSelf: false,
      })
    }
    const npcs = await personaDb.listNpcsFor(rootId)
    for (const n of npcs) {
      const nid = n.id?.trim()
      if (!nid) continue
      const nm = (n.name || n.wechatNickname || '').trim() || '未命名'
      rows.push({
        name: nm,
        gender: n.gender,
        pronoun: thirdPersonPronounForGender(n.gender),
        isSelf: nid === selfId,
      })
    }
  } catch {
    return ''
  }

  const thirdParties = rows.filter((r) => !r.isSelf)
  if (!thirdParties.length) return ''

  const playerRule = params.playerThirdPersonRule?.trim() || ''
  const lines = rows.map((r) => {
    const tag = r.isSelf ? '（**当前会话对方·即你**，自称用「我」）' : ''
    return `- **${r.name}**：档案性别 ${genderLabelZh(r.gender)}；转述/背称时用「${r.pronoun}」${tag}`
  })

  return (
    `\n\n---\n【同人脉 · 第三人他/她分轨（必守）】\n` +
    `你与用户聊到的下列姓名来自**同一条人脉档案**。背称或议论他们时，**必须**用表中与姓名绑定的「他/她」，**禁止**把【用户本人】的人称套到第三者身上。\n` +
    (playerRule.trim() ? `${playerRule.trim()}` : '') +
    `${lines.join('\n')}\n` +
    `- **示例**：用户问「司予的检讨书？」且表中司予为**男** → 须写「他也没心思写」「我帮**他**代劳」；**禁止**写「她」除非该姓名在表中为女。\n` +
    `- 勿因「检讨书」「闺蜜」「林淑华催得紧」等剧情臆测司予等人为女性；以本表档案性别为准。\n`
  )
}
