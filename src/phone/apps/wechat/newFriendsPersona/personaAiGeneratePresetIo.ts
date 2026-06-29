import {
  normalizePersonaAiGenerateForm,
  type PersonaAiGenerateFormDraftRecord,
} from './personaAiGenerateFormPersist'
import type { PersonaAiGenerateForm } from './personaAiGenerateTypes'

export const PERSONA_AI_GENERATE_PRESET_KIND = 'persona-ai-generate-preset-v1'

export type PersonaAiGeneratePresetExport = {
  kind: typeof PERSONA_AI_GENERATE_PRESET_KIND
  version: 1
  exportedAt: number
  /** 可选备注，便于在文件管理器中区分 */
  label?: string
  form: PersonaAiGenerateForm
}

function safeExportFilenameSegment(name: string, fallback: string): string {
  const raw = (name || '').trim() || fallback
  return raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 64) || fallback
}

function buildPresetExportFilename(form: PersonaAiGenerateForm): string {
  const label = form.nameHint.trim() || '未命名'
  return `AI立体人设预设-${safeExportFilenameSegment(label, '预设')}.json`
}

export function buildPersonaAiGeneratePresetExport(
  form: PersonaAiGenerateForm,
  label?: string,
): PersonaAiGeneratePresetExport {
  const trimmedLabel = label?.trim() || form.nameHint.trim() || undefined
  return {
    kind: PERSONA_AI_GENERATE_PRESET_KIND,
    version: 1,
    exportedAt: Date.now(),
    ...(trimmedLabel ? { label: trimmedLabel } : {}),
    form,
  }
}

export function serializePersonaAiGeneratePresetExport(
  payload: PersonaAiGeneratePresetExport,
): string {
  try {
    const compact = JSON.stringify(payload)
    if (compact.length <= 256 * 1024) {
      try {
        return JSON.stringify(JSON.parse(compact), null, 2)
      } catch {
        return compact
      }
    }
    return compact
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : '预设无法序列化')
  }
}

export function parsePersonaAiGeneratePresetImport(text: string): PersonaAiGenerateForm | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  let raw: unknown
  try {
    raw = JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.kind === PERSONA_AI_GENERATE_PRESET_KIND) {
    const form = normalizePersonaAiGenerateForm(o)
    return form
  }
  const asDraft = raw as PersonaAiGenerateFormDraftRecord
  if (asDraft.form) {
    return normalizePersonaAiGenerateForm(asDraft)
  }
  return normalizePersonaAiGenerateForm(raw)
}

async function saveJsonFileToDisk(json: string, filename: string): Promise<void> {
  const name = filename.trim().endsWith('.json') ? filename.trim() : `${filename.trim()}.json`
  const file = new File([json], name, { type: 'application/json', lastModified: Date.now() })

  const nav = navigator as Navigator & {
    share?: (data: ShareData) => Promise<void>
    canShare?: (data: ShareData) => boolean
  }
  if (typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    const data: ShareData = { files: [file] }
    try {
      if (nav.canShare(data)) {
        await nav.share(data)
        return
      }
    } catch (e) {
      const err = e as { name?: string }
      if (err?.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const a = document.createElement('a')
    a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px'
    a.rel = 'noopener'
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    URL.revokeObjectURL(url)
    throw new Error('无法保存文件，请重试或使用「分享」存到本地。')
  }
}

export async function exportPersonaAiGeneratePresetToFile(form: PersonaAiGenerateForm): Promise<void> {
  const payload = buildPersonaAiGeneratePresetExport(form)
  const json = serializePersonaAiGeneratePresetExport(payload)
  await saveJsonFileToDisk(json, buildPresetExportFilename(form))
}
