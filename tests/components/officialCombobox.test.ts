/**
 * 官方「国家 / 地区 · 城市 · 语言」三种下拉的契约。
 *
 * 用户口径（2026，给了官方三张图）：
 *   「图1-3 是官方 国家 城市 语言的 下拉形式 现在MTV的完全不对」
 *
 * 官方真值（`web/resources/web/assets/index-BiTZf8mJ.js`）：
 *   · `PSl` @12018716 国家：cmdk Command + Popover，带搜索行
 *       trigger  `flex h-9 w-full items-center justify-between gap-2 whitespace-nowrap px-3 py-2
 *                 transition-colors hover:bg-white/10 disabled:… [&[data-state=open]>svg]:rotate-180`
 *                 + `!found && !value` ⇒ `text-secondary-accent`
 *       content  `w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border-solid
 *                 border border-white/5 bg-popover p-0 text-popover-foreground shadow-md`
 *       input    placeholder = `settings.searchCountry`「搜索国家…」，`className="h-9"`
 *       list     `max-h-[260px] gap-0 px-0 py-1`
 *       item     cmdk 基线 `rounded-sm px-2 py-1.5 text-sm`
 *                + `data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground`
 *                + 右侧 `Check ml-auto h-4 w-4`（选中 opacity-100 / 否则 0）
 *       empty    `py-6 text-center text-sm text-muted-foreground`
 *   · `TSl` @12017267 城市：同上 + `cityUseCustom`「使用「{city}」」自定义项 + 按国家过滤
 *   · 语言 @12037509：Radix Select，**无搜索行**，`Yze` 顺序（English 在前），行右侧 ✓
 *   · 存/显分离：`value` = **英文名**（`englishName` / `name`），显示 = **本地化名**
 *
 * 数据真值：国家 = i18n-iso-countries 的 en/zh/ja/ko 四表（各 250 条）；
 *          城市 = `r9t` 243 条 + `SSl` 242 条。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CITY_NAMES, COUNTRY_NAMES_EN, COUNTRY_NAMES_JA, COUNTRY_NAMES_KO, COUNTRY_NAMES_ZH,
  OFFICIAL_CITIES, cityOptions, countryCodeOf, countryOptions, locationLocale,
} from '../../src/data/locations';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const COMBOBOX = 'src/components/shared/OfficialCombobox.tsx';
const CSS = 'src/styles/official-combobox.css';
const PAGE = 'src/components/settings/AccountSettings.tsx';
const DATA = 'src/data/locations.ts';

function cssBlock(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `找不到 ${selector}`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at)).replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('国家 / 城市 · 官方数据表', () => {
  it('四语国家表各 250 条，且键集合完全一致', () => {
    const en = Object.keys(COUNTRY_NAMES_EN);
    expect(en).toHaveLength(250);
    expect(Object.keys(COUNTRY_NAMES_ZH)).toHaveLength(250);
    expect(Object.keys(COUNTRY_NAMES_JA)).toHaveLength(250);
    expect(Object.keys(COUNTRY_NAMES_KO)).toHaveLength(250);
    expect(Object.keys(COUNTRY_NAMES_ZH).sort()).toEqual([...en].sort());
  });

  it('抽查官方用词（`TW` = 中国台湾省、`XK` = 科索沃、`US` = 美国、`CN` 是 ISO 官方全名）', () => {
    expect(COUNTRY_NAMES_ZH.TW).toBe('中国台湾省');
    expect(COUNTRY_NAMES_ZH.XK).toBe('科索沃');
    expect(COUNTRY_NAMES_ZH.US).toBe('美国');
    expect(COUNTRY_NAMES_EN.CN).toBe("People's Republic of China,China");
    expect(COUNTRY_NAMES_ZH.CN).toBe('中国');
  });

  it('城市 243 条 + 本地化 242 条，抽查与官方截图首屏一致', () => {
    expect(OFFICIAL_CITIES).toHaveLength(243);
    expect(Object.keys(CITY_NAMES)).toHaveLength(242);
    expect(OFFICIAL_CITIES[0]).toEqual({ name: 'New York', countryCode: 'US' });
    expect(CITY_NAMES['Abu Dhabi']).toMatchObject({ zh: '阿布扎比', ja: 'アブダビ', ko: '아부다비' });
  });

  it('`countryOptions`：value = 英文名、label = 本地化名，按本地化名 localeCompare 排序', () => {
    const zh = countryOptions('zh');
    expect(zh).toHaveLength(250);
    expect(zh[0].label).toBe('阿尔巴尼亚');
    expect(zh[0].value).toBe('Albania');
    /* 官方截图首屏前 7 行逐字 */
    expect(zh.slice(0, 7).map((o) => o.label)).toEqual([
      '阿尔巴尼亚', '阿尔及利亚', '阿富汗', '阿根廷', '阿拉伯撒哈拉民主共和国', '阿联酋', '阿鲁巴',
    ]);
    const sorted = [...zh].sort((a, b) => a.label.localeCompare(b.label, 'zh', { sensitivity: 'base' }));
    expect(zh.map((o) => o.label)).toEqual(sorted.map((o) => o.label));
  });

  it('`cityOptions`：不选国家 = 全部 243；城市表首屏与官方截图一致', () => {
    const zh = cityOptions('zh');
    expect(zh).toHaveLength(243);
    expect(zh.slice(0, 7).map((o) => o.label)).toEqual([
      '阿布贾', '阿布扎比', '阿德莱德', '阿克拉', '阿姆斯特丹', '埃德蒙顿', '艾哈迈达巴德',
    ]);
    expect(zh[0].value).toBe('Abuja');
  });

  it('`cityOptions`：选了国家只出该国城市（官方 `r9t.filter(countryCode === m)`）', () => {
    const cn = cityOptions('zh', 'People\'s Republic of China,China');
    expect(cn.length).toBeGreaterThan(0);
    expect(cn.every((o) => OFFICIAL_CITIES.some((c) => c.name === o.value && c.countryCode === 'CN'))).toBe(true);
    const jp = cityOptions('zh', 'Japan');
    expect(jp.map((o) => o.value)).toContain('Tokyo');
    expect(jp.map((o) => o.value)).not.toContain('Beijing');
  });

  it('`countryCodeOf` 反查英文名 → ISO（对应官方 `getAlpha2Code`）', () => {
    expect(countryCodeOf('Japan')).toBe('JP');
    expect(countryCodeOf('  China ')).toBe(undefined); // 表里 CN 的英文名是那串 ISO 全名
    expect(countryCodeOf(undefined)).toBe(undefined);
  });

  it('语言 → 官方四表之一', () => {
    expect(locationLocale('zh-CN')).toBe('zh');
    expect(locationLocale('ja-JP')).toBe('ja');
    expect(locationLocale('ko-KR')).toBe('ko');
    expect(locationLocale('en-US')).toBe('en');
  });
});

