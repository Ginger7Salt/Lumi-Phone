import type { Character, Gender } from '../types'
import type { ApiConfig } from '../../../api/types'
import { CharacterBasicProfileForm } from '../CharacterBasicProfileForm'

export function BasicInfoTab(props: {
  editorId: string
  character: Character
  isNpcPerspective: boolean
  protagonistCallsUser: string
  onProtagonistCallsChange: (v: string) => void
  onProtagonistCallsInteraction: () => void
  avatarFileInputRef: React.RefObject<HTMLInputElement | null>
  onPickAvatarFile: (file: File | null) => void
  patchCharacter: (p: Partial<Character>) => void
  onMbtiSelect: (nextCode: string) => void
  apiConfig: ApiConfig | null
  bioGenerating: boolean
  setBioGenerating: (v: boolean) => void
  onBioApiMissing: () => void
  onBioWorldBookMissing: () => void
  genderLabelZh: (g: Gender | undefined | null) => string
}) {
  return (
    <section className="rounded-[14px] border border-neutral-200/90 bg-white px-3 pb-6 pt-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-4 border-b border-neutral-100 pb-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-neutral-400">01 INFO · 档案主体</p>
        <h2 className="mt-2 text-[17px] font-semibold tracking-tight text-[#1C1C1E]">基础信息</h2>
        <p className="mt-1 text-[11px] font-light leading-relaxed text-neutral-500">生理数据、命理与简述；已沿用体检报告式栅格。</p>
      </header>
      <CharacterBasicProfileForm {...props} />
    </section>
  )
}
