import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  onRetry?: () => void
}

type State = {
  error: Error | null
}

/** 聊天气泡列表渲染兜底：避免单条异常导致整页白屏 */
export class WeChatChatRenderErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[WeChatChatRenderErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-6 my-8 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-[13px] leading-relaxed text-red-800">
          <p>消息列表渲染异常，已拦截白屏。</p>
          <p className="mt-1 text-[12px] text-red-600/90">可退出重进聊天查看已保存记录；若反复出现请打开控制台截图报错。</p>
          <button
            type="button"
            className="mt-3 rounded-full bg-white px-4 py-1.5 text-[12px] text-red-700 shadow-sm active:bg-red-100"
            onClick={() => {
              this.setState({ error: null })
              this.props.onRetry?.()
            }}
          >
            重试渲染
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
