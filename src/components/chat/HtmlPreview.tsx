/**
 * `htmlPreview` 全屏预览器 —— 官方 `mst`（`vendor-pkg-canvas-ChpWx5JY.js` **@2468555** 起，到 @2473900 附近）
 * + 渲染器 `HW`（**@10155**）+ 布局壳 `Rge`（**@11315**）的**逐字**复刻。
 *
 * 官方主组件原文（逐字，`_rawat.mjs` 原始窗口读出）：
 * ```js
 * mst=({isOpen:e,onClose:t,target:n})=>{
 *   const{t:o}=se(),
 *   [r,i]=a.useState({status:"loading"}),   // 加载结果
 *   [l,c]=a.useState(0),                    // retry 计数（也是 effect 依赖）
 *   [d,u]=a.useState(!1),                   // sharing
 *   [p,m]=a.useState({status:"idle"}),      // 分享态
 *   f=n?JSON.stringify([n.canvasId,n.artifactPath]):null   // artifactKey
 *   ...
 *   return Ds.createPortal(s.jsx(fo,{children:e&&n?s.jsxs(Tt.div,{...
 *     },"html-preview-frame"):null}),document.body)
 * ```
 *
 * 逐字数值：`transition:{duration:.2}`（**200 ms** opacity）；`style:{zIndex:80}`；React key `"html-preview-frame"`；
 * portal 宿主 `document.body`；外层 `fo`=AnimatePresence（**没有** `initial={false}`）；渲染超时 `Pge=1e4`（**10000 ms**）；
 * 分享上传文件名 **`share-page.txt`** / MIME **`text/plain`**；下载 `<a download>` + `hidden`，`URL.revokeObjectURL` 在 **60000 ms** 后。
 *
 * 未落地（见报告「诚实清单」）：根容器的 `role` / `aria-modal` / `tabIndex`、焦点陷阱、iframe 的 `allow` /
 * `allow-same-origin` / `referrerPolicy`、`postMessage` 的 targetOrigin 白名单 —— 官方**本身就没有**（§8.10/§8.12），
 * 所以不是「没做」，是「官方没有」。
 *
 * 接线点（**本轮未接线**）：host 处读 `useHtmlPreviewTarget()`、补 `canvasId` 后渲染
 * `<HtmlPreview isOpen={!!target} onClose={() => clearHtmlPreviewTarget()} target={target} />`。
 */
import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Download, Share2, X } from 'lucide-react';
import { useWidgetText } from '../../services/chat/widgetStrings';
import {
  officialHtmlPreviewTransport,
  officialToast,
} from '../../services/chat/htmlPreviewTransport';
import { ARTIFACT_PROXY_PAGE, officialWidgetProxyUrl } from '../../services/chat/widgetProxyUrl';
import {
  downloadHtmlArtifact,
  officialCx,
  shareArtifactUrl,
} from './widgetCardUtils';

/** 官方 `Pge = 1e4`：渲染超时 **10000 ms**。 */
export const HTML_RENDER_TIMEOUT = 1e4;

/** 官方 `transition:{duration:.2}`。 */
export const HTML_PREVIEW_FADE_DURATION = 0.2;

/** 官方 `style:{zIndex:80}`。 */
export const HTML_PREVIEW_Z_INDEX = 80;

/**
 * 官方 `ax`（`vendor-packages-jvPqKqU8.js` `xM` @197057，逐字）：
 * `"https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5/assets/tap_logo-B_K5uv9E.svg"`
 * —— 左栏品牌图是**远端 SVG URL**（硬编码资源哈希 `0a8da41c…`）。
 */
export const OFFICIAL_TAPNOW_LOGO_URL =
  'https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5/assets/tap_logo-B_K5uv9E.svg';

/** 官方 `mst` 的 `target`（= host 的 `uO`）形状。 */
export interface HtmlPreviewTarget {
  canvasId: string;
  artifactPath: string;
  title: string;
  description?: string;
}

