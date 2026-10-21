// @vitest-environment jsdom
/**
 * **round 118 —— 待决生成确认卡 ⇒ 自动展开（MTV 自有增强，用户 2026-10-15 追加裁决）**
 *
 * 背景：round 117 把「媒体生成」审批从 MTV 时间线卡收口给了官方确认卡，但官方卡落在聊天消息流的
 * 「工具步骤」折叠节（`[data-testid="agent-steps-summary"]`）里 ⇒ 用户看不见、找不到确认入口。
 * **用户明确要求**：待决时自动展开。
 *
 * ⚠️ **官方 `vS`(`EO`) 没有这个行为** —— 这是 MTV 自有的可用性增强。
 * 下一轮**不许**按「官方没有」把它删掉；要删必须先拿到用户的新裁决。
 *
 * 规则（三条 + 一条防打架）：
 *   1. **新出现**一个待决审批（键变化）⇒ 自动展开**一次**；
 *   2. **同一个**待决审批不重复展开；
 *   3. 用户在这个待决审批上**手动折叠过** ⇒ 不再顶开；
 *   4. 有待决确认时**不跑**官方的 380ms 自动收起（否则刚顶开就被收起）。
 *
 * 验证分级 = **(b) jsdom 真 DOM**（`@testing-library/react` + 假定时器）。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AgentStepsSection from '../../src/components/chat/AgentStepsSection';
import CollapsibleToolSection from '../../src/components/chat/CollapsibleToolSection';
import { pendingGenerationConfirmationKey } from '../../src/components/chat/confirmationEventDispatch';
import { setLocale } from '../../src/i18n';

/** 官方 `Oot = 380`（ms）。 */
const AUTO_COLLAPSE_DELAY_MS = 380;

