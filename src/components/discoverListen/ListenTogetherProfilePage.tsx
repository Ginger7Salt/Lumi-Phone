import { motion } from 'framer-motion'
import { ArrowLeft, Heart, History, Loader2, Music2, RefreshCw, User } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { ListenTogetherAvatarSourceSheet } from './ListenTogetherAvatarSourceSheet'
import { ListenNotesFeedList } from './ListenTogetherNotesFeedPage'
import { ListenTogetherTabUnderDev } from './ListenTogetherTabUnderDev'
import {
  ListenTogetherRecentPlayHistoryPage,
} from './ListenTogetherRecentPlayHistoryPage'
import { useListenTogetherUserAvatar } from './useListenTogetherUserAvatar'
import { ListenNum, ListenNumericText } from './ListenNum'
import { listenNumClass, listenNumStatClass } from './listenTogetherTypography'
import { NOTES_FEED_MOCK, type ListenAttachedMusic } from './listenTogetherNotesMock'
import { getNeteaseApiBase } from './neteaseApiClient'
import type { NeteaseProfileBundle } from './neteaseProfileApi'
import {
  ListenTogetherFollowListPage,
  type ListenTogetherFollowListTarget,
} from './ListenTogetherFollowListPage'
import type { NeteaseArtistItem, NeteaseSongItem } from './neteaseMusicApi'
import {
  formatListenPlayHistoryTime,
  LISTEN_PLAY_HISTORY_CHANGED,
  listListenPlayHistory,
  type ListenPlayHistoryEntry,
} from './listenTogetherPlayHistory'
import type { PlaylistOpenInfo, UserDetailInfo } from './listenTogetherProfileTypes'

type ProfileTab = 'created' | 'saved' | 'notes'

/** 改 false 恢复「我的」页手账 Tab */
const LISTEN_PROFILE_NOTES_UNDER_DEV = true

function AvatarCornerBadges({ vipLabel, isVip }: { vipLabel: string; isVip: boolean }) {
  return (
    <div className="absolute -bottom-0.5 -right-0.5 z-10 max-w-[88px]">
      <span
        className={`inline-block max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none shadow-md ring-2 ring-white ${
          isVip
            ? 'bg-gradient-to-r from-rose-400 to-red-400 text-white'
            : 'bg-stone-100 text-stone-500'
        }`}
        title={vipLabel}
      >
        {isVip ? <ListenNumericText text={vipLabel} /> : '非会员'}
      </span>
    </div>
  )
}

function PlaylistCard({
  title,
  count,
  cover,
  onClick,
}: {
  title: string
  count: number
  cover: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group overflow-hidden rounded-2xl bg-white/80 text-left shadow-[0_8px_30px_rgba(120,113,108,0.08)] ring-1 ring-stone-100/80 transition-transform active:scale-[0.98]"
    >
      <div className="relative aspect-square overflow-hidden bg-stone-100">
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-200 to-stone-300">
            <Music2 className="size-8 text-stone-400/80" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <div className="absolute inset-0 bg-stone-900/10 transition-colors group-hover:bg-stone-900/20" />
      </div>
      <div className="px-2.5 py-2.5">
        <p className="line-clamp-1 text-[13px] font-medium text-stone-800">
          <ListenNumericText text={title} />
        </p>
        <p className={`mt-0.5 text-[11px] text-stone-400 ${listenNumClass}`}>
          <ListenNum>{count.toLocaleString()}</ListenNum> 首
        </p>
      </div>
    </button>
  )
}

const EMPTY_VIP = {
  vipType: 0,
  vipLevel: 0,
  isVip: false,
  vipLabel: '未开通会员',
} as const

const GUEST_USER = {
  nickname: '未登录',
  avatar: null as string | null,
  neteaseLevel: 0,
  following: 0,
  followers: 0,
  listenHours: 0,
  listenSongs: 0,
  vip: EMPTY_VIP,
}

const VISITOR_USER = {
  nickname: '游客',
  avatar: null as string | null,
  neteaseLevel: 0,
  following: 0,
  followers: 0,
  listenHours: 0,
  listenSongs: 0,
  vip: EMPTY_VIP,
}

