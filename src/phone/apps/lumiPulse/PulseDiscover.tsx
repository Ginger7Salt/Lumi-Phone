import { AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
} from '../wechat/wechatConversationKey'
import { buildTrendingRefContext } from './buildTrendingRefContext'
import { buildTrendingPulsePostsRef } from './buildTrendingPulsePostsRef'
import { PulseUserProfileView } from './components/PulseUserProfileView'
import { PulseVerifiedAvatar } from './components/PulseVerifiedAvatar'
import { PulseWeiboFaceText } from './components/PulseWeiboFaceText'
import { aiGeneratePulseTrending } from './lumiPulseAi'
import { loadPulsePlayerIdentityPersonaContext } from './pulseProfilePersona'
import type {
  PulseFollowingUser,
  PulsePovOption,
  PulseProfileStats,
  PulseTrendingTopic,
} from './pulseTypes'
import { parsePulsePovId, toCharPovId } from './pulseTypes'
import {
  usePulseDiscoverPosts,
  usePulseFollowingList,
  usePulseProfileStatsByPov,
  usePulseTrendingTopics,
} from './pulseStoreSelectors'
import { loadPulseMentionDirectory } from './usePulseMentionDirectory'
import { usePulsePlayerAccount } from './usePulsePlayerAccount'
import { usePulseStore } from './usePulseStore'
import { TrendingBoard } from './TrendingBoard'
import {
  TrendingGenerateSheet,
  type TrendingGenerateSettings,
  type TrendingRefCharacterOption,
} from './TrendingGenerateSheet'

/** 剧情参考：当前身份已绑定的通讯录角色（排除 Lumi / 本人） */
function isTrendingRefContactEligible(contact: {
  id?: string
  characterId?: string
  remarkName?: string
}): boolean {
  const cid = contact.characterId?.trim() ?? ''
  if (!cid) return false
  if (cid === WECHAT_LUMI_PEER_CHARACTER_ID || cid === WECHAT_SELF_PEER_CHARACTER_ID) return false
  const rowId = contact.id?.trim() ?? ''
  if (rowId === WECHAT_LUMI_PEER_CHARACTER_ID || rowId === WECHAT_SELF_PEER_CHARACTER_ID) return false
  const name = (contact.remarkName ?? '').trim()
  if (/^lumi\b/i.test(name) && /助手/.test(name)) return false
  if (name === 'Lumi' || name === 'lumi助手' || name === 'Lumi助手') return false
  return true
}

function enrichFollowingUser(
  user: PulseFollowingUser,
  options: PulsePovOption[],
  statsByPov?: Record<string, PulseProfileStats>,
): PulseFollowingUser {
  const opt = options.find((o) => o.povId === user.povId)
  const weibo = statsByPov?.[user.povId]?.weiboNickname?.trim()
  const verify = statsByPov?.[user.povId]?.verifyLabel?.trim()
  return {
    ...user,
    name: weibo || user.name || opt?.label || '未命名',
    wechatNickname: user.wechatNickname || opt?.label,
    avatarUrl: opt?.avatarUrl || user.avatarUrl,
    bio: verify || user.bio || opt?.identity?.trim(),
    verified: true,
  }
}

function povOptionToUser(
  opt: PulsePovOption,
  statsByPov?: Record<string, PulseProfileStats>,
): PulseFollowingUser {
  const weibo = statsByPov?.[opt.povId]?.weiboNickname?.trim()
  const verify = statsByPov?.[opt.povId]?.verifyLabel?.trim()
  return {
    povId: opt.povId,
    name: weibo || opt.label,
    wechatNickname: opt.label,
    avatarUrl: opt.avatarUrl,
    bio: verify || opt.identity?.trim() || undefined,
    verified: true,
  }
}

