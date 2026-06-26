import {
  buildPersonaAiHealthyToneRules,
  buildPersonaAiIntimatePartnerWordingRules,
  buildPersonaAiNsfwHintToneRules,
  buildPersonaAiOrientationMutableSemanticsRule,
  buildPersonaAiPlayerIdentityContextBlock,
  buildPersonaAiPlayerUserGenderRules,
  buildPersonaAiRelationContextRules,
} from './personaAiGeneratePrompt'
import type { PersonaAiGenerateForm } from './personaAiGenerateTypes'
import type { Character, Gender, PlayerIdentity } from './types'
import {
  canonicalizePersonaAiEpilogueEntryName,
  getPersonaAiEpilogueEntryTemplates,
  type PersonaAiEpilogueEntry,
} from './personaAiWorldBooks'

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

const COMPREHENSIVE_AUDIT: { path: string[]; label: string }[] = [
  { path: ['base', 'info'], label: '外在形象' },
  { path: ['base', 'physiology'], label: '气质与体态' },
  { path: ['core', 'surface'], label: '对外伪装' },
  { path: ['core', 'trueSelf'], label: '真实底色' },
  { path: ['core', 'values'], label: '三观与执念' },
  { path: ['core', 'flaws'], label: '优缺点与雷点' },
  { path: ['psyche', 'background'], label: '身世与性格成因' },
  { path: ['psyche', 'shadow'], label: '阴影与心结' },
  { path: ['psyche', 'emotionalPattern'], label: '情绪模式' },
  { path: ['psyche', 'orientationOrigin'], label: '取向与自我认同' },
  { path: ['abilities', 'skills'], label: '职业与技能' },
  { path: ['abilities', 'hobbies'], label: '爱好' },
  { path: ['abilities', 'socialMode'], label: '多面社交态度' },
  { path: ['fetish', 'preference'], label: '亲密偏好' },
  { path: ['fetish', 'sensory'], label: '感官与节奏' },
  { path: ['fetish', 'dynamic'], label: '相处动态' },
  { path: ['fetish', 'jealousy'], label: '吃醋与边界' },
  { path: ['fetish', 'intimateSpeech'], label: '亲密口语习惯' },
  { path: ['relations', 'family'], label: '对家庭' },
  { path: ['relations', 'friends'], label: '对友人' },
  { path: ['relations', 'enemies'], label: '对立面' },
  { path: ['contrast', 'beforeLove'], label: '恋爱前' },
  { path: ['contrast', 'afterLove'], label: '恋爱后' },
  { path: ['contrast', 'conflict'], label: '冲突与和好' },
  { path: ['daily', 'speech'], label: '口语与口头禅' },
  { path: ['daily', 'habits'], label: '日常习惯' },
  { path: ['daily', 'money'], label: '消费观' },
  { path: ['daily', 'quirks'], label: '下意识与小怪癖' },
  { path: ['arc', 'secrets'], label: '伪装与秘密' },
  { path: ['arc', 'goal'], label: '动机、恐惧与软肋' },
  { path: ['arc', 'contrastMoe'], label: '反差萌' },
]

function readNested(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj
  for (const k of path) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[k]
  }
  return cur
}

