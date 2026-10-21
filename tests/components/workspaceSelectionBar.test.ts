/**
 * 「我的项目」多选批量条（官方 `ga`）的 1:1 契约测试。
 *
 * 用户 2026 截图对比（图1 MTV / 图2 官方）指出：中间那颗图标不对
 * （MTV 是 `tabler:users-group` 三个人；官方是 `tabler:users` 两个人）。
 * 顺带把其它几条官方口径也钉住 —— 这些都取自官方**活的 DOM 实测**：
 *   · 外层 `motion.div`：`initial {opacity:0,y:20}` → `animate {opacity:1,y:0}`，
 *     exit 反向，`transition {duration:.25,ease:"easeOut"}`（官方 `ga` 里**没有** reduced-motion 分支）
 *   · 内层 `flex items-center gap-2 px-5 py-4 rounded-2xl` + 内联
 *     `rgba(38,38,38,.5)` / `blur(44px)` / `0 4px 8px rgba(0,0,0,.3)` / `outline 1px rgba(255,255,255,.1)` offset -1
 *   · 图标路径（实测）：folder-plus `M12 19h-7a2 2 0 0 1 -2 -2v-11…` /
 *     users `M9 7m-4 0a4 4 0 1 0 8 0…` + `M16 3.13a4 4 0 0 1 0 7.75` / trash `M4 7l16 0…`
 *   · 官方 `<Tooltip delayDuration={1000}>` 包住整组 ⇒ MTV 用容器 `data-tooltip-delay="1000"` + 按钮 `data-tooltip`
 *     （原来写的是原生 `title=` ⇒ 会弹系统气泡，不是官方那种样式气泡）
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dialogs = () => readFileSync(new URL('../../src/components/workspace/WorkspaceDialogs.tsx', import.meta.url), 'utf8');
const projects = () => readFileSync(new URL('../../src/components/workspace/WorkspaceProjects.tsx', import.meta.url), 'utf8');

describe('工作空间多选批量条 1:1 官方', () => {
  it('位置与内联样式逐字对齐官方', () => {
    const source = dialogs();
    expect(source).toContain('fixed bottom-8 left-[calc(50%-175px)] z-50');
    expect(source).toContain('flex items-center gap-2 rounded-2xl px-5 py-4');
    expect(source).toContain("rgba(38, 38, 38, 0.50)");
    expect(source).toContain("blur(44px)");
    expect(source).toContain('0px 4px 8px 0px rgba(0, 0, 0, 0.30)');
    expect(source).toContain('1px solid rgba(255, 255, 255, 0.10)');
    expect(source).toContain('outlineOffset: -1');
  });

  it('入场/退场是官方那套 motion（.25s easeOut，y:20）', () => {
    const source = dialogs();
    expect(source).toContain('AnimatePresence');
    expect(source).toContain('initial={{ opacity: 0, y: 20 }}');
    expect(source).toContain('animate={{ opacity: 1, y: 0 }}');
    expect(source).toContain('exit={{ opacity: 0, y: 20 }}');
    expect(source).toContain("transition={{ duration: 0.25, ease: 'easeOut' }}");
  });

  it('按钮提示走官方 delayDuration=1000 的口径，不是原生 title', () => {
    const source = dialogs();
    expect(source).toContain('data-tooltip={action.label}');
    expect(source).toContain('data-tooltip-delay="1000"');
    expect(source).not.toContain('title={action.label}');
  });

  it('中间那颗图标是 tabler:users（两个人），不是 users-group（三个人）', () => {
    const source = projects();
    expect(source).toContain('icon="tabler:users"');
    expect(source).not.toContain('tabler:users-group');
    /* 另两颗与官方实测一致 */
    expect(source).toContain('icon="tabler:folder-plus"');
    expect(source).toContain('icon="tabler:trash"');
  });

  it('关闭按钮是官方那颗 tabler:x（20px）', () => {
    const source = dialogs();
    expect(source).toContain('icon="tabler:x"');
    expect(source).toContain('data-testid="workspace-selection-close"');
  });
});
