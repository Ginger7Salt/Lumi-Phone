/** 约会页「抢话 / 不抢话」当轮 prompt 块（与界面开关一致）。 */

export function buildUserReactionPromptBlock(params: {
  autoUserReaction: boolean
  godPerspective: boolean
  userDisplayName: string
  characterRealName: string
  isVnMode: boolean
}): string {
  const user = params.userDisplayName.trim() || '用户'
  const peer = params.characterRealName.trim() || '约会对象'

  if (params.godPerspective) {
    return (
      `【当轮抢话开关：关（上帝视角锁定）】\n` +
      `上帝视角（**须遵守**）：\n` +
      `- 本轮只写用户**不在场、看不见、听不见**的屏外剧情；镜头对准 ${peer} 独处或与 NPC/他人的互动。\n` +
      `- **严禁**玩家本人出场、与 ${peer}/NPC 同处一室、对视、肢体接触、当面引号对白；**严禁**旁白描写玩家当轮动作或神态。\n` +
      `- **严禁**代写玩家（我）的任何反应、动作、对白和选择；禁止与用户直接对话或假定玩家已开口。\n` +
      `- 禁止质问、责怪、阴阳怪气用户为何不反应。正文不得出现玩家引号对白。\n` +
      `- 若须提及玩家，仅限心念、回忆、未接通的消息、他人转述等**不在场**侧面信息；「你」不得当作镜头前的面对面对象。\n`
    )
  }

  if (params.autoUserReaction) {
    const vnLine = params.isVnMode
      ? `- VN：若写玩家出声对白，须用 \`【对白】${user}：…\` 或 \`【对白】你：…\`；勿与 ${peer} 的【对白】行混淆。\n`
      : ''
    return (
      `【当轮抢话开关：开】\n` +
      `抢话模式（**须遵守**）：\n` +
      `- **须**在正文合理代写玩家（我/${user}）的可见动作、选择或引号对白，推进本轮；**禁止**整段只有 ${peer}/NPC 发言而玩家完全失声。\n` +
      `- 玩家**说出口**的内容须写在弯引号/直引号内；动作用第二人称旁白或自然段叙述。\n` +
      `- 若本轮玩家输入/导演指令含对白或动作要点，须在正文中**演出**（可写出），勿只写 ${peer} 反应却省略玩家侧。\n` +
      `- 仍须为玩家留下后续选择空间，勿一次性代写过长的玩家独白。\n` +
      vnLine +
      `思维链【代写边界卡】须写明：抢话=开，且正文将含玩家侧言行。\n`
    )
  }

  const vnLine = params.isVnMode
    ? `- VN：**禁止** \`【对白】${user}：\` / \`【对白】你：\` 等玩家说话人行；玩家台词仅存在于历史「玩家输入」，本轮 AI 正文只写 ${peer}/NPC 侧。\n`
    : ''
  return (
    `【当轮抢话开关：关】\n` +
    `不抢话模式（**须遵守**）：\n` +
    `- **禁止**代写玩家（我/${user}）当轮任何**新**动作、神态、选择或说出口的对白；玩家本轮行为**仅**以界面「玩家输入/导演指令」为准，你只写 ${peer}/NPC 的感知、对白与反应。\n` +
    `- **禁止**正文出现玩家说出口的引号对白：包括「你说…」「你问…」「你低声道…」+ 引号台词；禁止 \`${user}：…\`、\`你：…\` 作玩家台词；**禁止**把玩家输入原句改写法再放进引号。\n` +
    `- **允许**：${peer} 与 NPC 在对白里称呼、质问、回应玩家（那是**角色**的对白，不是玩家对白）。\n` +
    `- 旁白中的「你」**禁止**描写玩家当轮新发起的动作/开口（如「你伸手…」「你开口说…」）；只写 ${peer} 侧等待、观察、抢先开口等。\n` +
    `- 「对白占比≥55%」**只统计** ${peer}/NPC 的引号对白；**禁止**为凑占比编造玩家引号对白。\n` +
    vnLine +
    `思维链【代写边界卡】须写明：抢话=关，正文不含玩家新引号对白/新动作。\n`
  )
}

/** 精简重试 system 用的一行摘要 */
export function summarizeUserReactionForSlimRetry(params: {
  autoUserReaction: boolean
  godPerspective: boolean
}): string {
  if (params.godPerspective) return '抢话：关（上帝视角）'
  return params.autoUserReaction ? '抢话：开（正文须含玩家侧言行）' : '抢话：关（禁止玩家新引号对白/新动作）'
}
