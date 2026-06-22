import { useState } from 'react'
import type { SimApiConfig } from './types'
import { useSimulatorStore } from './useSimulatorStore'

export function ApiSetupSheet({ onClose }: { onClose: () => void }) {
  const simApi = useSimulatorStore((s) => s.simApi)
  const setSimApi = useSimulatorStore((s) => s.setSimApi)
  const [draft, setDraft] = useState<SimApiConfig>({ ...simApi })

  return (
    <div className="absolute inset-0 z-[100] flex items-end bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="sm-card w-full max-h-[85%] overflow-y-auto rounded-t-[24px] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="sm-serif text-[18px] font-semibold text-[#2D2422]">叙事接口配置</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-stone-500">
          可沿用手机全局接口，或为本作单独填写。用于热搜、对话与修罗场叙事生成。
        </p>

        <div className="mt-5 flex gap-2">
          {(['inherit', 'custom'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDraft((d) => ({ ...d, mode }))}
              className={`flex-1 rounded-xl py-2.5 text-[14px] ${
                draft.mode === mode ? 'bg-rose-400 text-white' : 'bg-rose-50 text-stone-600'
              }`}
            >
              {mode === 'inherit' ? '沿用全局' : '单独配置'}
            </button>
          ))}
        </div>

        {draft.mode === 'custom' && (
          <div className="mt-4 space-y-3">
            <label className="block text-[12px] text-stone-500">接口地址</label>
            <input
              value={draft.apiUrl}
              onChange={(e) => setDraft((d) => ({ ...d, apiUrl: e.target.value }))}
              className="w-full rounded-xl border border-rose-100 px-3 py-2.5 text-[14px] outline-none"
              placeholder="https://"
            />
            <label className="block text-[12px] text-stone-500">密钥</label>
            <input
              type="password"
              value={draft.apiKey}
              onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
              className="w-full rounded-xl border border-rose-100 px-3 py-2.5 text-[14px] outline-none"
            />
            <label className="block text-[12px] text-stone-500">模型</label>
            <input
              value={draft.modelId}
              onChange={(e) => setDraft((d) => ({ ...d, modelId: e.target.value }))}
              className="w-full rounded-xl border border-rose-100 px-3 py-2.5 text-[14px] outline-none"
            />
          </div>
        )}

        <button
          type="button"
          className="sm-btn-primary mt-6 w-full py-3 text-[15px]"
          onClick={() => {
            setSimApi(draft)
            onClose()
          }}
        >
          保存
        </button>
      </div>
    </div>
  )
}
