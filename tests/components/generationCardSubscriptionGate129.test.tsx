// @vitest-environment jsdom
/**
 * **round 129 · 生成确认卡上的 `Subscription required` 误报（用户 2026-10-15 真机）**
 *
 * 现场：用户用的是**自定义厂商**（土豆 `api.ai-tudou.net`）+ 卡上已选好模型，
 * 卡脚却浮出「带锁图标的 `Subscription required`」，把「确认」挡住。
 *
 * 根因（官方原文 + 本仓现状，详见 `src/components/chat/generationChipController.ts` 文件头 round 129）：
 *   · 官方那句判据是 `Ft = !Fg(e, qt, q)` / `C = !t && !g`（`vendor-packages-CvEFn1fJ.js`
 *     @1228842 `$$=({imageCounts:e=0,isPayingCustomer:t=!1})=>… g=i.isFree??!1, C=!t&&!g`；
 *     @1236529 `aQ`：`b=x.isFree??!1, w=!r&&!b`）——`q`/`t`/`r` = **`isPayingCustomer`**
 *     （订阅/付费态，来自计费 store `P2` @812084，后端 `stripev2/customer/paying-status` @755467）；
 *   · 官方 `video.modelRestricted` 的 zh 原文 = **「任意一次付费即可全部解锁」**
 *     （`vendor-pkg-canvas-Dp0xADoD.js` @4363290 邻区；`index-CsQaPZ-H.js` @878905）；
 *   · MTV **没有** `isPayingCustomer` 数据源，round 116 起却把它按 `false` 传进判据
 *     ⇒ 目录里 8 个显式 `isFree:false` 的模型（图片 `tapnow-image-turbo`；视频
 *     `wanxiang-plus`/`wanxiang-i2v-flash`/`wanxiang-preview`；`midjourney-*` 被 `jz` 先滤掉）
 *     以及音频里除 `mureka-v8`/`mureka-o2` 外的全部模型都被断言「受限」。
 *
 * 本文件从**卡片 DOM** 钉死两件事：
 *   ① 正例：卡片模型是显式付费档 / 是用户自接连接模型 ⇒ **不出现** `Subscription required`，
 *      「确认」可点（`disabled === false`）；
 *   ② 反例：真正该拦的那条路仍然拦 —— 载荷没有 `model_name` ⇒ 确认禁用 + 官方
 *      `videoConfigs.selectModel`（"Select a model"），**闸门没被拆掉**。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GenerationConfirmationCard } from '../../src/components/chat/GenerationConfirmationCard';
import { confirmationStoreSliceOf } from '../../src/components/chat/confirmationEventDispatch';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

const CUSTOM_CONNECTION = 'provider-custom-2611fc0a';
const CUSTOM_MODEL_ID = 'provider-custom-2611fc0a-7n7og';
const CUSTOM_MODEL_REF = `general/${CUSTOM_MODEL_ID}`;

beforeEach(() => {
  setLocale('zh-CN');
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(() => { cleanup(); });

/** 复制 `generationCardModelUnknownConfirm.test.tsx` 的载荷形状（真机 fiber 读数同形）。 */
function imageCardContent(modelName: string | undefined, over: Record<string, unknown> = {}) {
  return {
    schema_version: 'tool_event.v1',
    type: 'tool_event',
    tool: 'generation_confirmation',
    status: 'pending',
    request: {
      confirmation_id: 'round-129-subscription-gate',
      request_kind: 'image',
      request_json: {
        kind: 'tapnow.generation_request.v1',
        request_kind: 'image',
        prompt: '一只可爱的幼猫…严格为3:4画幅。',
        ...(modelName === undefined ? {} : { model_name: modelName }),
        image: { aspect_ratio: '1:1', image_size: '2K', times: 1 },
        ...over,
      },
    },
  } as unknown as Record<string, unknown>;
}

function confirmButton(container: HTMLElement): HTMLButtonElement | null {
  return ([...container.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '确认') ?? null) as HTMLButtonElement | null;
}

describe('round 129 · 卡片上不再凭空出现 `Subscription required`', () => {
  it('① 载荷模型 = 目录里显式 `isFree:false` 的 `tapnow-image-turbo` ⇒ 确认可点、无订阅文案', () => {
    const content = imageCardContent('tapnow-image-turbo');
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    expect(container.textContent).not.toContain('Subscription required');
    const confirm = confirmButton(container);
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(false);
  });

  it('② 自定义厂商 + 已选模型（`general/<配置 id>`）⇒ 确认可点、无订阅文案', () => {
    /* 用户现场那一类连接（`generalModels` + `providers` 都要有，展示名出口才解析得出）。 */
    useAppStore.setState({
      config: {
        ...useAppStore.getState().config,
        providers: {
          ...useAppStore.getState().config.providers,
          [CUSTOM_CONNECTION]: {
            name: '我的连接',
            apiKey: 'test-only-key',
            baseUrl: 'https://example.invalid/v1',
          },
        },
        generalModels: [{
          id: CUSTOM_MODEL_ID,
          name: 'GPT Image 2.5 Flare async',
          modelId: 'gpt-image-2.5-flare',
          category: 'image',
          providerConfigId: CUSTOM_CONNECTION,
        }] as never,
      },
    });
    const content = imageCardContent(CUSTOM_MODEL_REF);
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    expect(container.textContent).not.toContain('Subscription required');
    /* 本仓明文：内部调用引用不许印给用户。 */
    expect(container.textContent).not.toContain('general/');
    const confirm = confirmButton(container);
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(false);
  });

  it('③ 反例 · 闸门没被拆掉：载荷**没有** `model_name` ⇒ 确认仍禁用，且理由是有意义的那条', () => {
    const content = imageCardContent(undefined);
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    /* 不许为了「不显示」把文案清空 —— 仍然要拦住。理由经 `OfficialTooltip` 挂在禁用按钮上
       （`ConfirmationCardParts.tsx:435-436`），内容由 radix 在 hover 时才进 DOM ⇒ 这里只钉
       「按钮真禁用 + 卡上不出现订阅文案」；`Select a model` 这条理由本身由
       `generationChipController.test.tsx` 的 round 116 用例逐字钉住。 */
    const confirm = confirmButton(container);
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(true);
    expect(container.textContent).not.toContain('Subscription required');
    /* 对照：同一张卡在旧行为下会带锁 + 订阅文案（回归守护）。 */
    expect(container.textContent).toContain('Model');
  });
});
