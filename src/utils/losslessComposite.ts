/**
 * losslessComposite.ts —— 「无损改图」的核心算法（纯函数，无 DOM / React 依赖）
 * ══════════════════════════════════════════════════════════════════════════
 * 逐条对齐参考实现 `https://taozui.name/tools/eraser/` 的内联脚本（整页 HTML 66693 字节，
 * 内联 `<script>` 位于 HTML **偏移 26478–63022**，即第 357 行那一条超长行）。
 * 注释里的 `html:NNNNN` 都是**该 HTML 文件的字符偏移**，`js:NNNN` 是脚本内偏移（= html − 26478），
 * 可以直接 `substr` 回原文核对。
 *
 * 管线（与参考实现一致）：
 *   ① 自动对齐 alignImages()            —— html:32609 `async function z()`   金字塔 + 纹理块 + 加权最小二乘
 *   ② 自动校色 computeColorCorrection() —— html:34634 `function q()`        逐通道均值/方差匹配
 *   ③ 改动检测 detectChanges()          —— html:36221 `function K()`        双路信号 + 中位数/MAD + 连通域
 *   ④ 合成 compositeLossless()          —— html:45049 `function tt(t,e)`    修改图 ⊕（原图挖掉 mask）
 *
 * ⚠️ 数据布局统一为 `Uint8ClampedArray`（RGBA，长度 = W*H*4），与 `ImageData.data` 一致。
 * ⚠️ 唯一无法逐字照抄的地方：参考实现用 `<canvas>` 的 `drawImage` 做降采样与 `filter: blur()` 做羽化，
 *    本文件无 DOM ⇒ 降采样用**面积平均**、羽化用**盒式模糊**实现等价物（已在各自函数处标注）。
 */

/* ══════════════════════════════════════════════════════════════════════════
   通用：常量与小工具
   ══════════════════════════════════════════════════════════════════════════ */

/** 参考实现的 `const n=(t,e,n)=>t<e?e:t>n?n:t`（脚本一开头就定义的三参夹取，js:156） */
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * 鲁棒差核：参考实现 `D()`/`P()` 里统一用的 `n<24?n:24`（html:31851 / html:32112）。
 * 单个像素差封顶 24 ⇒ 一处高对比边缘不会把整块拟合带偏。
 */
const ROBUST_DIFF_CAP = 24;

/**
 * 双线性降采样成**亮度**图 —— 等价参考实现 `S(t,e,n)` 里的
 * `ctx.drawImage(t,0,0,e,n)` + `getImageData` + `0.299r+0.587g+0.114b`（html:31478）。
 * `S()` **没有**设置 `imageSmoothingQuality` ⇒ canvas 默认 `low` = Skia 双线性 2×2。
 * ★ 顺序必须是「先双线性插值 RGB，再算亮度」（canvas 就是这样），不是「先算亮度再插值」——
 *   两者不等价，实测会让金字塔落点偏（用面积平均时 ty 差 59px；换成本实现后与网页版逐位一致）。
 * `dw===w && dh===h` 时走 1:1 快路径（末级金字塔就是全分辨率）。
 */
function lumaDownsample(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  dw: number,
  dh: number,
): Float32Array {
  const out = new Float32Array(dw * dh);
  if (dw === w && dh === h) {
    for (let i = 0, p = 0; i < out.length; i++, p += 4) {
      out[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
    }
    return out;
  }
  const bw = w / dw;
  const bh = h / dh;
  for (let y = 0; y < dh; y++) {
    const v = (y + 0.5) * bh - 0.5;
    const y0 = Math.floor(v);
    const fy = v - y0;
    const ya = clamp(y0, 0, h - 1);
    const yb = clamp(y0 + 1, 0, h - 1);
    for (let x = 0; x < dw; x++) {
      const u = (x + 0.5) * bw - 0.5;
      const x0 = Math.floor(u);
      const fx = u - x0;
      const xa = clamp(x0, 0, w - 1);
      const xb = clamp(x0 + 1, 0, w - 1);
      const pa = (ya * w + xa) * 4;
      const pb = (ya * w + xb) * 4;
      const pc = (yb * w + xa) * 4;
      const pd = (yb * w + xb) * 4;
      let lum = 0;
      for (let c = 0; c < 3; c++) {
        const top = data[pa + c] * (1 - fx) + data[pb + c] * fx;
        const bot = data[pc + c] * (1 - fx) + data[pd + c] * fx;
        /* canvas 把插值结果**取整**成 8bit 再给我们读，亮度是在取整后的通道上算的 */
        const v8 = clamp(Math.round(top * (1 - fy) + bot * fy), 0, 255);
        lum += (c === 0 ? 0.299 : c === 1 ? 0.587 : 0.114) * v8;
      }
      out[y * dw + x] = lum;
    }
  }
  return out;
}

/**
 * 梯度图：参考实现 `S(t,e,n)` 的后半段（html:31478）
 * ```js
 * for(let t=0;t<s;t++,e+=4) r[t]=.299*i[e]+.587*i[e+1]+.114*i[e+2];      // 亮度
 * for(let t=1;t<n-1;t++) for(let n=1;n<e-1;n++){                          // 4-邻域绝对差和
 *   const a=t*e+n; d[a]=Math.abs(r[a+1]-r[a-1])+Math.abs(r[a+e]-r[a-e]); }
 * ```
 * ★ 对齐用的是**边缘强度**而不是灰度值 —— 这样"重渲染导致整体偏色/偏亮"不会影响匹配。
 */
function gradientMap(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  dw: number,
  dh: number,
): Float32Array {
  const lum = lumaDownsample(data, w, h, dw, dh);
  const grad = new Float32Array(dw * dh);
  for (let y = 1; y < dh - 1; y++) {
    for (let x = 1; x < dw - 1; x++) {
      const a = y * dw + x;
      grad[a] = Math.abs(lum[a + 1] - lum[a - 1]) + Math.abs(lum[a + dw] - lum[a - dw]);
    }
  }
  return grad;
}

/** 可分离盒式模糊（用于检测阶段的局部均值，等价参考实现里 canvas 的两趟 1D 均值） */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return src;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      for (let xx = x0; xx <= x1; xx++) {
        sum += src[row + xx];
        n++;
      }
      tmp[row + x] = sum / n;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let n = 0;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      for (let yy = y0; yy <= y1; yy++) {
        sum += tmp[yy * w + x];
        n++;
      }
      out[y * w + x] = sum / n;
    }
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   ① 自动对齐 —— 参考实现 `z()`（html:32609）逐段移植
   ══════════════════════════════════════════════════════════════════════════ */

export interface AlignResult {
  /** 缩放：修改图绘制尺寸 = 原图尺寸 × sx（见 `drawAligned`） */
  sx: number;
  sy: number;
  /** 平移（像素，原图坐标系） */
  tx: number;
  ty: number;
  /** 纹理块拟合残差 RMS（像素）—— 参考 `z()` 的 `$`，> 2.5 提示"两图有局部形变" */
  resid: number;
  mode: '平移' | '平移+缩放';
  /** 参与拟合的纹理块数（参考 `align.blocks`） */
  blocks: number;
}

