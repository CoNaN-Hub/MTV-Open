// @vitest-environment jsdom
/**
 * 官方图标工厂的**类名契约**回归（覆盖表 §13.4 / §20：`TablerSvg` 的 `iconName` 缺口）。
 *
 * 官方图标工厂（vendor-libs 逐字）：
 * ```js
 * function p(prefix, name, pascal, node) { return (props) => createElement('svg', {
 *   className: ['tabler-icon', 'tabler-icon-' + name, props.className].join(' '), … }) }
 * ```
 * ⇒ **每一个** Tabler 图标在官方 DOM 里都带 `tabler-icon tabler-icon-<name>` 两个类。
 * MTV 的 `TablerSvg` 只在传了 `iconName` 时才补这两个类，本文件逐个锁住**已核实**的那些。
 *
 * 核实方式（双重证据，见覆盖表 §21 / §23）：
 *   ① 本文件注释里写明该官方符号等价的图标名；
 *   ② 用图标内联的**全部图元**（`<path d>`，必要时含 `rect`/`circle`）去 `vendor-libs` 的两套官方工厂
 *      定义里做**唯一命中**匹配：tabler `p("outline"|"filled", name, "Pascal", node)`、
 *      lucide `L(name, node)`。
 * 只写唯一命中的；`OfficialPencilIcon` / `OfficialMusicIcon` 在官方两套工厂里都查不到同形图标
 * ⇒ **一律不写**（宁缺勿猜）。
 * 验证分级 = **(b) jsdom 真 DOM**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import * as officialIcons from '../../src/components/chat/officialIcons';

afterEach(cleanup);

/** [组件名, 官方图标名] —— 全部经「路径全集唯一命中官方工厂」核实（tabler 工厂
 *  `p("outline", name, "Pascal", node)` / lucide 工厂 `L(name, node)`）。 */
const VERIFIED: Array<[keyof typeof officialIcons, string]> = [
  ['OfficialChevronDownIcon', 'chevron-down'],
  ['OfficialMoreVerticalIcon', 'dots'],
  ['OfficialTablerTrashIcon', 'trash'],
  ['OfficialTablerPencilIcon', 'pencil'],
  ['OfficialTablerPlusIcon', 'plus'],
  ['OfficialTablerEyeIcon', 'eye'],
  ['OfficialTablerChevronRightIcon', 'chevron-right'],
  ['OfficialChevronLeftIcon', 'chevron-left'],
  ['OfficialArrowNarrowRightIcon', 'arrow-narrow-right'],
  ['OfficialFileTextIcon', 'file-text'],
  ['OfficialFileIcon', 'file'],
  ['OfficialMarkdownIcon', 'markdown'],
  ['OfficialCsvIcon', 'file-type-csv'],
  ['OfficialHtmlIcon', 'file-type-html'],
  ['OfficialPhotoIcon', 'photo'],
  ['OfficialCircleCheckIcon', 'circle-check'],
  ['OfficialTablerCheckIcon', 'check'],
  ['OfficialLoader2Icon', 'loader-2'],
  ['OfficialGripVerticalIcon', 'grip-vertical'],
  ['OfficialMessageIcon', 'message'],
  ['OfficialVideoIcon', 'video'],
  ['OfficialCircleIcon', 'circle'],
];

/** lucide 工厂（`L(name, node)`）的图标：类串 = `lucide` + `lucide-<kebab>` + `lucide-<name>`（去重）。 */
const VERIFIED_LUCIDE: Array<[keyof typeof officialIcons, string]> = [
  ['OfficialPaperclipIcon', 'paperclip'],
  ['OfficialForkIcon', 'split'],
  ['OfficialTrashIcon', 'trash'],
  ['OfficialCopyIcon', 'copy'],
  ['OfficialCheckIcon', 'check'],
  ['OfficialThumbsUpIcon', 'thumbs-up'],
  ['OfficialThumbsDownIcon', 'thumbs-down'],
  ['OfficialGaugeIcon', 'gauge'],
  ['OfficialHistoryIcon', 'message-square-plus'],
  ['OfficialCollapseChatIcon', 'minimize-2'],
  ['OfficialLoaderCircleIcon', 'loader-circle'],
  ['OfficialCircleAlertIcon', 'circle-alert'],
  ['OfficialArrowDownIcon', 'arrow-down'],
];

/** 复刻官方 `Mct`（去重 join）与 `eMa`/`kze`。 */
function lucideClass(name: string): string {
  const pascal = name.replace(/^[a-z]|[\s-_]+(\w)/g, (m, g: string | undefined) => (g ? g.toUpperCase() : m.toUpperCase()));
  const kebab = pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return ['lucide', `lucide-${kebab}`, `lucide-${name}`]
    .filter((value, index, all) => all.indexOf(value) === index)
    .join(' ');
}

describe('officialIcons —— 官方图标工厂的类名契约', () => {
  it.each(VERIFIED)('tabler：%s 带 `tabler-icon tabler-icon-%s`，自定义 className 追加在末尾', (component, name) => {
    const Icon = officialIcons[component] as (props: { className?: string }) => React.ReactElement;
    const { container } = render(<Icon className="extra-cls" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    /* 官方工厂就是拼数组 join(' ') ⇒ 顺序与分隔逐字一致。 */
    expect(svg!.getAttribute('class')).toBe(`tabler-icon tabler-icon-${name} extra-cls`);
  });

  it.each(VERIFIED_LUCIDE)('lucide：%s 带 `%s` 系类串（`lucide` 开头、自定义 className 在末尾）', (component, name) => {
    const Icon = officialIcons[component] as (props: { className?: string }) => React.ReactElement;
    const { container } = render(<Icon className="extra-cls" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('class')).toBe(`${lucideClass(name)} extra-cls`);
  });

  it('`minimize-2` 的两个 token 都出（官方 `Mct` 去重但不去连字符）', () => {
    const { container } = render(<officialIcons.OfficialCollapseChatIcon />);
    expect(container.querySelector('svg')!.getAttribute('class')).toBe('lucide lucide-minimize2 lucide-minimize-2');
  });

  it('未核实的一律**不写**（宁缺勿猜）：`OfficialPencilIcon` / `OfficialMusicIcon` 不带任何图标库类', () => {
    for (const Icon of [officialIcons.OfficialPencilIcon, officialIcons.OfficialMusicIcon]) {
      const { container } = render(<Icon className="extra-cls" />);
      expect(container.querySelector('svg')!.getAttribute('class')).toBe('extra-cls');
    }
  });
});
