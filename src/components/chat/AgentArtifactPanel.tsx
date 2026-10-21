/**
 * AgentArtifactPanel —— 官方头部第 1 颗 sidePanel 打开的面板（官方组件 `Hoe`，`page-DVqoHdTT.js`@691705）。
 *
 * 官方结构（源码逐字）：
 *   · 根：`group rounded-xl bg-chat-background shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col
 *     overflow-hidden pointer-events-auto`，`aria-label="Side panel"`；停靠助手面板左侧，`gap: 12`。
 *   · 几何：`top = anchor.top + topOffset`，`left = max(8, anchor.left - width - gap)`，
 *     `width` 默认 **320**、下限 **320**（`cp`）、上限 **520**（`dp`），key **`artifact-panel-width`**；
 *     高度 key **`artifact-panel-height`**，下限 **280**（`KN`）；list 视图未拖高时 `maxHeight` **480**（`YN`）。
 *   · 左缘宽度拖拽条（**_左右拖动_**）：
 *     `absolute left-0 top-0 bottom-0 z-50 flex w-3 cursor-col-resize items-center justify-center`
 *     + `relative left-0.5 flex flex-col gap-[3px] transition-opacity duration-150`（hover/拖拽才亮）
 *     + 三点 `block h-[3px] w-[3px] rounded-full bg-white/40`。
 *   · 底缘高度拖拽条（**_上下拖动_**）：
 *     `absolute bottom-0 left-0 right-0 z-50 flex h-3 cursor-row-resize items-center justify-center`
 *     + `relative bottom-0.5 flex gap-[3px] transition-opacity duration-150`
 *     + 同样三点 `block h-[3px] w-[3px] rounded-full bg-white/40`（**横向排列**）。
 *   · **视图三分支**（官方 `workspaceView`）：
 *       `list`  → 输出/文件工作区（官方 `WN`）：`flex flex-1 flex-col px-4 pt-[26px]`（`HS='pt-[26px]'`）+
 *                 标题 `px-2 text-sm font-medium text-white/45`（`artifactPanel.outputs`「文件」）+
 *                 空态 `flex flex-1 items-center justify-center pb-6 text-sm text-white/40`（「暂无输出」）；
 *                 有文件时容器换成 `flex flex-1 flex-col px-4 pb-3`，标题变 sticky。
 *                 行：`relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left
 *                     transition-colors hover:bg-white/[0.05]` + 图标 20/1.5（`text-white/55`）+
 *                     `truncate text-sm text-white/85`。
 *       `file`  → 单个文件详情（带返回）；
 *       其它     → **markdown 产物详情**：头部 `V(ij,'pl-2.5 pr-4', 有分段 && 'border-b border-white/[0.06]')`
 *                 + 返回键 + 标题 + 右侧 `flex h-10 shrink-0 items-center gap-3`；分段导航行。
 *   · 收起键（官方条件 `!chatPanelOpen && onClose && view==='list'`）：`absolute bottom-2 right-2 z-[60] flex h-7 w-7
 *     … text-white/40 opacity-0 group-hover:opacity-100`，图标 `tz` = tabler `arrow-narrow-right` 18/1.5。
 *
 * ⚠️ 本地化差异（记账）：
 *   1. 官方 `workspaceFiles` 来自服务端 artifact 列表；MTV 的列表 = 本地 **brainstorm.md**（IndexedDB，有内容才出现）
 *      + 项目数据目录文件（Tauri 端；浏览器开发环境目录为空）。
 *   2. 官方用 `position: fixed` 锚在助手面板矩形左侧；MTV 是同一 flex 行里的兄弟节点，
 *      几何结果一致（面板宽 320 + 12 间距 + 助手面板），故保留流式布局。
 *   3. 本轮不做：交互页 iframe（`generateInteractivePage`）、图片类输出预览（官方 `voe` 的 image 分支）——
 *      file 视图目前只读文本。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useT } from '../../i18n';
import ArtifactMoreActionsMenu from './ArtifactMoreActionsMenu';
import ChatMarkdown from './ChatMarkdown';
import OverflowFade from './OverflowFade';
import {
  OfficialArrowNarrowRightIcon,
  OfficialChevronLeftIcon,
  OfficialCsvIcon,
  OfficialFileIcon,
  OfficialFileTextIcon,
  OfficialHtmlIcon,
  OfficialMarkdownIcon,
  OfficialPhotoIcon,
} from './officialIcons';
import {
  isBrainstormEmpty,
  clearBrainstormDoc,
  parseBrainstormSections,
  readBrainstormDoc,
  replaceBrainstormSection,
  subscribeBrainstorm,
  writeBrainstormDoc,
} from '../../services/chat/brainstormService';
import {
  listChatArtifacts,
  subscribeChatArtifacts,
  type ChatArtifactRecord,
} from '../../services/chat/chatArtifactService';
import { useSetHtmlPreviewTarget } from '../../services/chat/htmlPreviewTarget';

const ARTIFACT_PANEL_DEFAULT_WIDTH = 320;
/** 官方 `cp=320`：宽度下限与默认值同值。 */
const ARTIFACT_PANEL_MIN_WIDTH = 320;
const ARTIFACT_PANEL_MAX_WIDTH = 520;
const ARTIFACT_PANEL_WIDTH_KEY = 'artifact-panel-width';
/** 官方 `KN=280`：高度下限。 */
const ARTIFACT_PANEL_MIN_HEIGHT = 280;
const ARTIFACT_PANEL_HEIGHT_KEY = 'artifact-panel-height';
/** 官方 `YN=480`：list 视图未拖高时的 `maxHeight`。 */
const ARTIFACT_PANEL_LIST_MAX_HEIGHT = 480;
/** 官方 `g_=200`：list 视图内容高度下限；空列表时面板高度就固定是 200。 */
const ARTIFACT_PANEL_LIST_MIN_HEIGHT = 200;
/** 官方 `jI=380`：非 list 视图高度上限，也是量不到锚点时的兜底高度。 */
const ARTIFACT_PANEL_CONTENT_MAX_HEIGHT = 380;
/** 官方 `y_=520`：展开态宽度（同时是宽度拖拽上限）。 */
const ARTIFACT_PANEL_EXPANDED_WIDTH = 520;
/** 官方 `aC=[.22,1,.36,1]`：进入/高度动画的缓动。 */
const ARTIFACT_ANIM_EASE = [0.22, 1, 0.36, 1] as const;
/** 官方 `E1e=[.7,0,.84,0]`：退出动画的缓动。 */
const ARTIFACT_ANIM_EXIT_EASE = [0.7, 0, 0.84, 0] as const;
/** 官方 `Vk=.34`：高度动画时长。 */
const ARTIFACT_ANIM_HEIGHT_DURATION = 0.34;
/** 官方 `N1e=.24` / `R?.2`：opacity/x 进入时长（`R` = 减少动态）。 */
const ARTIFACT_ANIM_FADE_DURATION = 0.24;
const ARTIFACT_ANIM_FADE_DURATION_REDUCED = 0.2;
/** 官方 `T1e=.28` / `R?.16`：退出时长（`R` = 减少动态）。 */
const ARTIFACT_ANIM_EXIT_DURATION = 0.28;
const ARTIFACT_ANIM_EXIT_DURATION_REDUCED = 0.16;
/** 官方 `S1e=24`：进入/退出时的 x 位移（减少动态下为 0）。 */
const ARTIFACT_HIDDEN_X_OFFSET = 24;
const BRAINSTORM_ARTIFACT_PATH = 'brainstorm.md';
/** 稳定空数组：避免每次渲染新建引用把 `useMemo` 依赖打穿。 */
const EMPTY_ARTIFACTS: ChatArtifactRecord[] = [];

