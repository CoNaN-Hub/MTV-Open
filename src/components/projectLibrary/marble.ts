/**
 * marble.ts —— 官方 `Ke`（boring-avatars 的 `marble` 变体）的**纯算法**部分
 * ══════════════════════════════════════════════════════════════════════════
 * 官方源码原文（`index-BsHyQ2qj.js` @6728550 起，UMD 打包）：
 *
 *   var d = function(_) {                       // hashCode
 *     for (var M = 0, w = 0; w < _.length; w++) M = (M << 5) - M + _.charCodeAt(w), M &= M;
 *     return Math.abs(M);
 *   };
 *   var u = function(_, M) { return Math.floor(_ / Math.pow(10, M)) % 10; };              // getDigit
 *   var f = function(_, M, w) { var x = _ % M; return w && u(_, w) % 2 === 0 ? -x : x; }; // getUnit
 *   var y = function(_, M, w) { return M[_ % w]; };                                       // getRandomColor
 *
 *   // marble 的三层参数 T：
 *   Array.from({length: 3}, (O, z) => ({
 *     color:      y(L + z, R, j),            // L = d(name)，R = colors，j = colors.length
 *     translateX: f(L * (z + 1), 8, 1),
 *     translateY: f(L * (z + 1), 8, 2),
 *     scale:      1.2 + f(L * (z + 1), 4) / 10,
 *     rotate:     f(L * (z + 1), 360, 1),
 *   }))
 *
 * ⚠️ 两条 path 的 `scale()` **都取 T[2].scale**（官方原文如此），不是各自 z 的 scale。
 *
 * 校验（9444 实测 DOM，项目 id `4f10c54e-c98b-42d0-b6bd-9cb70bdb0d2f`）：
 *   hash = 556055423（%5 = 3）⇒ 底色 #606d80 / path1 #a3a7ae / path2 #3e3e41，
 *   path1 `translate(-6 -6) rotate(-286 40 40) scale(1.3)`、path2 `translate(-5 -5) rotate(-69 40 40) scale(1.3)`。
 */

/** 官方五色（`colors` 数组，顺序即取色环） */
export const MARBLE_COLORS = ['#3e3e41', '#3f66a2', '#567ebb', '#606d80', '#a3a7ae'];

function hashCode(name: string): number {
  let M = 0;
  for (let w = 0; w < name.length; w += 1) {
    M = (M << 5) - M + name.charCodeAt(w);
    M &= M;
  }
  return Math.abs(M);
}

const getDigit = (num: number, nth: number) => Math.floor(num / Math.pow(10, nth)) % 10;

const getUnit = (num: number, range: number, index?: number) => {
  const x = num % range;
  return index && getDigit(num, index) % 2 === 0 ? -x : x;
};

const getRandomColor = (num: number, colors: string[], range: number) => colors[num % range];

export interface MarbleSpec {
  color: string;
  translateX: number;
  translateY: number;
  scale: number;
  rotate: number;
}

/** 官方 marble 三层参数（`T`）：纯函数，同 `name` 恒定 */
export function marbleSpecs(name: string, colors: readonly string[] = MARBLE_COLORS): MarbleSpec[] {
  const L = hashCode(name);
  const j = colors.length;
  return Array.from({ length: 3 }, (_, z) => ({
    color: getRandomColor(L + z, colors as string[], j),
    translateX: getUnit(L * (z + 1), 8, 1),
    translateY: getUnit(L * (z + 1), 8, 2),
    scale: 1.2 + getUnit(L * (z + 1), 4) / 10,
    rotate: getUnit(L * (z + 1), 360, 1),
  }));
}