beforeEach(() => {
  setLocale('zh-CN');
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function section(container: HTMLElement) {
  return {
    root: container.querySelector('[data-testid="agent-steps-summary"] [data-state]')?.getAttribute('data-state'),
    content: container.querySelector('[data-agent-steps-content]')?.getAttribute('data-state'),
    inert: container.querySelector('[data-agent-steps-content]')?.hasAttribute('inert'),
    childrenMounted: container.querySelector('[data-inner-list]') !== null,
  };
}

const body = (
  <div data-inner-list="">
    <span>row</span>
  </div>
);

describe('round 118 · 待决生成确认卡 ⇒ 自动展开（MTV 自有增强）', () => {
  it('有待决确认 ⇒ 不跑官方 380ms 自动收起，内容保持展开且可交互（官方卡可见）', () => {
    const { container } = render(
      <AgentStepsSection autoCollapse pendingConfirmationKey="c1">{body}</AgentStepsSection>,
    );
    expect(section(container)).toEqual({ root: 'open', content: 'open', inert: false, childrenMounted: true });
    act(() => { vi.advanceTimersByTime(AUTO_COLLAPSE_DELAY_MS + 200); });
    /* 380ms 后**没有**被收起。 */
    expect(section(container)).toEqual({ root: 'open', content: 'open', inert: false, childrenMounted: true });
  });

  it('无待决 ⇒ 官方行为不变：380ms 后收起（内容 `inert`）', () => {
    const { container } = render(
      <AgentStepsSection autoCollapse pendingConfirmationKey={null}>{body}</AgentStepsSection>,
    );
    expect(section(container).root).toBe('open');
    act(() => { vi.advanceTimersByTime(AUTO_COLLAPSE_DELAY_MS + 200); });
    expect(section(container).root).toBe('closed');
    expect(section(container).content).toBe('closed');
    expect(section(container).inert).toBe(true);
  });

  it('已决议（键为 null）⇒ 不展开：连自动收起后的收起态都不动', () => {
    const { container } = render(
      <AgentStepsSection autoCollapse={false} pendingConfirmationKey={null}>{body}</AgentStepsSection>,
    );
    act(() => { vi.advanceTimersByTime(1000); });
    expect(section(container).root).toBe('closed');
    expect(section(container).childrenMounted).toBe(false);
  });

  it('规则 3：用户手动折叠后 **不被反复顶开**（同键再渲染仍收起）', () => {
    const { container, rerender } = render(
      <AgentStepsSection autoCollapse pendingConfirmationKey="c1">{body}</AgentStepsSection>,
    );
    expect(section(container).root).toBe('open');
    /* 用户点摘要行收起。 */
    fireEvent.click(container.querySelector('[data-testid="agent-steps-summary"] button') as HTMLButtonElement);
    expect(section(container).root).toBe('closed');
    /* 同一待决键反复渲染 ⇒ 保持收起。 */
    rerender(<AgentStepsSection autoCollapse pendingConfirmationKey="c1">{body}</AgentStepsSection>);
    expect(section(container).root).toBe('closed');
    rerender(<AgentStepsSection autoCollapse pendingConfirmationKey="c1">{body}</AgentStepsSection>);
    expect(section(container).root).toBe('closed');
  });

  it('规则 1/2：同键不重复展开；**换了一个新待决**才再展开一次', () => {
    const { container, rerender } = render(
      <AgentStepsSection autoCollapse={false} pendingConfirmationKey="c1">{body}</AgentStepsSection>,
    );
    fireEvent.click(container.querySelector('[data-testid="agent-steps-summary"] button') as HTMLButtonElement);
    expect(section(container).root).toBe('closed');
    /* 同键 ⇒ 不展开。 */
    rerender(<AgentStepsSection autoCollapse={false} pendingConfirmationKey="c1">{body}</AgentStepsSection>);
    expect(section(container).root).toBe('closed');
    /* 新的待决（键变化）⇒ 展开一次。 */
    rerender(<AgentStepsSection autoCollapse={false} pendingConfirmationKey="c2">{body}</AgentStepsSection>);
    expect(section(container).root).toBe('open');
  });

  it('规则 5：待决消失后记忆清空 ⇒ 下一次新待决仍会展开一次', () => {
    const { container, rerender } = render(
      <AgentStepsSection autoCollapse={false} pendingConfirmationKey="c1">{body}</AgentStepsSection>,
    );
    fireEvent.click(container.querySelector('[data-testid="agent-steps-summary"] button') as HTMLButtonElement);
    expect(section(container).root).toBe('closed');
    /* 已决议。 */
    rerender(<AgentStepsSection autoCollapse={false} pendingConfirmationKey={null}>{body}</AgentStepsSection>);
    expect(section(container).root).toBe('closed');
    /* 之后又出现（同一个 id 也算「新的一次待决」）⇒ 展开。 */
    rerender(<AgentStepsSection autoCollapse={false} pendingConfirmationKey="c1">{body}</AgentStepsSection>);
    expect(section(container).root).toBe('open');
  });
});

describe('round 118 · `pendingGenerationConfirmationKey` 判据（与读侧同源）', () => {
  const pending = {
    type: 'tool_event',
    content: {
      schema_version: 'tool_event.v1',
      tool: 'generation_confirmation',
      status: 'pending',
      request: {
        confirmation_id: 'c-pending',
        request_kind: 'image',
        request_json: { kind: 'tapnow.generation_request.v1', request_kind: 'image', prompt: 'x' },
      },
    },
  };
  const resolved = {
    type: 'tool_event',
    content: { ...pending.content, status: 'completed', response: { action: 'confirm' } },
  };
  const otherTool = { type: 'tool_event', content: { tool: 'canvas_query', status: 'pending' } };

  it('待决的 `generation_confirmation` ⇒ 返回它的 `confirmationId`', () => {
    expect(pendingGenerationConfirmationKey([pending])).toBe('c-pending');
  });

  it('已决议 / 非生成确认卡 / 空列表 ⇒ `null`', () => {
    expect(pendingGenerationConfirmationKey([resolved])).toBeNull();
    expect(pendingGenerationConfirmationKey([otherTool])).toBeNull();
    expect(pendingGenerationConfirmationKey([])).toBeNull();
    expect(pendingGenerationConfirmationKey(null)).toBeNull();
  });
});

describe('round 118 · `CollapsibleToolSection` 把键接到折叠节上', () => {
  it('折叠分支里带待决确认 ⇒ 摘要节 `data-state="open"`，官方卡不会被收起藏住', () => {
    const items = [{
      content: {
        schema_version: 'tool_event.v1',
        tool: 'generation_confirmation',
        status: 'pending',
        request: {
          confirmation_id: 'c-collapse',
          request_kind: 'image',
          request_json: { kind: 'tapnow.generation_request.v1', request_kind: 'image', prompt: 'x' },
        },
      },
    }];
    const { container } = render(
      <CollapsibleToolSection
        blocks={[{ kind: 'items', items }]}
        isStreaming={false}
        hasFollowingVisibleContent
        durationMs={1000}
      />,
    );
    const summaryRoot = container.querySelector('[data-testid="agent-steps-summary"] [data-state]');
    expect(summaryRoot).not.toBeNull();
    expect(summaryRoot!.getAttribute('data-state')).toBe('open');
    act(() => { vi.advanceTimersByTime(AUTO_COLLAPSE_DELAY_MS + 200); });
    expect(container.querySelector('[data-testid="agent-steps-summary"] [data-state]')!.getAttribute('data-state')).toBe('open');
  });

  it('同形状但**已决议** ⇒ 照官方收起（对照组）', () => {
    const items = [{
      content: {
        schema_version: 'tool_event.v1',
        tool: 'generation_confirmation',
        status: 'completed',
        response: { action: 'confirm' },
        request: {
          confirmation_id: 'c-done',
          request_kind: 'image',
          request_json: { kind: 'tapnow.generation_request.v1', request_kind: 'image', prompt: 'x' },
        },
      },
    }];
    const { container } = render(
      <CollapsibleToolSection
        blocks={[{ kind: 'items', items }]}
        isStreaming={false}
        hasFollowingVisibleContent
        durationMs={1000}
      />,
    );
    act(() => { vi.advanceTimersByTime(AUTO_COLLAPSE_DELAY_MS + 200); });
    expect(container.querySelector('[data-testid="agent-steps-summary"] [data-state]')!.getAttribute('data-state')).toBe('closed');
  });
});
