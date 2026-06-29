/**
 * 微信「个性签名」生成风格：人设 AI / 遇见九维 / 批量补全微信资料共用。
 * 目标：像真人随手改的一句状态，而非档案体、座右铭或 AI 文艺腔。
 */

/** 私聊改签名指令与批量补全时的硬上限 */
export const WECHAT_SIGNATURE_DISPLAY_MAX = 22

/** 人设 JSON 生成允许的上限（展示前仍会 clamp） */
export const WECHAT_SIGNATURE_GENERATE_MAX = 28

/** 离线/缺省兜底池：口语、留白，禁止从长档案截断 */
export const WECHAT_SIGNATURE_FALLBACK_POOL = [
  '会好 迟早',
  '随心即满分',
  '答案在明天',
  '不计划太多反而能勇敢冒险',
  '听喜欢的歌 吹傍晚的风',
  '人生嘛 捂住耳朵做自己才快乐',
  '慢热 熟了会好聊很多',
  '看见就回 没回就是在忙',
] as const

const STYLE_EXAMPLES = [
  '橙黄橘绿时',
  '会好 迟早',
  '随心即满分',
  '答案在明天',
  '生活本就应该五颜六色',
  '零碎的岛屿终会遇到海',
  '独处 是一场美丽的消耗',
  '翻篇是一种超能力',
  '自由就是不再寻求认可',
  '我与世界 就是帧帧瞬间',
  '不计划太多反而能勇敢冒险',
  '路虽远 行则将至',
  'Everything wins',
  '要自由 且随性的活着',
  '听喜欢的歌 吹傍晚的风 看太阳缓缓落下',
  '妈野 人生是矿工',
] as const

const ANTI_PATTERNS = [
  '热爱生活 / 做最好的自己 / 温柔且坚定 / 向阳而生',
  '赛博堆词：404、频段、波长、像素、光合作用、云端',
  'AI 文艺腔：劫灰、暗处的光、等你读懂我的隐喻、绝弦、青柠气泡水式长比喻',
  '把职业、MBTI、人设标签写进签名（如「INTJ 的日常」「某医生的值班日」）',
  '对读者说教或命令（你要… / 别… / 请…）',
  '网址、引流、无意义符号堆叠',
  '与 motto 座右铭雷同或互相复制',
] as const

export function pickWechatSignatureFallback(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return WECHAT_SIGNATURE_FALLBACK_POOL[h % WECHAT_SIGNATURE_FALLBACK_POOL.length]!
}

export function buildWechatSignatureAiRulesBlock(options?: {
  topLevelField?: string
  comprehensivePath?: string
  maxChars?: number
}): string {
  const top = options?.topLevelField ?? 'wechatSignature'
  const nested = options?.comprehensivePath ?? 'comprehensive.base.wechatSignature'
  const max = options?.maxChars ?? WECHAT_SIGNATURE_GENERATE_MAX
  const examples = STYLE_EXAMPLES.map((s) => `「${s}」`).join('、')

  return `【微信个性签名 · ${top} / ${nested}】
- **是什么**：微信资料里那一行极短状态，像真人随手改的；**不是**座右铭 motto、**不是** bio/档案概括、**不是**对世界书内容的缩写。
- **长度**：优先 4～15 字（含标点/空格）；最长不超过 ${max} 字；一句话，不换行，不加序号。
- **两处须完全一致**：顶层 ${top} 与 ${nested} 写**同一句**。
- **气质**：松弛留白、生活切片、小情绪、半句话、佛系摆烂、古诗一句、中英短碎片、网络口语均可；允许语病、随意感、低密度——**像朋友圈签名，不像文案策划交稿**。
- **贴合人设**：须与年龄、职业、性格、关系状态一致；年轻人可更跳脱，30+ 更克制；学生偏课业/吃喝玩乐，上班族偏摸鱼/下班/咖啡。
- **禁止**：${ANTI_PATTERNS.join('；')}。
- **风格参考（只学气质，照搬任一句视为严重违规，必须原创）**：${examples}。`
}

/** 批量「贴人设」微信资料生成器用的 signature 字段说明（JSON 键名为 signature） */
export function buildWechatProfileSignatureRulesBlock(maxChars = WECHAT_SIGNATURE_DISPLAY_MAX): string {
  const core = buildWechatSignatureAiRulesBlock({ maxChars })
  return core.replace(
    /【微信个性签名 · wechatSignature \/ comprehensive\.base\.wechatSignature】/,
    '【微信 signature 字段】',
  ).replace(
    '- **两处须完全一致**：顶层 wechatSignature 与 comprehensive.base.wechatSignature 写**同一句**。',
    '- 输出到 JSON 的 **signature** 字段（单字符串，禁止候选/编号/多版本）。',
  )
}
