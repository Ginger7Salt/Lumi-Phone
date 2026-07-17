import type { PulseTab } from './pulseTypes'

export type PulseAppCoachTargetId =
  | 'nav-profile'
  | 'profile-social-btn'
  | 'social-plot-list'
  | 'social-overwrite'
  | 'social-generate-btn'
  | 'nav-discover'
  | 'discover-trending-btn'
  | 'trending-sliders'
  | 'trending-styles'
  | 'trending-refs'
  | 'trending-start'
  | 'nav-home'
  | 'home-publish-btn'
  | 'publish-editor'
  | 'publish-toolbox'
  | 'publish-submit'
  | 'nav-inbox'
  | 'inbox-dm-entry'
  | 'inbox-dm-generate'
  | 'dm-sheet-body'

export type PulseCoachTopicId = 'social' | 'publish' | 'trending' | 'dm'

export type PulseAppCoachStep = {
  target: PulseAppCoachTargetId | null
  title: string
  body: string
  tab?: PulseTab
  openSocialSheet?: boolean
  openTrendingSheet?: boolean
  openPublishEditor?: boolean
  openDmSheet?: boolean
  openDmList?: boolean
  demoSocialOverwrite?: boolean
  centered?: boolean
  isOutro?: boolean
}

export type PulseCoachTopicMeta = {
  id: PulseCoachTopicId
  title: string
  subtitle: string
  badge: string
}

export const PULSE_APP_COACH_TARGET_ATTR = 'data-pulse-coach'
export const PULSE_APP_COACH_ROOT_ATTR = 'data-pulse-coach-root'
export const PULSE_APP_COACH_SEEN_KEY = 'lumi-pulse-coach-seen-v3'
export const PULSE_APP_START_COACH_EVENT = 'pulse-app-start-coach'

export function pulseAppCoachTargetSelector(id: PulseAppCoachTargetId): string {
  return `[${PULSE_APP_COACH_TARGET_ATTR}="${id}"]`
}

export function pulseAppCoachScopedTargetSelector(
  scopeRoot: string,
  targetId: PulseAppCoachTargetId,
): string {
  return `[${PULSE_APP_COACH_ROOT_ATTR}="${scopeRoot}"] ${pulseAppCoachTargetSelector(targetId)}`
}

export const PULSE_COACH_TOPICS: PulseCoachTopicMeta[] = [
  {
    id: 'social',
    title: '生成社交账号',
    subtitle: '粉丝 / 认证 / 重刷角色社交',
    badge: '推荐先做',
  },
  {
    id: 'trending',
    title: '生成热搜',
    subtitle: '话题数、风格、参考角色与剧情',
    badge: '舆论场',
  },
  {
    id: 'publish',
    title: '发布微博',
    subtitle: '正文、工具栏、谁可以看、发布后互动',
    badge: '发帖',
  },
  {
    id: 'dm',
    title: '私信回复',
    subtitle: '生成网友私信、发送与召唤回复',
    badge: '消息',
  },
]

/** 玩法面板常驻说明（按分区展示） */
export const PULSE_COACH_HUB_TIP_SECTIONS: Array<{
  heading: string
  tips: Array<{ title: string; body: string }>
}> = [
  {
    heading: '广场机制',
    tips: [
      {
        title: '粉丝自然增长',
        body: '生成社交账号后，用户与已有粉丝基数的角色会按真实时间缓慢涨粉：关网页也会在下次进入时补齐（最长约折算 48 小时）。体量越大绝对增量越高，相对增速会放缓。你发微博还会额外小幅涨粉；个人页「我」与底栏「我」上的 +N 角标表示这段时间新增，点掉只清提示、不扣粉丝。角色不会从 0 粉被瞎种起步，需先有社交数据。',
      },
    ],
  },
  {
    heading: '微信联动',
    tips: [
      {
        title: '微信私聊 → 角色关注你的微博',
        body: '在微信与角色私聊时，可以自然要求对方关注 / 回关你的微博。对方愿意照做时，系统会把「角色关注用户」写入微博广场（无需你在广场里手动点关注）。',
      },
      {
        title: '转发微博私信聊天记录（截图）',
        body: '想让角色把「微博私信」对话发到微信里吃瓜/举证：先打开该会话的聊天设置，开启「微博私信截图」开关。关闭则不注入该能力，也更省 token。这不是普通微信聊天记录卡片，而是微博私信 UI 截图。',
      },
    ],
  },
]

