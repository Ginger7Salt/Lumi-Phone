import type { ApiConfig } from '../../api/types'
import type { Character, Gender, PlayerIdentity } from './types'
import { openAiCompatibleChat, normalizeWechatId } from './ai'
import { WECHAT_SIGNATURE_GENERATE_MAX, coerceWechatSignature } from './wechatSignatureStyleRules'
import type { PersonaAiGenerateForm } from './personaAiGenerateTypes'
import {
  buildPersonaAiGenerateSystemPrompt,
  buildPersonaAiGenerateUserPrompt,
} from './personaAiGeneratePrompt'
import {
  buildPersonaSummaryFromComprehensive,
  normalizeComprehensivePersona,
  parseMeetAgeYearsFromInfo,
  type ComprehensivePersona,
} from '../../lumiMeet/comprehensivePersona'
import {
  buildPersonaAiWorldBooks,
  parsePersonaAiCompactSectionsFromParsed,
} from './personaAiWorldBooks'
import { parsePersonaAiModelOutput } from './personaAiGenerateMarkup'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import {
  auditPersonaAiGenerateResult,
  buildPersonaAiRepairAllowlist,
  buildPersonaAiRepairSystemPrompt,
  buildPersonaAiRepairUserPrompt,
  mergePersonaAiParsedSnapshot,
  PersonaAiGenerateFailure,
  pickPersonaAiRepairIssues,
  syncWorldBookEntriesInParsedSnapshot,
  type PersonaAiGenerateIssue,
  type PersonaAiGenerateResult,
} from './personaAiGenerateRecovery'

export type { PersonaAiGenerateIssue, PersonaAiGenerateResult }
export { PersonaAiGenerateFailure, pickPersonaAiRepairIssues } from './personaAiGenerateRecovery'

function parseModelOutput(text: string): { parsed: Record<string, unknown>; parseRecovered: boolean } {
  const result = parsePersonaAiModelOutput(text)
  if (!result.parsed || Object.keys(result.parsed).length === 0) {
    throw new PersonaAiGenerateFailure('模型未返回可解析的人设标记文本', text)
  }
  // 至少要有姓名或简介或一条世界书，否则视为失败
  const hasCore =
    Boolean(result.parsed.realName || result.parsed.wechatNickname || result.parsed.bio) ||
    (Array.isArray(result.parsed.worldBookEntries) && result.parsed.worldBookEntries.length > 0)
  if (!hasCore) {
    throw new PersonaAiGenerateFailure('模型输出无法识别为人设标记（缺少姓名/简介/世界书）', text)
  }
  return { parsed: result.parsed, parseRecovered: result.parseRecovered }
}

/** 补全/纠正：允许只返回待改字段（增量补丁） */
function parseRepairModelOutput(text: string): { parsed: Record<string, unknown>; parseRecovered: boolean } {
  const result = parsePersonaAiModelOutput(text)
  if (!result.parsed || Object.keys(result.parsed).length === 0) {
    throw new PersonaAiGenerateFailure('模型未返回可解析的补全标记文本', text)
  }
  return { parsed: result.parsed, parseRecovered: result.parseRecovered }
}

function parseGenderFromAi(raw: unknown, fallback: Gender): Gender {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'male' || s === '男' || s === 'm') return 'male'
  if (s === 'female' || s === '女' || s === 'f') return 'female'
  if (s === 'other' || s === '其他') return 'other'
  return fallback
}

function pickStr(v: unknown, max: number, fallback = ''): string {
  if (typeof v !== 'string') return fallback
  const t = v.trim()
  if (!t) return fallback
  return t.length > max ? t.slice(0, max) : t
}

function pickStrArray(v: unknown, count: number): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .slice(0, count)
}

function formatHeightFromCm(cm: string): string {
  const n = String(cm ?? '').replace(/\D/g, '')
  return n ? `${n}cm` : ''
}

function formatWeightFromKg(kg: string): string {
  const n = String(kg ?? '').replace(/[^\d.]/g, '')
  return n ? `${n}kg` : ''
}

function extractMbtiLetters(mbtiRaw: string): string {
  const m = /([IE][NS][FT][JP])/i.exec(String(mbtiRaw ?? ''))
  return m ? m[1]!.toUpperCase() : pickStr(mbtiRaw, 16)
}

type AssembleParams = {
  form: PersonaAiGenerateForm
  draft: Character
  playerDisplayName?: string
}

