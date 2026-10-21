/**
 * Group slice — visual node grouping on canvas
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';
import type { NodeGroup } from '../types';
import { generateId } from './store.utils';
import { isNodeMediaCopySource } from '../services/nodeMediaCopy';
import { registerCanvasImport, isCanvasDerivationFresh, completeCanvasDerivation, type CanvasDerivationGuard } from '../services/canvasDerivationGuard';
/* ★ 程序化改选区必须走它（MTV 的 store 选区只是 React Flow 选区的镜像，见该服务顶部说明） */
import { selectNodesInCanvas } from '../services/canvasSelectionService';
import { persistMediaRelocation, pendingMediaRelocations, completeMediaRelocation,
  relocateMediaReferences, relocateOwnedMediaReferences, type MediaRelocation } from '../services/indexedDb/mediaRelocations';
import {
  ensureGroupFolder,
  getAssetUrlFromPath,
  getProjectDataDir,
  moveProjectFileToFolder,
  finishProjectFileRelocation,
  removeEmptyProjectGroupFolder,
  sanitizeFolderName,
} from '../services/fileService';
/* 官方 PILE（堆叠）—— 建堆/解堆都是官方纯函数，见 `utils/officialPile.ts` */
import {
  applyPileCreation,
  buildPileIndex,
  isAllowedPileMember,
  pileDisplaySize,
  pileMemberIds,
  PILE_NODE_TYPE,
  recenterPile,
  releaseFromParents,
  removePileMember,
  unpilePileNode,
  type AnyNode,
} from '../utils/officialPile';
import { renderSizeOf, selectionBoundsOf } from '../utils/officialCanvasLayout';

export interface GroupSlice {
  groups: NodeGroup[];
  groupSelectedNodes: () => void;
  ungroupSelectedNodes: () => void;
  renameGroup: (id: string, name: string) => void;
  /** 在画布上直接创建一个空文件夹（折叠态分组），拖节点进去即入组 */
  createEmptyGroup: (position: { x: number; y: number }) => void;
  /** 折叠/展开分组：折叠后收成文件夹卡片，组内节点与其连线不再渲染 */
  toggleGroupCollapsed: (groupId: string) => void;
  setGroupColor: (groupId: string, color: string) => void;
  /** 把节点文件搬到所属分组的文件夹（未分组则搬回项目根目录），由自动保存驱动 */
  syncGroupFiles: () => Promise<void>;
  /* ── 官方 PILE（堆叠）：见 `utils/officialPile.ts` 与 `AGENTS.md`「官方 PILE 规格」 ── */
  /** 官方「堆叠」`Te`@1444658 → `E.createFromSelection(m)` → `pqe`@2776891 */
  pileSelectedNodes: () => void;
  /** 官方「取消堆叠」`gt`@1459256 → `$lt`@2779181 */
  unpileSelectedNodes: () => void;
  /**
   * 官方「拖拽入堆」`mqe`@2777346（门）+ `Hlt`@2777723（加成员）。
   * ⚠️ MTV 侧原来是**空**的；这是本轮新加的（拖拽命中判定见 `utils/officialPileDrop.ts`）。
   */
  addNodesToPile: (pileId: string, nodeIds: readonly string[]) => void;
  /**
   * 官方「把单个成员从堆叠里摘出」（画廊 `removeMember` = `wt`@1460146 → `Klt`@2779553）。
   *
   * ⚠️ MTV 偏离：官方第 3 个实参是**拖拽落点**（`wt` 里 `Y(screenCenter)` 换算成 flow 坐标 -
   *    `{width/2,height/2}`）；MTV 的这个 store 动作把它做成**可选**，省略时
   *    `removePileMember` 回落到成员的当前绝对坐标（原地不动）。
   * ⚠️ 官方 `wt` 还先做 `Ge(nextNodes)`（无变化 ⇒ 返回 `null`，画廊回落「放回堆叠」）；
   *    这里同样在**无变化时直接返回**（不提交历史），画廊侧再由返回值判定。
   */
  removeNodeFromPile: (pileId: string, nodeId: string, dropPosition?: { x: number; y: number }) => void;
}

