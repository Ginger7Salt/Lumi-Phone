import { useCallback, useState } from 'react'
import { accountNumStyle } from '../../userSystem/AccountNum'
import { changeUserPassword } from '../../userSystem/userSystemApi'
import type { userAccountThemeTokens } from '../../userSystem/userAccountTheme'

type ThemeTokens = ReturnType<typeof userAccountThemeTokens>

type Props = {
  t: ThemeTokens
  inputCls: string
  dividerCls: string
  onInfo: (message: string) => void
  onError: (message: string) => void
}

const passwordInputStyle = {
  fontFamily: accountNumStyle.fontFamily,
  fontVariantNumeric: accountNumStyle.fontVariantNumeric,
} as const

export function UserAccountChangePasswordPanel({ t, inputCls, dividerCls, onInfo, onError }: Props) {
  const [open, setOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  const resetForm = useCallback(() => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setLocalError('')
  }, [])

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (prev) resetForm()
      return !prev
    })
    setLocalError('')
  }, [resetForm])

  const handleSubmit = useCallback(async () => {
    setLocalError('')
    onError('')
    if (!currentPassword) {
      setLocalError('请输入当前密码')
      return
    }
    if (!newPassword) {
      setLocalError('请输入新密码')
      return
    }
    if (newPassword.length < 6) {
      setLocalError('新密码至少 6 位')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('两次新密码不一致')
      return
    }
    if (currentPassword === newPassword) {
      setLocalError('新密码不能与当前密码相同')
      return
    }

    setSubmitting(true)
    try {
      const r = await changeUserPassword({ currentPassword, newPassword })
      if (!r.ok) {
        setLocalError(r.error)
        return
      }
      resetForm()
      setOpen(false)
      onInfo(r.message)
    } finally {
      setSubmitting(false)
    }
  }, [confirmPassword, currentPassword, newPassword, onError, onInfo, resetForm])

  return (
    <div className={`rounded-[16px] border p-4 ${t.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-medium">修改密码</p>
          <p className={`mt-1 text-[12px] leading-5 ${t.muted}`}>需先验证当前密码，再设置新密码。</p>
        </div>
        <button
          type="button"
          className={`shrink-0 rounded-[10px] border px-3 py-1.5 text-[12px] ${t.secondaryBtn}`}
          onClick={handleToggle}
        >
          {open ? '取消' : '修改'}
        </button>
      </div>

      {open ? (
        <div className={`mt-4 space-y-3 border-t pt-4 ${dividerCls}`}>
          {localError ? (
            <div className={`rounded-[10px] border px-3 py-2 text-[13px] ${t.errorBox}`}>{localError}</div>
          ) : null}
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>当前密码</span>
            <input
              type="password"
              className={inputCls}
              style={passwordInputStyle}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>新密码</span>
            <input
              type="password"
              className={inputCls}
              style={passwordInputStyle}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className={`mb-1 block text-[12px] ${t.label}`}>确认新密码</span>
            <input
              type="password"
              className={inputCls}
              style={passwordInputStyle}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button
            type="button"
            className={`h-11 w-full rounded-[12px] text-[14px] font-medium disabled:opacity-50 ${t.primaryBtn}`}
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting ? '提交中…' : '确认修改'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