export interface HtmlPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  target: HtmlPreviewTarget | null;
}

type HtmlPreviewLoadState =
  | { status: 'loading' }
  | { status: 'ready'; html: string; artifactKey: string }
  | { status: 'error' };

type HtmlPreviewShareState = { status: 'idle' } | { status: 'shared'; token: string };

/* ────────────────────────── 官方 `HW`（@10155）────────────────────────── */

export interface HtmlSandboxRendererProps {
  html?: string;
  title?: string;
  className?: string;
}

/**
 * 官方 `HW`（HTML 沙箱渲染器，@10155 起，逐字）：
 * ```js
 * const Pge=1e4,
 * HW=({html:e,title:t,className:n})=>{const{t:o}=se(),r=a.useRef(null),i=a.useRef(null),
 *  [l]=a.useState(()=>crypto.randomUUID()),
 *  [c]=a.useState(()=>KP("artifact-proxy.html")),
 *  [d,u]=a.useState("loading"),
 *  p=a.useCallback(m=>{if(m.source!==r.current?.contentWindow)return;const f=m.data;if(!(!f||typeof f!="object")){
 *    if(f.type==="proxy-ready"){if(!e)return;
 *      r.current?.contentWindow?.postMessage({type:"render",html:e,nonce:l},"*"),
 *      i.current=setTimeout(()=>{u(h=>h==="loading"?"error":h)},Pge);
 *      return}
 *    f.nonce===l&&f.type==="rendered"&&(u("rendered"),i.current&&(clearTimeout(i.current),i.current=null))}},[e,l]);
 *  return a.useEffect(()=>(window.addEventListener("message",p),()=>{window.removeEventListener("message",p),i.current&&clearTimeout(i.current)}),[p]),
 *  s.jsxs("div",{className:z("relative",n),children:[
 *    s.jsx("iframe",{ref:r,title:t,src:c,sandbox:"allow-scripts",className:"h-full w-full bg-chat-background"}),
 *    d==="error"?s.jsx("div",{className:"pointer-events-none absolute inset-0 flex items-center justify-center bg-chat-background/80 text-xs text-muted-foreground",children:o("chatAdapter.htmlPreview.renderFailed","Failed to render artifact")}):null]})}
 * ```
 * 协议：`proxy-ready`（iframe→host，**只校验 `event.source`，不校验 nonce**）→ host 回
 * `{type:"render",html,nonce},"*"` → iframe 回 `{type:"rendered",nonce}`（**校验 `f.nonce===l`**）。
 */
export const HtmlSandboxRenderer = memo(function HtmlSandboxRenderer({
  html,
  title,
  className,
}: HtmlSandboxRendererProps) {
  const t = useWidgetText();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nonce] = useState(() => crypto.randomUUID());
  const [proxySrc] = useState(() => officialWidgetProxyUrl(ARTIFACT_PROXY_PAGE));
  const [status, setStatus] = useState<'loading' | 'rendered' | 'error'>('loading');

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as { type?: string; nonce?: string };
      if (!data || typeof data !== 'object') return;
      if (data.type === 'proxy-ready') {
        if (!html) return;
        iframeRef.current?.contentWindow?.postMessage({ type: 'render', html, nonce }, '*');
        timeoutRef.current = setTimeout(() => {
          setStatus((current) => (current === 'loading' ? 'error' : current));
        }, HTML_RENDER_TIMEOUT);
        return;
      }
      if (data.nonce === nonce && data.type === 'rendered') {
        setStatus('rendered');
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }
    },
    [html, nonce],
  );

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleMessage]);

  return (
    <div className={officialCx('relative', className)}>
      <iframe
        ref={iframeRef}
        title={title}
        src={proxySrc}
        sandbox="allow-scripts"
        className="h-full w-full bg-chat-background"
      />
      {status === 'error' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-chat-background/80 text-xs text-muted-foreground">
          {t('chatAdapter.htmlPreview.renderFailed', 'Failed to render artifact')}
        </div>
      ) : null}
    </div>
  );
});

