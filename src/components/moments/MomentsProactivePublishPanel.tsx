import { useEffect, useMemo, useState } from 'react'

import { resolveCharacterAvatarUrl } from '../../phone/utils/characterAvatarUrl'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import { findAccountById, loadAccountsBundle } from '../../phone/apps/wechat/wechatAccountPersistence'
import type { WeChatPersonaContact } from '../../phone/types'
import { MomentsMinimalSwitch } from './MomentsMinimalSwitch'
import { ProactiveCharacterMomentIntervalControl } from './ProactiveCharacterMomentIntervalControl'
import { ProactiveCharacterMomentMusicLanguageRatioPanel } from './ProactiveCharacterMomentMusicLanguageRatioPanel'
import {
  ProactiveMomentGlobalSavedSummary,
  ProactiveMomentPerCharacterSavedSummary,
} from './ProactiveMomentScheduleSummary'
import { SettingsMechanismAccordion } from './SettingsMechanismAccordion'
import {
  buildProactiveCharacterMomentKey,
  formatProactiveCharacterMomentIntervalLabel,
  hasProactiveCharacterMomentScheduleSaved,
  PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_PRESETS,
  resolveCharacterProactiveMomentSchedule,
  type ProactiveCharacterMomentMode,
  type ProactiveCharacterMomentSchedule,
} from './proactiveCharacterMomentTypes'
import { useMomentsSettingsStore } from './useMomentsSettingsStore'

type ContactRow = WeChatPersonaContact & {
  momentsBlocked: boolean
}

type Props = {
  accountId?: string | null
}

type ProactivePublishSubTab = 'schedule' | 'music'

const PROACTIVE_PUBLISH_SUB_TABS: { id: ProactivePublishSubTab; label: string }[] = [
  { id: 'schedule', label: '调度设置' },
  { id: 'music', label: '分享歌曲' },
]

