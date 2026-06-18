import { useState } from 'react'

import { apiTheme } from '../theme'
import { TextField } from './TextField'
import { extractHttpsUrls } from '../../wechat/linkPreview/extractHttpsUrls'
import {
  fetchLinkPreviews,
  type LinkPreviewItem,
} from '../../wechat/linkPreview/fetchLinkPreviews'

type Props = {
  disabled?: boolean
  onParsed?: () => void
}

function clipText(s: string | undefined, max: number): string {
  const t = String(s ?? '').trim()
  if (!t) return ''
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function resolveUrlsFromInput(raw: string): string[] {
  const text = raw.trim()
  if (!text) return []
  const extracted = extractHttpsUrls(text, 1)
  if (extracted.length) return extracted
  try {
    const u = new URL(text.startsWith('http') ? text : `https://${text}`)
    return [u.href]
  } catch {
    return []
  }
}

function ParseResultCard({ item }: { item: LinkPreviewItem }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: item.ok ? '#f0fdf4' : '#fef2f2',
        border: `1px solid ${item.ok ? '#bbf7d0' : '#fecaca'}`,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-medium"
          style={{
            background: item.ok ? '#dcfce7' : '#fee2e2',
            color: item.ok ? '#166534' : '#b91c1c',
          }}
        >
          {item.ok ? '成功' : '失败'}
        </span>
        {item.visionEnriched ? (
          <span
            className="rounded-md px-2 py-0.5 text-[11px] font-medium"
            style={{ background: '#ede9fe', color: '#5b21b6' }}
          >
            已识图
          </span>
        ) : null}
      </div>
      {item.ok ? (
        <div className="mt-3 space-y-2 text-[13px] leading-relaxed" style={{ color: apiTheme.text }}>
          {item.title ? <p className="font-medium">{clipText(item.title, 240)}</p> : null}
          {item.description ? (
            <p className="text-[12px]" style={{ color: apiTheme.subText }}>
              {clipText(item.description, 320)}
            </p>
          ) : null}
          {item.excerpt ? (
            <p className="whitespace-pre-wrap text-[12px]" style={{ color: apiTheme.subText }}>
              {clipText(item.excerpt, item.visionEnriched ? 2200 : 900)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[12px] leading-relaxed" style={{ color: '#b91c1c' }}>
          {clipText(item.error, 200) || '未能识别该链接'}
        </p>
      )}
    </div>
  )
}

export function ApiLinkPreviewParsePanel({ disabled = false, onParsed }: Props) {
  const [input, setInput] = useState('')
  const [parsing, setParsing] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [results, setResults] = useState<LinkPreviewItem[] | null>(null)

  const runParse = async () => {
    if (parsing || disabled) return
    const urls = resolveUrlsFromInput(input)
    if (!urls.length) {
      setHint('请粘贴有效链接')
      setResults(null)
      return
    }

    setParsing(true)
    setHint(null)
    setResults(null)
    try {
      const fetched = await fetchLinkPreviews(urls, {
        notifyQuota: true,
        failureToast: false,
      })
      setResults(fetched)
      if (!fetched.some((r) => r.ok)) {
        setHint('识别未成功')
      }
      onParsed?.()
    } catch {
      setHint('网络错误，请重试')
    } finally {
      setParsing(false)
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5" style={{ boxShadow: apiTheme.shadow }}>
      <p className="text-[15px] font-semibold" style={{ color: apiTheme.text }}>
        试一条链接
      </p>
      <p className="mt-1 text-[12px]" style={{ color: apiTheme.subText, fontWeight: 300 }}>
        与聊天发链相同，会消耗额度
      </p>

      <div className="mt-4 space-y-3">
        <TextField
          label=""
          value={input}
          onChange={setInput}
          placeholder="粘贴链接或分享文案"
        />
        <button
          type="button"
          disabled={disabled || parsing || !input.trim()}
          onClick={() => void runParse()}
          className="w-full rounded-xl px-4 py-2.5 text-[13px] font-medium text-white transition-opacity disabled:opacity-40"
          style={{ background: apiTheme.accent }}
        >
          {parsing ? '识别中…' : '开始识别'}
        </button>

        {hint ? (
          <p className="text-[12px]" style={{ color: '#b45309' }}>
            {hint}
          </p>
        ) : null}

        {results?.map((item) => (
          <ParseResultCard key={item.url} item={item} />
        ))}
      </div>
    </section>
  )
}
