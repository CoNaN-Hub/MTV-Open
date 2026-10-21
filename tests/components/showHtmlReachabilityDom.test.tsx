// @vitest-environment jsdom
/**
 * `show_html` **全链路可达性**回归 —— 工具 → 卡 → 点击 → 预览（**不 mock 传输层**）。
 *
 * 与 `tests/components/htmlPreviewDom.test.tsx` 的区别：那份把
 * `officialHtmlPreviewTransport` 整个 mock 掉，只测预览器自身的形状；
 * 这份**不 mock 任何东西**，走真链路：
 * ```
 * registerShowHtmlAgentTools()  →  tool.execute(html)  落 fake-indexeddb
 *   →  stepToToolEvent（官方 `lT` 分派）→ `ShowHtmlCard`（官方 `ure`）
 *   →  click ⇒ setHtmlPreviewTarget({artifactPath,title,description})（官方 @2358534）
 *   →  host（官方 @2773335 `uO`）⇒ <HtmlPreview>（官方 `mst`）
 *   →  officialHtmlPreviewTransport.getCanvasArtifact 真读 IndexedDB
 *   →  status:"ready" ⇒ `Rge` 壳 + `HW` 渲染器把正文 postMessage 进 iframe
 * ```
 * 官方偏移（`D:\DEEPSEEK\live-assets\vendor-pkg-canvas-ChpWx5JY.js`）：
 *   · `ONe=new Set(["show_html"])` @442497 / `lT=e=>ONe.has(xl(e))` @444963
 *   · `$M` 分派 @2427990 邻域：`if(lT(e)){const T=e.content;return T.status!=="completed"?null:s.jsx(ure,{content:T})}`
 *   · `ure` @2358363：`o=e.request??e,r=o.title??"HTML",i=o.artifact_path,l=o.description`，
 *     `onClick:()=>n({artifactPath:i,title:r,description:l})`
 *   · `uO=ot&&x?{canvasId:x,artifactPath:ot.artifactPath,title:ot.title,description:ot.description}:null` @2773335
 */
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MessageBubble from '../../src/components/chat/MessageBubble';
import HtmlPreview from '../../src/components/chat/HtmlPreview';
import { setLocale } from '../../src/i18n';
import {
  clearChatArtifactsForTests,
  readChatArtifact,
} from '../../src/services/chat/chatArtifactService';
import {
  buildAssistantFunctionTools,
  clearAgentToolRegistryForTests,
  getAgentTool,
  type AgentToolContext,
} from '../../src/services/chat/toolRegistry';
import { registerShowHtmlAgentTools } from '../../src/services/chat/tools/showHtmlTools';
import {
  ensureAgentToolsRegistered,
  resetAgentToolsRegistrationForTests,
} from '../../src/services/chat/tools';
import {
  useHtmlPreviewTarget,
  useHtmlPreviewTargetStore,
} from '../../src/services/chat/htmlPreviewTarget';
import { officialHtmlPreviewTransport } from '../../src/services/chat/htmlPreviewTransport';
import { useAppStore } from '../../src/store/useAppStore';
import type { AgentStep, AgentTask } from '../../src/types/agent';
import type { ChatMessage } from '../../src/types/chat';
import type { AgentTaskControls } from '../../src/components/chat/AgentTaskTimeline';

const PROJECT_ID = 'project-html-1';
const CONVERSATION_ID = 'conversation-html-1';
const HTML = '<!doctype html><html><body><h1 id="hello">HELLO-ARTIFACT</h1></body></html>';

/** `MessageBubble` 只有在 `agentControls` 存在时才会渲染任务时间线（`showTimeline`）。 */
const AGENT_CONTROLS = {
  onResolveApproval: () => {},
  mediaModelOptions: [],
  mediaModelAvailability: {},
  onStop: () => {},
} as unknown as AgentTaskControls;

function toolContext(over: Partial<AgentToolContext> = {}): AgentToolContext {
  return {
    taskId: 'task-html-1',
    projectId: PROJECT_ID,
    conversationId: CONVERSATION_ID,
    mode: 'autonomous',
    callId: 'call-html-1',
    signal: new AbortController().signal,
    ...over,
  };
}

