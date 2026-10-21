/**
 * officialNodeHistory —— 官方「应用所有历史 / 删除其他历史 / 折叠变体」的逐字口径。
 *
 * 官方出处（全部为 `E:\TapNow-0.4.66\resources\web\assets` 下 chunk 的字节偏移）：
 *
 * 1) 节点右键菜单（`page-DVqoHdTT.js`，图像节点分支 `y` @1362509，逐字）：
 *    ```js
 *    y=C=>{const E=C,N=V0(E.data);return[
 *      {label:e("common.applyAllHistory"), testId:St.CANVAS.NODE_CONTEXT_MENU.UNGROUP_ITEM,  hidden:!E.data.src, onClick:()=>{x(E)}},
 *      {label:e("common.deleteVariants"),  tips:e("common.deleteVariantsTip"), testId:St.CANVAS.NODE_CONTEXT_MENU.KEEP_MAIN_ITEM, hidden:N<=1, onClick:()=>{m(E)}},
 *      {label:e("common.download"),        testId:St.CANVAS.NODE_CONTEXT_MENU.DOWNLOAD_ITEM, hidden:!E.data.src, onClick:()=>{g(E)}},
 *    ].filter(k=>!k.hidden)}
 *    ```
 *    ⇒ 顺序恒为 **应用所有历史 → 删除其他历史 → 下载**；
 *      `删除其他历史` 的可见条件 = `V0(data) > 1`，并带 tips = `common.deleteVariantsTip`。
 *    菜单渲染处 `z`（@1374650）把 `tips` 渲染成标签右侧的 ⓘ（`U.tips && J(U.tips)`）。
 *
 * 2) 折叠变体计数 `V0`（`page-DVqoHdTT.js`@1359974，逐字）：
 *    ```js
 *    function V0(e){const t=new Set;e.src&&t.add(e.src);
 *      for(const n of e.options??[])n&&t.add(n);
 *      if(e.historyVariantsHidden){for(const n of e.historyLocalQueues??[])for(const s of n)s&&t.add(s);return t.size}
 *      return Math.max(t.size,e.historyVariantCount??0)}
 *    ```
 *
 * 3) 展开几何 `wme` + 常量（`page-DVqoHdTT.js`）：
 *    常量 @1357859 `const vl=80,U1=56,z1=72,mme="#3A3A3A",gme=100;`
 *    ```js
 *    function wme({sourceNode:e,historyBatches:t,position:n,title:s}){
 *      const i=[];let o=vl,a=vl*2;
 *      t.forEach((u,f)=>{
 *        const p=u.options.filter(Boolean).map((g,x)=>bme({sourceNode:e,batch:u,src:g,
 *          title:`${e.data.title||(e.type===pe.VIDEO?"Video":"Image")} ${f+1}-${x+1}`}));
 *        if(p.length===0)return;
 *        let h=vl,m=0;
 *        p.forEach(g=>{g.position={x:h,y:o};g.selected=!1;h+=mn(g)+U1;m=Math.max(m,ws(g))});
 *        a=Math.max(a,h-U1+vl);i.push(...p);o+=m+z1});
 *      const c=i.length>0?o-z1+vl:vl*2;
 *      const d=xu({title:s||"History",layoutType:"none",createdBy:"client",color:mme},n);
 *      d.width=a;d.height=c;d.selected=!0;
 *      return{groupNode:d,childNodes:i.map(u=>({...u,parentId:d.id}))}}
 *    ```
 *    分组落点（`x` handler @1362018 逐字）：
 *    `wme({sourceNode:C, historyBatches:T, position:{x:M.x+mn(C)+200, y:M.y}, title:Cme(C.data,e("common.nodeHistoryGroup"))})`
 *    然后 `requestAnimationFrame(()=>{d({nodes:[{id:I.id}],duration:800,padding:.2})})`。
 *
 * 4) 删除变体 `Sme`（`page-DVqoHdTT.js`@1360248，逐字）：
 *    ```js
 *    function Sme(e){const t=e.currentSourceFileId??Ca(e.src??"");
 *      const n=(e.historyLocalQueues??[]).findIndex(o=>o.includes(e.src??""));
 *      const i=(n>=0?e.historyLocalQueueMetadata?.[n]:void 0)??{prompt:e.prompt??"",…,createdAt:new Date().toISOString()};
 *      return{src:e.src,options:[],historyVariantsHidden:!0,historyVariantCount:e.src?1:0,
 *        historyLocalQueues:e.src?[[e.src]]:[],historyLocalQueueMetadata:e.src?[i]:[],
 *        historyLocalQueueResourceMetadata:e.src?[[_me(e)]]:[],
 *        ...(t?{currentSourceFileId:t}:{})}}
 *    ```
 *    ⇒ **只清空 `options` 并置 `historyVariantsHidden`/`historyVariantCount`，主图 `src` 原样保留、
 *      历史记录一条都不删**（这正对应 tips 文案「您仍可在侧边栏的“历史”面板中找到它们」）。
 *    回调 @1361521：`m=C=>{a(C.id,Sme(C.data));he.success(e("common.variantsHistoryDeleted"))}`。
 *
 * 5) toast 文案（`index-BsHyQ2qj.js` zh `common` 命名空间）：
 *    · `applyAllHistory` =「应用所有历史」@9140280
 *    · `deleteVariants`  =「删除其他历史」@9140100
 *    · `deleteVariantsTip` =「一键删除当前节点的所有其他折叠变体。您仍可在侧边栏的“历史”面板中找到它们。」@9140347
 *    · `variantsHistoryDeleted` =「历史已被删除，可在文件管理内查看」@9138770
 *    · `historyAppliedToCanvas` =「历史已应用到画布」@9139024
 *    · `noHistoryToApply` =「暂无可应用的历史」@9139345
 *    · `applyHistoryFailed` =「应用历史失败」@9140955
 *    · `nodeHistoryGroup` =「节点历史」@9140234
 *
 * ⚠️ 已核实（全 chunk 扫描，`tapnowloc.mjs`）：`common.applyVariants`（"应用所有变体"）、
 *    媒体查看器命名空间的 `applyAllVariants`（"应用所有变体"）、`variantsApplied`（"变体已应用"）
 *    在 0.4.66 的**全部** `.js` 里只出现在 6 份语言字典中，**没有任何消费点**（死键）。
 *    ⇒ 真正落地的「变体」入口就是上面第 2/3/4 条（应用所有历史 / 删除其他历史）。
 *
 * ⚠️ MTV 侧未移植的部分（诚实记账，见随附报告）：
 *    · `historyLocalQueues` / `historyLocalQueueMetadata` / `historyLocalQueueResourceMetadata`
 *      （官方「本地变体队列」，多媒体查看器版本队列的载体）MTV 没有对应结构 ⇒
 *      `V0` 的 hidden 分支只统计 `src + options`。
 *    · `historyPreviewSrc`（折叠态下节点显示哪一张变体，`course-…Chunk`@589300 `Mwe`）
 *      —— 本轮已移植，见下方「折叠变体可见 UI」段落与 `officialHistoryPreviewSrc` /
 *      `officialGalleryDisplaySrc` / `officialApplyVariantPatch` / `officialSelectVariantPatch`。
 *
 * ── 第二轮（本轮）在官方 chunk 上的**逐字复核**结果，与上面的出处一致 ──
 *   · `function V0(` 精确偏移 **1359987**（文件字符索引），逐字：
 *     `function V0(e){const t=new Set;e.src&&t.add(e.src);for(const n of e.options??[])n&&t.add(n);
 *      if(e.historyVariantsHidden){for(const n of e.historyLocalQueues??[])for(const s of n)s&&t.add(s);
 *      return t.size}return Math.max(t.size,e.historyVariantCount??0)}`
 *   · 常量 @1357865 逐字 `vl=80,U1=56,z1=72,mme="#3A3A3A",gme=100;`
 *   · `function wme(` @1358910；`function Sme(` @1360239；
 *     落点 `position:{x:M.x+mn(C)+200,y:M.y}` @1362074；
 *     `d({nodes:[{id:I.id}],duration:800,padding:.2})` @1362195（`requestAnimationFrame` 里 fitView）。
 *   · 节点菜单数组 @1362500 逐字（用 `V0(E.data)` 作为 `N`）：
 *     `[{label:e("common.applyAllHistory"),testId:St.CANVAS.NODE_CONTEXT_MENU.UNGROUP_ITEM,hidden:!E.data.src,onClick:()=>{x(E)}},
 *       {label:e("common.deleteVariants"),tips:e("common.deleteVariantsTip"),testId:St.CANVAS.NODE_CONTEXT_MENU.KEEP_MAIN_ITEM,hidden:N<=1,onClick:()=>{m(E)}},
 *       {label:e("common.download"),testId:St.CANVAS.NODE_CONTEXT_MENU.DOWNLOAD_ITEM,hidden:!E.data.src,onClick:()=>{g(E)}}].filter(k=>!k.hidden)`
 *   · `m` handler @1361520：`a(C.id,Sme(C.data)),he.success(e("common.variantsHistoryDeleted"))`
 *   · `function Cme(e,t){return typeof e.title=="string"&&e.title.trim()?e.title:t}` @1360870
 *     ⇒ 分组标题 = 节点 title 有值就用它，否则 `common.nodeHistoryGroup`「节点历史」。
 *   · zh `common` 逐字（`index-BsHyQ2qj.js`）：`applyAllHistory`@9140640「应用所有历史」、
 *     `deleteVariants`@9140017「删除其他历史」、`deleteVariantsTip`@9140366
 *     「一键删除当前节点的所有其他折叠变体。您仍可在侧边栏的“历史”面板中找到它们。」、
 *     `variantsHistoryDeleted`@9138794「历史已被删除，可在文件管理内查看」、
 *     `historyAppliedToCanvas`@9139048「历史已应用到画布」、`noHistoryToApply`@9139363「暂无可应用的历史」、
 *     `applyHistoryFailed`@9140975「应用历史失败」、`nodeHistoryGroup`@9140276「节点历史」。
 *   · 全 475 个 chunk 扫描确认：`applyVariants` / `applyAllVariants` / `variantsApplied`
 *     **只在 i18n 字典里出现**（`index-BsHyQ2qj.js` 各 6 处 = 6 份语言），**零消费点** ⇒ 死键，
 *     官方真正落地的「变体交互」就是节点右键菜单的「应用所有历史 / 删除其他历史」。
 */
