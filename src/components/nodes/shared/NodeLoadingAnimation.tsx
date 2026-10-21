/**
 * NodeLoadingAnimation — 官方「节点生成中」动效（TapNow 逐字照抄 ✓）
 *
 * 出处：官方桌面包 `zoom-slider-3ZcFvYQO.js` 的 `Eh=({nodeId,src,mediaType,estimatedDurationMs=3e4,noMedia=!1})`
 *   · 调用点（官方 8 处，逐字核对 ✓）：图片节点 @3231956 = `p&&l.jsx(Eh,{nodeId:t,src:u})`
 *     （`p` = isGenerating，`u` = 节点自己的 src）；音频 @3045849、标记卡 @3102477、
 *     视频 @3255683/@3351885/@3360772、3D @1760437 同构。
 *   · CSS：`src/styles/node-loading.css`（从官方 <style> 模板**逐字抽取**，未改写 ✓）
 *
 * 结构（官方 DOM 逐字 ✓）：
 *   z-40 包装层（`clipPath: inset(0 round 16px)`）
 *     ├─ 无底图时：`bg-[#070708]` z-0
 *     ├─ 阴影层 z-20：有底图 = rgba(0,0,0,.62)｜无底图 = rgba(0,0,0,.66)+blur(4px)
 *     └─ 动效层 z-30（`node-loading-motion-enter`）：grid-stars / grid-sweep / sweep-glow / burst / dither
 *
 * ⚠️ 官方那段「取上游媒体做模糊底图」是**死代码** ✗✓（原文 `const s=t.find(...)` 返回的是
 *    `{type,src}` 对象，紧接着 `n.get(s)` 却拿它当 Map 的 key → 恒为 undefined → 恒返回 null）
 *    ⇒ 官方**实际渲染**里从来不出现 `node-loading-media-blur` 底图；空卡永远是 `bg-[#070708]`
 *      + `node-loading-shadow-layer-empty`。
 *    这里按官方**实际渲染**对齐（不复现死分支），`node-loading-media-blur` 的 CSS 保留不动。
 *    判别式因此只剩一条：**节点自己有没有图**（`src`）。
 *      · 有图（生成中，旧图仍在下层）→ `node-loading-shadow-layer`（.62）
 *      · 无图（空卡生成中）      → `node-loading-shadow-layer-empty`（.66 + blur 4px）+ `bg-[#070708]`
 *
 * 用法：**作为同级浮层**放在卡片内容之后（官方也是同级 ✓），生成中时挂载即可。
 */
import { memo } from 'react';

interface NodeLoadingAnimationProps {
  /** 节点自己的媒体地址（官方 `src`）。有值 → 用 .62 阴影层，底图交给节点自己。 */
  src?: string;
  /** 无障碍：动效层整体隐藏（官方 wrapper 无 aria，这里补一条不影响观感） */
  label?: string;
}

function NodeLoadingAnimation({ src, label }: NodeLoadingAnimationProps) {
  const hasMedia = Boolean(src);
  return (
    <div
      className="absolute top-0 left-0 z-40 h-full w-full overflow-hidden rounded-2xl isolate"
      style={{ clipPath: 'inset(0 round 16px)' }}
      data-testid="node-loading-animation"
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {/* 官方：无底图时先铺一层近黑底（#070708）*/}
      {!hasMedia && (
        <div className="absolute top-0 left-0 z-0 h-full w-full overflow-hidden rounded-2xl bg-[#070708]" />
      )}
      {/* 官方阴影层：有图 .62；空卡 .66 + blur(4px) */}
      <div className={`absolute z-20 ${hasMedia ? 'node-loading-shadow-layer' : 'node-loading-shadow-layer-empty'}`} />
      {/* 官方动效层：五层，入场 420ms cubic-bezier(.16,1,.3,1) */}
      <div className="node-loading-motion-enter absolute top-0 left-0 z-30 h-full w-full overflow-hidden rounded-2xl">
        <div className="node-loading-grid-stars absolute inset-0" />
        <div className="node-loading-grid-sweep absolute inset-0" />
        <div className="node-loading-sweep-glow absolute" />
        <div className="node-loading-burst absolute inset-0" />
        <div className="node-loading-dither absolute inset-0" />
      </div>
    </div>
  );
}

export default memo(NodeLoadingAnimation);
