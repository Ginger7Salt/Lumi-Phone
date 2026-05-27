import { getYuyeActCommissionData, type YuyeActId } from '../../yuyeRoleScriptText'

import type { ActiveCommission, TaskItem } from './taskCommissionTypes'

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function toTaskItems(texts: string[]): TaskItem[] {
  return texts.map((text, i) => ({
    id: uid(`task-${i}`),
    text,
    isCompleted: false,
  }))
}

const GENERIC_ACT_TASKS: Record<YuyeActId, string[]> = {
  act1: [
    '梳理你在第一轮讨论中的时间线，勿捏造未读剧本细节。',
    '结合公共剧情与已解锁线索，为自身立场做合理辩护。',
  ],
  act2: [
    '审视新出现的矛盾点与物证，核对每个人的动线。',
    '在讨论中推进疑点，同时保护你的核心秘密。',
  ],
  act3: [
    '整理三轮线索，准备终局投票前的最后陈述。',
    '基于时间线与物证，说出你的判断。',
  ],
}

/** 按剧本 / 角色 / 幕次构建待接取密函 */
export function buildActCommission(
  scriptId: string,
  roleName: string,
  actId: YuyeActId,
): ActiveCommission {
  if (scriptId === 'yuye-guiling') {
    const data = getYuyeActCommissionData(roleName, actId)
    if (data && data.tasks.length > 0) {
      return {
        scriptId,
        actId,
        title: data.missionTitle,
        tasks: toTaskItems(data.tasks),
        status: 'locked',
      }
    }
  }

  const roman = actId === 'act1' ? 'ACT I' : actId === 'act2' ? 'ACT II' : 'ACT III'
  return {
    scriptId,
    actId,
    title: `MISSION: ${roman} | 密函：本幕任务`,
    tasks: toTaskItems(GENERIC_ACT_TASKS[actId]),
    status: 'locked',
  }
}
