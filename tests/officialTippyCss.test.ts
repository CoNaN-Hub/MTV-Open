/**
 * 官方 tippy 样式口径的回归守卫（live CDP 9222 实测结论，见
 * `live-ProseMirror-提及输入内核.md` §9）：
 *
 * 官方**没有**引入 tippy 核心样式表（`.tippy-box{position:relative;background:#333;…}` /
 * `.tippy-content{padding:5px 9px}` / `[data-tippy-root]{max-width:…}` / 箭头样式都不存在），
 * 全站只有两条规则：`.tippy-box{max-width:400px!important;font-size:14px}` 与
 * `.tippy-box[data-animation="fade"][data-state="hidden"]{opacity:0}`。
 * ⇒ MTV 必须同样**不**引 `tippy.js/dist/tippy.css`，只落这两条。
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const tippyCss = fs.readFileSync(path.join(root, 'src/styles/official-tippy.css'), 'utf8');
const indexCss = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');

/** 递归收集 `src/**` 下的源码（跳过 node_modules / 产物）。 */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('official-tippy.css —— 与 live 的 tippy 样式口径一致', () => {
  it('落的是官方真实存在的那两条规则', () => {
    expect(tippyCss).toContain('max-width: 400px !important');
    expect(tippyCss).toContain('font-size: 14px');
    expect(tippyCss).toContain(".tippy-box[data-animation='fade'][data-state='hidden']");
    expect(tippyCss).toContain('opacity: 0');
  });

  it('**不**引 tippy 核心样式表（官方没有，引了会多出背景/内边距/箭头）', () => {
    /* 只看**声明**：头注释里为说明「官方没有这些」而引用了原文，不算违规。 */
    const declarations = tippyCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(declarations).not.toContain('background-color: #333');
    expect(declarations).not.toContain('padding: 5px 9px');
    expect(declarations).not.toContain('data-tippy-root');
    expect(declarations).not.toContain('.tippy-arrow');
    expect(declarations).not.toContain('.tippy-content');
  });

  it('全仓没有任何文件 import `tippy.js/dist/tippy.css`', () => {
    /* 只匹配**真的 import 语句**（注释里提到文件名不算）。 */
    const importRe = /(?:@import\s+|import\s+)['"]tippy(?:\.js)?\/(?:dist\/)?tippy(?:\.min)?\.css['"]/;
    const offenders = walk(path.join(root, 'src'))
      .filter((file) => importRe.test(fs.readFileSync(file, 'utf8')))
      .map((file) => path.relative(root, file));
    expect(offenders).toEqual([]);
  });

  it('`index.css` 已 import 该文件（且排在 official-chat.css 之后）', () => {
    expect(indexCss).toContain("@import './styles/official-tippy.css';");
    expect(indexCss.indexOf("official-tippy.css")).toBeGreaterThan(indexCss.indexOf("official-chat.css"));
  });
});
