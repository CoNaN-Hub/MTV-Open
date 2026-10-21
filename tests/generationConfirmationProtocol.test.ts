/**
 * 确认卡族**纯函数层**回归（源码级 §(d) + 逻辑断言）。
 *
 * 覆盖：
 *  · `xl` @443724 派生的工具谓词（**大小写敏感** —— 主 agent 仲裁结论）
 *  · `Qet` @2311252 邻域（回退卡 viewModel）
 *  · `bJe` @2225676 / `yJe` @2225316（v1 / legacy 解析器）
 *  · `YJe` @2248830 邻域 + `QJe`/`XJe`/`ZJe`（自动预览）
 *  · `pZe` @2193324 / `Dx` @2268748 / `VJe` @2242278 / `net` @2253553 / `Ose` @2264650
 *  · `Ff` @2159117 / `Of` @2159421
 *  · 第 2 章：`lre`/`jtt`/`cre`/`dre`/`Mtt`/`Ptt`/`Ftt`/`sre`/`ire`/`Ott`
 *  · i18n 表（5 个无中文 key 必须仍回落英文）
 */
import { describe, expect, it } from 'vitest';
import {
  answerActionOf,
  formatPriceEstimate,
  isConfirmationInFlight,
  resolveCardVisualStatus,
  resolveConfirmationCardStatus,
  resolveMentionTokens,
  selectVisibleThumbnails,
  statusStyleOf,
  GENERATION_CONFIRMATION_FALLBACK_TEXT,
  GENERATION_STATUS_PALETTE,
} from '../src/services/chat/generationConfirmation';
import {
  extractFallbackViewModel,
  hasConfirmationItems,
  isAnyConfirmationCardTool,
  isDesktopConfirmationTool,
  isGenerationConfirmationTool,
  isGenerationRequestTool,
  isNodeUpdateConfirmationTool,
  parseGenerationAutoPreview,
  parseGenerationConfirmationLegacy,
  parseGenerationConfirmationV1,
  toolEventNameOf,
} from '../src/services/chat/generationConfirmationProtocol';
import {
  buildNodeUpdateAnswerPayload,
  buildNodeUpdateBody,
  buildNodeUpdateSummary,
  collectNodeUpdateRefs,
  extractNodeUpdateViewModel,
  explicitNodeUpdateText,
  isDiffSummaryLine,
  normalizeNodeUpdateChanges,
  numberGuard,
  resolveNodeUpdateEditTarget,
} from '../src/services/chat/nodeUpdateConfirmation';
import {
  fillOfficialTemplate,
  officialConfirmationText,
  officialConfirmationTextKeys,
} from '../src/services/chat/generationConfirmationStrings';

/* ------------------------------------------------------------------ *
 * 谓词（`xl` @443724，逐字；大小写敏感）
 * ------------------------------------------------------------------ */

