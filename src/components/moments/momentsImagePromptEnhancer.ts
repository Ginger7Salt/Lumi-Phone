import { getPollinationsStylePreset, resolveStylePrefix } from './pollinationsPresets'
import type { MomentsImageGenSettings } from './useMomentsSettingsStore'

const PERSON_HINT =
  /\b(person|people|portrait|face|selfie|girl|boy|man|woman|character|human|male|female|student|boyfriend|girlfriend|couple)\b/i

const ANIME_STYLE_HINT = /\banime\b|illustration|2d|cel shading|二次元/i

function isAnimeStyle(settings: MomentsImageGenSettings, combinedPrompt: string): boolean {
  if (ANIME_STYLE_HINT.test(combinedPrompt)) return true
  if (settings.stylePrefixMode === 'preset') {
    const preset = getPollinationsStylePreset(settings.stylePresetId)
    if (preset?.id === 'anime') return true
  }
  if (settings.stylePrefixMode === 'custom') {
    return ANIME_STYLE_HINT.test(settings.customStylePrefix)
  }
  return false
}

function hasPersonSubject(prompt: string): boolean {
  return PERSON_HINT.test(prompt) || /人|脸|肖像|自拍|男生|女生|少年|少女|青年/.test(prompt)
}

const ANIME_FACE_SUFFIX =
  'beautiful anime face, detailed expressive eyes, delicate facial features, well-proportioned face, attractive, clean linework, NOT ugly, NOT deformed face, NOT bad anatomy'

const REALISTIC_FACE_SUFFIX =
  'beautiful face, detailed facial features, symmetrical face, clear eyes, natural skin texture, attractive, NOT ugly, NOT deformed face, NOT bad anatomy'

const ANIME_ANTI_REALISTIC =
  'NOT photorealistic, NOT realistic photo, NOT DSLR, NOT 3d render, NOT hyperrealistic'

const SELFIE_HINT =
  /\b(selfie|self[\s-]?portrait|mirror selfie|front camera)\b|自拍|对镜|前置摄像头|镜面自拍/i

/** 角色私聊/群聊/朋友圈：模型描述是否为自拍（含人物正脸/对镜） */
export function isCharacterMediaSelfiePrompt(prompt: string): boolean {
  return SELFIE_HINT.test(prompt.trim())
}

/** @deprecated 使用 isCharacterMediaSelfiePrompt */
export const isCharacterChatSelfiePrompt = isCharacterMediaSelfiePrompt

const CHARACTER_MEDIA_POV_LANDSCAPE_SUFFIX =
  'authentic first-person smartphone POV from photographer standing or sitting height, camera tilt matches subject (horizontal eye-level for landscapes and street views, upward for sky and tall architecture, downward only for ground-level subjects), immersive handheld snapshot, photographer body parts are optional and only when the scene naturally includes them (feet or pant cuffs at bottom edge when looking down, hand or fingers at frame edge for peace sign or wave gesture, otherwise pure scenic view with no visible limbs), NOT third-person view, NOT aerial drone shot, NOT surveillance CCTV angle, NOT studio backdrop'

const CHARACTER_MEDIA_SELFIE_SUFFIX =
  'front-facing smartphone selfie camera POV at chest-to-face height arm-length distance, slight natural handheld angle, upper body and face in frame together, NOT extreme close-up big head portrait, NOT third-person portrait, NOT studio headshot, NOT fish-eye distortion'