function assistantMessage(): ChatMessage {
  return {
    id: 'm1',
    conversationId: CONVERSATION_ID,
    role: 'assistant',
    content: '',
    timestamp: 1_000,
    status: 'complete',
  };
}

/** 官方 `$M` 分支只看 `content.status === "completed"`（`AgentStep.status === 'succeeded'`）。 */
function taskWithStep(step: AgentStep): AgentTask {
  return {
    id: 'task-html-1',
    goal: '生成交互页',
    status: 'completed',
    steps: [step],
    createdAt: 1,
    updatedAt: 2,
  } as AgentTask;
}

/** 复刻真实的 `executePreparedToolCall`：把工具的 `officialRequest` 并进 `step.toolCall`。 */
function stepFromResult(
  officialRequest: Record<string, unknown>,
  status: AgentStep['status'] = 'succeeded',
): AgentStep {
  return {
    id: 's1',
    taskId: 'task-html-1',
    index: 0,
    kind: 'tool',
    title: '生成交互页',
    status,
    createdAt: 1_000,
    updatedAt: 2_000,
    toolCall: {
      callId: 'call-html-1',
      toolId: 'show_html',
      retryCount: 0,
      startedAt: 1_000,
      finishedAt: 2_000,
      effect: 'file_write',
      officialRequest,
    },
  };
}

/**
 * `src/App.tsx` @597 起宿主接线的**镜像**（同一条表达式）。
 * 这里不直接渲染 `App`：它会拉起 Canvas/mascot/Tauri 等整棵应用树，与本用例无关；
 * 「App.tsx 真的这样接线」由本文件的源码级断言守住（见最后一个 describe）。
 */
function HtmlPreviewHost() {
  const target = useHtmlPreviewTarget();
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  return target && currentProjectId ? (
    <HtmlPreview
      isOpen
      onClose={() => useHtmlPreviewTargetStore.getState().clearHtmlPreviewTarget()}
      target={{ canvasId: currentProjectId, ...target }}
    />
  ) : null;
}

async function runShowHtmlTool(title = '销量报告', description = '按周汇总') {
  const tool = getAgentTool('show_html');
  if (!tool) throw new Error('show_html 未注册');
  const result = await tool.execute(toolContext(), { title, description, html: HTML });
  if (result.status !== 'success' || !result.officialRequest) {
    throw new Error(`show_html 执行失败: ${result.summary}`);
  }
  return result.officialRequest;
}

/** 让 `HW` 沙箱渲染器的 iframe 完成官方握手，并回传 host→iframe 的 postMessage 载荷。 */
function driveSandboxHandshake() {
  const iframe = document.querySelector('iframe');
  if (!iframe) throw new Error('未渲染 iframe');
  const win = iframe.contentWindow as Window;
  const postMessage = vi.fn();
  Object.defineProperty(win, 'postMessage', { configurable: true, value: postMessage });
  const send = (data: unknown) => {
    const event = new MessageEvent('message', { data });
    Object.defineProperty(event, 'source', { value: win, configurable: true });
    act(() => {
      window.dispatchEvent(event);
    });
  };
  send({ type: 'proxy-ready' });
  const payload = postMessage.mock.calls[0]?.[0] as
    | { type: string; html: string; nonce: string }
    | undefined;
  if (!payload) throw new Error('host 未向 artifact-proxy 发送 render');
  send({ type: 'rendered', nonce: payload.nonce });
  return { iframe, payload, targetOrigin: postMessage.mock.calls[0]?.[1] };
}

beforeEach(async () => {
  setLocale('zh-CN');
  clearAgentToolRegistryForTests();
  registerShowHtmlAgentTools();
  useAppStore.setState({ currentProjectId: PROJECT_ID });
  useHtmlPreviewTargetStore.getState().clearHtmlPreviewTarget();
  await clearChatArtifactsForTests();
  if (typeof crypto.randomUUID !== 'function') {
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => '00000000-0000-4000-8000-000000000000',
    });
  }
});

afterEach(() => {
  cleanup();
  resetAgentToolsRegistrationForTests();
  clearAgentToolRegistryForTests();
  useHtmlPreviewTargetStore.getState().clearHtmlPreviewTarget();
});

