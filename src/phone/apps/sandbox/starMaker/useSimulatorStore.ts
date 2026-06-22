import { personaDb } from '../../wechat/newFriendsPersona/idb'
import { create } from 'zustand'
import type { ApiConfig } from '../../api/types'
import {
  AWARD_CATEGORIES,
  buildInitialHotSearches,
  DRAMA_TEMPLATES,
  INITIAL_ROSTER,
  PROLOGUE_QUIZ,
  randomScout,
  SCOUT_POOL,
  SHOP_PROPERTIES,
  SHOP_VEHICLES,
  TRAVEL_DESTINATIONS,
} from './presets'
import {
  fetchArtistChatReply,
  fetchDramaEvent,
  fetchHotSearchAi,
  fetchRandomEventFlavor,
  fetchTravelDiary,
  resolveSimApi,
} from './simulatorAi'
import type {
  Artist,
  ArtistStatKey,
  ChatMessage,
  DayPeriod,
  DramaEffects,
  NewDayNotice,
  PlayerProfile,
  ProducerState,
  SimApiConfig,
  StatDelta,
} from './types'
import {
  ACTIONS_PER_DAY,
  DATE_AFFECTION_THRESHOLD,
  DRAMA_AFFECTION_MIN,
  QUARTER_DAYS,
  RECRUIT_COST,
} from './types'
import type { PlayerStats } from './types'
import {
  buildEmptySaveSlotInfo,
  buildSaveSlotInfo,
  KV_LEGACY_KEY,
  KV_SESSION_KEY,
  SAVE_SLOT_COUNT,
  slotKvKey,
  unwrapSaveRaw,
  wrapSaveArchive,
  type SaveSlotInfo,
} from './saveArchive'
import {
  buildInitialPlayerStats,
  bumpPlayerStats,
  normalizePlayerProfile,
  normalizePlayerStats,
} from './playerCareer'
import {
  appendNegotiatedGig,
  ensureArtistProfile,
  refreshArtistFanReviews,
} from './artistProfileData'

const KV_API = 'star-maker-sim-api-v1'

let persistTimer: ReturnType<typeof setTimeout> | null = null

