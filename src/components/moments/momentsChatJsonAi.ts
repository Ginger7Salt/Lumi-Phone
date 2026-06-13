import type { ApiConfig } from '../../phone/apps/api/types'
import {
  openAiCompatibleChat,
  type OpenAiCompatibleMessage,
} from '../../phone/apps/wechat/newFriendsPersona/ai'
import {
  describeMomentModelJsonFailure,
  parseModelJsonPayload,
} from '../anonymousQa/qnaDirectedJsonParse'

const JSON_OUTPUT_USER_TAIL =
  '\n\n【硬性输出约束】你的回复必须是且仅能是一个 JSON 对象：首字符为 {，末字符为 }。禁止 Markdown、禁止前后说明、禁止角色台词、禁止思维链标签。'

const JSON_RETRY_USER_HINT =
  '你上一轮的输出无法被程序解析。请严格只输出一个合法 JSON 对象：不要 Markdown 代码块、不要解释、不要思维链标签；字符串内的换行请写成 \\n。'

const STRICT_JSON_RETRY_HINT =
  '忽略角色扮演式自然语言回复。只输出任务要求的 JSON 对象，字段名与示例一致，禁止任何非 JSON 字符。'

export type MomentsJsonChatOptions = {
  temperature?: number
  max_tokens?: number
}

function isResponseFormatUnsupportedError(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase()
  return /response_format|json_object|json_schema|structured|mime_type|output mime|application\/json/i.test(m)
}

function resolveMomentsJsonTemperature(options?: MomentsJsonChatOptions): number {
  const t = options?.temperature
  if (t == null) return 0.45
  return Math.min(t, 0.55)
}

function appendMomentsJsonOutputConstraint(messages: OpenAiCompatibleMessage[]): OpenAiCompatibleMessage[] {
  const copy = [...messages]
  let lastUserIdx = -1
  for (let i = copy.length - 1; i >= 0; i -= 1) {
    if (copy[i].role === 'user') {
      lastUserIdx = i
      break
    }
  }
  if (lastUserIdx >= 0) {
    const m = copy[lastUserIdx]
    copy[lastUserIdx] = {
      ...m,
      content: `${String(m.content ?? '')}${JSON_OUTPUT_USER_TAIL}`,
    }
  } else {
    copy.push({ role: 'user', content: JSON_OUTPUT_USER_TAIL.trim() })
  }
  return copy
}

async function callMomentsJsonChat(
  cfg: ApiConfig,
  messages: OpenAiCompatibleMessage[],
  options?: MomentsJsonChatOptions,
  useJsonMode = true,
): Promise<string> {
  const chatOpts = {
    ...options,
    temperature: resolveMomentsJsonTemperature(options),
    ...(useJsonMode ? { response_format: 'json_object' as const } : {}),
  }
  return (await openAiCompatibleChat(cfg, messages, chatOpts)).trim()
}

/** 朋友圈专用：请求模型 JSON 输出，失败时自动重试 */
export async function requestMomentsModelJsonText(
  cfg: ApiConfig,
  messages: OpenAiCompatibleMessage[],
  options?: MomentsJsonChatOptions,
): Promise<string> {
  const baseMessages = appendMomentsJsonOutputConstraint(messages)

  async function attempt(
    msgs: OpenAiCompatibleMessage[],
    opts?: MomentsJsonChatOptions,
  ): Promise<string> {
    try {
      return await callMomentsJsonChat(cfg, msgs, opts, true)
    } catch (e) {
      if (!isResponseFormatUnsupportedError(e)) throw e
      return await callMomentsJsonChat(cfg, msgs, opts, false)
    }
  }

  let raw = await attempt(baseMessages, options)
  if (parseModelJsonPayload(raw)) return raw

  const retryMessages: OpenAiCompatibleMessage[] = [
    ...baseMessages,
    { role: 'user', content: JSON_RETRY_USER_HINT },
  ]
  raw = await attempt(retryMessages, options)
  if (parseModelJsonPayload(raw)) return raw

  const strictMessages: OpenAiCompatibleMessage[] = [
    ...baseMessages,
    { role: 'user', content: STRICT_JSON_RETRY_HINT },
  ]
  return await attempt(strictMessages, { ...options, temperature: 0.35 })
}

export function parseMomentsModelJsonPayload(raw: string): unknown | null {
  return parseModelJsonPayload(raw)
}

export function throwIfMomentModelJsonInvalid<T>(raw: string, draft: T | null): asserts draft is T {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(describeMomentModelJsonFailure(''))
  }
  const payload = parseModelJsonPayload(raw)
  if (!payload) {
    throw new Error(describeMomentModelJsonFailure(raw))
  }
  if (!draft) {
    throw new Error(
      'JSON 已解析但缺少必填字段（如 postType/content/images）或正文为空。请重试、增大 max_tokens 或换模型',
    )
  }
}
