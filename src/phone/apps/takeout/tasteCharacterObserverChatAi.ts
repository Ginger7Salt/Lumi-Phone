import { loadResolvedApiConfig } from '../api/loadResolvedApiConfig'
import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
import { formatCharacterRemarkForObserverPrompt } from './characterTakeoutRemark'
import { pickCourierName } from './tasteDeliveryTracking'
import { resolveOrderRealRecipientName, resolveOrderRecipientNickname } from './tasteDeliveryRecipient'
import {
  loadTasteObserverChatPersonaContext,
} from './tasteObserverChatPersona'
import { loadTasteObserverChatMemoryPack } from './tasteObserverChatMemory'
import type { TasteChatMessage, TasteOrderPayload } from './types'

type ObserverKind = 'character-merchant' | 'character-courier'

type AiLine = { speaker: 'character' | 'peer'; peerName?: string; text: string }

function stripJsonFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  return m ? m[1].trim() : t
}

function msgId(threadId: string, index: number): string {
  return `ai-${threadId.slice(-8)}-${index}-${Math.random().toString(36).slice(2, 7)}`
}

function itemSummary(order: TasteOrderPayload): string {
  const parts = order.items.map((item) =>
    item.quantity > 1 ? `${item.name}×${item.quantity}` : item.name,
  )
  if (parts.length <= 3) return parts.join('、')
  return `${parts.slice(0, 3).join('、')}等 ${order.itemCount} 件`
}

function normalizeAiLines(raw: unknown): AiLine[] {
  const root = typeof raw === 'object' && raw !== null ? raw : null
  const arr = Array.isArray(raw)
    ? raw
    : Array.isArray((root as { messages?: unknown })?.messages)
      ? (root as { messages: unknown[] }).messages
      : null
  if (!arr?.length) return []

  const lines: AiLine[] = []
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue
    const r = row as { speaker?: unknown; from?: unknown; peerName?: unknown; senderName?: unknown; text?: unknown }
    const text = String(r.text ?? '').trim()
    if (!text) continue
    const speakerRaw = String(r.speaker ?? r.from ?? '').trim().toLowerCase()
    const speaker: AiLine['speaker'] =
      speakerRaw === 'character' || speakerRaw === '角色' ? 'character' : 'peer'
    const peerName = String(r.peerName ?? r.senderName ?? '').trim() || undefined
    lines.push({ speaker, peerName, text: text.slice(0, 280) })
  }
  return lines.slice(0, 16)
}

function assignTimestamps(
  threadId: string,
  lines: AiLine[],
  characterName: string,
  endTs: number,
  gapMs: number,
): TasteChatMessage[] {
  const startTs = endTs - gapMs * Math.max(lines.length, 1)
  return lines.map((line, index) => ({
    id: msgId(threadId, index),
    threadId,
    from: line.speaker,
    text: line.text,
    senderName: line.speaker === 'peer' ? line.peerName : characterName,
    ts: startTs + index * gapMs + Math.floor(Math.random() * 6000),
  }))
}

