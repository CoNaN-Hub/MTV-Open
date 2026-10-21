// @vitest-environment jsdom
/**
 * `generation_confirmation` 卡族 6 个变体 + `node_update_confirmation` 分发器的**真实 DOM** 回归
 * （jsdom + @testing-library/react；验证分级 = **(b)**）。
 *
 * 官方出处：`D:\DEEPSEEK\live-assets-new\vendor-pkg-canvas-CvbAwZyy.js`
 *  · `uot` @2326934（分发器）/ `xot` @2353836 / `got` @2351507 / `fot` @2346917 / `mot` @2344425 /
 *    `hot` @2350243 / `vnt` @2289814（自动预览）/ `Wet` @2285965 邻域
 *  · `Btt` @2358212 / `ztt` @2350962 / `Utt` @2353965
 *  · `v0` @2193932 / `V0` @2305841 / `Rx` @2244666 / `WJe` @2245470 / `pZe` @2193324 / `ore` @2346210
 *  · chip 原语 `Hs` @2266984（**不是 `Rs`**；`Rs` 是本 bundle 里的 PopoverContent）
 *
 * ⚠️ 第 85 轮：原先这里的偏移表来自另一个 bundle（`ChpWx5JY`），已作废并按实测重标。
 *
 * 每个官方变体至少一条断言（逐字 class / data-testid / 文案）。
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationConfirmationCard, GenerationAutoPreviewCard } from '../../src/components/chat/GenerationConfirmationCard';
import { NodeUpdateConfirmationCard } from '../../src/components/chat/NodeUpdateConfirmationCard';
import { NodeThumbRow } from '../../src/components/chat/ConfirmationCardParts';
import {
  confirmationStoreSliceOf,
  isAutoPreviewCardEvent,
  isConfirmationCardToolEvent,
} from '../../src/components/chat/confirmationEventDispatch';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { ConfirmationStoreSlice } from '../../src/services/chat/generationConfirmation';

afterEach(cleanup);

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

/* ------------------------------------------------------------------ *
 * 测试夹具（按官方协议逐字构造，保证走到目标分支）
 * ------------------------------------------------------------------ */

/** v1 批量卡（`detail.items[]` 非空 ⇒ `bJe` 命中）。 */
function v1BatchContent(kind: 'image' | 'video', count: number, confirmationId = 'c1') {
  return {
    status: 'started',
    tool: 'generation_confirmation',
    request: {
      confirmation_id: confirmationId,
      request_kind: kind,
      detail: {
        items: Array.from({ length: count }, (_, index) => ({
          index,
          tool_name: kind === 'image' ? 'gen_image' : kind === 'video' ? 'gen_video' : 'gen_audio',
          request_kind: kind,
          params: { model_name: 'm1', prompt: `prompt-${index}` },
        })),
      },
    },
  } as unknown as Record<string, unknown>;
}

/** v1 音频批量卡（`request_kind: "audio"`）。 */
function v1AudioBatchContent(count: number) {
  return {
    status: 'started',
    tool: 'generation_confirmation',
    request: {
      confirmation_id: 'a1',
      request_kind: 'audio',
      detail: {
        items: Array.from({ length: count }, (_, index) => ({
          index,
          tool_name: 'gen_audio',
          request_kind: 'audio',
          params: { model_name: 'm1', prompt: `audio-${index}` },
        })),
      },
    },
  } as unknown as Record<string, unknown>;
}

/** legacy 单条卡（无 `detail.items` ⇒ `yJe` 命中）。 */
function legacyContent(kind: 'image' | 'video' | 'audio', confirmationId = 'c1') {
  return {
    status: 'started',
    tool: 'generation_confirmation',
    confirmation_id: confirmationId,
    request_kind: kind,
    tool_name: kind === 'audio' ? 'gen_audio' : kind === 'video' ? 'gen_video' : 'gen_image',
    params: { model_name: 'm1', prompt: 'legacy prompt' },
  } as unknown as Record<string, unknown>;
}