import type { Node } from '@xyflow/react';
import type { BaseNodeData, OutputHistoryEntry } from '../types';
import { generateId } from '../store/store.utils';
import { firstNonEmptyString, officialSourceFileIdFromUrl } from './officialFavorites';

/** 官方 `vl = 80`（`page-DVqoHdTT.js`@1357865）：分组内边距 / 第一个子节点的坐标 */
export const OFFICIAL_HISTORY_GROUP_PADDING = 80;
/** 官方 `U1 = 56`（@1357871）：同一批次内子节点的水平间距 */
export const OFFICIAL_HISTORY_ITEM_GAP = 56;
/** 官方 `z1 = 72`（@1357877）：批次（行）之间的垂直间距 */
export const OFFICIAL_HISTORY_ROW_GAP = 72;
/** 官方 `mme = "#3A3A3A"`（@1357883）：历史分组节点的底色 */
export const OFFICIAL_HISTORY_GROUP_COLOR = '#3A3A3A';
/** 官方 `gme = 100`（@1357885）：取历史批次的条数上限 */
export const OFFICIAL_HISTORY_BATCH_LIMIT = 100;
/** 官方落点里的 `+200`（`page-DVqoHdTT.js`@1362018：`{x: M.x + mn(C) + 200, y: M.y}`） */
export const OFFICIAL_HISTORY_GROUP_OFFSET_X = 200;
/** 官方 `fitView` 参数（@1362030 逐字）：`{nodes:[{id: groupNode.id}], duration:800, padding:.2}` */
export const OFFICIAL_HISTORY_FIT_VIEW = { duration: 800, padding: 0.2 } as const;

