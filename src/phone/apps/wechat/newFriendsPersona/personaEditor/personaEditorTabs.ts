/** 人设编辑页 Archive Index 的 8 个板块 */

export type PersonaEditTabId =
  | 'basic'
  | 'opening'
  | 'wechat'
  | 'worldbook'
  | 'network'
  | 'schedule'
  | 'worldbackground'
  | 'io'

export const PERSONA_ARCHIVE_TABS: {
  id: PersonaEditTabId
  num: string
  en: string
  zh: string
}[] = [
  { id: 'basic', num: '01', en: 'INFO', zh: '基础信息' },
  { id: 'opening', num: '02', en: 'CHAT', zh: '开场白' },
  { id: 'wechat', num: '03', en: 'WX', zh: '微信资料' },
  { id: 'worldbook', num: '04', en: 'LORE', zh: '世界书' },
  { id: 'network', num: '05', en: 'NET', zh: '人脉关系' },
  { id: 'schedule', num: '06', en: 'TIME', zh: '日程表' },
  { id: 'worldbackground', num: '07', en: 'WORLD', zh: '世界背景' },
  { id: 'io', num: '08', en: 'DATA', zh: '导入导出' },
]
