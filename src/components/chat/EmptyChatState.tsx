/**
 * EmptyChatState —— 官方助手空状态（live 主 chunk `vendor-pkg-canvas-ChpWx5JY.js` 组件 `$rt`）1:1 移植。
 *
 * ## 官方符号 → 本文件对照（三步解析：chunk 内本地名 → import 别名 → 源 chunk 真名）
 *
 * | 官方符号 | 定义偏移（canvas chunk） | 本文件 |
 * | --- | --- | --- |
 * | `$rt` 空态根 | @2576970 | `EmptyChatState` |
 * | `Hrt` 建议容器 | @2574260 | `SuggestionList` |
 * | `Grt` 单卡 | @2570968 | `SuggestionCard` |
 * | `__` 模糊入场动效壳 | @2567334 | `Reveal` |
 * | `Jie` 分类 → 图标 | @2567697 | `CATEGORY_ICONS` |
 * | `YV` 分类图标分发 | @2567784 | `CategoryIcon` |
 * | `Brt` 卡片根类串 | @2569810 | `CARD_CLASS` |
 * | `Urt` 横排最小高 | @2569790 | `CARD_MIN_HEIGHT_ROW` |
 * | `Vrt` 鼠标跟随光晕 | @2570385 | `CARD_GLOW_CLASS` |
 * | `XV` 图标正常态配色 | @2570652 | `ICON_COLOR` |
 * | `QV` 错位参数 | @2570748 | `CARD_STAGGER` |
 * | `Rrt=460` / `Drt=32` / `Lrt=Rrt-Drt` | @2568064 | `SUGGESTION_WIDTH` / `SUGGESTION_GUTTER` / `SUGGESTION_STACK_THRESHOLD` |
 * | `Frt` 堆叠判定 | @2568091 | `isStackedByWidth` |
 * | `zrt` 换一批 16×16 自绘图标 | @2568245 | `officialIcons.OfficialRefreshSuggestionsIcon` |
 *
 * ## 图标三步解析（全部落在 `./vendor-libs-CQ5RMq_I.js`）
 *
 * canvas chunk 的 `import{… kX as KN, kY as Sue, kZ as Nue, k_ as Tue, k$ as $P, l0 as YN, l1 as Eue, …}`
 * （@3181 邻域，`from "./vendor-libs-CQ5RMq_I.js"`）⇒ 在 vendor-libs 的 `export{…}` 里反查：
 *
 * | canvas 本地名 | 导出名 | vendor-libs 本地名 | 真身 |
 * | --- | --- | --- | --- |
 * | `$P` | `k$` | `m6` | `L("sparkles")` = **lucide `Sparkles`**（`Jie` 的兜底） |
 * | `Sue` | `kY` | `sZ` | `L("lightbulb")` = **lucide `Lightbulb`**（`next_step`） |
 * | `Nue` | `kZ` | `Are` | `L("scan-search")` = **lucide `ScanSearch`**（`analyze`） |
 * | `Tue` | `k_` | `Ste` | `L("palette")` = **lucide `Palette`**（`reference`） |
 * | `KN` | `kX` | `jX` | `L("layout-grid")` = **lucide `LayoutGrid`**（`organize`） |
 * | `YN` | `l0` | `Q$` | `L("arrow-right")` = **lucide `ArrowRight`**（卡片右上箭头） |
 * | `Eue` | `l1` | `$0n` | `p("outline","masks-theater",…)` = **Tabler `masks-theater`**（`character`，非 lucide ⇒ 内联官方 path） |
 *
 * `_f`（`brainstorm`）与 `kq`（`visualize`）官方是 **`<img src>` 远程 SVG**，不是 SVG 组件，见下。
 *
 * ## ⚠️ 重要纠偏（推翻 `D:\DEEPSEEK\live-空态建议卡.md` §3 的归属）
 *
 * 该文档把 canvas **@4436806** 邻域那张卡当成「空态建议卡」，并据此列了 `Mce` / `Pce` / `Rce` / `YN` 四个待挖符号。
 * 实测：**那是教程/用例卡，不是空态建议卡** ——
 *   · 它的图标分发器是 `function Mce(e)`（@4430343），取值域是 `image|writing|character|product|inspiration`；
 *   · 它渲染 `e.title` / `e.description`，同一邻域还有 `qTt({index,useCase,onSelect})`，带 `tutorialKey` /
 *     `UTt`（用例配图 CDN URL 表）/ `skipTutorialTitle`（`WTt`）——全是教程语汇；
 *   · `Pce`（@4431x）是「教程卡入场动效」`{duration:.5, delay:.12+t*.05}`、`Rce` 是它的 `whileHover/whileTap`。
 * 空态建议卡的**真实定义在 @2570968 `Grt`**，分类取值域是 `next_step/inspiration/organize/analyze/reference`
 * （官方 `Jie`），与 `Xlt`/`Ylt` 兜底池一致。
 *
 * ## 官方与 MTV 的既有差异（记账，非本文件可解决）
 *
 * 官方 `Grt`：`description?.trim() || <><b1e query pillsOnly className="inline"/>{y1e(query) ? ` …` : null}</>`
 * —— 没有 `description` 时，官方会把 `query` 渲染成**带 mention 胶囊的富文本**（`b1e`）再拼 `y1e(query)`。
 * MTV 没有服务端建议 ⇒ 退化成直接渲染 `prompt` 纯文本。`b1e` / `y1e` 两个官方实体仍未解析
 * ⇒ **此处为已知降级**，代码里以 `suggestion.prompt` 代替，未在内联注释里假装已对齐。
 *
 * 官方 `Hrt` 另有 `isFreshSession === false` 的 **chip 云分支**（`flex-wrap-reverse` + `bottom-full` 渐变遮罩 +
 * 逐 chip `opacity/transform .25s ease-out ${i*0.06}s`）+ `Ort` 溢出判定。但官方唯一调用点 `$rt` 传的是
 * `isFreshSession: true`（`$rt` @2576970 末尾逐字：`isFreshSession:!0`）⇒ 该分支从空态入口**不可达**，
 * 属另一个调用者的形态，本文件不落地（未落地，不猜测）。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, LayoutGrid, Lightbulb, Palette, ScanSearch, Sparkles } from 'lucide-react';
import AgentMotionOrb from './AgentMotionOrb';
import { OfficialRefreshSuggestionsIcon } from './officialIcons';
import { useT, getLocale } from '../../i18n';
import { suggestionPage, type EmptyStateSuggestion, type SuggestionCategory } from './emptyStateSuggestions';

interface EmptyChatStateProps {
  /** 点击建议卡：官方把 `chip.query` 填进输入框（`onChipClick`） */
  onExample?: (text: string) => void;
  /** 官方：输入框已有内容时**整块**（问候 + 主句 + 建议）都不渲染（`hasInputContent ? null : …`） */
  hasInputContent?: boolean;
  /** 官方 `isSuggestionsVisible`：问候/主句照渲染，只收起建议容器 */
  isSuggestionsVisible?: boolean;
}

