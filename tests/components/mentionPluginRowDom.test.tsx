// @vitest-environment jsdom
/**
 * 官方 `Ub` 的**「应用（插件）」分组行数据**回归（jsdom）。
 *
 * 官方链路（`vendor-pkg-canvas-ChpWx5JY.js` 逐字）：
 * ```
 * // `Ub` 内 `tt`（@238346）
 * tt = useCallback(Ye => o({ id: Ye.pluginName, label: Ye.displayName, type: "plugin",
 *   renderText: Pve(Ye.pluginName, C$(Ye)), description: Ye.description, pluginStatus: Ye.status,
 *   pluginIsInstalled: Ye.isInstalled, pluginSkills: Ye.skills, pluginConnectors: Ye.connectors,
 *   pluginConnectorStatus: I1(Ye, ae), pluginIconUrl: Ye.iconUrl }), [ae, o])
 * // 行渲染（@253351）：onClick: () => tt(Ye)
 * // 键盘激活（@246257 的 switch）：case "plugin": … tt(Ye)
 * ```
 * ⇒ 点行 / 键盘回车都必须把**造好的 mention 项**交给面板的 `onSelect`（不是原始 plugin 对象）。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MentionSuggestionPanel, {
  type MentionPanelPlugin,
  type MentionSuggestionPanelProps,
} from '../../src/components/chat/MentionSuggestionPanel';
import type { MentionSuggestionItem } from '../../src/components/chat/createMentionExtension';

afterEach(cleanup);

const plugin: MentionPanelPlugin = {
  pluginName: 'feishu',
  displayName: '飞书',
  description: '飞书应用',
  isInstalled: true,
  status: 'enabled',
  skills: [{ name: 'feishu' }, { name: 'doc' }],
  connectors: [{ name: 'feishu', displayName: '飞书连接器' }],
  iconUrl: 'https://cdn.example/feishu.png',
};

/** 官方 `Zo = 3`：4 条以上才会出「还有 N 个结果」。 */
const manyPlugins: MentionPanelPlugin[] = [
  plugin,
  { pluginName: 'p2', displayName: '应用二' },
  { pluginName: 'p3', displayName: '应用三' },
  { pluginName: 'p4', displayName: '应用四' },
];

function renderPanel(overrides: Partial<MentionSuggestionPanelProps> = {}) {
  const onSelect = vi.fn();
  const onHover = vi.fn();
  const view = render(
    <MentionSuggestionPanel
      items={[] as readonly MentionSuggestionItem[]}
      selectedIndex={-1}
      onSelect={onSelect}
      onHover={onHover}
      emptyLabel=""
      {...overrides}
    />,
  );
  return { ...view, onSelect, onHover };
}

/** 面板里「应用」分组的行（`Xwe` 渲染的 `<button data-selectable-index>`）。 */
function pluginRowButtons(container: HTMLElement): HTMLElement[] {
  const headers = [...container.querySelectorAll('p')];
  const pluginHeader = headers.find((el) => el.textContent === '应用');
  const section = pluginHeader?.parentElement?.parentElement;
  return section ? [...section.querySelectorAll('button')] : [];
}

describe('官方 Ub「应用」分组 —— 行数据（`tt` 逐字）', () => {
  it('未开启 `showPlugins` 时不渲染应用分组', () => {
    const { container } = renderPanel();
    expect([...container.querySelectorAll('p')].some((el) => el.textContent === '应用')).toBe(false);
  });

  it('行显示 `displayName`，并带官方 `data-selectable-index`', () => {
    const { container } = renderPanel({ showPlugins: true, plugins: [plugin] });
    const rows = pluginRowButtons(container);
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toBe('飞书');
    /* 唯一一行 ⇒ 官方 `be` 里下标 0。 */
    expect(rows[0].getAttribute('data-selectable-index')).toBe('0');
    /* 官方 `Xwe` 行基类（`Qa`）逐字。 */
    expect(rows[0].className).toBe(
      'flex items-center gap-[8px] w-full px-[8px] py-[6px] text-left transition-colors rounded-[6px] cursor-pointer hover:bg-white/10',
    );
  });

  it('点击行 ⇒ `onSelect` 收到官方 `tt` 造出的 mention 项（含 `renderText`/`pluginConnectorStatus`）', () => {
    const { container, onSelect } = renderPanel({
      showPlugins: true,
      plugins: [plugin],
      connectorStatusById: new Map([['feishu', 'authenticated']]),
    });
    fireEvent.click(pluginRowButtons(container)[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({
      id: 'feishu',
      label: '飞书',
      type: 'plugin',
      /* `C$` 挑出不在连接器名单里的第一个技能 `doc` ⇒ `Pve("feishu","doc")`。 */
      renderText: 'plugin:feishu:doc',
      description: '飞书应用',
      pluginStatus: 'enabled',
      pluginIsInstalled: true,
      pluginSkills: [{ name: 'feishu' }, { name: 'doc' }],
      pluginConnectors: [{ name: 'feishu', displayName: '飞书连接器' }],
      pluginConnectorStatus: 'authenticated',
      pluginIconUrl: 'https://cdn.example/feishu.png',
    });
  });

  it('没有连接器状态表时 `pluginConnectorStatus` 为 `undefined`（官方 `I1` 里 `t.get` 无命中）', () => {
    const { container, onSelect } = renderPanel({ showPlugins: true, plugins: [plugin] });
    fireEvent.click(pluginRowButtons(container)[0]);
    expect(onSelect.mock.calls[0][0]).toMatchObject({ pluginConnectorStatus: undefined });
  });

  it('`Zo = 3`：4 条时只出 3 行 + 1 条「还有 N 个结果」，展开后 4 行', () => {
    const { container } = renderPanel({ showPlugins: true, plugins: manyPlugins });
    const collapsed = pluginRowButtons(container);
    expect(collapsed).toHaveLength(4);
    expect(collapsed[3].textContent).toBe('还有 1 个结果');
    fireEvent.click(collapsed[3]);
    const expanded = pluginRowButtons(container);
    expect(expanded.map((row) => row.textContent)).toEqual(['飞书', '应用二', '应用三', '应用四']);
  });
});