/** 残差告警线（参考实现 `T()` 里 `o.align.resid>2.5`，html:29226） */
export const ALIGN_RESID_WARN_PX = 2.5;
/** 宽高比差 > 1% ⇒ 判定"两图比例不同，已拉伸"（参考实现 `T()`） */
export const ASPECT_WARN_RATIO = 0.01;
/** 金字塔各级宽度（参考 `[256,512,1024,t].filter(...)`） */
const ALIGN_PYRAMID = [256, 512, 1024];
/** 缩放模型的门槛：`Math.abs(t.a)<=.02` 才认为是"平移 + 缩放"（参考 `z()`） */
const ALIGN_SCALE_TOLERANCE = 0.02;
/** 纹理块最小边长 = `Math.max(160, Math.round(Math.min(W,H)/4))`（参考 `z()`） */
const ALIGN_MIN_BLOCK = 160;
/** 块内搜索半径 ±4（参考 `for(let n=r-4;n<=r+4;n++)`）—— 顶到边上就丢掉该块 */
const ALIGN_BLOCK_RADIUS = 4;
/** 低纹理块剔除线：块内平均梯度 < 0.35 × 全图平均梯度（参考 `m<.35*M`） */
const ALIGN_TEXTURE_FLOOR = 0.35;
/** 拟合至少需要这么多块（参考 `g.length>=6`），否则退化回纯平移 */
const ALIGN_MIN_BLOCKS = 6;
/**
 * 对齐置信度门槛（**参考实现没有，是 MTV 的安全网**）。
 * 位移的「代价」系数：score = err·(1 + λ·|d|/短边)，λ 见下。
 *
 * 实测依据（2026，用户那张"床/草地"图，1440×2560）：算法给出 x=-84.3 / 缩放 100.21%、
 * 6 个纹理块；但页面内独立暴力 NCC 的最优只在 (-9,+20) 且比零位移仅好 4% —— 说明那个
 * 84px 是**重复纹理（草）造成的假峰**。加罚后 84px 需要有 ~6% 的误差优势才算赢。
 */
const ALIGN_SHIFT_PENALTY = 1;
/** 拟合结果的最小相对改善（末道门槛） */
const ALIGN_MIN_GAIN = 0.005;

/**
 * 两幅梯度图的鲁棒平均误差 —— 参考 `D(t,e,n,a,o,i)`（html:31851）逐字移植：
 * ```js
 * const d=Math.max(2,2-o), c=Math.min(n-2,n-2-o), l=Math.max(2,2-i), h=Math.min(a-2,a-2-i);
 * for(let a=l;a<h;a++){ let l2=a*n+d, h2=(a+i)*n+d+o;
 *   for(let n=d;n<c;n++,l2++,h2++){ const v=Math.abs(t[l2]-e[h2]); s+=v<24?v:24; r++; } }
 * ```
 * 约定：`b[x+dx, y+dy]` 与 `a[x, y]` 对齐 ⇒ 返回的是"修改图相对原图被平移了多少"的代价。
 */
function matchError(
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  dx: number,
  dy: number,
): number {
  const x0 = Math.max(2, 2 - dx);
  const x1 = Math.min(w - 2, w - 2 - dx);
  const y0 = Math.max(2, 2 - dy);
  const y1 = Math.min(h - 2, h - 2 - dy);
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    let pa = y * w + x0;
    let pb = (y + dy) * w + x0 + dx;
    for (let x = x0; x < x1; x++, pa++, pb++) {
      const d = Math.abs(a[pa] - b[pb]);
      sum += d < ROBUST_DIFF_CAP ? d : ROBUST_DIFF_CAP;
      n++;
    }
  }
  return n ? sum / n : 1e9;
}

/**
 * 单个纹理块的局部误差 —— 参考 `P(t,e,n,a,o,i,s,r,d,c,l)`（html:32112）逐字移植。
 * 与 `D()` 同构，但只在块的矩形内按 `step` 跳点采样（末级用 step=2 提速）。
 */
function blockError(
  a: Float32Array,
  b: Float32Array,
  w: number,
  h: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dx: number,
  dy: number,
  step: number,
): number {
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y += step) {
    const by = y + dy;
    if (by < 1 || by >= h - 1) continue;
    let pa = y * w + x0;
    let pb = by * w + x0 + dx;
    for (let x = x0; x < x1; x += step, pa += step, pb += step) {
      const bx = x + dx;
      if (bx < 1 || bx >= w - 1) continue;
      const d = Math.abs(a[pa] - b[pb]);
      sum += d < ROBUST_DIFF_CAP ? d : ROBUST_DIFF_CAP;
      n++;
    }
  }
  return n ? sum / n : 1e9;
}

/**
 * 加权最小二乘 —— 参考 `O(t,e,n)`（html:32369）逐字移植：在权重 `n[i]` 下拟合 `e[i] = a·t[i] + b`。
 * ```js
 * const d=a*s-o*o; if(Math.abs(d)<1e-9) return {a:0,b:a?i/a:0};
 * const c=(a*r-o*i)/d; return {a:c,b:(i-c*o)/a};
 * ```
 * （a=Σw, o=Σwx, i=Σwy, s=Σwx², r=Σwxy）
 */
function weightedFit(
  xs: readonly number[],
  ys: readonly number[],
  ws: readonly number[],
): { a: number; b: number } {
  let sw = 0;
  let swx = 0;
  let swy = 0;
  let swxx = 0;
  let swxy = 0;
  for (let i = 0; i < xs.length; i++) {
    const w = ws[i];
    sw += w;
    swx += w * xs[i];
    swy += w * ys[i];
    swxx += w * xs[i] * xs[i];
    swxy += w * xs[i] * ys[i];
  }
  const det = sw * swxx - swx * swx;
  if (Math.abs(det) < 1e-9) return { a: 0, b: sw ? swy / sw : 0 };
  const a = (sw * swxy - swx * swy) / det;
  return { a, b: (swy - a * swx) / sw };
}

/**
 * 自动对齐 —— 参考实现 `async function z()`（html:32609）逐段移植：
 *
 * 1. **金字塔粗搜**：`[256,512,1024,W]` 逐级在**梯度图**上做穷举平移搜索。
 *    第 0 级半径 `max(8, round(0.05×级宽))`，之后每级 `±2`，中心 = 上一级结果按宽度比放大。
 * 2. **纹理块精修**：全分辨率上铺 `max(160, min(W,H)/4)` 的块，扔掉平均梯度
 *    < 0.35×全图均值的"空白块"，每块在全局偏移 ±4 内搜最优，**顶到 ±4 边界的块丢弃**
 *    （那是局部独立运动，不是全局缩放）。
 * 3. **加权最小二乘**：拟合"偏移 = a·位置 + b"（权重 = 块纹理强度）。
 *    `|a| ≤ 0.02` 才接受缩放模型，`sx = 1/(1+a)`、`tx = −b/(1+a)`；
 *    否则退化回纯平移（scale=1）。
 * 4. **残差** = 块偏移的 RMS（像素）。
 *
 * ★ 与 MTV 旧实现的差别（旧的错了）：
 *    · 旧的在**灰度值**上匹配 ⇒ 整体偏色/偏亮会把匹配带偏；参考用**边缘强度**。
 *    · 旧的把"最优解"当成可累积的游标在双层循环里反复 `best.dx += dx`
 *      ⇒ 每级实际步长可达 9×(±4) 的漂移，实测出现过 tx=−270（真值 −84）这种发散。
 *    · 旧的缩放是"把原图按 k 缩小再和修改图零偏移比误差"，丢了平移自由度，
 *      且 k 的语义反了（原图缩 k ⇔ 修改图需放大 1/k）。
 *    · 旧的 `resid` 是灰度平均绝对差（0..255 量纲），不是像素残差 ⇒ `>2.5` 告警永远成立。
 */
