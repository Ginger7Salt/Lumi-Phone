/** 冲浪网友式随机昵称（匿名评论用） */
const PULSE_SURF_NICK_PREFIX = [
  '路过的',
  '蹲蹲',
  '吃瓜',
  '摸鱼',
  '匿名',
  '深夜',
  '云端',
  '街头',
  '地铁',
  '课间',
  '加班',
  '下雨天',
  '月亮',
  '柠檬',
  '薯片',
  '清醒',
  '沉默',
  '热心',
  '围观',
  '随手',
] as const

const PULSE_SURF_NICK_SUFFIX = [
  '猫',
  '狗',
  '企鹅',
  '鱼',
  '熊',
  '兔子',
  '乌鸦',
  '鹅',
  '狐',
  '蛙',
  '青年',
  '同学',
  '打工人',
  '路人甲',
  '路人乙',
  '旁观者',
  '观众席',
  '键盘侠暂退',
  '潜水员',
  '刷到了',
  '已老实',
  '不说话',
  '有话说',
] as const

/** 仅本机评论区展示：一眼能认出是本人匿名 */
export const PULSE_PLAYER_ANONYMOUS_DISPLAY_NAME = '匿名冲浪（我）'

export function inventPulseSurfNetizenNick(seed?: string): string {
  const s = String(seed ?? `${Date.now()}-${Math.random()}`)
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const a = Math.abs(h)
  const prefix = PULSE_SURF_NICK_PREFIX[a % PULSE_SURF_NICK_PREFIX.length]!
  const suffix = PULSE_SURF_NICK_SUFFIX[Math.floor(a / 17) % PULSE_SURF_NICK_SUFFIX.length]!
  const n = (a % 90) + 10
  return `${prefix}${suffix}${n}`.slice(0, 16)
}

/**
 * 玩家匿名发言落库用的稳定网友昵称（给 AI 看像普通路人；
 * 同一玩家每次相同）。
 */
export function inventPlayerAnonymousSurfNick(playerPovId: string): string {
  const id = playerPovId.trim() || 'player'
  return inventPulseSurfNetizenNick(`pulse-player-anon-nick:${id}`)
}

/** 玩家匿名头像落库 seed（稳定）；展示层再叠「我」角标 */
export function playerAnonymousSurfAvatarSeed(playerPovId: string): string {
  const id = playerPovId.trim() || 'player'
  return `pulse-player-anon-avatar:${id}`
}

export function isPulsePlayerAnonymousComment(
  comment: { anonymousByPlayerId?: string },
  currentPlayerPovId: string | null | undefined,
): boolean {
  const mine = currentPlayerPovId?.trim()
  const anon = comment.anonymousByPlayerId?.trim()
  return Boolean(mine && anon && mine === anon)
}