/* ────────────────────────── 官方 `Rge`（@11315）────────────────────────── */

export interface HtmlPreviewShellProps {
  title?: string;
  description?: string;
  html?: string;
  leftActions?: ReactNode;
  className?: string;
}

/**
 * 官方 `Rge`（@11315 起，逐字）：
 * ```js
 * Rge=({title:e,description:t,html:n,leftActions:o,className:r})=>{const{t:i}=se();
 *  return s.jsxs("div",{className:z("flex h-full w-full overflow-hidden",r),children:[
 *   s.jsxs("div",{className:"flex w-1/4 min-w-[220px] max-w-[360px] shrink-0 flex-col gap-9 overflow-y-auto border-r border-white/[0.06] px-6 pt-6 pb-7",children:[
 *     s.jsxs("div",{className:"flex items-center gap-2.5 text-foreground/90",children:[
 *       s.jsx("img",{src:ax,alt:"TapNow",className:"h-11 w-11 opacity-90"}),
 *       s.jsx("span",{className:"text-base font-semibold",children:"TapNow"})]}),
 *     s.jsxs("div",{className:"flex flex-col gap-6",children:[
 *       s.jsx("h3",{className:"text-base font-semibold leading-snug text-foreground/95",children:e}),
 *       t?s.jsx("p",{className:"text-[13px] leading-relaxed text-muted-foreground",children:t}):null,
 *       s.jsx("p",{className:"border-t border-white/[0.06] pt-6 text-[12px] leading-relaxed text-muted-foreground/70",
 *         children:i("chatAdapter.htmlPreview.disclaimer","This page was created by a user with AI …")})]}),
 *     s.jsx("div",{className:"mt-auto pt-4 pb-6",children:o})]}),
 *   s.jsx(HW,{html:n,title:e,className:"h-full w-full flex-1"})]})}
 * ```
 */
