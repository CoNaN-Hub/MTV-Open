/**
 * TextFullscreenViewer —— 官方「双击 Text 卡进全屏」那套 **MediaViewer** 的 1:1 实现（含官方动画常量）。
 *
 * 逐字来源（官方包 `E:/TapNow-0.4.66/resources/web/assets/`）：
 *   · 根 @576345 · header @576700 · 文本面板 @571990 · 底部行 `mye` @489845 · 格式工具 `r$` @486563
 *   · 动画常量 `On` @441334（`zoom-slider-3ZcFvYQO.js`）
 *   · 图标 `index-BiTZf8mJ.js`：`arrow-left` / `h-1 h-2 h-3` / `pilcrow` / `bold` / `italic`
 *
 * 动画（官方 `On`，逐字数值；这里用 CSS transition 实现，不引新依赖）：
 *   backdrop：opacity · **440ms** · `cubic-bezier(.65,0,.35,1)`
 *   textViewer：整体 morph **440ms**（圆角 300ms→440ms 用 `power1.inOut`≈`cubic-bezier(.4,0,.2,1)`）
 *               正文淡入 120ms 且**延迟 320ms**（`contentEnterStartSeconds`）
 *   chrome（header 返回键）：opacity + `translateY(18px)` · **240ms** · 延迟 **80ms** · `cubic-bezier(.22,1,.36,1)`
 *   actions（底部行）：opacity + `translateY(18px)` · 进场 **280ms** / 退场 **160ms** · 同曲线
 *   退场总时长 = chrome 240ms（`P()` 之后 `Xve` 收尾）
 *
 * 退出四条路（官方 `j`/`V`/`P`）：返回键 · Esc（`!document.fullscreenElement`）· 点左右空白带/backdrop（避开
 *   `[data-media-viewer-dismiss-blocker]`）· header 与底部行带 blocker ⇒ 点它们不关；多资源 ↑↓ 切换。
 *   **不含 mic**（mic 只在编辑区）✓
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderMarkdown } from '../../../utils/renderMarkdown';
import MarkdownTiptapEditor from './MarkdownTiptapEditor';
import { useAppStore } from '../../../store/useAppStore';
import type { Editor } from '@tiptap/react';
import { Icon } from '@iconify/react';

const BLOCKER = 'data-media-viewer-dismiss-blocker';

/* 官方 `On` @441334 逐字 */
const ANIM = {
  backdropMs: 440,
  viewerMs: 440,
  contentDelayMs: 320,
  contentMs: 120,
  chromeMs: 240,
  chromeDelayMs: 80,
  chromeOffsetPx: 18,
  actionsEnterMs: 280,
  actionsExitMs: 160,
  actionsOffsetPx: 18,
  easeShared: 'cubic-bezier(0.65, 0, 0.35, 1)',
  easeChrome: 'cubic-bezier(0.22, 1, 0.36, 1)',
  exitMs: 240,
} as const;

export interface ViewerAnchorRect { x: number; y: number; width: number; height: number; radius?: number }

export interface TextFullscreenViewerProps {
  open: boolean;
  text: string;
  title?: string;
  editable?: boolean;
  placeholder?: string;
  /** 卡片矩形：有它就做官方那种「卡片放大成全屏」的 morph ✓ */
  anchor?: ViewerAnchorRect | null;
  resources?: string[];
  resourceIndex?: number;
  onSelectResource?: (index: number) => void;
  onChange?: (next: string) => void;
  onClose: () => void;
}

type MdAction = 'h1' | 'h2' | 'h3' | 'paragraph' | 'bold' | 'italic' | 'list' | 'ordered-list' | 'divider';

const H_ICONS: Record<string, string> = {
  h1: 'tabler:h-1', h2: 'tabler:h-2', h3: 'tabler:h-3', paragraph: 'tabler:pilcrow',
};

