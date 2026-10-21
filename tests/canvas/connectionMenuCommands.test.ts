/**
 * 拖到画布空白处的连线菜单 —— 官方命令表 1:1 校验。
 *
 * 事实来源：官方 `zoom-slider-3ZcFvYQO.js` @2899892–2905600
 *   `textNodeLeft/RightCommands`、`imageNodeLeft/RightCommands`、
 *   `videoNodeLeft/RightCommands`、`audioNodeLeft/RightCommands`。
 * 官方组标题：左柄 `common.newContext`「添加上下文」/ 右柄 `common.generateNewContent`「引用该节点生成」。
 */
import { describe, expect, it } from 'vitest';
import {
  getConnectionMenuGroups,
  getConnectionMenuOptions,
  isBlankCardForCommands,
} from '../../src/hooks/useConnectionDropMenu';

function labels(nodeType: string, direction: 'input' | 'output'): string[] {
  return getConnectionMenuOptions(nodeType, direction).map((option) => option.label);
}

describe('连线拖放菜单 · 官方命令表', () => {
  it('组标题与拖拽侧对应官方 common.newContext / common.generateNewContent', () => {
    expect(getConnectionMenuGroups('ai-image', 'input')[0]?.title).toBe('添加上下文');
    expect(getConnectionMenuGroups('ai-image', 'output')[0]?.title).toBe('引用该节点生成');
  });

  it('文本节点：左 文本/图片，右 文本生成/图片生成/视频生成/音频/3D', () => {
    expect(labels('ai-text', 'input')).toEqual(['文本', '图片']);
    expect(labels('ai-text', 'output')).toEqual(['文本生成', '图片生成', '视频生成', '音频', '3D']);
  });

  it('图片节点：左 文本生成/图片处理，右 文本生成/图片生成/视频生成/音频生成/图片编辑器/3D', () => {
    expect(labels('ai-image', 'input')).toEqual(['文本生成', '图片处理']);
    expect(labels('ai-image', 'output')).toEqual([
      '文本生成',
      '图片生成',
      '视频生成',
      '音频生成',
      '图片编辑器',
      '3D',
    ]);
  });

  it('视频节点：左 文本生成/图片生成/音频生成，右 文本生成/音频生成/视频编辑/3D', () => {
    expect(labels('ai-video', 'input')).toEqual(['文本生成', '图片生成', '音频生成']);
    expect(labels('ai-video', 'output')).toEqual(['文本生成', '音频生成', '视频编辑', '3D']);
  });

  it('音频节点：左 文本，右 视频生成/数字人', () => {
    expect(labels('ai-audio', 'input')).toEqual(['文本']);
    expect(labels('ai-audio', 'output')).toEqual(['视频生成', '数字人']);
  });

  it('副标用官方 common.*GenerationDescription zh 原文', () => {
    const imageRight = getConnectionMenuOptions('ai-image', 'output');
    expect(imageRight.find((option) => option.label === '图片生成')?.description).toBe('宣传图、海报、封面');
    expect(imageRight.find((option) => option.label === '音频生成')?.description).toBe('配音、音效、背景音乐');
    expect(imageRight.find((option) => option.label === '文本生成')?.description).toBe('脚本、广告词、品牌文案');
    expect(imageRight.find((option) => option.label === '视频生成')?.description).toBe('宣传视频、动画、电影');
  });

  it('MTV 缺的三项按用户定的 B 方案落地：图片编辑器只建卡、视频编辑开视频编辑器、3D 映射 ai-director', () => {
    // 官方 `X3({title: e("nodes.imageEditor")})`：只建卡，编辑器靠双击打开 → 不自动开面板
    expect(
      getConnectionMenuOptions('ai-image', 'output').find((option) => option.label === '图片编辑器')?.action,
    ).toEqual({ kind: 'create-node', type: 'ai-image', title: '图片编辑器' });
    expect(
      getConnectionMenuOptions('ai-video', 'output').find((option) => option.label === '视频编辑')?.action,
    ).toEqual({ kind: 'open-video-editor' });
    // 3D → 映射到 MTV 的 ai-director（与「添加节点」面板里 3D 那条同口径）
    for (const nodeType of ['ai-text', 'ai-image', 'ai-video']) {
      const world = getConnectionMenuOptions(nodeType, 'output').find((option) => option.label === '3D');
      expect(world?.action).toEqual({ kind: 'create-node', type: 'ai-director' });
      expect(world?.description).toBe('生成 3D 场景与对象');
    }
  });

  it('官方 nZe 门禁：图片节点左柄只在空卡上弹菜单', () => {
    expect(getConnectionMenuOptions('ai-image', 'input', { blankCard: true }).map((o) => o.label)).toEqual([
      '文本生成',
      '图片处理',
    ]);
    expect(getConnectionMenuOptions('ai-image', 'input', { blankCard: false })).toEqual([]);
    // 门禁只作用于图片 / 素材库参考图，其它节点类型不受影响
    expect(getConnectionMenuOptions('ai-video', 'input', { blankCard: false }).map((o) => o.label)).toEqual([
      '文本生成',
      '图片生成',
      '音频生成',
    ]);
    expect(getConnectionMenuOptions('source-image', 'input', { blankCard: false })).toEqual([]);
    // 右柄不受门禁影响
    expect(getConnectionMenuOptions('ai-image', 'output', { blankCard: false }).length).toBe(6);
  });

  it('空卡判定看「卡里有没有媒体」', () => {
    expect(isBlankCardForCommands({ label: '空卡' })).toBe(true);
    expect(isBlankCardForCommands({ imageUrl: 'blob:x' })).toBe(false);
    expect(isBlankCardForCommands({ thumbnailUrl: 'blob:x' })).toBe(false);
    expect(isBlankCardForCommands({ filePath: 'D:/a.png' })).toBe(false);
    expect(isBlankCardForCommands(undefined)).toBe(true);
  });

  it('官方「图片生成」建图片卡并继承源参数（官方 Z3(fromNode)）', () => {
    const imageGeneration = getConnectionMenuOptions('ai-image', 'output').find(
      (option) => option.label === '图片生成',
    );
    expect(imageGeneration?.action).toMatchObject({
      kind: 'create-node',
      type: 'ai-image',
      title: '图片生成',
      inheritSourceParams: true,
    });
  });

  it('素材库参考图与官方图片节点同表', () => {
    expect(getConnectionMenuOptions('source-image', 'output')).toEqual(
      getConnectionMenuOptions('ai-image', 'output'),
    );
    expect(getConnectionMenuOptions('source-audio', 'input')).toEqual(
      getConnectionMenuOptions('ai-audio', 'input'),
    );
  });

  it('MTV 独有节点类型不塞进官方条目集，各自沿用旧候选表', () => {
    expect(labels('ai-panorama', 'output')).toEqual(['生成文本', '生成图片']);
    expect(getConnectionMenuOptions('ai-shotlist', 'output')).toEqual([]);
  });
});
