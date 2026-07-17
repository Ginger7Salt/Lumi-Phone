import { personaDb, pullPhoneKvWithLocalStorageLegacy } from '../../phone/apps/wechat/newFriendsPersona/idb'

/** 用户主动隐藏悬浮球：刷新后仍保持隐藏，直至再次进入听一听 */
export const LISTEN_TOGETHER_FLOATING_ORB_DISMISSED_KV_KEY =
  'listen-together-floating-orb-dismissed-v1'

let cachedDismissed = false

export function getFloatingOrbDismissedSync(): boolean {
  return cachedDismissed
}

export async function hydrateFloatingOrbDismissed(): Promise<boolean> {
  const raw = await pullPhoneKvWithLocalStorageLegacy(LISTEN_TOGETHER_FLOATING_ORB_DISMISSED_KV_KEY, [])
  cachedDismissed = raw === true
  return cachedDismissed
}

export async function persistFloatingOrbDismissed(dismissed: boolean): Promise<void> {
  cachedDismissed = dismissed
  if (dismissed) {
    await personaDb.setPhoneKv(LISTEN_TOGETHER_FLOATING_ORB_DISMISSED_KV_KEY, true)
  } else {
    await personaDb.deletePhoneKv(LISTEN_TOGETHER_FLOATING_ORB_DISMISSED_KV_KEY)
  }
}
