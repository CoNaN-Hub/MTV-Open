/**
 * 对比卡「注册表 + 卡体底色」契约（回归：2026-10 round 103 之后的对比卡白底药丸事故）。
 *
 * ── 事故现场（真机实测）──
 *   `src/components/Canvas.tsx` 的 `nodeTypes` 里 **`compare: CompareNode` 被整条删掉了**
 *   （同一处还丢了 `import CompareNode`，空出来的位置换成了 `mockup: MockupNode`）。
 *   于是 React Flow 找不到 `compare` 这个类型 ⇒ 走 **fallback「default」节点**：
 *   CDP 9333 读数（`http://localhost:5180/`，节点 `node-ozcyqb5a6`）：
 *     · 包装器 `class="react-flow__node react-flow__node-default ..."`
 *     · `background-color: rgb(255,255,255)`（纯白）· `border: 0.666667px solid rgb(26,25,43)`（黑描边）
 *     · 两个手柄 = React Flow 默认的 `data-handlepos="top"` / `"bottom"`（上下两个黑圆点）
 *     · 文字色 `rgb(245,245,245)` 落在白底上 ⇒ 用户看到的「白底浅字、几乎看不见」
 *     · `.compare-node` / `.compare-preview-placeholder` **在 DOM 里根本不存在**
 *   ⇒ 外观与功能同时报废（没有滑块、没有无损改图面板、`targetHandle:'left'` 也接不上）。
 *
 * ── 本文件钉住三条 ──
 *   ① **注册表完整性**：`types/index.ts` 的 `NodeType` 联合里每一个成员都必须在
 *      `Canvas.tsx` 的 `nodeTypes` 里有实现。React Flow 对缺键是**静默 fallback**（不报错），
 *      只靠肉眼几乎发现不了 ⇒ 用这条测试兜住。
 *   ② **空卡卡体底色与图像卡同源**：对比卡外壳（`.node.compare-node`）**自己不许画底色**，
 *      只能继承 `.node { background: var(--glass-bg-node) }`（图像卡走的是同一条）；
 *      空态占位层 `.compare-preview-placeholder` 必须是 `transparent`。
 *      真机对照（同一帧，暗色主题）：
 *        `.node.compare-node`  → background-color rgb(31,31,31) / radius 16px
 *        `.node.image-node`    → background-color rgb(31,31,31) / radius 16px
 *        `.compare-preview-placeholder` → transparent / radius 10px / color rgb(122,122,122)
 *                                        / .official-icon 48×48 color rgb(245,245,245) opacity 0.2
 *        `.node-preview-placeholder`（图像卡空态）→ transparent / radius 10px / color rgb(122,122,122)
 *                                        / svg 48×48 color rgb(245,245,245) g[opacity=0.2]
 *   ③ **`NODE_TYPE_CONFIG` 完整性**（同一次补丁的第二个受害者）：`NodeType` 的每个成员都得在
 *      `NODE_TYPE_CONFIG` 里有条目（或落在**恰好那 5 个**的显式豁免清单里 —— 那 5 个在建仓
 *      （`14a0c1f`）时就不在本表，见 `NODE_TYPE_CONFIG_EXEMPT` 的注释）。原先 `'compare'` 那一行
 *      被整行顶掉，`getNodeTypeConfig('compare')` 于是走灰色兜底 ⇒ 画布统计 / 撤销历史里显示的
 *      是英文 key `compare`（而不是「对比」），且**不报任何错**。原值已从 `git diff` 逐字取回。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const canvas = () => read('../../src/components/Canvas.tsx');
const types = () => read('../../src/types/index.ts');
const compareCss = () => read('../../src/styles/image-compare.css');
const nodesCss = () => read('../../src/styles/nodes.css');

/** 取出 `const nodeTypes: NodeTypes = withNodeRenderBoundaries({ ... })` 的键集合 */
function registeredNodeTypes(): Set<string> {
  const source = canvas();
  const start = source.indexOf('const nodeTypes: NodeTypes = withNodeRenderBoundaries({');
  expect(start).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf('\n});', start));
  const keys = new Set<string>();
  for (const line of body.split('\n')) {
    /* 键可能是裸标识符（`compare: CompareNode`）或带引号（`'ai-image': ImageNode`） */
    const m = /^\s*'?([a-z][a-z0-9-]*)'?:\s*[A-Za-z_$][\w$]*,\s*$/.exec(line);
    if (m) keys.add(m[1]);
  }
  return keys;
}

