/**
 * 官方 `Ub` 行模型（`buildMentionRows` / `mentionRowSelectableIndices`）回归。
 * 期望值来自 live `vendor-pkg-canvas-ChpWx5JY.js` @234660 的逐字行构造器。
 */
import { describe, expect, it } from 'vitest';
import {
  MENTION_SECTION_LIMIT,
  buildMentionRows,
  joinMentionLibraryPath,
  mentionAssetPath,
  mentionFolderPath,
  mentionRowSelectableIndices,
  normalizeMentionPathSegment,
  type MentionRowState,
} from '../src/components/chat/mentionSuggestionRows';

const asset = (id: string, name: string) => ({ id, name });
const group = (id: string, options: string[]) => ({ id, options: options.map((o) => ({ id: o })) });

function state(overrides: Partial<MentionRowState> = {}): MentionRowState {
  return {
    folderDrilldown: false,
    activeDirectionGroup: null,
    currentFolder: null,
    subFolders: [],
    folderAssets: [],
    linked: [],
    linkedExpanded: false,
    plugins: [],
    pluginsExpanded: false,
    privateElements: [],
    privateElementsExpanded: false,
    teamElements: [],
    teamElementsExpanded: false,
    privateAssets: [],
    privateAssetsExpanded: false,
    teamAssets: [],
    teamAssetsExpanded: false,
    privateFolders: [],
    teamFolders: [],
    directions: [],
    assetListView: false,
    enableAssetLibrary: true,
    enableElementLibrary: false,
    showPlugins: false,
    selectFolders: false,
    displayName: (f) => f.name,
    ...overrides,
  };
}

