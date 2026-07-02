import type { ApiConfig } from '../api/types'
import { openAiCompatibleChat } from '../wechat/newFriendsPersona/ai'
import type {
  PulseComment,
  PulseDmThread,
  PulseGeneratedProfileBundle,
  PulsePost,
  PulseTrendingTopic,
} from './pulseTypes'

function extractJsonArray(raw: string): unknown[] | null {
  const t = raw.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  const body = fence ? fence[1]!.trim() : t
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(body.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function hasApi(cfg: ApiConfig | null | undefined): cfg is ApiConfig {
  return !!(cfg?.apiUrl?.trim() && cfg?.apiKey?.trim())
}

/** 未配置 API 或生成无有效结果时抛出，由 UI 提示用户 */
function requirePulseApi(cfg: ApiConfig | null | undefined): ApiConfig {
  if (!hasApi(cfg)) {
    throw new Error('请先在 API 设置中配置模型后再生成')
  }
  return cfg
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const t = raw.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
  const body = fence ? fence[1]!.trim() : t
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(body.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function clipInt(raw: unknown, min: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, Math.round(n)))
}

function rethrowPulseAiError(e: unknown, fallbackMessage: string): never {
  if (e instanceof Error && e.message.trim()) throw e
  throw new Error(fallbackMessage)
}

export async function aiGeneratePulseFeedPosts(params: {
  apiConfig: ApiConfig | null
  viewerName: string
  count?: number
}): Promise<Array<{ authorName: string; content: string }>> {
  const count = Math.min(8, Math.max(3, params.count ?? 5))
  const apiConfig = requirePulseApi(params.apiConfig)

  const sys = `你是 Lumi Pulse 微博广场的 AI 编导。生成 ${count} 条中文网友动态，风格克制、有文学感，禁止 Unicode emoji 与微博橙红色调用语。
可使用微博方括号表情（如 [doge][允悲][吃瓜]），每条 0～2 个。
只输出 JSON 数组：[{"authorName":"网名","content":"正文"}]
正文 40～180 字，像真实社交媒体碎片。`
  const user = `当前浏览者：${params.viewerName}。请生成广场动态。`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.92 },
    )
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const out: Array<{ authorName: string; content: string }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName = clip(r.authorName, 24)
      const content = clip(r.content, 400)
      if (authorName && content) out.push({ authorName, content })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效动态')
    }
    return out.slice(0, count)
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

export async function aiGeneratePulseComments(params: {
  apiConfig: ApiConfig | null
  post: Pick<PulsePost, 'authorName' | 'content'>
  count?: number
}): Promise<Array<{ authorName: string; content: string; parentHint?: string }>> {
  const count = Math.min(12, Math.max(4, params.count ?? 6))
  const apiConfig = requirePulseApi(params.apiConfig)

  const sys = `你是 Lumi Pulse 评论区 AI。针对一条微博生成 ${count} 条网友评论，可含 1～2 条楼中楼（用 parentHint 写被回复者昵称）。
只输出 JSON：[{"authorName":"昵称","content":"评论","parentHint":"可选"}]
禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲]，每条 0～1 个。语气真实多样。`
  const user = `博主：${params.post.authorName}\n正文：${params.post.content}`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.9 },
    )
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const out: Array<{ authorName: string; content: string; parentHint?: string }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName = clip(r.authorName, 24)
      const content = clip(r.content, 280)
      if (!authorName || !content) continue
      const parentHint = clip(r.parentHint, 24) || undefined
      out.push({ authorName, content, parentHint })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效评论')
    }
    return out.slice(0, count)
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

