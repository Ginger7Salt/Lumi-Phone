import {
  buildPersonaAiHealthyToneRules,
  buildPersonaAiIntimatePartnerWordingRules,
  buildPersonaAiNsfwHintToneRules,
  buildPersonaAiOrientationMutableSemanticsRule,
  buildPersonaAiPlayerIdentityContextBlock,
  buildPersonaAiPlayerUserGenderRules,
  buildPersonaAiRelationContextRules,
  PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS,
  buildPersonaAiCompactEntryLengthRules,
} from './personaAiGeneratePrompt'
import type { PersonaAiGenerateForm } from './personaAiGenerateTypes'
import type { Character, Gender, PlayerIdentity } from './types'
import {
  PERSONA_AI_COMPACT_BOOK_TITLE,
  PERSONA_AI_COMPACT_ENTRY_NAMES,
  PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME,
  PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME,
  canonicalizePersonaAiCompactEntryName,
  isPersonaAiOrientationEpilogueName,
  isPersonaAiRelationshipHistoryEntryName,
  pickPersonaAiOrientationEpilogueContent,
  pickPersonaAiRelationshipHistoryContent,
  type PersonaAiCompactEntryName,
  type PersonaAiEpilogueEntry,
} from './personaAiWorldBooks'
import {
  serializePersonaAiMarkup,
} from './personaAiGenerateMarkup'

export type PersonaAiGenerateIssueKind =
  | 'parse'
  | 'missing_epilogue'
  | 'placeholder_field'
  | 'missing_top_field'

export type PersonaAiGenerateIssue = {
  id: string
  kind: PersonaAiGenerateIssueKind
  label: string
  detail?: string
}

/** 增量修复允许写入的字段白名单 */
export type PersonaAiRepairAllowlist = {
  /** 允许补丁覆盖的顶层键（realName / bio / openingLines 等） */
  topKeys: Set<string>
  /** 允许补丁覆盖的世界书条目标题 */
  wbNames: Set<string>
  /** 存在截断/解析问题时放宽：允许合并补丁中出现的任意字段 */
  allowBroadMerge: boolean
}

const TOP_ISSUE_ID_TO_KEY: Record<string, string> = {
  'top-realName': 'realName',
  'top-wechatNickname': 'wechatNickname',
  'top-occupation': 'occupation',
  'top-motto': 'motto',
  'top-wechatSignature': 'wechatSignature',
  'top-mbti': 'mbti',
  'top-orientation': 'orientation',
  'top-bio': 'bio',
  'top-opening': 'openingLines',
}

export function buildPersonaAiRepairAllowlist(issues: PersonaAiGenerateIssue[]): PersonaAiRepairAllowlist {
  const topKeys = new Set<string>()
  const wbNames = new Set<string>()
  let allowBroadMerge = false
  for (const i of issues) {
    if (i.kind === 'parse') {
      allowBroadMerge = true
      continue
    }
    if (i.id.startsWith('wb-') || i.id.startsWith('ep-')) {
      const name = i.id.replace(/^(wb|ep)-/, '')
      if (name) wbNames.add(name)
      continue
    }
    const mapped = TOP_ISSUE_ID_TO_KEY[i.id]
    if (mapped) topKeys.add(mapped)
    else if (i.id.startsWith('top-')) topKeys.add(i.id.slice(4))
  }
  return { topKeys, wbNames, allowBroadMerge }
}

/** 按模式筛待处理项：补全=缺失；纠正=过短/占位 */
export function pickPersonaAiRepairIssues(
  issues: PersonaAiGenerateIssue[],
  mode: 'complete' | 'fix',
): PersonaAiGenerateIssue[] {
  if (mode === 'complete') {
    return issues.filter(
      (i) =>
        i.kind === 'missing_epilogue' ||
        i.kind === 'missing_top_field' ||
        i.kind === 'parse',
    )
  }
  return issues.filter((i) => i.kind === 'placeholder_field' || i.kind === 'parse')
}

export type PersonaAiGenerateResult = {
  character: Character
  issues: PersonaAiGenerateIssue[]
  rawText: string
  parsedSnapshot: Record<string, unknown>
  parseRecovered: boolean
}

export class PersonaAiGenerateFailure extends Error {
  rawText: string

