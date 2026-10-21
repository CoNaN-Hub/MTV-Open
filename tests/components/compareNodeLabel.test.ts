/**
 * 对比卡标题行 + 空卡占位的契约（用户 2026 的四条要求）。
 *
 * 用户原话：
 *   · 「对比卡 左上角 要跟 image卡 一样 图标+文案 然后 文案也可以编辑」
 *   · 「图标+文案 要像 image卡 一样 常驻」
 *   · 「对比卡的 左上角 文案 字体大小 要与 图像生成/image 的字体一致」
 *   · 「对比的图标 及卡体的占位符 用下面的 svg」「对比卡空卡时 卡体颜色 也要一样」
 *
 * 实测结论（CDP 9222 现场量）：
 *   · 两边标题行都是 `node-label flex items-center select-none`；
 *     字号 12px / 字重 400 / 行高 18px / 颜色 rgba(247,247,247,.6) / 字体 ui-sans-serif —— 逐值相同
 *   · 空卡：两边 `background: transparent` + `border-radius: 10px`，实际底色都来自卡片
 *     （`--glass-bg-node` = rgb(31,31,31)）；占位图标渲染框都是 55.1×55.1（画布缩放后）
 *
 * ★ 关键坑（已修）：标题行**必须放在 `.node` 外面**。
 *   `nodes.css` 里 `.node.selected .node-label-text{visibility:hidden}`（官方"选中即隐藏标题"）
 *   只命中 `.node` 的后代 ⇒ 放进 `.node` 就会「第 1 击选中 → 标题隐藏 → 第 2 击落不到文字上
 *   → 双击改名永远进不去」（实测：修前对比卡双击无效、image 卡有效）。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const compare = () => readFileSync(new URL('../../src/components/nodes/CompareNode.tsx', import.meta.url), 'utf8');
const label = () => readFileSync(new URL('../../src/components/nodes/shared/NodeLabel.tsx', import.meta.url), 'utf8');
const css = () => readFileSync(new URL('../../src/styles/image-compare.css', import.meta.url), 'utf8');

describe('对比卡标题行 1:1 image 卡', () => {
  it('用的是 image 卡那套共享 NodeLabel（图标 + 文案 + 双击改名）', () => {
    const source = compare();
    expect(source).toContain("import NodeLabel from './shared/NodeLabel'");
    expect(source).toContain("import { useNodeRename } from './shared/useNodeRename'");
    expect(source).toContain("useNodeRename(id, data as BaseNodeData, '图片对比')");
    expect(source).toContain('<NodeLabel kind="compare" label={titleLabel} nodeId={id} onRename={handleRename} />');
    /* 旧的「自己写一个只有文字的标题行」必须彻底消失 */
    expect(source).not.toContain('data-label-kind="compare"');
  });

  it('★ 标题行渲染在 `.node` **外面**（否则选中即隐藏、双击改名失效）', () => {
    const source = compare();
    const labelAt = source.indexOf('<NodeLabel kind="compare"');
    const nodeAt = source.indexOf('className={`node compare-node');
    /* `.node-wrapper` 的收口 `</div>`：4 空格缩进 + 紧跟 `);`。
       ⚠️ 别写死 `'</div>\n    </div>\n  );'`（节点内 + 卡片 + wrapper 的连续三层收口）——
          「无损改图」的浮编块插在卡片之后 ⇒ 那三层不再相邻，锚点会失效 ✗（实测 -1）。 */
    const closeWrapper = source.lastIndexOf('</div>\n  );');
    expect(labelAt).toBeGreaterThan(-1);
    expect(nodeAt).toBeGreaterThan(-1);
    /* NodeLabel 出现在 `.node` 之前，且仍在 `.node-wrapper` 内 */
    expect(labelAt).toBeLessThan(nodeAt);
    expect(closeWrapper).toBeGreaterThan(nodeAt);
  });

  it('对比卡的标题图标 = 用户给的「对比」SVG', () => {
    expect(label()).toContain("kind === 'compare'");
    expect(label()).toContain('<OfficialIcon name="compare-placeholder" size={12} />');
  });

  it('添加节点菜单里的对比图标也是同一支（用户：「菜单图标也改成现在的 旋转90°后的」）', () => {
    const catalog = readFileSync(new URL('../../src/components/sidebar/nodePickerCatalog.tsx', import.meta.url), 'utf8');
    expect(catalog).toContain('<OfficialIcon name="compare-placeholder" size={17} />');
    expect(catalog).not.toContain('name="compare"');
    /* 用户：「添加节点菜单 里的名字不变 依旧是 对比」——菜单行文字不许动 */
    expect(catalog).toContain("label: '对比',");
  });

  it('连接下拉菜单（引用选中节点生成）：图标换新，菜单行文字仍是「对比」', () => {
    const hook = readFileSync(new URL('../../src/hooks/useConnectionDropMenu.ts', import.meta.url), 'utf8');
    expect(hook).toContain("createNode('nodes.compareNode', '对比', D_COMPARE, 'compare-placeholder', 'compare', {");
    expect(hook).not.toContain("D_COMPARE, 'compare', 'compare'");
  });

  it('创建出来的卡片默认名 = 图片对比（菜单文字与卡片标题分开）', () => {
    /* 连接菜单：`title` 会写进 data.label */
    expect(readFileSync(new URL('../../src/hooks/useConnectionDropMenu.ts', import.meta.url), 'utf8')).toContain("title: '图片对比',");
    /* 添加节点菜单：`buildNodeData` 写 label */
    expect(readFileSync(new URL('../../src/components/sidebar/nodePickerActions.ts', import.meta.url), 'utf8')).toContain("? '图片对比'");
    /* 卡片：默认名 + 老数据（旧默认「对比」）归一化 */
    const source = compare();
    expect(source).toContain("useNodeRename(id, data as BaseNodeData, '图片对比')");
    expect(source).toContain("displayLabel === '对比' ? '图片对比' : displayLabel");
  });

  /* ══ 无损改图生成的合成卡：盒子必须按**合成图自己的真实比例** ══
     实测踩过：只写 `nodeWidth/nodeHeight` 没用 —— `ImageNode` 渲染时自己重算
     （`role:'generator'` 走 `aspectRatioValue(data.aspectRatio)`）⇒ 漏 `aspectRatio`
     就落到兜底 1:1，9:16 的合成图出来是 250×250 的方卡（渲染 123×123、图被裁）。 */
  it('无损改图建卡：三件套一起写（aspectRatio + imageWidth/Height + 盒子尺寸）', () => {
    const source = compare();
    expect(source).toContain('const size = nodeSizeForAspectRatio(width / Math.max(1, height));');
    expect(source).toContain('const realRatio = nearestAspectRatioForImage(width, height);');
    expect(source).toContain('aspectRatio: realRatio.aspectRatio,');
    expect(source).toContain('imageWidth: width,');
    expect(source).toContain('imageHeight: height,');
    expect(source).toContain('nodeWidth: size.width,');
    expect(source).toContain('nodeHeight: size.height,');
    /* 不许再自己拿对比卡宽度算高度（那会把比例丢成方卡） */
    expect(source).not.toContain('Math.max(120, Math.round(w / ratio))');
  });

  /* ══ 无损改图生成的合成卡：节点连接线必须连得上 ══
     实测踩过：建边写的是 `sourceHandle:'right'`，但对比卡**只有 left 一个手柄**
     ⇒ React Flow 找不到 right 手柄就**静默丢弃这条边**（画布上只剩 2 条入边、
     新建的合成卡一条边都没有 ✗）。所以「有 right 手柄」与「建边用 right」是一对契约。 */
  it('无损改图建卡：连接线能连上（对比卡必须有 right 输出手柄 + 建边用 right）', () => {
    const source = compare();
    expect(source).toContain('position={Position.Right} id="right"');
    expect(source).toContain("sourceHandle: 'right', targetHandle: 'left'");
    /* left 也必须在（入边全靠它收，`useConnectionDropMenu` 建的就是 `targetHandle:'left'`） */
    expect(source).toContain('position={Position.Left} id="left"');
  });
});

