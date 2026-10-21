/**
 * mentionSuggestionRows —— 官方 `Ub` 的**行模型**（`be: Row[]`）逐字移植。
 *
 * 官方出处：live `vendor-pkg-canvas-ChpWx5JY.js` @234660（`Ub` 本体）；
 * 常量在 @232859：`Zo = 3`、`$we = 300`、`Wwe = 300 * 1e3`；路径工具在 @267046：
 * `EK`(去首尾 `/`) · `rw(space, name)` · `My(path, name)` · `iw(space, asset)`。
 *
 * 官方原文（要点）：
 * ```js
 * const be = a.useMemo(() => { const Ye = [];
 *   if (Ke && W) { Ye.push({kind:"backToDirectionList"});
 *     for (const Ht of W.options) Ye.push({kind:"directionOption", option:Ht, groupId:W.id}); return Ye; }
 *   if (je) { Ye.push({kind:"backToFolders"}),
 *     m && Y && Ye.push({kind:"selectCurrentFolder", folder:Y});
 *     for (const Ht of Ce) Ye.push({kind:"subFolder", folder:Ht, path:My(Y.path, Ne(Ht)), space:Y.space});
 *     for (const Ht of it) Ye.push({kind:"folderAsset", asset:Ht, path:My(Y.path, Ht.name)});
 *     return Ye; }
 *   const vt = j ? Oe : Oe.slice(0, Zo);
 *   for (const Ht of vt) Ye.push({kind:"linked", item:Ht});
 *   !j && Oe.length > Zo && Ye.push({kind:"showMoreLinked"});
 *   if (v) { …plugin / showMorePlugins… }
 *   if (i) { …privateElement / showMorePrivateElements / teamElement / showMoreTeamElements… }
 *   if (!r) { Ze && N && !Z && N.forEach(g => Ye.push({kind:"directionGroup", group:g})); return Ye; }
 *   if (Z) { …privateAsset / showMorePrivate / teamAsset / showMoreTeam… }
 *   else   { …privateFolder / showMorePrivateFolders / teamFolder / showMoreTeamFolders… }
 *   Ze && N && !Z && N.forEach(g => Ye.push({kind:"directionGroup", group:g})); return Ye;
 * }, [je, Ke, W, Ce, it, D, j, Oe, r, Z, O, Ue, U, Ge, me, He, Y, Ne, Ze, N, v, Re, i, G, et, H, Fe, m]);
 * ```
 * 键盘索引 `We`（@1010 起）：被 `getDisabledAssetTypes()` 命中的 `linked` 行返回 **-1**
 * （渲染时 `data-selectable-index={disabled ? undefined : globalIndex}` + `opacity-35 cursor-not-allowed`）
 * ⇒ **禁用的行不参与键盘选中**，但仍占据 `be` 里的位置。
 *
 * ⚠️ 如实说明：MTV 目前没有「素材库 / 元素库 / 插件 / 指令」这些域数据，
 * 因此本模块只负责**把官方行模型与上限语义逐字落地**，数据由调用方注入；
 * `MentionSuggestionPanel` 是否切到该模型，是后续接线（见契约文档 §8.5）。
 */

/** 官方 `Zo`：每个分组「先展示 3 条 + 1 条 showMore」。 */
export const MENTION_SECTION_LIMIT = 3;
/** 官方 `$we`。 */
export const MENTION_SEARCH_LIMIT = 300;
/** 官方 `Wwe`。 */
export const MENTION_TIMEOUT_MS = 300 * 1000;

/** 官方 `EK`：去掉首尾 `/`。 */
export function normalizeMentionPathSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

/** 官方 `rw(space, name)`：`${space}:/${EK(name)}`（空则 `${space}:/`）。 */
export function mentionFolderPath(space: string, name: string): string {
  const segment = normalizeMentionPathSegment(name);
  return segment ? `${space}:/${segment}` : `${space}:/`;
}

