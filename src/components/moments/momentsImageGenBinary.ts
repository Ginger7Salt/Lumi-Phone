export function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** 从 NovelAI 返回的 zip 或原始 PNG 字节中提取 data URL */
export function extractPngDataUrlFromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return `data:image/png;base64,${uint8ToBase64(bytes)}`
  }

  for (let i = 0; i < bytes.length - 8; i++) {
    if (bytes[i] !== 0x89 || bytes[i + 1] !== 0x50 || bytes[i + 2] !== 0x4e || bytes[i + 3] !== 0x47) {
      continue
    }
    let end = i + 8
    while (end < bytes.length - 7) {
      if (bytes[end] === 0x49 && bytes[end + 1] === 0x45 && bytes[end + 2] === 0x4e && bytes[end + 3] === 0x44) {
        end += 8
        break
      }
      end++
    }
    return `data:image/png;base64,${uint8ToBase64(bytes.slice(i, end))}`
  }

  throw new Error('未找到 PNG 图片数据')
}