describe('xl @443724 —— 工具名谓词大小写敏感', () => {
  it('`xl` 逐字：只取 `content.tool`，不 trim、不小写', () => {
    expect(toolEventNameOf({ type: 'tool_event', content: { tool: 'generation_confirmation' } }))
      .toBe('generation_confirmation');
    expect(toolEventNameOf({ type: 'tool_event', content: { tool: ' generation_confirmation ' } }))
      .toBe(' generation_confirmation ');
    expect(toolEventNameOf({ type: 'text', content: { tool: 'x' } })).toBe('');
    expect(toolEventNameOf({ type: 'tool_event', content: null })).toBe('');
    expect(toolEventNameOf({ type: 'tool_event', content: {} })).toBe('');
  });

  it('`dg`/`iT`/`kD`/`ib` 命中判定不做归一化', () => {
    expect(isGenerationConfirmationTool('generation_confirmation')).toBe(true);
    expect(isGenerationConfirmationTool('Generation_Confirmation')).toBe(false);
    expect(isGenerationConfirmationTool('GENERATION_CONFIRMATION')).toBe(false);
    expect(isNodeUpdateConfirmationTool('node_update_confirmation')).toBe(true);
    expect(isNodeUpdateConfirmationTool('Node_Update_Confirmation')).toBe(false);
    expect(isDesktopConfirmationTool('desktop_fs_confirmation')).toBe(true);
    expect(isDesktopConfirmationTool('Desktop_FS_Confirmation')).toBe(false);
    expect(isAnyConfirmationCardTool('batch_download_files_confirmation')).toBe(true);
    expect(isAnyConfirmationCardTool('cost_limit_confirmation')).toBe(false);
    expect(isGenerationRequestTool('generation_request')).toBe(true);
    expect(isGenerationRequestTool('Generation_Request')).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * `pZe` / `Dx` / `VJe` / `net` / `Ose`
 * ------------------------------------------------------------------ */

describe('pZe @2193324 + Dx @2268748', () => {
  it('5 态色板逐字', () => {
    expect(GENERATION_STATUS_PALETTE.confirmed).toEqual({
      colorClass: 'text-[#7CD5A7]', dotClass: 'bg-[#7CD5A7]',
      labelKey: 'chatAdapter.generationConfirmation.confirmed',
    });
    expect(GENERATION_STATUS_PALETTE.cancelled.colorClass).toBe('text-white/90');
    expect(GENERATION_STATUS_PALETTE.failed.colorClass).toBe('text-[#A55050]');
    expect(GENERATION_STATUS_PALETTE.skipped.colorClass).toBe('text-white/40');
    expect(GENERATION_STATUS_PALETTE.auto.dotClass).toBe('bg-[#90C4E5]');
  });

  it('`Dx` 收敛 + `pending` 不是色板键（调用方统一转 `void 0`）', () => {
    expect(resolveCardVisualStatus({ cardStatus: 'pending' })).toBe('pending');
    expect(resolveCardVisualStatus({ cardStatus: 'rejected' })).toBe('cancelled');
    expect(resolveCardVisualStatus({ cardStatus: 'skipped' })).toBe('skipped');
    expect(resolveCardVisualStatus({ cardStatus: 'confirmed' })).toBe('confirmed');
    expect(resolveCardVisualStatus({ cardStatus: 'confirmed', generationFailed: true })).toBe('failed');
    expect(resolveCardVisualStatus({ isAuto: true })).toBe('auto');
    expect(resolveCardVisualStatus({ isAuto: true, autoFailed: true })).toBe('failed');
    expect(resolveCardVisualStatus({})).toBe('pending');
    expect(statusStyleOf('pending')).toBeNull();
    expect(statusStyleOf('confirmed')?.dotClass).toBe('bg-[#7CD5A7]');
  });
});

describe('VJe @2242278 / GJe @2242075', () => {
  it('默认阈值 4；`zf` 传 3 时溢出徽章为 `${n}+`', () => {
    expect(selectVisibleThumbnails(['a', 'b'])).toEqual({ visible: ['a', 'b'], overflow: 0, badgeText: null });
    expect(selectVisibleThumbnails(['a', 'b', 'c', 'd', 'e'], 3)).toEqual({
      visible: ['a', 'b', 'c'], overflow: 2, badgeText: '2+',
    });
    expect(selectVisibleThumbnails([], 3)).toEqual({ visible: [], overflow: 0, badgeText: null });
  });
});

describe('net @2253553 —— mention 解析', () => {
  it('无 `{{node/...}}` ⇒ 原样返回', () => {
    expect(resolveMentionTokens({ prompt: 'plain', getNodeKind: () => 'image' }))
      .toEqual({ prompt: 'plain', addedNodeIds: [], unresolvedNodeIds: [], numberingUnavailable: false });
  });

  it('任一已解析引用 `mediaKind === null` ⇒ 直接 `numberingUnavailable`（优先级更高）', () => {
    const result = resolveMentionTokens({
      prompt: 'see {{node/n1}}',
      resolvedReferences: [{ nodeId: 'n1', mediaKind: null }],
      getNodeKind: () => 'image',
    });
    expect(result.numberingUnavailable).toBe(true);
    expect(result.prompt).toBe('see {{node/n1}}');
  });

  it('已解析引用优先复用 ordinal；未知 id 走新增计数；占位串首字母大写', () => {
    const reused = resolveMentionTokens({
      prompt: 'a {{node/n1}} b {{node/n2}}',
      resolvedReferences: [{ nodeId: 'n2', mediaKind: 'video' }],
      getNodeKind: (id) => (id === 'n1' ? 'image' : 'video'),
    });
    expect(reused.prompt).toBe('a {{Image 1}} b {{Video 1}}');
    expect(reused.numberingUnavailable).toBe(false);
  });

  it('`getNodeKind` 返回 null ⇒ `unresolvedNodeIds` 非空且 prompt 原样', () => {
    const result = resolveMentionTokens({
      prompt: 'x {{node/gone}}',
      resolvedReferences: [],
      getNodeKind: () => null,
    });
    expect(result.unresolvedNodeIds).toEqual(['gone']);
    expect(result.prompt).toBe('x {{node/gone}}');
  });
});

describe('Ose @2264650 —— 价目串', () => {
  it('`t.length===0` 先于长度校验（逐字顺序）⇒ 无请求、或请求为空时都是 "0 Tapies"', () => {
    expect(formatPriceEstimate([], [])).toBe('0 Tapies');
    expect(formatPriceEstimate([1], [])).toBe('0 Tapies');
    expect(formatPriceEstimate([1, 2], [{ requestKind: 'image' }])).toBeNull();
    expect(formatPriceEstimate([1, null], [
      { requestKind: 'image' }, { requestKind: 'image' },
    ])).toBeNull();
  });

  it('`~N Tapies`；全为按秒计费视频时追加单位', () => {
    expect(formatPriceEstimate([1.5, 2.5], [
      { requestKind: 'image' }, { requestKind: 'image' },
    ])).toBe('~4 Tapies');
    expect(formatPriceEstimate([1], [{ requestKind: 'video' }], '/s', () => true)).toBe('~1 Tapies/s');
    expect(formatPriceEstimate([1, 2], [{ requestKind: 'video' }, { requestKind: 'image' }], '/s', () => true))
      .toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * `Ff` / `Of`
 * ------------------------------------------------------------------ */

describe('Ff @2159117 / Of @2159421', () => {
  it('store 优先级：`pendingConfirmation` > `resolvedConfirmations` > `content.status`', () => {
    const content = { status: 'completed', response: { action: 'confirm' } };
    expect(resolveConfirmationCardStatus(content, 'c1', null)).toBe('confirmed');
    expect(resolveConfirmationCardStatus({ ...content, response: { action: 'reject' } }, 'c1', null)).toBe('rejected');
    expect(resolveConfirmationCardStatus({ status: 'failed', error: { code: 'conversation_cancelled' } }, 'c1', null))
      .toBe('skipped');
    expect(resolveConfirmationCardStatus({ status: 'failed', error: { code: 'other' } }, 'c1', null)).toBe('rejected');
    expect(resolveConfirmationCardStatus(content, 'c1', { resolvedConfirmations: { c1: 'skipped' } })).toBe('skipped');
    expect(resolveConfirmationCardStatus(content, 'c1', {
      pendingConfirmation: { confirmationId: 'c1', status: 'pending' },
    })).toBe('pending');
  });

  it('`Of`：仍在途 ⇒ true（整卡返回 null）', () => {
    expect(isConfirmationInFlight({ status: 'started' }, 'c1', null)).toBe(true);
    expect(isConfirmationInFlight({ status: 'started' }, 'c1', {
      pendingConfirmation: { confirmationId: 'c1', status: 'pending' },
    })).toBe(false);
    expect(isConfirmationInFlight({ status: 'completed' }, 'c1', null)).toBe(false);
  });

  it('`Uoe`：answer action 逐级回退', () => {
    expect(answerActionOf({ action: 'confirm' })).toBe('confirm');
    expect(answerActionOf({ response: { answer: { action: 'reject' } } })).toBe('reject');
    expect(answerActionOf({})).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * 解析器
 * ------------------------------------------------------------------ */

describe('Qet / bJe / yJe —— 回退卡与两条解析器', () => {
  it('`Qet`：从 `request_kind` 或 `detail.request_json.request_kind` 取回退 viewModel', () => {
    expect(extractFallbackViewModel({ confirmation_id: 'x', request_kind: 'video' }))
      .toEqual({ confirmationId: 'x', requestKind: 'video' });
    expect(extractFallbackViewModel({
      confirmation_id: 'x', detail: { request_json: { request_kind: 'image' } },
    })).toEqual({ confirmationId: 'x', requestKind: 'image' });
    expect(extractFallbackViewModel({})).toBeNull();
  });

  it('`bJe` 命中 `detail.items[]`；`yJe` 只在 items 不成组时命中', () => {
    const v1 = {
      request: {
        confirmation_id: 'c1',
        request_kind: 'image',
        detail: {
          items: [
            { index: 0, tool_name: 'gen_image', request_kind: 'image', params: { prompt: 'a' } },
            { index: 1, tool_name: 'gen_image', request_kind: 'image', params: { prompt: 'b' } },
          ],
        },
      },
    };
    expect(hasConfirmationItems(v1)).toBe(true);
    const parsed = parseGenerationConfirmationV1(v1);
    expect(parsed?.confirmationId).toBe('c1');
    expect(parsed?.items?.map((item) => item.index)).toEqual([0, 1]);
    expect(parsed?.items?.[0].params.prompt).toBe('a');
    expect(parseGenerationConfirmationLegacy(v1)).toBeNull();
  });

  it('批量里同配置（忽略 prompt）才成立；模型不同 ⇒ 两条解析器都不命中', () => {
    const inconsistent = {
      request: {
        confirmation_id: 'c2',
        request_kind: 'image',
        detail: {
          items: [
            { index: 0, tool_name: 'gen_image', request_kind: 'image', params: { model_name: 'm1', prompt: 'a' } },
            { index: 1, tool_name: 'gen_image', request_kind: 'image', params: { model_name: 'm2', prompt: 'a' } },
          ],
        },
      },
    };
    expect(parseGenerationConfirmationV1(inconsistent)).toBeNull();
    const legacy = parseGenerationConfirmationLegacy({
      confirmation_id: 'c3',
      tool_name: 'gen_image',
      request_kind: 'image',
      params: { model_name: 'm1', prompt: 'legacy' },
    });
    expect(legacy?.params.prompt).toBe('legacy');
  });

  it('`YJe`/`QJe`：`tapnow.generation_request.v1` 内联载体的字段映射', () => {
    const preview = parseGenerationAutoPreview({
      tool: 'generation_request',
      status: 'completed',
      request: {
        kind: 'tapnow.generation_request.v1',
        request_kind: 'image',
        model: 'gpt-image-2',
        image: { aspect_ratio: '16:9', image_size: '0.5K', times: 2 },
      },
    });
    expect(preview?.toolName).toBe('gen_image');
    expect(preview?.aspectRatio).toBe('16:9');
    expect(preview?.imageSize).toBe('0.5K');
    expect(preview?.times).toBe(2);
    expect(preview?.isBatch).toBe(false);
    expect(parseGenerationAutoPreview({ tool: 'gen_audio', status: 'completed' })).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * 第 2 章 —— node_update 文本助手
 * ------------------------------------------------------------------ */

describe('node_update_confirmation 文本助手', () => {
  it('`lre` 只认 `N lines changed|added|removed|updated`', () => {
    expect(isDiffSummaryLine('3 lines changed')).toBe(true);
    expect(isDiffSummaryLine('1 line added')).toBe(true);
    expect(isDiffSummaryLine('3 lines rewritten')).toBe(false);
  });

  it('`sre` 归一化：`field` 兜底 "node"、`mode` 兜底 "update"', () => {
    expect(normalizeNodeUpdateChanges([{ after_summary: 'x' }])).toEqual([
      { field: 'node', mode: 'update', before_summary: undefined, after_summary: 'x' },
    ]);
    expect(normalizeNodeUpdateChanges(null)).toEqual([]);
  });

  it('`ire` 去 `node/` 前缀并去重', () => {
    expect(collectNodeUpdateRefs({ node_ref: 'node/n1', request_json: { node_refs: ['n1', 'node/n2', ''] } }))
      .toEqual(['n1', 'n2']);
  });

  it('`Ftt` summary：`replace_data` → 固定英文；否则 `Update node fields: …`', () => {
    expect(buildNodeUpdateSummary({ replace_data: {} }, [])).toBe('Replace the full node data object');
    expect(buildNodeUpdateSummary({}, normalizeNodeUpdateChanges([{ field: 'prompt', mode: 'update' }])))
      .toBe('Update node fields: update prompt');
    expect(buildNodeUpdateSummary({ summary: 'S' }, [])).toBe('S');
    expect(buildNodeUpdateSummary({}, [])).toBe('Update the node');
  });

  it('`dre` body：显式文本优先 → `after_summary` 用 `\\n\\n` 连接 → 兜底 summary', () => {
    expect(buildNodeUpdateBody({ request_json: { patch: { text: 'T' } } }, [], 'F')).toBe('T');
    expect(buildNodeUpdateBody(
      {},
      normalizeNodeUpdateChanges([
        { field: 'prompt', mode: 'update', after_summary: 'A' },
        { field: 'content', mode: 'update', after_summary: 'B' },
        { field: 'other', mode: 'update', after_summary: 'C' },
      ]),
      'F',
    )).toBe('A\n\nB');
    expect(buildNodeUpdateBody({ summary: 'S' }, [], 'F')).toBe('S');
  });

  it('`cre`/`Mtt`/`Ptt`：patch → params 的回退与 payload 形状', () => {
    expect(explicitNodeUpdateText({ request_json: { patch: { title: 'X' } } })).toBe('X');
    expect(explicitNodeUpdateText({ request_json: { patch: { text: '2 lines changed' } } })).toBeUndefined();
    expect(resolveNodeUpdateEditTarget({ request_json: { patch: { prompt: 'p' } } }, []))
      .toEqual({ kind: 'patch', field: 'prompt' });
    expect(resolveNodeUpdateEditTarget({ request_json: { patch: { params: { text: 't' } } } }, []))
      .toEqual({ kind: 'params', field: 'text' });
    expect(resolveNodeUpdateEditTarget({}, normalizeNodeUpdateChanges([{ field: 'content', mode: 'update' }])))
      .toEqual({ kind: 'patch', field: 'text' });
    expect(resolveNodeUpdateEditTarget({}, [])).toBeNull();
    expect(buildNodeUpdateAnswerPayload({ kind: 'params', field: 'text' }, 'V')).toEqual({ params: { text: 'V' } });
    expect(buildNodeUpdateAnswerPayload({ kind: 'patch', field: 'prompt' }, 'V')).toEqual({ prompt: 'V' });
  });

  it('`Rtt` 数字守卫', () => {
    expect(numberGuard(3)).toBe(3);
    expect(numberGuard(Number.NaN)).toBeUndefined();
    expect(numberGuard('3')).toBeUndefined();
  });

  it('`Ott`：viewModel 的 items（index 兜底数组下标）', () => {
    const viewModel = extractNodeUpdateViewModel({
      request: {
        confirmation_id: 'n1',
        confirmation_kind: 'node_update',
        detail: {
          items: [
            { request_json: { changes: [{ field: 'prompt', mode: 'update' }], node_refs: ['node/a'] } },
            { index: 7, request_json: { patch: { text: 'hello' } } },
          ],
        },
      },
    });
    expect(viewModel?.confirmationId).toBe('n1');
    expect(viewModel?.items.map((item) => item.index)).toEqual([0, 7]);
    expect(viewModel?.items[1].bodyIsPrompt).toBe(true);
    expect(viewModel?.items[0].nodeRefs).toEqual(['a']);
    // 非 node_update 载体 ⇒ null
    expect(extractNodeUpdateViewModel({ request: { confirmation_id: 'x', confirmation_kind: 'other' } })).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * `GB` @2227380 —— 归一化输出必须是 camelCase（主 agent 第二次仲裁）
 * ------------------------------------------------------------------ */

describe('GB @2227380 —— 归一化输出属性名一律 camelCase（snake_case 只在等号右边）', () => {
  function legacyWithRawParams(params: Record<string, unknown>) {
    return parseGenerationConfirmationLegacy({
      status: 'started',
      confirmation_id: 'c1',
      tool_name: 'gen_image',
      request_kind: 'image',
      params,
    });
  }

  it('原始 snake_case 键 → 归一化 camelCase 键；snake 键**不再存在**', () => {
    const viewModel = legacyWithRawParams({
      prompt: 'p',
      model_name: 'm1',
      reference_node_ids: ['n1'],
      reference_image_sources: ['node/n1'],
    });
    const params = viewModel!.params as Record<string, unknown>;
    // camelCase（官方 `o.referenceNodeIds = sl(e,"reference_node_ids")` 等）
    expect(params.referenceNodeIds).toEqual(['n1']);
    expect(params.referenceImageSources).toEqual(['node/n1']);
    expect('normalizedReferences' in params).toBe(true);
    // snake 键不得残留（`GB` 的输出对象里没有它们）
    expect('reference_node_ids' in params).toBe(false);
    expect('reference_image_sources' in params).toBe(false);
    expect('normalized_references' in params).toBe(false);
    expect('element_refs' in params).toBe(false);
    // 官方 `o.normalizedReferences = tJe(e,"normalized_references") ?? nJe(e)`
    expect(params.normalizedReferences).toEqual([
      { source: 'node/n1', nodeId: 'n1', declaredMediaKind: 'image' },
    ]);
  });

  it('`normalizedReferences` 走 `?? nJe(e)` 兜底 ⇒ 源缺失时**仍被无条件赋值**（为 `[]`）', () => {
    const viewModel = legacyWithRawParams({ prompt: 'p', model_name: 'm1' });
    const params = viewModel!.params as Record<string, unknown>;
    expect('normalizedReferences' in params).toBe(true);
    expect(params.normalizedReferences).toEqual([]);
    expect('referenceNodeIds' in params).toBe(false);
    expect('referenceImageSources' in params).toBe(false);
  });

  it('`estimateParams` 有 `m &&` 守卫：源缺失时不产出；源存在时经 `IZe` 归一', () => {
    const without = legacyWithRawParams({ prompt: 'p' });
    expect('estimateParams' in (without!.params as Record<string, unknown>)).toBe(false);
    const withSource = legacyWithRawParams({
      prompt: 'p',
      estimate_params: { aspect_ratio: '16:9', image_size: '1K', generate_audio: true, prompt: 'p' },
    });
    const estimate = (withSource!.params as Record<string, unknown>).estimateParams as Record<string, unknown>;
    expect(estimate).toEqual({ prompt: 'p', aspectRatio: '16:9', imageSize: '1K', generateAudio: true });
    expect('aspect_ratio' in estimate).toBe(false);
    expect('image_size' in estimate).toBe(false);
    expect('generate_audio' in estimate).toBe(false);
  });

  it('`elementRefs` → camelCase（官方 `o.elementRefs = bse(e,"element_refs")`）', () => {
    /* ⚠️ 必须走官方 `presentation.v1` 路径（`oJe` 用 `{...record.params}` 透传全部原始键）：
       legacy 路径的 `pJe`→`VB` 白名单只搬 `xse` + 4 个 `reference_*` + `estimate_params`，
       `element_refs` / `references` **不在白名单内**（官方逐字事实，不能替它「补齐」）。 */
    const viewModel = parseGenerationConfirmationLegacy({
      kind: 'tapnow.generation_confirmation.presentation.v1',
      status: 'started',
      confirmation_id: 'c1',
      request_kind: 'image',
      params: {
        prompt: 'p',
        element_refs: [{ ref: 'element/e1', alias: 'A' }, { ref: 'node/n1' }],
      },
      request_json: { request_kind: 'image' },
    });
    const params = viewModel!.params as Record<string, unknown>;
    expect(params.elementRefs).toEqual([{ elementId: 'e1', alias: 'A' }]);
    expect('element_refs' in params).toBe(false);
  });

  it('`pJe`→`VB` 白名单不含 `element_refs`/`references`（legacy 路径下不产出 camel 键）', () => {
    const viewModel = legacyWithRawParams({
      prompt: 'p',
      element_refs: [{ ref: 'element/e1' }],
      references: [{ ref: 'node/n1' }],
    });
    const params = viewModel!.params as Record<string, unknown>;
    expect('elementRefs' in params).toBe(false);
    expect('element_refs' in params).toBe(false);
  });

  it('`originalParams` 与 `params` 同口径（camelCase）——官方两处都过 `GB`', () => {
    const viewModel = legacyWithRawParams({
      prompt: 'raw-prompt',
      model_name: 'm1',
      reference_node_ids: ['n1'],
    });
    const original = viewModel!.originalParams as Record<string, unknown>;
    expect(original.referenceNodeIds).toEqual(['n1']);
    expect('reference_node_ids' in original).toBe(false);
    // 官方 `pJe`：`originalParams` 与 `params` 同源（`{...n}`）⇒ 归一化后也应一致
    expect(original.prompt).toBe('raw-prompt');
  });

  it('`protocolContext` 读的是**原始** params（snake_case 一侧）', () => {
    const viewModel = parseGenerationConfirmationLegacy({
      kind: 'tapnow.generation_confirmation.presentation.v1',
      status: 'started',
      confirmation_id: 'c1',
      request_kind: 'image',
      params: { prompt: 'p', model_name: 'm1', references: [{ ref: 'node/n1' }] },
      request_json: { request_kind: 'image' },
    });
    expect(viewModel!.protocolContext.originalModelName).toBe('m1');
    expect(viewModel!.protocolContext.originalReferences).toEqual([{ ref: 'node/n1' }]);
  });
});

/* ------------------------------------------------------------------ *
 * i18n 表
 * ------------------------------------------------------------------ */

describe('官方文案表', () => {
  it('`{{name}}` 双花括号插值（不改写成 MTV 的单花括号口径）', () => {
    expect(fillOfficialTemplate('生成 {{count}} 张图片', { count: 3 })).toBe('生成 3 张图片');
    expect(fillOfficialTemplate('{{a}}-{{b}}', { a: 1 })).toBe('1-{{b}}');
  });

  it('zh 文案逐字（抽样）', () => {
    expect(officialConfirmationText('chatAdapter.generationConfirmation.batchTasks', { count: 2 })).toBe('2 个任务');
    expect(officialConfirmationText('chatAdapter.generationConfirmation.rejectAll')).toBe('全部拒绝');
    expect(officialConfirmationText('chatAdapter.nodeUpdateConfirmation.nodeUpdated')).toBe('计划更新的节点：');
    expect(officialConfirmationText('audio.audioGeneration')).toBe('音频生成');
  });

  it('5 个 locale 组内不存在的 key：**zh 与 en 相同**（中文环境回落英文）', () => {
    for (const message of Object.values(GENERATION_CONFIRMATION_FALLBACK_TEXT)) {
      expect(message.length).toBeGreaterThan(0);
    }
    expect(officialConfirmationText('chatAdapter.generationConfirmation.inconsistentBatchShort'))
      .toBe('Inconsistent batch configuration');
    expect(officialConfirmationText('chatAdapter.generationConfirmation.unsupportedKindShort'))
      .toBe('Unsupported confirmation type');
    expect(officialConfirmationText('chatAdapter.generationConfirmation.inconsistentBatchMode'))
      .toContain('These references require different generation modes');
    expect(officialConfirmationText('chatAdapter.generationConfirmation.unsupportedKind', { kind: 'audio' }))
      .toContain('audio generation confirmation');
  });

  it('10 个死 key（§9.2）**不在**代码引用表内', () => {
    const keys = officialConfirmationTextKeys();
    for (const dead of ['count', 'size', 'ratio', 'resolution', 'duration', 'model', 'mixedParams', 'done', 'switchMode', 'batch']) {
      expect(keys).not.toContain(`chatAdapter.generationConfirmation.${dead}`);
    }
  });
});
