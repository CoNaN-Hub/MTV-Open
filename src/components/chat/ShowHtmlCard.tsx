/**
 * `ShowHtmlCard` —— 官方 `ure`（`vendor-pkg-canvas-ChpWx5JY.js` **@2358363**，`ure=a.memo(...)`；
 * `ure.displayName=` @2360551）的**逐字**复刻。
 *
 * 官方原文（逐字，`_rawat.mjs` 原始窗口读出）：
 * ```js
 * ure=a.memo(({content:e})=>{
 *   const{t}=se(),n=sn(d=>d.setHtmlPreviewTarget),o=e.request??e,
 *         r=o.title??"HTML",i=o.artifact_path,l=o.description,
 *         c=t("chatAdapter.artifactPanel.openInteractivePage","Open interactive page");
 *   return i ? s.jsxs("button",{type:"button",
 *     onClick:()=>n({artifactPath:i,title:r,description:l}),
 *     className:"group/card relative my-2 flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl bg-chat-bubble-header py-4 pl-5 pr-4 text-left transition-colors duration-200 focus:outline-none",
 *     children:[
 *       s.jsx("span",{"aria-hidden":!0,className:"pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 group-hover/card:bg-white/[0.04]"}),
 *       s.jsx("span",{"aria-hidden":!0,className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_80px_at_bottom_left,rgba(155,232,255,0.06)_0%,rgba(0,0,0,0)_100%)] transition-opacity duration-200 group-hover/card:opacity-0"}),
 *       s.jsx("span",{"aria-hidden":!0,className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_80px_at_bottom_left,rgba(155,232,255,0.1)_0%,rgba(0,0,0,0)_100%)] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"}),
 *       s.jsx("span",{"aria-hidden":!0,className:"pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1.5px)] bg-[length:8px_8px] opacity-80 [mask-image:radial-gradient(circle_60px_at_bottom_left,black,transparent)] transition-opacity duration-200 [-webkit-mask-image:radial-gradient(circle_60px_at_bottom_left,black,transparent)] group-hover/card:opacity-100"}),
 *       s.jsx(wj,{size:28,stroke:1,className:"relative shrink-0 text-white/50 transition-colors duration-200 group-hover/card:text-white/80"}),
 *       s.jsxs("div",{className:"relative flex min-w-0 flex-1 flex-col gap-1",children:[
 *         s.jsx("span",{className:"truncate font-sans text-[14.5px] font-[590] leading-[22.5px] tracking-[-0.375px] text-popover-foreground transition-colors duration-200 group-hover/card:text-foreground",children:r}),
 *         s.jsx("span",{className:"truncate font-sans text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover/card:text-white/75",children:c})]})]})
 *   : null;
 * });
 * ure.displayName="ShowHtmlCard";
 * ```
 *
 * ⚠️⚠️ **与契约文档 §6.7 的一处实质分歧（以 live 源码为准）**：
 *   文档 §6.7 的「逐字要点」表把副标题写成 `o.description`，并在正文里断言
 *   「唯一 key `chatAdapter.artifactPanel.openInteractivePage` 被赋给 `c` 后**没有被使用**…该卡没有 a11y label」。
 *   **live 原始窗口显示副标题的 `children` 是 `c`，不是 `l`**（`l` 只在 `onClick` 里作为 `description` 传给 store）：
 *       `…group-hover/card:text-white/75",children:c})]})]})`
 *   ⇒ 本实现按 live 源码：**副标题渲染 `c` = `t("chatAdapter.artifactPanel.openInteractivePage")`**，
 *      `description` 仅进 store。这不是「自己断言」，是 `_rawat.mjs` 原文；已在报告中登记。
 */import { memo } from 'react';
import { useWidgetText } from '../../services/chat/widgetStrings';
import { useSetHtmlPreviewTarget } from '../../services/chat/htmlPreviewTarget';

/** 官方 `o = content.request ?? content` 的有效载荷。 */
export interface ShowHtmlPayload {
  title?: string;
  description?: string;
  artifact_path?: string;
}

/** 官方 `content`。 */
export interface ShowHtmlCardContent extends ShowHtmlPayload {
  status?: string;
  request?: ShowHtmlPayload;
}

export interface ShowHtmlCardProps {
  content: ShowHtmlCardContent;
}

