import { describe, expect, it } from 'vitest';
import {
  getDefaultLayout,
  getButtonRegistry,
  getHiddenDefaultToolbarButtons,
  getPluginToolbarButtonRegistry,
  migrateToolbarLayout,
} from '../../src/components/nodes/shared/toolbar/toolbarRegistry';
import type { InstalledPlugin } from '../../src/types/plugin';

describe('toolbar layout migration', () => {
  it('registers Camera Studio and history without the superseded angle tool', () => {
    const keys = getButtonRegistry('ai-image').map((button) => button.key);
    expect(keys).toContain('cameraStudio');
    expect(keys).toContain('history');
    expect(keys.indexOf('copyFile')).toBeLessThan(keys.indexOf('history'));
    expect(keys).not.toContain('multiAngle');

    /* ★ v9：主行严格照官方源码（官方左组 4 个 + ⋯ ‖ 右组 3 个）；MTV 只有 4 个能对上官方位置 */
    const defaultZones = getDefaultLayout('ai-image').zones;
    expect(defaultZones.map((zone) => ({ name: zone.name, keys: zone.buttonKeys }))).toEqual([
      { name: 'Primary', keys: ['crop', 'cameraStudio', 'repaint', 'relight', 'more'] },
      { name: 'Pin', keys: ['pin'] },
      { name: 'Secondary', keys: ['saveToLibrary', 'download', 'scale'] },
    ]);
    /* ★ 「⋯ 浏览全部」里的顺序 = **官方 `menuItems` 的顺序**（`ptt` @3083219）：
       outpainting(扩图) → erase(擦除) → annotation(标注) → enhance(增强) → resizePixels(调整像素，MTV 未实现)
       → cutout(抠图) → quickSplit(快速切分) → authenticityCheck(Seedance 校验，MTV 未实现)
       ⇒ MTV 能对上的 6 项按官方序排在前，MTV 自有项排在后（`customGrid` 紧跟 `multiGrid`，同属宫格）。 */
    expect(
      getHiddenDefaultToolbarButtons(
        getButtonRegistry('ai-image'),
        new Set(defaultZones.flatMap((zone) => zone.buttonKeys)),
      ).map((button) => button.key),
    ).toEqual([
      'expand', 'matting', 'annotate', 'upscale', 'subjectMatting', 'multiGrid',
      'customGrid', 'compose', 'upload', 'reversePrompt', 'copyFile', 'history',
      'roundtrip',
    ]);
  });

  it('replaces the old angle tool with Camera Studio in v1 image layouts', () => {
    const migrated = migrateToolbarLayout('ai-image', {
      version: 1,
      zones: [
        { id: 'custom', name: '自定义', buttonKeys: ['crop', 'multiAngle', 'upload'] },
      ],
    });

    expect(migrated).toEqual({
      version: 12,
      zones: [
        { id: 'custom', name: '自定义', buttonKeys: ['crop', 'cameraStudio', 'upload', 'history', 'relight', 'more'] },
      ],
    });
  });

  it('removes the old angle tool from current Camera Studio layouts', () => {
    expect(migrateToolbarLayout('ai-image', {
      version: 2,
      zones: [
        { id: 'custom', name: '自定义', buttonKeys: ['multiAngle', 'cameraStudio', 'upload'] },
      ],
    })).toEqual({
      version: 12,
      zones: [
        { id: 'custom', name: '自定义', buttonKeys: ['cameraStudio', 'upload', 'history', 'relight', 'more'] },
      ],
    });
  });

  it('keeps custom button zoning while advancing the image layout version', () => {
    const current = { version: 5, zones: [{ id: 'custom', name: '自定义', buttonKeys: ['crop', 'history'] }] };
    expect(migrateToolbarLayout('ai-image', current)).toEqual({
      version: 12,
      zones: [{ id: 'custom', name: '自定义', buttonKeys: ['crop', 'history', 'relight', 'more'] }],
    });
    /* §113：视频工具栏目标版本 4 → 5（拆三段 + 补官方 `pin` 组）。
       这条 v1 自定义布局里没有 `more` ⇒ 按 `migrateVideoLayoutToV5` 的规则，
       `pin` 作为**独立一组**追加到末尾；原分区的键/顺序一个不丢。 */
    expect(migrateToolbarLayout('ai-video', { ...current, version: 1 })).toEqual({
      version: 5,
      zones: [
        { id: 'custom', name: '自定义', buttonKeys: ['crop', 'history', 'upscale', 'download'] },
        { id: 'zone-video-pin', name: 'Pin', buttonKeys: ['pin'] },
      ],
    });
  });

  it('adds history to existing v3 image layouts once', () => {
    expect(migrateToolbarLayout('ai-image', {
      version: 3,
      zones: [{ id: 'secondary', name: 'Secondary', buttonKeys: ['crop'] }],
    })).toEqual({
      version: 12,
      zones: [{ id: 'secondary', name: 'Secondary', buttonKeys: ['crop', 'history', 'relight', 'more'] }],
    });
  });

  it('swaps the old v4 default fullscreen and history positions', () => {
    expect(migrateToolbarLayout('ai-image', {
      version: 4,
      zones: [{
        id: 'secondary',
        name: 'Secondary',
        buttonKeys: ['upload', 'copyFile', 'history', 'fullscreen'],
      }],
    })).toEqual({
      version: 12,
      zones: [{
        id: 'secondary',
        name: 'Secondary',
        buttonKeys: ['upload', 'copyFile', 'scale', 'history', 'relight', 'more'],
      }],
    });
  });

  it('places copy, history, and fullscreen after the image toolbar divider', () => {
    /* ★ v9：左组（裁剪/小逻摄影棚/查看提示词/⋯）+ 官方那条竖分隔线 + 右组（全屏 = 官方 scale 位） */
    expect(getDefaultLayout('ai-image')).toEqual({
      version: 12,
      zones: [
        { id: 'zone-0', name: 'Primary', buttonKeys: ['crop', 'cameraStudio', 'repaint', 'relight', 'more'] },
        { id: 'zone-1', name: 'Pin', buttonKeys: ['pin'] },
        { id: 'zone-2', name: 'Secondary', buttonKeys: ['saveToLibrary', 'download', 'scale'] },
      ],
    });
  });

  it('adds More once to legacy layouts and preserves an intentional current-version removal', () => {
    /* ★ 文本工具栏 v3/v4/v5：主行按官方 `not` 收敛 ——
       v3：自定义布局**只增不删**地补入 `pin`（插在 `copy` 前）与 `saveToLibrary`（插在 `copy` 后），再补 `more`；
       v4：补上官方**第 1 组**「背景颜色」（`color-picker`，官方是独立分组 ⇒ 这里也开一个独立分区放最前）；
       v5：把 MTV 自有项（`clearEmptyLines` / `showPrompt`）**从主行挪进 ⋯**，并确保 ⋯ 键存在。*/
    const migrated = migrateToolbarLayout('ai-text', {
      version: 1,
      zones: [{ id: 'primary', name: '常用', buttonKeys: ['copy', 'clearEmptyLines', 'showPrompt'] }],
    });
    expect(migrated).toEqual({
      version: 5,
      zones: [
        { id: 'zone-text-color', name: 'Color', buttonKeys: ['color-picker'] },
        { id: 'primary', name: '常用', buttonKeys: ['pin', 'copy', 'saveToLibrary', 'more'] },
      ],
    });

    /* 已是当前版本 ⇒ 用户主动移除的东西不再被补回 */
    const hiddenMore = {
      version: 5,
      zones: [{ id: 'primary', name: '常用', buttonKeys: ['copy'] }],
    };
    expect(migrateToolbarLayout('ai-text', hiddenMore)).toBe(hiddenMore);

    /* 文本默认布局（v5）= 官方 `[p, f]` 两组（背景颜色 丨 pin/复制全部/保存到素材库/全屏）+ MTV 的 ⋯ */
    expect(getDefaultLayout('ai-text')).toEqual({
      version: 5,
      zones: [
        { id: 'zone-0', name: 'Color', buttonKeys: ['color-picker'] },
        { id: 'zone-1', name: 'Primary', buttonKeys: ['pin', 'copy', 'saveToLibrary', 'fullscreen', 'more'] },
      ],
    });
  });

  it('collects only hidden built-in buttons inside More', () => {
    const registry = getButtonRegistry('ai-text');
    const hidden = getHiddenDefaultToolbarButtons(registry, new Set(['copy', 'more']));
    expect(hidden.map((button) => button.key)).toEqual([
      'color-picker', 'pin', 'saveToLibrary', 'fullscreen', 'clearEmptyLines', 'showPrompt',
    ]);
  });

  it('registers enabled plugin buttons without adding them to the default layout', () => {
    const plugin: InstalledPlugin = {
      id: 'example.plugin',
      source: 'main.js',
      enabled: true,
      installedAt: 1,
      updatedAt: 1,
      manifest: {
        apiVersion: 1,
        runtime: 'javascript',
        id: 'example.plugin',
        name: '示例插件',
        version: '1.0.0',
        category: 'utility',
        entry: 'main.js',
        permissions: ['node.read'],
        contributes: {
          nodeTools: [{
            id: 'uppercase',
            title: '输出转大写',
            placements: ['node-toolbar'],
            icon: 'mdi:format-letter-case-upper',
            dialog: { fields: [] },
            nodeTypes: ['ai-text'],
            inputFields: ['output'],
            output: { mode: 'update-current', fields: ['output'] },
          }],
        },
      },
    };

    const pluginButtons = getPluginToolbarButtonRegistry([plugin], 'ai-text');
    expect(pluginButtons).toEqual([expect.objectContaining({
      key: 'example.plugin:uppercase',
      label: '输出转大写 · 示例插件',
      defaultZone: '更多',
    })]);
    expect(getDefaultLayout('ai-text').zones.flatMap((zone) => zone.buttonKeys))
      .not.toContain('example.plugin:uppercase');

    const registry = [...getButtonRegistry('ai-text'), ...pluginButtons];
    const hidden = getHiddenDefaultToolbarButtons(
      registry,
      new Set(getDefaultLayout('ai-text').zones.flatMap((zone) => zone.buttonKeys)),
    );
    expect(hidden.map((button) => button.key)).toContain('example.plugin:uppercase');
  });

  it('adds the local speech-to-text button to legacy audio layouts', () => {
    const migrated = migrateToolbarLayout('ai-audio', {
      version: 2,
      zones: [{ id: 'primary', name: '常用', buttonKeys: ['togglePlay', 'transcribe', 'more'] }],
    });
    expect(migrated).toEqual({
      version: 3,
      zones: [{
        id: 'primary',
        name: '常用',
        buttonKeys: ['togglePlay', 'speechToText', 'transcribe', 'more'],
      }],
    });
  });

  it('does not re-add a speech-to-text button the user removed', () => {
    const migrated = migrateToolbarLayout('ai-audio', {
      version: 3,
      zones: [{ id: 'primary', name: '常用', buttonKeys: ['togglePlay', 'more'] }],
    });
    expect(migrated.version).toBe(3);
    expect(migrated.zones[0].buttonKeys).not.toContain('speechToText');
  });

  it('places speech-to-text right after play/pause in the default audio layout', () => {
    expect(getDefaultLayout('ai-audio')).toEqual({
      version: 3,
      zones: [{
        id: 'zone-0',
        name: '常用',
        buttonKeys: [
          'togglePlay', 'speechToText', 'transcribe', 'copyFile', 'upload', 'fullscreen', 'more',
        ],
      }],
    });
  });

  it('registers More in every editable node toolbar', () => {
    for (const nodeType of ['ai-text', 'ai-image', 'ai-video', 'ai-audio', 'ai-panorama']) {
      expect(getButtonRegistry(nodeType).map((button) => button.key)).toContain('more');
    }
  });

  it('updates the old default image layout without changing custom layouts', () => {
    const migrated = migrateToolbarLayout('ai-image', {
      version: 5,
      zones: [
        {
          id: 'zone-0',
          name: 'Primary',
          buttonKeys: ['matting', 'expand', 'multiGrid', 'cameraStudio', 'repaint', 'upscale', 'subjectMatting'],
        },
        {
          id: 'zone-1',
          name: 'Secondary',
          buttonKeys: ['annotate', 'crop', 'compose', 'upload', 'copyFile', 'fullscreen', 'history'],
        },
      ],
    });

    expect(migrated).toEqual(getDefaultLayout('ai-image'));
  });

  it('updates the previous v6 default image layout', () => {
    expect(migrateToolbarLayout('ai-image', {
      version: 6,
      zones: [
        {
          id: 'zone-0',
          name: 'Primary',
          buttonKeys: [
            'matting', 'expand', 'multiGrid', 'cameraStudio', 'repaint', 'upscale',
            'subjectMatting', 'annotate', 'crop', 'compose', 'upload', 'copyFile',
          ],
        },
        {
          id: 'zone-1',
          name: 'Secondary',
          buttonKeys: ['fullscreen', 'history'],
        },
      ],
    })).toEqual(getDefaultLayout('ai-image'));
  });

  /* §97 图像工具栏键名 = 官方逐字 `scale`（`vendor-pkg-canvas-CvbAwZyy.js` @1710782）。
     该处逐字：`{node:s.jsx(Mx,{size:20}),buttonType:"obsidian",handle:()=>{…},tooltip:n("common.fullScreen"),
     key:"scale",disabled:t,invisible:t,lockedTooltip:c("scale")}`；埋点 `"image"` / `"full_screen"`，
     事件带 `images_count` 与 `is_variants`。回归目标：老布局改名 / 幂等 / 不串味到文本·全景·音频三张表。 */
  it('renames the persisted image fullscreen key to the official scale key (idempotent, image only)', () => {
    const imageKeys = getButtonRegistry('ai-image').map((button) => button.key);
    expect(imageKeys).toContain('scale');
    expect(imageKeys).not.toContain('fullscreen');
    expect(getDefaultLayout('ai-image').version).toBe(12);
    const defaultZones = getDefaultLayout('ai-image').zones;
    expect(defaultZones[defaultZones.length - 1]).toEqual({
      id: 'zone-2', name: 'Secondary', buttonKeys: ['saveToLibrary', 'download', 'scale'],
    });

    /* 老用户持久化布局（v11）里的 `fullscreen` 读入即改名；分区/排序/删减原样保留 */
    const legacy = {
      version: 11,
      zones: [
        { id: 'zone-0', name: 'Primary', buttonKeys: ['crop', 'more'] },
        { id: 'zone-1', name: 'Secondary', buttonKeys: ['saveToLibrary', 'download', 'fullscreen'] },
      ],
    };
    const migrated = migrateToolbarLayout('ai-image', legacy);
    expect(migrated.version).toBe(12);
    expect(migrated.zones).toEqual([
      { id: 'zone-0', name: 'Primary', buttonKeys: ['crop', 'more'] },
      { id: 'zone-1', name: 'Secondary', buttonKeys: ['saveToLibrary', 'download', 'scale'] },
    ]);

    /* 幂等：同键再喂一遍 —— 逐字相同、不产生第二颗按钮、且直接返回同一对象 */
    const again = migrateToolbarLayout('ai-image', migrated);
    expect(again).toEqual(migrated);
    expect(again).toBe(migrated);

    /* 旧键与新键同时存在 ⇒ 丢旧键，绝不出现两颗同键按钮 */
    expect(migrateToolbarLayout('ai-image', {
      version: 11,
      zones: [{ id: 'z', name: 'Secondary', buttonKeys: ['scale', 'fullscreen', 'more'] }],
    }).zones[0].buttonKeys).toEqual(['scale', 'more']);

    /* ⚠️ 图像以外的三张表里 `fullscreen` 是它们**自己**的键 —— 必须原样保留，且不得被改成 `scale` */
    for (const nodeType of ['ai-text', 'ai-panorama', 'ai-audio']) {
      const keys = getButtonRegistry(nodeType).map((button) => button.key);
      expect(keys).toContain('fullscreen');
      expect(keys).not.toContain('scale');
      const untouched = { version: 999, zones: [{ id: 'z', name: '常用', buttonKeys: ['fullscreen', 'more'] }] };
      expect(migrateToolbarLayout(nodeType, untouched)).toBe(untouched);
    }
  });
});
