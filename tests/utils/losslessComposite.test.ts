/**
 * losslessComposite 的契约测试。
 * ⚠️ 这里断言的都是**从参考实现里抠出来的原值**（`D:\DEEPSEEK\_taozui\eraser.js`），
 *    改实现时如果这些数变了，说明参数漂了。
 */
import { describe, expect, it } from 'vitest';
import {
  AUTO_ADOPT_MEAN_EXCESS,
  CANDIDATE_MAX,
  CORR_GAIN_MAX,
  CORR_GAIN_MIN,
  CORR_MIN_SAMPLES,
  NOISE_MIN_THRESHOLD,
  ALIGN_RESID_WARN_PX,
  alignImages,
  applyColorCorrection,
  autoAdoptRegions,
  compositeLossless,
  computeColorCorrection,
  computeNoiseStats,
  detectChanges,
  maskFromRegions,
  planAdoption,
  upscaleMask,
} from '../../src/utils/losslessComposite';

/* ── 造图工具 ── */
function solid(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < d.length; p += 4) {
    d[p] = r;
    d[p + 1] = g;
    d[p + 2] = b;
    d[p + 3] = 255;
  }
  return d;
}

/** 带噪声的渐变图（对齐/检测都要有纹理，纯色图分不出改动） */
function textured(w: number, h: number, seed = 1): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const base = ((x * 3 + y * 5) % 200) + 20;
      d[p] = base + rnd() * 8;
      d[p + 1] = base + rnd() * 8;
      d[p + 2] = base + rnd() * 8;
      d[p + 3] = 255;
    }
  }
  return d;
}

function maskOf(w: number, h: number, rect: { x: number; y: number; w: number; h: number }): Uint8ClampedArray {
  const m = new Uint8ClampedArray(w * h * 4);
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const p = (y * w + x) * 4;
      m[p] = m[p + 1] = m[p + 2] = m[p + 3] = 255;
    }
  }
  return m;
}

describe('无损改图 · 合成（参考实现 tt）', () => {
  const W = 8;
  const H = 8;

  it('原图不透明度=100% 时，蒙版外**逐像素等于原图**（这就是"无损"）', () => {
    const orig = solid(W, H, 10, 20, 30);
    const mod = solid(W, H, 200, 100, 50);
    const mask = maskOf(W, H, { x: 2, y: 2, w: 2, h: 2 });
    const out = compositeLossless(orig, mod, mask, 1);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        const inMask = x >= 2 && x < 4 && y >= 2 && y < 4;
        expect(out[p]).toBe(inMask ? 200 : 10);
        expect(out[p + 1]).toBe(inMask ? 100 : 20);
        expect(out[p + 2]).toBe(inMask ? 50 : 30);
      }
    }
  });

  it('蒙版内一律取修改图；opacity=0 时整张都是修改图', () => {
    const orig = solid(W, H, 10, 20, 30);
    const mod = solid(W, H, 200, 100, 50);
    const mask = maskOf(W, H, { x: 0, y: 0, w: 1, h: 1 });

    const inMask = compositeLossless(orig, mod, mask, 1);
    expect([inMask[0], inMask[1], inMask[2]]).toEqual([200, 100, 50]);

    const none = compositeLossless(orig, mod, mask, 0);
    expect([none[0], none[1], none[2]]).toEqual([200, 100, 50]);
  });

  it('opacity=50% 时蒙版外是原图与修改图的等权混合', () => {
    const orig = solid(W, H, 0, 0, 0);
    const mod = solid(W, H, 200, 200, 200);
    const mask = maskOf(W, H, { x: 0, y: 0, w: 1, h: 1 });
    const out = compositeLossless(orig, mod, mask, 0.5);
    // 取非蒙版像素 (1,1)
    const p = (1 * W + 1) * 4;
    expect(out[p]).toBe(100);
  });
});