describe('show_html 全链路（真实传输层 + fake-indexeddb）', () => {
  it('工具 → 卡 → 点击 → 预览 ready：正文从 IndexedDB 取回并交付沙箱', async () => {
    const officialRequest = await runShowHtmlTool();
    const artifactPath = String(officialRequest.artifact_path);

    /* ① 工具真的把正文落进了本地 artifact 表（key = projectId::artifactPath）。 */
    const record = await readChatArtifact(PROJECT_ID, artifactPath);
    expect(record?.content).toBe(HTML);

    /* ② 渲染 `ShowHtmlCard`（官方 `ure`）：标题 + 官方副标题文案。 */
    const bubble = render(
      <MessageBubble
        message={assistantMessage()}
        agentTask={taskWithStep(stepFromResult(officialRequest))}
        agentControls={AGENT_CONTROLS}
      />,
    );
    const title = screen.getByText('销量报告');
    expect(title).not.toBeNull();
    expect(screen.getByText('打开互动作品')).not.toBeNull();
    const card = title.closest('button');
    expect(card).not.toBeNull();

    /* ③ 点击 ⇒ 官方 `setHtmlPreviewTarget({artifactPath,title,description})`。 */
    expect(useHtmlPreviewTargetStore.getState().htmlPreviewTarget).toBeNull();
    fireEvent.click(card as HTMLButtonElement);
    expect(useHtmlPreviewTargetStore.getState().htmlPreviewTarget).toEqual({
      artifactPath,
      title: '销量报告',
      description: '按周汇总',
    });

    /* 卡已交付给 store ⇒ 卸掉消息体，避免标题文本与预览壳重复命中。 */
    bubble.unmount();

    /* ④ host（官方 `uO`）渲染 `mst`。 */
    render(<HtmlPreviewHost />);
    expect(screen.getByLabelText('HTML 预览')).not.toBeNull();

    /* ⑤ 传输层**未被 mock**：走真 `officialHtmlPreviewTransport` 从 IndexedDB 读出正文 ⇒ `ready`。 */
    await waitFor(() => expect(screen.getByText('销量报告')).not.toBeNull());
    expect(screen.getByText('按周汇总')).not.toBeNull();
    expect(screen.getByText('下载 HTML')).not.toBeNull();
    expect(screen.queryByText('加载中…')).toBeNull();
    expect(screen.queryByText('预览加载失败')).toBeNull();
    expect(screen.queryByText('渲染失败')).toBeNull();
    /* 与「直接调传输层」的结果逐字一致，证明预览取到的就是工具写进去的那份。 */
    const direct = await officialHtmlPreviewTransport.getCanvasArtifact({
      canvas_id: PROJECT_ID,
      artifact_path: artifactPath,
    });
    expect(direct.data?.artifact?.content).toBe(HTML);

    /* ⑥ `HW` 沙箱握手：host 把**同一份正文** postMessage 进 iframe，renderFailed 遮罩不出现。 */
    const { iframe, payload, targetOrigin } = driveSandboxHandshake();
    expect(payload.type).toBe('render');
    expect(payload.html).toBe(HTML);
    expect(targetOrigin).toBe('*');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(screen.queryByText('渲染失败')).toBeNull();
  });

  it('`status !== "completed"` 的 show_html 事件 ⇒ 卡片不渲染（官方 `lT` 的 null 分支）', async () => {
    const officialRequest = await runShowHtmlTool();
    render(
      <MessageBubble
        message={{ ...assistantMessage(), status: 'streaming' }}
        agentTask={taskWithStep(stepFromResult(officialRequest, 'running'))}
        agentControls={AGENT_CONTROLS}
      />,
    );
    expect(screen.queryByText('销量报告')).toBeNull();
    expect(screen.queryByText('打开互动作品')).toBeNull();
  });
});

