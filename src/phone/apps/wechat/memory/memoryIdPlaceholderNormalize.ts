/**
 * 记忆正文 `{{id:…}}` 语法规范化：解开嵌套、修正残缺括号、避免入库/预览截断。
 */

const ID_PLACEHOLDER_RE = /\{\{id:([^}]+)\}\}/g

/** 解开 `{{id:{{id:真实id}}}}` 等嵌套（模型或入库误替换导致）。 */
export function unwrapNestedMemoryIdPlaceholders(text: string): string {
  let s = String(text ?? '')
  if (!s.includes('{{id:')) return s
  for (let i = 0; i < 10; i++) {
    const next = s
      .replace(/\{\{id:\s*\{\{id:([^}]+)\}\}\s*\}\}/g, '{{id:$1}}')
      .replace(/\{\{id:\s*\{\{id:([^}]+)\}\}(?!\})/g, '{{id:$1}}')
    if (next === s) break
    s = next
  }
  return s
}

export function normalizeMemoryIdPlaceholderSyntax(text: string): string {
  return unwrapNestedMemoryIdPlaceholders(String(text ?? '').trim())
}

/** 收集正文里所有 `{{id:…}}` 内的 id（先解开嵌套）。 */
export function collectMemoryIdPlaceholderIds(texts: Iterable<string>): string[] {
  const ids = new Set<string>()
  for (const raw of texts) {
    const s = normalizeMemoryIdPlaceholderSyntax(String(raw ?? ''))
    if (!s.includes('{{id:')) continue
    for (const m of s.matchAll(ID_PLACEHOLDER_RE)) {
      const id = m[1]?.trim()
      if (!id || id.includes('{{') || id.includes('}}')) continue
      ids.add(id)
    }
  }
  return [...ids]
}

/** 仅在非 `{{…}}` 占位符块内替换裸人设 id，避免把 `{{id:xxx}}` 弄成双层嵌套。 */
export function replaceBareTokenOutsidePlaceholders(
  content: string,
  token: string,
  replacement: string,
): string {
  const t = token.trim()
  const rep = replacement.trim()
  if (!t || !rep || !content.includes(t)) return content
  const parts = content.split(/(\{\{[^}]+\}\})/g)
  return parts
    .map((seg, idx) => {
      if (idx % 2 === 1) return seg
      return seg.split(t).join(rep)
    })
    .join('')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 展示层兜底：逐 id 强制替换仍未展开的 `{{id:…}}` */
export function forceExpandRemainingMemoryIdPlaceholders(
  text: string,
  idToDisplayName: Readonly<Record<string, string>>,
): string {
  let s = normalizeMemoryIdPlaceholderSyntax(String(text ?? ''))
  if (!s.includes('{{id:')) return s
  for (const id of collectMemoryIdPlaceholderIds([s])) {
    const name = String(idToDisplayName[id] ?? '').trim() || '其他角色'
    const re = new RegExp(`\\{\\{id:\\s*${escapeRegExp(id)}\\s*\\}\\}`, 'g')
    s = s.replace(re, name)
  }
  return s
}

/** 编辑面板保存：将展示用真实姓名还原为 `{{id:…}}`（长名优先，避免短名误替） */
export function collapseDisplayNamesToMemoryIdPlaceholders(
  text: string,
  idToDisplayName: Readonly<Record<string, string>>,
): string {
  let s = String(text ?? '')
  const entries = Object.entries(idToDisplayName)
    .filter(([, name]) => String(name).trim())
    .sort((a, b) => String(b[1]).length - String(a[1]).length)
  for (const [id, name] of entries) {
    s = replaceBareTokenOutsidePlaceholders(s, String(name).trim(), `{{id:${id}}}`)
  }
  return s
}

/** 将 `{{id:错误id}}` 纠正为 `{{id:canonicalId}}`（含嵌套解开后再替换）。 */
export function applyMemoryIdPlaceholderCorrections(
  text: string,
  idCorrections: Readonly<Record<string, string>>,
): string {
  let s = normalizeMemoryIdPlaceholderSyntax(text)
  if (!s.includes('{{id:')) return s
  for (const [wrong, right] of Object.entries(idCorrections)) {
    const w = wrong.trim()
    const r = right.trim()
    if (!w || !r || w === r) continue
    s = s.replaceAll(`{{id:${w}}}`, `{{id:${r}}}`)
  }
  return normalizeMemoryIdPlaceholderSyntax(s)
}
