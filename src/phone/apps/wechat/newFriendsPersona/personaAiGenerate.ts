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
import { buildPersonaAiWorldBooks, PERSONA_AI_EPILOGUE_ENTRY_NAMES, type PersonaAiEpilogueEntry } from './personaAiWorldBooks'
import { DEFAULT_WORLD_BACKGROUND_ID } from './worldBackgroundConstants'
import {
  auditPersonaAiGenerateResult,
  buildPersonaAiRepairSystemPrompt,
  buildPersonaAiRepairUserPrompt,
  mergePersonaAiParsedSnapshot,
  PersonaAiGenerateFailure,
  salvageTruncatedJsonObject,
  syncEpilogueEntriesInParsedSnapshot,
  type PersonaAiGenerateIssue,
  type PersonaAiGenerateResult,
} from './personaAiGenerateRecovery'

export type { PersonaAiGenerateIssue, PersonaAiGenerateResult }
export { PersonaAiGenerateFailure } from './personaAiGenerateRecovery'

function parseJsonObjectFromModelText(text: string): Record<string, unknown> {
  const t = text.trim()
  const fence = /```(?:json)?\s*([\s\S]*?)```/i
  const m = t.match(fence)
  const raw = (m ? m[1] : t).trim()
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('模型未返回可解析的 JSON 对象')
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>
}

function parseModelJsonObject(text: string): { parsed: Record<string, unknown>; parseRecovered: boolean } {
  try {
    return { parsed: parseJsonObjectFromModelText(text), parseRecovered: false }
  } catch (e) {
    const salvaged = salvageTruncatedJsonObject(text)
    if (salvaged) return { parsed: salvaged, parseRecovered: true }
    const msg = e instanceof Error ? e.message : 'JSON 解析失败'
    throw new PersonaAiGenerateFailure(msg, text)
  }
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


function parseEpilogueEntry(raw: unknown): PersonaAiEpilogueEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const name = pickStr(o.name, 64, '对 {{user}} 的当前态度')
  const content = pickStr(o.content, 2000)
  if (!content) return null
  return { name, content }
}

function parseEpilogueEntries(parsed: Record<string, unknown>): PersonaAiEpilogueEntry[] | null {
  const rawArr = parsed.epilogueEntries
  if (Array.isArray(rawArr) && rawArr.length) {
    const entries = rawArr
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        const name = pickStr(o.name, 64)
        const content = pickStr(o.content, 2000)
        if (!name || !content) return null
        return { name, content }
      })
      .filter((x): x is PersonaAiEpilogueEntry => x !== null)
    if (entries.length) return entries
  }
  const legacy = parseEpilogueEntry(parsed.epilogueEntry)
  if (legacy) {
    return [{ ...legacy, name: PERSONA_AI_EPILOGUE_ENTRY_NAMES[0] }]
  }
  return null
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
  const comprehensive = normalizeComprehensivePersona(parsed.comprehensive ?? parsed, {
    preserveUserPlaceholder: true,
  })
  const epilogueEntries = parseEpilogueEntries(parsed)

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

  const now = Date.now()
  const characterId = params.draft.id
  const worldBooks = buildPersonaAiWorldBooks(
    characterId,
    wechatNickname,
    comprehensive,
    now,
    epilogueEntries,
    params.playerDisplayName,
    {
      orientationMutable: params.form.orientationMutable,
      relationToUser: params.form.relationToUser,
    },
  )

  const bio =
    pickStr(parsed.bio, 400) ||
    buildPersonaSummaryFromComprehensive(comprehensive as ComprehensivePersona)

  const openingLines = pickStr(parsed.openingLines, 1200)
  const interests = pickStrArray(parsed.interests, 3)
  const painPoints = pickStrArray(parsed.painPoints, 2)
  const wechatId = normalizeWechatId(pickStr(parsed.wechatId, 20), characterId)
  const sigSeed = realName || characterId
  const sigRaw =
    pickStr(parsed.wechatSignature, WECHAT_SIGNATURE_GENERATE_MAX) ||
    comprehensive.base.wechatSignature.trim()
  const wechatSignature = coerceWechatSignature(sigRaw, sigSeed, WECHAT_SIGNATURE_GENERATE_MAX)
  comprehensive.base.wechatSignature = wechatSignature

  const avatarUrl = params.form.avatarUrl.trim()

  return {
    ...params.draft,
    updatedAt: now,
    name: realName,
    gender: parseGenderFromAi(parsed.gender, params.form.gender),
    age,
    height: formatHeightFromCm(comprehensive.base.heightCm),
    weight: formatWeightFromKg(comprehensive.base.weightKg),
    birthdayMD: comprehensive.base.birthdayMD,
    zodiac: comprehensive.base.zodiac,
    identity: pickStr(parsed.occupation, 48) || '学生',
    mbti: extractMbtiLetters(comprehensive.core.mbti),
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
  const { parsed, parseRecovered } = parseModelJsonObject(rawText)
  const character = assemblePersonaCharacter(parsed, params)
  const issues = auditPersonaAiGenerateResult(character, params.form, {
    parsed,
    parseRecovered,
    rawText,
  })
  return {
    character,
    issues,
    rawText,
    parsedSnapshot: parsed,
    parseRecovered,
  }
}

