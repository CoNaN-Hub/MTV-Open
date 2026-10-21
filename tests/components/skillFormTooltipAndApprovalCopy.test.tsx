// @vitest-environment jsdom
/**
 * 第 59 轮：用户四条里的两条「确定性缺陷」
 *
 * ① 技能表单的 ⓘ 提示按钮：官方 = Radix tooltip（`Un` Provider `delayDuration:200` +
 *    `Yn` TooltipContent `side:"top"` / `className:"max-w-[260px]"`），CDP 实测悬停后气泡
 *    192×32 悬浮在 ⓘ **上方**；MTV 此前只有裸 `<button aria-label>` ⇒ **悬停什么都不出**。
 * ② 「确认节点更新」卡正文：官方 `request.summary` 是「这次改什么」（工具摘要）；
 *    MTV 把 `approval.summary`（= `policy.reason`）塞进去 ⇒ 卡片显示内部原因串
 *    「B 协作模式的画布写操作需要确认」（那个 `B ` 是模式编号漏进用户可见文案）。
 *
 * 验证分级 = **(b) jsdom 真 DOM + (d) 源码级**。
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SkillForm from '../../src/components/chat/SkillForm';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const SKILL = {
  id: 'skill-1',
  name: 'visual-art-director',
  description: '对插画、概念美术做专业艺术评审',
  instructions: '## 诊断顺序\n1. 阅读性与创作意图\n',
};

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(cleanup);

describe('ⓘ 提示按钮：官方 tooltip', () => {
  it('悬停出现官方气泡文案（技能名规则 / 描述用途）', async () => {
    vi.useFakeTimers();
    try {
      render(<SkillForm mode="edit" skill={SKILL} onClose={() => {}} />);
      const trigger = document.body.querySelector<HTMLButtonElement>('button[aria-label="技能名称不能超过 64 个字符"]')!;
      expect(trigger).not.toBeNull();
      /* Radix Tooltip 的触发器会带上 `data-state`。 */
      expect(trigger.getAttribute('data-state')).toBe('closed');

      act(() => {
        fireEvent.pointerMove(trigger, { pointerType: 'mouse' });
        fireEvent.mouseMove(trigger);
        fireEvent.pointerEnter?.(trigger);
        fireEvent.mouseEnter(trigger);
        fireEvent.focus(trigger);
      });
      act(() => { vi.advanceTimersByTime(400); });

      /* 悬停后：触发器 open（Radix 首次瞬时打开时是 `instant-open`），气泡内容出现在 body 里（portal）。 */
      expect(['open', 'instant-open']).toContain(trigger.getAttribute('data-state'));
      /* 触发器自己没有文本 ⇒ 命中即为 portal 出来的气泡内容。 */
      expect(screen.getAllByText('技能名称不能超过 64 个字符').length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('源码级：ⓘ 用官方 `OfficialTooltip`（side=top / max-w-[260px] / delayDuration 200）', () => {
    const source = read('src/components/chat/SkillForm.tsx');
    expect(source).toContain("import OfficialTooltip from './OfficialTooltip';");
    /* 官方 className 是 `max-w-[260px]`；MTV 那个对话框 z 比官方高（130 vs 50）⇒ 再抬到 z-[200]
       （用户实测「描述的气泡在最底层、技能名称的完全看不见」）。 */
    expect(source).toContain("const TOOLTIP_CLASS = 'max-w-[260px] z-[200]';");
    expect(source.match(/className=\{TOOLTIP_CLASS\}/g)?.length).toBe(2);
    expect(source.match(/side="top"/g)?.length).toBe(2);
    expect(source.match(/delayDuration=\{200\}/g)?.length).toBe(2);
    /* 官方两个 tooltip 的文案（`skillNameInfoTooltip` / `descriptionInfoTooltip`）。 */
    expect(source).toContain("content={t('技能名称不能超过 64 个字符')}");
    expect(source).toContain("content={t('Agent 会根据这些描述决定在对话中使用哪些技能。')}");
  });
});

describe('审批卡的正文：用「这次改什么」而不是内部原因串', () => {
  it('`nodeUpdateConfirmationContent` 优先取工具 `inputSummary`', async () => {
    const { nodeUpdateConfirmationContent } = await import('../../src/services/chat/agentApprovalContents');
    const result = nodeUpdateConfirmationContent(
      {
        id: 'approval-1',
        kind: 'canvas_write',
        status: 'pending',
        summary: '需手动确认：画布修改要经你批准后才执行',
        requestedAt: 1,
      } as never,
      { callId: 'call-1', toolId: 'canvas_create_nodes', inputSummary: '新建 2 个画布节点' } as never,
    );
    const request = (result.content as { request?: { summary?: string } }).request;
    expect(request?.summary).toBe('新建 2 个画布节点');
  });

  it('工具没有摘要时回落 `approval.summary`', async () => {
    const { nodeUpdateConfirmationContent } = await import('../../src/services/chat/agentApprovalContents');
    const result = nodeUpdateConfirmationContent(
      {
        id: 'approval-2',
        kind: 'canvas_write',
        status: 'pending',
        summary: '需手动确认：画布修改要经你批准后才执行',
        requestedAt: 1,
      } as never,
      null,
    );
    const request = (result.content as { request?: { summary?: string } }).request;
    expect(request?.summary).toBe('需手动确认：画布修改要经你批准后才执行');
  });

  it('策略原因串里不再有内部模式编号（`B ` / `C ` 前缀）', async () => {
    const { evaluateAgentToolPolicy } = await import('../../src/services/chat/policyEngine');
    const context = {
      projectId: 'p', conversationId: 'c', taskId: 't', mode: 'interactive', disabledEffects: [],
    } as never;
    const definition = { id: 'canvas_create_nodes', title: '新建画布节点', effect: 'canvas_write' } as never;
    const outcome = evaluateAgentToolPolicy(definition, {}, context);
    expect(outcome.reason).toBe('需手动确认：画布修改要经你批准后才执行');
    expect(outcome.reason).not.toMatch(/^[A-Z] /);

    const auto = evaluateAgentToolPolicy(definition, {}, { ...(context as object), mode: 'autonomous' } as never);
    expect(auto.reason).not.toMatch(/^[A-Z] /);
    expect(auto.reason).toContain('自动生成模式允许自动执行');
  });
});
