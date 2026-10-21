// @vitest-environment jsdom
/**
 * `desktop_*_confirmation` 卡的纯函数层回归 —— 验证分级 **(d) 源码级**。
 * 每条断言都对着 live bundle 的逐字源码（偏移见被测模块文件头）。
 *
 * ⚠️ 用 jsdom 环境：被测模块的 `K5`（官方 @2156643）逐字读 **`window.localStorage`**，
 * node 环境下 `typeof window > "u"` ⇒ 整个缓存层是 no-op，无法验证。
 */
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_CACHE_TTL_MS,
  DESKTOP_CLIENT_ACTION_KINDS,
  DESKTOP_CONFIRMATION_TITLE_FALLBACKS,
  DESKTOP_CONFIRMATION_TITLE_HARD_FALLBACK,
  DESKTOP_CONFIRMATION_TOOLS,
  DESKTOP_RESULT_TRUNCATE_CHARS,
  DESKTOP_RUN_CACHE_PREFIX,
  DESKTOP_RESULT_CACHE_PREFIX,
  DESKTOP_SKIPPED_ERROR_CODES,
  buildDesktopAnswerPayload,
  canInteractWithDesktopConfirmation,
  clearDesktopConfirmationResultCache,
  clearDesktopConfirmationRunCache,
  dedupeTrimmedStrings,
  desktopConfirmationEnvelope,
  desktopConfirmationId,
  desktopConfirmationKind,
  desktopConfirmationPolicyAllows,
  desktopConfirmationSummary,
  desktopConfirmationTitleDefault,
  expandDesktopRequestJson,
  isDesktopConfirmationEvent,
  isDesktopConfirmationInFlight,
  officialAnswerAction,
  officialErrorCode,
  officialSortComparator,
  readDesktopConfirmationResultCache,
  readDesktopConfirmationRunCache,
  resolveDesktopConfirmationStatus,
  stableJsonStringify,
  truncateDesktopActionResult,
  writeDesktopConfirmationResultCache,
  writeDesktopConfirmationRunCache,
} from '../../../src/services/chat/desktopConfirmationCard';
import {
  officialDesktopConnectorMcpText,
  useDesktopConnectorMcpText,
  officialDesktopConnectorMcpTextKeys,
} from '../../../src/services/chat/desktopConnectorMcpStrings';

/** 官方 `n` = `se()` 的 `t`：本测试直接用真实文案表（zh-CN）。 */
const t = (key: string, defaultValue?: Parameters<typeof officialDesktopConnectorMcpText>[2]) =>
  officialDesktopConnectorMcpText(key, 'zh-CN', defaultValue);

describe('desktopConfirmationCard —— 族谓词（LNe @442270 / kD @444089 / xl @443724）', () => {
  it('工具名集合逐字为 5 个', () => {
    expect([...DESKTOP_CONFIRMATION_TOOLS]).toEqual([
      'desktop_open_app_confirmation',
      'desktop_capture_screen_confirmation',
      'desktop_fs_confirmation',
      'desktop_shell_command_confirmation',
      'batch_download_files_confirmation',
    ]);
  });

  it('只认 content.tool（不是 tool_name）', () => {
    expect(
      isDesktopConfirmationEvent({
        type: 'tool_event',
        content: { tool: 'desktop_fs_confirmation' },
      }),
    ).toBe(true);
    expect(
      isDesktopConfirmationEvent({
        type: 'tool_event',
        content: { tool_name: 'desktop_fs_confirmation' },
      }),
    ).toBe(false);
    expect(
      isDesktopConfirmationEvent({ type: 'tool_event', content: null }),
    ).toBe(false);
    expect(isDesktopConfirmationEvent({ type: 'text', content: { tool: 'desktop_fs_confirmation' } })).toBe(
      false,
    );
  });
});

