import { scheduleCharacterMomentArchive, type CharacterMomentArchiveJob } from './momentArchiverService'
import type { MomentItemModel } from './mockMoments'
import { getUserMomentMentionedContacts } from './momentMentionUtils'
import type { ContactTag, MomentContactRef } from './newMomentTypes'
import { scheduleUserMomentMentionArchive, type UserMomentMentionArchiveJob } from './userMomentMentionArchiveService'
import { scheduleUserMomentDistributionArchive } from './userMomentDistributionArchiveService'

type MomentMemoryArchiveJob = (CharacterMomentArchiveJob | UserMomentMentionArchiveJob) & {
  momentContacts?: MomentContactRef[]
  tags?: ContactTag[]
}

/** 动态互动解锁或更新后，刻录角色侧记忆（角色发布 / 用户分发 / 用户 @ 提醒）。 */
export function scheduleMomentInteractionMemoryArchive(job: MomentMemoryArchiveJob): void {
  const moment = job.moment
  if (moment.isUserAuthored) {
    if (job.momentContacts?.length) {
      scheduleUserMomentDistributionArchive({
        moment: job.moment,
        apiConfig: job.apiConfig,
        wechatAccountId: job.wechatAccountId,
        playerIdentityId: job.playerIdentityId,
        playerDisplayName: job.playerDisplayName,
        contactDirectory: job.contactDirectory,
        momentContacts: job.momentContacts,
        tags: job.tags,
        now: job.now,
      })
    }
    if (getUserMomentMentionedContacts(moment).length) {
      scheduleUserMomentMentionArchive(job)
    }
    return
  }
  if (moment.authorCharacterId?.trim()) {
    scheduleCharacterMomentArchive(job)
  }
}

export function scheduleMomentInteractionMemoryArchiveFromId(
  moments: MomentItemModel[],
  momentId: string,
  job: Omit<MomentMemoryArchiveJob, 'moment'>,
): void {
  const moment = moments.find((m) => m.id === momentId)
  if (moment) scheduleMomentInteractionMemoryArchive({ ...job, moment })
}
