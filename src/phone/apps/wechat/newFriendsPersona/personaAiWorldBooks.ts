import type { WorldBook, WorldBookItem, WorldBookPriority } from './types'
import { rewriteMeetWorldbookNamesToPlaceholders } from '../../lumiMeet/meetWorldbookPlaceholders'
import { sanitizeEpilogueExtensionNewContent } from './epilogueExtensionToneRules'

/** 微信 AI 人设：单本世界书 */
export const PERSONA_AI_COMPACT_BOOK_TITLE = '角色人设档案'
export const PERSONA_AI_COMPACT_BOOK_KEY = 'main'

/**
 * 单本世界书固定 8 条（顺序即 item01–item08）。
 * 前 7 条默认序言介入；「对你现在」为尾声延展（可随剧情更新）。
 * 取向「可变」时另增「取向认同的当前快照」为尾声延展（插在「性格内核」后）。
 * 填写过往感情史时另增「过往感情史」为序言介入（插在「亲密与恋爱观」后）。
 */
export const PERSONA_AI_COMPACT_ENTRY_NAMES = [
  '名片基础',
  '形象与气质',
  '性格内核',
  '能力与日常',
  '亲密与恋爱观',
  '人际与秘密',
  '周边NPC',
  '对你现在',
] as const

export type PersonaAiCompactEntryName = (typeof PERSONA_AI_COMPACT_ENTRY_NAMES)[number]

/** 尾声延展条目（对用户当下关系） */
export const PERSONA_AI_TOWARD_USER_ENTRY_NAME: PersonaAiCompactEntryName = '对你现在'

/** 围绕角色的具名 NPC 简要档案 */
export const PERSONA_AI_NPC_ROSTER_ENTRY_NAME: PersonaAiCompactEntryName = '周边NPC'

/** 用户填写感情史时单独抽出的序言条目（非与 {{user}} 当前关系） */
export const PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME = '过往感情史'

export type PersonaAiEpilogueEntry = { name: string; content: string }

/**
 * @deprecated 旧版 vol10 五条；新生成合并为「对你现在」。
 * 仍导出供旧档识别 / 尾声同步兼容。
 */
export const PERSONA_AI_EPILOGUE_ENTRY_NAMES = [
  '对 {{user}} 的当前态度',
  '对 {{user}} 的称呼与聊天分寸',
  '与 {{user}} 的相处边界',
  '对 {{user}} 内心的真实分量',
  '如何赢得 {{char}} 的好感',
] as const

/** 攻略向：现与「对你现在」同条 */
export const PERSONA_AI_AFFECTION_GUIDE_EPILOGUE_NAME = PERSONA_AI_TOWARD_USER_ENTRY_NAME

/**
 * 取向「可变」时单独抽出的尾声延展条目（不把整条「性格内核」改成尾声）。
 * 正文仍写当下稳定认同；「可变」仅指本条 priority=after、可随剧情更新快照。
 */
export const PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME = '取向认同的当前快照'

/** 取向正文所在条目名：固定→性格内核；可变→独立尾声快照 */
export function personaAiOrientationHostEntryName(orientationMutable?: boolean): string {
  return orientationMutable
    ? PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME
    : '性格内核'
}

/** @deprecated 请用 personaAiOrientationHostEntryName；默认指向可变时的独立尾声名 */
export const PERSONA_AI_ORIENTATION_WORLD_BOOK_ITEM_NAME = PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME

/** @deprecated */
export const PERSONA_AI_INTIMATE_SPEECH_ITEM_NAME = '亲密口语习惯'

/** @deprecated */
export const PERSONA_AI_NSFW_WORLD_BOOK_ITEM_NAME = '亲密尺度与偏好（成人向）'

export function isPersonaAiOrientationEpilogueName(raw: string): boolean {
  const name = String(raw ?? '').trim()
  if (!name) return false
  if (name === PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME) return true
  return /取向认同|取向.*当前快照|性取向由来|取向与自我认同/.test(name)
}

export function isPersonaAiRelationshipHistoryEntryName(raw: string): boolean {
  const name = String(raw ?? '').trim()
  if (!name) return false
  if (name === PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME) return true
  return /过往感情|感情史|恋爱史|情史/.test(name) && !/亲密与恋爱观/.test(name)
}