/* ─────────────────────────── 官方常量（逐字） ─────────────────────────── */

/** 官方 `Brt`（@2569810）—— 卡片根类串**逐字**。
 *
 *  ⚠️ MTV 曾以「官方 `Qce` 里没有这些」为由删掉 `shadow-*`/`transition-*`/`hover:*`。
 *  但 live 现行 chunk 的 `Brt` **确实带**它们：外投影 + 内侧顶部高光 + 内侧 1px 白描边，
 *  hover 时抬高投影并把 `border/background-color/box-shadow/transform` 一起过渡 ——
 *  **这正是用户指出的「质感 / hover 不对」的根因**，已按 `Brt` 逐字恢复。 */
const CARD_CLASS =
  'group/card relative flex min-w-0 cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-[16px] border border-white/[0.05] bg-chat-bubble-header py-4 pl-3 pr-9 text-left shadow-[0_16px_40px_rgba(0,0,0,0.20),0_0_28px_rgba(255,255,255,0.02),inset_0_1px_0_rgba(255,255,255,0.05)] transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out motion-reduce:transition-none hover:border-white/[0.18] hover:bg-surface-secondary hover:shadow-[0_20px_48px_rgba(0,0,0,0.28),0_0_36px_rgba(255,255,255,0.04),inset_0_1px_0_rgba(255,255,255,0.09)]';

