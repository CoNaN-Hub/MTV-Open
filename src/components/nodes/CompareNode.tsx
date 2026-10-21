/**
 * CompareNode —— 画布上的「对比」节点。
 *
 * ── 用户 2026 定的交互（本轮全部按此改）──
 *   ① 入口：「添加节点」菜单里在**图片的下方**（见 `nodePickerCatalog.generationItems`），
 *      与「图片」一样点一下就建到画布上 —— 建出来的卡和从多选菜单建的完全同形状。
 *   ② 用法：**把两张图片节点连进来**即出对比效果（前两条入边 = Before / After）。
 *      连线只有一个落点：`targetHandle:'left'`（本节点只有这一个手柄）。
 *      「落在卡右半边 ⇒ `resolveNodeBodyHandle` 给 `right` ⇒ 与来源同为 `right` ⇒ 判非法、松手没反应」
 *      这个问题在 `useConnectionDropMenu.handleConnectEnd` 里解决：
 *      **目标是 compare 时一律把 `targetHandle` 收成 `left`** ⇒ 整张卡都是可落区 ✓
 *   ③ **没有「交换 A/B」**：用户明确「不需要交换AB」⇒ 按钮与 `swapLayer` 全部移除。
 *   ④ 标签是 **Before / After**（用户：「是 After和Before 不是 Ab」）⇒ 直接用 Bencho 的默认标签。
 *   ⑤ 滑块**正好铺满卡片**（用户：图卡上下重叠，「有溢出的底部底色」＝ 滑块比卡小、
 *      露出了容器底色）⇒ `fill` 模式：尺寸由实测决定，不再写死 270×360。
 *   ⑥ **不出现底部编辑区，只出现左侧 `+`**（用户：「对比卡 不需要出现 底部编辑区，
 *      只需要出现 左侧 + 按钮，能我链接入图卡 实现对比就行」）：
 *        · 底部编辑区 = `AINodeDialog` 那条全局浮条 ⇒ 在它里面按 `nodeType === 'compare'` 整条不挂载；
 *        · 左侧 `+` = `.node-handle::after`（`styles/reactflow.css`）⇒ 只要这个 `Handle` 在，
 *          悬浮/选中卡片时它自己就会滑出来（本组件不需要再画别的按钮）。
 *
 * ── 参考实现（用户提供：MOMO 画布 `compareNode`，Vue3）──
 *   · 节点类型 `compareNode`，UI 名「对比」
 *   · `show-output-handle: false` ⇒ **没有输出接点**（对比是终点，不参与下游生成）
 *   · `resizable: false, animated: false`
 *   · 两张输入图来自入边（参考实现里 `M[0]` → before、`M[1]` → after）
 *   · 空态：`background:#1f1f1f; border-radius:12px` 居中占位
 *
 * ── 渲染层 ──
 * 对比滑块用 Bencho 的 `ImageCompare`（MIT）——本项目已有的、经用户确认的对比组件。
 * 参考实现自带的 side-by-side / playback-console 是 MOMO 画布内播放控制台，与滑块是两套交互，
 * 这里只落用户点名要的那一套（滑块）。 */
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { useAppStore, generateId } from '../../store/useAppStore';
import type { BaseNodeData } from '../../types';
import { NODE_BASE_SIZE, nearestAspectRatioForImage, nodeSizeForAspect, nodeSizeForAspectRatio } from '../../utils/nodeBounds';
import NodeLabel from './shared/NodeLabel';
import { useNodeRename } from './shared/useNodeRename';
import { OfficialIcon } from '../sidebar/OfficialIcon';
import ImageCompare from './shared/compare/ImageCompare';
/* ★ 用户 2026 转向：**无损改图归到对比卡** —— 对比天然持有「原图(before) / 修改图(after)」这一对，
   不用再靠连边去猜上游。编辑器是 props 驱动的，换宿主不用改本体。 */
import ImageFloatingCompositeEditor from './shared/image/ImageFloatingCompositeEditor';
import { useT } from '../../i18n';
import { saveDataUrlToProjectData, buildNodeFileName } from '../../services/fileService';