/** 尾声模板：恒有「对你现在」；取向可变时另含取向快照 */
export function getPersonaAiEpilogueEntryTemplates(orientationMutable?: boolean): readonly string[] {
  if (orientationMutable) {
    return [PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME, PERSONA_AI_TOWARD_USER_ENTRY_NAME]
  }
  return [PERSONA_AI_TOWARD_USER_ENTRY_NAME]
}

export function isPersonaAiPlatonicRelation(relationToUser: string): boolean {
  const rel = relationToUser.trim()
  if (!rel) return false
  return /同学|校友|同班|同事|同僚|朋友|好友|常聊|上司|下属|家人|亲戚|合租/.test(rel)
}

export function isPersonaAiRomanticRelation(relationToUser: string): boolean {
  const rel = relationToUser.trim()
  return /暧昧|恋人|交往|情侣|暗恋|稳定交往|前任/.test(rel)
}

function esc(s: string): string {
  return String(s ?? '').trim() || '（档案待补全）'
}

function mkItem(
  characterId: string,
  index: number,
  name: string,
  rawContent: string,
  nickname: string,
  realName: string,
  now: number,
  opts?: { priority?: WorldBookPriority; enabled?: boolean; userDisplayName?: string },
): WorldBookItem {
  const ids = {
    nickname,
    realName,
    userDisplayName: opts?.userDisplayName,
  }
  const body = rewriteMeetWorldbookNamesToPlaceholders(String(rawContent ?? ''), ids)
  const itemName = rewriteMeetWorldbookNamesToPlaceholders(String(name ?? ''), ids)
  const content = esc(body)
  const priority = opts?.priority ?? 'before'
  return {
    id: `persona-wb-${characterId}-${PERSONA_AI_COMPACT_BOOK_KEY}-item${String(index).padStart(2, '0')}`,
    name: itemName,
    enabled: opts?.enabled ?? true,
    priority,
    keywords: `AI人设 {{char}}`,
    content,
    updatedAt: now,
    collapsed: false,
    ...(priority === 'after' && content.trim() ? { contentInitial: content } : {}),
  }
}

function buildTowardUserDefault(relationToUser: string): string {
  const rel = relationToUser.trim() || '普通熟人'
  return `{{char}}与{{user}}的开局关系是「${rel}」。称呼、回消息节奏、相处边界与内心真实分量必须严格按该原文的投入程度来写：原文偏淡就写不咋在意/低投入，原文已是暧昧或恋爱再写对应亲近。禁止默认往好感、暗恋、嘴硬心软或「其实有点在意」抬；也禁止写成与原文矛盾的陌生人话术。可写维持该关系下的雷区。`
}

const SECTION_DEFAULTS: Record<PersonaAiCompactEntryName, (rel: string) => string> = {
  名片基础: () =>
    '{{char}}的基础名片侧写：姓名气质一句话、大致年龄层、职业身份、对外标签与雷点摘要。勿写对{{user}}的态度。',
  形象与气质: () =>
    '{{char}}的外貌：发色发型、身形体态、日常/通勤/正式或约会等场合穿搭偏好，以及气质气场与第一印象；具体可想象，勿堆砌空标签。',
  性格内核: () =>
    '{{char}}的对外面具与私下底色、三观与优缺点、身世成因与情绪模式、反差萌点；性取向若未单独开尾声条，可在此写当下稳定自我认同。勿写对{{user}}的专属态度。',
  能力与日常: () =>
    '{{char}}的技能爱好、社交态度、口语口头禅（含引语示例）、生活癖好与小习惯。通用日常，非对{{user}}专属。',
  亲密与恋爱观: () =>
    '{{char}}对亲密关系的一般观念与边界（指恋人写「对方」）；须覆盖恋爱前样子、恋爱后样子、吃醋样子、与恋人冲突时的样子；可含亲密偏好（清水档案禁止露骨）。',
  人际与秘密: () =>
    '{{char}}对不同关系（家人/友人/同事/对立面）的态度差异；自身秘密、软肋与反差萌。点到关系即可，具名人物细则见「周边NPC」。禁止写与{{user}}相关的秘密。',
  周边NPC: () =>
    '围绕{{char}}的具名配角简要档案（家人/友人/同事/对立面等）：每人写姓名、与{{char}}关系、一两句性格与近况，须贴合人脉偏向。禁止写成{{user}}；禁止整段照搬「人际与秘密」。',
  对你现在: (rel) => buildTowardUserDefault(rel),
}

