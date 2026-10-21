/**
 * 「补工具生产者」的**可达性**断言：新注册的两支工具必须真的**进到模型那侧的工具表里**，
 * 并且按官方/既有策略正确地被只读门控。
 *
 * 调用链（源码级）：`agentRoundExecutor` @784 `const tools = buildAssistantFunctionTools(roundContext)`
 * → `toolRegistry.buildAssistantFunctionTools` → `getAvailableAgentTools(context)` 过滤
 * （`readOnly` 只放 `read`、`toolAllowlist`、`isAvailable`）。
 * 验证分级 = **(b) 纯逻辑断言（真实注册表）**。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentToolContext } from '../../../src/services/chat/toolRegistry';
import {
  buildAssistantFunctionTools,
  clearAgentToolRegistryForTests,
  getAgentTool,
} from '../../../src/services/chat/toolRegistry';
import { registerAskQuestionAgentTools } from '../../../src/services/chat/tools/askQuestionTools';
import { registerShowHtmlAgentTools } from '../../../src/services/chat/tools/showHtmlTools';
import { useAppStore } from '../../../src/store/useAppStore';

function context(over: Partial<AgentToolContext> = {}): Omit<AgentToolContext, 'signal'> {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode: 'autonomous',
    ...over,
  };
}

beforeEach(() => {
  clearAgentToolRegistryForTests();
  registerAskQuestionAgentTools();
  registerShowHtmlAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1', activeConversationId: 'conversation-1' });
});

afterEach(() => {
  clearAgentToolRegistryForTests();
});

describe('工具生产者的可达性', () => {
  it('`ask_question` / `show_html` 都在模型的工具表里（带官方入参 schema）', () => {
    const tools = buildAssistantFunctionTools(context());
    const byName = new Map(tools.map((tool) => [tool.function.name, tool.function]));
    expect(byName.has('ask_question')).toBe(true);
    expect(byName.has('show_html')).toBe(true);
    /* 入参形状：`ask_question` 的 `questions[]`；`show_html` 的 `title` + `html`。 */
    expect(byName.get('ask_question')!.parameters.required).toEqual(['questions']);
    expect(byName.get('show_html')!.parameters.required).toEqual(['title', 'html']);
  });

  it('只读子任务：`ask_question`（`read`）保留、`show_html`（`file_write`）被门控掉', () => {
    const names = buildAssistantFunctionTools(context({ readOnly: true }))
      .map((tool) => tool.function.name);
    expect(names).toContain('ask_question');
    expect(names).not.toContain('show_html');
  });

  it('`toolAllowlist` 生效（官方/既有策略：不在清单里的工具不下发给模型）', () => {
    const names = buildAssistantFunctionTools(context({ toolAllowlist: ['show_html'] }))
      .map((tool) => tool.function.name);
    expect(names).toEqual(['show_html']);
  });

  it('项目不匹配时**发现期**仍下发（`isAvailable` 恒真），由执行期的 `authorize` 拦下', () => {
    /* MTV 的既有约定：`isAvailable` 决定「下不下发给模型」，`authorize` 决定「这一步准不准执行」；
       `show_html` 只在 `authorize` 里查项目 ⇒ 发现期本来就会带上它（与其它写工具一致）。
       这里把这条约定钉住，免得以后有人误以为发现期会按项目过滤。 */
    useAppStore.setState({ currentProjectId: 'project-other' });
    const names = buildAssistantFunctionTools(context()).map((tool) => tool.function.name);
    expect(names).toContain('show_html');
    const tool = getAgentTool('show_html')!;
    const decision = tool.authorize!(context(), { title: 't', html: '<p>x</p>' });
    expect(decision.allowed).toBe(false);
  });
});