/** 官方 `My(path, name)`：把 `path` 尾部 `/` 去掉再拼 `${EK(name)}`（无 `path` 时前缀 `library:`）。 */
export function joinMentionLibraryPath(path: string, name: string): string {
  const base = path.trim().replace(/\/+$/g, '');
  const segment = normalizeMentionPathSegment(name);
  return segment ? `${base || 'library:'}/${segment}` : base || 'library:/';
}

/** 官方 `iw(space, asset)`：资产行路径 = `${space}:${folderDisplayPath|folderName 归一化}` 再 `My(…, asset.name)`。 */
export function mentionAssetPath(
  space: string,
  asset: { folderDisplayPath?: string; folderName?: string; name: string },
): string {
  const folder = (asset.folderDisplayPath || asset.folderName || '').trim();
  const base = folder ? `${space}:${folder.startsWith('/') ? folder : `/${folder}`}` : `${space}:/`;
  return joinMentionLibraryPath(base, asset.name);
}

export interface MentionLinkedItem {
  id: string;
  label?: string;
  description?: string;
  type?: string;
  avatar?: string;
  videoSrc?: string;
}
export interface MentionPluginItem {
  pluginName: string;
  label?: string;
  [key: string]: unknown;
}
export interface MentionElementItem {
  id: string;
  label?: string;
  [key: string]: unknown;
}
export interface MentionLibraryAsset {
  id: string;
  name: string;
  folderDisplayPath?: string;
  folderName?: string;
  [key: string]: unknown;
}
export interface MentionLibraryFolder {
  id: string;
  name: string;
  [key: string]: unknown;
}
export interface MentionDirectionOption {
  id: string;
  [key: string]: unknown;
}
export interface MentionDirectionGroup {
  id: string;
  options: MentionDirectionOption[];
  [key: string]: unknown;
}
export interface MentionCurrentFolder {
  id: string;
  name: string;
  path: string;
  space: string;
}

/** 官方 `Ub` 内部全部标志（键名即官方符号，便于对照）。 */
export interface MentionRowState {
  /** `je`：处于文件夹下钻（面包屑视图）。 */
  folderDrilldown: boolean;
  /** `Ke && W`：处于某个指令组下钻；`W` 为当前指令组。 */
  activeDirectionGroup: MentionDirectionGroup | null;
  /** `Y`：当前文件夹。 */
  currentFolder: MentionCurrentFolder | null;
  /** `Ce`：当前文件夹的子文件夹。 */
  subFolders: readonly MentionLibraryFolder[];
  /** `it`：当前文件夹的资产。 */
  folderAssets: readonly MentionLibraryAsset[];
  /** `Oe` + `j`：已连接节点与「展开更多」。 */
  linked: readonly MentionLinkedItem[];
  linkedExpanded: boolean;
  /** `Re` + `D`：插件与「展开更多」。 */
  plugins: readonly MentionPluginItem[];
  pluginsExpanded: boolean;
  /** `et`/`Fe` + `G`/`H`：私有/团队元素与「展开更多」。 */
  privateElements: readonly MentionElementItem[];
  privateElementsExpanded: boolean;
  teamElements: readonly MentionElementItem[];
  teamElementsExpanded: boolean;
  /** `Ue`/`Ge` + `O`/`U`：私有/团队资产与「展开更多」。 */
  privateAssets: readonly MentionLibraryAsset[];
  privateAssetsExpanded: boolean;
  teamAssets: readonly MentionLibraryAsset[];
  teamAssetsExpanded: boolean;
  /** `me`/`He`：私有/团队文件夹（文件夹列表态）。 */
  privateFolders: readonly MentionLibraryFolder[];
  teamFolders: readonly MentionLibraryFolder[];
  /** `N` + `Ze` + `Z`：指令分组、是否有指令、资产库是否处于「资产列表」态。 */
  directions: readonly MentionDirectionGroup[];
  /** `Z`：`true` = 资产列表态；`false` = 文件夹列表态。 */
  assetListView: boolean;
  /** 官方 props 直通。 */
  enableAssetLibrary: boolean;
  enableElementLibrary: boolean;
  showPlugins: boolean;
  selectFolders: boolean;
  /** 官方 `Ne(folder)`：文件夹显示名。 */
  displayName: (folder: MentionLibraryFolder) => string;
}

