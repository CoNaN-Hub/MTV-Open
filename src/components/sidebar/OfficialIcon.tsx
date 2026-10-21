/**
 * OfficialIcon — TapNow 官方原版图标（用户从官方页面导出的 SVG，原样落库在 src/assets/official-icons/）
 *
 * 这些图标内部用 `currentColor` 上色、并带官方自己的 `opacity` 分组，
 * 所以必须**内联**进 DOM（不能用 <img>），这里用 Vite 的 `?raw` 导入后注入。
 * 外层 .official-icon 负责定尺寸，内层 svg 撑满。
 */
import nodeText from '../../assets/official-icons/node-text.svg?raw';
import nodeImage from '../../assets/official-icons/node-image.svg?raw';
import nodeVideo from '../../assets/official-icons/node-video.svg?raw';
import nodeAudio from '../../assets/official-icons/node-audio.svg?raw';
import node3d from '../../assets/official-icons/node-3d.svg?raw';
import timeline from '../../assets/official-icons/timeline.svg?raw';
import stage3d from '../../assets/official-icons/stage-3d.svg?raw';
import imageEditor from '../../assets/official-icons/image-editor.svg?raw';
import upload from '../../assets/official-icons/upload.svg?raw';
import search from '../../assets/official-icons/search.svg?raw';
import history from '../../assets/official-icons/history.svg?raw';
import plus from '../../assets/official-icons/plus.svg?raw';
import replace from '../../assets/official-icons/replace.svg?raw';
import handlePlus from '../../assets/official-icons/handle-plus.svg?raw';
import fullscreen from '../../assets/official-icons/fullscreen.svg?raw';
import annotate from '../../assets/official-icons/annotate.svg?raw';
import dimensions from '../../assets/official-icons/dimensions.svg?raw';
import multiAngle from '../../assets/official-icons/multi-angle.svg?raw';
import imagePlaceholder from '../../assets/official-icons/image-placeholder.svg?raw';
/* 用户 2026 提供的「对比」占位图标（圆角方框 + 横线 + 上下两个实心点 = 滑块/对比）：
   同时用于**对比卡标题行的图标**和**卡体空态占位**。 */