export function MomentsProactivePublishPanel({ accountId }: Props) {
  const { settings, patchProactiveCharacterMoments, patchCharacterProactiveMomentSchedule } =
    useMomentsSettingsStore()
  const pm = settings.proactiveCharacterMoments
  const [activeSubTab, setActiveSubTab] = useState<ProactivePublishSubTab>('schedule')
  const [savingGlobal, setSavingGlobal] = useState(false)
  const [savingCharacterKey, setSavingCharacterKey] = useState<string | null>(null)
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null)

  const accId = accountId?.trim() ?? ''

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!accId) {
        setContacts([])
        return
      }
      const bundle = await loadAccountsBundle()
      const account = bundle ? findAccountById(bundle, accId) : null
      if (!account) {
        if (!cancelled) setContacts([])
        return
      }
      const rows: ContactRow[] = []
      for (const c of account.personaContacts) {
        const cid = c.characterId?.trim()
        if (!cid) continue
        let momentsBlocked = false
        try {
          const ch = await personaDb.getCharacter(cid)
          momentsBlocked = !!ch?.momentsPermission?.blocked
        } catch {
          momentsBlocked = false
        }
        rows.push({ ...c, momentsBlocked })
      }
      if (!cancelled) setContacts(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [accId])

  const selectedKey = useMemo(() => {
    if (!accId || !selectedCharacterId) return ''
    return buildProactiveCharacterMomentKey(accId, selectedCharacterId)
  }, [accId, selectedCharacterId])

  const perCharacterSummaryRows = useMemo(
    () =>
      contacts.map((c) => ({
        characterId: c.characterId.trim(),
        characterName: c.remarkName || '未命名',
        schedule: resolveCharacterProactiveMomentSchedule(pm, accId, c.characterId.trim()),
      })),
    [accId, contacts, pm],
  )

  const patchGlobal = (patch: Partial<ProactiveCharacterMomentSchedule>) => {
    patchProactiveCharacterMoments({
      global: { ...pm.global, ...patch },
    })
  }

  const setMode = (mode: ProactiveCharacterMomentMode) => {
    patchProactiveCharacterMoments({ mode })
    window.dispatchEvent(new Event('moments-settings-changed'))
  }

  const handleSaveGlobalInterval = async (seconds: number) => {
    setSavingGlobal(true)
    try {
      patchGlobal({
        intervalSeconds: seconds,
        lastFiredAtMs: Date.now(),
      })
      window.dispatchEvent(new Event('moments-settings-changed'))
    } finally {
      setSavingGlobal(false)
    }
  }

  const handleSaveCharacterInterval = async (seconds: number) => {
    if (!selectedKey) return
    setSavingCharacterKey(selectedKey)
    try {
      patchCharacterProactiveMomentSchedule(selectedKey, {
        intervalSeconds: seconds,
        lastFiredAtMs: Date.now(),
      })
      window.dispatchEvent(new Event('moments-settings-changed'))
    } finally {
      setSavingCharacterKey(null)
    }
  }

  const toggleCharacterEnabled = (characterId: string, enabled: boolean) => {
    const key = buildProactiveCharacterMomentKey(accId, characterId)
    if (!key) return
    const existing = resolveCharacterProactiveMomentSchedule(pm, accId, characterId)
    patchCharacterProactiveMomentSchedule(key, {
      ...existing,
      enabled,
      ...(enabled ? {} : { lastFiredAtMs: 0 }),
    })
    if (enabled) setSelectedCharacterId(characterId)
    window.dispatchEvent(new Event('moments-settings-changed'))
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-[1] -mx-1 bg-white/95 px-1 pb-1 pt-0.5 backdrop-blur-sm">
        <div className="flex gap-1 rounded-full bg-[#F3F4F6] p-1">
          {PROACTIVE_PUBLISH_SUB_TABS.map((tab) => {
            const active = activeSubTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex-1 rounded-full py-2 text-[12px] font-medium transition-colors outline-none ${
                  active ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {activeSubTab === 'music' ? (
        <ProactiveCharacterMomentMusicLanguageRatioPanel
          accountId={accId}
          ratio={pm.musicShareLanguageRatio}
          followUserMusicTaste={pm.followUserMusicTaste}
          onRatioChange={(next) => {
            patchProactiveCharacterMoments({ musicShareLanguageRatio: next })
            window.dispatchEvent(new Event('moments-settings-changed'))
          }}
          onFollowUserMusicTasteChange={(next) => {
            patchProactiveCharacterMoments({ followUserMusicTaste: next })
            window.dispatchEvent(new Event('moments-settings-changed'))
          }}
        />
      ) : (
        <div className="space-y-6">
      <section className="rounded-3xl bg-white px-5 py-5 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">SCOPE</p>
        <h2 className="mt-1 text-[16px] font-semibold text-[#111827]">调度方式</h2>
        <div className="mt-3 flex gap-1 rounded-full bg-[#F3F4F6] p-1">
          {(
            [
              { id: 'global' as const, label: '全局随机' },
              { id: 'per_character' as const, label: '指定角色' },
            ] as const
          ).map((tab) => {
            const active = pm.mode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`flex-1 rounded-full py-2 text-[12px] font-medium transition-colors outline-none ${
                  active ? 'bg-white text-[#111827] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[#9CA3AF]">
          {pm.mode === 'global'
            ? '按统一频率，从通讯录中随机抽取多名较久未发圈的角色，同一轮可有多人发朋友圈。'
            : '仅为下方开启的角色单独设定频率；未开启的角色不会被调度。'}
        </p>
        <p className="mt-2 rounded-xl bg-[#F9FAFB] px-3 py-2 text-[11px] leading-relaxed text-[#6B7280]">
          当前仅所选模式会参与后台调度；另一模式的配置会保留，但不会同时运行，切换回来即可继续沿用。
        </p>
      </section>

      {pm.mode === 'global' ? (
        <section className="rounded-3xl bg-white px-5 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">
                GLOBAL
              </p>
              <h2 className="mt-1 text-[16px] font-semibold text-[#111827]">全局主动发布</h2>
            </div>
            <MomentsMinimalSwitch
              checked={pm.global.enabled}
              onChange={(v) => {
                patchGlobal({ enabled: v })
                window.dispatchEvent(new Event('moments-settings-changed'))
              }}
              label="全局主动发布"
            />
          </div>

          <SettingsMechanismAccordion
            triggerLabel="点击阅读底层原理 (View Mechanism)"
            body={
              '开启后按统一频率，从通讯录中随机抽取多名角色（优先较久未发圈者），各自静默发布一条朋友圈。' +
              '是否置顶由角色自行判断。需已配置聊天 API。'
            }
          />

          {pm.global.enabled ? (
            <>
              <div className="mt-4">
                <p className="text-[12px] font-medium text-[#374151]">每轮抽取角色数</p>
                <p className="mt-1 text-[11px] text-[#9CA3AF]">
                  到点后一次随机选出多名角色，各自发一条朋友圈（不超过通讯录可用人数）
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PROACTIVE_CHARACTER_MOMENT_PICK_COUNT_PRESETS.map((preset) => {
                    const active = pm.globalPickCount === preset.count
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          patchProactiveCharacterMoments({ globalPickCount: preset.count })
                          window.dispatchEvent(new Event('moments-settings-changed'))
                        }}
                        className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
                          active
                            ? 'bg-[#111827] text-white'
                            : 'border border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]'
                        }`}
                      >
                        {preset.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <ProactiveCharacterMomentIntervalControl
                savedIntervalSeconds={pm.global.intervalSeconds}
                scheduleSaved={hasProactiveCharacterMomentScheduleSaved(pm.global)}
                onSave={handleSaveGlobalInterval}
                saving={savingGlobal}
              />
            </>
          ) : (
            <p className="mt-4 text-[12px] leading-relaxed text-[#9CA3AF]">
              打开开关并保存频率后，全局调度才会开始。
            </p>
          )}

          <ProactiveMomentGlobalSavedSummary
            enabled={pm.global.enabled}
            schedule={pm.global}
            pickCount={pm.globalPickCount}
          />
        </section>
      ) : (
        <section className="rounded-3xl bg-white px-5 py-6 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">
            CHARACTERS
          </p>
          <h2 className="mt-1 text-[16px] font-semibold text-[#111827]">指定角色</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-[#9CA3AF]">
            为需要的角色单独开启并设置频率。点选角色后可配置间隔并保存。
          </p>

          {!accId ? (
            <p className="mt-4 text-[12px] text-[#9CA3AF]">请先登录微信号后再配置角色。</p>
          ) : contacts.length === 0 ? (
            <p className="mt-4 text-[12px] text-[#9CA3AF]">当前通讯录暂无可用角色。</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {contacts.map((c) => {
                const cid = c.characterId.trim()
                const key = buildProactiveCharacterMomentKey(accId, cid)
                const schedule = resolveCharacterProactiveMomentSchedule(pm, accId, cid)
                const selected = selectedCharacterId === cid
                const avatar = resolveCharacterAvatarUrl({ avatarUrl: c.avatarUrl })
                const sub =
                  schedule.enabled && hasProactiveCharacterMomentScheduleSaved(schedule)
                    ? formatProactiveCharacterMomentIntervalLabel(schedule.intervalSeconds)
                    : schedule.enabled
                      ? '已开启 · 待保存频率'
                      : '未开启'

                return (
                  <li key={cid}>
                    <div
                      className={`rounded-2xl border px-3 py-3 transition-colors ${
                        selected ? 'border-[#111827]/20 bg-[#FAFAFA]' : 'border-[#F3F4F6] bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={c.momentsBlocked}
                          onClick={() => setSelectedCharacterId(cid)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none disabled:opacity-45"
                        >
                          <div className="size-10 shrink-0 overflow-hidden rounded-full bg-[#F3F4F6]">
                            {avatar ? (
                              <img src={avatar} alt="" className="size-full object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center text-[12px] text-[#9CA3AF]">
                                {(c.remarkName || '?').slice(0, 1)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[14px] font-medium text-[#111827]">
                              {c.remarkName || '未命名'}
                            </p>
                            <p className="truncate text-[11px] text-[#9CA3AF]">
                              {c.momentsBlocked ? '已屏蔽朋友圈' : sub}
                            </p>
                          </div>
                        </button>
                        <MomentsMinimalSwitch
                          checked={schedule.enabled}
                          onChange={(v) => toggleCharacterEnabled(cid, v)}
                          label={`${c.remarkName} 主动发朋友圈`}
                        />
                      </div>

                      {selected && schedule.enabled && !c.momentsBlocked ? (
                        <div className="mt-3 border-t border-[#F3F4F6] pt-3">
                          <ProactiveCharacterMomentIntervalControl
                            savedIntervalSeconds={schedule.intervalSeconds}
                            scheduleSaved={hasProactiveCharacterMomentScheduleSaved(schedule)}
                            onSave={handleSaveCharacterInterval}
                            saving={savingCharacterKey === key}
                          />
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}

          <ProactiveMomentPerCharacterSavedSummary rows={perCharacterSummaryRows} />
        </section>
      )}

      <section className="rounded-3xl border border-[#F3F4F6] bg-[#FAFAFA] px-5 py-5">
        <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
          主动发布与私聊中「帮我发个朋友圈」互不冲突。全局模式与指定角色模式二选一；指定角色模式下仅调度你已开启的角色。
        </p>
      </section>
        </div>
      )}
    </div>
  )
}
