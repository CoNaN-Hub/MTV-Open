/**
 * TransferCenter —— 官方「文件传输中心」面板（`index-*.js` @12181143 的 `HTl`）逐字对照
 *
 *   <section aria-label="文件传输中心"
 *     class="fixed bottom-3.5 left-1/2 z-1000 w-fit min-w-[min(300px,calc(100vw-24px))] max-w-[calc(100vw-24px)]
 *            -translate-x-1/2 overflow-hidden rounded-2xl bg-neutral-800/90
 *            shadow-[0_4px_16px_rgba(0,0,0,0.16)] ring-1 ring-white/10 backdrop-blur-2xl">
 *     ├ 头部 `flex h-[42px] px-4`
 *     │   ├ 展开/收起钮（`aria-expanded`，整行可点）：状态图标 16px + 文案（14/500/20 text-neutral-100）
 *     │   │   + 上下箭头 17px（官方 `hm`/`Tw` 两枚图标按展开态交叉淡入淡出）
 *     │   └ 关闭钮 `w-6` + X 16px（`aria-label="关闭传输面板"`）
 *     └ 列表（`aria-controls="transfer-center-list"`，`grid-rows-[1fr]/[0fr]` 高度过渡）
 *         └ `max-h-[118px] overflow-y-auto px-4 pb-3`，滚动到底时底部 `mask-image` 渐隐
 *             行：`flex h-7 min-w-0 items-center gap-2 text-sm font-normal leading-5`
 *               · 缩略图/类型图标 16px（`text-neutral-400`）
 *               · 名称 `flex-1 truncate text-neutral-100`（title = 名称 [+ 错误]）
 *               · running 且已知总大小时 = 18px 环形进度 + `{{pct}}%`（`tabular-nums`）
 *                 否则 = 状态文案（`$Tl` 决定颜色：失败红 / 等待·取消灰 / 其余浅灰）
 *
 * 官方行为：`FTl(items)` 全部 completed 后 `RTl = 10s` 自动 `close()`（只收起，不清行）。
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import {
  TransferArchiveIcon,
  TransferAudioIcon,
  TransferCanceledIcon,
  TransferChevronIcon,
  TransferCloseIcon,
  TransferDoneIcon,
  TransferDownloadIcon,
  TransferFailedIcon,
  TransferSpinnerIcon,
  TransferUploadIcon,
} from './transferIcons';
import {
  clampTransferPercentage,
  isTransferBatchCompleted,
  shouldShowTransferProgress,
  transferHeaderText,
  transferOverallState,
  transferStatusClass,
  transferStatusText,
  type TransferItem,
} from '../../store/store.transfer';

/** 官方 `RTl = 1e4`：全部完成后 10s 自动收起 */
const AUTO_CLOSE_DELAY = 10_000;
/** 官方 `D9t` */
const LIST_ID = 'transfer-center-list';
/** 官方 `R9t`：滚动到底部时的渐隐遮罩 */
const BOTTOM_MASK = 'linear-gradient(to bottom, black calc(100% - 24px), transparent 100%)';

/** 官方 `jTl`：18px 环形进度（track white/15 + 进度 neutral-200） */
function TransferProgressRing({ item, label }: { item: TransferItem; label: string }) {
  const percent = clampTransferPercentage(item.percentage);
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className="size-[18px] shrink-0"
      viewBox="0 0 18 18"
    >
      <circle className="text-white/15" cx="9" cy="9" r={radius} fill="none" stroke="currentColor" strokeWidth="2" />
      <circle
        className="text-neutral-200 transition-[stroke-dashoffset] duration-200 ease-out motion-reduce:transition-none"
        cx="9"
        cy="9"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - percent / 100)}
        strokeLinecap="round"
        strokeWidth="2"
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

/** 官方 `zTl`：头部左侧的状态图标（Tabler loader-2 / circle-x / 本地取消 / Tabler check） */
function TransferStateIcon({ state }: { state: ReturnType<typeof transferOverallState> }) {
  if (state === 'active') {
    return <TransferSpinnerIcon className="animate-spin text-neutral-400 motion-reduce:animate-[spin_2s_linear_infinite]" />;
  }
  if (state === 'failed') {
    return <TransferFailedIcon className="text-red-300" />;
  }
  if (state === 'canceled') {
    return <TransferCanceledIcon className="text-neutral-400" />;
  }
  return <TransferDoneIcon className="text-neutral-300" />;
}

/**
 * 官方 `bTl`：行首缩略图/图标
 *   有 thumbnail → `<img class="size-full object-cover">`（外面是 16px 的 `size-4` 槽）
 *   否则 = `HNe`：download 类型 → Tabler `outline/download`；其余 → Lucide `cloud-upload`
 *   （archive / audio 这两种在 MTV 里也用官方那两枚自定义矢量）
 */
function TransferRowThumb({ item }: { item: TransferItem }) {
  if (item.thumbnail) return <img src={item.thumbnail} alt="" className="size-full object-cover" draggable={false} />;
  if (item.kind === 'archive') return <TransferArchiveIcon />;
  if (item.kind === 'audio') return <TransferAudioIcon />;
  return item.type === 'download' ? <TransferDownloadIcon /> : <TransferUploadIcon />;
}

/**
 * 面板本体 —— **只在面板打开时挂载**（关闭即卸载），
 * 于是「每次打开都展开」= 官方 `useEffect(() => { isOpen && setExpanded(true) }, [isOpen])` 的等价实现，
 * 且不需要在 effect 里 setState。
 */
