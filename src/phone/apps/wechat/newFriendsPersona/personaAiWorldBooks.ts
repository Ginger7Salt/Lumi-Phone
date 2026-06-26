import type { WorldBook, WorldBookItem, WorldBookPriority } from './types'
import type { ComprehensivePersona } from '../../lumiMeet/comprehensivePersona'
import { rewriteMeetWorldbookNamesToPlaceholders } from '../../lumiMeet/meetWorldbookPlaceholders'

/** 微信 AI 人设生成专用分册名（仅 vol01–vol10；不含遇见 vol11/vol12） */
const PERSONA_AI_WORLD_BOOK_VOLUME_TITLES: readonly { volKey: string; bookTitle: string }[] = [
  { volKey: 'vol01', bookTitle: '01 BASE | 基础核心设定' },
  { volKey: 'vol02', bookTitle: '02 CORE | 人格内核' },
  { volKey: 'vol03', bookTitle: '03 PSYCHE | 心理与情感' },
  { volKey: 'vol04', bookTitle: '04 ABILITIES | 能力与偏好' },
  { volKey: 'vol05', bookTitle: '05 DESIRE | 欲念与底线' },
  { volKey: 'vol06', bookTitle: '06 SOCIAL | 人际法则' },
  { volKey: 'vol07', bookTitle: '07 CONTRAST | 恋爱镜像反差' },
  { volKey: 'vol08', bookTitle: '08 DETAILS | 日常侧写' },
  { volKey: 'vol09', bookTitle: '09 · 藏着的事（秘密、软肋、反差萌）' },
  { volKey: 'vol10', bookTitle: '10 · 对你现在（态度、称呼、边界、心思）' },
]

export type PersonaAiEpilogueEntry = { name: string; content: string }

/** vol10 尾声延展固定条目标题（顺序即写入 item01–item05） */
export const PERSONA_AI_EPILOGUE_ENTRY_NAMES = [
  '对 {{user}} 的当前态度',
  '对 {{user}} 的称呼与聊天分寸',
  '与 {{user}} 的相处边界',
  '对 {{user}} 内心的真实分量',
  '如何赢得 {{char}} 的好感',
] as const

/** vol10 攻略 / 加好感行为侧写条目 */
export const PERSONA_AI_AFFECTION_GUIDE_EPILOGUE_NAME = PERSONA_AI_EPILOGUE_ENTRY_NAMES[4]

/** @deprecated 旧版在 vol10 单独追加的取向快照条目标题；现改为 vol03「取向与自我认同」尾声延展 */
export const PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME = '取向认同的当前快照'

/** vol03 取向条目名（UI「可变」= priority=after 尾声延展，非正文写取向动摇） */
export const PERSONA_AI_ORIENTATION_WORLD_BOOK_ITEM_NAME = '取向与自我认同'

/** vol05 亲密场景口语习惯条目 */
export const PERSONA_AI_INTIMATE_SPEECH_ITEM_NAME = '亲密口语习惯'

/** @deprecated 已移除；勿再写入世界书 */
export const PERSONA_AI_NSFW_WORLD_BOOK_ITEM_NAME = '亲密尺度与偏好（成人向）'

/** vol10 尾声条目标题（恒为 5 条；取向可变时改 vol03 条目优先级，不在此追加） */
export function getPersonaAiEpilogueEntryTemplates(_orientationMutable?: boolean): readonly string[] {
  return PERSONA_AI_EPILOGUE_ENTRY_NAMES
}

function isLegacyOrientationSnapshotEntryName(raw: string): boolean {
  const name = String(raw ?? '').trim()
  if (!name) return false
  if (name === PERSONA_AI_ORIENTATION_MUTABLE_EPILOGUE_NAME) return true
  return /取向/.test(name) && /快照|认同|可变|当前/.test(name) && !name.includes('{{user}}')
}

function resolveOrientationOriginContent(
  orientationOrigin: string,
  epilogueEntries: PersonaAiEpilogueEntry[] | null | undefined,
  orientationMutable: boolean,
): string {
  const base = String(orientationOrigin ?? '').trim()
  if (!orientationMutable) return base
  for (const e of epilogueEntries ?? []) {
    if (!isLegacyOrientationSnapshotEntryName(String(e?.name ?? ''))) continue
    const snap = String(e?.content ?? '').trim()
    if (!snap) continue
    if (!base || snap.length > base.length) return snap
  }
  return base
}