import comparePlaceholder from '../../assets/official-icons/compare-placeholder.svg?raw';
// 官方空白画布态「双击」胶囊里的图标（20-viewBox，含一个 #1FA2DC 蓝色元素）
import canvasDoubleclick from '../../assets/official-icons/canvas-doubleclick.svg?raw';
import imageChangeBg from '../../assets/official-icons/image-change-bg.svg?raw';
// 官方左侧竖条的 6 个图标（从 app.tapnow.ai 竖条 DOM 原样抠出）
import railPlus from '../../assets/official-icons/rail/plus.svg?raw';
import railNodeSearch from '../../assets/official-icons/rail/node-search.svg?raw';
import railAssets from '../../assets/official-icons/rail/assets.svg?raw';
import railTemplate from '../../assets/official-icons/rail/template.svg?raw';
import railComment from '../../assets/official-icons/rail/comment.svg?raw';
import railHistory from '../../assets/official-icons/rail/history.svg?raw';
/* 画布统计（MTV 2026 新增）：图标取自《画布统计 · 复刻手册》§9.1 ①（柱状图） */
import railStats from '../../assets/official-icons/rail/stats.svg?raw';
// 官方左下缩放控制（zoom-slider）的 4 组图标：默认 + hover 两态
import zoomMap from '../../assets/official-icons/zoom/map.svg?raw';
import zoomMapHover from '../../assets/official-icons/zoom/map-hover.svg?raw';
import zoomWorkflow from '../../assets/official-icons/zoom/workflow.svg?raw';
import zoomWorkflowHidden from '../../assets/official-icons/zoom/workflow-hidden.svg?raw';
import zoomGrid from '../../assets/official-icons/zoom/grid.svg?raw';
import zoomGridHover from '../../assets/official-icons/zoom/grid-hover.svg?raw';
import zoomFocus from '../../assets/official-icons/zoom/focus.svg?raw';
import zoomFocusHover from '../../assets/official-icons/zoom/focus-hover.svg?raw';
// 官方右上角导航的 7 个图标（从 app.tapnow.ai 右上角 DOM 原样抠出）
import trBalance from '../../assets/official-icons/topright/balance.svg?raw';
import trCommunity from '../../assets/official-icons/topright/community.svg?raw';
import trShare from '../../assets/official-icons/topright/share.svg?raw';
import trAvatar1 from '../../assets/official-icons/topright/avatar1.svg?raw';
import trAvatar2 from '../../assets/official-icons/topright/avatar2.svg?raw';
import trAvatar3 from '../../assets/official-icons/topright/avatar3.svg?raw';
import trAvatar4 from '../../assets/official-icons/topright/avatar4.svg?raw';
// 官方「添加节点」面板 9 行的图标（从官方面板 DOM 原样抠出，viewBox 各异 ✓）
import pickText from '../../assets/official-icons/picker/pick-text.svg?raw';
import pickImage from '../../assets/official-icons/picker/pick-image.svg?raw';
import pickVideo from '../../assets/official-icons/picker/pick-video.svg?raw';
import pickAudio from '../../assets/official-icons/picker/pick-audio.svg?raw';
import pick3d from '../../assets/official-icons/picker/pick-3d.svg?raw';
import pickTimeline from '../../assets/official-icons/picker/pick-timeline.svg?raw';
import pickStudio from '../../assets/official-icons/picker/pick-studio.svg?raw';
import pickEditor from '../../assets/official-icons/picker/pick-editor.svg?raw';
import pickCompare from '../../assets/official-icons/picker/pick-compare.svg?raw';
import pickUpload from '../../assets/official-icons/picker/pick-upload.svg?raw';
/* 画布「样机」节点图标（**用户提供**，非官方 picker 资产）——用户 2026 上传，原样落库 */
import mockup from '../../assets/official-icons/mockup.svg?raw';
// 用户提供的「提示词」图标（18×18 · 铅笔 + 星火 ✓）
import promptEdit from '../../assets/official-icons/prompt/prompt-edit.svg?raw';
import expand from '../../assets/official-icons/expand.svg?raw';
import download from '../../assets/official-icons/download.svg?raw';
// ── 用户新提供的一批（官方原版）──
import focusEdit from '../../assets/official-icons/focus-edit.svg?raw';
import referencePlus from '../../assets/official-icons/reference-plus.svg?raw';
import adaptive from '../../assets/official-icons/adaptive.svg?raw';
import send from '../../assets/official-icons/send.svg?raw';
import style from '../../assets/official-icons/style.svg?raw';
// ── 官方「图像节点工具栏」主行图标（源码级抠出：别名链 zoom-slider → use-waveform-data/index → 定义体求值）
//    裁剪 `Roe` · 重绘 `Poe` · 打光 `Doe` · ⋯ `jU` · 保存到素材库 `Wv` · 置顶 `mne`(Tabler outline/tag, 18px stroke2)
import crop from '../../assets/official-icons/crop.svg?raw';
import redraw from '../../assets/official-icons/redraw.svg?raw';
import relight from '../../assets/official-icons/relight.svg?raw';
import more from '../../assets/official-icons/more.svg?raw';
import saveToLibraryIcon from '../../assets/official-icons/save-to-library.svg?raw';
import pin from '../../assets/official-icons/pin.svg?raw';
// ── 图像卡「⋯ 浏览全部」里官方项的图标（同一套别名链解析器 `_exe-icon-svg.mjs` 抠出）──
//    擦除 `OU`→`Rm`（官方自绘 20×20 · 1 path）· 抠图 `fre`→`zdi`（官方自绘 20×20 · 1 path）
//    快速切分 `mre`→`K8n`（Tabler `grid-dots` · 9 点阵 · 24 viewBox 描边）· 增强 `LU`→`Vm`（官方自绘 20×20）
import erase from '../../assets/official-icons/erase.svg?raw';
import cutout from '../../assets/official-icons/cutout.svg?raw';
import quickSplit from '../../assets/official-icons/quick-split.svg?raw';
/* 无损改图（MTV 自有，用户提供的 SVG，原样落库） */
import lossless from '../../assets/official-icons/lossless.svg?raw';
import enhance from '../../assets/official-icons/enhance.svg?raw';
// ── 文本卡工具栏（官方 `not` @3386555）里官方项的图标 ──
//    「复制全部」用的是官方 `yU`(CopyButton) 内部那两个 16px 图标：
//      默认态 `B0`→`V0n`（Tabler `copy`）· 已复制态 `F0`→`Yf`（Tabler `check`）
import copyIcon from '../../assets/official-icons/copy.svg?raw';
import copiedIcon from '../../assets/official-icons/copied.svg?raw';
// 官方节点工具条末尾的删除键图标（`Mg` → Tabler `trash`，5 path）
import deleteIcon from '../../assets/official-icons/delete.svg?raw';
// ── 官方放大面板底部「编辑工具条」的 9 个图标（`r$` = MarkdownToolbar @486152）──
//    h1 `v1` · h2 `x1` · h3 `w1` · paragraph `Kte` · bold `x3` · italic `w3` ·
//    bulletList `Py` · orderedList `C1` · divider `C3`
import mdH1 from '../../assets/official-icons/md/md-h1.svg?raw';
import mdH2 from '../../assets/official-icons/md/md-h2.svg?raw';
import mdH3 from '../../assets/official-icons/md/md-h3.svg?raw';
import mdParagraph from '../../assets/official-icons/md/md-paragraph.svg?raw';
import mdBold from '../../assets/official-icons/md/md-bold.svg?raw';
import mdItalic from '../../assets/official-icons/md/md-italic.svg?raw';
import mdList from '../../assets/official-icons/md/md-list.svg?raw';
import mdOrderedList from '../../assets/official-icons/md/md-ordered-list.svg?raw';
import mdDivider from '../../assets/official-icons/md/md-divider.svg?raw';
// ── 官方底行「上游引用行」（`gx`）里用到的 3 个图标 ──
//    文本条目 `Si`（14 viewBox · 3 条文本线）· 音频条目 `$o`→`Xm` 默认分支 `cu`（16 viewBox · 7 条波形）
//    移除键 `Ms`→Tabler `x`（24 viewBox · stroke2）
import chipText from '../../assets/official-icons/chip-text.svg?raw';
import chipAudio from '../../assets/official-icons/chip-audio.svg?raw';
import xIcon from '../../assets/official-icons/x.svg?raw';
// ── 官方媒体查看器「历史版本列」上下翻页键（`Obe` 的 `Wte` / `lf`，Tabler chevron-up/down · 24 viewBox stroke2）
import chevronUp from '../../assets/official-icons/chevron-up.svg?raw';
import chevronDown from '../../assets/official-icons/chevron-down.svg?raw';
// ── 官方「节点搜索」(`Vxe`) 的筛选/结果图标里 MTV 尚无的两个（源码级抠出）──
//    `world` = 官方 `fi`（index-BiTZf8mJ.js 的 Tabler `box`，12 条 path）
//    `group` = 官方 `fa`（use-waveform-data 的 `Bm`，20 viewBox 双文件夹）
import nodeSearchWorld from '../../assets/official-icons/node-search/world.svg?raw';
import nodeSearchGroup from '../../assets/official-icons/node-search/group.svg?raw';
// ── 官方媒体查看器「底部操作条」的图标（`Qge` @436707）──
//    复制提示词 `Gte`→Tabler clipboard-text · 设为主图 `Zge` 里的 `Wc`→Tabler photo
//    下载 `Pd`→Tabler download · busy `Wo`→Tabler loader-2（该 build 里只有 1 条 path，已逐字抠出）
// ── 官方媒体查看器「左上返回箭头」（`u8` @585428 的 `$ne` = Tabler `arrow-left` · 24 viewBox stroke2 · 3 path）──
import actionsBack from '../../assets/official-icons/actions-back.svg?raw';
import actionsCopy from '../../assets/official-icons/actions-copy.svg?raw';
import actionsSetMain from '../../assets/official-icons/actions-set-main.svg?raw';
import actionsDownload from '../../assets/official-icons/actions-download.svg?raw';
import actionsSpinner from '../../assets/official-icons/actions-spinner.svg?raw';
/* MTV 自有「图片往返」（官方无此项）：用户给的 icons8 `adobe-photoshop`
   按 MTV 的图标语言重绘 —— 20×20 · 1.5px 单线 · `currentColor`（圆角方框 + Ps） */
