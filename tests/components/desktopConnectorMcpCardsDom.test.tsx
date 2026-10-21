// @vitest-environment jsdom
/**
 * 三族卡片（`desktop_*_confirmation` / `connectorAuthCard` / `mcpApp`）的**真实 DOM** 回归
 * —— 验证分级 **(b) jsdom**。
 *
 * ⚠️ 三族卡片的官方实现都从全局 hook / store / context 取数据（MTV 全无对应物），本轮用
 * **props 注入的 bridge** 接线；本文件同时充当 bridge 契约的用例。
 *
 * ⚠️ **没有**做 (a) live 画布实测：live 画布已有会话、这三张卡不在 live DOM 里，且不许点用户的
 * live 画布。本文件是本轮能给的最高验证等级。
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DesktopConfirmationCard, {
  DESKTOP_PERMISSIONS_SETTINGS_SECTION,
} from '../../src/components/chat/DesktopConfirmationCard';
import ConnectorAuthCard from '../../src/components/chat/ConnectorAuthCard';
import McpAppCard, { type McpAppHostBridgeOptions } from '../../src/components/chat/McpAppCard';
import { z } from '../../src/components/chat/officialClassNames';
import type { ToolEventContent } from '../../src/services/chat/agentContents';
import {
  DESKTOP_CACHE_TTL_MS,
  DESKTOP_RUN_CACHE_PREFIX,
} from '../../src/services/chat/desktopConfirmationCard';

afterEach(cleanup);

/* ==========================================================================
 * 官方 `z`（clsx/twMerge）替身自检
 * ========================================================================== */

describe('officialClassNames —— 官方 `z` 的替身', () => {
  it('falsy 丢弃、空格拼接', () => {
    expect(z('a', false, null, undefined, '', 'b')).toBe('a b');
    expect(z()).toBe('');
  });
});

/* ==========================================================================
 * 1. DesktopConfirmationCard（官方 `$Qe` @2162950）
 * ========================================================================== */

