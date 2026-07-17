import { useEffect, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  formatPlayerIdentityDisplayName,
} from '../wechat/wechatCharacterPlayerIdentity'
import { findAccountById, loadAccountsBundle } from '../wechat/wechatAccountPersistence'
import { parsePulsePovId } from './pulseTypes'
import { usePulseStore } from './usePulseStore'

/**
 * 微博侧展示：
 * - 默认昵称/头像取当前微信马甲资料（与身份扮演独立）
 * - boundIdentityLabel 为当前身份视角名，仅用于主页括号标注
 * - 实际微博昵称/头像可在 profileStats 单独覆盖
 */
export function usePulsePlayerAccount() {
  const { state } = useCustomization()
  const playerPovId = usePulseStore((s) => s.currentPlayerPovId)
  const [wechatNickname, setWechatNickname] = useState('')
  const [wechatAvatarUrl, setWechatAvatarUrl] = useState('')
  const [boundIdentityLabel, setBoundIdentityLabel] = useState('')
  /** 身份卡真实姓名（Character.name），供网友私信称呼；不等于微博/微信昵称 */
  const [identityRealName, setIdentityRealName] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const bundle = await loadAccountsBundle()
      if (cancelled) return
      const account = bundle ? findAccountById(bundle, bundle.currentAccountId) : null
      setWechatNickname(
        account?.nickname?.trim() || state.profile.displayName?.trim() || '我',
      )
      setWechatAvatarUrl(
        account?.avatarUrl?.trim() || state.profile.avatarImageUrl?.trim() || '',
      )

      const parsed = playerPovId ? parsePulsePovId(playerPovId) : null
      if (parsed?.kind === 'player' && parsed.rawId) {
        const identity = await personaDb.getPlayerIdentity(parsed.rawId)
        if (cancelled) return
        setBoundIdentityLabel(
          identity
            ? formatPlayerIdentityDisplayName(identity, parsed.rawId)
            : '',
        )
        setIdentityRealName(identity?.name?.trim() || '')
        return
      }
      if (cancelled) return
      setBoundIdentityLabel('')
      setIdentityRealName('')
    })()
    return () => {
      cancelled = true
    }
  }, [
    playerPovId,
    state.profile.avatarImageUrl,
    state.profile.displayName,
  ])

  return {
    playerPovId,
    /** @deprecated 改用 wechatNickname；兼容旧调用 */
    displayName: wechatNickname || '我',
    /** @deprecated 改用 wechatAvatarUrl */
    avatarUrl: wechatAvatarUrl || undefined,
    wechatNickname: wechatNickname || '我',
    wechatAvatarUrl: wechatAvatarUrl || undefined,
    boundIdentityLabel: boundIdentityLabel || undefined,
    /** 身份真实姓名；网友私信应以此称呼用户 */
    identityRealName: identityRealName || undefined,
  }
}