describe('无损改图 · 自动校色（参考实现 q/j）', () => {
  const W = 40;
  const H = 40;

  it('增益夹取在 [0.85, 1.18]，与参考实现同值', () => {
    expect(CORR_GAIN_MIN).toBe(0.85);
    expect(CORR_GAIN_MAX).toBe(1.18);
    expect(CORR_MIN_SAMPLES).toBe(500);
  });

  it('能把"整体乘系数 + 加偏移"的偏色反校正回去', () => {
    const orig = textured(W, H);
    const g = 1.1;
    const o = 8;
    const mod = new Uint8ClampedArray(orig.length);
    for (let p = 0; p < orig.length; p += 4) {
      for (let c = 0; c < 3; c++) mod[p + c] = orig[p + c] * g + o;
      mod[p + 3] = 255;
    }

    const corr = computeColorCorrection(orig, mod, null, W, H);
    expect(corr.computed).toBe(true);
    // 参考实现只给 gain 一个窄夹取区间 ⇒ 1.1 的反向 ≈ 0.909 落在区间内
    expect(corr.gain[0]).toBeGreaterThan(0.85);
    expect(corr.gain[0]).toBeLessThan(1);

    const fixed = applyColorCorrection(mod, corr, 1);
    // 校正后应当非常接近原图（允许四舍五入误差）
    let maxDiff = 0;
    for (let p = 0; p < orig.length; p += 4) {
      maxDiff = Math.max(maxDiff, Math.abs(fixed[p] - orig[p]));
    }
    expect(maxDiff).toBeLessThanOrEqual(4);
  });

  it('样本不足（纯色小图）时放弃校色：gain=1 / offset=0', () => {
    const orig = solid(4, 4, 100, 100, 100);
    const mod = solid(4, 4, 100, 100, 100);
    const corr = computeColorCorrection(orig, mod, null, 4, 4);
    expect(corr.gain).toEqual([1, 1, 1]);
    expect(corr.offset).toEqual([0, 0, 0]);
    expect(corr.sampled).toBe(0);
  });

  it('蒙版内的像素不参与采样', () => {
    const orig = textured(W, H);
    // 修改图整张改色，但全部被蒙版盖住 ⇒ 可用样本为 0 ⇒ 不校色
    const mod = solid(W, H, 250, 10, 10);
    const mask = maskOf(W, H, { x: 0, y: 0, w: W, h: H });
    const corr = computeColorCorrection(orig, mod, mask, W, H);
    expect(corr.sampled).toBe(0);
    expect(corr.gain).toEqual([1, 1, 1]);
  });
});

describe('无损改图 · 噪声阈值（参考实现 g）', () => {
  it('阈值 = max(6, median + 8·max(0.5, MAD))', () => {
    // 造一片恒定差值 3 的区域：median=3, MAD=0 ⇒ max(6, 3+4)=7
    const w = 64;
    const h = 64;
    const diff = new Float32Array(w * h).fill(3);
    const stats = computeNoiseStats(diff, w, h);
    expect(stats.median).toBe(3);
    expect(stats.mad).toBe(0);
    expect(stats.threshold).toBe(7);
  });

  it('差值很小时被下限 6 兜住', () => {
    const w = 64;
    const h = 64;
    const diff = new Float32Array(w * h).fill(1);
    expect(computeNoiseStats(diff, w, h).threshold).toBe(NOISE_MIN_THRESHOLD);
  });
});