function inferCharacterMediaPovTiltSuffix(prompt: string): string {
  const p = prompt.trim()
  const lower = p.toLowerCase()

  if (/比耶|耶|peace sign|v sign|v-sign|剪刀手|手势|招手|waving hand|hand gesture|手指.*(?:入镜|边缘|画[面框])|举.*手/.test(p)) {
    return 'first-person smartphone POV with photographer own hand or fingers entering frame edge making casual peace sign or wave gesture, scenic background beyond hand, NOT third-person portrait, NOT full-body shot'
  }

  if (
    /脚下|地面|低头|俯拍|俯视|floor|ground|at (my )?feet|pavement|sidewalk|looking down|below|裤脚|裤腿|鞋尖|裙角|台阶/.test(p) ||
    /(?:脚边|脚下|地面).{0,8}(?:猫|狗)/.test(p)
  ) {
    if (/裤脚|裤腿|鞋尖|球鞋|拖鞋|sneaker|toes|pant legs|cuffs|skirt hem|我的.*(?:鞋|裤|裙)/.test(p)) {
      return 'downward tilted phone camera toward ground-level subject, photographer own shoes or pant cuffs visible at bottom edge as in casual over-the-feet phone snap'
    }
    return 'downward tilted phone camera toward ground-level subject, natural downward phone tilt, no forced feet or legs unless prompt explicitly mentions them'
  }

  if (/天空|抬头|仰视|sky|ceiling|looking up|building top|树梢|树冠|高楼|招牌|clouds|sunset sky|星空|星轨|月亮/.test(lower)) {
    return 'upward tilted phone camera from standing height, sky architecture or canopy fills frame, no feet legs or hands in frame, immersive looking-up snapshot'
  }

  if (/桌面|桌|咖啡|键盘|书|饭|餐|手边|lap|膝盖|食物|奶茶|杯/.test(p)) {
    return 'slightly downward seated or standing phone POV toward table-level subject, hands or sleeves may optionally edge into frame'
  }

  if (
    /风景|街景|窗外|夜景|城市|lake|mountain|landscape|scenery|street|horizon|sunset|海|湖|山|路|林荫|建筑|天际线|江|河|公园|雪|雨/.test(
      p,
    )
  ) {
    return 'natural eye-level smartphone POV, scenery fills frame horizontally, no visible photographer body parts, handheld snapshot realism, NOT drone NOT CCTV NOT third-person'
  }

  return 'natural eye-level or context-appropriate first-person smartphone POV from standing or sitting height, body parts only when scene naturally includes them, NOT third-person NOT drone'
}

/** 角色侧配图（私聊/群聊/朋友圈）：非自拍强制真实第一视角；自拍从前置摄像头高度 arm-length */
export function buildCharacterMediaImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed

  const stylePrefix = resolveStylePrefix(settings)
  const withStyle = stylePrefix ? `${stylePrefix}${trimmed}`.trim() : trimmed
  const anime = isAnimeStyle(settings, withStyle)

  if (isCharacterMediaSelfiePrompt(trimmed)) {
    const parts = [withStyle, CHARACTER_MEDIA_SELFIE_SUFFIX]
    if (anime && !/not photorealistic/i.test(withStyle)) parts.push(ANIME_ANTI_REALISTIC)
    parts.push(anime ? ANIME_FACE_SUFFIX : REALISTIC_FACE_SUFFIX)
    return parts.join(', ')
  }

  const parts = [withStyle, CHARACTER_MEDIA_POV_LANDSCAPE_SUFFIX, inferCharacterMediaPovTiltSuffix(trimmed)]
  if (anime && !/not photorealistic/i.test(withStyle)) {
    parts.push(ANIME_ANTI_REALISTIC)
  }
  return parts.join(', ')
}

/** @deprecated 使用 buildCharacterMediaImagePrompt */
export const buildCharacterChatImagePrompt = buildCharacterMediaImagePrompt

export function resolveImageStyleHint(settings: MomentsImageGenSettings): string {
  if (settings.stylePrefixMode === 'custom') {
    const custom = settings.customStylePrefix.trim()
    return custom ? `自定义（${custom.slice(0, 48)}）` : '自定义'
  }
  return getPollinationsStylePreset(settings.stylePresetId)?.labelZh ?? '写实摄影'
}

export function enhanceMomentsImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed

  const parts = [trimmed]
  const anime = isAnimeStyle(settings, trimmed)

  if (anime && !/not photorealistic/i.test(trimmed)) {
    parts.push(ANIME_ANTI_REALISTIC)
  }

  if (hasPersonSubject(trimmed)) {
    parts.push(anime ? ANIME_FACE_SUFFIX : REALISTIC_FACE_SUFFIX)
  }

  return parts.join(', ')
}

export function buildMomentsImagePrompt(
  prompt: string,
  settings: MomentsImageGenSettings,
  options?: { skipStylePrefix?: boolean },
): string {
  const trimmed = prompt.trim()
  if (!trimmed) return trimmed

  const stylePrefix = options?.skipStylePrefix ? '' : resolveStylePrefix(settings)
  const withStyle = stylePrefix ? `${stylePrefix}${trimmed}`.trim() : trimmed
  return enhanceMomentsImagePrompt(withStyle, settings)
}