/** 将模型/旧档条目标题归并为标准条目之一；旧 vol10 五条 →「对你现在」 */
export function canonicalizePersonaAiCompactEntryName(raw: string): PersonaAiCompactEntryName | null {
  const name = String(raw ?? '').trim()
  if (!name) return null
  // 独立附加条：勿并入八条模板
  if (isPersonaAiOrientationEpilogueName(name)) return null
  if (isPersonaAiRelationshipHistoryEntryName(name)) return null
  if ((PERSONA_AI_COMPACT_ENTRY_NAMES as readonly string[]).includes(name)) {
    return name as PersonaAiCompactEntryName
  }
  const compact = name.replace(/\s+/g, '')
  for (const t of PERSONA_AI_COMPACT_ENTRY_NAMES) {
    if (t.replace(/\s+/g, '') === compact) return t
  }
  if (/名片|基础资料|身份名片/.test(name)) return '名片基础'
  if (/形象|气质|外貌|体态/.test(name)) return '形象与气质'
  // 「取向」单独条目已在上方拦截；此处不再因含「取向」并入性格内核
  if (/性格|内核|伪装|底色|心理|身世/.test(name)) return '性格内核'
  if (/能力|日常|口语|习惯|爱好|技能/.test(name)) return '能力与日常'
  if (/亲密|恋爱|欲念|fetish|contrast|反差/.test(name) && !/反差萌/.test(name)) return '亲密与恋爱观'
  if (/周边NPC|NPC简|关联人物|身边的人|周边人物|配角档案|人物简档/.test(name)) return '周边NPC'
  if (/人际|家庭|友人|秘密|软肋|反差萌|圈子/.test(name)) return '人际与秘密'
  if (
    name === PERSONA_AI_TOWARD_USER_ENTRY_NAME ||
    /对你现在|当前态度|称呼|聊天分寸|相处边界|真实分量|如何赢得|攻略|加好感/.test(name)
  ) {
    return '对你现在'
  }
  return null
}

/** @deprecated 兼容旧名；新档请用 canonicalizePersonaAiCompactEntryName */
export function canonicalizePersonaAiEpilogueEntryName(
  raw: string,
  _orientationMutable?: boolean,
): string | null {
  const c = canonicalizePersonaAiCompactEntryName(raw)
  if (!c) return null
  if ((PERSONA_AI_EPILOGUE_ENTRY_NAMES as readonly string[]).includes(String(raw ?? '').trim())) {
    return PERSONA_AI_TOWARD_USER_ENTRY_NAME
  }
  return c
}

export function normalizePersonaAiCompactSections(
  entries: PersonaAiEpilogueEntry[] | null | undefined,
  opts?: { relationToUser?: string },
): PersonaAiEpilogueEntry[] {
  const relationToUser = String(opts?.relationToUser ?? '').trim()
  const byName = new Map<PersonaAiCompactEntryName, string>()
  for (const e of entries ?? []) {
    const content = sanitizeEpilogueExtensionNewContent(String(e?.content ?? '').trim())
    if (!content) continue
    const rawName = String(e?.name ?? '')
    if (isPersonaAiOrientationEpilogueName(rawName)) continue
    if (isPersonaAiRelationshipHistoryEntryName(rawName)) continue
    const canonical = canonicalizePersonaAiCompactEntryName(rawName)
    if (!canonical) continue
    const prev = byName.get(canonical)
    if (!prev || content.length > prev.length) byName.set(canonical, content)
  }
  return PERSONA_AI_COMPACT_ENTRY_NAMES.map((name) => ({
    name,
    content: byName.get(name) ?? SECTION_DEFAULTS[name](relationToUser),
  }))
}

