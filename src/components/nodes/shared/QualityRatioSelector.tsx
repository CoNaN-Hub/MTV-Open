/**
 * QualityRatioSelector 图像质量/比例选择器 — 弹出面板选择图像尺寸(1K/2K/4K)和宽高比
 */
import { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import AnimatedButton from '../../shared/AnimatedButton';
import { OfficialIcon } from '../../sidebar/OfficialIcon';
import { useT } from '../../../i18n';
import { aspectRatiosForModel, imageSizesForModel, qualityOptionsForModel, transparentBackgroundForModel } from '../../../utils/imageModelCapabilities';
import type { ModelKey } from '../../../utils/imageModelCapabilities';
import { isChannelDisabled } from '../../../services/models/channelParamLimits';

/** 真·比例值（`16:9` / `2.5:1` …）✓ —— 「自适应」「全景图」「Auto」**都不是** ✓
 *  触发器与格阵**共用这一条判据** ✗✓（两边各写一份必然走岔 ✗）*/
const RATIO_VALUE = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;

/** ★★★★★ 比例图标尺寸 —— **官方算法**（实测反推 ✓ 逐项吻合 ✓）
 *  官方图标 = 外层 `div 14×14`（"flex items-center justify-center flex-none"）
 *            + 内形 `div border-[1.5px] border-current rounded-[2px]` ✓ **opacity 1** ✓
 *  内形尺寸（官方实测 ✓）：取长边 14 · 短边 = round(14 × min(r, 1/r)) ✓
 *    1:1→14×14 · 2:1→14×7 · 4:3→14×11 · 3:4→11×14 · 5:4→14×11 · 4:5→11×14
 *    3:2→14×9 · 2:3→9×14 · 16:9→14×8 · 9:16→8×14 · 21:9→14×6 · 9:21→6×14 ✓ **全部吻合** ✓
 *  ⚠️ MTV 原来用写死的 class 尺寸（12×12 / 8×14 / 13×9 …）✗ —— 与官方**逐项都不同** ✓ 用户指出 ✓ */
function ratioIconSize(value: string): { width: number; height: number } {
  const m = RATIO_VALUE.exec(value.trim());
  if (!m) return { width: 14, height: 14 }; /* 「Auto」/「Auto(4K)」等非比例 → 方形 ✓ */
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!w || !h) return { width: 14, height: 14 };
  const r = w / h;
  if (r >= 1) return { width: 14, height: Math.max(2, Math.round(14 / r)) };
  return { width: Math.max(2, Math.round(14 * r)), height: 14 };
}

interface RatioOption {
  value: string;
  className: string;
}

/** ★★★★★ **官方「精细度」7 个键的中文标签** ✓（EXE i18n 原文 ✓ `uBs.gpt2.qualityOptions`）
 *    low 低 · medium 中 · high 高 · xhigh 超高 · max 极致 · hd 2K · standard 标准 ✓
 *  → 各模型给**自己的子集** ✓（gpt-image-2.5-* = 低/中/高/超高/极致 5 档 ✓ 已与官方实测吻合 ✓）*/
const QUALITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '超高',
  max: '极致',
  hd: '2K',
  standard: '标准',
};

/** ★★★★★ **官方「滑动指示块」**（EXE DOM 原文 ✓ 我此前完全没有 ✗ 用户："点击底色 / 过渡动画" ✓）
 *  官方 cls：`absolute top-0.5 bottom-0.5 bg-input/40 rounded-md transition-all duration-200 ease-out`
 *  实测：画质/精细度组 = 选中项同尺寸（97×32 / 58×32）· bg white **6%** · r10
 *        比例组    = 选中项同尺寸（左列 64×67 / 格阵 52×43）· bg white **9%**（`bg-input/60`）
 *
 *  ★★★★★ **官方【两套】几何规则** ✓✓（`zoom-slider-3ZcFvYQO.js` 的 `P2e` 原文 ✓）
 *    ```js
 *    // 量（依赖 [value, options]）：
 *    const S = d.current.querySelector(`button[data-option="${f}"]`);
 *    const _ = d.current.getBoundingClientRect(), E = S.getBoundingClientRect();
 *    p({top:E.top-_.top, left:E.left-_.left, width:E.width, height:E.height});
 *
 *    // ① flex 组（轨道 `relative flex bg-input/40 rounded-lg p-0.5`）：
 *    //    指示块 cls = "absolute top-0.5 bottom-0.5 bg-input/60 rounded-md
 *    //                 transition-all duration-200 ease-out pointer-events-none"
 *    style={{left:u.left, width:u.width}}                       // ← 只写 left/width
 *
 *    // ② 栅格组（轨道 `relative flex gap-1.5 bg-input/40 rounded-lg p-1`，左列 64×67 与格 52×43 高不同）：
 *    //    指示块 cls = "absolute bg-input/60 rounded-md transition-all duration-200 ease-out
 *    //                 pointer-events-none"                        // ← ★ 没有 top-0.5 / bottom-0.5 ✗✓
 *    style={{top:u.top, left:u.left, width:u.width, height:u.height}}   // ← 四个都写
 *    ```
 *    ⇒ **flex 组**纵向由 `top-0.5`/`bottom-0.5` 两条 inset 定死（CSS 已写 ✓，JS 只写 left/width）
 *      **栅格组**四边全由 JS 写（CSS 那条 `.img-rp-ratio-split > …` 已把 inset 去掉 ✓）
 *
 *  ⚠️ 选中项按钮必须 `position: relative + z-index`（CSS 已给 ✓），否则被它盖住 ✗（AGENTS.md 已记 ✓）
 *  ⚠️ 弹窗开合有 `scale` 动画 ✗ → 只在 mount 时量会**量到缩放中的盒**（偏小 8%）✗
 *     → rAF + 动画结束后 + resize 各量一次 ✓
 *  ⚠️⚠️ **不能量「视觉盒」** ✓✓（现场实测到的事故）：`AnimatedButton` 在 hover 时 `scale(1.04)`，
 *     而弹窗 portal 到 body 后逃出了 `prompt.css` 的 `transform:none` ✗ →
 *     `getBoundingClientRect()` 返回**放大 4%** 的盒 ✗ → 指示块被写成 1.04× 且**不会自愈**
 *     （ResizeObserver 只看布局盒，transform 不改布局 ✗）→ 稳态残差 Δ=−1,−1,+2,+2 ✓
 *     → 已在 CSS 里按官方去掉弹窗内所有 `.anim-btn` 的缩放 ✓（官方本来就没有 ✗ 见 quality-ratio.css ✓）*/
