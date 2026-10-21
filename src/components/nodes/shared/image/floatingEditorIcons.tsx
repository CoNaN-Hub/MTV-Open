/**
 * 浮动编辑器图标（官方 tabler / lucide 的 path **逐字**取自官方 bundle）
 * ──────────────────────────────────────────────────────────────────────────
 * 来源：`TapNow-0.4.66/resources/web/assets/index-BsHyQ2qj.js` 的 `F("<name>", …)` 定义表
 *   · `x`               → `M18 6l-12 12` / `M6 6l12 12`（关浮层；官方 redraw 实测渲染 16×16）
 *   · `brush`           → 4 段（见下）
 *   · `rectangle`       → 框选（官方 aria-label = "Marquee Selection"）
 *   · `eraser`          → 2 段
 *   · `arrow-back-up`   → 撤销；`arrow-forward-up` → 重做
 *   · `paperclip`       → 底栏「添加参考图」
 *   · lucide `arrow-up` → 生成键（白色圆钮）
 *   · `aspect-ratio`    → 宽高比触发钮（裁剪/扩图共用）
 */
const ICONS = {
  x: [['path', { d: 'M18 6l-12 12' }], ['path', { d: 'M6 6l12 12' }]],
  brush: [
    ['path', { d: 'M3 21v-4a4 4 0 1 1 4 4h-4' }],
    ['path', { d: 'M21 3a16 16 0 0 0 -12.8 10.2' }],
    ['path', { d: 'M21 3a16 16 0 0 1 -10.2 12.8' }],
    ['path', { d: 'M10.6 9a9 9 0 0 1 4.4 4.4' }],
  ],
  rectangle: [
    ['path', { d: 'M3 5m0 2a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z' }],
  ],
  eraser: [
    ['path', {
      d: 'M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3',
    }],
    ['path', { d: 'M18 13.3l-6.3 -6.3' }],
  ],
  arrowBackUp: [['path', { d: 'M9 14l-4 -4l4 -4' }], ['path', { d: 'M5 10h11a4 4 0 1 1 0 8h-1' }]],
  arrowForwardUp: [['path', { d: 'M15 14l4 -4l-4 -4' }], ['path', { d: 'M19 10h-11a4 4 0 1 0 0 8h1' }]],
  paperclip: [['path', {
    d: 'M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5',
  }]],
  arrowUp: [
    ['path', { d: 'm5 12 7-7 7 7' }],
    ['path', { d: 'M12 19V5' }],
  ],
  /* 官方标注「文本」钮图标 —— 9444 实测 outerHTML 逐字：
     `class="tabler-icon tabler-icon-typography"` 18×18，5 段 path */
  typography: [
    ['path', { d: 'M4 20l3 0' }],
    ['path', { d: 'M14 20l7 0' }],
    ['path', { d: 'M6.9 15l6.9 0' }],
    ['path', { d: 'M10.2 6.3l5.8 13.7' }],
    ['path', { d: 'M5 20l6 -16l2 0l7 16' }],
  ],
  /* 官方标注「保存」钮的图标（`v3` size=16，9444 实测 `tabler-icon-device-floppy`） */
  /* 打光面板三个 14px 图标 —— 9444 实测官方 DOM（`tabler-icon-*`）逐字 */
  sun: [
    ['path', { d: 'M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0' }],
    ['path', { d: 'M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7' }],
  ],
  temperature: [
    ['path', { d: 'M10 13.5a4 4 0 1 0 4 0v-8.5a2 2 0 0 0 -4 0v8.5' }],
    ['path', { d: 'M10 9l4 0' }],
  ],
  helpCircle: [
    ['path', { d: 'M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0' }],
    ['path', { d: 'M12 16v.01' }],
    ['path', { d: 'M12 13a2 2 0 0 0 .914 -3.782a1.98 1.98 0 0 0 -2.414 .483' }],
  ],
  /* 官方标注「保存」钮的图标 —— 9444 实测 `tabler-icon-device-floppy` 16×16 */
  save: [
    ['path', {
      d: 'M6 4h10l4 4v10a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2',
    }],
    ['path', { d: 'M12 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0' }],
    ['path', { d: 'M14 4l0 4l-6 0l0 -4' }],
  ],
  /* 官方 `Wu` 生成胶囊里「预估价格」左边那颗图标（9444 实测 outerHTML 逐字：3 段 path、16×16、
     `stroke="rgb(204,204,204)"`）—— MTV 没有价格源，胶囊里放的是生成次数，图标沿用官方那颗。 */
  coins: [
    ['path', {
      d: 'M11.2077 11.0832C13.7219 11.0832 15.7601 9.04507 15.7601 6.53088C15.7601 4.01668 13.7219 1.97852 11.2077 1.97852C8.6935 1.97852 6.65533 4.01668 6.65533 6.53088C6.65533 9.04507 8.6935 11.0832 11.2077 11.0832Z',
    }],
    ['path', {
      d: 'M2.05883 7.07063C2.40649 5.06634 4.30083 3.70985 6.31403 4.03225C8.31238 4.35169 9.68225 6.2074 9.41481 8.20129C9.41481 8.34911 9.51357 8.81255 9.57973 9.03629C9.77436 9.69448 10.1844 10.6335 11.015 11.721C12.2615 13.3554 11.948 15.691 10.3152 16.9375C8.68085 18.1841 6.34524 17.8721 5.09869 16.2378C2.41541 12.7239 1.71413 9.22201 2.0514 7.11817L2.05883 7.07063Z',
    }],
    ['path', {
      d: 'M8.52786 8.98262L7.26662 12.7829C6.82516 14.1131 7.54561 15.5493 8.87578 15.9907L12.6761 17.252C14.0062 17.6934 15.4424 16.973 15.8839 15.6428L17.1451 11.8425C17.5866 10.5124 16.8662 9.07616 15.536 8.6347L11.7357 7.37346C10.4055 6.932 8.96932 7.65244 8.52786 8.98262Z',
    }],
  ],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`tabler-icon tabler-icon-${name}`}
      aria-hidden="true"
    >
      {ICONS[name].map(([tag, attrs], index) => (
        tag === 'path'
          ? <path key={index} {...(attrs as { d: string })} />
          : null
      ))}
    </svg>
  );
}