type Store = ProducerState & {
  hydrated: boolean
  simApi: SimApiConfig
  scoutCandidate: Artist | null
  floatingDeltas: StatDelta[]
  travelDiary: { title: string; lines: string[] } | null
  lastFlavor: string | null
  chatRoomArtistId: string | null
  newDayNotice: NewDayNotice | null
  sessionEpoch: number

  hydrate: () => Promise<void>
  listSaveSlots: () => Promise<SaveSlotInfo[]>
  getCurrentSavePreview: () => SaveSlotInfo
  saveGame: (slotIndex: number) => Promise<SaveSlotInfo>
  loadGame: (slotIndex: number) => Promise<SaveSlotInfo>
  restartGame: () => Promise<void>
  setSimApi: (api: SimApiConfig) => void
  completePrologue: (profile: Omit<PlayerProfile, 'stats'>, answers: Record<string, string>) => void
  selectArtist: (id: string | null) => void
  pushDelta: (label: string, value: string, tone: StatDelta['tone']) => void
  removeDelta: (id: string) => void

  getPeriod: () => DayPeriod
  getDisplayHour: () => number
  getSeasonLabel: () => string
  actionsRemaining: () => number
  canAct: () => boolean

  recruitArtist: () => boolean
  refreshScout: () => void
  negotiateGig: (artistId: string, mainApi: ApiConfig | null) => Promise<boolean>
  promoCampaign: (mainApi: ApiConfig | null) => Promise<boolean>
  trainArtist: (artistId: string, stat: ArtistStatKey) => boolean
  visitSet: (artistId: string, mainApi: ApiConfig | null) => Promise<boolean>
  sendChatMessage: (artistId: string, text: string, mainApi: ApiConfig | null) => Promise<void>
  startDate: (artistId: string) => { title: string; lines: string[] } | null
  buyProperty: (id: string) => boolean
  buyVehicle: (id: string) => boolean
  startTravel: (destId: string, artistId: string | null, mainApi: ApiConfig | null) => Promise<boolean>
  resolveDramaChoice: (choiceId: string) => void
  dismissQuarterlyAwards: () => void
  resolveBirthdayChoice: (mode: 'party' | 'alone') => void
  clearTravelDiary: () => void
  clearLastFlavor: () => void
  regenerateHotSearches: (mainApi: ApiConfig | null, hint?: string) => Promise<void>
  openChatRoom: (artistId: string) => void
  closeChatRoom: () => void
  dismissNewDayNotice: () => void

  findArtistByCharacterId: (characterId: string) => Artist | undefined
  isDateUnlocked: (artistId: string) => boolean
  getAwardResults: () => Array<{ category: string; artistName: string }>
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function buildInitialState(): ProducerState {
  return {
    prologueDone: false,
    player: null,
    funds: 150000,
    reputation: 40,
    assets: { properties: [], vehicles: [] },
    artists: INITIAL_ROSTER.map(ensureArtistProfile),
    scoutPool: SCOUT_POOL.map((a) => ({ ...a })),
    hotSearches: buildInitialHotSearches(),
    chatThreads: {},
    dateUnlockedIds: [],
    gameYear: 1,
    gameMonth: 3,
    gameDay: 1,
    actionsUsedToday: 0,
    totalDays: 0,
    selectedArtistId: INITIAL_ROSTER[0]?.id ?? null,
    pendingDrama: null,
    pendingBirthday: false,
    pendingQuarterlyAwards: false,
    lastAwardDay: 0,
    recentLog: [],
  }
}

function pickPersistableState(store: Store): ProducerState {
  return {
    prologueDone: store.prologueDone,
    player: store.player,
    funds: store.funds,
    reputation: store.reputation,
    assets: store.assets,
    artists: store.artists,
    scoutPool: store.scoutPool,
    hotSearches: store.hotSearches,
    chatThreads: store.chatThreads,
    dateUnlockedIds: store.dateUnlockedIds,
    gameYear: store.gameYear,
    gameMonth: store.gameMonth,
    gameDay: store.gameDay,
    actionsUsedToday: store.actionsUsedToday,
    totalDays: store.totalDays,
    selectedArtistId: store.selectedArtistId,
    pendingDrama: store.pendingDrama,
    pendingBirthday: store.pendingBirthday,
    pendingQuarterlyAwards: store.pendingQuarterlyAwards,
    lastAwardDay: store.lastAwardDay,
    recentLog: store.recentLog,
  }
}

function normalizePersistedState(raw: unknown): ProducerState {
  const base = buildInitialState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<ProducerState>
  const artists =
    Array.isArray(r.artists) && r.artists.length > 0
      ? r.artists.map((a) =>
          ensureArtistProfile({
            ...a,
            resentment: typeof a.resentment === 'number' ? a.resentment : 0,
            stats: a.stats ?? base.artists[0]?.stats,
          }),
        )
      : base.artists.map(ensureArtistProfile)
  return {
    ...base,
    ...r,
    prologueDone: !!r.prologueDone,
    player: normalizePlayerProfile(r.player ?? base.player),
    funds: typeof r.funds === 'number' ? r.funds : base.funds,
    reputation: typeof r.reputation === 'number' ? r.reputation : base.reputation,
    assets: {
      properties: Array.isArray(r.assets?.properties) ? r.assets.properties : [],
      vehicles: Array.isArray(r.assets?.vehicles) ? r.assets.vehicles : [],
    },
    artists,
    scoutPool: Array.isArray(r.scoutPool) && r.scoutPool.length > 0 ? r.scoutPool : base.scoutPool,
    hotSearches:
      Array.isArray(r.hotSearches) && r.hotSearches.length > 0 ? r.hotSearches : base.hotSearches,
    chatThreads: r.chatThreads && typeof r.chatThreads === 'object' ? r.chatThreads : {},
    dateUnlockedIds: Array.isArray(r.dateUnlockedIds) ? r.dateUnlockedIds : [],
    gameYear: typeof r.gameYear === 'number' ? r.gameYear : base.gameYear,
    gameMonth: typeof r.gameMonth === 'number' ? r.gameMonth : base.gameMonth,
    gameDay: typeof r.gameDay === 'number' ? r.gameDay : base.gameDay,
    actionsUsedToday: typeof r.actionsUsedToday === 'number' ? r.actionsUsedToday : 0,
    totalDays: typeof r.totalDays === 'number' ? r.totalDays : 0,
    selectedArtistId: r.selectedArtistId ?? artists[0]?.id ?? null,
    pendingDrama: r.pendingDrama ?? null,
    pendingBirthday: !!r.pendingBirthday,
    pendingQuarterlyAwards: !!r.pendingQuarterlyAwards,
    lastAwardDay: typeof r.lastAwardDay === 'number' ? r.lastAwardDay : 0,
    recentLog: Array.isArray(r.recentLog) ? r.recentLog : [],
  }
}

function schedulePersist(store: Store) {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    void personaDb.setPhoneKv(
      KV_SESSION_KEY,
      wrapSaveArchive(pickPersistableState(store), Date.now()),
    )
  }, 300)
}

function clearEphemeralUi(): Pick<
  Store,
  'floatingDeltas' | 'travelDiary' | 'lastFlavor' | 'chatRoomArtistId' | 'newDayNotice'
> {
  return {
    floatingDeltas: [],
    travelDiary: null,
    lastFlavor: null,
    chatRoomArtistId: null,
    newDayNotice: null,
  }
}

async function flushSessionPersist(store: Store, savedAt = Date.now()) {
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  await personaDb.setPhoneKv(KV_SESSION_KEY, wrapSaveArchive(pickPersistableState(store), savedAt))
}