import roundtrip from '../../assets/official-icons/roundtrip.svg?raw';

const RAW: Record<string, string> = {
  'node-text': nodeText,
  'node-image': nodeImage,
  'node-video': nodeVideo,
  'node-audio': nodeAudio,
  'node-3d': node3d,
  timeline,
  'stage-3d': stage3d,
  'image-editor': imageEditor,
  upload,
  search,
  history,
  plus,
  replace,
  'handle-plus': handlePlus,
  fullscreen,
  annotate,
  dimensions,
  'multi-angle': multiAngle,
  'image-placeholder': imagePlaceholder,
  'compare-placeholder': comparePlaceholder,
  'canvas-doubleclick': canvasDoubleclick,
  'image-change-bg': imageChangeBg,
  // 官方左侧竖条的 6 个图标（从 app.tapnow.ai 竖条 DOM 原样抠出）
  'rail-plus': railPlus,
  'rail-node-search': railNodeSearch,
  'rail-assets': railAssets,
  'rail-template': railTemplate,
  'rail-comment': railComment,
  'rail-history': railHistory,
  'rail-stats': railStats,
  // 官方左下缩放控制的图标（默认态 + hover 态两套）
  'zoom-map': zoomMap,
  'zoom-map-hover': zoomMapHover,
  'zoom-workflow': zoomWorkflow,
  'zoom-workflow-hidden': zoomWorkflowHidden,
  'zoom-grid': zoomGrid,
  'zoom-grid-hover': zoomGridHover,
  'zoom-focus': zoomFocus,
  'zoom-focus-hover': zoomFocusHover,
  'tr-balance': trBalance,
  'tr-community': trCommunity,
  'tr-share': trShare,
  'tr-avatar1': trAvatar1,
  'tr-avatar2': trAvatar2,
  'tr-avatar3': trAvatar3,
  'tr-avatar4': trAvatar4,
  'pick-text': pickText,
  'pick-image': pickImage,
  'pick-video': pickVideo,
  'pick-audio': pickAudio,
  'pick-3d': pick3d,
  'pick-timeline': pickTimeline,
  'pick-studio': pickStudio,
  'pick-editor': pickEditor,
  /* 画布「对比」节点（MTV 新增，非官方图标）：左矩形 + 中间虚线 + 左右箭头 */
  compare: pickCompare,
  'pick-upload': pickUpload,
  /* 画布「样机」节点（MTV 新增，**用户提供的图标**，非官方资产） */
  mockup,
  'prompt-edit': promptEdit,
  expand,
  download,
  'focus-edit': focusEdit,
  'reference-plus': referencePlus,
  adaptive,
  send,
  style,
  // 官方图像工具栏主行（源码级）
  crop,
  redraw,
  relight,
  more,
  'save-to-library': saveToLibraryIcon,
  pin,
  /* ⋯ 浏览全部里官方项的图标（源码级） */
  erase,
  cutout,
  'quick-split': quickSplit,
  lossless,
  enhance,
  /* 文本卡工具栏：官方 CopyButton 的两个状态图标（16px） */
  copy: copyIcon,
  copied: copiedIcon,
  /* 触屏工具条的删除键（官方 `Mg`） */
  delete: deleteIcon,
  /* 放大面板底部编辑工具条（官方 `r$` 的 9 个 Tabler 图标） */
  'md-h1': mdH1,
  'md-h2': mdH2,
  'md-h3': mdH3,
  'md-paragraph': mdParagraph,
  'md-bold': mdBold,
  'md-italic': mdItalic,
  'md-list': mdList,
  'md-ordered-list': mdOrderedList,
  'md-divider': mdDivider,
  /* 底行「上游引用行」的条目图标 + 移除键图标（源码级） */
  'chip-text': chipText,
  'chip-audio': chipAudio,
  x: xIcon,
  /* 媒体查看器历史列的上下翻页键（源码级：Tabler chevron-up/down） */
  'chevron-up': chevronUp,
  'chevron-down': chevronDown,
  /* 官方「节点搜索」筛选表 `Axe` 里 MTV 缺的两个图标（源码级） */
  'node-search-world': nodeSearchWorld,
  'node-search-group': nodeSearchGroup,
  /* 媒体查看器底部操作条（源码级：Tabler clipboard-text / photo / download / loader-2） */
  'actions-back': actionsBack,
  'actions-copy': actionsCopy,
  'actions-set-main': actionsSetMain,
  'actions-download': actionsDownload,
  'actions-spinner': actionsSpinner,
  /* MTV 自有：图片往返（重绘自 icons8 `adobe-photoshop`，非官方图标） */
  roundtrip,
};

export type OfficialIconName = keyof typeof RAW;

export function OfficialIcon({
  name,
  size = 14,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const raw = RAW[name];
  if (!raw) return null;
  /* ⚠️ 从官方 DOM 抠出来的图标**会带上官方上下文里的状态类** ✗，例如
       class="absolute transition-opacity duration-200 opacity-0 text-tap-text-1 group-hover:opacity-100"
     这些类一旦被注入 DOM，Tailwind 的 `opacity-0` 会**直接把图标压成透明** ✗
     （实测：激活态的小地图/网格图标完全不显示）。
     所以注入前**统一剥掉 svg 上的 class**，只保留路径本身 ✓ */
  const clean = raw.replace(/\s+class="[^"]*"/g, '');
  return (
    <span
      className={className ? `official-icon ${className}` : 'official-icon'}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