function isWeakFieldValue(v: unknown): boolean {
  const t = String(v ?? '').trim()
  if (!t) return true
  if (t === PLACEHOLDER) return true
  return t.length < 4
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

function parseEpilogueNamesFromParsed(
  parsed: Record<string, unknown>,
  orientationMutable: boolean,
): Set<string> {
  const names = new Set<string>()
  const rawArr = parsed.epilogueEntries
  if (!Array.isArray(rawArr)) return names
  for (const x of rawArr) {
    if (!x || typeof x !== 'object') continue
    const rawName = String((x as Record<string, unknown>).name ?? '').trim()
    if (!rawName) continue
    const canonical = canonicalizePersonaAiEpilogueEntryName(rawName, orientationMutable)
    names.add(canonical ?? rawName)
  }
  return names
}

function collectCanonicalEpilogueNames(
  parsed: Record<string, unknown>,
  character: Character,
  orientationMutable: boolean,
): Set<string> {
  const names = parseEpilogueNamesFromParsed(parsed, orientationMutable)
  const vol10 = (character.worldBooks ?? []).find((w) => w.name.includes('对你现在'))
  for (const it of vol10?.items ?? []) {
    const rawName = String(it.name ?? '').trim()
    if (!rawName) continue
    const canonical = canonicalizePersonaAiEpilogueEntryName(rawName, orientationMutable)
    if (canonical) names.add(canonical)
  }
  return names
}

function vol10NonCanonicalExtraCount(character: Character, orientationMutable: boolean): number {
  const vol10 = (character.worldBooks ?? []).find((w) => w.name.includes('对你现在'))
  let extras = 0
  for (const it of vol10?.items ?? []) {
    const c = canonicalizePersonaAiEpilogueEntryName(String(it.name ?? ''), orientationMutable)
    if (!c) extras += 1
  }
  return extras
}

/** 按条目标题合并尾声（补全只返回部分条目时，保留已有条目） */
export function mergeEpilogueEntryArrays(
  base: unknown,
  patch: unknown,
  orientationMutable: boolean,
): PersonaAiEpilogueEntry[] {
  const byKey = new Map<string, PersonaAiEpilogueEntry>()

  const ingest = (arr: unknown, patchWins: boolean) => {
    if (!Array.isArray(arr)) return
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!name || !content) continue
      const canonical = canonicalizePersonaAiEpilogueEntryName(name, orientationMutable)
      const key = canonical ?? name
      const entry: PersonaAiEpilogueEntry = { name: canonical ?? name, content }
      const prev = byKey.get(key)
      if (!prev || patchWins || content.length > prev.content.length) {
        byKey.set(key, entry)
      }
    }
  }

  ingest(base, false)
  ingest(patch, true)
  return Array.from(byKey.values())
}

export function syncEpilogueEntriesInParsedSnapshot(parsed: Record<string, unknown>, character: Character): void {
  const vol10 = (character.worldBooks ?? []).find((w) => w.name.includes('对你现在'))
  if (!vol10?.items?.length) return
  const entries = vol10.items
    .map((it) => ({
      name: String(it.name ?? '').trim(),
      content: String(it.content ?? '').trim(),
    }))
    .filter((e) => e.name && e.content && e.content !== PLACEHOLDER)
  if (entries.length) parsed.epilogueEntries = entries
}

const COMPREHENSIVE_ISSUE_PATHS: Record<string, string> = Object.fromEntries(
  COMPREHENSIVE_AUDIT.map((row) => [`ph-${row.path.join('.')}`, `comprehensive.${row.path.join('.')}`]),
)

function repairHintForIssue(issue: PersonaAiGenerateIssue): string | null {
  if (issue.id.startsWith('ep-')) {
    const name = issue.id.slice(3)
    return `epilogueEntries 中 name 须**完全一致**为「${name}」`
  }
  if (issue.id === 'top-bio') return '顶层 bio'
  if (issue.id === 'top-opening') return '顶层 openingLines'
  return COMPREHENSIVE_ISSUE_PATHS[issue.id] ?? null
}

