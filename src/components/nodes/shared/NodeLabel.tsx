/**
 * NodeLabel 节点标签 — 渲染节点顶部标题栏，按节点类型显示对应图标/颜色/编号/Beta 角标
 * 支持双击标签文本进行重命名
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Icon } from '@iconify/react';
import type { NodeType } from '../../../types';
import { getNodeTypeConfig } from '../../../types';
import { OfficialIcon } from '../../sidebar/OfficialIcon';
/* ★ 官方视频节点图标 `es`（= `vendor-packages-DRvCmDjR.js` 的 `T6` / 导出表 `IconNodeVideo`）。
   `MentionIconVideo` 是它的逐字内联实现（`size=48 / opacity=.2` 为官方默认值，见
   `components/chat/MentionLibraryParts.tsx` @401）——**同一支 path、同一个 viewBox 0 0 48 48**，
   所以标题行与卡体空态共用同一颗组件，不会再出现两支不同的视频图标。 */
import { MentionIconVideo } from '../../chat/MentionLibraryParts';
import { useAppStore } from '../../../store/useAppStore';
import { readPins } from '../../../services/canvasPin';
import { useFilteredPinGroupId } from '../../../store/store.pin';
import PinIndicator from './PinIndicator';
import type { AuthenticityStatus } from '../../../utils/officialAuthenticityCheck';

interface NodeLabelProps {
  kind: NodeType;
  label: string;
  displayId?: number;
  isBeta?: boolean;
  nodeId: string;
  onRename: (newName: string) => void;
  /**
   * ★ 官方**内容校验（authenticityCheck）状态** —— 标题行末尾那个「对号」的**出现条件**。
   *
   * 官方源码（`course-api-base-url-CGXqZmAy.js`@257900–259600 逐字）：
   *   `if (status === bs.UNKNOWN) return null;`                      ← 未知：不渲染
   *   `if (status === bs.APPROVED) { … <CircleCheck className="text-foreground/70"/> }`  ← 通过：**对号**
   *   `if (V3(status)) … statusText.pending …`                       ← PENDING / PROCESSING：灰字「校验中」
   *   `if (status === bs.REJECTED || bs.REJECTED_INVALID) …`         ← 驳回：警告图标 / 红字
   * ⇒ **对号 = 文件通过服务端内容校验**，与「是否来自素材库」无关。
   *   ⚠️ MTV 旧实现用「有本地图 + 非参考卡」判定 ⇒ 语义错（用户实测「对号出现的不对劲」）。
   *   MTV 没有官方那条 review-status 接口 ⇒ 默认 `unknown`（官方同款：不渲染）。
   *   见 `utils/officialAuthenticityCheck.ts`。
   */
  authenticityStatus?: AuthenticityStatus;
}

