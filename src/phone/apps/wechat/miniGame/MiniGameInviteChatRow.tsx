import { useCallback, useRef } from 'react'

import type { WeChatBubbleTheme } from '../../../types'
import {
  ChatGroupSenderNicknameWithRank,
  ChatGroupSpeakerRankOnAvatar,
} from '../group/ChatGroupSpeakerAvatarWrap'
import { useLongPress } from '../hooks/useWeChatLongPress'
import { MiniGameAcceptResponseCard, MiniGameDeclineResponseCard } from './MiniGameAcceptResponseCard'
import { MiniGameCharacterInviteReceivedCard } from './MiniGameCharacterInviteReceivedCard'
import { invitePayloadFromAcceptPayload } from './miniGameInviteHelpers'
import { MiniGameInviteSentCard } from './MiniGameInviteSentCard'
import type { WeChatMiniGameInvitePayload, WeChatMiniGamePayload } from '../newFriendsPersona/types'

/** 用户侧 / 角色侧小游戏卡统一宽度 */
export const MINI_GAME_CHAT_CARD_WIDTH_CLASS = 'w-[min(260px,calc(100vw-120px))]'

type Props = {
  id: string
  isSelf: boolean
  data: WeChatMiniGamePayload
  bubble: WeChatBubbleTheme
  showAvatar: boolean
  showAvatarColumn: boolean
  chatSelfAvatarUrl?: string
  chatOtherAvatarUrl?: string
  chatOtherSenderNickname?: string
  chatOtherAvatarRankBadge?: 'owner' | 'admin' | null
  chatSelfAvatarRankBadge?: 'owner' | 'admin' | null
  groupRankShowBesideNickname?: boolean
  selected?: boolean
  onEnterGame?: (invite: WeChatMiniGameInvitePayload) => void
  miniGameInviteRespondBusy?: boolean
  onRespondToCharacterInvite?: (
    messageId: string,
    invite: WeChatMiniGameInvitePayload,
    response: 'accept' | 'decline',
  ) => void
  onLongPress?: (anchorRect: DOMRect) => void
}

function MiniGameCardBody({
  messageId,
  isSelf,
  data,
  peerName,
  onEnterGame,
  miniGameInviteRespondBusy,
  onRespondToCharacterInvite,
}: {
  messageId: string
  isSelf: boolean
  data: WeChatMiniGamePayload
  peerName?: string
  onEnterGame?: (invite: WeChatMiniGameInvitePayload) => void
  miniGameInviteRespondBusy?: boolean
  onRespondToCharacterInvite?: (
    messageId: string,
    invite: WeChatMiniGameInvitePayload,
    response: 'accept' | 'decline',
  ) => void
}) {
  if (data.kind === 'game_invite') {
    if (isSelf) {
      return (
        <MiniGameInviteSentCard
          data={data}
          peerName={peerName}
          onEnterGame={
            data.charResponded === 'accepted' && !data.matchResult && onEnterGame
              ? () => onEnterGame(data)
              : undefined
          }
        />
      )
    }
    return (
      <MiniGameCharacterInviteReceivedCard
        data={data}
        peerName={peerName}
        busy={miniGameInviteRespondBusy}
        onAccept={() => onRespondToCharacterInvite?.(messageId, data, 'accept')}
        onDecline={() => onRespondToCharacterInvite?.(messageId, data, 'decline')}
        onEnterGame={
          data.userResponded === 'accepted' && !data.matchResult && onEnterGame
            ? () => onEnterGame(data)
            : undefined
        }
      />
    )
  }
  if (data.kind === 'game_accept') {
    return (
      <MiniGameAcceptResponseCard
        data={data}
        charName={peerName}
        isSelf={isSelf}
        onEnterGame={
          !data.matchResult && onEnterGame ? () => onEnterGame(invitePayloadFromAcceptPayload(data)) : undefined
        }
      />
    )
  }
  return <MiniGameDeclineResponseCard data={data} />
}