function assemblePersonaCharacter(parsed: Record<string, unknown>, params: AssembleParams): Character {
  const hasComprehensive =
    parsed.comprehensive != null && typeof parsed.comprehensive === 'object'
  const comprehensive = hasComprehensive
    ? normalizeComprehensivePersona(parsed.comprehensive, { preserveUserPlaceholder: true })
    : normalizeComprehensivePersona({}, { preserveUserPlaceholder: true })

  const sections = parsePersonaAiCompactSectionsFromParsed(parsed)

  const userNameHint = params.form.nameHint.trim()
  const aiRealName = pickStr(parsed.realName, 24) || comprehensive.base.realName.trim() || '未命名'
  const realName = userNameHint || aiRealName
  comprehensive.base.realName = realName

  const wechatNickname = pickStr(parsed.wechatNickname, 12) || realName.slice(0, 2) || realName
  const ageNum = Number(parsed.age)
  const ageFromInfo = parseMeetAgeYearsFromInfo(comprehensive.base.info)
  const age =
    Number.isFinite(ageNum) && ageNum >= 16 && ageNum <= 99
      ? Math.round(ageNum)
      : ageFromInfo ?? null

  const heightCm = pickStr(parsed.heightCm, 16) || comprehensive.base.heightCm
  const weightKg = pickStr(parsed.weightKg, 16) || comprehensive.base.weightKg
  const birthdayMD = pickStr(parsed.birthdayMD, 8) || comprehensive.base.birthdayMD
  const zodiac = pickStr(parsed.zodiac, 16) || comprehensive.base.zodiac
  const mbti = extractMbtiLetters(pickStr(parsed.mbti, 16) || comprehensive.core.mbti)

  const now = Date.now()
  const characterId = params.draft.id
  const historyHint = params.form.relationshipHistoryHint.trim()
  const worldBooks = buildPersonaAiWorldBooks(
    characterId,
    wechatNickname,
    null,
    now,
    sections,
    params.playerDisplayName,
    {
      orientationMutable: params.form.orientationMutable,
      relationToUser: params.form.relationToUser,
      orientationLabel: pickStr(parsed.orientation, 48) || params.form.orientationHint.trim() || undefined,
      includeRelationshipHistory: Boolean(historyHint),
      relationshipHistoryHint: historyHint || undefined,
    },
  )

  const bio =
    pickStr(parsed.bio, 400) ||
    (hasComprehensive
      ? buildPersonaSummaryFromComprehensive(comprehensive as ComprehensivePersona)
      : '')

  const openingLines = ''
  // 立体人设生成不产出开场白；若模型仍输出则丢弃，留给用户日后填写
  if (parsed.openingLines != null) delete parsed.openingLines
  const interests = pickStrArray(parsed.interests, 3)
  const painPoints = pickStrArray(parsed.painPoints, 2)
  const wechatId = normalizeWechatId(pickStr(parsed.wechatId, 20), characterId)
  const sigSeed = realName || characterId
  const sigRaw =
    pickStr(parsed.wechatSignature, WECHAT_SIGNATURE_GENERATE_MAX) ||
    comprehensive.base.wechatSignature.trim()
  const wechatSignature = coerceWechatSignature(sigRaw, sigSeed, WECHAT_SIGNATURE_GENERATE_MAX)

  const avatarUrl = params.form.avatarUrl.trim()

  return {
    ...params.draft,
    updatedAt: now,
    name: realName,
    gender: parseGenderFromAi(parsed.gender, params.form.gender),
    age,
    height: formatHeightFromCm(heightCm),
    weight: formatWeightFromKg(weightKg),
    birthdayMD,
    zodiac,
    identity: pickStr(parsed.occupation, 48) || '学生',
    mbti,
    bio,
    motto: pickStr(parsed.motto, 40),
    openingLines,
    wechatNickname,
    wechatId,
    wechatSignature,
    ...(avatarUrl ? { avatarUrl, originalAvatarUrl: avatarUrl } : {}),
    interests: interests.length ? interests : undefined,
    painPoints: painPoints.length ? painPoints : undefined,
    worldBooks,
    worldBackgroundId: params.draft.worldBackgroundId?.trim() || DEFAULT_WORLD_BACKGROUND_ID,
    worldBackgroundEnabled: params.draft.worldBackgroundEnabled ?? true,
  }
}

export function buildPersonaAiFromModelText(
  rawText: string,
  params: {
    form: PersonaAiGenerateForm
    draft: Character
    playerDisplayName?: string
  },
): PersonaAiGenerateResult {
  const { parsed, parseRecovered } = parseModelOutput(rawText)
  const character = assemblePersonaCharacter(parsed, params)
  const issues = auditPersonaAiGenerateResult(character, params.form, {
    parsed,
    parseRecovered,
    rawText,
  })
  syncWorldBookEntriesInParsedSnapshot(parsed, character)
  return {
    character,
    issues,
    rawText,
    parsedSnapshot: parsed,
    parseRecovered,
  }
}