const PERSONA_AI_EPILOGUE_DEFAULT_CONTENT: Record<string, string> = {
  '对 {{user}} 的当前态度': '{{char}}与{{user}}的关系尚在建立中：交流以礼貌与试探为主，亲近度未定型。',
  '对 {{user}} 的称呼与聊天分寸':
    '{{char}}对{{user}}仍用较正式的称呼或直接叫「你」；回消息不算快，以文字为主，emoji 用得克制；很少主动找话题，多半等{{user}}先开口。',
  '与 {{user}} 的相处边界':
    '{{char}}可以聊日常与轻话题，但私事与感情经历尚未到能深问的程度；越界调侃或打探隐私会让{{char}}明显冷下来。',
  '对 {{user}} 内心的真实分量':
    '{{char}}对{{user}}尚处于观察期：表面礼貌，心里还没把{{user}}放进「自己人」圈；若{{user}}持续真诚，态度会慢慢松动。',
  '如何赢得 {{char}} 的好感':
    '{{user}}对{{char}}示以稳定、真诚与边界感：记住{{char}}说过的小事、在{{char}}忙时不连环追问、困难时先听再给建议，都会加分；查岗、道德绑架、越界玩笑是雷区。好感宜慢慢累积——持续加分后，{{char}}有可能从欣赏变成心动甚至喜欢 {{user}}，不因一开始只是普通关系就写死没可能。',
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

function isRomanticRelationHint(relationToUser: string): boolean {
  return isPersonaAiRomanticRelation(relationToUser)
}

/** 模型未返回或标题不匹配时的关系向兜底（避免同学关系却写成「陌生人试探」） */
function buildPersonaAiEpilogueDefault(templateName: string, relationToUser: string): string {
  const rel = relationToUser.trim()
  if (/同学|校友|同班/.test(rel)) {
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[0]) {
      return '{{char}}与{{user}}是同班同学：日常抬头不见低头见，聊天以课业、班级琐事和互相吐槽为主，态度自然，不刻意客套也不越界。'
    }
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[1]) {
      return '{{char}}对{{user}}多半直呼其名或叫「你」；回消息看情况，课间/课后聊得多一些，emoji 看熟悉程度；会就作业、考试、班级八卦主动开话。'
    }
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[2]) {
      return '{{char}}与{{user}}可聊学习、爱好与日常，但感情私事、家庭矛盾等需等更熟再碰；开过分黄色/恋爱越界玩笑会让{{char}}尴尬或冷场。'
    }
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[3]) {
      return '{{char}}把{{user}}当班里常打交道的同学：不算特别亲近，但比纯路人熟；若觉得{{user}}长得好看也只是审美层面的服气，**没有**恋爱或性方面的念头。'
    }
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[4]) {
      return '{{user}}想拉好感：课业互助靠谱、记得{{char}}吐槽过的细节、下课能接话不冷场，都会加分；当众拆台、借作业不还、强行暧昧或黄色玩笑是雷区。节奏宜慢，但持续真诚加分后，{{char}}有可能从同窗变成对 {{user}} 心动甚至喜欢。'
    }
  }
  if (/同事|同僚/.test(rel)) {
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[0]) {
      return '{{char}}与{{user}}是同事：交流以工作对接、项目吐槽和午休闲聊为主，私下程度取决于实际交情。'
    }
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[4]) {
      return '{{user}}想加好感：工作上靠谱、记得{{char}}提过的偏好、午休能自然接话，都会加分；甩锅、打小报告、传八卦是雷区。宜先私下慢慢熟，持续加分后 {{char}} 有可能对 {{user}} 产生超出同事的心动。'
    }
  }
  if (/朋友|好友|常聊/.test(rel) && !isRomanticRelationHint(rel)) {
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[0]) {
      return '{{char}}与{{user}}是朋友：聊天随意，能互损也能正经聊心事，亲近度高于普通同学/同事。'
    }
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[4]) {
      return '{{user}}想更亲近：记得{{char}}说过的小事、困难时先听再给建议、约局守时不放鸽子，都会加分；道德绑架、借友谊要挟、当众揭短，是雷区。信任与好感累积后，{{char}} 有可能从朋友慢慢喜欢上 {{user}}。'
    }
  }
  if (isRomanticRelationHint(rel)) {
    if (templateName === PERSONA_AI_EPILOGUE_ENTRY_NAMES[4]) {
      return '{{user}}想推进关系：稳定出现、记得{{char}}的喜好与雷点、给{{char}}留体面与空间，都会加分；忽冷忽热、 jealousy 式查岗、用 guilt trip 逼表态，是雷区。顺着 {{char}} 的节奏持续加分，喜欢与信任会加深。'
    }
  }
  return PERSONA_AI_EPILOGUE_DEFAULT_CONTENT[templateName] ?? '（档案待补全）'
}