  constructor(message: string, rawText: string) {
    super(message)
    this.name = 'PersonaAiGenerateFailure'
    this.rawText = rawText
  }
}

const PLACEHOLDER = '（档案待补全）'

const TOP_FIELD_AUDIT: { key: string; label: string; minLen?: number }[] = [
  { key: 'realName', label: '真实姓名' },
  { key: 'wechatNickname', label: '微信昵称' },
  { key: 'occupation', label: '职业' },
  { key: 'motto', label: '座右铭', minLen: 4 },
  { key: 'wechatSignature', label: '微信个性签名', minLen: 2 },
  { key: 'mbti', label: 'MBTI' },
  { key: 'orientation', label: '性取向' },
]

function isWeakFieldValue(v: unknown, minLen = 4): boolean {
  const t = String(v ?? '').trim()
  if (!t) return true
  if (t === PLACEHOLDER) return true
  return t.length < minLen
}

/** empty → missing；有字但过短/占位 → placeholder */
function classifyWeakField(v: unknown, minLen = 4): 'ok' | 'missing' | 'placeholder' {
  const t = String(v ?? '').trim()
  if (!t) return 'missing'
  if (t === PLACEHOLDER || t.length < minLen) return 'placeholder'
  return 'ok'
}

/** 尝试修复被截断的 JSON（常见于 max_tokens 用尽） */
export function salvageTruncatedJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  if (start < 0) return null
  let s = text.slice(start).trim()
  const attempts = [
    (x: string) => x,
    (x: string) => (x.endsWith(',') ? x.slice(0, -1) : x),
    (x: string) => (/"[^"\\]*$/.test(x) ? `${x}"` : x),
    (x: string) => `${x}"`,
    (x: string) => `${x}}`,
    (x: string) => `${x}"}`,
    (x: string) => `${x}}}`,
    (x: string) => `${x}"]}`,
    (x: string) => `${x}"}]}`,
    (x: string) => `${x}"}}`,
    (x: string) => `${x}"}}}`,
    (x: string) => `${x}"}]}}`,
  ]
  for (const mutate of attempts) {
    try {
      const candidate = mutate(s)
      return JSON.parse(candidate) as Record<string, unknown>
    } catch {
      /* next */
    }
  }
  return null
}

function findCompactPersonaBook(character: Character) {
  const books = character.worldBooks ?? []
  return (
    books.find((w) => w.name === PERSONA_AI_COMPACT_BOOK_TITLE) ||
    books.find((w) => /角色人设档案|对你现在/.test(String(w.name ?? ''))) ||
    books[0]
  )
}

function collectCompactEntryContentsFromParsed(
  parsed: Record<string, unknown>,
): Map<PersonaAiCompactEntryName, string> {
  const byName = new Map<PersonaAiCompactEntryName, string>()

  const ingest = (nameRaw: string, contentRaw: string) => {
    const content = String(contentRaw ?? '').trim()
    if (!content || content === PLACEHOLDER) return
    const canonical = canonicalizePersonaAiCompactEntryName(nameRaw)
    if (!canonical) return
    const prev = byName.get(canonical)
    if (!prev || content.length > prev.length) byName.set(canonical, content)
  }

  const arr = parsed.worldBookEntries
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      ingest(String(o.name ?? ''), String(o.content ?? ''))
    }
  }

  const obj = parsed.worldBookSections
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      ingest(k, String(v ?? ''))
    }
  }

  const epi = parsed.epilogueEntries
  if (Array.isArray(epi)) {
    for (const x of epi) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      ingest(String(o.name ?? ''), String(o.content ?? ''))
    }
  }

  return byName
}

