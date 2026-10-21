/**
 * WorkspaceCovers —— 官方「我的项目」页封面族（`page-CoyqNJe1.js` 逐字）
 * ══════════════════════════════════════════════════════════════════════════
 * 官方 `ys`（单张收藏夹封面 `CollectionCard`）：
 *   const u = R("w-full rounded-xl","shadow-[-2px_-1px_10.5px_rgba(0,0,0,0.4)]",
 *               "outline outline-1 outline-[#CCCCCC]/50", className);
 *   !image && projectId → <div className={R(u,"overflow-hidden")} style={{aspectRatio:"100 / 134"}}>
 *                           <Ke size="100%" preserveAspectRatio="none" className="h-full w-full"
 *                               name={projectId} variant="marble" square colors={五色} /></div>
 *   image              → <div className={R(u,"relative overflow-hidden")} style={{aspectRatio:"100 / 134"}}>
 *                           {!loaded && 占位层（渐变 + 花标 16px @ left-2 top-2）}
 *                           <img src={image} alt="Collection preview"
 *                                className={R("w-full h-full object-cover transition-opacity duration-200", !loaded && "opacity-0")}
 *                                onLoad={() => setLoaded(true)} /></div>
 *   否则                → <div className={R(u,"relative")}
 *                           style={{aspectRatio:"100 / 134", background:"linear-gradient(180deg, #CCCECE 0%, #939E9E 100%)"}}>
 *                           <div className="absolute left-2 top-2"><gt color="#646464" size={16} strokeWidth={1.06}/></div></div>
 *
 * 官方 `ks`（三张叠放 `CoverSet`）：positions——
 *   normal   [{left:"58.5%",top:"24.6%",rotate:15,zIndex:3},
 *             {left:"31.3%",top:"18.5%",rotate:0, zIndex:2},
 *             {left:"5.6%", top:"37.9%",rotate:-15,zIndex:1}]
 *   expanded [{left:"63.7%",top:"17.9%",rotate:15,zIndex:3},
 *             {left:"31.3%",top:"6.7%", rotate:0, zIndex:2},
 *             {left:"0.4%", top:"31.2%",rotate:-15,zIndex:1}]     // isDropTarget 时
 *   外层 `<div className={R("absolute inset-0", className)} style={{perspective:400}}>`，
 *   每个子层 `className="absolute" style={{width:"37.3%", transformOrigin:"left top", left, top, rotate, zIndex}}`
 *
 * 官方 `ra` / `la`（**列表**预览格用的 px 版叠卡，非百分比）：
 *   ra = [{left:12.8,top:15.87,width:19.56,height:26.08,rotate:-15,zIndex:1},
 *         {left:25.6,top:8.8,  width:20,   height:26.4, rotate:0,  zIndex:2},
 *         {left:40.4,top:10.87,width:19.56,height:26.08,rotate:15, zIndex:3}]
 *   la.style = {position:"absolute", left, top, width, height, transform:`rotate(${rotate}deg)`,
 *               transformOrigin:"top left", zIndex, borderRadius:4, overflow:"hidden",
 *               boxShadow:"-2px -1px 10.5px rgba(0, 0, 0, 0.40)", outline:"1px solid rgba(204, 204, 204, 0.4)"}
 *   image ? <img className="w-full h-full object-cover"/> : projectId ? marble
 *         : 渐变底 + <div className="absolute left-1 top-1"><gt size={8} strokeWidth={1.06}/></div>
 *
 * 官方 `ca`（列表 72×48 预览格）：
 *   project    → <div className="shrink-0 overflow-hidden rounded-lg" style={{width:72,height:48}}>
 *                   image ? <img className="w-full h-full object-cover"/> : marble(h-full w-full)</div>
 *   collection → <div className="shrink-0 relative overflow-hidden rounded-lg"
 *                      style={{width:72,height:48,
 *                             background:"linear-gradient(136deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 100%), #1A1E20"}}>
 *                   三张 ra/la 叠卡</div>
 *
 * 官方 `Ss`（玻璃口袋 `GlassPocket`）与 `Wo`（滤镜定义，全页只渲染一次）：
 *   rt = url("data:image/svg+xml,<svg width='284' height='116' viewBox='0 0 284 116'
 *              preserveAspectRatio='none'><path d='M0 12C0 5.37258 …V12Z' fill='black'/></svg>")
 *   <svg className="absolute inset-0" width="100%" height="100%" viewBox="0 0 284 116"
 *        preserveAspectRatio="none"><path d={qo} fill="rgba(89, 103, 107, 0.3)"
 *        filter="url(#glassPocketInnerShadow)"/></svg>
 */
import { useState } from 'react';
import { MarbleAvatar, Rosette, type MarbleAvatarProps } from '../projectLibrary/ProjectCovers';

