/**
 * 「账户管理」与「简体中文」语言弹层的契约。
 *
 * 用户口径（2026，给了两张官方截图）：
 *   ·「接错了 设置按钮的弹窗里 先接入简体中文 和账户管理  点击简体中文 出现弹窗
 *      点击账户设置后 弹窗 的个人页面及页面内容 （放在mtv 通用设置 常规 上方）」
 *   ·「简体中文里 不要法语」
 *   ·「咱本地归本地 但是 你这个 是纯忽悠人 图2是官方的」
 *     ⇒ 第一版按「精简版」只做了 4 项被判定为**忽悠人**，必须按官方 JSX **逐字重建**。
 *
 * 官方真值：
 *   · 语言列表 = `Yze`（`index-BiTZf8mJ.js`）去掉法语 ⇒ 正好等于 MTV 的 `LOCALES`。
 *   · 「个人简介」页 JSX（同一 chunk，`settings.personalIntroTitle` 附近）：
 *       `flex flex-row items-start gap-6` 两栏 · 头像 `h-[180px] w-[180px] bg-muted shadow-sm`
 *       + hover `rounded-full bg-black/60` 遮罩 + `h-8 w-8` 相机图标 ·
 *       右栏 `flex min-w-0 flex-1 flex-col gap-4` · 字段 `flex flex-col gap-2` ·
 *       国家/城市 `grid sm:grid-cols-2` · 「+」`h-7 w-7 rounded-md` ·
 *       必填星号 `text-destructive` · 保存成功 `settings.profileSaveSuccess`
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_LABELS } from '../../src/i18n';

const read = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

const NAV = 'src/components/settings/SettingsNavigation.tsx';
const PAGE = 'src/components/settings/AccountSettings.tsx';
const SIDEBAR = 'src/components/Sidebar.tsx';
const CSS = 'src/styles/settings-panel.css';

/** 去掉注释后的源码 —— 文件头会**提到**「没移植的官方字段」，whole-file 匹配会误判 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function cssBlock(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `找不到 ${selector}`).toBeGreaterThan(-1);
  /* 剥注释：规则块里的说明文字会**提到被换掉的旧 token**（例：「之前写成 --o-foreground」），
     不剥的话 `not.toMatch` 会被自己写的注释误伤。 */
  return css.slice(at, css.indexOf('}', at)).replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('账户管理 · 导航落点', () => {
  it('「账户管理」在导航里排在「常规」**上方**（用户原话）', () => {
    const nav = read(NAV);
    const account = nav.indexOf("id: 'account'");
    const general = nav.indexOf("id: 'general'");
    expect(account).toBeGreaterThan(-1);
    expect(general).toBeGreaterThan(-1);
    expect(account, '账户管理必须在常规之前').toBeLessThan(general);
  });

  it('设置页签类型里有 `account`，且面板会渲染它', () => {
    expect(read('src/store/store.ui.ts')).toMatch(/\|\s*'account'/);
    const panel = read('src/components/SettingsPanel.tsx');
    expect(panel).toContain("import AccountSettings from './settings/AccountSettings';");
    expect(panel).toContain("activeTab === 'account' && <AccountSettings />");
  });

  it('导航项按用户 2026 改名：账户管理 → 个人设置，常规 → 常规设置', () => {
    const nav = read(NAV);
    expect(nav).toContain("label: '个人设置'");
    expect(nav).toContain("label: '常规设置'");
    /* 页头与导航同名（同一页两个名字会打架） */
    expect(read('src/components/settings/GeneralSettings.tsx')).toContain("t('常规设置')");
  });

  it('左栏滚动条 = **原生细灰条**，不是 MTV 那条发蓝紫的全局悬浮滑条', () => {
    /* 用户 2026：「这里的滑条颜色！！！」（`--scrollbar-thumb:#3a3a50`）。
       口径同 `canvas-nav.css` 的 `.project-list`。 */
    expect(read(NAV)).toContain('data-overlay-scrollbar="off"');
    const css = read(CSS);
    expect(css).toMatch(/\.settings-panel-nav\s*\{[^}]*scrollbar-color:\s*rgb\(64, 64, 64\) transparent/);
    expect(css).toMatch(/\.settings-panel-nav\[data-overlay-scrollbar='off'\]\s*\{[^}]*scrollbar-width:\s*thin !important/);
  });
});