export function alignImages(
  orig: Uint8ClampedArray,
  mod: Uint8ClampedArray,
  w: number,
  h: number,
): AlignResult {
  const W = Math.max(8, Math.round(w));
  const H = Math.max(8, Math.round(h));

  const levels = [...ALIGN_PYRAMID, W]
    .filter((v, i, arr) => v <= W && arr.indexOf(v) === i)
    .sort((a, b) => a - b);

  let offX = 0;
  let offY = 0;
  let prevW = 0;
  let origGrad: Float32Array | null = null;
  let modGrad: Float32Array | null = null;

  for (let li = 0; li < levels.length; li++) {
    const lw = levels[li];
    const lh = Math.max(8, Math.round((H * lw) / W));
    const gOrig = gradientMap(orig, W, H, lw, lh);
    const gMod = gradientMap(mod, W, H, lw, lh);

    let radius: number;
    if (li === 0) {
      radius = Math.max(8, Math.round(0.05 * lw));
    } else {
      const k = lw / prevW;
      offX = Math.round(offX * k);
      offY = Math.round(offY * k);
      radius = 2;
    }

    let bestErr = Infinity;
    let bestX = offX;
    let bestY = offY;
    for (let dy = offY - radius; dy <= offY + radius; dy++) {
      for (let dx = offX - radius; dx <= offX + radius; dx++) {
        const err = matchError(gOrig, gMod, lw, lh, dx, dy);
        if (err < bestErr) {
          bestErr = err;
          bestX = dx;
          bestY = dy;
        }
      }
    }
    offX = bestX;
    offY = bestY;
    prevW = lw;
    origGrad = gOrig;
    modGrad = gMod;
  }

  /* 末级金字塔就是全分辨率 ⇒ 它的梯度图直接拿来铺纹理块（参考实现同样复用了 `c`/`l`）。 */
  const gOrig = origGrad;
  const gMod = modGrad;
  if (!gOrig || !gMod) {
    return { sx: 1, sy: 1, tx: -offX, ty: -offY, resid: 0, mode: '平移', blocks: 0 };
  }

  /* ── 置信度门槛（MTV 安全网，参考实现没有）──────────────────────────────
     只比「误差更好」是不够的：草地/砖墙这类**重复纹理**会让 84px 这种大位移也匹配得上
     （实测：全图像素都在变背景替换模式，梯度误差在 -84 处并不比 0 差多少），
     结果把前景一起带歪 ⇒ 用户看到「两张图没对齐」。
     所以改用**带位移惩罚的分数**：score(d) = err(d) · (1 + λ·|d| / min(W,H))。
     λ=1 ⇒ 位移每占短边 1%，误差要多改善 1% 才算赢；真位移（误差接近 0）照样赢。 */
  const errAtZero = matchError(gOrig, gMod, W, H, 0, 0);
  const errAtChosen = matchError(gOrig, gMod, W, H, offX, offY);
  const shiftPenalty = 1 + (Math.hypot(offX, offY) / Math.min(W, H)) * ALIGN_SHIFT_PENALTY;
  if (!(errAtChosen * shiftPenalty < errAtZero)) {
    /* 位移输给"不动" ⇒ 这张图**就不该做全局对齐**（背景被整片换掉了），
       直接返回恒等，别再用纹理块去拟合噪声。 */
    return { sx: 1, sy: 1, tx: 0, ty: 0, resid: 0, mode: '平移', blocks: 0 };
  }

  /* ── 全图平均梯度（参考：`for(let t=0;t<c.length;t+=7)M+=c[t]`） ── */
  let meanGrad = 0;
  let samples = 0;
  for (let i = 0; i < gOrig.length; i += 7) {
    meanGrad += gOrig[i];
    samples++;
  }
  meanGrad = samples ? meanGrad / samples : 0;

  const blockSize = Math.max(ALIGN_MIN_BLOCK, Math.round(Math.min(W, H) / 4));
  const nx = Math.max(1, Math.floor((W - 16) / blockSize));
  const ny = Math.max(1, Math.floor((H - 16) / blockSize));
  const ox = Math.floor((W - nx * blockSize) / 2);
  const oy = Math.floor((H - ny * blockSize) / 2);

  const cx: number[] = [];
  const cy: number[] = [];
  const bx: number[] = [];
  const by: number[] = [];
  const bw: number[] = [];

  for (let row = 0; row < ny; row++) {
    for (let col = 0; col < nx; col++) {
      const x0 = ox + col * blockSize;
      const y0 = oy + row * blockSize;
      const x1 = x0 + blockSize;
      const y1 = y0 + blockSize;

      /* 块纹理强度（参考：`for(let e=s;e<u;e+=4) for(let n=i;n<d;n+=4) m+=c[e*t+n]`，step 4） */
      let sum = 0;
      let n = 0;
      for (let y = y0; y < y1; y += 4) {
        for (let x = x0; x < x1; x += 4) {
          sum += gOrig[y * W + x];
          n++;
        }
      }
      const tex = n ? sum / n : 0;
      if (tex < ALIGN_TEXTURE_FLOOR * meanGrad) continue;

      let bestErr = Infinity;
      let bestX = offX;
      let bestY = offY;
      for (let dy = offY - ALIGN_BLOCK_RADIUS; dy <= offY + ALIGN_BLOCK_RADIUS; dy++) {
        for (let dx = offX - ALIGN_BLOCK_RADIUS; dx <= offX + ALIGN_BLOCK_RADIUS; dx++) {
          const err = blockError(gOrig, gMod, W, H, x0, y0, x1, y1, dx, dy, 2);
          if (err < bestErr) {
            bestErr = err;
            bestX = dx;
            bestY = dy;
          }
        }
      }
      /* 顶到搜索边界 ⇒ 该块的位移超出全局模型（局部独立运动），按参考实现丢弃 */
      if (
        Math.abs(bestX - offX) >= ALIGN_BLOCK_RADIUS ||
        Math.abs(bestY - offY) >= ALIGN_BLOCK_RADIUS
      ) {
        continue;
      }
      cx.push((x0 + x1) / 2);
      cy.push((y0 + y1) / 2);
      bx.push(bestX);
      by.push(bestY);
      bw.push(tex);
    }
  }

  if (cx.length >= ALIGN_MIN_BLOCKS) {
    const fx = weightedFit(cx, bx, bw);
    const fy = weightedFit(cy, by, bw);
    if (Math.abs(fx.a) <= ALIGN_SCALE_TOLERANCE && Math.abs(fy.a) <= ALIGN_SCALE_TOLERANCE) {
      let acc = 0;
      for (let i = 0; i < cx.length; i++) {
        const ex = bx[i] - (fx.a * cx[i] + fx.b);
        const ey = by[i] - (fy.a * cy[i] + fy.b);
        acc += ex * ex + ey * ey;
      }
      const fitTx = -fx.b / (1 + fx.a);
      const fitTy = -fy.b / (1 + fy.a);
      /* 末道置信度门槛：拟合出来的位移也要比「不动」明显更好，否则说明这些块本来就是噪声匹配
         （实测那张「床/草地」：6 块拟合出 x=-84.3、缩放 100.21%，但全图误差并不比不动更低） */
      const errFit = matchError(gOrig, gMod, W, H, Math.round(fitTx), Math.round(fitTy));
      if (errFit < errAtZero * (1 - ALIGN_MIN_GAIN)) {
        return {
          sx: 1 / (1 + fx.a),
          sy: 1 / (1 + fy.a),
          tx: fitTx,
          ty: fitTy,
          resid: Math.sqrt(acc / cx.length),
          mode: '平移+缩放',
          blocks: cx.length,
        };
      }
    }
  }

  /* 退化：纯平移（参考实现里 `L=0,E=a,C=0,I=r` ⇒ sx=sy=1、tx=−a、ty=−r） */
  return {
    sx: 1,
    sy: 1,
    tx: -offX,
    ty: -offY,
    resid: 0,
    mode: '平移',
    blocks: cx.length,
  };
}

