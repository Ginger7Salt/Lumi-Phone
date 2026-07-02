import { getWechatClassicEmojiUrlByName } from './wechatClassicStickerPack'

const EMOJI_IMG_ATTR = 'data-wx-classic-emoji'
export const WECHAT_COMPOSER_ZWSP = '\u200b'

function stripComposerInvisibleChars(text: string): string {
  return text.replaceAll(WECHAT_COMPOSER_ZWSP, '').trim()
}

/** 输入框可见/可发送文案（去掉零宽字符） */
export function normalizeWeChatComposerDraftText(text: string): string {
  return stripComposerInvisibleChars(String(text ?? ''))
}

export function readWeChatComposerDraftText(root: HTMLElement | null): string {
  if (!root) return ''
  return normalizeWeChatComposerDraftText(serializeWeChatComposerEl(root))
}

export function clearWeChatComposerField(root: HTMLElement | null) {
  if (!root) return
  applyWeChatComposerText(root, '')
}

const ZWSP = WECHAT_COMPOSER_ZWSP
const CLASSIC_EMOJI_BRACKET_RE = /\[([^\[\]\n]{1,24})\]/g

const EMOJI_IMG_CLASS = 'mx-px inline-block h-[22px] w-[22px] align-[-4px] object-contain'

function createEmojiImg(name: string, url: string, token: string): HTMLImageElement {
  const img = document.createElement('img')
  img.src = url
  img.alt = token
  img.setAttribute(EMOJI_IMG_ATTR, name)
  img.contentEditable = 'false'
  img.draggable = false
  img.className = EMOJI_IMG_CLASS
  return img
}

function appendTextWithClassicEmojis(target: Node, text: string) {
  const emojiMap = getWechatClassicEmojiUrlByName()
  let last = 0
  CLASSIC_EMOJI_BRACKET_RE.lastIndex = 0
  for (const m of text.matchAll(CLASSIC_EMOJI_BRACKET_RE)) {
    const idx = m.index ?? 0
    const name = String(m[1] ?? '').trim()
    const url = name ? emojiMap.get(name) : undefined
    if (!url) continue
    if (idx > last) target.appendChild(document.createTextNode(text.slice(last, idx)))
    target.appendChild(createEmojiImg(name, url, m[0]!))
    last = idx + m[0]!.length
  }
  if (last < text.length) target.appendChild(document.createTextNode(text.slice(last)))
  if (last === 0 && text) target.appendChild(document.createTextNode(text))
}

export function serializeWeChatComposerEl(root: HTMLElement): string {
  let out = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += (node.textContent ?? '').replaceAll(ZWSP, '')
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    if (el.tagName === 'IMG') {
      const name = el.getAttribute(EMOJI_IMG_ATTR)
      if (name) {
        out += `[${name}]`
        return
      }
    }
    if (el.tagName === 'BR') {
      out += '\n'
      return
    }
    el.childNodes.forEach(walk)
  }
  root.childNodes.forEach(walk)
  return out
}

export function applyWeChatComposerText(root: HTMLElement, text: string) {
  root.replaceChildren()
  if (!text) return
  appendTextWithClassicEmojis(root, text)
}

export function moveWeChatComposerCaretToEnd(root: HTMLElement) {
  root.focus({ preventScroll: true })
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function insertWeChatClassicEmojiAtCaret(root: HTMLElement, token: string) {
  const match = /^\[([^\]]+)\]$/.exec(token.trim())
  if (!match) return
  const name = match[1]!.trim()
  const url = getWechatClassicEmojiUrlByName().get(name)
  if (!url) return

  const img = createEmojiImg(name, url, token.trim())
  const tail = document.createTextNode(ZWSP)
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
    root.appendChild(img)
    root.appendChild(tail)
    moveWeChatComposerCaretToEnd(root)
    return
  }
  const range = sel.getRangeAt(0)
  range.deleteContents()
  range.insertNode(tail)
  range.insertNode(img)
  range.setStartAfter(tail)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}