/** 从条目列表取出取向尾声正文（最长者胜） */
export function pickPersonaAiOrientationEpilogueContent(
  entries: PersonaAiEpilogueEntry[] | null | undefined,
): string {
  let best = ''
  for (const e of entries ?? []) {
    const name = String(e?.name ?? '')
    if (!isPersonaAiOrientationEpilogueName(name)) continue
    const content = sanitizeEpilogueExtensionNewContent(String(e?.content ?? '').trim())
    if (content.length > best.length) best = content
  }
  return best
}

/** 从条目列表取出过往感情史正文（最长者胜） */
export function pickPersonaAiRelationshipHistoryContent(
  entries: PersonaAiEpilogueEntry[] | null | undefined,
): string {
  let best = ''
  for (const e of entries ?? []) {
    const name = String(e?.name ?? '')
    if (!isPersonaAiRelationshipHistoryEntryName(name)) continue
    const content = sanitizeEpilogueExtensionNewContent(String(e?.content ?? '').trim())
    if (content.length > best.length) best = content
  }
  return best
}

/**
 * 若模型仍把取向写进「性格内核」，尽量剥出独立段，避免与尾声条重复。
 * 匹配以「性取向 / 取向认同 / 自我认同」等起头的段落。
 */
export function peelOrientationParagraphFromCore(coreRaw: string): {
  core: string
  peeled: string
} {
  const core = String(coreRaw ?? '').trim()
  if (!core) return { core: '', peeled: '' }

  const parts = core.split(/\n{2,}/)
  const kept: string[] = []
  const peeledParts: string[] = []
  for (const p of parts) {
    const t = p.trim()
    if (!t) continue
    if (/^(?:性取向|取向认同|取向与自我|自我认同(?:与取向)?|对自我性取向)/.test(t) || /性取向[/／与]*自我认同/.test(t.slice(0, 40))) {
      peeledParts.push(t)
      continue
    }
    kept.push(t)
  }
  if (!peeledParts.length) return { core, peeled: '' }
  return {
    core: kept.join('\n\n').trim() || core,
    peeled: peeledParts.join('\n\n').trim(),
  }
}

function buildOrientationEpilogueDefault(orientationLabel?: string): string {
  const label = String(orientationLabel ?? '').trim()
  if (label) {
    return `{{char}}当前对自我性取向的认同可概括为「${label}」。正文只写当下稳定自我认同与由来，不因与{{user}}的互动写成取向动摇；本条为尾声延展快照，可随剧情更新表述，但不等于开局即写「取向不确定」。`
  }
  return `{{char}}对自我性取向有清晰、当下稳定的认同表述（含由来与边界感）。禁止因勾选「可变」或欣赏{{user}}外貌写成取向动摇；本条为尾声延展快照，可随剧情更新。`
}

function buildRelationshipHistoryDefault(hint?: string): string {
  const seed = String(hint ?? '').trim()
  if (seed) {
    return `围绕用户种子「${seed}」扩写{{char}}的过往感情史：分手/前任余波、模式与雷区、对亲密关系的习惯影响。只写过去与第三人，禁止写成与{{user}}的当前关系；也禁止把{{user}}写成前任。`
  }
  return `{{char}}的过往感情史侧写：重要前任或情感经历、分手余波与模式、对亲密关系的习惯影响。只写过去，禁止写成与{{user}}的当前关系。`
}

/**
 * 将 AI 人设写成**一本**世界书、固定条目。
 * 「对你现在」恒为尾声延展；取向「可变」时另增取向快照尾声；有感情史种子时另增「过往感情史」序言。
 */
