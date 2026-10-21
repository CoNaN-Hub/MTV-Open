/**
 * `brainstorm_update` **生产者**回归（覆盖表 §36.4）。
 *
 * 官方链路（客户端可见的部分）：`artifacts/brainstorm.md` 是**产物通道**里的 artifact ——
 * `ist()`（@2444453）给它专属图标、`kV`（@2444845）给它面板排序与「Brainstorm」标签，
 * 产物列表（@2755800 一带）从 `lT` 家族 tool_event 的 `content.request.artifact_path` 收集。
 * ⇒ 官方是「agent 调工具写 artifact，聊天里正常回答」；MTV 由此新增本工具，
 * 并在系统指令里去掉旧的「每次回复都用完整 markdown 重写文档（只写文档本身）」。
 *
 * 验证分级 = **(b) 真实执行链（fake-indexeddb + 真 toolRegistry） + (d) 源码级**。
 */
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AgentToolContext } from '../../../src/services/chat/toolRegistry';
import { clearAgentToolRegistryForTests, getAgentTool } from '../../../src/services/chat/toolRegistry';
import {
  BRAINSTORM_ARTIFACT_PATH,
  registerBrainstormAgentTools,
} from '../../../src/services/chat/tools/brainstormTools';
import { readBrainstormDoc, clearBrainstormDoc } from '../../../src/services/chat/brainstormService';
import { ensureAgentToolsRegistered } from '../../../src/services/chat/tools';
import { useAppStore } from '../../../src/store/useAppStore';

function context(over: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    taskId: 'task-1',
    projectId: 'project-1',
    conversationId: 'conversation-1',
    mode: 'autonomous',
    callId: 'call-brainstorm-1',
    signal: new AbortController().signal,
    ...over,
  };
}

function setBrainstormMode(enabled: boolean): void {
  type Conversation = ReturnType<typeof useAppStore.getState>['conversations'][number];
  useAppStore.setState({
    conversations: [{
      id: 'conversation-1',
      projectId: 'project-1',
      title: '测试会话',
      createdAt: 1,
      updatedAt: 1,
      brainstormMode: enabled,
    } as unknown as Conversation],
  });
}

beforeEach(async () => {
  clearAgentToolRegistryForTests();
  registerBrainstormAgentTools();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ currentProjectId: 'project-1', activeConversationId: 'conversation-1' });
  await clearBrainstormDoc('conversation-1');
});

afterEach(() => {
  clearAgentToolRegistryForTests();
});

describe('brainstorm_update 生产者', () => {
  it('已注册；`effect` 是写操作（与官方 artifact 通道同档）', () => {
    const tool = getAgentTool('brainstorm_update');
    expect(tool).toBeDefined();
    expect(tool!.effect).toBe('file_write');
  });

  it('执行 ⇒ 文档写进会话级落点，出参是官方通道形状 `{title, description, artifact_path}`', async () => {
    const tool = getAgentTool('brainstorm_update')!;
    const markdown = '# 稻草人导演\n\n## 分析对象\n场十五到十八';
    const result = await tool.execute(context(), { markdown });
    expect(result.status).toBe('success');
    expect(result.officialRequest).toEqual({
      title: 'brainstorm.md',
      description: '',
      artifact_path: BRAINSTORM_ARTIFACT_PATH,
    });
    expect(BRAINSTORM_ARTIFACT_PATH).toBe('artifacts/brainstorm.md');
    await expect(readBrainstormDoc('conversation-1')).resolves.toBe(markdown);
  });

  it('空正文 ⇒ 报错且**不写**文档', async () => {
    const tool = getAgentTool('brainstorm_update')!;
    const result = await tool.execute(context(), { markdown: '   ' });
    expect(result.status).toBe('error');
    expect(result.errorCode).toBe('BRAINSTORM_EMPTY');
    await expect(readBrainstormDoc('conversation-1')).resolves.toBe('');
  });

  it('授权：只有头脑风暴会话可用（普通会话拒绝）', () => {
    const tool = getAgentTool('brainstorm_update')!;
    setBrainstormMode(false);
    const denied = tool.authorize?.(context(), { markdown: 'x' });
    expect(denied?.allowed).toBe(false);
    setBrainstormMode(true);
    const allowed = tool.authorize?.(context(), { markdown: 'x' });
    expect(allowed?.allowed).toBe(true);
  });

  it('全量注册（`ensureAgentToolsRegistered`）也带上它', () => {
    clearAgentToolRegistryForTests();
    ensureAgentToolsRegistered();
    expect(getAgentTool('brainstorm_update')).toBeDefined();
  });
});

describe('系统指令与收尾写入（源码级）', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

  it('头脑风暴指令改成「正常回答 + 调 `brainstorm_update`」，不再要求把文档当回答', () => {
    const source = read('src/services/ai/assistantStream.ts');
    expect(source).toContain('brainstorm_update');
    expect(source).toContain('不要把整份文档当回答输出');
    /* 旧指令那两行原文必须消失（注释里对它的**引述**不算：所以断言带前缀 `- ` 的引导行）。 */
    expect(source).not.toContain('- 你要持续维护一份名为 brainstorm.md 的文档');
    expect(source).not.toContain('- 每次回复都用完整的 markdown 重写这份文档');
  });

  it('收尾不再把整轮回答写成文档（旧逻辑会让正文与面板重复）', () => {
    const source = read('src/services/chat/conversationExecutionController.ts');
    expect(source).not.toContain('writeBrainstormDoc(conversationId, projectId, fullText)');
    expect(source).toContain('不再');
  });
});
