import {
  PERSONA_AI_COMPACT_ENTRY_NAMES,
  PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME,
  PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME,
  canonicalizePersonaAiCompactEntryName,
  isPersonaAiOrientationEpilogueName,
  isPersonaAiRelationshipHistoryEntryName,
  type PersonaAiEpilogueEntry,
} from './personaAiWorldBooks'

/** 与 prompt 中 PERSONA_AI_COMPACT_ENTRY_TARGET_CHARS 保持一致 */
const ENTRY_TARGET_CHARS = 500

/** 顶层单行字段：中文键 → 内部 JSON 键 */
const TOP_FIELD_ALIASES: ReadonlyArray<{ keys: string[]; field: string }> = [
  { keys: ['真实姓名', '姓名', 'realName'], field: 'realName' },
  { keys: ['微信昵称', '昵称', 'wechatNickname'], field: 'wechatNickname' },
  { keys: ['年龄', 'age'], field: 'age' },
  { keys: ['性别', 'gender'], field: 'gender' },
  { keys: ['性取向', '取向', 'orientation'], field: 'orientation' },
  { keys: ['职业', '身份', 'occupation'], field: 'occupation' },
  { keys: ['座右铭', 'motto'], field: 'motto' },
  { keys: ['微信号', '微信ID', 'wechatId'], field: 'wechatId' },
  { keys: ['个性签名', '微信个性签名', 'wechatSignature'], field: 'wechatSignature' },
  { keys: ['生日', 'birthdayMD', 'birthday'], field: 'birthdayMD' },
  { keys: ['身高', 'heightCm', 'height'], field: 'heightCm' },
  { keys: ['体重', 'weightKg', 'weight'], field: 'weightKg' },
  { keys: ['MBTI', 'mbti'], field: 'mbti' },
  { keys: ['兴趣', '兴趣爱好', 'interests'], field: 'interests' },
  { keys: ['雷点', 'painPoints'], field: 'painPoints' },
]

const BLOCK_ALIASES: ReadonlyArray<{ titles: string[]; field: 'bio' | 'openingLines' | 'wb' }> = [
  { titles: ['简介', 'bio', '人设简介'], field: 'bio' },
  { titles: ['开场白', 'openingLines', '开场'], field: 'openingLines' },
]

function stripModelNoise(text: string): string {
  let s = String(text ?? '')
  s = s.replace(/```(?:json|text|markdown)?\s*/gi, '').replace(/```/g, '')
  s = s.replace(/<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi, '')
  s = s.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
  s = s.replace(/<\/?redacted_thinking\b[^>]*>/gi, '')
  return s.trim()
}

function normalizeKey(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[：:]$/, '')
}

function matchTopField(keyRaw: string): string | null {
  const k = normalizeKey(keyRaw)
  if (!k) return null
  for (const row of TOP_FIELD_ALIASES) {
    for (const alias of row.keys) {
      if (normalizeKey(alias) === k || normalizeKey(alias).toLowerCase() === k.toLowerCase()) {
        return row.field
      }
    }
  }
  return null
}

