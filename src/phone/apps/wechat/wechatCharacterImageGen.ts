import type { WeChatImageMime } from './newFriendsPersona/types'

/** 角色侧：单行 `[图片]英文或中文描述`，客户端调用生图 API 后作为图片消息发出 */
export function parseCharacterImageGenLine(line: string): { prompt: string } | null {
  const t = String(line ?? '')
    .trim()
    .replace(/^\uFEFF+/, '')
    .replace(/^[\u200B-\u200D\uFEFF]+/, '')
    .trim()
  const m = /^\[图片\]\s*(.+)$/.exec(t)
  if (!m) return null
  const prompt = m[1]!.trim()
  if (!prompt) return null
  return { prompt }
}

function parseDataUrlParts(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(dataUrl.trim())
  if (!m) return null
  return { mime: m[1]!.trim(), base64: m[2]!.trim() }
}

function normalizeWeChatImageMime(mime: string): WeChatImageMime | null {
  const lower = mime.toLowerCase()
  if (lower === 'image/jpeg' || lower === 'image/jpg') return 'image/jpeg'
  if (lower === 'image/png') return 'image/png'
  if (lower === 'image/gif') return 'image/gif'
  if (lower === 'image/webp') return 'image/webp'
  return null
}

export function imageGenDataUrlToPayload(dataUrl: string): { base64: string; mime: WeChatImageMime } {
  const parsed = parseDataUrlParts(dataUrl)
  if (!parsed?.base64) throw new Error('invalid_image_data_url')
  const mime = normalizeWeChatImageMime(parsed.mime) ?? 'image/png'
  if (parsed.base64.length < 64) throw new Error('image_payload_too_small')
  return { base64: parsed.base64, mime }
}

/** 概率未命中时从模型输出中移除 `[图片]` 行 */
export function stripCharacterImageGenLinesFromBubbles(bubbles: string[]): string[] {
  return bubbles
    .map((b) =>
      String(b ?? '')
        .split('\n')
        .filter((line) => !parseCharacterImageGenLine(line.trim()))
        .join('\n')
        .trim(),
    )
    .filter(Boolean)
}

/** 保留前 maxCount 条 `[图片]` 行，其余移除 */
export function limitCharacterImageGenLinesFromBubbles(bubbles: string[], maxCount: number): string[] {
  const cap = Math.max(0, Math.round(maxCount))
  if (cap <= 0) return stripCharacterImageGenLinesFromBubbles(bubbles)
  let used = 0
  return bubbles
    .map((b) => {
      const kept: string[] = []
      for (const line of String(b ?? '').split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (parseCharacterImageGenLine(trimmed)) {
          if (used >= cap) continue
          used += 1
        }
        kept.push(line)
      }
      return kept.join('\n').trim()
    })
    .filter(Boolean)
}

