/**
 * 「样机」节点的**菜单入口**回归 —— 用户 2026：「是我要的，保留并补全入口」。
 *
 * ══ 为什么有这个测试文件 ══
 * 这个入口曾经被**一次打歪的多文件补丁**弄丢过：那次改动在 `nodePickerCatalog.tsx` 里
 * 拿「样机」条目**替换掉了 `type: 'ai-video',`**，把「视频」从添加节点菜单里整个删掉了；
 * 同一批改动还删掉了 `nodePickerActions.ts` 里的 `const isCompare = type === 'compare';`
 * 却保留了它的使用（`tsc` 报 `TS2304`）。
 *
 * ⇒ 所以本文件钉的不只是「样机在不在」，还有**「视频和对比不许被吃掉」**这两条防回归。
 *
 * ══ 依据 ══
 * · 「样机」是 MTV **新增**节点（`src/types/index.ts` 的 `NodeType` 有 `'mockup'`、
 *   `NODE_TYPE_CONFIG['mockup'].label = '样机'`、`src/components/Canvas.tsx` 映射 `MockupNode`）,
 *   **不是**官方 TapNow「添加节点」面板里的行 —— 与上面那条「对比」同性质。
 * · 图标 = **用户 2026 上传**的 `src/assets/official-icons/mockup.svg`（原样落库，
 *   不是官方 picker 资产；官方 `picker/` 那 10 支图标已被其它行占用）。
 * · 菜单行的**顺序依据**：用户/实现要求把它放在「对比」正下方、「视频」上方。
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const catalog = readFileSync(
  new URL('../../src/components/sidebar/nodePickerCatalog.tsx', import.meta.url),
  'utf8',
);
const actions = readFileSync(
  new URL('../../src/components/sidebar/nodePickerActions.ts', import.meta.url),
  'utf8',
);
const officialIcon = readFileSync(
  new URL('../../src/components/sidebar/OfficialIcon.tsx', import.meta.url),
  'utf8',
);
const iconAsset = readFileSync(
  new URL('../../src/assets/official-icons/mockup.svg', import.meta.url),
);
const connectionMenu = readFileSync(
  new URL('../../src/hooks/useConnectionDropMenu.ts', import.meta.url),
  'utf8',
);

describe('「样机」节点菜单入口', () => {
  it('添加节点菜单里有样机这一行，且是 mockup 类型', () => {
    expect(catalog).toContain("type: 'mockup',");
    expect(catalog).toContain("label: '样机',");
    expect(catalog).toContain('<OfficialIcon name="mockup" size={17} />');
  });

  it('顺序 = 「对比」→「样机」→「视频」', () => {
    const compare = catalog.indexOf("label: '对比',");
    const mockup = catalog.indexOf("label: '样机',");
    const video = catalog.indexOf("label: '视频',");
    expect(compare).toBeGreaterThan(-1);
    expect(mockup).toBeGreaterThan(-1);
    expect(video).toBeGreaterThan(-1);
    expect(compare).toBeLessThan(mockup);
    expect(mockup).toBeLessThan(video);
  });

  /* ══ 防回归：那次打歪的补丁把这两条吃掉了 ══ */
  it('「视频」条目仍在（曾被一次坏补丁整体吃掉）', () => {
    expect(catalog).toContain("type: 'ai-video',");
    expect(catalog).toContain("label: '视频',");
    expect(catalog).toContain('<OfficialIcon name="pick-video" size={17} />');
  });

  it('「对比」的 isCompare 声明仍在，且尺寸分支没被删', () => {
    expect(actions).toContain("const isCompare = type === 'compare';");
    /* 声明之后必须真的被用到 —— 只删声明留下使用就是 TS2304 */
    expect(actions).toContain('isCompare ? NODE_BASE_SIZE.width');
    expect(actions).toContain('isCompare ? NODE_BASE_SIZE.height');
  });

  it('生成组的 7 行一个都没少', () => {
    for (const label of ['文本', '图片', '对比', '样机', '视频', '音频', '3D']) {
      expect(catalog, `缺少菜单行「${label}」`).toContain(`label: '${label}',`);
    }
  });

  it('图标已注册进 OfficialIcon 表，且注释标明是用户提供、非官方资产', () => {
    expect(officialIcon).toContain("import mockup from '../../assets/official-icons/mockup.svg?raw';");
    expect(officialIcon).toContain('mockup,');
    expect(officialIcon).toMatch(/用户提供|用户 2026 上传/);
  });

  it('图标资产逐字落库：24×24 viewBox + currentColor 描边（与 picker 那套同规格）', () => {
    const svg = iconAsset.toString('utf8');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('fill="none"');
    /* 用户上传的原件哈希（sha256）—— 用于确认落库的是同一份字节，没被改写 */
    expect(createHash('sha256').update(iconAsset).digest('hex')).toBe(
      '452484b84a8588b1049614a718449c8cd92fffea38c2cb8838f99d99a41c97f8',
    );
  });

  it('菜单行文字与卡片默认标题分开（与「对比」同一口径）', () => {
    /* 菜单行 = 「样机」 */
    expect(catalog).toContain("label: '样机',");
    /* `buildNodeData` 建卡时写卡片默认标题 */
    expect(actions).toContain("const isMockup = type === 'mockup';");
    expect(actions).toContain("nodeData.label = '样机';");
  });
});

