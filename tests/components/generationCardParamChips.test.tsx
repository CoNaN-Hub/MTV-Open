// @vitest-environment jsdom
/**
 * 图像/视频生成确认卡上**三颗参数胶囊**（比例 / 清晰度 / 张数）的可选性回归。
 *
 * 用户 2026-10-15 现场（P0）逐字：「官方的 有四个 都可以点击选择 你现在除了模型 都不行」。
 *
 * 根因（本文件钉住的就是它）：
 *   MTV 卡上的模型引用是 `general/<配置 id>` / `<provider>/<modelId>`，而官方参数目录
 *   （`src/data/model-param-catalog.json`，键 = 官方 `qo` 的 wireName，`getParamEntry` 精确匹配）
 *   **查不到** ⇒ `modelInfo === null` ⇒ 官方 `Jnt` 的 `Lb(undefined, 当前值)` 只给出
 *   `[当前值]` ⇒ 菜单点开只有自己那一行（选中等于没选）= 用户说的「点了没反应」。
 *
 * 官方候选（逐字出处见 `generationChipController.ts` 的 `OFFICIAL_*_CANDIDATES` 注释）：
 *   · 比例 15 项 —— `live-assets-new/vendor-packages-DRvCmDjR.js` @1095139 `rq.options.aspectRatios`
 *   · 清晰度 3 项 —— 同一处 `rq.options.imageSizeOptions:["1K","2K","4K"]`
 *   · 张数 3 项 —— `live-assets-new/vendor-pkg-canvas-CvbAwZyy.js` @1327920 `p8e=[1,2,4]`
 *
 * 验证分级 = (a) 真实组件 DOM + 真实下拉（Radix `DropdownMenu`，`fireEvent.pointerDown` 打开）。
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GenerationConfirmationCard } from '../../src/components/chat/GenerationConfirmationCard';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import { clearProviderEntitlements } from '../../src/services/ai/providerEntitlements';

const CONNECTION = 'custom-a';

function generalModel(id: string, modelId: string) {
  return { id, name: modelId, modelId, category: 'image', providerConfigId: CONNECTION };
}

function seed(models: ReturnType<typeof generalModel>[]) {
  useAppStore.setState({
    config: {
      ...useAppStore.getState().config,
      providers: {
        ...useAppStore.getState().config.providers,
        [CONNECTION]: { name: '土豆 · 生图组', apiKey: 'placeholder-key-not-real', catalogId: 'custom-openai', selectedModels: [] },
      },
      generalModels: models as never,
    },
  });
}

/** 与 `agentApprovalContents.generationConfirmationContent` 同形的**单条**（legacy）图像卡载荷。 */
function imageCardContent(modelName: string) {
  return {
    status: 'started',
    tool: 'generation_confirmation',
    request: {
      confirmation_id: 'c1',
      request_kind: 'image',
      request_json: {
        kind: 'tapnow.generation_request.v1',
        request_kind: 'image',
        prompt: '一只猫',
        model_name: modelName,
        image: { aspect_ratio: '9:16', image_size: '1K', times: 1 },
      },
    },
  } as unknown as Record<string, unknown>;
}

const PENDING = { pendingConfirmation: { confirmationId: 'c1', status: 'pending' } };

function chipButton(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll('button')]
    .find((element) => element.textContent?.includes(label));
  if (!button) throw new Error(`找不到胶囊：${label}`);
  return button as HTMLButtonElement;
}

function menuItems(): string[] {
  return [...document.querySelectorAll('[role="menuitem"]')]
    .map((element) => element.textContent ?? '');
}

async function openChip(label: string): Promise<void> {
  await act(async () => {
    fireEvent.pointerDown(chipButton(label));
  });
}