describe('desktopConfirmationCard —— 静态表（BQe @2159581 / VQe @2159839 / zQe @2158792 / d_ @2157895）', () => {
  it('BQe 五项逐字 + 硬兜底串', () => {
    expect(DESKTOP_CONFIRMATION_TITLE_FALLBACKS).toEqual({
      desktop_open_app: 'Open app on this desktop',
      desktop_capture_screen: 'Capture screen on this desktop',
      desktop_fs: 'Agent requests local folder access',
      desktop_shell_command: 'Run a shell command on this desktop',
      batch_download_files: 'Download files',
    });
    expect(DESKTOP_CONFIRMATION_TITLE_HARD_FALLBACK).toBe('Run a desktop action');
    expect(desktopConfirmationTitleDefault('desktop_fs')).toBe(
      'Agent requests local folder access',
    );
    expect(desktopConfirmationTitleDefault('unknown_kind')).toBe('Run a desktop action');
  });

  it('VQe 只有 batch_download_files', () => {
    expect([...DESKTOP_CLIENT_ACTION_KINDS]).toEqual(['batch_download_files']);
  });

  it('zQe 三个 error code 逐字', () => {
    expect([...DESKTOP_SKIPPED_ERROR_CODES]).toEqual([
      'superseded_by_new_message',
      'generation_confirmation_expired',
      'conversation_cancelled',
    ]);
  });

  it('d_ = 51200', () => {
    expect(DESKTOP_RESULT_TRUNCATE_CHARS).toBe(51200);
  });
});

describe('desktopConfirmationCard —— 状态解析（Uoe @2158894 / UQe @2159023 / Ff @2159117 / Of @2159421）', () => {
  it('Uoe 的取值顺序 response.action → response.answer.action → result.action → result.answer.action → action', () => {
    expect(officialAnswerAction({ action: 'a' })).toBe('a');
    expect(officialAnswerAction({ result: { action: 'b' }, action: 'a' })).toBe('b');
    expect(officialAnswerAction({ response: { answer: { action: 'c' } }, action: 'a' })).toBe('c');
    expect(officialAnswerAction({ response: { action: 'reject' } })).toBe('reject');
  });

  it('UQe 只认字符串 code', () => {
    expect(officialErrorCode({ error: { code: 'x' } })).toBe('x');
    expect(officialErrorCode({ result: { error: { code: 'y' } } })).toBe('y');
    expect(officialErrorCode({ error: { code: 42 } })).toBe('');
  });

  it('Ff：store pendingConfirmation 优先，其次 resolvedConfirmations，再按 status/action 推', () => {
    expect(
      resolveDesktopConfirmationStatus({ status: 'started' }, 'c1', {
        pendingConfirmation: { confirmationId: 'c1', status: 'pending' },
      }),
    ).toBe('pending');
    expect(
      resolveDesktopConfirmationStatus({ status: 'started' }, 'c1', {
        resolvedConfirmations: { c1: 'confirmed' },
      }),
    ).toBe('confirmed');
    expect(resolveDesktopConfirmationStatus({ status: 'completed' }, 'c1', null)).toBe('confirmed');
    expect(
      resolveDesktopConfirmationStatus({ status: 'completed', response: { action: 'reject' } }, 'c1', null),
    ).toBe('rejected');
    expect(resolveDesktopConfirmationStatus({ status: 'failed' }, 'c1', null)).toBe('rejected');
    expect(
      resolveDesktopConfirmationStatus(
        { status: 'failed', error: { code: 'conversation_cancelled' } },
        'c1',
        null,
      ),
    ).toBe('skipped');
    expect(resolveDesktopConfirmationStatus({ status: 'started' }, 'c1', null)).toBe('pending');
  });

  it('Of：status==="started" 且无 action 且 store 无记录 ⇒ 在途（整卡 null）', () => {
    expect(isDesktopConfirmationInFlight({ status: 'started' }, 'c1', null)).toBe(true);
    expect(isDesktopConfirmationInFlight({ status: 'completed' }, 'c1', null)).toBe(false);
    expect(
      isDesktopConfirmationInFlight({ status: 'started', response: { action: 'confirm' } }, 'c1', null),
    ).toBe(false);
    expect(
      isDesktopConfirmationInFlight({ status: 'started' }, 'c1', {
        pendingConfirmation: { confirmationId: 'c1', status: 'pending' },
      }),
    ).toBe(false);
  });
});