async function readSessionRaw(): Promise<unknown> {
  let raw = await personaDb.getPhoneKv(KV_SESSION_KEY)
  if (!raw) {
    raw = await personaDb.getPhoneKv(KV_LEGACY_KEY)
    if (raw) {
      await personaDb.setPhoneKv(KV_SESSION_KEY, raw)
    }
  }
  return raw
}

async function readSaveSlotInfo(slotIndex: number): Promise<SaveSlotInfo> {
  const raw = await personaDb.getPhoneKv(slotKvKey(slotIndex))
  if (!raw || typeof raw !== 'object') {
    return buildEmptySaveSlotInfo(slotIndex)
  }
  const { state, savedAt } = unwrapSaveRaw(raw, normalizePersistedState)
  const info = buildSaveSlotInfo(state, savedAt, slotIndex)
  return info.hasValidSave ? info : buildEmptySaveSlotInfo(slotIndex)
}

async function listAllSaveSlots(): Promise<SaveSlotInfo[]> {
  const slots: SaveSlotInfo[] = []
  for (let i = 0; i < SAVE_SLOT_COUNT; i += 1) {
    slots.push(await readSaveSlotInfo(i))
  }
  return slots
}

function periodFromActionIndex(used: number): DayPeriod {
  if (used < 2) return 'morning'
  if (used < 4) return 'afternoon'
  return 'evening'
}

function hourFromActionIndex(used: number): number {
  const slots = [8, 12, 14, 18, 20, 24]
  return slots[Math.min(used, 5)] ?? 8
}

function seasonFromMonth(m: number): string {
  if (m >= 3 && m <= 5) return '春'
  if (m >= 6 && m <= 8) return '夏'
  if (m >= 9 && m <= 11) return '秋'
  return '冬'
}

function advanceCalendar(state: ProducerState): Partial<ProducerState> {
  let { gameDay, gameMonth, gameYear, totalDays } = state
  const actionsUsedToday = 0
  gameDay += 1
  totalDays += 1
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (gameDay > daysInMonth[gameMonth - 1]) {
    gameDay = 1
    gameMonth += 1
  }
  if (gameMonth > 12) {
    gameMonth = 1
    gameYear += 1
  }

  const patch: Partial<ProducerState> = { gameDay, gameMonth, gameYear, totalDays, actionsUsedToday }

  if (totalDays > 0 && totalDays % QUARTER_DAYS === 0 && state.lastAwardDay !== totalDays) {
    patch.pendingQuarterlyAwards = true
    patch.lastAwardDay = totalDays
  }

  const bd = state.player?.birthdayMD
  if (bd) {
    const [bm, bdDay] = bd.split('-').map(Number)
    if (bm === gameMonth && bdDay === gameDay) {
      patch.pendingBirthday = true
    }
  }

  return patch
}

function buildStaticDrama(state: ProducerState) {
  const secrets = state.artists.filter(
    (a) => a.status === 'secret_dating' && a.affection >= DRAMA_AFFECTION_MIN,
  )
  if (secrets.length < 2) return null
  const template = DRAMA_TEMPLATES[Math.floor(Math.random() * DRAMA_TEMPLATES.length)]
  const [a, b] = secrets.slice(0, 2)
  const choices = template.choices.map((c) => {
    const effects = { ...c.effects }
    if (c.id === 'calm') {
      effects.affection = { [a.id]: 3, [b.id]: 3 }
      effects.resentment = { [a.id]: -5, [b.id]: -5 }
    }
    if (c.id === 'lie') {
      effects.resentment = { [a.id]: 8, [b.id]: 8 }
    }
    if (c.id === 'public' || c.id === 'admit') {
      effects.setStatus = { [a.id]: 'public_romance' }
      effects.fans = { [a.id]: -80000 }
      effects.commercial = { [a.id]: -15 }
      effects.affection = { [a.id]: 15 }
      effects.clearDrama = true
    }
    if (c.id === 'press') {
      effects.funds = -15000
      effects.resentment = { [a.id]: 5 }
    }
    return { ...c, effects }
  })
  return { id: uid(), title: template.title, lines: template.lines, choices }
}

async function rollDrama(state: ProducerState, simApi: SimApiConfig, mainApi: ApiConfig | null) {
  const secrets = state.artists.filter(
    (a) => a.status === 'secret_dating' && a.affection >= DRAMA_AFFECTION_MIN,
  )
  if (secrets.length < 2 || Math.random() > 0.45) return buildStaticDrama(state)
  const api = resolveSimApi(simApi, mainApi)
  if (!api) return buildStaticDrama(state)
  return fetchDramaEvent({ api, artistA: secrets[0], artistB: secrets[1] })
}

