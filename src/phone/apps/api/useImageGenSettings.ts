import { useCallback } from 'react'

import type { MomentsImageGenSettings } from '../../../components/moments/useMomentsSettingsStore'
import { isMomentsImageGenConfigured } from '../../../components/moments/momentsImageGenAvailability'
import { useApiSettings } from './ApiSettingsContext'
import { DEFAULT_IMAGE_GEN_SETTINGS, patchPresetImageGen } from './imageGenPresetUtils'

export function useImageGenSettings() {
  const { currentPreset, upsertPreset } = useApiSettings()

  const imageGen = currentPreset?.imageGen ?? DEFAULT_IMAGE_GEN_SETTINGS

  const patchImageGen = useCallback(
    (patch: Partial<MomentsImageGenSettings>) => {
      if (!currentPreset) return
      upsertPreset(patchPresetImageGen(currentPreset, patch))
    },
    [currentPreset, upsertPreset],
  )

  return {
    imageGen,
    patchImageGen,
    hasPreset: !!currentPreset,
    configured: isMomentsImageGenConfigured(imageGen),
  }
}