describe('无损改图 · 改动检测（参考实现 K）', () => {
  it('两张一模一样的图 ⇒ 检测不到任何改动', () => {
    const W = 256;
    const H = 256;
    const img = textured(W, H);
    const det = detectChanges(img, new Uint8ClampedArray(img), W, H);
    const adopted = autoAdoptRegions(det);
    expect(det.bgMode).toBe(false);
    expect(adopted.length).toBe(0);
  });

  it('局部明显改动 ⇒ 检出连通域，且平均超阈 ≥ 1.4 被自动采纳', () => {
    const W = 256;
    const H = 256;
    const orig = textured(W, H);
    const mod = new Uint8ClampedArray(orig);
    // 在 (100,100)-(140,140) 贴一块明显不同的内容
    for (let y = 100; y < 140; y++) {
      for (let x = 100; x < 140; x++) {
        const p = (y * W + x) * 4;
        mod[p] = 250;
        mod[p + 1] = 20;
        mod[p + 2] = 20;
      }
    }
    const det = detectChanges(orig, mod, W, H);
    expect(det.regions.length).toBeGreaterThan(0);

    const adopted = autoAdoptRegions(det);
    expect(adopted.length).toBeGreaterThan(0);

    // 采纳区域的包围盒应覆盖到我们改动的那块（检测分辨率下按比例）
    const k = det.dw / W;
    const bx = 100 * k;
    const by = 100 * k;
    const hit = adopted.some(
      (r) => r.minX <= bx + 2 && r.maxX >= bx - 2 && r.minY <= by + 2 && r.maxY >= by - 2,
    );
    expect(hit).toBe(true);
  });

  it('自动采纳门槛就是 1.4', () => {
    expect(AUTO_ADOPT_MEAN_EXCESS).toBe(1.4);
  });
});

describe('无损改图 · 掩码放大（参考实现 X）', () => {
  it('检测分辨率的掩码能放大回原图分辨率，且位置对得上', () => {
    const dw = 4;
    const dh = 4;
    const small = new Uint8Array(dw * dh);
    small[1 * dw + 1] = 1; // (1,1) 那一格
    const W = 16;
    const H = 16;
    const big = upscaleMask(small, dw, dh, W, H);
    // 原图 (4,4) 落在第一格内 ⇒ 应为不透明
    expect(big[(4 * W + 4) * 4 + 3]).toBe(255);
    // 原图 (12,12) 落在第三格 ⇒ 应透明
    expect(big[(12 * W + 12) * 4 + 3]).toBe(0);
  });

  it('maskFromRegions 只画已采纳的区域', () => {
    const W = 128;
    const H = 128;
    const orig = textured(W, H);
    const mod = new Uint8ClampedArray(orig);
    for (let y = 40; y < 60; y++) {
      for (let x = 40; x < 60; x++) {
        const p = (y * W + x) * 4;
        mod[p] = 0;
        mod[p + 1] = 255;
        mod[p + 2] = 0;
      }
    }
    const det = detectChanges(orig, mod, W, H);
    autoAdoptRegions(det);
    const m = maskFromRegions(det);
    expect(m.some((v) => v === 1)).toBe(true);
    expect(m.length).toBe(det.dw * det.dh);
  });
});

describe('无损改图 · PSD 导出（决策②：ag-psd）', () => {
  it('ag-psd 能在本仓库的运行时跑通，且三层结构被接受、产出真 PSD（8BPS 头）', async () => {
    // 用 imageData 而不是 canvas：Node 测试环境没有 canvas，ag-psd 两种入参都支持
    const W = 8;
    const H = 8;
    const mk = (v: number) => ({ width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(v) });
    const agPsd = await import('ag-psd');
    const psd = agPsd.writePsd(
      {
        width: W,
        height: H,
        imageData: mk(128),
        children: [
          { name: '原图', imageData: mk(10) },
          {
            name: '修改图_已校色',
            imageData: mk(200),
            mask: { top: 0, left: 0, right: W, bottom: H, defaultColor: 0, imageData: mk(255) },
          },
          { name: '盖印_合成', imageData: mk(128) },
        ],
      },
      { generateThumbnail: false },
    );
    const head = new TextDecoder('latin1').decode(new Uint8Array(psd as ArrayBuffer).subarray(0, 4));
    expect(head).toBe('8BPS');
  });
});

