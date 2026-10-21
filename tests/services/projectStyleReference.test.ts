import { describe, expect, it } from 'vitest';
import {
  applyProjectDefaultsToNodeData,
  getEnabledProjectStyleReferenceUrl,
  normalizeProjectSettings,
  resolveProjectGenerationPrompt,
} from '../../src/services/projectSettingsService';
import type { BaseNodeData, ProjectSettings } from '../../src/types';

describe('project style reference (风格母图)', () => {
  it('normalizes style reference with default enabled', () => {
    const settings: ProjectSettings = {
      visualStyle: {
        styleReference: {
          imageUrl: 'asset://localhost/style.png',
          fileName: 'style.png',
        },
      },
    };
    const next = normalizeProjectSettings(settings);
    expect(next.visualStyle?.styleReference?.imageUrl).toBe('asset://localhost/style.png');
    expect(next.visualStyle?.styleReference?.enabled).toBe(true);
  });

  it('preserves explicit disabled', () => {
    const settings: ProjectSettings = {
      visualStyle: {
        styleReference: {
          imageUrl: 'https://cdn/x.png',
          enabled: false,
        },
      },
    };
    const next = normalizeProjectSettings(settings);
    expect(next.visualStyle?.styleReference?.enabled).toBe(false);
    expect(getEnabledProjectStyleReferenceUrl(next)).toBeNull();
  });

  it('getEnabledProjectStyleReferenceUrl returns url when enabled', () => {
    const settings: ProjectSettings = {
      visualStyle: {
        styleReference: {
          imageUrl: '  https://cdn/style.png  ',
          enabled: true,
        },
      },
    };
    expect(getEnabledProjectStyleReferenceUrl(settings)).toBe('https://cdn/style.png');
  });

  it('keeps named style and style reference together', () => {
    const settings: ProjectSettings = {
      visualStyle: {
        styleId: 'cinematic',
        styleName: '电影质感',
        prompt: '电影级',
        locked: true,
        styleReference: {
          imageUrl: 'asset://ref.png',
          enabled: true,
        },
      },
    };
    const next = normalizeProjectSettings(settings);
    expect(next.visualStyle?.styleId).toBe('cinematic');
    expect(next.visualStyle?.styleReference?.imageUrl).toBe('asset://ref.png');
  });

  it('syncs a new image node size to the project aspect ratio', () => {
    const next = applyProjectDefaultsToNodeData({
      label: '生成图像',
      type: 'ai-image',
      role: 'generator',
      prompt: '',
      aspectRatio: '16:9',
      nodeWidth: 280,
      nodeHeight: 158,
    }, {
      generation: { imageAspectRatio: '2:3' },
    });

    expect(next).toMatchObject({
      aspectRatio: '2:3',
      nodeWidth: 187,
      nodeHeight: 280,
    });
  });

  it('视频节点不吃项目级画风（官方只有图片路径带 style_images），但仍吃媒体提示词后缀', () => {
    const data: BaseNodeData = {
      label: '视频生成',
      type: 'ai-video',
      style: 'paper-cut',
    };
    const settings: ProjectSettings = {
      visualStyle: {
        styleId: 'cinematic',
        prompt: '电影级画面',
      },
      promptSuffixes: {
        video: '镜头稳定，运动连贯',
      },
    };

    /* 第 65 轮按官方源码收窄：`supportsVisualStyle` 去掉 `ai-video` ——
       官方 `style_images` 只在图片路径（`cameraControlImage({… style_images …})`）出现，
       视频参数白名单 `m3e` 里的 `style` 是**按模型的选项**（Pixverse/Vidu），不是项目级画风。
       ⇒ 项目画风（含 `data.style` 选中的剪纸风）不再进视频提示词；**媒体提示词后缀照旧**。 */
    expect(resolveProjectGenerationPrompt({
      prompt: '一艘飞船穿过云层',
      data,
      settings,
      customStyles: [{
        id: 'paper-cut',
        nodeType: 'ai-video',
        name: '剪纸',
        prompt: '中国剪纸艺术风格，层次分明',
        createdAt: 1,
      }],
    })).toBe([
      '一艘飞船穿过云层',
      '镜头稳定，运动连贯',
    ].join('\n\n'));

    /* 对照：图片节点的画风仍然生效（收窄只作用于视频）。 */
    expect(resolveProjectGenerationPrompt({
      prompt: '一艘飞船穿过云层',
      data: { label: '图片生成', type: 'ai-image', style: 'paper-cut' } as BaseNodeData,
      settings,
      customStyles: [{
        id: 'paper-cut',
        nodeType: 'ai-video',
        name: '剪纸',
        prompt: '中国剪纸艺术风格，层次分明',
        createdAt: 1,
      }],
    })).toBe([
      '一艘飞船穿过云层',
      '中国剪纸艺术风格，层次分明',
    ].join('\n\n'));
  });
});