describe('OfficialCombobox · 结构对齐官方 `PSl`/`TSl`', () => {
  it('触发器：role=combobox + `data-state` + 文字 span + 右侧 chevron', () => {
    const src = read(COMBOBOX);
    expect(src).toContain('role="combobox"');
    expect(src).toContain("data-state={open ? 'open' : 'closed'}");
    expect(src).toContain('className="o-combobox__value"');
    expect(src).toContain('o-combobox__chevron');
    /* 图标**内联**（不是 `<Icon icon="lucide:chevron-down" />`）：Iconify 走网络异步，
       首帧缺席会把后面的文字推位（用户 2026 实测反馈） */
    expect(src).toContain('<ChevronIcon />');
    expect(src).toContain('m6 9l6 6l6-6');
  });

  it('面板：portal 到 body + 宽度与触发器相同 + `sideOffset={4}`', () => {
    const src = read(COMBOBOX);
    expect(src).toContain('createPortal(');
    expect(src).toContain('document.body');
    expect(src).toContain('width: r.width');
    expect(src).toContain('top: r.bottom + 4');
  });

  it('搜索行：magnifier + `searchPlaceholder`；语言那种传 `searchable={false}` 就没有', () => {
    const src = read(COMBOBOX);
    expect(src).toContain('<SearchIcon />');
    expect(src).toContain('m21 21l-4.34-4.34');
    expect(src).toContain('placeholder={searchPlaceholder}');
    expect(src).toMatch(/searchable && \(/);
  });

  it('行：truncate 标签 + 右侧 ✓ + 高亮项 `is-active`', () => {
    const src = read(COMBOBOX);
    expect(src).toContain('o-combobox__item-label');
    expect(src).toContain('o-combobox__check');
    expect(src).toContain('<CheckIcon on={isSelected} />');
    expect(src).toContain("`o-combobox__check${on ? ' is-on' : ''}`");
    expect(src).toContain('`o-combobox__item${row === activeIndex ? \' is-active\' : \'\'}`');
    expect(src).toContain('`o-combobox__item${activeIndex === 0 ? \' is-active\' : \'\'}`');
  });

  it('过滤 = 官方那套「本地化名 + 英文名」拼接后 includes；搜索词驱动', () => {
    const src = read(COMBOBOX);
    expect(src).toContain('`${item.label} ${item.value}`');
    expect(src).toContain('item.label.toLowerCase() === customValue.toLowerCase()');
  });

  it('自定义项（官方 `cityUseCustom` 的 `A`）：输入非空且列表里没有同名才出现', () => {
    const src = read(COMBOBOX);
    expect(src).toContain('showCustom');
    expect(src).toContain('customValue.length > 0');
    expect(src).toContain('customLabel!(customValue)');
  });

  it('键盘 = cmdk：↑↓ 循环 / Enter 选中 / Esc 关闭', () => {
    const src = read(COMBOBOX);
    expect(src).toContain("event.key === 'ArrowDown'");
    expect(src).toContain("event.key === 'ArrowUp'");
    expect(src).toContain("event.key === 'Enter'");
    expect(src).toContain("event.key !== 'Escape'");
    expect(src).toContain('(prev + 1) % rowCount');
  });

  it('外部点击用标记类名判（portal 不在触发器里）', () => {
    const src = read(COMBOBOX);
    expect(src).toContain("closest('.o-combobox')");
  });
});

describe('OfficialCombobox · CSS 逐字对齐官方原子', () => {
  it('触发器：h-9 / px-3 py-2 / gap-2 / hover 白 10% / 空值 #646464 / 开启时 chevron 转 180', () => {
    const css = read(CSS);
    const trigger = cssBlock(css, '.o-combobox__trigger');
    expect(trigger).toContain('height: 36px');
    expect(trigger).toContain('padding: 8px 12px');
    expect(trigger).toContain('gap: 8px');
    expect(trigger).toContain('white-space: nowrap');
    expect(css).toContain('.o-combobox__trigger:hover { background: rgba(255, 255, 255, 0.1); }');
    expect(cssBlock(css, '.o-combobox__trigger.is-empty')).toContain('color: #646464');
    expect(css).toContain(".o-combobox__trigger[data-state='open'] .o-combobox__chevron { transform: rotate(180deg); }");
  });

  it('面板：rounded-md(10) + border-white/5 + bg-popover + p-0 + shadow-md', () => {
    const panel = cssBlock(read(CSS), '.o-combobox__panel');
    expect(panel).toContain('padding: 0');
    expect(panel).toContain('border-radius: 10px');
    expect(panel).toContain('rgba(255, 255, 255, 0.05)');
    expect(panel).toContain('var(--popover, #262626)');
    expect(panel).toContain('var(--shadow-md');
  });

  it('搜索行：px-3 + 下边框 + 图标 mr-2 opacity-50 + 输入 h-9 text-sm', () => {
    const search = cssBlock(read(CSS), '.o-combobox__search');
    expect(search).toContain('padding: 0 12px');
    expect(search).toContain('border-bottom: 1px solid var(--border');
    const icon = cssBlock(read(CSS), '.o-combobox__search-icon');
    expect(icon).toContain('margin-right: 8px');
    expect(icon).toContain('opacity: 0.5');
    const input = cssBlock(read(CSS), '.o-combobox__input');
    expect(input).toContain('height: 36px');
    expect(input).toContain('font-size: 14px');
  });

  it('列表 max-h-260 + p-1；行 rounded-sm(8) + px-2 py-1.5 + text-sm + 高亮 bg-accent', () => {
    expect(cssBlock(read(CSS), '.o-combobox__list')).toContain('max-height: 260px');
    const item = cssBlock(read(CSS), '.o-combobox__item');
    expect(item).toContain('padding: 6px 8px');
    expect(item).toContain('border-radius: 8px');
    expect(item).toContain('font-size: 14px');
    const active = cssBlock(read(CSS), '.o-combobox__item.is-active');
    expect(active).toContain('var(--accent, #404040)');
    expect(active).toContain('var(--accent-foreground, #fafafa)');
  });

  it('✓：ml-auto + 选中 opacity-1 / 否则 0；空态 py-6 居中 muted', () => {
    const check = cssBlock(read(CSS), '.o-combobox__check');
    expect(check).toContain('margin-left: auto');
    expect(check).toContain('opacity: 0');
    expect(cssBlock(read(CSS), '.o-combobox__check.is-on')).toContain('opacity: 1');
    const empty = cssBlock(read(CSS), '.o-combobox__empty');
    expect(empty).toContain('padding: 24px 0');
    expect(empty).toContain('text-align: center');
    expect(empty).toContain('var(--muted-foreground, #7a7a7a)');
  });

  it('字段皮肤 = 官方 `L6`（rounded-lg / white-10 边 / white-5 底 / 14px）', () => {
    const field = cssBlock(read(CSS), '.o-combobox--field .o-combobox__trigger');
    expect(field).toContain('border: 1px solid rgba(255, 255, 255, 0.1)');
    expect(field).toContain('border-radius: 12px');
    expect(field).toContain('rgba(255, 255, 255, 0.05)');
    expect(field).toContain('font-size: 14px');
  });

  it('CSS 已被 index.css 引入', () => {
    expect(read('src/index.css')).toContain("@import './styles/official-combobox.css';");
  });
});

describe('账户管理 · 三处接线', () => {
  it('国家 / 城市 / 语言都换成 `OfficialCombobox`，旧的 `Select` 与自造短名单全删', () => {
    const page = code(read(PAGE));
    expect(page).toContain("import OfficialCombobox from '../shared/OfficialCombobox';");
    expect(page).toContain('id="account-country"');
    expect(page).toContain('id="account-city"');
    expect(page).toContain('id="account-language"');
    expect(page.match(/<OfficialCombobox/g)).toHaveLength(3);
    expect(page).not.toContain("from '../shared/Select'");
    for (const dead of ['const COUNTRIES', 'const CITIES', 'withCurrent']) {
      expect(page, `${dead} 应该已删`).not.toContain(dead);
    }
  });

  it('占位符与空态走官方 i18n key', () => {
    const page = read(PAGE);
    expect(page).toContain("placeholder={t('国家')}");
    expect(page).toContain("searchPlaceholder={t('搜索国家…')}");
    expect(page).toContain("emptyText={t('未找到国家。')}");
    expect(page).toContain("placeholder={t('城市')}");
    expect(page).toContain("searchPlaceholder={t('搜索城市…')}");
    expect(page).toContain("emptyText={t('未找到城市。')}");
    expect(page).toContain("customLabel={(input) => t('使用「{city}」', { city: input })}");
    expect(page).toContain("placeholder={t('请选择语言')}");
    /* 语言那处**没有搜索行**（官方是 Radix Select）*/
    expect(page).toMatch(/searchable=\{false\}/);
  });

  it('语言行序按官方 `Yze`（English 在前），并去掉法语', () => {
    const page = read(PAGE);
    expect(page).toContain("const LANGUAGE_ORDER: Locale[] = ['en-US', 'zh-CN', 'ja-JP', 'ko-KR'];");
    expect(page).toContain('options={LANGUAGE_ORDER.map((code) => ({ value: code, label: LOCALE_LABELS[code] }))}');
    expect(page).not.toContain("'fr-FR'");
  });

  it('国家/城市通过 `locationLocale` + 已选国家联动', () => {
    const page = read(PAGE);
    expect(page).toContain('countryOptions(locLocale)');
    expect(page).toContain('cityOptions(locLocale, draft.country)');
  });

  it('六条新词条已进 en/ja/ko 字典', () => {
    const keys = ['搜索国家…', '搜索城市…', '未找到国家。', '未找到城市。', '使用「{city}」', '请选择语言'];
    for (const loc of ['en-US', 'ja-JP', 'ko-KR']) {
      const src = read(`src/i18n/locales/${loc}/settings.ts`);
      for (const k of keys) expect(src, `${loc} 缺 ${k}`).toContain(`'${k}':`);
    }
  });

  it('数据文件来自官方，不是自造（文件头写明出处 + 关键常量都在）', () => {
    const data = read(DATA);
    expect(data).toContain('index-BiTZf8mJ.js');
    for (const name of ['COUNTRY_NAMES_EN', 'COUNTRY_NAMES_ZH', 'COUNTRY_NAMES_JA', 'COUNTRY_NAMES_KO',
      'OFFICIAL_CITIES', 'CITY_NAMES', 'countryOptions', 'cityOptions', 'countryCodeOf', 'locationLocale']) {
      expect(data, `缺 ${name}`).toContain(name);
    }
  });
});