/** 按条目标题合并世界书条目（补全只返回部分条目时，保留已有） */
export function mergeWorldBookEntryArrays(
  base: unknown,
  patch: unknown,
  opts?: {
    /** 仅合并这些标题；未指定则合并补丁中全部条目 */
    allowNames?: Set<string>
    /**
     * true：允许名单内条目一律以补丁为准（纠正模式）
     * false：仅当补丁更长时覆盖（补全缺失时默认）
     */
    forcePatch?: boolean
  },
): PersonaAiEpilogueEntry[] {
  const byKey = new Map<string, PersonaAiEpilogueEntry>()

  const ingest = (arr: unknown, isPatch: boolean) => {
    if (!Array.isArray(arr)) return
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!name || !content) continue
      const canonical = canonicalizePersonaAiCompactEntryName(name)
      const key = canonical ?? name
      if (isPatch && opts?.allowNames?.size && !opts.allowNames.has(key)) continue
      const entry: PersonaAiEpilogueEntry = { name: canonical ?? name, content }
      const prev = byKey.get(key)
      if (!prev) {
        byKey.set(key, entry)
        continue
      }
      if (!isPatch) continue
      if (opts?.forcePatch || content.length > prev.content.length) {
        byKey.set(key, entry)
      }
    }
  }

  ingest(base, false)
  ingest(patch, true)
  return Array.from(byKey.values())
}

/** 只保留允许名单内的补丁字段，避免模型整卷重写时覆盖已完整内容 */
export function filterPersonaAiRepairPatch(
  patch: Record<string, unknown>,
  allow: PersonaAiRepairAllowlist,
  base?: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  const takeTop = (k: string, v: unknown) => {
    if (allow.allowBroadMerge) {
      if (allow.topKeys.has(k) || isWeakFieldValue(base?.[k], 2)) out[k] = v
      return
    }
    if (allow.topKeys.has(k)) out[k] = v
  }

  for (const [k, v] of Object.entries(patch)) {
    if (k === 'worldBookEntries' || k === 'epilogueEntries') continue
    takeTop(k, v)
  }

  const rawEntries = patch.worldBookEntries ?? patch.epilogueEntries
  if (!Array.isArray(rawEntries)) return out

  if (allow.allowBroadMerge) {
    // 截断抢救：条目仍交给 mergeWorldBookEntryArrays（默认更长者胜）
    out.worldBookEntries = rawEntries as PersonaAiEpilogueEntry[]
    return out
  }

  if (allow.wbNames.size > 0) {
    const filtered: PersonaAiEpilogueEntry[] = []
    for (const x of rawEntries) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!name || !content) continue
      const canonical = canonicalizePersonaAiCompactEntryName(name) ?? name
      if (!allow.wbNames.has(canonical)) continue
      filtered.push({ name: canonical, content })
    }
    if (filtered.length) out.worldBookEntries = filtered
  }
  return out
}

/** @deprecated 兼容旧名 */
export function mergeEpilogueEntryArrays(
  base: unknown,
  patch: unknown,
  _orientationMutable?: boolean,
): PersonaAiEpilogueEntry[] {
  return mergeWorldBookEntryArrays(base, patch)
}

export function syncWorldBookEntriesInParsedSnapshot(
  parsed: Record<string, unknown>,
  character: Character,
): void {
  const book = findCompactPersonaBook(character)
  if (!book?.items?.length) return
  const entries = book.items
    .map((it) => ({
      name: String(it.name ?? '').trim(),
      content: String(it.content ?? '').trim(),
    }))
    .filter((e) => e.name && e.content && e.content !== PLACEHOLDER)
  if (entries.length) parsed.worldBookEntries = entries
}

/** @deprecated */
export function syncEpilogueEntriesInParsedSnapshot(
  parsed: Record<string, unknown>,
  character: Character,
): void {
  syncWorldBookEntriesInParsedSnapshot(parsed, character)
}

function repairHintForIssue(issue: PersonaAiGenerateIssue): string | null {
  if (issue.id.startsWith('wb-')) {
    const name = issue.id.slice(3)
    return `补写段落【${name}】`
  }
  if (issue.id.startsWith('ep-')) {
    const name = issue.id.slice(3)
    return `补写段落【${name}】`
  }
  if (issue.id === 'top-bio') return '补写【简介】'
  if (issue.id.startsWith('top-')) {
    const key = issue.id.slice(4)
    const labelMap: Record<string, string> = {
      realName: '真实姓名',
      wechatNickname: '微信昵称',
      occupation: '职业',
      motto: '座右铭',
      wechatSignature: '个性签名',
      mbti: 'MBTI',
      orientation: '性取向',
    }
    return `补写键值行「${labelMap[key] ?? key}：…」`
  }
  return null
}

