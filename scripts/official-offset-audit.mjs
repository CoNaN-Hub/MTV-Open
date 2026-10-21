#!/usr/bin/env node
/**
 * official-offset-audit.mjs —— 全仓「官方偏移引用」审计与规范化表。
 *
 * 背景：仓库注释里大量引用官方产物的 `@<偏移>`，但
 *   · 官方会持续更新构建，偏移随构建变化；
 *   · 这些引用**横跨多代产物**（线上 web 多代 + 桌面版 + 提取包），部分源产物已不在本地。
 * ⇒ 本脚本把每条引用归类，产出后续「重定位大扫」可直接消费的表。
 *
 * 依赖：先跑 `node scripts/official-artifacts.mjs` 生成 `scripts/official-artifacts-index.json`。
 *
 * 用法：
 *   node scripts/official-offset-audit.mjs [--out <file>]
 *
 * 输出（默认 D:\DEEPSEEK\_r105-offset-table.json）每行一条：
 *   status = resolved          行内点名的产物**唯一**存在于某个 dump 目录 ⇒ 给出规范写法
 *          = ambiguous-product 同名多份，不能猜
 *          = missing-product   点名的产物本地没有（更早代次）⇒ 只能人工重挖
 *          = no-hint           没点名产物，需按上下文人工判
 *
 * ⚠️ 已知噪音：`s.js` / `l.js` / `t.js` / `a.js` 这类 1 字符名是**压缩后的相对导入路径**
 *    （`"./s.js"`），不是产物名；统计缺失时应剔除。
 *
 * 引用规范见仓库根 `AGENTS.md`：注释引官方证据必须写「dump 目录 + 文件名 + 偏移」。
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = join(REPO, 'scripts', 'official-artifacts-index.json');

const args = process.argv.slice(2);
let outFile = 'D:\\DEEPSEEK\\_r105-offset-table.json';
for (let i = 0; i < args.length; i += 1) if (args[i] === '--out') outFile = args[++i];

if (!existsSync(INDEX)) {
  console.error('缺少 scripts/official-artifacts-index.json —— 请先运行：node scripts/official-artifacts.mjs');
  process.exit(1);
}
const FILES = JSON.parse(readFileSync(INDEX, 'utf8')).files; // 产物名 -> [{dir,size,mtime}]

/** dump 绝对路径 → 短标签（live-assets-r100 / TapNowExtract …） */
const shortDir = (d) => {
  const m = /D:\\DEEPSEEK\\([^\\]+)/.exec(d);
  return m ? m[1] : d;
};

/** 1 字符名是压缩相对导入路径，不是产物 */
const isNoise = (n) => /^[a-z]\.js$/.test(n);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

const rows = [];
const stat = { resolved: 0, missingProduct: 0, noHint: 0, ambiguous: 0 };
const missingSet = new Map();

for (const file of walk(join(REPO, 'src')).concat(walk(join(REPO, 'tests')))) {
  const rel = relative(REPO, file).replace(/\\/g, '/');
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    const offsets = [...line.matchAll(/@(\d{5,})/g)].map((m) => Number(m[1]));
    if (!offsets.length) return;
    const names = [...new Set([...line.matchAll(/([A-Za-z0-9_-]+\.js)/g)].map((m) => m[1]))].filter((n) => !isNoise(n));
    const base = { file: rel, line: i + 1, offsets, snippet: line.trim().slice(0, 110) };
    if (!names.length) { stat.noHint += offsets.length; rows.push({ ...base, status: 'no-hint' }); return; }
    for (const n of names) {
      const hit = FILES[n];
      if (!hit) {
        stat.missingProduct += offsets.length;
        missingSet.set(n, (missingSet.get(n) ?? 0) + 1);
        rows.push({ ...base, status: 'missing-product', product: n });
      } else if (hit.length > 1) {
        stat.ambiguous += offsets.length;
        rows.push({ ...base, status: 'ambiguous-product', product: n, dirs: hit.map((h) => shortDir(h.dir)) });
      } else {
        const dir = shortDir(hit[0].dir);
        stat.resolved += offsets.length;
        rows.push({ ...base, status: 'resolved', product: n, dir, canonical: offsets.map((o) => `${dir}/${n} @${o}`) });
      }
    }
  });
}

writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 19), stats: stat, rows }, null, 1), 'utf8');
console.log(`条目 ${rows.length}  偏移实例 ${stat.resolved + stat.missingProduct + stat.ambiguous + stat.noHint}`);
console.log(JSON.stringify(stat, null, 1));
console.log('\n本地缺失的产物（引用数 top 15，唯有这些需要人工重挖）:');
for (const [n, c] of [...missingSet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${String(c).padStart(4)}  ${n}`);
console.log(`\n→ ${outFile}`);