function ProfilePlaylistGrid({
  playlists,
  emptyHint,
  neteaseBound,
  onRequestLogin,
  onOpenPlaylist,
}: {
  playlists: Array<{ id: number; title: string; count: number; cover: string }>
  emptyHint: string
  neteaseBound: boolean
  onRequestLogin?: () => void
  onOpenPlaylist?: (playlist: PlaylistOpenInfo) => void
}) {
  if (playlists.length === 0) {
    return <p className="py-6 text-center text-[12px] text-stone-400">{emptyHint}</p>
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {playlists.map((pl) => (
        <PlaylistCard
          key={pl.id}
          title={pl.title}
          count={pl.count}
          cover={pl.cover || ''}
          onClick={() => {
            if (!neteaseBound) {
              onRequestLogin?.()
              return
            }
            if (pl.id) {
              onOpenPlaylist?.({
                id: pl.id,
                title: pl.title,
                cover: pl.cover,
                count: pl.count,
              })
            }
          }}
        />
      ))}
    </div>
  )
}

export type { PlaylistOpenInfo } from './listenTogetherProfileTypes'

export type ListenTogetherProfilePageProps = {
  className?: string
  onBack?: () => void
  onOpenPlaylist?: (playlist: PlaylistOpenInfo) => void
  onPlayAttachedMusic?: (music: ListenAttachedMusic, noteId: string) => void
  neteaseBound?: boolean
  isGuestMode?: boolean
  onRequestLogin?: () => void
  onLeaveGuest?: () => void
  neteaseProfile?: NeteaseProfileBundle | null
  profileLoading?: boolean
  profileError?: string | null
  profileFromCache?: boolean
  onSyncNetease?: () => void
  syncingNetease?: boolean
  cookie?: string
  onOpenArtist?: (artist: NeteaseArtistItem) => void
  onOpenUser?: (user: UserDetailInfo) => void
  onPlaySong?: (song: NeteaseSongItem, queue: NeteaseSongItem[], index: number) => void
}

