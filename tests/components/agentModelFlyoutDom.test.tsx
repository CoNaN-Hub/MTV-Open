// @vitest-environment jsdom
/**
 * 官方「模型信息卡 + 思考强度档位」飞出面板的**真实 DOM 回归**
 * （`vendor-pkg-canvas-ChpWx5JY.js`：`bye`@62684 / `NR`@70900 / `Rye`@67400 / `cbe`@82060）。
 *
 * 覆盖：
 *  ① 弹窗能渲染出信息卡（模型名 / 简介 / 速度·智能·成本三行）与 `思考强度` 档位控件；
 *  ② 档位选中与**写入 store**（官方 `dbe` 的 `onThinkingChange` → `setChatModelThinkingSettings`）、
 *    默认档位（官方 `NR`：`settings?.level || thinking.default?.level || levels[0]`）、
 *    以及「每个模型各自存一份」（官方按模型 id 存 ⇒ 不互相继承）；
 *  ③ **有** `thinking` 元数据 ⇒ 只出现元数据给的档位；**无**元数据 ⇒ 出现官方逐字 6 档 + 关闭哨兵
 *    （★ 本工程唯一偏离官方处：官方 `NR` 首行 `if (!model.thinking) return null` ⇒ 不渲染；
 *      MTV 按用户决定用官方词汇表兜底把控件画出来，保证「无论如何都能调」）。
 *
 * 验证分级：(b) jsdom 真 DOM。真机读数见 §76/§78 报告（a 级 CDP 9333）。
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setLocale } from '../../src/i18n';
import { useAppStore } from '../../src/store/useAppStore';
import type { ModelOption } from '../../src/types';
import type { ModelThinkingMeta } from '../../src/types/chat';
import AgentModelFlyout from '../../src/components/chat/AgentModelFlyout';

const THINKING: ModelThinkingMeta = {
  levels: ['low', 'medium', 'high'],
  default: { enabled: true, level: 'medium' },
  can_disable: true,
  switchable: true,
};

function model(value: string, label: string, thinking?: ModelThinkingMeta): ModelOption {
  return {
    value,
    provider: 'apimatch',
    label,
    description: '',
    nodeTypes: ['ai-text'],
    ...(thinking ? { thinking } : {}),
  };
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  setLocale('zh-CN');
});

afterEach(() => {
  cleanup();
  useAppStore.setState(useAppStore.getInitialState(), true);
});

describe('官方模型信息卡（bye）+ 思考强度（NR）', () => {
  it('① 渲染模型名 / 官方简介 / 速度·智能·成本 三行与 meter 值', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/gpt-6-luna', 'GPT 6 Luna', THINKING)}
        info={{ displayName: 'GPT 6 Luna', description: 'ignored' }}
      />,
    );
    expect(container.querySelector('h4')?.textContent).toBe('GPT 6 Luna');
    /* 官方 i18n `chatAdapter.modelOptions.info.models.gpt6Luna.description` */
    expect(container.querySelector('p')?.textContent).toBe('最高效的档位，适合聚焦的高频任务。');
    const meters = Array.from(container.querySelectorAll('meter')).map((m) => [
      m.getAttribute('aria-label'),
      m.getAttribute('value'),
      m.getAttribute('min'),
      m.getAttribute('max'),
    ]);
    expect(meters).toEqual([
      ['速度', '5', '1', '5'],
      ['智能', '4', '1', '5'],
      ['成本', '1', '1', '5'],
    ]);
    /* 能力条逐字类名（官方 `xye`：`h-[3px] w-5 rounded-full` + `/90` 与 `/35`） */
    const bars = Array.from(container.querySelectorAll('dl dd > span > span')).map((s) => s.className);
    expect(bars).toHaveLength(15);
    expect(bars.slice(0, 5)).toEqual([
      'h-[3px] w-5 rounded-full bg-text-text-primary/90',
      'h-[3px] w-5 rounded-full bg-text-text-primary/90',
      'h-[3px] w-5 rounded-full bg-text-text-primary/90',
      'h-[3px] w-5 rounded-full bg-text-text-primary/90',
      'h-[3px] w-5 rounded-full bg-text-text-primary/90',
    ]);
    /* 思考强度（官方 `chatAdapter.modelOptions.effort`） */
    expect(container.textContent).toContain('思考强度');
  });

  it('② 默认档位 = thinking.default.level，滑块档位序列含「关」哨兵', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/gpt-6-luna', 'GPT 6 Luna', THINKING)}
        info={{ displayName: 'GPT 6 Luna', description: null }}
      />,
    );
    const slider = container.querySelector('[role="slider"]');
    expect(slider).toBeTruthy();
    /* can_disable ⇒ levels = [__thinking_off__, low, medium, high] ⇒ max = 3 */
    expect(slider?.getAttribute('aria-valuemax')).toBe('3');
    /* 默认 medium ⇒ index 2 */
    expect(slider?.getAttribute('aria-valuenow')).toBe('2');
    expect(slider?.getAttribute('aria-valuetext')).toBe('中');
    expect(slider?.getAttribute('aria-label')).toBe('思考强度');
  });

  it('② 选中一档 ⇒ 写入 store 的 `chatModelThinkingSettings[模型 id]`（官方写入点）', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/gpt-6-luna', 'GPT 6 Luna', THINKING)}
        info={{ displayName: 'GPT 6 Luna', description: null }}
      />,
    );
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/gpt-6-luna']).toEqual({
      enabled: true,
      level: 'high',
    });
    /* ⚠️ 官方 `selectIndex(0)`：`levels[0]` 在 `can_disable` 时就是**关闭哨兵** ⇒
       Home 落成 `{enabled:false, level:<当前档>}`，不是「最低档 low」。 */
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/gpt-6-luna']).toEqual({
      enabled: false,
      level: 'high',
    });
  });

  it('② 拖到「关」哨兵 ⇒ enabled:false 且保留**当时的**档位（官方 `f(km)` 分支）', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/gpt-6-luna', 'GPT 6 Luna', THINKING)}
        info={{ displayName: 'GPT 6 Luna', description: null }}
      />,
    );
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    /* 第一次 ArrowLeft：medium(2) → low(1)，写 {enabled:true, level:'low'} */
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/gpt-6-luna']).toEqual({
      enabled: true,
      level: 'low',
    });
    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    /* 第二次 ArrowLeft：low(1) → 哨兵(0) ⇒ `{enabled:false, level:<重渲染后的当前档>'low'}` */
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/gpt-6-luna']).toEqual({
      enabled: false,
      level: 'low',
    });
    expect(slider.getAttribute('aria-valuetext')).toBe('关');
  });

  it('② 档位按模型 id 各存一份 —— 换模型不继承（官方 `chatModelThinkingSettings[modelId]`）', () => {
    const { container, unmount } = render(
      <AgentModelFlyout
        model={model('apimart/gpt-6-luna', 'GPT 6 Luna', THINKING)}
        info={{ displayName: 'GPT 6 Luna', description: null }}
      />,
    );
    fireEvent.keyDown(container.querySelector('[role="slider"]') as HTMLElement, { key: 'End' });
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/gpt-6-luna']).toEqual({
      enabled: true,
      level: 'high',
    });
    unmount();

    /* 另一个模型：自己的默认档（`default.level = medium`），没有继承上一个模型的 high */
    const second = render(
      <AgentModelFlyout
        model={model('apimart/gpt-6-sol', 'GPT 6 Sol', {
          levels: ['low', 'medium', 'high'],
          default: { enabled: true, level: 'medium' },
          can_disable: true,
        })}
        info={{ displayName: 'GPT 6 Sol', description: null }}
      />,
    );
    const slider = second.container.querySelector('[role="slider"]');
    expect(slider?.getAttribute('aria-valuenow')).toBe('2');
    expect(slider?.getAttribute('aria-valuetext')).toBe('中');
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/gpt-6-sol']).toBeUndefined();
  });

  it('③ 无 `thinking` 元数据 ⇒ 兜底出现**官方逐字 6 档 + 关闭哨兵**（★ 唯一偏离官方处 ★）', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/plain', 'Plain')}
        info={{ displayName: 'Plain', description: null }}
      />,
    );
    const slider = container.querySelector('[role="slider"]');
    expect(slider).toBeTruthy();
    /* 官方词汇表 6 档 + 关闭哨兵 = 7 个位置 ⇒ aria-valuemax = 6 */
    expect(slider?.getAttribute('aria-valuemax')).toBe('6');
    /* 默认档走官方 `||` 链的最后一环 `levels[0]` = `low` ⇒ index 1（index 0 是关闭哨兵） */
    expect(slider?.getAttribute('aria-valuenow')).toBe('1');
    /* 官方 i18n `chatAdapter.modelOptions.levels.low`（zh）逐字 */
    expect(slider?.getAttribute('aria-valuetext')).toBe('低');
    expect(slider?.getAttribute('aria-label')).toBe('思考强度');
    /* 档位点 = 一行一个（官方 `Rye` 对 `p` 逐个画点）⇒ 关闭哨兵也算一个 ⇒ 7 */
    expect(container.querySelectorAll('[role="slider"] [aria-hidden] span.rounded-full')).toHaveLength(7);
    /* 信息卡本体仍在（能力评分走官方 fye 兜底表 ⇒ 默认 default 三档 3/3/3） */
    expect(container.querySelectorAll('meter')).toHaveLength(3);
  });

  it('③ 兜底档位可调到 `max`，且换到最右端写的是官方 code `max`（不是自造名）', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/plain', 'Plain')}
        info={{ displayName: 'Plain', description: null }}
      />,
    );
    const slider = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(slider, { key: 'End' });
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/plain']).toEqual({
      enabled: true,
      level: 'max',
    });
    expect(slider.getAttribute('aria-valuetext')).toBe('最高');
  });

  it('③ 有元数据时**只**出现元数据给的档位（不掺官方词汇表）', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/two', 'Two', { levels: ['low', 'max'], can_disable: false })}
        info={{ displayName: 'Two', description: null }}
      />,
    );
    const slider = container.querySelector('[role="slider"]');
    /* can_disable:false ⇒ 不插哨兵 ⇒ 只有 2 个位置 */
    expect(slider?.getAttribute('aria-valuemax')).toBe('1');
    expect(slider?.getAttribute('aria-valuenow')).toBe('0');
    expect(slider?.getAttribute('aria-valuetext')).toBe('低');
    expect(container.querySelectorAll('[role="slider"] [aria-hidden] span.rounded-full')).toHaveLength(2);
    fireEvent.keyDown(slider as HTMLElement, { key: 'End' });
    expect(useAppStore.getState().chatModelThinkingSettings['apimart/two']).toEqual({
      enabled: true,
      level: 'max',
    });
  });

  it('③ 单档 + 不可关 ⇒ 官方 `if (!switchable && !canDisable) return null`（整个控件不出现）', () => {
    const { container } = render(
      <AgentModelFlyout
        model={model('apimart/one', 'One', { levels: ['medium'], can_disable: false })}
        info={{ displayName: 'One', description: null }}
      />,
    );
    expect(container.querySelector('[role="slider"]')).toBeNull();
  });
});
