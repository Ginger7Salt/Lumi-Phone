import { motion } from 'framer-motion'

export type RolePortraitMsgBubbleProps = {
  body: string
  roleName: string
  isSelf: boolean
  portraitUrl?: string
  isTyping?: boolean
}

function RoleAvatar({
  roleName,
  portraitUrl,
}: {
  roleName: string
  portraitUrl?: string
}) {
  const initial = roleName.trim().slice(0, 1) || '？'
  return (
    <div className="jbs-gf-chat-role-avatar shrink-0" aria-hidden>
      {portraitUrl ? (
        <img
          src={portraitUrl}
          alt=""
          className="jbs-gf-chat-role-avatar-img"
          draggable={false}
        />
      ) : (
        <span className="jbs-gf-chat-role-avatar-fallback">{initial}</span>
      )}
    </div>
  )
}

export function RolePortraitMsgBubble({
  body,
  roleName,
  isSelf,
  portraitUrl,
  isTyping = false,
}: RolePortraitMsgBubbleProps) {
  const nickname = roleName.trim() || '未知'

  const bubble = (
    <div
      className={`jbs-font-serif jbs-gf-chat-dialogue-bubble jbs-gf-chat-group-bubble text-[15px] leading-[1.65] ${
        isSelf ? 'jbs-gf-chat-dialogue-bubble--self' : ''
      }${isSelf && isTyping ? ' jbs-gf-chat-dialogue-bubble--self-live' : ''}`}
    >
      <span className={isSelf ? 'jbs-gf-chat-dialogue-self-text' : undefined}>{body}</span>
      {isTyping ? (
        <span className="jbs-gf-chat-typewriter-cursor ml-0.5 inline-block w-[2px] align-middle" />
      ) : null}
    </div>
  )

  if (isSelf) {
    return (
      <motion.div
        className="jbs-gf-chat-group-row jbs-gf-chat-group-row--self mb-3 w-full shrink-0"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="jbs-gf-chat-group-row-inner jbs-gf-chat-group-row-inner--self flex max-w-full flex-row items-start justify-end gap-2.5">
          <div className="flex w-max max-w-[min(260px,calc(100vw-4.5rem))] shrink-0 flex-col items-end gap-[3px]">
            <span className="jbs-gf-chat-group-nickname max-w-full truncate text-right">{nickname}</span>
            {bubble}
          </div>
          <RoleAvatar roleName={nickname} portraitUrl={portraitUrl} />
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="jbs-gf-chat-group-row mb-3 w-full shrink-0 overflow-x-visible"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="jbs-gf-chat-group-row-inner flex max-w-full flex-row items-start justify-start gap-2.5">
        <RoleAvatar roleName={nickname} portraitUrl={portraitUrl} />
        <div className="flex min-w-0 max-w-[min(260px,calc(100vw-4.5rem))] flex-1 flex-col items-start gap-[3px]">
          <span className="jbs-gf-chat-group-nickname max-w-full truncate">{nickname}</span>
          {bubble}
        </div>
      </div>
    </motion.div>
  )
}