/**
 * 把「修改图」按对齐结果画进一张 **原图尺寸** 的画布。
 * 参考实现 `W()`（html:31326）：`p.aiRaw.drawImage(o.aiBmp, t.tx, t.ty, o.W*t.sx, o.H*t.sy)`
 * —— 无论修改图原本多大，都拉伸/缩放到原图的 W×H 再叠加变换。
 */
export function drawAligned(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  origW: number,
  origH: number,
  align: AlignResult,
): void {
  ctx.clearRect(0, 0, origW, origH);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, align.tx, align.ty, origW * align.sx, origH * align.sy);
}

/* ══════════════════════════════════════════════════════════════════════════
   ② 自动校色 —— 参考实现 `q()`（html:34634）
   ══════════════════════════════════════════════════════════════════════════ */

export interface ColorCorrection {
  computed: boolean;
  gain: [number, number, number];
  offset: [number, number, number];
  /** 每通道偏色（仅用于展示：修改图 − 原图） */
  cast: [number, number, number];
  /** 有效样本占比（0..1） */
  sampled: number;
}

/** 增益夹取范围（参考实现 `q()`：`n(Math.sqrt(i/s), .85, 1.18)`，html:34634） */
export const CORR_GAIN_MIN = 0.85;
export const CORR_GAIN_MAX = 1.18;
/** 「看起来没变」的判定：`|ΔR|+|ΔG|+|ΔB| ≤ 96`（参考实现 `q()`） */
export const CORR_SAME_PIXEL_DIFF = 96;
/** 样本不足就放弃校色（参考实现 `q()`：`if(m<500)`） */
export const CORR_MIN_SAMPLES = 500;
/** 采样上限：把总采样点数压到 ~400k（参考实现 `q()`：`d = max(1, floor(a/4e5))`） */
export const CORR_SAMPLE_BUDGET = 400000;

/**
 * 自动校色 —— 参考实现 `q()` 逐条：
 * ```js
 * const d=Math.max(1,Math.floor(a/4e5));                        // 采样步长
 * if(s[e+3]<250) continue;                                      // 修改图透明处不算
 * if(r[e+3]>8 || |ΔR|+|ΔG|+|ΔB| > 96) continue;                 // 蒙版内 / 明显改过的不算
 * gain[t]=n(Math.sqrt(varOrig/varMod), .85, 1.18);
 * offset[t]=meanOrig - gain·meanMod;  cast[t]=meanMod-meanOrig;
 * ```
 * ⇒ **逐通道"均值 + 标准差"匹配**（不是直方图匹配、没有 gamma），只在**未改动像素**上统计，
 *    增益夹在 [0.85, 1.18] 防止整块改色时把修改图拉爆。
 */
export function computeColorCorrection(
  orig: Uint8ClampedArray,
  mod: Uint8ClampedArray,
  mask: Uint8ClampedArray | null,
  w: number,
  h: number,
): ColorCorrection {
  const total = w * h;
  const stride = Math.max(1, Math.floor(total / CORR_SAMPLE_BUDGET));

  const sumO = [0, 0, 0];
  const sumM = [0, 0, 0];
  const sqO = [0, 0, 0];
  const sqM = [0, 0, 0];
  let samples = 0;
  let visited = 0;

  for (let i = 0; i < total; i += stride) {
    const p = 4 * i;
    visited++;
    if (mod[p + 3] < 250) continue;
    if (mask && mask[p + 3] > 8) continue;
    const d =
      Math.abs(mod[p] - orig[p]) +
      Math.abs(mod[p + 1] - orig[p + 1]) +
      Math.abs(mod[p + 2] - orig[p + 2]);
    if (d > CORR_SAME_PIXEL_DIFF) continue;
    for (let c = 0; c < 3; c++) {
      const o = orig[p + c];
      const m = mod[p + c];
      sumO[c] += o;
      sumM[c] += m;
      sqO[c] += o * o;
      sqM[c] += m * m;
    }
    samples++;
  }

  if (samples < CORR_MIN_SAMPLES) {
    return { computed: true, gain: [1, 1, 1], offset: [0, 0, 0], cast: [0, 0, 0], sampled: 0 };
  }

  const gain: [number, number, number] = [1, 1, 1];
  const offset: [number, number, number] = [0, 0, 0];
  const cast: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const meanO = sumO[c] / samples;
    const meanM = sumM[c] / samples;
    // 参考实现用 Math.max(1, var) 兜底，防止方差为 0 时除零
    const varO = Math.max(1, sqO[c] / samples - meanO * meanO);
    const varM = Math.max(1, sqM[c] / samples - meanM * meanM);
    const g = clamp(Math.sqrt(varO / varM), CORR_GAIN_MIN, CORR_GAIN_MAX);
    gain[c] = g;
    offset[c] = meanO - g * meanM;
    cast[c] = meanM - meanO;
  }
  return { computed: true, gain, offset, cast, sampled: visited ? samples / visited : 0 };
}

/**
 * 把校色结果应用到「修改图」的**副本**上（不改原数组）。
 * 参考实现 `j()`（html:35849）建的是 256 项 LUT：
 * `a[o]=o+e*(i-o)+t.manual[n]`，其中 `i=gain*o+offset`、`e=corr.k`（强度）、`manual` 是手调偏移。
 */
export function applyColorCorrection(
  mod: Uint8ClampedArray,
  corr: ColorCorrection,
  strength = 1,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mod);
  if (!corr.computed || strength <= 0) return out;
  const k = clamp(strength, 0, 1);
  for (let p = 0; p < out.length; p += 4) {
    if (out[p + 3] === 0) continue; // 全透明像素不动
    for (let c = 0; c < 3; c++) {
      const v = out[p + c];
      const corrected = v * corr.gain[c] + corr.offset[c];
      out[p + c] = v + (corrected - v) * k;
    }
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   ③ 改动检测 —— 参考实现 `K()`（html:36221）
   ══════════════════════════════════════════════════════════════════════════ */

export interface NoiseStats {
  /** 自适应阈值：max(6, median + 8·max(0.5, MAD)) */
  threshold: number;
  median: number;
  mad: number;
}

/** 参考实现 `g()`：`T = Math.max(6, med + 8*Math.max(.5, mad))`（html:36221 内） */
export const NOISE_MIN_THRESHOLD = 6;
export const NOISE_MAD_SCALE = 8;
/** 自动采纳门槛：连通域平均超阈 ≥ 1.4（参考 `t.strong=S(t,1.4)`） */
export const AUTO_ADOPT_MEAN_EXCESS = 1.4;
/** 「敢自动采用」的触发条件一：第一名面积 ≥ 全图 **0.2%**（参考 `D[0].area>=.002*c`） */
export const AUTO_ADOPT_MIN_AREA_SHARE = 0.002;
/** 触发条件二：高强度区域 **≥ 3 处**（参考 `D.length>=3`） */
export const AUTO_ADOPT_MIN_STRONG_COUNT = 3;
/** 弱候选门槛：`mean ∈ [1.0, 1.4)`（参考 `!t.strong&&!t.shift&&t.mean>=1`） */
export const FAINT_MIN_MEAN_EXCESS = 1.0;
/** 高强度 / 弱候选各自的截断（参考 `.slice(0, 40)` / `.slice(0, 12)`） */
export const STRONG_MAX = 40;
export const FAINT_MAX = 12;
/** 不敢自动采用时只标前 5 名（参考 `R.filter(t=>!t.shift).slice(0, 5)`） */
export const CANDIDATE_MAX = 5;
/** 采用超过这个数就**不再画框**（参考 `if(P&&D.length>5) O.forEach(t=>{t.strong=!0})`） */
export const BOX_MAX_ADOPTED = 5;
/** 背景替换模式判定：模糊后差值 > 20 的像素占比 ≥ 0.3（参考 `K()` 的 `L>=.3`） */
export const BG_MODE_SHARE = 0.3;
export const BG_MODE_DIFF = 20;
/** 连通域最小面积：`Math.max(6, 5e-5*c)`（参考 `F=Math.max(6,5e-5*c)`） */
const MIN_REGION_AREA = 6;
/** 统计噪声时排除边缘的比例（参考 `p=Math.max(2,Math.ceil(.01*Math.min(s,d)))` —— **1%**） */
const NOISE_BORDER_RATIO = 0.01;
/** 鬼影（配准残差）判定：±3 像素内某个平移能把平均差降到 45% 以下（参考 `o<.45*a`） */
const GHOST_SHIFT_RANGE = 3;
const GHOST_SHIFT_RATIO = 0.45;

function medianAndMad(values: Float32Array): { median: number; mad: number; sorted: Float32Array } {
  const sorted = Float32Array.from(values).sort();
  const median = sorted[sorted.length >> 1] ?? 0;
  const dev = Float32Array.from(values, (v) => Math.abs(v - median)).sort();
  return { median, mad: dev[dev.length >> 1] ?? 0, sorted };
}

/**
 * 由差值分布推出噪声阈值。
 * 参考实现 `g(t)`：先剔掉边缘（`f()`，1% 边），再取中位数与绝对中位差（MAD）。
 */
export function computeNoiseStats(diff: Float32Array, w: number, h: number): NoiseStats {
  const border = Math.max(2, Math.ceil(NOISE_BORDER_RATIO * Math.min(w, h)));
  const inner: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < border || y < border || x >= w - border || y >= h - border) continue;
      inner.push(diff[y * w + x]);
    }
  }
  const stats = medianAndMad(Float32Array.from(inner));
  return {
    threshold: Math.max(
      NOISE_MIN_THRESHOLD,
      stats.median + NOISE_MAD_SCALE * Math.max(0.5, stats.mad),
    ),
    median: stats.median,
    mad: stats.mad,
  };
}

