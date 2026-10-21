/**
 * 官方「模型悬浮飞出面板」的**组件**部分 —— `use-chat-attachment-file-input-CE59XJWo.js` 逐字。
 *
 *   `uu` → `ModelInfoPanel`       面板外壳：模型图标 + 名称 + 简介 + 能力条（速度/智能/花费）+ 提示段 + 子节点
 *   `th` → `ModelPickerFlyout`    `createPortal(document.body)` 的定位壳（`fixed z-120 w-[240px]`）
 *   `cu` → `CapabilityMeter`      能力评分条（1..5）
 *
 * 几何/悬浮意图在 `src/services/chat/modelFlyoutGeometry.ts`，
 * 两个钩子在 `src/components/chat/useModelRowFlyout.ts`（`.ts`，避免 fast-refresh 规则）。
 */
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import type { ModelCapabilityScores } from '../../types/chat';
import {
  OFFICIAL_CAPABILITY_KEYS,
  officialCapabilityLabel,
} from '../../services/chat/officialModelInfo';
import {
  FLOATING_SURFACE_ATTR,
  FLYOUT_BRIDGE_WIDTH,
  FLYOUT_PANEL_WIDTH,
  type FlyoutPosition,
} from '../../services/chat/modelFlyoutGeometry';

/**
 * 官方 `wu`（live canvas chunk 名 `xye`）**逐字**：
 * ```js
 * xye = ({value:e}) => jsx("span",{className:"flex items-center gap-1","aria-hidden":"true",children:
 *   Array.from({length:5},(t,n) => jsx("span",{className:z("h-[3px] w-5 rounded-full",
 *     n<e?"bg-text-text-primary/90":"bg-text-text-secondary/35")},n))});
 * ```
 * ⇒ 5 段 · 每段 `h-[3px] w-5` · 点亮条件 `index < value`（index 从 0 数）·
 *   点亮 `bg-text-text-primary/90` · 未点亮 `bg-text-text-secondary/35`。
 */
export function CapabilityMeter({ value, size = 'sm' }: { value: number; size?: 'sm' | 'md' }) {
  /* `sm` = 官方聊天侧尺寸（`h-[3px] w-5`）；`md` = 画布说明卡（参考图里更宽更厚一档）。 */
  const shape = size === 'md' ? 'h-1 w-6' : 'h-[3px] w-5';
  return (
    <span aria-hidden className="flex items-center gap-1">
      {Array.from({ length: 5 }, (_unused, index) => (
        <span
          key={index}
          className={
            index < value
              ? `${shape} rounded-full bg-text-text-primary/90`
              : `${shape} rounded-full bg-text-text-secondary/35`
          }
        />
      ))}
    </span>
  );
}

/**
 * 官方 `uu`：模型信息面板。
 * `notice` 对应官方「该模型暂不可用 / 会话中锁定」这类提示段
 * （`mt-3 rounded-lg bg-muted px-2.5 py-2 text-[11px] leading-4 text-text-text-secondary`）。
 */
export function ModelInfoPanel({
  displayName,
  description,
  capabilityScores,
  locale = 'zh-CN',
  notice,
  leading,
  children,
}: {
  displayName: string;
  description?: string | null;
  capabilityScores?: ModelCapabilityScores | null;
  locale?: string;
  notice?: string | null;
  /** 官方 `pn`：模型图标槽（16×16 包裹）。 */
  leading?: ReactNode;
  children?: ReactNode;
}) {
  const capabilities = OFFICIAL_CAPABILITY_KEYS
    .map((key) => ({ capability: key, value: capabilityScores?.[key] }))
    .filter(
      (entry): entry is { capability: (typeof OFFICIAL_CAPABILITY_KEYS)[number]; value: number } =>
        typeof entry.value === 'number',
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-popover p-1 shadow-lg">
      <div className="px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <h4 className="min-w-0 truncate font-semibold text-sm text-text-text-primary">{displayName}</h4>
        </div>
        {description ? <p className="mt-2 text-xs leading-5 text-text-text-secondary">{description}</p> : null}
        {capabilities.length > 0 ? (
          <div className="mt-2.5 border-t border-border/40 pt-2.5">
            <dl className="flex flex-col gap-2">
              {capabilities.map(({ capability, value }) => {
                const label = officialCapabilityLabel(capability, locale);
                return (
                  <div key={capability} className="flex items-center justify-between gap-4">
                    <dt className="text-xs font-medium text-text-text-secondary">{label}</dt>
                    <dd>
                      <meter className="sr-only" aria-label={label} min={1} max={5} value={value} />
                      <CapabilityMeter value={value} />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-lg bg-muted px-2.5 py-2 text-[11px] leading-4 text-text-text-secondary">
            {notice}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * 官方 `th`：飞出面板的定位壳（`createPortal(document.body)`）。
 * `position` 为 `null` 时面板不可见且不接收指针（官方同款兜底样式）。
 */
export function ModelPickerFlyout({
  panelRef,
  position,
  children,
  width,
  gap = FLYOUT_BRIDGE_WIDTH,
}: {
  panelRef: React.RefObject<HTMLDivElement | null>;
  position: FlyoutPosition | null;
  children: ReactNode;
  /** 面板宽度；官方 `zu = 240`，画布说明卡按参考图收窄到 288（宽度同时决定水平定位）。 */
  width?: number;
  /** 行与面板之间的可见间隙；过桥同宽（官方 6；画布说明卡按参考图放大）。 */
  gap?: number;
}) {
  if (typeof document === 'undefined' || !document.body) return null;
  /* 面板挂在行的哪一侧，过桥就长在面板的哪条内边（朝行那一侧）。 */
  const panelOnRight = position?.side === 'right';
  return createPortal(
    <div
      ref={panelRef}
      {...{ [FLOATING_SURFACE_ATTR]: '' }}
      /* 官方 `th`/`cbe` 逐字：`className:"fixed z-120 w-[240px]"`（宽度在 class 里，不在 style 里）。 */
      className="fixed z-[120]"
      style={
        position
          ? { top: position.top, left: position.left, width: width ?? FLYOUT_PANEL_WIDTH }
          : { visibility: 'hidden', pointerEvents: 'none', top: 0, left: 0, width: width ?? FLYOUT_PANEL_WIDTH }
      }
    >
      {/* 官方过桥：`absolute -inset-y-2 left-full w-[6px]` —— 指针从行扫到面板时不落在空隙里。
          面板在行右侧时镜像到 `right-full`，宽度 = 实际间隙。 */}
      <div
        aria-hidden
        className={`absolute -inset-y-2 ${panelOnRight ? 'right-full' : 'left-full'}`}
        style={{ width: gap }}
      />
      {children}
    </div>,
    document.body,
  );
}
