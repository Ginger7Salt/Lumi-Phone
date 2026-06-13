import type { ApiConfig } from '../../phone/apps/api/types'
import { openAiCompatibleChatLenient } from '../../phone/apps/wechat/newFriendsPersona/ai'
import { parseModelJsonPayload } from '../anonymousQa/qnaDirectedJsonParse'

const KEYWORD_TASK = `
【系统任务：朋友圈记忆关键词提取】
仅根据朋友圈正文与地点，提取 3~5 个核心「触发关键词」（物品、情绪、事件、地点等），供未来聊天命中唤醒。
不要总结、不要改写评论区内容。
只返回纯 JSON，严禁 Markdown：
{"keywords":["关键词1","关键词2","关键词3"]}
`.trim()

function clampKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string') continue
    const t = item.replace(/\s+/g, ' ').trim()
    if (!t || t.length > 16) continue
    if (!out.includes(t)) out.push(t)
    if (out.length >= 5) break
  }
  return out
}

function fallbackKeywordsFromText(text: string): string[] {
  const chunks = text
    .replace(/[^\u4e00-\u9fffA-Za-z0-9·]/g, ' ')
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && x.length <= 8)
  const out: string[] = []
  for (const c of chunks) {
    if (!out.includes(c)) out.push(c)
    if (out.length >= 4) break
  }
  return out
}

export async function extractMomentMemoryKeywords(params: {
  apiConfig: ApiConfig | null | undefined
  momentText: string
  location: string
}): Promise<string[]> {
  const cfg = params.apiConfig
  const hasApi = !!(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim() && cfg?.modelId?.trim())

  const userBlock = [
    `朋友圈正文：${params.momentText || '（无文字）'}`,
    `地点：${params.location || '无'}`,
  ].join('\n')

  if (hasApi && cfg) {
    try {
      const raw = await openAiCompatibleChatLenient(
        cfg,
        [
          { role: 'system', content: KEYWORD_TASK },
          { role: 'user', content: userBlock },
        ],
        { temperature: 0.35, max_tokens: 200 },
      )
      const payload = parseModelJsonPayload(raw)
      if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
        const kws = clampKeywords((payload as Record<string, unknown>).keywords)
        if (kws.length) return kws
      }
    } catch {
      // silent fallback
    }
  }

  return fallbackKeywordsFromText(`${params.momentText} ${params.location}`)
}