export default function NodeLabel({ kind, label, displayId: _displayId, isBeta, nodeId, onRename, authenticityStatus = 'unknown' }: NodeLabelProps) {
  const config = getNodeTypeConfig(kind);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);
  /* 官方 Pin 指示器（`Qke`，zoom-slider @1213314）：标题行内显示本节点的色组小圆点 */
  const pinPins = useAppStore((s) => s.nodes.find((n) => n.id === nodeId)?.data.color_pins);
  const pins = readPins({ color_pins: pinPins });
  const filteredPinGroupId = useFilteredPinGroupId();

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(label);
    setIsEditing(true);
  }, [label]);

  const handleSave = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== label) {
      onRename(trimmed);
    }
    setIsEditing(false);
  }, [editText, label, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        setEditText(label);
        setIsEditing(false);
      }
    },
    [handleSave, label],
  );

  return (
    <div className={`node-label flex items-center select-none ${isEditing ? 'z-20' : ''}`} data-label-kind={kind}>
      {/* 官方文本卡标题图标（9444 实测官方 DOM 逐字）：
            <span class="flex size-[1em] shrink-0 items-center [&>svg]:size-full">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="…三条右对齐横线…"/></svg>
            </span>
          （上一轮我误判成"官方没有图标"—— 那是因为我只量了内层 span+input，没量容器的图标兄弟节点 ✗ 已改正） */}
      {kind === 'ai-text' ? (
        <span className="node-label-icon node-label-icon--text" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M9.71912 10.2559C10.0412 10.2559 10.3021 10.5167 10.3021 10.8389C10.3021 11.161 10.0412 11.4218 9.71912 11.4219H2.04138C1.71938 11.4217 1.45839 11.1609 1.45837 10.8389C1.45837 10.5168 1.71937 10.256 2.04138 10.2559H9.71912ZM7.80017 6.41699C8.12211 6.41721 8.38311 6.67802 8.38318 7C8.38318 7.32203 8.12215 7.58279 7.80017 7.58301H2.04138C1.71937 7.58283 1.45837 7.32206 1.45837 7C1.45844 6.678 1.71941 6.41717 2.04138 6.41699H7.80017ZM11.9584 2.57812C12.2804 2.57812 12.5412 2.8391 12.5414 3.16113C12.5414 3.4833 12.2805 3.74512 11.9584 3.74512H2.04138C1.71937 3.74494 1.45837 3.48319 1.45837 3.16113C1.45853 2.8392 1.71946 2.5783 2.04138 2.57812H11.9584Z"
            />
          </svg>
        </span>
      ) : (
      <span className="node-label-icon" aria-hidden="true">
        {/* 官方「Image」前面的图标就是 image 占位符那支 SVG（用户提供 image前-占位符.svg）。
            对比卡同理：用户 2026 提供的那支「对比」SVG（圆角方框 + 横线 + 两个实心点）
            既当标题行图标、也当卡体空态占位（见 CompareNode）。
            其它节点类型仍用各自的主题图标。

            ★ 视频卡标题图标 = 官方 `es`（`vendor-packages-DRvCmDjR.js` 局部名 `T6`，导出表
              `IconNodeVideo:T6` @315xxx / `T6=({className:e,size:t=48,opacity:n=.2})=>` @319667；
              canvas 里 `import{… N as es …}` ⇒ `es === T6`）。
              官方逐字调用点：`cse`（`GenerateVideoNode`，canvas @2076580）
                `titleIcon:s.jsx(es,{opacity:1})`   ← **opacity 显式 1**
              官方外层包装 `PJ`（canvas @833535）
                `s.jsx("span",{className:"flex size-[1em] shrink-0 items-center [&>svg]:size-full"})`
                ⇒ 图标被 CSS 压到 **1em = 标题字号**（官方标题行 `text-xs` ⇒ 12px）。
              MTV 的 `.node-label-icon`（`styles/nodes.css` @309）就是这层的等价实现
              （12×12 + `[&>svg]{12×12}`）⇒ 这里只需换图标本身。
              ⚠️ MTV 原来对 `ai-video` 用的是 `config.icon` = iconify `mdi:video-outline`
              —— 官方 4 个产物里 **0 命中**（自造）✗ 已按官方替换。 */}
        {kind === 'ai-image'
          ? <OfficialIcon name="image-placeholder" size={12} />
          : kind === 'compare'
            ? <OfficialIcon name="compare-placeholder" size={12} />
            : kind === 'ai-video'
              ? <MentionIconVideo size={12} opacity={1} />
              : <Icon icon={config.icon} width="12" height="12" />}
      </span>
      )}
      {isEditing ? (
        /* 官方编辑态（`Yke`）：外层 `relative min-w-0 max-w-full **w-max shrink**`（**宽度跟内容走**），
           里面用**不可见占位 span** 撑出宽度、真正的 input 绝对定位铺满。
           ⚠️ MTV 原来直接渲染 `<input flex-1>` ⇒ 输入态把整行占满、后面的 Pin 圆点被顶到行尾
             （用户反馈"点击 image 进入时圆点位置会跑"）—— 改成官方这套结构后显示/编辑两态位置一致。 */
        <div className="relative min-w-0 max-w-full w-max shrink">
          <span
            className="invisible whitespace-pre inline-block pointer-events-none select-none align-top"
            aria-hidden="true"
          >
            {editText || label}
          </span>
          <input
            ref={inputRef}
            className="node-label-input absolute inset-0 box-border h-auto w-full border-none bg-transparent p-0 font-[inherit] text-[length:inherit] leading-[inherit] text-inherit outline-none"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <span
          /* 官方显示态（`qke` 的标题）只有 `min-w-0 truncate` —— **没有 flex-1**
             ⇒ 标题是内容宽，后面的 Pin 圆点紧贴标题（这正是"圆点应该在 image 后面"的成因）
             行高照官方 `F7 = {lineHeight: 1.5}` */
          className="node-label-text min-w-0 truncate cursor-default leading-[1.5]"
          onDoubleClick={handleDoubleClick}
          /* 官方卡片标签悬浮**没有气泡提示**（截图确认）—— MTV 原来挂的「双击重命名」已按要求删除 */
        >
          {label}
        </span>
      )}
      {/* ★ 官方标题行里名字**后面**的「对号」徽标（t1060 官方 DOM 逐字：
          `<span class="inline-flex items-center shrink-0"><svg width="1em" height="1em" viewBox="0 0 24 24"
            class="tabler-icon tabler-icon-circle-check text-foreground/70">`）
          ⇒ **尺寸是 `1em`（= 标题字号 12px）**，不是固定 20px；间距由标题行的 `gap-1`(4px) 提供，**没有额外 margin**。
          （旧版写死 20×20 + margin-left 6px ⇒ 图标偏大、间距 10px ✗ —— 用户反馈「图标大小不一致 / 间距不一致」）
          ★ 出现条件（官方 `KP`@258250 逐字）：`status === bs.APPROVED` 才画；`UNKNOWN` 直接 `return null`。
            MTV 旧实现按「有图 + 非参考卡」判定 ⇒ **语义错**，用户实测「对号出现的不对劲」✗ 已按官方改 ✓ */}
      {kind === 'ai-image' && authenticityStatus === 'approved' ? (
        <span className="node-label-check" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="tabler-icon tabler-icon-circle-check">
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M9 12l2 2l4 -4" />
          </svg>
        </span>
      ) : null}
      {/* 官方 `eIe`：`inline-flex shrink-0 items-center` + `margin-right:0.667em`，
          `opacity = (!过滤 || 本卡属于该过滤组) ? 1 : 0`；内部是 `Qke`（title 变体）。
          ⚠️ 位置：官方标题行是**内容宽**（`inline-flex`）⇒ 它带 `ml-auto` 也紧跟在标题文字后面；
             MTV 的 `.node-label` 是**整卡宽** ⇒ 若用 `ml-auto` 会把圆点推到卡片右边缘（用户实测"位置不对"），
             所以这里放在标题文字**正后面**，保留官方的 0.667em 右边距。 */}
      <span
        className="pin-indicator-slot inline-flex shrink-0 items-center transition-opacity duration-200 ease-out"
        /* ⚠️ 官方 `Qke` 的 title 变体尺寸是 **em**（`0.8em` / 过滤中 `1em`），em 基准 = 标题文字字号。
           这里的槽是标题文字的**兄弟**（官方那层在内容宽的标题行内），所以必须显式把基准钉在 12px
           （= 官方标题 `text-xs`），否则会继承 `.node-label` 更大的字号 ⇒ 圆点被放大（实测 18px ✗ → 应为 9.6px）。 */
        style={{ marginRight: '0.667em', fontSize: 12, opacity: !filteredPinGroupId || pins.includes(filteredPinGroupId) ? 1 : 0 }}
        aria-hidden="true"
      >
        <PinIndicator pins={pins} variant="title" filteredGroupId={filteredPinGroupId} />
      </span>
      <span className="ml-auto flex items-center gap-1.5 flex-shrink-0">
        {/* 官方 canvas-node-title 只有「图标 + 文案」，没有节点编号徽章，故不再渲染 #{displayId} */}
        {isBeta && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400">
            Beta
          </span>
        )}
      </span>
    </div>
  );
}
