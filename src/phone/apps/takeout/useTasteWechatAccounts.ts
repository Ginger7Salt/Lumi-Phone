import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import type { WeChatPersonaContact } from '../../types'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  migrateAllLegacyWeChatConversationsToAccountScope,
  repairSplitPrivateChatHistoriesForWechatAccount,
} from '../wechat/wechatAccountPrivateChatStorage'
import {
  cloneAccount,
  findAccountById,
  loadAccountsBundle,
  loadLegacyProfileOnly,
  migrateLegacyProfileToBundle,
  resolveAccountSessionIdentityId,
  saveAccountsBundle,
} from '../wechat/wechatAccountPersistence'
import { filterPersonaContactsForWechatAccount } from '../wechat/wechatPersonaContactsSync'
import { accountToProfile, type UserAccount } from '../wechat/wechatAccountTypes'

function syncProfileFromAccount(
  account: UserAccount,
  setProfile: (patch: Partial<import('../../types').Profile>) => void,
) {
  const p = accountToProfile(account)
  const nick = p.nickname.trim()
  setProfile({
    displayName: nick || '未命名',
    signature: p.signature?.trim() ?? '',
    avatarImageUrl: p.avatarUrl.trim(),
    avatarEmoji: nick.slice(0, 1) || '微',
  })
}

export function useTasteWechatAccounts() {
  const { state, setProfile, setWeChatPersonaContacts } = useCustomization()
  const [accounts, setAccounts] = useState<UserAccount[]>([])
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    let bundle = await loadAccountsBundle()
    if (!bundle) {
      const legacy = await loadLegacyProfileOnly()
      if (legacy) {
        bundle = await migrateLegacyProfileToBundle(legacy, state.wechatPersonaContacts)
      }
    }
    if (bundle) {
      setAccounts(bundle.accounts.map(cloneAccount))
      setCurrentAccountId(bundle.currentAccountId)
    } else {
      setAccounts([])
      setCurrentAccountId(null)
    }
    setHydrated(true)
  }, [state.wechatPersonaContacts])

  useEffect(() => {
    void refresh()
    const onStorage = () => {
      void refresh()
    }
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => window.removeEventListener('wechat-storage-changed', onStorage)
  }, [refresh])

  const switchAccount = useCallback(
    async (accountId: string) => {
      const outgoingId = currentAccountId?.trim()
      if (!outgoingId || switchingId || accountId === outgoingId) return

      let bundle = await loadAccountsBundle()
      if (!bundle) return
      const target = findAccountById(bundle, accountId)
      if (!target) return

      setSwitchingId(accountId)
      try {
        const snap: WeChatPersonaContact[] = state.wechatPersonaContacts.map((c) => ({ ...c }))
        const nextAccounts = bundle.accounts.map((a) => {
          if (a.accountId === outgoingId) {
            return { ...cloneAccount(a), personaContacts: snap, lastActive: Date.now() }
          }
          if (a.accountId === accountId) {
            return { ...cloneAccount(a), lastActive: Date.now() }
          }
          return cloneAccount(a)
        })
        const nextBundle = { accounts: nextAccounts, currentAccountId: accountId }
        await saveAccountsBundle(nextBundle)

        const fresh = findAccountById(nextBundle, accountId)!
        const primaryId = nextAccounts[0]?.accountId
        const contacts = await filterPersonaContactsForWechatAccount(
          fresh.personaContacts,
          fresh,
          primaryId,
        )

        setWeChatPersonaContacts(contacts.map((c) => ({ ...c })))
        syncProfileFromAccount(fresh, setProfile)

        const sessionId = resolveAccountSessionIdentityId(fresh)
        if (sessionId) {
          await personaDb.setCurrentIdentityId(sessionId)
          await migrateAllLegacyWeChatConversationsToAccountScope({
            wechatAccountId: fresh.accountId,
            appSessionPlayerIdentityId: sessionId,
          })
          await repairSplitPrivateChatHistoriesForWechatAccount(fresh.accountId)
        }

        setAccounts(nextAccounts.map(cloneAccount))
        setCurrentAccountId(accountId)
      } finally {
        setSwitchingId(null)
      }
    },
    [currentAccountId, setProfile, setWeChatPersonaContacts, state.wechatPersonaContacts, switchingId],
  )

  const currentAccount = useMemo(
    () => accounts.find((a) => a.accountId === currentAccountId) ?? null,
    [accounts, currentAccountId],
  )

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => b.lastActive - a.lastActive),
    [accounts],
  )

  return {
    accounts: sortedAccounts,
    currentAccount,
    currentAccountId,
    hydrated,
    switchingId,
    switchAccount,
  }
}
