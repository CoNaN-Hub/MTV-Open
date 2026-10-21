// @vitest-environment jsdom
/**
 * 官方 `Ub`（`@` 建议弹层）**完整渲染树**的真实 DOM 回归（jsdom）。
 *
 * 全部断言对着官方源码逐条落（`D:\DEEPSEEK\_ub_fmt.txt` 行号见各用例注释）：
 *  · 不可用文案分支（2068–2080）        · 空态分支（1735–1764）
 *  · `Am` 滚动壳 + 容器级 `onMouseMove` 悬停（`Ct`，1144–1197）
 *  · 文件夹下钻分支（1858–2080）        · 指令组下钻分支（1765–1857）
 *  · 主分支五段顺序与 `Su` 插值文案（2086–2911）
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MentionSuggestionPanel, {
  type MentionPanelFolder,
  type MentionPanelPlugin,
  type MentionSuggestionPanelProps,
} from '../../src/components/chat/MentionSuggestionPanel';
import type { MentionSuggestionItem } from '../../src/components/chat/createMentionExtension';

afterEach(cleanup);

/** 官方 `Qa`（行基类）。 */
const ROW_CLASS = 'flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left transition-colors rounded-[6px] cursor-pointer hover:bg-white/10';

const item = (id: string): MentionSuggestionItem => ({ id, label: `节点${id}` });

/** 渲染一个「只传 items」的默认面板。 */
function renderPanel(overrides: Partial<MentionSuggestionPanelProps> = {}) {
  const onSelect = vi.fn();
  const onHover = vi.fn();
  const props = {
    items: [] as readonly MentionSuggestionItem[],
    selectedIndex: -1,
    onSelect,
    onHover,
    emptyLabel: '',
    ...overrides,
  };
  const view = render(<MentionSuggestionPanel {...props} />);
  return { ...view, onSelect, onHover };
}

describe('官方 Ub 渲染树：① 不可用文案分支（_ub_fmt.txt 2068–2080）', () => {
  it('只渲染 `_j`/`_h` 外壳 + `px-3 py-3 text-[13px] leading-[18px] text-white/40`，没有 `data-mention-panel`', () => {
    const { container } = renderPanel({ mentionUnavailableMessage: '当前模型不支持 @' });
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('text-white rounded-[16px] overflow-hidden backdrop-blur-[28px]');
    expect(root.getAttribute('data-mention-panel')).toBeNull();
    const body = root.firstElementChild as HTMLElement;
    expect(body.className).toBe('px-3 py-3 text-[13px] leading-[18px] text-white/40');
    expect(body.textContent).toBe('当前模型不支持 @');
    /* 该分支不渲染 `sw` / `Am`。 */
    expect(container.querySelector('.flex.min-h-0.flex-1.flex-col.gap-2.p-2')).toBeNull();
    expect(container.querySelector('.overflow-y-auto')).toBeNull();
  });
});

describe('官方 Ub 渲染树：② 空态分支（1735–1764）', () => {
  it('`enableAssetLibrary` 关闭时不渲染 `qr` 搜索行，并使用官方空态文案', () => {
    const { container } = renderPanel();
    const root = container.querySelector('[data-mention-panel]') as HTMLElement;
    expect(root.className).toContain('max-h-[320px]');
    expect(container.querySelector('input')).toBeNull();
    const empty = container.querySelector('.px-1.py-3') as HTMLElement;
    expect(empty.className).toBe('px-1 py-3 text-[14px] text-[rgba(255,255,255,0.4)]');
    /* 未注入 `emptyLabel` ⇒ 走官方 `omniReference.suggestion.noResults`（zh-CN「暂无结果」）。 */
    expect(empty.textContent).toBe('暂无结果');
  });

  it('`enableAssetLibrary` 打开时 `qr` 出现（placeholder = `library.search`）、根高 `h-[320px]`', () => {
    const { container } = renderPanel({ enableAssetLibrary: true });
    const root = container.querySelector('[data-mention-panel]') as HTMLElement;
    expect(root.className).toBe(
      'text-white rounded-[16px] overflow-hidden backdrop-blur-[28px] flex flex-col w-[320px] h-[320px]',
    );
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).not.toBeNull();
    /* 官方 `C("library.search")` → zh-CN「搜索」。 */
    expect(input.getAttribute('placeholder')).toBe('搜索');
    /* `Uv` 的 `barClassName={ER}` 逐字。 */
    expect(input.parentElement!.className).toContain(
      'min-w-[48px] self-stretch rounded-[12px] border-0 bg-accent px-3 py-1.5',
    );
  });
});

