import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { getMbtiTagline4 } from '../../wechat/newFriendsPersona/mbtiProfileUi'
import { Pressable } from '../../../components/Pressable'
import { DialogueStrip } from './components/DialogueStrip'
import { SimNum, simNumStyle } from './components/SimNum'
import { PROLOGUE_QUIZ } from './presets'
import type { PlayerProfile } from './types'
import { useSimulatorStore } from './useSimulatorStore'

const INTRO_LINES = [
  '镜头、热搜、合约——这个行业从不缺真实的重量。',
  '你立志成为金牌制作人。此路艰深，每一步皆关乎成败。',
  '在踏上星途之前，请先完成这份命运问卷——没有标准答案，只有你的选择。',
]

export function PrologueQuiz() {
  const completePrologue = useSimulatorStore((s) => s.completePrologue)
  /** null = 已过开场；0~2 = 开场对话条序号 */
  const [introIdx, setIntroIdx] = useState<number | null>(0)
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [birthdayMD, setBirthdayMD] = useState('06-15')
  const [mbtiKey, setMbtiKey] = useState('INFJ')
  const [answers, setAnswers] = useState<Record<string, string>>({})

  const q = PROLOGUE_QUIZ[step - 1]

  const goPrevQuestion = useCallback(() => {
    if (step === PROLOGUE_QUIZ.length + 1) {
      setStep(PROLOGUE_QUIZ.length)
      return
    }
    if (step > 1) setStep((s) => s - 1)
  }, [step])

  const finish = useCallback(() => {
    const profile: Omit<PlayerProfile, 'stats'> = {
      name: name.trim() || '无名',
      birthdayMD,
      mbti: mbtiKey,
      prStyle: 'calm',
      romanceStyle: 'secret',
    }
    completePrologue(profile, answers)
  }, [answers, birthdayMD, completePrologue, mbtiKey, name])

  const bg = (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(circle at 28% 18%, rgba(249,168,212,0.35), transparent 52%), radial-gradient(circle at 72% 82%, rgba(251,207,232,0.3), transparent 48%)',
        }}
        aria-hidden
      />
    </>
  )

  if (introIdx !== null && introIdx < INTRO_LINES.length) {
    const isLast = introIdx === INTRO_LINES.length - 1
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-[#FFFBFB] to-[#FFF5F7]">
        {bg}
        <DialogueStrip
          align="center"
          hint="序章"
          text={INTRO_LINES[introIdx]}
          continueLabel={isLast ? '开始' : '继续'}
          onContinue={() => {
            if (isLast) setIntroIdx(null)
            else setIntroIdx((i) => (i ?? 0) + 1)
          }}
        />
      </div>
    )
  }

  if (step === PROLOGUE_QUIZ.length + 1) {
    return (
      <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-[#FFFBFB] to-[#FFF5F7]">
        {bg}
        <div className="sm-tab-scroll h-full min-h-0">
          <div className="sm-tab-scroll-inner">
            <Pressable
              onClick={goPrevQuestion}
              className="mb-2 inline-flex items-center gap-1 text-[13px] text-stone-500"
              aria-label="返回上一题"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              上一题
            </Pressable>
            <h2 className="sm-serif text-[20px] font-semibold text-[#2D2422]">留下你的名字</h2>
            <label className="mt-2 block text-[13px] text-stone-500">姓名</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full border-b border-rose-200 bg-transparent py-3 text-[16px] text-[#2D2422] outline-none"
              placeholder="请输入"
            />
            <label className="block text-[13px] text-stone-500">生日（月-日）</label>
            <input
              value={birthdayMD}
              onChange={(e) => setBirthdayMD(e.target.value)}
              className="mt-2 w-full border-b border-rose-200 bg-transparent py-3 text-[16px] outline-none"
              style={simNumStyle}
            />
            <label className="block text-[13px] text-stone-500">性格气质</label>
            <p className="mt-2 text-[15px] text-stone-700">{getMbtiTagline4(mbtiKey) || '理想温情'}</p>
            <div className="sm-chip-row">
              {['INFJ', 'INFP', 'INTJ', 'ENFP', 'ISTP', 'ISFP'].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMbtiKey(m)}
                  className={`rounded-full px-4 py-2 text-[13px] ${
                    mbtiKey === m ? 'bg-rose-400 text-white' : 'bg-white text-stone-600 ring-1 ring-rose-100'
                  }`}
                >
                  {getMbtiTagline4(m)}
                </button>
              ))}
            </div>
            <Pressable onClick={finish} className="sm-btn-primary w-full py-3.5 text-[15px]">
              踏入星途
            </Pressable>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-[#FFFBFB] to-[#FFF5F7]">
      {bg}
      <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))]">
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex w-full max-w-md flex-col items-center gap-4"
          >
            <div className="flex w-full items-center justify-between gap-2">
              {step > 1 ? (
                <Pressable
                  onClick={goPrevQuestion}
                  className="inline-flex shrink-0 items-center gap-1 px-1 py-1 text-[13px] text-stone-500"
                  aria-label="返回上一题"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  上一题
                </Pressable>
              ) : (
                <span className="w-[52px]" aria-hidden />
              )}
              <p className="text-center text-[12px] tracking-[0.15em] text-rose-400">
                命运问卷 · <SimNum>{step}</SimNum>/<SimNum>{PROLOGUE_QUIZ.length}</SimNum>
              </p>
              <span className="w-[52px]" aria-hidden />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="sm-story-line sm-serif w-full px-5 py-4 text-center text-[16px] leading-[1.88] text-[#2D2422]"
            >
              {q.text}
            </motion.div>

            <div className="max-h-[min(40vh,280px)] w-full space-y-2 overflow-y-auto">
              {q.choices.map((c) => {
                const selected = answers[q.id] === c.id
                return (
                  <Pressable
                    key={c.id}
                    onClick={() => {
                      setAnswers((prev) => ({ ...prev, [q.id]: c.id }))
                      setStep((s) => s + 1)
                    }}
                    className={`sm-btn-ghost w-full px-4 py-3.5 text-left text-[15px] leading-relaxed ${
                      selected ? 'ring-2 ring-rose-300 bg-rose-50/60' : ''
                    }`}
                  >
                    {c.label}
                  </Pressable>
                )
              })}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