/** 供补全 prompt 使用的精简快照（纯文本标记） */
export function buildPersonaAiRepairSnapshot(
  parsed: Record<string, unknown>,
  issues: PersonaAiGenerateIssue[],
): string {
  const allow = buildPersonaAiRepairAllowlist(issues)
  const needWb = allow.wbNames
  const needTop = allow.topKeys
  const lines: string[] = []

  const topLabels: { key: string; label: string }[] = [
    { key: 'realName', label: '真实姓名' },
    { key: 'wechatNickname', label: '微信昵称' },
    { key: 'occupation', label: '职业' },
    { key: 'motto', label: '座右铭' },
    { key: 'wechatSignature', label: '个性签名' },
    { key: 'mbti', label: 'MBTI' },
    { key: 'orientation', label: '性取向' },
    { key: 'bio', label: '简介' },
  ]

  const locked: string[] = []
  const rewriteTop: string[] = []

  for (const row of topLabels) {
    const raw = parsed[row.key]
    const text = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean).join('、')
      : String(raw ?? '').trim()
    const mustRewrite = allow.allowBroadMerge || needTop.has(row.key)
    if (!mustRewrite && text && text !== PLACEHOLDER) {
      locked.push(`${row.label}（已完整·勿改，约 ${text.length} 字）`)
      continue
    }
    if (mustRewrite) {
      if (text) rewriteTop.push(`${row.label}：${text}`)
      else rewriteTop.push(`${row.label}：（空·请补写）`)
    }
  }

  if (locked.length) {
    lines.push('【已完整顶层·禁止输出这些键】', ...locked.map((x) => `- ${x}`), '')
  }
  if (rewriteTop.length) {
    lines.push('【待处理顶层·仅可改这些键】', ...rewriteTop, '')
  }

  const arr = parsed.worldBookEntries ?? parsed.epilogueEntries
  const lockedWb: string[] = []
  const weakParts: string[] = []
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!name) continue
      const canonical = canonicalizePersonaAiCompactEntryName(name) ?? name
      const mustRewrite = allow.allowBroadMerge || needWb.has(canonical)
      if (!mustRewrite && content && content !== PLACEHOLDER) {
        lockedWb.push(`【${canonical}】（已完整·勿改，约 ${content.length} 字）`)
        continue
      }
      if (mustRewrite) {
        weakParts.push(
          '',
          `【${canonical}】`,
          content && content !== PLACEHOLDER ? content : '（空或过短·请重写本段）',
        )
      }
    }
  }

  for (const name of PERSONA_AI_COMPACT_ENTRY_NAMES) {
    if (!needWb.has(name) && !allow.allowBroadMerge) continue
    const already = weakParts.some((p) => p === `【${name}】`)
    if (already) continue
    const hasInArr =
      Array.isArray(arr) &&
      arr.some((x) => {
        if (!x || typeof x !== 'object') return false
        const n = canonicalizePersonaAiCompactEntryName(String((x as { name?: unknown }).name ?? ''))
        return n === name
      })
    if (!hasInArr) {
      weakParts.push('', `【${name}】`, '（缺失·请新写本段）')
    }
  }

  if (needWb.has(PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME) || allow.allowBroadMerge) {
    const already = weakParts.some((p) => p === `【${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}】`)
    if (!already) {
      const hasOrient =
        Array.isArray(arr) &&
        arr.some((x) => {
          if (!x || typeof x !== 'object') return false
          return isPersonaAiOrientationEpilogueName(String((x as { name?: unknown }).name ?? ''))
        })
      if (!hasOrient && needWb.has(PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME)) {
        weakParts.push(
          '',
          `【${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}】`,
          '（缺失·请新写本段）',
        )
      }
    }
  }

  if (needWb.has(PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME)) {
    const already = weakParts.some((p) => p === `【${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}】`)
    if (!already) {
      const hasHistory =
        Array.isArray(arr) &&
        arr.some((x) => {
          if (!x || typeof x !== 'object') return false
          return isPersonaAiRelationshipHistoryEntryName(String((x as { name?: unknown }).name ?? ''))
        })
      if (!hasHistory) {
        weakParts.push(
          '',
          `【${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}】`,
          '（缺失·请新写本段）',
        )
      }
    }
  }

  if (lockedWb.length) {
    lines.push('【已完整世界书·禁止输出这些段】', ...lockedWb.map((x) => `- ${x}`), '')
  }
  if (weakParts.length) {
    lines.push('【待处理世界书正文·仅可输出这些【标题】】', ...weakParts)
  }

  // 解析失败时仍给一份可读全文作参考（但提示勿整卷重抄）
  if (allow.allowBroadMerge && !rewriteTop.length && !weakParts.length) {
    const full = serializePersonaAiMarkup(parsed, { includeAllTop: true })
    if (full.trim()) {
      lines.push('', '【参考全文（可能残缺；只补缺漏，勿整卷重抄）】', full)
    }
  }

  const text = lines.join('\n').trim()
  if (text.length <= 12000) return text || '（暂无已生成内容）'
  return `${text.slice(0, 12000)}…（快照已截断）`
}