/** 一次移动的结果：新路径 + 重建的展示 URL + 项目内相对路径 */
interface MovedFile {
  filePath: string;
  assetUrl: string;
  relativePath: string;
}

async function describeFile(filePath: string, folder: string | null): Promise<MovedFile> {
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
  return {
    filePath,
    assetUrl: await getAssetUrlFromPath(filePath),
    relativePath: folder ? `${folder}/${fileName}` : fileName,
  };
}

async function moveFile(
  filePath: string | undefined,
  projectDir: string,
  folder: string | null,
  forceCopy = false,
): Promise<MovedFile | null> {
  const moved = await moveProjectFileToFolder(filePath, projectDir, folder, { preserveSource: true, forceCopy });
  return moved ? describeFile(moved, folder) : null;
}

/** 折叠后的文件夹卡片尺寸 */
export const COLLAPSED_GROUP_SIZE = { width: 220, height: 152 };

// 自动保存每 2 秒可能触发一次，重入会让同一个文件被搬两次
let syncingGroupFiles = false;
const retiredFolders = new Map<string, Set<string>>();
function retireFolders(projectId: string | null, names: string[]) {
  if (projectId) retiredFolders.set(projectId, new Set([...(retiredFolders.get(projectId) ?? []), ...names]));
}

async function relocateGroupedFiles(projectId: string, projectDir: string, guard: CanvasDerivationGuard,
  set: Parameters<StateCreator<AppState>>[0], get: () => AppState): Promise<void> {
  const fresh = () => isCanvasDerivationFresh(guard, get());
  const finish = async (move: MediaRelocation) => {
    if (!fresh() || isNodeMediaCopySource(move.oldPath)) return false;
    if (!move.ownerId) await finishProjectFileRelocation(move.oldPath, move.newPath, projectDir);
    await completeMediaRelocation(move);
    return true;
  };
  const pending = await pendingMediaRelocations(projectId);
  if (!fresh()) return;
  if (pending.length) {
    set((state) => pending.reduce((current, move) => move.ownerId
      ? relocateOwnedMediaReferences(current, move, move.ownerId) : relocateMediaReferences(current, [move]), state));
    if (await get().saveCurrentProjectSilent() !== projectId || !fresh()) return;
    for (const move of pending) if (!await finish(move)) return;
  }
  const nodeIds = get().nodes.filter((node) => node.type !== 'group').map((node) => node.id);
  for (const nodeId of nodeIds) {
    const initial = get().nodes.find((node) => node.id === nodeId);
    if (!initial || !fresh()) continue;
    const slots = [null, ...(initial.data.storyboardOverrides ?? []).map((_, index) => index)];
    for (const slot of slots) {
      if (!fresh()) return;
      const node = get().nodes.find((item) => item.id === nodeId);
      if (!node) break;
      const path = slot === null ? node.data.filePath : node.data.storyboardOverrides?.[slot]?.filePath;
      if (!path || isNodeMediaCopySource(path)) continue;
      const key = (value: string) => value.replace(/\\/g, '/');
      // Shared legacy nodes split first. The last owner performs the actual relocation.
      const owners = get().nodes.filter(({ data }) => [data.filePath,
        ...(data.storyboardOverrides ?? []).map((cell) => cell?.filePath),
        ...(data.directorCaptureFilePaths ?? [])].some((candidate) => candidate && key(candidate) === key(path)));
      const shared = owners.length > 1;
      const group = get().groups.find((item) => item.id === node.parentId);
      const folder = group ? sanitizeFolderName(group.name) : null;
      const moved = await moveFile(path, projectDir, folder, shared);
      if (!moved || !fresh()) continue;
      const move: MediaRelocation = { oldPath: path, newPath: moved.filePath, assetUrl: moved.assetUrl,
        relativePath: moved.relativePath, projectId, ownerId: shared ? nodeId : undefined, oldAssetUrl: await getAssetUrlFromPath(path) };
      await persistMediaRelocation(move, shared ? nodeId : undefined);
      if (!fresh()) return; // Durable pending cleanup resumes when this project is reopened.
      set((state) => shared ? relocateOwnedMediaReferences(state, move, nodeId) : relocateMediaReferences(state, [move]));
      if (await get().saveCurrentProjectSilent() !== projectId || !fresh()) return;
      if (!await finish(move)) return;
    }
  }
}

