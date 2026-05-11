import { motion } from 'framer-motion'
import type { PersonaEditTabId } from './personaEditorTabs'
import { PERSONA_ARCHIVE_TABS } from './personaEditorTabs'

const LINE_LAYOUT_ID = 'persona-archive-platinum-line'

export function ArchiveIndexTabs({
  activeId,
  onChange,
  hideNetwork,
}: {
  activeId: PersonaEditTabId
  onChange: (id: PersonaEditTabId) => void
  /** NPC 人设隐藏人脉 Tab */
  hideNetwork?: boolean
}) {
  const tabs = hideNetwork ? PERSONA_ARCHIVE_TABS.filter((t) => t.id !== 'network') : PERSONA_ARCHIVE_TABS

  return (
    <nav
      aria-label="档案索引"
      className="border-b border-neutral-200/80 bg-white/90 backdrop-blur-md"
    >
      <div className="flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const active = activeId === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className="relative shrink-0 px-4 py-3 text-left transition-colors duration-200"
            >
              <span
                className={`block whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.22em] ${
                  active ? 'text-[#1C1C1E]' : 'text-gray-400'
                }`}
              >
                {t.num} {t.en}
              </span>
              <span
                className={`mt-0.5 block whitespace-nowrap text-[12px] font-medium tracking-tight ${
                  active ? 'text-[#1C1C1E]' : 'text-gray-400'
                }`}
              >
                <span className="mr-1 font-light opacity-50">|</span>
                {t.zh}
              </span>
              {active ? (
                <motion.span
                  layoutId={LINE_LAYOUT_ID}
                  className="pointer-events-none absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#D4AF37]"
                  transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  aria-hidden
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
