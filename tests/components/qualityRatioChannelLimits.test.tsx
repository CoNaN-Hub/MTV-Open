// @vitest-environment jsdom
import { createElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import QualityRatioSelector from '../../src/components/nodes/shared/QualityRatioSelector';

vi.mock('../../src/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/i18n')>();
  return { ...actual, useT: () => (key: string) => key };
});

/**
 * **渠道**置灰（不是「模型不支持」）：土豆异步生图走免费池渠道，
 * `resolution=4k` / `quality=high` 一律 `409 free_pool_param_mismatch`（2026-10-20 逐参数实测）。
 * 用户口径：菜单项**留着但点不动**，当前值若落在置灰档位上要自动收敛，否则一按生成就 409。
 */
const TUDOU_ASYNC = 'gpt-image-2.5-flare-async';

function panel(props: Record<string, unknown> = {}) {
  return render(createElement(
    QualityRatioSelector as unknown as (p: Record<string, unknown>) => ReactElement,
    {
      model: TUDOU_ASYNC,
      imageSize: '2K',
      aspectRatio: '16:9',
      quality: 'medium',
      onChangeAspectRatio: vi.fn(),
      onChangeImageSize: vi.fn(),
      onChangeQuality: vi.fn(),
      disabledImageSizes: ['4K'],
      disabledQualities: ['high', 'xhigh', 'max'],
      fallbackImageSize: '2K',
      fallbackQuality: 'medium',
      channelLimitReason: '免费池渠道限制',
      ...props,
    },
  ));
}

/** 打开参数弹窗（触发器是 `ui-schema-quality-ratio-pill` 里那颗按钮）。*/
function openPanel(container: HTMLElement) {
  const trigger = container.querySelector('.ui-schema-quality-ratio-pill button') as HTMLElement;
  fireEvent.click(trigger);
  return trigger;
}

beforeEach(() => { cleanup(); });

describe('channel-limited image parameters', () => {
  it('keeps 4K in the menu but disables it, with the reason as tooltip', () => {
    const { container } = panel();
    openPanel(container);
    const fourK = container.ownerDocument.querySelector('button[data-ui-schema-value="4K"]') as HTMLButtonElement;
    expect(fourK).toBeTruthy();
    expect(fourK.disabled).toBe(true);
    expect(fourK.getAttribute('title')).toBe('免费池渠道限制');
    const twoK = container.ownerDocument.querySelector('button[data-ui-schema-value="2K"]') as HTMLButtonElement;
    expect(twoK.disabled).toBe(false);
  });

  it('disables the top quality tiers and keeps low / medium clickable', () => {
    const { container } = panel();
    openPanel(container);
    const high = container.ownerDocument.querySelector('button[data-ui-schema-value="high"]') as HTMLButtonElement;
    expect(high?.disabled).toBe(true);
    const medium = container.ownerDocument.querySelector('button[data-ui-schema-value="medium"]') as HTMLButtonElement;
    expect(medium?.disabled).toBe(false);
  });

  it('converges a stale 4K / high selection to what the channel accepts', () => {
    const onChangeImageSize = vi.fn();
    const onChangeQuality = vi.fn();
    panel({ imageSize: '4K', quality: 'high', onChangeImageSize, onChangeQuality });
    expect(onChangeImageSize).toHaveBeenCalledWith('2K');
    expect(onChangeQuality).toHaveBeenCalledWith('medium');
  });

  it('leaves parameters alone for models without channel limits', () => {
    const onChangeImageSize = vi.fn();
    panel({
      model: 'gpt-image-2.5-flare',
      imageSize: '4K',
      quality: 'high',
      disabledImageSizes: undefined,
      disabledQualities: undefined,
      fallbackImageSize: undefined,
      fallbackQuality: undefined,
      channelLimitReason: undefined,
      onChangeImageSize,
    });
    expect(onChangeImageSize).not.toHaveBeenCalled();
  });
});