function splitList(raw: string): string[] {
  return String(raw ?? '')
    .split(/[,，、;/｜|]+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

function resolveBlockTitle(
  titleRaw: string,
): { kind: 'bio' | 'openingLines' | 'wb'; name?: string } | null {
  let t = String(titleRaw ?? '').trim()
  t = t.replace(/^世界书[·・.\-—–]*/, '').trim()
  if (isPersonaAiOrientationEpilogueName(t)) {
    return { kind: 'wb', name: PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME }
  }
  if (isPersonaAiRelationshipHistoryEntryName(t)) {
    return { kind: 'wb', name: PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME }
  }
  const compact = canonicalizePersonaAiCompactEntryName(t)
  if (compact) return { kind: 'wb', name: compact }

  const n = normalizeKey(t)
  for (const row of BLOCK_ALIASES) {
    for (const alias of row.titles) {
      if (normalizeKey(alias) === n) return { kind: row.field }
    }
  }
  return null
}

/**
 * 人设 AI 稳定输出格式（非 JSON）：
 * - 顶层：`键：值` 单行
 * - 多行块：`【简介】` / `【开场白】` / `【名片基础】` … 直到下一个【】或文末
 */
export function buildPersonaAiMarkupFormatSpec(opts?: {
  orientationMutable?: boolean
  includeRelationshipHistory?: boolean
}): string {
  const orientationMutable = opts?.orientationMutable ?? false
  const includeHistory = opts?.includeRelationshipHistory ?? false
  const wbNames: string[] = []
  for (const n of PERSONA_AI_COMPACT_ENTRY_NAMES) {
    wbNames.push(n)
    if (orientationMutable && n === '性格内核') {
      wbNames.push(PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME)
    }
    if (includeHistory && n === '亲密与恋爱观') {
      wbNames.push(PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME)
    }
  }
  const extraNote = [
    orientationMutable ? '取向可变尾声 1 条' : '',
    includeHistory ? '过往感情史 1 条' : '',
  ]
    .filter(Boolean)
    .join(' + ')
  const wbBlocks = wbNames
    .map((n) => {
      if (n === PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME) {
        return `【${n}】\n（取向「可变」专用尾声：约 ${Math.floor(ENTRY_TARGET_CHARS * 0.55)}–${ENTRY_TARGET_CHARS} 字；只写当下稳定自我认同，禁止写进「性格内核」）`
      }
      if (n === PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME) {
        return `【${n}】\n（约 ${Math.floor(ENTRY_TARGET_CHARS * 0.7)}–${ENTRY_TARGET_CHARS} 字；角色过往感情/前任余波；禁止写成与 {{user}} 的当前关系；勿并入「亲密与恋爱观」）`
      }
      if (n === '性格内核' && orientationMutable) {
        return `【${n}】\n（约 ${ENTRY_TARGET_CHARS} 字；面具/三观/身世/反差萌；**勿写性取向**，取向只写在「${PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME}」）`
      }
      if (n === '亲密与恋爱观' && includeHistory) {
        return `【${n}】\n（约 ${ENTRY_TARGET_CHARS} 字；一般恋爱观与四态；**过往感情史另写「${PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME}」**，此处勿展开长情史）`
      }
      return `【${n}】\n（约 ${ENTRY_TARGET_CHARS} 字正文）`
    })
    .join('\n\n')

  return `
【输出格式 · 纯文本标记（禁止 JSON）】
不要输出 JSON、不要 Markdown 代码围栏、不要解释。只按下列标记写纯文本。

一、顶层名片（每行一项，「键：值」；冒号可用全角或半角）：
真实姓名：
微信昵称：
年龄：
性别：（男 / 女 / 其他）
性取向：
职业：
座右铭：
微信号：
个性签名：
生日：（MM-DD）
身高：（厘米数字即可）
体重：（千克数字即可）
MBTI：
兴趣：（恰好 3 个，用顿号分隔）
雷点：（恰好 2 个，用顿号分隔）

二、多行块（标题必须用全角【】，标题单独成行；正文写在标题下一行起，直到下一个【】）：
【简介】
（80–220 字，第三人称，至少 2 次 {{char}}，禁止出现 {{user}}）

三、世界书条目（标题必须与下列**完全一致**，共 ${wbNames.length} 条${extraNote ? `；含 ${extraNote}` : ''}）：
${wbBlocks}

截断容错：即使后文被截断，已写出的「键：值」与已写出的【标题】段仍可被解析；请尽量先写完顶层与简介，再写世界书各条。
**禁止输出【开场白】**（开场白由用户日后在人设编辑页自行填写或生成）。
`.trim()
}

export type PersonaAiMarkupParseResult = {
  parsed: Record<string, unknown>
  /** 解析到了至少一项有效内容 */
  ok: boolean
  /** 有部分字段但可能被截断 */
  partial: boolean
}

/** 从模型纯文本标记解析为人设内部结构（与旧 JSON 同形，供 assemble 复用） */
export function parsePersonaAiMarkup(text: string): PersonaAiMarkupParseResult {
  const raw = stripModelNoise(text)
  const parsed: Record<string, unknown> = {}
  const wbByName = new Map<string, string>()

  if (!raw) return { parsed, ok: false, partial: false }

  // 按 【标题】 切开
  const sectionRe = /【\s*([^】]+?)\s*】/g
  const headers: { title: string; index: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = sectionRe.exec(raw)) !== null) {
    headers.push({ title: m[1]!.trim(), index: m.index, end: m.index + m[0].length })
  }

  const headText = headers.length ? raw.slice(0, headers[0]!.index) : raw

  for (const line of headText.split(/\r?\n/)) {
    const lm = /^\s*([^：:\n]{1,24})\s*[：:]\s*(.*)$/.exec(line)
    if (!lm) continue
    const field = matchTopField(lm[1]!)
    if (!field) continue
    const value = (lm[2] ?? '').trim()
    if (!value) continue
    if (field === 'interests' || field === 'painPoints') {
      parsed[field] = splitList(value)
    } else if (field === 'age') {
      const n = Number.parseInt(value.replace(/\D/g, ''), 10)
      if (Number.isFinite(n)) parsed.age = n
    } else {
      parsed[field] = value
    }
  }

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i]!
    const bodyStart = h.end
    const bodyEnd = i + 1 < headers.length ? headers[i + 1]!.index : raw.length
    const body = raw.slice(bodyStart, bodyEnd).trim()
    if (!body) continue
    const resolved = resolveBlockTitle(h.title)
    if (!resolved) continue
    if (resolved.kind === 'bio') {
      parsed.bio = body
    } else if (resolved.kind === 'openingLines') {
      parsed.openingLines = body
    } else if (resolved.kind === 'wb' && resolved.name) {
      const prev = wbByName.get(resolved.name)
      if (!prev || body.length > prev.length) wbByName.set(resolved.name, body)
    }
  }

  if (wbByName.size) {
    const entries: PersonaAiEpilogueEntry[] = []
    for (const name of PERSONA_AI_COMPACT_ENTRY_NAMES) {
      const content = wbByName.get(name)
      if (content) entries.push({ name, content })
    }
    const orient = wbByName.get(PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME)
    if (orient) {
      entries.push({ name: PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME, content: orient })
    }
    const history = wbByName.get(PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME)
    if (history) {
      entries.push({ name: PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME, content: history })
    }
    for (const [name, content] of wbByName) {
      if (!entries.some((e) => e.name === name)) entries.push({ name, content })
    }
    parsed.worldBookEntries = entries
  }

  // 增量补全可能只返回少数顶层键或若干【段落】
  const ok = Object.keys(parsed).length > 0

  const expectedWb = PERSONA_AI_COMPACT_ENTRY_NAMES.length
  const gotWb = wbByName.size
  const partial =
    ok &&
    (gotWb < expectedWb ||
      !parsed.bio ||
      !parsed.realName)

  return { parsed, ok, partial }
}

