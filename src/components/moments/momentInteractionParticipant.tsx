import { resolveProfileAvatarPreviewUrl } from '../../phone/utils/characterAvatarUrl'

import type { MomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'
import { resolveCharIdByDisplayName } from './momentRelationshipGraph'

export type InteractionParticipantMeta = {
  charId?: string
  /** 微信备注（通讯录展示名） */
  remark: string
  avatarUrl?: string
  isCurrentUser: boolean
}

type ResolveParticipantParams = {
  displayName: string
  charId?: string
  currentUserName: string
  currentUserAvatarUrl?: string
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
}

export function resolveInteractionParticipant(
  params: ResolveParticipantParams,
): InteractionParticipantMeta {
  const name = params.displayName.trim()
  const player = params.currentUserName.trim()
  if (player && name === player) {
    return {
      remark: name,
      avatarUrl: params.currentUserAvatarUrl,
      isCurrentUser: true,
    }
  }

  const resolvedCharId =
    params.charId?.trim() ||
    resolveCharIdByDisplayName(name, params.momentContacts, params.contactDirectory.getDisplayName)
  if (resolvedCharId) {
    return {
      charId: resolvedCharId,
      remark: params.contactDirectory.getDisplayName(resolvedCharId),
      avatarUrl: resolveProfileAvatarPreviewUrl(params.contactDirectory.getAvatar(resolvedCharId)),
      isCurrentUser: false,
    }
  }

  return { remark: name || '未命名', isCurrentUser: false }
}

type ParticipantAvatarProps = {
  meta: InteractionParticipantMeta
  size?: 'sm' | 'md'
  onClick?: () => void
}

export function InteractionParticipantAvatar({ meta, size = 'md', onClick }: ParticipantAvatarProps) {
  const dim = size === 'sm' ? 'size-5' : 'size-7'
  const textSize = size === 'sm' ? 'text-[9px]' : 'text-[10px]'

  const avatar = meta.avatarUrl ? (
    <img
      src={meta.avatarUrl}
      alt=""
      className={`${dim} shrink-0 rounded-[4px] object-cover bg-gray-100`}
    />
  ) : (
    <span
      className={`${dim} flex shrink-0 items-center justify-center rounded-[4px] bg-gray-200 ${textSize} font-medium text-gray-600`}
    >
      {(meta.remark || '?').slice(0, 1)}
    </span>
  )

  if (!onClick) return avatar

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="shrink-0 rounded-[4px] transition-opacity hover:opacity-85 focus:outline-none"
      aria-label={`查看 ${meta.remark || '用户'} 资料`}
    >
      {avatar}
    </button>
  )
}
