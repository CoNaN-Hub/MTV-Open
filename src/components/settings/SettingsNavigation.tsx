/**
 * settings/SettingsNavigation — 官方设置面板的**左栏导航**（逐字照抄官方版式）
 *
 * 官方出处：`course-api-base-url-CGXqZmAy.js` 的 `settings-modal`（i18n 命名空间 `settings` → `rKs`）
 * + 9444 实测（2560×1370）。官方原文结构：
 * ```html
 * <div class="overflow-y-auto w-44 sm:w-56 bg-muted/50 flex flex-col p-4 m-0 rounded-l-2xl">
 *   <nav class="space-y-3 flex-1">
 *     <div>                                  <!-- 一组 -->
 *       <div class="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">订阅和充值</div>
 *       <div class="space-y-1">
 *         <button class="w-full flex items-center gap-2 px-3 py-2 rounded-md transition-all text-left
 *                        text-sm font-normal text-sidebar-foreground
 *                        hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
 *                 data-testid="settings-modal-nav-subscription-btn">
 *           <svg … class="… size-[18px] stroke-1 flex-shrink-0"></svg>
 *           <span class="flex items-center gap-2"><div …>订阅套餐</div></span>
 *         </button>
 *       </div>
 *     </div>
 *   </nav>
 * </div>
 * ```
 * 选中项把 `text-sidebar-foreground hover:…` 换成 `bg-sidebar-accent text-sidebar-accent-foreground`。
 * 尺寸/色值/字号/字重/hover 一律照官方（见 `styles/settings-panel.css`）。
 *
 * ⚠️ MTV 偏离（按用户 2026-09-28 的决定）：
 *   · 官方的 4 组是「订阅和充值 / 权益和账单 / 通用设置 / 帮助与支持」，装的是账号与计费；
 *     MTV 是本地桌面应用、没有账号/计费后端 ⇒ **保留官方版式，换成 MTV 自己的 4 组**：
 *       创作 / 模型与连接 / 数据 / 应用。
 *   · 官方的「画布设置」「权限」「用量看板」三项按官方原样做（用户点名）；
 *     「关于与更新」是官方「帮助与支持」组里「版本 + 点击检查更新」那一块的 MTV 落点。
 *   · 图标：官方项（画布设置 `lucide-layout-grid` / 权限 `lucide-shield-check` / 用量看板
 *     `lucide-chart-no-axes-column-increasing`）用**官方抠出来的原标记**（
 *     `data/official-settings-nav-icons.json`，含官方自绘的 18×18 订阅图标那套）；
 *     MTV 独有的项用同族 lucide 图标 + 官方同款 18px / 1px 描边。
 */
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

import OFFICIAL_NAV_ICONS from '../../data/official-settings-nav-icons.json';
import type { SettingsTab } from '../../store/store.ui';
import { useT } from '../../i18n';
import CreditBoltIcon from '../shared/CreditBoltIcon';