/** 官方收藏夹 `cover_set` 元素形状（服务端字段名） */
export interface CoverSetItem {
  canvas_id?: string;
  preview_image?: string;
}

const MARBLE_PROPS = {
  size: '100%',
  preserveAspectRatio: 'none',
  square: true,
} satisfies Partial<MarbleAvatarProps>;

/* ── 官方 `ys`：单张收藏夹封面 ── */
export function CollectionCardPreview({
  image,
  projectId,
  className,
}: {
  image?: string;
  projectId?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const base = `w-full rounded-[16px] shadow-[-2px_-1px_10.5px_rgba(0,0,0,0.4)] outline outline-1 outline-[#CCCCCC]/50${
    className ? ` ${className}` : ''
  }`;

  if (!image && projectId) {
    return (
      <div className={`${base} overflow-hidden`} style={{ aspectRatio: '100 / 134' }}>
        <MarbleAvatar name={projectId} {...MARBLE_PROPS} className="h-full w-full" />
      </div>
    );
  }

  if (image) {
    return (
      <div className={`${base} relative overflow-hidden`} style={{ aspectRatio: '100 / 134' }}>
        {!loaded && (
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg, #CCCECE 0%, #939E9E 100%)' }}
          >
            <div className="absolute left-2 top-2">
              <Rosette size={16} color="#646464" strokeWidth={1.06} />
            </div>
          </div>
        )}
        <img
          src={image}
          alt="Collection preview"
          className={`w-full h-full object-cover transition-opacity duration-200${loaded ? '' : ' opacity-0'}`}
          onLoad={() => setLoaded(true)}
        />
      </div>
    );
  }

  return (
    <div
      className={`${base} relative`}
      style={{
        aspectRatio: '100 / 134',
        background: 'linear-gradient(180deg, #CCCECE 0%, #939E9E 100%)',
      }}
    >
      <div className="absolute left-2 top-2">
        <Rosette size={16} color="#646464" strokeWidth={1.06} />
      </div>
    </div>
  );
}

/* ── 官方 `ks`：三张叠放（宫格收藏夹封面） ── */
const COVER_POSITIONS = [
  { left: '58.5%', top: '24.6%', rotate: 15, zIndex: 3 },
  { left: '31.3%', top: '18.5%', rotate: 0, zIndex: 2 },
  { left: '5.6%', top: '37.9%', rotate: -15, zIndex: 1 },
];
const COVER_POSITIONS_EXPANDED = [
  { left: '63.7%', top: '17.9%', rotate: 15, zIndex: 3 },
  { left: '31.3%', top: '6.7%', rotate: 0, zIndex: 2 },
  { left: '0.4%', top: '31.2%', rotate: -15, zIndex: 1 },
];

export function CoverSet({
  coverSet = [],
  isDropTarget = false,
  className,
}: {
  coverSet?: CoverSetItem[];
  isDropTarget?: boolean;
  className?: string;
}) {
  const positions = isDropTarget ? COVER_POSITIONS_EXPANDED : COVER_POSITIONS;
  const items = [0, 1, 2].map((position) => ({
    id: coverSet[position]?.canvas_id || `empty-${position}`,
    image: coverSet[position]?.preview_image || undefined,
    projectId: coverSet[position]?.canvas_id,
    position,
  }));
  return (
    <div className={`absolute inset-0${className ? ` ${className}` : ''}`} style={{ perspective: 400 }}>
      {items.map((item) => {
        const spec = positions[item.position];
        return (
          <div
            key={item.id}
            className="absolute"
            style={{
              width: '37.3%',
              transformOrigin: 'left top',
              left: spec.left,
              top: spec.top,
              zIndex: spec.zIndex,
              transform: spec.rotate ? `rotate(${spec.rotate}deg)` : 'none',
            }}
          >
            <CollectionCardPreview image={item.image} projectId={item.projectId} />
          </div>
        );
      })}
    </div>
  );
}

/* ── 官方 `ra` / `la`：列表 72×48 预览格里的 px 版叠卡 ── */
const LIST_FOLDER_SPECS = [
  { left: 12.8, top: 15.87, width: 19.56, height: 26.08, rotate: -15, zIndex: 1 },
  { left: 25.6, top: 8.8, width: 20, height: 26.4, rotate: 0, zIndex: 2 },
  { left: 40.4, top: 10.87, width: 19.56, height: 26.08, rotate: 15, zIndex: 3 },
];

function ListStackCard({
  image,
  projectId,
  spec,
}: {
  image?: string;
  projectId?: string;
  spec: (typeof LIST_FOLDER_SPECS)[number];
}) {
  const style: React.CSSProperties = {
    position: 'absolute',
    left: spec.left,
    top: spec.top,
    width: spec.width,
    height: spec.height,
    transform: `rotate(${spec.rotate}deg)`,
    transformOrigin: 'top left',
    zIndex: spec.zIndex,
    borderRadius: 4,
    overflow: 'hidden',
    boxShadow: '-2px -1px 10.5px rgba(0, 0, 0, 0.40)',
    outline: '1px solid rgba(204, 204, 204, 0.4)',
  };
  if (image) {
    return (
      <div style={style}>
        <img src={image} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }
  if (projectId) {
    return (
      <div style={style}>
        <MarbleAvatar name={projectId} {...MARBLE_PROPS} className="h-full w-full" />
      </div>
    );
  }
  return (
    <div style={{ ...style, background: 'linear-gradient(180deg, #CCCECE 0%, #939E9E 100%)' }}>
      <div className="absolute left-1 top-1">
        <Rosette size={8} color="#646464" strokeWidth={1.06} />
      </div>
    </div>
  );
}

/* ── 官方 `ca` / `cs`：列表 72×48 预览格（项目 / 收藏夹统一入口） ── */
export type ListCoverItem =
  | { type: 'project'; previewImage?: string; projectId?: string }
  | { type: 'collection'; coverSet?: CoverSetItem[] };

export function ListCover({ item }: { item: ListCoverItem }) {
  if (item.type === 'project') {
    return (
      <div className="shrink-0 overflow-hidden rounded-[12px]" style={{ width: 72, height: 48 }}>
        {item.previewImage ? (
          <img src={item.previewImage} alt="" className="w-full h-full object-cover" />
        ) : (
          <MarbleAvatar name={item.projectId ?? ''} {...MARBLE_PROPS} className="h-full w-full" />
        )}
      </div>
    );
  }
  const coverSet = item.coverSet ?? [];
  const items = [0, 1, 2].map((index) => ({
    id: coverSet[index]?.canvas_id || `empty-${index}`,
    image: coverSet[index]?.preview_image || undefined,
    projectId: coverSet[index]?.canvas_id,
  }));
  return (
    <div
      className="shrink-0 relative overflow-hidden rounded-[12px]"
      style={{
        width: 72,
        height: 48,
        background: 'linear-gradient(136deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0) 100%), #1A1E20',
      }}
    >
      {items.map((item, index) => (
        <ListStackCard key={item.id} image={item.image} projectId={item.projectId} spec={LIST_FOLDER_SPECS[index]} />
      ))}
    </div>
  );
}

/* ── 官方玻璃口袋（`Ss` + `Wo` + `rt`） ── */
export const GLASS_POCKET_PATH =
  'M0 12C0 5.37258 5.37258 0 12 0H97.5617C103.047 0 108.435 1.4556 113.174 4.2182L137.578 18.4446C141.095 20.4942 145.092 21.5742 149.162 21.5742H272C278.627 21.5742 284 26.9468 284 33.5742V100C284 108.837 276.837 116 268 116H16C7.16345 116 0 108.837 0 100V12Z';

export const GLASS_POCKET_MASK = `url("data:image/svg+xml,%3Csvg width='284' height='116' viewBox='0 0 284 116' preserveAspectRatio='none' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='${GLASS_POCKET_PATH}' fill='black'/%3E%3C/svg%3E") 0% 0% / 100% 100% no-repeat`;

/** 官方 `Wo`：全页只渲染一次的内阴影滤镜定义 */
export function GlassPocketFilterDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none' }} aria-hidden="true">
      <defs>
        <filter id="glassPocketInnerShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feOffset dx="0" dy="8" />
          <feGaussianBlur stdDeviation="8" result="blur1" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadow1" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="color1"
          />
          <feOffset in="SourceAlpha" dx="0" dy="8" />
          <feGaussianBlur stdDeviation="8" result="blur2" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadow2" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="color2"
          />
          <feOffset in="SourceAlpha" dx="-8" dy="0" />
          <feGaussianBlur stdDeviation="8" result="blur3" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadow3" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="color3"
          />
          <feOffset in="SourceAlpha" dx="8" dy="0" />
          <feGaussianBlur stdDeviation="8" result="blur4" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadow4" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0"
            result="color4"
          />
          <feBlend in="color1" in2="color2" mode="normal" result="shadows12" />
          <feBlend in="shadows12" in2="color3" mode="normal" result="shadows123" />
          <feBlend in="shadows123" in2="color4" mode="normal" result="shadows" />
          <feBlend in="SourceGraphic" in2="shadows" mode="normal" />
        </filter>
      </defs>
    </svg>
  );
}

/** 官方 `Ss`：玻璃口袋的描边/内阴影层 */
export function GlassPocket({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="100%"
      height="100%"
      viewBox="0 0 284 116"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d={GLASS_POCKET_PATH} fill="rgba(89, 103, 107, 0.3)" filter="url(#glassPocketInnerShadow)" />
    </svg>
  );
}
