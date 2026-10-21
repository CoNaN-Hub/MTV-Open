/**
 * settings/DesktopPermissionsSettings —— 官方「通用设置 → 权限」面板的 MTV 落点
 *
 * 官方出处（`index-BsHyQ2qj.js` 的 `Lal` / `Ral` / `DQ` / `Pal`，9444 实测 + 源码逐字）：
 *   · 这一页**不用**通用设置面板的版式，它自己是居中定宽列：
 *     `div.mx-auto.flex.w-full.max-w-2xl.flex-col.gap-8`（max-w-2xl = 672px，段间距 32px）
 *   · 页头：`h2.font-semibold.text-foreground.text-xl`（20/600）+ `p.mt-1.text-sm`（14px，间距 4px）
 *     ⚠️ 不是「画布设置」那种 18/500 + 6px 间距
 *   · 分组 `DQ`：`section.space-y-3` > `div.flex.items-start.justify-between.gap-3`
 *       > `div.min-w-0.space-y-1` > `h3.font-medium.text-foreground.text-sm.tracking-tight`
 *       + `p.text-muted-foreground.text-xs.leading-5`（**12px/20**，不是 14px）
 *   · 批准方式 `Ral`：容器 `overflow-hidden rounded-xl border border-border/80 bg-muted/30`；
 *     每行 `flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition-colors`
 *       + 非末行 `border-border/70 border-b` + 选中 `bg-white/[0.04]` / 未选中 `hover:bg-muted/50`
 *     图标 `size={18} strokeWidth={1.75} className="mt-0.5 shrink-0"`，选中色 **#E8871E**，未选中 `--muted-foreground`
 *     标题 `text-[13px] font-medium leading-5`、说明 `mt-0.5 text-[12px] leading-4`（选中 `opacity-90`）
 *     尾部：选中 → `Check size={16} strokeWidth={2.25}`；未选中 → **`<span className="size-4 shrink-0" />` 占位**
 *   · 能力列表 `Pal`：行 `flex items-start gap-3 px-4 py-3.5` + `border-border/70 border-b`；
 *     图标 18/1.75 muted；标题 `font-medium text-foreground text-sm`；说明 `text-muted-foreground text-xs leading-5`；
 *     可选 `footer`（`div.pt-1.5`）；尾部是官方 **Switch**（`h-5 w-9`，`mt-0.5 shrink-0`）
 *
 * ⚠️ 与官方的语义映射（MTV 偏离，逐条记账）：
 *   1. 官方的批准方式是 2 选 1（`always_confirm` / `auto_except_delete`）；MTV 的引擎有
 *      **3 种运行模式**（`AgentMode = plan | collaborative | autonomous`）⇒ 照 MTV 的真实口径列 3 项。
 *      官方把它持久化成**本机默认偏好**（`preference.confirmationMode`）⇒ MTV 落成
 *      `config.agentDefaultMode`，用来初始化**新对话**；已有对话仍在输入栏工具条里覆盖
 *      （与官方描述「Device default for this computer. Individual chats can still override in the input toolbar.」一致）。
 *   2. 官方能力列表是 4 个**用户开关**（Local files / Open apps / Shell commands / Screen access），
 *      语义是「关掉 = 这个能力整个不可用，高风险动作仍按上面的批准方式走」。
 *      MTV 按自己的 `AgentToolEffect` 9 种列出；**同一个语义**：关掉 = Policy Engine 直接拒绝
 *      （见 `services/chat/policyEngine.ts` 的 `AGENT_TOGGLEABLE_EFFECTS`）。
 *      · `只读` / `需要你作答` 两项**不可关**（关掉只读等于把 Agent 变成废人；「需要你作答」不是能力
 *        而是交互约束）⇒ 用官方那套 `footer` 说明 + 禁用的开关呈现，不假装能拨。
 *   3. 官方的「系统级授权」「启动目录」两组（桌面通知 / 录屏 / 本地目录授权）MTV 没有对应模型
 *      ⇒ 暂不搬；MTV 的本地文件能力走 `FileAppSettings`（「文件与应用」页签）。
 */
import { useCallback, useMemo } from 'react';
import { Icon } from '@iconify/react';

import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { SettingsPaneBody } from './SettingsPane';
import { OfficialSwitch } from './official/OfficialControls';
import { AGENT_TOGGLEABLE_EFFECTS } from '../../services/chat/policyEngine';
import type { AgentToolEffect } from '../../types/agent';

/** 官方 `Ral` 里的常量（逐字）：`const NQ = "#E8871E"` */
const OFFICIAL_SELECTED_COLOR = '#E8871E';

