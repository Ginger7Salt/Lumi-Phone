import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiPresetEditPath } from '../apiPresetRoutes'
import { API_LINK_PREVIEW_ROUTE, LINK_PREVIEW_FEATURE_TITLE } from '../linkPreviewDisplayLabels'
import { useApiSettings } from '../ApiSettingsContext'
import { useImageGenSettings } from '../useImageGenSettings'
import { apiTheme } from '../theme'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PresetCard } from '../components/PresetCard'
import { TopNav } from '../components/TopNav'

export function ApiSettingsHomePage({ onBack }: { onBack: () => void }) {
  const nav = useNavigate()
  const { presets, currentPresetId, currentPreset, setCurrentPresetId, deletePreset, duplicatePreset, linkPreview } =
    useApiSettings()
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

  const linkPreviewTag = useMemo(() => {
    if (!linkPreview.enabled) return { text: '已关闭', bg: apiTheme.subText }
    const t = linkPreview.lastTest
    if (!linkPreview.apiKey.trim()) {
      return t?.ok ? { text: '匿名可用', bg: apiTheme.accent } : { text: '已启用', bg: apiTheme.accent }
    }
    if (!t) return { text: '已配置', bg: apiTheme.accent }
    return t.ok ? { text: '连接正常', bg: apiTheme.accent } : { text: '连接失败', bg: apiTheme.subText }
  }, [linkPreview])

  const openLinkPreview = () => {
    nav(API_LINK_PREVIEW_ROUTE)
  }

  const openEdit = () => {
    if (!currentPresetId) {
      nav('/new')
      return
    }
    nav(apiPresetEditPath(currentPresetId))
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
                  编辑预设时可切换「主接口 / 副接口 / 生图」三个 Tab；{LINK_PREVIEW_FEATURE_TITLE} 在下方单独配置。
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {currentPreset ? (
                <button
                  type="button"
                  onClick={() => {
                    const nid = duplicatePreset(currentPresetId)
                    if (nid) nav(apiPresetEditPath(nid))
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

        <section className="mx-4 mt-3 rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[16px] font-semibold" style={{ color: apiTheme.text }}>
                {LINK_PREVIEW_FEATURE_TITLE}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: apiTheme.subText, fontWeight: 300 }}>
                微信聊天发 https 时自动识别：普通页提取正文，抖音 / 小红书 / B 站等解析视频与图文（支持识图）。
              </p>
              <span
                className="mt-2 inline-block rounded-lg px-3 py-1 text-[12px] font-medium text-white"
                style={{ background: linkPreviewTag.bg }}
              >
                {linkPreviewTag.text}
              </span>
            </div>
            <button
              type="button"
              onClick={openLinkPreview}
              className="shrink-0 text-[14px] font-medium transition-all duration-200 ease-out hover:opacity-80"
              style={{ color: apiTheme.accent }}
            >
              配置
            </button>
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
              onEdit={() => nav(apiPresetEditPath(p.id))}
              onDuplicate={() => {
                const nid = duplicatePreset(p.id)
                if (nid) nav(apiPresetEditPath(nid))
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
        className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 px-4"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          type="button"
          onClick={() => nav('/new')}
          className="pointer-events-auto w-full rounded-xl px-4 py-3 text-[15px] font-semibold text-white transition-all duration-200 ease-out hover:brightness-105"
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