describe('官方 Ub 渲染树：③ 容器级悬停 `Ct`（1144–1197）', () => {
  it('`Am` 外壳存在；同坐标重复 mousemove 被去重（只触发一次）', () => {
    const { container, onHover } = renderPanel({ items: [item('1'), item('2')] });
    expect(container.querySelector('.relative.flex.min-h-0.min-w-0.flex-1.flex-col')).not.toBeNull();
    const row = container.querySelector('[data-selectable-index="1"]') as HTMLElement;
    fireEvent.mouseMove(row, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(row, { clientX: 10, clientY: 20 });
    expect(onHover).toHaveBeenCalledTimes(1);
    expect(onHover).toHaveBeenCalledWith(1);
  });

  it('未命中 `[data-selectable-index]`（标题区）时不改选中', () => {
    const { container, onHover } = renderPanel({ items: [item('1')] });
    const title = container.querySelector('p') as HTMLElement;
    fireEvent.mouseMove(title, { clientX: 5, clientY: 5 });
    expect(onHover).not.toHaveBeenCalled();
  });

  it('命中禁用行（`data-selectable-index` 缺失）时不变选，且行带官方禁用类串', () => {
    const { container, onHover } = renderPanel({
      items: [{ id: 'a', label: '视频节点', type: 'attachment', description: 'video' }],
      getDisabledAssetTypes: () => new Set(['attachment']),
    });
    const row = container.querySelector('button') as HTMLElement;
    expect(row.getAttribute('data-selectable-index')).toBeNull();
    expect(row.className).toContain('opacity-35 cursor-not-allowed');
    fireEvent.mouseMove(screen.getByText('视频节点'), { clientX: 1, clientY: 1 });
    expect(onHover).not.toHaveBeenCalled();
  });
});

describe('官方 Ub 渲染树：④ 文件夹下钻分支（1858–2080）', () => {
  const rootFolder: MentionPanelFolder = { id: 'f1', name: '角色' };
  const subFolder: MentionPanelFolder = { id: 'f2', name: '子文件夹' };
  const asset = { id: 'a1', name: '素材A' };

  /** 点进私有文件夹行（主分支 → 下钻）。 */
  const drillIn = (getByIndex: (index: string) => HTMLElement) => {
    fireEvent.click(getByIndex('0'));
  };

  it('面包屑：返回按钮（index 0）+ 文件夹名 + `selectFolders` 时的「引用当前文件夹」（index 1）+ 图标', () => {
    const { container } = renderPanel({
      enableAssetLibrary: true,
      selectFolders: true,
      privateFolders: [rootFolder],
      folders: [subFolder],
      assets: [asset],
    });
    drillIn((index) => container.querySelector(`[data-selectable-index="${index}"]`) as HTMLElement);

    const breadcrumb = container.querySelector('.flex.h-8.w-full.min-w-0.items-center.gap-1.px-1') as HTMLElement;
    expect(breadcrumb).not.toBeNull();
    const back = container.querySelector('[data-selectable-index="0"]') as HTMLElement;
    expect(back.tagName).toBe('BUTTON');
    expect(back.className).toBe(
      'group flex size-8 shrink-0 items-center justify-center rounded-[8px] text-white/60 transition-colors hover:bg-white/10 hover:text-white/90',
    );
    expect(back.getAttribute('aria-label')).toBe('返回: 角色');
    expect(back.getAttribute('title')).toBe('返回');
    /* 官方 `Vi`（Tabler chevron-left）内联。 */
    expect(back.querySelector('svg.tabler-icon-chevron-left')).not.toBeNull();
    expect(breadcrumb.querySelector('span')!.className).toBe(
      'min-w-0 flex-1 truncate px-1 text-[13px] font-medium leading-5 text-white/80',
    );
    const reference = container.querySelector('[data-selectable-index="1"]') as HTMLElement;
    expect(reference.textContent).toBe('Reference folder');
    expect(reference.className).toBe(
      'inline-flex h-8 shrink-0 items-center gap-1 rounded-[8px] border border-white/[0.08] bg-white/[0.04] px-2 text-xs font-medium leading-5 text-white/70 transition-colors hover:border-white/[0.12] hover:bg-white/10 hover:text-white/90',
    );
    /* 官方 `dd` 文件夹图标（20 视框）。 */
    expect(reference.querySelector('svg[viewBox="0 0 20 20"]')).not.toBeNull();
  });

  it('下钻区：`Cu` 分隔线 → `Ak` 子文件夹行 → `Ik` 资产行，索引偏移 = `selectFolders ? 2 : 1`', () => {
    const { container } = renderPanel({
      enableAssetLibrary: true,
      selectFolders: true,
      privateFolders: [rootFolder],
      folders: [subFolder],
      assets: [asset],
    });
    drillIn((index) => container.querySelector(`[data-selectable-index="${index}"]`) as HTMLElement);
    /* `Ak`：`group/asset-folder` + 行基类。 */
    const folderRow = container.querySelector('[data-selectable-index="2"]') as HTMLElement;
    expect(folderRow.className).toBe(`group/asset-folder ${ROW_CLASS}`);
    expect(folderRow.textContent).toBe('子文件夹');
    /* `Ik` 资产行：索引 = 0 + 偏移(2) + 子文件夹数(1)。 */
    const assetRow = container.querySelector('[data-selectable-index="3"]') as HTMLElement;
    expect(assetRow.textContent).toContain('素材A');
    /* 分隔线（`Cu`）在子文件夹与资产之间各一条。 */
    const separators = [...container.querySelectorAll('div.shrink-0')].filter((el) => (el as HTMLElement).style.height === '0.5px');
    expect(separators).toHaveLength(2);
  });

  it('`selectFolders` 关闭时无「引用当前文件夹」按钮，且索引偏移为 1', () => {
    const { container } = renderPanel({
      enableAssetLibrary: true,
      privateFolders: [rootFolder],
      folders: [subFolder],
      assets: [asset],
    });
    drillIn((index) => container.querySelector(`[data-selectable-index="${index}"]`) as HTMLElement);
    expect(container.querySelector('button[aria-label]')!.textContent).toBe('');
    expect(container.querySelector('[data-selectable-index="1"]')!.textContent).toBe('子文件夹');
    expect(container.querySelector('[data-selectable-index="2"]')!.textContent).toContain('素材A');
  });

  it('`folderAssetsLoading && assets.length === 0` 渲染 `U3`（3 行骨架，`pointer-events-none`）', () => {
    const { container } = renderPanel({
      enableAssetLibrary: true,
      privateFolders: [rootFolder],
      folders: [],
      assets: [],
      folderAssetsLoading: true,
    });
    drillIn((index) => container.querySelector(`[data-selectable-index="${index}"]`) as HTMLElement);
    const skeletons = [...container.querySelectorAll('div')].filter((el) => el.className === `${ROW_CLASS} pointer-events-none`);
    expect(skeletons).toHaveLength(3);
    /* 骨架块走官方 `$n`（`animate-pulse rounded-md bg-input/30`）。 */
    expect((skeletons[0].firstElementChild as HTMLElement).className).toContain('animate-pulse rounded-md bg-input/30');
  });

  it('下钻后「返回」按钮把视图还原回主分支', () => {
    const { container } = renderPanel({
      enableAssetLibrary: true,
      privateFolders: [rootFolder],
      folders: [subFolder],
    });
    drillIn((index) => container.querySelector(`[data-selectable-index="${index}"]`) as HTMLElement);
    expect(container.querySelector('.flex.h-8.w-full.min-w-0.items-center.gap-1.px-1')).not.toBeNull();
    fireEvent.click(container.querySelector('[data-selectable-index="0"]') as HTMLElement);
    expect(container.querySelector('.flex.h-8.w-full.min-w-0.items-center.gap-1.px-1')).toBeNull();
    expect(container.textContent).toContain('个人素材库');
  });
});

describe('官方 Ub 渲染树：⑤ 指令组下钻分支（1765–1857）', () => {
  const groups = [
    {
      id: 'duration',
      label: '时长',
      options: [
        { id: 'o1', label: '选项一' },
        { id: 'o2', label: '选项二' },
      ],
    },
  ];

  it('首行是「返回指令列表」（index 0，文案 = group.label），option 行索引 = i+1；且官方此处根节点不带 `data-mention-panel`', () => {
    const { container } = renderPanel({ getDirectionItems: () => groups });
    fireEvent.click(container.querySelector('[data-selectable-index="0"]') as HTMLElement);

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute('data-mention-panel')).toBeNull();
    const back = container.querySelector('[data-selectable-index="0"]') as HTMLElement;
    expect(back.className).toBe(ROW_CLASS);
    expect(back.textContent).toBe('时长');
    expect(back.querySelector('svg.tabler-icon-chevron-left')).not.toBeNull();
    expect(container.querySelector('[data-selectable-index="1"]')!.textContent).toBe('选项一');
    expect(container.querySelector('[data-selectable-index="2"]')!.textContent).toBe('选项二');
    /* 指令组下钻的 `Am` 用 `gap-[2px]`（官方 1885/1785）。 */
    expect((container.querySelector('.overflow-y-auto') as HTMLElement).className).toContain('gap-[2px]');
  });

  it('点击 option 走 `onSelect`（官方 `Ee` 构造的 `direction_option:` item），点返回还原', () => {
    const { container, onSelect } = renderPanel({ getDirectionItems: () => groups });
    fireEvent.click(container.querySelector('[data-selectable-index="0"]') as HTMLElement);
    fireEvent.click(container.querySelector('[data-selectable-index="2"]') as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith({
      id: 'direction_option:o2',
      label: '选项二',
      type: 'direction_duration',
      renderText: 'direction:duration:o2:选项二',
    });
  });
});

describe('官方 Ub 渲染树：⑥ 主分支分区顺序与文案（2086–2911）', () => {
  it('分组标题顺序 = 已连接节点 → 应用 → 个人主体/团队主体 → 个人素材库/团队素材库 → 指令', () => {
    const plugins: MentionPanelPlugin[] = [{ pluginName: 'p1', displayName: '插件A' }];
    const { container } = renderPanel({
      items: [item('1')],
      showPlugins: true,
      plugins,
      enableElementLibrary: true,
      privateElements: [{ id: 'e1', label: '元素A' }],
      teamElements: [{ id: 'e2', label: '元素B' }],
      enableAssetLibrary: true,
      /* 官方 `bn = Z ? Ue.length>0 : me.length>0`：无搜索时资产库走「文件夹列表态」⇒ 注入文件夹。 */
      privateFolders: [{ id: 'pf1', name: '我的文件夹' }],
      teamFolders: [{ id: 'tf1', name: '团队文件夹' }],
      getDirectionItems: () => [{ id: 'duration', label: '时长', options: [] }],
    });
    expect([...container.querySelectorAll('p')].map((el) => el.textContent)).toEqual([
      '已连接节点',
      '应用',
      '个人主体',
      '团队主体',
      '个人素材库',
      '团队素材库',
      '指令',
    ]);
    /* 分组之间用官方 `Cu`（0.5px）分隔。 */
    const separators = [...container.querySelectorAll('div.shrink-0')].filter((el) => (el as HTMLElement).style.height === '0.5px');
    expect(separators.length).toBeGreaterThanOrEqual(4);
  });

  it('`Xp` 标题 hint：linked 分组带 `linkedNodeShortcutHint`，其它分组无 hint', () => {
    const { container, } = renderPanel({
      items: [item('1')],
      showPlugins: true,
      plugins: [{ pluginName: 'p1', displayName: '插件A' }],
    });
    const [linkedHeader, pluginHeader] = [...container.querySelectorAll('p')].map((el) => el.parentElement as HTMLElement);
    expect(linkedHeader.className).toBe('flex items-center justify-between gap-2 px-1 py-1');
    const hint = linkedHeader.querySelector('span') as HTMLElement;
    expect(hint.className).toBe('shrink-0 text-[11px] font-normal leading-[1.3] tracking-normal text-white/30');
    expect(hint.textContent).toBe('输入序号快选');
    expect(pluginHeader.querySelector('span')).toBeNull();
  });

  it('`Su` showMore 行的 `{{count}}` 插值文案（`omniReference.suggestion.showMoreResults`）', () => {
    const { container } = renderPanel({
      items: [item('1'), item('2'), item('3'), item('4'), item('5')],
    });
    /* `Zo = 3` ⇒ 先渲染 3 条 + 1 条 showMore，count = 5 - 3 = 2。 */
    expect(container.querySelectorAll('[data-selectable-index]')).toHaveLength(4);
    const showMore = container.querySelector('[data-selectable-index="3"]') as HTMLElement;
    expect(showMore.className).toBe(`${ROW_CLASS} gap-[6px] text-[12px] text-[rgba(255,255,255,0.4)]`);
    expect(showMore.textContent).toBe('还有 2 个结果');
    /* 点击后展开到 5 条。 */
    fireEvent.click(showMore);
    expect(container.querySelectorAll('[data-selectable-index]')).toHaveLength(5);
  });

  it('容器级 `onMouseMove` 命中行 → 行进入选中态 `bg-white/10`', () => {
    const onHover = vi.fn();
    const setSelectedIndex = vi.fn();
    const { container } = renderPanel({
      items: [item('1'), item('2')],
      selectedIndex: 1,
      onHover,
      setSelectedIndex,
    });
    /* 命中行 → 官方 `u?.(Bt)`（MTV 侧同时回调 `onHover`）。 */
    fireEvent.mouseMove(container.querySelector('[data-selectable-index="0"]') as HTMLElement, {
      clientX: 3,
      clientY: 4,
    });
    expect(setSelectedIndex).toHaveBeenCalledWith(0);
    expect(onHover).toHaveBeenCalledWith(0);
    /* 选中态类串由受控的 `selectedIndex` 决定（官方 `cx(Qa, !Ht && vt === n && hc)`）。 */
    expect((container.querySelector('[data-selectable-index="1"]') as HTMLElement).className).toBe(`${ROW_CLASS} bg-white/10`);
  });
});

describe('官方 Ub 渲染树：⑦ 键盘 interceptor（1256–1425）', () => {
  it('安装 interceptor；Enter 在 linked 行上走 `onSelect(item)`', () => {
    const interceptorRef: { current: ((event: KeyboardEvent) => boolean) | null } = { current: null };
    const { onSelect } = renderPanel({
      items: [item('1'), item('2')],
      selectedIndex: 1,
      setKeyDownInterceptor: (interceptor) => {
        interceptorRef.current = interceptor;
      },
    });
    expect(interceptorRef.current).not.toBeNull();
    const handled = interceptorRef.current!(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(handled).toBe(true);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe('2');
  });
});