describe('DesktopConfirmationCard —— 结构 / 状态（$Qe）', () => {
  const baseRequest = {
    confirmation_id: 'cf-1',
    confirmation_kind: 'desktop_fs',
  };
  const content: ToolEventContent = {
    schema_version: 'tool_event.v1',
    type: 'tool_event',
    tool: 'desktop_fs_confirmation',
    status: 'pending',
    request: baseRequest,
  };
  const pendingStore = {
    pendingConfirmation: { confirmationId: 'cf-1', status: 'pending', kind: 'desktop_fs' },
  };

  it('未注入 store 时：标题/正文按官方文案渲染，两个按钮均 disabled', () => {
    const onAnswer = vi.fn();
    const { container } = render(<DesktopConfirmationCard content={content} onAnswer={onAnswer} />);
    const root = container.querySelector('[data-testid="desktop-confirmation-card"]');
    expect(root).not.toBeNull();
    expect(root?.className).toBe(
      'my-2 flex w-full flex-col gap-3 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
    );
    /* 标题 = 官方动态 key `titles.${p}` ⇒ zh「Agent 请求访问本地文件夹」 */
    expect(container.textContent).toContain('Agent 请求访问本地文件夹');
    /* 正文 = HQe 兜底分支（MTV 无 operation 生产者） */
    expect(container.textContent).toContain('Operation: \nTarget: choose target after confirming');

    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['拒绝', '确认']);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    expect(buttons[0].className).toBe(
      'inline-flex items-center rounded-lg bg-white/[0.09] px-3 py-2 text-xs font-normal leading-3 text-[#F5F5F5] transition-colors focus:outline-none cursor-not-allowed opacity-40',
    );
    expect(buttons[1].className).toBe(
      'inline-flex items-center rounded-lg bg-[#F5F5F5] px-3 py-2 text-xs font-normal leading-3 text-[#0F0F0F] transition-opacity focus:outline-none cursor-not-allowed opacity-40',
    );
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('在途（status==="started" 且无 store 记录）⇒ 整卡 return null', () => {
    /* 官方生产者在工具还在跑时发的就是 `status:"started"` + 无 action。 */
    const { container } = render(
      <DesktopConfirmationCard content={{ ...content, status: 'started' }} onAnswer={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');

    const resolved: ToolEventContent = {
      ...content,
      status: 'completed',
      response: { action: 'confirm' },
    };
    const view = render(<DesktopConfirmationCard content={resolved} onAnswer={vi.fn()} />);
    expect(view.container.innerHTML).not.toBe('');
  });

  it('缺 confirmation_id / confirmation_kind ⇒ return null', () => {
    const view = render(
      <DesktopConfirmationCard
        content={{ ...content, request: { confirmation_id: 'x' } }}
        onAnswer={vi.fn()}
      />,
    );
    expect(view.container.innerHTML).toBe('');
    const view2 = render(
      <DesktopConfirmationCard
        content={{ ...content, request: { confirmation_kind: 'desktop_fs' } }}
        onAnswer={vi.fn()}
      />,
    );
    expect(view2.container.innerHTML).toBe('');
  });

  it('store 命中 + runner 可用 ⇒ Confirm 走 `runAgentDesktopAction` 并产出官方 answer payload', async () => {
    const onAnswer = vi.fn();
    const runAgentDesktopAction = vi.fn().mockResolvedValue({ ok: true });
    const { container } = render(
      <DesktopConfirmationCard
        content={{ ...content, request: { ...baseRequest, operation: 'pick_file', file_grant_id: 'g-9' } }}
        onAnswer={onAnswer}
        bridge={{ store: pendingStore, runAgentDesktopAction }}
      />,
    );
    const confirm = [...container.querySelectorAll('button')][1];
    expect(confirm.disabled).toBe(false);
    await act(async () => {
      fireEvent.click(confirm);
    });
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(1));
    expect(runAgentDesktopAction).toHaveBeenCalledWith('desktop_fs', expect.any(Object));
    expect(onAnswer).toHaveBeenCalledWith('cf-1', 'confirm', { desktop_fs: { ok: true } });
  });

  it('runner 缺失 ⇒ 按官方「Desktop Host is unavailable」分支产出失败 answer（不伪造成功）', async () => {
    const onAnswer = vi.fn();
    const { container } = render(
      <DesktopConfirmationCard content={content} onAnswer={onAnswer} bridge={{ store: pendingStore }} />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(onAnswer).toHaveBeenCalledTimes(1);
    const [id, action, payload] = onAnswer.mock.calls[0] as [string, string, Record<string, unknown>];
    expect(id).toBe('cf-1');
    expect(action).toBe('confirm');
    expect(payload).toEqual({
      desktop_fs: { ok: false, error: 'Desktop Host is unavailable in this client.' },
    });
  });

  it('client action（batch_download_files）缺 runner ⇒ 「Client action runner is unavailable」', async () => {
    const onAnswer = vi.fn();
    const downloadContent: ToolEventContent = {
      schema_version: 'tool_event.v1',
      type: 'tool_event',
      tool: 'batch_download_files_confirmation',
      status: 'started',
      request: { confirmation_id: 'cf-2', confirmation_kind: 'batch_download_files', node_refs: ['n1'] },
    };
    const { container } = render(
      <DesktopConfirmationCard
        content={downloadContent}
        onAnswer={onAnswer}
        bridge={{
          store: { pendingConfirmation: { confirmationId: 'cf-2', status: 'pending', kind: 'batch_download_files' } },
        }}
      />,
    );
    expect(container.textContent).toContain('下载文件');
    expect(container.textContent).toContain('Files: 1\nDestination: browser downloads');
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(onAnswer.mock.calls[0][2]).toEqual({
      batch_download_files: { ok: false, error: 'Client action runner is unavailable in this client.' },
    });
  });

  it('Reject ⇒ `(id, "reject", undefined, "user declined")`', async () => {
    const onAnswer = vi.fn();
    const { container } = render(
      <DesktopConfirmationCard content={content} onAnswer={onAnswer} bridge={{ store: pendingStore }} />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][0]);
    });
    expect(onAnswer).toHaveBeenCalledWith('cf-1', 'reject', undefined, 'user declined');
  });

  it('policy.isKindEnabled=false ⇒ 显示 disabledInSettings + 打开设置（跳 DESKTOP_PERMISSIONS），Confirm 走 reject 分支', async () => {
    const onAnswer = vi.fn();
    const openSettingsModal = vi.fn();
    const { container } = render(
      <DesktopConfirmationCard
        content={content}
        onAnswer={onAnswer}
        bridge={{
          store: pendingStore,
          openSettingsModal,
          desktopPermissionPolicy: { isKindEnabled: () => false },
        }}
      />,
    );
    expect(container.textContent).toContain('此能力已在桌面端权限设置中关闭。');
    const settingsBtn = screen.getByText('打开设置');
    expect(settingsBtn.className).toBe('underline underline-offset-2 hover:text-amber-100');
    fireEvent.click(settingsBtn);
    expect(openSettingsModal).toHaveBeenCalledWith(DESKTOP_PERMISSIONS_SETTINGS_SECTION);
    expect(DESKTOP_PERMISSIONS_SETTINGS_SECTION).toBe('desktop_permissions');

    /* `M = C && !o && S` ⇒ S=false ⇒ Confirm 禁用（与官方逐字一致）。
       官方 `k` 里的 `!S` 分支（写 'desktop capability disabled in settings'）
       因按钮 disabled 而**无法由点击到达**（官方也是如此）。 */
    const confirmBtn = [...container.querySelectorAll('button')].at(-1)!;
    expect(confirmBtn.disabled).toBe(true);
    /* 官方自动确认 effect：`if(!S){c.current=u,I();return}` ⇒ 未注入策略开关时自动走 **reject**。 */
    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith('cf-1', 'reject', undefined, 'user declined'),
    );
    await act(async () => {
      fireEvent.click(confirmBtn);
    });
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });

  it('非 pending 状态：confirmed / rejected / skipped 三种状态文本 + 透明度类', () => {
    for (const [action, expected, extra] of [
      ['confirm', '已确认', 'opacity-80'],
      ['reject', '已拒绝', 'opacity-50'],
    ] as const) {
      const view = render(
        <DesktopConfirmationCard
          content={{ ...content, status: 'completed', response: { action } }}
          onAnswer={vi.fn()}
        />,
      );
      expect(view.container.textContent).toContain(expected);
      expect(view.container.querySelector('[data-testid="desktop-confirmation-card"]')?.className).toContain(
        extra,
      );
      expect(view.container.querySelectorAll('button')).toHaveLength(0);
      view.unmount();
    }

    const skipped = render(
      <DesktopConfirmationCard
        content={{ ...content, status: 'failed', error: { code: 'conversation_cancelled' } }}
        onAnswer={vi.fn()}
      />,
    );
    expect(skipped.container.textContent).toContain('已跳过');
    expect(
      skipped.container.querySelector('[data-testid="desktop-confirmation-card"]')?.className,
    ).toContain('opacity-50');
    /* 状态文本行 className 逐字 */
    expect(skipped.container.querySelector('.px-1.text-xs')?.className).toBe(
      'px-1 text-xs text-white/45',
    );
  });

  it('点开时读一次官方 result 缓存（`l.current` 守卫 + `LQe`），命中则直接复用', async () => {
    localStorage.setItem(
      `${'tap:desktop-confirmation-result:v1:'}cf-1`,
      JSON.stringify({ modifications: { desktop_fs: { ok: true, cached: true } }, expiresAt: Date.now() + DESKTOP_CACHE_TTL_MS }),
    );
    const onAnswer = vi.fn();
    const runAgentDesktopAction = vi.fn();
    const { container } = render(
      <DesktopConfirmationCard
        content={content}
        onAnswer={onAnswer}
        bridge={{ store: pendingStore, runAgentDesktopAction }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(runAgentDesktopAction).not.toHaveBeenCalled();
    expect(onAnswer).toHaveBeenCalledWith('cf-1', 'confirm', { desktop_fs: { ok: true, cached: true } });
    localStorage.clear();
  });

  it('autoConfirm + shouldAutoConfirm ⇒ 挂载即自动确认（官方 auto-confirm effect）', async () => {
    const onAnswer = vi.fn();
    const runAgentDesktopAction = vi.fn().mockResolvedValue({ ok: true });
    render(
      <DesktopConfirmationCard
        content={content}
        onAnswer={onAnswer}
        bridge={{
          store: pendingStore,
          runAgentDesktopAction,
          desktopPermissionPolicy: { shouldAutoConfirm: () => true },
        }}
      />,
    );
    await waitFor(() => expect(runAgentDesktopAction).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith('cf-1', 'confirm', { desktop_fs: { ok: true } }),
    );
  });

  it('run 缓存守卫常量逐字（Q5 @2157027）', () => {
    expect(DESKTOP_RUN_CACHE_PREFIX).toBe('tap:desktop-confirmation-run:v1:');
  });
});

/* ==========================================================================
 * 2. ConnectorAuthCard（官方 `Loe` @2149033 + `TQe` @2142258）
 * ========================================================================== */

describe('ConnectorAuthCard —— 容器 `Loe`', () => {
  it('无 auth_cards ⇒ return null', () => {
    const view = render(
      <ConnectorAuthCard content={{ schema_version: 'tool_event.v1', type: 'tool_event', tool: 'get_connector_status', status: 'completed', request: {}, response: {} }} />,
    );
    expect(view.container.innerHTML).toBe('');
  });

  it('容器 className `my-2 flex w-full flex-col gap-2`，一卡一层', () => {
    const view = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{}}
      />,
    );
    const root = view.container.firstElementChild;
    expect(root?.className).toBe('my-2 flex w-full flex-col gap-2');
    expect(root?.children).toHaveLength(1);
  });
});