/**
 * 二值形态学（可分离），等价参考实现里的 `_(t,e,n,a,o)`（html:41995）：
 * `o=1` 膨胀、`o=0` 腐蚀，重复 `a` 次（参考实现内部是 1 次 2a+1 窗口，等价）。
 */
function morph(
  mask: Uint8Array,
  w: number,
  h: number,
  radius: number,
  mode: 'erode' | 'dilate',
): Uint8Array {
  let cur = mask;
  for (let pass = 0; pass < radius; pass++) {
    const next = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let hit = 0;
        for (let dy = -1; dy <= 1 && !hit; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (cur[yy * w + xx]) {
              hit = 1;
              break;
            }
          }
        }
        if (mode === 'dilate') {
          next[i] = hit;
        } else {
          let all = 1;
          for (let dy = -1; dy <= 1 && all; dy++) {
            const yy = y + dy;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = x + dx;
              if (yy < 0 || yy >= h || xx < 0 || xx >= w || !cur[yy * w + xx]) {
                all = 0;
                break;
              }
            }
          }
          next[i] = all;
        }
      }
    }
    cur = next;
  }
  return cur;
}

export interface ChangedRegion {
  /** 连通域编号（= `det.labels` 里的取值，`maskFromRegions` 用它取真实形状） */
  id: number;
  /** 合并进来的所有连通域编号 */
  componentIds: number[];
  area: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  /** 平均超阈倍数（≥ 1.4 才自动采纳；参考 `mass/area`） */
  meanExcess: number;
  /** 强度总和（参考 `mass`，排序与"第一名/第二名"比值都用它） */
  mass: number;
  /** 配准鬼影（±3px 内某个平移能显著降低差异）⇒ 不是真改动，排除出候选 */
  shift: boolean;
  /** 平移补偿后残余差异的下降比例（参考 `shiftGain`，仅展示/调试用） */
  shiftGain?: number;
  adopted: boolean;
}

export interface ChangeDetection {
  dw: number;
  dh: number;
  /** 逐像素归一化分数（检测分辨率，长度 dw*dh） */
  score: Float32Array;
  regions: ChangedRegion[];
  noise: NoiseStats;
  /** 整图重渲染 ⇒ 反过来保留未变前景（参考 `bgMode`） */
  bgMode: boolean;
  /** 第一名 / 第二名的**强度**比（参考 `N[0].mass/N[1].mass`，不够大就不敢自动采纳） */
  dominance: number;
  /** 检测分辨率的连通域标签（-1 = 非改动） */
  labels: Int32Array;
  /** 背景替换模式的掩码：1 = 换成修改图（检测分辨率；参考 `det.bgMask`） */
  bgMask: Uint8Array | null;
  /** 背景替换模式下保留的未变前景块数（参考 `keepCount`） */
  keepCount: number;
  /** 模糊后差值 > 20 的像素占比（参考 `changedShare`，百分比整数） */
  changedShare: number;
  /** 复用蒙版时应加的羽化半径（**原图像素**；参考 `X()`/`J()` 的 `blur(px)`） */
  maskBlurPx: number;
}

/**
 * 改动检测 —— 参考实现 `K()`（html:36221）逐段移植。两路信号：
 *   · `y[i] = max_c |blur1(原图_c) − blur1(修改图_c)|`   ← 抑制 JPEG/重渲染噪点的逐通道模糊差
 *   · `v[i] = box2( (|ΔR|+|ΔG|+|ΔB|)/3 )`               ← 平均差再做半径 2 的模糊
 * 各自用 `g()`（中位数 + 8×MAD）定阈值，归一后取最大 ⇒ `score = max(y/Ty, v/Tv)`。
 *
 * 之后分两支（与参考实现同构）：
 *   · **背景替换模式**（`changedShare ≥ 30%`）：整张图都变了 ⇒ 反面框架：找出"没变"的块并保留，
 *     其余全换成修改图（参考 `Y()` → `X(det.bgMask, det.bgFeather)`）。MTV 旧版**只把这句当文案**，
 *     掩码仍为空 ⇒ 用户那张"AI 重渲染"的图在 MTV 上等于什么都没识别出来。
 *   · **局部改动**：连通域 → **合并邻近块** → **鬼影剔除** → 强/弱候选（参考 `R`/`shift`/`strong`）。
 *
 * ★ 鬼影剔除（`shift`）是"识别准不准"的关键：对齐差 1–2 像素时，每个边缘都会变成一条
 *   "改动"（一条细线）。参考实现把每个连域在 ±3px 内平移找更低的差，能降到 <45% 的
 *   判为配准残差、直接排除。MTV 旧版没有这一步 ⇒ 框全落在物体的轮廓线上。
 */
