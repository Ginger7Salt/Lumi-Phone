import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import type { WeChatContactRow } from '../../../../components/WeChatContactsInstagram'
import { Pressable } from '../../../components/Pressable'
import { MemoryDashboard } from './MemoryDashboard'
import { MemoryEngineConfig } from './MemoryEngineConfig'
import { ARCHIVE_BG } from './memoryArchiveTheme'
import { MEMORY_ARCHIVE_TUTORIAL_SECTIONS } from './memoryArchiveTutorialCopy'
import { MemoryTutorialModal } from './MemoryTutorialModal'
import { MemoryTutorialButton } from './MemoryTutorialButton'

const MEMORY_ARCHIVE_START_COACH_EVENT = 'memory-archive-start-coach'

function TopBar({
  title,
  onBack,
  onOpenTutorial,
}: {
  title: string
  onBack: () => void
  onOpenTutorial?: () => void
}) {
  return (
    <div
      className="sticky top-0 z-30 shrink-0"
      style={{
        background: '#FFFFFF',
        paddingTop: 'max(10px, env(safe-area-inset-top,0px))',
        boxShadow: '0 8px 30px rgba(0,0,0,0.03)',
      }}
    >
      <div className="flex items-center px-4 py-3">
        <Pressable
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-[12px] transition-all duration-200 ease-out hover:bg-gray-50"
          aria-label="返回"
        >
          <ArrowLeft className="size-5 text-gray-900" strokeWidth={1.75} />
        </Pressable>
        <p className="flex-1 text-center text-[18px] font-semibold tracking-tight text-gray-900">
          {title}
        </p>
        {onOpenTutorial ? (
          <MemoryTutorialButton onClick={onOpenTutorial} />
        ) : (
          <div className="h-10 w-10 shrink-0" aria-hidden />
        )}
      </div>
    </div>
  )
}

export function MemoryManagementApp({
  contacts,
  playerIdentityId,
  playerDisplayName,
  currentWechatAccountId,
  onBack,
}: {
  contacts: WeChatContactRow[]
  playerIdentityId: string | null
  playerDisplayName: string
  currentWechatAccountId?: string
  onBack: () => void
}) {
  const [activeTab, setActiveTab] = useState<'config' | 'memories'>('config')
  const [hubTutorialOpen, setHubTutorialOpen] = useState(false)

  const pid = playerIdentityId?.trim() ?? ''

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-gray-900" style={{ background: ARCHIVE_BG }}>
      <TopBar title="记忆档案馆" onBack={onBack} />

      {activeTab === 'memories' ? (
        <MemoryTutorialModal
          open={hubTutorialOpen}
          onClose={() => setHubTutorialOpen(false)}
          title="记忆档案馆 · 怎么看"
          subtitle="列表、配置与注入规则小抄"
          sections={MEMORY_ARCHIVE_TUTORIAL_SECTIONS}
          onStartLiveCoach={() => {
            setHubTutorialOpen(false)
            window.setTimeout(() => {
              window.dispatchEvent(new CustomEvent(MEMORY_ARCHIVE_START_COACH_EVENT))
            }, 280)
          }}
          zIndex={52000}
        />
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 px-4 pb-2 pt-2" style={{ background: ARCHIVE_BG }}>
          <div className="mx-auto flex max-w-xl gap-1 rounded-full bg-gray-100/80 p-1">
            <Pressable
              type="button"
              role="tab"
              aria-selected={activeTab === 'config'}
              onClick={() => setActiveTab('config')}
              className={`min-h-[44px] flex-1 rounded-full py-2.5 text-center text-[14px] font-semibold transition-colors ${
                activeTab === 'config'
                  ? 'bg-white text-gray-900 shadow-[0_4px_16px_rgba(0,0,0,0.04)]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              配置
            </Pressable>
            <Pressable
              type="button"
              role="tab"
              aria-selected={activeTab === 'memories'}
              onClick={() => setActiveTab('memories')}
              className={`min-h-[44px] flex-1 rounded-full py-2.5 text-center text-[14px] font-semibold transition-colors ${
                activeTab === 'memories'
                  ? 'bg-white text-gray-900 shadow-[0_4px_16px_rgba(0,0,0,0.04)]'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              记忆管理
            </Pressable>
          </div>
        </div>
        <div
          className={`min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] ${
            activeTab === 'config' ? '' : 'hidden'
          }`}
          aria-hidden={activeTab !== 'config'}
        >
          <MemoryEngineConfig />
        </div>
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${activeTab === 'memories' ? '' : 'hidden'}`}
          aria-hidden={activeTab !== 'memories'}
        >
          {/* 保持挂载：删除/保存会广播 wechat-storage-changed，勿因 loading 卸载导致 Tab 回到默认 */}
          <MemoryDashboard
            contacts={contacts}
            playerIdentityId={pid || '__none__'}
            playerDisplayName={playerDisplayName.trim() || '我'}
            currentWechatAccountId={currentWechatAccountId}
          />
        </div>
      </div>
    </div>
  )
}