export function ListenTogetherProfilePage({
  className = '',
  onBack,
  onOpenPlaylist,
  onPlayAttachedMusic,
  neteaseBound = false,
  isGuestMode = false,
  onRequestLogin,
  onLeaveGuest,
  neteaseProfile = null,
  profileLoading = false,
  profileError = null,
  profileFromCache = false,
  onSyncNetease,
  syncingNetease = false,
  cookie = '',
  onOpenArtist,
  onOpenUser,
  onPlaySong,
}: ListenTogetherProfilePageProps) {
  const [profileTab, setProfileTab] = useState<ProfileTab>('created')
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false)
  const [recentHistoryOpen, setRecentHistoryOpen] = useState(false)
  const [recentHistory, setRecentHistory] = useState<ListenPlayHistoryEntry[]>([])
  const profileRootRef = useRef<HTMLDivElement>(null)
  const pendingScrollTopRef = useRef<number | null>(null)
  const [followListTarget, setFollowListTarget] = useState<ListenTogetherFollowListTarget | null>(
    null,
  )
  const {
    avatar: displayAvatar,
    source: avatarSource,
    setAvatarSource,
    wechatAvatar,
    neteaseAvatar,
  } = useListenTogetherUserAvatar(neteaseProfile?.user.avatar)

  useEffect(() => {
    let cancelled = false
    const reload = async () => {
      const entries = await listListenPlayHistory()
      if (!cancelled) setRecentHistory(entries)
    }
    void reload()
    const onChanged = () => {
      void reload()
    }
    window.addEventListener(LISTEN_PLAY_HISTORY_CHANGED, onChanged)
    return () => {
      cancelled = true
      window.removeEventListener(LISTEN_PLAY_HISTORY_CHANGED, onChanged)
    }
  }, [])

  const latestRecentEntry = recentHistory[0] ?? null

  const selectProfileTab = useCallback((tab: ProfileTab) => {
    const scrollEl = profileRootRef.current?.parentElement
    if (scrollEl) pendingScrollTopRef.current = scrollEl.scrollTop
    setProfileTab(tab)
  }, [])

  const clampProfileScroll = useCallback(() => {
    const scrollEl = profileRootRef.current?.parentElement
    if (!scrollEl) return
    const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight)
    if (scrollEl.scrollTop > maxScroll) {
      scrollEl.scrollTop = maxScroll
    }
  }, [])

  const myNotes = useMemo(
    () => NOTES_FEED_MOCK.notes.filter((note) => note.author.type === 'user'),
    [],
  )

  const user = !neteaseBound
    ? isGuestMode
      ? VISITOR_USER
      : GUEST_USER
    : neteaseProfile
      ? {
          nickname: neteaseProfile.user.nickname,
          avatar: neteaseProfile.user.avatar,
          neteaseLevel: neteaseProfile.user.neteaseLevel,
          following: neteaseProfile.user.following,
          followers: neteaseProfile.user.followers,
          listenHours: neteaseProfile.user.listenHours,
          listenSongs: neteaseProfile.user.listenSongs,
          vip: neteaseProfile.user.vip,
        }
      : {
          nickname: '网易云用户',
          avatar: null,
          neteaseLevel: 0,
          following: 0,
          followers: 0,
          listenHours: 0,
          listenSongs: 0,
          vip: EMPTY_VIP,
        }

  const listenStat =
    user.listenHours > 0
      ? { value: user.listenHours.toLocaleString(), suffix: '小时' as const }
      : user.listenSongs > 0
        ? { value: user.listenSongs.toLocaleString(), suffix: '首' as const }
        : { value: '0', suffix: '小时' as const }

  const apiHostLabel = useMemo(() => {
    try {
      return new URL(getNeteaseApiBase()).host
    } catch {
      return getNeteaseApiBase()
    }
  }, [])

  const musicAssets = neteaseProfile
    ? {
        likedSongs: neteaseProfile.likedSongs,
        createdPlaylists: neteaseProfile.createdPlaylists,
        savedPlaylists: neteaseProfile.savedPlaylists,
      }
    : {
        likedSongs: { id: 0, title: '我喜欢的音乐', count: 0, cover: '' },
        createdPlaylists: [],
        savedPlaylists: [],
      }

  const likedCover = musicAssets.likedSongs.cover || null

  const emptyHint = !neteaseBound
    ? isGuestMode
      ? '游客模式不同步个人歌单'
      : '登录网易云后查看'
    : profileLoading
      ? '加载中…'
      : '暂无数据'

  useLayoutEffect(() => {
    const scrollEl = profileRootRef.current?.parentElement
    if (!scrollEl) return
    if (pendingScrollTopRef.current !== null) {
      scrollEl.scrollTop = pendingScrollTopRef.current
      pendingScrollTopRef.current = null
    }
    clampProfileScroll()
  }, [
    profileTab,
    clampProfileScroll,
    musicAssets.createdPlaylists,
    musicAssets.savedPlaylists,
    myNotes,
    neteaseBound,
    profileLoading,
  ])

  const openFollowList = (listKind: 'following' | 'followers') => {
    if (!neteaseBound) {
      onRequestLogin?.()
      return
    }
    const userId = neteaseProfile?.user.userId
    if (!userId) return
    setFollowListTarget({
      listKind,
      subject: {
        type: 'user',
        userId,
        title: user.nickname,
      },
    })
  }

  const handleOpenArtistFromList = (artist: NeteaseArtistItem) => {
    setFollowListTarget(null)
    onOpenArtist?.(artist)
  }

  const handleOpenUserFromList = (next: UserDetailInfo) => {
    setFollowListTarget(null)
    onOpenUser?.(next)
  }

  return (
    <div ref={profileRootRef} className={`bg-stone-50 ${className}`}>
      {/* 1. Profile header ~25vh */}
      <section className="relative overflow-hidden bg-gradient-to-b from-rose-100/50 to-stone-50 px-4 pb-8 pt-[max(16px,env(safe-area-inset-top))]">
        {onBack ? (
          <button
            type="button"
            aria-label="返回发现页"
            onClick={onBack}
            className="absolute left-3 top-[max(12px,env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/50 text-stone-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80"
          >
            <ArrowLeft className="size-5" strokeWidth={1.5} />
          </button>
        ) : null}
        {neteaseBound && onSyncNetease ? (
          <button
            type="button"
            aria-label="刷新"
            title="刷新网易云资料与歌单"
            onClick={onSyncNetease}
            disabled={syncingNetease}
            className="absolute right-3 top-[max(12px,env(safe-area-inset-top))] z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/50 text-stone-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80 hover:text-rose-500 disabled:opacity-60"
          >
            <RefreshCw
              className={`size-4 ${syncingNetease ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
          </button>
        ) : null}
        <div
          className="pointer-events-none absolute -right-8 -top-12 h-40 w-40 rounded-full bg-rose-200/30 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col items-center pt-6">
          <div className="relative">
            <button
              type="button"
              aria-label="切换头像来源"
              title="点击切换微信或网易云头像"
              onClick={() => setAvatarSheetOpen(true)}
              className="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={user.nickname}
                  className="h-[88px] w-[88px] rounded-full object-cover bg-white shadow-[0_12px_40px_rgba(120,113,108,0.15)] ring-4 ring-white/60 transition-transform group-active:scale-[0.98]"
                />
              ) : (
                <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-stone-200/80 shadow-[0_12px_40px_rgba(120,113,108,0.12)] ring-4 ring-white/60 transition-transform group-active:scale-[0.98]">
                  <User className="size-10 text-stone-400" strokeWidth={1.5} aria-hidden />
                </div>
              )}
              <span className="absolute inset-0 rounded-full bg-stone-900/0 transition-colors group-hover:bg-stone-900/5" />
            </button>
            {neteaseBound && !profileLoading ? (
              <AvatarCornerBadges vipLabel={user.vip.vipLabel} isVip={user.vip.isVip} />
            ) : null}
          </div>
          <p className="mt-2 text-[10px] text-stone-400">
            点击头像切换为{avatarSource === 'wechat' ? '微信' : '网易云'}头像
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <h1 className="text-[22px] font-medium tracking-wide text-stone-800">
              <ListenNumericText text={user.nickname} />
            </h1>
          </div>
          <p className="mt-1 text-[11px] tracking-[0.2em] text-stone-400">LISTEN · BOND</p>
          {!neteaseBound ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onRequestLogin}
                className="rounded-full bg-rose-50 px-4 py-1.5 text-[12px] text-rose-500"
              >
                {isGuestMode ? '登录网易云账号' : '登录网易云'}
              </button>
              {isGuestMode && onLeaveGuest ? (
                <button
                  type="button"
                  onClick={onLeaveGuest}
                  className="rounded-full bg-stone-100 px-4 py-1.5 text-[12px] text-stone-600"
                >
                  退出游客模式
                </button>
              ) : null}
            </div>
          ) : null}
          {isGuestMode && !neteaseBound ? (
            <p className="mt-2 max-w-[280px] text-center text-[11px] leading-relaxed text-stone-400">
              游客可搜索与播放公开内容；登录后可同步「我喜欢的音乐」与个人歌单
            </p>
          ) : null}
          {profileLoading || syncingNetease ? (
            <p className="mt-2 flex flex-col items-center justify-center gap-0.5 text-[11px] text-stone-400">
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" aria-hidden />
                {syncingNetease ? '正在同步网易云最新数据…' : '正在同步网易云资料…'}
              </span>
              <span className="text-[10px] text-stone-300">
                API · <ListenNumericText text={apiHostLabel} />
              </span>
            </p>
          ) : profileFromCache && neteaseBound ? (
            <p className="mt-2 text-center text-[10px] text-stone-400">
              资料来自本地缓存 · 点击右上角刷新可同步
              <span className="block text-stone-300">
                API · <ListenNumericText text={apiHostLabel} />
              </span>
            </p>
          ) : null}
          {profileError ? (
            <p className="mt-2 text-center text-[11px] text-rose-400">{profileError}</p>
          ) : null}

          <div className="mt-8 grid w-full max-w-[360px] grid-cols-4 gap-1">
            {(
              [
                { label: '关注', value: user.following.toLocaleString(), suffix: '' },
                { label: '粉丝', value: user.followers.toLocaleString(), suffix: '' },
                {
                  label: '累计听歌',
                  value: listenStat.value,
                  suffix: listenStat.suffix,
                },
                {
                  label: '听歌等级',
                  value: user.neteaseLevel > 0 ? `Lv.${user.neteaseLevel}` : '—',
                  suffix: '',
                },
              ] as const
            ).map((item) => (
              <button
                key={item.label}
                type="button"
                disabled={item.label !== '关注' && item.label !== '粉丝'}
                onClick={() => {
                  if (item.label === '关注') openFollowList('following')
                  if (item.label === '粉丝') openFollowList('followers')
                }}
                className={`text-center ${
                  item.label === '关注' || item.label === '粉丝'
                    ? 'rounded-xl px-1 py-1 transition-colors hover:bg-white/60 active:scale-[0.98]'
                    : ''
                }`}
              >
                <p className={`${listenNumStatClass} text-[15px] text-stone-800 sm:text-base`}>
                  {item.label === '听歌等级' ? (
                    <ListenNumericText text={item.value} />
                  ) : (
                    <ListenNum>{item.value}</ListenNum>
                  )}
                  {item.suffix ? (
                    <span className="ml-0.5 text-[11px] font-normal text-stone-500 sm:text-xs">
                      {item.suffix}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-[10px] text-stone-400 sm:text-xs">{item.label}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="space-y-8 px-4 pb-32">
        <section className="space-y-4" aria-label="音乐资产">
          <button
            type="button"
            onClick={() => {
              if (!neteaseBound) {
                onRequestLogin?.()
                return
              }
              const liked = musicAssets.likedSongs
              if (liked.id) {
                onOpenPlaylist?.({
                  id: liked.id,
                  title: liked.title || '我喜欢的音乐',
                  cover: liked.cover,
                  count: liked.count,
                })
              }
            }}
            className="flex w-full overflow-hidden rounded-2xl bg-white/80 text-left shadow-[0_12px_40px_rgba(120,113,108,0.1)] ring-1 ring-stone-100/80 transition-transform active:scale-[0.99]"
          >
            <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center bg-stone-100">
              {likedCover ? (
                <img src={likedCover} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <Heart className="size-8 text-stone-300" strokeWidth={1.5} />
              )}
              <div className="absolute inset-0 bg-stone-900/10" />
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-400 shadow-sm">
                <Heart className="size-3.5 fill-current" strokeWidth={0} />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
              <p className="text-[16px] font-medium text-stone-800">我喜欢的音乐</p>
              <p className={`mt-1 text-[13px] text-stone-400 ${listenNumClass}`}>
                {neteaseBound ? (
                  <>
                    <ListenNum>{musicAssets.likedSongs.count.toLocaleString()}</ListenNum> 首
                  </>
                ) : (
                  emptyHint
                )}
              </p>
              {neteaseBound ? (
                <p className="mt-2 text-[11px] text-rose-400/90">快速进入红心歌单 →</p>
              ) : null}
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRecentHistoryOpen(true)}
            className="flex w-full overflow-hidden rounded-2xl bg-white/80 text-left shadow-[0_12px_40px_rgba(120,113,108,0.1)] ring-1 ring-stone-100/80 transition-transform active:scale-[0.99]"
          >
            <div className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center bg-gradient-to-br from-[#FFF0F3] to-stone-100">
              {latestRecentEntry?.cover ? (
                <img
                  src={latestRecentEntry.cover}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <History className="size-8 text-rose-300" strokeWidth={1.5} aria-hidden />
              )}
              <div className="absolute inset-0 bg-stone-900/10" />
              <span className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-rose-400 shadow-sm">
                <History className="size-3.5" strokeWidth={1.75} aria-hidden />
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center px-4 py-3">
              <p className="text-[16px] font-medium text-stone-800">最近播放</p>
              <p className={`mt-1 text-[13px] text-stone-400 ${listenNumClass}`}>
                {recentHistory.length > 0 ? (
                  <>
                    <ListenNum>{recentHistory.length.toLocaleString()}</ListenNum> 首记录
                  </>
                ) : (
                  '暂无播放记录'
                )}
              </p>
              {latestRecentEntry ? (
                <p className="mt-2 line-clamp-1 text-[11px] text-rose-400/90">
                  最近：
                  <ListenNumericText text={latestRecentEntry.name} />
                  <span className={`ml-1 text-stone-400 ${listenNumClass}`}>
                    · {formatListenPlayHistoryTime(latestRecentEntry.playedAtMs)}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-stone-400">播放过的歌曲会记录在这里 →</p>
              )}
            </div>
          </button>

          <div className="overflow-hidden">
            <div
              className="mb-4 grid w-full grid-cols-3 overflow-hidden"
              role="tablist"
              aria-label="歌单与手账"
            >
              {(
                [
                  { id: 'created' as const, label: '创建的歌单' },
                  { id: 'saved' as const, label: '收藏的歌单' },
                  { id: 'notes' as const, label: '手账' },
                ]
              ).map((tab) => {
                const active = profileTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectProfileTab(tab.id)}
                    className={`relative min-w-0 px-1 pb-2 text-center text-[13px] font-medium transition-colors sm:text-[14px] ${
                      active ? 'text-stone-800' : 'text-stone-400'
                    }`}
                  >
                    <span className="block truncate">{tab.label}</span>
                    {active ? (
                      <motion.span
                        layoutId="profile-playlist-tab"
                        className="absolute -bottom-0.5 left-2 right-2 h-0.5 rounded-full bg-rose-300"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div>
              <div role="tabpanel" hidden={profileTab !== 'created'}>
                <ProfilePlaylistGrid
                  playlists={musicAssets.createdPlaylists}
                  emptyHint={emptyHint}
                  neteaseBound={neteaseBound}
                  onRequestLogin={onRequestLogin}
                  onOpenPlaylist={onOpenPlaylist}
                />
              </div>
              <div role="tabpanel" hidden={profileTab !== 'saved'}>
                <ProfilePlaylistGrid
                  playlists={musicAssets.savedPlaylists}
                  emptyHint={emptyHint}
                  neteaseBound={neteaseBound}
                  onRequestLogin={onRequestLogin}
                  onOpenPlaylist={onOpenPlaylist}
                />
              </div>
              <div role="tabpanel" hidden={profileTab !== 'notes'}>
                {LISTEN_PROFILE_NOTES_UNDER_DEV ? (
                  <ListenTogetherTabUnderDev
                    title="功能开发中"
                    hint="听歌手账正在开发，你的听歌心得与记录将在此展示。"
                    className="min-h-[240px] px-4 py-8"
                  />
                ) : (
                  <ListenNotesFeedList notes={myNotes} onPlayAttachedMusic={onPlayAttachedMusic} />
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
      <ListenTogetherFollowListPage
        open={followListTarget !== null}
        target={followListTarget}
        cookie={cookie}
        onBack={() => setFollowListTarget(null)}
        onOpenArtist={handleOpenArtistFromList}
        onOpenUser={handleOpenUserFromList}
        onRequireLogin={onRequestLogin}
      />
      <ListenTogetherRecentPlayHistoryPage
        open={recentHistoryOpen}
        onBack={() => setRecentHistoryOpen(false)}
        onPlaySong={onPlaySong}
      />
      <ListenTogetherAvatarSourceSheet
        open={avatarSheetOpen}
        onClose={() => setAvatarSheetOpen(false)}
        source={avatarSource}
        wechatAvatar={wechatAvatar}
        neteaseAvatar={neteaseAvatar}
        onSelect={(next) => {
          void setAvatarSource(next)
        }}
      />
    </div>
  )
}