/**
 * 官方只有两态确认模式（`chatAdapter.confirmMode.{ask,auto}`）；MTV 原有的「Plan（只读）」官方没有 ⇒ 已删除。
 *
 * ⚠️ 第 85 轮：原先这里用 MTV 自造词「协作模式 / 自主模式」+ MTV 自写说明，
 * **官方没有任何一个用户可见字符串叫「协作模式」**（官方值域是 `ask` / `auto`，
 * 官方两态表 `Qk` @188605：`{mode:"ask",labelKey:"chatAdapter.confirmMode.ask",
 * titleKey:…askTitle,descKey:…askDesc,desktopDescKey:…alwaysConfirmDescription}` /
 * `{mode:"auto",…}`）。⇒ 文案一律改走官方词典键，与 `GenerationConfirmModeSwitch.tsx`
 * 的 `MODES` 完全同源，四语逐字等于官方。
 */
const AGENT_MODES: { id: 'collaborative' | 'autonomous'; icon: string; titleKey: string; descKey: string }[] = [
  {
    id: 'collaborative',
    icon: 'lucide:hand',
    /* 官方 `chatAdapter.confirmMode.askTitle`（zh「手动确认」@4288786 / en `Ask before acting` @3592929） */
    titleKey: 'chatAdapter.confirmMode.askTitle',
    /* 官方 `chatAdapter.confirmMode.askDesc`（zh「Agent在执行生成前都会寻求您的确认」@4288869 / en @3593060） */
    descKey: 'chatAdapter.confirmMode.askDesc',
  },
  {
    id: 'autonomous',
    icon: 'lucide:zap',
    /* 官方 `chatAdapter.confirmMode.autoTitle`（zh「自动生成」@4288850 / en `Act without asking` @3593027） */
    titleKey: 'chatAdapter.confirmMode.autoTitle',
    /* 官方 `chatAdapter.confirmMode.autoDesc`（zh「Agent会自主规划生成任务并自动执行」@4288817 / en @3592972） */
    descKey: 'chatAdapter.confirmMode.autoDesc',
  },
];

interface CapabilityRow {
  id: string;
  effect: AgentToolEffect;
  icon: string;
  title: string;
  desc: string;
  /** 不可拨的开关：`true` 时开关禁用，`checked` 表示它固化的口径 */
  fixed?: { checked: boolean; reason: string };
}

/** MTV 的 `AgentToolEffect` 全量九种（`services/chat/toolRegistry.ts`） */
const CAPABILITIES: CapabilityRow[] = [
  {
    id: 'read',
    effect: 'read',
    icon: 'lucide:eye',
    title: '只读',
    desc: '读取画布、对话、历史、配置等，不改任何东西。',
    fixed: { checked: true, reason: '只读能力始终放行，不可关闭。' },
  },
  {
    id: 'user_choice',
    effect: 'user_choice',
    icon: 'lucide:circle-help',
    title: '需要你作答',
    desc: '不改任何东西，但必须由你在卡片里选一次。',
    fixed: { checked: false, reason: '需要你作答的工具在任何模式下都会等待，不可关闭。' },
  },
  { id: 'canvas_write', effect: 'canvas_write', icon: 'lucide:layout-grid', title: '画布写入', desc: '新建 / 修改 / 连接 / 删除画布节点与分组。' },
  { id: 'file_write', effect: 'file_write', icon: 'lucide:folder-open', title: '本地文件写入', desc: '在你授权的目录里读写文件。' },
  { id: 'permanent_delete', effect: 'permanent_delete', icon: 'lucide:trash-2', title: '永久删除', desc: '删除对话、历史、任务等不可撤销的数据。' },
  { id: 'media_generation', effect: 'media_generation', icon: 'lucide:sparkles', title: '媒体生成', desc: '发起图片 / 视频 / 音频生成（可能计费）。' },
  { id: 'memory_write', effect: 'memory_write', icon: 'lucide:brain', title: '项目记忆写入', desc: '写入或修改项目记忆。' },
  { id: 'config_write', effect: 'config_write', icon: 'lucide:settings', title: '配置写入', desc: '修改模型供应商配置、自定义画风等。' },
  { id: 'asset_write', effect: 'asset_write', icon: 'lucide:library', title: '资产库 / 角色库写入', desc: '写入资产库与角色库。' },
];