function applyDramaEffects(
  artists: Artist[],
  effects: DramaEffects,
  state: Pick<ProducerState, 'funds' | 'reputation'>,
) {
  let funds = state.funds
  let reputation = state.reputation
  if (effects.funds) funds += effects.funds
  if (effects.reputation) reputation = Math.max(0, Math.min(100, reputation + effects.reputation))

  const next = artists.map((a) => {
    let affection = a.affection
    let resentment = a.resentment
    let fans = a.fans
    let status = a.status
    const stats = { ...a.stats }

    if (effects.affection?.[a.id]) affection = Math.min(100, affection + effects.affection[a.id])
    if (effects.resentment?.[a.id]) resentment = Math.max(0, Math.min(100, resentment + effects.resentment[a.id]))
    if (effects.fans?.[a.id]) fans = Math.max(0, fans + effects.fans[a.id])
    if (effects.commercial?.[a.id]) {
      stats.commercial = Math.max(0, Math.min(99, stats.commercial + effects.commercial[a.id]))
    }
    if (effects.setStatus?.[a.id]) status = effects.setStatus[a.id]

    return { ...a, affection, resentment, fans, status, stats }
  })

  return { artists: next, funds, reputation }
}

function bumpAction(state: ProducerState): {
  patch: Partial<ProducerState>
  newDayNotice: NewDayNotice | null
} {
  const used = state.actionsUsedToday + 1
  if (used >= ACTIONS_PER_DAY) {
    const patch = { actionsUsedToday: 0, ...advanceCalendar({ ...state, actionsUsedToday: used }) }
    const month = patch.gameMonth ?? state.gameMonth
    return {
      patch,
      newDayNotice: {
        gameYear: patch.gameYear ?? state.gameYear,
        gameMonth: month,
        gameDay: patch.gameDay ?? state.gameDay,
        season: seasonFromMonth(month),
      },
    }
  }
  return { patch: { actionsUsedToday: used }, newDayNotice: null }
}

function applyActionAdvance(state: ProducerState): Partial<ProducerState> & { newDayNotice?: NewDayNotice } {
  const { patch, newDayNotice } = bumpAction(state)
  return newDayNotice ? { ...patch, newDayNotice } : patch
}

function withPlayerStatBump(player: ProducerState['player'], delta: Partial<PlayerStats>) {
  if (!player) return player
  return {
    ...player,
    stats: bumpPlayerStats(normalizePlayerStats(player.stats), delta),
  }
}

export function computeAwardResults(artists: Artist[]): Array<{ category: string; artistName: string }> {
  if (!artists.length) return []
  return AWARD_CATEGORIES.map((cat) => {
    const winner = [...artists].sort((a, b) => b.stats[cat.stat] - a.stats[cat.stat])[0]
    return { category: cat.name, artistName: winner?.name ?? '—' }
  })
}

