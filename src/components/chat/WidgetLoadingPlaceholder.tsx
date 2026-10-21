/**
 * `WidgetLoadingPlaceholder` —— 官方 `pre`（`vendor-pkg-canvas-ChpWx5JY.js` **@2360571**，`pre=a.memo(...)`；
 * `pre.displayName=` @2363592）的**逐字**复刻。
 *
 * 官方原文（逐字，`_rawat.mjs` 原始窗口读出）：
 * ```js
 * const pre=a.memo(({title:e,messages:t,height:n=220})=>{
 *   const{t:o}=se(),[r,i]=a.useState(0);
 *   a.useEffect(()=>{if(!t||t.length<=1)return;
 *     const c=setInterval(()=>{i(d=>(d+1)%t.length)},2500);
 *     return()=>clearInterval(c)},[t]);
 *   const l=e||t?.[r]||o("chatAdapter.widget.generating","Generating...");
 *   return s.jsxs("div",{className:"my-2 overflow-hidden rounded-xl border border-white/10 bg-[#1F1F1F] relative",
 *     style:{height:`${n}px`},children:[
 *       s.jsx("div",{className:"absolute inset-0 dot-base"}),
 *       s.jsxs("div",{className:"absolute inset-0 wave-container",children:[
 *         s.jsx("div",{className:"absolute inset-0 wave wave-1"}),
 *         s.jsx("div",{className:"absolute inset-0 wave wave-2"})]}),
 *       s.jsxs("div",{className:"absolute bottom-0 left-0 right-0 flex items-center gap-2 px-4 py-3",children:[
 *         s.jsx("div",{className:"h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/20 border-t-white/60"}),
 *         s.jsx("span",{className:"text-[10px] text-white/30 tracking-wider",children:l})]}),
 *       s.jsx("style",{children:`…§6.4 关键帧逐字…`})]})});
 * pre.displayName="WidgetLoadingPlaceholder";
 * ```
 *
 * 逐字数值：默认高度 **220px**（inline style）；文案轮播 `setInterval(..., 2500)`，**仅当 `messages.length > 1`**；
 * 文案优先级 `title` → `messages[index]` → `t("chatAdapter.widget.generating","Generating...")`。
 *
 * `dot-base` / `wave-container` / `wave-1` / `wave-2` 与 `@keyframes wave-flow-1/2` **不是 Tailwind 工具类、
 * 也不是全局 CSS**（§6.4：`live-assets` 下没有任何 `.css`，`index-DQjoOgEC.js` 里 0 次）——它们**只**存在于
 * 本组件的内联 `<style>` 里，故这里逐字内联（也因此不受 Tailwind v3 purge 影响）。
 */
import { memo, useEffect, useState } from 'react';
import { useWidgetText } from '../../services/chat/widgetStrings';

export interface WidgetLoadingPlaceholderProps {
  title?: string;
  messages?: readonly string[];
  /** 官方默认 `height = 220`。 */
  height?: number;
}

/** 官方内联 `<style>` 的**逐字**内容（含缩进，`_rawat.mjs` @2361040 区原始窗口）。 */
export const OFFICIAL_WIDGET_LOADING_CSS = `
          .dot-base {
            background-image: radial-gradient(rgba(255,255,255,0.1) 1.5px, transparent 1.5px);
            background-size: 18px 18px;
            background-position: center;
          }
          .wave-container {
            -webkit-mask-image: radial-gradient(white 1.5px, transparent 1.5px);
            -webkit-mask-size: 18px 18px;
            -webkit-mask-position: center;
            mask-image: radial-gradient(white 1.5px, transparent 1.5px);
            mask-size: 18px 18px;
            mask-position: center;
          }
          .wave {
            filter: blur(14px);
            background-repeat: repeat;
            will-change: background-position;
          }
          .wave-1 {
            background-image: repeating-linear-gradient(
              110deg,
              transparent 0px,
              transparent 80px,
              rgba(255,255,255,0.5) 120px,
              rgba(255,255,255,0.4) 160px,
              transparent 200px,
              transparent 320px
            );
            background-size: calc(320px / sin(110deg)) 100%;
            opacity: 0.7;
            animation: wave-flow-1 5s linear infinite;
          }
          .wave-2 {
            background-image: repeating-linear-gradient(
              70deg,
              transparent 0px,
              transparent 120px,
              rgba(255,255,255,0.3) 170px,
              rgba(255,255,255,0.25) 220px,
              transparent 270px,
              transparent 420px
            );
            background-size: calc(420px / sin(70deg)) 100%;
            opacity: 0.55;
            animation: wave-flow-2 7.5s linear infinite;
          }
          @keyframes wave-flow-1 {
            from { background-position-x: 0; }
            to { background-position-x: calc(320px / sin(110deg)); }
          }
          @keyframes wave-flow-2 {
            from { background-position-x: 0; }
            to { background-position-x: calc(420px / sin(70deg)); }
          }
        `;

/** 官方轮播周期：`2500` ms。 */
export const WIDGET_LOADING_MESSAGE_INTERVAL = 2500;

const WidgetLoadingPlaceholder = memo(function WidgetLoadingPlaceholder({
  title,
  messages,
  height = 220,
}: WidgetLoadingPlaceholderProps) {
  const t = useWidgetText();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages || messages.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, WIDGET_LOADING_MESSAGE_INTERVAL);
    return () => clearInterval(timer);
  }, [messages]);

  const label =
    title || messages?.[index] || t('chatAdapter.widget.generating', 'Generating...');

  return (
    <div
      className="my-2 overflow-hidden rounded-xl border border-white/10 bg-[#1F1F1F] relative"
      style={{ height: `${height}px` }}
    >
      <div className="absolute inset-0 dot-base" />
      <div className="absolute inset-0 wave-container">
        <div className="absolute inset-0 wave wave-1" />
        <div className="absolute inset-0 wave wave-2" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 px-4 py-3">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-white/20 border-t-white/60" />
        <span className="text-[10px] text-white/30 tracking-wider">{label}</span>
      </div>
      <style>{OFFICIAL_WIDGET_LOADING_CSS}</style>
    </div>
  );
});

WidgetLoadingPlaceholder.displayName = 'WidgetLoadingPlaceholder';

export default WidgetLoadingPlaceholder;