function isDefaultEpilogueContent(templateName: string, content: string): boolean {
  const c = content.trim()
  if (!c) return true
  const generic = PERSONA_AI_EPILOGUE_DEFAULT_CONTENT[templateName]?.trim()
  return generic != null && c === generic
}

/** 将模型返回的条目标题归并到 vol10 固定模板，避免因标题不完全一致产生重复条目 */
export function canonicalizePersonaAiEpilogueEntryName(
  raw: string,
  _orientationMutable?: boolean,
): string | null {
  const name = String(raw ?? '').trim()
  if (!name) return null
  if (isLegacyOrientationSnapshotEntryName(name)) return null
  const templates = getPersonaAiEpilogueEntryTemplates()
  if ((templates as readonly string[]).includes(name)) return name
  const compact = name.replace(/\s+/g, '')
  for (const t of templates) {
    if (t.replace(/\s+/g, '') === compact) return t
  }
  if (/当前态度/.test(name) || (name.includes('态度') && !name.includes('称呼') && !name.includes('聊天'))) {
    return PERSONA_AI_EPILOGUE_ENTRY_NAMES[0]
  }
  if (/称呼|聊天分寸/.test(name)) return PERSONA_AI_EPILOGUE_ENTRY_NAMES[1]
  if (/相处边界|相处.*边界/.test(name)) return PERSONA_AI_EPILOGUE_ENTRY_NAMES[2]
  if (/内心|真实分量|心里的分量/.test(name)) return PERSONA_AI_EPILOGUE_ENTRY_NAMES[3]
  if (/如何赢得|攻略|加好感|获取.*好感|赢得.*好感/.test(name)) return PERSONA_AI_EPILOGUE_ENTRY_NAMES[4]
  return null
}

function esc(s: string): string {
  return String(s ?? '').trim() || '（档案待补全）'
}

function mkItem(
  characterId: string,
  volKey: string,
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
  return {
    id: `persona-wb-${characterId}-${volKey}-item${String(index).padStart(2, '0')}`,
    name: itemName,
    enabled: opts?.enabled ?? true,
    priority: opts?.priority ?? 'before',
    keywords: `AI人设 {{char}}`,
    content: esc(body),
    updatedAt: now,
    collapsed: false,
  }
}

function mkBook(characterId: string, volKey: string, volLabel: string, items: WorldBookItem[]): WorldBook {
  return {
    id: `persona-wb-${characterId}-${volKey}`,
    name: volLabel,
    enabled: true,
    collapsed: false,
    items,
  }
}

function normalizePersonaAiEpilogueEntries(
  entries: PersonaAiEpilogueEntry[] | null | undefined,
  opts?: { orientationMutable?: boolean; relationToUser?: string },
): PersonaAiEpilogueEntry[] {
  const orientationMutable = opts?.orientationMutable ?? false
  const relationToUser = String(opts?.relationToUser ?? '').trim()
  const templates = getPersonaAiEpilogueEntryTemplates(orientationMutable)
  const byName = new Map<string, string>()
  for (const e of entries ?? []) {
    const content = String(e?.content ?? '').trim()
    if (!content) continue
    const rawName = String(e?.name ?? '')
    if (isLegacyOrientationSnapshotEntryName(rawName)) continue
    const canonical = canonicalizePersonaAiEpilogueEntryName(rawName, orientationMutable)
    if (!canonical) continue
    const prev = byName.get(canonical)
    const prevIsDefault = prev != null && isDefaultEpilogueContent(canonical, prev)
    const nextIsDefault = isDefaultEpilogueContent(canonical, content)
    if (!prev || (prevIsDefault && !nextIsDefault) || (!prevIsDefault && !nextIsDefault && content.length > prev.length)) {
      byName.set(canonical, content)
    }
  }
  const ordered: PersonaAiEpilogueEntry[] = []
  for (const templateName of templates) {
    ordered.push({
      name: templateName,
      content:
        byName.get(templateName) ??
        buildPersonaAiEpilogueDefault(templateName, relationToUser) ??
        '（档案待补全）',
    })
  }
  const extras = (entries ?? []).filter((e) => {
    const name = String(e?.name ?? '').trim()
    const content = String(e?.content ?? '').trim()
    if (!name || !content) return false
    const canonical = canonicalizePersonaAiEpilogueEntryName(name, orientationMutable)
    return canonical == null
  })
  return [...ordered, ...extras.map((e) => ({ name: String(e.name).trim(), content: String(e.content).trim() }))]
}

