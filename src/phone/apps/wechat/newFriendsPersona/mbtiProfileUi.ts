/** MBTI 形象图与四字概括，供档案页等复用（与项目根 image/MBTI人格形象图 一致） */

const MBTI_IMAGE_URLS = import.meta.glob('../../../../../image/MBTI人格形象图/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

export function resolveMbtiImageUrl(mbti: string): string {
  const key = (mbti || '').trim().toUpperCase()
  if (!key) return ''
  for (const [path, url] of Object.entries(MBTI_IMAGE_URLS)) {
    const name = path.split('/').pop() || ''
    if (name.toUpperCase().startsWith(key)) return url
  }
  return ''
}

/** 部分原图留白少，略放大避免显得过小 */
export function isLargeMbtiAvatar(mbti?: string): boolean {
  const key = String(mbti || '').trim().toUpperCase()
  return key === 'ISFJ' || key === 'ENTJ'
}

/** 各类型人格速写（约二十字，人设档案与身份卡等处共用） */
export const MBTI_SUMMARY_4: Record<string, string> = {
  INTJ: '善长远规划，喜独立思考，常以逻辑与效率把目标落到实地。',
  INTP: '热衷追问「为什么」，擅长抽象建模，爱在思辨里逼近真相。',
  ENTJ: '目标感强敢拍板，善于带队攻坚，习惯掌控节奏直至结果。',
  ENTP: '机敏爱辩、点子多，敢挑战常规，在碰撞与试错里找新解。',
  INFJ: '共情却内敛，看重内在意义，愿在不张扬里默默托举他人成长。',
  INFP: '温柔而有立场，重视真诚与感受，常以创作安放内心世界。',
  ENFJ: '热情善解人意，善于鼓舞人心，常凝聚众人朝愿景前行。',
  ENFP: '热情洋溢、意象丰盈，不喜死板拘束，爱连结人与各种可能。',
  ISTJ: '靠谱守信重规矩，做事条理分明，是值得托付的执行担当。',
  ISFJ: '安静体贴少张扬，默默关照身边人，给人稳稳的安全感。',
  ESTJ: '务实果断讲秩序，长于分工落地，能把安排一步步压实。',
  ESFJ: '热心周到重和睦，爱张罗氛围与人情，照顾大家的感受。',
  ISTP: '遇事冷静话不多，动手能力强，偏好眼见为实的解法。',
  ISFP: '敏感随性审美在线，温和内敛，活在当下里的体验派。',
  ESTP: '反应迅捷敢冒险，擅长临场应变，享受挑战与即时掌控。',
  ESFP: '外向乐天善交际，爱热闹也爱即兴，常是气氛与行动力担当。',
}