/**
 * 卡片尺寸 = **被对比的那张图卡的尺寸**（用户 2026：「对比卡的尺寸逻辑不对，现在尺寸固定死了，
 * 比如我现在对比两张 9:16 的图，被裁剪了；我想要的是我对比什么尺寸图的卡片就是什么尺寸」）。
 *
 * 取值链（第一张入图 = Before）：
 *   ① 源节点的 `nodeWidth/nodeHeight` —— 画布上那张图卡**实际渲染的**尺寸
 *      （= 官方 `pR(ratio)`：短边恒 250 ⇒ 16:9 → 444×250 · 9:16 → 250×444 · 1:1 → 250×250；
 *        用户手动缩放过也照样跟着走）⇒ 对比卡和图卡**一样大、一样比例**，滑块里的图不被裁 ✓
 *   ② 源节点只有 `aspectRatio`（没写节点尺寸的老数据）⇒ `nodeSizeForAspect(aspectRatio)`
 *   ③ 都没有（还没连图 / 源卡是空卡）⇒ 官方基准 `Od = 250×250`
 *
 * ⚠️ 别再写死尺寸 ✗（原来写死 280×360：9:16 的图被 `object-fit: cover` 裁掉上下 ✗）。
 * ⚠️ 尺寸还要**回写进 `data.nodeWidth/nodeHeight`**（`updateNodeDataTransient`，不写历史）——
 *    MTV 的包围盒/对齐/快照（`getNodeBounds`）都读这两个字段，不写就会出现
 *    「看得见的是 250×444、但框选/对齐按 280×360 算」的错位 ✗
 */
function resolveCompareSources(
  nodeId: string,
  nodes: ReturnType<typeof useAppStore.getState>['nodes'],
  edges: ReturnType<typeof useAppStore.getState>['edges'],
): Array<{ nodeId: string; url: string; width?: number; height?: number; aspectRatio?: string }> {
  const out: Array<{ nodeId: string; url: string; width?: number; height?: number; aspectRatio?: string }> = [];
  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    const source = nodes.find((n) => n.id === edge.source);
    if (!source) continue;
    const data = source.data as BaseNodeData | undefined;
    const url = (data?.imageUrl || data?.thumbnailUrl || '') as string;
    if (typeof url === 'string' && url.trim() !== '') {
      const width = typeof data?.nodeWidth === 'number' ? data.nodeWidth : undefined;
      const height = typeof data?.nodeHeight === 'number' ? data.nodeHeight : undefined;
      out.push({ nodeId: source.id, url, width, height, aspectRatio: data?.aspectRatio });
    }
  }
  return out;
}

/** 卡片尺寸（见上面的取值链） */
function compareCardSize(primary: { width?: number; height?: number; aspectRatio?: string } | undefined): {
  width: number;
  height: number;
} {
  if (primary?.width && primary?.height && primary.width > 0 && primary.height > 0) {
    return { width: Math.round(primary.width), height: Math.round(primary.height) };
  }
  if (primary?.aspectRatio) {
    const sized = nodeSizeForAspect(primary.aspectRatio);
    if (sized.width > 0 && sized.height > 0) return sized;
  }
  return { ...NODE_BASE_SIZE };
}