describe('desktopConfirmationCard —— view-model（Boe @2159902 / GQe @2160058）', () => {
  it('Boe 展开 detail.request_json，缺失则原样返回', () => {
    expect(expandDesktopRequestJson({ detail: { request_json: { operation: 'pick_file' } } })).toEqual({
      operation: 'pick_file',
    });
    expect(expandDesktopRequestJson({ operation: 'pick_file' })).toEqual({ operation: 'pick_file' });
    expect(expandDesktopRequestJson({ detail: { request_json: 'nope' } })).toEqual({
      detail: { request_json: 'nope' },
    });
  });

  it('GQe 去重且保序、只留字符串', () => {
    expect(dedupeTrimmedStrings([' a ', 'a', 'b', 1, null, '  ', 'b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(dedupeTrimmedStrings('x')).toEqual([]);
  });
});

describe('desktopConfirmationCard —— MM / OQe（@2157930 / @2158411）', () => {
  it('MM 稳定键序 + null/undefined 语义', () => {
    expect(stableJsonStringify({ b: 1, a: 2 })).toBe('{"a": 2, "b": 1}');
    expect(stableJsonStringify(null)).toBe('null');
    expect(stableJsonStringify(Number.NaN)).toBe('null');
    expect(stableJsonStringify(undefined)).toBeUndefined();
    expect(stableJsonStringify([1, undefined, 'x'])).toBe('[1, null, "x"]');
    expect(officialSortComparator('a', 'b')).toBe(-1);
  });

  it('OQe：小结果原样返回；大结果截断 + truncated_chars', () => {
    expect(truncateDesktopActionResult({ ok: true })).toEqual({ ok: true });
    const big = 'x'.repeat(DESKTOP_RESULT_TRUNCATE_CHARS + 10);
    const out = truncateDesktopActionResult({ ok: true, payload: big });
    expect(out.truncated).toBe(true);
    expect(out.ok).toBe(true);
    expect(out.preview_json?.length).toBe(DESKTOP_RESULT_TRUNCATE_CHARS);
    expect(out.truncated_chars).toBeGreaterThan(0);
  });

  it('OQe：已 truncated 且带 preview_json ⇒ 只再裁 preview_json', () => {
    const out = truncateDesktopActionResult({
      truncated: true,
      truncated_chars: 7,
      preview_json: 'y'.repeat(DESKTOP_RESULT_TRUNCATE_CHARS + 5),
    });
    expect(out.truncated).toBe(true);
    expect(out.truncated_chars).toBe(7);
    expect(out.preview_json?.length).toBe(DESKTOP_RESULT_TRUNCATE_CHARS);
  });

  it('hy = (e,t)=>({[e]:OQe(t)})', () => {
    expect(buildDesktopAnswerPayload('desktop_fs', { ok: true })).toEqual({
      desktop_fs: { ok: true },
    });
  });
});

describe('desktopConfirmationCard —— HQe 摘要构造器（@2160228，逐字 switch）', () => {
  it('desktop_open_app / desktop_capture_screen 的硬编码英文', () => {
    expect(desktopConfirmationSummary(t, 'desktop_open_app', { app_id: 'Figma' })).toBe('App: Figma');
    expect(desktopConfirmationSummary(t, 'desktop_capture_screen', {})).toBe('Scope: current screen');
    expect(
      desktopConfirmationSummary(t, 'desktop_capture_screen', { scope: 'window' }),
    ).toBe('Scope: window');
    expect(
      desktopConfirmationSummary(t, 'desktop_capture_screen', { window_id: 'w-1' }),
    ).toBe('Scope: w-1');
  });

  it('desktop_shell_command 直接回 command', () => {
    expect(desktopConfirmationSummary(t, 'desktop_shell_command', { command: 'ls -la' })).toBe('ls -la');
  });

  it('desktop_fs 兜底分支 `Operation: …\\nTarget: …`', () => {
    expect(desktopConfirmationSummary(t, 'desktop_fs', {})).toBe(
      'Operation: \nTarget: choose target after confirming',
    );
    expect(
      desktopConfirmationSummary(t, 'desktop_fs', { operation: 'delete', file_grant_id: 'g1' }),
    ).toBe('Operation: delete\nTarget: g1');
    expect(
      desktopConfirmationSummary(t, 'desktop_fs', { operation: 'pick_file', file_grant_id: 'g1' }),
    ).toBe('Agent needs access to a local file. After you confirm, pick a file to grant access.');
  });

  it('desktop_fs 的 4 条硬编码英文分支', () => {
    expect(
      desktopConfirmationSummary(t, 'desktop_fs', { operation: 'pick_directory' }),
    ).toBe('Agent needs access to a local folder. After you confirm, pick a folder to grant access.');
    expect(desktopConfirmationSummary(t, 'desktop_fs', { operation: 'pick_file' })).toBe(
      'Agent needs access to a local file. After you confirm, pick a file to grant access.',
    );
    expect(
      desktopConfirmationSummary(t, 'desktop_fs', {
        operation: 'batch_upload',
        batch_source: 'pick_directory',
      }),
    ).toBe('After you confirm, pick a local folder to upload its files.');
    expect(desktopConfirmationSummary(t, 'desktop_fs', { operation: 'batch_upload' })).toBe(
      'After you confirm, pick local files to upload.',
    );
  });

  it('desktop_fs.batch_write：有 items 用数量，无 items 用 i18n「由 Agent 选择」', () => {
    expect(
      desktopConfirmationSummary(t, 'desktop_fs', {
        operation: 'batch_write',
        items: [1, 2, 3],
        directory_grant_id: 'dir-1',
      }),
    ).toBe('文件：3\n保存位置：dir-1');
    expect(desktopConfirmationSummary(t, 'desktop_fs', { operation: 'batch_write' })).toBe(
      '文件：由 Agent 选择\n保存位置：确认后选择本地文件夹',
    );
  });

  it('desktop_fs.organize：目录行 + 数量行 + 前 4 条 + more', () => {
    const actions = [
      { type: 'mkdir', path: 'A' },
      { type: 'rename', source: 's', destination: 'd' },
      { type: 'move', source: 'm1', destination: 'm2' },
      { type: 'weird', source: 'w1', destination: 'w2' },
      { type: 'move', source: 'x1', destination: 'x2' },
      'not-an-object',
    ];
    const out = desktopConfirmationSummary(t, 'desktop_fs', { operation: 'organize', actions }, '已授权目录');
    const lines = out.split('\n');
    expect(lines[0]).toBe('操作目录：已授权目录');
    /* 官方 `d` 先过滤出对象型 action ⇒ 5 条（`'not-an-object'` 被丢弃）。 */
    expect(lines[1]).toBe('操作数量：5');
    expect(lines[2]).toBe('创建文件夹：A');
    expect(lines[3]).toBe('重命名：s → d');
    expect(lines[4]).toBe('移动：m1 → m2');
    /* 未知 type 落到 move（官方 `const f=m.type==="rename"?"rename":"move"`）。 */
    expect(lines[5]).toBe('移动：w1 → w2');
    expect(lines[6]).toBe('另有 1 项');
    expect(lines).toHaveLength(7);
  });

  it('desktop_fs.organize：无 o 时依次回落 directory_grant_id → i18n authorizedFolder', () => {
    expect(
      desktopConfirmationSummary(t, 'desktop_fs', {
        operation: 'organize',
        actions: [],
        directory_grant_id: 'dir-9',
      }).split('\n')[0],
    ).toBe('操作目录：dir-9');
    expect(
      desktopConfirmationSummary(t, 'desktop_fs', { operation: 'organize', actions: [] }).split('\n')[0],
    ).toBe('操作目录：已授权文件夹');
  });

  it('batch_download_files：files+node_refs 计数，destination 由 desktopCapability.available 决定', () => {
    expect(
      desktopConfirmationSummary(t, 'batch_download_files', { file_ids: ['a'], node_refs: ['n1', 'n2'] }),
    ).toBe('Files: 3\nDestination: browser downloads');
    expect(
      desktopConfirmationSummary(
        t,
        'batch_download_files',
        { file_ids: ['a'] },
        undefined,
        true,
      ),
    ).toBe('Files: 1\nDestination: Desktop save dialog');
    expect(desktopConfirmationSummary(t, 'batch_download_files', {})).toBe(
      'Files: selected by Agent\nDestination: browser downloads',
    );
  });

  it('未知 kind ⇒ 空串', () => {
    expect(desktopConfirmationSummary(t, 'nope', {})).toBe('');
  });
});

describe('desktopConfirmationCard —— localStorage 缓存（Q5/Z5/zoe/DB/J5/fy/LB/LQe/c_）', () => {
  it('常量逐字', () => {
    expect(DESKTOP_RUN_CACHE_PREFIX).toBe('tap:desktop-confirmation-run:v1:');
    expect(DESKTOP_RESULT_CACHE_PREFIX).toBe('tap:desktop-confirmation-result:v1:');
    expect(DESKTOP_CACHE_TTL_MS).toBe(1440 * 60 * 1e3);
  });

  it('run 缓存：写入后可读；字段缺失 / 过期 / canvasId 不符 ⇒ 返回 null 并清键', () => {
    writeDesktopConfirmationRunCache({
      canvasId: 'cv1',
      conversationId: 'c1',
      runId: 'r1',
      assistantMessageId: 'm1',
      confirmationId: 'cf1',
    });
    expect(readDesktopConfirmationRunCache('cv1')?.runId).toBe('r1');
    /* canvasId 不符 ⇒ 清键 */
    expect(readDesktopConfirmationRunCache('cv2')).toBeNull();

    localStorage.setItem(
      `${DESKTOP_RUN_CACHE_PREFIX}cv3`,
      JSON.stringify({
        canvasId: 'cv3',
        conversationId: 'c',
        runId: 'r',
        assistantMessageId: 'm',
        confirmationId: 'cf',
        expiresAt: Date.now() - 1,
      }),
    );
    expect(readDesktopConfirmationRunCache('cv3')).toBeNull();
    expect(localStorage.getItem(`${DESKTOP_RUN_CACHE_PREFIX}cv3`)).toBeNull();

    localStorage.setItem(`${DESKTOP_RUN_CACHE_PREFIX}cv4`, 'not-json');
    expect(readDesktopConfirmationRunCache('cv4')).toBeNull();
  });

  it('fy：runId 不匹配时不删；匹配（或不传）时删', () => {
    writeDesktopConfirmationRunCache({
      canvasId: 'cv5',
      conversationId: 'c',
      runId: 'r',
      assistantMessageId: 'm',
      confirmationId: 'cf',
    });
    clearDesktopConfirmationRunCache('cv5', 'other-run');
    expect(localStorage.getItem(`${DESKTOP_RUN_CACHE_PREFIX}cv5`)).not.toBeNull();
    clearDesktopConfirmationRunCache('cv5', 'r');
    expect(localStorage.getItem(`${DESKTOP_RUN_CACHE_PREFIX}cv5`)).toBeNull();
  });

  it('result 缓存：写入后可读；空 id 直接 no-op', () => {
    writeDesktopConfirmationResultCache('cf9', { ok: true });
    expect(readDesktopConfirmationResultCache('cf9')).toEqual({ ok: true });
    clearDesktopConfirmationResultCache('cf9');
    expect(readDesktopConfirmationResultCache('cf9')).toBeUndefined();
    expect(readDesktopConfirmationResultCache('')).toBeUndefined();
  });
});

describe('desktopConfirmationCard —— envelope / 交互判定', () => {
  it('d = content.request ?? content.result ?? {}', () => {
    expect(desktopConfirmationEnvelope({ request: { confirmation_id: 'a' }, result: { confirmation_id: 'b' } })).toEqual(
      { confirmation_id: 'a' },
    );
    expect(desktopConfirmationEnvelope({ result: { confirmation_id: 'b' } })).toEqual({
      confirmation_id: 'b',
    });
    expect(desktopConfirmationEnvelope(null)).toEqual({});
    expect(desktopConfirmationId({ confirmation_id: 7 })).toBe('7');
    expect(desktopConfirmationKind({})).toBe('');
  });

  it('S = !p || !f || f.isKindEnabled(p)', () => {
    expect(desktopConfirmationPolicyAllows('desktop_fs', null)).toBe(true);
    expect(desktopConfirmationPolicyAllows('', { isKindEnabled: () => false })).toBe(true);
    expect(
      desktopConfirmationPolicyAllows('desktop_fs', { isKindEnabled: (kind) => kind !== 'desktop_fs' }),
    ).toBe(false);
  });

  it('C = canInteract：要求 pending + store 命中 + kind 一致', () => {
    const store = { pendingConfirmation: { confirmationId: 'c1', status: 'pending', kind: 'desktop_fs' } };
    expect(canInteractWithDesktopConfirmation('c1', 'desktop_fs', 'pending', store)).toBe(true);
    expect(canInteractWithDesktopConfirmation('c1', 'desktop_open_app', 'pending', store)).toBe(false);
    expect(canInteractWithDesktopConfirmation('c1', 'desktop_fs', 'confirmed', store)).toBe(false);
    expect(canInteractWithDesktopConfirmation('c1', 'desktop_fs', 'pending', null)).toBe(false);
  });
});

describe('desktopConnectorMcpStrings —— desktop 组覆盖', () => {
  it('24 个 desktopConfirmation 键（= §3.9 的 25 项减去运行时不用的 titles.fallback）'
    + ' + 3 个 addMenu 键 + 10 个 connectorAuthCard 键（= §5.8 的 11 项减去死键 connected）'
    + ' + 12 个 mcpApp 键', () => {
    const keys = officialDesktopConnectorMcpTextKeys();
    expect(keys.filter((k) => k.startsWith('chatAdapter.desktopConfirmation.'))).toHaveLength(24);
    expect(keys.filter((k) => k.startsWith('chatAdapter.connectorAuthCard.'))).toHaveLength(10);
    expect(keys.filter((k) => k.startsWith('chatAdapter.mcpApp.'))).toHaveLength(12);
  });

  it('死键 `connectorAuthCard.connected` 与 `titles.fallback` **不入表**（§9.1）', () => {
    const keys = officialDesktopConnectorMcpTextKeys();
    expect(keys).not.toContain('chatAdapter.connectorAuthCard.connected');
    expect(keys).not.toContain('chatAdapter.desktopConfirmation.titles.fallback');
  });

  it('`{{var}}` 插值 + 未命中回落 defaultValue / key 本身', () => {
    expect(
      officialDesktopConnectorMcpText('chatAdapter.connectorAuthCard.title', 'zh-CN', {
        name: 'Feishu',
        defaultValue: 'Connect with Feishu',
      }),
    ).toBe('连接 Feishu');
    expect(officialDesktopConnectorMcpText('chatAdapter.mcpApp.title', 'zh-CN', 'App')).toBe('应用');
    /* common.* 未入表（未挖到 zh 值）⇒ 回落官方 defaultValue。 */
    expect(officialDesktopConnectorMcpText('common.cancel', 'zh-CN', 'Cancel')).toBe('Cancel');
    expect(officialDesktopConnectorMcpText('no.such.key', 'zh-CN')).toBe('no.such.key');
  });

  it('useDesktopConnectorMcpText 是函数（hook 形状自检）', () => {
    expect(typeof useDesktopConnectorMcpText).toBe('function');
  });
});