export type MentionRow =
  | { kind: 'backToDirectionList' }
  | { kind: 'directionOption'; option: MentionDirectionOption; groupId: string }
  | { kind: 'backToFolders' }
  | { kind: 'selectCurrentFolder'; folder: MentionCurrentFolder }
  | { kind: 'subFolder'; folder: MentionLibraryFolder; path: string; space: string }
  | { kind: 'folderAsset'; asset: MentionLibraryAsset; path: string }
  | { kind: 'linked'; item: MentionLinkedItem }
  | { kind: 'showMoreLinked' }
  | { kind: 'plugin'; plugin: MentionPluginItem }
  | { kind: 'showMorePlugins' }
  | { kind: 'privateElement'; item: MentionElementItem }
  | { kind: 'showMorePrivateElements' }
  | { kind: 'teamElement'; item: MentionElementItem }
  | { kind: 'showMoreTeamElements' }
  | { kind: 'directionGroup'; group: MentionDirectionGroup }
  | { kind: 'privateAsset'; asset: MentionLibraryAsset; path: string }
  | { kind: 'showMorePrivate' }
  | { kind: 'teamAsset'; asset: MentionLibraryAsset; path: string }
  | { kind: 'showMoreTeam' }
  | { kind: 'privateFolder'; folder: MentionLibraryFolder; path: string; space: string }
  | { kind: 'showMorePrivateFolders' }
  | { kind: 'teamFolder'; folder: MentionLibraryFolder; path: string; space: string }
  | { kind: 'showMoreTeamFolders' };

