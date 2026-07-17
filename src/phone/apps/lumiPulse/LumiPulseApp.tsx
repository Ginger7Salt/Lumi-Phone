import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { PULSE_COLORS, PULSE_TAB_SPRING } from './constants'
import { ForwardSheet } from './ForwardSheet'
import {
  consumePendingPulsePostId,
  LUMI_PULSE_NAVIGATE_EVENT,
  LUMI_PULSE_OPEN_USER_EVENT,
  peekPulseReturnToChat,
  type PulseOpenUserDetail,
} from './lumiPulseNavigation'
import { PulseAppCoach } from './PulseAppCoach'
import { PulseAppCoachHub } from './PulseAppCoachHub'
import {
  PULSE_APP_COACH_ROOT_ATTR,
  PULSE_APP_COACH_SEEN_KEY,
  PULSE_COACH_STEPS_BY_TOPIC,
  type PulseAppCoachStep,
  type PulseCoachTopicId,
} from './pulseAppCoachSteps'
import { PostDetail } from './PostDetail'
import { PulseAuthGuard } from './PulseAuthGuard'
import { PulseDiscover } from './PulseDiscover'
import { usePulseEngagementClock } from './pulseEngagementUnlock'
import { resumePlayerPostEngagementOnEnter } from './pulsePlayerPostEngagement'
import { resumePlayerPostCharacterEngagementOnEnter } from './pulsePlayerPostCharacterEngagement'
import { PulseHomeFeed } from './PulseHomeFeed'
import { PulseInbox } from './PulseInbox'
import { PulseProfile } from './PulseProfile'
import { PulseNumericText } from './components/PulseNum'
import { PulseUserProfileView } from './components/PulseUserProfileView'
import { PulseTabBar } from './PulseTabBar'
import type { PulseFollowingUser, PulseTab, PulseTrendingTopic } from './pulseTypes'
import { parsePulsePovId } from './pulseTypes'
import { TrendingTopicPage } from './TrendingTopicPage'
import {
  usePulseDiscoverPosts,
  usePulsePostById,
  usePulseProfileStats,
  usePulseProfileStatsByPov,
  usePulseTrendingTopics,
  useUnlockedPulseDmThreads,
  useUnlockedPulseInteractions,
} from './pulseStoreSelectors'
import { usePulseIdentityBoundCharPovIds } from './usePulseIdentityBoundCharPovIds'
import { usePulseIdentityOptions } from './usePulseIdentityOptions'
import { usePulsePovOptions } from './usePulsePovOptions'
import { usePulsePlayerAccount } from './usePulsePlayerAccount'
import { usePulseStore } from './usePulseStore'

export function LumiPulseApp({
  onBack,
  backTarget = 'desktop',
  className = '',
}: {
  onBack: () => void
  /** desktop：返回手机桌面；discover：返回微信发现列表 */
  backTarget?: 'desktop' | 'discover'
  className?: string
}) {
  return <LumiPulseAppContent onBack={onBack} backTarget={backTarget} className={className} />
}

