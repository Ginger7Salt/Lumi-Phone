import { ChevronLeft } from 'lucide-react'
import { motion } from 'framer-motion'

import type { Relationship } from '../../phone/apps/wechat/newFriendsPersona/types'

import { MomentItem } from './MomentItem'
import { MomentsContentBackdrop, MomentsContentBackgroundLayer } from './MomentsContentBackdrop'
import type { MomentItemModel } from './mockMoments'
import { buildMomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'
import type { OnOpenMomentParticipantProfile } from './momentProfileNavigation'
import { useMomentInteractionClock } from './useMomentInteractionClock'

type MomentDetailPageProps = {
  item: MomentItemModel
  currentUserName: string
  currentUserAvatarUrl?: string
  momentContacts?: MomentContactRef[]
  momentRelationships?: Relationship[]
  playerIdentityId?: string | null
  enableVisitorFootprints?: boolean
  replyingMomentId?: string | null
  replyingAuthorName?: string | null
  replyingTargetName?: string | null
  highlightCommentId?: string | null
  onBack: () => void
  onOpenFloatingInput?: (momentId: string, replyTo?: string) => void
  onToggleLike?: (momentId: string, liked: boolean) => void | Promise<void>
  onCharacterMomentInteractionsUnlocked?: (momentId: string) => void
  onTogglePin?: (momentId: string) => void | Promise<void>
  onDelete?: (momentId: string) => void | Promise<void>
  allowSubjectPin?: boolean
  onOpenParticipantProfile?: OnOpenMomentParticipantProfile
  subjectCharacterId?: string
  subjectDisplayName?: string
  subjectAvatarUrl?: string
}

export function MomentDetailPage({
  item,
  currentUserName,
  currentUserAvatarUrl,
  momentContacts = [],
  momentRelationships = [],
  playerIdentityId,
  enableVisitorFootprints = false,
  replyingMomentId,
  replyingAuthorName,
  replyingTargetName,
  highlightCommentId,
  onBack,
  onOpenFloatingInput,
  onToggleLike,
  onCharacterMomentInteractionsUnlocked,
  onTogglePin,
  onDelete,
  allowSubjectPin,
  onOpenParticipantProfile,
  subjectCharacterId,
  subjectDisplayName,
  subjectAvatarUrl,
}: MomentDetailPageProps) {
  const now = useMomentInteractionClock(5000)
  const contactDirectory = buildMomentsContactDirectory(momentContacts)

  return (
    <motion.div
      className="absolute inset-0 z-[440] flex flex-col bg-transparent"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 42 }}
    >
      <header
        className="relative flex shrink-0 items-center border-b border-gray-100 bg-white/90 px-3 pb-3 backdrop-blur-md"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          aria-label="返回"
          onClick={onBack}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-black/[0.04]"
        >
          <ChevronLeft className="size-5 text-[#111827]" strokeWidth={1.5} />
        </button>
        <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold text-[#111827]">
          详情
        </h1>
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <MomentsContentBackgroundLayer />
        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <MomentsContentBackdrop className="min-h-full">
          <div className="mx-auto max-w-[560px]">
            <MomentItem
            item={item}
            currentUserName={currentUserName}
            currentUserAvatarUrl={currentUserAvatarUrl}
            now={now}
            contactDirectory={contactDirectory}
            momentContacts={momentContacts}
            momentRelationships={momentRelationships}
            playerIdentityId={playerIdentityId}
            enableVisitorFootprints={enableVisitorFootprints}
            isReplying={replyingMomentId === item.id}
            replyingAuthorName={replyingAuthorName}
            replyingTargetName={replyingTargetName}
            highlightCommentId={highlightCommentId}
            defaultExpanded
            showParticipantAvatars
            showMentionLabel
            onOpenFloatingInput={onOpenFloatingInput}
            onToggleLike={onToggleLike}
            onCharacterMomentInteractionsUnlocked={onCharacterMomentInteractionsUnlocked}
            onTogglePin={onTogglePin}
            onDelete={onDelete}
            allowSubjectPin={allowSubjectPin}
            onOpenParticipantProfile={onOpenParticipantProfile}
            subjectCharacterId={subjectCharacterId}
            subjectDisplayName={subjectDisplayName}
            subjectAvatarUrl={subjectAvatarUrl}
          />
          </div>
        </MomentsContentBackdrop>
        </div>
      </div>
    </motion.div>
  )
}
