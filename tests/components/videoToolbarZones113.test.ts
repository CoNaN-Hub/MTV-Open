/**
 * §113 视频工具栏「三段分区 + 官方 pin 组 + 幂等迁移」回归。
 *
 * 官方依据（`D:\DEEPSEEK\live-assets-r100\vendor-pkg-canvas-DuoOicPr.js`）：
 *   · @1969928 区逐字 `U=v0(e),B=Fe(Hp),G=a.useMemo(()=>[O,...U?[[U]]:[],F],[O,U,F])`
 *     ⇒ 渲染顺序 = **左组 → pin 组 → 右组**。
 *   · @838584 `v0` 逐字 = `…{key:"pin",buttonType:"unwrapped",node:s.jsx(eLe,{pins:o,onToggle:i=>r(e,i)})}`
 *     ⇒ pin 只有 3 个字段，无 tooltip/disabled/invisible/lockedTooltip；门 = `!t || !n ? null`。
 *   · 组间分隔线 = `w-px h-[18px] bg-primary-border`（真机 CDP 9222 实测 2 条）。
 */
import { describe, expect, it } from 'vitest';

const load = () => import('../../src/components/nodes/shared/toolbar/toolbarRegistry');

describe('§113 视频工具栏三段分区（官方 [O, pin, F]）', () => {
  it('默认布局 = Primary | Pin | Secondary，版本 5', async () => {
    const { DEFAULT_VIDEO_LAYOUT } = await load();
    expect(DEFAULT_VIDEO_LAYOUT.version).toBe(5);
    expect(DEFAULT_VIDEO_LAYOUT.zones.map((zone) => zone.name)).toEqual(['Primary', 'Pin', 'Secondary']);
    expect(DEFAULT_VIDEO_LAYOUT.zones.map((zone) => zone.buttonKeys)).toEqual([
      ['upscale', 'video_frame_capture', 'more'],
      ['pin'],
      ['saveToLibrary', 'download', 'scale'],
    ]);
  });

  it('v4 旧默认（单 zone `常用`）⇒ 整体换新为三段；再跑一遍幂等', async () => {
    const { migrateToolbarLayout } = await load();
    const legacyV4 = {
      version: 4,
      zones: [{
        id: 'zone-0',
        name: '常用',
        buttonKeys: ['upscale', 'video_frame_capture', 'more', 'saveToLibrary', 'download', 'scale'],
      }],
    };
    const once = migrateToolbarLayout('ai-video', legacyV4);
    expect(once.version).toBe(5);
    expect(once.zones.map((zone) => zone.name)).toEqual(['Primary', 'Pin', 'Secondary']);
    /* 幂等：第二次跑必须**逐字相等**（不会长出第二个 Pin 组、不会重复补键） */
    const twice = migrateToolbarLayout('ai-video', once);
    expect(twice).toEqual(once);
  });

  it('用户动过的 v4 布局 ⇒ 只增不删：原分区/顺序原样保留，pin 独立一组插在「含 more 的那组」之后；幂等', async () => {
    const { migrateToolbarLayout } = await load();
    const custom = {
      version: 4,
      zones: [
        { id: 'z0', name: '我的组', buttonKeys: ['download', 'upscale', 'more'] },
        { id: 'z1', name: '副组', buttonKeys: ['scale', 'copyFile'] },
      ],
    };
    const once = migrateToolbarLayout('ai-video', custom);
    expect(once.zones.map((zone) => zone.name)).toEqual(['我的组', 'Pin', '副组']);
    /* 一个键都不许丢、顺序不许乱 */
    expect(once.zones[0].buttonKeys).toEqual(['download', 'upscale', 'more']);
    expect(once.zones[1].buttonKeys).toEqual(['pin']);
    expect(once.zones[2].buttonKeys).toEqual(['scale', 'copyFile']);
    const twice = migrateToolbarLayout('ai-video', once);
    expect(twice).toEqual(once);
  });

  it('没有 `more` 的用户布局 ⇒ pin 组追加到末尾（仍独立成组，不漏键）', async () => {
    const { migrateToolbarLayout } = await load();
    const custom = { version: 4, zones: [{ id: 'z0', name: 'x', buttonKeys: ['upscale', 'download'] }] };
    const once = migrateToolbarLayout('ai-video', custom);
    expect(once.zones.map((zone) => zone.name)).toEqual(['x', 'Pin']);
    expect(once.zones[0].buttonKeys).toEqual(['upscale', 'download']);
  });

  it('只影响视频：文本 / 图像 / 音频 / 全景的默认布局跑迁移后**逐字不变**', async () => {
    const {
      DEFAULT_TEXT_LAYOUT,
      DEFAULT_IMAGE_LAYOUT,
      DEFAULT_AUDIO_LAYOUT,
      DEFAULT_PANORAMA_LAYOUT,
      migrateToolbarLayout,
    } = await load();
    for (const [type, layout] of [
      ['ai-text', DEFAULT_TEXT_LAYOUT],
      ['ai-image', DEFAULT_IMAGE_LAYOUT],
      ['ai-audio', DEFAULT_AUDIO_LAYOUT],
      ['ai-panorama', DEFAULT_PANORAMA_LAYOUT],
    ] as const) {
      expect(migrateToolbarLayout(type, layout)).toEqual(layout);
      /* 再确认它自己那份默认布局里没有被塞进视频的 Pin 组（图像本来就有一组 Pin，是它自己的） */
      const pinZones = layout.zones.filter((zone) => zone.buttonKeys.includes('pin'));
      expect(pinZones.length).toBe(type === 'ai-image' || type === 'ai-text' ? 1 : 0);
    }
  });
});
