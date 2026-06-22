import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { personaDb } from '../newFriendsPersona/idb'
import type { CharacterMemory } from '../newFriendsPersona/types'
import { formatMomentMemoryBodyForDisplay } from './momentMemoryDisplayUtils'
import { MemoryContentWithSourceBadges } from './memorySourceBadges'

/**
 * 列表/详情展示：将记忆中的 `{{user}}` / `{{char}}` / `{{archive_char}}` / `{{id:…}}` 展开为绑定姓名（与注入模型一致）。
 */
export function MemoryContentWithSourceBadgesFromRow(props: {
  memory: CharacterMemory
  bodyClassName?: string
  bodyStyle?: CSSProperties
  size?: 'sm' | 'md'
  emptyBodyFallback?: string
}): ReactNode {
  const [displayContent, setDisplayContent] = useState(props.memory.content)

  useEffect(() => {
    const m = props.memory
    let cancelled = false
    ;(async () => {
      if (!String(m.content ?? '').includes('{{')) {
        if (!cancelled) setDisplayContent(m.content)
        return
      }
      try {
        const [line] = await personaDb.expandMemoryListContentForPrompt([m], m.characterId)
        if (!cancelled) setDisplayContent(line ?? m.content)
      } catch {
        if (!cancelled) setDisplayContent(m.content)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    props.memory.id,
    props.memory.content,
    props.memory.characterId,
    props.memory.memoryScope,
    props.memory.linkedFromCharacterId,
  ])

  return (
    <MemoryContentWithSourceBadges
      content={
        props.memory.memoryScope === 'moment'
          ? formatMomentMemoryBodyForDisplay(displayContent)
          : displayContent
      }
      bodyClassName={props.bodyClassName}
      bodyStyle={props.bodyStyle}
      size={props.size}
      emptyBodyFallback={props.emptyBodyFallback}
    />
  )
}