export function auditPersonaAiGenerateResult(
  character: Character,
  form: PersonaAiGenerateForm,
  meta: { parsed: Record<string, unknown>; parseRecovered: boolean; rawText: string },
): PersonaAiGenerateIssue[] {
  const issues: PersonaAiGenerateIssue[] = []
  if (meta.parseRecovered) {
    issues.push({
      id: 'parse-truncated',
      kind: 'parse',
      label: '输出可能被截断',
      detail: '模型标记文本未完整结束，已尽量抢救已写出的字段；建议补全或纠正。',
    })
  }

  for (const row of TOP_FIELD_AUDIT) {
    const v = meta.parsed[row.key]
    const charFallback =
      row.key === 'realName'
        ? character.name
        : row.key === 'wechatNickname'
          ? character.wechatNickname
          : row.key === 'occupation'
            ? character.identity
            : row.key === 'motto'
              ? character.motto
              : row.key === 'wechatSignature'
                ? character.wechatSignature
                : row.key === 'mbti'
                  ? character.mbti
                  : undefined
    const minLen = row.minLen ?? 2
    const kindA = classifyWeakField(v, minLen)
    const kindB = classifyWeakField(charFallback, minLen)
    const kind = kindA === 'ok' || kindB === 'ok' ? 'ok' : kindA === 'missing' && kindB === 'missing' ? 'missing' : 'placeholder'
    if (kind === 'missing') {
      issues.push({
        id: `top-${row.key}`,
        kind: 'missing_top_field',
        label: row.label,
        detail: '内容缺失',
      })
    } else if (kind === 'placeholder') {
      issues.push({
        id: `top-${row.key}`,
        kind: 'placeholder_field',
        label: row.label,
        detail: '内容过短或为占位稿',
      })
    }
  }

  {
    const bioKind = classifyWeakField(meta.parsed.bio ?? character.bio, 20)
    if (bioKind === 'missing') {
      issues.push({ id: 'top-bio', kind: 'missing_top_field', label: '简介 bio', detail: '未生成' })
    } else if (bioKind === 'placeholder') {
      issues.push({ id: 'top-bio', kind: 'placeholder_field', label: '简介 bio', detail: '过短或占位' })
    }
  }

  const contents = collectCompactEntryContentsFromParsed(meta.parsed)
  for (const name of PERSONA_AI_COMPACT_ENTRY_NAMES) {
    const content = contents.get(name)
    if (!content) {
      issues.push({
        id: `wb-${name}`,
        kind: 'missing_epilogue',
        label: `世界书 · ${name}`,
        detail: '模型未返回或标题不匹配',
      })
    } else if (isWeakFieldValue(content, Math.floor(PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS * 0.45))) {
      issues.push({
        id: `wb-${name}`,
        kind: 'placeholder_field',
        label: `世界书 · ${name}`,
        detail: `内容过短（目标约 ${PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS} 字）或为占位稿`,
      })
    }
  }

  if (form.orientationMutable) {
    const orientContent =
      pickPersonaAiOrientationEpilogueContent(
        Array.isArray(meta.parsed.worldBookEntries)
          ? (meta.parsed.worldBookEntries as PersonaAiEpilogueEntry[])
          : [],
      ) ||
      (() => {
        const book = findCompactPersonaBook(character)
        for (const it of book?.items ?? []) {
          if (isPersonaAiOrientationEpilogueName(String(it.name ?? ''))) {
            return String(it.content ?? '').trim()
          }
        }
        return ''
      })()
    if (!orientContent) {
      issues.push({
        id: `wb-${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}`,
        kind: 'missing_epilogue',
        label: `世界书 · ${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}`,
        detail: '取向可变时须单独输出该尾声条目',
      })
    } else if (isWeakFieldValue(orientContent, Math.floor(PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS * 0.35))) {
      issues.push({
        id: `wb-${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}`,
        kind: 'placeholder_field',
        label: `世界书 · ${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}`,
        detail: '内容过短或为占位稿',
      })
    }
  }

  if (form.relationshipHistoryHint.trim()) {
    const historyContent =
      pickPersonaAiRelationshipHistoryContent(
        Array.isArray(meta.parsed.worldBookEntries)
          ? (meta.parsed.worldBookEntries as PersonaAiEpilogueEntry[])
          : [],
      ) ||
      (() => {
        const book = findCompactPersonaBook(character)
        for (const it of book?.items ?? []) {
          if (isPersonaAiRelationshipHistoryEntryName(String(it.name ?? ''))) {
            return String(it.content ?? '').trim()
          }
        }
        return ''
      })()
    if (!historyContent) {
      issues.push({
        id: `wb-${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}`,
        kind: 'missing_epilogue',
        label: `世界书 · ${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}`,
        detail: '填写了感情史时须单独输出该条目',
      })
    } else if (isWeakFieldValue(historyContent, Math.floor(PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS * 0.35))) {
      issues.push({
        id: `wb-${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}`,
        kind: 'placeholder_field',
        label: `世界书 · ${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}`,
        detail: '内容过短或为占位稿',
      })
    }
  }

  const book = findCompactPersonaBook(character)
  let extras = 0
  for (const it of book?.items ?? []) {
    const rawName = String(it.name ?? '')
    if (isPersonaAiOrientationEpilogueName(rawName)) continue
    if (isPersonaAiRelationshipHistoryEntryName(rawName)) continue
    if (!canonicalizePersonaAiCompactEntryName(rawName)) extras += 1
  }
  if (extras > 0) {
    issues.push({
      id: 'wb-dup',
      kind: 'parse',
      label: '世界书条目标题不规范',
      detail: `有 ${extras} 条标题无法归并到 ${PERSONA_AI_COMPACT_ENTRY_NAMES.length} 条模板，可能重复；纠正时请只输出标准标题`,
    })
  }

  return issues
}

