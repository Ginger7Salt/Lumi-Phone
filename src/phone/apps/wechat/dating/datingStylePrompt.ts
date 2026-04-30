import type { NarrativeGenOptions } from './types'

const DEFAULT_STYLE_PROMPT = [
  '现实事实白描，动作与对白优先，短句推进，不空泛抒情。',
  '默认参考作者：汪曾祺（仅借鉴平实、节制、贴地的叙述质感，不照搬原句）。',
  '严禁抽象、油腻、霸总、土味、极端化表达。',
].join(' ')

const DEFAULT_REFERENCE_SNIPPET = [
  '他把塑料袋放到桌角，抬眼看我一秒，说：「先吃，面要坨了。」',
  '门口风有点硬，她把外套往上拽了拽，手机在掌心里震了一下。',
  '电梯到七层停住，谁也没先出去。她侧过脸，问：「你刚才那句，算认真吗？」',
  '雨没大，只是路滑。她走得慢一点，我就跟着慢一点。',
  '他拧开矿泉水递过来，语气很平：「别急，先把话说清楚。」',
].join('\n')

/**
 * AI Prompt：文风调教（注入到约会续写的 **system** 末尾，与 `lumiThinkingChainRules` 导出的 DATING_STYLE_SYSTEM_PROMPT 拼接）。
 *
 * 当用户在「文风设定」中填写 stylePrompt / referenceSnippet 并在点击「发送」时通过
 * `NarrativeGenOptions` 传入 `generateDatingAi`，此处生成以下结构（与产品文档一致）：
 *
 * 【写作风格约束】
 * 必须严格遵循以下文风：${stylePrompt}
 *
 * 【参考笔触学习】
 * 请深入分析并精准模仿以下片段的行文节奏、用词习惯、感官描写方式和句式结构。
 * 你的回复必须让人觉得是出自同一作者之手：
 * """${referenceSnippet}"""
 */
export function buildDatingStyleSystemAppend(gen?: NarrativeGenOptions): string {
  const userStylePrompt = gen?.stylePrompt?.trim()
  const userReferenceSnippet = gen?.referenceSnippet?.trim()
  const hasUserCustomStyle = Boolean(userStylePrompt || userReferenceSnippet)
  const stylePrompt = userStylePrompt || DEFAULT_STYLE_PROMPT
  const referenceSnippet = userReferenceSnippet || DEFAULT_REFERENCE_SNIPPET

  const parts: string[] = []
  parts.push(
    hasUserCustomStyle
      ? '【文风参考源】本轮检测到用户自定义文风配置：文风与参考片段均以用户输入为最高优先级。'
      : '【文风参考源】本轮未检测到用户自定义文风配置：默认采用「汪曾祺式现实白描」与内置示例片段进行模仿。',
  )
  parts.push(
    `【写作风格约束】\n接下来请推进剧情。请严格遵循以下文风：${stylePrompt}`,
  )
  parts.push(
    `【参考笔触学习】\n你可以参考以下文本的笔触和行文节奏进行模仿；并尽量让输出在句式密度、标点节奏与用词习惯上与之一致：\n"""${referenceSnippet}"""`,
  )
  return `\n\n${parts.join('\n\n')}`
}
