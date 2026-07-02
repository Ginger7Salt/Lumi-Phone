import { useCallback, useEffect, useState } from 'react'

import { GameCanvas } from './GameCanvas'
import { GameLobbySheet } from './GameLobbySheet'
import { GameReadyScreen } from './GameReadyScreen'
import type { GomokuSessionSetup } from './gomokuReactionBank'
import type { WeChatMiniGameMatchResult } from '../newFriendsPersona/types'
import type { MiniGameType } from './types'

export type MiniGameSession = {
  gameType: MiniGameType
  inviteId: string
  userInviteMessageId?: string
  acceptMessageId?: string
  preloadedGomokuSetup?: GomokuSessionSetup
}

export function MiniGameFlow({
  lobbyOpen,
  session,
  charId,
  charName,
  avatarUrl,
  playerAvatarUrl,
  conversationKey,
  onCloseLobby,
  onSendInvite,
  onCloseGame,
  onGameFinished,
}: {
  lobbyOpen: boolean
  session: MiniGameSession | null
  charId: string
  charName?: string
  avatarUrl?: string
  playerAvatarUrl?: string
  conversationKey?: string
  onCloseLobby: () => void
  onSendInvite: (game: MiniGameType) => void
  onCloseGame: () => void
  onGameFinished?: (params: { inviteId: string; matchResult: WeChatMiniGameMatchResult }) => void
}) {
  const [launchPhase, setLaunchPhase] = useState<'ready' | 'playing'>('ready')

  useEffect(() => {
    if (session) setLaunchPhase('ready')
  }, [session])

  const handleStartGame = useCallback(() => {
    setLaunchPhase('playing')
  }, [])

  const handleSendInvite = useCallback(
    (game: MiniGameType) => {
      onSendInvite(game)
      onCloseLobby()
    },
    [onCloseLobby, onSendInvite],
  )

  return (
    <>
      <GameLobbySheet open={lobbyOpen} onClose={onCloseLobby} onSendInvite={handleSendInvite} />
      {session ? (
        <>
          <GameReadyScreen
            open={launchPhase === 'ready'}
            gameType={session.gameType}
            charName={charName}
            avatarUrl={avatarUrl}
            playerAvatarUrl={playerAvatarUrl}
            onClose={onCloseGame}
            onStartGame={handleStartGame}
          />
          <GameCanvas
            open={launchPhase === 'playing'}
            gameType={session.gameType}
            charId={charId}
            charName={charName}
            avatarUrl={avatarUrl}
            playerAvatarUrl={playerAvatarUrl}
            conversationKey={conversationKey}
            inviteId={session.inviteId}
            preloadedGomokuSetup={session.preloadedGomokuSetup}
            onClose={onCloseGame}
            onGameFinished={onGameFinished}
          />
        </>
      ) : null}
    </>
  )
}
