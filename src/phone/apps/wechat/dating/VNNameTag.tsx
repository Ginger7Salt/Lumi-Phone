type Props = {
  name: string
  innerVoice?: boolean
}

export function VNNameTag({ name, innerVoice = false }: Props) {
  return (
    <div
      className="absolute left-[5%] top-0 z-20 -translate-y-1/2 rounded-md px-3 py-1.5 shadow-[0_8px_20px_rgba(0,0,0,0.2)]"
      style={{
        background: innerVoice ? 'rgba(36, 28, 16, 0.94)' : 'rgba(28, 28, 30, 0.94)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-4 w-[1px] rounded-full"
          style={{ background: innerVoice ? 'rgba(212,175,55,0.95)' : 'rgba(255,255,255,0.65)' }}
        />
        <span
          className="text-[13px] font-medium tracking-[0.12em]"
          style={{ color: innerVoice ? '#E7CC8F' : '#FFFFFF' }}
        >
          {name || '未命名'}
        </span>
      </div>
    </div>
  )
}