export default function TextFullscreenViewer({
  open,
  text,
  title = '',
  editable = true,
  placeholder = '开启你的创作...',
  anchor,
  resources,
  resourceIndex = 0,
  onSelectResource,
  onChange,
  onClose,
}: TextFullscreenViewerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState({ h: 'paragraph', bold: false, italic: false, list: false, orderedList: false });
  const editorRef = useRef<Editor | null>(null);

  const multi = (resources?.length ?? 0) > 1;

  /* 进入：下一帧起动画（对应官方 `phase: open`） */
  useEffect(() => {
    if (!open) {
      /* 关闭时把进出场状态归零。⚠️ 放微任务里：effect 同步体直接 setState 会被
         `react-hooks/set-state-in-effect` 判错；语义不变（本帧末照样归零）。 */
      queueMicrotask(() => { setEntered(false); setExiting(false); });
      return undefined;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    const focusTimer = window.setTimeout(() => { if (editable) areaRef.current?.focus(); }, 0);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(focusTimer); };
  }, [editable, open]);

  /* 退场：先播退场动画，再真关（官方 `P()` → `Xve` 收尾） */
  const requestClose = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setEntered(false);
    window.setTimeout(() => { setExiting(false); onClose(); }, ANIM.exitMs);
  }, [exiting, onClose]);

  const onKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.defaultPrevented || !open) return;
    const target = event.target as HTMLElement | null;
    const inEditable = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (multi && !inEditable && (event.key === 'ArrowUp' || event.key === 'ArrowDown') && onSelectResource) {
      event.preventDefault(); event.stopPropagation();
      onSelectResource(resourceIndex + (event.key === 'ArrowUp' ? -1 : 1));
      return;
    }
    if (event.key === 'Escape' && !document.fullscreenElement) {
      event.preventDefault(); event.stopPropagation(); requestClose();
    }
  }, [multi, onSelectResource, open, requestClose, resourceIndex]);

  const onBackdropClick = useCallback((event: React.MouseEvent) => {
    if (!open) return;
    const el = event.target as Element | null;
    if (el?.closest(`[${BLOCKER}]`)) return;
    requestClose();
  }, [open, requestClose]);

  /* ★ 官方 Esc 关闭（`@576700`：`!document.fullscreenElement` 时才关）—— 必须挂在 **document** 上：
     放大面板是 portal，编辑态焦点在 tiptap 里、只读态焦点可能还在画布，
     只挂根节点 `onKeyDown` 时收不到按键（实测 Esc 关不掉 ✗）。 */
  useEffect(() => {
    if (!open) return undefined;
    const onDocKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        event.preventDefault();
        /* 别让画布那层的 Esc（取消连线/清选中）跟着一起触发 */
        event.stopPropagation();
        requestClose();
      }
    };
    /* 挂 **window 捕获阶段**：画布里另有 Esc 处理（取消连线/清选中）可能在 window/document 上
       `stopPropagation()`，挂 document 捕获仍会被它挡掉（实测 Esc 无效 ✗）。 */
    window.addEventListener('keydown', onDocKeyDown, true);
    /* 只读态把焦点收进面板（编辑态由 tiptap 自己 focus，别抢） */
    const focusTimer = window.setTimeout(() => {
      const root = rootRef.current;
      if (!editable && root && !root.contains(document.activeElement)) root.focus({ preventScroll: true });
    }, 0);
    return () => {
      document.removeEventListener('keydown', onDocKeyDown, true);
      window.removeEventListener('keydown', onDocKeyDown, true);
      window.clearTimeout(focusTimer);
    };
  }, [editable, open, requestClose]);

  const stop = useCallback((event: React.SyntheticEvent) => event.stopPropagation(), []);

  const applyAction = useCallback((action: MdAction) => {
    /* ★ 官方 `r$` 的按钮发的是**编辑器命令**（toggleHeading / toggleBold / toggleBulletList / setHorizontalRule…）
        ⇒ 有 tiptap 实例就走真命令 = 所见即所得；没有实例（只读/无编辑器）才退回 markdown 语法改写 ✓ */
    const rich = editorRef.current;
    if (rich) {
      const chain = rich.chain().focus();
      switch (action) {
        case 'h1': case 'h2': case 'h3':
          chain.toggleHeading({ level: Number(action.slice(1)) as 1 | 2 | 3 }).run();
          return;
        case 'paragraph': chain.setParagraph().run(); return;
        case 'bold': chain.toggleBold().run(); return;
        case 'italic': chain.toggleItalic().run(); return;
        case 'list': chain.toggleBulletList().run(); return;
        case 'ordered-list': chain.toggleOrderedList().run(); return;
        case 'divider': chain.setHorizontalRule().run(); return;
        default: return;
      }
    }
    const area = areaRef.current;
    if (!area || !onChange) return;
    const start = area.selectionStart ?? 0;
    const end = area.selectionEnd ?? 0;
    const selected = text.slice(start, end);
    const wrap = (token: string) => {
      const body = selected || '文本';
      onChange(`${text.slice(0, start)}${token}${body}${token}${text.slice(end)}`);
      requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + token.length, start + token.length + body.length); });
    };
    const prefix = (token: string) => {
      const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      onChange(`${text.slice(0, lineStart)}${token}${text.slice(lineStart)}`);
      requestAnimationFrame(() => { area.focus(); area.setSelectionRange(start + token.length, end + token.length); });
    };
    switch (action) {
      case 'h1': case 'h2': case 'h3': {
        const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        const stripped = text.slice(lineStart).replace(/^#{1,6}\s+/, '');
        onChange(`${text.slice(0, lineStart)}${'#'.repeat(Number(action.slice(1)))} ${stripped}`);
        setActive((prev) => ({ ...prev, h: action }));
        break;
      }
      case 'paragraph': {
        const lineStart = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
        onChange(`${text.slice(0, lineStart)}${text.slice(lineStart).replace(/^#{1,6}\s+/, '')}`);
        setActive((prev) => ({ ...prev, h: 'paragraph' }));
        break;
      }
      case 'bold': wrap('**'); setActive((prev) => ({ ...prev, bold: !prev.bold })); break;
      case 'italic': wrap('*'); setActive((prev) => ({ ...prev, italic: !prev.italic })); break;
      case 'list': prefix('- '); break;
      case 'ordered-list': prefix('1. '); break;
      case 'divider': prefix('---\n'); break;
      default: break;
    }
  }, [onChange, text]);

  const copyAll = useCallback(async () => {
    /* ★ 官方点「复制全部」的反馈 = **sonner toast 弹窗**（不是气泡）：
         官方 9444 实测：点击后出现 `[data-sonner-toast]`（class `!bg-white dark:!bg-zinc-800 !border-0 !text-tap-text-1 …`），
         文案 = i18n `copySuccess:"复制成功"` + `copySuccessDesc:"内容已复制到剪贴板"`
         （`index-BiTZf8mJ.js` @9768863 的 `vWs` 块；`CopyButton` 自身只做图标 copy→check 切换）。
         ⚠️ 官方那个工具栏的 Radix tooltip 实测是 **1×1 不可见**（`[role="tooltip"]` rect `[1180,1248,1,1]`、`className:""`）
            ⇒ 用户看到的"官方工具栏没有气泡"是对的，MTV 因此**不再挂任何 tooltip**。 */
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      useAppStore.getState().showToast('复制成功', 'success', '内容已复制到剪贴板');
    } catch {
      useAppStore.getState().showToast('复制失败', 'error');
    }
  }, [text]);

  const formatBar = useMemo(() => {
    /* ★ 官方 `Wh`（ToolbarToggleItem @485563）+ `BI`（@485563）逐字：
         item 基础 = `h-7 w-7 p-0 transition-all duration-300`，
         颜色 = `BI(isActive, appearance==='media-viewer')`：
            基础 `rounded-full bg-transparent text-white/70 hover:bg-white/[0.08] hover:text-white`
            激活追加 `bg-white/[0.10] text-white`
            （另有 `cursor-pointer data-[state=on]:bg-white/[0.10] data-[state=on]:text-white`）
       ⚠️ 上一轮我用的是**自己编的** `size-7 rounded-[6px] text-white/60` + 激活 `bg-white/[0.12]`
          ⇒ 圆角、颜色全不对（用户：「颜色也不对」） */
    const segBtn = (key: string, label: string, iconName: string, isActive: boolean) => (
      <button
        key={key}
        type="button"
        aria-label={label}
        /* ⚠️ 官方这个工具栏的 tooltip 实测是 **1×1 不可见**（`[role="tooltip"]` rect `[1180,1248,1,1]`）
           ⇒ 按用户要求/观感"没有气泡"：这里**不挂** `data-tooltip`，也没有原生 `title` */
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyAction(key as MdAction)}
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-transparent p-0 transition-all duration-300 ${
          isActive
            ? 'bg-white/[0.10] text-white'
            : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
        }`}
      >
        <Icon icon={iconName} width={16} height={16} />
      </button>
    );
    return (
      /* 官方 `r$` 根容器逐字：`flex w-fit items-center gap-1 p-1` */
      <div className="flex w-fit items-center gap-1 p-1">
        {/* ★ 官方把 h1/h2/h3/paragraph 放在**同一个 ToggleGroup** 里，那个组带 `gap-0.5`（2px）；
            MTV 之前把它们直接挂根容器上，吃的是根容器的 `gap-1`（4px）✗。
            官方 9444 实测相邻按钮间距 = [21, **2,2,2**, 17, 2, 17, 2, 17]，
            MTV 改前是 [21, **4,4,4**, 17, 2, 17, 2, 17] —— 用户说的「间距与官方不对」就是这处。 */}
        <div className="flex items-center gap-0.5">
          {/* ★ 官方 i18n `nodes.markdownToolbar.paragraph` = "Paragraph" → zh-CN **「正文」**
              （官方 9444 实测按钮顺序 = 标题1 / 标题2 / 标题3 / **正文**）；MTV 之前写「段落」✗ */}
          {segBtn('h1', '标题 1', H_ICONS.h1, active.h === 'h1')}
          {segBtn('h2', '标题 2', H_ICONS.h2, active.h === 'h2')}
          {segBtn('h3', '标题 3', H_ICONS.h3, active.h === 'h3')}
          {segBtn('paragraph', '正文', H_ICONS.paragraph, active.h === 'paragraph')}
        </div>
        <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
        <div className="flex items-center gap-0.5">
          {segBtn('bold', '加粗', 'tabler:bold', active.bold)}
          {segBtn('italic', '斜体', 'tabler:italic', active.italic)}
        </div>
        <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
        <div className="flex items-center gap-0.5">
          {/* ★ 官方 `r$` 的两个 list 项也吃 `activeState`（`uye` 把 isList/isOrderedList 映射成 'list'/'ordered-list'
              再交给 toggle group 的 value）⇒ 激活态必须跟着编辑器走。
              MTV 上一轮这里**写死 false** ⇒ 列表 chip 点完永不点亮 ✗（用户：「底部工具栏 点击后的逻辑显示全错」） */}
          {segBtn('list', '无序列表', 'tabler:list', active.list)}
          {segBtn('ordered-list', '有序列表', 'tabler:list-numbers', active.orderedList)}
        </div>
        {/* 官方 `r$` @488180：列表组之后还有**第三根竖线**，再单独一颗「分隔线」（我上一轮漏了这根线） */}
        <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
        <button
          type="button"
          aria-label="分隔线"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyAction('divider')}
          /* 官方 divider 那颗（@488560）：`h-7 w-7 cursor-pointer p-0`，
             media-viewer 档追加 `rounded-full text-white/70 hover:bg-white/[0.08] hover:text-white` */
          className="flex h-7 w-7 items-center justify-center rounded-full p-0 text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <Icon icon="tabler:minus" width={16} height={16} />
        </button>
      </div>
    );
  }, [active, applyAction]);

  if (!open) return null;

  const show = entered && !exiting;

  /* 官方 morph：从卡片矩形（`anchor`）放大到全屏；无 anchor 时纯淡入
     ⚠️ 面板靠 `left-1/2` + `-translate-x-1/2` 居中，但**内联 transform 会盖掉类上的
        `-translate-x-1/2`**（实测 computed `transform: matrix(1,0,0,1,0,0)`，面板左边缘落在
        视口正中 = 文字从中间往右排 ✗）。所以居中量必须**自己算进内联 transform**：
        show 态 = `translate(-panelW/2, 0)`（等价于 `-50%`）；morph 态目标 = 卡片左上角。 */
  const panelW = Math.min(window.innerWidth * 0.6, 1120);
  const panelBaseLeft = window.innerWidth / 2;
  const panelStyle: React.CSSProperties = anchor
    ? {
      transition: `transform ${ANIM.viewerMs}ms ${ANIM.easeShared}, border-radius ${ANIM.viewerMs}ms ${ANIM.easeShared}, opacity ${ANIM.viewerMs}ms ${ANIM.easeShared}`,
      transformOrigin: 'top left',
      transform: show
        ? `translate(${-panelW / 2}px, 0px) scale(1, 1)`
        : `translate(${anchor.x - panelBaseLeft}px, ${anchor.y}px) scale(${anchor.width / Math.max(1, panelW)}, ${anchor.height / Math.max(1, window.innerHeight * 0.6)})`,
      borderRadius: show ? 0 : (anchor.radius ?? 12),
    }
    : {
      transition: `opacity ${ANIM.viewerMs}ms ${ANIM.easeShared}`,
      opacity: show ? 1 : 0,
    };

  return createPortal(
    <div
      ref={rootRef}
      data-media-viewer=""
      data-state={show ? 'open' : 'closed'}
      role="dialog"
      aria-modal="true"
      aria-label={title || '文本'}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={onBackdropClick}
      onPointerDown={stop}
      onPointerMove={stop}
      onPointerUp={stop}
      onPointerCancel={stop}
      className="fixed inset-0 z-[100] select-none overscroll-contain text-white outline-none overflow-hidden"
    >
      {/* backdrop：官方 `On.backdrop` 440ms cubic-bezier(.65,0,.35,1) */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 bg-black"
        style={{ opacity: show ? 1 : 0, transition: `opacity ${ANIM.backdropMs}ms ${ANIM.easeShared}` }}
      />

      {/* 文本档左右两条「点空白关闭」热区（宽 = 面板两侧留白） */}
      <button type="button" tabIndex={-1} aria-label="关闭" onClick={requestClose}
        className="fixed bottom-0 left-0 top-20 z-20 cursor-default border-0 bg-transparent p-0 w-[calc((100vw-min(76vw,1440px))/2)]" />
      <button type="button" tabIndex={-1} aria-label="关闭" onClick={requestClose}
        className="fixed bottom-0 right-0 top-20 z-20 cursor-default border-0 bg-transparent p-0 w-[calc((100vw-min(76vw,1440px))/2)]" />

      {/* 文本面板（`w-[min(60vw,1120px)]`；morph 就作用在它身上）
          ★ 官方把 `data-media-viewer-dismiss-blocker` 挂在**文本安全区**上
            （`zoom-slider-3ZcFvYQO.js` @570171：`<div ref=u data-media-viewer-dismiss-blocker
              className="media-viewer__text-safe-zone fixed z-10 flex justify-center">`，里面就是面板+编辑器；
              同文件共 6 处挂点：图片画框 / 历史条 / **文本安全区** / 底行 / 底行子节点 / header）。
            MTV 之前只挂了 header + 底行 ⇒ **在编辑器里点一下（准备输入）会冒泡到根节点的
            `onBackdropClick`，被当成"点空白"直接退出面板** ✗（用户报的 BUG，实测复现）。 */}
      <main
        {...{ [BLOCKER]: true }}
        className="absolute left-1/2 top-20 bottom-24 z-10 w-[min(60vw,1120px)] -translate-x-1/2 select-text overflow-hidden text-card-foreground"
        style={panelStyle}
      >
        <div
          className="size-full overflow-y-auto"
          style={{
            opacity: show ? 1 : 0,
            transition: `opacity ${ANIM.contentMs}ms linear ${show ? ANIM.contentDelayMs : 0}ms`,
          }}
        >
        {editable ? (
          /* ★ 官方编辑态：tiptap 富文本（WYSIWYG）+ `canvas-text-markdown min-h-full !max-w-none !px-10 !py-8`
             ⇒ 内容进出都是 markdown（`data.output` 不变），h1/h2/粗体/列表/分隔线**当下就渲染** ✓ */
          <MarkdownTiptapEditor
            value={text}
            placeholder={placeholder}
            onChange={(next) => onChange?.(next)}
            onEditorReady={(instance) => { editorRef.current = instance; }}
            onStateChange={setActive}
          />
        ) : (
          /* ★ 查看态 = **markdown 渲染**（官方 `sxe` @571990：`<div className="size-full overflow-y-auto px-10 py-8">
               <UP markdown/></div>`，`UP` = `<div class="canvas-text-markdown"><ReactMarkdown/></div>`）
             与文本卡本体的渲染**同一套**（`utils/renderMarkdown` + `.canvas-text-markdown` 样式）⇒
             h1/h2/h3（含 h1/h2 下边框）、粗体、斜体、列表、分隔线、行内代码的颜色与排版都按官方 CSS ✓ */
          <div
            className="canvas-text-markdown size-full overflow-y-auto px-10 py-8"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
          />
        )}
        </div>
      </main>

      {/* header：返回键，官方 `On.chrome` = 240ms / 延迟 80ms / translateY(18px) / cubic-bezier(.22,1,.36,1) */}
      <header {...{ [BLOCKER]: true }} className="fixed inset-x-0 top-0 z-30 h-20">
        <button
          type="button"
          aria-label="返回"
          onClick={requestClose}
          className="absolute left-5 top-5 flex size-9 items-center justify-center rounded-full bg-white/[0.08] text-white/90 transition-colors hover:bg-white/[0.14]"
          style={{
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0)' : `translateY(${ANIM.chromeOffsetPx}px)`,
            transition: `opacity ${ANIM.chromeMs}ms ${ANIM.easeChrome} ${show ? ANIM.chromeDelayMs : 0}ms, transform ${ANIM.chromeMs}ms ${ANIM.easeChrome} ${show ? ANIM.chromeDelayMs : 0}ms, background-color 150ms`,
          }}
        >
          <Icon icon="tabler:arrow-left" width={20} height={20} />
        </button>
      </header>

      {/* 底部行 `mye`：胶囊 + 复制全文圆钮 + 分隔线 + 格式条；官方 `On.actions` 进场 280ms / 退场 160ms + translateY(18px) */}
      <div {...{ [BLOCKER]: true }} className="fixed bottom-7 left-1/2 z-30 -translate-x-1/2">
        <div
          className="flex items-center gap-1 rounded-[24px] bg-[oklch(20%_0.008_250)] p-1.5 shadow-[0_14px_40px_rgba(0,0,0,0.32)]"
          style={{
            opacity: show ? 1 : 0,
            transform: show ? 'translateY(0)' : `translateY(${ANIM.actionsOffsetPx}px)`,
            transition: `opacity ${show ? ANIM.actionsEnterMs : ANIM.actionsExitMs}ms ${ANIM.easeChrome}, transform ${show ? ANIM.actionsEnterMs : ANIM.actionsExitMs}ms ${ANIM.easeChrome}`,
          }}
        >
          {/* ★ 官方 `CopyButton`（`use-waveform-data-DMduQqB-.js` @91900 的 `rd`）逐字：
                const [copied,setCopied]=useState(false);
                onClick = async d => { d.stopPropagation(); await copy(value); setCopied(true); setTimeout(()=>setCopied(false),2000); };
                const tip = copied ? (successText||'Copied!') : (defaultText||'Copy');
                return <Tooltip content={tip}><span className="inline-flex"><Button variant="clean" shape="square" onClick={onClick}
                         className={className}>{copied?<Check size={16}/>:<Copy size={16}/>}</Button></span></Tooltip>;
              ⚠️ 上一轮我以为"官方的面板就是这个 tooltip" —— **错了**：官方 9444 实测那个工具栏的
                `[role="tooltip"]` 是 **1×1 不可见**（rect `[1180,1248,1,1]`、`className:""`），
                真正的反馈是点完后弹出的 **sonner toast**（`[data-sonner-toast]`，「复制成功 / 内容已复制到剪贴板」）
                ⇒ 所以这里**不挂任何 tooltip**，toast 在 `copyAll` 里弹。 */}
          <button
            type="button"
            aria-label={copied ? '已复制' : '复制全部'}
            /* ★ 官方 CopyButton（`use-waveform-data` @91900 `rd`）：点完只做「图标 copy→check」+ 弹 **toast**
               （toast 由 app 层的复制反馈弹，见 `copyAll`）。官方工具栏没有可见气泡 ⇒ 这里不挂 tooltip。 */
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); void copyAll(); }}
            className="flex size-9 items-center justify-center rounded-full p-0 text-white/75 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Icon icon={copied ? 'tabler:check' : 'tabler:copy'} width={16} height={16} />
          </button>
          {editable && (
            <>
              <span aria-hidden className="mx-1 h-5 w-px bg-white/10" />
              {formatBar}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