/** 交互态 store 切片（官方 `hs.pendingConfirmation`）。 */
function pendingStore(confirmationId: string, kind?: string): ConfirmationStoreSlice {
  return { pendingConfirmation: { confirmationId, status: 'pending', kind } };
}

/** v1 批量卡 + 逐条引用（原始 `reference_node_ids` 是 snake_case 一侧）。 */
function v1BatchWithRefs(referenceLists: string[][]) {
  return {
    status: 'started',
    tool: 'generation_confirmation',
    request: {
      confirmation_id: 'c1',
      request_kind: 'image',
      detail: {
        items: referenceLists.map((refs, index) => ({
          index,
          tool_name: 'gen_image',
          request_kind: 'image',
          params: { model_name: 'm1', prompt: `prompt-${index}`, reference_node_ids: refs },
        })),
      },
    },
  } as unknown as Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * 变体 ① `ett` —— v1 图像/视频批量卡
 * ------------------------------------------------------------------ */

describe('ett（v1 图像/视频批量卡，@2314736）', () => {
  it('渲染官方卡壳逐字 class + batchTasks chip + 逐条移除按钮', () => {
    const content = v1BatchContent('image', 2);
    const { container } = render(
      <GenerationConfirmationCard content={content} store={pendingStore('c1')} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe(
      'my-2 flex w-full flex-col gap-2 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
    );
    expect(root.style.containerType).toBe('inline-size');
    // 卡头 = 官方 `v0`：图标 12（`text-white/60`） + 标题 span（同 class）
    const headerTitle = container.querySelector('span.text-white\\/60') as HTMLElement;
    expect(headerTitle.textContent).toBe('图片生成');
    // `batchTasks` chip（官方 `Rs variant="static"`）
    expect(screen.getByText('2 个任务')).toBeTruthy();
    // `Rx` 批量列表容器底色 `bg-[#2F2F2F]`、`max-h-[320px]`
    expect(container.querySelector('.bg-\\[\\#2F2F2F\\]')!.className)
      .toBe('rounded-2xl bg-[#2F2F2F] p-1');
    expect(container.querySelector('.max-h-\\[320px\\]')).toBeTruthy();
    // 条目序号 `1.` / `2.`
    expect(screen.getByText('1.')).toBeTruthy();
    expect(screen.getByText('2.')).toBeTruthy();
    // `rejectItem` 文案（zh「移除」）逐条渲染
    expect(screen.getAllByText('移除')).toHaveLength(2);
    // `_0` 卡脚：取消 + 确认
    expect(screen.getByText('取消')).toBeTruthy();
    expect(screen.getByText('确认')).toBeTruthy();
  });

  it('全部条目被移除后主按钮文案变 `rejectAll`（「全部拒绝」，不是独立按钮）', () => {
    const content = v1BatchContent('image', 1);
    render(<GenerationConfirmationCard content={content} store={pendingStore('c1')} />);
    expect(screen.getByText('确认')).toBeTruthy();
    fireEvent.click(screen.getByText('移除'));
    expect(screen.getByText('全部拒绝')).toBeTruthy();
    // 「取消」按钮随 `showRejectButton={B>0}` 消失
    expect(screen.queryByText('取消')).toBeNull();
  });

  it('引用一致性走**归一化后的 camelCase**：全批一致 ⇒ 共享缩略图行；不一致 ⇒ 逐条缩略图', () => {
    /* 官方 `ett`：`const K = d.map(Y => Y.params.referenceNodeIds ?? [])` —— 读的是 camelCase。
       若实现仍读 snake_case，这里两条断言都会失败（缩略图行不会渲染）。 */
    const shared = v1BatchWithRefs([['n1'], ['n1']]);
    const first = render(<GenerationConfirmationCard content={shared} store={pendingStore('c1')} />);
    // 共享 ⇒ 卡脚一块 `zf`（`inline-flex items-center gap-1 rounded-lg bg-white/10 px-1.5 py-1`）
    expect(first.container.querySelector('.bg-white\\/10.px-1\\.5.py-1')).toBeTruthy();
    expect(first.container.querySelector('button[aria-label="node_n1"]')).toBeTruthy();
    // 共享 ⇒ `showPerItemReferences=false` ⇒ 条目不渲染 `noReference`
    expect(screen.queryByText('无参考')).toBeNull();
    cleanup();

    const perItem = v1BatchWithRefs([['n1'], ['n2']]);
    const second = render(<GenerationConfirmationCard content={perItem} store={pendingStore('c1')} />);
    // 不一致 ⇒ `sharedReferences = []` ⇒ 卡脚不渲染共享行；缩略图落进各自条目
    expect(second.container.querySelector('button[aria-label="node_n1"]')).toBeTruthy();
    expect(second.container.querySelector('button[aria-label="node_n2"]')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ *
 * 变体 ② `Jet` —— legacy 图像/视频单条卡
 * ------------------------------------------------------------------ */

describe('Jet（legacy 图像/视频单条卡，@2312411）', () => {
  it('单条：省略 `overflow-hidden` 之外的差别 —— 无 `batchTasks` chip、clamp-5、`noPrompt` 作为 placeholder', () => {
    const content = legacyContent('video');
    const { container } = render(
      <GenerationConfirmationCard content={content} store={pendingStore('c1')} />,
    );
    const root = container.firstElementChild as HTMLElement;
    // 逐字：`relative my-2 …` + 两条状态串（教学态关闭 ⇒ `overflow-hidden`）
    expect(root.className).toBe(
      'relative my-2 flex w-full flex-col gap-2 rounded-2xl bg-[#1F1F1F] p-3 transition-opacity overflow-hidden',
    );
    // 卡头标题走 `chatAdapter.generationConfirmation.videoGeneration`（zh「视频生成」）
    expect(screen.getByText('视频生成')).toBeTruthy();
    // legacy 单条卡**没有** `batchTasks` chip
    expect(screen.queryByText('1 个任务')).toBeNull();
    // `WJe` 单条折叠行数 = `line-clamp-5`
    expect(container.querySelector('.line-clamp-5')).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ *
 * 变体 ③ `Xet` —— v1 音频批量卡
 * ------------------------------------------------------------------ */

describe('Xet（v1 音频批量卡，@2307946）', () => {
  it('音频卡**没有** `batchTasks` chip；标题走 `audio.audioGeneration`', () => {
    const content = v1AudioBatchContent(2);
    const { container } = render(
      <GenerationConfirmationCard content={content} store={pendingStore('a1')} />,
    );
    expect(screen.getByText('音频生成')).toBeTruthy();
    expect(screen.queryByText('2 个任务')).toBeNull();
    // `Xet` 的 chip 行容器是 `flex min-w-0 flex-wrap items-center gap-1.5`（**没有** `items-center gap-1.5` 外壳）
    expect(container.querySelector('.flex.min-w-0.flex-wrap.items-center.gap-1\\.5')).toBeTruthy();
    // `showItemReferences={true}` ⇒ 无参考时渲染 `noReference`（zh「无参考」）
    expect(screen.getAllByText('无参考')).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ *
 * 变体 ④ `Yet` —— legacy 音频单条卡
 * ------------------------------------------------------------------ */

describe('Yet（legacy 音频单条卡，@2305474）', () => {
  it('单条音频：`Rx mode="single"`、无 `showItemReferences`（不渲染 `noReference`）', () => {
    const content = legacyContent('audio');
    const { container } = render(
      <GenerationConfirmationCard content={content} store={pendingStore('c1')} />,
    );
    expect(screen.getByText('音频生成')).toBeTruthy();
    expect(container.querySelector('.line-clamp-5')).toBeTruthy();
    // `Yet` 不传 `showItemReferences` ⇒ 默认 `false` ⇒ 无 `noReference`
    expect(screen.queryByText('无参考')).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * 变体 ⑤ `Zet` —— 回退卡
 * ------------------------------------------------------------------ */

describe('Zet（回退卡，@2311252）', () => {
  it('非 image/video/audio 的 requestKind ⇒ `unsupportedKind` 英文兜底文案 + 卡壳 `gap-3`', () => {
    const content = {
      status: 'started',
      tool: 'generation_confirmation',
      request_kind: 'unknown_kind',
      confirmation_id: 'z1',
    } as unknown as Record<string, unknown>;
    const { container } = render(<GenerationConfirmationCard content={content} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('my-2 flex w-full flex-col gap-3 rounded-2xl bg-[#1F1F1F] p-3');
    // 5 个无中文翻译的 key 之一：只回落英文 defaultValue
    expect(screen.getByText(/This version cannot display the unknown_kind generation confirmation/)).toBeTruthy();
    // `_0`：`showAutoModeSwitch={false}` ⇒ 不渲染 Act 开关行
    expect(screen.queryByText('Act')).toBeNull();
  });

  it('`detail.items` 非空且 requestKind 已知 ⇒ 「批量配置不一致」文案', () => {
    const content = {
      status: 'started',
      request_kind: 'image',
      confirmation_id: 'z2',
      detail: { items: [{}] },
    } as unknown as Record<string, unknown>;
    render(<GenerationConfirmationCard content={content} />);
    expect(screen.getByText(/This batch does not share one model and generation configuration/)).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ *
 * 变体 ⑥ `eet` —— 自动模式预览卡
 * ------------------------------------------------------------------ */

describe('eet（自动模式预览卡，@2250895）', () => {
  it('批量图像：`generateImages` 文案 + 无 `_0` 卡脚 + `512P` 改写', () => {
    /* 官方渲染器 @2428328：`eet` 只在 `status === "completed" | "failed"` 时渲染。 */
    const content = {
      tool: 'generation_request',
      status: 'completed',
      request: {
        kind: 'tapnow.generation_request.v1',
        request_kind: 'image',
        model: 'gpt-image-2',
        prompt: undefined,
        image: { aspect_ratio: '16:9', image_size: '0.5K', times: 2 },
      },
    } as unknown as Record<string, unknown>;
    const { container } = render(<GenerationAutoPreviewCard content={content} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe(
      'my-2 flex w-full flex-col gap-3 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
    );
    // `v0` 的 status 走 `"auto"`（`pZe.auto` = `text-[#90C4E5]`）
    expect(container.querySelector('.text-\\[\\#90C4E5\\]')).toBeTruthy();
    // `d === "0.5K" ? "512P" : d`（逐字改写）
    expect(screen.getByText('512P')).toBeTruthy();
    expect(screen.queryByText('0.5K')).toBeNull();
    // 倍率 `${p}×`
    expect(screen.getByText('2×')).toBeTruthy();
    // 该卡**无 `_0` 卡脚**
    expect(screen.queryByText('确认')).toBeNull();
    // 经分发组件（`isAutoPreviewCardEvent`）也能拿到同一张卡
    expect(isAutoPreviewCardEvent(content)).toBe(true);
    expect(isAutoPreviewCardEvent({ ...content, status: 'started' })).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * `node_update_confirmation` 分发器 `Btt`
 * ------------------------------------------------------------------ */

describe('Btt（node_update_confirmation 分发器，@2358212）', () => {
  it('无 `detail.items` ⇒ 单卡 `ztt`：`data-testid="node-update-confirmation-card"`', () => {
    const content = {
      status: 'started',
      tool: 'node_update_confirmation',
      request: {
        confirmation_id: 'n1',
        confirmation_kind: 'node_update',
        summary: '更新文本',
      },
    } as unknown as Record<string, unknown>;
    render(
      <NodeUpdateConfirmationCard content={content} store={pendingStore('n1', 'node_update')} />,
    );
    expect(screen.getByTestId('node-update-confirmation-card')).toBeTruthy();
    expect(screen.getByText('确认节点更新')).toBeTruthy();
    // 两个按钮的逐字静态 class（含 disabled: 变体）
    const update = screen.getByText('更新');
    expect(update.className).toBe(
      'inline-flex items-center rounded-lg bg-[#F5F5F5] px-3 py-2 text-xs font-normal leading-3 text-[#0F0F0F] transition-opacity hover:opacity-85 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-100',
    );
    const cancel = screen.getByText('取消');
    expect(cancel.className).toBe(
      'inline-flex items-center rounded-lg bg-white/[0.09] px-3 py-2 text-xs font-normal leading-3 text-[#F5F5F5] transition-colors hover:bg-white/[0.14] focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/[0.09]',
    );
  });

  it('有 `detail.items` ⇒ 批量卡：`data-testid` + `batchTasks` + 逐条 reject testid', () => {
    const content = {
      status: 'started',
      tool: 'node_update_confirmation',
      request: {
        confirmation_id: 'n2',
        confirmation_kind: 'node_update',
        detail: {
          items: [
            { index: 0, request_json: { changes: [{ field: 'prompt', mode: 'update', after_summary: 'AAA' }] } },
            { index: 1, request_json: { changes: [{ field: 'prompt', mode: 'update', after_summary: 'BBB' }] } },
          ],
        },
      },
    } as unknown as Record<string, unknown>;
    render(
      <NodeUpdateConfirmationCard content={content} store={pendingStore('n2', 'node_update')} />,
    );
    expect(screen.getByTestId('node-update-confirmation-batch-card')).toBeTruthy();
    expect(screen.getByTestId('node-update-batch-item-0')).toBeTruthy();
    expect(screen.getByTestId('node-update-batch-item-1')).toBeTruthy();
    expect(screen.getByTestId('node-update-batch-reject-0')).toBeTruthy();
    // `generationConfirmation.batchTasks`（zh「2 个任务」）
    expect(screen.getByText('2 个任务')).toBeTruthy();
    // `Ftt` 的硬编码英文 summary（不可翻译）
    expect(screen.getAllByText('Update node fields: update prompt').length).toBeGreaterThan(0);
  });

  it('单卡编辑过 prompt 时回传 `Mtt`/`Ptt` 形状的 payload', () => {
    const onAnswer = vi.fn();
    const content = {
      status: 'started',
      tool: 'node_update_confirmation',
      request: {
        confirmation_id: 'n3',
        confirmation_kind: 'node_update',
        request_json: { patch: { prompt: 'old' } },
      },
    } as unknown as Record<string, unknown>;
    render(
      <NodeUpdateConfirmationCard
        content={content}
        store={pendingStore('n3', 'node_update')}
        onAnswer={onAnswer}
      />,
    );
    fireEvent.click(screen.getByText('更新'));
    // 未编辑 ⇒ 官方裸 `confirm`
    expect(onAnswer).toHaveBeenCalledWith('n3', 'confirm');
  });
});

/* ------------------------------------------------------------------ *
 * 分发谓词（`dg` / `iT`；`xl` @443724 大小写敏感 —— 主 agent 仲裁）
 * ------------------------------------------------------------------ */

describe('confirmationEventDispatch：`dg` / `iT` 的大小写敏感语义', () => {
  it('恰好命中官方工具名', () => {
    expect(isConfirmationCardToolEvent('generation_confirmation')).toBe(true);
    expect(isConfirmationCardToolEvent('node_update_confirmation')).toBe(true);
  });

  it('大小写变体 / 前后空白在官方 `xl` 语义下**不命中**', () => {
    expect(isConfirmationCardToolEvent('Generation_Confirmation')).toBe(false);
    expect(isConfirmationCardToolEvent('GENERATION_CONFIRMATION')).toBe(false);
    expect(isConfirmationCardToolEvent(' generation_confirmation')).toBe(false);
    expect(isConfirmationCardToolEvent('generation_confirmation ')).toBe(false);
    expect(isConfirmationCardToolEvent('Node_Update_Confirmation')).toBe(false);
    // `desktop_*` 属第 3 章，不在本族
    expect(isConfirmationCardToolEvent('desktop_fs_confirmation')).toBe(false);
  });

  it('`started` 且无 answer action ⇒ 推导出 `pendingConfirmation`（可交互）', () => {
    const content = legacyContent('image', 'c9');
    const store = confirmationStoreSliceOf(content, false);
    expect(store?.pendingConfirmation?.confirmationId).toBe('c9');
    expect(store?.pendingConfirmation?.status).toBe('pending');
  });

  it('`completed` ⇒ 不再产出 `pendingConfirmation`（走终态判定）', () => {
    const content = { ...legacyContent('image', 'c9'), status: 'completed' };
    const store = confirmationStoreSliceOf(content, false);
    expect(store?.pendingConfirmation).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ *
 * 第 85 轮 A2 —— **卡脚渲染门**：`visual === 'pending' && interactive`
 *
 * 官方逐字（`CvbAwZyy`）：
 *   · `got`@2351507：`h = A==="pending" && store.pendingConfirmation?.confirmationId===confirmationId
 *     && store.pendingConfirmation?.status==="pending"`，卡脚 `A==="pending" && s.jsx(V0,{…})` @2353747
 *   · `xot`@2353836 卡脚 @2359142 / `mot`@2344425 @2346828 / `fot`@2346917 @2349795 —— 同口径
 *   · `hot`@2350243：`d = e.status==="started" && store.pendingConfirmation?.confirmationId===r.confirmationId
 *     && Ad(e,r.confirmationId,o)==="pending"`，卡脚 `d && s.jsx(V0,{…})` @2351194
 *   ⇒ 非 pending（或未命中 `pendingConfirmation`）时官方**压根不渲染卡脚**，而不是渲染成禁用态。
 * ------------------------------------------------------------------ */

describe('第 85 轮 A2：非 pending / 不可交互 ⇒ 卡脚整体不渲染', () => {
  /* round 111 修正：第 85 轮这条用例把「真机卡 `content.status === 'pending'`（不是 `'started'`）⇒
     `confirmationStoreSliceOf` 不合成 `pendingConfirmation` ⇒ `interactive === false` ⇒ 卡脚不渲染」
     当成**期望行为**钉住了。但正是这个行为造成了用户第二次实测的
     「指令下了 也没有确认啥的 没后续了」——**整张卡上没有「确认」可点**。
     真实原因是写侧（`agentApprovalContents.approvalStatusToOfficialStatus`）刻意用 `"pending"`
     表示未决，而这里原先只认 `"started"` ⇒ 两条 MTV 自己的实现互相不认。
     已修：`confirmationStoreSliceOf` 同时认 `"started" | "pending"`（见该函数注释里的官方依据）。
     因此 `content.status="pending"` 且用**真实分发切片**推导时，卡脚必须**在 DOM 里且可用**。 */
  it('`content.status="pending"` + 真实分发切片 ⇒ 卡脚渲染且 `取消`/`确认` 均未禁用（round 111 修正）', () => {
    const content = { ...legacyContent('image', 'c1'), status: 'pending' };
    /* 用真实分发切片（而不是手写空切片），保证测的是真机那条路径。 */
    const store = confirmationStoreSliceOf(content, false);
    render(<GenerationConfirmationCard content={content} store={store} />);
    const cancel = screen.getByText('取消').closest('button') as HTMLButtonElement;
    const confirm = screen.getByText('确认').closest('button') as HTMLButtonElement;
    expect(cancel.tagName).toBe('BUTTON');
    expect(confirm.tagName).toBe('BUTTON');
    expect(cancel.disabled).toBe(false);
    expect(confirm.disabled).toBe(false);
  });

  it('`status="completed"`（终态）⇒ 卡脚不渲染', () => {
    const content = { ...legacyContent('image', 'c1'), status: 'completed' };
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    expect(screen.queryByText('取消')).toBeNull();
    expect(screen.queryByText('确认')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  it('store 给了别的 `confirmationId`（不命中）⇒ 卡脚不渲染', () => {
    const content = legacyContent('image', 'c1');
    render(<GenerationConfirmationCard content={content} store={pendingStore('other-id')} />);
    expect(screen.queryByText('取消')).toBeNull();
    expect(screen.queryByText('确认')).toBeNull();
  });

  /* 反向：pending 且 interactive ⇒ 卡脚照旧渲染且两键可用（证明收紧没有「收过头」）。 */
  it('`started` + `pendingConfirmation` 命中 ⇒ 卡脚渲染且 `取消`/`确认` 均未禁用', () => {
    const content = legacyContent('image', 'c1');
    render(<GenerationConfirmationCard content={content} store={pendingStore('c1')} />);
    /* 确认键的文案在 `V0` 的内层 `<span className="relative z-[1]">` 里 ⇒ 用 `closest('button')` 取按钮本体。 */
    const cancel = screen.getByText('取消').closest('button') as HTMLButtonElement;
    const confirm = screen.getByText('确认').closest('button') as HTMLButtonElement;
    expect(cancel.tagName).toBe('BUTTON');
    expect(confirm.tagName).toBe('BUTTON');
    expect(cancel.disabled).toBe(false);
    expect(confirm.disabled).toBe(false);
  });

  it('回退卡（官方 `hot`）：`started` 但 store 未命中 `pendingConfirmation` ⇒ 卡脚不渲染', () => {
    /* 回退卡内容：`confirmation_id` + `request_kind` 齐备 ⇒ `extractFallbackViewModel` 出 viewModel、卡本体渲染；
       但 store 没有 `pendingConfirmation` ⇒ 官方 `hot` 的 `d` 为假 ⇒ 卡脚不渲染。 */
    const content = {
      status: 'started',
      tool: 'generation_confirmation',
      request: { confirmation_id: 'f1', request_kind: 'unsupported-kind' },
    } as unknown as Record<string, unknown>;
    const { container } = render(<GenerationConfirmationCard content={content} store={{}} />);
    expect(container.firstElementChild).not.toBeNull();
    expect(screen.queryByText('取消')).toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });

  /* chip 静态态 class 必须与官方**逐字相同** —— 官方静态态**不加** `cursor-pointer` / hover / transition。
     round 111：用**终态**（`completed`）取静态态 —— `pending` 现在按官方语义是**可交互**的
     （chips 变成 dropdown 触发器）。 */
  it('chip 静态态 class 不变：`<span>`、无 `cursor-pointer` / `hover:` / `transition-colors`', () => {
    const content = { ...legacyContent('image', 'c1'), status: 'completed' };
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    const chips = [...container.querySelectorAll('span')].filter((el) => (
      /inline-flex items-center gap-1\.5 rounded-lg px-2 py-1\.5 text-xs font-medium leading-5 text-white\/88/.test(el.className)
    ));
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.tagName).toBe('SPAN');
      expect(chip.className).not.toContain('cursor-pointer');
      expect(chip.className).not.toContain('hover:bg-white/[0.05]');
      expect(chip.className).not.toContain('transition-colors');
    }
  });
});

/* ------------------------------------------------------------------ *
 * 第 88 轮：缩略图条（官方 `Kf`/`Jre`/`unt`）—— MTV 节点类型必须先归一到官方字面量
 * ------------------------------------------------------------------ */

describe('第 88 轮：缩略图条按官方 Kf / Jre / unt 落地', () => {
  /** 官方 `Jre` 读的是画布 `nodeLookup` 里节点的 `type`；MTV 节点类型是 `ai-*` / `source-*`。 */
  function seedNode(id: string, type: string, src: string) {
    useAppStore.setState({
      nodes: [{ id, type, position: { x: 0, y: 0 }, data: { type, src, title: `t-${id}` } }],
    } as never);
  }

  function thumbImg(): HTMLImageElement | null {
    return document.querySelector('img');
  }

  /* 旧实现把 MTV 类型直接拿去比 `=== 'video' || === 'image'` ⇒ 恒不成立 ⇒ 永远没有 `<img>`。 */
  it('`ai-image` 节点 ⇒ 渲染真实缩略图，且走官方 `pn(src, SMALL)`', () => {
    seedNode('n1', 'ai-image', 'https://cdn.test/a.png');
    render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    const img = thumbImg();
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://cdn.test/a.png?variant_name=small');
  });

  it('`ai-video` 节点 ⇒ 走官方 `pn(src, THUMBNAIL)`', () => {
    seedNode('n1', 'ai-video', 'https://cdn.test/v.mp4');
    render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(thumbImg()?.getAttribute('src')).toBe('https://cdn.test/v.mp4?variant_name=thumbnail');
  });

  /* MTV 适配点：本地资产加 `?variant_name=` 反而取不到图。 */
  it('本地 `asset://` 资产 ⇒ 原样使用，不加变体', () => {
    seedNode('n1', 'ai-image', 'asset://local/a.png');
    render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(thumbImg()?.getAttribute('src')).toBe('asset://local/a.png');
  });

  /* 旧实现的兜底 glyph 也拿 MTV 类型比 `=== 'text'` ⇒ 恒落 default ⇒ 任何类型都画成图片图标。 */
  it('`ai-text` 节点 ⇒ 无 `<img>`，且兜底 glyph 是文本图标（14 视框）而非图片图标（48 视框）', () => {
    seedNode('n1', 'ai-text', '');
    const { container } = render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(thumbImg()).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 14 14');
  });

  it('`ai-video` 节点无 src ⇒ 兜底 glyph 是视频图标（48 视框、非文本/音频）', () => {
    seedNode('n1', 'ai-video', '');
    const { container } = render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(thumbImg()).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 48 48');
  });

  /* 官方 `Jre` 用 `useStore` 选择器订阅（`getState()` 惰性读则不会重渲染）。 */
  it('节点 `src` 后到 ⇒ 订阅生效，缩略图随之出现', () => {
    seedNode('n1', 'ai-image', '');
    render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(thumbImg()).toBeNull();
    act(() => {
      seedNode('n1', 'ai-image', 'https://cdn.test/late.png');
    });
    expect(thumbImg()?.getAttribute('src')).toBe('https://cdn.test/late.png?variant_name=small');
  });

  /* ── 音频兜底 glyph 的三态（官方 `unt({nodeType, audioScene})` → `_s`=`Wk`@311612）──
     三个 scene 是三条**不同的 path**（都是 16 视框，只有 path 数据能区分）：
       等化器（默认 / Text-to-Speech）首条 path  `M6.80013 2.16699…`
       双音符（Music）          首条 path  `M5.61096 11.611…`
       双声波（Sound）          首条 path  `M9.63342 10.667…` */
  function seedAudioNode(scene?: string) {
    useAppStore.setState({
      nodes: [{
        id: 'n1',
        type: 'ai-audio',
        position: { x: 0, y: 0 },
        data: { type: 'ai-audio', src: '', title: 't-n1', ...(scene ? { params: { scene } } : {}) },
      }],
    } as never);
  }

  function firstPathD(container: HTMLElement): string {
    return container.querySelector('svg path')?.getAttribute('d') ?? '';
  }

  it('音频节点无 `params.scene` ⇒ 兜底 glyph 走官方默认「等化器」', () => {
    seedAudioNode();
    const { container } = render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(firstPathD(container).startsWith('M6.80013 2.16699')).toBe(true);
  });

  it('音频节点 `params.scene="Music"` ⇒ 兜底 glyph 是官方「双音符」', () => {
    seedAudioNode('Music');
    const { container } = render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(firstPathD(container).startsWith('M5.61096 11.611')).toBe(true);
  });

  it('音频节点 `params.scene="Sound"` ⇒ 兜底 glyph 是官方「双声波」', () => {
    seedAudioNode('Sound');
    const { container } = render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(firstPathD(container).startsWith('M9.63342 10.667')).toBe(true);
  });

  it('音频节点 `params.scene="Text-to-Speech"` ⇒ 与缺省同为「等化器」', () => {
    seedAudioNode('Text-to-Speech');
    const { container } = render(<NodeThumbRow nodeIds={['n1']} showTooltip={false} />);
    expect(firstPathD(container).startsWith('M6.80013 2.16699')).toBe(true);
  });
});