/** 官方历史批次（服务端 node history 的一条 batch）：`options` 是这一次生成返回的全部图片 */
export interface OfficialHistoryBatch {
  options: string[];
  prompt?: string;
  params?: Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** 去重并丢掉空值（官方各处都先 `filter(Boolean)` 再进 `Set`） */
function distinctUrls(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!isNonEmptyString(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

/**
 * 官方 `e.data.src` 在 MTV 的等价物：节点当前的主图 / 主媒体。
 * 图片卡读 `imageUrl`，视频卡 `videoUrl`，音频卡 `audioUrl`，源卡再回落 `filePath` 派生的 URL。
 */
export function officialNodeSrc(data: BaseNodeData | undefined): string {
  if (!data) return '';
  for (const value of [data.imageUrl, data.videoUrl, data.audioUrl, data.thumbnailUrl]) {
    if (isNonEmptyString(value)) return value;
  }
  return '';
}

/** 官方 `V0(e)`（`page-DVqoHdTT.js`@1359974）：节点的「折叠变体数」 */
export function officialVariantCount(data: BaseNodeData | undefined): number {
  if (!data) return 0;
  const urls = new Set<string>();
  const src = officialNodeSrc(data);
  if (src) urls.add(src);
  const options = Array.isArray(data.options) ? data.options : [];
  for (const option of options) if (isNonEmptyString(option)) urls.add(option);
  /* 官方 hidden 分支会再并入 `historyLocalQueues`（MTV 没有该结构，见文件头记账） */
  if (data.historyVariantsHidden === true) return urls.size;
  const known = typeof data.historyVariantCount === 'number' ? data.historyVariantCount : 0;
  return Math.max(urls.size, known);
}

/**
 * 官方 `Sme(e)`（`page-DVqoHdTT.js`@1360248）在 MTV 节点数据上的落地：
 * 清空 `options`、标记 `historyVariantsHidden`、把计数落到 1，**主图与历史记录都不动**。
 */
export function officialDeleteVariantsPatch(data: BaseNodeData | undefined): Partial<BaseNodeData> {
  const src = officialNodeSrc(data);
  return {
    options: [],
    historyVariantsHidden: true,
    historyVariantCount: src ? 1 : 0,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   「折叠变体」可见 UI —— 官方 `MediaGalleryOnNode`（`UT`）+ `MediaItem`（`Ree`）
   ＋ 计数药丸 `$O` 的逐字口径。

   官方出处（`E:\TapNow-0.4.66\resources\web\assets\course-api-base-url-CGXqZmAy.js`，
   0-based 字符偏移，均为逐字原文）：
   · 常量 @3133757：`const Xf=16,yst=48,vst=8,xst=[],ma="historyPreviewSrc";`
   · @3097539 `const Fnt={width:100,height:100},Ont=16,Lnt=4,jnt=5,Bnt=10,znt="__history_stack_placeholder_";`
   · 折叠堆叠数 `ZE`（@3097603）：
     `function ZE(e,t){return e<=0?0:t?Math.min(Math.max(e-1,0),3):Math.min(e,4)}`
   · 关画廊时露出的条目 `Vnt`（@3097668）：
     `function Vnt({items:e,currentItem:t,isHistoryMode:n,stackCount:s}){if(n){const r=s??ZE(e.length,!0);return j$(e,t).slice(0,r)}return e.slice(0,ZE(e.length,!1))}`
     `j$(e,t,n){return t?e.filter(s=>!vo(s,t,n)):e}`（@433591）= 去掉当前主图
   · 点击语义 `Hnt`（@3097802）：
     `function Hnt({isOpen:e,isHistoryMode:t,isPlaceholder:n}){return e||t&&!n?"select":"toggle"}`
   · `MediaItem` 的几何（`Ree` @3092533 逐字）：
     ```js
     const I = useMemo(()=>{const V=x?d:d+1,H=Math.min(V,V>4?4:2),$=x?n:n+1,W=$%H,Y=Math.floor($/H),
       Q=n<a?12*(n+1):0,q=n<a?4*(n+1):0;
       return{left:s?(o.width+i)*W:Q,top:s?-(o.height+i)*Y:q}},[n,s,o.width,o.height,i,a,d,x]);
     const B = {width:r.width,height:r.height,zIndex:s?Bnt:-1*(n+1),scale:s?1:n<a?1-(n+1)*(.14/a):1};
     const k = {rotate:s?0:n<a?c*(n+1):0,...I};
     const P = {...Pnt,delay:s?n*.03:0};    // Pnt={type:"spring",damping:18,stiffness:280}
     ```
     外层类名逐字：
     `group/item min-w-full min-h-full absolute bg-muted/40 border rounded-xl border-border/60 overflow-hidden backdrop-blur-sm`
     ＋ `cursor-pointer`（disabled 时 `cursor-not-allowed opacity-70`）
     图片类名逐字：
     `w-full h-full object-contain transition-[transform,opacity] duration-300 group-hover/item:scale-110`
     ＋ 打开时 `opacity-100`、折叠时 `opacity-0`（**折叠态的堆叠卡只露边框、不显图**）
   · 计数药丸 `$O`（@3096620 逐字）：
     ```js
     const $O=({totalCount:e,nodeId:t,nodeType:n="image",className:s,loading:r=!1,disabled:o=!1,trackOnOpen:i=!0})=>{
       const f=e>=50?"50+":e, m=o||r||e<=0, p=$x(t);
       return u?null:l.jsxs(Jt,{onClick:g,disabled:m,variant:"secondary",
         className:Z("group/indicator h-7 rounded-[10px] px-3 py-1.5 text-xs font-semibold",
                    "bg-black/50 hover:bg-black/70 text-[#F5F5F5]",
                    "cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",s),
         children:[r?l.jsx(ko,{className:"animate-spin",size:16}):l.jsx("span",{children:f}),
           l.jsx(l_,{className:Z(p?"rotate-0":"rotate-90","transition-transform duration-300 ease-in-out ml-2 group-hover/indicator:rotate-0"),size:16})]})}
     ```
     渲染处（图像节点）`l.jsx($O,{nodeId:s,totalCount:ge,loading:ce,trackOnOpen:ae,disabled:c,className:"absolute top-3 right-3 z-10"})`；
     `l_` = Tabler `chevron-right`（9444 实测 `class="tabler-icon tabler-icon-chevron-right …"`，`<path d="M9 6l6 6l-6 6">`）
     ⇒ **折叠时 `rotate-90`（指向下 ▾）、展开时 `rotate-0`（指向右 ▶）**。
   · 展开行背后的暗色渐变层（图像节点 @3238300 区域逐字）：
     `l.jsx("div",{className:"absolute z-[5] nodrag rounded-3xl",style:{left:-(te.btnSize+te.btnOffset+16),top:te.top-32,
       width:te.width+(te.btnSize+te.btnOffset+16)*2,height:te.height+80,
       background:"radial-gradient(ellipse 72.97% 122.43% at 50% 50%, #09090B 0%, rgba(9,9,11,0) 100%)",
       backdropFilter:"blur(2px)",transition:"top 0.3s ease-out, left 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out"}})`
     其中 `te`（网格几何，`zee` 的 `De` @3145802）：
     ```js
     const et = ce.length>4?4:2, Be = Math.min(ce.length, et), se = Math.ceil(ce.length/et),
       xe = Be*w + (Be-1)*16, Ze = se*h + (se-1)*16;
     return {gap:16,btnSize:48,btnOffset:8,cols:Be,rows:se,width:xe,height:Ze,
             right:Be*w+(Be-1)*16,top:-((se-1)*(h+16)),bottom:h,centerY:-((se-1)*(h+16))/2+h/2}
     ```
   · 批次指示点（同一段逐字，`F.length>1` 才出现）：
     `className:"absolute z-20 flex items-center gap-3 flex-wrap max-w-full"`，style `{left:0,top:te.bottom+16}`；
     每个点 `className:Z("h-2 rounded-full cursor-pointer transition-all", i===ee?"w-[42px] bg-[#F5F5F5]":"w-6 bg-[#D9D9D9] opacity-40 hover:opacity-70")`
   · 卡片内三个小按钮（`MediaItem` 打开且 `onApply` 存在时）逐字：
     左上容器 `absolute top-2 left-2 flex items-center gap-0.5 bg-black/50 rounded-[10px] px-0.5 py-0.5 transition-opacity duration-300`
       ＋ `opacity-0 pointer-events-none group-hover/item:opacity-100 group-hover/item:pointer-events-auto`
     每个按钮（官方 `JI` → `Jt variant="ghost" size="icon"`，`Dnt` @3091877 逐字）
       `h-7 w-7 rounded-[10px] text-[#F5F5F5] hover:text-[#F5F5F5] hover:bg-white/10 cursor-pointer transition-colors`
     顺序 + tooltip：`common.favorite`（Tabler star）/ `common.applyToCanvas`（Tabler copy）/ `common.download`（Tabler download）
     ⚠️ 9444 实测：中间那颗 **图标是 Tabler `copy`，但 tooltip 是「应用到画布」**（`common.applyToCanvas`），
        点击走 `handleApply`（= 把这张变体作为**新节点**复制到画布，toast
        `"The current image has been copied to the canvas"`，`course-…`@3143120 的 `ft`）。
     「设为主图」药丸（`g` = onApply 存在那支）逐字：
     右上容器 `absolute top-2 right-2 flex items-center bg-black/50 rounded-[10px] px-3 py-1.5 transition-opacity duration-300`
       ＋ 同上的 `opacity-0 … group-hover/item:opacity-100 …`
     按钮 `text-[#F5F5F5] text-xs font-semibold leading-4 cursor-pointer whitespace-nowrap hover:opacity-80 transition-opacity`
       ＋ 文案 `common.setAsMainImage`（zh「设为主图」）
     ⚠️ 实测：**每一张**（含当前主图那张）都挂着这颗药丸，只是 `opacity-0` 直到 hover 该卡。
   · 「点外部收回」：官方展开门是 `z.length>0 && (p||L)`，`p` = 节点 `selected`。
     9444 实测：点画布空白 → `selected:false` ⇒ 画廊整段卸载（`itemCount:0`）、药丸也消失。
   ══════════════════════════════════════════════════════════════════════════ */

/** 官方 `Fnt`（@3097539）：`MediaItem` 的默认单元尺寸 */
export const OFFICIAL_GALLERY_DEFAULT_CELL = { width: 100, height: 100 } as const;
/** 官方 `Xf = 16`（@3133757）：卡片间距（`gap`） */
export const OFFICIAL_GALLERY_GAP = 16;
/** 官方 `yst = 48`（@3133757）：展开行外圈暗色层的按钮尺寸补偿 */
export const OFFICIAL_GALLERY_BTN_SIZE = 48;
/** 官方 `vst = 8`（@3133757）：展开行外圈暗色层的按钮偏移补偿 */
export const OFFICIAL_GALLERY_BTN_OFFSET = 8;
/** 官方 `Lnt = 4`（@3097539）：参与旋转/缩放的折叠堆叠卡上限索引 */
export const OFFICIAL_GALLERY_MAX_ROTATE_INDEX = 4;
/** 官方 `jnt = 5`（@3097539）：折叠堆叠卡每张多转 5° */
export const OFFICIAL_GALLERY_ROTATE_VALUE = 5;
/** 官方 `Bnt = 10`（@3097539）：展开态卡片 z-index */
export const OFFICIAL_GALLERY_OPEN_Z_INDEX = 10;
/** 官方 `Ont = 16`（@3097539）：`MediaItem` 收到的 `gap` */
export const OFFICIAL_GALLERY_ITEM_GAP = 16;
/** 官方 `e>=50?"50+":e`（@3096620 药丸里的计数文案上限） */
export const OFFICIAL_GALLERY_COUNT_DISPLAY_CAP = 50;

/** 官方 `ZE(e,t)`（@3097603）：折叠态最多露几张 */
export function officialCollapsedStackCount(length: number, isHistoryMode: boolean): number {
  if (length <= 0) return 0;
  return isHistoryMode
    ? Math.min(Math.max(length - 1, 0), 3)
    : Math.min(length, 4);
}

/** 官方 `vo` 的 MTV 等价：按 URL 去重比较（MTV 没有 CDN 变体归一，只做精确串比较） */
export function officialSameMediaUrl(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a === b;
}

/**
 * 官方 `Vnt({items,currentItem,isHistoryMode,stackCount})`（@3097668）：
 * 折叠态实际渲染哪几张（history 模式去掉当前主图，其余模式取前 N 张）。
 */
export function officialCollapsedStackItems(
  items: readonly string[],
  currentItem: string,
  isHistoryMode: boolean,
  stackCount?: number,
): string[] {
  if (isHistoryMode) {
    const count = stackCount ?? officialCollapsedStackCount(items.length, true);
    return items.filter((url) => !officialSameMediaUrl(url, currentItem)).slice(0, count);
  }
  return items.slice(0, officialCollapsedStackCount(items.length, false));
}

/** 官方 `Hnt`（@3097802）：点一张卡是「选中它」还是「展开/收起画廊」 */
export function officialGalleryClickAction(
  isOpen: boolean,
  isHistoryMode: boolean,
): 'select' | 'toggle' {
  return isOpen || isHistoryMode ? 'select' : 'toggle';
}

export interface OfficialGalleryGeometry {
  gap: number;
  btnSize: number;
  btnOffset: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
  right: number;
  top: number;
  bottom: number;
  centerY: number;
}

/** 官方 `zee` 的 `De`（@3145802）：展开行网格几何 + 暗色层尺寸 */
export function officialGalleryGeometry(
  cell: { width: number; height: number },
  itemCount: number,
): OfficialGalleryGeometry {
  const gap = OFFICIAL_GALLERY_ITEM_GAP;
  const perRow = itemCount > 4 ? 4 : 2;
  const cols = Math.min(itemCount, perRow);
  const rows = Math.ceil(itemCount / perRow);
  const width = cols * cell.width + (cols - 1) * gap;
  const height = rows * cell.height + (rows - 1) * gap;
  return {
    gap,
    btnSize: OFFICIAL_GALLERY_BTN_SIZE,
    btnOffset: OFFICIAL_GALLERY_BTN_OFFSET,
    cols,
    rows,
    width,
    height,
    right: cols * cell.width + (cols - 1) * gap,
    top: -((rows - 1) * (cell.height + gap)),
    bottom: cell.height,
    centerY: -((rows - 1) * (cell.height + gap)) / 2 + cell.height / 2,
  };
}

/** 官方 `MediaItem` 的暗色渐变外圈（逐字样式对象） */
export function officialGalleryBackdropStyle(geometry: OfficialGalleryGeometry) {
  const pad = geometry.btnSize + geometry.btnOffset + 16;
  return {
    left: -pad,
    top: geometry.top - 32,
    width: geometry.width + pad * 2,
    height: geometry.height + 80,
    background: 'radial-gradient(ellipse 72.97% 122.43% at 50% 50%, #09090B 0%, rgba(9, 9, 11, 0) 100%)',
    backdropFilter: 'blur(2px)',
    transition: 'top 0.3s ease-out, left 0.3s ease-out, width 0.3s ease-out, height 0.3s ease-out',
  } as const;
}

export interface OfficialGalleryItemLayout {
  /** 展开态：`(cellWidth+gap) * (index % cols)` */
  openLeft: number;
  /** 展开态：`-(cellHeight+gap) * floor(index / cols)` */
  openTop: number;
  /** 折叠态：`index < maxRotateIndex ? 12*(index+1) : 0` */
  closedLeft: number;
  /** 折叠态：`index < maxRotateIndex ? 4*(index+1) : 0` */
  closedTop: number;
  /** 折叠态：`1 - (index+1) * (0.14 / maxRotateIndex)` */
  closedScale: number;
  /** 折叠态：`rotateValue * (index+1)`（度） */
  closedRotate: number;
  zIndex: number;
}

/**
 * 官方 `Ree` 的 `I` / `B` / `k` 三个 useMemo 合成的一张卡的布局。
 *
 * 官方出处（本轮在**运行中**的 9444 上复核过同一段：运行端 chunk
 * `course-api-base-url-0D9Dk52r.js` 与本机 `course-api-base-url-CGXqZmAy.js` 逐字同构，
 * 该段在运行端偏移 @3096653）：
 * ```js
 * const I=h.useMemo(()=>{const V=x?d:d+1,H=Math.min(V,V>4?4:2),$=x?n:n+1,
 *   W=$%H,Y=Math.floor($/H),Z=n<a?12*(n+1):0,q=n<a?4*(n+1):0;
 *   return{left:s?(o.width+i)*W:Z,top:s?-(o.height+i)*Y:q}},[n,s,o.width,o.height,i,a,d,x]);
 * const B={width:r.width,height:r.height,zIndex:s?Bnt:-1*(n+1),scale:s?1:n<a?1-(n+1)*(.14/a):1};
 * const k={rotate:s?0:n<a?c*(n+1):0,...I};
 * ```
 * 其中 `x` = `isHistoryMode`、`d` = `showItemsLength`、`n` = 该卡在**渲染集合**里的下标。
 * ⚠️ **非历史模式**（`officialGalleryIsHistoryMode === false`）时 `$ = n+1`：
 * 官方把「当前主图」算作第 0 格（它仍由节点自身渲染），变体从第 1 格往右排。
 * MTV 的折叠变体走的是（伪造的）历史模式 ⇒ `$ = n`。
 *
 * ⚠️ **实测与源码不符的一处（诚实记账）**：9444 上折叠稳态的堆叠卡实测为
 * `z-index:-1; transform:scale(0.965); left:0px; top:0px`（无 `rotate`、无 12/4 偏移），
 * 而其 `z-index=-1` 与 `scale=0.965` 只能由 `n=0 < a=4` 得出（同一分支应给 `left:12/top:4/rotate:5`）。
 * 该矛盾无法从源码解释，MTV 选择**按源码**落地（`left:12/top:4/rotate:5`）。
 */
export function officialGalleryItemLayout(
  index: number,
  isOpen: boolean,
  cell: { width: number; height: number },
  showItemsLength: number,
  isHistoryMode: boolean,
): OfficialGalleryItemLayout {
  const a = OFFICIAL_GALLERY_MAX_ROTATE_INDEX;
  const c = OFFICIAL_GALLERY_ROTATE_VALUE;
  /* 官方 `V = x ? d : d+1`；`H = Math.min(V, V>4?4:2)` */
  const v = isHistoryMode ? showItemsLength : showItemsLength + 1;
  const cols = Math.min(v, v > 4 ? 4 : 2);
  /* 官方 `$ = x ? n : n+1` */
  const slot = isHistoryMode ? index : index + 1;
  const withinRotateRange = index < a;
  return {
    openLeft: (cell.width + OFFICIAL_GALLERY_ITEM_GAP) * (slot % cols),
    openTop: -((cell.height + OFFICIAL_GALLERY_ITEM_GAP) * Math.floor(slot / cols)),
    closedLeft: withinRotateRange ? 12 * (index + 1) : 0,
    closedTop: withinRotateRange ? 4 * (index + 1) : 0,
    closedScale: withinRotateRange ? 1 - (index + 1) * (0.14 / a) : 1,
    closedRotate: isOpen ? 0 : (withinRotateRange ? c * (index + 1) : 0),
    zIndex: isOpen ? OFFICIAL_GALLERY_OPEN_Z_INDEX : -1 * (index + 1),
  };
}

/** 官方 `nK(e)`（`course-…`@589300 逐字）：`historyPreviewSrc || src` */
export function officialHistoryPreviewSrc(data: BaseNodeData | undefined): string | null {
  const value = data?.historyPreviewSrc;
  return typeof value === 'string' && value ? value : null;
}

/**
 * 官方 `Mwe(e)`（`course-…`@589300）的 `src` 覆盖分支：
 * `historyVariantsHidden !== true` 时，节点**显示** `historyPreviewSrc ?? src`。
 * MTV 只取「显示哪一张」这一条（`historyVariantsHidden` 下的 `options` 重建见 `officialDeleteVariantsPatch`）。
 */
export function officialGalleryDisplaySrc(data: BaseNodeData | undefined): string {
  return officialHistoryPreviewSrc(data) ?? officialNodeSrc(data);
}

/**
 * 官方 `MediaGalleryOnNode` 的 `galleryItems`（`UT` 里 `ce = X ? X.options : n`，运行端 @3101xxx 同构）：
 * **只取 `options`，不含 `src`** —— 因此画廊渲染的卡片数 = `options` 去重张数。
 * ```js
 * const ce=h.useMemo(()=>X?X.options:n,[X,n]);          // X = currentBatch（服务端批次）
 * ```
 * MTV 没有服务端批次 ⇒ `X` 恒为空 ⇒ 就是 `options`。
 */
export function officialGalleryItems(data: BaseNodeData | undefined): string[] {
  const options = Array.isArray(data?.options) ? data!.options : [];
  return distinctUrls(options);
}

/**
 * 官方 `historyGalleryItems`（`UT` 的 `M`）= 展开/折叠时用于「历史模式」的条目集合。
 * ```js
 * const Pe=h.useMemo(()=>H.length===0?ce:K_([W,...H.flatMap(_e=>_e.options)],Se),[H,W,ce,Se]);
 * ```
 * `H`（服务端批次）为空时它就是 `galleryItems` ⇒ MTV 与 `officialGalleryItems` 相同。
 * 官方把它作为 `closedItems` 传给 `UT`，折叠堆叠数 `closedStackCount = ZE(M.length, true)`。
 */
export function officialHistoryGalleryItems(data: BaseNodeData | undefined): string[] {
  return officialGalleryItems(data);
}

/**
 * 官方 `Cst(src, options) = K_([src, ...options]).length`（@3133247 逐字）：
 * `legacyGalleryTotalCount`，**计数药丸上的数字就是它**（`ge = ae ? k : P`，无服务端批次时 `ge = P = Oe = Cst(t,n)`）。
 * 注意与 `officialGalleryItems` 的口径差异：计数**含** `src`，卡片渲染**不含**。
 */
export function officialLegacyGalleryCount(data: BaseNodeData | undefined): number {
  const options = Array.isArray(data?.options) ? data!.options : [];
  return distinctUrls([officialNodeSrc(data), ...options]).length;
}

/**
 * 官方 `ae`（`isHistoryMode`，图像节点渲染处 `ae=!!D&&de>1&&F.length>0`）的 MTV 等价：
 * 官方要求**存在服务端历史批次** `D` 且批次数 `>1`。MTV 没有服务端批次 ⇒
 * 用「未被隐藏 + 计数 > 1」伪造为真，以复现用户在官方桌面端看到的那一支 UI
 * （`onApply`/`onFavorite` 存在的那一支：卡片左上三颗 + 右上「设为主图」）。
 * ⚠️ 若按官方字面（`ae=false`），`UT` 收到 `onApply: void 0`，卡片会走另一支：
 * 只有「设为主图」(`Jt variant=secondary size=sm`, `absolute top-2 right-12`) + 下载
 * (`Jt variant=secondary size=icon`, `absolute top-2 right-2 … rounded-full size-9`)，
 * 且展开行的 `$ = n+1`（当前主图占第 0 格）。MTV 二者都未走。
 */
export function officialGalleryIsHistoryMode(data: BaseNodeData | undefined): boolean {
  if (!data || data.historyVariantsHidden === true) return false;
  return officialLegacyGalleryCount(data) > 1;
}

/**
 * 官方 `handleApply`（`he`，`course-…`@3141396 逐字）在 MTV 节点数据上的落地：
 * ```js
 * data:{...Be.data, src:_e, options:re.options, historyVariantsHidden:y,
 *       historyVariantCount:Math.max(B?.totalCount??0,re.options.length),[ma]:void 0,
 *       currentSourceFileId:re.sourceFileIds[_e]??ne??tr(_e),prompt:re.prompt,params:je, ...VH(...)}
 * ```
 * ⇒ 换主图 + 换该批次的 `options` + **保留**当前 `historyVariantsHidden` + 重算计数 + **清空** `historyPreviewSrc`。
 */
export function officialApplyVariantPatch(
  data: BaseNodeData | undefined,
  url: string,
  options: readonly string[],
  extra?: { prompt?: string },
): Partial<BaseNodeData> {
  const nextOptions = distinctUrls(options);
  const totalCount = typeof data?.historyVariantCount === 'number' ? data.historyVariantCount : 0;
  const sourceFileId = officialSourceFileIdFromUrl(url);
  return {
    imageUrl: url,
    thumbnailUrl: url,
    output: url,
    options: nextOptions,
    historyVariantsHidden: data?.historyVariantsHidden,
    historyVariantCount: Math.max(totalCount, nextOptions.length),
    /* ★ 官方 `[ma]: void 0` —— 必须显式清掉，否则折叠态仍显示旧预览图 */
    historyPreviewSrc: undefined,
    ...(sourceFileId ? { currentSourceFileId: sourceFileId } : {}),
    ...(typeof extra?.prompt === 'string' && extra.prompt ? { prompt: extra.prompt } : {}),
  };
}

/**
 * 官方 `Ct`（`handleSelectImage`，`course-…`@3142860）**未命中服务端批次**时的分支：
 * `u(e,{src:_e,[ma]:void 0,currentSourceFileId:tr(_e)})`
 * ⇒ 只换主图 + 清 `historyPreviewSrc` + 写 `currentSourceFileId`，**不动 `options` / 计数**。
 */
export function officialSelectVariantPatch(
  url: string,
  options?: { keepHistoryVariantCount?: number },
): Partial<BaseNodeData> {
  const sourceFileId = officialSourceFileIdFromUrl(url);
  return firstNonEmptyString(url)
    ? {
        imageUrl: url,
        thumbnailUrl: url,
        output: url,
        historyPreviewSrc: undefined,
        ...(sourceFileId ? { currentSourceFileId: sourceFileId } : {}),
        ...(typeof options?.keepHistoryVariantCount === 'number'
          ? { historyVariantCount: options.keepHistoryVariantCount }
          : {}),
      }
    : {};
}

/**
 * 把 MTV 的「节点历史记录」折算成官方的 **history batches**。
 *
 * 官方 `x` handler（`page-DVqoHdTT.js`@1362018）：
 *   `const N = await gj(t, Eme(C), gme);            // 服务端 node history`
 *   `const k = vme(C);                              // 旧的 `src + options` 单批次`
 *   `const T = N.batches.length>0 ? N.batches : (k ? [k] : []);`
 *   ⇒ **服务端批次优先；没有服务端批次时才把 `src + options` 当成一个批次**（`vme`@1358433）。
 *
 * MTV 没有服务端批次，`outputHistoryRecords` 就是「服务端 node history」的等价物 ⇒
 *   1. 节点当前带 `options`（多变体批量刚跑完）⇒ 它自己就是**最新一个批次**（一行 N 张）；
 *   2. 其余历史记录（新→旧）每条各算一个批次。
 *      官方每个 batch 的各张图并排成一行；MTV 的历史记录没有 run id，无法把同一批的多张再并成一行，
 *      这里按「一条记录 = 一个批次」处理（多变体那一批已经由第 1 步覆盖，不受影响）。
 */
export function officialHistoryBatches(
  data: BaseNodeData | undefined,
  records: readonly OutputHistoryEntry[],
): OfficialHistoryBatch[] {
  const batches: OfficialHistoryBatch[] = [];
  const seen = new Set<string>();
  const src = officialNodeSrc(data);
  const options = Array.isArray(data?.options) ? data!.options : [];
  const current = distinctUrls([src, ...options]);
  const sourceNodeType = data?.type;

  for (const url of current) seen.add(url);
  if (current.length > 0) {
    batches.push({
      options: current,
      prompt: typeof data?.prompt === 'string' ? data.prompt : undefined,
      params: {
        ...(typeof data?.imageSize === 'string' ? { imageSize: data.imageSize } : {}),
        ...(typeof data?.aspectRatio === 'string' ? { aspectRatio: data.aspectRatio } : {}),
      },
    });
  }

  for (const record of records) {
    if (record.status !== 'success') continue;
    if (record.nodeType && sourceNodeType && record.nodeType !== sourceNodeType) continue;
    const url = isNonEmptyString(record.mediaUrl) ? record.mediaUrl : record.output;
    if (!isNonEmptyString(url) || seen.has(url)) continue;
    seen.add(url);
    batches.push({
      options: [url],
      prompt: record.prompt,
      params: record.params as Record<string, unknown> | undefined,
    });
    if (batches.length >= OFFICIAL_HISTORY_BATCH_LIMIT) break;
  }

  return batches.slice(0, OFFICIAL_HISTORY_BATCH_LIMIT);
}

export interface OfficialHistoryExpansionInput {
  sourceNode: Node<BaseNodeData>;
  /** 源节点的**绝对**左上角坐标（官方 `ts(C, A).x / .y`） */
  sourcePosition: { x: number; y: number };
  /** 官方 `mn(C)`：源节点宽度 */
  sourceWidth: number;
  /** 官方 `ws(child)`：子节点高度（MTV 用源节点同款尺寸建子节点） */
  childSize: { width: number; height: number };
  batches: readonly OfficialHistoryBatch[];
  /** 官方 `Cme(data, t("common.nodeHistoryGroup")) || "History"` —— **分组节点**的标题 */
  title: string;
}

export interface OfficialHistoryExpansion {
  groupNode: Node<BaseNodeData>;
  childNodes: Node<BaseNodeData>[];
}

/** 官方 `bme({sourceNode, batch, src, title})`（`page-DVqoHdTT.js`@1358096）：批次里每一张图建一个同类型节点 */
function createHistoryChildNode(
  sourceNode: Node<BaseNodeData>,
  batch: OfficialHistoryBatch,
  url: string,
  title: string,
  size: { width: number; height: number },
): Node<BaseNodeData> {
  const type = sourceNode.type ?? 'ai-image';
  const data = sourceNode.data ?? ({} as BaseNodeData);
  return {
    id: `node-${generateId()}`,
    type,
    position: { x: 0, y: 0 },
    selected: false,
    data: {
      label: title,
      type: type as BaseNodeData['type'],
      role: 'source',
      prompt: batch.prompt ?? data.prompt ?? '',
      status: 'success',
      nodeWidth: size.width,
      nodeHeight: size.height,
      /* ★ 官方 `bme` 里子节点的 `params` 是 `yme(type, {...bO(source), ...batch.params})`，
         而 MTV 的图片卡尺寸来自 `aspectRatio`（`nodeSizeForAspectRatio`）而不是 `params`
         ⇒ 这里把源节点的盒子字段一并透传，让子节点**与源节点同尺寸**：
         `wme` 的行高/列宽用的是 `mn(child)`/`ws(child)`（真实渲染尺寸），
         子节点一旦画得比 `childSize` 小，分组框就会与内容不匹配。 */
      ...(typeof data.aspectRatio === 'string' ? { aspectRatio: data.aspectRatio } : {}),
      ...(typeof data.imageWidth === 'number' ? { imageWidth: data.imageWidth } : {}),
      ...(typeof data.imageHeight === 'number' ? { imageHeight: data.imageHeight } : {}),
      ...(isNonEmptyString(url) ? { imageUrl: url, thumbnailUrl: url, output: url } : {}),
      ...(batch.params ? { params: batch.params } : {}),
    } as BaseNodeData,
  };
}

/**
 * 官方 `wme`（`page-DVqoHdTT.js`@1358919）的逐字移植：
 * 行 = 批次、列 = 批次内的 options，内边距 `vl`、列距 `U1`、行距 `z1`；
 * 分组尺寸 = 最右子节点右边 + `vl` / 最下子节点下边 + `vl`（空批次时 `vl*2`）；
 * 分组落点 = 源节点右侧 `mn(C) + 200` 处、与源节点顶对齐；分组 `selected = true`。
 */
export function buildOfficialHistoryExpansion({
  sourceNode,
  sourcePosition,
  sourceWidth,
  childSize,
  batches,
  title,
}: OfficialHistoryExpansionInput): OfficialHistoryExpansion {
  const childNodes: Node<BaseNodeData>[] = [];
  let rowY = OFFICIAL_HISTORY_GROUP_PADDING;
  let groupWidth = OFFICIAL_HISTORY_GROUP_PADDING * 2;
  /* 官方 `wme` 里子节点标题的前缀是**源节点的 title**（不是分组标题）：
     `${e.data.title || (e.type === pe.VIDEO ? "Video" : "Image")} ${f+1}-${x+1}` */
  const sourceTitle = typeof sourceNode.data?.label === 'string' && sourceNode.data.label.trim()
    ? sourceNode.data.label
    : (sourceNode.type === 'ai-video' ? 'Video' : 'Image');

  batches.forEach((batch, batchIndex) => {
    const urls = batch.options.filter(isNonEmptyString);
    if (urls.length === 0) return;
    let columnX = OFFICIAL_HISTORY_GROUP_PADDING;
    let rowHeight = 0;
    for (let optionIndex = 0; optionIndex < urls.length; optionIndex += 1) {
      const child = createHistoryChildNode(
        sourceNode,
        batch,
        urls[optionIndex],
        `${sourceTitle} ${batchIndex + 1}-${optionIndex + 1}`,
        childSize,
      );
      child.position = { x: columnX, y: rowY };
      child.selected = false;
      childNodes.push(child);
      columnX += childSize.width + OFFICIAL_HISTORY_ITEM_GAP;
      rowHeight = Math.max(rowHeight, childSize.height);
    }
    groupWidth = Math.max(groupWidth, columnX - OFFICIAL_HISTORY_ITEM_GAP + OFFICIAL_HISTORY_GROUP_PADDING);
    rowY += rowHeight + OFFICIAL_HISTORY_ROW_GAP;
  });

  const groupHeight = childNodes.length > 0
    ? rowY - OFFICIAL_HISTORY_ROW_GAP + OFFICIAL_HISTORY_GROUP_PADDING
    : OFFICIAL_HISTORY_GROUP_PADDING * 2;

  const groupId = `group-${generateId()}`;
  const groupNode = {
    id: groupId,
    type: 'group' as const,
    position: {
      x: sourcePosition.x + sourceWidth + OFFICIAL_HISTORY_GROUP_OFFSET_X,
      y: sourcePosition.y,
    },
    data: {
      type: 'comment' as const,
      label: title || 'History',
      groupId,
      color: OFFICIAL_HISTORY_GROUP_COLOR,
      /* 官方 `xu({title, layoutType:"none", createdBy:"client", color:mme})` 的另外两个字段 */
      layoutType: 'none',
      createdBy: 'client',
    },
    style: { width: groupWidth, height: groupHeight },
    width: groupWidth,
    height: groupHeight,
    selected: true,
  } as Node<BaseNodeData>;

  return {
    groupNode,
    childNodes: childNodes.map((child) => ({ ...child, parentId: groupId })),
  };
}
