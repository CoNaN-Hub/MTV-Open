// @vitest-environment jsdom
/**
 * artifact 面板的**产物列表**回归（覆盖表 §6：官方 `workspaceFiles` 的 MTV 侧对应物）。
 *
 * 官方 artifact 面板（`cst` @2447080 的 `kV` 列表）列的是**画布产物**：
 * `brainstorm.md`、交互页 html、生成的图片……MTV 现在有了真正的本地产物表
 * （`chatArtifactService`，`show_html` 工具写入 `artifacts/<conversationId>/<name>.html`），
 * 所以面板要把它们列出来；点 `.html` 行走官方**全屏预览**入口
 * （`ure` 卡的 `onClick → setHtmlPreviewTarget`），而不是文本详情页。
 *
 * 验证分级 = **(b) jsdom 真 DOM + fake-indexeddb**。
 */
import 'fake-indexeddb/auto';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import AgentArtifactPanel from '../../src/components/chat/AgentArtifactPanel';
import { setLocale } from '../../src/i18n';
import {
  clearChatArtifactsForTests,
  writeChatArtifact,
} from '../../src/services/chat/chatArtifactService';
import { useHtmlPreviewTargetStore } from '../../src/services/chat/htmlPreviewTarget';

const PANEL = {
  conversationId: 'conv-1',
  projectId: 'project-1',
  onClose: () => {},
  onAddToCanvas: () => {},
  onDiscuss: () => {},
};

beforeEach(async () => {
  setLocale('zh-CN');
  useHtmlPreviewTargetStore.getState().clearHtmlPreviewTarget();
  await clearChatArtifactsForTests();
});

afterEach(async () => {
  cleanup();
  await clearChatArtifactsForTests();
});

describe('AgentArtifactPanel —— 官方产物列表', () => {
  it('会话没有产物 ⇒ 显示官方空态「暂无输出」', async () => {
    const { container } = render(<AgentArtifactPanel {...PANEL} />);
    await waitFor(() => {
      expect(container.querySelector('.chat-artifact-panel')).not.toBeNull();
    });
    expect(container.textContent).toContain('暂无输出');
  });

  it('`show_html` 落盘的 HTML 产物会出现在「文件」列表里', async () => {
    await writeChatArtifact({
      projectId: 'project-1',
      conversationId: 'conv-1',
      artifactPath: 'artifacts/conv-1/report.html',
      content: '<h1>hi</h1>',
      title: '周报',
    });
    const { container } = render(<AgentArtifactPanel {...PANEL} />);
    await waitFor(() => {
      expect(container.textContent).toContain('report.html');
    });
    expect(container.textContent).not.toContain('暂无输出');
  });

  it('点 HTML 产物行 ⇒ 写官方预览目标（`setHtmlPreviewTarget`），不开文本详情页', async () => {
    await writeChatArtifact({
      projectId: 'project-1',
      conversationId: 'conv-1',
      artifactPath: 'artifacts/conv-1/report.html',
      content: '<h1>hi</h1>',
      title: '周报',
    });
    const { container, getByText } = render(<AgentArtifactPanel {...PANEL} />);
    const row = await waitFor(() => getByText('report.html'));
    row.click();
    expect(useHtmlPreviewTargetStore.getState().htmlPreviewTarget).toEqual({
      artifactPath: 'artifacts/conv-1/report.html',
      title: '周报',
      description: '',
    });
    /* 列表视图没有切走（仍能看到产物行）。 */
    expect(container.textContent).toContain('report.html');
  });

  it('别的会话的产物不会串进来（按 `conversationId` 过滤）', async () => {
    await writeChatArtifact({
      projectId: 'project-1',
      conversationId: 'conv-other',
      artifactPath: 'artifacts/conv-other/other.html',
      content: '<p>other</p>',
    });
    const { container } = render(<AgentArtifactPanel {...PANEL} />);
    await waitFor(() => {
      expect(container.querySelector('.chat-artifact-panel')).not.toBeNull();
    });
    expect(container.textContent).not.toContain('other.html');
  });
});