async function callPersonaAiText(
  cfg: ApiConfig,
  system: string,
  user: string,
  signal?: AbortSignal,
): Promise<string> {
  return openAiCompatibleChat(
    cfg,
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { max_tokens: 12288, signal },
  )
}

export function isPersonaAiAbortError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const name = String((e as { name?: unknown }).name ?? '')
  if (name === 'AbortError') return true
  const msg = e instanceof Error ? e.message : String(e)
  return /aborted|abort|The user aborted|signal is aborted/i.test(msg)
}

export async function generatePersonaWithAi(params: {
  apiConfig: ApiConfig
  form: PersonaAiGenerateForm
  draft: Character
  playerIdentity?: PlayerIdentity | null
  playerDisplayName?: string
  worldBackgroundPrompt?: string
  signal?: AbortSignal
}): Promise<PersonaAiGenerateResult> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim() || !cfg?.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }

  const system = buildPersonaAiGenerateSystemPrompt({
    orientationMutable: params.form.orientationMutable,
    nsfwEnabled: params.form.nsfwEnabled,
    relationToUser: params.form.relationToUser,
    nsfwHint: params.form.nsfwHint,
    includeRelationshipHistory: Boolean(params.form.relationshipHistoryHint.trim()),
  })
  const user = buildPersonaAiGenerateUserPrompt({
    form: params.form,
    playerDisplayName: params.playerDisplayName,
    playerIdentity: params.playerIdentity,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
  })

  const raw = await callPersonaAiText(cfg, system, user, params.signal)
  return buildPersonaAiFromModelText(raw, {
    form: params.form,
    draft: params.draft,
    playerDisplayName: params.playerDisplayName,
  })
}

export async function repairPersonaAiWithAi(params: {
  apiConfig: ApiConfig
  form: PersonaAiGenerateForm
  draft: Character
  base: PersonaAiGenerateResult
  mode: 'complete' | 'fix'
  issueFilter?: (issue: PersonaAiGenerateIssue) => boolean
  playerDisplayName?: string
  playerIdentity?: PlayerIdentity | null
  worldBackgroundPrompt?: string
  signal?: AbortSignal
}): Promise<PersonaAiGenerateResult> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim() || !cfg?.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }

  const issues = params.issueFilter
    ? params.base.issues.filter(params.issueFilter)
    : pickPersonaAiRepairIssues(params.base.issues, params.mode)

  if (issues.length === 0) {
    throw new Error(
      params.mode === 'complete'
        ? '没有可补全的缺失项（过短/占位请用「纠正出错内容」）'
        : '没有可纠正的过短/占位项（空白缺失请用「继续补全剩余条目」）',
    )
  }

  const allowlist = buildPersonaAiRepairAllowlist(issues)

  const system = buildPersonaAiRepairSystemPrompt({
    orientationMutable: params.form.orientationMutable,
    nsfwEnabled: params.form.nsfwEnabled,
    relationToUser: params.form.relationToUser,
    mode: params.mode,
    includeRelationshipHistory: Boolean(params.form.relationshipHistoryHint.trim()),
  })
  const user = buildPersonaAiRepairUserPrompt({
    form: params.form,
    mode: params.mode,
    issues,
    parsedSnapshot: params.base.parsedSnapshot,
    rawText: params.base.rawText,
    playerDisplayName: params.playerDisplayName,
    playerIdentity: params.playerIdentity,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
  })

  const raw = await callPersonaAiText(cfg, system, user, params.signal)
  const { parsed: patch, parseRecovered } = parseRepairModelOutput(raw)
  const merged = mergePersonaAiParsedSnapshot(params.base.parsedSnapshot, patch, {
    orientationMutable: params.form.orientationMutable,
    allowlist,
    forceEntryPatch: params.mode === 'fix',
  })
  const character = assemblePersonaCharacter(merged, {
    form: params.form,
    draft: params.draft,
    playerDisplayName: params.playerDisplayName,
  })
  syncWorldBookEntriesInParsedSnapshot(merged, character)
  const mergedIssues = auditPersonaAiGenerateResult(character, params.form, {
    parsed: merged,
    parseRecovered,
    rawText: `${params.base.rawText}\n---repair---\n${raw}`,
  })
  return {
    character,
    issues: mergedIssues,
    rawText: raw,
    parsedSnapshot: merged,
    parseRecovered,
  }
}

const TOP_FIELD_REGEN_KEYS = new Set([
  'realName',
  'wechatNickname',
  'occupation',
  'motto',
  'wechatSignature',
  'mbti',
  'orientation',
  'bio',
])

