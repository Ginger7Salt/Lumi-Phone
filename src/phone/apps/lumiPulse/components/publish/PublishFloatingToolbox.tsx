import { AtSign, Eye, Hash, Image, MapPin, Smile } from 'lucide-react'
import { motion } from 'framer-motion'

import { Pressable } from '../../../../components/Pressable'
import { PULSE_COLORS } from '../../constants'

/** 内联工具栏：紧跟输入框下方，随内容滚动 */
export function PublishFloatingToolbox({
  onOpenEmoji,
  onImage,
  onHashtag,
  onMention,
  onLocation,
  onVisibility,
  onDismissKeyboard,
  imageDisabled,
  visibilityPartial,
}: {
  onOpenEmoji: () => void
  onImage: () => void
  onHashtag: () => void
  onMention: () => void
  onLocation: () => void
  onVisibility: () => void
  /** 点工具栏前先收键盘（话题按钮除外） */
  onDismissKeyboard?: () => void
  imageDisabled?: boolean
  visibilityPartial?: boolean
}) {
  return (
    <motion.div
      className="shrink-0 px-4 py-2.5"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 34 }}
    >
      <div className="flex items-center justify-center gap-0.5 rounded-full bg-[#FAFAFA] px-4 py-2.5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]">
        <ToolboxIcon
          icon={Smile}
          label="表情"
          onClick={onOpenEmoji}
          onDismissKeyboard={onDismissKeyboard}
          color={PULSE_COLORS.mistBlue}
        />
        <ToolboxIcon
          icon={Image}
          label="图片"
          onClick={onImage}
          onDismissKeyboard={onDismissKeyboard}
          disabled={imageDisabled}
          color={PULSE_COLORS.sage}
        />
        <ToolboxIcon
          icon={Hash}
          label="话题"
          onClick={onHashtag}
          keepKeyboard
          color={PUBLISH_HASH_COLOR}
        />
        <ToolboxIcon
          icon={AtSign}
          label="艾特"
          onClick={onMention}
          onDismissKeyboard={onDismissKeyboard}
          color={PULSE_COLORS.lightGold}
        />
        <ToolboxIcon
          icon={MapPin}
          label="位置"
          onClick={onLocation}
          onDismissKeyboard={onDismissKeyboard}
          color={PULSE_COLORS.muted}
        />
        <ToolboxIcon
          icon={Eye}
          label="谁可以看"
          onClick={onVisibility}
          onDismissKeyboard={onDismissKeyboard}
          color={visibilityPartial ? PULSE_COLORS.dustyRose : PULSE_COLORS.muted}
          active={visibilityPartial}
        />
      </div>
    </motion.div>
  )
}

const PUBLISH_HASH_COLOR = '#7C90A0'

function ToolboxIcon({
  icon: Icon,
  label,
  onClick,
  onDismissKeyboard,
  color,
  disabled,
  active,
  keepKeyboard,
}: {
  icon: typeof Smile
  label: string
  onClick: () => void
  onDismissKeyboard?: () => void
  color: string
  disabled?: boolean
  active?: boolean
  /** 话题等需要继续输入的按钮：不收键盘 */
  keepKeyboard?: boolean
}) {
  return (
    <Pressable
      type="button"
      onPointerDown={(e) => {
        if (keepKeyboard || disabled) return
        // 阻止 iOS 在点击时把焦点还给 contentEditable
        e.preventDefault()
        onDismissKeyboard?.()
      }}
      onClick={onClick}
      disabled={disabled}
      className={`relative flex size-9 items-center justify-center rounded-full disabled:opacity-35 ${
        active ? 'bg-[#FFF5F7]' : 'active:bg-black/[0.04]'
      }`}
      aria-label={label}
    >
      <Icon className="size-[18px]" strokeWidth={1.35} style={{ color }} />
      {active ? (
        <span
          className="absolute right-1 top-1 size-1.5 rounded-full"
          style={{ backgroundColor: PULSE_COLORS.dustyRose }}
        />
      ) : null}
    </Pressable>
  )
}