export default function DesktopPermissionsSettings() {
  const t = useT();
  const showToast = useAppStore((state) => state.showToast);
  const config = useAppStore((state) => state.config);
  const updateConfig = useAppStore((state) => state.updateConfig);
  const saveConfig = useAppStore((state) => state.saveConfig);

  /** 本机默认批准方式；未设置时与「新建对话」的缺省一致 */
  const defaultMode = config.agentDefaultMode ?? 'collaborative';
  const capabilities = useMemo(
    () => config.agentCapabilities ?? {},
    [config.agentCapabilities],
  );

  const persist = useCallback((patch: Parameters<typeof updateConfig>[0]) => {
    updateConfig(patch);
    void saveConfig().catch(() => undefined);
  }, [saveConfig, updateConfig]);

  const selectMode = useCallback((mode: typeof AGENT_MODES[number]) => {
    if (defaultMode === mode.id) return;
    persist({ agentDefaultMode: mode.id });
    showToast(t('默认批准方式已设为「{mode}」；已打开的对话仍在输入栏工具条里单独切换', { mode: t(mode.titleKey) }), 'success');
  }, [defaultMode, persist, showToast, t]);

  const toggleCapability = useCallback((row: CapabilityRow, next: boolean) => {
    persist({ agentCapabilities: { ...capabilities, [row.effect]: next } });
    showToast(
      next
        ? t('已开启「{name}」能力', { name: t(row.title) })
        : t('已关闭「{name}」能力；Agent 再尝试该操作会被直接拒绝', { name: t(row.title) }),
      next ? 'success' : 'info',
    );
  }, [capabilities, persist, showToast, t]);

  const toggleable = useMemo(() => new Set<string>(AGENT_TOGGLEABLE_EFFECTS), []);

  return (
    <SettingsPaneBody>
      <div className="o-perm-page">
        {/* 官方页头：`h2.font-semibold.text-foreground.text-xl` + `p.mt-1.text-sm` */}
        <div>
          <h2 className="o-perm-head-title">{t('权限')}</h2>
          <p className="o-perm-head-desc">{t('控制 MTV 桌面端 Agent 如何使用本机能力。')}</p>
        </div>

        {/* ── 分组 1：批准方式（官方 `DQ` + `Ral`） ── */}
        <section className="o-perm-section">
          <div className="o-perm-section__head">
            <div className="o-perm-section__label">
              <h3 className="o-perm-section__title">{t('应如何批准本机操作？')}</h3>
              <p className="o-perm-section__desc">
                {t('本机默认策略，用来初始化新对话。单次对话仍可在输入栏工具条中覆盖。')}
              </p>
            </div>
          </div>

          <div className="settings-perm-group" data-testid="permission-mode-picker">
            {AGENT_MODES.map((mode) => {
              const active = defaultMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`permission-mode-${mode.id}`}
                  className="settings-perm-option"
                  onClick={() => selectMode(mode)}
                >
                  {/* 官方：选中 #E8871E，未选中 `--muted-foreground` */}
                  <Icon
                    icon={mode.icon}
                    width={18}
                    height={18}
                    aria-hidden="true"
                    color={active ? OFFICIAL_SELECTED_COLOR : undefined}
                    style={active ? undefined : { color: 'var(--o-muted-foreground)' }}
                  />
                  <div className="settings-perm-option-body">
                    <div
                      className="settings-perm-option-title"
                      style={active ? { color: OFFICIAL_SELECTED_COLOR } : undefined}
                    >
                      {t(mode.titleKey)}
                    </div>
                    <div
                      className="settings-perm-option-desc"
                      style={active ? { color: OFFICIAL_SELECTED_COLOR } : undefined}
                    >
                      {t(mode.descKey)}
                    </div>
                  </div>
                  {active ? (
                    <Icon
                      icon="lucide:check"
                      width={16}
                      height={16}
                      className="settings-perm-option-check"
                      color={OFFICIAL_SELECTED_COLOR}
                      aria-hidden="true"
                    />
                  ) : (
                    /* 官方未选中时的 16×16 占位 —— 少了它会横向跑位 */
                    <span className="settings-perm-option-slot" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 分组 2：能力开关（官方 `DQ` + `Pal`） ── */}
        <section className="o-perm-section">
          <div className="o-perm-section__head">
            <div className="o-perm-section__label">
              <h3 className="o-perm-section__title">{t('Agent 可使用的本机能力')}</h3>
              <p className="o-perm-section__desc">
                {t('逐项开关本机能力；关掉后 Agent 再尝试该操作会被直接拒绝。高风险操作仍遵循上方批准方式。')}
              </p>
            </div>
          </div>

          <div className="settings-perm-group">
            {CAPABILITIES.map((capability) => {
              const disabledByConfig = capabilities[capability.effect] === false;
              const checked = capability.fixed
                ? capability.fixed.checked
                : toggleable.has(capability.effect) && !disabledByConfig;
              return (
                <div
                  key={capability.id}
                  className="settings-perm-item"
                  data-testid={`permission-capability-${capability.id}`}
                >
                  <Icon icon={capability.icon} width={18} height={18} aria-hidden="true" />
                  <div className="settings-perm-item-body">
                    <div className="settings-perm-item-title">{t(capability.title)}</div>
                    <div className="settings-perm-item-desc">{t(capability.desc)}</div>
                    {capability.fixed && (
                      <div className="settings-perm-item-footer">{t(capability.fixed.reason)}</div>
                    )}
                  </div>
                  <OfficialSwitch
                    label={t(capability.title)}
                    checked={checked}
                    disabled={Boolean(capability.fixed)}
                    onChange={(next) => toggleCapability(capability, next)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </SettingsPaneBody>
  );
}