/** 官方 `Urt`（@2569790）—— 横排（非堆叠）卡片的最小高。 */
const CARD_MIN_HEIGHT_ROW = 'min-h-[140px]';

/** 官方 `Vrt`（@2570385）—— 鼠标跟随光晕层（`--mouse-x/--mouse-y` 由 pointer 事件写入）。 */
const CARD_GLOW_CLASS =
  'pointer-events-none absolute inset-0 opacity-0 blur-xl transition-opacity duration-700 group-hover/card:opacity-70 bg-[radial-gradient(circle_220px_at_var(--mouse-x,50%)_var(--mouse-y,50%),rgba(178,239,255,0.07)_0%,rgba(213,241,255,0.025)_55%,transparent_85%)]';

/** 官方 `XV`（@2570652）—— 图标正常态配色；禁用态官方是行内三元给的另一串。 */
const ICON_COLOR = 'flex items-center text-white/60 transition-colors duration-200 group-hover/card:text-white';
const ICON_COLOR_DISABLED = 'flex items-center text-white/35';

/** 官方 `QV`（@2570748）—— 两张卡的错位参数（横排跨列 / 竖排堆叠两套）。 */
const CARD_STAGGER = [
  { rotate: -2.25, txRow: 'clamp(0px, 0.8%, 4px)', txStack: 'clamp(-6px, -0.4%, 1px)', marginTopStack: 0, zIndex: 20 },
  { rotate: 1.75, txRow: 'clamp(-4px, -0.8%, 0px)', txStack: 'clamp(-4px, -0.6%, -1px)', marginTopStack: -2, zIndex: 10 },
];

/** 官方 `Rrt` / `Drt` / `Lrt = Rrt - Drt`（@2568064）。 */
const SUGGESTION_WIDTH = 460;
const SUGGESTION_GUTTER = 32;
const SUGGESTION_STACK_THRESHOLD = SUGGESTION_WIDTH - SUGGESTION_GUTTER; /* = 428 */

/** 官方 `Frt(e)`（@2568091）：`e < Lrt`（新会话的堆叠判定）。
 *  360px 侧栏 ⇒ 428 以下 ⇒ `flex-col`；宽面板 ⇒ `flex-row`（两列）。 */
function isStackedByWidth(clientWidth: number): boolean {
  return clientWidth < SUGGESTION_STACK_THRESHOLD;
}

/* ─────────────────────────── 分类图标（官方 `Jie` / `YV`） ─────────────────────────── */

/** 官方 `_f`（canvas @20420 邻域）：`brainstorm` 分类图标 —— 官方是 **`<img>` 远程 SVG**，不是 SVG 组件。
 *  资源 URL 逐字取自官方 `zge`（@20420）。 */
const BRAINSTORM_ICON_SRC =
  'https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5/assets/brainstorm-icon-DOBrugdc.svg';
/** 官方 `kq`（canvas @98803 邻域）：`visualize` 分类图标，URL 逐字取自官方 `Cbe`（@98803）。 */
const VISUALIZE_ICON_SRC =
  'https://fe-assets.tapnow.media/0a8da41c37db9507b96c3dc55fb843278f7127e5/assets/visualize-icon-Bw9rqZKG.svg';