interface WorkspaceFile {
  path: string;
  name: string;
  kind: 'brainstorm' | 'text' | 'markdown' | 'csv' | 'html' | 'image' | 'other';
}

interface AgentArtifactPanelProps {
  conversationId: string;
  projectId: string;
  /** 官方 `anchorRef`：助手面板根元素。官方用它算 `H.top / H.height`，面板宽高都由它推导。 */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** 官方 `chatPanelOpen`：收起键只在助手面板关闭 + list 视图时出现。 */
  chatPanelOpen?: boolean;
  onClose: () => void;
  /** 官方 `artifactPanel.addToCanvas`。 */
  onAddToCanvas: (markdown: string) => void;
  /** 官方 `artifactPanel.discuss`。 */
  onDiscuss: (markdown: string) => void;
  /** 官方 `cst` 里那颗**局部** busy 标志 `ae`（调用点把它当 `agentBusy` 传进来，但 `cst` 不读该 prop，
   *  而是在内部自己算一个 `ae`）⇒ MTV 用这个 prop 承担官方 `ae` 的角色，禁用到「添加到画布 / 讨论」两颗键上。 */
  agentBusy?: boolean;
}

function readStoredWidth(): number {
  if (typeof window === 'undefined') return ARTIFACT_PANEL_DEFAULT_WIDTH;
  const parsed = Number.parseInt(window.localStorage.getItem(ARTIFACT_PANEL_WIDTH_KEY) ?? '', 10);
  if (!Number.isFinite(parsed)) return ARTIFACT_PANEL_DEFAULT_WIDTH;
  return Math.max(ARTIFACT_PANEL_MIN_WIDTH, Math.min(ARTIFACT_PANEL_MAX_WIDTH, parsed));
}