/** 供补全 prompt 使用的精简快照：优先保留尾声与待补字段上下文 */
export function buildPersonaAiRepairSnapshot(
  parsed: Record<string, unknown>,
  issues: PersonaAiGenerateIssue[],
): string {
  const weakPaths = new Set(
    issues
      .filter((i) => i.kind === 'placeholder_field')
      .map((i) => COMPREHENSIVE_ISSUE_PATHS[i.id])
      .filter(Boolean) as string[],
  )
  const comprehensive = (parsed.comprehensive ?? parsed) as Record<string, unknown>
  const slimComprehensive: Record<string, unknown> = {}
  for (const path of weakPaths) {
    const parts = path.replace(/^comprehensive\./, '').split('.')
    const v = readNested(comprehensive, parts)
    if (v != null) {
      let cur = slimComprehensive as Record<string, unknown>
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i]!
        if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}
        cur = cur[k] as Record<string, unknown>
      }
      cur[parts[parts.length - 1]!] = v
    }
  }
  const slim: Record<string, unknown> = {}
  if (parsed.bio != null) slim.bio = parsed.bio
  if (parsed.openingLines != null) slim.openingLines = parsed.openingLines
  if (parsed.epilogueEntries != null) slim.epilogueEntries = parsed.epilogueEntries
  if (Object.keys(slimComprehensive).length) slim.comprehensive = slimComprehensive
  else if (parsed.comprehensive != null) {
    slim.comprehensive = '(其余九维字段已生成，此处省略；请勿重复输出已完整的 comprehensive 字段)'
  }
  const text = JSON.stringify(slim)
  if (text.length <= 12000) return text
  return `${text.slice(0, 12000)}…（快照已截断；epilogueEntries 与待补字段优先保留）`
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
      label: 'JSON 被截断',
      detail: '模型输出未完整结束，已尝试抢救部分字段；建议补全或纠正。',
    })
  }

  const comprehensive = (meta.parsed.comprehensive ?? meta.parsed) as Record<string, unknown>
  for (const row of COMPREHENSIVE_AUDIT) {
    const v = readNested(comprehensive, row.path)
    if (isWeakFieldValue(v)) {
      issues.push({
        id: `ph-${row.path.join('.')}`,
        kind: 'placeholder_field',
        label: row.label,
        detail: '内容缺失或为占位稿',
      })
    }
  }

  if (!String(meta.parsed.bio ?? '').trim() && !String(character.bio ?? '').trim()) {
    issues.push({ id: 'top-bio', kind: 'missing_top_field', label: '简介 bio', detail: '未生成' })
  }
  if (!String(meta.parsed.openingLines ?? '').trim() && !String(character.openingLines ?? '').trim()) {
    issues.push({
      id: 'top-opening',
      kind: 'missing_top_field',
      label: '开场白',
      detail: '未生成',
    })
  }
  const expected = getPersonaAiEpilogueEntryTemplates()
  const parsedNames = collectCanonicalEpilogueNames(meta.parsed, character, form.orientationMutable)
  for (const name of expected) {
    if (!parsedNames.has(name)) {
      issues.push({
        id: `ep-${name}`,
        kind: 'missing_epilogue',
        label: `尾声 · ${name}`,
        detail: '模型未返回或标题不匹配',
      })
    }
  }

  const extraCount = vol10NonCanonicalExtraCount(character, form.orientationMutable)
  if (extraCount > 0) {
    issues.push({
      id: 'ep-dup',
      kind: 'parse',
      label: '尾声条目标题不规范',
      detail: `有 ${extraCount} 条标题无法归并到模板，可能重复；纠正时请只输出标准标题`,
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
  opts?: { orientationMutable?: boolean },
): Record<string, unknown> {
  const patchCopy = { ...patch }
  let mergedEpilogue: PersonaAiEpilogueEntry[] | undefined
  if (patchCopy.epilogueEntries != null) {
    mergedEpilogue = mergeEpilogueEntryArrays(
      base.epilogueEntries,
      patchCopy.epilogueEntries,
      opts?.orientationMutable ?? false,
    )
    delete patchCopy.epilogueEntries
  }
  const out = deepMergePatch(base, patchCopy)
  if (mergedEpilogue != null) out.epilogueEntries = mergedEpilogue
  return out
}

export function buildPersonaAiRepairSystemPrompt(opts: {
  orientationMutable: boolean
  nsfwEnabled: boolean
  relationToUser?: string
}): string {
  const rel = opts.relationToUser?.trim() || '普通熟人'
  return `你是中文都市向角色档案修复助手。用户已有一次生成结果，但部分字段缺失、为占位稿或 JSON 不完整。
你必须输出且仅输出**单个合法 JSON 对象**（不要 Markdown 围栏、不要解释）。
**增量补全铁律**：在已有 JSON 快照上合并；只输出待补/待纠正的键，已正确的字段不要重复输出。
epilogueEntries 可**只输出缺失的几条**，系统会按 name 与已有条目合并，不会覆盖其它已生成的尾声。
结构须与完整人设 JSON 一致：可含 comprehensive、epilogueEntries、bio、openingLines 等顶层键。
epilogueEntries 若输出：name 须与模板**完全一致**；每项 { "name", "content" }。
角色用 {{char}}、绑定玩家用 {{user}}，禁止写汉字真名。
补全/纠正时须**完整参考**用户消息中的【绑定玩家身份】基础资料与世界书条目，{{user}} 的性别、身份与亲密描写不得与之矛盾。
与 {{user}} 的关系为「${rel}」；同学/朋友下颜值欣赏≠恋爱≠取向动摇；非恋爱关系勿把 fetish 写成对 {{user}} 的暗恋或性幻想；vol03 取向条目禁止因 {{user}} 颜值写自我怀疑。
${buildPersonaAiIntimatePartnerWordingRules()}
${opts.nsfwEnabled ? 'NSFW 已开启：补写的 fetish 五字段须**直白描绘**（黄文义，禁止隐喻/清水），语气遵循用户亲密种子；禁止超雄 caricature；指恋人写「对方」，禁止男人/女人。' : 'NSFW 未开启：补写的 fetish 须清水纯爱，intimateSpeech 写与对方亲密口语示例，禁止露骨性描写；指恋人写「对方」，禁止男人/女人。'}
${opts.orientationMutable ? `${buildPersonaAiOrientationMutableSemanticsRule(true)} 勿在 epilogueEntries 重复取向条目。` : ''}

${buildPersonaAiHealthyToneRules()}`.trim()
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
  const issueLines = issues
    .map((i) => {
      const hint = repairHintForIssue(i)
      return `- ${i.label}${i.detail ? `（${i.detail}）` : ''}${hint ? ` → 补写 JSON 键：${hint}` : ''}`
    })
    .join('\n')
  const relation = form.relationToUser.trim() || '普通熟人'
  const epilogueTemplates = getPersonaAiEpilogueEntryTemplates()
  const lines = [
    mode === 'complete'
      ? '请**仅补全**下列缺失条目，不要改动已正确的字段。'
      : '请**纠正**下列出错/占位/不贴合关系的条目，可重写对应字段使其自洽。',
    '',
    '【重要】本次是**增量补全**：在下方「已有 JSON 快照」基础上合并；不是从头重新生成整个人设。',
    '',
    `【与 {{user}} 的关系】${relation}`,
    form.relationDetailHint.trim()
      ? `【开局关系细节】${form.relationDetailHint.trim()}`
      : '',
    buildPersonaAiRelationContextRules(form),
    buildPersonaAiNsfwHintToneRules(form),
    '',
    '【vol10 尾声条目标题（须完全一致）】',
    ...epilogueTemplates.map((t) => `- ${t}`),
    '',
    '【待处理项】',
    issueLines || '- （模型上次 JSON 整体解析失败，请输出完整合法 JSON）',
    '',
    '【已有 JSON 快照（已生成内容，勿重复输出已完整的键）】',
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
    '纠正时须遵守：完整参考上方【绑定玩家身份】与世界书；颜值欣赏≠恋爱≠取向动摇；fetish 勿把 {{user}} 写成暗恋/性幻想对象；vol03 取向勿因 {{user}} 颜值写自我怀疑；vol05/vol07 指恋人写「对方」，禁止男人/女人；{{user}} 身体描写须与绑定玩家性别及身份资料一致（仅 epilogue 等明确指 {{user}} 的字段）。',
    '**全局禁止**：补写/纠正内容不得出现超雄、极端、病态 caricature（暴力压制、恐怖占有、跟踪监禁、PUA/煤气灯、精神疾病猎奇美化、性暴力 glorification 等）。',
    '输出单个 JSON 对象，仅包含需要补全/纠正的键。',
  )
  return lines.join('\n')
}