export function buildPersonaAiWorldBooks(
  characterId: string,
  nickname: string,
  /** @deprecated 旧九维入参已忽略；请传 sections */
  _personaOrUnused: unknown,
  now: number,
  sectionsOrEpilogue: PersonaAiEpilogueEntry[] | null,
  userDisplayName?: string,
  opts?: {
    orientationMutable?: boolean
    relationToUser?: string
    /** 顶层「性取向」短标签，作取向尾声缺省正文参考 */
    orientationLabel?: string
    /** 用户填写了感情史种子时另增「过往感情史」条目 */
    includeRelationshipHistory?: boolean
    relationshipHistoryHint?: string
  },
): WorldBook[] {
  const orientationMutable = opts?.orientationMutable ?? false
  const includeHistory = opts?.includeRelationshipHistory === true
  const relationToUser = String(opts?.relationToUser ?? '').trim()
  const sections = normalizePersonaAiCompactSections(sectionsOrEpilogue, { relationToUser })
  const rn = nickname
  const itemOpts = userDisplayName?.trim() ? { userDisplayName: userDisplayName.trim() } : undefined

  let orientationExtra: string | null = null
  if (orientationMutable) {
    let orient = pickPersonaAiOrientationEpilogueContent(sectionsOrEpilogue) || ''
    const coreIdx = sections.findIndex((s) => s.name === '性格内核')
    if (coreIdx >= 0) {
      const peeled = peelOrientationParagraphFromCore(sections[coreIdx]!.content)
      if (peeled.peeled) {
        if (!orient || peeled.peeled.length > orient.length) orient = peeled.peeled
        sections[coreIdx] = { name: '性格内核', content: peeled.core }
      }
    }
    orientationExtra = orient.trim() || buildOrientationEpilogueDefault(opts?.orientationLabel)
  }

  let historyExtra: string | null = null
  if (includeHistory) {
    historyExtra =
      pickPersonaAiRelationshipHistoryContent(sectionsOrEpilogue).trim() ||
      buildRelationshipHistoryDefault(opts?.relationshipHistoryHint)
  }

  const items: WorldBookItem[] = []
  let itemIndex = 0
  for (const e of sections) {
    const name = e.name as PersonaAiCompactEntryName
    const isTowardUser = name === '对你现在'
    const priority: WorldBookPriority = isTowardUser ? 'after' : 'before'
    itemIndex += 1
    items.push(
      mkItem(characterId, itemIndex, name, e.content, nickname, rn, now, {
        ...itemOpts,
        priority,
      }),
    )
    // 插在「性格内核」后：独立取向尾声
    if (orientationMutable && name === '性格内核' && orientationExtra) {
      itemIndex += 1
      items.push(
        mkItem(
          characterId,
          itemIndex,
          PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME,
          orientationExtra,
          nickname,
          rn,
          now,
          { ...itemOpts, priority: 'after' },
        ),
      )
    }
    // 插在「亲密与恋爱观」后：过往感情史（序言）
    if (includeHistory && name === '亲密与恋爱观' && historyExtra) {
      itemIndex += 1
      items.push(
        mkItem(
          characterId,
          itemIndex,
          PERSONA_AI_RELATIONSHIP_HISTORY_ENTRY_NAME,
          historyExtra,
          nickname,
          rn,
          now,
          { ...itemOpts, priority: 'before' },
        ),
      )
    }
  }

  return [
    {
      id: `persona-wb-${characterId}-${PERSONA_AI_COMPACT_BOOK_KEY}`,
      name: PERSONA_AI_COMPACT_BOOK_TITLE,
      enabled: true,
      collapsed: false,
      items,
    },
  ]
}

/** 从模型输出解析世界书各段正文 */
export function parsePersonaAiCompactSectionsFromParsed(
  parsed: Record<string, unknown>,
): PersonaAiEpilogueEntry[] {
  const out: PersonaAiEpilogueEntry[] = []

  const arr = parsed.worldBookEntries
  if (Array.isArray(arr)) {
    for (const x of arr) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!name || !content) continue
      out.push({ name, content })
    }
  }

  const obj = parsed.worldBookSections
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const content = String(v ?? '').trim()
      if (!content) continue
      out.push({ name: k, content })
    }
  }

  // 兼容旧 epilogueEntries：并入「对你现在」
  const epi = parsed.epilogueEntries
  if (Array.isArray(epi) && epi.length) {
    const chunks: string[] = []
    for (const x of epi) {
      if (!x || typeof x !== 'object') continue
      const o = x as Record<string, unknown>
      const name = String(o.name ?? '').trim()
      const content = String(o.content ?? '').trim()
      if (!content) continue
      chunks.push(name ? `【${name}】${content}` : content)
    }
    if (chunks.length) out.push({ name: PERSONA_AI_TOWARD_USER_ENTRY_NAME, content: chunks.join('\n') })
  }

  return out
}
