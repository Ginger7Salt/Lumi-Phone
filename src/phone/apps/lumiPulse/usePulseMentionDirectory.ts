import { useEffect, useMemo, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import type { PulseMentionDirectoryEntry } from './pulseMentionExpr'
import { pulseCharacterWeiboNickname } from './pulseMentionExpr'
import type { PulsePovOption } from './pulseTypes'
import { toCharPovId, toPlayerPovId } from './pulseTypes'
import { usePulseProfileStatsByPov } from './pulseStoreSelectors'
import { usePulsePlayerAccount } from './usePulsePlayerAccount'
import { usePulsePovOptions } from './usePulsePovOptions'

/**
 * 微博艾特目录：当前角色昵称 + 玩家微博昵称。
 * 用于展示解析、入库改写、发布插入表达式。
 */
export function usePulseMentionDirectory(
  povOptionsOverride?: PulsePovOption[],
): PulseMentionDirectoryEntry[] {
  const { options: hookOptions } = usePulsePovOptions()
  const povOptions = povOptionsOverride ?? hookOptions
  const { state } = useCustomization()
  const { displayName: playerDisplayName, playerPovId } = usePulsePlayerAccount()
  const statsByPov = usePulseProfileStatsByPov()
  const [extraByCharId, setExtraByCharId] = useState<
    Record<string, { nickname: string; aliases: string[] }>
  >({})

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const ids = [
        ...new Set([
          ...povOptions.map((o) => o.rawId),
          ...state.wechatPersonaContacts.map((c) => c.characterId.trim()).filter(Boolean),
        ]),
      ]
      const next: Record<string, { nickname: string; aliases: string[] }> = {}
      await Promise.all(
        ids.map(async (id) => {
          const ch = await personaDb.getCharacter(id)
          if (!ch) return
          const nickname = pulseCharacterWeiboNickname(ch)
          const aliases = [ch.wechatNickname, ch.name]
            .map((x) => x?.trim() || '')
            .filter(Boolean)
          const contact = state.wechatPersonaContacts.find((c) => c.characterId.trim() === id)
          const remark = contact?.remarkName?.trim()
          if (remark) aliases.push(remark)
          next[id] = { nickname, aliases: [...new Set(aliases)] }
        }),
      )
      if (!cancelled) setExtraByCharId(next)
    })()
    return () => {
      cancelled = true
    }
  }, [povOptions, state.wechatPersonaContacts])

  return useMemo(() => {
    const rows: PulseMentionDirectoryEntry[] = []
    const seen = new Set<string>()

    for (const opt of povOptions) {
      const extra = extraByCharId[opt.rawId]
      const storedWeibo = statsByPov[opt.povId]?.weiboNickname?.trim()
      const nickname = storedWeibo || extra?.nickname || opt.label
      const aliases = [
        ...(extra?.aliases?.length ? extra.aliases : [opt.label]),
        extra?.nickname,
        opt.label,
      ].filter(Boolean) as string[]
      if (seen.has(opt.povId)) continue
      seen.add(opt.povId)
      rows.push({ povId: opt.povId, nickname, aliases: [...new Set(aliases)] })
    }

    for (const [charId, extra] of Object.entries(extraByCharId)) {
      const povId = toCharPovId(charId)
      if (seen.has(povId)) continue
      seen.add(povId)
      const storedWeibo = statsByPov[povId]?.weiboNickname?.trim()
      rows.push({
        povId,
        nickname: storedWeibo || extra.nickname,
        aliases: [...new Set([extra.nickname, ...extra.aliases].filter(Boolean))],
      })
    }

    if (playerPovId) {
      const playerWeibo = statsByPov[playerPovId]?.weiboNickname?.trim()
      const nickname = playerWeibo || playerDisplayName.trim() || '我'
      rows.push({
        povId: playerPovId,
        nickname,
        aliases: [
          ...new Set(
            [playerDisplayName, playerWeibo, nickname, '我']
              .map((x) => x?.trim() || '')
              .filter(Boolean),
          ),
        ],
      })
    }

    return rows
  }, [extraByCharId, playerDisplayName, playerPovId, povOptions, statsByPov])
}

/** 异步构建目录（热搜入库等非 React 路径） */
export async function loadPulseMentionDirectory(params: {
  characterIds: string[]
  /** 微博展示昵称（优先 weiboNickname，其次微信昵称） */
  playerDisplayName?: string
  /** 必须传入当前微博视角的玩家身份 id，勿用微信账号槽位兜底错位 */
  playerIdentityId?: string
  /** 额外别名：微信昵称、身份名等，便于 AI 正文回收成表达式 */
  playerAliases?: string[]
}): Promise<PulseMentionDirectoryEntry[]> {
  const rows: PulseMentionDirectoryEntry[] = []
  const seen = new Set<string>()

  for (const id of [...new Set(params.characterIds.map((x) => x.trim()).filter(Boolean))]) {
    const ch = await personaDb.getCharacter(id)
    if (!ch) continue
    const povId = toCharPovId(id)
    if (seen.has(povId)) continue
    seen.add(povId)
    const nickname = pulseCharacterWeiboNickname(ch)
    rows.push({
      povId,
      nickname,
      aliases: [...new Set([ch.wechatNickname, ch.name].map((x) => x?.trim() || '').filter(Boolean))],
    })
  }

  const playerId = params.playerIdentityId?.trim() || ''
  const nick = params.playerDisplayName?.trim()
  if (playerId && nick) {
    const aliases = [
      nick,
      ...(params.playerAliases ?? []).map((a) => a.trim()).filter(Boolean),
    ]
    rows.push({
      povId: toPlayerPovId(playerId),
      nickname: nick,
      aliases: [...new Set(aliases)],
    })
  }

  return rows
}
