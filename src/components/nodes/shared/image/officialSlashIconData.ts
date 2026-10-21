/* ══════════════════════════════════════════════════════════════════════════
   官方 `/` 指令菜单图标 —— 数据部分（从 TapNow 0.4.66 bundle 里**逐字抽出**）
   ──────────────────────────────────────────────────────────────────────────
   官方出处（`zoom-slider-3ZcFvYQO.js` @1620442 的 `vm=[…]`）：
     icon: l.jsx(h1,  {className:"w-5 h-5"})   // multi_angle_grid       多机位九宫格
     icon: l.jsx(Lne, {className:"w-5 h-5"})   // cinematic_lighting     电影级光影校正
     icon: l.jsx(jne, {className:"w-5 h-5"})   // character_turnaround   角色三视图生成
     icon: l.jsx(Bne, {className:"w-5 h-5"})   // scene_prediction (+3s) 画面推演 - 3秒后
     icon: l.jsx(zne, {className:"w-5 h-5"})   // scene_reconstruction   画面推演 - 5秒前
   这 5 个标识符由 `index-BiTZf8mJ.js` 头部 import 解析出来（`… as h1/Lne/jne/Bne/zne`），
   再经该 chunk 的 export 表（`ow←R9e / s_←gMn / s$←oSn / t0←NVn / t1←gHn`）落到
   `@tabler/icons-react` 的图标定义上（工厂 `g=(t,e,n,a)=>…`，outline 变体默认属性
   `_ui.outline` = `xmlns / viewBox 0 0 24 24 / fill none / stroke currentColor /
   strokeWidth 2 / strokeLinecap round / strokeLinejoin round`，`width/height = size`）：

     R9e = g("outline","video","Video",dIo)                          → tabler video
     gMn = g("outline","lamp-2","Lamp2",Cto)                         → tabler lamp-2
     oSn = g("outline","man","Man",Moo)                              → tabler man
     NVn = g("outline","run","Run",kyo)                              → tabler run
     gHn = g("outline","rewind-backward-5","RewindBackward5",J5o)    → tabler rewind-backward-5

   ⚠️ 下面是**官方那 5 个 `d` 字符串的逐字拷贝**（不是「语义相近」的 MTV 图标）。
   ══════════════════════════════════════════════════════════════════════════ */

export interface OfficialSlashIconDef {
  /** 官方 tabler 图标名（决定 `tabler-icon-<name>` 类名） */
  name: string;
  /** 官方 `path` 数组（逐字） */
  d: string[];
}

/** key = 官方 `vm` 里的 id */
export const OFFICIAL_SLASH_ICONS: Record<string, OfficialSlashIconDef> = {
  multi_angle_grid: {
    name: 'video',
    d: [
      'M15 10l4.553 -2.276a1 1 0 0 1 1.447 .894v6.764a1 1 0 0 1 -1.447 .894l-4.553 -2.276v-4z',
      'M3 6m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z',
    ],
  },
  cinematic_lighting: {
    name: 'lamp-2',
    d: [
      'M5 21h9',
      'M10 21l-7 -8l8.5 -5.5',
      'M13 14c-2.148 -2.148 -2.148 -5.852 0 -8c2.088 -2.088 5.842 -1.972 8 0l-8 8z',
      'M11.742 7.574l-1.156 -1.156a2 2 0 0 1 2.828 -2.829l1.144 1.144',
      'M15.5 12l.208 .274a2.527 2.527 0 0 0 3.556 0c.939 -.933 .98 -2.42 .122 -3.4l-.366 -.369',
    ],
  },
  character_turnaround: {
    name: 'man',
    d: [
      'M10 16v5',
      'M14 16v5',
      'M9 9h6l-1 7h-4z',
      'M5 11c1.333 -1.333 2.667 -2 4 -2',
      'M19 11c-1.333 -1.333 -2.667 -2 -4 -2',
      'M12 4m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    ],
  },
  scene_prediction: {
    name: 'run',
    d: [
      'M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0',
      'M4 17l5 1l.75 -1.5',
      'M15 21l0 -4l-4 -3l1 -6',
      'M7 12l0 -3l5 -1l3 3l3 1',
    ],
  },
  scene_reconstruction: {
    name: 'rewind-backward-5',
    d: [
      'M15 18a6 6 0 1 0 0 -12h-11',
      'M7 9l-3 -3l3 -3',
      'M8 20h2a1 1 0 0 0 1 -1v-1a1 1 0 0 0 -1 -1h-2v-3h3',
    ],
  },
};