/** @deprecated 兼容旧引用；请用 PULSE_COACH_HUB_TIP_SECTIONS */
export const PULSE_COACH_HUB_TIPS = PULSE_COACH_HUB_TIP_SECTIONS.flatMap((s) => s.tips)

const SOCIAL_STEPS: PulseAppCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '生成社交账号',
    body: '没有粉丝与认证时，发帖后的互动会偏冷清。建议先走完本指引，再去发帖或演化热搜。',
  },
  {
    target: 'nav-profile',
    tab: 'profile',
    title: '打开「我」',
    body: '社交账号数据在个人页生成。点底栏「我」。',
  },
  {
    target: 'profile-social-btn',
    tab: 'profile',
    title: '点「生成社交」',
    body: '右上角金色「生成社交」打开设置面板。',
  },
  {
    target: 'social-plot-list',
    tab: 'profile',
    openSocialSheet: true,
    title: '选择剧情参考线',
    body: '单选一条绑定角色剧情作锚点，定你在这条线上的粉丝量级与认证。首次生成会一并写入通讯录角色的社交。',
  },
  {
    target: 'social-overwrite',
    tab: 'profile',
    openSocialSheet: true,
    demoSocialOverwrite: true,
    title: '重刷角色社交',
    body: '以后默认只补用户本线。要重刷角色微博昵称/粉丝/关注：打开「覆盖角色社交账号」，勾选角色后再生成。',
  },
  {
    target: 'social-generate-btn',
    tab: 'profile',
    openSocialSheet: true,
    demoSocialOverwrite: true,
    title: '确认生成',
    body: '选好剧情线（重刷时再勾角色）后点底部按钮。完成后个人页与角色主页会出现对应社交数据。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '社交指引完成',
    body: '接下来可去「生成热搜」铺舆论，或「发布微博」试互动。粉丝会随真实时间自然增长（详见玩法面板「广场机制」）；微信侧还可私聊让角色关注你的微博。',
  },
]

const TRENDING_STEPS: PulseAppCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '生成热搜',
    body: '发现页可演化话题榜 + 讨论帖 + 评论区。建议先有社交账号，舆论口吻会更贴你的公开形象。',
  },
  {
    target: 'nav-discover',
    tab: 'discover',
    title: '打开「发现」',
    body: '点底栏「发现」进入热搜榜。',
  },
  {
    target: 'discover-trending-btn',
    tab: 'discover',
    title: '点「演化新的热搜」',
    body: '打开演化面板；可反复演化，结果写入当前剧情世界。',
  },
  {
    target: 'trending-sliders',
    tab: 'discover',
    openTrendingSheet: true,
    title: '调整生成体量',
    body: '热搜话题数、每条热搜的讨论帖数、每帖评论互动条数。想快出结果先用偏小默认值。',
  },
  {
    target: 'trending-styles',
    tab: 'discover',
    openTrendingSheet: true,
    title: '风格与帖形态',
    body: '可多选讨论风格与帖形态（纯文字 / 图文 / 纯图），生成时在所选范围内混排。',
  },
  {
    target: 'trending-refs',
    tab: 'discover',
    openTrendingSheet: true,
    title: '参考角色与剧情',
    body: '可选绑定角色注入人设，并参考私聊/约会轮数或已发微博；也可写自定义要求。',
  },
  {
    target: 'trending-start',
    tab: 'discover',
    openTrendingSheet: true,
    title: '开始演化',
    body: '点「开始演化」。完成后点进某条热搜即可看讨论帖。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '热搜指引完成',
    body: '可回玩法面板选「发布微博」或「私信回复」继续。',
  },
]