describe('「样机」连接菜单入口（用户 2026：「连接菜单加上」）', () => {
  it('进了多选生成菜单 `getSelectionMenuGroups`，且与「对比」同口径', () => {
    expect(connectionMenu).toContain(
      "createNode('nodes.mockupNode', '样机', D_MOCKUP, 'mockup', 'mockup'),",
    );
    expect(connectionMenu).toContain("const D_MOCKUP = '将图片呈现在可旋转的设备样机中';");
  });

  it('位置 = 「对比」正下方、「3D」上方', () => {
    const compare = connectionMenu.indexOf("createNode('nodes.compareNode', '对比'");
    const mockup = connectionMenu.indexOf("createNode('nodes.mockupNode', '样机'");
    /* ⚠️ `WORLD_COMMAND,` 在 `TEXT_RIGHT` 里也出现过一次（更靠前）⇒ 必须从 mockup 之后开始找，
          否则拿到的第一个命中是 TEXT_RIGHT 那一份，断言会假失败。 */
    const world = connectionMenu.indexOf('WORLD_COMMAND,', mockup);
    expect(compare).toBeGreaterThan(-1);
    expect(mockup).toBeGreaterThan(-1);
    expect(world).toBeGreaterThan(-1);
    expect(compare).toBeLessThan(mockup);
    expect(mockup).toBeLessThan(world);
  });

  /* ══ 防回归：本文件开头立的规矩 —— MTV 独有节点类型不许进官方逐条照抄的命令表 ══ */
  it('没有被塞进 Handle 拖拽的官方命令表（IMAGE_LEFT / IMAGE_RIGHT 等）', () => {
    /* 按 `const` 边界取块（不靠固定行号，也不假设两个 const 的先后顺序） */
    const block = (name: string) => {
      const at = connectionMenu.indexOf(`const ${name}`);
      if (at < 0) return '';
      const next = connectionMenu.indexOf('\nconst ', at + 1);
      return connectionMenu.slice(at, next < 0 ? undefined : next);
    };

    /* 先证明取块非空（否则下面的 not.toContain 是假通过） */
    const imageRight = block('IMAGE_RIGHT');
    const imageLeft = block('IMAGE_LEFT');
    const textRight = block('TEXT_RIGHT');
    expect(imageRight.length).toBeGreaterThan(100);
    expect(imageLeft.length).toBeGreaterThan(100);
    expect(textRight.length).toBeGreaterThan(100);
    expect(imageRight).toContain('imageGeneration');
    expect(imageLeft).toContain('textGenerationAndEdit');
    expect(textRight).toContain("'视频生成'");

    /* 「对比」当初就是从 IMAGE_RIGHT 里挪走的；「样机」也不许进去 */
    expect(imageRight).not.toContain('mockup');
    expect(imageLeft).not.toContain('mockup');
    expect(textRight).not.toContain('mockup');
  });
});
