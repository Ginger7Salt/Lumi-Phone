import type { Gender } from './types'

/** AI 生成角色 · 用户填写面板 */
export type PersonaAiGenerateForm = {
  /** 真实姓名；留空则由 AI 生成 */
  nameHint: string
  /** 头像 dataURL 或 URL；留空则不生成分配头像 */
  avatarUrl: string
  gender: Gender
  /** 年龄描述，如「25岁」「20-28岁」 */
  ageHint: string
  /** 职业 / 社会身份方向 */
  occupationHint: string
  /** 外貌 / 形象方向 */
  appearanceHint: string
  /** MBTI 四字母；空串 = 交给 AI；「不限」同空 */
  mbtiHint: string
  /** 性格关键词、气质 */
  personalityKeywords: string
  /** 社交面具一句话（对外 vs 私下反差） */
  socialMaskHint: string
  /** 身世 / 背景梗（1–3 句种子） */
  backgroundHint: string
  /** 兴趣爱好（写入 vol04 爱好 + 顶层 interests） */
  hobbiesHint: string
  /** 生活小习惯：烟酒、作息、洁癖等（写入 vol08 日常习惯/怪癖） */
  lifeHabitsHint: string
  /** 与 {{user}} 的关系设定 */
  relationToUser: string
  /** 开局关系细节（认识方式、最近互动等） */
  relationDetailHint: string
  /** 过往感情史（写入 psyche.background / vol07 恋爱前反差） */
  relationshipHistoryHint: string
  /** 恋爱 / 亲密态度方向 */
  loveAttitudeHint: string
  /** 恋爱前 / 恋爱后 / 吵架和好表现种子（写入 vol07 contrast） */
  loveContrastHint: string
  /** 角色本人通用口语 / 口头禅习惯（写入 vol08，非对 {{user}} 专属） */
  speechStyleHint: string
  /** 性取向；空或「不限」= 交给 AI */
  orientationHint: string
  /** true = vol03「取向与自我认同」改为尾声延展，可随剧情更新 */
  orientationMutable: boolean
  /** 开启成人向（NSFW）档案扩写 */
  nsfwEnabled: boolean
  /** 亲密/成人向偏好种子（仅 nsfwEnabled 时生效） */
  nsfwHint: string
  /** 补充说明（题材、禁忌、参考气质等） */
  extraNotes: string
}

export const PERSONA_AI_RELATION_PRESETS = [
  '陌生人 · 刚认识',
  '同学 / 同事',
  '朋友 · 常聊',
  '暧昧 / 试探中',
  '恋人 / 稳定交往',
  '前任 · 仍有牵扯',
  '上司 / 下属',
  '家人 / 亲戚',
] as const

export const PERSONA_AI_PERSONALITY_PRESETS = [
  '温柔内敛',
  '高冷毒舌',
  '阳光社牛',
  '慢热文艺',
  '腹黑克制',
  '直球热烈',
  '理性可靠',
  '傲娇嘴硬',
] as const

/** 对外展示 vs 私下真实 · 写入 core.surface / core.trueSelf 反差种子 */
export const PERSONA_AI_SOCIAL_MASK_PRESETS = [
  '对外礼貌疏离 · 私下话多毒舌',
  '对外高冷禁欲 · 私下软萌黏人',
  '对外社牛健谈 · 私下其实社疲',
  '对外温和可靠 · 私下情绪易爆',
  '对外完美学霸 · 私下摆烂犯浑',
  '对外精英体面 · 私下爱拆台',
  '对外开朗爱笑 · 私下敏感多思',
  '对外克制距离 · 私下占有欲强',
] as const

export const PERSONA_AI_OCCUPATION_PRESETS = [
  '外科医生',
  '律所律师',
  '独立插画师',
  '咖啡店老板',
  '大学讲师',
  '品牌策划',
  '自由摄影师',
  '急诊护士',
] as const

export const PERSONA_AI_APPEARANCE_PRESETS = [
  '清冷系 · 短发',
  '港风 · 爱穿黑',
  '软萌 · 齐刘海',
  '干练 · 西装感',
  '文艺 · 宽松穿搭',
  '运动 · 清爽阳光',
] as const

export const PERSONA_AI_BACKGROUND_PRESETS = [
  '小镇出来打拼',
  '单亲家庭长大',
  '留学归来',
  '转行二次起步',
  '家里期望很高',
  '曾经历重大挫折',
] as const

export const PERSONA_AI_HOBBIES_PRESETS = [
  '宅家追剧、打游戏',
  '跑步、健身',
  '摄影、扫街',
  '烘焙、下厨',
  '听歌、Livehouse',
  '画画、手工',
  '阅读、写作',
  '养猫、遛狗',
] as const

export const PERSONA_AI_LIFE_HABITS_PRESETS = [
  '不抽烟、不喝酒',
  '偶尔小酌',
  '社交才喝酒',
  '烟民但量少',
  '咖啡依赖',
  '熬夜党',
  '早起星人',
  '轻度洁癖',
] as const

export const PERSONA_AI_RELATIONSHIP_HISTORY_PRESETS = [
  '暂无恋爱经历',
  '谈过一段，和平分手',
  '被伤到，现在慢热',
  '有过暧昧没成',
  '前任仍有联系',
  '大学恋情最刻骨铭心',
  '长期单身，不急',
] as const

export const PERSONA_AI_LOVE_ATTITUDE_PRESETS = [
  '慢热试探',
  '直球但怕受伤',
  '嘴硬心软',
  '边界感强',
  '占有欲克制',
  '已恋爱 · 稳定',
  '暂无恋爱意向',
] as const

export const PERSONA_AI_LOVE_CONTRAST_PRESETS = [
  '恋爱前冷 · 恋爱后黏',
  '恋爱前嘴硬 · 恋爱后撒娇',
  '恋爱前疏离 · 恋爱后直球',
  '吵架先冷战 · 后会哄',
  '吃醋但不承认',
  '稳定后反而更克制',
] as const

export const PERSONA_AI_SPEECH_STYLE_PRESETS = [
  '说话短 · 少 emoji',
  '爱用省略号',
  '偶尔毒舌',
  '温柔耐心',
  '偶尔方言词',
  '话多爱分享',
] as const

export const PERSONA_AI_MBTI_ANY = '不限'

export const PERSONA_AI_ORIENTATION_ANY = '不限'

export const PERSONA_AI_ORIENTATION_PRESETS = [
  '异性恋',
  '同性恋',
  '双性恋 / 泛性恋',
  '无性恋',
  '探索中 / 未明确',
] as const

export const PERSONA_AI_NSFW_PRESETS = [
  '慢热羞涩',
  '主动热情',
  '温柔引导型',
  '占有欲强',
  '嘴硬身体诚实',
  '重氛围轻尺度',
] as const

export function emptyPersonaAiGenerateForm(): PersonaAiGenerateForm {
  return {
    nameHint: '',
    avatarUrl: '',
    gender: 'female',
    ageHint: '',
    occupationHint: '',
    appearanceHint: '',
    mbtiHint: '',
    personalityKeywords: '',
    socialMaskHint: '',
    backgroundHint: '',
    hobbiesHint: '',
    lifeHabitsHint: '',
    relationToUser: '',
    relationDetailHint: '',
    relationshipHistoryHint: '',
    loveAttitudeHint: '',
    loveContrastHint: '',
    speechStyleHint: '',
    orientationHint: '',
    orientationMutable: false,
    nsfwEnabled: false,
    nsfwHint: '',
    extraNotes: '',
  }
}