/** 取出 `types/index.ts` 的 `NodeType` 联合成员 */
function declaredNodeTypes(): Set<string> {
  const source = types();
  const start = source.indexOf('export type NodeType =');
  expect(start).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf(';', start));
  const out = new Set<string>();
  for (const m of body.matchAll(/\|\s*'([a-z][a-z0-9-]*)'/g)) out.add(m[1]);
  return out;
}

/** 取出 `NODE_TYPE_CONFIG` 的键集合（`export const NODE_TYPE_CONFIG … { 'ai-text': {…} }`） */
function configuredNodeTypes(): Set<string> {
  const source = types();
  const start = source.indexOf('export const NODE_TYPE_CONFIG');
  expect(start).toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf('\n};', start));
  const keys = new Set<string>();
  for (const m of body.matchAll(/^\s*'([a-z][a-z0-9-]*)':\s*\{/gm)) keys.add(m[1]);
  return keys;
}

/** 取 `NODE_TYPE_CONFIG` 里某个键的**整行原文**，找不到返回 null */
function configEntryLine(type: string): string | null {
  const source = types();
  const start = source.indexOf('export const NODE_TYPE_CONFIG');
  const body = source.slice(start, source.indexOf('\n};', start));
  const re = new RegExp("^\\s*'" + type + "':\\s*\\{.*\\},?\\s*$", 'm');
  return body.match(re)?.[0] ?? null;
}

/**
 * **故意不进 `NODE_TYPE_CONFIG`** 的 `NodeType` 成员 —— 逐个可核对，不许悄悄加人。
 *
 * 事实（`git show HEAD:src/types/index.ts` 即可复核）：这 5 个成员**从建仓起就没有**
 * `NODE_TYPE_CONFIG` 条目，不是被哪次补丁顶掉的；它们的标签由别处提供：
 *   · `source-*` 四类 ⇒ `src/utils/nodeTypeLabels.ts` 的 `EXTRA_NODE_LABELS`
 *     （该文件开头逐字写着「`NODE_TYPE_CONFIG` 之外的类型名」）；
 *   · `comment` ⇒ 分组标题注释节点（`store.groups.ts` 造，`nodeTypes` 里映射 `TextNode`），
 *     显示名走 `data.label`（分组名），本表无条目属原设计。
 * ⇒ 本文件**不自造**这些条目（补进去会连带改掉 `AssetsPanel` / 历史描述里的图标与文案，
 *   属无关改动）；改为把「缺哪些」钉成一个**恰好这 5 个**的显式清单：将来谁想新增豁免，
 *   必须回来改这个常量 —— 而「从表里掉一条」会立刻被下面的不变量抓红。
 */
const NODE_TYPE_CONFIG_EXEMPT: readonly string[] = [
  'comment',
  'source-audio',
  'source-image',
  'source-text',
  'source-video',
];

/** 取某个选择器规则体（从 `sel {` 到第一个 `}`），找不到返回 null */
function ruleBody(css: string, selector: string): string | null {
  const at = css.indexOf(selector + ' {');
  if (at < 0) return null;
  return css.slice(at + selector.length, css.indexOf('}', at));
}

describe('对比卡注册表（回归：compare 从 nodeTypes 掉出去 ⇒ 白底药丸）', () => {
  it('`compare` 在 nodeTypes 里，且 CompareNode 被 import', () => {
    expect(canvas()).toContain("import CompareNode from './nodes/CompareNode';");
    expect(registeredNodeTypes().has('compare')).toBe(true);
  });

  it('`mockup` 也还在（同一处改动一起加进来的，别互相顶掉）', () => {
    expect(registeredNodeTypes().has('mockup')).toBe(true);
  });

  it('★ 不变量：NodeType 联合的每个成员都要在 nodeTypes 里注册', () => {
    const registered = registeredNodeTypes();
    const missing = [...declaredNodeTypes()].filter((t) => !registered.has(t)).sort();
    expect(missing).toEqual([]);
    /* 反向抽查：解析没退化（键确实被读出来了；少一条就说明正则解析坏了、上面的 `[]` 是假绿） */
    expect(registered.size).toBeGreaterThanOrEqual(20);
    expect(declaredNodeTypes().size).toBeGreaterThanOrEqual(19);
    expect(declaredNodeTypes().has('compare')).toBe(true);
    expect(declaredNodeTypes().has('ai-image')).toBe(true);
  });
});

