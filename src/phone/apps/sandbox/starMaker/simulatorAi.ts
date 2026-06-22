/**
 * 金牌制作人 · 大模型衔接层（地下城主）
 */

import type { ApiConfig } from '../../api/types'
import type { Artist, ChatMessage, DramaEvent, HotSearchItem, SimApiConfig } from './types'
import { DRAMA_TEMPLATES } from './presets'

export function resolveSimApi(sim: SimApiConfig, main: ApiConfig | null): SimApiConfig | null {
  if (sim.mode === 'custom') {
    const url = sim.apiUrl.trim()
    const key = sim.apiKey.trim()
    const model = sim.modelId.trim()
    if (url && key && model) return sim
  }
  if (main?.apiUrl?.trim() && main?.apiKey?.trim() && main?.modelId?.trim()) {
    return {
      mode: 'custom',
      apiUrl: main.apiUrl,
      apiKey: main.apiKey,
      modelId: main.modelId,
    }
  }
  return null
}

export interface AiNarrativeResult {
  lines: string[]
  title?: string
}

async function callChat(params: {
  api: SimApiConfig | null
  system: string
  user: string
}): Promise<string | null> {
  const { api, system, user } = params
  if (!api || api.mode === 'inherit') return null
  const url = api.apiUrl.trim()
  const key = api.apiKey.trim()
  const model = api.modelId.trim()
  if (!url || !key || !model) return null

  try {
    const base = url.replace(/\/+$/, '')
    const endpoint = base.endsWith('/chat/completions') ? base : `${base}/v1/chat/completions`
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.85,
        max_tokens: 800,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

export async function fetchHotSearchAi(params: {
  api: SimApiConfig | null
  artists: Artist[]
  hint?: string
}): Promise<HotSearchItem[]> {
  const { artists, hint } = params
  const artist = artists[Math.floor(Math.random() * artists.length)]
  const gossip = hint?.includes('恋') || hint?.includes('夜') || Math.random() < 0.38

  const aiText = await callChat({
    api: params.api,
    system: '你是娱乐圈热搜策划。只输出三行，每行一个热搜词条，不要序号、不要英文、不要 hashtag 符号。',
    user: `根据线索「${hint ?? '金牌制作人日常'}」与艺人「${artist?.name ?? '未知'}」，生成三条中文热搜，每条 6-14 字。`,
  })

  if (aiText) {
    const lines = aiText
      .split('\n')
      .map((s) => s.replace(/^[\d.、\-#\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 3)
    if (lines.length) {
      return lines.map((keyword, i) => ({
        id: `hs-ai-${Date.now()}-${i}`,
        rank: i + 1,
        keyword,
        heat: 96 - i * 8,
        type: i === 0 && gossip ? ('gossip' as const) : gossip ? ('negative' as const) : ('positive' as const),
        artistId: artist?.id,
        createdAt: Date.now(),
      }))
    }
  }

  if (gossip) {
    return [
      {
        id: `hs-${Date.now()}-0`,
        rank: 1,
        keyword: hint ?? `${artist?.name ?? '某艺人'}深夜同回公寓`,
        heat: 99,
        type: 'gossip',
        artistId: artist?.id,
        createdAt: Date.now(),
      },
      {
        id: `hs-${Date.now()}-1`,
        rank: 2,
        keyword: `${artist?.name ?? '顶流'}新剧定档`,
        heat: 84,
        type: 'positive',
        artistId: artist?.id,
        createdAt: Date.now(),
      },
      {
        id: `hs-${Date.now()}-2`,
        rank: 3,
        keyword: '经纪公司连夜公关',
        heat: 76,
        type: 'negative',
        createdAt: Date.now(),
      },
    ]
  }

  return [
    {
      id: `hs-${Date.now()}-0`,
      rank: 1,
      keyword: `${artist?.name ?? '艺人'}深夜发文`,
      heat: 94,
      type: 'positive',
      artistId: artist?.id,
      createdAt: Date.now(),
    },
    {
      id: `hs-${Date.now()}-1`,
      rank: 2,
      keyword: hint ?? '金牌制作人上位',
      heat: 86,
      type: 'positive',
      createdAt: Date.now(),
    },
    {
      id: `hs-${Date.now()}-2`,
      rank: 3,
      keyword: '暑期档神仙阵容',
      heat: 78,
      type: 'positive',
      createdAt: Date.now(),
    },
  ]
}

export async function fetchArtistChatReply(params: {
  api: SimApiConfig | null
  artist: Artist
  transcript: ChatMessage[]
  contextBlock: string
}): Promise<{ text: string; affectionDelta: number; resentmentDelta: number }> {
  const lastUser = [...params.transcript].reverse().find((m) => m.role === 'user')
  const userText = lastUser?.content ?? ''

  const aiText = await callChat({
    api: params.api,
    system: `你是艺人「${params.artist.name}」，正在与经纪人私聊。语气符合人设：${params.artist.personaSummary}。关系：${params.artist.status}。只输出一条回复，50字以内，纯中文，不要括号动作说明。\n${params.contextBlock}`,
    user: userText || '在吗？',
  })

  if (aiText) {
    const len = aiText.length
    return {
      text: aiText.slice(0, 120),
      affectionDelta: len > 30 ? 2 : 1,
      resentmentDelta: params.artist.status === 'secret_dating' && len < 15 ? 1 : 0,
    }
  }

  const fallbacks = [
    `……你发的「${userText.slice(0, 10)}」我看到了。今晚收工后再说？`,
    `${params.artist.name}，你总是挑我最忙的时候找我。`,
    '嗯。有你盯着，我反而安心一点。',
    '别熬夜了……我也是说给自己听的。',
  ]
  return {
    text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
    affectionDelta: userText.length > 6 ? 2 : 1,
    resentmentDelta: 0,
  }
}

export async function fetchTravelDiary(params: {
  api: SimApiConfig | null
  destination: string
  artistName: string
  days: number
}): Promise<string[]> {
  const aiText = await callChat({
    api: params.api,
    system: '你是女性向恋爱小说作者。写一段旅行小记，纯中文，文学感，每段 1-2 句，共 4 段，段间空行。',
    user: `与艺人${params.artistName}同游${params.destination}，${params.days}日。经纪人视角，暧昧克制，有细节。`,
  })

  if (aiText) {
    return aiText.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6)
  }

  return [
    `${params.destination}的风比想象中软，${params.artistName}走在你身侧半步之外。`,
    '镜头外的他少了舞台上的锋利，只剩偶尔侧目时，眼底一闪而过的依赖。',
    '你们在某条僻静巷口同时停下，谁都没有先开口。',
    '回程的航班上，他递来一张写满字的便签，又迅速别过脸去。',
  ]
}

export async function fetchDramaEvent(params: {
  api: SimApiConfig | null
  artistA: Artist
  artistB: Artist
}): Promise<DramaEvent> {
  const template = DRAMA_TEMPLATES[Math.floor(Math.random() * DRAMA_TEMPLATES.length)]
  const id = `drama-${Date.now()}`

  const aiText = await callChat({
    api: params.api,
    system: '你是乙女游戏编剧。续写修罗场开场，纯中文，3-4 句，第三人称，有画面感。',
    user: `艺人${params.artistA.name}与${params.artistB.name}因经纪人陷入修罗场。场景：${template.title}。`,
  })

  const lines = aiText
    ? aiText.split(/[。！？\n]/).map((s) => s.trim()).filter(Boolean).map((s) => (s.endsWith('。') ? s : `${s}。`))
    : [...template.lines]

  const choices = template.choices.map((c) => {
    const effects = { ...c.effects }
    if (c.id === 'calm') {
      effects.affection = { [params.artistA.id]: 3, [params.artistB.id]: 3 }
      effects.resentment = { [params.artistA.id]: -5, [params.artistB.id]: -5 }
    }
    if (c.id === 'lie') {
      effects.resentment = { [params.artistA.id]: 8, [params.artistB.id]: 8 }
      effects.affection = { [params.artistA.id]: -2, [params.artistB.id]: -2 }
    }
    if (c.id === 'public' || c.id === 'admit') {
      effects.setStatus = { [params.artistA.id]: 'public_romance' }
      effects.fans = { [params.artistA.id]: -80000, [params.artistB.id]: -20000 }
      effects.commercial = { [params.artistA.id]: -15, [params.artistB.id]: -5 }
      effects.affection = { [params.artistA.id]: 15 }
      effects.clearDrama = true
    }
    if (c.id === 'press') {
      effects.resentment = { [params.artistA.id]: 5 }
    }
    return { ...c, effects }
  })

  return { id, title: template.title, lines, choices }
}

export async function fetchRandomEventFlavor(params: {
  api: SimApiConfig | null
  actionLabel: string
  context: string
}): Promise<string> {
  const aiText = await callChat({
    api: params.api,
    system: '你是娱乐圈模拟游戏旁白。一句到三句，纯中文，柔和文学感，不要英文。',
    user: `玩家执行「${params.actionLabel}」。背景：${params.context}。`,
  })
  return aiText?.slice(0, 180) ?? `${params.actionLabel}告一段落，城市的霓虹又亮了一格。`
}
