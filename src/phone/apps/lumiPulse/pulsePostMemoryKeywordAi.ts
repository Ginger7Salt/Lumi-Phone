import type { ApiConfig } from '../api/types'
import { openAiCompatibleChatLenient } from '../wechat/newFriendsPersona/ai'
import { parseModelJsonPayload } from '../../../components/anonymousQa/qnaDirectedJsonParse'

import { extractPulseHashtagKeywords } from './pulsePostMemoryContentBuilder'

const KEYWORD_TASK = `
【系统任务：微博记忆关键词提取】
仅根据微博正文、配图画面描述与话题，提取 3~5 个核心「触发关键词」（物品、情绪、事件、地点、人物、画面元素等），供未来聊天命中唤醒。
不要总结评论区；不要改写原文。
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

export async function extractPulsePostMemoryKeywords(params: {
  apiConfig: ApiConfig | null | undefined
  postText: string
  location?: string
  trendingTitle?: string
  /** 配图中文画面描述 */
  imageDescriptions?: string[]
}): Promise<string[]> {
  const hashtags = extractPulseHashtagKeywords(params.postText)
  const seed: string[] = ['微博', ...hashtags]
  if (params.trendingTitle?.trim()) {
    const t = params.trendingTitle.trim()
    if (!seed.includes(t)) seed.push(t)
  }

  const imageBlock = (params.imageDescriptions ?? [])
    .map((d) => d.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join('；')

  const cfg = params.apiConfig
  const hasApi = !!(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim() && cfg?.modelId?.trim())

  const userBlock = [
    `微博正文：${params.postText || '（无文字）'}`,
    `配图画面：${imageBlock || '无'}`,
    `话题：${params.trendingTitle?.trim() || '无'}`,
    `地点：${params.location?.trim() || '无'}`,
  ].join('\n')

  let extracted: string[] = []
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
        extracted = clampKeywords((payload as Record<string, unknown>).keywords)
      }
    } catch {
      // silent fallback
    }
  }

  if (!extracted.length) {
    extracted = fallbackKeywordsFromText(
      `${params.postText} ${imageBlock} ${params.trendingTitle ?? ''} ${params.location ?? ''}`,
    )
  }

  const out: string[] = []
  for (const k of [...seed, ...extracted]) {
    const t = k.trim()
    if (!t || out.includes(t)) continue
    out.push(t)
    if (out.length >= 8) break
  }
  return out
}
