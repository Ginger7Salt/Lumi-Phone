import { AnimatePresence, motion } from 'framer-motion'
import { Eye } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { MomentsContactDirectory } from './momentsContactDirectory'
import {
  buildMomentContactNameResolver,
  resolveMomentVisibilityProtocol,
  type ResolvedVisibilityName,
} from './momentVisibilityProtocol'
import type { MomentContactRef, MomentPrivacyMeta } from './newMomentTypes'

const PLATINUM = '#D4AF37'

type Props = {
  privacy: MomentPrivacyMeta | undefined
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  currentUserName: string
}

function NameChip({ entry }: { entry: ResolvedVisibilityName }) {
  const shieldedUser = entry.isUser
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[9px] tracking-wide ${
        shieldedUser
          ? 'border-[#991B1B]/25 bg-[#991B1B]/5 text-[#991B1B] line-through decoration-[#991B1B]/60'
          : 'border-gray-100 bg-gray-50/80 text-gray-500'
      }`}
    >
      [ {entry.name} ]
    </span>
  )
}

function ProtocolBody({ protocol }: { protocol: ReturnType<typeof resolveMomentVisibilityProtocol> }) {
  switch (protocol.kind) {
    case 'public':
      return (
        <p className="font-serif text-[13px] italic leading-relaxed text-[#374151]">
          众生皆可见
          <span className="mt-1 block text-[11px] not-italic tracking-wide text-[#9CA3AF]">
            Visible to all entities
          </span>
        </p>
      )
    case 'onlyUser':
      return (
        <div className="rounded-xl bg-gradient-to-br from-[#D4AF37]/10 via-white to-white px-3 py-3 ring-1 ring-[#D4AF37]/15">
          <p
            className="font-serif text-[13px] font-semibold leading-relaxed text-[#111827]"
            style={{ color: '#1a1a1a' }}
          >
            深渊独白：仅向你开放观测
            <span
              className="mt-1 block text-[11px] font-normal not-italic tracking-wide"
              style={{ color: PLATINUM }}
            >
              Exclusive resonance with you
            </span>
          </p>
        </div>
      )
    case 'private':
      return (
        <p className="font-serif text-[13px] italic leading-relaxed text-[#374151]">
          封存于自身
          <span className="mt-1 block text-[11px] not-italic tracking-wide text-[#9CA3AF]">
            Retained in private vault
          </span>
        </p>
      )
    case 'shareWith':
      return (
        <div>
          <p className="font-serif text-[13px] italic leading-relaxed text-[#374151]">
            定向展露
            <span className="mt-1 block text-[11px] not-italic tracking-wide text-[#9CA3AF]">
              Selective exposure
            </span>
          </p>
          {protocol.names.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {protocol.names.map((entry, index) => (
                <NameChip key={`share-${index}-${entry.name}`} entry={entry} />
              ))}
            </div>
          ) : null}
        </div>
      )
    case 'hideFrom':
      return (
        <div>
          <p className="font-serif text-[13px] font-semibold leading-relaxed text-[#111827]">
            刻意隐匿
            <span className="mt-1 block text-[11px] font-normal not-italic tracking-wide text-[#9CA3AF]">
              Shielded from targets
            </span>
          </p>
          {protocol.names.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {protocol.names.map((entry, index) => (
                <NameChip key={`hide-${index}-${entry.name}`} entry={entry} />
              ))}
            </div>
          ) : null}
        </div>
      )
    default:
      return null
  }
}

export function MomentVisibilityProtocolInspector({
  privacy,
  contactDirectory,
  momentContacts,
  currentUserName,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  const protocol = useMemo(() => {
    const resolveName = buildMomentContactNameResolver({
      contactDirectory,
      momentContacts,
      currentUserName,
    })
    return resolveMomentVisibilityProtocol(privacy, resolveName)
  }, [contactDirectory, currentUserName, momentContacts, privacy])

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const root = rootRef.current
      if (!root || root.contains(event.target as Node)) return
      close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [close, open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close, open])

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="检视观测权限"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((v) => !v)
        }}
        className="group flex size-8 items-center justify-center rounded-md border border-gray-200/90 bg-gray-50/95 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors duration-200 hover:border-gray-300 hover:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-300"
      >
        <Eye className="size-4 stroke-[1.5] text-gray-600 transition-colors group-hover:text-gray-800" aria-hidden />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.96, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -5, scale: 0.96, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="absolute right-0 top-full z-30 mt-2 w-[min(92vw,280px)] rounded-2xl border border-gray-100 bg-white/90 p-4 shadow-[0_10px_40px_rgba(0,0,0,0.04)] backdrop-blur-xl"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <p className="font-mono text-[9px] tracking-[0.28em] text-gray-400">
              VISIBILITY | 观测权限
            </p>
            <div className="mt-3">
              <ProtocolBody protocol={protocol} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