function deepMergePatch(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue
    if (Array.isArray(v)) {
      out[k] = v
      continue
    }
    if (typeof v === 'object' && typeof out[k] === 'object' && out[k] != null && !Array.isArray(out[k])) {
      out[k] = deepMergePatch(out[k] as Record<string, unknown>, v as Record<string, unknown>)
    } else {
      out[k] = v
    }
  }
  return out
}

export function mergePersonaAiParsedSnapshot(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  opts?: {
    orientationMutable?: boolean
    allowlist?: PersonaAiRepairAllowlist
    /** 纠正模式：允许名单内条目强制以补丁覆盖 */
    forceEntryPatch?: boolean
  },
): Record<string, unknown> {
  const filtered = opts?.allowlist
    ? filterPersonaAiRepairPatch(patch, opts.allowlist, base)
    : { ...patch }
  const patchCopy = { ...filtered }
  let mergedEntries: PersonaAiEpilogueEntry[] | undefined

  const patchEntries = patchCopy.worldBookEntries ?? patchCopy.epilogueEntries
  if (patchEntries != null) {
    const forcePatch =
      opts?.forceEntryPatch === true && !(opts.allowlist?.allowBroadMerge)
    mergedEntries = mergeWorldBookEntryArrays(
      base.worldBookEntries ?? base.epilogueEntries,
      patchEntries,
      {
        allowNames:
          opts?.allowlist && !opts.allowlist.allowBroadMerge ? opts.allowlist.wbNames : undefined,
        forcePatch,
      },
    )
    delete patchCopy.worldBookEntries
    delete patchCopy.epilogueEntries
  }

  const out = deepMergePatch(base, patchCopy)
  if (mergedEntries != null) out.worldBookEntries = mergedEntries
  return out
}

