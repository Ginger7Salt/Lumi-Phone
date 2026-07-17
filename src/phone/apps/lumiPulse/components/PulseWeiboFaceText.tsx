import { useMemo } from 'react'

import { openPulseUserProfile } from '../lumiPulseNavigation'
import {
  buildPulseMentionAliasMap,
  buildPulseMentionNicknameByPov,
  formatPulseMentionDisplay,
  pulseMentionExprInnerToPovId,
  resolvePulseMentionDisplayName,
  resolvePulseMentionPovId,
} from '../pulseMentionExpr'
import { parsePulsePovId } from '../pulseTypes'
import { parsePulseWeiboRichText, PUBLISH_SYNTAX_COLORS } from '../pulseWeiboRichText'
import { usePulseMentionDirectory } from '../usePulseMentionDirectory'
import { PulseNumericText } from './PulseNum'

/** 渲染含 [doge] 微博表情、#话题#、@艾特（表达式同步昵称）、【超话】的正文 */
export function PulseWeiboFaceText({
  text,
  className,
  singleLine = false,
}: {
  text: string
  className?: string
  /** 会话列表等单行预览：不换行，表情略小 */
  singleLine?: boolean
}) {
  const directory = usePulseMentionDirectory()
  const nicknameByPov = useMemo(() => buildPulseMentionNicknameByPov(directory), [directory])
  const aliasMap = useMemo(() => buildPulseMentionAliasMap(directory), [directory])
  const parts = useMemo(() => parsePulseWeiboRichText(text), [text])

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <PulseNumericText
              key={`t-${i}`}
              text={part.value}
              className={singleLine ? 'whitespace-nowrap' : 'whitespace-pre-wrap'}
            />
          )
        }
        if (part.type === 'face') {
          return (
            <img
              key={`f-${i}-${part.name}`}
              src={part.url}
              alt={`[${part.name}]`}
              title={`[${part.name}]`}
              className={
                singleLine
                  ? 'mx-px inline-block size-[14px] align-[-3px] object-contain'
                  : 'mx-px inline-block size-[18px] align-[-4px] object-contain'
              }
              draggable={false}
            />
          )
        }
        if (part.type === 'mention') {
          const displayInner =
            part.exprKind && part.exprId
              ? (() => {
                  const povId = pulseMentionExprInnerToPovId(part.exprKind, part.exprId)
                  if (!povId) {
                    return resolvePulseMentionDisplayName(part.raw, nicknameByPov, aliasMap)
                  }
                  const nick = nicknameByPov.get(povId)?.trim()
                  if (nick) return nick
                  return resolvePulseMentionDisplayName(part.raw, nicknameByPov, aliasMap)
                })()
              : resolvePulseMentionDisplayName(part.name, nicknameByPov, aliasMap)
          const label = formatPulseMentionDisplay(displayInner)
          const targetPovId = resolvePulseMentionPovId(
            part.exprKind && part.exprId ? part.raw : part.name,
            nicknameByPov,
            aliasMap,
          )
          const canOpen =
            Boolean(targetPovId) &&
            (parsePulsePovId(targetPovId!)?.kind === 'char' ||
              parsePulsePovId(targetPovId!)?.kind === 'player')

          if (canOpen && targetPovId) {
            return (
              <button
                key={`m-${i}-${part.raw}`}
                type="button"
                className="m-0 inline cursor-pointer border-0 bg-transparent p-0 align-baseline font-medium"
                style={{ color: PUBLISH_SYNTAX_COLORS.mention }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openPulseUserProfile({ povId: targetPovId, name: displayInner })
                }}
              >
                {label}
              </button>
            )
          }

          return (
            <span
              key={`m-${i}-${part.raw}`}
              className="font-medium"
              style={{ color: PUBLISH_SYNTAX_COLORS.mention }}
            >
              {label}
            </span>
          )
        }
        if (part.type === 'supertopic') {
          return (
            <span
              key={`s-${i}-${part.name}`}
              className="rounded-md px-1 font-semibold text-[#3A3A3C]"
              style={{ backgroundColor: PUBLISH_SYNTAX_COLORS.supertopicBg }}
            >
              {part.raw}
            </span>
          )
        }
        return (
          <span
            key={`h-${i}-${part.tag}`}
            className="font-medium"
            style={{ color: PUBLISH_SYNTAX_COLORS.hashtag }}
          >
            {part.raw}
          </span>
        )
      })}
    </span>
  )
}
