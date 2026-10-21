// @vitest-environment jsdom
/**
 * **round 122 优先取证**：待决卡的「模型 chip 不可编辑 + 确认不可点」到底成不成立？
 *
 * 现场背景（round 120 真机读数）：第二张待决卡的载荷是
 * `request_json.model_name = "general/provider-custom-2611fc0a-1idsg9"`，
 * fiber 里 `params.model = {status:"unknown", displayName:"general/provider-custom-…"}`，
 * DOM 里模型 chip 是 `span`（点不开）。
 *
 * 代码 trace（`generationChipController.ts`）：
 *   · `modelUnknown = editedModel?.status === 'unknown'` ⇒ **true**
 *   · `modelChipEditable = !modelEditingLocked && !referencesPending && !modelUnknown && !videoModeUnknown`
 *     ⇒ **false** ⇒ `ParamChip` 的 `editable` 为假 ⇒ 渲染成 `<span>`（不可编辑）
 *   · **但** `modelAvailable = modelUnknown || (!!modelId && …)` ⇒ **true**
 *     ⇒ `confirmDisabled = subscriptionLoading || !modelAvailable` ⇒ **false**
 *   · round 116 的 `modelSelectionRequired` 由宿主按「载荷**没有** `model_name`」才置真
 *     （`GenerationConfirmationCard.tsx`：`interactive && !cardModelName(content)`）
 *     ⇒ 这张卡**有** `model_name` ⇒ `modelSelectionRequired === false` ⇒ 不会落到「Select a model」那条
 *
 * ⇒ 预期**不是死路**：模型 chip 不可编辑（MTV 解析不出该模型、没有可切换的目录项），
 *   但「确认」**可点**（模型已在载荷里指派），确认时 `confirmationAnswerResolution` 用
 *   `request_json.model_name` 作 `modelRef` 上行。
 * 官方同口径：`iie` @2324048 `we = G || (!!F && Lg(e,F,q) && GF(e,F,de))`，
 *   `G = _?.status==="unknown"` ⇒ unknown 时 `we` 为真 ⇒ `Te = Y || !we` 为假 ⇒ 确认放行。
 *
 * 本文件把这个组合**钉死**（防止将来把 unknown 也当「未选模型」而卡死确认）。
 *
 * ★ round 121 补充：上面第 8 行的「DOM 里模型 chip 是 `span`（点不开）」**同时**意味着
 *   这一支显示的是 `_.displayName` —— MTV 的 `generationConfirmationProtocol.hE` 目录为空
 *   （该文件 @679-690 自述）⇒ 它就是载荷 `model_name` **原样**，即 `general/<配置 id>` 内部引用。
 *   本仓禁止把它印给用户（`ProjectSettingsPopover.tsx:644`）⇒ 已过展示名出口
 *   （`generationChipController.ts` 的 `resolveChipModelDisplayName`）。**chip 仍不可点**
 *   （`modelChipEditable` 含 `!modelUnknown`，官方 `!p&&!Ce&&!G&&!V` 逐字）—— 见下方断言。
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GenerationConfirmationCard } from '../../src/components/chat/GenerationConfirmationCard';
import { confirmationStoreSliceOf } from '../../src/components/chat/confirmationEventDispatch';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';

/**
 * ★ round 121：模型 chip 上应显示的**可读名**。
 *
 * 载荷 `model_name = "general/provider-custom-2611fc0a-1idsg9"` 是**内部调用引用**，
 * 本仓明文禁止印给用户（`components/ProjectSettingsPopover.tsx:644`「绝不把 `apimart/xxx` /
 * `general/<cfgId>` 这种调用引用印给用户」）。本文件不播种 `config.generalModels`
 * ⇒ 展示名出口解析不出上游名 ⇒ 兜底 = **剥掉 `general/` 前缀**。
 */
const MODEL_CHIP_TEXT = 'provider-custom-2611fc0a-1idsg9';