describe('对比卡空态', () => {
  it('占位用 image 卡同一套类 ⇒ 底色/圆角任何主题下都一致', () => {
    const source = compare();
    expect(source).toContain('compare-preview-placeholder node-preview-placeholder');
    expect(source).toContain('<OfficialIcon name="compare-placeholder" size={48} />');
    /* 用户 2026：「卡体 中去掉 对比 占位符」⇒ 空卡里**只有图标**，没有任何文字 */
    expect(source).not.toContain('compare-empty-hint');
  });

  it('占位图标上色与 image 卡那支占位图一致（#f5f5f5 + 20%）', () => {
    const source = css();
    const rule = source.slice(source.indexOf('.compare-preview-placeholder .official-icon {'));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toContain('color: rgb(245, 245, 245)');
    expect(body).toContain('opacity: 0.2');
    expect(body).not.toContain('--theme-text-muted');
  });

  it('图标资产整体旋转 90°', () => {
    const svg = readFileSync(new URL('../../src/assets/official-icons/compare-placeholder.svg', import.meta.url), 'utf8');
    expect(svg).toContain('transform="rotate(90 12 12)"');
  });

  it('空态不再自带 `#1f1f1f` 底色（用户：「卡体颜色也要一样 现在目前的颜色不对」）', () => {
    const source = css();
    const placeholder = source.slice(source.indexOf('.compare-preview-placeholder {'));
    const body = placeholder.slice(0, placeholder.indexOf('}'));
    expect(body).toContain('background: transparent');
    expect(body).not.toContain('#1f1f1f');
    /* 滑块容器（连够两张图之后）仍保留自己的底色 */
    const preview = source.slice(source.indexOf('.compare-preview {'));
    expect(preview.slice(0, preview.indexOf('}'))).toContain('background: #1f1f1f');
  });
});