export async function aiGeneratePulseTrending(params: {
  apiConfig: ApiConfig | null
  povName: string
  povContext?: string
  count?: number
}): Promise<Array<Pick<PulseTrendingTopic, 'title' | 'tag' | 'excerpt'>>> {
  const count = Math.min(10, Math.max(5, params.count ?? 8))
  const apiConfig = requirePulseApi(params.apiConfig)

  const sys = `你是舆论场编导。为中文微博热搜榜生成 ${count} 条词条，可结合角色剧情。
只输出 JSON：[{"title":"# 词条 #","tag":"爆|新|热","excerpt":"一句话导语"}]
禁止 Unicode emoji；导语可用 [doge] 等微博表情，保持杂志感。`
  const user = `当前世界主角：${params.povName}
${params.povContext?.trim() ? `剧情背景：${params.povContext.trim().slice(0, 800)}` : ''}
请生成与 TA 生活可能相关的热搜。`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.88 },
    )
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const out: Array<Pick<PulseTrendingTopic, 'title' | 'tag' | 'excerpt'>> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const title = clip(r.title, 80)
      if (!title) continue
      const tagRaw = clip(r.tag, 4)
      const tag = tagRaw === '爆' || tagRaw === '新' || tagRaw === '热' ? tagRaw : undefined
      const excerpt = clip(r.excerpt, 160) || undefined
      out.push({ title, tag, excerpt })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效热搜词条')
    }
    return out.slice(0, count)
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

export async function aiGeneratePulseDmThreads(params: {
  apiConfig: ApiConfig | null
  povName: string
  threadCount?: number
}): Promise<Array<{ fanName: string; messages: string[] }>> {
  const n = Math.min(5, Math.max(2, params.threadCount ?? 3))
  const apiConfig = requirePulseApi(params.apiConfig)

  const sys = `你是追星/网友私信生成器。为名人 ${params.povName} 生成 ${n} 个私信对话，每对话 3～5 条粉丝或匿名网友消息（狂热、质问、表白、黑粉均可）。
只输出 JSON：[{"fanName":"网名","messages":["..."]}]
禁止 emoji。`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: `目标：${params.povName}` },
      ],
      { temperature: 0.93 },
    )
    const rows = extractJsonArray(raw)
    if (!rows?.length) {
      throw new Error('生成失败：模型未返回有效 JSON')
    }
    const out: Array<{ fanName: string; messages: string[] }> = []
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const fanName = clip(r.fanName, 24)
      const msgs = Array.isArray(r.messages)
        ? r.messages.map((m) => clip(m, 320)).filter(Boolean)
        : []
      if (fanName && msgs.length) out.push({ fanName, messages: msgs.slice(0, 6) })
    }
    if (!out.length) {
      throw new Error('生成失败：未解析到有效私信')
    }
    return out.slice(0, n)
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

