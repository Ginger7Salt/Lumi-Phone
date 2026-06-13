/** 瞬时生成：朋友圈内容气质 / 题材类型（与纯文字·图文·纯图片的载体形式独立） */
export type InstantGenContentTypeChoice =
  | 'auto'
  | 'custom'
  | 'daily_vent'
  | 'jealous_crush'
  | 'serious_notice'
  | 'gossip'
  | 'essay'
  | 'show_off'
  | 'melancholy'
  | 'celebration'

export const INSTANT_GEN_CUSTOM_CONTENT_DIRECTION_MAX = 300

export type InstantGenContentTypeOption = {
  id: InstantGenContentTypeChoice
  label: string
  hint: string
}

export const INSTANT_GEN_CONTENT_TYPE_OPTIONS: InstantGenContentTypeOption[] = [
  {
    id: 'auto',
    label: '自动适配',
    hint: '根据角色人设、好感度与最近对话/剧情，自行选择最自然的朋友圈气质与题材。',
  },
  {
    id: 'custom',
    label: '自定义',
    hint: '由你指定本条朋友圈的内容偏向、情绪走向或剧情意图；模型须严格围绕你的描述生成正文与互动。',
  },
  {
    id: 'daily_vent',
    label: '日常吐槽',
    hint: '生活琐事、工作学习、天气交通、奇葩见闻等轻松吐槽；口语化、有梗、像真人发牢骚，可带自嘲或阴阳怪气但别过火。',
  },
  {
    id: 'jealous_crush',
    label: '暗恋吃醋',
    hint: '酸溜溜、欲言又止、暗戳戳的暗恋或吃醋；不直说名字，用暗示、对比、深夜感、配图氛围烘托；互动里可有朋友起哄或看破不说破。',
  },
  {
    id: 'serious_notice',
    label: '严肃通知',
    hint: '官方感、公告感：活动通知、请假说明、重要提醒、组织安排等；语气正式克制、条理清晰，可分段换行，像真人在发重要事项。',
  },
  {
    id: 'gossip',
    label: '爆瓜内容',
    hint: '八卦、内幕、惊天大瓜、圈内传闻；悬念拉满、细节具体但留余地，像知情人爆料；互动里朋友追问、震惊、站队或吃瓜评论要热闹。',
  },
  {
    id: 'essay',
    label: '小作文',
    hint: '长文感悟、复盘、抒情或叙事；可数百字，分段清晰，有起承转合；适合深夜、纪念、告别、感谢等场景。',
  },
  {
    id: 'show_off',
    label: '炫生活',
    hint: '晒美食、旅行、成就、礼物、合照等；凡尔赛或直球炫耀皆可，符合角色性格；配图与文案互相呼应。',
  },
  {
    id: 'melancholy',
    label: '丧系emo',
    hint: '低落、疲惫、失眠、意难平、遗憾；短句或长叹，氛围感强，可配空镜或夜景；互动宜安慰、陪聊或同样丧。',
  },
  {
    id: 'celebration',
    label: '庆祝开心',
    hint: '生日、节日、上岸、和好、小确幸；语气明亮、真诚，可带 emoji；互动里祝福、羡慕、调侃均可。',
  },
]

const CONTENT_TYPE_LABEL = new Map(
  INSTANT_GEN_CONTENT_TYPE_OPTIONS.map((o) => [o.id, o.label] as const),
)

const CONTENT_TYPE_HINT = new Map(
  INSTANT_GEN_CONTENT_TYPE_OPTIONS.map((o) => [o.id, o.hint] as const),
)

export function getInstantGenContentTypeLabel(choice: InstantGenContentTypeChoice): string {
  return CONTENT_TYPE_LABEL.get(choice) ?? '自动适配'
}

export function clampInstantGenCustomContentDirection(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, INSTANT_GEN_CUSTOM_CONTENT_DIRECTION_MAX)
}

export function buildInstantGenContentTypePromptBlock(
  choice: InstantGenContentTypeChoice,
  customDirection?: string,
): string {
  if (choice === 'custom') {
    const direction = clampInstantGenCustomContentDirection(customDirection ?? '')
    if (!direction) {
      return [
        '【内容气质】用户选择：自定义，但未填写具体偏向。',
        '请结合角色人设与最近上下文自行推断最合理的朋友圈方向。',
      ].join('\n')
    }
    return [
      '【内容气质 · 必须遵循】用户自定义内容偏向：',
      direction,
      '请严格围绕上述用户指定的内容偏向撰写正文与互动评论，仍须符合角色人设与口语活人感；载体形式（纯文字/图文/纯图片）仍须遵守用户选定的 postType。',
    ].join('\n')
  }
  if (choice === 'auto') {
    return [
      '【内容气质】用户选择：自动适配。',
      '请结合角色人设、与用户的关系及最近上下文，自行决定本条朋友圈的气质（日常/暧昧/严肃/八卦/长文等），务必像该角色会发的那种圈。',
    ].join('\n')
  }
  const label = getInstantGenContentTypeLabel(choice)
  const hint = CONTENT_TYPE_HINT.get(choice) ?? ''
  return [
    `【内容气质 · 必须遵循】用户指定类型：${label}`,
    hint,
    '载体形式（纯文字/图文/纯图片）仍须遵守用户选定的 postType；内容气质与本条正文、互动评论的风格须一致。',
  ].join('\n')
}

export function normalizeInstantGenContentType(
  raw: unknown,
  fallback: InstantGenContentTypeChoice = 'auto',
): InstantGenContentTypeChoice {
  if (typeof raw !== 'string') return fallback
  const hit = INSTANT_GEN_CONTENT_TYPE_OPTIONS.find((o) => o.id === raw)
  return hit?.id ?? fallback
}