export const useSimulatorStore = create<Store>((set, get) => ({
  ...buildInitialState(),
  hydrated: false,
  simApi: { mode: 'inherit', apiUrl: '', apiKey: '', modelId: '' },
  scoutCandidate: null,
  floatingDeltas: [],
  travelDiary: null,
  lastFlavor: null,
  chatRoomArtistId: null,
  newDayNotice: null,
  sessionEpoch: 0,

  async hydrate() {
    if (get().hydrated) return
    try {
      const raw = await readSessionRaw()
      const apiRaw = await personaDb.getPhoneKv(KV_API)
      if (raw && typeof raw === 'object') {
        const { state } = unwrapSaveRaw(raw, normalizePersistedState)
        set({ ...state, hydrated: true })
      } else {
        set({ hydrated: true })
      }
      if (apiRaw && typeof apiRaw === 'object') {
        set({ simApi: { ...get().simApi, ...(apiRaw as SimApiConfig) } })
      }
    } catch {
      set({ hydrated: true })
    }
    get().refreshScout()
  },

  async listSaveSlots() {
    const slots = await listAllSaveSlots()
    if (slots.some((s) => s.hasValidSave)) return slots
    const legacy = await personaDb.getPhoneKv(KV_LEGACY_KEY)
    if (!legacy || typeof legacy !== 'object') return slots
    const { state, savedAt } = unwrapSaveRaw(legacy, normalizePersistedState)
    const info = buildSaveSlotInfo(state, savedAt, 0)
    if (!info.hasValidSave) return slots
    await personaDb.setPhoneKv(slotKvKey(0), legacy)
    return listAllSaveSlots()
  },

  getCurrentSavePreview() {
    return buildSaveSlotInfo(pickPersistableState(get()), Date.now(), -1)
  },

  async saveGame(slotIndex) {
    if (slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
      throw new Error('存档位无效')
    }
    const store = get()
    const savedAt = Date.now()
    const archive = wrapSaveArchive(pickPersistableState(store), savedAt)
    await personaDb.setPhoneKv(slotKvKey(slotIndex), archive)
    await flushSessionPersist(store, savedAt)
    return buildSaveSlotInfo(pickPersistableState(store), savedAt, slotIndex)
  },

  async loadGame(slotIndex) {
    if (slotIndex < 0 || slotIndex >= SAVE_SLOT_COUNT) {
      throw new Error('存档位无效')
    }
    try {
      const raw = await personaDb.getPhoneKv(slotKvKey(slotIndex))
      if (!raw || typeof raw !== 'object') {
        throw new Error('该存档位暂无存档')
      }
      const { state, savedAt } = unwrapSaveRaw(raw, normalizePersistedState)
      const info = buildSaveSlotInfo(state, savedAt, slotIndex)
      if (!info.hasValidSave) {
        throw new Error('该存档位暂无有效存档')
      }
      set({
        ...state,
        hydrated: true,
        sessionEpoch: get().sessionEpoch + 1,
        scoutCandidate: randomScout(),
        ...clearEphemeralUi(),
      })
      await flushSessionPersist(get(), savedAt ?? Date.now())
      return info
    } catch (err) {
      throw err instanceof Error ? err : new Error('载入失败')
    }
  },

  async restartGame() {
    if (persistTimer) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    const fresh = buildInitialState()
    await personaDb.setPhoneKv(KV_SESSION_KEY, wrapSaveArchive(fresh, 0))
    set({
      ...fresh,
      hydrated: true,
      simApi: get().simApi,
      sessionEpoch: get().sessionEpoch + 1,
      scoutCandidate: randomScout(),
      ...clearEphemeralUi(),
    })
  },

  setSimApi(api) {
    set({ simApi: api })
    void personaDb.setPhoneKv(KV_API, api)
  },

  completePrologue(profile, answers) {
    let funds = 150000
    let reputation = 42
    let scoutBias = ''
    let merged: Omit<PlayerProfile, 'stats'> = { ...profile }

    for (const q of PROLOGUE_QUIZ) {
      const choice = q.choices.find((c) => c.id === answers[q.id])
      if (!choice) continue
      if (choice.effects.funds) funds += choice.effects.funds
      if (choice.effects.reputation) reputation += choice.effects.reputation
      if (choice.effects.scoutBias) scoutBias = choice.effects.scoutBias
      if (choice.effects.prStyle) merged = { ...merged, prStyle: choice.effects.prStyle }
      if (choice.effects.romanceStyle) merged = { ...merged, romanceStyle: choice.effects.romanceStyle }
    }

    const artists = [...INITIAL_ROSTER]
    if (scoutBias.startsWith('scout-')) {
      const scout = SCOUT_POOL.find((s) => s.id === scoutBias)
      if (scout && !artists.some((a) => a.name === scout.name)) {
        artists.push({ ...scout, id: uid(), affection: 35 })
      }
    } else if (scoutBias) {
      const idx = artists.findIndex((a) => a.id === scoutBias)
      if (idx >= 0) artists[idx] = { ...artists[idx], affection: artists[idx].affection + 12 }
    }

    set({
      prologueDone: true,
      player: { ...merged, stats: buildInitialPlayerStats(merged, answers) },
      funds,
      reputation: Math.max(0, Math.min(100, reputation)),
      artists,
      selectedArtistId: artists[0]?.id ?? null,
      hotSearches: get().hotSearches?.length ? get().hotSearches : buildInitialHotSearches(),
      assets: get().assets ?? { properties: [], vehicles: [] },
    })
    schedulePersist(get())
  },

  selectArtist(id) {
    set({ selectedArtistId: id })
    schedulePersist(get())
  },

  pushDelta(label, value, tone) {
    const id = uid()
    set((s) => ({ floatingDeltas: [...s.floatingDeltas, { id, label, value, tone }] }))
    window.setTimeout(() => get().removeDelta(id), 2200)
  },

  removeDelta(id) {
    set((s) => ({ floatingDeltas: s.floatingDeltas.filter((d) => d.id !== id) }))
  },

  getPeriod: () => periodFromActionIndex(get().actionsUsedToday),
  getDisplayHour: () => hourFromActionIndex(get().actionsUsedToday),
  getSeasonLabel: () => seasonFromMonth(get().gameMonth),
  actionsRemaining: () => ACTIONS_PER_DAY - get().actionsUsedToday,
  canAct: () => get().actionsUsedToday < ACTIONS_PER_DAY && !get().pendingDrama,

  refreshScout: () => set({ scoutCandidate: randomScout() }),

  recruitArtist() {
    const state = get()
    const c = state.scoutCandidate
    if (!c || state.funds < RECRUIT_COST || !get().canAct()) return false
    if (state.artists.some((a) => a.name === c.name)) return false

    set({
      artists: [...state.artists, ensureArtistProfile(c)],
      funds: state.funds - RECRUIT_COST,
      scoutCandidate: randomScout(),
      selectedArtistId: c.id,
      player: withPlayerStatBump(state.player, { pr: 2, eloquence: 1, resource: 1 }),
      ...applyActionAdvance(state),
      recentLog: [`招募艺人${c.name}`, ...state.recentLog].slice(0, 8),
    })
    get().pushDelta('签约', c.name, 'gain')
    get().pushDelta('资金', `-${RECRUIT_COST}`, 'loss')
    schedulePersist(get())
    return true
  },

  async negotiateGig(artistId, mainApi) {
    const state = get()
    if (!get().canAct()) return false
    const artist = state.artists.find((a) => a.id === artistId)
    if (!artist) return false

    const pay = 8000 + Math.floor(Math.random() * 12000)
    const fanGain = 1200 + Math.floor(Math.random() * 2800)
    const newGig = appendNegotiatedGig(artist, state.gameYear, state.gameMonth, state.gameDay)
    const artists = state.artists.map((a) => {
      if (a.id !== artistId) return a
      const profiled = ensureArtistProfile(a)
      const withGig = refreshArtistFanReviews({
        ...profiled,
        fans: profiled.fans + fanGain,
        stats: { ...profiled.stats, commercial: Math.min(99, profiled.stats.commercial + 2) },
        affection: Math.min(100, profiled.affection + 2),
        gigs: [newGig, ...(profiled.gigs ?? [])].slice(0, 8),
      })
      return withGig
    })

    const flavor = await fetchRandomEventFlavor({
      api: resolveSimApi(state.simApi, mainApi),
      actionLabel: '洽谈通告',
      context: `${artist.name}接下一档通告。`,
    })
    const pendingDrama = state.pendingDrama ?? (await rollDrama({ ...state, artists }, state.simApi, mainApi))

    set({
      artists,
      funds: state.funds + pay,
      player: withPlayerStatBump(state.player, { eloquence: 2, pr: 1, resource: 1 }),
      ...applyActionAdvance(state),
      pendingDrama,
      lastFlavor: flavor,
      recentLog: [`${artist.name}洽谈通告`, ...state.recentLog].slice(0, 8),
    })
    get().pushDelta('资金', `+${pay}`, 'gain')
    get().pushDelta('粉丝', `+${fanGain}`, 'gain')
    await get().regenerateHotSearches(mainApi, `${artist.name}新通告`)
    schedulePersist(get())
    return true
  },

  async promoCampaign(mainApi) {
    const state = get()
    if (!get().canAct()) return false
    const cost = 9000
    if (state.funds < cost) return false

    set({
      funds: state.funds - cost,
      reputation: Math.min(100, state.reputation + 5),
      player: withPlayerStatBump(state.player, { pr: 3, insight: 1 }),
      ...applyActionAdvance(state),
      recentLog: ['舆论宣发', ...state.recentLog].slice(0, 8),
    })
    get().pushDelta('声望', '+5', 'gain')
    get().pushDelta('资金', `-${cost}`, 'loss')
    await get().regenerateHotSearches(mainApi, '舆论宣发')
    schedulePersist(get())
    return true
  },

  trainArtist(artistId, stat) {
    const state = get()
    if (!get().canAct()) return false
    const cost = 2800
    if (state.funds < cost) return false

    const artists = state.artists.map((a) => {
      if (a.id !== artistId) return a
      return {
        ...a,
        stats: {
          ...a.stats,
          [stat]: Math.min(99, a.stats[stat] + 8),
          stamina: Math.max(0, a.stats.stamina - 3),
        },
      }
    })

    set({
      artists,
      funds: state.funds - cost,
      player: withPlayerStatBump(state.player, { pr: 1, eloquence: 1, stamina: 1 }),
      ...applyActionAdvance(state),
      lastFlavor: '练习室的节拍与汗味交织，他在镜前一遍遍重复同一段动作。',
      recentLog: ['安排培训', ...state.recentLog].slice(0, 8),
    })
    get().pushDelta('能力', '+8', 'gain')
    get().pushDelta('资金', `-${cost}`, 'loss')
    schedulePersist(get())
    return true
  },

  async visitSet(artistId, mainApi) {
    const state = get()
    if (!get().canAct()) return false
    const artist = state.artists.find((a) => a.id === artistId)
    if (!artist) return false

    const dateIds = [...state.dateUnlockedIds]
    const artists = state.artists.map((a) => {
      if (a.id !== artistId) return a
      const affection = Math.min(100, a.affection + 8)
      let status = a.status
      if (status === 'friend' && affection >= 40) status = 'ambiguous'
      if (status === 'ambiguous' && affection >= 72 && state.player?.romanceStyle === 'secret') {
        status = 'secret_dating'
      }
      return {
        ...a,
        affection,
        status,
        stats: { ...a.stats, stamina: Math.min(99, a.stats.stamina + 5) },
        resentment: a.status === 'secret_dating' ? Math.max(0, a.resentment - 2) : a.resentment,
      }
    })

    const updated = artists.find((a) => a.id === artistId)
    if (updated && updated.affection >= DATE_AFFECTION_THRESHOLD && !dateIds.includes(artistId)) {
      dateIds.push(artistId)
    }

    const flavor = await fetchRandomEventFlavor({
      api: resolveSimApi(state.simApi, mainApi),
      actionLabel: '剧组探班',
      context: `探班${artist.name}。`,
    })
    const pendingDrama = state.pendingDrama ?? (await rollDrama({ ...state, artists }, state.simApi, mainApi))

    set({
      artists,
      dateUnlockedIds: dateIds,
      player: withPlayerStatBump(state.player, { charm: 3, insight: 1 }),
      ...applyActionAdvance(state),
      pendingDrama,
      lastFlavor: flavor,
      recentLog: [`探班${artist.name}`, ...state.recentLog].slice(0, 8),
    })
    get().pushDelta('好感', '+8', 'gain')
    schedulePersist(get())
    return true
  },

  async sendChatMessage(artistId, text, mainApi) {
    const trimmed = text.trim()
    if (!trimmed) return
    const state = get()
    const artist = state.artists.find((a) => a.id === artistId)
    if (!artist) return

    const userMsg: ChatMessage = { id: uid(), role: 'user', content: trimmed, ts: Date.now() }
    const thread = [...(state.chatThreads[artistId] ?? []), userMsg]
    set({ chatThreads: { ...state.chatThreads, [artistId]: thread } })

    const reply = await fetchArtistChatReply({
      api: resolveSimApi(state.simApi, mainApi),
      artist,
      transcript: thread,
      contextBlock: buildProducerContextBlock(artist),
    })

    const artistMsg: ChatMessage = { id: uid(), role: 'artist', content: reply.text, ts: Date.now() }
    const dateIds = [...state.dateUnlockedIds]
    const artists = state.artists.map((a) => {
      if (a.id !== artistId) return a
      const affection = Math.min(100, a.affection + reply.affectionDelta)
      const resentment = Math.min(100, a.resentment + reply.resentmentDelta)
      let status = a.status
      if (status === 'friend' && affection >= 38) status = 'ambiguous'
      if (status === 'ambiguous' && affection >= 70 && state.player?.romanceStyle === 'secret') {
        status = 'secret_dating'
      }
      return { ...a, affection, resentment, status }
    })

    const aff = artists.find((a) => a.id === artistId)?.affection ?? 0
    if (aff >= DATE_AFFECTION_THRESHOLD && !dateIds.includes(artistId)) dateIds.push(artistId)

    set({
      artists,
      chatThreads: { ...state.chatThreads, [artistId]: [...thread, artistMsg] },
      dateUnlockedIds: dateIds,
    })
    if (reply.affectionDelta > 0) get().pushDelta('好感', `+${reply.affectionDelta}`, 'gain')
    schedulePersist(get())
  },

  startDate(artistId) {
    if (!get().isDateUnlocked(artistId) || !get().canAct()) return null
    const state = get()
    const artist = state.artists.find((a) => a.id === artistId)
    if (!artist) return null

    const presets: Record<string, { title: string; lines: string[] }> = {
      'sm-linyuan': {
        title: '深夜兜风',
        lines: [
          '他摇下车窗，城市的风灌进来，带着雨后青草的气息。',
          '「你知道我为什么接那部戏吗？」他目视前方，声音很轻。',
          '红灯亮起。他侧过头，目光落在你脸上，比任何镜头都近。',
        ],
      },
      'sm-xiawei': {
        title: '剧组探班之后',
        lines: [
          '她递来一杯冰美式，杯壁上凝着水珠，像某种小心翼翼的示好。',
          '「别以为我是特意等你的。」她别过脸，耳尖却红了。',
        ],
      },
    }

    const story = presets[artistId] ?? {
      title: '专属约会',
      lines: ['月色温柔，他忽然握住了你的指尖。', '这一刻，经纪人的身份似乎变得模糊。'],
    }

    const artists = state.artists.map((a) =>
      a.id === artistId
        ? { ...a, affection: Math.min(100, a.affection + 6), resentment: Math.max(0, a.resentment - 4) }
        : a,
    )

    set({
      artists,
      player: withPlayerStatBump(state.player, { charm: 4, stamina: 1 }),
      ...applyActionAdvance(state),
      recentLog: [`与${artist.name}约会`, ...state.recentLog].slice(0, 8),
    })
    get().pushDelta('好感', '+6', 'gain')
    schedulePersist(get())
    return story
  },

  buyProperty(id) {
    const item = SHOP_PROPERTIES.find((p) => p.id === id)
    const state = get()
    if (!item || state.funds < item.price || state.assets.properties.includes(id)) return false
    set({
      funds: state.funds - item.price,
      assets: { ...state.assets, properties: [...state.assets.properties, id] },
      reputation: Math.min(100, state.reputation + 3),
    })
    get().pushDelta('资产', item.name, 'gain')
    get().pushDelta('资金', `-${item.price}`, 'loss')
    schedulePersist(get())
    return true
  },

  buyVehicle(id) {
    const item = SHOP_VEHICLES.find((v) => v.id === id)
    const state = get()
    if (!item || state.funds < item.price || state.assets.vehicles.includes(id)) return false
    set({
      funds: state.funds - item.price,
      assets: { ...state.assets, vehicles: [...state.assets.vehicles, id] },
    })
    get().pushDelta('座驾', item.name, 'gain')
    get().pushDelta('资金', `-${item.price}`, 'loss')
    schedulePersist(get())
    return true
  },

  async startTravel(destId, artistId, mainApi) {
    const dest = TRAVEL_DESTINATIONS.find((d) => d.id === destId)
    const state = get()
    if (!dest || !get().canAct() || state.funds < dest.cost) return false

    const artist = artistId ? state.artists.find((a) => a.id === artistId) : null
    const lines = await fetchTravelDiary({
      api: resolveSimApi(state.simApi, mainApi),
      destination: dest.name,
      artistName: artist?.name ?? '无人',
      days: dest.days,
    })

    let artists = state.artists
    if (artist) {
      artists = state.artists.map((a) =>
        a.id === artist.id
          ? { ...a, affection: Math.min(100, a.affection + 12), resentment: Math.max(0, a.resentment - 6) }
          : a,
      )
    }

    set({
      artists,
      funds: state.funds - dest.cost,
      player: withPlayerStatBump(state.player, { charm: 2, pr: 1, insight: 2 }),
      ...applyActionAdvance(state),
      travelDiary: { title: `${dest.name}·${dest.days}日`, lines },
      recentLog: [`前往${dest.name}旅行`, ...state.recentLog].slice(0, 8),
    })
    get().pushDelta('资金', `-${dest.cost}`, 'loss')
    if (artist) get().pushDelta('好感', '+12', 'gain')
    schedulePersist(get())
    return true
  },

  resolveDramaChoice(choiceId) {
    const state = get()
    const drama = state.pendingDrama
    if (!drama) return
    const choice = drama.choices.find((c) => c.id === choiceId)
    if (!choice) return
    const result = applyDramaEffects(state.artists, choice.effects, state)
    set({ artists: result.artists, funds: result.funds, reputation: result.reputation, pendingDrama: null })
    schedulePersist(get())
  },

  dismissQuarterlyAwards() {
    set({ pendingQuarterlyAwards: false })
    schedulePersist(get())
  },

  resolveBirthdayChoice(mode) {
    const state = get()
    const sorted = [...state.artists].sort((a, b) => b.affection - a.affection)
    const top = sorted[0]
    let artists = state.artists
    if (mode === 'party' && top) {
      artists = state.artists.map((a) =>
        a.id === top.id ? { ...a, affection: Math.min(100, a.affection + 10) } : a,
      )
      get().pushDelta('好感', `+10`, 'gain')
    } else if (mode === 'alone' && top && top.affection >= 50) {
      artists = state.artists.map((a) =>
        a.id === top.id ? { ...a, affection: Math.min(100, a.affection + 15) } : a,
      )
      get().pushDelta('彩蛋', top.name, 'gain')
    }
    set({ artists, pendingBirthday: false })
    schedulePersist(get())
  },

  clearTravelDiary: () => set({ travelDiary: null }),
  clearLastFlavor: () => set({ lastFlavor: null }),

  async regenerateHotSearches(mainApi, hint) {
    const state = get()
    const items = await fetchHotSearchAi({
      api: resolveSimApi(state.simApi, mainApi),
      artists: state.artists,
      hint,
    })
    set({ hotSearches: items })
    schedulePersist(get())
  },

  openChatRoom: (artistId) => set({ chatRoomArtistId: artistId }),
  closeChatRoom: () => set({ chatRoomArtistId: null }),
  dismissNewDayNotice: () => set({ newDayNotice: null }),

  findArtistByCharacterId: (characterId) => get().artists.find((a) => a.characterId === characterId),

  isDateUnlocked(artistId) {
    const a = get().artists.find((x) => x.id === artistId)
    return get().dateUnlockedIds.includes(artistId) || (a?.affection ?? 0) >= DATE_AFFECTION_THRESHOLD
  },

  getAwardResults() {
    return computeAwardResults(get().artists)
  },
}))

export function buildProducerContextBlock(artist: Artist): string {
  return [
    '【金牌制作人 · 艺人上下文】',
    `艺人：${artist.name}`,
    `好感：${artist.affection}`,
    `关系：${artist.status}`,
    `粉丝：${artist.fans}`,
    artist.personaSummary ? `人设：${artist.personaSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