describe('无损改图 · 自动对齐（参考实现 z）', () => {
  it('纯平移能被估出来（符号与量级正确）', () => {
    const W = 128;
    const H = 128;
    const orig = textured(W, H, 7);
    // 把原图整体右移 4 / 下移 3 当作"修改图"
    const mod = new Uint8ClampedArray(orig.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sx = x - 4;
        const sy = y - 3;
        const dp = (y * W + x) * 4;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) {
          mod[dp + 3] = 255;
          continue;
        }
        const sp = (sy * W + sx) * 4;
        mod[dp] = orig[sp];
        mod[dp + 1] = orig[sp + 1];
        mod[dp + 2] = orig[sp + 2];
        mod[dp + 3] = 255;
      }
    }
    const align = alignImages(orig, mod, W, H);
    expect(Math.abs(align.tx)).toBeGreaterThan(0);
    expect(align.mode).toBe('平移');
    expect(align.blocks).toBeGreaterThan(0);
  });

  /* 2026 用户实测：「无损修图 感觉两张图 没对齐」——那张「床 / 草地」图上算法给出 x=-84.3、
     缩放 100.21%、6 个纹理块，但两张图其实**根本不是同一个画面**（AI 把背景整片换掉），
     84px 是重复纹理（草）的假峰，强行平移会把前景也带歪。
     门槛：位移必须赢过「不动」的罚分才采用，否则回恒等。 */
  it('两张不同的画面（背景被整片换掉）⇒ 不做全局对齐，回落到恒等', () => {
    const W = 160;
    const H = 160;
    const orig = textured(W, H, 11);
    const mod = textured(W, H, 29); // 另一套纹理 ⇒ 完全不同的画面
    const align = alignImages(orig, mod, W, H);
    expect(align.tx).toBe(0);
    expect(align.ty).toBe(0);
    expect(align.sx).toBe(1);
    expect(align.sy).toBe(1);
    expect(align.blocks).toBe(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   回归：旧实现在这几处是**错的**（对齐发散 / 蒙版填包围盒 / 背景替换没实现 / 鬼影没剔除），
   逐条钉住，免得以后又退回去。
   ══════════════════════════════════════════════════════════════════════════════ */
describe('无损改图 · 对齐精度（旧实现会发散，实测 tx=-270 而真值 -84）', () => {
  /** 把 orig 平移 (dx,dy)：mod(x,y) = orig(x−dx, y−dy) */
  function shifted(orig: Uint8ClampedArray, W: number, H: number, dx: number, dy: number) {
    const out = new Uint8ClampedArray(orig.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const sx = x - dx;
        const sy = y - dy;
        const dp = (y * W + x) * 4;
        out[dp + 3] = 255;
        if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
        const sp = (sy * W + sx) * 4;
        out[dp] = orig[sp];
        out[dp + 1] = orig[sp + 1];
        out[dp + 2] = orig[sp + 2];
      }
    }
    return out;
  }

  it('小位移 (±4,±3) 必须**精确**估出（旧实现给 tx=−9 ty=0）', () => {
    const W = 512;
    const H = 768;
    const orig = textured(W, H, 7);
    const align = alignImages(orig, shifted(orig, W, H, 4, 3), W, H);
    expect(align.tx).toBeCloseTo(-4, 0);
    expect(align.ty).toBeCloseTo(-3, 0);
    /* 纯平移时拟合斜率≈0 ⇒ 缩放≈1（参考实现按"缩放 100.00%"显示） */
    expect(align.sx).toBeCloseTo(1, 2);
    expect(align.sy).toBeCloseTo(1, 2);
  });

  it('中位移 (20,−12) 也要精确（旧实现直接给 0：搜索半径不够）', () => {
    const W = 512;
    const H = 768;
    const orig = textured(W, H, 7);
    const align = alignImages(orig, shifted(orig, W, H, 20, -12), W, H);
    expect(align.tx).toBeCloseTo(-20, 0);
    expect(align.ty).toBeCloseTo(12, 0);
  });

  it('resid 是**像素残差**（旧实现拿灰度平均差冒充，量纲 0..255 ⇒ >2.5 告警永远成立）', () => {
    const W = 512;
    const H = 768;
    const orig = textured(W, H, 7);
    const align = alignImages(orig, shifted(orig, W, H, 4, 3), W, H);
    expect(align.resid).toBeLessThan(ALIGN_RESID_WARN_PX);
  });

  it('位移超出参考实现的 ±5% 搜索窗时，至少不能发出离谱的值（把图画到原图外面）', () => {
    /* 参考实现金字塔第 0 级半径 = max(8, 5%×级宽)，总可达范围 ≈ 5%×短边 + 各级 ±2。
       这里只断言"结果有界"，用来防"发散"这类 bug 复发。 */
    const W = 1024;
    const H = 1536;
    const orig = textured(W, H, 7);
    const align = alignImages(orig, shifted(orig, W, H, -84, -7), W, H);
    expect(Math.abs(align.tx)).toBeLessThan(W * 0.5);
    expect(Math.abs(align.ty)).toBeLessThan(H * 0.5);
    expect(Number.isFinite(align.sx)).toBe(true);
  });
});

describe('无损改图 · 背景替换模式（参考实现 Y/X）—— 旧实现只当文案、蒙版留空', () => {
  it('整图都变了但留一块没变的前景 ⇒ bgMode + keepCount≥1 + 蒙版覆盖绝大部分画面', () => {
    const W = 256;
    const H = 256;
    const orig = textured(W, H, 11);
    const mod = new Uint8ClampedArray(orig.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        /* 双峰的差值分布（真实用户图正是这种：约 36% 没变 / 64% 变了）：
           左边 40% 宽的一整条保持原样（"没变的前景"），其余 +90（"全变了"）。
           ⚠️ 不能做成"全图均匀 +90" —— 参考实现 `e=q(.2)+4·max(.5,q(.4)−q(.2))`
              要求第 20 百分位落在**未变**那一峰里，否则阈值失效（照抄参考实现就是这个行为）。 */
        const keep = x < 160;
        for (let c = 0; c < 3; c++) mod[p + c] = keep ? orig[p + c] : orig[p + c] + 90;
        mod[p + 3] = 255;
      }
    }
    const det = detectChanges(orig, mod, W, H);
    expect(det.bgMode).toBe(true);
    expect(det.keepCount).toBeGreaterThanOrEqual(1);
    expect(det.changedShare).toBeGreaterThan(30);

    const plan = planAdoption(det);
    expect(plan.adopted.length).toBe(0); // 背景替换模式不走"候选采纳"
    const mask = maskFromRegions(det);
    let on = 0;
    for (let i = 0; i < mask.length; i++) on += mask[i];
    /* 蒙版 = 全图减去"没变的前景" ⇒ 必须有可观覆盖（旧实现这里是 **0**，一个像素都不换） */
    expect(on / mask.length).toBeGreaterThan(0.2);
  });

  it('maskFromRegions 在 bgMode 下**直接返回 det.bgMask**（旧实现只认 regions ⇒ 恒为空）', () => {
    const dw = 8;
    const dh = 8;
    const bgMask = new Uint8Array(dw * dh);
    for (let i = 0; i < bgMask.length; i++) bgMask[i] = i % 2;
    const det = {
      dw,
      dh,
      score: new Float32Array(dw * dh),
      regions: [],
      noise: { threshold: 6, median: 1, mad: 0.5 },
      bgMode: true,
      dominance: 0,
      labels: new Int32Array(dw * dh).fill(-1),
      bgMask,
      keepCount: 1,
      changedShare: 62,
      maskBlurPx: 6,
    } as never;
    const out = maskFromRegions(det);
    expect(Array.from(out)).toEqual(Array.from(bgMask));
  });
});

describe('无损改图 · 鬼影剔除（参考实现 shift）—— 旧实现把配准残差当改动', () => {
  it('只差 1 像素平移 ⇒ 检测出的连域标为 shift，且**一处都不自动采用**', () => {
    const W = 256;
    const H = 256;
    const orig = textured(W, H, 13);
    const mod = new Uint8ClampedArray(orig.length);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dp = (y * W + x) * 4;
        const sx = Math.min(W - 1, x + 1);
        const sp = (y * W + sx) * 4;
        mod[dp] = orig[sp];
        mod[dp + 1] = orig[sp + 1];
        mod[dp + 2] = orig[sp + 2];
        mod[dp + 3] = 255;
      }
    }
    const det = detectChanges(orig, mod, W, H);
    const plan = planAdoption(det);
    expect(plan.adopted.length).toBe(0);
    /* 要么被 shift 剔掉，要么强度不够 —— 但绝不能"整片采纳" */
    expect(plan.cands.length).toBeLessThanOrEqual(5);
  });
});

