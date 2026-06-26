import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'

import { Pressable } from '../../../components/Pressable'
import { phoneNumStyle } from '../../../types'
import { CustomNumericKeyboard } from '../redPacket/CustomNumericKeyboard'

type PinKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back'

export function PaymentKeyboard({
  open,
  title = '输入支付密码',
  subtitle,
  amountLabel,
  onClose,
  onVerified,
  verifyPin,
  showInlineSuccess = true,
  verifiedHoldMs,
}: {
  open: boolean
  title?: string
  subtitle?: string
  amountLabel?: string
  onClose: () => void
  onVerified: () => void
  verifyPin: (pin: string) => Promise<boolean>
  /** 为 false 时验证通过后立即回调，由外部展示成功动效 */
  showInlineSuccess?: boolean
  verifiedHoldMs?: number
}) {
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [verified, setVerified] = useState(false)

  const reset = useCallback(() => {
    setPin('')
    setPinError('')
    setVerified(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [onClose, reset])

  const submitDigit = useCallback(
    async (digit: string) => {
      const next = `${pin}${digit}`.slice(0, 6)
      setPin(next)
      if (next.length < 6) return
      const ok = await verifyPin(next)
      if (!ok) {
        setPin('')
        setPinError('支付密码错误')
        return
      }
      const holdMs = verifiedHoldMs ?? (showInlineSuccess ? 720 : 280)
      if (showInlineSuccess) setVerified(true)
      window.setTimeout(() => {
        onVerified()
        handleClose()
      }, holdMs)
    },
    [handleClose, onVerified, pin, showInlineSuccess, verifiedHoldMs, verifyPin],
  )

  const onKey = useCallback(
    (key: PinKey) => {
      if (verified) return
      if (key === '.') return
      if (key === 'back') {
        setPin((prev) => prev.slice(0, -1))
        setPinError('')
        return
      }
      void submitDigit(key)
    },
    [submitDigit, verified],
  )

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-[80] flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Pressable type="button" onClick={handleClose} className="min-h-0 flex-1 bg-black/30 backdrop-blur-[2px]" aria-label="关闭">
            {' '}
          </Pressable>
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 42 }}
            className="rounded-t-[28px] border-t border-[#ece8e2] bg-gradient-to-b from-white to-[#faf8f4] px-5 pb-[max(18px,env(safe-area-inset-bottom,0px))] pt-5"
          >
            <p className="text-center text-[10px] tracking-[0.2em] text-neutral-400">安全支付</p>
            <h3 className="mt-2 text-center text-[22px] font-semibold text-[#1C1C1E]">{title}</h3>
            {amountLabel ? (
              <p className="mt-2 text-center text-[22px] leading-none text-[#1C1C1E]" style={phoneNumStyle}>
                {amountLabel}
              </p>
            ) : null}
            {subtitle ? <p className="mt-1 text-center text-[12px] text-neutral-400">{subtitle}</p> : null}

            <AnimatePresence>
              {verified ? (
                <motion.div
                  className="mt-8 flex flex-col items-center"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <span
                    className="flex size-14 items-center justify-center rounded-full border border-[#D4AF37]/40"
                    style={{ color: '#D4AF37' }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <p className="mt-3 text-[11px] tracking-[0.12em] text-[#D4AF37]">支付成功</p>
                </motion.div>
              ) : (
                <motion.div key="pin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="mt-5 flex justify-center gap-3">
                    {Array.from({ length: 6 }, (_, i) => (
                      <motion.span
                        key={i}
                        animate={
                          i < pin.length
                            ? { scale: [1.15, 1], backgroundColor: '#111111' }
                            : { scale: 1, backgroundColor: 'rgba(255,255,255,0)' }
                        }
                        transition={{ duration: 0.16 }}
                        className="size-3.5 rounded-full border border-neutral-300"
                      />
                    ))}
                  </div>
                  {pinError ? <p className="mt-3 text-center text-[12px] text-[#d95050]">{pinError}</p> : null}
                  <div className="mt-5">
                    <CustomNumericKeyboard variant="pin" tone="platinum" onKey={onKey} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