function CompareNode({ id, data, selected = false }: NodeProps) {
  const t = useT();
  const edges = useAppStore((s) => s.edges);
  const nodes = useAppStore((s) => s.nodes);

  const sources = useMemo(() => resolveCompareSources(id, nodes, edges), [id, nodes, edges]);
  /* 入边顺序即 Before / After：先连进来的那张是 Before（擦除线左侧那张） */
  const before = sources[0];
  const after = sources[1];

  /* ★ 标题行与 image 卡同源：`NodeLabel`（图标 + 文案，**双击可改名**，常驻显示）。
     用户 2026：「对比卡 左上角 要跟 image卡 一样 图标+文案 然后 文案也可以编辑」、
     「图标+文案 要像 image卡 一样 常驻」——`NodeLabel` 就是 image 卡用的那个组件，
     图标/字号/颜色/位置/选中时隐藏的规则全部继承 ✓
     ★ 用户 2026：「创建/连接后 卡片左上角显示为 图片对比」⇒ 默认名 `图片对比`；
       老数据里存的是「对比」（旧默认）⇒ 显示时归一化，用户自定义过的名字不动
       （与 ImageNode 把老的「生成图像」归一成 "Image" 同一套做法）。 */
  const { displayLabel, handleRename } = useNodeRename(id, data as BaseNodeData, '图片对比');
  const titleLabel = displayLabel === '对比' ? '图片对比' : displayLabel;
  const ready = Boolean(before?.url && after?.url);

  /* 卡片尺寸 = 入图那张图卡的尺寸（见 `compareCardSize` 的取值链）
     ⚠️ 必须声明在下面的 `handleLosslessApply` **之前**（建卡要用 cardW / 算 nodeHeight） */
  const card = useMemo(() => compareCardSize(before), [before]);
  const cardW = card.width;
  const cardH = card.height;

  /* ══ 无损改图（用户 2026 转向：归到对比卡）══
     · 原图 = `before`（入边第 1 张）、修改图 = `after`（入边第 2 张）
     · 产出 = **新建一张合成卡**（用户决策①），对比卡自身不动
     · 纯本地合成，不调 AI；算法见 `utils/losslessComposite.ts`
     ★★ 入口形式（用户 2026 两次口径）：「给对比加上工作栏和底部悬浮编辑区」+
        「按钮形式就不要了 不要先点开按钮再出现工具栏 跟其他卡一样的出现形式即可」
        ⇒ **选中对比卡就直接进入编辑态**（顶栏 + 画面区 + 底部两行），
        不再有那颗「无损改图」图标当入口。
        · `dismissed`：编辑器里的 × 先退回**对比滑块**；取消选中再选中就重新进编辑态
          （否则"选中即编辑"会和 × 打架：× 关掉立刻又被选中条件开回来）。 */
  const [losslessDismissed, setLosslessDismissed] = useState(false);
  /* 取消选中 ⇒ 清掉"已关闭"标记（重新选中就再次进编辑态）。
     写法用 React 官方的**渲染期调整 state**（`adjusting state when a prop changes`）：
     放进 effect 既会多渲染一帧，也会撞上仓库的 `react-hooks/set-state-in-effect` 规则。 */
  const [prevSelected, setPrevSelected] = useState(selected);
  if (prevSelected !== selected) {
    setPrevSelected(selected);
    if (!selected) setLosslessDismissed(false);
  }
  const losslessOpen = selected && ready && !losslessDismissed;
  const handleLosslessApply = useCallback(
    async ({ dataUrl, width, height }: { dataUrl: string; width: number; height: number }) => {
      const store = useAppStore.getState();
      const self = store.nodes.find((node) => node.id === id);
      const pos = self?.position ?? { x: 0, y: 0 };
      const projectId = store.currentProjectId ?? 'default';
      const newNodeId = `node-${generateId()}`;
      let url = dataUrl;
      try {
        const saved = await saveDataUrlToProjectData(
          dataUrl,
          projectId,
          buildNodeFileName('lossless', 'png', 'composite'),
        );
        if (saved?.assetUrl) url = saved.assetUrl;
      } catch {
        /* 落盘失败就退回 dataURL，不阻断建卡 */
      }
      const live = useAppStore.getState();
      /* ★★ 合成卡的盒子和 `ImageNode` 同口径：**按合成图自己的真实比例**算
         （官方 `pR`：短边恒 250 ⇒ 9:16 → 250×444）。
         ⚠️ 只在 data 里写 `nodeWidth/nodeHeight` 是**不够**的 —— `ImageNode` 渲染时
            自己重算：`role:'generator'` 走 `aspectRatioValue(data.aspectRatio)`、
            `role:'source'` 才看 `imageWidth/imageHeight`（见 ImageNode.tsx:192-197）。
            漏了 `aspectRatio` 就落到兜底 1:1 ⇒ 合成出来是 **250×250 的方卡**、
            9:16 的图被 `object-fit` 裁掉上下（实测：`inline: height: 250px`、渲染 123×123 ✗）。
         ⇒ 照 `ImageNode` 的「从历史应用到画布」那条（同文件 1148-1173 行）三件套一起写：
           `aspectRatio`（合法比例表里最接近的）+ `imageWidth/imageHeight`（真实像素）+ 盒子尺寸。 */
      const size = nodeSizeForAspectRatio(width / Math.max(1, height));
      const realRatio = nearestAspectRatioForImage(width, height);
      live.addNode({
        id: newNodeId,
        type: 'ai-image',
        position: { x: pos.x + cardW + 100, y: pos.y },
        data: {
          label: t('无损改图'),
          type: 'ai-image',
          role: 'generator',
          status: 'success',
          imageUrl: url,
          aspectRatio: realRatio.aspectRatio,
          imageWidth: width,
          imageHeight: height,
          nodeWidth: size.width,
          nodeHeight: size.height,
        } as BaseNodeData,
      });
      live.setEdges([
        ...live.edges,
        { id: `edge-${generateId()}`, source: id, target: newNodeId, sourceHandle: 'right', targetHandle: 'left' },
      ]);
      /* × 只退回**对比滑块**（不是取消选中），重新选中再进编辑态 —— 见 `losslessDismissed` */
      setLosslessDismissed(true);
      live.showToast(t('已生成合成卡'));
    },
    [cardW, id, t],
  );

  const dataW = typeof data?.nodeWidth === 'number' ? data.nodeWidth : undefined;
  const dataH = typeof data?.nodeHeight === 'number' ? data.nodeHeight : undefined;

  /* 尺寸回写进 data（包围盒/对齐/快照都读它）。用 transient：这是**跟随源图派生**的值，
     不是用户动作 ⇒ 不该在历史里多出一条记录 ✓；值没变就 return（防止自激循环） */
  useEffect(() => {
    if (dataW === cardW && dataH === cardH) return;
    useAppStore.getState().updateNodeDataTransient(id, {
      nodeWidth: cardW,
      nodeHeight: cardH,
    } as Partial<BaseNodeData>);
  }, [id, cardW, cardH, dataW, dataH]);

  return (
    <div className="node-wrapper relative has-media">
      {/* ══ 入口已取消（用户 2026）══
         原来这里是 `NodeToolbarShell` + 一颗「无损改图」图标按钮，点了才出编辑器的工具栏。
         用户明确否掉：「按钮形式就不要了 不要先点开按钮 再出现工具栏 跟其他卡一样的出现形式即可」
         ⇒ 选中卡片**直接进编辑态**（编辑器的顶栏 / 画面区 / 底部两行自己就是那套 UI），
         这里不再渲染任何入口工具条（`NodeToolbarShell` 也不需要）。
         ⚠️ 别把 `NodeToolbarShell` 加回来：它的外层 `z-20` 是给"卡片工具条"用的，
            现在卡片上没有任何工具条，加了只会多一层空的浮层。 */}
      {/* ★★ 标题行必须在 `.node` **外面**（与 image 卡同构，见 ImageNode）：
          `.node.selected .node-label-text{visibility:hidden}`（官方"选中即隐藏标题"）只作用于
          `.node` 的**后代** ⇒ 放进 `.node` 里就会「点一下选中 → 标题立刻隐藏 → 第二击落不到文字上
          → 双击改名永远进不去」。实测：image 卡双击进编辑 ✓ / 之前对比卡双击无效 ✗。
          放在 wrapper 层后：常驻可见、可双击改名，行为与 image 卡完全一致 ✓ */}
      <NodeLabel kind="compare" label={titleLabel} nodeId={id} onRename={handleRename} />
      <div
        className={`node compare-node ${selected ? 'selected' : ''}`}
        style={{ width: cardW, height: cardH }}
      >
        {/* ★ 接入 MTV 既有手柄体系（照 `ImageNode` 的写法）：`type="source"` + `id="left"`
             —— MTV 全画布就是这个口径（`ConnectionMode.Loose`），多选菜单建的边连的也正是
             `targetHandle:'left'`（`useConnectionDropMenu` @741）。
             ★★ **右侧输出手柄**（用户 2026：「旁边生成一张同比例的「无损改图」卡 节点连接线 要有」）：
                无损改图会把合成结果**作为一张新卡输出**，所以对比卡不再是"纯终点"。
                ⚠️ 少了它连接线根本画不出来 —— React Flow 会去找 `sourceHandle:'right'`，
                   对比卡上没有这个 id 的手柄就**静默丢弃这条边**（实测：画布上只有 2 条入边、
                   新建的合成卡一条边都没有 ✗）。所以建边用的 `sourceHandle:'right'` 必须配一个真手柄。
                ⚠️ 旧注释担心的 `right → right` 非法边：MTV 的规则是 `sourceHandle !== targetHandle`
                   （见 `isCanvasConnectionValid`），那是**所有**双手柄节点的通例，不是这里的特例；
                   而且右侧手柄现在有真实输出语义（连出去=喂给下游）✓
                落点问题仍由 `handleConnectEnd` 兜底：**对比卡的整张卡都当 `left` 收**。 */}
        <Handle type="source" position={Position.Left} id="left" className="node-handle handle-source handle-image" />
        <Handle type="source" position={Position.Right} id="right" className="node-handle handle-source handle-image" />
        <div className="compare-node-content">
          {ready ? (
            <div className="compare-preview image-compare-scope">
              {/* 标签用 Bencho 默认的 Before / After；`fill` ⇒ 滑块铺满卡片，不留底色 */}
              {/* ⚠️ `corner` 必须 = **卡片圆角 16**（`.node` 的 `border-radius`）。
                  原来写 12 ⇒ 里层图的圆角比方框少切 4px，那 4px 会**露在卡片轮廓外**；
                  平时被卡片底色盖住看不出，但编辑器（圆角 16 的承载面）盖上去之后，
                  四个角就会露出对比滑块 / 合成图 ⇒ 用户报
                  「对比图卡的底部圆角面板没包裹住图，图现在有点溢出」。 */}
              <ImageCompare beforeSrc={before!.url} afterSrc={after!.url} corner={16} fill />
            </div>
          ) : (
            /* ★ 空卡：**跟 image 卡用同一套占位类**（`.node-preview-placeholder`）⇒
               底色/圆角在**任何主题**下都必然与 image 卡一致
               （用户 2026：「对比卡空卡时 卡体颜色 也要一样 现在目前的 颜色不对」）。
               内容**只有用户给的那支 SVG**（用户 2026：「卡体 中去掉 对比 占位符」）。
               ★ 上色也照 image 卡那支占位图：`color: rgb(245,245,245)` + `opacity: .2`
                 （用户 2026：「占位符的颜色也不对」——原来是 `--theme-text-muted` #7d7d91，
                   偏亮且偏蓝，与 image 卡空态那支 20% 的 #f5f5f5 不是一回事）。 */
            <div className="compare-preview-placeholder node-preview-placeholder image-compare-scope">
              <OfficialIcon name="compare-placeholder" size={48} />
            </div>
          )}
        </div>
      </div>
      {/* ══ 编辑态（选中即进）══
          由编辑器自己提供「顶栏 + 画面区 + 底栏」（复用 `.irf-root` 那套 MTV 宿主）⇒
          这张卡一被选中就是完整的无损改图工作区，没有任何"先点按钮"的一步。 */}
      {losslessOpen && before?.url && after?.url && (
        <ImageFloatingCompositeEditor
          nodeId={id}
          imageUrl={after.url}
          originalUrl={before.url}
          containerWidth={cardW}
          containerHeight={cardH}
          onCancel={() => setLosslessDismissed(true)}
          onApply={(payload) => void handleLosslessApply(payload)}
        />
      )}
    </div>
  );
}

export default memo(CompareNode);