function connectorContent(cardOverrides: Record<string, unknown> = {}) {
  return {
    schema_version: 'tool_event.v1' as const,
    type: 'tool_event' as const,
    tool: 'get_connector_status',
    status: 'completed',
    tool_call_id: 'call-7',
    request: {},
    response: {
      auth_cards: [
        {
          connector_id: 'slack',
          label: 'Slack',
          description: 'Team chat',
          status: 'disconnected',
          auth_scheme: 'oauth2_authcode',
          ...cardOverrides,
        },
      ],
      connectors: [],
    },
  };
}

describe('ConnectorAuthCard —— 单卡 `TQe` 各状态', () => {
  it('idle + disconnected ⇒ connectPromptDesc + Skip / Authenticate；`common.*` 未入表故 Skip 用官方英文兜底', () => {
    const { container } = render(<ConnectorAuthCard content={connectorContent()} bridge={{}} />);
    expect(container.textContent).toContain('连接 Slack');
    expect(container.textContent).toContain('检测到 Slack 尚未成功连接');
    const card = container.firstElementChild?.firstElementChild;
    expect(card?.className).toBe(
      'flex w-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] px-4 pt-3 pb-2.5',
    );
    const buttons = [...container.querySelectorAll('button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['跳过', '去授权']);
    expect(buttons[0].className).toBe(
      'cursor-pointer rounded-full px-2 py-1 text-xs font-medium leading-4 whitespace-nowrap text-text-text-secondary transition-colors hover:bg-white/8 hover:text-text-text-primary',
    );
    expect(buttons[1].className).toBe(
      'flex h-6 max-w-full cursor-pointer items-center justify-center truncate rounded-full bg-white px-3 text-xs font-medium leading-4 text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60',
    );
  });

  it('认证中（isStartingSession）⇒ 主按钮显示「连接中...」且 disabled', () => {
    const { container } = render(
      <ConnectorAuthCard content={connectorContent()} bridge={{ isStartingSession: true }} />,
    );
    const primary = [...container.querySelectorAll('button')][1];
    expect(primary.textContent).toBe('连接中...');
    expect(primary.disabled).toBe(true);
  });

  it('Authenticate ⇒ `startSession({connector_id, capabilities})`；非 form 流 ⇒ window.open(redirectUrl, "_blank", "noopener,noreferrer")', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const startSession = vi
      .fn()
      .mockResolvedValue({ sessionId: 's-1', redirectUrl: 'https://auth.example/redirect' });
    const { container } = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{
          startSession,
          connectors: [
            {
              id: 'slack',
              label: 'Slack',
              description: '',
              icon: null,
              status: 'disconnected',
              authScheme: 'oauth2_authcode',
              capabilities: [{ id: 'chat', enabled: true }],
              connectedAt: null,
              lastError: null,
              pendingSessionId: null,
            },
          ],
        }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(startSession).toHaveBeenCalledWith({ connector_id: 'slack', capabilities: ['chat'] });
    expect(open).toHaveBeenCalledWith('https://auth.example/redirect', '_blank', 'noopener,noreferrer');
  });

  it('form 流 ⇒ 打开授权弹窗（bridge.renderAuthDialog），不 window.open', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const renderAuthDialog = vi.fn((props: { plugin: { pluginName: string } }) => (
      <div data-testid="auth-dialog">{props.plugin.pluginName}</div>
    ));
    const { container, getByTestId } = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{
          startSession: vi.fn().mockResolvedValue({ sessionId: 's-2', formFields: [{ name: 'token' }] }),
          renderAuthDialog,
        }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(open).not.toHaveBeenCalled();
    expect(getByTestId('auth-dialog').textContent).toBe('slack');
    expect(renderAuthDialog.mock.calls[0][0]).toMatchObject({
      open: true,
      session: { sessionId: 's-2' },
      connector: { id: 'slack' },
    });
  });

  it('waiting ⇒ shimmer 等待文案 + Cancel + `<a rel="noreferrer">` 的 Continue in（无 noopener，逐字）', async () => {
    const { container } = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{
          startSession: vi
            .fn()
            .mockResolvedValue({ sessionId: 's-3', verificationUrl: 'https://verify.example' }),
          session: { sessionId: 's-3', verificationUrl: 'https://verify.example', userCode: 'ABCD-1234' },
          connectors: [],
        }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(container.textContent).toContain('等待授权中...');
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://verify.example');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noreferrer');
    expect(link?.textContent).toBe('在 Slack 中继续');
    /* device code 区块（非 feishu/lark ⇒ 显示） */
    expect(container.textContent).toContain('ABCD-1234');
    expect(container.querySelector('.grid-cols-\\[2rem_1fr_2rem\\]')?.className).toBe(
      'mt-2 grid grid-cols-[2rem_1fr_2rem] items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2',
    );
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Cancel']);
  });

  it('feishu/lark ⇒ **不显示** device code（官方 `_be` 判定）', async () => {
    const { container } = render(
      <ConnectorAuthCard
        content={connectorContent({ connector_id: 'feishu', label: 'Feishu' })}
        bridge={{
          startSession: vi
            .fn()
            .mockResolvedValue({ sessionId: 's-4', verificationUrl: 'https://verify.example' }),
          session: { sessionId: 's-4', verificationUrl: 'https://verify.example', userCode: 'ABCD' },
        }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(container.textContent).toContain('等待授权中...');
    expect(container.textContent).not.toContain('ABCD');
  });

  it('device code 的 CopyButton 走 bridge.renderCopyButton（官方 `e1`，未注入 ⇒ 不渲染）', async () => {
    const renderCopyButton = vi.fn(() => <div data-testid="copy-btn" />);
    const { container, queryByTestId } = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{
          startSession: vi.fn().mockResolvedValue({ sessionId: 's-5', userCode: 'X' }),
          session: { sessionId: 's-5', userCode: 'X' },
          renderCopyButton,
        }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(queryByTestId('copy-btn')).not.toBeNull();
    expect(renderCopyButton).toHaveBeenCalledWith({
      value: 'X',
      defaultText: 'Copy',
      successText: 'Copied',
      className: 'size-8 justify-self-end',
    });
    expect(container.querySelector('.text-center.font-mono')?.className).toBe(
      'text-center font-mono text-base font-semibold tracking-[0.25em] text-white',
    );
  });

  it('connected（connector.status==="authenticated"）⇒ 单行 + 绿点 + 「已连接」，无按钮', () => {
    const { container } = render(
      <ConnectorAuthCard
        content={connectorContent({ status: 'authenticated' })}
        bridge={{}}
      />,
    );
    expect(container.textContent).toContain('已连接');
    expect(container.querySelectorAll('button')).toHaveLength(0);
    const card = container.firstElementChild?.firstElementChild;
    expect(card?.className).toBe(
      'flex w-full flex-col rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3',
    );
    expect(container.querySelector('.size-1\\.5')?.className).toBe(
      'size-1.5 rounded-full bg-accent-accent-success',
    );
    expect(container.querySelector('.text-accent-accent-success')?.className).toBe(
      'flex shrink-0 items-center gap-1.5 text-xs font-medium leading-4 text-accent-accent-success',
    );
  });

  it('skipped（store 命中）⇒ 只有 Skipped 文本 + opacity-60，无按钮', () => {
    const { container } = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{ isSkipped: (key) => key === 'call-7:slack' }}
      />,
    );
    expect(container.textContent).toContain('已跳过');
    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(container.firstElementChild?.firstElementChild?.className).toContain('opacity-60');
    expect(container.querySelector('.text-text-text-tertiary')?.className).toBe(
      'whitespace-nowrap text-xs font-medium leading-4 text-text-text-tertiary',
    );
  });

  it('Skip ⇒ `markSkipped(`${toolCallId}:${connectorId}`)`，且不发请求', () => {
    const markSkipped = vi.fn();
    const startSession = vi.fn();
    const { container } = render(
      <ConnectorAuthCard content={connectorContent()} bridge={{ markSkipped, startSession }} />,
    );
    fireEvent.click([...container.querySelectorAll('button')][0]);
    expect(markSkipped).toHaveBeenCalledWith('call-7:slack');
    expect(startSession).not.toHaveBeenCalled();
  });

  it('expired ⇒ statusExpired 文案（含 {{name}} 插值）', () => {
    const { container } = render(
      <ConnectorAuthCard content={connectorContent({ status: 'expired' })} bridge={{}} />,
    );
    expect(container.textContent).toContain('Slack 授权已过期，请重新连接。');
  });

  it('pollingError（waiting 中）⇒ failed 态 + Retry 按钮', async () => {
    const { container, rerender } = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{
          startSession: vi.fn().mockResolvedValue({ sessionId: 's-6', verificationUrl: 'https://v' }),
        }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(container.textContent).toContain('等待授权中...');
    rerender(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{ startSession: vi.fn(), pollingError: { code: 1 } }}
      />,
    );
    await waitFor(() => expect(container.textContent).toContain('连接失败。'));
    expect([...container.querySelectorAll('button')].map((b) => b.textContent)).toEqual([
      '跳过',
      '重试',
    ]);
  });

  it('connector icon：有 icon ⇒ `<img class="size-full object-contain">` 白底圆角容器', () => {
    const { container } = render(
      <ConnectorAuthCard
        content={connectorContent({ icon: ' https://cdn.example/i.png ' })}
        bridge={{}}
      />,
    );
    const wrap = container.querySelector('img')?.parentElement;
    expect(wrap?.className).toBe(
      'flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-white',
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/i.png');
    expect(container.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('img')?.getAttribute('draggable')).toBe('false');
  });

  it('无 icon ⇒ 走 bridge.renderPluginIcon（官方 `Gi`）；未注入 ⇒ 不渲染图标', () => {
    const renderPluginIcon = vi.fn(() => <span data-testid="plugin-icon" />);
    const view = render(
      <ConnectorAuthCard content={connectorContent()} bridge={{ renderPluginIcon }} />,
    );
    expect(view.queryByTestId('plugin-icon')).not.toBeNull();
    expect(renderPluginIcon).toHaveBeenCalledWith({
      pluginId: 'slack',
      label: 'Slack',
      size: 18,
      variant: 'pill',
    });
    view.unmount();

    const bare = render(<ConnectorAuthCard content={connectorContent()} bridge={{}} />);
    expect(bare.container.querySelector('img')).toBeNull();
  });

  it('startSession 返回 null ⇒ 走官方 onError(startFailed) 兜底，不改状态', async () => {
    const onError = vi.fn();
    const { container } = render(
      <ConnectorAuthCard
        content={connectorContent()}
        bridge={{ startSession: vi.fn().mockResolvedValue(null), onError }}
      />,
    );
    await act(async () => {
      fireEvent.click([...container.querySelectorAll('button')][1]);
    });
    expect(onError).toHaveBeenCalledWith('启动连接器授权失败');
    expect(container.textContent).toContain('检测到 Slack 尚未成功连接');
  });
});