function readStoredHeight(): number | null {
  if (typeof window === 'undefined') return null;
  const parsed = Number.parseInt(window.localStorage.getItem(ARTIFACT_PANEL_HEIGHT_KEY) ?? '', 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(ARTIFACT_PANEL_MIN_HEIGHT, parsed);
}

/** 官方 `zoe`：按 `artifact_path` / `content_type` 选图标（官方是 Tabler 一组）。 */
function resolveFileIcon(file: WorkspaceFile) {
  switch (file.kind) {
    case 'brainstorm':
    case 'text':
      return OfficialFileTextIcon;
    case 'markdown':
      return OfficialMarkdownIcon;
    case 'csv':
      return OfficialCsvIcon;
    case 'html':
      return OfficialHtmlIcon;
    case 'image':
      return OfficialPhotoIcon;
    default:
      return OfficialFileIcon;
  }
}

export default function AgentArtifactPanel({
  conversationId,
  projectId,
  anchorRef,
  chatPanelOpen = true,
  onClose,
  onAddToCanvas,
  onDiscuss,
  agentBusy = false,
}: AgentArtifactPanelProps) {
  const t = useT();
  /** 官方交互页入口：`.html` 产物行点击后写 `htmlPreviewTarget`（宿主 `App.tsx` 渲染 `HtmlPreview`）。 */
  const setHtmlPreviewTarget = useSetHtmlPreviewTarget();
  /** 官方 `workspaceView`：默认 **list**（输出/文件工作区）。 */
  const [view, setView] = useState<'list' | 'detail' | 'file'>('list');
  const [markdown, setMarkdown] = useState('');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [width, setWidth] = useState(readStoredWidth);
  /** 官方 `Y`（`artifactPanelExpanded`，默认 **true**）：展开态 = 撑满助手面板高度。 */
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState<number | null>(readStoredHeight);
  const [colResizing, setColResizing] = useState(false);
  const [rowResizing, setRowResizing] = useState(false);
  const [colHover, setColHover] = useState(false);
  const [rowHover, setRowHover] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  /** 官方 `H`：锚点（助手面板根元素）的 `{top,left,height}`。 */
  const [anchorRect, setAnchorRect] = useState<{ top: number; left: number; height: number } | null>(null);
  /** 官方 `J`：list 视图量出来的内容高度（`max(200, min(480, scrollHeight))`；空列表由 `g_` 直接给 200）。 */
  const [contentMeasure, setContentMeasure] = useState<{ view: string; height: number } | null>(null);
  /** 官方 `q`：`Cn = q || Ke.current !== view` —— 这一小段时间里高度变化要播 `.34s` 动画。 */
  const [heightAnimPending, setHeightAnimPending] = useState(false);
  const [previousView, setPreviousView] = useState(view);
  const [animationSignature, setAnimationSignature] = useState(`${view}|${expanded}|${chatPanelOpen}`);
  /* 官方 `a.useLayoutEffect(() => { const Gt = Ke.current; Gt !== w && (Ke.current = w, e && Q(!0),
     w === "list" && ee(null), Gt === "list" && w !== "list" && K(!0)) }, [w, e])`：
     视图变了就置 `q`（`Q(!0)`）、重新量内容高度、并且**从 list 进详情时展开**。
     另外 `b`（chatPanelOpen）与 `Z`（expanded）变化也各自 `Q(!0)`。
     这里用「渲染期同步 state」表达同一件事（`useEffect` 里 setState 会被 `react-hooks/set-state-in-effect` 拦）。
     等价性：`Ke.current` 在 layout effect 里更新 ⇒ `Cn` 恰好在「视图变化那一帧 + 动画未完成期间」为真；
     这里 `heightAnimPending` 由 `onAnimationComplete` 清掉，行为一致。 */
  if (previousView !== view) {
    setPreviousView(view);
    if (previousView === 'list' && view !== 'list') setExpanded(true);
  }
  const nextAnimationSignature = `${view}|${expanded}|${chatPanelOpen}`;
  if (animationSignature !== nextAnimationSignature) {
    setAnimationSignature(nextAnimationSignature);
    setHeightAnimPending(true);
  }
  const reduceMotion = useReducedMotion() ?? false;
  /** 官方 `O = R ? 0 : S1e`。 */
  const artifactHiddenXOffset = reduceMotion ? 0 : ARTIFACT_HIDDEN_X_OFFSET;
  /** 官方 `D = R ? .2 : .24`。 */
  const artifactFadeDuration = reduceMotion ? ARTIFACT_ANIM_FADE_DURATION_REDUCED : ARTIFACT_ANIM_FADE_DURATION;
  /** 官方 `F = R ? .16 : .28`。 */
  const artifactExitDuration = reduceMotion ? ARTIFACT_ANIM_EXIT_DURATION_REDUCED : ARTIFACT_ANIM_EXIT_DURATION;
  const panelRef = useRef<HTMLElement | null>(null);
  const colGestureRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const rowGestureRef = useRef<{ startY: number; startHeight: number } | null>(null);
  /** 官方 `je`：list 非空分支里包住整个列表的 `shrink-0` 容器（量 `scrollHeight` 用）。 */
  const listContentRef = useRef<HTMLDivElement | null>(null);
  /** 官方 `ct` / `it`：高度拖拽的上/下限（渲染期写入，拖拽回调读）。 */
  const maxHeightRef = useRef(0);
  const minHeightRef = useRef(0);
  /** 官方 `Pe`：高度拖拽的当前值。 */
  const panelHeightRef = useRef(0);
  /** 官方 `Ze`：打开副作用只跑一次（`e` 由 false→true）。 */
  const openedRef = useRef(false);
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  useEffect(() => {
    widthRef.current = width;
    heightRef.current = height;
  }, [width, height]);

  /* 官方 `a.useLayoutEffect(()=>{if(!e)return; const Gt=n.current; ...})`：量锚点矩形，
     用 ResizeObserver + window resize/scroll 跟着更新。MTV 的锚点 = 助手面板根元素。 */
  useLayoutEffect(() => {
    const el = anchorRef?.current;
    if (!el) return undefined;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setAnchorRect({ top: rect.top, left: rect.left, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorRef]);

  /* 官方打开副作用（`Ze.current !== e` 分支）—— 组件挂载即「打开」：
     展开态 = (`view !== 'list'`)、拖高归零、宽度回 320。 */
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    setExpanded(view !== 'list');
    panelHeightRef.current = 0;
    setHeight(null);
    widthRef.current = ARTIFACT_PANEL_MIN_WIDTH;
    setWidth(ARTIFACT_PANEL_MIN_WIDTH);
  }, [view]);

  /* 正文：打开读一次 + 订阅变更（Agent 写完 / 分段保存都会通知）。
     ⚠️ `conversationId` 可能为空串（新建对话态、尚无会话记录 —— 官方 artifact 面板挂在 canvas 上、
     不需要会话）。此时**跳过产物读写**，只渲染官方的空态壳，不要去读/写 `''` 这个伪 key。 */
  useEffect(() => {
    /* 空串 ⇒ 直接不读（`markdown` 初值就是 `''`；面板关闭即卸载 ⇒ 不需要额外清空）。 */
    if (!conversationId) return undefined;
    let alive = true;
    const load = () => {
      void readBrainstormDoc(conversationId).then((next) => {
        if (alive) setMarkdown(next);
      });
    };
    load();
    const unsubscribe = subscribeBrainstorm((changedId) => {
      if (changedId === conversationId) load();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [conversationId]);

  /* ⚠️ 已删除：MTV 原来把「项目数据目录里的文件」当成官方 `workspaceFiles` 列出来
     （`getProjectDataDir` + `listDirectoryFiles`）——官方 `workspaceFiles` 是**服务端 artifact**
     （brainstorm.md / 交互页 html / 生成的图片等），**不列画布节点、也不列本地目录文件**。
     实测该列表出现的是「额娘深秋--…／去脏去噪|中--…／图片生成--…」这类落到项目目录的媒体文件名，
     与官方语义不符 ⇒ 按「不是官方的移除」整段删掉。
     MTV 的产物列表现在只剩真产物：本会话的 `artifacts/brainstorm.md`（见下方 `outputs`）。 */

  /* 官方 `ie`：左缘拖拽改宽度（`startWidth - Δx`）+ 写 `artifact-panel-width`；
     官方 `$`：底缘拖拽改高度（`startHeight + Δy`）+ 写 `artifact-panel-height`。
     ⚠️ 官方在两个 `onMouseDown` 里都会先调 `ht()` —— 展开态下**第一次拖拽**会先折叠成显式尺寸。 */
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const col = colGestureRef.current;
      if (col) {
        setWidth(Math.max(
          ARTIFACT_PANEL_MIN_WIDTH,
          Math.min(ARTIFACT_PANEL_MAX_WIDTH, col.startWidth - (event.clientX - col.startX)),
        ));
        return;
      }
      const row = rowGestureRef.current;
      if (row) {
        /* 官方：`Math.max(it.current, Math.min(ct.current, xe.current + Δy))`
           —— 下限是 `it`（list 视图 200 / 其它 380），上限是 `ct`（Jt）。 */
        const next = Math.max(
          minHeightRef.current,
          Math.min(maxHeightRef.current || Number.POSITIVE_INFINITY, row.startHeight + (event.clientY - row.startY)),
        );
        panelHeightRef.current = next;
        setHeight(next);
      }
    };
    const onUp = () => {
      if (colGestureRef.current) {
        colGestureRef.current = null;
        setColResizing(false);
        document.body.classList.remove('cursor-col-resize', 'select-none');
        try {
          window.localStorage.setItem(ARTIFACT_PANEL_WIDTH_KEY, String(Math.round(widthRef.current)));
        } catch {
          /* 持久化失败不影响本次拖拽 */
        }
      }
      if (rowGestureRef.current) {
        rowGestureRef.current = null;
        setRowResizing(false);
        document.body.classList.remove('cursor-row-resize', 'select-none');
        try {
          window.localStorage.setItem(ARTIFACT_PANEL_HEIGHT_KEY, String(Math.round(heightRef.current ?? 0)));
        } catch {
          /* 持久化失败不影响本次拖拽 */
        }
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  /** 官方 `ht()`：拖拽前把展开态收敛成显式尺寸（宽拉到上限 520、高拉到当前上限 `ct`）。 */
  const collapseExpandedGeometry = useCallback(() => {
    if (!expanded) return;
    setExpanded(false);
    widthRef.current = ARTIFACT_PANEL_EXPANDED_WIDTH;
    setWidth(ARTIFACT_PANEL_EXPANDED_WIDTH);
    try {
      window.localStorage.setItem(ARTIFACT_PANEL_WIDTH_KEY, String(ARTIFACT_PANEL_EXPANDED_WIDTH));
    } catch {
      /* 持久化失败不影响本次拖拽 */
    }
    const nextHeight = maxHeightRef.current;
    panelHeightRef.current = nextHeight;
    heightRef.current = nextHeight;
    setHeight(nextHeight);
    try {
      window.localStorage.setItem(ARTIFACT_PANEL_HEIGHT_KEY, String(Math.round(nextHeight)));
    } catch {
      /* 持久化失败不影响本次拖拽 */
    }
  }, [expanded]);

  const sections = useMemo(() => parseBrainstormSections(markdown), [markdown]);
  const brainstormEmpty = isBrainstormEmpty(markdown);
  /**
   * 输出列表 = 本会话的实际产物：
   *   · `artifacts/brainstorm.md`（有内容时）；
   *   · **HTML 交互页**（`show_html` 工具写进 `chatArtifactService` 的本地产物）——
   *     官方 `workspaceFiles` 里就是「brainstorm.md + 交互页 html + 生成的图片」，
   *     面板行图标 `bS`(`file-type-html`) 也早就在 `resolveFileIcon` 里备好了。
   */
  const [artifactsState, setArtifactsState] = useState<{ conversationId: string; records: ChatArtifactRecord[] } | null>(null);
  useLayoutEffect(() => {
    if (!conversationId) return undefined;
    let alive = true;
    const load = () => {
      void listChatArtifacts(conversationId).then((records) => {
        /* setState 只发生在异步回调里（effect 体里同步 setState 会被 `react-hooks/set-state-in-effect` 拦）。 */
        if (alive) setArtifactsState({ conversationId, records });
      });
    };
    load();
    /* 面板开着时新产物也要出现：`show_html` 工具每次落盘都派发一次事件
       （与 `brainstormService` 的 `subscribeBrainstorm` 同一套轻量约定）。 */
    const unsubscribe = subscribeChatArtifacts((changedId) => {
      if (changedId === conversationId) load();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [conversationId]);
  /** 只认当前会话的读数（换会话时旧读数立即失效，无需清 state）。 */
  const artifacts = artifactsState && artifactsState.conversationId === conversationId
    ? artifactsState.records
    : EMPTY_ARTIFACTS;

  const outputs: WorkspaceFile[] = useMemo(() => [
    ...(brainstormEmpty
      ? []
      : [{ path: BRAINSTORM_ARTIFACT_PATH, name: BRAINSTORM_ARTIFACT_PATH, kind: 'brainstorm' as const }]),
    ...artifacts.map((record) => ({
      path: record.artifactPath,
      name: record.artifactPath.split('/').pop() ?? record.artifactPath,
      kind: 'html' as const,
    })),
  ], [artifacts, brainstormEmpty]);

  const openOutput = (path: string) => {
    /* 官方交互页的入口是**全屏预览**（`ure` 卡的 onClick → `setHtmlPreviewTarget`），
       不是文本详情页 ⇒ `.html` 产物直接开预览（宿主在 `App.tsx` 渲染 `HtmlPreview`）。 */
    const artifact = artifacts.find((record) => record.artifactPath === path);
    if (artifact) {
      setHtmlPreviewTarget({
        artifactPath: artifact.artifactPath,
        title: artifact.title ?? artifact.artifactPath.split('/').pop() ?? artifact.artifactPath,
        description: '',
      });
      return;
    }
    setSelectedPath(path);
    setView(path === BRAINSTORM_ARTIFACT_PATH ? 'detail' : 'file');
  };

  /* 官方 `a.useLayoutEffect(()=>{w==="list"&&ee(null)},[C,w])`
     + `if(C.length===0){ee(g_);return} ... ee(max(g_, min(AV, el.scrollHeight)))`：
     空列表固定 `g_=200`；非空量列表 `scrollHeight` 并夹到 `[200, 480]`。
     ⚠️ 官方把测量结果放进 state（`J`），这里用 `ResizeObserver` 的**首次投递**代替
        「effect 体内同步量一次」——行为等价（RO 在 `observe()` 时必投递一次当前尺寸），
        且不触发 `react-hooks/set-state-in-effect`。
        量到的值带 `view` 戳，切换视图后旧值自动失效（等价官方 `[C,w]` 依赖里先 `ee(null)`）。 */
  useLayoutEffect(() => {
    if (view !== 'list' || outputs.length === 0) return undefined;
    const el = listContentRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => {
      const next = Math.max(
        ARTIFACT_PANEL_LIST_MIN_HEIGHT,
        Math.min(ARTIFACT_PANEL_LIST_MAX_HEIGHT, el.scrollHeight),
      );
      if (next > 0) setContentMeasure({ view, height: next });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [view, outputs]);

  /** 官方 `J`：空列表恒为 `g_=200`；非空用当前视图下量到的值。 */
  const listContentHeight = outputs.length === 0
    ? ARTIFACT_PANEL_LIST_MIN_HEIGHT
    : (contentMeasure && contentMeasure.view === view ? contentMeasure.height : null);

  /* 官方 `voe` 的入参：`contentType` / `content` / `loading`。
     MTV 的产物目前只有本地 `brainstorm.md`（内容就是本组件的 markdown 状态），
     其它路径没有可读内容 ⇒ 走官方「暂不支持预览」分支。 */
  const selectedFileKind = outputs.find((file) => file.path === selectedPath)?.kind;
  const selectedFileIsImage = selectedFileKind === 'image';
  const selectedFileIsMarkdown = selectedFileKind === 'markdown' || selectedFileKind === 'brainstorm';
  const selectedFileContent = selectedPath === BRAINSTORM_ARTIFACT_PATH ? markdown : '';

  /** 官方 `artifactPanel.clearContent`：删掉产物（MTV = 清空本地 brainstorm 文档并回到 list 视图）。 */
  const handleClearContent = useCallback(() => {
    setMarkdown('');
    setSelectedPath(null);
    setView('list');
    void clearBrainstormDoc(conversationId);
  }, [conversationId]);

  const commitEdit = useCallback(() => {    if (!editingId) return;
    const next = replaceBrainstormSection(markdown, editingId, draft);
    setMarkdown(next);
    setEditingId(null);
    /* 无会话（空串）⇒ 没有可信的产物 key，不写。 */
    if (conversationId) void writeBrainstormDoc(conversationId, projectId, next);
  }, [conversationId, draft, editingId, markdown, projectId]);

  /* ── 官方 `cst` 的几何（逐条对应源码变量，`c = topOffset = 0`）──
       At = H ? Math.min(380, Math.max(280, H.height - c - 24)) : 380
       Lt = H ? Math.max(280, H.height - c) : 380
       qt = (H && window) ? Math.max(280, innerHeight - H.top - c - 16) : Lt
       Jt = chatPanelOpen ? Lt : Math.max(Lt, qt)          // 高度拖拽上限
       it = view === 'list' ? 200 : At                     // 高度拖拽下限
       Vn = height != null ? Math.max(At, Math.min(Jt, height)) : At
       En = height != null ? Math.max(200, Math.min(Jt, height)) : (listContentHeight ?? 'auto')
       Et = expanded ? Jt : (view === 'list' ? En : Vn)     // 面板高度
       dn = expanded ? 520 : width                          // 面板宽度
      并且 `view === 'list' && !expanded && height == null` 时套 `maxHeight: 480`（`YN`）。
      ⚠️ 官方默认态实测（CDP，`app.tapnow.media`）：
        `position: fixed; top:0; width:320px; z-index:30; max-height:480px; height:200px`
        → 面板就是**一张很短的浮卡**（高度 = 内容高度、空列表固定 200、被 480 夹住），
          下面露出画布，官方**不是**满高。 */
  const topOffset = 0;
  const contentMaxByAnchor = anchorRect
    ? Math.min(ARTIFACT_PANEL_CONTENT_MAX_HEIGHT, Math.max(ARTIFACT_PANEL_MIN_HEIGHT, anchorRect.height - topOffset - 24))
    : ARTIFACT_PANEL_CONTENT_MAX_HEIGHT;
  const anchorFullHeight = anchorRect
    ? Math.max(ARTIFACT_PANEL_MIN_HEIGHT, anchorRect.height - topOffset)
    : ARTIFACT_PANEL_CONTENT_MAX_HEIGHT;
  const viewportBoundHeight = anchorRect && typeof window !== 'undefined'
    ? Math.max(ARTIFACT_PANEL_MIN_HEIGHT, window.innerHeight - anchorRect.top - topOffset - 16)
    : anchorFullHeight;
  const maxPanelHeight = chatPanelOpen ? anchorFullHeight : Math.max(anchorFullHeight, viewportBoundHeight);
  const minPanelHeight = view === 'list' ? ARTIFACT_PANEL_LIST_MIN_HEIGHT : contentMaxByAnchor;
  const constrainedStoredHeight = height != null
    ? Math.max(contentMaxByAnchor, Math.min(maxPanelHeight, height))
    : null;
  const listAutoHeight = height != null
    ? Math.max(ARTIFACT_PANEL_LIST_MIN_HEIGHT, Math.min(maxPanelHeight, height))
    : (listContentHeight ?? 'auto');
  const panelHeight: number | 'auto' = expanded ? maxPanelHeight : view === 'list' ? listAutoHeight : (constrainedStoredHeight ?? contentMaxByAnchor);
  const currentPanelHeight = typeof panelHeight === 'number' ? panelHeight : (listContentHeight ?? contentMaxByAnchor);
  /* 拖拽回调要读的三个值（官方 `ct` / `it` / `Be`）。写在 effect 里而不是渲染期，
     避免 `react-hooks/refs` 报「render 期访问 ref」。 */
  useEffect(() => {
    maxHeightRef.current = maxPanelHeight;
    minHeightRef.current = minPanelHeight;
    panelHeightRef.current = currentPanelHeight;
  }, [maxPanelHeight, minPanelHeight, currentPanelHeight]);
  const panelWidth = expanded ? ARTIFACT_PANEL_EXPANDED_WIDTH : width;
  const listAutoMaxHeight = view === 'list' && !expanded && height == null;
  const panelStyle: React.CSSProperties = { width: panelWidth, height: panelHeight };
  /* 官方是 `position: fixed`（悬浮在画布上、不占布局）。MTV 的容器是 `relative w-0`（零宽、
     不占 flex 行空间）⇒ 面板用 `absolute` 挂在它右缘、往左展开，并留官方那 12px 间距。 */
  panelStyle.position = 'absolute';
  panelStyle.right = 12;
  panelStyle.top = 0;
  if (listAutoMaxHeight) panelStyle.maxHeight = ARTIFACT_PANEL_LIST_MAX_HEIGHT;

  const renderListRow = (file: WorkspaceFile) => {
    const FileIcon = resolveFileIcon(file);
    return (
      <li key={file.path}>
        <button
          type="button"
          onClick={() => openOutput(file.path)}
          className="relative flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05]"
        >
          <FileIcon size={20} strokeWidth={1.5} className="shrink-0 text-white/55" />
          <span className="truncate text-sm text-white/85">{file.name}</span>
        </button>
      </li>
    );
  };

  return (
    <motion.aside
      ref={panelRef}
      aria-label="Side panel"
      className="chat-artifact-panel group relative flex shrink-0 flex-col overflow-hidden rounded-xl bg-chat-background shadow-[0_8px_30px_rgba(0,0,0,0.5)] pointer-events-auto"
      style={panelStyle}
      /* 官方 `Tt.div` 逐字（`cst`@2447080 附近）：
           initial={{opacity:0, x:O}}  animate={{opacity:1, x:0, height:Et}}
           exit={{opacity:0, x:O, transition:{duration:F, ease:E1e}}}
           transition={{opacity:{duration:D,ease:aC}, x:{duration:D,ease:aC},
                        height: Cn ? {duration:Vk,ease:aC} : {duration:0}}}
           onAnimationComplete: () => { q && Q(!1) }
         其中 `O = R ? 0 : S1e`（24）、`D = R ? .2 : .24`、`F = R ? .16 : .28`、
         `aC = [.22,1,.36,1]`、`E1e = [.7,0,.84,0]`、`Vk = .34`、`R = useReducedMotion()`；
         `Cn = q || Ke.current !== view`。 */
      initial={{ opacity: 0, x: artifactHiddenXOffset }}
      animate={{
        opacity: 1,
        x: 0,
        height: panelHeight,
        transition: {
          opacity: { duration: artifactFadeDuration, ease: ARTIFACT_ANIM_EASE },
          x: { duration: artifactFadeDuration, ease: ARTIFACT_ANIM_EASE },
          height: heightAnimPending
            ? { duration: ARTIFACT_ANIM_HEIGHT_DURATION, ease: ARTIFACT_ANIM_EASE }
            : { duration: 0 },
        },
      }}
      exit={{
        opacity: 0,
        x: artifactHiddenXOffset,
        transition: { duration: artifactExitDuration, ease: ARTIFACT_ANIM_EXIT_EASE },
      }}
      onAnimationComplete={() => {
        if (heightAnimPending) setHeightAnimPending(false);
      }}
    >
      {/* 官方收起键：仅「助手面板关闭 + list 视图」时出现，默认透明、hover 才亮。
          图标 `tz` = tabler `arrow-narrow-right`（不是 lucide）。 */}
      {!chatPanelOpen && view === 'list' && (
        <button
          type="button"
          aria-label={t('收起')}
          data-tooltip={t('收起')}
          onClick={onClose}
          className="absolute bottom-2 right-2 z-[60] flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-white/40 opacity-0 transition-opacity duration-150 hover:bg-white/[0.08] hover:text-white/70 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
        >
          <OfficialArrowNarrowRightIcon size={18} strokeWidth={1.5} />
        </button>
      )}

      {/* ==== 官方左缘宽度拖拽条（左右拖动）==== */}
      <div
        className="absolute left-0 top-0 bottom-0 z-50 flex w-3 cursor-col-resize items-center justify-center"
        onMouseDown={(event) => {
          event.preventDefault();
          collapseExpandedGeometry();
          const startWidth = expanded ? ARTIFACT_PANEL_EXPANDED_WIDTH : width;
          colGestureRef.current = { startX: event.clientX, startWidth };
          setColResizing(true);
          document.body.classList.add('cursor-col-resize', 'select-none');
        }}
        onMouseEnter={() => setColHover(true)}
        onMouseLeave={() => setColHover(false)}
      >
        <div
          className={`relative left-0.5 flex flex-col gap-[3px] transition-opacity duration-150 ${
            colResizing || colHover ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="block h-[3px] w-[3px] rounded-full bg-white/40" />
          <span className="block h-[3px] w-[3px] rounded-full bg-white/40" />
          <span className="block h-[3px] w-[3px] rounded-full bg-white/40" />
        </div>
      </div>

      {/* ==== 官方底缘高度拖拽条（上下拖动）==== */}
      <div
        className="absolute bottom-0 left-0 right-0 z-50 flex h-3 cursor-row-resize items-center justify-center"
        onMouseDown={(event) => {
          event.preventDefault();
          collapseExpandedGeometry();
          /* 官方 `$`：`Oe.current = clientY; xe.current = Be.current`（= 当前面板高度）。 */
          rowGestureRef.current = {
            startY: event.clientY,
            startHeight: panelHeightRef.current,
          };
          setRowResizing(true);
          document.body.classList.add('cursor-row-resize', 'select-none');
        }}
        onMouseEnter={() => setRowHover(true)}
        onMouseLeave={() => setRowHover(false)}
      >
        <div
          className={`relative bottom-0.5 flex gap-[3px] transition-opacity duration-150 ${
            rowResizing || rowHover ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <span className="block h-[3px] w-[3px] rounded-full bg-white/40" />
          <span className="block h-[3px] w-[3px] rounded-full bg-white/40" />
          <span className="block h-[3px] w-[3px] rounded-full bg-white/40" />
        </div>
      </div>

      {view === 'list' ? (
        /* 官方 list 分支：容器 `relative flex flex-1 flex-col overflow-hidden`（官方 `WN`） */
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {outputs.length === 0 ? (
            <div className="flex flex-1 flex-col px-4 pt-[26px]">
              <h3 className="px-2 text-sm font-medium text-white/45">{t('文件')}</h3>
              <div className="flex flex-1 items-center justify-center pb-6 text-sm text-white/40">
                {t('暂无输出')}
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
              <div ref={listContentRef} className="shrink-0">
                <div className="flex flex-1 flex-col px-4 pb-3">
                  <h3 className="sticky top-0 z-10 bg-chat-background px-2 pb-2 pt-[26px] text-sm font-medium text-white/45">
                    {t('文件')}
                  </h3>
                  <ul className="flex flex-col pt-1">
                    {outputs.map(renderListRow)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : view === 'file' ? (
        /* 官方 `file` 分支（`voe`，`page-BeI7xydN.js`@692522 附近）逐字：
             根 `flex flex-1 flex-col overflow-hidden`
             头部 `flex shrink-0 items-center gap-2 py-3 pl-3 pr-4`
               返回键 `flex items-center rounded-md p-1 text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/85`
               标题 `min-w-0 flex-1 truncate text-sm font-medium text-white/85`
             内容 `flex flex-1 flex-col overflow-auto px-4 pb-4 pt-2`
               loading   → `px-1 py-4 text-sm text-white/40`「正在加载…」
               image     → 同款类串「暂不支持预览该文件类型」
               markdown  → `canvas-text-markdown !text-[13px] …` 渲染
               其它文本  → `whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-white/80` 的 `<pre><code>`
             底部（有 addToCanvas / discuss 时）`flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2.5` */
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 py-3 pl-3 pr-4">
            <button
              type="button"
              onClick={() => { setView('list'); setSelectedPath(null); }}
              aria-label={t('返回')}
              data-tooltip={t('返回')}
              className="flex items-center rounded-md p-1 text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/85"
            >
              <OfficialChevronLeftIcon size={18} strokeWidth={1.5} />
            </button>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white/85">
              {(selectedPath ?? '').split('/').filter(Boolean).pop() ?? selectedPath ?? ''}
            </span>
          </div>
          <div className="flex flex-1 flex-col overflow-auto px-4 pb-4 pt-2">
            {selectedFileIsImage ? (
              <p className="px-1 py-4 text-sm text-white/40">{t('暂不支持预览该文件类型')}</p>
            ) : selectedFileIsMarkdown ? (
              <div className="canvas-text-markdown !text-[13px] [&_p]:!text-[13px] [&_li]:!text-[13px] [&_h1]:!text-[18px] [&_h2]:!text-[15px] [&_h3]:!text-[14px] [&_h4]:!text-[13px]">
                <ChatMarkdown value={selectedFileContent} />
              </div>
            ) : (
              <pre className="whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed text-white/80">
                <code>{selectedFileContent}</code>
              </pre>
            )}
          </div>
          {/* 官方 `voe` 底部动作行：`flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2.5`
              + 文字按钮 `bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-white/65 …` */}
          <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-2.5">
            <button
              type="button"
              onClick={() => onAddToCanvas(selectedFileContent)}
              className="flex flex-1 cursor-pointer items-center justify-center rounded-md bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white/90"
            >
              {t('添加到画布')}
            </button>
            <button
              type="button"
              onClick={() => onDiscuss(selectedFileContent)}
              className="flex flex-1 cursor-pointer items-center justify-center rounded-md bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white/90"
            >
              {t('在对话中讨论')}
            </button>
          </div>
        </div>
      ) : (
        /* 官方 markdown 产物分支 */
        <>
          <div className={`flex items-stretch justify-between gap-2 pt-4 pb-1 pl-2.5 pr-4 ${sections.length > 0 ? 'border-b border-white/[0.06]' : ''}`}>
            <div className="flex min-w-0 flex-1 items-stretch gap-2">
              <div className="flex shrink-0 items-center self-stretch">
                <button
                  type="button"
                  onClick={() => { setView('list'); setSelectedPath(null); }}
                  aria-label={t('返回')}
                  data-tooltip={t('返回')}
                  className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.12] hover:text-chat-foreground"
                >
                  <OfficialChevronLeftIcon size={18} strokeWidth={1.5} />
                </button>
              </div>
              <div className="flex h-10 min-w-0 flex-1 items-center">
                <h3 className="truncate text-sm font-medium leading-snug text-foreground/90">{BRAINSTORM_ARTIFACT_PATH}</h3>
              </div>
            </div>
            {/* 官方这里是 `rj`（`flex h-10 shrink-0 items-center gap-3`）+「更多操作」下拉（`Qae`）：
                触发键 = tabler `dots`（横排三点）16/1.5；菜单里只有一个 destructive 项「清空内容」。 */}
            <div className="flex h-10 shrink-0 items-center gap-3">
              <ArtifactMoreActionsMenu onClearContent={handleClearContent} />
            </div>
          </div>

          {sections.length > 0 && (
            /* 官方分段导航行：`border-b border-white/[0.06] px-2 py-2` + 右侧 `flex shrink-0 items-center gap-1.5` */
            <div className="border-b border-white/[0.06] px-2 py-2">
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <OverflowFade
                    className="overflow-x-auto"
                    fadeFromClassName="from-chat-background"
                    deps={[sections.length]}
                  >
                    <div className="flex items-center gap-1.5">
                      {sections.map((section) => (
                        <span key={section.id} className="shrink-0 rounded-md px-2 py-1 text-[11px] text-muted-foreground/80">
                          {section.title}
                        </span>
                      ))}
                    </div>
                  </OverflowFade>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {/* 官方 `cst` 的这颗键位**没有**「更新」入口（见 `live-侧栏-动作条-面板-输入区.md` §3 A6）：
                      调用点 @2775490/@2775502/@2776335 把 `updating` / `agentBusy` / `onUpdate` 传给了 `cst`，
                      但 `cst` 的 destructure 里**没有**这三个名字、函数体里也 0 引用（死参数）；
                      `chatAdapter.artifactPanel.{update,updating,updateBusyHint}` 在 live bundle 里同样**无调用点**。
                      ⇒ MTV 原先那颗「更新」键是**反向多做**，已按官方移除。 */}
                  <button
                    type="button"
                    onClick={() => onAddToCanvas(markdown)}
                    disabled={brainstormEmpty || agentBusy}
                    className="flex cursor-pointer items-center justify-center rounded-md bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t('添加到画布')}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDiscuss(markdown)}
                    disabled={brainstormEmpty || agentBusy}
                    className="flex cursor-pointer items-center justify-center rounded-md bg-surface-secondary px-2.5 py-1.5 text-xs font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t('在对话中讨论')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
            {brainstormEmpty ? (
              /* 官方空态（PAGE@703980）：`flex flex-1 flex-col items-center justify-center px-8 py-10 text-center`
                 + 标题 `text-[15px] font-medium text-foreground/80`
                 + 说明 `mt-2 max-w-[260px] text-[12px] leading-relaxed text-foreground/40` */
              <div className="flex flex-1 flex-col items-center justify-center px-8 py-10 text-center">
                <div className="text-[15px] font-medium text-foreground/80">{t('暂无内容')}</div>
                <div className="mt-2 max-w-[260px] text-[12px] leading-relaxed text-foreground/40">
                  {t('开始对话，内容会自动同步到这里。')}
                </div>
              </div>
            ) : sections.map((section) => (
              <div key={section.id} className="rounded-lg px-2 py-1.5 hover:bg-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/85">{section.title}</span>
                  {editingId !== section.id && (
                    <button
                      type="button"
                      aria-label={t('编辑')}
                      data-tooltip={t('编辑')}
                      onClick={() => { setEditingId(section.id); setDraft(section.body); }}
                      className="flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-surface-secondary px-2 py-1 text-[11px] font-medium text-white/65 transition-colors hover:bg-white/[0.08] hover:text-white/90"
                    >
                      {t('编辑')}
                    </button>
                  )}
                </div>
                {editingId === section.id ? (
                  <div className="mt-1.5">
                    <textarea
                      value={draft}
                      autoFocus
                      placeholder={t('编辑这部分')}
                      onChange={(event) => setDraft(event.target.value)}
                      className="min-h-[96px] w-full resize-y rounded-md border border-white/[0.08] bg-black/30 p-2 text-[12px] leading-5 text-foreground/90 outline-none"
                    />
                    <div className="mt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={commitEdit}
                        className="inline-flex h-6 items-center rounded-md bg-white px-2 text-[11px] font-semibold text-black transition-colors hover:bg-white/90"
                      >
                        {t('保存')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="inline-flex h-6 items-center rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground/90"
                      >
                        {t('取消')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-5 text-muted-foreground/85">
                    {section.body || t('暂无内容')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </motion.aside>
  );
}