function LumiPulseAppContent({
  onBack,
  backTarget,
  className,
}: {
  onBack: () => void
  backTarget: 'desktop' | 'discover'
  className?: string
}) {
  const { state, themeStyle } = useCustomization()
  const pageStyle = state.appPageStyles.weibo

  const { hydrated: worldsHydrated, currentAccountId, options: allWorldOptions } = usePulsePovOptions()
  const {
    hydrated: identitiesHydrated,
    options: identityOptions,
  } = usePulseIdentityOptions()
  const {
    playerPovId,
    wechatNickname,
    wechatAvatarUrl,
    boundIdentityLabel,
    identityRealName,
  } = usePulsePlayerAccount()
  const bindAccount = usePulseStore((s) => s.bindAccount)
  const clearPlayerPovPick = usePulseStore((s) => s.clearPlayerPovPick)
  const setCurrentPlayerPovId = usePulseStore((s) => s.setCurrentPlayerPovId)
  const setIdentityVisibleCharPovIds = usePulseStore((s) => s.setIdentityVisibleCharPovIds)
  const currentWorldId = usePulseStore((s) => s.currentPOVId)
  const setCurrentWorldId = usePulseStore((s) => s.setCurrentPOVId)
  const syncPlayerPostEngagementDisplay = usePulseStore((s) => s.syncPlayerPostEngagementDisplay)
  const syncPlayerFollowerGrowth = usePulseStore((s) => s.syncPlayerFollowerGrowth)
  const posts = usePulseDiscoverPosts()
  const trending = usePulseTrendingTopics()
  const profileStats = usePulseProfileStats(playerPovId)
  const statsByPov = usePulseProfileStatsByPov()
  const weiboDisplayName = profileStats.weiboNickname?.trim() || wechatNickname
  const weiboAvatar = profileStats.weiboAvatarUrl?.trim() || wechatAvatarUrl
  const apiConfig = useCurrentApiConfig('chatCard')
  const engagementNow = usePulseEngagementClock()
  const interactions = useUnlockedPulseInteractions(engagementNow)
  const dmThreads = useUnlockedPulseDmThreads(engagementNow)

  const contactCharacterIds = useMemo(() => {
    const ids = state.wechatPersonaContacts.map((c) => c.characterId.trim()).filter(Boolean)
    for (const o of allWorldOptions) ids.push(o.rawId)
    return [...new Set(ids)]
  }, [allWorldOptions, state.wechatPersonaContacts])

  const { boundCharPovIds, boundCharPovIdSet } = usePulseIdentityBoundCharPovIds(
    playerPovId,
    contactCharacterIds,
  )

  const identityRawId = useMemo(() => {
    const parsed = playerPovId ? parsePulsePovId(playerPovId) : null
    return parsed?.kind === 'player' ? parsed.rawId : ''
  }, [playerPovId])

  const options = useMemo(() => {
    if (!identityRawId) return []
    return allWorldOptions.filter((o) => {
      const linked = o.linkedPlayerIdentityIds ?? []
      if (linked.length) return linked.includes(identityRawId)
      return boundCharPovIdSet.has(o.povId)
    })
  }, [allWorldOptions, boundCharPovIdSet, identityRawId])

  const [tab, setTab] = useState<PulseTab>('home')
  const [openPostId, setOpenPostId] = useState<string | null>(null)
  const [openTopicId, setOpenTopicId] = useState<string | null>(null)
  const [forwardPostId, setForwardPostId] = useState<string | null>(null)
  const [mentionUser, setMentionUser] = useState<PulseFollowingUser | null>(null)
  const [toast, setToast] = useState('')
  const [coachHubOpen, setCoachHubOpen] = useState(false)
  const [coachOpen, setCoachOpen] = useState(false)
  const [coachTopic, setCoachTopic] = useState<PulseCoachTopicId | null>(null)
  const [coachStepIndex, setCoachStepIndex] = useState(0)
  const [coachSocialSheet, setCoachSocialSheet] = useState(false)
  const [coachDemoOverwrite, setCoachDemoOverwrite] = useState(false)
  const [coachTrendingSheet, setCoachTrendingSheet] = useState(false)
  const [coachPublishEditor, setCoachPublishEditor] = useState(false)
  const [coachDmSheet, setCoachDmSheet] = useState(false)
  const [coachDmList, setCoachDmList] = useState(false)
  const coachAutoTriedRef = useRef(false)
  /** 从聊天室卡片深链进入：关详情 / 点返回时直接退出到聊天，而不是落在微博广场 */
  const [exitToChatOnBack, setExitToChatOnBack] = useState(false)
  /**
   * 从个人页等触发的「切换身份」：选完 / 取消返回时回到原 Tab，而不是退出微博或落到发现。
   */
  const [identitySwitchResume, setIdentitySwitchResume] = useState<{
    tab: PulseTab
    previousPlayerPovId: string
  } | null>(null)
  const prevWorldRef = useRef<string | null>(null)

  const activeWorld = useMemo(
    () => options.find((o) => o.povId === currentWorldId) ?? null,
    [currentWorldId, options],
  )

  const openPost = usePulsePostById(openPostId)
  const forwardPost = usePulsePostById(forwardPostId)

  const openTopic = useMemo(() => {
    if (!openTopicId) return null
    return trending.find((t) => t.id === openTopicId) ?? null
  }, [openTopicId, trending])

  const handleRepostPost = useCallback((postId: string) => {
    setForwardPostId(postId)
  }, [])

  const inboxUnreadCount = useMemo(() => {
    const interactionUnread = interactions.filter((i) => !i.read).length
    const dmUnread = dmThreads.reduce((sum, t) => sum + Math.max(0, t.unread || 0), 0)
    return interactionUnread + dmUnread
  }, [interactions, dmThreads])

  const hydrated = worldsHydrated && identitiesHydrated

  useEffect(() => {
    void bindAccount(currentAccountId)
  }, [bindAccount, currentAccountId])

  /** 墙钟 tick：补齐已到点的赞/转/评 + 粉丝自然增长（退出网页后重进也会立刻追上） */
  useEffect(() => {
    if (!hydrated || !playerPovId) return
    syncPlayerPostEngagementDisplay(engagementNow)
    syncPlayerFollowerGrowth(engagementNow)
  }, [
    engagementNow,
    hydrated,
    playerPovId,
    syncPlayerFollowerGrowth,
    syncPlayerPostEngagementDisplay,
  ])

  /** 进入广场：续跑仍 pending 的发帖粉丝互动生成 */
  useEffect(() => {
    if (!hydrated || !playerPovId) return
    syncPlayerFollowerGrowth(Date.now())
    resumePlayerPostEngagementOnEnter({
      apiConfig,
      playerRealName: identityRealName?.trim() || undefined,
      playerWeiboNickname: weiboDisplayName,
      onToast: (msg) => setToast(msg),
    })
    resumePlayerPostCharacterEngagementOnEnter({
      apiConfig,
      playerDisplayName: weiboDisplayName,
      onToast: (msg) => setToast(msg),
    })
  }, [
    apiConfig,
    hydrated,
    identityRealName,
    playerPovId,
    syncPlayerFollowerGrowth,
    weiboDisplayName,
  ])

  const markCoachSeen = useCallback(() => {
    try {
      localStorage.setItem(PULSE_APP_COACH_SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
  }, [])

  const resetCoachUiFlags = useCallback(() => {
    setCoachSocialSheet(false)
    setCoachDemoOverwrite(false)
    setCoachTrendingSheet(false)
    setCoachPublishEditor(false)
    setCoachDmSheet(false)
    setCoachDmList(false)
  }, [])

  /** 「玩法」：打开主题选择面板（含微信联动说明） */
  const openCoachHub = useCallback(() => {
    setOpenPostId(null)
    setOpenTopicId(null)
    setMentionUser(null)
    setForwardPostId(null)
    setCoachOpen(false)
    setCoachTopic(null)
    resetCoachUiFlags()
    setCoachHubOpen(true)
  }, [resetCoachUiFlags])

  const startCoachTopic = useCallback(
    (topicId: PulseCoachTopicId) => {
      setOpenPostId(null)
      setOpenTopicId(null)
      setMentionUser(null)
      setForwardPostId(null)
      setCoachHubOpen(false)
      setCoachTopic(topicId)
      setCoachStepIndex(0)
      resetCoachUiFlags()
      setCoachOpen(true)
    },
    [resetCoachUiFlags],
  )

  const finishCoach = useCallback(() => {
    markCoachSeen()
    setCoachOpen(false)
    setCoachTopic(null)
    resetCoachUiFlags()
  }, [markCoachSeen, resetCoachUiFlags])

  const coachSteps = coachTopic ? PULSE_COACH_STEPS_BY_TOPIC[coachTopic] : []

  const handleCoachBeforeStep = useCallback((step: PulseAppCoachStep) => {
    if (step.tab) setTab(step.tab)
    setCoachSocialSheet(Boolean(step.openSocialSheet))
    setCoachDemoOverwrite(Boolean(step.demoSocialOverwrite))
    setCoachTrendingSheet(Boolean(step.openTrendingSheet))
    setCoachPublishEditor(Boolean(step.openPublishEditor))
    setCoachDmSheet(Boolean(step.openDmSheet))
    setCoachDmList(Boolean(step.openDmList))
  }, [])

  /** 首次进入微博广场：自动打开玩法面板 */
  useEffect(() => {
    if (!hydrated || !playerPovId || !currentWorldId) return
    if (coachAutoTriedRef.current) return
    coachAutoTriedRef.current = true
    try {
      if (localStorage.getItem(PULSE_APP_COACH_SEEN_KEY) === '1') return
    } catch {
      return
    }
    const t = window.setTimeout(() => openCoachHub(), 480)
    return () => window.clearTimeout(t)
  }, [currentWorldId, hydrated, openCoachHub, playerPovId])

  /** 每次进入微博广场：清空已选身份，强制身份视角选择 */
  useEffect(() => {
    clearPlayerPovPick()
  }, [clearPlayerPovPick])

  /** 同步当前身份可见角色集合，供帖子过滤 / 互动门禁 */
  useEffect(() => {
    if (!playerPovId) {
      setIdentityVisibleCharPovIds(null)
      return
    }
    setIdentityVisibleCharPovIds(boundCharPovIds)
  }, [boundCharPovIds, playerPovId, setIdentityVisibleCharPovIds])

  /**
   * 身份选定后：世界锚点仅在「绑定了该身份的主要角色」内选择。
   * 有记忆世界且仍有效则沿用；否则自动接入首位绑定世界。
   */
  useEffect(() => {
    if (!hydrated || !playerPovId) return
    if (!options.length) {
      if (currentWorldId) setCurrentWorldId(null)
      return
    }
    if (options.some((o) => o.povId === currentWorldId)) return
    setCurrentWorldId(options[0]!.povId)
  }, [hydrated, playerPovId, options, currentWorldId, setCurrentWorldId])

  /** 切换世界时关闭跨世界的动态详情（首次进入世界不清空） */
  useEffect(() => {
    const prev = prevWorldRef.current
    prevWorldRef.current = currentWorldId
    if (prev && currentWorldId && prev !== currentWorldId) {
      setOpenPostId(null)
      setOpenTopicId(null)
      setMentionUser(null)
    }
  }, [currentWorldId])

  useEffect(() => {
    if (!playerPovId) return
    const applyPendingPost = () => {
      const pending = consumePendingPulsePostId()
      if (pending) {
        setOpenTopicId(null)
        setOpenPostId(pending)
        if (peekPulseReturnToChat()) setExitToChatOnBack(true)
      } else if (peekPulseReturnToChat()) {
        setExitToChatOnBack(true)
      }
    }
    applyPendingPost()
    window.addEventListener(LUMI_PULSE_NAVIGATE_EVENT, applyPendingPost)
    return () => window.removeEventListener(LUMI_PULSE_NAVIGATE_EVENT, applyPendingPost)
  }, [playerPovId])

  useEffect(() => {
    const onOpenUser = (ev: Event) => {
      const detail = (ev as CustomEvent<PulseOpenUserDetail>).detail
      const povId = detail?.povId?.trim()
      if (!povId) return
      const parsed = parsePulsePovId(povId)
      if (!parsed || (parsed.kind !== 'char' && parsed.kind !== 'player')) return
      const opt = allWorldOptions.find((o) => o.povId === povId) ?? options.find((o) => o.povId === povId)
      const stats = statsByPov[povId]
      const weibo = stats?.weiboNickname?.trim()
      const verify = stats?.verifyLabel?.trim()
      const name =
        weibo ||
        detail.name?.trim() ||
        (povId === playerPovId ? weiboDisplayName : undefined) ||
        opt?.label ||
        '未命名'
      setMentionUser({
        povId,
        name,
        wechatNickname: opt?.label,
        avatarUrl:
          stats?.weiboAvatarUrl?.trim() ||
          opt?.avatarUrl ||
          (povId === playerPovId ? weiboAvatar : undefined),
        bio: verify || opt?.identity?.trim() || undefined,
        verified: parsed.kind === 'char' || stats?.verifyLabel != null,
      })
    }
    window.addEventListener(LUMI_PULSE_OPEN_USER_EVENT, onOpenUser)
    return () => window.removeEventListener(LUMI_PULSE_OPEN_USER_EVENT, onOpenUser)
  }, [
    allWorldOptions,
    options,
    playerPovId,
    statsByPov,
    weiboAvatar,
    weiboDisplayName,
  ])

  const handleChromeBack = useCallback(() => {
    if (exitToChatOnBack) {
      setOpenPostId(null)
      setOpenTopicId(null)
      setMentionUser(null)
      setExitToChatOnBack(false)
    }
    onBack()
  }, [exitToChatOnBack, onBack])

  const handlePostDetailBack = useCallback(() => {
    if (exitToChatOnBack) {
      handleChromeBack()
      return
    }
    setOpenPostId(null)
  }, [exitToChatOnBack, handleChromeBack])

  useEffect(() => {
    if (!openPostId) return
    if (openPost) return
    /** 动态列表已就绪但找不到对应帖（删帖 / 换世界等） */
    if (!posts.length) return
    setOpenPostId(null)
    setToast('原动态不存在或已删除')
  }, [openPostId, openPost, posts.length])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  const showToast = useCallback((msg: string) => setToast(msg), [])

  const handleTrendingTopic = useCallback((topic: PulseTrendingTopic) => {
    setOpenTopicId(topic.id)
  }, [])

  const handleSelectIdentity = useCallback(
    (povId: string) => {
      setCurrentPlayerPovId(povId)
      if (identitySwitchResume) {
        setTab(identitySwitchResume.tab)
        setIdentitySwitchResume(null)
      }
    },
    [identitySwitchResume, setCurrentPlayerPovId],
  )

  const beginIdentitySwitch = useCallback(
    (resumeTab: PulseTab = 'profile') => {
      if (!playerPovId) {
        clearPlayerPovPick()
        return
      }
      setIdentitySwitchResume({ tab: resumeTab, previousPlayerPovId: playerPovId })
      setTab(resumeTab)
      clearPlayerPovPick()
    },
    [clearPlayerPovPick, playerPovId],
  )

  const handleIdentitySelectBack = useCallback(() => {
    if (identitySwitchResume) {
      setCurrentPlayerPovId(identitySwitchResume.previousPlayerPovId)
      setTab(identitySwitchResume.tab)
      setIdentitySwitchResume(null)
      return
    }
    handleChromeBack()
  }, [handleChromeBack, identitySwitchResume, setCurrentPlayerPovId])

  if (!hydrated) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FCFCFC] text-[13px] text-neutral-400">
        载入脉冲…
      </div>
    )
  }

  if (!currentAccountId) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FCFCFC] px-8 text-center text-[13px] leading-relaxed text-neutral-400">
        请先登录微信账号后再使用微博广场
      </div>
    )
  }

  if (!playerPovId) {
    return (
      <div className={`h-full min-h-0 ${className}`} data-phone-page="app" data-app-id="weibo">
        <PulseAuthGuard
          options={identityOptions}
          onSelect={handleSelectIdentity}
          onBack={handleIdentitySelectBack}
          backLabel={
            identitySwitchResume
              ? '返回个人页'
              : exitToChatOnBack
                ? '返回聊天'
                : backTarget === 'discover'
                  ? '返回发现'
                  : '返回主页'
          }
        />
      </div>
    )
  }

  if (!options.length) {
    return (
      <div
        className={`flex h-full min-h-0 flex-col bg-[#FCFCFC] ${className}`}
        data-phone-page="app"
        data-app-id="weibo"
        style={{ ...themeStyle, fontFamily: 'var(--phone-font)' }}
      >
        <header
          className="relative z-20 flex shrink-0 items-center gap-2 px-3 pb-2"
          style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
        >
          <Pressable
            type="button"
            onClick={handleChromeBack}
            className="flex items-center gap-0.5 rounded-full py-1.5 pr-2 opacity-70"
            aria-label={
              exitToChatOnBack ? '返回聊天' : backTarget === 'discover' ? '返回发现' : '返回主页'
            }
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
              <path d="M14 6L8 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[13px] tracking-wide text-[#1C1C1E]">
              {exitToChatOnBack ? '返回聊天' : backTarget === 'discover' ? '返回发现' : '返回主页'}
            </span>
          </Pressable>
        </header>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-[13px] leading-relaxed text-neutral-400">
            当前身份尚未绑定主要角色。请在人设中为角色绑定此身份后再进入，或切换其他身份视角。
          </p>
          <Pressable
            type="button"
            onClick={() => beginIdentitySwitch('profile')}
            className="rounded-full bg-[#1C1C1E] px-4 py-2 text-[12px] tracking-wide text-white"
          >
            切换身份
          </Pressable>
        </div>
      </div>
    )
  }

  if (!currentWorldId || !activeWorld) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FCFCFC] text-[13px] text-neutral-400">
        进入微博…
      </div>
    )
  }

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col bg-[#FCFCFC] ${className}`}
      data-phone-page="app"
      data-app-id="weibo"
      {...{ [PULSE_APP_COACH_ROOT_ATTR]: 'pulse-app' }}
      style={{
        ...themeStyle,
        backgroundColor: pageStyle?.pageBg ?? PULSE_COLORS.bg,
        fontFamily: 'var(--phone-font)',
      }}
    >
      {tab !== 'profile' ? (
        <header
          className="grid shrink-0 grid-cols-[36px_1fr_auto] items-center gap-1 px-3 pb-1.5"
          style={{
            paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
            backgroundColor: 'rgba(252,252,252,0.88)',
          }}
        >
          <Pressable
            onClick={handleChromeBack}
            className="flex size-9 items-center justify-center rounded-full opacity-60"
            aria-label={
              exitToChatOnBack ? '返回聊天' : backTarget === 'discover' ? '返回发现' : '返回桌面'
            }
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
              <path d="M14 6L8 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Pressable>
          <h1 className="truncate text-center text-[16px] font-semibold tracking-[0.02em] text-[#1C1C1E]">
            微博广场
          </h1>
          <Pressable
            type="button"
            onClick={openCoachHub}
            className="rounded-full px-2.5 py-1.5 text-[11px] tracking-wide text-neutral-500"
            aria-label="玩法指引"
          >
            玩法
          </Pressable>
        </header>
      ) : null}

      <main className="flex min-h-0 flex-1 flex-col" style={{ minHeight: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            className="flex min-h-0 flex-1 flex-col"
            style={{ minHeight: 0 }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={PULSE_TAB_SPRING}
          >
            {tab === 'home' ? (
              <PulseHomeFeed
                currentPlayerPovId={playerPovId}
                authorName={weiboDisplayName}
                authorAvatarUrl={weiboAvatar}
                povOptions={options}
                onOpenPost={setOpenPostId}
                onRepostPost={handleRepostPost}
                onToast={showToast}
                coachOpenPublishEditor={coachOpen && coachPublishEditor}
              />
            ) : tab === 'discover' ? (
              <PulseDiscover
                povName={activeWorld.label}
                currentWorldId={currentWorldId}
                currentPlayerPovId={playerPovId}
                povOptions={options}
                onOpenTopic={handleTrendingTopic}
                onOpenPost={setOpenPostId}
                onRepostPost={handleRepostPost}
                coachOpenTrendingSheet={coachOpen && coachTrendingSheet}
                onStartCoach={openCoachHub}
              />
            ) : tab === 'inbox' ? (
              <PulseInbox
                currentPlayerPovId={playerPovId}
                currentWorldId={currentWorldId}
                selfAvatarUrl={weiboAvatar}
                onOpenPost={setOpenPostId}
                coachOpenDmSheet={coachOpen && coachDmSheet}
                coachOpenDmList={coachOpen && coachDmList}
              />
            ) : (
              <PulseProfile
                wechatNickname={wechatNickname}
                wechatAvatarUrl={wechatAvatarUrl}
                boundIdentityLabel={boundIdentityLabel}
                stats={profileStats}
                currentPlayerPovId={playerPovId}
                currentWorldId={currentWorldId}
                povOptions={options}
                onOpenPost={setOpenPostId}
                onRepostPost={handleRepostPost}
                onToast={showToast}
                onBack={handleChromeBack}
                onSwitchIdentity={() => beginIdentitySwitch('profile')}
                backAriaLabel={
                  exitToChatOnBack ? '返回聊天' : backTarget === 'discover' ? '返回发现' : '返回桌面'
                }
                coachOpenSocialSheet={coachOpen && coachSocialSheet}
                coachDemoSocialOverwrite={coachOpen && coachDemoOverwrite}
                onStartCoach={openCoachHub}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {!openPost && !openTopic ? (
        <PulseTabBar
          active={tab}
          onChange={setTab}
          inboxUnreadCount={inboxUnreadCount}
          profileFollowersGain={profileStats.followersGainPending ?? 0}
        />
      ) : null}

      <AnimatePresence>
        {openTopic ? (
          <TrendingTopicPage
            topic={openTopic}
            currentPlayerPovId={playerPovId}
            onBack={() => setOpenTopicId(null)}
            onOpenPost={setOpenPostId}
            onRepostPost={handleRepostPost}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {openPost ? (
          <PostDetail
            post={openPost}
            currentPlayerPovId={playerPovId}
            authorLabel={weiboDisplayName}
            authorAvatarUrl={weiboAvatar}
            onBack={handlePostDetailBack}
            onToast={showToast}
            onRepost={() => handleRepostPost(openPost.id)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {mentionUser && playerPovId ? (
          <PulseUserProfileView
            user={mentionUser}
            currentPlayerPovId={playerPovId}
            onBack={() => setMentionUser(null)}
            onOpenPost={setOpenPostId}
            onRepostPost={handleRepostPost}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {forwardPost ? (
          <ForwardSheet
            post={forwardPost}
            onClose={() => setForwardPostId(null)}
            onSent={() => {
              setForwardPostId(null)
              showToast('已发送给微信好友')
            }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-14 z-[1400] flex justify-center px-6"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <div
              className="rounded-full px-4 py-2 text-[11px] tracking-[0.04em] text-white backdrop-blur-md"
              style={{ backgroundColor: 'rgba(28,28,30,0.9)' }}
            >
              <PulseNumericText text={toast} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <PulseAppCoachHub
        open={coachHubOpen}
        onClose={() => {
          markCoachSeen()
          setCoachHubOpen(false)
        }}
        onPickTopic={startCoachTopic}
      />

      <PulseAppCoach
        open={coachOpen && coachSteps.length > 0}
        steps={coachSteps}
        stepIndex={coachStepIndex}
        onStepChange={setCoachStepIndex}
        onSkip={finishCoach}
        onComplete={finishCoach}
        onBeforeStep={handleCoachBeforeStep}
        layoutEpoch={`${tab}-${coachTopic}-${coachSocialSheet}-${coachTrendingSheet}-${coachDemoOverwrite}-${coachPublishEditor}-${coachDmSheet}-${coachDmList}`}
      />
    </div>
  )
}