/** 将内部快照序列化为标记文本，供补全模型阅读 */
export function serializePersonaAiMarkup(
  parsed: Record<string, unknown>,
  opts?: { onlyWeakNames?: Set<string>; includeAllTop?: boolean },
): string {
  const lines: string[] = []
  const pushField = (label: string, key: string) => {
    const v = parsed[key]
    if (v == null) return
    if (Array.isArray(v)) {
      const joined = v.map((x) => String(x).trim()).filter(Boolean).join('、')
      if (joined) lines.push(`${label}：${joined}`)
      return
    }
    const s = String(v).trim()
    if (s) lines.push(`${label}：${s}`)
  }

  if (opts?.includeAllTop !== false) {
    pushField('真实姓名', 'realName')
    pushField('微信昵称', 'wechatNickname')
    pushField('年龄', 'age')
    pushField('性别', 'gender')
    pushField('性取向', 'orientation')
    pushField('职业', 'occupation')
    pushField('座右铭', 'motto')
    pushField('微信号', 'wechatId')
    pushField('个性签名', 'wechatSignature')
    pushField('生日', 'birthdayMD')
    pushField('身高', 'heightCm')
    pushField('体重', 'weightKg')
    pushField('MBTI', 'mbti')
    pushField('兴趣', 'interests')
    pushField('雷点', 'painPoints')
  }

  if (parsed.bio != null && String(parsed.bio).trim()) {
    lines.push('', '【简介】', String(parsed.bio).trim())
  }
  if (parsed.openingLines != null && String(parsed.openingLines).trim()) {
    lines.push('', '【开场白】', String(parsed.openingLines).trim())
  }

  const arr = parsed.worldBookEntries
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!name || !content) continue
      const canonical = canonicalizePersonaAiCompactEntryName(name) ?? name
      if (opts?.onlyWeakNames?.size && !opts.onlyWeakNames.has(canonical)) continue
      lines.push('', `【${canonical}】`, content)
    }
  }

  const text = lines.join('\n').trim()
  if (text.length <= 12000) return text
  return `${text.slice(0, 12000)}…（快照已截断）`
}

/** 尝试解析：优先标记文本，其次兼容旧 JSON */
export function parsePersonaAiModelOutput(text: string): {
  parsed: Record<string, unknown>
  parseRecovered: boolean
  format: 'markup' | 'json'
} {
  const markup = parsePersonaAiMarkup(text)
  if (markup.ok) {
    return {
      parsed: markup.parsed,
      parseRecovered: markup.partial,
      format: 'markup',
    }
  }

  // JSON 兼容（偶发模型仍输出 JSON）
  try {
    const t = stripModelNoise(text)
    const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t)
    const raw = (fence ? fence[1] : t).trim()
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
      if (parsed && typeof parsed === 'object') {
        return { parsed, parseRecovered: false, format: 'json' }
      }
    }
  } catch {
    /* fallthrough */
  }

  return { parsed: markup.parsed, parseRecovered: true, format: 'markup' }
}