function TransferPanelSurface({ items, headerText, overallState, closePanel }: {
  items: TransferItem[];
  headerText: string;
  overallState: ReturnType<typeof transferOverallState>;
  closePanel: () => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  /** 官方 `f`：列表滚到底时底部渐隐 —— 直接改 DOM 样式（不进 React 状态） */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const sync = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (atBottom) {
        el.style.maskImage = 'none';
        el.style.setProperty('-webkit-mask-image', 'none');
      } else {
        el.style.maskImage = BOTTOM_MASK;
        el.style.setProperty('-webkit-mask-image', BOTTOM_MASK);
      }
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    return () => el.removeEventListener('scroll', sync);
  }, [expanded, items.length]);

  return (
    <section
      aria-label={t('文件传输中心')}
      style={{ fontFamily: 'Inter, sans-serif' }}   /* 官方 `--font-sans:Inter,sans-serif`（MTV 现已打包真 Inter 400/600，与官方 web 一致） */
      className="fixed bottom-3.5 left-1/2 z-[1000] w-fit min-w-[min(300px,calc(100vw-24px))] max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-hidden rounded-[16px] bg-neutral-800/90 shadow-[0_4px_16px_rgba(0,0,0,0.16)] ring-1 ring-white/10 backdrop-blur-2xl"
    >
      <div className="flex h-[42px] px-4">
        <button
          type="button"
          aria-controls={LIST_ID}
          aria-expanded={expanded}
          aria-label={expanded ? '收起' : '展开'}
          data-tooltip={expanded ? '收起' : '展开'}
          className="group flex min-w-0 flex-auto cursor-pointer items-center text-left focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/40"
          onClick={() => setExpanded((value) => !value)}
        >
          <span aria-hidden="true" className="mr-2 flex size-4 shrink-0 items-center justify-center">
            <TransferStateIcon state={overallState} />
          </span>
          <span className="min-w-0 flex-auto truncate text-sm font-medium leading-5 text-neutral-100" title={headerText}>
            {headerText}
          </span>
          <span className="relative mr-1 size-[17px] shrink-0 text-neutral-400 transition-colors duration-150 group-hover:text-neutral-100">
            {/* 官方 `hm` = Lucide **chevron-down**（展开态可见）/ `Tw` = chevron-up（收起态可见），交叉淡入 */}
            <TransferChevronIcon className={`absolute inset-0 size-[17px] transition-opacity duration-150 motion-reduce:transition-none ${expanded ? 'opacity-100' : 'opacity-0'}`} />
            <TransferChevronIcon up className={`absolute inset-0 size-[17px] transition-opacity duration-150 motion-reduce:transition-none ${expanded ? 'opacity-0' : 'opacity-100'}`} />
          </span>
        </button>
        <button
          type="button"
          aria-label={t('关闭传输面板')}
          data-tooltip={t('关闭传输面板')}
          className="flex w-6 shrink-0 cursor-pointer items-center justify-end text-neutral-400 transition-colors hover:text-white focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/40"
          onClick={closePanel}
        >
          <TransferCloseIcon className="size-4" />
        </button>
      </div>

      <div
        id={LIST_ID}
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={listRef}
            className="max-h-[118px] overflow-y-auto overscroll-contain px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const statusText = transferStatusText(item, t);
                return (
                  <div key={item.id} className="flex h-7 min-w-0 items-center gap-2 text-sm font-normal leading-5">
                    <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center overflow-hidden text-neutral-400">
                      <TransferRowThumb item={item} />
                    </span>
                    <p className="w-0 min-w-0 flex-1 truncate text-neutral-100" title={item.error ? `${item.name} ${item.error}` : item.name}>
                      {item.name}
                    </p>
                    {shouldShowTransferProgress(item) ? (
                      <div className="flex items-center gap-1.5">
                        <TransferProgressRing item={item} label={statusText} />
                        <span aria-hidden="true" className="whitespace-nowrap text-neutral-300 tabular-nums">
                          {Math.round(clampTransferPercentage(item.percentage))}%
                        </span>
                      </div>
                    ) : (
                      <p className={`max-w-full truncate ${transferStatusClass(item)}`} title={item.error || statusText}>
                        {statusText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TransferCenter() {
  const t = useT();
  const { items, isOpen, closePanel } = useAppStore(useShallow((s) => ({
    items: s.transferItems,
    isOpen: s.transferPanelOpen,
    closePanel: s.closeTransferPanel,
  })));

  const overallState = useMemo(() => transferOverallState(items), [items]);
  const allCompleted = useMemo(() => isOpen && isTransferBatchCompleted(items), [isOpen, items]);

  /** 官方：全部完成后 10s 自动收起面板（items 保留，见 `RTl`） */
  useEffect(() => {
    if (!allCompleted) return;
    const timer = window.setTimeout(closePanel, AUTO_CLOSE_DELAY);
    return () => window.clearTimeout(timer);
  }, [allCompleted, closePanel]);

  const headerText = useMemo(() => transferHeaderText(items, overallState, t), [items, overallState, t]);

  if (!isOpen || items.length === 0) return null;

  return (
    <TransferPanelSurface
      items={items}
      headerText={headerText}
      overallState={overallState}
      closePanel={closePanel}
    />
  );
}

export default memo(TransferCenter);
