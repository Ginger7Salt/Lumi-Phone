import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion'
import { ChevronDown, Pencil, Settings2, ShieldCheck, Sparkles } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { useCurrentApiConfig } from '../api/ApiSettingsContext'
import { personaDb } from '../wechat/newFriendsPersona/idb'
import {
  WECHAT_LUMI_PEER_CHARACTER_ID,
  WECHAT_SELF_PEER_CHARACTER_ID,
} from '../wechat/wechatConversationKey'
import { PulseFollowingList } from './components/PulseFollowingList'
import {
  PulsePlotLineSwitchSheet,
  PulseProfileSettingsSheet,
} from './components/PulsePlotLineSheets'
import {
  PulseSocialAccountsGenerateSheet,
  pulseCharHasSocialAccount,
  type SocialAccountsGenerateOptions,
} from './components/PulseSocialAccountsGenerateSheet'
import { PulseUserProfileView } from './components/PulseUserProfileView'
import { PulseVerifiedAvatar } from './components/PulseVerifiedAvatar'
import { PostCard } from './components/PostCard'
import { PulseNum } from './components/PulseNum'
import { PULSE_COLORS, PULSE_DEFAULT_COVER, PULSE_MODAL_SPRING, PULSE_TAB_SPRING } from './constants'
import { buildTrendingRefContext } from './buildTrendingRefContext'
import { aiGeneratePulseSocialAccounts } from './lumiPulseAi'
import {
  loadPulseCharacterPersonaContext,
  loadPulsePlayerIdentityPersonaContext,
} from './pulseProfilePersona'
import {
  buildPulseFollowEdgesFromPlayerLinks,
  buildPulseFollowEdgesFromRelationships,
  mergePulseFollowEdges,
} from './pulseIdentityScope'
import { PublishEditor } from './PublishEditor'
import type {
  PulseFollowingUser,
  PulsePost,
  PulsePovOption,
  PulseProfileSegment,
  PulseProfileStats,
  PulseSocialAccountSeed,
} from './pulseTypes'
import { usePulseVisibilityCandidates } from './usePulseVisibilityCandidates'
import { formatFollowersGainBadge, formatPulseCount, parsePulsePovId, toCharPovId } from './pulseTypes'
import { sanitizePulseProfileSignature } from './pulseWeiboFace'
import {
  usePulseActivePlotCharPov,
  usePulseFollowingList,
  usePulseFusionMode,
  usePulseGeneratedPlotCharPovIds,
  usePulseLikedPosts,
  usePulsePostsByAuthor,
  usePulseProfileStats,
  usePulseProfileStatsByPov,
} from './pulseStoreSelectors'
import { usePublishMentionCandidates } from './usePublishMentionCandidates'
import { usePulseStore } from './usePulseStore'

const PROFILE_TABS: { id: PulseProfileSegment; label: string }[] = [
  { id: 'posts', label: '动态' },
  { id: 'liked', label: '赞过' },
]

type ProfileListKind = 'following' | 'friends'

type ProfileOverlay =
  | { kind: 'following' }
  | { kind: 'friends' }
  | { kind: 'user'; user: PulseFollowingUser; from: ProfileListKind }

/** 个人页好友：微信通讯录角色，排除 Lumi 与本人 */
function isProfileFriendContact(contact: {
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

function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const url = typeof r.result === 'string' ? r.result : ''
      if (url) resolve(url)
      else reject(new Error('读取图片失败'))
    }
    r.onerror = () => reject(new Error('读取图片失败'))
    r.readAsDataURL(file)
  })
}

/** 从世界选项与社交统计补全：微博昵称优先于微信/世界标签 */
function enrichFollowingUser(
  user: PulseFollowingUser,
  options: PulsePovOption[],
  statsByPov?: Record<string, PulseProfileStats>,
): PulseFollowingUser {
  const opt = options.find((o) => o.povId === user.povId)
  const weibo = statsByPov?.[user.povId]?.weiboNickname?.trim()
  const verify = statsByPov?.[user.povId]?.verifyLabel?.trim()
  const weiboAvatar = statsByPov?.[user.povId]?.weiboAvatarUrl?.trim()
  return {
    ...user,
    name: weibo || user.name || opt?.label || '未命名',
    avatarUrl: weiboAvatar || opt?.avatarUrl || user.avatarUrl,
    bio: verify || user.bio || opt?.identity,
    wechatNickname: user.wechatNickname || opt?.label,
    verified: user.verified === true || user.povId.startsWith('char:') || Boolean(opt),
  }
}