/** 预览后：按用户勾选条目 + 改写要求，增量重写世界书/顶层字段 */
export async function regeneratePersonaAiSelectedParts(params: {
  apiConfig: ApiConfig
  form: PersonaAiGenerateForm
  draft: Character
  base: PersonaAiGenerateResult
  /** 世界书条目标题，或顶层键（bio / realName…） */
  selectedNames: string[]
  guidance: string
  playerDisplayName?: string
  playerIdentity?: PlayerIdentity | null
  worldBackgroundPrompt?: string
  signal?: AbortSignal
}): Promise<PersonaAiGenerateResult> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim() || !cfg?.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }
  const names = [...new Set(params.selectedNames.map((n) => n.trim()).filter(Boolean))]
  if (!names.length) throw new Error('请先勾选要重写的条目')

  const topKeys = new Set<string>()
  const wbNames = new Set<string>()
  for (const n of names) {
    if (TOP_FIELD_REGEN_KEYS.has(n) || n === '简介') {
      if (n === '简介') topKeys.add('bio')
      else topKeys.add(n)
    } else if (n === '开场白' || n === 'openingLines') {
      // 立体人设不生成开场白，忽略
      continue
    } else {
      wbNames.add(n)
    }
  }
  if (!topKeys.size && !wbNames.size) throw new Error('请先勾选要重写的条目（不含开场白）')

  const allowlist = {
    topKeys,
    wbNames,
    allowBroadMerge: false,
  }

  const guidance = params.guidance.trim() || '按用户不满意处重写，保持人设自洽与标记格式。'
  const snapshotLines: string[] = []
  for (const key of topKeys) {
    const v = params.base.parsedSnapshot[key]
    const text = Array.isArray(v)
      ? v.map((x) => String(x).trim()).filter(Boolean).join('、')
      : String(v ?? '').trim()
    const label =
      key === 'bio'
        ? '简介'
        : key === 'realName'
          ? '真实姓名'
          : key === 'wechatNickname'
            ? '微信昵称'
            : key === 'wechatSignature'
              ? '个性签名'
              : key === 'occupation'
                ? '职业'
                : key === 'orientation'
                  ? '性取向'
                  : key
    if (key === 'bio') {
      snapshotLines.push('', `【${label}】`, text || '（空）')
    } else {
      snapshotLines.push(`${label}：${text || '（空）'}`)
    }
  }
  const arr = params.base.parsedSnapshot.worldBookEntries
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      if (!wbNames.has(name)) continue
      snapshotLines.push('', `【${name}】`, String(o.content ?? '').trim() || '（空）')
    }
  }
  for (const name of wbNames) {
    if (!snapshotLines.some((l) => l === `【${name}】`)) {
      snapshotLines.push('', `【${name}】`, '（缺失·请新写）')
    }
  }

  const system = `你是中文都市向角色档案改写助手。用户对部分条目不满意，请**只重写白名单内的键值行与【段落】**，禁止 JSON，禁止输出未勾选项，**禁止输出【开场白】**。
改写须贴合用户改写要求；仍用 {{char}}/{{user}}；第三人称档案体；中性朴实，禁止超雄 caricature。
世界书【标题】须与用户指定标题完全一致。`.trim()

  const user = [
    '【改写要求（最高优先级）】',
    guidance,
    '',
    '【白名单 · 仅可输出这些】',
    topKeys.size ? `- 顶层：${[...topKeys].join('、')}` : '',
    wbNames.size ? `- 世界书：${[...wbNames].join('、')}` : '',
    '',
    '【待改写原文】',
    snapshotLines.join('\n'),
    '',
    '只输出改写后的键值行与【段落】，不要解释。',
  ]
    .filter(Boolean)
    .join('\n')

  const raw = await callPersonaAiText(cfg, system, user, params.signal)
  const { parsed: patch, parseRecovered } = parseRepairModelOutput(raw)
  const merged = mergePersonaAiParsedSnapshot(params.base.parsedSnapshot, patch, {
    orientationMutable: params.form.orientationMutable,
    allowlist,
    forceEntryPatch: true,
  })
  const character = assemblePersonaCharacter(merged, {
    form: params.form,
    draft: params.draft,
    playerDisplayName: params.playerDisplayName,
  })
  // 局部重写也不写入开场白
  character.openingLines = ''
  if (merged.openingLines != null) delete merged.openingLines
  syncWorldBookEntriesInParsedSnapshot(merged, character)
  const mergedIssues = auditPersonaAiGenerateResult(character, params.form, {
    parsed: merged,
    parseRecovered,
    rawText: `${params.base.rawText}\n---regen---\n${raw}`,
  })
  return {
    character,
    issues: mergedIssues,
    rawText: raw,
    parsedSnapshot: merged,
    parseRecovered,
  }
}
