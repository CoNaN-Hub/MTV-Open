// @vitest-environment jsdom
/**
 * §129 官方 `ha`（视频输入栏 headerSlot）的 **`Se`（首尾帧）分支** 回归。
 *
 * 官方 `vendor-pkg-canvas-Dp0xADoD.js`：
 *  · `ha` 定义 @2057769 起；三分支 `ji ?（全能参考：图/音槽）: Se ?（首尾帧行）: null`，
 *    `Se = ge === Gu.FRAMES`（= 生成方式「首尾帧」）。
 *  · 首尾帧行 @2060400–2063200 逐字：
 *      <div className="flex items-center gap-1">
 *        首帧槽：有帧 ⇒ 38×38 缩略图 + hover ✕；无帧 ⇒
 *          <button className="size-[38px] flex items-center justify-center rounded-[10px] shrink-0 transition-all
 *                             focus:outline-none bg-white/[0.08] hover:bg-white/[0.12]" onClick={()=>nt("first")}>
 *            {Qd size-4}</button>（tooltip `common.firstFrame`）
 *        ⇄：<button type="button" onClick={On} disabled={at.length<2||me}
 *                   className="flex items-center justify-center shrink-0 rounded-sm p-1 transition-colors
 *                              [hover:bg-white/[0.12]]">{ige size-4 text-white/40}</button>
 *        尾帧槽：同首帧（tooltip `common.lastFrame`，onClick `nt("last")`）
 *      </div>
 *  · 三颗图标的 **outerHTML 全部取自官方 App 真机**（CDP 读 DOM，非推断）：
 *      `Qd`  = `<svg xmlns=… width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
 *                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
 *                 class="lucide lucide-plus size-4 transition-colors text-white/60"><path d="M5 12h14"/>
 *                 <path d="M12 5v14"/></svg>`  ← **lucide `plus`**
 *      `ige` = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="size-4 text-white/40">
 *                 <path d="M10.5 2.84998L13 5.34998H3M5.5 13.1L3 10.6L13 10.6" stroke="currentColor"
 *                       stroke-linecap="round" stroke-linejoin="round"/></svg>`
 *      `KR`  = 官方自绘 48 viewBox（`class="size-4 transition-colors text-white/60 hover:text-foreground"`），
 *              MTV 侧等价物 = `.prompt-magic-btn` 里的 `OfficialIcon name="focus-edit"`（已在位）。
 *  · 与参数面板的「参考帧/参考角色」两组**分开**：那两组按用户早前裁决保持关闭。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PANEL = readFileSync('src/components/nodes/shared/PromptPanel.tsx', 'utf8');

describe('§129 `ha` 首尾帧行', () => {
  it('gate = 生成方式「首尾帧」（官方 `Se = ge === Gu.FRAMES`）', () => {
    expect(PANEL).toContain("{generateMethod === 'frames' && onChangeVideoReferences && (");
    expect(PANEL).toContain('data-testid="prompt-frame-row"');
  });

  it('首/尾帧槽 = 官方 lucide `plus` 逐字（`M5 12h14` + `M12 5v14`）', () => {
    expect(PANEL).toContain('<path d="M5 12h14" />');
    expect(PANEL).toContain('<path d="M12 5v14" />');
    expect(PANEL).toContain('lucide lucide-plus size-4 transition-colors text-white/60');
  });

  it('⇄ = 官方自绘 16 viewBox 的逐字 path，`size-4 text-white/40`', () => {
    expect(PANEL).toContain('M10.5 2.84998L13 5.34998H3M5.5 13.1L3 10.6L13 10.6');
    expect(PANEL).toContain('size-4 text-white/40');
  });

  it('⇄ 的 disabled = 官方 `at.length<2`（帧槽计数）', () => {
    expect(PANEL).toContain('const frameRefs = orderedFrameRefs(videoReferences);');
    expect(PANEL).toContain('const frameSlotCount = frameRefs.length;');
    expect(PANEL).toContain('disabled={frameSlotCount < 2}');
  });

  it('帧槽**按顺序**取帧（官方 `at[0]`=首帧 / `at[1]`=尾帧，没有 role 区分）', () => {
    /* 用户裁决：「⇄ 按照官方的来」⇒ 与官方 @2041103 的 `first: He[0]` / `last: He[1]` 同构 */
    expect(PANEL).toContain('const ref = frameRefs[slotIndex];');
    expect(PANEL).not.toContain("item.kind === 'frame' && item.role === slot");
  });

  it('⇄ = 官方 `re("image",[1,0])`（交换顺序，而不是只换 role）', () => {
    expect(PANEL).toContain('const next = swapFrameOrder(videoReferences);');
  });

  it('帧槽按钮 = 官方 38×38 / rounded-[10px] / bg-white/[0.08] hover:bg-white/[0.12]', () => {
    expect(PANEL).toContain('size-[38px] flex items-center justify-center rounded-[10px] shrink-0 transition-all focus:outline-none bg-white/[0.08] hover:bg-white/[0.12]');
    expect(PANEL).toContain('className="size-[38px] object-cover rounded-[10px] border border-white/10"');
  });

  it('首尾帧模式下 **不渲染** 官方 `ji` 分支的 chips 区与「参考 +」（官方是二选一）', () => {
    expect(PANEL).toContain("{generateMethod !== 'frames' && nodeId && <UpstreamReferenceChips");
    expect(PANEL).toContain("{generateMethod !== 'frames' && (\n              <button");
  });

  it('参数面板那两组仍按早前裁决保持关闭（两处要分开）', () => {
    const VIDEO = readFileSync('src/components/nodes/shared/VideoParamSelector.tsx', 'utf8');
    expect(VIDEO).toContain('const SHOW_MTV_REFERENCE_PICKERS = false;');
  });
});