describe('无损改图 · 蒙版按连通域真实形状（旧实现填包围盒）', () => {
  it('L 形区域 ⇒ 包围盒里的"空缺角"不能被填上', () => {
    const dw = 40;
    const dh = 40;
    const labels = new Int32Array(dw * dh).fill(-1);
    /* 在 (5,5) 起画一个 L：横条 y=5..9,x=5..24 + 竖条 x=5..9,y=5..24 */
    for (let y = 5; y <= 24; y++) {
      for (let x = 5; x <= 24; x++) {
        const inBar = (y <= 9 && x <= 24) || (x <= 9 && y <= 24);
        if (inBar) labels[y * dw + x] = 0;
      }
    }
    const det = {
      dw,
      dh,
      score: new Float32Array(dw * dh),
      regions: [
        {
          id: 0,
          componentIds: [0],
          area: 100,
          mass: 300,
          meanExcess: 3,
          minX: 5,
          minY: 5,
          maxX: 24,
          maxY: 24,
          shift: false,
          adopted: true,
        },
      ],
      noise: { threshold: 6, median: 1, mad: 0.5 },
      bgMode: false,
      dominance: 2,
      labels,
      bgMask: null,
      keepCount: 0,
      changedShare: 0,
      maskBlurPx: 0,
    } as never;
    const mask = maskFromRegions(det);
    /* 包围盒右下角 (22,22) 在 L 的空缺里 ⇒ 必须是 0（旧实现会填成 1） */
    expect(mask[22 * dw + 22]).toBe(0);
    /* L 的横条上必须为 1 */
    expect(mask[7 * dw + 20]).toBe(1);
  });
});

