export type VnBgmAsset = {
  name: string
  fileName: string
  url: string
}

type GlobModule = {
  default?: string
}

const VN_BGM_MODULES_REL = import.meta.glob<GlobModule>(
  '../../../../../BGM/**/*.{mp3,wav,ogg,m4a,flac,aac,MP3,WAV,OGG,M4A,FLAC,AAC}',
  { eager: true },
)
const VN_BGM_MODULES_ABS = import.meta.glob<GlobModule>(
  '/BGM/**/*.{mp3,wav,ogg,m4a,flac,aac,MP3,WAV,OGG,M4A,FLAC,AAC}',
  { eager: true },
)
const VN_BGM_MODULES_PUBLIC = import.meta.glob<GlobModule>(
  '/public/BGM/**/*.{mp3,wav,ogg,m4a,flac,aac,MP3,WAV,OGG,M4A,FLAC,AAC}',
  { eager: true },
)
const VN_BGM_MODULES = {
  ...VN_BGM_MODULES_REL,
  ...VN_BGM_MODULES_ABS,
  ...VN_BGM_MODULES_PUBLIC,
}

function cleanBgmName(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  return t
    .replace(/\.[A-Za-z0-9]+$/u, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeBgmKey(raw: string): string {
  return cleanBgmName(raw)
    .toLowerCase()
    .replace(/[，,。.!！?？、;；:："“”"'‘’（）()[\]【】\-_/\\]/g, '')
    .replace(/\s+/g, '')
}

function pathBaseName(path: string): string {
  const norm = String(path || '').replace(/\\/g, '/')
  const idx = norm.lastIndexOf('/')
  return idx >= 0 ? norm.slice(idx + 1) : norm
}

export const VN_BGM_ASSETS: VnBgmAsset[] = Object.entries(VN_BGM_MODULES)
  .map(([path, mod]) => {
    const fileName = pathBaseName(path)
    const name = cleanBgmName(fileName)
    const url = String(mod?.default || '').trim()
    if (!name || !url) return null
    return { name, fileName, url }
  })
  .filter((x): x is VnBgmAsset => !!x)
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))

export function buildVnBgmPromptBlock(): string {
  if (!VN_BGM_ASSETS.length) return ''
  const names = VN_BGM_ASSETS.map((x) => x.name)
  return (
    `【VN背景音乐库】以下 BGM 名可用（直接使用文件名语义）：\n` +
    `${names.map((x) => `- ${x}`).join('\n')}\n` +
    `【BGM输出规则】` +
    `需要切换音乐时，在对应气泡前单独输出一行「【BGM】音乐名」。` +
    `同一轮可多次切换，且必须从上述列表中选最符合当下情绪和场景的一项；` +
    `若当前音乐已合适则不要重复输出。`
  )
}

export function resolveVnBgmByName(name: string): VnBgmAsset | null {
  const key = normalizeBgmKey(name)
  if (!key) return null
  const exact = VN_BGM_ASSETS.find((x) => normalizeBgmKey(x.name) === key)
  if (exact) return exact
  const fuzzy = VN_BGM_ASSETS.find((x) => {
    const nk = normalizeBgmKey(x.name)
    return nk.includes(key) || key.includes(nk)
  })
  return fuzzy ?? null
}

export function extractVnBgmCueName(rawLine: string): string | null {
  const t = String(rawLine || '').trim()
  if (!t) return null
  const m1 = t.match(/^【\s*BGM\s*】\s*(.+)$/iu)
  if (m1?.[1]) return m1[1].trim()
  const m2 = t.match(/^BGM[：:]\s*(.+)$/iu)
  if (m2?.[1]) return m2[1].trim()
  return null
}