/** 小游戏邀约 / 回应聊天气泡行 */
export function MiniGameInviteChatRow({
  id,
  isSelf,
  data,
  bubble,
  showAvatar,
  showAvatarColumn,
  chatSelfAvatarUrl,
  chatOtherAvatarUrl,
  chatOtherSenderNickname,
  chatOtherAvatarRankBadge = null,
  groupRankShowBesideNickname = true,
  selected = false,
  onEnterGame,
  miniGameInviteRespondBusy,
  onRespondToCharacterInvite,
  onLongPress,
}: Props) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const avatarPx = 40

  const handleLongPress = useCallback(() => {
    if (!onLongPress) return
    const el = anchorRef.current
    if (!el) return
    onLongPress(el.getBoundingClientRect())
  }, [onLongPress])

  const { bind, pressing } = useLongPress({
    enabled: !!onLongPress,
    ms: 500,
    moveThresholdPx: 10,
    onLongPress: () => handleLongPress(),
  })

  const card = (
    <div
      ref={anchorRef}
      className={`relative inline-block select-none transition-[transform,opacity] duration-150 ease-out ${MINI_GAME_CHAT_CARD_WIDTH_CLASS}`}
      style={{
        transform: pressing && !selected ? 'scale(0.98)' : 'scale(1)',
        opacity: pressing && !selected ? 0.92 : 1,
      }}
      {...bind}
    >
      <MiniGameCardBody
        messageId={id}
        isSelf={isSelf}
        data={data}
        peerName={chatOtherSenderNickname}
        onEnterGame={onEnterGame}
        miniGameInviteRespondBusy={miniGameInviteRespondBusy}
        onRespondToCharacterInvite={onRespondToCharacterInvite}
      />
    </div>
  )

  const showAvatarVisual = showAvatar && showAvatarColumn
  const reserveAvatarGutter = showAvatar
  const avatarGutter = <div className="h-10 w-10 shrink-0" aria-hidden />
  const otherAvatarFallback = (
    <div
      className="h-10 w-10 shrink-0"
      style={{
        borderRadius: `${bubble.avatarRadiusPx}px`,
        background: 'rgba(0,0,0,0.06)',
        border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
      }}
      aria-hidden
    />
  )

  if (isSelf) {
    return (
      <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-visible" data-wx-msg-id={id}>
        <div className="ml-auto mr-[24px] flex max-w-full flex-row-reverse items-start gap-[12px]">
          {showAvatarVisual ? (
            chatSelfAvatarUrl?.trim() ? (
              <img
                src={chatSelfAvatarUrl.trim()}
                alt=""
                width={avatarPx}
                height={avatarPx}
                className="h-10 w-10 shrink-0 object-cover"
                style={{
                  borderRadius: `${bubble.avatarRadiusPx}px`,
                  border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                }}
                aria-hidden
              />
            ) : (
              <div
                className="h-10 w-10 shrink-0"
                style={{
                  borderRadius: `${bubble.avatarRadiusPx}px`,
                  background: 'rgba(0,0,0,0.06)',
                  border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                }}
                aria-hidden
              />
            )
          ) : reserveAvatarGutter ? (
            avatarGutter
          ) : null}
          <div className="flex min-w-0 flex-col items-end">{card}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-[100vw] max-w-[100vw] shrink-0 overflow-x-visible" data-wx-msg-id={id}>
      {!showAvatar ? (
        <div className="ml-[24px] mr-auto min-w-0">{card}</div>
      ) : showAvatarVisual ? (
        <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
          {groupRankShowBesideNickname !== false || !chatOtherAvatarRankBadge ? (
            chatOtherAvatarUrl?.trim() ? (
              <img
                src={chatOtherAvatarUrl.trim()}
                alt=""
                width={avatarPx}
                height={avatarPx}
                className="h-10 w-10 shrink-0 object-cover"
                style={{
                  borderRadius: `${bubble.avatarRadiusPx}px`,
                  border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                }}
                aria-hidden
              />
            ) : (
              otherAvatarFallback
            )
          ) : (
            <ChatGroupSpeakerRankOnAvatar rankBadge={chatOtherAvatarRankBadge}>
              {chatOtherAvatarUrl?.trim() ? (
                <img
                  src={chatOtherAvatarUrl.trim()}
                  alt=""
                  width={avatarPx}
                  height={avatarPx}
                  className="h-10 w-10 shrink-0 object-cover"
                  style={{
                    borderRadius: `${bubble.avatarRadiusPx}px`,
                    border: '1px solid color-mix(in oklab, var(--wx-border) 70%, transparent)',
                  }}
                  aria-hidden
                />
              ) : (
                otherAvatarFallback
              )}
            </ChatGroupSpeakerRankOnAvatar>
          )}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
            {groupRankShowBesideNickname !== false ? (
              <ChatGroupSenderNicknameWithRank
                nickname={chatOtherSenderNickname}
                rankBadge={chatOtherAvatarRankBadge ?? null}
              />
            ) : null}
            {card}
          </div>
        </div>
      ) : reserveAvatarGutter ? (
        <div className="ml-[24px] mr-auto flex max-w-full flex-row items-start gap-[12px]">
          {avatarGutter}
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">{card}</div>
        </div>
      ) : (
        <div className="ml-[24px] mr-auto min-w-0">{card}</div>
      )}
    </div>
  )
}
