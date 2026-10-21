/**
 * GroupNode — 分组节点（**按官方 `QQ` 重写**）
 *
 * 官方源码（`zoom-slider-3ZcFvYQO.js`@char2884373，逐字）：
 * ```jsx
 * const QQ = ({id, data, selected, dragging}) => {
 *   const title = data?.title || "title";
 *   const layoutType = data?.layoutType || "none";
 *   const loading = data?.loading || false;
 *   const createdBy = data?.createdBy || "server";
 *   const color = data?.color;
 *   const v = nd(id);                    // 直接单选
 *   const y = !loading && v && selected;
 *   const x = Math.min(48 * (1 / zoom), 60);
 *   return (
 *     <No>
 *       <div className="canvas-node-presence-surface relative w-full h-full duration-300 rounded-[12px] group"
 *            style={{ backgroundColor: color || "transparent" }}
 *            onContextMenu={e => { e.preventDefault(); e.stopPropagation(); }}>
 *         <yW handleStyle={{border:"none"}} />      // NodeResizeControl（边框无）
 *         <O7 nodeId={id} selected={!!selected} title={title} />
 *         {loading && <div className="flex items-center gap-2 absolute origin-bottom right-4 -top-2 …"
 *                             style={{transform:`scale(${1/zoom})`}}>
 *                        <Wo className="w-4 h-4 animate-spin text-muted-foreground/60"/></div>}
 *       </div>
 *       <jl nodeId={id} visible={y} isDragging={dragging}>
 *         <qD tools={tools} nodeId={id} nodeTitle={title}
 *             className="absolute origin-bottom left-1/2 z-10 pointer-events-auto"
 *             style={{top: `-${x}px`}} />
 *       </jl>
 *       <Handle id="left"  type="target" position={Position.Left}  className="invisible"/>
 *       <Handle id="right" type="source" position={Position.Right} className="invisible"/>
 *     </No>
 *   );
 * };
 * ```
 *
 * ★★ 与 MTV 旧实现的差别（用户 2026 复核后裁定按官方重写）：
 *   · 分组色 = **整块表面的底色**（`backgroundColor: color`），**不再**是「淡染底 + 描边」；
 *   · 表面是**一整块 `rounded-[12px]`**，**没有** MTV 那条「标题栏 + 折叠为文件夹 + N 节点计数 + 批量生成」；
 *   · 标题层 `O7` 坐在分组盒子**上方**（`D7` 里有 `absolute -translate-y-full left-1 -top-0 pb-2 w-full`），
 *     不是画在盒子里面；
 *   · 两侧 handle 官方是 `className="invisible"`（点不到），且左=`target` / 右=`source`（MTV 旧版两个都是 `source`）。
 *   · MTV 自有的「折叠为文件夹」随标题栏一起去掉（用户已批准）⇒ `toggleGroupCollapsed` /
 *     `groupCollapsed` 在分组节点上不再被使用（store 里的 action 保留，`canvas-group-folder*` 的 CSS 变死代码）。
 *
 * 标题层 `O7 = memo(Xke)`（@char1212657）：`selected && titleEditable ? <Yke/> : <qke/>`
 *   `qke`（只读，@char1210727）：`div ref className={D7 + ' text-left'} style={F7}` 内 `span.min-w-0.truncate{title}`
 *   `Yke`（可编辑，@char1211377）：同一层里换成
 *     `div.relative.min-w-0.max-w-full.w-max.shrink` 内
 *       `span.invisible.whitespace-pre`（撑宽垫）+ 绝对定位 `input`（`box-border h-auto w-full border-none
 *       bg-transparent p-0 font-[inherit] text-[length:inherit] leading-[inherit] outline-none nodrag nowheel`）
 *   官方 `D7`（逐字）：
 *     `canvas-node-title absolute z-[1] pointer-events-auto -translate-y-full left-1 -top-0 pb-2 w-full
 *      text-foreground/60 overflow-hidden whitespace-nowrap flex items-center gap-1`
 *   官方 `F7`：`{ lineHeight: 1.5 }`
 *   ⚠️ `text-foreground/60`：MTV 没有 `--foreground` 色阶（Tailwind v3 也不会生成该工具类）
 *      ⇒ 着陆时写 `rgba(245,245,245,.6)`（= 官方 `--foreground:#f5f5f5` 的 60%）。
 *   ⚠️ 官方 `Yke` 是 **1s 防抖**后写 `data.title`；MTV 的 `renameGroup` 还会**同步改磁盘文件夹名**
 *      ⇒ 逐字写会把文件夹改疯 ⇒ 这里**本地受控 + blur/Enter 落库**（差异已在注释与报告里记账）。
 */
