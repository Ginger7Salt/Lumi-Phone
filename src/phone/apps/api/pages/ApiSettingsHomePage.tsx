import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiSettings } from '../ApiSettingsContext'
import { useImageGenSettings } from '../useImageGenSettings'
import { apiTheme } from '../theme'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PresetCard } from '../components/PresetCard'
import { TopNav } from '../components/TopNav'

export function ApiSettingsHomePage({ onBack }: { onBack: () => void }) {
  const nav = useNavigate()
  const { presets, currentPresetId, currentPreset, setCurrentPresetId, deletePreset, duplicatePreset } = useApiSettings()
  const { configured: imageGenConfigured, imageGen } = useImageGenSettings()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const mainConfigured = useMemo(() => {
    const p = currentPreset
    if (!p) return false
    return !!p.main.apiUrl.trim() && !!p.main.apiKey.trim()
  }, [currentPreset])

  const mainTestTag = useMemo(() => {
    const t = currentPreset?.main.lastTest
    if (!t) return { text: '未测试', bg: apiTheme.subText }
    return t.ok ? { text: '连接成功', bg: apiTheme.accent } : { text: '连接失败', bg: apiTheme.subText }
  }, [currentPreset?.main.lastTest])

  const imageGenTag = useMemo(() => {
    if (!currentPreset) return { text: '未配置', bg: apiTheme.subText }
    if (!imageGen.enabled) return { text: '已关闭', bg: apiTheme.subText }
    return imageGenConfigured
      ? { text: '已就绪', bg: apiTheme.accent }
      : { text: '待填 Key', bg: apiTheme.subText }
  }, [currentPreset, imageGen.enabled, imageGenConfigured])

  const openEdit = () => {
    if (!currentPresetId) {
      nav('/new')
      return
    }
    nav(`/edit/${currentPresetId}`)
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden"
      style={{ background: apiTheme.bg, fontFamily: apiTheme.font }}
    >
      <TopNav title="API设置" onBack={onBack} />

      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(92px+env(safe-area-inset-bottom,0px))] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <section className="mx-4 mt-4 rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
          <p className="text-[14px]" style={{ color: apiTheme.subText }}>
            当前使用预设
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-[18px] font-semibold" style={{ color: apiTheme.text }}>
                  {currentPreset ? currentPreset.name || '未命名预设' : '暂无预设'}
                </p>
                <span
                  className="shrink-0 rounded-lg px-3 py-1 text-[12px] font-medium text-white"
                  style={{ background: mainConfigured ? apiTheme.accent : apiTheme.subText }}
                >
                  {currentPreset ? (mainConfigured ? '主接口已配置' : '主接口未配置') : '未配置'}
                </span>
                <span
                  className="shrink-0 rounded-lg px-3 py-1 text-[12px] font-medium text-white"
                  style={{ background: mainTestTag.bg }}
                >
                  {mainTestTag.text}
                </span>
                {currentPreset ? (
                  <span
                    className="shrink-0 rounded-lg px-3 py-1 text-[12px] font-medium text-white"
                    style={{ background: imageGenTag.bg }}
                  >
                    生图 {imageGenTag.text}
                  </span>
                ) : null}
              </div>
              {!currentPreset ? (
                <p className="mt-2 text-[14px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
                  先新建一个 API 预设，在编辑页配置主接口、副接口与生图 API。
                </p>
              ) : (
                <p className="mt-2 text-[13px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
                  编辑预设时可切换「主接口 / 副接口 / 生图 API」三个 Tab。
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {currentPreset ? (
                <button
                  type="button"
                  onClick={() => {
                    const nid = duplicatePreset(currentPresetId)
                    if (nid) nav(`/edit/${nid}`)
                  }}
                  className="text-[14px] font-medium transition-all duration-200 ease-out hover:opacity-80"
                  style={{ color: apiTheme.subText }}
                >
                  复制
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => openEdit()}
                className="text-[14px] font-medium transition-all duration-200 ease-out hover:opacity-80"
                style={{ color: apiTheme.accent }}
              >
                {currentPreset ? '编辑' : '新建'}
              </button>
            </div>
          </div>
        </section>

        <p className="mx-4 mt-6 text-[16px] font-semibold" style={{ color: apiTheme.text }}>
          我的预设
        </p>

        {presets.length ? (
          presets.map((p) => (
            <PresetCard
              key={p.id}
              name={p.name}
              description={p.description}
              active={p.id === currentPresetId}
              onClick={() => setCurrentPresetId(p.id)}
              onEdit={() => nav(`/edit/${p.id}`)}
              onDuplicate={() => {
                const nid = duplicatePreset(p.id)
                if (nid) nav(`/edit/${nid}`)
              }}
              onDelete={() => setDeleteId(p.id)}
            />
          ))
        ) : (
          <div className="mx-4 mt-3 rounded-2xl bg-white p-6 text-center" style={{ boxShadow: apiTheme.shadow }}>
            <p className="text-[14px] font-medium" style={{ color: apiTheme.text }}>
              还没有任何预设
            </p>
            <p className="mt-2 text-[13px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
              点击下方按钮新建你的第一个 API 预设。
            </p>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 px-4"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={() => nav('/new')}
          className="w-full rounded-xl px-4 py-3 text-[15px] font-semibold text-white transition-all duration-200 ease-out hover:brightness-105"
          style={{ background: apiTheme.accent }}
        >
          新建API预设
        </button>
      </div>

      <ConfirmDialog
        open={!!deleteId}
        title="确认删除？"
        message="删除后不可恢复。"
        confirmText="删除"
        danger
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deletePreset(deleteId)
          setDeleteId(null)
        }}
      />
    </div>
  )
}