interface NavItem {
  id: SettingsTab;
  label: string;
  /** 官方抠出的原 SVG（`data/official-settings-nav-icons.json` 的 key）；没有就走 `iconify` */
  officialIcon?: keyof typeof OFFICIAL_NAV_ICONS;
  iconifyIcon?: string;
  /** ★ 自带图标节点（如「积分-闪电」）—— 给了它就优先，不再看上面两个 */
  customIcon?: ReactNode;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

/**
 * 分组由用户 2026 直接梳理定稿（6 组，顺序不可改）：
 *   通用设置 / 积分超市 / 账单和用量 / 模型与连接 / 数据 / 应用
 *
 * ★ 2026 追加（用户点名）：官方账号菜单里的「账户管理」个人资料页移植进来，
 *   放在 **「通用设置 · 常规」上方**（用户原话），故它是「通用设置」组的**第一项**。
 */
const SETTINGS_GROUPS: NavGroup[] = [
  {
    title: '通用设置',
    items: [
      /* ★ 图标跟着官方走（用户 2026）：官方 `userMenu.accountSettings`（账户管理）前的图标是
         `kye = g("outline","settings")`（齿轮），MTV 这一项就是「账户管理」改名来的「个人设置」
         ⇒ 用齿轮。官方 `userMenu.creatorProfile`（个人主页）前的才是 `user-round`。
         「常规设置」的图标用户说**先别动**，等他再说。 */
      { id: 'account', label: '个人设置', iconifyIcon: 'lucide:settings' },
      { id: 'general', label: '常规设置', iconifyIcon: 'lucide:settings' },
      { id: 'canvas', label: '画布设置', officialIcon: 'canvasSettings' },
    ],
  },
  {
    title: '积分超市',
    items: [
      /* 图标用用户给的「积分-闪电」（`CreditBoltIcon`，fill:currentColor ⇒ 跟着导航文字色走） */
      { id: 'credits', label: '充值积分', customIcon: <CreditBoltIcon size={18} /> },
    ],
  },
  {
    title: '账单和用量',
    items: [
      { id: 'billing', label: '账单记录', iconifyIcon: 'lucide:receipt-text' },
      { id: 'usage', label: '用量看板', officialIcon: 'usage' },
    ],
  },
  {
    title: '模型与连接',
    items: [
      { id: 'api', label: 'API Key', iconifyIcon: 'lucide:key-round' },
      /* ★ 多平台接入 / 官方名称展示：映射对照表 + 待审核（只读） */
      { id: 'modelMapping', label: '模型映射', iconifyIcon: 'lucide:tags' },
      { id: 'comfyui', label: 'ComfyUI', iconifyIcon: 'lucide:workflow' },
      { id: 'mcp', label: 'MCP 控制', iconifyIcon: 'lucide:plug-zap' },
    ],
  },
  {
    title: '数据',
    items: [
      { id: 'storage', label: '存储健康', iconifyIcon: 'lucide:database' },
      { id: 'files', label: '文件与应用', iconifyIcon: 'lucide:folder-cog' },
    ],
  },
  {
    title: '应用',
    items: [
      { id: 'plugins', label: '插件', iconifyIcon: 'lucide:blocks' },
      { id: 'shortcuts', label: '快捷键', iconifyIcon: 'lucide:keyboard' },
      { id: 'permissions', label: '权限', officialIcon: 'permissions' },
      { id: 'about', label: '关于与更新', iconifyIcon: 'lucide:info' },
    ],
  },
];

/** 官方那种「原样注入官方 SVG 标记」的图标位（`size-[18px] stroke-1` 由 CSS 兜） */
function OfficialNavIcon({ name }: { name: keyof typeof OFFICIAL_NAV_ICONS }) {
  return (
    <span
      className="settings-panel-nav-official-icon contents"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: OFFICIAL_NAV_ICONS[name] }}
    />
  );
}

function NavIcon({ item }: { item: NavItem }): ReactNode {
  if (item.customIcon) return item.customIcon;
  if (item.officialIcon) return <OfficialNavIcon name={item.officialIcon} />;
  return <Icon icon={item.iconifyIcon ?? 'lucide:circle'} width={18} height={18} aria-hidden="true" />;
}

export default function SettingsNavigation({
  activeTab,
  onSelect,
}: {
  activeTab: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
}) {
  const t = useT();
  return (
    <div
      className="settings-panel-nav"
      data-testid="settings-panel-nav"
      /* ★ 不要 MTV 那条全局悬浮滑条（`--scrollbar-thumb:#3a3a50`，发蓝紫）——
         用户 2026 点名「这里的滑条颜色！！！」。关掉悬浮层后由 CSS 给一条**原生细灰条**，
         和右栏 `.settings-content`（`data-overlay-scrollbar="off"`）同一个口径。 */
      data-overlay-scrollbar="off"
    >
      <nav>
        {SETTINGS_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="settings-panel-nav-heading">{t(group.title)}</div>
            <div className="settings-panel-nav-group">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-current={activeTab === item.id}
                  data-testid={`settings-panel-nav-${item.id}-btn`}
                  className="settings-panel-nav-item"
                  onClick={() => onSelect(item.id)}
                >
                  <NavIcon item={item} />
                  <span>{t(item.label)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
