import { AnimatePresence } from 'framer-motion'
import { AtSign, ChevronRight, Heart, MessageCircle, Repeat2, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
} from '../wechat/wechatConversationKey'
import { buildTrendingRefContext } from './buildTrendingRefContext'
import {
  DmGenerateSheet,
  type DmGenerateSettings,
} from './components/DmGenerateSheet'
import { NotificationCell } from './components/NotificationCell'
import { PulseInboxList } from './components/PulseInboxList'
import { PulseNumericText } from './components/PulseNum'
import { PulseVerifiedAvatar } from './components/PulseVerifiedAvatar'
import { PulseWeiboFaceText } from './components/PulseWeiboFaceText'
import { PULSE_COLORS } from './constants'
import { aiGeneratePulseDmThreads, flatToDmThreads } from './lumiPulseAi'
import {
  pickStablePulseNetizenAvatarPath,
  resolvePulseAuthorAvatarUrl,
} from './pulseNetizenAvatar'
import { loadPulsePlayerIdentityPersonaContext } from './pulseProfilePersona'
import type { PulseInteraction } from './pulseTypes'
import { parsePulsePovId, toCharPovId } from './pulseTypes'
import { usePulseEngagementClock } from './pulseEngagementUnlock'
import {
  usePulseProfileStatsByPov,
  useUnlockedPulseDmThreads,
  useUnlockedPulseInteractions,
} from './pulseStoreSelectors'
import type { TrendingRefCharacterOption } from './TrendingGenerateSheet'
import { usePulseIdentityBoundCharPovIds } from './usePulseIdentityBoundCharPovIds'
import { usePulsePlayerAccount } from './usePulsePlayerAccount'
import { usePulsePovOptions } from './usePulsePovOptions'
import { usePulseStore } from './usePulseStore'

type InboxCategory = 'all' | 'mention' | 'comment' | 'like' | 'repost'

/** 互动列表每页条数；底部手动加载更多 */
const INTERACTION_PAGE_SIZE = 10