describe('NODE_TYPE_CONFIG 注册表（回归：compare 条目被顶掉 ⇒ 统计/历史里显示英文 key）', () => {
  it('★ 不变量：NodeType 的每个成员要么在 NODE_TYPE_CONFIG 里有条目，要么在豁免清单里', () => {
    const configured = configuredNodeTypes();
    const missing = [...declaredNodeTypes()].filter((t) => !configured.has(t)).sort();
    expect(missing).toEqual([...NODE_TYPE_CONFIG_EXEMPT].sort());
    /* 反向抽查：解析没退化（否则上面的 `[]`/清单比对是假绿） */
    expect(configured.size).toBeGreaterThanOrEqual(13);
    expect(configured.has('ai-image')).toBe(true);
    expect(configured.has('canvas-note')).toBe(true);
    expect(configured.has('compare')).toBe(true);
  });

  it('★ 不变量：NODE_TYPE_CONFIG 的键不许是 NodeType 之外的名字（删类型必须连条目一起删）', () => {
    const declared = declaredNodeTypes();
    const orphans = [...configuredNodeTypes()].filter((t) => !declared.has(t)).sort();
    expect(orphans).toEqual([]);
  });

  it('豁免清单恰好那 5 个（新增 NodeType 成员必须显式决定：进表 or 进豁免）', () => {
    expect([...NODE_TYPE_CONFIG_EXEMPT].sort()).toEqual([
      'comment', 'source-audio', 'source-image', 'source-text', 'source-video',
    ]);
    /* 豁免的成员必须真的在 NodeType 里（别留下已删类型的死豁免） */
    const declared = declaredNodeTypes();
    expect(NODE_TYPE_CONFIG_EXEMPT.filter((t) => !declared.has(t))).toEqual([]);
  });

  it('源素材四类的标签有替代事实来源（`utils/nodeTypeLabels.ts` 的 EXTRA_NODE_LABELS）', () => {
    const labels = read('../../src/utils/nodeTypeLabels.ts');
    for (const type of ['source-text', 'source-image', 'source-video', 'source-audio']) {
      expect(NODE_TYPE_CONFIG_EXEMPT).toContain(type);
      expect(labels).toContain("'" + type + "':");
    }
  });

  it('`compare` 条目按被顶掉前的原文逐字补回（git diff 可核）', () => {
    const line = configEntryLine('compare');
    expect(line).not.toBeNull();
    expect(line).toContain("icon: 'mdi:compare'");
    expect(line).toContain("color: 'text-sky-400'");
    expect(line).toContain("bg: 'bg-sky-500/15'");
    expect(line).toContain("label: '对比'");
  });
});

describe('对比卡空态：卡体底色与图像卡同源', () => {
  it('卡体外壳 `.node` 的底色令牌 = `--glass-bg-node`（图像卡走的是同一条）', () => {
    const body = ruleBody(nodesCss(), '.node');
    expect(body).toContain('background: var(--glass-bg-node)');
  });

  it('`.compare-node` 自己不画底色（只继承 `.node` 的卡体色）', () => {
    const body = ruleBody(compareCss(), '.compare-node');
    expect(body).not.toBeNull();
    expect(body).not.toContain('background');
  });

  it('空态占位层是 transparent（不许兜底成白/近白）', () => {
    const body = ruleBody(compareCss(), '.compare-preview-placeholder');
    expect(body).toContain('background: transparent');
    expect(body).toContain('border-radius: 10px');
  });

  it('空态占位图标 = image 卡那支（#f5f5f5 + 20%）', () => {
    const icon = ruleBody(compareCss(), '.compare-preview-placeholder .official-icon');
    expect(icon).toContain('width: 48px');
    expect(icon).toContain('height: 48px');
    expect(icon).toContain('color: rgb(245, 245, 245)');
    expect(icon).toContain('opacity: 0.2');
  });

  it('src/styles 全量扫描：没有任何规则给 `.compare-node` 画不透明底色', () => {
    const files = ['image-compare.css', 'nodes.css', 'nodes-image.css', 'base.css'];
    const offenders: string[] = [];
    for (const f of files) {
      let css: string;
      try { css = read('../../src/styles/' + f); } catch { continue; }
      for (const m of css.matchAll(/(^|[},])\s*([^{}]*\.compare-node[^{}]*)\{([^}]*)\}/g)) {
        const sel = m[2].trim();
        const body = m[3];
        /* 允许 `.compare-node-content` / `.compare-preview*` 这类后代选择器，只挑卡体本身 */
        if (!/(^|\s|\W)\.compare-node(\s|,|:|$)/.test(sel)) continue;
        const bg = /background(?:-color)?:\s*([^;]+);/.exec(body);
        if (bg && !/transparent|none|var\(--glass-bg-node\)/.test(bg[1])) {
          offenders.push(`${f} :: ${sel} → ${bg[1].trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
    expect(files.length).toBeGreaterThan(0);
  });
});