/** 官方 `_f` / `kq` 的逐字渲染：`<img alt="" aria-hidden draggable={false}
 *  className="shrink-0 rounded-[22%] object-cover <className>" style={{width:size, height:size}}/>`。 */
function RemoteCategoryIcon({ src, size = 24, className }: { src: string; size?: number; className?: string }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={['shrink-0 rounded-[22%] object-cover', className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    />
  );
}

/** 官方 `Eue`（vendor-libs `$0n` @2586105）= Tabler **`masks-theater`**（outline），path 数据 = `Wli`（@2585512）。
 *
 *  官方工厂 `p(prefix, name, pascalName, paths)`（vendor-libs @1529977）逐字：
 *   `class = ['tabler-icon', 'tabler-icon-' + name, className].join(' ')`，
 *   `{...{xmlns,width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"}}`
 *   之后覆盖 `width/height = size`、`strokeWidth = stroke`、`stroke = color`。
 *
 *  官方 `Jie.character = Prt = ({size, strokeWidth, className}) => <Eue size stroke={strokeWidth} className/>`
 *  —— 适配器**只透传这三个属性**（`aria-hidden` 被丢弃，官方怪点照抄）。 */
function OfficialMasksTheaterIcon({
  size = 24,
  strokeWidth = 2,
  className,
}: {
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={['tabler-icon', 'tabler-icon-masks-theater', className].filter(Boolean).join(' ')}
    >
      <path d="M13.192 9h6.616a2 2 0 0 1 1.992 2.183l-.567 6.182a4 4 0 0 1 -3.983 3.635h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183z" />
      <path d="M15 13h.01" />
      <path d="M18 13h.01" />
      <path d="M15 16.5c1 .667 2 .667 3 0" />
      <path d="M8.632 15.982a4.037 4.037 0 0 1 -.382 .018h-1.5a4 4 0 0 1 -3.983 -3.635l-.567 -6.182a2 2 0 0 1 1.992 -2.183h6.616a2 2 0 0 1 2 2" />
      <path d="M6 8h.01" />
      <path d="M9 8h.01" />
      <path d="M6 12c.764 -.51 1.528 -.63 2.291 -.36" />
    </svg>
  );
}

/** 官方 `Jie`（@2567697）—— 分类 → 图标组件，**键与顺序逐字**。
 *  兜底 `?? $P`（lucide `Sparkles`）在 `CategoryIcon` 里做（官方 `Jie[e]??$P`）。 */
const CATEGORY_ICONS: Record<string, (props: { size?: number; strokeWidth?: number; className?: string }) => ReactNode> = {
  inspiration: Sparkles,
  character: OfficialMasksTheaterIcon,
  reference: Palette,
  analyze: ScanSearch,
  next_step: Lightbulb,
  organize: LayoutGrid,
};

/** 官方 `YV`（@2567784）—— 分类图标分发器（逐字分支：2 个前置 + `Jie` 查表 + `$P` 兜底）。 */
function CategoryIcon({ category }: { category: SuggestionCategory }) {
  if (category === 'brainstorm') return <RemoteCategoryIcon src={BRAINSTORM_ICON_SRC} size={16} className="size-4 shrink-0" />;
  if (category === 'visualize') return <RemoteCategoryIcon src={VISUALIZE_ICON_SRC} size={16} className="size-4 shrink-0" />;
  const IconComponent = CATEGORY_ICONS[category] ?? Sparkles;
  return <IconComponent size={16} strokeWidth={1.6} className="size-4 shrink-0" aria-hidden="true" />;
}

/* ─────────────────────────── 官方 `__`：模糊入场动效壳 ─────────────────────────── */

/** 官方 `__`（@2567334）—— 卡片**标题/说明**的入场壳：
 *  减弱动效时退化成纯 `div`（无 animation）；否则 `blur(4px)→blur(0)` + `y:4→0`，
 *  `.6s` `ease [.25,.1,.25,1]`，`delay` 由调用方按卡序给出。
 *
 *  这就是用户指出的「**尺寸切换缺动画**」的落点：MTV 之前完全没有这层，卡片是硬切出现的；
 *  官方每张卡的标题/说明各带一条 **80ms 步进**的错峰入场（标题 `i*80ms`，说明 `i*80+150ms`），
 *  点「换一批」时卡片 key 变化 ⇒ 重新挂载 ⇒ 动画重放。 */
const Reveal = memo(function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <div className={className}>{children}</div>;
  return (
    <motion.div
      initial={{ filter: 'blur(4px)', opacity: 0, y: 4 }}
      animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
});

/* ─────────────────────────── 官方 `Grt`：单张建议卡 ─────────────────────────── */

const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  index,
  isStacked,
  disabled = false,
  onSelect,
}: {
  suggestion: EmptyStateSuggestion;
  index: number;
  /** 官方 `isStacked`：面板窄（`clientWidth < 428`）时卡片竖排、占满整宽。 */
  isStacked: boolean;
  disabled?: boolean;
  onSelect: (suggestion: EmptyStateSuggestion) => void;
}) {
  const stagger = CARD_STAGGER[index] ?? CARD_STAGGER[0];
  /* 官方：`u = index*80/1000`（标题延迟）、`p = (index*80+150)/1000`（说明延迟）。 */
  const titleDelay = (index * 80) / 1000;
  const bodyDelay = (index * 80 + 150) / 1000;
  const [hovered, setHovered] = useState(false);

  const translateX = isStacked ? stagger.txStack : stagger.txRow;
  const marginTop = isStacked ? stagger.marginTopStack : 0;
  const transform = `translateX(${translateX}) translateY(${hovered ? -3 : 0}px) rotate(${stagger.rotate}deg) scale(${hovered ? 1.012 : 1})`;

  /* 官方 `b(node, x, y)`：把指针位置写进 `--mouse-x/--mouse-y`（光晕层读它）。 */
  const trackPointer = useCallback((node: HTMLButtonElement, clientX: number, clientY: number) => {
    const rect = node.getBoundingClientRect();
    node.style.setProperty('--mouse-x', `${clientX - rect.left}px`);
    node.style.setProperty('--mouse-y', `${clientY - rect.top}px`);
  }, []);
  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => trackPointer(event.currentTarget, event.clientX, event.clientY),
    [trackPointer],
  );
  const handleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setHovered(true);
      trackPointer(event.currentTarget, event.clientX, event.clientY);
    },
    [trackPointer],
  );
  /* 官方 `w`：移出时除了取消 hover，还要**清掉**两个自定义属性（官方逐字行为）。 */
  const handleMouseLeave = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setHovered(false);
    event.currentTarget.style.removeProperty('--mouse-x');
    event.currentTarget.style.removeProperty('--mouse-y');
  }, []);
  const handleFocus = useCallback(() => setHovered(true), []);
  const handleBlur = useCallback(() => setHovered(false), []);

  /* 官方 `c = description?.trim()`、`d = c || <b1e/>+y1e(...)`：MTV 无服务端 ⇒ 退化成 `prompt`（见文件头记账）。 */
  const body = suggestion.description?.trim() || suggestion.prompt;

  const iconSlotClass = `shrink-0 ${disabled ? ICON_COLOR_DISABLED : ICON_COLOR}`;
  const titleClass = [
    'min-w-0',
    isStacked ? 'flex-1' : '',
    'line-clamp-2 text-sm font-medium leading-5 transition-colors duration-200',
    disabled ? 'text-white/45' : 'text-white/90 group-hover/card:text-white',
  ]
    .filter(Boolean)
    .join(' ');
  const bodyClass = [
    isStacked ? 'relative z-[1]' : '',
    'min-w-0 line-clamp-2 overflow-hidden break-words text-xs font-normal leading-4 transition-colors duration-200',
    disabled ? 'text-white/30' : 'text-white/45 group-hover/card:text-white/60',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(suggestion)}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{ marginTop: `${marginTop}px`, transform, zIndex: hovered ? stagger.zIndex + 8 : stagger.zIndex }}
      className={`${CARD_CLASS} ${
        isStacked ? 'w-full min-h-[108px]' : `${CARD_MIN_HEIGHT_ROW} flex-1 basis-0`
      } disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {disabled ? null : <span aria-hidden="true" className={CARD_GLOW_CLASS} />}
      <ArrowRight
        size={16}
        strokeWidth={1.6}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-5 z-[1] shrink-0 text-white/25 transition-[color,transform] duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-white/55"
      />
      {isStacked ? (
        <>
          <span className="relative z-[1] flex min-w-0 items-center gap-2">
            <span className={iconSlotClass}>
              <CategoryIcon category={suggestion.iconCategory} />
            </span>
            <Reveal delay={titleDelay} className={titleClass}>
              {suggestion.title}
            </Reveal>
          </span>
          <Reveal delay={bodyDelay} className={bodyClass}>
            {body}
          </Reveal>
        </>
      ) : (
        <>
          <span className="relative z-[1] flex min-w-0 items-center gap-2">
            <span className={iconSlotClass}>
              <CategoryIcon category={suggestion.iconCategory} />
            </span>
            {suggestion.suggestionType ? (
              <span
                className={`min-w-0 truncate text-[13px] font-semibold leading-5 transition-colors duration-200 ${
                  disabled ? 'text-white/30' : 'text-white/40 group-hover/card:text-white/65'
                }`}
              >
                {suggestion.suggestionType}
              </span>
            ) : null}
          </span>
          <span className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden">
            <Reveal delay={titleDelay} className={titleClass}>
              {suggestion.title}
            </Reveal>
            <Reveal delay={bodyDelay} className={bodyClass}>
              {body}
            </Reveal>
          </span>
        </>
      )}
    </button>
  );
});

/* ─────────────────────────── 官方 `Hrt`：建议容器 ─────────────────────────── */

const SuggestionList = memo(function SuggestionList({
  suggestions,
  onChipClick,
  onRefresh,
  disabled = false,
}: {
  suggestions: EmptyStateSuggestion[];
  onChipClick: (suggestion: EmptyStateSuggestion) => void;
  onRefresh?: () => void;
  disabled?: boolean;
}) {
  /** 官方 `l`：外层 `pb-5` 容器，堆叠判定量的是**它**的 `clientWidth`。 */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isStacked, setIsStacked] = useState(false);

  /** 官方 `f`：卡片 key 前缀 = 全部 id 拼接 —— 点「换一批」换池时 key 变化 ⇒ 卡片重挂载 ⇒ 入场动画重放。 */
  const idsKey = useMemo(() => suggestions.map((suggestion) => suggestion.id).join(','), [suggestions]);

  /* 官方 `Hrt` 用 `new ResizeObserver(h)` 观察 `l.current`；这里**额外**挂一个 `window.resize` 兜底
     —— 实测（CDP 真浏览器，`_r31_*` 探针）某些情形下 `ResizeObserver` 的投递会被浏览器抑制
     （例如标签页被遮挡时 `visibilityState === 'hidden'`），而**只靠** observer 会让 `isStacked`
     停在初始 `false` ⇒ 窄面板仍然两列、卡片高度也不变。`window.resize` 是同步事件、代价极低。 */
  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      setIsStacked(isStackedByWidth(containerRef.current.clientWidth));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (observer && containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
    /* ⚠️ 依赖用 `idsKey`（稳定字符串）而不是 `suggestions`（父组件每次渲染都会新建数组）
       —— 否则每次渲染都会 disconnect + 重建 observer。 */
  }, [idsKey]);

  return (
    <div ref={containerRef} className="pb-5">
      <div className={`flex min-w-0 gap-3 ${isStacked ? 'flex-col' : 'flex-row'}`}>
        {suggestions.slice(0, 2).map((suggestion, index) => (
          <SuggestionCard
            key={`${idsKey}-${suggestion.id}`}
            suggestion={suggestion}
            index={index}
            isStacked={isStacked}
            disabled={disabled}
            onSelect={onChipClick}
          />
        ))}
      </div>
      {onRefresh ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={disabled}
            onClick={onRefresh}
            className="flex size-4 shrink-0 cursor-pointer items-center justify-center text-white/45 transition hover:text-white focus-visible:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-white/45"
            /* 官方此处 `aria-label` 是**硬编码英文**（无 i18n、也无 `data-tooltip`）⇒ 逐字照抄。 */
            aria-label="Refresh suggestions"
          >
            <OfficialRefreshSuggestionsIcon />
          </button>
        </div>
      ) : null}
    </div>
  );
});

/* ─────────────────────────── 官方 `$rt`：空态根 ─────────────────────────── */

export default function EmptyChatState({
  onExample,
  hasInputContent = false,
  isSuggestionsVisible = true,
}: EmptyChatStateProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(0);
  /** 官方 `[h,g]=useState(96)` + `g(Math.round(clientHeight*0.38))`，由 ResizeObserver 重算。 */
  const [offset, setOffset] = useState(96);
  const containerRef = useRef<HTMLDivElement | null>(null);

  /** `suggestionPage` 每次都返回**新数组** ⇒ 用 `useMemo` 稳住引用，避免下游每次渲染都重建。 */
  const locale = getLocale();
  const suggestions = useMemo(() => suggestionPage(locale, 2, page), [locale, page]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const measure = () => setOffset(Math.round(node.clientHeight * 0.38));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* 官方 `tde`：`initial={false}`；减弱动效 ⇒ `{opacity, y:0}`，否则未揭示时 `y = 容器高×0.38`，
     `.55s` `ease [.22,1,.36,1]`。官方 `revealed` 由面板在「中部可以显示」时置真；
     本仓 `EmptyChatState` 只在无消息时挂载 ⇒ 挂载后下一帧置真 = 官方那次「从下方 38% 浮上来 + 淡入」。 */
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRevealed(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const handleSelect = useCallback(
    (suggestion: EmptyStateSuggestion) => {
      onExample?.(suggestion.prompt);
    },
    [onExample],
  );
  const handleRefresh = useCallback(() => setPage((current) => current + 1), []);

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 select-none flex-col overflow-hidden px-4">
      <motion.div
        initial={false}
        animate={
          reduceMotion
            ? { opacity: revealed ? 1 : 0, y: 0 }
            : revealed
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: offset }
        }
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="my-auto flex w-full flex-col py-4"
      >
        {hasInputContent ? null : (
          <>
            <div className="mb-3 flex items-center gap-1.5">
              <AgentMotionOrb className="shrink-0" chrome="plain" proximityActive={false} orbSize="medium" />
              {/* 官方 `chatAdapter.welcome.greeting`（默认账号 New Tapper） */}
              <h2 className="m-0 text-2xl font-light text-text-text-secondary">
                {t('Hi {username}!', { username: 'New Tapper' })}
              </h2>
            </div>
            {/* 官方 `chatAdapter.welcome.question` */}
            <p className="mb-5 whitespace-pre-wrap break-words text-[28px] font-normal leading-8 text-text-text-primary">
              {t('今天一起创作点什么？')}
            </p>
          </>
        )}
        {!hasInputContent && isSuggestionsVisible ? (
          <SuggestionList
            suggestions={suggestions}
            onChipClick={handleSelect}
            /* 官方刷新键在无回调时**整块不渲染**（`o ? <div…> : null`）；
               MTV 的池是本地池，「换一批」始终可用 ⇒ 只在 `onExample` 缺失（只读态）时收起。 */
            onRefresh={onExample ? handleRefresh : undefined}
            disabled={!onExample}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