function SegmentedThumb({
  activeKey,
  hasActive = true,
  variant = 'flex',
}: {
  activeKey: string;
  hasActive?: boolean;
  /** `flex` = 画质/精细度/透明背景（官方：只写 left/width，纵向由 inset 定死 ✓）
   *  `grid` = 比例组（官方：top/left/width/height 四个都写 ✓）*/
  variant?: 'flex' | 'grid';
}) {
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const sync = useCallback(() => {
    const thumb = thumbRef.current;
    const track = thumb?.parentElement;
    if (!thumb || !track) return;
    const active = track.querySelector<HTMLElement>('.ui-schema-option.active');
    if (!active) {
      thumb.style.opacity = '0';
      return;
    }
    const t = track.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    thumb.style.opacity = '1';
    /* `left/top` 相对包含块的 padding box ✓（两个轨道都无边框 → 与 border box 同原点 ✓）
       = 官方 `left: E.left-_.left` / `top: E.top-_.top` ✓（逐字同款 ✓）*/
    thumb.style.left = `${a.left - t.left}px`;
    thumb.style.width = `${a.width}px`;
    if (variant === 'grid') {
      thumb.style.top = `${a.top - t.top}px`;
      thumb.style.height = `${a.height}px`;
    } else {
      /* ★ 官方 flex 组**只写 left/width** ✓ → 纵向（含高度）由 CSS 的 `top:2px`/`bottom:2px` 定死 ✓
         必须把可能残留的 inline top/height 清掉 ✗（否则顶部一整套旧值会盖住 inset ✗）*/
      thumb.style.top = '';
      thumb.style.height = '';
    }
  }, [variant]);
  useLayoutEffect(() => {
    const thumb = thumbRef.current;
    const track = thumb?.parentElement;
    sync();
    const raf = requestAnimationFrame(sync);
    const timer = window.setTimeout(sync, 320); /* 弹窗动画播完再量一次 ✓ */
    window.addEventListener('resize', sync);
    /* ★ 尺寸自愈 ✓：样式热更 / 字体加载 / 面板重排都可能在 mount 之后改变盒大小 ✗
         （实测踩过：比例组指示块一度比选中项**大 2px 且偏 1,1** ✗ → 加了观察器 ✓）*/
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined' && track) {
      ro = new ResizeObserver(sync);
      ro.observe(track);
      const active = track.querySelector<HTMLElement>('.ui-schema-option.active');
      if (active) ro.observe(active);
      track.querySelectorAll<HTMLElement>('.ui-schema-option').forEach((el) => ro?.observe(el));
    }
    /* ★★★★★ **轨道自身变化也要同步** ✓✓（现场抓到：指示块一度停在 `0×0` ✗）
         触发场景：「自适应」→ 档位列表**空** → 指示块不渲染 ✓；
                   切回 16:9 → 档位**回来了** → 指示块**新挂载** ✗ 此时若只靠上面那几种时机，
                   可能量到的是「还没有 active 的那一帧」→ 尺寸停在 CSS 默认的 `0×0` ✗✓
         → 观察轨道的 childList/class 变化（选项增删 + active 切换 ✓）→ 一变就同步 ✓ */
    let mo: MutationObserver | undefined;
    if (typeof MutationObserver !== 'undefined' && track) {
      mo = new MutationObserver(() => sync());
      mo.observe(track, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener('resize', sync);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [sync, activeKey]);
  /* ★ 没有选中项就**不渲染** ✓（官方「自适应」态下画质行是**空底** ✓ 没有任何指示块 ✓）
     ⚠️ 只靠 effect 里改 opacity 会漏：档位从「有」变「空」时，槽**尺寸没变** → ResizeObserver 不触发 ✗
        → 上一次量到的 97×32 指示块会**留在空槽里** ✗✓（现场抓到 ✓）
     → 用 props 决定渲染与否 ✓（React 条件渲染 ✓ 插入后同一帧内定位 ✓ 不会产生过渡动画 ✓）*/
  if (!hasActive) return null;
  return <span className="img-rp-segmented-thumb" ref={thumbRef} aria-hidden="true" />;
}

interface QualityRatioSelectorProps {
  imageSize?: string;
  aspectRatio?: string;
  onChangeImageSize?: (size: string) => void;
  onChangeAspectRatio: (ratio: string) => void;
  /** 是否显示画质选择区，默认 true */
  showImageSize?: boolean;
  /** 是否显示"自适应"选项，默认 true */
  showAdaptive?: boolean;
  /** 自定义比例选项列表，不传则使用默认 */
  ratios?: RatioOption[];
  /** 自定义画质档位，不传则使用通用档位 */
  imageSizes?: readonly string[];
  /** 弹出方向：'top'(默认，向上，适合底部工具栏) | 'bottom'(向下，适合顶部工具栏) */
  placement?: 'top' | 'bottom';
  /** ★★★ **当前模型 id** ✓✓（用来查**官方模型能力表** ✓）
   *  官方同一个弹窗在**不同模型**下项数不同 ✓（7 / 9 / 11 项 · 还可能含 "Auto" ✓ 实测过 ✓）
   *  传入后：比例列表与画质档都**按官方表**给 ✓（不传则用官方最高频的那套兜底 ✓）*/
  model?: string;
  /** ★★★★★ **自定义模型 → 官方模型的映射候选** ✓✓（用户："自定义模型 你映射官方的" ✓）
   *  自定义连接的模型 value 是 `general/provider-custom-<hash>` ✗ 里面没有官方模型名 ✗
   *  但 `GeneralModelConfig` 有 `modelId`（**上游真实模型名** ✓）与 `name`（可读名 ✓）
   *  → PromptPanel 把 `[modelId, name]` 传进来 ✓ 由 `findImageModelCapability` 依次尝试 ✓
   *  匹配不到就还是兜底 ✓（不编造 ✗）*/
  modelAliases?: Array<string | undefined | null>;
  /* ★★★★★ **「精细度」组** ✓✓（官方弹窗的**第三组** ✓ 实测 ✓ —— 不是我之前做的「联网搜索」✗）
     EXE 原文 ✓：`options.qualityOptions: ["low","medium","high"]` ✓
                 i18n `quality:"精细度"` ✓ · `qualityOptions:{low:"低", medium:"中", high:"高"}` ✓ */
  quality?: string;
  onChangeQuality?: (q: string) => void;
  qualityOptions?: readonly string[];
  showQuality?: boolean;
  /* ★★★★★ **官方第 4 组 = 「透明背景」** ✓✓（用户："每个模型的弹窗和弹窗内容是匹配的" ✓）
     EXE 证据 ✓：i18n `transparentBackground:"透明背景"` · `transparentBackgroundOn:"ON"` ·
                 `transparentBackgroundOff:"OFF"` ·
                 `transparentBackgroundTooltip:"Once enabled, describe the transparent background in the
                  prompt as well. Without it, no alpha channel is produced."` ✓
     官方实测 ✓：**无文字标题**的那一组 —— 标题行里只有一个 help 图标（tabler help 12×12 ✓）·
                 两格 **146×32** 文案 **开启 / 关闭** ✓（= 296 宽减去 pad 2×2 后两等分 ✓）
     逐模型 ✓：EXE 里只有 `gpt-image-2.5-flare` / `gpt-image-2.5-sunburst` 是 true ✓
     ⚠️ 未传 `transparentBackground` 时**不显示** ✓（值由节点数据给 ✓）*/
  transparentBackground?: boolean;
  onChangeTransparentBackground?: (on: boolean) => void;
  /** 强制显示/隐藏该组（默认按模型能力表 ✓）*/
  showTransparentBackground?: boolean;
  /* ★★★★★ **渠道限制**（不是官方能力表 ✗）—— 官方说「模型支持 4K」，
     但你接的这条渠道只收 2K（土豆免费池：`resolution=4k` / `quality=high` → 409
     `free_pool_param_mismatch`，2026-10-20 逐参数实测）。
     用户口径：**置灰，不剪掉**（菜单项保留，点不动，`title` 说明原因）。
     当前值正好落在置灰档位上 ⇒ 自动收敛到 `fallback*`（否则一按生成就 409 ✗）。*/
  disabledImageSizes?: readonly string[];
  disabledQualities?: readonly string[];
  fallbackImageSize?: string;
  fallbackQuality?: string;
  /** 置灰原因（渲染到 `title`，给用户解释）*/
  channelLimitReason?: string;
}

export default function QualityRatioSelector({
  imageSize = '1K',
  aspectRatio = '16:9',
  onChangeImageSize,
  onChangeAspectRatio,
  showImageSize = true,
  showAdaptive = true,
  ratios: customRatios,
  /* ★★★ **官方只有 3 档：1K / 2K / 4K** ✗✓（实测反推 ✓）
     官方分段控件 296 宽 − pad 2×2 = 292 → 每档 **97.33** ✓✓（实测 97 ✓）
     MTV 原来有 **4 档**（720p/1K/2K/4K ✗）→ 292÷4 = **73** ✗（实测 73 ✗✓ 完全吻合 ✓）
     → 去掉 720p ✓（官方模型能力表里是 `imageSizeOptions: ["1K","2K"] | ["1K","2K","4K"]` ✓）*/
  imageSizes = ['1K', '2K', '4K'],
  placement = 'top',
  model,
  modelAliases,
  quality = 'low',
  onChangeQuality,
  qualityOptions = [],
  showQuality = true,
  transparentBackground,
  onChangeTransparentBackground,
  showTransparentBackground,
  disabledImageSizes,
  disabledQualities,
  fallbackImageSize,
  fallbackQuality,
  channelLimitReason,
}: QualityRatioSelectorProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  /* ★★★★★ **弹窗 portal 到 body** ✓✓（= 官方 Radix Portal ✓）
     事故（用户："弹窗被什么东西裁断了，看不到上面部分" ✓）：
       实测裁剪链 ✓ → **`.prompt-panel { overflow: hidden }`** ✗✓（框 T422..620）
         而弹窗框 T277..566 ✗ → **顶部 145px 被裁掉** ✓✓
       官方用 Radix Portal ✓ → 弹窗渲染到 body ✓ → **永不裁剪** ✓
       ⚠️ `position: fixed` 也逃不掉 ✗ —— 祖先 `.ai-dialog-float` 有 transform ✗
          （fixed 会以它为包含块 ✓）→ **必须真 portal** ✓
     位置：用**触发器的实时 rect** 自己算 ✓
       弹窗**底边** = 触发器**顶边** − 8 ✓（官方实测 ✓）· 水平**居中**于触发器 ✓ */
  const popupRef = useRef<HTMLDivElement>(null);
  /* ★ 直接写 DOM 定位 ✓（不用 setState ✗ —— 那会多一次渲染 ✗ 且被 lint 规则挡 ✓）
     与 MTV 其它跟随代码（Canvas / AINodeDialog）同一个模式 ✓ */
  const measure = useCallback(() => {
    const el = ref.current;
    const pop = popupRef.current;
    if (!el || !pop) return;
    const r = el.getBoundingClientRect();
    /* 官方位置 ✓：弹窗**底边** = 触发器**顶边** − 8 ✓ · 水平**居中** ✓ */
    pop.style.left = `${r.left + r.width / 2}px`;
    pop.style.top = `${r.top - 8 - pop.offsetHeight}px`;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    /* 首帧渲染后用**真实高度**再校正一次 ✓（避免"先错位、再跳正"✓）*/
    const raf = requestAnimationFrame(measure);
    /* ★★★★★ **打开期间要**跟着触发器走** ✓✓（= 官方 Radix `autoUpdate` ✓ 我此前只量一次 ✗）
         现场事故：点比例格 → 卡片按官方 280ms 补间**改尺寸** → 底部面板逐帧位移 ✗
           而弹窗**停在原地** ✗ → 我下一次点按就**点空**（落到弹窗外）→ 弹窗被 outside-click 关掉 ✗✓
         官方：popover 锚在触发器上、逐帧跟随 ✓
         → 监听**面板的 style 变化**（AINodeDialog 每帧写 transform ✓ 同一个模式 ✓）+ resize ✓ */
    const panel = ref.current?.closest('.ai-dialog-float, .node-float-ui-visible');
    const mo = new MutationObserver(() => measure());
    if (panel) mo.observe(panel, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => measure();
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, measure]);

  // Close popup on outside click (capture phase to beat React Flow event interception)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      /* ★ portal 后弹窗**不在 ref 里** ✗ → 也要判断它 ✓ 否则点弹窗内部会立刻关闭 ✗ */
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)
        && !(popupRef.current && popupRef.current.contains(target))) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handler, true);
    }
    return () => document.removeEventListener('mousedown', handler, true);
  }, [open]);

  // Close popup on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    if (open) {
      window.addEventListener('keydown', handler);
    }
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  /* ★★★★★ **官方比例顺序（14 项 ✓ 逐项实测 ✓）** ✓✓
       官方 DOM 顺序：**自适应 | 全景图 | 1:1 | 2:1 | 4:3 | 3:4 | 5:4 | 4:5 | 3:2 | 2:3 | 16:9 | 9:16 | 21:9 | 9:21**
       （「自适应」「全景图」不在格阵里 ✗ —— 它们是**左列两个 64×67 的按钮** ✓ 组件里单独渲染 ✓）
       ⚠️ MTV 原来是 1:1 · 9:16 · 16:9 · 3:4 · 4:3 · 3:2 · 2:3 · 5:4 · 4:5 · 21:9 ✗ **顺序完全不对** ✓
          而且缺 **2:1** ✗ 和 **9:21** ✗（官方都有 ✓）—— 用户："比例的排序 都不一样" ✓✓ */
  const DEFAULT_RATIOS: RatioOption[] = [
    { value: '1:1', className: '' },
    { value: '2:1', className: '' },
    { value: '4:3', className: '' },
    { value: '3:4', className: '' },
    { value: '5:4', className: '' },
    { value: '4:5', className: '' },
    { value: '3:2', className: '' },
    { value: '2:3', className: '' },
    /* 官方顺序的尾部 ✓：… 3:2 · 2:3 · **16:9 · 9:16 · 21:9 · 9:21** ✓ */
    { value: '16:9', className: '' },
    { value: '9:16', className: '' },
    { value: '21:9', className: '' },
    { value: '9:21', className: '' },
  ];

  /* ★★★★★ **按官方模型能力表派生** ✓✓（用户："对齐官方使用的源码" ✓）
     官方 EXE 原文：每个模型有自己的 `options.aspectRatios` / `options.imageSizeOptions` ✓
       实测：同一个弹窗在不同模型下项数不同 ✓（7 / 9 / 11 项 · 含 "Auto"/"Auto(4K)" ✓）
       MTV 原来**写死 10 项** ✗ → 现在：**传入 `model` 就按官方表** ✓ 不传用默认 ✓
     来源：`src/data/official-image-models.json`（77 个模型 ✓ 从 EXE 抽出 ✓ 不发明 ✓）*/
  /** 候选名 = [我方模型 value, 上游 modelId, 可读 name] ✓（自定义模型靠后两者映射官方 ✓）*/
  const modelKey = useMemo<ModelKey>(
    () => (model ? [model, ...(modelAliases ?? [])] : modelAliases ?? null),
    [model, modelAliases],
  );

  const effectiveRatios = useMemo(() => {
    if (customRatios) return customRatios;
    if (!modelKey) return DEFAULT_RATIOS;
    const list = aspectRatiosForModel(modelKey);
    /* ★★★★★ **`auto` / `Auto` 不能出现在格阵里** ✗✓（官方实测 + 现场抓到 ✗）
         官方模型的 `aspectRatios` 列表里**带 `"auto"`** ✓（gpt-image 家族 `["auto","1:1",…]` ✓）
         但官方 UI 把它渲染成**左列的「自适应」按钮**（`auto` **就是**自适应 ✓）✗ 不是格阵里的一格 ✗
         → 我此前没过滤 ✗ → 现场会同时出现「自适应」和「auto」**两个** ✗✓ 一眼可见 ✓
       ⇒ 这里过滤掉 ✓；是否显示「自适应」按钮由 `hasAutoRatio` 决定 ✓（见下 ✓）*/
    return list
      .filter((v) => !/^auto$/i.test(v.trim()))
      .map((v) => ({ value: v, className: '' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- DEFAULT_RATIOS 是函数内常量 ✓ 无需依赖 ✓
  }, [customRatios, modelKey]);

  /** 官方「自适应」按钮是否出现 —— **由该模型的列表里有没有 `auto` 决定** ✓（不写死 ✓）
   *  （`aspectRatios:["auto",…]` → 有自适应 ✓；没有 `auto` 的模型 → 没有这一格 ✓）
   *  没有模型信息时沿用 `showAdaptive` ✓（保持旧行为 ✓）*/
  const hasAutoRatio = useMemo(() => {
    if (!modelKey) return showAdaptive;
    return showAdaptive && aspectRatiosForModel(modelKey).some((v) => /^auto$/i.test(v.trim()));
  }, [modelKey, showAdaptive]);

  const effectiveImageSizes = useMemo(() => {
    /* ★★★★★ 必须带 aspectRatio 一起算 ✓ —— 官方源码：
         `imageSizeOptions: ({aspectRatio}) => aspectRatio === "auto" ? **[]** : ["1K","2K","4K"]`
         → 选「自适应」时画质档为空 ✓（不传 aspectRatio 会永远算成非空 ✗）*/
    if (!modelKey) return imageSizes;
    return imageSizesForModel(modelKey, aspectRatio);
  }, [modelKey, imageSizes, aspectRatio]);

  /* ★★★★★ **逐模型内容匹配**（用户："每个模型的弹窗和弹窗内容是匹配的 这个不要忽略" ✓）
       官方 EXE：每个模型的 schema 决定**有哪些组、每组有哪些项** ✓
         · `qualityOptions` 为 null（如 flux-2-pro ✓）→ **没有「精细度」这一组** ✓
           （我原来写死回退 ['low','medium','high'] ✗ —— 那是我编的 ✗✓ 已删 ✓）
         · 有 `qualityOptions` → 用**该模型自己的档位**（3 档 / 5 档 / midjourney 的 standard·hd ✓）
         · `transparentBackground === true`（EXE 里只有 gpt-image-2.5-flare / sunburst ✓）→ 第 4 组「透明背景」✓*/
  const fidelityOptions = useMemo(() => {
    if (qualityOptions.length) return qualityOptions;
    return qualityOptionsForModel(modelKey) ?? [];
  }, [qualityOptions, modelKey]);

  const showTransparentBg = useMemo(
    () => (showTransparentBackground ?? false) || transparentBackgroundForModel(modelKey),
    [showTransparentBackground, modelKey],
  );

  /** 渠道没置灰的那些档位（只用于「当前值收敛」的判断，菜单仍渲染完整列表）。*/
  const channelAllowedImageSizes = useMemo(
    () => effectiveImageSizes.filter((size) => !isChannelDisabled(disabledImageSizes, size)),
    [effectiveImageSizes, disabledImageSizes],
  );
  const channelAllowedQualities = useMemo(
    () => fidelityOptions.filter((entry) => !isChannelDisabled(disabledQualities, entry)),
    [fidelityOptions, disabledQualities],
  );

  /* ★★★★★ **换模型后把不合法的值夹到该模型的合法值上** ✓✓（官方源码同款 ✓）
     官方（EXE）原文：`L && L.length>0 ? (r?.(L), s && !L.includes(s) && o?.(L[0])) : r?.([])`
       → 列表变了之后，**当前值不在列表里**就自动选**第一项** ✓（官方就是这么收敛的 ✓）
     ⚠️ MTV 原来不夹 ✗：换成 gpt-image-2.5 后画质还是上一个模型的 `512P` ✗
        → 该组**一个选项都不选中** ✗（现场实测：画质 3 按钮 · 指示块=无 ✗✓）
     ⚠️ 列表为空（自适应态 ✓）时**不夹** ✓（官方此时也留空 ✓）
     ★★★★★ **「全景图」必须豁免** ✓✓（现场实测到的缺陷 ✗ → 已修 ✓）
       官方 `P2e` 原文：`f = i?.selected ? "__panorama" : t` ✓ —— **全景图是独立的 `panoramaOption`**
         对象，**不在 `options` 数组里** ✗✓；夹值那条 `L.includes(s)` 只作用于 schema 的选项列表 ✓
       而 MTV 把「全景图」写成了 `aspectRatio` 的一个值 ✗ → 它**永远不在** `effectiveRatios` 里 ✗
         → 每点一次「全景图」都被这条夹回 `effectiveRatios[0]`（= 1:1）✗✓（现场实测：点全景图 → 选中变 1:1 ✓）
       ⇒ 只要「全景图」按钮被渲染（`hasAutoRatio` ✓ 左列同生同灭 ✓）就把它当作合法值 ✓（= 官方语义 ✓） */
  useEffect(() => {
    if (!modelKey) return;
    /* ★ 渠道置灰档位（不是「模型不支持」✗）：菜单里**留着但点不动**；
       当前值正好落在这一档上 ⇒ 收敛到该渠道能给到的最高档（`fallback*`，缺省取最后一个可用项），
       否则用户一按生成就吃服务端 409（土豆免费池 4K / 高质量）。*/
    if (imageSize && isChannelDisabled(disabledImageSizes, imageSize)) {
      const fallback = (fallbackImageSize && !isChannelDisabled(disabledImageSizes, fallbackImageSize))
        ? fallbackImageSize
        : channelAllowedImageSizes[channelAllowedImageSizes.length - 1];
      if (fallback) onChangeImageSize?.(fallback);
    } else if (effectiveImageSizes.length && imageSize && !effectiveImageSizes.includes(imageSize)) {
      onChangeImageSize?.(effectiveImageSizes[0]);
    }
    if (quality && isChannelDisabled(disabledQualities, quality)) {
      const fallback = (fallbackQuality && !isChannelDisabled(disabledQualities, fallbackQuality))
        ? fallbackQuality
        : channelAllowedQualities[channelAllowedQualities.length - 1];
      if (fallback) onChangeQuality?.(fallback);
    } else if (fidelityOptions.length && quality && !fidelityOptions.includes(quality)) {
      onChangeQuality?.(fidelityOptions[0]);
    }
    const ratioValid = effectiveRatios.some((r) => r.value === aspectRatio)
      || (aspectRatio === '自适应' && hasAutoRatio)
      || (aspectRatio === '全景图' && hasAutoRatio);
    if (effectiveRatios.length && aspectRatio && !ratioValid) {
      onChangeAspectRatio(effectiveRatios[0].value);
    }
  }, [
    modelKey, effectiveImageSizes, fidelityOptions, effectiveRatios, hasAutoRatio,
    imageSize, quality, aspectRatio, onChangeImageSize, onChangeQuality, onChangeAspectRatio,
    disabledImageSizes, disabledQualities, fallbackImageSize, fallbackQuality,
    channelAllowedImageSizes, channelAllowedQualities,
  ]);

  /* ★★★★★ **触发器标签 = 比例 (+ 画质) (+ 精细度)** ✓✓
     用户："当有精细度选项时 选择后 显示 比例框+比例+画质+精细度" ✓✓
     · **比例**   永远在 ✓（左侧图标见下 ✓）
     · **画质**   只在**该模型在当前比例下真的有档位**时加 ✓
                  —— 官方 fn 形态 `aspectRatio === "auto" ? [] : ["1K","2K","4K"]` ✓
                     所以「自适应」时档位是**空数组** ✓ → 不加 ✓
                     （与弹窗里「画质」那行**留空**是同一个事实 ✓ 不是两套规则 ✗）
     · **精细度** 只在**该模型真的有 `qualityOptions`** 时加 ✓
                  （`fidelityOptions` 就是官方表给该模型的子集 ✓ 没有该组的模型 `[]` ✓ → 不加 ✓）
     文案：精细度用**官方 7 键中文** ✓（与弹窗同一张 `QUALITY_LABELS` ✓ 不另造 ✗）*/
  const pillLabelParts = [aspectRatio];
  if (showImageSize && effectiveImageSizes.length > 0 && imageSize) {
    pillLabelParts.push(imageSize);
  }
  if (showQuality && fidelityOptions.length > 0 && quality) {
    pillLabelParts.push(t(QUALITY_LABELS[quality] ?? quality));
  }
  const pillLabel = pillLabelParts.join(' · ');

  return (
    <div className="ui-schema-renderer" data-ui-schema-model={model ?? ''} data-ui-schema-placement="resolution" ref={ref}>
      <div className="ui-schema-quality-ratio-pill" data-ui-schema-composite-field="qualityRatio">
        <AnimatedButton
          type="button"
          /* 官方 `JJ` 的展开态是 `data-[state=open]:bg-white/[0.1]`（Radix Popover 给的 data-state）
             ⇒ MTV 用 `open` 状态映射成 `is-open`（样式见 prompt.css） */
          className={`img-pill-btn ui-schema-menu-trigger${open ? ' is-open' : ''}`}
          data-ui-schema-menu-trigger="qualityRatio"
          aria-expanded={open}
          data-state={open ? 'open' : 'closed'}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          {/* ★★★★★ **触发器图标 = 选中的那个比例的「比例框」** ✓✓
              用户："在比例尺寸按钮弹窗内 选择不同比例时 按钮应该显示 相对应的比例框+比例" ✓✓
              · 真比例（`16:9` …）→ 用**弹窗格阵同一套**图标：
                  `.img-rp-icon-wrap`（外层 14×14 ✓）> `.img-rp-icon-shape`
                  （内形按 `ratioIconSize(value)` 给宽高 ✓ · 1.5px `currentColor` 边框 ✓ r2 ✓）
                ⇒ 与格阵里那一格**逐像素同构** ✓（不是另画一个 ✗）
              · 「自适应」→ 保持原样：官方 lucide **fullscreen** 图标 ✓（用户明确要求保留 ✓）
              · 其它非比例值（如全景图用的 `2:1` 其实是真比例 ✓；真出非比例值时）→ 同上保持自适应图标 ✓
              ⚠️ **不改胶囊尺寸 token** ✓✓（`.prompt-footer .img-pill-btn` 的 h36 / r12 / pad 4 8 /
                 gap 4 / 14px/500 一律不动 ✓ —— 换图标只是把 16×16 的图标盒换成 14×14 ✓
                 高 36 由 padding 吸掉 ✓ 不撑高 ✓）*/}
          {RATIO_VALUE.test(aspectRatio.trim()) ? (() => {
            const s = ratioIconSize(aspectRatio);
            return (
              <span className="img-rp-icon-wrap">
                <span className="img-rp-icon-shape" style={{ width: s.width, height: s.height }} />
              </span>
            );
          })() : (
            <OfficialIcon name="adaptive" size={16} />
          )}
          <span className="ui-schema-pill-label ui-schema-quality-ratio-label">
            {pillLabel}
          </span>
        </AnimatedButton>

        {/* ★★★★★ **弹窗经由 portal 挂到 body** ✓✓（= 官方 Radix Portal ✓ 永不裁剪 ✓）
             实测：原来挂在 `.prompt-panel`（`overflow: hidden` ✗）内 → 顶部被裁 ✗
             这里用 `position: fixed` + 触发器实时 rect 定位 ✓（弹窗底 = 触发器顶 − 8 ✓ · 水平居中 ✓）*/}
        {open && createPortal(
          <div
            ref={popupRef}
            className={`img-ratio-popup ui-schema-popup ui-schema-quality-ratio-popup${placement === 'bottom' ? ' img-ratio-popup--down' : ''}`}
            style={{ display: 'block' }}
          >
            {/* ★★★★★ **官方实测（自适应已选时 ✓ 用户点的 ✓）：「画质」组是「留空」不是「隐藏」** ✓✓
                 官方 DOM：组块 **312×74 照旧**（pad8 · gap6）· 标题「画质」照旧 ✓
                           里面是 **空的 296×36 分段器底**（`flex bg-input/40 rounded-lg p-0.5` ✓）
                           **零个按钮** ✓ · **弹窗总高 413 不变** ✓（切自适应**不跳版** ✓）
                 ⚠️ 我此前按「隐藏该组」实现 ✗ —— 那是**猜的** ✗✓ 已按实测改成留空 ✓
                 空的底由 CSS 的 `.img-rp-quality-segmented` 自己撑出 36 高 ✓（无按钮时指示块自动隐藏 ✓）*/}
            {showImageSize && (
              <div className="img-rp-quality-area" data-ui-schema-field="imageSize" data-ui-schema-type="segmented" data-ui-schema-default="2K">
                <div className="img-rp-section-label">{t('画质')}</div>
                <div className="img-rp-quality-segmented">
                  {/* ★★★★★ **自适应时这一行不是空条** ✓✓（用户截图实测 ✓ 我上次只数 `button` 漏了 ✗）
                       官方：`画质` 下方那条里显示 **图标 + 「自适应」** ✓（那个标识**不是 button** ✗✓）
                       → 档位列表为空（= 官方 fn 在 auto 时返回 `[]` ✓）时渲染这一个只读标识 ✓
                       图标 = 官方包里的 lucide **image**（原文 ✓ `m21 15-3.086-3.086…` + `circle 9 9 r2`
                         + `rect 18×18 x3 y3 rx2` ✓ 逐字抄 ✓ 不自己画 ✗）*/}
                  {effectiveImageSizes.length === 0 ? (
                    <span className="img-rp-quality-auto">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <span>{t('自适应')}</span>
                    </span>
                  ) : (
                    <>
                      <SegmentedThumb
                        activeKey={imageSize ?? ''}
                        hasActive={!!imageSize && effectiveImageSizes.includes(imageSize)}
                      />
                      {effectiveImageSizes.map((size) => {
                        const channelDisabled = isChannelDisabled(disabledImageSizes, size);
                        return (
                          <AnimatedButton
                            key={size}
                            type="button"
                            className={`img-rp-quality-item ui-schema-option ${imageSize === size ? 'active' : ''}${channelDisabled ? ' is-channel-disabled' : ''}`}
                            data-ui-schema-value={size}
                            data-ui-schema-option-label={size}
                            data-channel-disabled={channelDisabled ? 'true' : undefined}
                            disabled={channelDisabled}
                            title={channelDisabled ? channelLimitReason : undefined}
                            onClick={() => onChangeImageSize?.(size)}
                          >
                            {size}
                          </AnimatedButton>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="img-rp-ratio-area" data-ui-schema-field="aspectRatio" data-ui-schema-type="segmented" data-ui-schema-default={hasAutoRatio ? '自适应' : '16:9'}>
              <div className="img-rp-section-label">{t('比例')}</div>
              {/* ★★★★★ 官方结构：**左列两格**（自适应 64×67 + 全景图 64×67 ✓）+ **右侧格阵** ✓
                   官方 DOM 实测：自适应 @x4 y4 · **全景图 @x4 y75**（在自适应**下方** ✓）
                   官方图标 SVG **原文照抄** ✓（不猜 ✗）
                     · 自适应 = lucide **fullscreen 20×20** ✓
                     · 全景图 = tabler **view-360-number 18×18** ✓
                   官方标签：自适应 **12px**（text-xs ✓）· 全景图 **10px**（text-[10px] leading-none ✓）
                   官方按钮：64×67 · r10 · pad **8px 0** · gap **4px** · 色 #7a7a7a ✓ */}
              <div className={`img-rp-ratio-split${hasAutoRatio ? ' has-adaptive' : ''}`}>
                {/* ★ 比例组 = 官方**栅格组**（左列 64×67 与格 52×43 高不同）→ `variant="grid"`
                     ⇒ top/left/width/height **四个都由 JS 写**（官方 `P2e` 栅格分支原文 ✓）
                     ⇒ flex 组那套 `top-0.5/bottom-0.5` 会把这里拉成整轨高 ✗（CSS 已按官方去掉 ✓）*/}
                <SegmentedThumb activeKey={aspectRatio} variant="grid" />
                {hasAutoRatio && (
                  <div className="img-rp-ratio-left">
                    <AnimatedButton
                      type="button"
                      className={`img-rp-large-adaptive ui-schema-option ${aspectRatio === '自适应' ? 'active' : ''}`}
                      data-label="自适应"
                      data-ui-schema-value="自适应"
                      onClick={() => onChangeAspectRatio('自适应')}
                    >
                      {/* 官方 lucide-fullscreen（EXE DOM outerHTML 原文 ✓）*/}
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                        <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                        <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                        <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                        <rect width="10" height="8" x="7" y="8" rx="1" />
                      </svg>
                      <span className="img-rp-pano-label-12">{t('自适应')}</span>
                    </AnimatedButton>
                    {/* ★ 官方「全景图」按钮 ✓（MTV 之前**完全没有** ✗ 用户："不要胡乱搞" ✓）*/}
                    <AnimatedButton
                      type="button"
                      className={`img-rp-large-panorama ui-schema-option ${aspectRatio === '全景图' ? 'active' : ''}`}
                      data-label="全景图"
                      data-ui-schema-value="全景图"
                      onClick={() => onChangeAspectRatio('全景图')}
                    >
                      {/* 官方 tabler view-360-number（EXE DOM outerHTML 原文 ✓）*/}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 6a1 1 0 0 0 -1 -1h-2a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h2a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1h-3" />
                        <path d="M3 5h2.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-1.5h1.5a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 1 -1.5 1.5h-2.5" />
                        <path d="M17 7v4a2 2 0 1 0 4 0v-4a2 2 0 1 0 -4 0z" />
                        <path d="M3 16c0 1.657 4.03 3 9 3s9 -1.343 9 -3" />
                      </svg>
                      <span className="img-rp-pano-label-10">{t('全景图')}</span>
                    </AnimatedButton>
                  </div>
                )}
                <div className="img-rp-ratio-right">
                  {effectiveRatios.map((r) => (
                    <AnimatedButton
                      key={r.value}
                      type="button"
                      className={`img-rp-ratio-item ui-schema-option ${aspectRatio === r.value ? 'active' : ''}`}
                      data-label={r.value}
                      data-ui-schema-value={r.value}
                      onClick={() => onChangeAspectRatio(r.value)}
                    >
                      {/* ★ 官方图标结构（EXE DOM 原文 ✓）：
                           外层 `div 14×14` "flex items-center justify-center flex-none" ✓
                           内形 `div border-[1.5px] border-current rounded-[2px]` ✓ **opacity 1** ✓
                           尺寸按比例算 ✓（官方 12 项实测逐一吻合 ✓）*/}
                      {(() => {
                        const s = ratioIconSize(r.value);
                        return (
                          <span className="img-rp-icon-wrap">
                            <span
                              className="img-rp-icon-shape"
                              style={{ width: s.width, height: s.height }}
                            />
                          </span>
                        );
                      })()}
                      <span className="img-rp-ratio-label">{r.value}</span>
                    </AnimatedButton>
                  ))}
                </div>
              </div>
            </div>

            {/* ★★★★★ **第三组 = 「精细度」（官方实测 ✓ 不是我之前做的「联网搜索」✗）**
                 官方 DOM 实测（GPT Image2 模型 ✓）：
                   组标题 «**精细度**» ✓ · 内容 bg rgba(255,255,255,.06) · r12 · **pad 2px** ✓
                   三格 «**低**»«**中**»«**高**» 各 **97×32** · r10 · pad **6px 8px** ✓ · 14px/w400 ✓
                   选中 rgb(245,245,245) / 未选 rgb(122,122,122) ✓（**选中「低」** = 默认 low ✓）
                 来源：EXE `qualityOptions: ["low","medium","high"]` ✓ · i18n `quality:"精细度"` ✓
                       `qualityOptions:{low:"低", medium:"中", high:"高"}` ✓ */}
            {showQuality && fidelityOptions.length > 0 && (
              <div
                className="img-rp-quality-area"
                data-ui-schema-field="quality"
                data-ui-schema-type="segmented"
                data-ui-schema-default="low"
              >
                <div className="img-rp-section-label">{t('精细度')}</div>
                <div className="img-rp-quality-segmented img-rp-fidelity-segmented">
                  <SegmentedThumb
                    activeKey={quality ?? ''}
                    hasActive={!!quality && fidelityOptions.includes(quality)}
                  />
                  {(fidelityOptions.length ? fidelityOptions : []).map((q) => {
                    const channelDisabled = isChannelDisabled(disabledQualities, q);
                    return (
                      <AnimatedButton
                        key={q}
                        type="button"
                        className={`img-rp-quality-item img-rp-fidelity-item ui-schema-option ${quality === q ? 'active' : ''}${channelDisabled ? ' is-channel-disabled' : ''}`}
                        data-ui-schema-value={q}
                        data-ui-schema-option-label={q}
                        data-channel-disabled={channelDisabled ? 'true' : undefined}
                        disabled={channelDisabled}
                        title={channelDisabled ? channelLimitReason : undefined}
                        onClick={() => onChangeQuality?.(q)}
                      >
                        {t(QUALITY_LABELS[q] ?? q)}
                      </AnimatedButton>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ★★★★★ **官方第 4 组 = 「透明背景」** ✓✓（逐模型 ✓ 只有 2.5 系列有 ✓）
                 官方实测 ✓：标题行**没有文字**、只有一个 help 图标（12×12 · #7a7a7a ✓）
                            两格 **146×32** = 296 宽 pad2 两等分 ✓ · 文案 **开启 / 关闭** ✓
                 i18n 原文 ✓：`transparentBackground:"透明背景"` · Tooltip 原文 ✓（悬停提示 ✓）*/}
            {showTransparentBg && (
              <div
                className="img-rp-quality-area"
                data-ui-schema-field="transparentBackground"
                data-ui-schema-type="segmented"
                data-ui-schema-default="off"
              >
                <div className="img-rp-section-label">
                  <span>{t('透明背景')}</span>
                  <span
                    className="img-rp-help"
                    title={t('开启后，请在提示词中也描述透明背景。没有描述时不会输出 alpha 通道。')}
                    aria-label={t('透明背景说明')}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 17v.01" />
                      <path d="M12 13.5a1.5 1.5 0 0 1 1 -1.5a2.6 2.6 0 1 0 -3 -4" />
                      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
                    </svg>
                  </span>
                </div>
                <div className="img-rp-quality-segmented">
                  <SegmentedThumb activeKey={transparentBackground ? 'on' : 'off'} />                  <AnimatedButton
                    type="button"
                    className={`img-rp-quality-item ui-schema-option ${transparentBackground ? 'active' : ''}`}
                    data-ui-schema-value="on"
                    onClick={() => onChangeTransparentBackground?.(true)}
                  >
                    {t('开启')}
                  </AnimatedButton>
                  <AnimatedButton
                    type="button"
                    className={`img-rp-quality-item ui-schema-option ${transparentBackground ? '' : 'active'}`}
                    data-ui-schema-value="off"
                    onClick={() => onChangeTransparentBackground?.(false)}
                  >
                    {t('关闭')}
                  </AnimatedButton>
                </div>
              </div>
            )}
          </div>,
          document.body,
        )}
      </div>
    </div>
  );
}