export function buildPersonaAiRepairSystemPrompt(opts: {
  orientationMutable: boolean
  nsfwEnabled: boolean
  relationToUser?: string
  mode?: 'complete' | 'fix'
  includeRelationshipHistory?: boolean
}): string {
  const rel = opts.relationToUser?.trim() || '普通熟人'
  const includeHistory = opts.includeRelationshipHistory === true
  const entryList = [
    ...PERSONA_AI_COMPACT_ENTRY_NAMES.map((n) => `- ${n}`),
    ...(opts.orientationMutable ? [`- ${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}（取向可变 · 尾声）`] : []),
    ...(includeHistory ? [`- ${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}（感情史 · 序言）`] : []),
  ].join('\n')
  const modeLine =
    opts.mode === 'fix'
      ? '本次任务是**纠正**：只重写「待处理」里标为过短/占位/不规范的字段与段落；已标「已完整·勿改」的禁止输出。'
      : '本次任务是**补全**：只新写「待处理」里标为缺失的字段与段落；已标「已完整·勿改」的禁止输出、禁止改写。'
  const orientHostLine = opts.orientationMutable
    ? `取向写在尾声「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」，「性格内核」勿写取向；禁止因 {{user}} 颜值写自我怀疑。`
    : '取向写在「性格内核」，禁止因 {{user}} 颜值写自我怀疑。'
  const historyHostLine = includeHistory
    ? `过往感情史写在序言「${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}」；禁止写成与 {{user}} 当前关系。`
    : ''
  return `你是中文都市向角色档案修复助手。用户已有一次生成结果，但部分字段缺失或为占位稿。
必须按【输出格式】写**纯文本标记**；**禁止 JSON**、禁止 Markdown 围栏、禁止解释。
${modeLine}
**增量铁律（最高优先级）**：
1. 只输出需要补全/纠正的键值行与【段落】；不要输出整份人设。
2. 快照里写「已完整·勿改」的键/段：一句都不要再写。
3. 系统会按白名单合并；你多写的完整字段会被丢弃，但浪费 token 且易截断。
世界书若输出：【标题】须与下列**完全一致**：
${entryList}
角色用 {{char}}、绑定玩家用 {{user}}，禁止写汉字真名。
与 {{user}} 的关系为「${rel}」；颜值欣赏≠恋爱≠取向动摇；「亲密与恋爱观」勿把 {{user}} 写成暗恋/性幻想对象；${orientHostLine}${historyHostLine ? ` ${historyHostLine}` : ''}
「对你现在」须先读懂关系原文「${rel}」的投入程度，心里分量与之对齐；原文未表达好感时禁止补写成潜在心动、嘴硬心软或暗中关注。
${buildPersonaAiIntimatePartnerWordingRules()}
${opts.nsfwEnabled ? 'NSFW 已开启：补写「亲密与恋爱观」须直白描绘；指恋人写「对方」；禁止超雄 caricature。' : 'NSFW 未开启：补写「亲密与恋爱观」须清水恋爱观，禁止露骨；指恋人写「对方」。'}
${opts.orientationMutable ? `${buildPersonaAiOrientationMutableSemanticsRule(true)}` : ''}
${buildPersonaAiCompactEntryLengthRules()}
补写正文须用**中性朴实**描述，禁止超雄/极端用语与八股油腻形容词。

${buildPersonaAiHealthyToneRules()}

【输出格式 · 增量纯文本（禁止 JSON）】
只写待处理项。顶层用「键：值」单行；多行块用【标题】单独成行，正文写在下一行起。
示例（假设只缺座右铭与「对你现在」）：
座右铭：……
【对你现在】
……正文……
不要输出示例里未列出的其他键或【段落】。`.trim()
}

