/**
 * 上游引用缩略图「点击 → 插入提示词」的回归（用户 2026：
 *   「点击缩略图窗口 官方会自动让参考图进入输入区，MTV 现在无法点击 也无法进去」）。
 *
 * 官方源码实测（`vendor-pkg-canvas-DKuSpVZP.js`，节点面板传给条组件 `Tx` 的 `onMediaClick`）：
 * ```js
 * Xe = useCallback(ot => {
 *   if (x) return;
 *   const pt = ue.find(it => it.id === ot.nodeId && it.type === ot.mediaType);
 *   pt && k.current?.insertMention?.(pt);      // ★ 插进提示词输入框
 * });
 * ```
 * 条目自身（`Rw`）：`onClick:y?void 0:c` + `c&&"cursor-pointer"`。
 *
 * ⚠️ MTV 组件头注释原来写的是「官方条目点击 = 打开媒体查看器/历史」——**是错的**，
 *    那次误判导致这条链路一直没接（`insertMentionAtCursor` 只在 `@` 菜单里用过）。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL('../../src/' + p, import.meta.url), 'utf8');

describe('上游引用缩略图点击 = 插入提示词 mention', () => {
  it('条目绑了点击（且只在有处理器时才可点）', () => {
    const source = read('components/nodes/shared/UpstreamReferenceChips.tsx');
    expect(source).toContain('onInsertMention?: (reference: { nodeId: string; label: string }) => void;');
    expect(source).toContain("className={`prompt-ref-chip${onInsertMention ? ' is-clickable' : ''}`}");
    expect(source).toContain('onClick={onInsertMention');
    expect(source).toContain('onInsertMention({ nodeId: item.nodeId, label: item.title || title })');
    /* 旧注释里那句错误结论必须已被纠正 */
    expect(source).toContain('这条旧注释是错的');
    expect(source).not.toContain('官方条目点击 = `onMediaClick`（开媒体查看器 / 历史）；MTV 图片/视频查看器尚未接');
  });

  it('CSS 给了官方那条 cursor-pointer', () => {
    const css = read('styles/prompt.css');
    const rule = css.slice(css.indexOf('.prompt-ref-chip.is-clickable {'));
    expect(rule.slice(0, rule.indexOf('}'))).toContain('cursor: pointer');
  });

  it('PromptPanel 透出 / AINodeDialog 接到编辑器 API', () => {
    expect(read('components/nodes/shared/PromptPanel.tsx'))
      .toContain('<UpstreamReferenceChips nodeId={nodeId} onInsertMention={onInsertReferenceMention} />');
    const dialog = read('components/nodes/AINodeDialog.tsx');
    expect(dialog).toContain('editorApiRef.current?.insertMentionAtCursor(reference.nodeId, reference.label);');
  });
});