/** 按角色人设生成个人主页：统计数据 + 若干条 TA 发的微博（含互动数与评论） */
export async function aiGeneratePulseProfileBundle(params: {
  apiConfig: ApiConfig | null
  characterName: string
  worldName: string
  personaSummary: string
  postCount: number
}): Promise<PulseGeneratedProfileBundle> {
  const postCount = Math.min(8, Math.max(1, params.postCount))
  const apiConfig = requirePulseApi(params.apiConfig)

  const sys = `你是 Lumi Pulse 微博个人主页编导。根据角色人设，生成该角色作为「名人/主角」的微博主页数据。
只输出一个 JSON 对象（不要 markdown 包裹以外的说明）：
{
  "profileStats": { "following": 数字, "followers": 数字, "likesReceived": 数字, "bio": "一句个人简介<=60字" },
  "followingUsers": [{ "name": "关注对象的微博昵称", "bio": "可选一句话简介<=30字" }],
  "posts": [
    {
      "content": "微博正文 40~200字",
      "likeCount": 数字,
      "commentCount": 数字,
      "repostCount": 数字,
      "comments": [{ "authorName": "网友昵称", "content": "评论内容" }]
    }
  ]
}
要求：
- 必须生成恰好 ${postCount} 条 posts，均为该角色本人发的微博（第一人称或日记感）
- 每条 post 的 comments 数组提供 2~4 条真实网友评论；commentCount 可大于 comments 长度（表示还有更多评论）
- likeCount/commentCount/repostCount 须符合该角色人气，彼此合理
- 禁止 Unicode emoji；可用微博方括号表情如 [doge][允悲]
- 粉丝数/获赞须与角色身份匹配（普通人偏低，主角/名人可偏高）
- followingUsers 提供 3~8 个该角色会关注的微博账号（网友/博主/同行），following 数字须与 followingUsers 长度一致`

  const user = `世界：${params.worldName}
角色：${params.characterName}
${params.personaSummary.trim() ? `【人设资料】\n${params.personaSummary.trim().slice(0, 3200)}` : ''}`

  try {
    const raw = await openAiCompatibleChat(
      apiConfig,
      [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      { temperature: 0.88 },
    )
    const obj = extractJsonObject(raw)
    if (!obj) throw new Error('生成失败：模型未返回有效 JSON')

    const statsRaw = obj.profileStats
    if (!statsRaw || typeof statsRaw !== 'object') {
      throw new Error('生成失败：缺少 profileStats')
    }
    const sr = statsRaw as Record<string, unknown>
    const profileStats = {
      following: clipInt(sr.following, 0, 9999),
      followers: clipInt(sr.followers, 0, 99_000_000),
      likesReceived: clipInt(sr.likesReceived, 0, 999_999_999),
      bio: clip(sr.bio, 120) || undefined,
    }

    const postsRaw = obj.posts
    if (!Array.isArray(postsRaw) || !postsRaw.length) {
      throw new Error('生成失败：未解析到有效动态')
    }

    const posts: PulseGeneratedProfileBundle['posts'] = []
    for (const row of postsRaw) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const content = clip(r.content, 500)
      if (!content) continue
      const comments: Array<{ authorName: string; content: string }> = []
      if (Array.isArray(r.comments)) {
        for (const c of r.comments) {
          if (!c || typeof c !== 'object') continue
          const cr = c as Record<string, unknown>
          const authorName = clip(cr.authorName, 24)
          const commentContent = clip(cr.content, 280)
          if (authorName && commentContent) comments.push({ authorName, content: commentContent })
        }
      }
      posts.push({
        content,
        likeCount: clipInt(r.likeCount, 0, 9_999_999),
        commentCount: Math.max(comments.length, clipInt(r.commentCount, 0, 999_999)),
        repostCount: clipInt(r.repostCount, 0, 999_999),
        comments,
      })
    }

    if (!posts.length) throw new Error('生成失败：未解析到有效动态')

    const followingUsers: PulseGeneratedProfileBundle['followingUsers'] = []
    if (Array.isArray(obj.followingUsers)) {
      for (const row of obj.followingUsers) {
        if (!row || typeof row !== 'object') continue
        const r = row as Record<string, unknown>
        const name = clip(r.name, 24)
        if (!name) continue
        followingUsers.push({ name, bio: clip(r.bio, 60) || undefined })
      }
    }

    return {
      profileStats: {
        ...profileStats,
        following: followingUsers.length > 0 ? followingUsers.length : profileStats.following,
      },
      posts: posts.slice(0, postCount),
      followingUsers,
    }
  } catch (e) {
    rethrowPulseAiError(e, '生成失败')
  }
}

export function nestPulseComments(
  flat: PulseComment[],
): Array<PulseComment & { replies: PulseComment[] }> {
  const roots = flat.filter((c) => !c.parentId)
  const byParent = new Map<string, PulseComment[]>()
  for (const c of flat) {
    if (!c.parentId) continue
    const list = byParent.get(c.parentId) ?? []
    list.push(c)
    byParent.set(c.parentId, list)
  }
  return roots.map((r) => ({
    ...r,
    replies: (byParent.get(r.id) ?? []).sort((a, b) => a.createdAt - b.createdAt),
  }))
}

export function flatToDmThreads(
  rows: Array<{ fanName: string; messages: string[] }>,
): PulseDmThread[] {
  return rows.map((row, threadIndex) => {
    const now = Date.now()
    const messages = row.messages.map((content, i) => ({
      id: `pdm-${now}-${threadIndex}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      fromFan: true,
      content,
      createdAt: now - (row.messages.length - i) * 45_000,
    }))
    const last = messages[messages.length - 1]
    return {
      id: `pth-${now}-${threadIndex}`,
      fanName: row.fanName,
      messages,
      lastMessage: last?.content ?? '',
      lastAt: last?.createdAt ?? now,
      unread: messages.length,
    }
  })
}