export function buildCharacterImageGenPromptBlock(styleHint?: string): string {
  const styleName = styleHint?.trim() || '用户已配置'
  return `---------------------
【角色发送 AI 配图（已启用）】
---------------------
你**可以**在合适语境下单独发一条**图片消息**（例如分享随手拍、晒物、发梗图式实拍），让对话更生动；但图片**不能替代**该说的道歉、解释、边界与严肃信息。

■ 输出格式（硬性）
- 单独占一行，且该行**只能**是：\`[图片]英文或中文画面描述\`
- **只写画面内容**：主体、场景、光线、关键物件与氛围；**不要**混写其它文字、引号说明或 Markdown。
- **禁止写风格词**：画风/媒介/渲染方式（如 anime、油画、写实、3D、胶片、水彩、赛博朋ck、illustration style 等）由客户端按「${styleName}」**自动拼接**，你方 \`[图片]\` 行里**不要**出现任何风格/画质修饰词。

■ 视角（硬性）
- **非自拍（默认）**：角色分享的是**自己手机第一视角**随手拍——镜头高度随角色**站/坐**姿势；**俯仰角必须与主体位置一致**。**不是**每张都要露出脚、裤腿或手：
  - **平视风景/街景/窗外/海面** → 眼平高度，**以环境为主，可不出现任何肢体**；禁止无人机/监控/第三人称。
  - **仰视**（天空、树梢、高楼、招牌）→ 向上举机，**通常无脚或裤腿**。
  - **俯视/地面级**（脚下猫狗、地面物件、台阶）→ 向下拍；**此时**可在画面下缘写鞋尖、裤腿、裙角等。
  - **桌台/手边**（咖啡、键盘、饭菜）→ 略俯视；袖口或手指**可**入镜。
  - **比耶/手势** → 第一视角下**自己的手或手指**从画面边缘入镜，背景仍是所拍场景；不是第三人称拍全身。
  - 只写「此刻举机所见」，不要写「一张某某的照片」这类元描述。
- **自拍（少数）**：仅当语境明确是晒脸/对镜/前置自拍；须写**五官与外貌**，但构图是**前置摄像头高度、一臂距离**，**上半身与脸同框**，**避免大头照/脸占满屏**；不要第三人称别人给拍的人像。
- 示例（非自拍·俯视+脚）：\`[图片]俯视，脚边一只橘猫蹲在地砖上，画面下方露出我的白色球鞋和牛仔裤裤脚\`
- 示例（非自拍·平视·无肢体）：\`[图片]平视，雨后街道，霓虹倒映在湿漉漉的路面，远处便利店暖黄招牌\`
- 示例（非自拍·仰视·无肢体）：\`[图片]仰视，傍晚渐变天空与楼群轮廓，无人物肢体入镜\`
- 示例（非自拍·比耶）：\`[图片]比耶，手从画面右下角入镜，背景是夕阳下的海平线\`
- 示例（非自拍·桌台）：\`[图片]略俯视，手边半杯咖啡，窗外灰蒙蒙的天光，袖口露在画面边缘\`
- 示例（自拍）：\`[图片]前置自拍，一臂距离，上半身入镜，穿米色卫衣对着镜头浅笑，背后是卧室暖灯，不要大头贴\`

■ 频率与场景
- 允许一轮 **0 条**；不要每轮都发，也不要用图片刷屏替代正文。
- 仅在轻松、日常、分享类语境使用；争吵、冷战、正式通知、对方明显需要被认真对待时**优先用文字**。
- 若当前不适合发图，请**只输出文字行**，不要输出 \`[图片]\` 行。

■ 与表情包区分
- \`[表情包]引用名\` 仅用于**表情包库**资源；**实拍/场景/物品**类请用 \`[图片]描述\`，不要用表情包行冒充。

■ 禁止假发图（硬性）
- 凡口头写「发过去了」「拍好了」「传给你了」「给你发了」等，**同一轮回复中必须**有对应 \`[图片]\` 行；否则客户端**不会**出图。
- **没有** \`[图片]\` 行时，禁止写已发送/已拍好类措辞；应继续文字说明，或直接输出 \`[图片]\` 行。`
}

const CHARACTER_FAKE_SENT_IMAGE_RE =
  /(?:发过去了|发给你了|发给你啦|拍好了|传过去了|图发你了|照片发你了|给你发了|已发送|发你(?:了|啦)?)/u

/** 模型口头声称已发图，但输出中无 `[图片]` 行 */
export function characterOutputClaimsSentImageWithoutLine(bubbles: string[]): boolean {
  if (bubbles.some((b) => parseCharacterImageGenLine(String(b).trim()))) return false
  return bubbles.some((b) => {
    const t = String(b ?? '').trim()
    if (!t || /^\[表情包\]/.test(t)) return false
    return CHARACTER_FAKE_SENT_IMAGE_RE.test(t)
  })
}

export function buildCharacterImageFakeSendRetryBias(): string {
  return `[系统纠错] 你上一轮口头写了「发过去了/拍好了」等，但**缺少** \`[图片]画面描述\` 行，客户端**不会**生图。
请立刻补发：单独占一行 \`[图片]…\`（与上一轮口头承诺一致的画面，如前置自拍），可保留原有文字气泡；**禁止**再次假装已发而无 \`[图片]\` 行。`
}

export function mergeCharacterImageRetryBubbles(original: string[], retry: string[]): string[] {
  const imageLines: string[] = []
  for (const b of retry) {
    for (const line of String(b ?? '').split('\n')) {
      const trimmed = line.trim()
      if (parseCharacterImageGenLine(trimmed)) imageLines.push(trimmed)
    }
  }
  if (!imageLines.length) return original

  const fakeIdx = original.findIndex((b) => {
    const t = String(b ?? '').trim()
    return t && !/^\[表情包\]/.test(t) && CHARACTER_FAKE_SENT_IMAGE_RE.test(t)
  })
  if (fakeIdx >= 0) {
    return [...original.slice(0, fakeIdx), ...imageLines, ...original.slice(fakeIdx)]
  }
  return [...imageLines, ...original]
}
