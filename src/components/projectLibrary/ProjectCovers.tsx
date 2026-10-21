/**
 * ProjectCovers — 项目封面（逐字移植官方 TapNow 打包产物）
 * ══════════════════════════════════════════════════════════════════════════
 * 1) `MarbleAvatar` —— 官方 `Ke`＝**boring-avatars** 的 `marble` 变体。
 *    官方源码原文（`index-BsHyQ2qj.js` @6728550 起，UMD 打包）：
 *
 *      var d = function(_) {                       // hashCode
 *        for (var M = 0, w = 0; w < _.length; w++) M = (M << 5) - M + _.charCodeAt(w), M &= M;
 *        return Math.abs(M);
 *      };
 *      var u = function(_, M) { return Math.floor(_ / Math.pow(10, M)) % 10; };            // getDigit
 *      var f = function(_, M, w) { var x = _ % M; return w && u(_, w) % 2 === 0 ? -x : x; }; // getUnit
 *      var y = function(_, M, w) { return M[_ % w]; };                                     // getRandomColor
 *
 *      // marble：Array.from({length:3}, (O, z) => ({
 *      //   color:      y(L + z, R, j),
 *      //   translateX: f(L * (z + 1), 8, 1),
 *      //   translateY: f(L * (z + 1), 8, 2),
 *      //   scale:      1.2 + f(L * (z + 1), 4) / 10,
 *      //   rotate:     f(L * (z + 1), 360, 1),
 *      // }))            // L = d(name)，j = colors.length
 *
 *      svg: viewBox 0 0 80 80 · fill none · role img · width/height = size
 *           mask#useId(maskUnits userSpaceOnUse, 0 0 80 80) > rect(80×80, rx = square ? undefined : 160, #FFFFFF)
 *           g[mask]:
 *             rect(80×80, fill = T[0].color)
 *             path(d=M32.414…, fill=T[1].color, transform=translate(T[1].x T[1].y) rotate(T[1].rotate 40 40) scale(**T[2].scale**))
 *             path(d=M22.216…, fill=T[2].color, style=mix-blend-mode:overlay,
 *                  transform=translate(T[2].x T[2].y) rotate(T[2].rotate 40 40) scale(T[2].scale))
 *           defs > filter#filter_useId(filterUnits userSpaceOnUse, colorInterpolationFilters sRGB)
 *                    > feFlood(flood-opacity 0) · feBlend(SourceGraphic, BackgroundImageFix)
 *                    > feGaussianBlur(stdDeviation 7, result effect1_foregroundBlur)
 *
 *    ⚠️ 两条 path 的 `scale()` **都取 T[2].scale**（官方原文如此），不是各自 z 的 scale。
 *
 *    官方调用（项目卡 / 收藏夹封面 / 列表预览格三处完全一致）：
 *      <Ke size="100%" preserveAspectRatio="none" className="h-full w-full" name={projectId}
 *          variant="marble" square colors={["#3e3e41","#3f66a2","#567ebb","#606d80","#a3a7ae"]} />
 *
 *    校验（9444 实测 DOM，项目 id `4f10c54e-c98b-42d0-b6bd-9cb70bdb0d2f`）：
 *      hash = 556055423（%5 = 3）⇒ 底色 #606d80 / path1 #a3a7ae / path2 #3e3e41，
 *      path1 `translate(-6 -6) rotate(-286 40 40) scale(1.3)`、path2 `translate(-5 -5) rotate(-69 40 40) scale(1.3)`
 *      —— 与本文件实现逐值一致（见 `_marble-check.mjs`）。
 *
 * 2) `FolderCover` —— MTV 项目库弹窗仍在用（官方工作空间已改走收藏夹卡，见 WorkspaceCovers.tsx）。
 */
import { useId } from 'react';
import { MARBLE_COLORS, marbleSpecs } from './marble';

export interface MarbleAvatarProps {
  /** 官方 `name`：决定取色的哈希种子（项目/收藏夹 id） */
  name: string;
  colors?: readonly string[];
  /** 官方 `size`（默认 "100%"） */
  size?: string | number;
  /** 官方 `square`：`rx = square ? undefined : 160` */
  square?: boolean;
  preserveAspectRatio?: string;
  className?: string;
}