export function detectChanges(
  orig: Uint8ClampedArray,
  mod: Uint8ClampedArray,
  w: number,
  h: number,
): ChangeDetection {
  /* 检测分辨率：长边 ≈ 1024（参考 `n=max(1,round(max(W,H)/1024))`） */
  const factor = Math.max(1, Math.round(Math.max(w, h) / 1024));
  const dw = Math.max(16, Math.round(w / factor));
  const dh = Math.max(16, Math.round(h / factor));
  const total = dw * dh;

  /* 面积平均降采样（等价参考 `drawImage` 的 bilinear，且更抗混叠） */
  const sample = (src: Uint8ClampedArray): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(dw * dh * 4);
    const bw = w / dw;
    const bh = h / dh;
    for (let y = 0; y < dh; y++) {
      const sy0 = Math.floor(y * bh);
      const sy1 = Math.min(h, Math.max(sy0 + 1, Math.floor((y + 1) * bh)));
      for (let x = 0; x < dw; x++) {
        const sx0 = Math.floor(x * bw);
        const sx1 = Math.min(w, Math.max(sx0 + 1, Math.floor((x + 1) * bw)));
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        let n = 0;
        for (let yy = sy0; yy < sy1; yy++) {
          let p = (yy * w + sx0) * 4;
          for (let xx = sx0; xx < sx1; xx++, p += 4) {
            r += src[p];
            g += src[p + 1];
            b += src[p + 2];
            a += src[p + 3];
            n++;
          }
        }
        const dp = (y * dw + x) * 4;
        out[dp] = n ? r / n : 0;
        out[dp + 1] = n ? g / n : 0;
        out[dp + 2] = n ? b / n : 0;
        out[dp + 3] = n ? a / n : 0;
      }
    }
    return out;
  };

  const so = sample(orig);
  const sm = sample(mod);

  /* ① 逐通道半径 1 模糊后的差，取 RGB 最大（参考 `y`） */
  const y = new Float32Array(total);
  for (let c = 0; c < 3; c++) {
    const o = new Float32Array(total);
    const m = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      o[i] = so[i * 4 + c];
      m[i] = sm[i * 4 + c];
    }
    const bo = boxBlur(o, dw, dh, 1);
    const bm = boxBlur(m, dw, dh, 1);
    for (let i = 0; i < total; i++) {
      if (sm[i * 4 + 3] < 250) continue;
      const d = Math.abs(bo[i] - bm[i]);
      if (d > y[i]) y[i] = d;
    }
  }

  /* ② 逐像素平均绝对差（参考 `x`），再半径 2 模糊（参考 `v=m(x,2)`） */
  const px = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const p = i * 4;
    px[i] =
      sm[p + 3] < 250
        ? 0
        : (Math.abs(so[p] - sm[p]) + Math.abs(so[p + 1] - sm[p + 1]) + Math.abs(so[p + 2] - sm[p + 2])) / 3;
  }
  const v = boxBlur(px, dw, dh, 2);

  const noiseY = computeNoiseStats(y, dw, dh);
  const noiseV = computeNoiseStats(v, dw, dh);
  /* 展示用：参考实现把 `M`（v 的噪声统计）当作 `det.noise` */
  const noise = noiseV;

  const border = Math.max(2, Math.ceil(NOISE_BORDER_RATIO * Math.min(dw, dh)));

  /* ③ 背景替换模式判定：模糊后差 > 20 的占比（参考 `L=1-(第一个>20的下标+1)/len`） */
  let changed = 0;
  let counted = 0;
  for (let yIdx = 0; yIdx < dh; yIdx++) {
    for (let xIdx = 0; xIdx < dw; xIdx++) {
      if (xIdx < border || yIdx < border || xIdx >= dw - border || yIdx >= dh - border) continue;
      counted++;
      if (v[yIdx * dw + xIdx] > BG_MODE_DIFF) changed++;
    }
  }
  const changedShare = counted ? (100 * changed) / counted : 0;
  const bgMode = counted > 0 && changed / counted >= BG_MODE_SHARE;

  const cleanBorder = (arr: Float32Array) => {
    for (let yIdx = 0; yIdx < dh; yIdx++) {
      for (let xIdx = 0; xIdx < dw; xIdx++) {
        if (xIdx < border || yIdx < border || xIdx >= dw - border || yIdx >= dh - border) {
          arr[yIdx * dw + xIdx] = 0;
        }
      }
    }
  };

  /* ─────────── 背景替换模式（参考 `Y()` + `X()`） ─────────── */
  if (bgMode) {
    const sorted = Float32Array.from(computedSorted(v, dw, dh, border));
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
    /* 未变阈值：`max(12, q(.2) + 4*max(.5, q(.4)-q(.2)))` */
    const thresh = Math.max(12, q(0.2) + 4 * Math.max(0.5, q(0.4) - q(0.2)));
    let kept: Uint8Array = new Uint8Array(total);
    for (let i = 0; i < total; i++) kept[i] = v[i] < thresh ? 1 : 0;
    for (let yIdx = 0; yIdx < dh; yIdx++) {
      for (let xIdx = 0; xIdx < dw; xIdx++) {
        if (xIdx < border || yIdx < border || xIdx >= dw - border || yIdx >= dh - border) {
          kept[yIdx * dw + xIdx] = 0;
        }
      }
    }
    /* 开运算（腐蚀 2 → 膨胀 2）吃掉椒盐，再闭运算（膨胀 3 → 腐蚀 3）填孔（参考 `_` 链） */
    kept = morph(morph(kept, dw, dh, 2, 'erode'), dw, dh, 2, 'dilate');
    kept = morph(morph(kept, dw, dh, 3, 'dilate'), dw, dh, 3, 'erode');

    /* 只保留面积 ≥ 1% 的"没变的前景块"（参考 `t>=.01*c`） */
    const { labels: keptLabels, sizes } = labelComponents(kept, dw, dh);
    const keepIds = new Set<number>();
    sizes.forEach((size, id) => {
      if (size >= 0.01 * total) keepIds.add(id);
    });
    for (let i = 0; i < total; i++) {
      kept[i] = keptLabels[i] >= 0 && keepIds.has(keptLabels[i]) ? 1 : 0;
    }

    /* 前景再腐蚀 u ⇒ 剩下的"没变"区域之外全部换成修改图（参考 `u=max(1,round(.004*min(s,d)))`） */
    const u = Math.max(1, Math.round(0.004 * Math.min(dw, dh)));
    const solid = morph(kept, dw, dh, u, 'erode');
    const bgMask = new Uint8Array(total);
    for (let i = 0; i < total; i++) bgMask[i] = solid[i] ? 0 : 1;

    const score = new Float32Array(total);
    for (let i = 0; i < total; i++) score[i] = bgMask[i] ? 2 : 0;

    return {
      dw,
      dh,
      score,
      regions: [],
      noise,
      bgMode: true,
      dominance: 0,
      labels: new Int32Array(total).fill(-1),
      bgMask,
      keepCount: keepIds.size,
      changedShare: Math.round(changedShare),
      /* 参考 `bgFeather=u*n`（原图分辨率），X() 用它做 `filter: blur()` */
      maskBlurPx: u * factor,
    };
  }

  /* ─────────── 局部改动：归一化分数 + 连通域 ─────────── */
  const score = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    score[i] = Math.max(y[i] / noiseY.threshold, v[i] / noiseV.threshold);
  }
  cleanBorder(score);

  const raw = new Uint8Array(total);
  for (let i = 0; i < total; i++) raw[i] = score[i] > 1 ? 1 : 0;

  /* 开运算吃掉椒盐点（参考：不这么做连通域会炸成几千个） */
  const solid = morph(morph(raw, dw, dh, 2, 'erode'), dw, dh, 2, 'dilate');

  const { labels, comps } = labelComponents(solid, dw, dh, score);
  const minArea = Math.max(MIN_REGION_AREA, 5e-5 * total);

  /* 合并容差（参考 `T=Math.ceil(1.5*max(4,round(.012*min(W,H)))/n)`，检测分辨率像素） */
  const mergeTol = Math.ceil((1.5 * Math.max(4, Math.round(0.012 * Math.min(w, h)))) / factor);

  type Raw = {
    id: number;
    mass: number;
    area: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  };
  const rawRegions: Raw[] = comps
    .filter((c) => c.area >= minArea)
    .sort((a, b) => b.mass - a.mass)
    .slice(0, 60);

  const topMass = rawRegions.length ? rawRegions[0].mass : 0;
  const mergeFloor = 0.15 * topMass;
  const merged: (Raw & { ids: number[] })[] = [];
  for (const r of rawRegions) {
    let target: (Raw & { ids: number[] }) | null = null;
    if (r.mass >= mergeFloor) {
      target =
        merged.find(
          (m) =>
            m.mass >= mergeFloor &&
            r.x0 - mergeTol <= m.x1 + mergeTol &&
            r.x1 + mergeTol >= m.x0 - mergeTol &&
            r.y0 - mergeTol <= m.y1 + mergeTol &&
            r.y1 + mergeTol >= m.y0 - mergeTol,
        ) ?? null;
    }
    if (target) {
      target.ids.push(r.id);
      target.mass += r.mass;
      target.area += r.area;
      target.x0 = Math.min(target.x0, r.x0);
      target.y0 = Math.min(target.y0, r.y0);
      target.x1 = Math.max(target.x1, r.x1);
      target.y1 = Math.max(target.y1, r.y1);
    } else {
      merged.push({ ...r, ids: [r.id] });
    }
  }
  merged.sort((a, b) => b.mass - a.mass);

  /* 鬼影剔除：在 ±3px 内找一个能显著降低差异的平移 ⇒ 这块其实是"没对齐" */
  const labelOf = new Map<number, Raw>();
  for (const c of comps) labelOf.set(c.id, c);
  const localMeanDiff = (box: { x0: number; y0: number; x1: number; y1: number }, dx: number, dy: number, ids: Set<number>) => {
    let sum = 0;
    let n = 0;
    for (let yIdx = box.y0; yIdx <= box.y1; yIdx++) {
      const sy = yIdx + dy;
      if (sy < 0 || sy >= dh) continue;
      for (let xIdx = box.x0; xIdx <= box.x1; xIdx++) {
        const sx = xIdx + dx;
        if (sx < 0 || sx >= dw) continue;
        const li = yIdx * dw + xIdx;
        if (!ids.has(labels[li])) continue;
        const sp = li * 4;
        const tp = (sy * dw + sx) * 4;
        if (sm[tp + 3] < 250) continue;
        sum +=
          Math.abs(so[sp] - sm[tp]) + Math.abs(so[sp + 1] - sm[tp + 1]) + Math.abs(so[sp + 2] - sm[tp + 2]);
        n++;
      }
    }
    return n ? sum / n : 0;
  };

  const regions: ChangedRegion[] = merged.map((m) => {
    const mean = m.area ? m.mass / m.area : 0;
    const ids = new Set(m.ids);
    let shift = false;
    let shiftGain: number | undefined;
    if (mean >= 1) {
      const base = localMeanDiff(m, 0, 0, ids);
      if (base > 0) {
        let best = base;
        for (let dy = -GHOST_SHIFT_RANGE; dy <= GHOST_SHIFT_RANGE; dy++) {
          for (let dx = -GHOST_SHIFT_RANGE; dx <= GHOST_SHIFT_RANGE; dx++) {
            if (!dx && !dy) continue;
            const val = localMeanDiff(m, dx, dy, ids);
            if (val < best) best = val;
          }
        }
        if (best < GHOST_SHIFT_RATIO * base) {
          shift = true;
          shiftGain = +(1 - best / base).toFixed(2);
        }
      }
    }
    return {
      id: m.ids[0],
      componentIds: m.ids,
      area: m.area,
      minX: m.x0,
      minY: m.y0,
      maxX: m.x1,
      maxY: m.y1,
      meanExcess: mean,
      mass: m.mass,
      shift,
      shiftGain,
      adopted: false,
    };
  });

  /* 第一名 / 第二名强度比（参考 `U=N[0].mass/(N[1]?N[1].mass:.01*N[0].mass)`） */
  const top = merged.slice(0, 5);
  const dominance = top.length
    ? +(top[0].mass / (top[1] ? top[1].mass : 0.01 * top[0].mass)).toFixed(1)
    : 0;

  /* 检测到改动后，蒙版羽化半径（参考 `X(t.bgMask, l/2)` 里 `l=round(c/2)`、`c≈1.2%短边`） */
  const featherBase = Math.max(4, Math.round(0.012 * Math.min(w, h)));
  const maskBlurPx = Math.round(featherBase / 2);

  return {
    dw,
    dh,
    score,
    regions,
    noise,
    bgMode: false,
    dominance,
    labels,
    bgMask: null,
    keepCount: 0,
    changedShare: Math.round(changedShare),
    maskBlurPx,
  };
}