beforeEach(() => {
  setLocale('zh-CN');
  /* 确定性：模型 chip 的展示名会读 `config.generalModels` / `config.providers`。 */
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(() => { cleanup(); });

/** 第二张待决卡的**逐字**载荷（round 120 真机 fiber 读数）。 */
function providerModelCardContent(over: Record<string, unknown> = {}) {
  return {
    schema_version: 'tool_event.v1',
    type: 'tool_event',
    tool: 'generation_confirmation',
    status: 'pending',
    request: {
      confirmation_id: 'agent-probe-step-2-approval',
      request_kind: 'image',
      request_json: {
        kind: 'tapnow.generation_request.v1',
        request_kind: 'image',
        prompt: '生成一只可爱的幼猫…严格为3:4画幅。',
        model_name: 'general/provider-custom-2611fc0a-1idsg9',
        image: { aspect_ratio: '1:1', image_size: '2K', times: 1 },
        ...over,
      },
    },
  } as unknown as Record<string, unknown>;
}

function modelChip(container: HTMLElement): Element | null {
  return [...container.querySelectorAll('button,span')].find((el) => (
    /inline-flex items-center gap-1\.5 rounded-lg px-2 py-1\.5 text-xs font-medium leading-5 text-white\/88/.test(String(el.className))
    && (el.textContent || '').includes(MODEL_CHIP_TEXT)
  )) ?? null;
}

function confirmButton(container: HTMLElement): HTMLButtonElement | null {
  return ([...container.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === '确认') ?? null) as HTMLButtonElement | null;
}

describe('round 122 · 待决卡的「模型未知」组合：chip 只读但**确认必须可点**（不是死路）', () => {
  it('载荷有 `model_name`（未解析出目录条目）⇒ 模型 chip 是 **span**（不可编辑）', () => {
    const content = providerModelCardContent();
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    const chip = modelChip(container);
    expect(chip).not.toBeNull();
    expect(chip!.tagName).toBe('SPAN');
  });

  it('★ round 121：chip 文本是**可读名** —— 不再把 `general/<配置 id>` 这种内部调用引用印给用户', () => {
    const content = providerModelCardContent();
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    /* 本仓明文：`components/ProjectSettingsPopover.tsx:644`。 */
    expect(container.textContent).not.toContain('general/');
    expect(container.textContent).toContain(MODEL_CHIP_TEXT);
  });

  it('⭐「确认」**存在且未禁用** —— 模型已指派，`modelUnknown` 走官方 `G` 分支放行', () => {
    const content = providerModelCardContent();
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    const confirm = confirmButton(container);
    expect(confirm).not.toBeNull();
    expect(confirm!.disabled).toBe(false);
  });

  it('未选模型的提示文案（`Select a model`）**不出现** —— 那是「载荷没有 model_name」才该有的态', () => {
    const content = providerModelCardContent();
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    expect(container.textContent).not.toContain('Select a model');
    expect(container.textContent).not.toContain('Subscription required');
  });

  it('对照组：载荷**没有** `model_name` ⇒ chip 可编辑（button）且提示「先选模型」、确认禁用', () => {
    const content = providerModelCardContent({ model_name: undefined });
    /* ★ 2026-10-15 用户口径：候选**只**来自「他已接入的连接声明的模型」⇒ 先给一条连接声明一个
       图片模型，候选才非空。候选为 0 条时 chip 会降级成静态 `<span>` 并改出「先去拉取模型」的
       可操作提示（**不许**塞 MTV 内置模型充数）—— 那一路由
       `tests/components/cardModelCandidates.test.tsx` 钉住。 */
    useAppStore.setState({
      config: {
        ...useAppStore.getState().config,
        providers: {
          'custom-edge': {
            name: '土豆 · 生图组',
            apiKey: 'placeholder-key-not-real',
            catalogId: 'custom-openai',
            selectedModels: [],
          },
        } as never,
        generalModels: [{
          id: 'candidate-1',
          name: 'Nano Banana',
          modelId: 'gemini-nano-banana-2.1',
          category: 'image',
          providerConfigId: 'custom-edge',
        }] as never,
      },
    });
    const { container } = render(
      <GenerationConfirmationCard content={content} store={confirmationStoreSliceOf(content, false)} />,
    );
    /* round 116 的 `modelSelectionRequired` 态：占位 chip 可点开，确认须先选模型。 */
    const placeholder = [...container.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Model');
    expect(placeholder).toBeDefined();
    expect(placeholder!.disabled).toBe(false);
    expect(confirmButton(container)!.disabled).toBe(true);
  });
});
