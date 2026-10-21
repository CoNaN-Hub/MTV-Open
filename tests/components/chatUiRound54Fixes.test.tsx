// @vitest-environment jsdom
/**
 * 用户第 54 轮三条实测定点修复的回归：
 *   ① `处理失败: openai_error` —— 注入的图片绕过了 `supportsVision`（无视觉能力的模型被上游拒）
 *   ② 状态行文案永远是随机四档，官方在 `thinkingActivity === 'thinking'` 时是**思考中…**
 *   ③ 管理技能对话框：页签「点击底色」缺失（官方滑块）+ 右侧多出自绘滑条
 *
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级**。
 */
import { act, cleanup, render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import SkillsManagerDialog from '../../src/components/chat/SkillsManagerDialog';
import ThinkingStatusLine from '../../src/components/chat/ThinkingStatusLine';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(cleanup);

describe('② 状态行：`thinkingActivity` 驱动「思考中…」', () => {
  const labels = (container: HTMLElement) => (container.querySelector('output span')?.textContent ?? '').trim();

  it('`thinking` ⇒ 思考中…（官方 `IC` 的分支）；`null` ⇒ 四档之一；`degraded` ⇒ 四档之一', () => {
    const thinking = render(<ThinkingStatusLine streamState="streaming" thinkingActivity="thinking" />);
    expect(labels(thinking.container)).toBe('思考中...');
    cleanup();

    const none = render(<ThinkingStatusLine streamState="streaming" thinkingActivity={null} />);
    expect(['思考中...', '处理中...', '运行中...', '整理中...']).toContain(labels(none.container));
    cleanup();

    const degraded = render(<ThinkingStatusLine streamState="streaming" thinkingActivity="degraded" />);
    expect(['思考中...', '处理中...', '运行中...', '整理中...']).toContain(labels(degraded.container));
  });

  it('源码级：`te()`/`Q()` 的等价实现（轮次开始置 thinking、15s 降级、有正文就清）', () => {
    const source = read('src/services/chat/agentRoundExecutor.ts');
    expect(source).toContain("setChatThinkingActivity('thinking')");
    expect(source).toContain('THINKING_ACTIVITY_DEGRADE_MS = 15_000');
    expect(source).toContain("setChatThinkingActivity('degraded')");
    /* 有可见正文/工具调用/结束时清除（官方 `onContent`/`onSubagentEvent` 的 `Q()`）。 */
    expect(source).toContain('clearThinkingActivity()');
    /* 清空的调用点：text.delta / tool.call.final / error / finally 共 4 处。 */
    expect((source.match(/clearThinkingActivity\(\)/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

describe('③ 管理技能对话框：页签滑块 + 无滑条', () => {
  function mountDialog() {
    return render(
      <SkillsManagerDialog
        open
        onClose={() => {}}
        onCreateSkill={() => {}}
        onUploadSkillFile={() => {}}
        onUploadSkillFolder={() => {}}
      />,
    );
  }

  it('页签有官方滑块（`bg-white/[0.12]` + 官方 inset 阴影），切页签会平移到第二列', () => {
    const { rerender } = mountDialog();
    const slider = document.body.querySelector<HTMLElement>('[data-testid="skills-dialog-tab-slider"]');
    expect(slider).not.toBeNull();
    expect(slider!.className).toContain('bg-white/[0.12]');
    expect(slider!.className).toContain('backdrop-blur-[28px]');
    expect(slider!.style.boxShadow).toContain('inset');
    expect(slider!.style.boxShadow).toContain('0px 4px 8px 0px');
    /* 默认页签 =「技能」（`tabs` 第二项）⇒ 滑块在第二列。 */
    expect(slider!.style.transform).toContain('translateX(calc(100% + 4px))');

    rerender(
      <SkillsManagerDialog
        open
        onClose={() => {}}
        onCreateSkill={() => {}}
        onUploadSkillFile={() => {}}
        onUploadSkillFolder={() => {}}
      />,
    );
    const tablist = document.body.querySelector('[role="tablist"]')!;
    const appsTab = Array.from(tablist.querySelectorAll('[role="tab"]'))
      .find((tab) => tab.textContent?.includes('应用'))!;
    act(() => { (appsTab as HTMLButtonElement).click(); });
    const moved = document.body.querySelector<HTMLElement>('[data-testid="skills-dialog-tab-slider"]')!;
    expect(moved.style.transform ?? '').not.toContain('translateX');
  });

  it('两个列表容器都关掉了 MTV 自绘滑条（`data-overlay-scrollbar="off"`，官方那条列表本来就没有滑条）', () => {
    /* 空数据时对话框走的是空态分支（没有列表）⇒ 这条用源码级钉住两处调用点（分级 d）。 */
    const source = read('src/components/chat/SkillsManagerDialog.tsx');
    const usages = (source.match(/<div className=\{SKILLS_DIALOG_GRID_CLASS\} data-overlay-scrollbar="off">/g) ?? []);
    expect(usages.length).toBe(2);
    /* 常量本身仍旧带官方那两条「隐藏原生滑条」的类。 */
    const panel = read('src/components/chat/PluginMarketPanel.tsx');
    expect(panel).toContain('[&::-webkit-scrollbar]:hidden');
    expect(panel).toContain('[scrollbar-width:none]');
  });
});

describe('① 视觉回灌必须尊重 `supportsVision`', () => {
  it('源码级：有视觉 ⇒ 发 `image_url`；无视觉 ⇒ 改用视觉描述（与 `assistantVisualContext` 同一条回落）', () => {
    const source = read('src/services/chat/agentRoundExecutor.ts');
    expect(source).toContain('resolveAssistantModel(currentTask.projectId)?.supportsVision');
    expect(source).toContain('getOrCreateVisualDescription');
    /* 描述分支不能带 image_url。 */
    const elseIndex = source.indexOf('本轮使用的助手模型没有视觉输入能力');
    expect(elseIndex).toBeGreaterThan(0);
    const block = source.slice(elseIndex, elseIndex + 400);
    expect(block).not.toContain('image_url');
  });

  it('单张超出总量预算的图片不回灌，但在文本结果里被报告', () => {
    const source = read('src/services/chat/tools/viewMediaTools.ts');
    expect(source).toContain('MAX_TOTAL_DATA_URL_CHARS');
    expect(source).toContain('图片体积超出本轮预算，未随结果回灌');
    expect(source).toContain('downscaleDataUrl');
    expect(source).toContain('MAX_IMAGE_EDGE_PX');
  });
});