/** 取非边缘像素值的升序快照（参考 `g()` 里构造的 `sorted`） */
function computedSorted(v: Float32Array, w: number, h: number, border: number): Float32Array {
  const inner: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < border || y < border || x >= w - border || y >= h - border) continue;
      inner.push(v[y * w + x]);
    }
  }
  return Float32Array.from(inner).sort();
}

interface ComponentInfo {
  id: number;
  area: number;
  mass: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * 四邻域连通域（栈式，参考实现的写法），同时累计 `mass = Σ(E−1)` 与包围盒。
 * `score` 省略时 `mass` 记作 `area`（背景替换模式只用到面积）。
 */
function labelComponents(
  mask: Uint8Array,
  w: number,
  h: number,
  score?: Float32Array,
): { labels: Int32Array; comps: ComponentInfo[]; sizes: number[] } {
  const total = w * h;
  const labels = new Int32Array(total).fill(-1);
  const stack = new Int32Array(total);
  const comps: ComponentInfo[] = [];
  for (let start = 0; start < total; start++) {
    if (labels[start] >= 0 || !mask[start]) continue;
    const id = comps.length;
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    let area = 0;
    let mass = 0;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    while (top) {
      const i = stack[--top];
      area++;
      mass += score ? score[i] - 1 : 1;
      const x = i % w;
      const y = (i - x) / w;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const nb0 = x > 0 ? i - 1 : -1;
      const nb1 = x < w - 1 ? i + 1 : -1;
      const nb2 = i - w;
      const nb3 = i + w;
      if (nb0 >= 0 && labels[nb0] < 0 && mask[nb0]) {
        labels[nb0] = id;
        stack[top++] = nb0;
      }
      if (nb1 >= 0 && labels[nb1] < 0 && mask[nb1]) {
        labels[nb1] = id;
        stack[top++] = nb1;
      }
      if (nb2 >= 0 && labels[nb2] < 0 && mask[nb2]) {
        labels[nb2] = id;
        stack[top++] = nb2;
      }
      if (nb3 < total && labels[nb3] < 0 && mask[nb3]) {
        labels[nb3] = id;
        stack[top++] = nb3;
      }
    }
    comps.push({ id, area, mass, x0, y0, x1, y1 });
  }
  return { labels, comps, sizes: comps.map((c) => c.area) };
}

/** 自动采纳：平均超阈 ≥ 1.4 且非鬼影的区域；返回被采纳的区域（同时写回 `adopted`） */
export function autoAdoptRegions(det: ChangeDetection): ChangedRegion[] {
  return planAdoption(det).adopted;
}

export interface AdoptPlan {
  /** 自动采用（进蒙版）的区域 */
  adopted: ChangedRegion[];
  /** 画面上要标注的区域 —— ★**含已采用的那些**（参考实现 `det.cands` 就是"采用 + 候选"的并集） */
  cands: ChangedRegion[];
  /** 是否走了"敢自动采用"那一支 */
  auto: boolean;
  /** 较弱候选数（= `cands - adopted`），状态文案用 */
  extra: number;
  /** 采用过多时**不画框**（参考：「超过 5 处时连较弱的也一并采用、不再画框」） */
  showBoxes: boolean;
}

/**
 * 采纳 / 标注策略 —— 逐条对齐参考实现 `K()` 的收尾（html:36221）：
 *
 * ```js
 * const D=R.filter(t=>t.strong).slice(0,40);
 * const P=D.length>0&&(D[0].area>=.002*c||D.length>=3);
 * const O=R.filter(t=>!t.strong&&!t.shift&&t.mean>=1).slice(0,12);
 * P&&D.length>5&&O.forEach(t=>{t.strong=!0});
 * const z=P?D.concat(O):R.filter(t=>!t.shift).slice(0,5);
 * ```
 *
 * ★ `t.strong` 的定义里**带 `!t.shift`**（鬼影不算改动）—— 少了这条，边缘配准残差会被当成改动。
 * ★ `cands` 包含已自动采用的高强度区域（不然「N 处自动采用 + 0 个弱候选」时一个标注都没有）。
 */
export function planAdoption(det: ChangeDetection): AdoptPlan {
  const total = det.dw * det.dh;
  det.regions.forEach((r) => {
    r.adopted = false;
  });

  const strong = det.regions
    .filter((r) => !r.shift && r.meanExcess >= AUTO_ADOPT_MEAN_EXCESS)
    .slice(0, STRONG_MAX);
  const strongSet = new Set(strong);
  const auto =
    strong.length > 0 &&
    (strong[0].area >= total * AUTO_ADOPT_MIN_AREA_SHARE ||
      strong.length >= AUTO_ADOPT_MIN_STRONG_COUNT);
  const faint = det.regions
    .filter((r) => !strongSet.has(r) && !r.shift && r.meanExcess >= FAINT_MIN_MEAN_EXCESS)
    .slice(0, FAINT_MAX);
  /* 成群（高强度 > 5 处）时门槛放宽：弱候选一并采用（参考 `if (P && D.length > 5)`） */
  const promote = auto && strong.length > BOX_MAX_ADOPTED;
  const cands = auto
    ? [...strong, ...faint]
    : det.regions.filter((r) => !r.shift).slice(0, CANDIDATE_MAX);

  const adopted: ChangedRegion[] = [];
  for (const r of cands) {
    /* ⚠️ `auto === false` 时**一处都不采用**（哪怕它 mean ≥ 1.4）——参考实现的调用点
       只把候选框标出来，等用户点 ✗。 */
    r.adopted = auto && (strongSet.has(r) || promote);
    if (r.adopted) adopted.push(r);
  }
  return {
    adopted,
    cands,
    auto,
    extra: cands.length - adopted.length,
    /* 采用超过 5 处 ⇒ 不画框（否则几十个 chip 会把画面糊满） */
    showBoxes: !promote,
  };
}

/**
 * 由已采纳区域拼出检测分辨率的布尔掩码 —— **按连通域真实形状**填（参考 `J()` 里的 `lab` 标签），
 * 不是包围盒！旧实现按 `minX..maxX × minY..maxY` 填矩形 ⇒ 检测到一处改动就会把整块矩形
 * 贴上修改图（用户看到的"框是方的、边上带原图内容"就是这个）。
 * 背景替换模式直接用 `det.bgMask`。
 */
export function maskFromRegions(det: ChangeDetection): Uint8Array {
  if (det.bgMode && det.bgMask) return det.bgMask.slice();
  const out = new Uint8Array(det.dw * det.dh);
  const ids = new Set<number>();
  for (const r of det.regions) {
    if (!r.adopted) continue;
    const compIds = r.componentIds ?? [r.id];
    for (const id of compIds) ids.add(id);
  }
  if (!ids.size) return out;
  /* 没有标签（旧的结构化 det / 单测里手工造的对象）⇒ 退回包围盒 */
  if (!det.labels || !det.labels.length) {
    for (const r of det.regions) {
      if (!r.adopted) continue;
      for (let y = r.minY; y <= r.maxY; y++) {
        for (let x = r.minX; x <= r.maxX; x++) out[y * det.dw + x] = 1;
      }
    }
    return out;
  }
  for (let i = 0; i < out.length; i++) {
    out[i] = det.labels[i] >= 0 && ids.has(det.labels[i]) ? 1 : 0;
  }
  /* 参考 `J()` 里再膨胀一点（`h=ceil((c+l)/a)`），让边缘多带一点修改图，避免留缝 */
  const dilate = Math.max(1, Math.round((0.012 * Math.min(det.dw, det.dh) * 1.5) / 2));
  return morph(out, det.dw, det.dh, dilate, 'dilate');
}

/**
 * 把检测分辨率的布尔掩码放大成原图分辨率的 RGBA 掩码（最近邻），
 * 然后按 `softPx`（原图像素）做盒式模糊 —— 等价参考实现 `X()` 里的
 * `p.mask.filter='blur(e px)'`（羽化）。`softPx=0` 时保持硬边、逐像素精确。
 */
export function upscaleMask(
  small: Uint8Array,
  dw: number,
  dh: number,
  w: number,
  h: number,
  softPx = 0,
): Uint8ClampedArray {
  const alpha = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(dh - 1, Math.floor(((y + 0.5) * dh) / h));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(dw - 1, Math.floor(((x + 0.5) * dw) / w));
      if (small[sy * dw + sx]) alpha[y * w + x] = 255;
    }
  }
  if (softPx > 0) {
    const r = Math.max(1, Math.round(softPx));
    const blurred = boxBlur(alpha, w, h, r);
    alpha.set(blurred);
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < alpha.length; i++) {
    const a = alpha[i];
    if (a <= 0) continue;
    const p = i * 4;
    out[p] = 255;
    out[p + 1] = 255;
    out[p + 2] = 255;
    out[p + 3] = a;
  }
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   ④ 合成 —— 参考实现 `tt()`（html:45049）
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * 无损合成：`结果 = 修改图(已校色) ⊕ (原图 − 蒙版) × opacity`
 *
 * 参考实现 `tt(t,e)` 的等价推导：
 * ```js
 * t.drawImage(i,0,0); t.drawImage(r,0,0);                  // 原图 → 修改图(已校色)
 * p.tmp  = 原图; p.tmp.globalCompositeOperation='destination-out'; p.tmp.drawImage(d,0,0);
 * t.globalAlpha=e; t.drawImage(h,0,0);                      // h 就是 tmp
 * ```
 * ⇒ tmp 的 alpha = (1 − 蒙版alpha)，乘上 opacity 后**原图层的有效权重** `t = (1−ma)·opacity`
 * ⇒ `out = 修改图·(1 − t) + 原图·t`。
 * 核对：蒙版外 t = opacity（=1 时**逐像素等于原图** ✓）；蒙版内 t = 0（= 修改图 ✓）。
 *
 * ★ 没有任何泊松/多尺度融合：边缘柔化全靠**蒙版自身的 alpha**（画笔同心圈 + 检测区模糊）。
 */
export function compositeLossless(
  orig: Uint8ClampedArray,
  mod: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  opacity: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(orig.length);
  const a = clamp(opacity, 0, 1);
  for (let p = 0; p < out.length; p += 4) {
    const ma = mask[p + 3] / 255;
    const t = (1 - ma) * a;
    out[p] = mod[p] * (1 - t) + orig[p] * t;
    out[p + 1] = mod[p + 1] * (1 - t) + orig[p + 1] * t;
    out[p + 2] = mod[p + 2] * (1 - t) + orig[p + 2] * t;
    out[p + 3] = 255;
  }
  return out;
}