/* ==========================================================================
 * 3. McpAppCard（官方 `nre` @2330684 + `Stt` @2345405）
 * ========================================================================== */

describe('McpAppCard —— 结构 / 常量（nre + Stt）', () => {
  function mcpContent(overrides: Record<string, unknown> = {}) {
    return {
      schema_version: 'tool_event.v1' as const,
      type: 'tool_event' as const,
      tool: 'show_widget',
      status: 'completed',
      tool_call_id: 'call-mcp',
      ui: { resource_uri: 'ui://tapnow/actor-emotion@v1' },
      request: { title: 'Emotion picker' },
      response: { summary: 'summary line' },
      ...overrides,
    };
  }

  it('无 ui.resource_uri ⇒ return null', () => {
    const view = render(<McpAppCard content={{ ...mcpContent(), ui: {} }} />);
    expect(view.container.innerHTML).toBe('');
  });

  it('根容器 className / role / data-expanded 逐字；header 标题取 request.title', () => {
    const { container } = render(<McpAppCard content={mcpContent()} />);
    const root = container.firstElementChild;
    expect(root?.tagName).toBe('DIV');
    expect(root?.className).toBe('my-2 w-full');
    expect(root?.getAttribute('role')).toBe('dialog');
    expect(root?.getAttribute('data-expanded')).toBe('false');
    expect(root?.getAttribute('aria-modal')).toBe('false');
    expect(container.textContent).toContain('Emotion picker');
    /* header 行逐字 */
    expect(container.querySelector('.h-8')?.className).toBe(
      'flex h-8 items-center justify-between gap-2 px-1',
    );
  });

  it('loading 骨架行逐字（Stt）：h-4 w-4 border-2 + `chatAdapter.mcpApp.loading`', () => {
    const { container } = render(<McpAppCard content={mcpContent()} />);
    const row = container.querySelector('div.flex.items-center.gap-2.px-3.py-3');
    expect(row).not.toBeNull();
    expect(row?.querySelector('div')?.className).toBe(
      'h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground',
    );
    expect(row?.querySelector('output')?.className).toBe('text-xs text-muted-foreground');
    expect(row?.textContent).toBe('正在加载面板…');
  });

  it('iframe：sandbox 只有 allow-scripts / 无 allow / src = 官方代理页 / display:none / height 200px / title = request.title ?? "App"', () => {
    const { container } = render(<McpAppCard content={mcpContent()} />);
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe?.hasAttribute('allow')).toBe(false);
    expect(iframe?.hasAttribute('referrerpolicy')).toBe(false);
    expect(iframe?.getAttribute('src')).toBe('/usercontent-proxy/mcp-app-proxy.html');
    expect(iframe?.getAttribute('title')).toBe('Emotion picker');
    expect(iframe?.style.display).toBe('none');
    expect(iframe?.style.height).toBe('200px');
    expect(iframe?.style.width).toBe('100%');
    expect(iframe?.style.overflow).toBe('hidden');
  });

  it('iframe title 缺省 = "App"；无 request.title 时 header 用 i18n「应用」', () => {
    const { container } = render(<McpAppCard content={mcpContent({ request: {} })} />);
    expect(container.querySelector('iframe')?.getAttribute('title')).toBe('App');
    expect(container.querySelector('.text-\\[13px\\]')?.textContent).toBe('应用');
  });

  it('previs 资源 ⇒ header 显示 "Previs"，但 iframe title 仍为 "App"（官方无 Previs 分支）', () => {
    const { container } = render(
      <McpAppCard content={mcpContent({ ui: { resource_uri: 'ui://tapnow/previs@v3' }, request: {} })} />,
    );
    expect(container.querySelector('.text-\\[13px\\]')?.textContent).toBe('Previs');
    expect(container.querySelector('iframe')?.getAttribute('title')).toBe('App');
  });

  it('展开按钮只在 policy.allowExpanded 时出现（actor-emotion true / 未知资源 false）', () => {
    const allowed = render(<McpAppCard content={mcpContent()} />);
    const toggle = allowed.container.querySelector('[data-mcp-app-expand-toggle]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('放大应用');
    expect(toggle?.getAttribute('title')).toBe('放大应用');
    expect(toggle?.className).toBe(
      'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    );
    /* 官方 `a$`/`l$`：lucide Minimize2 / Maximize2，仅 `aria-hidden` + `className="size-4"` */
    const icon = toggle?.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('size-4');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    allowed.unmount();

    const denied = render(
      <McpAppCard content={mcpContent({ ui: { resource_uri: 'ui://tapnow/unknown@v1' } })} />,
    );
    expect(denied.container.querySelector('[data-mcp-app-expand-toggle]')).toBeNull();
  });

  it('展开 ⇒ backdrop + dialog className + iframe 高度算式 + aria-expanded', () => {
    const { container } = render(<McpAppCard content={mcpContent()} />);
    const toggle = container.querySelector('[data-mcp-app-expand-toggle]')!;
    act(() => {
      fireEvent.click(toggle);
    });
    const backdrop = container.querySelector('[data-testid="mcp-app-backdrop"]');
    expect(backdrop?.tagName).toBe('BUTTON');
    expect(backdrop?.getAttribute('aria-label')).toBe('关闭放大的应用');
    expect(backdrop?.className).toBe('fixed inset-0 z-[99] cursor-default bg-black/55');
    const root = container.querySelector('[role="dialog"]');
    expect(root?.className).toBe(
      'fixed left-1/2 top-1/2 z-[100] flex h-[88vh] w-[min(1280px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl',
    );
    expect(root?.getAttribute('data-expanded')).toBe('true');
    expect(container.querySelector('iframe')?.style.height).toBe('calc(88vh - 36px)');
    expect(container.querySelector('.h-9')?.className).toBe(
      'flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border/50 px-2.5',
    );
    expect(container.querySelector('[data-mcp-app-expand-toggle]')?.getAttribute('aria-label')).toBe(
      '收起应用',
    );

    /* backdrop 点击收起 */
    act(() => {
      fireEvent.click(backdrop!);
    });
    expect(container.querySelector('[data-testid="mcp-app-backdrop"]')).toBeNull();
    expect(container.querySelector('iframe')?.style.height).toBe('200px');
  });

  it('Esc 收起展开（官方 keydown effect）', () => {
    const { container } = render(<McpAppCard content={mcpContent()} />);
    act(() => {
      fireEvent.click(container.querySelector('[data-mcp-app-expand-toggle]')!);
    });
    expect(container.querySelector('[data-testid="mcp-app-backdrop"]')).not.toBeNull();
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(container.querySelector('[data-testid="mcp-app-backdrop"]')).toBeNull();
  });
});

describe('McpAppCard —— host bridge 回调（未注入 ⇒ 不伪造 ready/error）', () => {
  const content = {
    schema_version: 'tool_event.v1' as const,
    type: 'tool_event' as const,
    tool: 'show_widget',
    status: 'completed',
    tool_call_id: 'call-mcp',
    ui: { resource_uri: 'ui://tapnow/actor-emotion@v1' },
    request: { title: 'Emotion picker' },
    response: { summary: 'summary line' },
  };

  type Captured = { options: McpAppHostBridgeOptions | null; disposed: number };

  function mountWithBridge() {
    const captured: Captured = { options: null, disposed: 0 };
    const view = render(
      <McpAppCard
        content={content}
        createHostBridge={(options) => {
          captured.options = options;
          return {
            start: () => {},
            dispose: () => {
              captured.disposed += 1;
            },
            updatePresentationState: () => {},
            updateConversationRunActive: () => {},
            sendPresentationShortcut: () => {},
          };
        }}
        locale="zh-CN"
        conversationId="conv-1"
      />,
    );
    return { ...view, captured };
  }

  it('createHostBridge 收到官方形状的 options（resourceUri / toolInput / toolResult / locale / callbacks）', () => {
    const { captured } = mountWithBridge();
    expect(captured.options).not.toBeNull();
    expect(captured.options?.resourceUri).toBe('ui://tapnow/actor-emotion@v1');
    expect(captured.options?.toolInput).toEqual({ title: 'Emotion picker' });
    expect(captured.options?.toolResult).toEqual({ summary: 'summary line' });
    expect(captured.options?.locale).toBe('zh-CN');
    expect(typeof captured.options?.callbacks.onReady).toBe('function');
    expect(typeof captured.options?.callbacks.onError).toBe('function');
    expect(typeof captured.options?.callbacks.onSizeChanged).toBe('function');
    expect(typeof captured.options?.callbacks.onToolCall).toBe('function');
    /* actor-emotion 不支持 update_model_context ⇒ 不注入该回调 */
    expect('onUpdateModelContext' in (captured.options?.callbacks ?? {})).toBe(false);
  });

  it('未注入 createHostBridge ⇒ status 恒 loading（骨架常在、iframe display:none），不伪造 ready/error', () => {
    const { container } = render(<McpAppCard content={content} />);
    expect(container.textContent).toBe('Emotion picker' + '正在加载面板…');
    expect(container.querySelector('iframe')?.style.display).toBe('none');
    expect(container.textContent).not.toContain('面板暂时未能加载');
  });

  it('onReady ⇒ ready（骨架消失、iframe display:block）', async () => {
    const { container, captured } = mountWithBridge();
    await act(async () => {
      captured.options!.callbacks.onReady();
    });
    expect(container.querySelector('div.flex.items-center.gap-2.px-3.py-3')).toBeNull();
    expect(container.querySelector('iframe')?.style.display).toBe('block');
  });

  it('onError("timeout") ⇒ error 面板 + loadTimeout 文案 + Reload 按钮', async () => {
    const { container, captured } = mountWithBridge();
    await act(async () => {
      captured.options!.callbacks.onError('timeout');
    });
    expect(container.textContent).toContain('面板暂时未能加载');
    expect(container.textContent).toContain('summary line');
    expect(container.textContent).toContain('面板资源加载或初始化超时');
    expect(container.textContent).toContain('重新加载面板');
    const panel = container.querySelector('[aria-live="polite"]');
    expect(panel?.className).toBe(
      'flex min-h-40 flex-col items-start justify-center gap-3 rounded-lg border border-border/50 px-4 py-5',
    );
    expect(captured.disposed).toBe(1);
  });

  it('onError 非白名单 ⇒ 原始 reason 被截断到 240 字符显示', async () => {
    const { container, captured } = mountWithBridge();
    await act(async () => {
      captured.options!.callbacks.onError('x'.repeat(300));
    });
    expect(container.textContent).toContain('x'.repeat(240));
    expect(container.textContent).not.toContain('x'.repeat(241));
  });

  it('onSizeChanged 夹取到 [100, maxInlineHeight]；actor-emotion 无上限', async () => {
    const { container, captured } = mountWithBridge();
    await act(async () => {
      captured.options!.callbacks.onSizeChanged(40);
    });
    expect(container.querySelector('iframe')?.style.height).toBe('100px');
    await act(async () => {
      captured.options!.callbacks.onSizeChanged(640);
    });
    expect(container.querySelector('iframe')?.style.height).toBe('640px');
  });

  it('手动 Reload ⇒ reducer 走 retry（attempt+1、automaticRetries 归零）并重挂 iframe', async () => {
    const { container, captured } = mountWithBridge();
    await act(async () => {
      captured.options!.callbacks.onError('resource_error');
    });
    const reload = screen.getByText('重新加载面板');
    await act(async () => {
      fireEvent.click(reload);
    });
    /* attempt 已 >0 ⇒ 官方 `Stt` 的 `retrying` 分支显示 `retryLoading`。 */
    expect(container.textContent).toContain('正在重新加载面板…');
    expect(container.querySelector('iframe')?.style.display).toBe('none');
  });

  it('previs 失败 ⇒ error 面板显示「正在准备自动重试…」（Jse 非 null）', async () => {
    const captured: { options: McpAppHostBridgeOptions | null } = { options: null };
    const { container } = render(
      <McpAppCard
        content={{ ...content, ui: { resource_uri: 'ui://tapnow/previs@v3' } }}
        createHostBridge={(options) => {
          captured.options = options;
          return {
            start: () => {},
            dispose: () => {},
            updatePresentationState: () => {},
            updateConversationRunActive: () => {},
            sendPresentationShortcut: () => {},
          };
        }}
      />,
    );
    await act(async () => {
      captured.options!.callbacks.onError('resource_error');
    });
    expect(container.textContent).toContain('正在准备自动重试…');
  });

  it('onSendPrompt 返回 false 时 bridge 收到 false；返回 undefined ⇒ true（并在 collapseOnSendMessage 时收起）', async () => {
    const captured: { options: McpAppHostBridgeOptions | null } = { options: null };
    const onSendPrompt = vi.fn().mockResolvedValue(undefined);
    render(
      <McpAppCard
        content={content}
        onSendPrompt={onSendPrompt}
        collapseOnSendMessage
        createHostBridge={(options) => {
          captured.options = options;
          return {
            start: () => {},
            dispose: () => {},
            updatePresentationState: () => {},
            updateConversationRunActive: () => {},
            sendPresentationShortcut: () => {},
          };
        }}
      />,
    );
    let result: unknown;
    await act(async () => {
      result = await captured.options!.callbacks.onSendPrompt('  hi  ');
    });
    expect(result).toBe(true);
    expect(onSendPrompt).toHaveBeenCalledWith('hi', undefined);

    await act(async () => {
      result = await captured.options!.callbacks.onSendPrompt('   ');
    });
    expect(result).toBe(false);
  });
});