/** 将 AI 九维人设拆成 10 个世界书分册（vol01–09 序言介入；vol10 尾声延展）。不含遇见专用 vol11/vol12。 */
export function buildPersonaAiWorldBooks(
  characterId: string,
  nickname: string,
  persona: ComprehensivePersona,
  now: number,
  epilogueEntries: PersonaAiEpilogueEntry[] | null,
  userDisplayName?: string,
  opts?: { orientationMutable?: boolean; relationToUser?: string },
): WorldBook[] {
  const p = persona
  const b = p.base
  const rn = String(b.realName ?? '').trim()
  const itemOpts = userDisplayName?.trim() ? { userDisplayName: userDisplayName.trim() } : undefined
  const mk = (
    volKey: string,
    index: number,
    itemName: string,
    content: string,
    extra?: { priority?: WorldBookPriority },
  ) =>
    mkItem(characterId, volKey, index, itemName, content, nickname, rn, now, {
      ...itemOpts,
      ...extra,
    })

  const vol01: WorldBookItem[] = [
    mk('vol01', 1, '外在形象', b.info),
    mk('vol01', 2, '气质与体态', b.physiology),
  ]

  const c = p.core
  const vol02: WorldBookItem[] = [
    mk('vol02', 1, '对外伪装', c.surface),
    mk('vol02', 2, '真实底色', c.trueSelf),
    mk('vol02', 3, '三观与执念', c.values),
    mk('vol02', 4, '优缺点与雷点', c.flaws),
  ]

  const ps = p.psyche
  const orientationMutable = opts?.orientationMutable ?? false
  const orientationContent = resolveOrientationOriginContent(
    ps.orientationOrigin,
    epilogueEntries,
    orientationMutable,
  )
  const vol03: WorldBookItem[] = [
    mk('vol03', 1, '身世与性格成因', ps.background),
    mk('vol03', 2, '阴影与心结', ps.shadow),
    mk('vol03', 3, '情绪模式', ps.emotionalPattern),
    mk(
      'vol03',
      4,
      PERSONA_AI_ORIENTATION_WORLD_BOOK_ITEM_NAME,
      orientationContent,
      orientationMutable ? { priority: 'after' } : undefined,
    ),
  ]

  const ab = p.abilities
  const vol04: WorldBookItem[] = [
    mk('vol04', 1, '职业与技能', ab.skills),
    mk('vol04', 2, '爱好', ab.hobbies),
    mk('vol04', 3, '多面社交态度', ab.socialMode),
  ]

  const f = p.fetish
  const vol05: WorldBookItem[] = [
    mk('vol05', 1, '亲密偏好', f.preference),
    mk('vol05', 2, '感官与节奏', f.sensory),
    mk('vol05', 3, '相处动态', f.dynamic),
    mk('vol05', 4, '吃醋与边界', f.jealousy),
    mk('vol05', 5, PERSONA_AI_INTIMATE_SPEECH_ITEM_NAME, f.intimateSpeech),
  ]

  const r = p.relations
  const vol06: WorldBookItem[] = [
    mk('vol06', 1, '对家庭', r.family),
    mk('vol06', 2, '对友人', r.friends),
    mk('vol06', 3, '对立面', r.enemies),
  ]

  const ct = p.contrast
  const vol07: WorldBookItem[] = [
    mk('vol07', 1, '恋爱前', ct.beforeLove),
    mk('vol07', 2, '恋爱后', ct.afterLove),
    mk('vol07', 3, '冲突与和好', ct.conflict),
  ]

  const d = p.daily
  const vol08: WorldBookItem[] = [
    mk('vol08', 1, '口语与口头禅', d.speech),
    mk('vol08', 2, '日常习惯', d.habits),
    mk('vol08', 3, '消费观', d.money),
    mk('vol08', 4, '下意识与小怪癖', d.quirks),
  ]

  const a = p.arc
  const vol09: WorldBookItem[] = [
    mk('vol09', 1, '伪装与秘密', a.secrets),
    mk('vol09', 2, '动机、恐惧与软肋', a.goal),
    mk('vol09', 3, '反差萌', a.contrastMoe),
  ]

  const vol10: WorldBookItem[] = normalizePersonaAiEpilogueEntries(epilogueEntries, {
    orientationMutable: opts?.orientationMutable,
    relationToUser: opts?.relationToUser,
  }).map((e, i) => mk('vol10', i + 1, e.name, e.content, { priority: 'after' }))

  const byVol: Record<string, WorldBookItem[]> = {
    vol01,
    vol02,
    vol03,
    vol04,
    vol05,
    vol06,
    vol07,
    vol08,
    vol09,
    vol10,
  }

  return PERSONA_AI_WORLD_BOOK_VOLUME_TITLES.map((meta) =>
    mkBook(characterId, meta.volKey, meta.bookTitle, byVol[meta.volKey] ?? []),
  )
}
