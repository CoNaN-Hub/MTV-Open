/**
 * `ShowWidgetCard` —— 官方 `mre`（`vendor-pkg-canvas-ChpWx5JY.js` **@2363632**，`mre=a.memo(...)`；
 * `mre.displayName=` @2365771）与占位 `Gtt`（**@2365897**）的**逐字**复刻。
 *
 * 官方原文（逐字，`_rawat.mjs` 原始窗口读出）：
 * ```js
 * const Vtt=1e4,
 * mre=a.memo(({content:e,onSendPrompt:t})=>{
 *   const{t:n}=se(),o=a.useRef(null),r=a.useRef(crypto.randomUUID()),i=a.useRef(KP("widget-proxy.html")),
 *         l=a.useRef(null),c=a.useRef(!1),
 *         [d,u]=a.useState("loading"),[p,m]=a.useState(200),[f,h]=a.useState(!1),
 *         g=e.request??e,x=g.title,y=g.widget_code;
 *   const b=a.useCallback(w=>{
 *     if(w.source!==o.current?.contentWindow)return;
 *     const C=w.data;
 *     if(!(!C||typeof C!="object")&&C.nonce===r.current&&(
 *       C.type==="rendered" && (u("rendered"), l.current&&(clearTimeout(l.current),l.current=null)),
 *       C.type==="error"    && (u("error"),    l.current&&(clearTimeout(l.current),l.current=null)),
 *       C.type==="resize"   && typeof C.height=="number" && (m(Math.max(C.height,100)), h(!0)),
 *       C.type==="sendPrompt" && typeof C.text=="string" && C.text.trim() &&
 *         Promise.resolve().then(()=>t(C.text.trim()))
 *           .then(S=>{if(S===!1)throw new Error("widget prompt rejected")})
 *           .catch(()=>{ne.error(n("chatAdapter.errors.sendFailed",{defaultValue:"Send failed. Please retry."}))}),
 *       C.type==="openLink" && typeof C.url=="string"))
 *       try{const S=new URL(C.url).protocol;
 *           (S==="http:"||S==="https:")&&window.open(C.url,"_blank","noopener,noreferrer")}catch{}
 *   },[t,n]);
 *   ...
 * ```
 *
 * ⚠️ 两处**非逐字但语义等价**的改写（均为工具链所迫，已逐条注明）：
 *   1. 官方的「逗号表达式 + 单一 `if`」无法在 ESLint（`no-sequences`）下通过 ⇒ 拆成
 *      **顺序早退 + 独立 `if`**：先 `source` 校验、再 `!data||typeof data!="object"` 早退、
 *      再 `nonce` 早退，随后**每个 type 分支无条件求值**（与逗号表达式一致，**不是** `&&` 短路链）。
 *   2. `catch{}` 空块补了注释（ESLint `no-empty`）。
 *
 * 逐字数值（§7 表）：超时 `Vtt=1e4` = **10000ms**；默认高度 `useState(200)`，`resize` 取
 * `Math.max(height,100)`（**下限 100px**）；`sandbox:"allow-scripts"`（**没有** `allow-same-origin`）；
 * iframe `title = title ?? "Widget"`；父→子 `{type:"render",html:widget_code,nonce}` targetOrigin `"*"`；
 *  `!widget_code || status==="error"` ⇒ **返回 `null`**。
 */
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useWidgetText } from '../../services/chat/widgetStrings';
import { officialToast } from '../../services/chat/htmlPreviewTransport';
import { officialWidgetProxyUrl, WIDGET_PROXY_PAGE } from '../../services/chat/widgetProxyUrl';

/** 官方 `Vtt = 1e4`：渲染超时 **10000 ms**。 */
export const WIDGET_RENDER_TIMEOUT = 1e4;

/** 官方 `resize` 的最小高度下限：`Math.max(C.height, 100)`。 */
export const WIDGET_MIN_HEIGHT = 100;

/** 官方首次渲染前的默认高度：`useState(200)`。 */
export const WIDGET_DEFAULT_HEIGHT = 200;

/** 官方 `g = content.request ?? content` 的有效载荷。 */
export interface ShowWidgetPayload {
  title?: string;
  widget_code?: string;
}

/** 官方 `content`（分发处读 `status`）。 */
export interface ShowWidgetCardContent extends ShowWidgetPayload {
  status?: string;
  request?: ShowWidgetPayload;
}

export interface ShowWidgetCardProps {
  content: ShowWidgetCardContent;
  /** 官方 `onSendPrompt`：返回 `false` ⇒ 抛 `Error("widget prompt rejected")`。 */
  onSendPrompt: (text: string) => unknown;
}

/**
 * 官方内联 `Gtt`（@2365897，逐字）：`"Loading widget..."` 是**硬编码英文，不是 i18n key**；
 * 转圈 **h-4 w-4（16×16）**、边框 **2px**。
 */