describe('mentionSuggestionRows —— 官方 Ub 行模型', () => {
  it('官方常量：`Zo=3` / `$we=300`', () => {
    expect(MENTION_SECTION_LIMIT).toBe(3);
  });

  it('路径工具逐字：`EK` / `rw` / `My` / `iw`', () => {
    expect(normalizeMentionPathSegment('  /a/b/  ')).toBe('a/b');
    expect(mentionFolderPath('private', ' /设计/ ')).toBe('private:/设计');
    expect(mentionFolderPath('team', '')).toBe('team:/');
    expect(joinMentionLibraryPath('library:/a/', 'b')).toBe('library:/a/b');
    expect(joinMentionLibraryPath('', 'b')).toBe('library:/b');
    expect(joinMentionLibraryPath('', '')).toBe('library:/');
    /* `iw("private", asset)`：有 folderDisplayPath 时拼在 space 后，再 `My(…, name)`。 */
    expect(mentionAssetPath('private', { name: 'cat.png', folderDisplayPath: '设计/动物' })).toBe('private:/设计/动物/cat.png');
    expect(mentionAssetPath('team', { name: 'cat.png', folderName: '/设计' })).toBe('team:/设计/cat.png');
    expect(mentionAssetPath('private', { name: 'cat.png' })).toBe('private:/cat.png');
  });

  it('每个分组「先 3 条 + 1 条 showMore」，展开后不再出 showMore', () => {
    const many = [1, 2, 3, 4, 5].map((n) => ({ id: `l${n}` }));
    const collapsed = buildMentionRows(state({ linked: many }));
    expect(collapsed.map((r) => r.kind)).toEqual(['linked', 'linked', 'linked', 'showMoreLinked']);
    const expanded = buildMentionRows(state({ linked: many, linkedExpanded: true }));
    expect(expanded.map((r) => r.kind)).toEqual(['linked', 'linked', 'linked', 'linked', 'linked']);
  });

  it('恰好 3 条时**不**出 showMore', () => {
    const rows = buildMentionRows(state({ linked: [1, 2, 3].map((n) => ({ id: `l${n}` })) }));
    expect(rows.map((r) => r.kind)).toEqual(['linked', 'linked', 'linked']);
  });

  it('区块顺序：linked → plugin → element → asset/folder → directionGroup，且各自带分隔/更多行', () => {
    const rows = buildMentionRows(state({
      linked: [{ id: 'a' }],
      plugins: [{ pluginName: 'p1' }, { pluginName: 'p2' }, { pluginName: 'p3' }, { pluginName: 'p4' }],
      showPlugins: true,
      enableElementLibrary: true,
      privateElements: [{ id: 'pe' }],
      teamElements: [{ id: 'te' }],
      privateFolders: [{ id: 'pf', name: 'pf' }],
      directions: [group('g1', ['o1'])],
    }));
    expect(rows.map((r) => r.kind)).toEqual([
      'linked',
      'plugin', 'plugin', 'plugin', 'showMorePlugins',
      'privateElement', 'teamElement',
      'privateFolder',
      'directionGroup',
    ]);
  });

  it('资产列表态（`Z=true`）出 private/team 资产，文件夹态出 private/team 文件夹', () => {
    const list = buildMentionRows(state({
      assetListView: true,
      privateAssets: [asset('a1', 'a.png')],
      teamAssets: [asset('b1', 'b.png')],
      privateFolders: [{ id: 'f1', name: 'f1' }],
    }));
    expect(list.map((r) => r.kind)).toEqual(['privateAsset', 'teamAsset']);
    expect(list[0]).toMatchObject({ path: 'private:/a.png' });

    const folders = buildMentionRows(state({
      assetListView: false,
      privateAssets: [asset('a1', 'a.png')],
      privateFolders: [{ id: 'f1', name: 'f1' }],
    }));
    expect(folders.map((r) => r.kind)).toEqual(['privateFolder']);
    expect(folders[0]).toMatchObject({ path: 'private:/f1', space: 'private' });
  });

  it('两个列表态都**不**渲染指令分组（官方 `Ze && N && !Z`）', () => {
    expect(buildMentionRows(state({ assetListView: true, directions: [group('g', ['o'])] })).map((r) => r.kind))
      .toEqual([]);
  });

  it('没有资产库时（`!r`）只出指令分组（前面的 linked / plugin 区块照旧先出）', () => {
    const rows = buildMentionRows(state({
      enableAssetLibrary: false,
      directions: [group('g1', ['o1', 'o2'])],
      linked: [{ id: 'a' }],
      plugins: [{ pluginName: 'p' }],
      showPlugins: true,
    }));
    /* 官方 `!r` 分支在 ③④⑤ 之后，只补「指令分组」并 return ⇒ 不会再出资产/文件夹行。 */
    expect(rows.map((r) => r.kind)).toEqual(['linked', 'plugin', 'directionGroup']);
    const bare = buildMentionRows(state({
      enableAssetLibrary: false,
      directions: [group('g1', ['o1'])],
    }));
    expect(bare.map((r) => r.kind)).toEqual(['directionGroup']);
  });

  it('文件夹下钻：`backToFolders` → (`selectCurrentFolder`) → `subFolder` → `folderAsset`', () => {
    const rows = buildMentionRows(state({
      folderDrilldown: true,
      selectFolders: true,
      currentFolder: { id: 'cur', name: '设计', path: 'private:/设计', space: 'private' },
      subFolders: [{ id: 's1', name: '动物' }],
      folderAssets: [asset('a1', 'cat.png')],
      linked: [{ id: 'ignored' }],
    }));
    expect(rows.map((r) => r.kind)).toEqual(['backToFolders', 'selectCurrentFolder', 'subFolder', 'folderAsset']);
    expect(rows[2]).toMatchObject({ path: 'private:/设计/动物', space: 'private' });
    expect(rows[3]).toMatchObject({ path: 'private:/设计/cat.png' });
    /* `selectFolders=false` 时**没有**「引用当前文件夹」那一行。 */
    const without = buildMentionRows(state({ folderDrilldown: true, selectFolders: false, currentFolder: { id: 'cur', name: 'x', path: 'private:/x', space: 'private' } }));
    expect(without.map((r) => r.kind)).toEqual(['backToFolders']);
  });

  it('指令组下钻：`backToDirectionList` + 每个 option 一行，且**短路**其它区块', () => {
    const rows = buildMentionRows(state({
      activeDirectionGroup: group('g', ['slow_motion', 'orbit']),
      linked: [{ id: 'a' }],
    }));
    expect(rows).toEqual([
      { kind: 'backToDirectionList' },
      { kind: 'directionOption', option: { id: 'slow_motion' }, groupId: 'g' },
      { kind: 'directionOption', option: { id: 'orbit' }, groupId: 'g' },
    ]);
  });

  it('键盘索引：被禁用资产类型命中的 `linked` 行为 -1，其余为自身下标', () => {
    const rows = buildMentionRows(state({
      linked: [{ id: 'a', type: 'video' }, { id: 'b', type: 'image' }],
      plugins: [{ pluginName: 'p' }],
      showPlugins: true,
    }));
    expect(rows.map((r) => r.kind)).toEqual(['linked', 'linked', 'plugin']);
    expect(mentionRowSelectableIndices(rows, (item) => item.id === 'a')).toEqual([-1, 1, 2]);
    expect(mentionRowSelectableIndices(rows, () => false)).toEqual([0, 1, 2]);
    /* 无 `type` 的 linked 行永不因禁用而变 -1（官方 `!!(row.item.type && …)`）。 */
    expect(mentionRowSelectableIndices(buildMentionRows(state({ linked: [{ id: 'a' }] })), () => true)).toEqual([0]);
    /* 有 `type` 且命中禁用集合 ⇒ -1。 */
    expect(mentionRowSelectableIndices(buildMentionRows(state({ linked: [{ id: 'a', type: 'video' }] })), () => true)).toEqual([-1]);
  });

  it('`getDisabledAssetTypes()` 为空时全部可选（官方 `S?.has` 可空）', () => {
    const rows = buildMentionRows(state({ linked: [{ id: 'a', type: 'video' }] }));
    expect(mentionRowSelectableIndices(rows, () => false)).toEqual([0]);
  });
});