async function pickMenuItem(label: string): Promise<void> {
  const item = [...document.querySelectorAll('[role="menuitem"]')]
    .find((element) => element.textContent === label);
  if (!item) throw new Error(`菜单里没有：${label}（当前是 ${JSON.stringify(menuItems())}）`);
  await act(async () => {
    fireEvent.click(item);
  });
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  clearProviderEntitlements();
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
  clearProviderEntitlements();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('三颗参数胶囊都能点开菜单，且候选是**官方那几项**', () => {
  /* ⚠️ 2026 用户裁决（截图里 1:4/4:1/1:8/8:1 挂着🔒）：「你有些尺寸带锁是什么意思？」
     ⇒ 官方菜单**只列该模型支持的档位**，不支持的**不出现**（不再置灰）。
     所以这里断言的是「该模型（nano-banana-2.1 能力表）支持的那 11 项」，顺序仍与官方
     `rq.options.aspectRatios` 一致；不支持的 1:4/4:1/1:8/8:1 必须**不在**菜单里。 */
  it('比例：只列该模型支持的档位（顺序同官方 `rq.options.aspectRatios`）', async () => {
    seed([generalModel('g1', 'nano-banana-2.1')]);
    render(
      <GenerationConfirmationCard content={imageCardContent('general/g1')} store={PENDING} />,
    );

    await openChip('9:16');
    const items = menuItems();
    expect(items).toEqual([
      'Auto', '1:1', '9:16', '16:9', '3:4', '4:3', '3:2', '2:3', '5:4', '4:5', '21:9',
    ]);
    for (const unsupported of ['1:4', '4:1', '1:8', '8:1']) {
      expect(items).not.toContain(unsupported);
    }
  });

  it('清晰度：1K / 2K / 4K，选中后胶囊文案立刻更新', async () => {
    seed([generalModel('g1', 'nano-banana-2.1')]);
    render(
      <GenerationConfirmationCard content={imageCardContent('general/g1')} store={PENDING} />,
    );

    await openChip('1K');
    expect(menuItems()).toEqual(['1K', '2K', '4K']);
    await pickMenuItem('2K');
    /* 选中态立刻落到胶囊上（官方「选中后胶囊文案立刻更新」）。 */
    expect(document.querySelectorAll('button')[0]) // 0 是模型胶囊
      .toBeDefined();
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('2K'))).toBe(true);
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('1K'))).toBe(false);
  });

  it('张数：1× / 2× / 4×，选中后胶囊文案立刻更新', async () => {
    seed([generalModel('g1', 'nano-banana-2.1')]);
    render(
      <GenerationConfirmationCard content={imageCardContent('general/g1')} store={PENDING} />,
    );

    await openChip('1×');
    expect(menuItems()).toEqual(['1×', '2×', '4×']);
    await pickMenuItem('4×');
    expect([...document.querySelectorAll('button')].some((b) => b.textContent?.includes('4×'))).toBe(true);
  });

  it('**完全查不到**的模型（不在参数目录、也不在官方能力表）⇒ 菜单仍是官方完整表（不剪成一行）', async () => {
    seed([generalModel('g1', 'acme-unknown-image-model')]);
    render(
      <GenerationConfirmationCard content={imageCardContent('general/g1')} store={PENDING} />,
    );

    await openChip('9:16');
    expect(menuItems()).toHaveLength(15);
    /* 无能力数据 ⇒ 不置灰（仓库纪律：官方无判据 ⇒ 不阻断）。 */
    expect(menuItems()).toContain('1:8');
    const disabledItems = [...document.querySelectorAll('[role="menuitem"]')]
      .filter((element) => element.getAttribute('aria-disabled') === 'true');
    expect(disabledItems).toHaveLength(0);
  });

  it('官方能力表**声明不支持**的档位直接不出现（`nano-banana-flash-lite` 只声明 1K）', async () => {
    seed([generalModel('g1', 'nano-banana-flash-lite')]);
    render(
      <GenerationConfirmationCard content={imageCardContent('general/g1')} store={PENDING} />,
    );

    await openChip('1K');
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    /* 用户 2026：「有些尺寸带锁是什么意思？」⇒ 不支持的不再置灰列出，直接不列。 */
    expect(items.map((element) => element.textContent)).toEqual(['1K']);
  });

  it('确认时把三颗胶囊的选择编成官方 wire 载荷（`aspect_ratio` / `image_size` / `times`）', async () => {
    seed([generalModel('g1', 'nano-banana-2.1')]);
    const answers: Array<{ action: string; payload: unknown }> = [];
    render(
      <GenerationConfirmationCard
        content={imageCardContent('general/g1')}
        store={PENDING}
        onAnswer={(_id, action, payload) => { answers.push({ action, payload }); }}
      />,
    );

    await openChip('1K');
    await pickMenuItem('2K');
    await openChip('9:16');
    await pickMenuItem('16:9');
    await openChip('1×');
    await pickMenuItem('2×');

    await act(async () => {
      fireEvent.click(chipButton('确认'));
    });

    expect(answers).toHaveLength(1);
    expect(answers[0].action).toBe('confirm');
    /**
     * 官方 `Mv`（`generationChipController.buildWireModifications` / 编码表 `ETT` @2241685）
     * 产出的正是这三个 **snake_case** 键 —— 服务端 `gJe` 按它逐字段叠回请求。
     */
    expect(answers[0].payload).toEqual({
      times: 2,
      aspect_ratio: '16:9',
      image_size: '2K',
    });
  });
});
