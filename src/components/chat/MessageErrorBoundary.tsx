/**
 * MessageErrorBoundary —— 官方 `fce`（消息级错误边界，`page-BeI7xydN.js` 里包住 `g5` 的组件）的等价实现。
 *
 * 官方用法：
 *   <fce messageId={m.id} role={m.role}
 *        fallbackText={t('chatAdapter.errors.messageRenderFailed', 'This message could not be displayed.')}>
 *     <g5 … />
 *   </fce>
 * 官方错误盒类串（`_classes` 扫出来的那一条）：
 *   `w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive`
 *
 * ⚠️ 官方 `fce` 是 class 组件错误边界；这里用等价实现，并把 `messageId` 作为 `key` 依据 ——
 *    消息切换时重置边界状态（否则上一条的报错会粘在下一条上）。
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useT } from '../../i18n';

interface MessageErrorBoundaryProps {
  messageId: string;
  children: ReactNode;
}

interface MessageErrorBoundaryState {
  failed: boolean;
}

export default function MessageErrorBoundary({ messageId, children }: MessageErrorBoundaryProps) {
  const t = useT();
  return (
    <Boundary
      key={messageId}
      fallbackText={t('这条消息无法显示')}
    >
      {children}
    </Boundary>
  );
}

class Boundary extends Component<
  { children: ReactNode; fallbackText: string },
  MessageErrorBoundaryState
> {
  constructor(props: { children: ReactNode; fallbackText: string }) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError(): MessageErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[chat] 消息渲染失败', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    /* 官方错误盒类串逐字。 */
    return (
      <div className="w-full rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {this.props.fallbackText}
      </div>
    );
  }
}
