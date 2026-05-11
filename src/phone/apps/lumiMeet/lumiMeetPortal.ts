/** 遇见 App 内 Portal 锚点，解决 Tab 内容区内 fixed 被底部导航压住的问题 */

export const LUMI_MEET_ROOT_ID = 'lumi-meet-root'

export function getLumiMeetPortalTarget(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById(LUMI_MEET_ROOT_ID)
}
