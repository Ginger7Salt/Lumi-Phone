import { resolveCharacterAvatarUrl, resolveProfileAvatarPreviewUrl } from '../../phone/utils/characterAvatarUrl'

import type { MomentItemModel } from './mockMoments'
import type { MomentsContactDirectory } from './momentsContactDirectory'

export type ResolveMomentAuthorDisplayParams = {
  currentUserName: string
  currentUserAvatarUrl?: string
  contactDirectory: MomentsContactDirectory
  /** 个人相册页当前主体（如正在查看某角色相册） */
  subjectCharacterId?: string
  subjectDisplayName?: string
  subjectAvatarUrl?: string
}

function pickMomentAuthorAvatarUrl(...candidates: (string | undefined | null)[]): string {
  for (const raw of candidates) {
    const trimmed = raw?.trim()
    if (!trimmed) continue
    const resolved = resolveCharacterAvatarUrl({ avatarUrl: trimmed })
    if (resolved.trim()) return resolved
  }
  return ''
}

export function resolveMomentAuthorDisplay(
  item: MomentItemModel,
  params: ResolveMomentAuthorDisplayParams,
): { name: string; avatarUrl: string } {
  if (item.isUserAuthored) {
    return {
      name: params.currentUserName.trim() || item.authorName.trim() || '我',
      avatarUrl:
        pickMomentAuthorAvatarUrl(params.currentUserAvatarUrl, item.authorAvatar) ||
        resolveProfileAvatarPreviewUrl(params.currentUserAvatarUrl) ||
        '',
    }
  }

  const charId = item.authorCharacterId?.trim()
  if (charId) {
    const subjectId = params.subjectCharacterId?.trim()
    const fromSubject =
      subjectId && subjectId === charId
        ? {
            name: params.subjectDisplayName?.trim(),
            avatar: params.subjectAvatarUrl,
          }
        : null

    return {
      name:
        fromSubject?.name ||
        params.contactDirectory.getDisplayName(charId) ||
        item.authorName.trim() ||
        '未命名',
      avatarUrl:
        pickMomentAuthorAvatarUrl(
          fromSubject?.avatar,
          params.contactDirectory.getAvatar(charId),
          item.authorAvatar,
        ) || '',
    }
  }

  return {
    name: item.authorName.trim() || '未命名',
    avatarUrl: pickMomentAuthorAvatarUrl(item.authorAvatar) || '',
  }
}
