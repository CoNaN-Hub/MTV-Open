/**
 * 官方节点工具条**容器**（`zoom-slider-3ZcFvYQO.js` @1477578 `cPe`，导出 `qD = memo(cPe)`）的共用交互。
 *
 * 源码逐字（`cPe` 里那个 `<div>` 的属性）：
 *   ref:      `scaleMode === "canvas" ? Sh("--float-scale") : undefined`
 *   onClick:  `m => { m.stopPropagation(); m.preventDefault(); }`
 *   style:    `{ …r, ...(scaleMode === "inherit" ? { "--float-scale": 1 } : {}),
 *                "--float-y": "-100%", "--float-offset": "12px", transformOrigin: "center bottom" }`
 *   className:`nodrag cursor-default w-fit h-12 p-1 rounded-full flex flex-nowrap items-center
 *               justify-between bg-popover border z-10 whitespace-nowrap gap-1 text-white/90
 *               node-float-ui-visible`
 *
 * 这里只搬**交互**那一行（几何/配色在 `styles/nodes.css` 的 `.node-floating-toolbar`）：
 * 点工具条本体（按钮之间的空隙、组间分隔线、容器 padding）**不冒泡**到画布
 * ⇒ 既不会取消节点选中、也不会触发画布点选/框选，更不会让节点开始拖拽。
 * 5 个节点类型（图像 / 文本 / 视频 / 音频 / 全景）共用同一份 —— 官方就只有一个 `qD`。
 */
export function stopToolbarContainerClick(event: {
  stopPropagation: () => void;
  preventDefault: () => void;
}): void {
  event.stopPropagation();
  event.preventDefault();
}
