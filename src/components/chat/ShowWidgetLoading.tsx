/**
 * `ShowWidgetLoading` —— 官方 `fre`（`vendor-pkg-canvas-ChpWx5JY.js` **@2365793**；`fre.displayName=` @2365878）
 * 的**逐字**复刻。
 *
 * 官方原文（逐字）：
 * ```js
 * const fre=a.memo(({title:e,messages:t})=>s.jsx(pre,{title:e,messages:t}));
 * fre.displayName="ShowWidgetLoading";
 * ```
 * ⇒ 它**只是一个转发壳**：把 `{title, messages}` 原样交给 `pre`（`WidgetLoadingPlaceholder`），
 * **不传 `height`**（因此始终走官方的 220px 默认值）。
 *
 * 分发点（官方 @2427100 邻域，逐字 —— 本轮**不接线**，由主 agent 统一在消息渲染器做）：
 * ```js
 * if(aT(e)){ const T=e.content;
 *   return (T.status==="pending"||T.status==="started")&&t
 *       ? s.jsx(fre,{title:T.request?.title, messages:T.request?.loading_messages})
 *       : T.status==="completed" ? s.jsx(mre,{...}) : null; }
 * ```
 */
import { memo } from 'react';
import WidgetLoadingPlaceholder from './WidgetLoadingPlaceholder';

export interface ShowWidgetLoadingProps {
  title?: string;
  messages?: readonly string[];
}

const ShowWidgetLoading = memo(function ShowWidgetLoading({ title, messages }: ShowWidgetLoadingProps) {
  return <WidgetLoadingPlaceholder title={title} messages={messages} />;
});

ShowWidgetLoading.displayName = 'ShowWidgetLoading';

export default ShowWidgetLoading;