const PUBLISH_STEPS: PulseAppCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '发布微博',
    body: '建议先生成社交账号再发帖，粉丝与角色互动会更自然。发帖后赞评私信会按墙钟陆续解锁。',
  },
  {
    target: 'nav-home',
    tab: 'home',
    title: '打开「首页」',
    body: '关注/推荐流在这里。右上角加号（个人页也有「+ 写微博」）可发动态。',
  },
  {
    target: 'home-publish-btn',
    tab: 'home',
    title: '点右上角发帖',
    body: '进入发布页。',
  },
  {
    target: 'publish-editor',
    tab: 'home',
    openPublishEditor: true,
    title: '写正文',
    body: '可写短句碎念；支持方括号表情、#话题#、@别人。',
  },
  {
    target: 'publish-toolbox',
    tab: 'home',
    openPublishEditor: true,
    title: '工具栏',
    body: '表情、配图、话题、@、位置、谁可以看（公开或部分可见角色）。',
  },
  {
    target: 'publish-submit',
    tab: 'home',
    openPublishEditor: true,
    title: '点「发布」',
    body: '发出后稍等互动解锁；也可进详情回复评论、召唤楼中楼接话。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '发帖指引完成',
    body: '想继续可去「私信回复」看消息页怎么聊网友。',
  },
]

const DM_STEPS: PulseAppCoachStep[] = [
  {
    target: null,
    centered: true,
    title: '私信回复',
    body: '消息页可生成网友私信，也可回复已有会话。发送后网友会 AI 接话；空内容点发送可催对方再回一条。',
  },
  {
    target: 'nav-inbox',
    tab: 'inbox',
    title: '打开「消息」',
    body: '互动通知与私信入口都在这里。',
  },
  {
    target: 'inbox-dm-entry',
    tab: 'inbox',
    title: '进入私信列表',
    body: '点「私信」一行打开会话列表。没有会话时，可先点「生成网友私信」。',
  },
  {
    target: 'inbox-dm-generate',
    tab: 'inbox',
    title: '生成网友私信',
    body: '可调会话数、风格，可选参考角色（网友跟你聊 TA）。生成后会出现在私信列表。',
  },
  {
    target: 'dm-sheet-body',
    tab: 'inbox',
    openDmSheet: true,
    title: '调整私信参数',
    body: '会话数、每会话条数、风格与参考角色。确认后开始生成。',
  },
  {
    target: null,
    tab: 'inbox',
    centered: true,
    title: '怎么回复',
    body: '点进某个网友会话：输入内容发送会自动召唤对方回复；若对方已说过话、输入框为空，点发送可再催一条回复。等待时会显示「对方正在输入…」。',
  },
  {
    target: null,
    centered: true,
    title: '和角色私聊的联动',
    body: '在微信私聊里可自然让角色关注你的微博（对方愿意时会写入广场）。若要角色把微博私信对话发到微信：打开该微信会话设置里的「微博私信截图」开关。',
  },
  {
    target: null,
    centered: true,
    isOutro: true,
    title: '私信指引完成',
    body: '玩法面板可随时重选其它指引；微信联动说明也在面板下方。',
  },
]

export const PULSE_COACH_STEPS_BY_TOPIC: Record<PulseCoachTopicId, PulseAppCoachStep[]> = {
  social: SOCIAL_STEPS,
  trending: TRENDING_STEPS,
  publish: PUBLISH_STEPS,
  dm: DM_STEPS,
}

/** @deprecated 兼容旧引用：默认拼成「社交」指引 */
export const PULSE_APP_COACH_STEPS = SOCIAL_STEPS