export const HtmlPreviewShell = memo(function HtmlPreviewShell({
  title,
  description,
  html,
  leftActions,
  className,
}: HtmlPreviewShellProps) {
  const t = useWidgetText();
  return (
    <div className={officialCx('flex h-full w-full overflow-hidden', className)}>
      <div className="flex w-1/4 min-w-[220px] max-w-[360px] shrink-0 flex-col gap-9 overflow-y-auto border-r border-white/[0.06] px-6 pt-6 pb-7">
        <div className="flex items-center gap-2.5 text-foreground/90">
          <img src={OFFICIAL_TAPNOW_LOGO_URL} alt="TapNow" className="h-11 w-11 opacity-90" />
          <span className="text-base font-semibold">TapNow</span>
        </div>
        <div className="flex flex-col gap-6">
          <h3 className="text-base font-semibold leading-snug text-foreground/95">{title}</h3>
          {description ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
          <p className="border-t border-white/[0.06] pt-6 text-[12px] leading-relaxed text-muted-foreground/70">
            {t(
              'chatAdapter.htmlPreview.disclaimer',
              'This page was created by a user with AI and may contain inaccuracies. Please verify independently. Its content and views are not affiliated with TapNow.',
            )}
          </p>
        </div>
        <div className="mt-auto pt-4 pb-6">{leftActions}</div>
      </div>
      <HtmlSandboxRenderer html={html} title={title} className="h-full w-full flex-1" />
    </div>
  );
});

/* ────────────────────────── 官方 `mst`（@2468555）────────────────────────── */

const HtmlPreview = function HtmlPreview({ isOpen, onClose, target }: HtmlPreviewProps) {
  const t = useWidgetText();
  const [load, setLoad] = useState<HtmlPreviewLoadState>({ status: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareState, setShareState] = useState<HtmlPreviewShareState>({ status: 'idle' });
  const artifactKey = target ? JSON.stringify([target.canvasId, target.artifactPath]) : null;

  /** 官方 (1)：关闭时重置为 loading。 */
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `mst` 逐字：`e||i({status:"loading"})`
      setLoad({ status: 'loading' });
    }
  }, [isOpen]);

  /** 官方 (2)：Esc 关闭（**裸 window keydown**，不检查 target、不 preventDefault、不区分 isComposing）。 */
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  /** 官方 (3)：拉 HTML 正文（依赖 retry 计数，每次 retry 重新拉）。 */
  useEffect(() => {
    if (!isOpen || !target) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `mst` 逐字：`i({status:"loading"})`
    setLoad({ status: 'loading' });
    officialHtmlPreviewTransport
      .getCanvasArtifact({ canvas_id: target.canvasId, artifact_path: target.artifactPath })
      .then((response) => {
        if (cancelled) return;
        const content = response?.data?.artifact?.content;
        setLoad(
          typeof content === 'string'
            ? {
                status: 'ready',
                html: content,
                artifactKey: JSON.stringify([target.canvasId, target.artifactPath]),
              }
            : { status: 'error' },
        );
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
    // 官方依赖数组逐字为 `[e,n?.canvasId,n?.artifactPath,l]` —— 有意不写 `target` 本身。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, target?.canvasId, target?.artifactPath, retryCount]);

  /** 官方 (4)：拉已分享 token（**依赖不含 retry 计数**）。 */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 官方 `mst` 逐字：`m({status:"idle"})`
    setShareState({ status: 'idle' });
    if (!isOpen || !target) return;
    let cancelled = false;
    officialHtmlPreviewTransport
      .getSharedPageByArtifact({ canvas_id: target.canvasId, artifact_path: target.artifactPath })
      .then((response) => {
        if (cancelled) return;
        const token = response?.data?.token;
        if (typeof token === 'string' && token) setShareState({ status: 'shared', token });
      })
      .catch(() => {
        /* 官方 `.catch(()=>{})` 逐字：分享 token 拉取失败静默忽略。 */
      });
    return () => {
      cancelled = true;
    };
    // 官方依赖数组逐字为 `[e,n?.canvasId,n?.artifactPath]` —— 有意不写 `target` 本身。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, target?.canvasId, target?.artifactPath]);

  /** 官方 `h`：复制分享链接 + toast。 */
  const copyShareLink = useCallback(
    async (url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        officialToast.success(t('chatAdapter.htmlPreview.shareCopied', 'Share link copied'));
      } catch {
        officialToast.error(t('chatAdapter.htmlPreview.copyFailed', 'Copy failed'));
      }
    },
    [t],
  );

  /** 官方 `g`（分享）。 */
  const handleShare = useCallback(async () => {
    if (load.status !== 'ready' || load.artifactKey !== artifactKey || sharing || !target) return;
    setSharing(true);
    try {
      const file = new File([load.html], 'share-page.txt', { type: 'text/plain' });
      const uploaded = await officialHtmlPreviewTransport.uploadSharePage(file);
      const fileId = uploaded?.fileInfo?.file_id;
      if (!uploaded.success || !fileId) {
        officialToast.error(t('chatAdapter.htmlPreview.shareFailed', 'Share failed'));
        return;
      }
      const token = (
        await officialHtmlPreviewTransport.shareHtmlArtifact({
          file_id: fileId,
          title: target.title,
          description: target.description?.trim() || target.title,
          canvas_id: target.canvasId,
          source_artifact_path: target.artifactPath,
        })
      )?.data?.token;
      if (!token) {
        officialToast.error(t('chatAdapter.htmlPreview.shareFailed', 'Share failed'));
        return;
      }
      setShareState({ status: 'shared', token });
      await copyShareLink(shareArtifactUrl(token));
    } catch {
      officialToast.error(t('chatAdapter.htmlPreview.shareFailed', 'Share failed'));
    } finally {
      setSharing(false);
    }
  }, [artifactKey, copyShareLink, load, sharing, t, target]);

  /** 官方 `x`（下载）。 */
  const handleDownload = useCallback(() => {
    if (!isOpen || !target || load.status !== 'ready' || load.artifactKey !== artifactKey) return;
    try {
      downloadHtmlArtifact(load.html, target.artifactPath);
    } catch {
      officialToast.error(
        t('chatAdapter.htmlPreview.downloadFailed', 'Failed to start HTML download'),
      );
    }
  }, [artifactKey, isOpen, load, t, target]);

  /* 官方：`if(typeof document>"u")return null;`（在构造 `y`/`b` 之前）。 */
  if (typeof document === 'undefined') return null;

  const shareButton = (
    <button
      type="button"
      onClick={handleShare}
      disabled={sharing}
      className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Share2 size={14} strokeWidth={1.6} />
      {sharing
        ? t('chatAdapter.htmlPreview.sharing', 'Sharing…')
        : t('chatAdapter.htmlPreview.share', 'Share this page')}
    </button>
  );

  const shareLinkBlock =
    shareState.status === 'shared' ? (
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-muted-foreground">
          {t('chatAdapter.htmlPreview.shareLinkLabel', 'Share link')}
        </span>
        <div className="flex items-stretch gap-1.5">
          <input
            readOnly
            value={shareArtifactUrl(shareState.token)}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md bg-white/[0.06] px-2.5 py-2 text-[12px] text-foreground/85 outline-none"
          />
          <button
            type="button"
            onClick={() => copyShareLink(shareArtifactUrl(shareState.token))}
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-md bg-white/[0.06] px-3 text-[12px] font-medium text-foreground/85 transition-colors hover:bg-white/[0.12]"
          >
            <Copy size={13} strokeWidth={1.6} />
            {t('chatAdapter.htmlPreview.copy', 'Copy')}
          </button>
        </div>
      </div>
    ) : null;

  return createPortal(
    <AnimatePresence>
      {isOpen && target ? (
        <motion.div
          key="html-preview-frame"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: HTML_PREVIEW_FADE_DURATION }}
          style={{ zIndex: HTML_PREVIEW_Z_INDEX }}
          className="fixed inset-0 overflow-hidden bg-chat-background"
          aria-label={t('chatAdapter.htmlPreview.title', 'HTML preview')}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md bg-black/30 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-white/[0.12] hover:text-foreground/95"
            aria-label={t('chatAdapter.htmlPreview.close', 'Close preview')}
          >
            <X size={15} strokeWidth={1.5} />
          </button>
          {load.status === 'ready' && load.artifactKey === artifactKey ? (
            <HtmlPreviewShell
              title={target.title}
              description={target.description}
              html={load.html}
              leftActions={
                <div className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white/[0.06] px-3 py-2 text-[13px] font-medium text-foreground/85 transition-colors hover:bg-white/[0.12]"
                  >
                    <Download size={14} strokeWidth={1.6} />
                    {t('chatAdapter.htmlPreview.downloadHtml', 'Download HTML')}
                  </button>
                  {shareState.status === 'shared' ? shareLinkBlock : shareButton}
                </div>
              }
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              {load.status !== 'error' ? (
                t('chatAdapter.htmlPreview.loading', 'Loading…')
              ) : (
                <>
                  <span>{t('chatAdapter.htmlPreview.loadFailed', 'Failed to load preview')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoad({ status: 'loading' });
                      setRetryCount((current) => current + 1);
                    }}
                    className="inline-flex h-7 items-center justify-center rounded-md px-3 text-xs text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground/95"
                  >
                    {t('chatAdapter.htmlPreview.retry', 'Retry')}
                  </button>
                </>
              )}
            </div>
          )}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};

export default HtmlPreview;
