#!/usr/bin/env node
/**
 * official-artifacts.mjs —— 官方产物索引与重定位工具。
 *
 * 背景（2026-10-14）：
 *   线上官方更新过一次构建，仓库注释里大量 `@<偏移>` 引用随之失效。更麻烦的是，
 *   这些注释**横跨多代不同的官方产物**（线上 web 版多代 + 桌面版 + 提取包），
 *   而历史 dump 目录一度被同名覆盖，导致引用无法核对。
 *
 * 本脚本做两件事：
 *   1) 把**所有**历史 dump 目录里的产物建成一张「文件名 → 所在目录」索引（同名跨目录会被列出，不会静默取一个）；
 *   2) 从仓库注释里抽出被引用的**压缩符号名**，在索引到的产物里找它们的定义偏移。
 *
 * 用法：
 *   node scripts/official-artifacts.mjs                 # 生成/刷新索引
 *   node scripts/official-artifacts.mjs --dir <路径>    # 追加一个 dump 目录
 *   node scripts/official-artifacts.mjs --out <文件>    # 指定输出（默认 scripts/official-artifacts-index.json）
 *
 * ⚠️ 约定（见 AGENTS.md「官方产物抓取与引用」）：
 *   · 每次抓取官方产物**必须新建按日期或构建哈希命名的目录**，绝不覆盖旧的。
 *   · 代码注释引用官方证据时，必须写「dump 目录 + 文件名 + 偏移」，
 *     例如 `live-assets-r100/index-BFQAZgBP.js @1309969`，不要只写裸 `@1309969`。
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 已知的历史 dump 目录（新的往后加；不要删旧的） */
const DEFAULT_DIRS = [
  'D:\\DEEPSEEK\\tapnow-assets',
  'D:\\DEEPSEEK\\tapnow-extract',
  'D:\\DEEPSEEK\\TapNowExtract\\web\\resources\\web\\assets',
  'D:\\DEEPSEEK\\live-assets',
  'D:\\DEEPSEEK\\live-assets-current',
  'D:\\DEEPSEEK\\live-assets-new',
  'D:\\DEEPSEEK\\live-assets-r100',
  'D:\\DEEPSEEK\\_official-css',
];

const args = process.argv.slice(2);
const extraDirs = [];
let outFile = join(REPO, 'scripts', 'official-artifacts-index.json');
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--dir') extraDirs.push(args[++i]);
  else if (args[i] === '--out') outFile = args[++i];
}

const dirs = [...DEFAULT_DIRS, ...extraDirs];

/* ── 1. 产物清单索引 ── */
const files = new Map(); // 文件名 -> [{dir, size, mtime}]
const dirSummary = [];

/** 递归收集某目录下的 js/css（官方 assets 目录有子目录，组件提取包也在子目录里） */
function collect(dir, out = []) {
  let entries = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) collect(full, out);
    else if (st.isFile() && /\.(js|css)$/.test(name)) out.push({ full, name, size: st.size, mtime: st.mtime });
  }
  return out;
}

for (const dir of dirs) {
  if (!existsSync(dir)) { dirSummary.push({ dir, exists: false }); continue; }
  const found = collect(dir);
  for (const f of found) {
    const list = files.get(f.name) ?? [];
    list.push({ dir, size: f.size, mtime: f.mtime.toISOString().slice(0, 19) });
    files.set(f.name, list);
  }
  dirSummary.push({ dir, exists: true, assets: found.length });
}

/* ── 2. 抽出仓库注释里引用的符号与产物名 ── */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|css)$/.test(name)) out.push(full);
  }
  return out;
}

const citedSymbols = new Set();
const citedFiles = new Set();
for (const file of walk(join(REPO, 'src')).concat(walk(join(REPO, 'tests')))) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!/@\d{5,}|\.js/.test(line)) continue;
    for (const m of line.matchAll(/`([A-Za-z_$][A-Za-z0-9_$]{0,7})`/g)) citedSymbols.add(m[1]);
    for (const m of line.matchAll(/([A-Za-z0-9_-]+\.js)/g)) citedFiles.add(basename(m[1]));
  }
}

/* ── 2b. 归一化：行内被路径分隔符/换行截断的产物名（如 `CvbAwZyy.js`）回查完整名。
       只有当「以 `-<片段>` 结尾」的产物在索引里**唯一**时才归一化，避免张冠李戴。 ── */