describe('show_html 的 canvas_id 一致性（官方 `uO` 的 `canvasId:x`）', () => {
  it('卡点击后的目标**不带** canvasId；预览用的 canvas_id 恒等于当前项目 id，与落盘 key 一致', async () => {
    const officialRequest = await runShowHtmlTool();
    const artifactPath = String(officialRequest.artifact_path);
    useHtmlPreviewTargetStore.getState().setHtmlPreviewTarget({
      artifactPath,
      title: '销量报告',
      description: '按周汇总',
    });

    /* 目标本身只有官方 `ure` 传的三个字段 —— `canvasId` 由 host 在消费时补（官方 @2773335）。 */
    expect(Object.keys(useHtmlPreviewTargetStore.getState().htmlPreviewTarget ?? {}).sort())
      .toEqual(['artifactPath', 'description', 'title']);

    render(<HtmlPreviewHost />);
    await waitFor(() => expect(screen.getByText('销量报告')).not.toBeNull());
  });

  it('切换项目后：host 用**新**项目 id 当 canvas_id ⇒ 读不到旧项目的产物（与官方 `x` 同步变化一致）', async () => {
    const officialRequest = await runShowHtmlTool();
    const artifactPath = String(officialRequest.artifact_path);
    useHtmlPreviewTargetStore.getState().setHtmlPreviewTarget({
      artifactPath,
      title: '销量报告',
      description: '按周汇总',
    });

    useAppStore.setState({ currentProjectId: 'project-html-2' });
    render(<HtmlPreviewHost />);

    /* 新项目下没有这条 artifact ⇒ 官方失败态（`.catch`/空正文 ⇒ `{status:"error"}`）。 */
    await waitFor(() => expect(screen.getByText('预览加载失败')).not.toBeNull());
    expect(screen.queryByText('销量报告')).toBeNull();

    /* 旧项目的产物本身没被动过（只是 canvas_id 不再指向它）。 */
    expect((await readChatArtifact(PROJECT_ID, artifactPath))?.content).toBe(HTML);
    expect(await readChatArtifact('project-html-2', artifactPath)).toBeNull();
  });

  it('没有当前项目时 host 不渲染预览器（官方 `ot&&x ? … : null`，`x` 为假 ⇒ `isOpen:false`）', async () => {
    useHtmlPreviewTargetStore.getState().setHtmlPreviewTarget({
      artifactPath: 'artifacts/c/p.html',
      title: '销量报告',
    });
    useAppStore.setState({ currentProjectId: null });
    render(<HtmlPreviewHost />);
    expect(screen.queryByLabelText('HTML 预览')).toBeNull();
  });
});

describe('工具可达性：show_html 是否真的被交给模型', () => {
  const plainContext = {
    taskId: 'task-1',
    projectId: PROJECT_ID,
    conversationId: CONVERSATION_ID,
    mode: 'collaborative' as const,
  };

  function builtinToolNames(over: Partial<typeof plainContext & { readOnly: boolean; toolAllowlist: string[] }> = {}) {
    resetAgentToolsRegistrationForTests();
    clearAgentToolRegistryForTests();
    ensureAgentToolsRegistered();
    return buildAssistantFunctionTools({ ...plainContext, ...over }).map((tool) => tool.function.name);
  }

  it('全量内置注册后，普通任务（无 allowlist / 非只读）⇒ `show_html` 出现在函数工具清单', () => {
    expect(builtinToolNames()).toContain('show_html');
  });

  it('只读子任务（`readOnly`）⇒ 被排除（`effect: "file_write"`，见 `getAvailableAgentTools`）', () => {
    expect(builtinToolNames({ readOnly: true })).not.toContain('show_html');
  });

  it('任务级 allowlist 不含它 ⇒ 被排除（Skill 声明的工具上限）', () => {
    expect(builtinToolNames({ toolAllowlist: ['canvas_query'] })).not.toContain('show_html');
  });
});

describe('App.tsx 的宿主接线（源码级守卫）', () => {
  /* jsdom 下 `import.meta.url` 不是 file: 方案（vitest 会给出虚拟 URL）⇒ 用仓库根定位。 */
  const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');

  it('读 htmlPreviewTarget store、按官方 `ot&&x` 判真值、并补 canvasId', () => {
    expect(appSource).toContain('useHtmlPreviewTarget()');
    expect(appSource).toContain('{htmlPreviewTarget && currentProjectId ? (');
    expect(appSource).toMatch(/canvasId:\s*currentProjectId/);
    expect(appSource).toContain('<HtmlPreview');
    expect(appSource).toContain('clearHtmlPreviewTarget()');
  });
});