function isDmRefContactEligible(contact: {
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

function interactionLabel(it: PulseInteraction): string {
  switch (it.type) {
    case 'like':
      return ' 赞了你'
    case 'comment':
      return ' 评论了你'
    case 'mention':
      return ' @了你'
    case 'repost':
      return ' 转发了你'
    case 'follow':
      return ' 关注了你'
    default:
      return ' 互动了你'
  }
}

function matchesCategory(it: PulseInteraction, cat: InboxCategory): boolean {
  if (cat === 'all') return true
  return it.type === cat
}

/** 互动来源是否为已认证角色（有 fromPovId 或能按昵称对上角色） */
function isVerifiedCharacterInteraction(
  it: PulseInteraction,
  statsByPov: Record<string, { weiboNickname?: string; verifyLabel?: string } | undefined>,
  nameToCharPov: Map<string, string>,
): boolean {
  const pov = it.fromPovId?.trim()
  if (pov && parsePulsePovId(pov)?.kind === 'char') return true
  const name = it.fromName.trim().toLowerCase()
  if (!name) return false
  const hitPov = nameToCharPov.get(name)
  if (hitPov && parsePulsePovId(hitPov)?.kind === 'char') return true
  for (const [povId, st] of Object.entries(statsByPov)) {
    if (parsePulsePovId(povId)?.kind !== 'char') continue
    const nick = st?.weiboNickname?.trim().toLowerCase()
    if (nick && nick === name) return true
  }
  return false
}

/** 消息中心：互动通知 + 入口进入专属私信列表 */
export function PulseInbox({
  currentPlayerPovId,
  currentWorldId,
  selfAvatarUrl,
  onOpenPost,
  coachOpenDmSheet = false,
  coachOpenDmList = false,
}: {
  currentPlayerPovId: string
  currentWorldId?: string
  /** 用户微博头像 */
  selfAvatarUrl?: string
  /** 点击带 postId 的互动（如 @我）打开帖子详情 */
  onOpenPost?: (postId: string) => void
  /** 玩法引导：强制打开私信生成面板 */
  coachOpenDmSheet?: boolean
  /** 玩法引导：强制打开私信列表 */
  coachOpenDmList?: boolean
}) {
  const apiConfig = useCurrentApiConfig('chatCard')
  const { state } = useCustomization()
  const { wechatNickname, identityRealName } = usePulsePlayerAccount()
  const { options: povOptions } = usePulsePovOptions()
  const statsByPov = usePulseProfileStatsByPov()
  const engagementNow = usePulseEngagementClock()
  const interactions = useUnlockedPulseInteractions(engagementNow)
  const dmThreads = useUnlockedPulseDmThreads(engagementNow)
  const prependDmThreads = usePulseStore((s) => s.prependDmThreads)
  const markInteractionsReadByType = usePulseStore((s) => s.markInteractionsReadByType)
  const [dmListOpen, setDmListOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [genDm, setGenDm] = useState(false)
  const [category, setCategory] = useState<InboxCategory>('all')
  const [interactionVisibleCount, setInteractionVisibleCount] = useState(INTERACTION_PAGE_SIZE)
  const [lastRefCharacterNames, setLastRefCharacterNames] = useState<string[]>([])
  const prevCoachDmSheet = useRef(false)
  const prevCoachDmList = useRef(false)

  useEffect(() => {
    if (coachOpenDmSheet && !prevCoachDmSheet.current) {
      setSheetOpen(true)
    } else if (!coachOpenDmSheet && prevCoachDmSheet.current && !genDm) {
      setSheetOpen(false)
    }
    prevCoachDmSheet.current = coachOpenDmSheet
  }, [coachOpenDmSheet, genDm])

  useEffect(() => {
    if (coachOpenDmList && !prevCoachDmList.current) {
      setDmListOpen(true)
    } else if (!coachOpenDmList && prevCoachDmList.current) {
      setDmListOpen(false)
    }
    prevCoachDmList.current = coachOpenDmList
  }, [coachOpenDmList])

  const playerWeiboName =
    statsByPov[currentPlayerPovId]?.weiboNickname?.trim() || wechatNickname.trim() || ''
  const playerRealName = identityRealName?.trim() || playerWeiboName || '我'

  const nameToCharPov = useMemo(() => {
    const m = new Map<string, string>()
    for (const opt of povOptions) {
      if (parsePulsePovId(opt.povId)?.kind !== 'char') continue
      const label = opt.label?.trim().toLowerCase()
      if (label) m.set(label, opt.povId)
    }
    for (const [povId, st] of Object.entries(statsByPov)) {
      if (parsePulsePovId(povId)?.kind !== 'char') continue
      const nick = st?.weiboNickname?.trim().toLowerCase()
      if (nick) m.set(nick, povId)
    }
    return m
  }, [povOptions, statsByPov])

  const contactCharacterIds = useMemo(
    () =>
      state.wechatPersonaContacts
        .map((c) => c.characterId?.trim())
        .filter((id): id is string => Boolean(id)),
    [state.wechatPersonaContacts],
  )
  const { boundCharPovIds } = usePulseIdentityBoundCharPovIds(currentPlayerPovId, contactCharacterIds)
  const boundCharSet = useMemo(() => new Set(boundCharPovIds), [boundCharPovIds])

  const refCharacterOptions = useMemo((): TrendingRefCharacterOption[] => {
    const seen = new Set<string>()
    const rows: TrendingRefCharacterOption[] = []
    for (const c of state.wechatPersonaContacts) {
      if (!isDmRefContactEligible(c)) continue
      const characterId = c.characterId.trim()
      if (seen.has(characterId)) continue
      const povId = toCharPovId(characterId)
      if (boundCharSet.size && !boundCharSet.has(povId)) continue
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
    const worldCid = currentWorldId ? parsePulsePovId(currentWorldId)?.rawId?.trim() : ''
    if (worldCid && refCharacterOptions.some((o) => o.characterId === worldCid)) return worldCid
    return refCharacterOptions[0]?.characterId
  }, [currentWorldId, refCharacterOptions])

  const unreadByType = useMemo(() => {
    const unread = interactions.filter((i) => !i.read)
    return {
      mention: unread.filter((i) => i.type === 'mention').length,
      comment: unread.filter((i) => i.type === 'comment').length,
      like: unread.filter((i) => i.type === 'like').length,
      repost: unread.filter((i) => i.type === 'repost').length,
    }
  }, [interactions])

  const filteredInteractions = useMemo(
    () => interactions.filter((it) => matchesCategory(it, category)),
    [interactions, category],
  )

  // 切换分类时回到第一页
  useEffect(() => {
    setInteractionVisibleCount(INTERACTION_PAGE_SIZE)
  }, [category])

  const visibleInteractions = useMemo(
    () => filteredInteractions.slice(0, interactionVisibleCount),
    [filteredInteractions, interactionVisibleCount],
  )
  const hasMoreInteractions = filteredInteractions.length > interactionVisibleCount

  const dmUnread = useMemo(
    () => dmThreads.reduce((sum, t) => sum + Math.max(0, t.unread || 0), 0),
    [dmThreads],
  )

  const previewAvatars = useMemo(() => {
    return dmThreads.slice(0, 3).map((t) => ({
      id: t.id,
      src:
        resolvePulseAuthorAvatarUrl(t.fanAvatarUrl) ||
        resolvePulseAuthorAvatarUrl(pickStablePulseNetizenAvatarPath(`dm:${t.fanName}`)),
    }))
  }, [dmThreads])

  const generateDm = useCallback(
    async (settings: DmGenerateSettings) => {
      setGenDm(true)
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
            includePlayerIdentity: true,
          })
        } else {
          // 不选参考角色：只注入用户本人身份
          const identityRaw = parsePulsePovId(currentPlayerPovId)?.rawId?.trim() || ''
          if (identityRaw) {
            povContext = await loadPulsePlayerIdentityPersonaContext(identityRaw)
          }
        }

        const rows = await aiGeneratePulseDmThreads({
          apiConfig,
          playerRealName,
          playerWeiboNickname: playerWeiboName || undefined,
          refCharacterNames: refCharacters.map((c) => c.name),
          threadCount: settings.threadCount,
          messagesPerThread: settings.messagesPerThread,
          styles: settings.styles,
          styleCustom: settings.styleCustom,
          povContext: povContext || undefined,
          customRequirements: settings.customRequirements,
        })
        setLastRefCharacterNames(refCharacters.map((c) => c.name))
        prependDmThreads(flatToDmThreads(rows), currentPlayerPovId)
        setSheetOpen(false)
        setDmListOpen(true)
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '生成失败')
      } finally {
        setGenDm(false)
      }
    },
    [
      apiConfig,
      currentPlayerPovId,
      playerRealName,
      playerWeiboName,
      prependDmThreads,
      refCharacterOptions,
    ],
  )

  const pickCategory = (cat: InboxCategory) => {
    setCategory(cat)
    if (cat !== 'all') markInteractionsReadByType(cat)
  }

  const loadMoreInteractions = () => {
    setInteractionVisibleCount((n) => n + INTERACTION_PAGE_SIZE)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col bg-[#FCFCFD]">
        <div className="shrink-0 px-4 pb-2 pt-2">
          <h2 className="text-[17px] font-semibold tracking-tight text-[#2D2422]">消息</h2>
        </div>

        <div className="shrink-0 px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            <NotificationCell
              label="@我"
              Icon={AtSign}
              tintBg="rgba(162,178,198,0.2)"
              iconColor={PULSE_COLORS.mistBlue}
              unreadCount={unreadByType.mention}
              active={category === 'mention'}
              onPress={() => pickCategory(category === 'mention' ? 'all' : 'mention')}
            />
            <NotificationCell
              label="评论"
              Icon={MessageCircle}
              tintBg="rgba(163,196,188,0.2)"
              iconColor={PULSE_COLORS.sage}
              unreadCount={unreadByType.comment}
              active={category === 'comment'}
              onPress={() => pickCategory(category === 'comment' ? 'all' : 'comment')}
            />
            <NotificationCell
              label="赞"
              Icon={Heart}
              tintBg="rgba(229,152,155,0.2)"
              iconColor={PULSE_COLORS.dustyRose}
              unreadCount={unreadByType.like}
              active={category === 'like'}
              onPress={() => pickCategory(category === 'like' ? 'all' : 'like')}
            />
            <NotificationCell
              label="转发"
              Icon={Repeat2}
              tintBg="rgba(212,175,55,0.15)"
              iconColor={PULSE_COLORS.lightGold}
              unreadCount={unreadByType.repost}
              active={category === 'repost'}
              onPress={() => pickCategory(category === 'repost' ? 'all' : 'repost')}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-28">
          <Pressable
            type="button"
            onClick={() => setDmListOpen(true)}
            data-pulse-coach="inbox-dm-entry"
            className="mb-5 flex w-full items-center gap-3 rounded-[20px] bg-white px-4 py-4 text-left shadow-sm"
          >
            <div className="flex -space-x-2">
              {previewAvatars.length ? (
                previewAvatars.map((a) =>
                  a.src ? (
                    <img
                      key={a.id}
                      src={a.src}
                      alt=""
                      className="size-9 rounded-full object-cover ring-2 ring-white"
                    />
                  ) : (
                    <div key={a.id} className="size-9 rounded-full bg-[#F0EFED] ring-2 ring-white" />
                  ),
                )
              ) : (
                <div
                  className="flex size-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'rgba(229,152,155,0.15)' }}
                >
                  <MessageCircle
                    className="size-4"
                    strokeWidth={1.5}
                    style={{ color: PULSE_COLORS.dustyRose }}
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-[#2D2422]">私信</span>
                {dmUnread > 0 ? (
                  <span
                    className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[10px] font-bold leading-none text-white"
                    style={{ background: '#fa5151', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.95)' }}
                    aria-label={`${dmUnread} 条未读私信`}
                  >
                    <PulseNumericText
                      text={dmUnread > 99 ? '99+' : String(dmUnread)}
                      className="text-[10px] font-bold leading-none text-white"
                    />
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-[12px] text-neutral-400">
                {dmThreads.length
                  ? `${dmThreads.length} 个会话 · 粉丝与路人留言`
                  : '生成网友私信，体验陌生人对话'}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-neutral-300" strokeWidth={1.5} />
          </Pressable>

          <div className="mb-3 flex items-center justify-between px-0.5">
            <p className="text-[12px] font-medium text-neutral-400">互动</p>
            <Pressable
              type="button"
              onClick={() => setSheetOpen(true)}
              disabled={genDm}
              data-pulse-coach="inbox-dm-generate"
              className="flex items-center gap-1 text-[11px] text-neutral-400"
            >
              <Sparkles
                className="size-3.5"
                strokeWidth={1.3}
                style={{ color: PULSE_COLORS.lightGold }}
              />
              {genDm ? '召唤中…' : '生成网友私信'}
            </Pressable>
          </div>

          {filteredInteractions.length > 0 ? (
            <div className="mb-5 space-y-2">
              {visibleInteractions.map((it) => {
                const targetPostId = it.postId?.trim()
                const canOpenPost = Boolean(targetPostId && onOpenPost)
                const avatarSrc =
                  resolvePulseAuthorAvatarUrl(it.fromAvatarUrl) ||
                  resolvePulseAuthorAvatarUrl(
                    pickStablePulseNetizenAvatarPath(`inbox:${it.type}:${it.fromName}`),
                  )
                const verified = isVerifiedCharacterInteraction(it, statsByPov, nameToCharPov)
                return (
                  <Pressable
                    key={it.id}
                    type="button"
                    disabled={!canOpenPost}
                    onClick={() => {
                      if (!targetPostId || !onOpenPost) return
                      onOpenPost(targetPostId)
                    }}
                    className={`flex w-full items-start gap-3 rounded-[18px] bg-white px-3.5 py-3 text-left shadow-sm ${
                      !it.read ? 'ring-1 ring-[#E5989B]/15' : ''
                    } ${canOpenPost ? '' : 'cursor-default'}`}
                  >
                    <div className="relative shrink-0">
                      <PulseVerifiedAvatar
                        src={avatarSrc}
                        verified={verified}
                        sizeClass="size-10"
                        borderClass="border-0 ring-1 ring-black/[0.04]"
                      />
                      {!it.read ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 z-[2] size-2 rounded-full ring-2 ring-white"
                          style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] leading-snug text-[#2D2422]">
                        <span className="font-medium">{it.fromName}</span>
                        {interactionLabel(it)}
                      </p>
                      {it.content ? (
                        <p className="mt-1 line-clamp-3 text-[12px] text-neutral-400">
                          <PulseWeiboFaceText
                            text={it.content}
                            className="text-[12px] text-neutral-400"
                          />
                        </p>
                      ) : it.postSnippet ? (
                        <p className="mt-1 line-clamp-2 text-[12px] text-neutral-400">
                          <PulseWeiboFaceText
                            text={it.postSnippet}
                            className="text-[12px] text-neutral-400"
                          />
                        </p>
                      ) : null}
                    </div>
                  </Pressable>
                )
              })}
              {hasMoreInteractions ? (
                <Pressable
                  type="button"
                  onClick={loadMoreInteractions}
                  className="flex w-full items-center justify-center rounded-[18px] bg-white/80 py-3 text-[12px] text-neutral-400 shadow-sm"
                >
                  加载更多（还有 {filteredInteractions.length - interactionVisibleCount} 条）
                </Pressable>
              ) : filteredInteractions.length > INTERACTION_PAGE_SIZE ? (
                <p className="py-2 text-center text-[11px] text-neutral-300">已全部加载</p>
              ) : null}
            </div>
          ) : category !== 'all' ? (
            <p className="mb-5 py-8 text-center text-[12px] text-neutral-300">该分类暂无新互动</p>
          ) : !dmThreads.length && !interactions.length ? (
            <p className="py-16 text-center text-[13px] text-neutral-300">暂无消息</p>
          ) : null}
        </div>
      </div>

      <DmGenerateSheet
        open={sheetOpen}
        loading={genDm}
        onClose={() => !genDm && setSheetOpen(false)}
        onConfirm={(settings) => void generateDm(settings)}
        refCharacterOptions={refCharacterOptions}
        defaultRefCharacterId={defaultRefCharacterId}
        playerRealName={playerRealName}
      />

      <AnimatePresence>
        {dmListOpen ? (
          <PulseInboxList
            threads={dmThreads}
            onBack={() => setDmListOpen(false)}
            onGenerate={() => setSheetOpen(true)}
            generating={genDm}
            playerRealName={playerRealName}
            playerWeiboNickname={playerWeiboName || undefined}
            selfAvatarUrl={selfAvatarUrl}
            refCharacterNames={lastRefCharacterNames}
          />
        ) : null}
      </AnimatePresence>
    </>
  )
}
