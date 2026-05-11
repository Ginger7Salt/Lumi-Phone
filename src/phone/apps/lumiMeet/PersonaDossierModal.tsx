import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { ComprehensivePersona } from './comprehensivePersona'
import { getLumiMeetPortalTarget } from './lumiMeetPortal'
import { NineDimensionAccordion } from './nineDimensionAccordion'

/** 机密档案视图（与 MeetWorldbookShelfModal 共享九维手风琴） */
export function PersonaDossierModal({
  open,
  onClose,
  nickname,
  avatarUrl,
  dossier,
}: {
  open: boolean
  onClose: () => void
  nickname: string
  avatarUrl: string
  dossier: ComprehensivePersona
}) {
  const portalEl = getLumiMeetPortalTarget()

  if (!portalEl) return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="dossier-root"
          className="pointer-events-auto fixed inset-0 z-[310] flex flex-col bg-white"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <header
            className="flex shrink-0 items-center gap-3 border-b border-black/[0.06] px-4 pb-3"
            style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
          >
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#2c2a26] active:bg-black/[0.04]"
              aria-label="关闭"
            >
              <X className="size-5" strokeWidth={1.25} />
            </button>
            <img
              src={avatarUrl}
              alt=""
              className="size-11 shrink-0 rounded-2xl object-cover ring-1 ring-black/[0.06]"
            />
            <div className="min-w-0 flex-1">
              <p className="meet-caption-en text-[9px] uppercase tracking-[0.35em] text-[#b8b5ad]">
                Persona Dossier · 机密档案
              </p>
              <h2 className="truncate font-medium tracking-[0.08em] text-[#2c2a26]" style={{ fontSize: '17px' }}>
                {nickname}
              </h2>
            </div>
          </header>

          <div className="meet-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
            <p className="meet-caption-en mb-4 text-center text-[10px] uppercase tracking-[0.42em] text-[#c4c0b8]">
              Nine-Dimensional Matrix · 只读
            </p>
            <NineDimensionAccordion dossier={dossier} />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    portalEl,
  )
}
