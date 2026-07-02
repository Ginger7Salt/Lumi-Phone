import { motion } from 'framer-motion'

import { Pressable } from '../../../components/Pressable'
import { PULSE_CARD_SHADOW, PULSE_STAGGER } from '../constants'
import type { PulsePost } from '../pulseTypes'

/** 个人主页媒体 Tab — 双列瀑布流 */
export function MediaWaterfall({
  posts,
  onOpen,
}: {
  posts: PulsePost[]
  onOpen: (postId: string) => void
}) {
  const left: PulsePost[] = []
  const right: PulsePost[] = []
  posts.forEach((p, i) => (i % 2 === 0 ? left : right).push(p))

  const renderColumn = (items: PulsePost[], side: 'left' | 'right') => (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {items.map((post, i) => {
        const url = post.imageUrls?.[0]
        if (!url) return null
        const tall = (i + (side === 'right' ? 1 : 0)) % 3 === 0
        return (
          <motion.div
            key={post.id}
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0 },
            }}
          >
            <Pressable
              type="button"
              onClick={() => onOpen(post.id)}
              className={`block w-full overflow-hidden rounded-xl bg-[#F5F5F4] ${PULSE_CARD_SHADOW}`}
            >
              <img
                src={url}
                alt=""
                className={`w-full object-cover ${tall ? 'aspect-[3/4]' : 'aspect-square'}`}
                draggable={false}
              />
            </Pressable>
          </motion.div>
        )
      })}
    </div>
  )

  return (
    <motion.div
      className="flex gap-2"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: PULSE_STAGGER } }}
    >
      {renderColumn(left, 'left')}
      {renderColumn(right, 'right')}
    </motion.div>
  )
}
