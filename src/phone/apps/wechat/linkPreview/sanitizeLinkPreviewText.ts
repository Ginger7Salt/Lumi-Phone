/** 去掉控制字符、异常 surrogate，避免注入 prompt / 渲染时出问题 */
export function sanitizeLinkPreviewText(raw: string | undefined, max: number): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}