export const createGroupSlice: StateCreator<AppState, [], [], GroupSlice> = (set, get) => {
  return {
  groups: [],

  groupSelectedNodes: () => {
    const { selectedNodeIds, groups, nodes } = get();
    if (selectedNodeIds.length === 0) {
      get().showToast('请先选中节点', 'error');
      return;
    }

    // Auto-detect ungroup scenario:
    // - any selected node has parentId (inside a group)
    // - any selected node is itself a group node
    const shouldUngroup = nodes.some(
      (n) => selectedNodeIds.includes(n.id) && (n.parentId != null || n.type === 'group'),
    );
    if (shouldUngroup) {
      get().ungroupSelectedNodes();
      return;
    }

    if (selectedNodeIds.length < 2) {
      get().showToast('请至少选中 2 个节点', 'error');
      return;
    }

    const candidateIds = selectedNodeIds;

    get().commitToHistory();

    // Compute bounding box from absolute positions
    const selectedNodes = nodes.filter((n) => candidateIds.includes(n.id));
    /* ★★ 打组外框 = **官方 `x1`@1384453 → `Bi`(`p2`)@424114 逐字**（用户反馈「外框计算方式不对」）。
       官方逐字：
       ```js
       function x1(e){ return Bi(e.map(n=>({position:n.position,
         width:n.measured?.width??n.width, height:n.measured?.height??n.height})), 20) }
       function p2(e,t=20){ … const o=ch(r.width,200), i=ch(r.height,100);
         return { x:n.minX-t, y:n.minY-t,
                  width:n.maxX-n.minX+2*t, height:n.maxY-n.minY+2*t } }   // ch(v,d)=有限数?v:d
       ```
       ⇒ 唯一常量是**四边各 20**；**没有 titleBar 预留**（官方标题 `D7` 是 `-translate-y-full`
          悬浮在盒子**外面上方**，盒内不占高度）、**没有 `Math.max` 夹取**。
       ⚠️ MTV 原来用的是自己编的 `padding=36` + `titleBarH=36` + 两个 clamp(200/120) +
          尺寸优先读 `data.nodeWidth` ⇒ 恒定偏大：左 16 / 上 52 / 宽 32 / 高 68，
          而且尺寸来源不对会随节点类型乱飘（`renderSizeOf` 的注释里已实测
          `data.nodeWidth=444×250` 而实际渲染 `250×333`）✓ */
    const bounds = selectionBoundsOf(selectedNodes as never, nodes as never) ?? {
      minX: 0, minY: 0, maxX: 0, maxY: 0,
    };
    /** 官方 `Bi(…, 20)` 的 `t` —— 四边各 20 */
    const GROUP_PADDING = 20;
    const gX = bounds.minX - GROUP_PADDING;
    const gY = bounds.minY - GROUP_PADDING;
    const gW = bounds.maxX - bounds.minX + GROUP_PADDING * 2;
    const gH = bounds.maxY - bounds.minY + GROUP_PADDING * 2;

    // Calculate relative positions & group dimensions
    const relMap = new Map<string, { x: number; y: number }>();
    for (const id of candidateIds) {
      const n = nodes.find((nn) => nn.id === id);
      if (!n) continue;
      const absX = n.parentId
        ? n.position.x + (nodes.find((p) => p.id === n.parentId)?.position.x || 0)
        : n.position.x;
      const absY = n.parentId
        ? n.position.y + (nodes.find((p) => p.id === n.parentId)?.position.y || 0)
        : n.position.y;
      relMap.set(n.id, { x: absX - gX, y: absY - gY });
    }

    /* ★★ 官方分组的底色**可以是「无颜色」**（`zoom-slider`@char2884373 逐字）：
       `QQ`: `style={{backgroundColor: color || "transparent"}}`
       `mQ`: `!selectedColor && "bg-card-foreground"`（触发器变白点）+ `onReset: () => G("")`
       ⇒ 新建分组**不预置颜色**（旧版塞调色板首色 = 我自己编的，官方表面本来是透明的）。 */
    const color = '';

    // 分组名同时也是本地文件夹名，重名会撞同一个文件夹，所以创建时就去重
    /* ★★ 官方默认分组名 = `common.newGroup` = **「新建组」**（`index-BiTZf8mJ.js`@9120986 逐字）。
       ⚠️ MTV 原来写死「分组」⇒ 用户实测「打组左上角的名字不对，官方是 新建组」✗。 */
    let groupName = '新建组';
    for (let i = 2; groups.some((g) => g.name === groupName); i++) groupName = `新建组 ${i}`;

    const groupId = `group-${generateId()}`;
    const newGroup: NodeGroup = {
      id: groupId,
      name: groupName,
      nodeIds: candidateIds,
      color,
      createdAt: Date.now(),
    };

    // Build the group node — must appear BEFORE its children in the nodes array
    const groupNode = {
      id: groupId,
      type: 'group' as const,
      position: { x: gX, y: gY },
      data: { label: newGroup.name, type: 'comment' as const, groupId, color },
      style: { width: gW, height: gH },
      /* 官方 `b1`@1384708 逐字：分组节点把尺寸写在**顶层** `width`/`height`（不是只写 `style`）。
         只写 `style` 时 React Flow 的 `measured` 与选择/吸附口径会拿不到真实尺寸。 */
      width: gW,
      height: gH,
    };

    set((state) => ({
      groups: [...state.groups, newGroup],
      nodes: [
        // Place group node BEFORE children (xyflow requirement)
        groupNode,
        ...state.nodes.map((n) =>
          candidateIds.includes(n.id)
            ? { ...n, parentId: groupId, position: relMap.get(n.id)! }
            : n
        ),
      ],
    }));

    void ensureGroupFolder(get().currentProjectId, newGroup.name);

    /* ★ 官方「打组」后**选中变成新 group**（`taskbar-official-report.md` §2.3 实测：
       「节点数 7 → 8，多出一个 group 节点；**选中变成新 group**」）。
       ⚠️ MTV 原来保留原子节点的选区 ⇒ 后果是官方 style 的 group 浮动工具条**不会立刻出现**
          （出现门 `nd` = 直接单选该节点），得再点一下分组。
       ⚠️⚠️ **必须走 `selectNodesInCanvas`，不能只调 `setSelectedNodeIds`**：
          MTV 有两套选区（RF 内部 + store 镜像），只改 store 会出现「store 说选了分组、
          RF 仍选着那 2 个子节点」的分裂状态 —— 拖拽/Delete 按 RF 走、浮层按 store 走。
          走 RF API 后由 `onSelectionChange` 回流（`selectionSource` 会自动是 `'direct'`）✓ */
    selectNodesInCanvas([groupId]);

    get().showToast(`已创建「${newGroup.name}」（${candidateIds.length} 个节点）`);
  },

  /**
   * 官方「堆叠」（`page-DPdEgTS0.js`@1444658 的 `Te` → `E.createFromSelection(m)`）。
   *
   * `m` = 当前选中 id（官方按 `selectionClickOrder` 重排后再传，MTV 直接按 store 顺序）。
   * 建堆是**纯函数** `pqe`@2776891（见 `utils/officialPile.ts`）：
   *   被完全吸收的来源堆叠节点会被移除、成员脱父并转绝对坐标、新堆叠节点追加在最后。
   * 门不过（`EQ` 返回 null）时**什么都不做**（官方 `Te` 里 `if(!V||!E.createFromSelection(m))return`）。
   */
  pileSelectedNodes: () => {
    const { nodes, selectedNodeIds } = get();
    if (selectedNodeIds.length === 0) return;
    const next = applyPileCreation(
      nodes as unknown as AnyNode[],
      selectedNodeIds,
      generateId(),
      {},
      (node) => renderSizeOf(node as never, nodes as never),
    );
    if (next.length === nodes.length && next === nodes) return;
    const created = next.find(
      (n) => n.type === PILE_NODE_TYPE && !nodes.some((old) => old.id === n.id),
    );
    if (!created) return;
    get().commitToHistory();
    set({ nodes: next as never });
    /* 与「打组」一致：建完把选区落到新堆叠节点上，这样浮层立刻出现在它上面 */
    selectNodesInCanvas([created.id]);
  },

  /**
   * 官方「取消堆叠」（`page-DPdEgTS0.js`@1459256 的 `gt` → `$lt`@2779181）。
   * 空堆叠直接删除；否则成员按官方平铺布局（间距 `vC = 128`）释放、清 `parentId`/`extent`。
   */
  unpileSelectedNodes: () => {
    const { nodes, selectedNodeIds } = get();
    const index = buildPileIndex(nodes as unknown as AnyNode[]);
    const targetIds = new Set<string>();
    for (const id of selectedNodeIds) {
      const node = nodes.find((n) => n.id === id);
      if (!node) continue;
      if (node.type === PILE_NODE_TYPE) targetIds.add(node.id);
      const owner = index.pileIdByNodeId.get(id);
      if (owner) targetIds.add(owner);
      /* 选中「堆叠里的成员」时，官方 `gt` 也是解它所属的那个堆叠 */
      void pileMemberIds;
    }
    if (targetIds.size === 0) return;
    get().commitToHistory();
    let next = nodes as unknown as AnyNode[];
    for (const pileId of targetIds) {
      next = unpilePileNode(next, pileId, (node) => renderSizeOf(node as never, next as never));
    }
    set({ nodes: next as never });
    selectNodesInCanvas([]);
  },

  /**
   * 官方「拖拽入堆」：`mqe(nodes, pileId, newIds)` 是**门**，`Hlt` 是加成员。
   * 门逐条（`zoom-slider-3ZcFvYQO.js`@2777346 逐字）：
   *   堆叠存在 · `enabled !== false` · 去重后的新成员数 > 0 ·
   *   `现有 + 新增 <= maxMembers ?? 50` · 每个新成员都过 `SQ`（类型合法且**不在别的堆叠里**）。
   * 加成员：把新 id **追加**到 `memberIds` 末尾（= 叠到最上面一层），
   * 成员脱父转绝对坐标，堆叠按新封面尺寸重居中。
   */
  addNodesToPile: (pileId, nodeIds) => {
    const { nodes } = get();
    const pile = nodes.find((n) => n.id === pileId && n.type === PILE_NODE_TYPE);
    if (!pile) return;
    const existing = pileMemberIds(pile as unknown as AnyNode);
    const existingSet = new Set(existing);
    const fresh = [...new Set(nodeIds)].filter((id) => !existingSet.has(id));
    if (fresh.length === 0) return;
    if (existing.length + fresh.length > 50) return;
    const index = buildPileIndex(nodes as unknown as AnyNode[]);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const ok = fresh.every((id) => {
      const node = byId.get(id);
      if (!node || node.type === PILE_NODE_TYPE) return false;
      return !index.pileIdByNodeId.has(id) && isAllowedPileMember(node as unknown as AnyNode);
    });
    if (!ok) return;

    const nextMemberIds = [...existing, ...fresh];
    const released = releaseFromParents(nodes as unknown as AnyNode[], nextMemberIds);
    const sizeOf = (node: AnyNode) => renderSizeOf(node as never, nodes as never);
    const members = nextMemberIds
      .map((id) => (released.get(id) ?? byId.get(id)) as AnyNode | undefined)
      .filter(Boolean) as AnyNode[];
    const resized = recenterPile(
      (released.get(pileId) ?? pile) as AnyNode,
      members.map((m) => pileDisplaySize(m, sizeOf)),
      sizeOf,
    );
    get().commitToHistory();
    set({
      nodes: nodes.map((n) => {
        if (n.id === pileId) {
          return { ...resized, data: { ...resized.data, memberIds: nextMemberIds } } as never;
        }
        return (released.get(n.id) ?? n) as never;
      }),
    });
  },

  /**
   * 官方画廊 `removeMember`（`page-DPdEgTS0.js`@1460146 的 `wt`）→ `Klt`@2779553：
   * 把 `nodeId` 从 `pileId` 的 `memberIds` 里摘掉并落到 `dropPosition`（flow 坐标、左上角）。
   * 剩余成员 `< 2` 时堆叠节点整体删除、剩余成员居中——全部在 `removePileMember` 里逐字实现。
   */
  removeNodeFromPile: (pileId, nodeId, dropPosition) => {
    const { nodes } = get();
    /* 官方 `wt` 的 `Ge(nextNodes)`：不在该堆叠里 ⇒ 图无变化 ⇒ **不提交历史、直接返回** */
    if (buildPileIndex(nodes as unknown as AnyNode[]).pileIdByNodeId.get(nodeId) !== pileId) return;
    const next = removePileMember(
      nodes as unknown as AnyNode[],
      pileId,
      nodeId,
      (node) => renderSizeOf(node as never, nodes as never),
      dropPosition,
    );
    get().commitToHistory();
    set({ nodes: next as never });
  },

  ungroupSelectedNodes: () => {
    const { selectedNodeIds, groups, nodes } = get();
    if (selectedNodeIds.length === 0) {
      get().showToast('请先选中节点或分组', 'error');
      return;
    }

    // Find groups that contain any selected nodes (or are themselves selected group nodes)
    const affectedGroupIds = new Set<string>();
    for (const n of nodes) {
      if (selectedNodeIds.includes(n.id) && n.parentId) affectedGroupIds.add(n.parentId);
    }
    // Also include selected group nodes themselves
    for (const id of selectedNodeIds) {
      const gn = nodes.find((n) => n.id === id);
      if (gn?.data?.groupId) affectedGroupIds.add(gn.data.groupId as string);
    }

    if (affectedGroupIds.size === 0) {
      get().showToast('选中节点未属于任何分组', 'error');
      return;
    }

    get().commitToHistory();

    const dissolvedNames: string[] = [];
    const newNodeGroups = groups.filter((g) => {
      if (affectedGroupIds.has(g.id)) {
        dissolvedNames.push(g.name);
        return false;
      }
      return true;
    });

    // Collect all child IDs of dissolved groups
    const dissolvedChildIds = new Set<string>();
    for (const gid of affectedGroupIds) {
      const gn = groups.find((g) => g.id === gid);
      if (gn) gn.nodeIds.forEach((id) => dissolvedChildIds.add(id));
    }

    // Remove parentId and convert to absolute positions
    set((state) => ({
      groups: newNodeGroups,
      nodes: state.nodes
        .filter((n) => {
          // Remove dissolved group nodes
          if (affectedGroupIds.has(n.id) && n.type === 'group') return false;
          return true;
        })
        .map((n) => {
          if (dissolvedChildIds.has(n.id) && n.parentId) {
            const pn = state.nodes.find((p) => p.id === n.parentId);
            return {
              ...n,
              parentId: undefined,
              position: {
                x: (pn ? pn.position.x : 0) + n.position.x,
                y: (pn ? pn.position.y : 0) + n.position.y,
              },
            };
          }
          return n;
        }),
    }));

    retireFolders(get().currentProjectId, dissolvedNames);
    const dissolvedGroupNames = groups.filter((g) => affectedGroupIds.has(g.id)).map((g) => g.name);
    get().showToast(`已解散分组「${dissolvedGroupNames.join('、')}」`);
  },

  createEmptyGroup: (position) => {
    const { groups } = get();
    const color = '';
    let groupName = '分组';
    for (let i = 2; groups.some((g) => g.name === groupName); i++) groupName = `分组 ${i}`;
    const groupId = `group-${generateId()}`;

    get().commitToHistory();
    set((state) => ({
      groups: [...state.groups, { id: groupId, name: groupName, nodeIds: [], color, createdAt: Date.now() }],
      // 分组节点必须排在子节点之前（xyflow 要求）
      nodes: [
        {
          id: groupId,
          type: 'group' as const,
          position,
          data: { label: groupName, type: 'comment' as const, groupId, color, groupCollapsed: true },
          style: { ...COLLAPSED_GROUP_SIZE },
          ...COLLAPSED_GROUP_SIZE,
        },
        ...state.nodes,
      ],
    }));

    void ensureGroupFolder(get().currentProjectId, groupName);
    get().showToast(`已创建「${groupName}」`);
  },

  toggleGroupCollapsed: (groupId) => {
    const groupNode = get().nodes.find((n) => n.id === groupId && n.type === 'group');
    if (!groupNode) return;
    const collapsed = groupNode.data.groupCollapsed === true;
    const childIds = new Set(get().nodes.filter((n) => n.parentId === groupId).map((n) => n.id));
    const expanded = groupNode.data.groupExpandedSize;
    const currentSize = {
      width: Number(groupNode.width ?? groupNode.style?.width ?? groupNode.measured?.width) || 320,
      height: Number(groupNode.height ?? groupNode.style?.height ?? groupNode.measured?.height) || 200,
    };
    const nextSize = collapsed ? expanded ?? currentSize : COLLAPSED_GROUP_SIZE;

    get().commitToHistory();
    set((state) => ({
      nodes: state.nodes.map((n) => {
        if (n.id !== groupId) {
          // 折叠后组内节点看不见了，不能继续留在选区里
          return collapsed || !childIds.has(n.id) || !n.selected ? n : { ...n, selected: false };
        }
        return {
          ...n,
          width: nextSize.width,
          height: nextSize.height,
          style: { ...n.style, ...nextSize },
          data: {
            ...n.data,
            groupCollapsed: collapsed ? undefined : true,
            groupExpandedSize: collapsed ? expanded : currentSize,
          },
        };
      }),
      selectedNodeIds: collapsed
        ? state.selectedNodeIds
        : state.selectedNodeIds.filter((id) => !childIds.has(id)),
    }));
  },

  setGroupColor: (groupId, color) => {
    if (!get().groups.some((g) => g.id === groupId)) return;
    get().commitToHistory();
    set((state) => ({
      groups: state.groups.map((g) => (g.id === groupId ? { ...g, color } : g)),
      nodes: state.nodes.map((n) => (n.id === groupId
        ? { ...n, data: { ...n.data, color } }
        : n)),
    }));
  },

  renameGroup: (id, name) => {
    const oldName = get().groups.find((g) => g.id === id)?.name;
    if (!oldName || oldName === name) return;
    if (get().groups.some((group) => group.id !== id && sanitizeFolderName(group.name) === sanitizeFolderName(name))) {
      get().showToast('分组名称已存在', 'error');
      return;
    }

    get().commitToHistory();
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? { ...g, name } : g)),
      // 分组节点的 label 是显示与持久化的来源，一并改掉
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: name } } : n)),
    }));

    const projectId = get().currentProjectId;
    retireFolders(projectId, [oldName]);
    // 逐文件提交引用迁移，完成后只清理空目录。
    void ensureGroupFolder(projectId, name).then(() => {
      if (get().currentProjectId === projectId) return get().syncGroupFiles();
    });
  },

  syncGroupFiles: async () => {
    if (syncingGroupFiles) return;
    const projectId = get().currentProjectId;
    if (!projectId) return;
    const guard = registerCanvasImport(get());
    if (!guard) return;
    syncingGroupFiles = true;
    try {
      const projectDir = await getProjectDataDir(projectId);
      if (!projectDir || !isCanvasDerivationFresh(guard, get())) return;
      await relocateGroupedFiles(projectId, projectDir, guard, set, get);
      if (!isCanvasDerivationFresh(guard, get())) return;
      if (await get().saveCurrentProjectSilent() !== projectId) return;
      for (const name of retiredFolders.get(projectId) ?? []) {
        if (!isCanvasDerivationFresh(guard, get())) return;
        if (!get().groups.some((group) => sanitizeFolderName(group.name) === sanitizeFolderName(name))) {
          await removeEmptyProjectGroupFolder(projectDir, name);
        }
        retiredFolders.get(projectId)?.delete(name);
      }
    } catch {
      if (get().currentProjectId === projectId) get().showToast('分组文件归档未完成，原文件已保留，请重试', 'error');
    } finally {
      completeCanvasDerivation(guard);
      syncingGroupFiles = false;
    }
  },
  };
};