/** 官方 `Ke`（boring-avatars marble）—— 无快照项目的封面 */
export function MarbleAvatar({
  name,
  colors = MARBLE_COLORS,
  size = '100%',
  square = true,
  preserveAspectRatio = 'none',
  className,
}: MarbleAvatarProps) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const T = marbleSpecs(name, colors);
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      aria-hidden="true"
    >
      <mask id={uid} maskUnits="userSpaceOnUse" x="0" y="0" width="80" height="80">
        {/* 官方 `rx: square ? undefined : 160` */}
        <rect width="80" height="80" rx={square ? undefined : 160} fill="#FFFFFF" />
      </mask>
      <g mask={`url(#${uid})`}>
        <rect width="80" height="80" fill={T[0].color} />
        <path
          filter={`url(#filter_${uid})`}
          d="M32.414 59.35L50.376 70.5H72.5v-71H33.728L26.5 13.381l19.057 27.08L32.414 59.35z"
          fill={T[1].color}
          transform={`translate(${T[1].translateX} ${T[1].translateY}) rotate(${T[1].rotate} 40 40) scale(${T[2].scale})`}
        />
        <path
          filter={`url(#filter_${uid})`}
          style={{ mixBlendMode: 'overlay' }}
          d="M22.216 24L0 46.75l14.108 38.129L78 86l-3.081-59.276-22.378 4.005 12.972 20.186-23.35 27.395L22.215 24z"
          fill={T[2].color}
          transform={`translate(${T[2].translateX} ${T[2].translateY}) rotate(${T[2].rotate} 40 40) scale(${T[2].scale})`}
        />
      </g>
      <defs>
        <filter id={`filter_${uid}`} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation={7} result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  );
}

/* ── 官方花标（三个 path 原样，`gt`） ── */
const ROSETTE_PATHS = [
  'M11.2077 11.0832C13.7219 11.0832 15.7601 9.04507 15.7601 6.53088C15.7601 4.01668 13.7219 1.97852 11.2077 1.97852C8.6935 1.97852 6.65533 4.01668 6.65533 6.53088C6.65533 9.04507 8.6935 11.0832 11.2077 11.0832Z',
  'M2.05883 7.07063C2.40649 5.06634 4.30083 3.70985 6.31403 4.03225C8.31238 4.35169 9.68225 6.2074 9.41481 8.20129C9.41481 8.34911 9.51357 8.81255 9.57973 9.03629C9.77436 9.69448 10.1844 10.6335 11.015 11.721C12.2615 13.3554 11.948 15.691 10.3152 16.9375C8.68085 18.1841 6.34524 17.8721 5.09869 16.2378C2.41541 12.7239 1.71413 9.22201 2.0514 7.11817L2.05883 7.07063Z',
  'M8.52786 8.98262L7.26662 12.7829C6.82516 14.1131 7.54561 15.5493 8.87578 15.9907L12.6761 17.252C14.0062 17.6934 15.4424 16.973 15.8839 15.6428L17.1451 11.8425C17.5866 10.5124 16.8662 9.07616 15.536 8.6347L11.7357 7.37346C10.4055 6.932 8.96932 7.65244 8.52786 8.98262Z',
];

/** 官方 `gt`：`<svg width={size} height={size} viewBox="0 0 20 20" style={{stroke: color}}>` 三个 path */
export function Rosette({
  size = 16,
  color = '#646464',
  strokeWidth = 1.06,
  className,
}: {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ stroke: color }}
      className={className}
      aria-hidden="true"
    >
      {ROSETTE_PATHS.map((d) => (
        <path key={d.slice(0, 12)} d={d} strokeWidth={strokeWidth} />
      ))}
    </svg>
  );
}

/* ── 以下为 MTV 项目库弹窗仍在用的旧组件（官方工作空间已不走这条路径） ── */

/** 官方叠卡定位（顺序即 z-index 1→3，4:3 大卡用） */
const FOLDER_CARDS = [
  { left: '5.6%', top: '37.9%', z: 1, rotate: 'rotate(-15deg)' },
  { left: '31.3%', top: '18.5%', z: 2, rotate: 'none' },
  { left: '58.5%', top: '24.6%', z: 3, rotate: 'rotate(15deg)' },
];

/** 「文件夹」封面 —— 官方 4:3 深底 + 三张扇形叠放的白卡（**仅项目库弹窗在用**） */
export function FolderCover() {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        background:
          'linear-gradient(136deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%), rgb(29,36,42)',
        borderRadius: 12,
      }}
    >
      <div className="absolute inset-0" style={{ perspective: '400px' }}>
        {FOLDER_CARDS.map((card) => (
          <div
            key={card.z}
            className="absolute"
            style={{
              width: '37.3%',
              transformOrigin: 'left top',
              left: card.left,
              top: card.top,
              zIndex: card.z,
              transform: card.rotate,
            }}
          >
            <div
              className="relative w-full"
              style={{
                aspectRatio: '100 / 134',
                borderRadius: 16,
                background: 'linear-gradient(rgb(204,206,206) 0%, rgb(147,158,158) 100%)',
                outline: '1px solid rgba(204,204,204,0.5)',
                boxShadow: '-2px -1px 10.5px rgba(0,0,0,0.4)',
              }}
            >
              <div className="absolute left-2 top-2">
                <Rosette size={16} color="#646464" strokeWidth={1.06} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 「无快照画布」封面 —— 官方 marble（五色 boring-avatars）；`seed` 即官方 `name`（项目 id）。
 * 保留此导出名是为了 MTV 其它入口（主页最近项目、项目库弹窗）继续可用。
 */
export function BlankCanvasCover({ seed, className = 'h-full w-full' }: { seed: string; className?: string }) {
  return <MarbleAvatar name={seed} className={className} />;
}
