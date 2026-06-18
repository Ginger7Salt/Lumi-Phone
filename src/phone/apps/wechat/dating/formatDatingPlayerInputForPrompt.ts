/** 与 {@link parsePlotRichText} / 约会页输入提示一致的纯文本切分（无 React 依赖）。 */

export type DatingPlayerInputKind = 'narration' | 'dialogue' | 'innerThought'

export type DatingPlayerInputSegment = {
  kind: DatingPlayerInputKind
  text: string
}

const QL = '\u201C'
const QR = '\u201D'
const Q_OPEN_ALT = '\u201F'

function normalizeRichTextSource(s: string): string {
  return String(s || '')
    .replace(/\uFEFF/g, '')
    .replace(/\uFF0A/g, '*')
}

function indexOfClosingCurve(t: string, from: number): number {
  const jR = t.indexOf(QR, from)
  if (jR !== -1) return jR
  return t.indexOf('\uFF02', from)
}

type Match = { end: number; kind: DatingPlayerInputKind; inner: string }

function nextRichMatch(t: string, i: number): Match | null {
  if (t.slice(i).startsWith('**')) {
    const end = t.indexOf('**', i + 2)
    if (end === -1) return null
    return { end: end + 2, kind: 'innerThought', inner: t.slice(i + 2, end) }
  }
  if (t[i] === '*' && t[i + 1] !== '*') {
    const end = t.indexOf('*', i + 1)
    if (end === -1) return null
    const inner = t.slice(i + 1, end)
    if (!inner.trim()) return null
    return { end: end + 1, kind: 'innerThought', inner }
  }
  if (t[i] === '「') {
    const end = t.indexOf('」', i + 1)
    if (end === -1) return null
    return { end: end + 1, kind: 'dialogue', inner: t.slice(i + 1, end) }
  }
  if (t[i] === QL || t[i] === Q_OPEN_ALT) {
    const end = indexOfClosingCurve(t, i + 1)
    if (end === -1) return null
    return { end: end + 1, kind: 'dialogue', inner: t.slice(i + 1, end) }
  }
  if (t[i] === '"') {
    const end = t.indexOf('"', i + 1)
    if (end === -1 || end === i + 1) return null
    return { end: end + 1, kind: 'dialogue', inner: t.slice(i + 1, end) }
  }
  return null
}

/** 按引号 / ** 切分玩家输入；其余为旁白（含动作描写，非口播）。 */
export function parseDatingPlayerInput(raw: string): DatingPlayerInputSegment[] {
  const t = normalizeRichTextSource(raw).trim()
  if (!t) return []

  const out: DatingPlayerInputSegment[] = []
  let plainStart = 0
  let i = 0

  const pushPlain = (from: number, to: number) => {
    if (from >= to) return
    const chunk = t.slice(from, to).trim()
    if (chunk) out.push({ kind: 'narration', text: chunk })
  }

  while (i < t.length) {
    const m = nextRichMatch(t, i)
    if (m) {
      pushPlain(plainStart, i)
      const inner = m.inner.trim()
      if (inner) out.push({ kind: m.kind, text: inner })
      i = m.end
      plainStart = i
      continue
    }
    i += 1
  }
  pushPlain(plainStart, t.length)
  return out
}

/**
 * 给模型看的「玩家输入语义拆解」：明确哪些是对白（NPC 可听见）、旁白动作、内心（NPC 默认不知）。
 */
export function buildDatingPlayerInputSemanticsBlock(
  raw: string,
  peerName: string,
  opts?: { directorMode?: boolean; godPerspective?: boolean },
): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const directorMode = opts?.directorMode === true
  const godPerspective = opts?.godPerspective === true
  const segments = parseDatingPlayerInput(trimmed)
  const dialogue = segments.filter((s) => s.kind === 'dialogue').map((s) => s.text)
  const inner = segments.filter((s) => s.kind === 'innerThought').map((s) => s.text)
  const narration = segments.filter((s) => s.kind === 'narration').map((s) => s.text)

  const peer = peerName.trim() || '约会对象'
  const lines: string[] = godPerspective
    ? [
        '【上帝视角·屏外剧情引导·语义拆解（玩家**不在场**；下列仅作剧情方向，**禁止**把玩家写成在场或同屏互动）】',
      ]
    : directorMode
      ? [
          '【导演指令·语义拆解（输入**尚未发生**，须从当前场面起笔当场演出；禁止当作既成事实直接续写结果态）】',
        ]
      : [
          '【玩家输入·语义拆解（与界面「弯引号/英文引号=对白、**=内心、其余=旁白」一致；须严格区分可听见与不可知）】',
        ]

  if (godPerspective) {
    if (dialogue.length) {
      lines.push(`- **引号对白**（玩家不在场；**禁止**写成 ${peer} 当面听见玩家说出口；若须呼应，只可写 ${peer} 看手机/回想/他人转述等屏外侧面）：`)
      for (const d of dialogue) lines.push(`  · ${d}`)
    }
    if (narration.length) {
      lines.push(
        `- **意图/旁白线索**（**禁止**演成玩家当场动作或与 ${peer} 同框；须转写为 ${peer}/NPC 在玩家看不见处的独处或他人场景）：`,
      )
      for (const n of narration) lines.push(`  · ${n}`)
    }
    if (inner.length) {
      lines.push(`- **内心线索**（玩家不在场；${peer} 默认不知，仅可作 ${peer} 无从得知的留白或误猜，禁止当面点破）：`)
      for (const x of inner) lines.push(`  · ${x}`)
    }
    if (!dialogue.length && !narration.length && !inner.length) {
      lines.push(`- 本轮输入按屏外剧情方向处理；**禁止**把玩家写成在场。`)
    }
    lines.push(
      `- **上帝承接铁律**：只写屏外第三者镜头；**禁止**玩家出场、同场、引号对白、肢体接触；指令中的冲突须转写为 ${peer}/NPC 独处或与他人互动时的心理/行动。`,
    )
    return lines.join('\n')
  }

  if (dialogue.length) {
    lines.push(`- **NPC 可听见的对白**（引号内；${peer} 可当作玩家当场说出口的话）：`)
    for (const d of dialogue) lines.push(`  · ${d}`)
  }
  if (narration.length) {
    lines.push(
      `- **旁白 / 可观察动作**（引号外叙述；表示场面推进或玩家意图中的动作/神态，**不是**口播台词；禁止写成 ${peer}「听见了」旁白整句文字，只能写其**看见/感到**的后果）：`,
    )
    for (const n of narration) lines.push(`  · ${n}`)
  }
  if (inner.length) {
    lines.push(`- **玩家内心 / OS**（** 包裹；${peer} 默认不知，禁止无因复述、反驳或点破其中信息）：`)
    for (const x of inner) lines.push(`  · ${x}`)
  }
  if (!dialogue.length && !narration.length && !inner.length) {
    lines.push(`- 本轮输入未识别到引号对白或 ** 内心，整段按旁白/意图处理，**禁止**当作玩家已说出口的台词。`)
  }

  lines.push(
    directorMode
      ? '- **导演承接铁律**：指令中的动作/对白/情绪须**逐步演到眼前**，禁止「他已经……」「话一出口就……」等跳过过程的既成事写法；指令末尾的结果（如「他很震惊」）须通过过程写出让读者感到震惊，而非默认 shock 已发生。'
      : '- **承接铁律**：对白→可回响/反驳；旁白动作→写可见反应；内心→不得当作对方已知晓；旁白里的说明性句子（如设定解释）若未用引号，**禁止**让 NPC 当作听见的话来回应。',
  )
  return lines.join('\n')
}
