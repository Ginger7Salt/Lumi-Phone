import type { WeChatLocationPayload } from '../newFriendsPersona/types'

function parseDistanceKm(payload: WeChatLocationPayload): number | null {
  if (typeof payload.distanceMeters === 'number' && Number.isFinite(payload.distanceMeters)) {
    return payload.distanceMeters / 1000
  }
  const m = /^([\d,.]+)\s*KM$/i.exec(payload.distance.trim())
  if (m) {
    const n = Number(m[1]!.replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  if (/unknown/i.test(payload.distance)) return null
  return null
}

/** 注入 AI 对话 transcript · 用户发给角色的位置 */
export function formatLocationShareAiTranscriptLine(
  payload: WeChatLocationPayload,
  from: 'self' | 'other' = 'self',
): string {
  if (from === 'other') return formatCharacterLocationShareAiTranscriptLine(payload)
  const name = payload.name.trim()
  const address = payload.address?.trim()
  const place = address ? `${name} — ${address}` : name
  const dist = payload.distance.trim()
  return `（系统关键事件：用户向你共享了TA的实时坐标）地点：【${place}】。TA距离你的物理距离显示为【${dist}】。请结合人设对距离与地点作出真实反应。`
}

/** 注入 AI 对话 transcript · 角色发给用户的位置 */
export function formatCharacterLocationShareAiTranscriptLine(payload: WeChatLocationPayload): string {
  const name = payload.name.trim()
  const address = payload.address?.trim()
  const place = address ? `${name} — ${address}` : name
  const dist = payload.distance.trim()
  return `（系统关键事件：你向对方共享了你的坐标覆写位置）地点：【${place}】。对方界面显示 TARGET DISTANCE 为【${dist}】。此为你主动发送的位置卡，不是真实 GPS。`
}

/** 位置试探引擎：供 reply output prompt 附录 */
export function buildLocationShareAiDirectiveBlock(payload: WeChatLocationPayload): string {
  const name = payload.name.trim()
  const address = payload.address?.trim() || '（未填写详细坐标）'
  const dist = payload.distance.trim()
  const km = parseDistanceKm(payload)
  let proximityHint = ''
  if (km != null) {
    if (km < 1) {
      proximityHint =
        '距离极近（< 1 km）：可表现震惊、立刻去找对方、或让对方站在原地别动等强烈现场感。'
    } else if (km > 500) {
      proximityHint = '距离极远：可表现错愕、异地牵挂、或质疑为何出现在如此远的位置。'
    } else if (km >= 1 && km <= 15) {
      proximityHint = '同城/近郊距离：可表现方便与否、是否要约见、或对具体场所的在意。'
    }
  } else {
    proximityHint = '距离未知：可对人设合理地追问或忽略数值，但仍须回应地点本身。'
  }

  return `【系统关键事件：用户向你共享了TA的实时坐标】
地点：【${name} — ${address}】。
重点注意：TA距离你的物理距离显示为【${dist}】。
${proximityHint}
请结合你的人设给出真实反应；回复须自然提到该距离或地点，禁止假装已打开真实地图导航。`
}