function buildPersonaSections(
  ctx: Awaited<ReturnType<typeof loadTasteObserverChatPersonaContext>>,
  memoryBlock: string,
): string {
  return [
    ctx.personaGuardBlock,
    ctx.characterPersonaBlock,
    ctx.playerPersonaBlock,
    ctx.relationshipBlock,
    memoryBlock.trim()
      ? `${memoryBlock.trim()}\n（↑ 与线上私聊同源：含关键词命中与向量语义召回的长期记忆；生成角色与商家/骑手对话时须与此一致，可含蓄体现近期关系与承诺。）`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

function buildMerchantPrompt(
  order: TasteOrderPayload,
  ctx: Awaited<ReturnType<typeof loadTasteObserverChatPersonaContext>>,
  memoryBlock: string,
): string {
  const merchantName = `${order.storeName}·店长`
  const slipRecipient = resolveOrderRecipientNickname(order)
  const realRecipient = resolveOrderRealRecipientName(order)
  const remarkBlock = formatCharacterRemarkForObserverPrompt(order.remark, slipRecipient)
  const personaSections = buildPersonaSections(ctx, memoryBlock)

  return `【场景】微信私聊 · 角色「${ctx.characterName}」**已在寻味平台完成下单**（菜品、小票寄语等均已写入订单并由系统**自动出票**），现与商家跟进确认，**不是**在聊天里找商家点菜下单。
【商家】${merchantName}
【已下订单（系统内，对话仅核对勿重选）】${itemSummary(order)}，合计 ¥${order.total.toFixed(2)}
【收货名（外卖单可见）】${slipRecipient}
【真实收货人】${realRecipient}
${remarkBlock}

${personaSections}

请生成 6–10 条自然、口语化的微信短消息，还原**下单后、备餐前/备餐中**的沟通。
要求：
1) **必须**基于上方角色人设、用户人设、双方关系与【长期记忆】生成；角色语气须与人设及近期关系一致；
2) **禁止**在对话里重新点菜、询问「有什么推荐」、从零报菜名下单；订单内容以【已下订单】为准，商家可说「系统里看到您的订单了」并核对菜品；
3) 可体现对「${slipRecipient}」的关心；可确认收货昵称、备餐时间、是否收到平台订单；
4) **小票/备注**：寻味下单时已自动出票，**禁止**在对话里要求打印小票、确认 remark 会不会印、复读小票寄语；仅当存在「需在微信里口头转告商家」时才说口味/做法等；
5) 商家回复专业、简洁；可含：已接单、核对清单、开始备餐、预计出餐时间；
6) **禁止**在对话中写出或确认具体街道门牌地址；
7) **禁止**使用微信昵称、通讯录备注当作用户称呼；
8) 每条 1–2 句，禁止 markdown、禁止系统说明；
9) 只输出 JSON：{"messages":[{"speaker":"character"|"peer","peerName":"${merchantName}","text":"..."}]}
peer 行必须带 peerName；character 行不要 peerName。`
}

function buildCourierPrompt(
  order: TasteOrderPayload,
  ctx: Awaited<ReturnType<typeof loadTasteObserverChatPersonaContext>>,
  courier: string,
  memoryBlock: string,
): string {
  const slipRecipient = resolveOrderRecipientNickname(order)
  const realRecipient = resolveOrderRealRecipientName(order)
  const remarkBlock = formatCharacterRemarkForObserverPrompt(order.remark, slipRecipient)
  const personaSections = buildPersonaSections(ctx, memoryBlock)

  return `【场景】微信私聊 · 配送进行中，角色「${ctx.characterName}」与骑手「${courier}」一对一协调送达（**仅二人对话，禁止出现商家/店长发言**）。
【骑手】${courier}
【取餐门店】${order.storeName}（仅作背景，商家不在本聊天中）
【收货名（外卖单可见）】${slipRecipient}
【真实收货人】${realRecipient}
${remarkBlock}

${personaSections}

请生成 6–10 条自然、口语化的微信短消息。
要求：
1) **必须**基于上方角色人设、用户人设、双方关系与【长期记忆】生成；这是给「${slipRecipient}」的惊喜外卖（昵称可与身份名不同），语气须贴合二人关系与近期记忆；
2) 对话**只在角色与骑手之间**；骑手可取餐、途中、即将送达、已送达等；**禁止**生成商家/店长/店员的 peer 消息；
3) 可说明放门口、保温、勿打扰等细节；骑手回复务实简短；
4) **禁止**讨论小票打印、订单 remark 或复读小票寄语；
5) **禁止**在对话中写出或确认具体街道门牌地址；
6) **禁止**使用微信昵称、通讯录备注当作用户称呼；
7) 每条 1–2 句，禁止 markdown；可适当颜文字；
8) 只输出 JSON：{"messages":[{"speaker":"character"|"peer","peerName":"${courier}","text":"..."}]}
peer 行 peerName **必须**为「${courier}」。`
}

function isMerchantPeerName(name: string | undefined, storeName: string): boolean {
  const n = (name ?? '').trim()
  if (!n) return false
  if (/店长|商家|店员|经理/.test(n)) return true
  const store = storeName.trim()
  return Boolean(store && n.includes(store))
}

function filterCourierOnlyLines(lines: AiLine[], courier: string, storeName: string): AiLine[] {
  const courierKey = courier.trim()
  return lines
    .filter((line) => {
      if (line.speaker === 'character') return true
      return !isMerchantPeerName(line.peerName, storeName)
    })
    .map((line) => (line.speaker === 'peer' ? { ...line, peerName: courierKey } : line))
}

export async function generateCharacterObserverChatWithAi(params: {
  order: TasteOrderPayload
  kind: ObserverKind
  threadId: string
  characterName: string
  apiConfig?: ApiConfig | null
}): Promise<TasteChatMessage[]> {
  const cfg = params.apiConfig ?? (await loadResolvedApiConfig('chatCard'))
  if (!cfg?.apiUrl?.trim() || !cfg.apiKey?.trim() || !cfg.modelId?.trim()) {
    throw new Error('未配置聊天 API，请在 API 设置中配置「聊天记录卡片」')
  }

  const ctx = await loadTasteObserverChatPersonaContext(params.order, params.characterName)
  const charName = ctx.characterName
  const courier = pickCourierName(params.order.orderId)

  const memoryPack = await loadTasteObserverChatMemoryPack({
    order: params.order,
    kind: params.kind,
    apiConfig: cfg,
    personaCtx: ctx,
  })

  const userPrompt =
    params.kind === 'character-merchant'
      ? buildMerchantPrompt(params.order, ctx, memoryPack.promptBlock)
      : buildCourierPrompt(params.order, ctx, courier, memoryPack.promptBlock)

  const system = `你是外卖场景对话编剧。根据【角色人设】【用户（玩家身份）人设】【双方关系】【长期记忆】与订单信息，生成只读旁观视角的微信聊天记录。
角色与商家的对话发生在**寻味平台已下单之后**（核对、确认、备餐跟进），不是在微信里重新点菜下单。
寻味下单时小票寄语会随订单自动出票，**禁止**在生成的对话里要求打印小票、确认备注会不会印、或复读 remark 正文。
长期记忆与线上私聊同源（含关键词与向量语义召回）；对话须贴合人设、关系与记忆，禁止用微信昵称/通讯录备注代替用户身份，勿与长期记忆矛盾。
输出必须是合法 JSON，不要任何解释文字。`

  const raw = await openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.78, max_tokens: 1800 },
  )

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(String(raw ?? '')))
  } catch {
    throw new Error('AI 返回格式无效，请重试')
  }

  const lines = normalizeAiLines(parsed)
  const filtered =
    params.kind === 'character-courier'
      ? filterCourierOnlyLines(lines, courier, params.order.storeName)
      : lines
  if (filtered.length < 4) {
    throw new Error('AI 生成的对话过短，请重试')
  }

  if (params.kind === 'character-merchant') {
    const endTs = params.order.placedAt + 7 * 60_000
    return assignTimestamps(params.threadId, filtered, charName, endTs, 42_000)
  }

  const courierStart = params.order.placedAt + Math.max(5, 12) * 60_000
  return assignTimestamps(params.threadId, filtered, charName, courierStart + filtered.length * 38_000, 40_000)
}