import { useEffect, useRef, useState } from 'react';
import { NodeResizer, Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { useAppStore } from '../../store/useAppStore';
import { useNodeLocked } from '../../hooks/useNodeLocked';
import { useIsDirectSingleSelection } from '../../hooks/useIsDirectSingleSelection';
import NodeToolbarShell from './shared/NodeToolbarShell';
import GroupNodeToolbar from './GroupNodeToolbar';
import { useT } from '../../i18n';

interface GroupNodeData {
  groupId: string;
  color: string;
  label: string;
  /** @deprecated 官方分组没有「折叠为文件夹」⇒ 本节点不再消费该字段（store 里仍可能残留） */
  groupCollapsed?: boolean;
}

/* ★ `selected` 用在这里 —— 官方 `Xke` 的两个分支就是 `selected && titleEditable ? <Yke/> : <qke/>`：
   未选中 = **只读 span**（`qke`），选中才换成可编辑 input（`Yke`）。 */
export default function GroupNode({ id, data, selected }: NodeProps) {
  const t = useT();
  const { groupId, color, label } = data as unknown as GroupNodeData;
  const renameGroup = useAppStore((s) => s.renameGroup);
  const commitToHistory = useAppStore((s) => s.commitToHistory);
  const isDirectSingleSelection = useIsDirectSingleSelection(id);
  // 锁定的分组同样禁止缩放
  const isNodeLocked = useNodeLocked(id);

  /* 标题 = 官方 `Yke`：受控 input + **1s 防抖**写回（官方 `Yc(e, f => …, 1e3)`）。
     `titleEditable`：官方是 `Hi(nodeType)?.titleEditable !== false`（类型元数据没显式禁用就算可编辑）
     —— MTV 的分组没有这个元数据、官方默认也是 true ⇒ 恒为可编辑，与官方默认取值一致。 */
  const [draft, setDraft] = useState(label ?? '');
  const debounceRef = useRef<number | null>(null);
  /* 外部值（Ctrl+Z / 别处改名）变了要跟上 —— 用**渲染期同步**而不是 effect 里 setState
     （本仓库 eslint 有 `react-hooks/set-state-in-effect`，且那样会多一次级联渲染） */
  const [lastLabel, setLastLabel] = useState(label ?? '');
  if (lastLabel !== (label ?? '')) {
    setLastLabel(label ?? '');
    setDraft(label ?? '');
  }
  useEffect(() => () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); }, []);

  const handleTitleChange = (value: string) => {
    setDraft(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const next = value.trim();
      if (next && next !== (label ?? '')) renameGroup(groupId, next);
    }, 1000);
  };

  const placeholder = t('输入标题');
  const titleEditable = Boolean(selected);

  return (
    <>
      {/* 官方外层：**一整块** `rounded-[12px]` 表面，分组色直接当底色（`color || "transparent"`） */}
      <div
        className="canvas-group-surface"
        style={{ backgroundColor: color || 'transparent' }}
        onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); }}
      >
        <NodeResizer
          isVisible={!isNodeLocked}
          minWidth={200}
          minHeight={120}
          onResizeStart={commitToHistory}
          onResizeEnd={commitToHistory}
          /* 官方 `yW` 传的就是 `handleStyle={{border:"none"}}` */
          handleStyle={{ border: 'none' }}
        />

        {/* 官方 `O7` 标题层：`selected && titleEditable ? <Yke/> : <qke/>`
            `D7` 的 `absolute -translate-y-full left-1 -top-0 pb-2 w-full` ⇒ 悬浮在盒子上方 */}
        <div className="canvas-group-titlebar nodrag">
          {titleEditable ? (
            /* 官方 `Yke`：`div.relative.min-w-0.max-w-full.w-max.shrink` 内 撑宽垫 + 绝对定位 input */
            <div className="canvas-group-titlebar-field">
              <span className="canvas-group-titlebar-ghost" aria-hidden="true">{draft || placeholder}</span>
              <input
                className="canvas-group-titlebar-input"
                value={draft}
                placeholder={placeholder}
                spellCheck={false}
                onChange={(event) => handleTitleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setDraft(label ?? '');
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          ) : (
            /* 官方 `qke`：`span.min-w-0.truncate`（只读态） */
            <span className="canvas-group-titlebar-text">{label}</span>
          )}
        </div>

        {/* 官方 group 浮动工具条（48 高 · 颜色/布局 丨 整组执行/解组 丨 下载全部） */}
        <NodeToolbarShell visible={isDirectSingleSelection}>
          <GroupNodeToolbar groupId={groupId} color={color} />
        </NodeToolbarShell>
      </div>

      {/* 两侧连线手柄：官方就是 `className="invisible"`，左=target / 右=source */}
      <Handle type="target" position={Position.Left} id="left" className="invisible" />
      <Handle type="source" position={Position.Right} id="right" className="invisible" />
    </>
  );
}