const indexNames = [...files.keys()];
for (const raw of [...citedFiles]) {
  if (files.has(raw)) continue;
  const suffix = indexNames.filter((k) => k.endsWith(`-${raw}`));
  if (suffix.length === 1) { citedFiles.delete(raw); citedFiles.add(suffix[0]); }
}

/* ── 3. 在「被引用的产物」里找这些符号的定义偏移 ── */
const DEF_PATTERNS = (s) => [`const ${s}=`, `function ${s}(`, `let ${s}=`, `var ${s}=`];
const symbols = {};
let scanned = 0;
for (const name of citedFiles) {
  const entries = files.get(name);
  if (!entries || entries.length !== 1) continue; // 找不到或有歧义 ⇒ 不猜
  const { dir } = entries[0];
  const full = join(dir, name);
  let text;
  try { text = readFileSync(full, 'utf8'); } catch { continue; }
  scanned += 1;
  for (const sym of citedSymbols) {
    const hits = [];
    for (const p of DEF_PATTERNS(sym)) {
      let at = text.indexOf(p);
      while (at >= 0 && hits.length < 6) { hits.push(at + p.indexOf(sym)); at = text.indexOf(p, at + 1); }
    }
    if (!hits.length) continue;
    hits.sort((a, b) => a - b);
    const list = symbols[sym] ?? [];
    list.push({ file: name, dir, offsets: hits });
    symbols[sym] = list;
  }
}

const ambiguous = [...files.entries()].filter(([, v]) => v.length > 1).map(([k, v]) => ({ name: k, dirs: v.map((x) => x.dir) }));
const missing = [...citedFiles].filter((n) => !files.has(n)).sort();

/* ── 4. 每一代构建的身份指纹 ──
   官方发布目录名里带构建哈希（线上 URL 形如 `…/<hash>/assets/…`），本地 dump 只保留了文件名，
   但**入口分块的 content-hash 后缀本身就是该代的身份**（如 `vendor-pkg-canvas-DuoOicPr.js`）。
   这里把每代的入口分块记下来，让「哪份 dump = 哪一代」可机器判定，而不是只在散文里描述。 */
const ENTRY_PREFIXES = ['index-', 'page-', 'vendor-pkg-canvas-', 'vendor-packages-', 'vendor-libs-', 'loading-overlay-'];
const generations = [];
for (const d of dirSummary.filter((x) => x.exists)) {
  const entries = [...files.entries()]
    .filter(([, v]) => v.some((x) => x.dir === d.dir))
    .map(([name]) => name)
    .filter((name) => ENTRY_PREFIXES.some((p) => name.startsWith(p)))
    .sort();
  const mtimes = files.get(entries[0])?.filter((x) => x.dir === d.dir).map((x) => x.mtime) ?? [];
  generations.push({
    dir: d.dir,
    assets: d.assets,
    latestMtime: mtimes.sort().at(-1) ?? null,
    entries,
  });
}

const payload = {
  generatedAt: new Date().toISOString().slice(0, 19),
  note: '官方产物索引；由 scripts/official-artifacts.mjs 生成。注释引用官方证据时必须写明「dump 目录 + 文件名 + 偏移」。',
  dirs: dirSummary,
  /* 「哪份 dump 是哪一代官方构建」的机器可读指纹（入口分块的 content-hash 后缀即该代身份） */
  generations,
  fileCount: files.size,
  files: Object.fromEntries([...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))),
  citedFileCount: citedFiles.size,
  citedFilesMissing: missing,
  citedFilesAmbiguous: ambiguous,
  citedSymbolCount: citedSymbols.size,
  symbols,
};
writeFileSync(outFile, JSON.stringify(payload, null, 1), 'utf8');

console.log(`dump 目录 ${dirSummary.filter((d) => d.exists).length}/${dirs.length} 个可用，产物名 ${files.size} 个`);
console.log(`仓库点名产物 ${citedFiles.size} 个：磁盘上有 ${citedFiles.size - missing.length}，缺 ${missing.length}，同名多份 ${ambiguous.length}`);
console.log(`抽取到被引符号 ${citedSymbols.size} 个；扫描产物 ${scanned} 个，收录符号 ${Object.keys(symbols).length} 个`);
if (missing.length) console.log(`缺失产物（前 15）: ${missing.slice(0, 15).join(', ')}`);
if (ambiguous.length) console.log(`同名多份（前 5）: ${ambiguous.slice(0, 5).map((a) => a.name).join(', ')}`);
console.log(`→ ${outFile}`);
