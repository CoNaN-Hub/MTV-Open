/**
 * brainstormService —— 官方 `brainstorm.md` 本地落点的守卫
 *
 * 官方依据：`artifactPanel.*`（`emptyTitle` 暂无内容 / `emptyHint` 开始头脑风暴…）+
 * 宿主 `Hoe` props（`markdown` / `workspaceView` / 分段编辑 / Update / Add to Canvas / Discuss）。
 * 本地实现：文档按**会话**存 IndexedDB（无服务端、无联网），按 `## ` 分小节。
 */
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  vi.resetModules();
});

async function loadService() {
  return import('../../../src/services/chat/brainstormService');
}

describe('brainstorm 文档（官方 brainstorm.md 的本地落点）', () => {
  it('按会话读写与清除', async () => {
    const { readBrainstormDoc, writeBrainstormDoc, clearBrainstormDoc, isBrainstormEmpty } =
      await loadService();

    expect(await readBrainstormDoc('conv-1')).toBe('');
    expect(isBrainstormEmpty('')).toBe(true);

    await writeBrainstormDoc('conv-1', 'project-1', '# 主题\n\n## 分镜\n\n三镜头');
    expect(await readBrainstormDoc('conv-1')).toContain('三镜头');
    expect(isBrainstormEmpty(await readBrainstormDoc('conv-1'))).toBe(false);
    /* 会话之间互不影响（官方 artifact 也是会话级） */
    expect(await readBrainstormDoc('conv-2')).toBe('');

    await clearBrainstormDoc('conv-1');
    expect(await readBrainstormDoc('conv-1')).toBe('');
  });

  it('按 `## ` 切分小节并标记空小节', async () => {
    const { parseBrainstormSections } = await loadService();
    const sections = parseBrainstormSections([
      '# 主题',
      '',
      '开场构想',
      '',
      '## 分镜',
      '',
      '三镜头',
      '',
      '## 待补',
      '',
    ].join('\n'));

    expect(sections.map((section) => section.title)).toEqual(['未命名小节', '分镜', '待补']);
    expect(sections[0].body).toBe('# 主题\n\n开场构想');
    expect(sections[1].body).toBe('三镜头');
    expect(sections[2].isEmpty).toBe(true);
    expect(new Set(sections.map((section) => section.id)).size).toBe(sections.length);
  });

  it('分段编辑只替换目标小节正文', async () => {
    const { parseBrainstormSections, replaceBrainstormSection } = await loadService();
    const markdown = '# 主题\n\n## 分镜\n\n旧内容\n\n## 待补\n\n旧待补\n';
    const target = parseBrainstormSections(markdown).find((section) => section.title === '分镜')!;

    const next = replaceBrainstormSection(markdown, target.id, '新内容');
    expect(next).toContain('新内容');
    expect(next).not.toContain('旧内容');
    /* 其它小节原样保留 */
    expect(next).toContain('## 待补');
    expect(next).toContain('旧待补');
  });

  it('官方「Update」提示词逐字存在（EN 与 zh 同义）', async () => {
    const { BRAINSTORM_UPDATE_PROMPT_EN, BRAINSTORM_UPDATE_PROMPT_ZH } = await loadService();
    expect(BRAINSTORM_UPDATE_PROMPT_EN).toContain('re-summarize and update the entire brainstorm.md document');
    expect(BRAINSTORM_UPDATE_PROMPT_EN).toContain('Only update the brainstorm.md document');
    expect(BRAINSTORM_UPDATE_PROMPT_ZH).toContain('brainstorm.md');
  });
});
