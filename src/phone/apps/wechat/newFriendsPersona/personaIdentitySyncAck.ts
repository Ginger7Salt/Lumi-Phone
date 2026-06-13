import { personaDb } from './idb'

const CLIQUE_IDENTITY_SYNC_ACK_PREFIX = 'persona-clique-identity-sync-ack-v1:'

export type CliqueIdentitySyncAck = {
  identityId: string
  identityName: string
  syncedAt: number
}

function kvKey(rootId: string): string {
  return `${CLIQUE_IDENTITY_SYNC_ACK_PREFIX}${rootId.trim()}`
}

export async function getCliqueIdentitySyncAck(rootId: string): Promise<CliqueIdentitySyncAck | null> {
  const id = rootId.trim()
  if (!id) return null
  const raw = await personaDb.getPhoneKv(kvKey(id))
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const identityId = typeof o.identityId === 'string' ? o.identityId.trim() : ''
  const identityName = typeof o.identityName === 'string' ? o.identityName.trim() : ''
  const syncedAt = typeof o.syncedAt === 'number' && Number.isFinite(o.syncedAt) ? o.syncedAt : 0
  if (!identityId || !identityName || !syncedAt) return null
  return { identityId, identityName, syncedAt }
}

export async function markCliqueIdentitySyncAck(
  rootId: string,
  identityId: string,
  identityName: string,
): Promise<void> {
  const rid = rootId.trim()
  const pid = identityId.trim()
  const name = identityName.trim()
  if (!rid || !pid || !name) return
  await personaDb.setPhoneKv(kvKey(rid), {
    identityId: pid,
    identityName: name,
    syncedAt: Date.now(),
  } satisfies CliqueIdentitySyncAck)
}

export async function clearCliqueIdentitySyncAck(rootId: string): Promise<void> {
  const id = rootId.trim()
  if (!id) return
  await personaDb.deletePhoneKv(kvKey(id))
}

/** 当前绑定身份已与最近一次 AI 同步记录一致时，检测仅看实时数据，不再对照导入归档 */
export async function isCliqueIdentitySyncAckCurrent(
  rootId: string,
  identityId: string,
  identityName: string,
): Promise<boolean> {
  const ack = await getCliqueIdentitySyncAck(rootId)
  if (!ack) return false
  return ack.identityId === identityId.trim() && ack.identityName === identityName.trim()
}