function WidgetLoadingRow() {
  return (
    <div className="flex items-center gap-2 px-3 py-3">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground" />
      <span className="text-xs text-muted-foreground">Loading widget...</span>
    </div>
  );
}

const ShowWidgetCard = memo(function ShowWidgetCard({ content, onSendPrompt }: ShowWidgetCardProps) {
  const t = useWidgetText();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const nonceRef = useRef(crypto.randomUUID());
  const proxySrcRef = useRef(officialWidgetProxyUrl(WIDGET_PROXY_PAGE));
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderSentRef = useRef(false);
  const [status, setStatus] = useState<'loading' | 'rendered' | 'error'>('loading');
  const [height, setHeight] = useState(WIDGET_DEFAULT_HEIGHT);
  const [measured, setMeasured] = useState(false);

  const payload = content.request ?? content;
  const title = payload.title;
  const widgetCode = payload.widget_code;

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as {
        type?: string;
        nonce?: string;
        height?: number;
        text?: string;
        url?: string;
      };
      if (!data || typeof data !== 'object') return;
      if (data.nonce !== nonceRef.current) return;
      /* ↓ 官方逗号表达式的每个分支都**无条件求值**（拆分理由见文件头）。 */
      if (data.type === 'rendered') {
        setStatus('rendered');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
      if (data.type === 'error') {
        setStatus('error');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
      if (data.type === 'resize' && typeof data.height === 'number') {
        setHeight(Math.max(data.height, WIDGET_MIN_HEIGHT));
        setMeasured(true);
      }
      if (data.type === 'sendPrompt' && typeof data.text === 'string' && data.text.trim()) {
        const promptText = data.text.trim();
        Promise.resolve()
          .then(() => onSendPrompt(promptText))
          .then((result) => {
            if (result === false) throw new Error('widget prompt rejected');
          })
          .catch(() => {
            officialToast.error(
              t('chatAdapter.errors.sendFailed', { defaultValue: 'Send failed. Please retry.' }),
            );
          });
      }
      if (data.type === 'openLink' && typeof data.url === 'string') {
        try {
          const protocol = new URL(data.url).protocol;
          if (protocol === 'http:' || protocol === 'https:') {
            window.open(data.url, '_blank', 'noopener,noreferrer');
          }
        } catch {
          /* 官方 `catch{}` 逐字：非法 URL 静默忽略。 */
        }
      }
    },
    [onSendPrompt, t],
  );

  /** 官方 `_`：父→子 render（`renderSentRef` 保证只发一次）。 */
  const sendRender = useCallback(() => {
    if (renderSentRef.current || !widgetCode) return;
    const target = iframeRef.current?.contentWindow;
    if (target) {
      renderSentRef.current = true;
      target.postMessage({ type: 'render', html: widgetCode, nonce: nonceRef.current }, '*');
    }
  }, [widgetCode]);

  /** 官方 `v`：`proxy-ready` ⇒ 发 render。 */
  const handleProxyReady = useCallback(
    (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string };
      if (!data || typeof data !== 'object' || data.type !== 'proxy-ready') return;
      sendRender();
    },
    [sendRender],
  );

  useEffect(() => {
    if (!widgetCode) return;
    renderSentRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `mre` 逐字：`u("loading"), h(!1)`
    setStatus('loading');
    setMeasured(false);
    const timer = setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'error' : current));
    }, WIDGET_RENDER_TIMEOUT);
    timeoutRef.current = timer;
    return () => {
      clearTimeout(timer);
      if (timeoutRef.current === timer) timeoutRef.current = null;
    };
  }, [widgetCode]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    window.addEventListener('message', handleProxyReady);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('message', handleProxyReady);
    };
  }, [handleMessage, handleProxyReady]);

  if (!widgetCode || status === 'error') return null;

  /* 官方 `i=a.useRef(KP("widget-proxy.html"))` ⇒ 渲染期读 `i.current`（只算一次）。
     仓库 `react-hooks/refs` 禁止渲染期读 ref，故按官方原样保留并逐点豁免
     （与 `confirmationPromptState.ts` 的豁免做法一致，不改成「等价实现」）。 */
  // eslint-disable-next-line react-hooks/refs -- 官方 `mre` 逐字：`src:i.current`
  const proxySrc = proxySrcRef.current;

  return (
    <div className="my-2 w-full">
      {!(status === 'rendered' && measured) && <WidgetLoadingRow />}
      <iframe
        ref={iframeRef}
        src={proxySrc}
        onLoad={sendRender}
        sandbox="allow-scripts"
        style={{
          width: '100%',
          height: `${height}px`,
          border: 'none',
          overflow: 'hidden',
          display: status === 'rendered' && measured ? 'block' : 'none',
        }}
        title={title ?? 'Widget'}
      />
    </div>
  );
});

ShowWidgetCard.displayName = 'ShowWidgetCard';

export default ShowWidgetCard;