async function callPersonaAiJson(
  cfg: ApiConfig,
  system: string,
  user: string,
): Promise<string> {
  return openAiCompatibleChat(cfg, [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ], { max_tokens: 8192 })
}

export async function generatePersonaWithAi(params: {
  apiConfig: ApiConfig
  form: PersonaAiGenerateForm
  draft: Character
  playerIdentity?: PlayerIdentity | null
  playerDisplayName?: string
  worldBackgroundPrompt?: string
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
  })
  const user = buildPersonaAiGenerateUserPrompt({
    form: params.form,
    playerDisplayName: params.playerDisplayName,
    playerIdentity: params.playerIdentity,
    worldBackgroundPrompt: params.worldBackgroundPrompt,
  })

  const raw = await callPersonaAiJson(cfg, system, user)
  return buildPersonaAiFromModelText(raw, {
    form: params.form,
    draft: params.draft,
    playerDisplayName: params.playerDisplayName,
  })
}

function pickRepairIssues(issues: PersonaAiGenerateIssue[], mode: 'complete' | 'fix'): PersonaAiGenerateIssue[] {
  if (mode === 'fix') return issues
  const targeted = issues.filter(
    (i) =>
      i.kind === 'missing_epilogue' ||
      i.kind === 'missing_top_field' ||
      i.kind === 'placeholder_field' ||
      i.kind === 'parse',
  )
  return targeted.length > 0 ? targeted : issues
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
}): Promise<PersonaAiGenerateResult> {
  const cfg = params.apiConfig
  if (!cfg?.apiUrl?.trim() || !cfg?.apiKey?.trim() || !cfg?.modelId?.trim()) {
    throw new Error('未配置 AI API')
  }

  const issues = params.issueFilter
    ? params.base.issues.filter(params.issueFilter)
    : pickRepairIssues(params.base.issues, params.mode)

  const system = buildPersonaAiRepairSystemPrompt({
    orientationMutable: params.form.orientationMutable,
    nsfwEnabled: params.form.nsfwEnabled,
    relationToUser: params.form.relationToUser,
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

  const raw = await callPersonaAiJson(cfg, system, user)
  const { parsed: patch, parseRecovered } = parseModelJsonObject(raw)
  const merged = mergePersonaAiParsedSnapshot(params.base.parsedSnapshot, patch, {
    orientationMutable: params.form.orientationMutable,
  })
  const character = assemblePersonaCharacter(merged, {
    form: params.form,
    draft: params.draft,
    playerDisplayName: params.playerDisplayName,
  })
  syncEpilogueEntriesInParsedSnapshot(merged, character)
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