export function buildPersonaAiRepairUserPrompt(params: {
  form: PersonaAiGenerateForm
  mode: 'complete' | 'fix'
  issues: PersonaAiGenerateIssue[]
  parsedSnapshot: Record<string, unknown>
  rawText?: string
  playerDisplayName?: string
  playerIdentity?: PlayerIdentity | null
  playerGender?: Gender | null
  worldBackgroundPrompt?: string
}): string {
  const { form, mode, issues } = params
  const allow = buildPersonaAiRepairAllowlist(issues)
  const allowedTop = [...allow.topKeys]
  const allowedWb = [...allow.wbNames]
  const issueLines = issues
    .map((i) => {
      const hint = repairHintForIssue(i)
      const tag =
        i.kind === 'missing_epilogue' || i.kind === 'missing_top_field'
          ? '缺失'
          : i.kind === 'placeholder_field'
            ? '过短/占位'
            : '解析'
      return `- [${tag}] ${i.label}${i.detail ? `（${i.detail}）` : ''}${hint ? ` → ${hint}` : ''}`
    })
    .join('\n')
  const relation = form.relationToUser.trim() || '普通熟人'
  const allowLines = [
    allow.allowBroadMerge
      ? '- （存在截断/解析问题：可补缺漏字段，但仍禁止整卷无差别重抄已完整内容）'
      : '',
    allowedTop.length ? `- 允许输出的顶层键：${allowedTop.join('、')}` : '',
    allowedWb.length ? `- 允许输出的世界书【标题】：${allowedWb.join('、')}` : '',
    !allow.allowBroadMerge && !allowedTop.length && !allowedWb.length
      ? '- （无明确白名单，请只处理【待处理项】列出的内容）'
      : '',
  ].filter(Boolean)

  const lines = [
    mode === 'complete'
      ? '请**仅补全缺失**条目（空字段/未返回的世界书段）。不要改写已有正文，哪怕你觉得能写得更好。'
      : '请**仅纠正过短/占位**条目。不要动已完整字段；对名单内条目可整段重写到合格长度。',
    '',
    '【重要】这是增量补丁，不是重新生成整个人设。输出越短越好，只含待处理键/段。',
    '',
    `【与 {{user}} 的关系】${relation}`,
    form.relationDetailHint.trim()
      ? `【开局关系细节】${form.relationDetailHint.trim()}`
      : '',
    buildPersonaAiRelationContextRules(form),
    buildPersonaAiNsfwHintToneRules(form),
    '',
    '【本次允许写入（白名单）】',
    ...allowLines,
    '',
    '【待处理项】',
    issueLines || '- （上次标记文本整体解析失败，请按格式补出缺漏；已完整内容仍勿重抄）',
    '',
    '【已有标记快照】',
    buildPersonaAiRepairSnapshot(params.parsedSnapshot, issues),
  ].filter(Boolean)
  if (params.rawText?.trim() && issues.some((i) => i.kind === 'parse')) {
    lines.push('', '【上次失败原文末尾（供修复截断）】', params.rawText.trim().slice(-4000))
  }
  const identityContext = buildPersonaAiPlayerIdentityContextBlock(params.playerIdentity)
  if (identityContext.trim()) {
    lines.push('', identityContext)
  }
  const dn = params.playerDisplayName?.trim()
  if (dn) lines.push('', `【绑定玩家展示名参考】${dn}（正文仍用 {{user}}）`)
  const playerGender = params.playerIdentity?.gender ?? params.playerGender ?? null
  const genderRules = buildPersonaAiPlayerUserGenderRules(playerGender)
  if (genderRules.trim()) lines.push('', '【绑定玩家性别 · {{user}}】', genderRules)
  if (params.worldBackgroundPrompt?.trim()) {
    lines.push('', `【世界背景参考】\n${params.worldBackgroundPrompt.trim()}`)
  }
  lines.push(
    '',
    '纠正/补全须遵守：完整参考上方【绑定玩家身份】与世界书；颜值欣赏≠恋爱≠取向动摇；「亲密与恋爱观」指恋人写「对方」；「对你现在」明确指 {{user}}；{{user}} 身体描写须与绑定玩家性别一致。',
    `补写世界书条目约 ${PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS} 字；描述用中性词，禁止超雄/极端用语与八股油腻形容词。`,
    '**全局禁止**：不得出现超雄、极端、病态 caricature，也不得堆砌花里胡哨网文标签。',
    '**只输出白名单内的键值行与【段落】**；禁止 JSON；禁止重复「已完整·勿改」内容。',
  )
  return lines.join('\n')
}