export function PulseProfile({
  wechatNickname,
  wechatAvatarUrl,
  boundIdentityLabel,
  stats: statsProp,
  currentPlayerPovId,
  currentWorldId,
  povOptions,
  onOpenPost,
  onRepostPost,
  onToast,
  onBack,
  onSwitchIdentity,
  backAriaLabel = '返回',
  coachOpenSocialSheet = false,
  coachDemoSocialOverwrite = false,
  onStartCoach,
}: {
  /** 当前微信马甲昵称（微博未单独设置时回退） */
  wechatNickname: string
  wechatAvatarUrl?: string
  /** 当前身份视角展示名（括号标注） */
  boundIdentityLabel?: string
  stats: PulseProfileStats
  currentPlayerPovId: string
  currentWorldId: string
  povOptions: PulsePovOption[]
  onOpenPost: (postId: string) => void
  onRepostPost: (postId: string) => void
  onToast: (msg: string) => void
  onBack?: () => void
  /** 返回身份选择 */
  onSwitchIdentity?: () => void
  backAriaLabel?: string
  /** 玩法引导：强制打开社交生成弹层 */
  coachOpenSocialSheet?: boolean
  /** 玩法引导：演示「覆盖角色」区 */
  coachDemoSocialOverwrite?: boolean
  onStartCoach?: () => void
}) {
  const [tab, setTab] = useState<PulseProfileSegment>('posts')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editPost, setEditPost] = useState<PulsePost | null>(null)
  const [socialSheetOpen, setSocialSheetOpen] = useState(false)
  const [socialGenerating, setSocialGenerating] = useState(false)
  const [socialPlotPovId, setSocialPlotPovId] = useState<string | null>(null)
  const prevCoachSocialOpen = useRef(false)
  const [plotLineSheetOpen, setPlotLineSheetOpen] = useState(false)
  const [settingsSheetOpen, setSettingsSheetOpen] = useState(false)
  const [nickEditorOpen, setNickEditorOpen] = useState(false)
  const [nickDraft, setNickDraft] = useState('')
  const [bioEditorOpen, setBioEditorOpen] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [overlay, setOverlay] = useState<ProfileOverlay | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const toggleLike = usePulseStore((s) => s.toggleLike)
  const applySocialAccountsBundle = usePulseStore((s) => s.applySocialAccountsBundle)
  const bumpProfileStats = usePulseStore((s) => s.bumpProfileStats)
  const clearFollowersGainPending = usePulseStore((s) => s.clearFollowersGainPending)
  const setActivePlotCharPov = usePulseStore((s) => s.setActivePlotCharPov)
  const setFusionMode = usePulseStore((s) => s.setFusionMode)
  const identityVisibleCharPovIds = usePulseStore((s) => s.identityVisibleCharPovIds)
  const activePlotCharPov = usePulseActivePlotCharPov()
  const fusionMode = usePulseFusionMode()
  const generatedPlotCharPovIds = usePulseGeneratedPlotCharPovIds()
  const plotSocialByCharPov = usePulseStore((s) => {
    const acc = s.currentAccountId
    if (!acc) return undefined
    return s.root.byAccount[acc]?.playerPlotSocialByCharPov
  })
  const visibilityCandidates = usePulseVisibilityCandidates(povOptions)
  const visibilityNameByPovId = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of visibilityCandidates) m.set(c.povId, c.name)
    return m
  }, [visibilityCandidates])
  const apiConfig = useCurrentApiConfig('chatCard')
  const { state } = useCustomization()

  const editorVisible = editorOpen || Boolean(editPost)
  // 发帖层关闭后清焦点即可；不要来回改 overflow（会把滚动/封面高度弄乱）
  useEffect(() => {
    if (editorVisible) return
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }, [editorVisible])

  const { scrollY } = useScroll({ container: scrollRef })
  const coverY = useTransform(scrollY, [0, 180], [0, 48])

  const myPosts = usePulsePostsByAuthor(currentPlayerPovId)
  const likedPosts = usePulseLikedPosts(currentPlayerPovId)
  const followingList = usePulseFollowingList(currentPlayerPovId)
  const liveStats = usePulseProfileStats(currentPlayerPovId)
  /** 以 store 最新为准（生成后 props 可能短暂落后） */
  const stats: PulseProfileStats = {
    ...statsProp,
    ...liveStats,
    weiboNickname: liveStats.weiboNickname?.trim() || statsProp.weiboNickname,
    weiboAvatarUrl: liveStats.weiboAvatarUrl?.trim() || statsProp.weiboAvatarUrl,
    coverUrl: liveStats.coverUrl?.trim() || statsProp.coverUrl,
    verifyLabel: liveStats.verifyLabel?.trim() || statsProp.verifyLabel,
    bio: liveStats.bio?.trim() || statsProp.bio,
    followersGainPending:
      liveStats.followersGainPending ?? statsProp.followersGainPending ?? 0,
  }
  const statsByPov = usePulseProfileStatsByPov()
  const mentionCandidates = usePublishMentionCandidates(currentPlayerPovId, povOptions)

  const weiboDisplayName = stats.weiboNickname?.trim() || wechatNickname.trim() || '我'
  const weiboAvatar = stats.weiboAvatarUrl?.trim() || wechatAvatarUrl
  const coverSrc = stats.coverUrl?.trim() || PULSE_DEFAULT_COVER
  const followersGainPending = Math.max(0, Math.floor(stats.followersGainPending ?? 0))
  const followersGainLabel = formatFollowersGainBadge(followersGainPending)
  const dismissFollowersGain = useCallback(() => {
    clearFollowersGainPending(currentPlayerPovId)
  }, [clearFollowersGainPending, currentPlayerPovId])

  const boundSet = useMemo(
    () => (identityVisibleCharPovIds ? new Set(identityVisibleCharPovIds) : null),
    [identityVisibleCharPovIds],
  )

  const friendsList = useMemo((): PulseFollowingUser[] => {
    const seen = new Set<string>()
    const rows: PulseFollowingUser[] = []
    for (const c of state.wechatPersonaContacts) {
      if (!isProfileFriendContact(c)) continue
      const characterId = c.characterId.trim()
      if (seen.has(characterId)) continue
      seen.add(characterId)
      const povId = toCharPovId(characterId)
      if (boundSet && !boundSet.has(povId)) continue
      const opt = povOptions.find((o) => o.povId === povId)
      const wechatNick = c.remarkName?.trim() || opt?.label || '未命名'
      const weibo = statsByPov[povId]?.weiboNickname?.trim()
      const verify = statsByPov[povId]?.verifyLabel?.trim()
      rows.push({
        povId,
        name: weibo || wechatNick,
        wechatNickname: wechatNick,
        avatarUrl: statsByPov[povId]?.weiboAvatarUrl?.trim() || opt?.avatarUrl || c.avatarUrl,
        bio: verify || opt?.identity?.trim() || '通讯录好友',
        verified: true,
      })
    }
    return rows
  }, [boundSet, povOptions, state.wechatPersonaContacts, statsByPov])

  const socialPlotAnchors = useMemo(() => {
    return friendsList.map((f) => {
      const opt = povOptions.find((o) => o.povId === f.povId)
      return {
        povId: f.povId,
        name: f.wechatNickname?.trim() || f.name,
        subtitle: opt?.identity?.trim() || opt?.worldName?.trim() || f.bio,
        charHasSocial: pulseCharHasSocialAccount(statsByPov[f.povId]),
      }
    })
  }, [friendsList, povOptions, statsByPov])

  const generatedPlotSet = useMemo(
    () => new Set(generatedPlotCharPovIds),
    [generatedPlotCharPovIds],
  )

  const plotLineOptions = useMemo(() => {
    return socialPlotAnchors.map((a) => {
      const snap = plotSocialByCharPov?.[a.povId]
      const hasSocial = generatedPlotSet.has(a.povId)
      return {
        povId: a.povId,
        name: a.name,
        subtitle: a.subtitle,
        hasSocial,
        verifyLabel: snap?.verifyLabel,
        followers: hasSocial ? Math.max(0, Math.floor(snap?.followers ?? 0)) : undefined,
      }
    })
  }, [generatedPlotSet, plotSocialByCharPov, socialPlotAnchors])

  const activePlotLineLabel = useMemo(() => {
    if (!activePlotCharPov) return null
    const hit = plotLineOptions.find((o) => o.povId === activePlotCharPov)
    return hit?.name?.trim() || null
  }, [activePlotCharPov, plotLineOptions])

  const openSocialSheet = useCallback(
    (preferPovId?: string | null) => {
      const prefer = preferPovId?.trim() || ''
      const preferred =
        (prefer && socialPlotAnchors.some((a) => a.povId === prefer) ? prefer : null) ||
        (activePlotCharPov && socialPlotAnchors.some((a) => a.povId === activePlotCharPov)
          ? activePlotCharPov
          : null) ||
        (currentWorldId && socialPlotAnchors.some((a) => a.povId === currentWorldId)
          ? currentWorldId
          : null) ||
        socialPlotAnchors[0]?.povId ||
        null
      setSocialPlotPovId(preferred)
      setSocialSheetOpen(true)
    },
    [activePlotCharPov, currentWorldId, socialPlotAnchors],
  )

  useEffect(() => {
    if (coachOpenSocialSheet && !prevCoachSocialOpen.current) {
      openSocialSheet()
    } else if (!coachOpenSocialSheet && prevCoachSocialOpen.current) {
      if (!socialGenerating) setSocialSheetOpen(false)
    }
    prevCoachSocialOpen.current = coachOpenSocialSheet
  }, [coachOpenSocialSheet, openSocialSheet, socialGenerating])

  const handleSelectPlotLine = useCallback(
    (povId: string) => {
      const result = setActivePlotCharPov(povId)
      if (result === 'ok') {
        const name = plotLineOptions.find((o) => o.povId === povId)?.name?.trim() || '该角色'
        onToast(`已切换到「${name}」剧情线`)
        setPlotLineSheetOpen(false)
        return
      }
      if (result === 'missing_social') {
        const name = plotLineOptions.find((o) => o.povId === povId)?.name?.trim() || '该角色'
        const charMissing = !pulseCharHasSocialAccount(statsByPov[povId])
        onToast(
          charMissing
            ? `「${name}」线尚无用户社交，且角色账号未生成；生成时可勾选角色一并补齐`
            : '请先为该角色线生成社交数据，再切换',
        )
        setPlotLineSheetOpen(false)
        openSocialSheet(povId)
        return
      }
      onToast('无法切换剧情线')
    },
    [onToast, openSocialSheet, plotLineOptions, setActivePlotCharPov, statsByPov],
  )

  const handleRequestGeneratePlotLine = useCallback(
    (povId: string) => {
      const opt = plotLineOptions.find((o) => o.povId === povId)
      const name = opt?.name?.trim() || '该角色'
      const charMissing = !pulseCharHasSocialAccount(statsByPov[povId])
      onToast(
        charMissing
          ? `「${name}」剧情线尚未生成用户社交，且该角色账号也未生成；补齐时可一并勾选角色`
          : `「${name}」剧情线尚未生成社交，请先补齐`,
      )
      setPlotLineSheetOpen(false)
      openSocialSheet(povId)
    },
    [onToast, openSocialSheet, plotLineOptions, statsByPov],
  )

  const likesReceived = useMemo(
    () => myPosts.reduce((sum, p) => sum + p.likeCount, 0),
    [myPosts],
  )

  const worldName = useMemo(
    () => povOptions.find((o) => o.povId === currentWorldId)?.worldName || '现代都市',
    [currentWorldId, povOptions],
  )

  const socialSeeds = useMemo((): PulseSocialAccountSeed[] => {
    const seeds: PulseSocialAccountSeed[] = [
      {
        key: 'player',
        povId: currentPlayerPovId,
        name: wechatNickname.trim() || '用户',
        wechatNickname: wechatNickname.trim() || '用户',
        avatarUrl: weiboAvatar,
        verified: Boolean(stats.verifyLabel?.trim()),
        roleHint: boundIdentityLabel?.trim()
          ? `用户本人；当前身份：${boundIdentityLabel.trim()}`
          : '微博用户本人',
      },
    ]
    for (const f of friendsList) {
      const rawId = f.povId.startsWith('char:') ? f.povId.slice('char:'.length) : f.povId
      const wx = f.wechatNickname?.trim() || f.name
      seeds.push({
        key: rawId,
        povId: f.povId,
        name: wx,
        wechatNickname: wx,
        avatarUrl: f.avatarUrl,
        verified: true,
        roleHint: f.bio,
      })
    }
    return seeds
  }, [
    boundIdentityLabel,
    currentPlayerPovId,
    friendsList,
    stats.verifyLabel,
    wechatNickname,
    weiboAvatar,
  ])

  const generateSocialAccounts = useCallback(
    async (opts?: SocialAccountsGenerateOptions) => {
      if (socialGenerating) return
      const plotPovId = socialPlotPovId?.trim() || ''
      if (!plotPovId || !socialPlotAnchors.some((a) => a.povId === plotPovId)) {
        window.alert('请先选择要基于哪条角色剧情生成社交数据')
        return
      }

      const overwriteCharPovIds = [
        ...new Set(
          (opts?.overwriteCharPovIds ?? [])
            .map((id) => id.trim())
            .filter((id) => socialPlotAnchors.some((a) => a.povId === id)),
        ),
      ]
      const plotAlreadyGenerated = generatedPlotSet.has(plotPovId)

      // 该线用户社交已有、且未勾选覆盖角色 → 只切线
      if (plotAlreadyGenerated && overwriteCharPovIds.length === 0) {
        const result = setActivePlotCharPov(plotPovId)
        setSocialSheetOpen(false)
        const lineName =
          socialPlotAnchors.find((a) => a.povId === plotPovId)?.name?.trim() || '该角色'
        if (result === 'ok') {
          onToast(`「${lineName}」剧情线已有用户社交，已切换过去`)
        } else {
          onToast(`「${lineName}」剧情线数据异常，请稍后再试`)
        }
        return
      }

      // 角色社交是否已生成过：有则默认只补用户；可按需覆盖所选角色
      const charSocialAlreadyExists = friendsList.some((f) =>
        pulseCharHasSocialAccount(statsByPov[f.povId]),
      )
      const playerPlotOnly = charSocialAlreadyExists || generatedPlotCharPovIds.length > 0
      const skipPlayerWrite = playerPlotOnly && plotAlreadyGenerated
      const overwriteSet = new Set(overwriteCharPovIds)

      setSocialGenerating(true)
      try {
        const characterIds = friendsList
          .map((f) => (f.povId.startsWith('char:') ? f.povId.slice('char:'.length) : ''))
          .filter(Boolean)
        const identityRaw = parsePulsePovId(currentPlayerPovId)?.rawId
        const networkIds = identityRaw
          ? [...new Set([...characterIds, identityRaw])]
          : characterIds
        const relationships = networkIds.length
          ? await personaDb.listRelationshipsInNetwork(networkIds)
          : []

        // 恋人/亲密关系存在 playerNetworkLinks（不进 relationships），必须一并读入
        const rootCandidates = new Set<string>()
        const worldRaw = parsePulsePovId(currentWorldId)?.rawId
        if (worldRaw) rootCandidates.add(worldRaw)
        for (const id of characterIds) rootCandidates.add(id)
        const linkLists = await Promise.all(
          [...rootCandidates].map((id) => personaDb.getPlayerNetworkLinks(id)),
        )
        const playerLinks = []
        const seenLink = new Set<string>()
        for (const list of linkLists) {
          for (const link of list) {
            const key = link.id?.trim() || `${link.characterId}::${link.relationThemToYou}`
            if (seenLink.has(key)) continue
            seenLink.add(key)
            playerLinks.push(link)
          }
        }

        const seedsForAi = playerPlotOnly
          ? socialSeeds.filter((s) => {
              if (s.key === 'player' || s.povId === currentPlayerPovId) {
                return !skipPlayerWrite
              }
              return overwriteSet.has(s.povId)
            })
          : socialSeeds
        if (!seedsForAi.length) {
          throw new Error(
            skipPlayerWrite && overwriteCharPovIds.length === 0
              ? '缺少要写入的账号种子'
              : '缺少用户账号种子，无法生成',
          )
        }

        const seedPovIds = socialSeeds.map((s) => s.povId)
        const needFollowEdges =
          !playerPlotOnly || overwriteCharPovIds.length > 0
        const followEdges = needFollowEdges
          ? mergePulseFollowEdges(
              buildPulseFollowEdgesFromRelationships({
                seedPovIds,
                relationships,
                playerPovId: currentPlayerPovId,
              }),
              buildPulseFollowEdgesFromPlayerLinks({
                seedPovIds,
                playerLinks,
                playerPovId: currentPlayerPovId,
              }),
            )
          : []

        const playerIdentityContext = identityRaw
          ? await loadPulsePlayerIdentityPersonaContext(identityRaw)
          : ''

        const plotAnchor = socialPlotAnchors.find((a) => a.povId === plotPovId)
        const plotCharId = parsePulsePovId(plotPovId)?.rawId || ''
        const needPlayerGen = seedsForAi.some(
          (s) => s.key === 'player' || s.povId === currentPlayerPovId,
        )
        const charSeedsForAi = seedsForAi.filter(
          (s) => s.key !== 'player' && s.povId !== currentPlayerPovId,
        )

        // 剧情锚点语境只给用户批次；角色各自加载本人设，禁止串台
        const [plotAnchorContext, characterPersonaContext] = await Promise.all([
          needPlayerGen && plotCharId
            ? buildTrendingRefContext({
                refCharacters: [
                  {
                    characterId: plotCharId,
                    name: plotAnchor?.name || '角色',
                  },
                ],
                chatRefRounds: 6,
                datingRefRounds: 4,
                includePlayerIdentity: true,
              })
            : Promise.resolve(''),
          charSeedsForAi.length
            ? Promise.all(
                charSeedsForAi.map(async (seed) => {
                  const cid = parsePulsePovId(seed.povId)?.rawId || ''
                  if (!cid) return ''
                  const { personaSummary } = await loadPulseCharacterPersonaContext(cid, {
                    bioMaxChars: 900,
                    worldBookMaxChars: 700,
                    worldBackgroundMaxChars: 400,
                    includeBoundPlayerIdentity: false,
                  })
                  const block = personaSummary.trim()
                  return block ? `### key=${seed.key}\n${block}` : ''
                }),
              ).then((blocks) => blocks.filter(Boolean).join('\n\n'))
            : Promise.resolve(''),
        ])

        const generated = await aiGeneratePulseSocialAccounts({
          apiConfig,
          worldName: worldName,
          accounts: seedsForAi,
          playerIdentityContext,
          plotAnchorName: needPlayerGen ? plotAnchor?.name : undefined,
          plotAnchorContext: needPlayerGen ? plotAnchorContext : undefined,
          characterPersonaContext: characterPersonaContext || undefined,
        })
        const written = applySocialAccountsBundle({
          seeds: seedsForAi,
          generated,
          followEdges,
          plotAnchorCharPovId: plotPovId,
          playerPlotOnly,
          overwriteCharPovIds,
          skipPlayerWrite,
        })
        if (!written) {
          throw new Error('写入失败：请确认已进入微博身份视角后再试')
        }
        // 仅覆盖角色时不会写用户、也就不会绑定 active plot，需显式切到所选线
        if (skipPlayerWrite) {
          setActivePlotCharPov(plotPovId)
        }
        setSocialSheetOpen(false)
        const lineName = plotAnchor?.name?.trim() || '所选角色'
        const overwriteN = overwriteCharPovIds.length
        onToast(
          !playerPlotOnly
            ? `已按「${lineName}」剧情生成 ${written} 个社交账号`
            : skipPlayerWrite
              ? `已覆盖 ${overwriteN} 位角色的社交账号`
              : overwriteN > 0
                ? `已补齐「${lineName}」用户社交，并覆盖 ${overwriteN} 位角色`
                : `已补齐「${lineName}」剧情线下的用户社交（角色账号未改动）`,
        )
      } catch (e) {
        window.alert(e instanceof Error ? e.message : '生成失败')
      } finally {
        setSocialGenerating(false)
      }
    },
    [
      apiConfig,
      applySocialAccountsBundle,
      currentPlayerPovId,
      currentWorldId,
      friendsList,
      generatedPlotCharPovIds.length,
      generatedPlotSet,
      onToast,
      setActivePlotCharPov,
      socialGenerating,
      socialPlotAnchors,
      socialPlotPovId,
      socialSeeds,
      statsByPov,
      worldName,
    ],
  )

  const openNickEditor = useCallback(() => {
    setNickDraft(stats.weiboNickname?.trim() || wechatNickname.trim() || '')
    setNickEditorOpen(true)
  }, [stats.weiboNickname, wechatNickname])

  const saveNickname = useCallback(() => {
    const next = nickDraft.trim().slice(0, 24)
    bumpProfileStats(currentPlayerPovId, {
      weiboNickname: next || undefined,
    })
    setNickEditorOpen(false)
    onToast(next ? '微博昵称已更新' : '已恢复为微信昵称展示')
  }, [bumpProfileStats, currentPlayerPovId, nickDraft, onToast])

  const openBioEditor = useCallback(() => {
    setBioDraft(sanitizePulseProfileSignature(stats.bio || ''))
    setBioEditorOpen(true)
  }, [stats.bio])

  const saveBio = useCallback(() => {
    const next = sanitizePulseProfileSignature(bioDraft).trim().slice(0, 120)
    bumpProfileStats(currentPlayerPovId, {
      bio: next || undefined,
    })
    setBioEditorOpen(false)
    onToast(next ? '个性签名已更新' : '个性签名已清空')
  }, [bioDraft, bumpProfileStats, currentPlayerPovId, onToast])

  const onAvatarFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f || !f.type.startsWith('image/')) return
      try {
        const url = await readImageFileAsDataUrl(f)
        bumpProfileStats(currentPlayerPovId, { weiboAvatarUrl: url })
        onToast('微博头像已更新')
      } catch {
        onToast('头像读取失败')
      }
    },
    [bumpProfileStats, currentPlayerPovId, onToast],
  )

  const onCoverFile = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      e.target.value = ''
      if (!f || !f.type.startsWith('image/')) return
      try {
        const url = await readImageFileAsDataUrl(f)
        bumpProfileStats(currentPlayerPovId, { coverUrl: url })
        onToast('背景图已更新')
      } catch {
        onToast('背景图读取失败')
      }
    },
    [bumpProfileStats, currentPlayerPovId, onToast],
  )

  const listPosts = tab === 'posts' ? myPosts : likedPosts

  return (
    <div className="relative flex min-h-0 flex-1 flex-col" style={{ minHeight: 0 }}>
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onAvatarFile(e)}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void onCoverFile(e)}
      />

      {/*
        滚动容器禁止再套 flex-col：子项默认 flex-shrink:1，
        封面 h-52 会被动态列表挤成 0，看起来只剩动态区、整页像卡死。
      */}
      <div
        ref={scrollRef}
        className="relative z-0 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#FCFCFC] pb-28"
        style={{ minHeight: 0, touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="relative h-52 shrink-0 overflow-hidden">
          <Pressable
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="absolute inset-0 block size-full"
            aria-label="更换背景图"
          >
            <motion.img
              src={coverSrc}
              alt=""
              className="absolute inset-0 size-full object-cover"
              style={{ y: coverY, scale: 1.08 }}
              draggable={false}
            />
          </Pressable>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 40%, ${PULSE_COLORS.bg} 100%)`,
            }}
          />
          {onBack ? (
            <Pressable
              type="button"
              onClick={onBack}
              className="absolute left-3 z-10 flex size-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-md"
              style={{ top: 'max(10px, env(safe-area-inset-top, 0px))' }}
              aria-label={backAriaLabel}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M14 6L8 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Pressable>
          ) : null}
          <div
            className="absolute right-3 z-10 flex items-center gap-2"
            style={{ top: 'max(12px, calc(env(safe-area-inset-top, 0px) + 4px))' }}
          >
            <Pressable
              type="button"
              onClick={() => setSettingsSheetOpen(true)}
              className="flex size-8 items-center justify-center rounded-full bg-white/80 text-[#1C1C1E] shadow-[0_2px_15px_rgba(0,0,0,0.06)] backdrop-blur-md"
              aria-label="剧情线设置"
            >
              <Settings2 className="size-3.5" strokeWidth={1.6} />
            </Pressable>
            <Pressable
              type="button"
              onClick={() => openSocialSheet()}
              className="rounded-full bg-white/80 px-3 py-1.5 text-[11px] tracking-wide text-[#1C1C1E] shadow-[0_2px_15px_rgba(0,0,0,0.06)] backdrop-blur-md"
              style={{
                boxShadow: `0 0 24px ${PULSE_COLORS.lightGold}33`,
              }}
              data-pulse-coach="profile-social-btn"
            >
              <span className="flex items-center gap-1">
                <Sparkles className="size-3" strokeWidth={1.4} style={{ color: PULSE_COLORS.lightGold }} />
                生成社交
              </span>
            </Pressable>
            {onStartCoach ? (
              <Pressable
                type="button"
                onClick={onStartCoach}
                className="rounded-full bg-white/80 px-2.5 py-1.5 text-[11px] tracking-wide text-neutral-500 shadow-[0_2px_15px_rgba(0,0,0,0.06)] backdrop-blur-md"
                aria-label="玩法指引"
              >
                玩法
              </Pressable>
            ) : null}
          </div>
        </div>

        <div className="relative px-4">
          <div className="-mt-11">
            <Pressable
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="relative block"
              aria-label="更换微博头像"
            >
              <PulseVerifiedAvatar
                src={weiboAvatar}
                verified={Boolean(stats.verifyLabel?.trim())}
                sizeClass="size-[88px]"
                className="-translate-y-1/2 shadow-[0_2px_15px_rgba(0,0,0,0.06)]"
              />
            </Pressable>
          </div>

          <div className="-mt-2 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
            <Pressable type="button" onClick={openNickEditor} className="min-w-0 max-w-full text-left">
              <h1 className="truncate text-[20px] font-semibold text-[#1C1C1E]">{weiboDisplayName}</h1>
            </Pressable>
            {boundIdentityLabel ? (
              <span className="shrink-0 text-[13px] text-neutral-400">（绑定身份：{boundIdentityLabel}）</span>
            ) : null}
            {onSwitchIdentity ? (
              <Pressable
                type="button"
                onClick={onSwitchIdentity}
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-400"
                aria-label="切换身份"
              >
                <ChevronDown className="size-4" strokeWidth={1.8} />
              </Pressable>
            ) : null}
          </div>

          {plotLineOptions.length > 0 ? (
            <Pressable
              type="button"
              onClick={() => setPlotLineSheetOpen(true)}
              className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-[#F4F4F5] px-2.5 py-1 text-left"
              aria-label="切换角色剧情线"
            >
              <span className="truncate text-[12px] text-neutral-600">
                当前剧情线：
                <span className="font-medium text-[#1C1C1E]">
                  {activePlotLineLabel || '未选择'}
                </span>
                {!activePlotCharPov || !generatedPlotSet.has(activePlotCharPov || '') ? (
                  <span className="text-neutral-400">（需生成社交）</span>
                ) : null}
              </span>
              <ChevronDown className="size-3.5 shrink-0 text-neutral-400" strokeWidth={1.8} />
            </Pressable>
          ) : null}

          {stats.verifyLabel?.trim() ? (
            <div className="mt-1.5 flex items-start gap-1.5">
              <ShieldCheck
                className="mt-0.5 size-3.5 shrink-0"
                style={{ color: PULSE_COLORS.lightGold }}
                strokeWidth={1.6}
                aria-hidden
              />
              <p className="min-w-0 text-[12px] leading-snug" style={{ color: '#B8952E' }}>
                {stats.verifyLabel.trim()}
              </p>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-600">
            <Pressable type="button" onClick={() => setOverlay({ kind: 'following' })} className="text-left">
              关注{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{stats.following > 0 ? stats.following : followingList.length}</PulseNum>
              </strong>
            </Pressable>
            <span className="text-neutral-300">|</span>
            <span className="relative inline-flex items-center gap-1">
              粉丝{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{formatPulseCount(stats.followers)}</PulseNum>
              </strong>
              {followersGainLabel ? (
                <Pressable
                  type="button"
                  onClick={dismissFollowersGain}
                  className="ml-0.5 rounded-full bg-[#fa5151] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                  aria-label={`粉丝新增 ${followersGainPending}，点击清除提示`}
                >
                  {followersGainLabel}
                </Pressable>
              ) : null}
            </span>
            <span className="text-neutral-300">|</span>
            <Pressable type="button" onClick={() => setOverlay({ kind: 'friends' })} className="text-left">
              好友{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{friendsList.length}</PulseNum>
              </strong>
            </Pressable>
            <span className="text-neutral-300">|</span>
            <span>
              获赞与收藏{' '}
              <strong className="font-semibold text-[#1C1C1E]">
                <PulseNum>{formatPulseCount(likesReceived)}</PulseNum>
              </strong>
            </span>
          </div>

          <div className="mt-3 flex items-start gap-2">
            <p className="flex-1 font-serif text-[13px] italic leading-relaxed text-neutral-400">
              {sanitizePulseProfileSignature(stats.bio || '') ||
                '在脉冲里，每一句话都是一次呼吸。'}
            </p>
            <Pressable
              type="button"
              onClick={openBioEditor}
              className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-neutral-100 hover:text-neutral-500"
              aria-label="编辑个性签名"
            >
              <Pencil className="size-3.5" strokeWidth={1.3} />
            </Pressable>
          </div>

          <div className="mt-5 flex shadow-[0_2px_15px_rgba(0,0,0,0.03)]">
            {PROFILE_TABS.map(({ id, label }) => {
              const active = tab === id
              return (
                <Pressable
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="relative flex-1 py-3 text-center"
                >
                  <motion.span
                    animate={{ scale: active ? 1 : 0.96, opacity: active ? 1 : 0.5 }}
                    transition={PULSE_TAB_SPRING}
                    className={`text-[14px] ${active ? 'font-semibold text-[#1C1C1E]' : 'text-neutral-400'}`}
                  >
                    {label}
                  </motion.span>
                  {active ? (
                    <motion.span
                      layoutId="pulse-profile-tab"
                      className="absolute inset-x-4 bottom-0 h-[2px] rounded-full"
                      style={{ backgroundColor: PULSE_COLORS.dustyRose }}
                      transition={PULSE_TAB_SPRING}
                    />
                  ) : null}
                </Pressable>
              )
            })}
          </div>

          <div className="mt-4 pb-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={PULSE_TAB_SPRING}
              >
                {listPosts.length ? (
                  <div className="space-y-3">
                    {listPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        currentPovId={currentPlayerPovId}
                        onOpen={() => onOpenPost(post.id)}
                        onLike={() => toggleLike(post.id)}
                        onRepost={() => onRepostPost(post.id)}
                        onEdit={(p) => setEditPost(p)}
                        visibilityNameByPovId={visibilityNameByPovId}
                        compact
                      />
                    ))}
                  </div>
                ) : (
                  <p className="py-12 text-center text-[13px] text-neutral-400">
                    {tab === 'liked' ? '还没有赞过的动态' : '暂无内容'}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      <Pressable
        type="button"
        onClick={() => setEditorOpen(true)}
        className="fixed bottom-24 right-4 z-20 rounded-full px-4 py-3 text-[11px] tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(229,152,155,0.35)]"
        style={{ backgroundColor: PULSE_COLORS.dustyRose }}
        data-pulse-coach="profile-publish-fab"
      >
        + 写微博
      </Pressable>

      <AnimatePresence>
        {nickEditorOpen ? (
          <motion.div
            className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/35 px-5 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNickEditorOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl bg-white px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.14)]"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={PULSE_MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[15px] font-semibold text-[#1C1C1E]">微博昵称</p>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
                与微信昵称独立。留空则展示微信昵称「{wechatNickname || '我'}」。
              </p>
              <input
                value={nickDraft}
                onChange={(e) => setNickDraft(e.target.value.slice(0, 24))}
                maxLength={24}
                placeholder={wechatNickname || '输入微博昵称'}
                className="mt-4 w-full rounded-2xl border border-black/[0.06] bg-[#F7F6F5] px-4 py-3 text-[14px] text-[#1C1C1E] outline-none focus:border-black/15"
                autoFocus
              />
              <div className="mt-4 flex gap-2">
                <Pressable
                  type="button"
                  onClick={() => setNickEditorOpen(false)}
                  className="flex-1 rounded-full bg-[#F5F5F4] py-2.5 text-[13px] text-neutral-600"
                >
                  取消
                </Pressable>
                <Pressable
                  type="button"
                  onClick={saveNickname}
                  className="flex-1 rounded-full bg-[#1C1C1E] py-2.5 text-[13px] text-white"
                >
                  保存
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {bioEditorOpen ? (
          <motion.div
            className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/35 px-5 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBioEditorOpen(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-3xl bg-white px-5 py-5 shadow-[0_16px_48px_rgba(0,0,0,0.14)]"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={PULSE_MODAL_SPRING}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-[15px] font-semibold text-[#1C1C1E]">个性签名</p>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
                展示在主页资料区，纯文字，最多 120 字。
              </p>
              <textarea
                value={bioDraft}
                onChange={(e) =>
                  setBioDraft(sanitizePulseProfileSignature(e.target.value).slice(0, 120))
                }
                maxLength={120}
                rows={4}
                placeholder="写一句想给大家看到的签名…"
                className="mt-4 w-full resize-none rounded-2xl border border-black/[0.06] bg-[#F7F6F5] px-4 py-3 text-[14px] leading-relaxed text-[#1C1C1E] outline-none focus:border-black/15"
                autoFocus
              />
              <p className="mt-1.5 text-right font-mono text-[10px] tabular-nums text-neutral-300">
                {bioDraft.length}/120
              </p>
              <div className="mt-3 flex gap-2">
                <Pressable
                  type="button"
                  onClick={() => setBioEditorOpen(false)}
                  className="flex-1 rounded-full bg-[#F5F5F4] py-2.5 text-[13px] text-neutral-600"
                >
                  取消
                </Pressable>
                <Pressable
                  type="button"
                  onClick={saveBio}
                  className="flex-1 rounded-full bg-[#1C1C1E] py-2.5 text-[13px] text-white"
                >
                  保存
                </Pressable>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {editorOpen || editPost ? (
        <PublishEditor
          authorPovId={currentPlayerPovId}
          authorName={weiboDisplayName}
          authorAvatarUrl={weiboAvatar}
          mentionCandidates={mentionCandidates}
          visibilityCandidates={visibilityCandidates}
          editPost={editPost}
          onClose={() => {
            setEditorOpen(false)
            setEditPost(null)
          }}
          onPublished={() => {
            setEditorOpen(false)
            setEditPost(null)
          }}
          onToast={onToast}
        />
      ) : null}

      <AnimatePresence>
        {socialSheetOpen ? (
          <PulseSocialAccountsGenerateSheet
            playerName={weiboDisplayName}
            friendCount={friendsList.length}
            plotAnchors={socialPlotAnchors}
            selectedPlotPovId={socialPlotPovId}
            onSelectPlot={setSocialPlotPovId}
            generating={socialGenerating}
            onClose={() => !socialGenerating && setSocialSheetOpen(false)}
            onGenerate={(opts) => void generateSocialAccounts(opts)}
            playerPlotOnly={
              coachDemoSocialOverwrite ||
              generatedPlotCharPovIds.length > 0 ||
              friendsList.some((f) => pulseCharHasSocialAccount(statsByPov[f.povId]))
            }
            coachDemoOverwrite={coachDemoSocialOverwrite}
            selectedPlotAlreadyGenerated={Boolean(
              socialPlotPovId && generatedPlotSet.has(socialPlotPovId),
            )}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {plotLineSheetOpen ? (
          <PulsePlotLineSwitchSheet
            options={plotLineOptions}
            activePovId={activePlotCharPov}
            onSelect={handleSelectPlotLine}
            onClose={() => setPlotLineSheetOpen(false)}
            onRequestGenerate={handleRequestGeneratePlotLine}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {settingsSheetOpen ? (
          <PulseProfileSettingsSheet
            fusionMode={fusionMode}
            onToggleFusion={(next) => {
              setFusionMode(next)
              onToast(next ? '已开启融合模式' : '已关闭融合模式')
            }}
            onClose={() => setSettingsSheetOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay && overlay.kind === 'following' ? (
          <PulseFollowingList
            ownerName={weiboDisplayName}
            following={followingList.map((u) => enrichFollowingUser(u, povOptions, statsByPov))}
            currentPlayerPovId={currentPlayerPovId}
            onBack={() => setOverlay(null)}
            onOpenUser={(user) =>
              setOverlay({
                kind: 'user',
                from: 'following',
                user: enrichFollowingUser(user, povOptions, statsByPov),
              })
            }
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay && overlay.kind === 'friends' ? (
          <PulseFollowingList
            ownerName={weiboDisplayName}
            listLabel="好友"
            emptyText="通讯录里还没有好友"
            following={friendsList}
            currentPlayerPovId={currentPlayerPovId}
            onBack={() => setOverlay(null)}
            onOpenUser={(user) =>
              setOverlay({
                kind: 'user',
                from: 'friends',
                user: enrichFollowingUser(user, povOptions, statsByPov),
              })
            }
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {overlay?.kind === 'user' ? (
          <PulseUserProfileView
            user={overlay.user}
            currentPlayerPovId={currentPlayerPovId}
            onBack={() => setOverlay({ kind: overlay.from })}
            onOpenPost={onOpenPost}
            onRepostPost={onRepostPost}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
