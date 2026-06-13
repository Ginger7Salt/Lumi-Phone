export const VOICE_ALLOWED_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'neutral',
  'calm',
  'fluent',
  'whisper',
] as const

export type VoiceAllowedEmotion = (typeof VOICE_ALLOWED_EMOTIONS)[number]

const VOICE_ALLOWED_TONE_TOKENS = new Set([
  'clear-throat',
  'laughs',
  'chuckle',
  'coughs',
  'groans',
  'breath',
  'pant',
  'inhale',
  'exhale',
  'gasps',
  'sniffs',
  'sighs',
  'snorts',
  'burps',
  'lip-smacking',
  'humming',
  'hissing',
  'emm',
  'sneezes',
])

export function sanitizeVoiceTranscriptDisplay(input: string): string {
  return String(input ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\{\/?(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/gi, ' ')
    .replace(/(^|[\s，。！？!?,、；;:：])(啧+|哈+)(?:\s*(?:\.{2,}|…+|~+|～+))?(?=$|[\s，。！？!?,、；;:：])/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sanitizeVoiceControlForTextBubble(input: string): string {
  return String(input ?? '')
    .replace(/<#\s*[\d.]+\s*#>/g, ' ')
    .replace(/\(([a-zA-Z][a-zA-Z\- ]{0,24})\)/g, ' ')
    .replace(/\{\/?(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/gi, ' ')
    .replace(/（(?:对方|用户)?语音(?:[，,:：][^）]{1,16})?）/g, ' ')
    .replace(/\((?:对方|用户)?语音(?:[，,:：][^)]{1,16})?\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeVoiceScriptForTts(input: string): string {
  let s = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return '{neutral}(breath)<#0.4#>嗯。{/neutral}'

  s = s.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    const token = String(inner || '').trim().toLowerCase()
    return VOICE_ALLOWED_TONE_TOKENS.has(token) ? `(${token})` : ' '
  })

  s = s.replace(/\{\/?([a-zA-Z]+)\}/g, (m, tag: string) => {
    const t = String(tag || '').toLowerCase()
    return (VOICE_ALLOWED_EMOTIONS as readonly string[]).includes(t) ? m.toLowerCase() : ' '
  })

  s = s.replace(
    /(^|[\s，。！？!?,、；;:：])(啧+|哈+)(?:\s*(?:\.{2,}|…+|~+|～+))?(?=$|[\s，。！？!?,、；;:：])/gu,
    '$1',
  )

  const plain = sanitizeVoiceControlForTextBubble(s)
  const guessEmotion = () => {
    const t = plain
    const surprised =
      /真的假的|真的吗|不会吧|啊\?|诶\?|哎\?|震惊|？！|\?!|\?！/u.test(t) || /[?？]/u.test(t)
    const happy = /喜欢|求求|拜托|太好了|好耶|开心|嘿嘿|嘻嘻|~|么|嘛/u.test(t)
    const sad = /难过|委屈|想哭|呜呜|唉|算了吧|对不起/u.test(t)
    const angry = /气死|烦死|别闹|够了|离谱|你干嘛/u.test(t)
    if (angry) return 'angry' as const
    if (sad) return 'sad' as const
    if (surprised && !happy) return 'surprised' as const
    if (happy) return 'happy' as const
    if (t.length >= 26 && /[，。,.]/u.test(t) && !/[!?？！]/u.test(t)) return 'fluent' as const
    return 'neutral' as const
  }

  if (!/<#\s*[\d.]+\s*#>/.test(s)) {
    s = s
      .replace(/(\.\.\.|…+)/g, `<#0.5#>$1<#0.5#>`)
      .replace(/([，,])/g, `$1<#0.35#>`)
      .replace(/([。；;])/g, `$1<#0.5#>`)
      .replace(/([！？!?])/g, `$1<#0.6#>`)
      .replace(/(~+)/g, `$1<#0.25#>`)
      .replace(/\s+/g, ' ')
      .trim()
    if (!/<#\s*[\d.]+\s*#>/.test(s)) s = `<#0.4#>${s}`
  }

  const hasEmotionTag = /\{(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/i.test(s)
  if (!hasEmotionTag) {
    const emo = guessEmotion()
    s = `{${emo}}${s}{/${emo}}`
  }

  return s.replace(/\s+/g, ' ').trim()
}

export function stripEmotionTagsForTts(input: string): string {
  let s = String(input ?? '')
    .replace(/\{\/?(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  s = s
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/【/g, '(')
    .replace(/】/g, ')')

  s = s.replace(/\(([^)]*)\)/g, (_m, inner: string) => {
    const token = String(inner || '').trim().toLowerCase()
    return VOICE_ALLOWED_TONE_TOKENS.has(token) ? `(${token})` : ' '
  })

  s = s.replace(/<(?!#\s*[\d.]+\s*#>)[^>]*>/g, ' ')

  return s.replace(/\s+/g, ' ').trim()
}

export function pickVoiceEmotionForTts(input: string): VoiceAllowedEmotion | undefined {
  const s = String(input ?? '')
  const m = s.match(/\{(happy|sad|angry|fearful|disgusted|surprised|neutral|calm|fluent|whisper)\}/i)
  if (!m?.[1]) return undefined
  const emo = m[1].toLowerCase() as VoiceAllowedEmotion
  return (VOICE_ALLOWED_EMOTIONS as readonly string[]).includes(emo) ? emo : undefined
}