/** 官方 `be`：把各域数据拍平成有序行序列（含 `Zo=3` 的截断与 showMore 行）。 */
export function buildMentionRows(state: MentionRowState): MentionRow[] {
  const rows: MentionRow[] = [];
  const {
    folderDrilldown, activeDirectionGroup, currentFolder, subFolders, folderAssets,
    linked, linkedExpanded, plugins, pluginsExpanded,
    privateElements, privateElementsExpanded, teamElements, teamElementsExpanded,
    privateAssets, privateAssetsExpanded, teamAssets, teamAssetsExpanded,
    privateFolders, teamFolders, directions, assetListView,
    enableAssetLibrary, enableElementLibrary, showPlugins, selectFolders, displayName,
  } = state;

  /* ① 指令组下钻 */
  if (activeDirectionGroup) {
    rows.push({ kind: 'backToDirectionList' });
    for (const option of activeDirectionGroup.options) {
      rows.push({ kind: 'directionOption', option, groupId: activeDirectionGroup.id });
    }
    return rows;
  }

  /* ② 文件夹下钻（面包屑「返回 / 当前文件夹 / 引用当前文件夹」+ 子文件夹 + 资产） */
  if (folderDrilldown) {
    rows.push({ kind: 'backToFolders' });
    if (selectFolders && currentFolder) rows.push({ kind: 'selectCurrentFolder', folder: currentFolder });
    for (const folder of subFolders) {
      rows.push({
        kind: 'subFolder',
        folder,
        path: joinMentionLibraryPath(currentFolder?.path ?? '', displayName(folder)),
        space: currentFolder?.space ?? 'private',
      });
    }
    for (const asset of folderAssets) {
      rows.push({ kind: 'folderAsset', asset, path: joinMentionLibraryPath(currentFolder?.path ?? '', asset.name) });
    }
    return rows;
  }

  /* ③ 已连接节点 */
  for (const item of (linkedExpanded ? linked : linked.slice(0, MENTION_SECTION_LIMIT))) {
    rows.push({ kind: 'linked', item });
  }
  if (!linkedExpanded && linked.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMoreLinked' });

  /* ④ 应用（插件） */
  if (showPlugins) {
    for (const plugin of (pluginsExpanded ? plugins : plugins.slice(0, MENTION_SECTION_LIMIT))) {
      rows.push({ kind: 'plugin', plugin });
    }
    if (!pluginsExpanded && plugins.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMorePlugins' });
  }

  /* ⑤ 元素库（私有 / 团队） */
  if (enableElementLibrary) {
    for (const item of (privateElementsExpanded ? privateElements : privateElements.slice(0, MENTION_SECTION_LIMIT))) {
      rows.push({ kind: 'privateElement', item });
    }
    if (!privateElementsExpanded && privateElements.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMorePrivateElements' });
    for (const item of (teamElementsExpanded ? teamElements : teamElements.slice(0, MENTION_SECTION_LIMIT))) {
      rows.push({ kind: 'teamElement', item });
    }
    if (!teamElementsExpanded && teamElements.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMoreTeamElements' });
  }

  /* ⑥ 没有资产库时，只出指令分组 */
  if (!enableAssetLibrary) {
    if (directions.length > 0 && !assetListView) {
      for (const group of directions) rows.push({ kind: 'directionGroup', group });
    }
    return rows;
  }

  /* ⑦ 资产库 · 资产列表态 / ⑧ 资产库 · 文件夹列表态 */
  if (assetListView) {
    for (const asset of (privateAssetsExpanded ? privateAssets : privateAssets.slice(0, MENTION_SECTION_LIMIT))) {
      rows.push({ kind: 'privateAsset', asset, path: mentionAssetPath('private', asset) });
    }
    if (!privateAssetsExpanded && privateAssets.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMorePrivate' });
    for (const asset of (teamAssetsExpanded ? teamAssets : teamAssets.slice(0, MENTION_SECTION_LIMIT))) {
      rows.push({ kind: 'teamAsset', asset, path: mentionAssetPath('team', asset) });
    }
    if (!teamAssetsExpanded && teamAssets.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMoreTeam' });
  } else {
    for (const folder of (privateAssetsExpanded ? privateFolders : privateFolders.slice(0, MENTION_SECTION_LIMIT))) {
      rows.push({ kind: 'privateFolder', folder, path: mentionFolderPath('private', displayName(folder)), space: 'private' });
    }
    if (!privateAssetsExpanded && privateFolders.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMorePrivateFolders' });
    for (const folder of (teamAssetsExpanded ? teamFolders : teamFolders.slice(0, MENTION_SECTION_LIMIT))) {
      rows.push({ kind: 'teamFolder', folder, path: mentionFolderPath('team', displayName(folder)), space: 'team' });
    }
    if (!teamAssetsExpanded && teamFolders.length > MENTION_SECTION_LIMIT) rows.push({ kind: 'showMoreTeamFolders' });
  }

  /* ⑨ 指令分组放最后 */
  if (directions.length > 0 && !assetListView) {
    for (const group of directions) rows.push({ kind: 'directionGroup', group });
  }
  return rows;
}

/**
 * 官方 `We` 的单行判定：每行对应的**可选索引**；被禁用资产类型命中的 `linked` 行为 `-1`。
 *
 * 官方原文逐字：`if (row.kind === "linked" && row.item.type && S?.has(row.item.type)) return -1;`
 * ⇒ **`item.type` 为空的行永不因禁用而失选**（`S` 即 `getDisabledAssetTypes()`，
 * 所以这里的 `hasDisabledType` 只需要是那个 Set 的 `has`）。
 */
export function mentionRowSelectableIndex(
  rows: readonly MentionRow[],
  index: number,
  hasDisabledType: (item: MentionLinkedItem) => boolean,
): number {
  const row = rows[index];
  if (!row) return -1;
  if (row.kind === 'linked' && row.item.type && hasDisabledType(row.item)) return -1;
  return index;
}

/** 官方面板渲染用的整表映射（`be.map((row, index) => …)`）。 */
export function mentionRowSelectableIndices(
  rows: readonly MentionRow[],
  hasDisabledType: (item: MentionLinkedItem) => boolean,
): number[] {
  return rows.map((_, index) => mentionRowSelectableIndex(rows, index, hasDisabledType));
}
