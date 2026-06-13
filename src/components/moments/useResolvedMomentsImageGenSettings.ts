import { useMemo } from 'react'

import { useImageGenSettings } from '../../phone/apps/api/useImageGenSettings'

import { resolveMomentsEffectiveImageGenSettings } from './resolveMomentsImageGenSettings'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'

/** 朋友圈动态/配图：专属生图 API 优先，未开启时回退 API 设置默认生图 */
export function useResolvedMomentsImageGenSettings() {
  const { settings, patchImageGen } = useMomentsSettingsStore()
  const { imageGen: globalImageGen } = useImageGenSettings()

  const effectiveImageGen = useMemo(
    () => resolveMomentsEffectiveImageGenSettings(settings.imageGen, globalImageGen),
    [globalImageGen, settings.imageGen],
  )

  return {
    dedicatedImageGen: settings.imageGen,
    globalImageGen,
    effectiveImageGen,
    patchDedicatedImageGen: patchImageGen,
  }
}