export function PulseDiscover({
  povName,
  currentWorldId,
  currentPlayerPovId,
  povOptions,
  onOpenTopic,
  onOpenPost,
  onRepostPost,
  coachOpenTrendingSheet = false,
  onStartCoach,
}: {
  povName: string
  currentWorldId: string
  currentPlayerPovId: string
  povOptions: PulsePovOption[]
  onOpenTopic: (topic: PulseTrendingTopic) => void
  onOpenPost: (postId: string) => void
  onRepostPost: (postId: string) => void
  /** 玩法引导：强制打开演化热搜面板 */
  coachOpenTrendingSheet?: boolean
  onStartCoach?: () => void
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const { state } = useCustomization()
  const { wechatNickname, boundIdentityLabel } = usePulsePlayerAccount()
  const trending = usePulseTrendingTopics()
  const allPosts = usePulseDiscoverPosts()
  const following = usePulseFollowingList(currentPlayerPovId)
  const statsByPov = usePulseProfileStatsByPov()
  const ingestTrendingBundle = usePulseStore((s) => s.ingestTrendingBundle)
  const identityVisibleCharPovIds = usePulseStore((s) => s.identityVisibleCharPovIds)

  const playerWeiboName =
    statsByPov[currentPlayerPovId]?.weiboNickname?.trim() || wechatNickname.trim() || '我'
  const playerIdentityId = parsePulsePovId(currentPlayerPovId)?.rawId?.trim() || ''
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [openUser, setOpenUser] = useState<PulseFollowingUser | null>(null)
  const prevCoachTrendingOpen = useRef(false)

  useEffect(() => {
    if (coachOpenTrendingSheet && !prevCoachTrendingOpen.current) {
      setSheetOpen(true)
    } else if (!coachOpenTrendingSheet && prevCoachTrendingOpen.current) {
      if (!loading) setSheetOpen(false)
    }
    prevCoachTrendingOpen.current = coachOpenTrendingSheet
  }, [coachOpenTrendingSheet, loading])

  const boundCharSet = useMemo(
    () => (identityVisibleCharPovIds ? new Set(identityVisibleCharPovIds) : null),
    [identityVisibleCharPovIds],
  )

  /** 仅当前身份视角绑定的角色（同人脉隔离规则） */
  const refCharacterOptions = useMemo((): TrendingRefCharacterOption[] => {
    const seen = new Set<string>()
    const rows: TrendingRefCharacterOption[] = []
    for (const c of state.wechatPersonaContacts) {
      if (!isTrendingRefContactEligible(c)) continue
      const characterId = c.characterId.trim()
      if (seen.has(characterId)) continue
      const povId = toCharPovId(characterId)
      if (boundCharSet && !boundCharSet.has(povId)) continue
      seen.add(characterId)
      const opt = povOptions.find((o) => o.povId === povId)
      rows.push({
        characterId,
        name: c.remarkName?.trim() || opt?.label || '未命名',
        avatarUrl: opt?.avatarUrl || c.avatarUrl,
        subtitle: opt?.identity?.trim() || opt?.worldName?.trim() || '已绑定本身份',
      })
    }
    return rows
  }, [boundCharSet, povOptions, state.wechatPersonaContacts])

  const defaultRefCharacterId = useMemo(() => {
    const worldCid = parsePulsePovId(currentWorldId)?.rawId?.trim()
    if (worldCid && refCharacterOptions.some((o) => o.characterId === worldCid)) return worldCid
    return refCharacterOptions[0]?.characterId
  }, [currentWorldId, refCharacterOptions])

  const q = query.trim().toLowerCase()

  const matchedCharacters = useMemo(() => {
    if (!q) return [] as PulseFollowingUser[]
    const byId = new Map<string, PulseFollowingUser>()

    for (const opt of povOptions) {
      const weibo = statsByPov[opt.povId]?.weiboNickname?.trim() || ''
      const hit =
        opt.label.toLowerCase().includes(q) ||
        weibo.toLowerCase().includes(q) ||
        (opt.identity?.toLowerCase().includes(q) ?? false)
      if (!hit) continue
      byId.set(opt.povId, povOptionToUser(opt, statsByPov))
    }

    for (const u of following) {
      const enriched = enrichFollowingUser(u, povOptions, statsByPov)
      const hit =
        enriched.name.toLowerCase().includes(q) ||
        (enriched.wechatNickname?.toLowerCase().includes(q) ?? false)
      if (!hit) continue
      if (!byId.has(enriched.povId)) byId.set(enriched.povId, enriched)
    }

    return [...byId.values()]
  }, [q, povOptions, following, statsByPov])

  const filteredPosts = useMemo(() => {
    if (!q) return []
    return allPosts.filter(
      (p) => p.authorName.toLowerCase().includes(q) || p.content.toLowerCase().includes(q),
    )
  }, [q, allPosts])

  const generate = useCallback(
    async (settings: TrendingGenerateSettings) => {
      setLoading(true)
      try {
        const idSet = new Set(settings.refCharacterIds.map((id) => id.trim()).filter(Boolean))
        const refCharacters = refCharacterOptions
          .filter((o) => idSet.has(o.characterId))
          .map((o) => ({ characterId: o.characterId, name: o.name }))

        let povContext = ''
        if (refCharacters.length) {
          povContext = await buildTrendingRefContext({
            refCharacters,
            chatRefRounds: settings.chatRefRounds,
            datingRefRounds: settings.datingRefRounds,
            includePlayerIdentity: settings.includePlayerIdentity,
          })
        } else if (settings.includePlayerIdentity && playerIdentityId) {
          // 不选参考角色：只注入用户本人身份（与私信生成一致）
          povContext = await loadPulsePlayerIdentityPersonaContext(playerIdentityId)
        }

        const pulsePostsRef = buildTrendingPulsePostsRef({
          enabled: settings.refPulsePostsEnabled,
          playerPovId:
            settings.includePlayerIdentity && settings.playerPulsePostRefCount > 0
              ? currentPlayerPovId
              : null,
          playerDisplayName: playerWeiboName,
          playerPostCount: settings.playerPulsePostRefCount,
          characterIds: refCharacters,
          charPostCount: settings.charPulsePostRefCount,
        })
        if (pulsePostsRef) {
          povContext = [povContext, pulsePostsRef].filter(Boolean).join('\n\n——\n\n')
        }

        const worldCid = parsePulsePovId(currentWorldId)?.rawId?.trim()
        const mentionDirectory = await loadPulseMentionDirectory({
          characterIds: [
            ...refCharacters.map((c) => c.characterId),
            ...(worldCid ? [worldCid] : []),
            ...povOptions.map((o) => o.rawId),
          ],
          ...(settings.includePlayerIdentity
            ? {
                playerDisplayName: playerWeiboName,
                playerIdentityId,
                playerAliases: [
                  wechatNickname,
                  boundIdentityLabel,
                  playerWeiboName,
                  '用户',
                  '玩家',
                  '你',
                ].filter((x): x is string => Boolean(x?.trim())),
              }
            : {}),
        })
        const mentionTargets = [
          ...new Set(
            [
              ...(settings.includePlayerIdentity ? [playerWeiboName] : []),
              ...mentionDirectory.map((e) => e.nickname),
            ]
              .map((n) => n.trim())
              .filter(Boolean),
          ),
        ]
        const bundles = await aiGeneratePulseTrending({
          apiConfig,
          povName,
          povContext,
          count: settings.topicCount,
          postsPerTopic: settings.postsPerTopic,
          style: settings.styles[0] ?? 'mixed',
          styles: settings.styles,
          customRequirements: settings.customRequirements,
          commentsPerPost: settings.commentsPerPost,
          postKinds: settings.postKinds,
          mentionTargets,
          playerDisplayName: settings.includePlayerIdentity ? playerWeiboName : undefined,
          includePlayerIdentity: settings.includePlayerIdentity,
        })
        const topics = ingestTrendingBundle({
          forPovId: currentWorldId,
          bundles,
          playerMentionAliases: settings.includePlayerIdentity
            ? [playerWeiboName, wechatNickname].filter(Boolean)
            : [],
          mentionDirectory,
        })
        if (!topics.length) throw new Error('生成失败：未能写入热搜')
        setSheetOpen(false)
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '生成失败')
      } finally {
        setLoading(false)
      }
    },
    [
      apiConfig,
      boundIdentityLabel,
      currentPlayerPovId,
      currentWorldId,
      ingestTrendingBundle,
      playerIdentityId,
      playerWeiboName,
      povName,
      povOptions,
      refCharacterOptions,
      wechatNickname,
    ],
  )

  const searching = Boolean(q)

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FCFCFC]">
      <div className="shrink-0 px-4 pb-3 pt-2">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-gray-100/50 px-3.5 py-2.5">
            <Search className="size-4 text-neutral-400" strokeWidth={1.4} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索角色姓名、动态或关键词..."
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#1C1C1E] outline-none placeholder:text-neutral-400"
            />
          </div>
          {onStartCoach ? (
            <Pressable
              type="button"
              onClick={onStartCoach}
              className="shrink-0 rounded-full bg-white px-2.5 py-2 text-[11px] tracking-wide text-neutral-500 shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
              aria-label="玩法指引"
            >
              玩法
            </Pressable>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
        {searching ? (
          <div className="space-y-5">
            <section>
              <p className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-neutral-400">角色</p>
              {matchedCharacters.length ? (
                <div className="space-y-2">
                  {matchedCharacters.map((user) => {
                    return (
                      <Pressable
                        key={user.povId}
                        type="button"
                        onClick={() => setOpenUser(user)}
                        className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
                      >
                        <PulseVerifiedAvatar
                          src={user.avatarUrl}
                          verified={Boolean(user.verified)}
                          sizeClass="size-12"
                          borderClass="ring-1 ring-black/[0.04]"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium text-[#1C1C1E]">
                            {user.name}
                          </span>
                          <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                            {user.bio?.trim() || '点击进入微博主页'}
                          </p>
                        </div>
                      </Pressable>
                    )
                  })}
                </div>
              ) : (
                <p className="py-4 text-center text-[12px] text-neutral-400">未匹配到角色</p>
              )}
            </section>

            <section>
              <p className="mb-2.5 text-[11px] uppercase tracking-[0.2em] text-neutral-400">动态</p>
              {filteredPosts.length ? (
                <div className="space-y-2">
                  {filteredPosts.map((p) => (
                    <Pressable
                      key={p.id}
                      type="button"
                      onClick={() => onOpenPost(p.id)}
                      className="w-full rounded-2xl bg-white px-4 py-3 text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)]"
                    >
                      <p className="text-[13px] font-medium text-[#1C1C1E]">{p.authorName}</p>
                      <p className="mt-1 line-clamp-2 font-serif text-[13px] leading-relaxed text-neutral-600">
                        <PulseWeiboFaceText text={p.content} />
                      </p>
                    </Pressable>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-[12px] text-neutral-400">未找到相关动态</p>
              )}
            </section>
          </div>
        ) : (
          <TrendingBoard
            trending={trending}
            loading={loading}
            onGenerate={() => setSheetOpen(true)}
            onOpenTopic={onOpenTopic}
          />
        )}
      </div>

      <TrendingGenerateSheet
        open={sheetOpen}
        loading={loading}
        onClose={() => setSheetOpen(false)}
        onConfirm={(settings) => void generate(settings)}
        refCharacterOptions={refCharacterOptions}
        defaultRefCharacterId={defaultRefCharacterId}
      />

      <AnimatePresence>
        {openUser ? (
          <PulseUserProfileView
            user={openUser}
            currentPlayerPovId={currentPlayerPovId}
            onBack={() => setOpenUser(null)}
            onOpenPost={onOpenPost}
            onRepostPost={onRepostPost}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
