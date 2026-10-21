/**
 * UI 一致性收口 —— 「界面只能显示 displayName」的可执行约束。
 *
 * 用户要求（2026）：
 *   「UI 的模型选择器、当前模型标签、会话历史、消息卡片、设置页等所有位置，
 *     只能展示 displayName，不得直接展示 providerModelId」
 *   「不得将任何单一平台名称、模型规则或映射逻辑写死在 Agent UI 或业务组件中」
 *
 * 做法：扫描 `src/**\/*.tsx` 里**渲染成文字**的原始模型引用（JSX 子节点 / 模板串），
 * 只允许出现在下面白名单里（白名单本身也要有正当理由）。
 * ⚠️ `key=` / `value=` / `data-*` / 组件属性传递**不算**展示，不参与扫描。
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '../../src');

function walkTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkTsx(full, out);
    else if (/\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** JSX **文字**里直接插值原始模型引用的形态（`key=` / `value=` / `data-*` 天然不匹配）*/
const DISPLAY_LEAKS: Array<[string, RegExp]> = [
  ['JSX 子节点直接渲染 selectedModel', />\s*\{\s*selectedModel\s*\}/],
  ['JSX 子节点直接渲染 model.id', />\s*\{\s*\w*model\.id\s*\}/],
  ['JSX 子节点直接渲染 option.id', />\s*\{\s*option\.id\s*\}/],
  ['JSX 子节点直接渲染 entry.model', />\s*\{\s*entry\.model\s*\}/],
  ['JSX 子节点直接渲染 row.model', />\s*\{\s*row\.model\s*\}/],
  ['JSX 子节点直接渲染 model.name', />\s*\{\s*\w*model\.name\s*\}/],
  ['JSX 子节点直接渲染 model.label', />\s*\{\s*\w*model\.label\s*\}/],
  ['模板串里直接拼 selectedModel', /<[^>]*>\s*\{\s*`[^`]*\$\{\s*selectedModel\s*\}[^`]*`/],
  ['模板串里直接拼 entry.model', /<[^>]*>\s*\{\s*`[^`]*\$\{\s*entry\.model\s*\}[^`]*`/],
  ['模板串里直接拼 row.model', /<[^>]*>\s*\{\s*`[^`]*\$\{\s*row\.model\s*\}[^`]*`/],
  ['模板串里直接拼 model.name', /<[^>]*>\s*\{\s*`[^`]*\$\{\s*\w*model\.name\s*\}[^`]*`/],
];

/**
 * 允许例外（每条都要能说出理由）。
 * 目前为空 —— 说明「UI 里已经没有任何一处直接渲染原始模型引用了」。
 */
const ALLOWED: Array<{ file: string; pattern: string; why: string }> = [];

describe('UI 一致性：界面不得直接渲染 providerModelId', () => {
  const files = walkTsx(SRC);

  it('全仓 tsx 扫描：没有直接渲染原始模型引用的地方', () => {
    const leaks: string[] = [];
    for (const file of files) {
      const rel = file.replace(SRC, 'src').replace(/\\/g, '/');
      const src = strip(readFileSync(file, 'utf8'));
      src.split(/\r?\n/).forEach((line, index) => {
        for (const [name, re] of DISPLAY_LEAKS) {
          if (!re.test(line)) continue;
          const allowed = ALLOWED.some((entry) => rel.endsWith(entry.file) && line.includes(entry.pattern));
          if (!allowed) leaks.push(`${rel}:${index + 1} [${name}] ${line.trim().slice(0, 110)}`);
        }
      });
    }
    expect(leaks, `发现 ${leaks.length} 处直接把原始模型引用印给用户：\n${leaks.join('\n')}`).toEqual([]);
  });

  it('渲染模型名的主力文件都走展示名出口（不是自己读 label/name）', () => {
    const mustUseDisplayLayer = [
      'src/components/nodes/shared/ModelSelector.tsx',
      'src/components/OutputHistoryPanel.tsx',
      'src/components/nodes/ShotlistNode.tsx',
      'src/components/chat/ChatInput.tsx',
      'src/components/chat/AgentApprovalCard.tsx',
      'src/components/ProjectSettingsPopover.tsx',
      'src/components/settings/providerConnection/ProviderModelSection.tsx',
      'src/components/settings/providerConnection/ProviderBillingSection.tsx',
      'src/components/settings/ModelProtocolEditor.tsx',
      'src/components/settings/BillingRecordsSettings.tsx',
      'src/components/nodes/PluginNode.tsx',
    ];
    for (const rel of mustUseDisplayLayer) {
      const src = readFileSync(join(SRC, rel.replace(/^src\//, '')), 'utf8');
      expect(src, `${rel} 应通过 services/models/display 取名`)
        .toMatch(/from '.*services\/models\/display'/);
    }
  });

  it('映射逻辑只有一处：组件里不再出现「按 id 猜官方名」的表/正则', () => {
    /* 老的第三方覆盖表（名字部分）与官方正则族匹配都不该再被 UI 组件用来取名 */
    for (const rel of ['src/components/nodes/shared/ModelSelector.tsx']) {
      const src = strip(readFileSync(join(SRC, rel.replace(/^src\//, '')), 'utf8'));
      expect(src, rel).not.toContain('MODEL_DISPLAY_OVERRIDES');
      expect(src, rel).not.toMatch(/KEYWORD_RULES|VARIANT_DISPLAY/);
    }
    /* 平台规则不写在业务文件里 */
    const business = strip(readFileSync(join(SRC, 'services/ai/generateImage.ts'), 'utf8'));
    expect(business).not.toMatch(/ai-tudou|grsai/i);
  });

  it('展示名出口本身不依赖 UI / store 的写接口（可被服务层复用）', () => {
    const display = strip(readFileSync(join(SRC, 'services/models/display.ts'), 'utf8'));
    /* 允许读 store（React hook 需要），但不许写 */
    expect(display).not.toMatch(/updateConfig|saveConfig|updateNodeData/);
    /* 纯函数部分不依赖 React */
    expect(display).toContain('export function displayNameOfModelRef');
    expect(display).toContain('export function displayNameOfCatalogEntry');
    expect(display).toContain('export function normalizedModelOf');
  });

  it('旧的「手写 id→名」覆盖表已删除，说明文案表里不含 name', () => {
    /* 用户点名要删的就是它：`components/nodes/shared/modelDisplayOverrides.ts` */
    expect(() => readFileSync(join(SRC, 'components/nodes/shared/modelDisplayOverrides.ts'), 'utf8'))
      .toThrow();
    const descriptions = readFileSync(join(SRC, 'data/modelDescriptions.ts'), 'utf8');
    expect(descriptions).toContain('MODEL_DESCRIPTION_OVERRIDES');
    /* 说明表只放文案 —— 出现 `name:` 就说明又把名字写回来了 */
    expect(descriptions).not.toMatch(/^\s*name:/m);
  });
});