/**
 * 官方 `wj` = lucide **`file-text-spark`**（`vendor-libs-CQ5RMq_I.js` `wWt=p("outline","file-text-spark","FileTextSpark",kjr)`
 * @2292502，iconNode `kjr` 逐字）。
 *
 * ⚠️ MTV 的 `lucide-react@0.546` **没有导出 `FileTextSpark`**（已实测：`require('lucide-react').FileTextSpark === undefined`），
 *    故按官方 iconNode 内联。svg 属性**逐字复刻官方 lucide 运行时**（`vendor-libs` @360150 区）：
 *    `{...defaultAttributes, width:size, height:size, stroke:color, strokeWidth, className:Mct("lucide", className),
 *      ...(!children && !hasA11yProp(rest) && {"aria-hidden":"true"}), ...rest}`
 *    其中 `defaultAttributes = {xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",
 *    fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"}`；
 *    `Mct` 是「去空 + 去重」的 join。
 *    ⚠️ 官方调用点传的是 **`stroke:1`**（不是 `strokeWidth`）⇒ 经 `...rest` 覆盖 `stroke:"currentColor"` 为 `1`。
 *    这是官方原样（本组件保留该属性，不做「修正」）。
 */
function OfficialFileTextSparkIcon({
  size,
  stroke,
  className,
}: {
  size: number;
  stroke?: string;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-file-text-spark${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <path d="M14 3v4a1 1 0 0 0 1 1h4" />
      <path d="M12 21h-5a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v3.5" />
      <path d="M9 9h1" />
      <path d="M9 13h6" />
      <path d="M9 17h3" />
      <path d="M19 22.5a4.75 4.75 0 0 1 3.5 -3.5a4.75 4.75 0 0 1 -3.5 -3.5a4.75 4.75 0 0 1 -3.5 3.5a4.75 4.75 0 0 1 3.5 3.5" />
    </svg>
  );
}

const ShowHtmlCard = memo(function ShowHtmlCard({ content }: ShowHtmlCardProps) {
  const t = useWidgetText();
  const setHtmlPreviewTarget = useSetHtmlPreviewTarget();
  const payload = content.request ?? content;
  const title = payload.title ?? 'HTML';
  const artifactPath = payload.artifact_path;
  const description = payload.description;
  const openInteractivePage = t(
    'chatAdapter.artifactPanel.openInteractivePage',
    'Open interactive page',
  );

  return artifactPath ? (
    <button
      type="button"
      onClick={() => setHtmlPreviewTarget({ artifactPath, title, description })}
      className="group/card relative my-2 flex w-full cursor-pointer items-center gap-4 overflow-hidden rounded-2xl bg-chat-bubble-header py-4 pl-5 pr-4 text-left transition-colors duration-200 focus:outline-none"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 group-hover/card:bg-white/[0.04]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_80px_at_bottom_left,rgba(155,232,255,0.06)_0%,rgba(0,0,0,0)_100%)] transition-opacity duration-200 group-hover/card:opacity-0"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_80px_at_bottom_left,rgba(155,232,255,0.1)_0%,rgba(0,0,0,0)_100%)] opacity-0 transition-opacity duration-200 group-hover/card:opacity-100"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.09)_1px,transparent_1.5px)] bg-[length:8px_8px] opacity-80 [mask-image:radial-gradient(circle_60px_at_bottom_left,black,transparent)] transition-opacity duration-200 [-webkit-mask-image:radial-gradient(circle_60px_at_bottom_left,black,transparent)] group-hover/card:opacity-100"
      />
      {/* 官方调用点逐字传 `stroke:1`（不是 `strokeWidth`）⇒ React 序列化为 `stroke="1"`；
          这里保留同一个字面值（`stroke` 的 React 类型只收 `string`，故做一次类型断言，运行时值不变）。 */}
      <OfficialFileTextSparkIcon
        size={28}
        stroke={1 as unknown as string}
        className="relative shrink-0 text-white/50 transition-colors duration-200 group-hover/card:text-white/80"
      />
      <div className="relative flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-sans text-[14.5px] font-[590] leading-[22.5px] tracking-[-0.375px] text-popover-foreground transition-colors duration-200 group-hover/card:text-foreground">
          {title}
        </span>
        {/* 官方 live 逐字：`children:c`（= `chatAdapter.artifactPanel.openInteractivePage`），**不是** `description`。 */}
        <span className="truncate font-sans text-xs font-normal leading-[18px] text-white/60 transition-colors duration-200 group-hover/card:text-white/75">
          {openInteractivePage}
        </span>
      </div>
    </button>
  ) : null;
});

ShowHtmlCard.displayName = 'ShowHtmlCard';

export default ShowHtmlCard;
