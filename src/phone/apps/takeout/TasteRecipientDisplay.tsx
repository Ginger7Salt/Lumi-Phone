/** 收货昵称 + 浅灰括号内真实姓名 */
export function TasteRecipientLabelWithRealName({
  nickname,
  realName,
  nicknameClassName = 'text-[#1C1C1E]',
  realNameClassName = 'text-neutral-300',
}: {
  nickname: string
  realName?: string
  nicknameClassName?: string
  realNameClassName?: string
}) {
  const nick = nickname.trim()
  const real = realName?.trim() || ''
  if (!nick && !real) return null
  return (
    <span>
      {nick ? <span className={nicknameClassName}>{nick}</span> : null}
      {real ? <span className={realNameClassName}>（{real}）</span> : null}
    </span>
  )
}