describe('无损改图 · 蒙版羽化（参考实现 X 里的 blur）', () => {
  it('softPx > 0 ⇒ 边缘出现半透明过渡；softPx = 0 ⇒ 只有 0/255', () => {
    const dw = 8;
    const dh = 8;
    const small = new Uint8Array(dw * dh);
    small[4 * dw + 4] = 1;
    const W = 64;
    const H = 64;
    const hard = upscaleMask(small, dw, dh, W, H, 0);
    let hardMid = 0;
    for (let p = 3; p < hard.length; p += 4) if (hard[p] > 0 && hard[p] < 255) hardMid++;
    expect(hardMid).toBe(0);

    const soft = upscaleMask(small, dw, dh, W, H, 4);
    let softMid = 0;
    for (let p = 3; p < soft.length; p += 4) if (soft[p] > 0 && soft[p] < 255) softMid++;
    expect(softMid).toBeGreaterThan(0);
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   采纳 / 标注策略 —— 逐条对齐参考实现 `analyzeChanges()` 的收尾
   （`_ref-src/eraser_index.html` 753-772 行）+ README 的「自动采用 N 处，框出 M 处」实测表。
   用**合成 det** 测，不依赖真实图像的连通域个数（那受形态学影响，测不稳）。
   ══════════════════════════════════════════════════════════════════════════════ */
describe('无损改图 · 采纳 / 标注策略（参考实现第四版）', () => {
  const DW = 100;
  const DH = 100;
  /** 总 10000 px ⇒ `auto` 的面积门槛 `n * 0.002` = **20 px** */
  function region(index: number, meanExcess: number, area = 40) {
    return {
      area,
      minX: index * 2,
      minY: index * 2,
      maxX: index * 2 + 5,
      maxY: index * 2 + 5,
      meanExcess,
      adopted: false,
    };
  }
  function det(regions: ReturnType<typeof region>[]) {
    return {
      dw: DW,
      dh: DH,
      score: new Float32Array(DW * DH),
      regions,
      noise: { threshold: 6, median: 1, mad: 0.5 },
      bgMode: false,
      dominance: 0,
    };
  }

  it('没有高强度（全部 mean < 1.4）⇒ 一处都不采纳，只标前五名', () => {
    const d = det([1.3, 1.2, 1.1, 1.05, 1.02, 1.01, 1.0].map((m, i) => region(i, m)));
    const plan = planAdoption(d);
    expect(plan.auto).toBe(false);
    expect(plan.adopted.length).toBe(0);
    expect(plan.cands.length).toBe(CANDIDATE_MAX);
    // 前五名 = 数组前五个（detectChanges 已按 强度×面积 排好序）
    expect(plan.cands[0]).toBe(d.regions[0]);
    expect(plan.showBoxes).toBe(true);
  });

  it('★ 标注列表**含已自动采用的高强度区域**（参考 `cands = strong.concat(faint)`）', () => {
    /* 这正是用户报「改动的处的标注也没有」的那个坑：
       4 处自动采用 + 0 个弱候选 ⇒ 只画"未采用的"就一个框都没有 */
    const d = det([2.4, 2.0, 1.9, 1.6].map((m, i) => region(i, m)));
    const plan = planAdoption(d);
    expect(plan.auto).toBe(true);
    expect(plan.adopted.length).toBe(4);
    expect(plan.extra).toBe(0);
    // 四处都要**照常画框**（不是"没有候选就不画"）
    expect(plan.cands.length).toBe(4);
    expect(plan.cands.every((r) => r.adopted)).toBe(true);
    expect(plan.showBoxes).toBe(true);
  });

  it('auto 的两个触发条件：第一名面积 ≥ 0.2% **或** 高强度 ≥ 3 处', () => {
    /* ① 面积够（40 ≥ 20）⇒ 一处也敢自动采用 */
    const big = det([region(0, 1.6, 40)]);
    expect(planAdoption(big).auto).toBe(true);
    /* ② 面积不够（10 < 20）但强度够 ⇒ 3 处 ⇒ 也敢 */
    const many = det([region(0, 1.6, 10), region(1, 1.5, 10), region(2, 1.45, 10)]);
    expect(planAdoption(many).auto).toBe(true);
    /* ③ 面积不够、数量也不够（2 处）⇒ 不敢自动采用，退成候选 */
    const weak = det([region(0, 1.6, 10), region(1, 1.5, 10)]);
    const plan = planAdoption(weak);
    expect(plan.auto).toBe(false);
    expect(plan.adopted.length).toBe(0);
  });

  it('高强度 ≤ 5 处 ⇒ 同时采纳高强度 + 把弱候选（mean ≥ 1.0）一起标注', () => {
    const d = det([2.4, 2.0, 1.6, 1.2, 1.1, 0.9].map((m, i) => region(i, m)));
    const plan = planAdoption(d);
    expect(plan.auto).toBe(true);
    expect(plan.adopted.length).toBe(3);
    // 弱候选 = mean ∈ [1.0, 1.4) 的两处；0.9 那处不算
    expect(plan.cands.length).toBe(5);
    expect(plan.extra).toBe(2);
    expect(plan.showBoxes).toBe(true);
  });

  it('高强度超过 5 处 ⇒ 连弱的一起全采纳、**不画框**（README「办公室去人物」那一行）', () => {
    const means = [4.4, 3.9, 3.1, 2.8, 2.2, 1.9, 1.5, 1.2, 1.1, 1.05];
    const d = det(means.map((m, i) => region(i, m)));
    const plan = planAdoption(d);
    expect(plan.auto).toBe(true);
    expect(plan.showBoxes).toBe(false);
    expect(plan.adopted.length).toBe(means.length);
    expect(plan.extra).toBe(0);
  });

  it('autoAdoptRegions 就是 planAdoption().adopted 的别名（旧调用点语义不变）', () => {
    const d = det([2.0, 1.2].map((m, i) => region(i, m)));
    expect(autoAdoptRegions(d).length).toBe(planAdoption(d).adopted.length);
  });
});

