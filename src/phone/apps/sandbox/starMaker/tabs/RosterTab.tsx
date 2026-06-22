import { AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { ArtistAvatar } from '../components/ArtistAvatar'
import { TabScrollPage } from '../components/TabScrollPage'
import { ArtistDetailSheet } from '../views/ArtistDetailSheet'
import { useSimulatorStore } from '../useSimulatorStore'

export function RosterTab() {
  const artists = useSimulatorStore((s) => s.artists)
  const selectedArtistId = useSimulatorStore((s) => s.selectedArtistId)
  const selectArtist = useSimulatorStore((s) => s.selectArtist)

  const [detailOpen, setDetailOpen] = useState(false)

  const artist = artists.find((a) => a.id === selectedArtistId) ?? artists[0]

  if (!artist) {
    return (
      <TabScrollPage>
        <p className="py-16 text-center text-[14px] text-stone-500">尚无旗下艺人，请前往行程招募。</p>
      </TabScrollPage>
    )
  }

  function openArtist(id: string) {
    selectArtist(id)
    setDetailOpen(true)
  }

  return (
    <>
      <TabScrollPage>
        <p className="px-1 text-[12px] text-stone-500">点击头像查看艺人详情</p>
        <div className="grid grid-cols-4 gap-4 px-1 pt-1">
          {artists.map((a) => (
            <Pressable
              key={a.id}
              onClick={() => openArtist(a.id)}
              className="flex flex-col items-center"
              aria-label={`查看${a.name}`}
            >
              <ArtistAvatar
                artist={a}
                size="lg"
                selected={detailOpen && a.id === artist.id}
              />
            </Pressable>
          ))}
        </div>
      </TabScrollPage>

      <AnimatePresence>
        {detailOpen && artist ? (
          <ArtistDetailSheet artist={artist} onClose={() => setDetailOpen(false)} />
        ) : null}
      </AnimatePresence>
    </>
  )
}
