import { motion } from 'framer-motion'

import { TASTE_STORES } from './tasteCatalog'
import { StorePreviewCard } from './StorePreviewCard'

export function TasteHome({ onOpenStore }: { onOpenStore: (storeId: string) => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-transparent pb-8">
      <header className="px-6 pb-6 pt-5 text-center">
        <div className="mx-auto h-px w-16 bg-gray-100" />
        <p className="mt-4 text-[11px] tracking-[0.12em] text-neutral-400">私厨甄选</p>
      </header>

      <div className="space-y-4 px-4">
        {TASTE_STORES.map((store, idx) => (
          <motion.div
            key={store.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.4 }}
          >
            <StorePreviewCard store={store} onOpenStore={onOpenStore} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