describe('齿轮弹窗 · 先接入简体中文与账户管理', () => {
  it('菜单里两项都在，「简体中文」在「账户管理」前、二者都在「设置」前', () => {
    const side = read(SIDEBAR);
    const body = side.slice(side.indexOf('function AvatarMenuBody'));
    const lang = body.indexOf('avatar-menu-item-label');
    const account = body.indexOf("t('账户管理')");
    const settings = body.indexOf("t('设置')");
    expect(lang, '语言行').toBeGreaterThan(-1);
    expect(account, '账户管理行').toBeGreaterThan(-1);
    expect(lang).toBeLessThan(account);
    expect(account).toBeLessThan(settings);
    /* 语言行带 chevron + aria-haspopup，点开的是语言弹层；账户管理点开设置面板 */
    expect(body).toContain('aria-haspopup="listbox"');
    expect(body).toContain('avatar-menu-item-chevron');
  });

  it('「账户管理」点开的是设置面板的 account 页', () => {
    expect(read(SIDEBAR)).toContain("setSettingsOpen(true, 'account')");
  });
});

describe('语言 · 内容与官方配方', () => {
  it('列表按官方 `Yze` 排序（English 在前），且**没有法语**', () => {
    expect(Array.from(LOCALES)).toEqual(['zh-CN', 'en-US', 'ja-JP', 'ko-KR']);
    expect(LOCALE_LABELS['ja-JP']).toBe('日本語');
    expect(LOCALE_LABELS['ko-KR']).toBe('한국어');
    for (const file of [PAGE, SIDEBAR]) {
      /* 注释里会**提到**官方那行法语（说明为什么去掉）⇒ 先剥注释再断言 */
      expect(code(read(file)), `${file} 不该出现 fr-FR`).not.toMatch(/fr-FR|Fran[çc]ais/);
    }
    /* 2026：账户页那处按官方 `Yze` 顺序；齿轮里的弹层仍复用 `LOCALES` */
    expect(read(PAGE)).toContain('LANGUAGE_ORDER');
    expect(read(SIDEBAR)).toContain('LOCALES.map');
  });

  it('齿轮里的语言弹层用官方那套 token（bg #1F1F1F · border-white/10 · rounded-xl · hover #404040）', () => {
    const flyout = read('src/styles/sidebar.css');
    const menu = cssBlock(flyout, '.avatar-submenu');
    expect(menu).toMatch(/var\(--menu-bg/);
    expect(menu).toMatch(/var\(--popover-border/);
    expect(menu).toMatch(/var\(--popover-radius/);
    expect(cssBlock(flyout, '.avatar-submenu-item')).toMatch(/var\(--popover-item-radius/);
    expect(flyout).toMatch(/\.avatar-submenu-item\[data-checked\]/);
  });
});

describe('个人简介页 · 逐字对齐官方（图2）', () => {
  it('两栏版式：左 180×180 头像 + 右表单列，字段竖排 gap 8', () => {
    const css = read(CSS);
    expect(cssBlock(css, '.account-form')).toMatch(/flex-direction:\s*row/);
    expect(cssBlock(css, '.account-form')).toMatch(/align-items:\s*flex-start/);
    const avatar = cssBlock(css, '.account-avatar-preview');
    expect(avatar).toMatch(/width:\s*180px/);
    expect(avatar).toMatch(/height:\s*180px/);
    expect(avatar).toMatch(/border-radius:\s*9999px/);
    expect(avatar).toMatch(/var\(--muted/); /* 官方 bg-muted */
    expect(cssBlock(css, '.account-avatar-preview > img')).toMatch(/object-fit:\s*cover/);
    expect(cssBlock(css, '.account-avatar-fallback')).toMatch(/var\(--primary/); /* 官方 bg-primary */
    expect(cssBlock(css, '.account-fields')).toMatch(/gap:\s*16px/);
    expect(cssBlock(css, '.account-field-row')).toMatch(/gap:\s*8px/);
    /* hover 遮罩：官方 `rounded-full bg-black/60`，默认透明、hover 才出来 */
    const overlay = cssBlock(css, '.account-avatar-overlay');
    expect(overlay).toMatch(/border-radius:\s*9999px/);
    expect(overlay).toMatch(/rgba\(0,\s*0,\s*0,\s*0\.6\)/);
    expect(overlay).toMatch(/opacity:\s*0/);
    expect(css).toMatch(/\.account-avatar-group:hover \.account-avatar-overlay/);
  });

  it('国家/城市是官方那种 `sm:grid-cols-2` 两列', () => {
    const css = read(CSS);
    expect(cssBlock(css, '.account-grid-2')).toMatch(/grid/);
    expect(css).toMatch(/@media \(min-width:\s*640px\)[\s\S]{0,200}grid-template-columns:\s*1fr 1fr/);
  });

  it('页面字段齐全：用户名* / 个人简介 / 社交媒体 / 国家-地区 / 城市 / 身份-职业 / 显示入驻时间 / 语言 / 保存', () => {
    const page = code(read(PAGE));
    for (const label of ['用户名', '个人简介', '社交媒体', '国家 / 地区', '城市', '身份 / 职业', '显示入驻时间', '语言']) {
      expect(page, `缺字段 ${label}`).toContain(`t('${label}')`);
    }
    expect(page).toContain('official/OfficialControls'); // 用官方皮控件
    expect(page).toContain('OfficialTextarea');
    expect(page).toContain('OfficialSwitch');
    /* 必填星号（官方 `text-destructive`）*/
    expect(page).toContain('account-required');
    expect(read(CSS)).toMatch(/\.account-required \{[^}]*var\(--destructive/);
    /* 保存 + 官方成功提示 */
    expect(page).toContain("t('保存')");
    expect(page).toContain("t('资料已更新')");
  });

  it('社交媒体是「输入框 + 右侧「+」+ chip 列表」，且 + 按钮用官方几何', () => {
    const page = code(read(PAGE));
    expect(page).toContain('account-social-add');
    expect(page).toContain('account-social-chips');
    expect(page).toContain('socialLinks');
    const add = cssBlock(read(CSS), '.account-social-add');
    expect(add).toMatch(/width:\s*28px/); /* h-7 w-7 */
    expect(add).toMatch(/height:\s*28px/);
    expect(add).toMatch(/border-radius:\s*6px/); /* rounded-md */
    expect(add).toMatch(/right:\s*4px/); /* right-1 */
  });
});

/**
 * 第二轮用户反馈（对照官方图2）：「颜色不对 · 个人简介下面的框是固定的 ·
 * 国家 城市 语言的下拉菜单全部不对」。
 * 真值来自官方共用字段皮肤 `L6`（`index-BiTZf8mJ.js`）与标签皮肤 `v3`。
 */
describe('个人简介页 · 字段皮肤与下拉（第二轮反馈）', () => {
  it('字段皮肤 = 官方共用 `L6`：bg-white/5 + border-white/10 + rounded-lg(12) + 高 36 + 无投影', () => {
    const css = read(CSS);
    const skin = cssBlock(css, '.account-fields .o-input,\n.account-fields .o-input--textarea');
    expect(skin).toMatch(/height:\s*36px/);
    expect(skin).toMatch(/rgba\(255,\s*255,\s*255,\s*0\.10\)/); /* border-white/10 */
    expect(skin).toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\)/); /* bg-white/5 —— 不是透明 */
    expect(skin).toMatch(/border-radius:\s*12px/); /* rounded-lg = var(--radius) */
    expect(skin).toMatch(/box-shadow:\s*none/);
    /* Select 触发器和输入框同一层皮肤（官方也给它挂 L6）*/
    const trigger = cssBlock(css, '.account-fields .ui-select--custom .ui-select__trigger');
    expect(trigger).toMatch(/height:\s*36px/);
    expect(trigger).toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.05\)/);
    expect(trigger).toMatch(/border-radius:\s*12px/);
    /* 触发器不许再挂 o-select-trigger（透明底 + 硬边）*/
    expect(code(read(PAGE))).not.toContain('OFFICIAL_SELECT_TRIGGER');
  });

  it('个人简介框**固定 160px 且不可拖拽**（官方 h-40 + resize-none）', () => {
    const css = read(CSS);
    const bio = cssBlock(css, '.account-fields .o-input--textarea.account-bio');
    expect(bio).toMatch(/height:\s*160px/);
    expect(bio).toMatch(/resize:\s*none/);
    /* 选择器必须够长压过 `.o-input--textarea`（它在 official-controls.css，后引入）*/
    expect(bio).not.toMatch(/resize:\s*vertical/);
  });

  it('标签是灰的（官方 `v3` = text-muted-foreground），不是亮白', () => {
    const label = cssBlock(read(CSS), '.account-field-label');
    expect(label).toMatch(/var\(--muted-foreground/);
    expect(label).not.toMatch(/--o-foreground/);
  });

  it('2026：国家/城市/语言换成 `OfficialCombobox`，旧的 Select 补丁样式已清干净', () => {
    const page = code(read(PAGE));
    expect(page).not.toContain('account-menu');
    expect(page).not.toContain('"o-menu"');
    expect(page).toContain("import OfficialCombobox from '../shared/OfficialCombobox';");
    /* 弹层样式搬到 `official-combobox.css`（那份由 officialCombobox.test.ts 逐条锁）*/
    const css = code(read(CSS));
    expect(css).not.toContain('.account-menu');
    expect(read('src/index.css')).toContain("@import './styles/official-combobox.css';");
  });
});

describe('本地个人资料 · 落点与持久化', () => {
  it('config 有完整的本地资料字段（含社交媒体列表类型）', () => {
    const types = read('src/types/index.ts');
    for (const key of [
      'profileAvatarUrl', 'profileUsername', 'profileBio', 'profileSocialLinks',
      'profileCountry', 'profileCity', 'profileOccupation', 'profileShowJoinedDate',
    ]) {
      expect(types, `config 缺 ${key}`).toContain(key);
    }
    expect(types).toContain('export interface ProfileSocialLink');
  });

  it('点「保存」才落盘（对齐官方那颗保存按钮），走 config + saveConfig', () => {
    const page = code(read(PAGE));
    expect(page).toContain('updateConfig');
    expect(page).toContain('saveConfig');
    /* 官方必填项：用户名为空要拦下来 */
    expect(page).toContain("t('用户名不能为空')");
    /* 邮箱是官方云资料字段，本地不移植 */
    expect(page).not.toContain('profileEmail');
  });

  it('改语言走既有链路（写 config.language ⇒ store 里会 setLocale）', () => {
    /* 组合框给的是 string ⇒ 先归一成 Locale 再落盘 */
    expect(code(read(PAGE))).toMatch(/persist\(\{ language: next \}\)/);
    expect(code(read(PAGE))).toContain('normalizeLocale(value)');
    expect(read('src/store/store.config.ts')).toContain('setLocale(partial.language)');
  });

  it('空头像的兜底首字母按官方 `Ax`：没名字显示 U（不是 MTV 原来的 M）', () => {
    /* 官方 `Ax`：`y = (username?.trim()||'').charAt(0) || 'U'`，
       username = `user_name || email || 'User'` ⇒ 空名字落到 'User' ⇒ **U** */
    const page = code(read(PAGE));
    expect(page).toContain("((draft.username.trim() || 'User')[0] ?? 'U').toUpperCase()");
    expect(page).not.toContain("?? 'M'");
  });

  it('头像配色照官方：root `bg-muted`+shadow-sm，fallback `bg-primary`+`text-primary-foreground`', () => {
    /* 用户 2026 问过「MTV 这个头像的默认颜色也不对」⇒ 逐条核对后确认**官方就是 `--primary` #1fa2dc**，
       MTV 已经一致（实测 computed rgb(31,162,220)），所以这条锁住「别再改成别的色」 */
    const css = read(CSS);
    expect(cssBlock(css, '.account-avatar-preview')).toMatch(/var\(--muted/);
    expect(cssBlock(css, '.account-avatar-preview')).toMatch(/box-shadow/);
    const fb = cssBlock(css, '.account-avatar-fallback');
    expect(fb).toMatch(/var\(--primary,\s*#1fa2dc\)/);
    expect(fb).toMatch(/var\(--primary-foreground,\s*#fafafa\)/);
    expect(fb).toMatch(/font-size:\s*24px/);
    expect(fb).toMatch(/font-weight:\s*500/);
  });

  it('头像上传先缩到 ≤256，避免把原图 data URL 塞进 config', () => {
    const page = read(PAGE);
    expect(page).toMatch(/AVATAR_MAX\s*=\s*256/);
    expect(page).toContain('canvas.toDataURL');
  });
});
