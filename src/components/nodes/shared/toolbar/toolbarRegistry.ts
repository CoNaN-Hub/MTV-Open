/**
 * toolbarRegistry.ts — 各节点类型 Toolbar 的按钮注册表与默认布局
 */
import type { NodeType, ToolbarButtonDef, ToolbarZoneLayout, ToolbarLayout } from '../../../../types';
import type { AvailableNodePluginTool, InstalledPlugin } from '../../../../types/plugin';
import { getAvailableNodePluginTools } from '../../../../services/plugins/pluginRuntime';

// ── 通用图标（复用 inline SVG 太繁琐，用 iconify name，回退到 emoji）──

export const TOOLBAR_MORE_KEY = 'more';

export function getPluginToolbarButtonKey(pluginTool: AvailableNodePluginTool): string {
  return `${pluginTool.pluginId}:${pluginTool.tool.id}`;
}

/** 把启用插件贡献的节点工具映射为可编辑 Toolbar 按钮；默认不进入布局，因此显示在“更多”。 */
export function getPluginToolbarButtonRegistry(
  plugins: InstalledPlugin[],
  nodeType: string,
): ToolbarButtonDef[] {
  return getAvailableNodePluginTools(plugins, nodeType as NodeType, 'node-toolbar').map((pluginTool) => ({
    key: getPluginToolbarButtonKey(pluginTool),
    label: `${pluginTool.tool.title} · ${pluginTool.pluginName}`,
    icon: pluginTool.tool.icon || 'lucide:blocks',
    defaultZone: '更多',
  }));
}

function createMoreButton(defaultZone: string): ToolbarButtonDef {
  return {
    key: TOOLBAR_MORE_KEY,
    // 官方实测：这个「⋯」按钮的 tooltip 是「浏览全部」
    label: '浏览全部',
    icon: 'mdi:dots-horizontal',
    // 官方 `jU`（⋯ 本体，20×20 viewBox，三点；dPe 的 more 分支用的就是它）
    officialIcon: 'more',
    defaultZone,
  };
}

/** 文本节点按钮
 *
 *  ★ 严格照官方 `not`（`zoom-slider-3ZcFvYQO.js` @3386555，`GenerateTextNode`/`PureTextNode` 共用）：
 *      `p = [ {背景色 color-picker} ]`                        ← 第 1 组（官方 `mQ`，tooltip=背景颜色）
 *      `f = [ (pin)?, 复制全部, 保存到素材库, (canEdit)? 全屏 ]` ← 第 2 组（顺序逐字）
 *      两组合并 ⇒ `[p, f]`，组间一根分隔线；`isReadonly` 时整体为空（`if(t)return[]`）。
 *  官方事实：
 *    · 「复制全部」= `yU`(CopyButton)：`defaultText=nodes.markdownToolbar.copyAll`(复制全部) /
 *      `successText=…copied`(已复制)，图标 16px（Tabler copy / check）
 *    · 「保存到素材库」= `Wv` size**18** · 「全屏」= `Og` size**18**（仅 `canEdit` 时）
 *    · pin = `hx`（`buttonType:"unwrapped"`；文本节点恒 `pinnable`）
 *    · 官方**没有**「清除空行 / 查看提示词」⇒ 那是 MTV 自有功能，只进 ⋯ 菜单（`defaultHidden`）
 *  ⚠️ 官方第 1 组那个「背景色」MTV 文本卡暂无颜色字段 ⇒ 该组为空、容器按官方空组规则跳过
 *     （见 `styles/nodes.css` 与 `ImageNodeToolbar` 的 `visibleZones` 过滤）。
 */
export const TEXT_BUTTONS: ToolbarButtonDef[] = [
  // ── 第 1 组：官方 `p = [ {背景色 color-picker} ]`（`mQ`，tooltip=`nodes.markdownToolbar.backgroundColor`「背景颜色」）──
  //    官方该项的 `handle` 是**空函数**（`tot(){}`）——交互全在色盘弹层里（见 ColorPickerButton.tsx）
  { key: 'color-picker',   label: '背景颜色',    icon: 'mdi:palette-outline',            defaultZone: 'Color' },
  // ── 第 2 组：官方 `f`（pin → 复制全部 → 保存到素材库 → 全屏）──
  { key: 'pin',            label: 'Pin',         icon: 'mdi:pin-outline',                officialIcon: 'pin',         defaultZone: 'Primary' },
  { key: 'copy',           label: '复制全部',    icon: 'mdi:content-copy',               officialIcon: 'copy',        officialIconSize: 16, defaultZone: 'Primary' },
  { key: 'saveToLibrary',  label: '保存到素材库',icon: 'mdi:bookmark-plus-outline',      officialIcon: 'save-to-library', defaultZone: 'Primary' },
  { key: 'fullscreen',     label: '全屏',        icon: 'mdi:fullscreen',                 officialIcon: 'fullscreen',  defaultZone: 'Primary' },
  /* ⚠️ 官方**文本卡工具栏没有**「⋯ 浏览全部」这颗（用户：「文本卡片方工具栏 是没有 浏览全部的 你移除 不是官方的不要」）
     ⇒ 原来的 `createMoreButton('Primary')` 与其菜单内两颗 MTV 自有项（`clearEmptyLines` 清除空行 / `showPrompt` 查看提示词）
        一并移除；官方文本卡工具栏就这 5 颗：背景颜色 · Pin · 复制全部 · 保存到素材库 · 全屏 ✓ */
];

/** 视频节点按钮
 *
 *  ★ 官方**当前线上构建**（`D:\DEEPSEEK\live-assets-r100\vendor-pkg-canvas-DuoOicPr.js`，
 *    4,557,761 chars）的视频工具栏逐字锚点 —— §108 重新定位（旧注释引的 `xXe`/`eoe`/@1975xxx
 *    属上一代 `vendor-pkg-canvas-CvbAwZyy.js`，在 r100 里已偏移/改名）：
 *
 *    · 构建器 = `fXe=(e,t=!1)=>{…}` @1963379（`const n=Mn("VideoNodeTools"), o=pa("VIDEO"), …`）
 *    · **右组 `F`** @1966997 起（`F=a.useMemo(()=>[{node:s.jsx(Yv,{size:20}),…`）——
 *      `saveToLibrary`@1967014 · `download`@1967252 · `scale`@1967392
 *    · **左组 `O`** `O=a.useMemo(()=>{const V=A&&!S&&!t;return[` @1967672 —— 逐字键序与偏移：
 *      `clip`@1967672 · `upscale`@1967837 · `video_replace`@1968070 · `video_remove`@1968276 ·
 *      `video_creation`@1968537（`badge:"beta",showBadge:!0`）· `multi_view`@1968831（同 beta）·
 *      `video_frame_capture`@1969038（`buttonType:"more",tooltipInsideTrigger:!0`，
 *        `menuItems:dXe` = `capture_current/capture_first/capture_last`，`dXe` @1962790）·
 *      `more`@1969413（`showBadge:!1`，`menuItems` = `scene_breakdown` + 条件项 `authenticityCheck`）
 *    · **中组 pin** = 共享 helper `v0` @838584
 *      （`function v0(e){const t=JD(),{pinnable:n}=nLe(e),{pins:o}=pJ(e),…{key:"pin",buttonType:"unwrapped",node:s.jsx(eLe,{…})}}`）；
 *      ⚠️ 视频与图像**共用同一支 `v0`**（图像组装 `XWe` @1711336 也调它）。
 *    · **组装** @1970044 逐字：`U=v0(e),B=Fe(Hp),G=a.useMemo(()=>[O,...U?[[U]]:[],F],[O,U,F]);return a.useMemo(()=>B?mXe(G):G,[B,G])`
 *      ⇒ `[左组, (pin组)?, 右组]`；pin 组缺席时不留空组。
 *    · 组间分隔线 = `div.w-px.h-[18px].bg-primary-border`（官方真机 DOM 实测，见下方 §108 记账）。
 *    · `mXe` @1963095（`pXe=new Set(["download","scale"])` @1963047）：当 `B=Fe(Hp)` 为真时，
 *      **除 download/scale 外**每颗键被强制 `disabled + lockedTooltip`。
 *
 *  ⚠️ 官方**真机**读数（CDP 9222 · `https://app.tapnow.media/canvas/86b84122-…` ·
 *    node `video-661bd819-c8ea-460b-984a-8763a447fa8f` 选中态）与上面源码**逐组一致**：
 *    `[data-testid="canvas-node-toolbar"]` = `div.node-floating`(h-12 p-1 rounded-full) 内
 *    3 个 `ul` + 2 条分隔线；组1 **8 颗**（宽 334 = 8×40 + 7×2）→ 组2 pin（宽 41.8）→ 组3 **3 颗**（宽 124）。
 *
 *  ★ 旧注释引用的桌面版 0.4.99（`course-api-base-url-DmmB7bTf.js` + `components/03-video-toolbar-actions.js`
 *    @2685052…）**已无法在本地任何 dump 里核对**（AGENTS.md §引用规范：拿不到就不当结论用），
 *    §108 起本段一律以 `live-assets-r100` 的偏移 + 官方真机 DOM 为准。
 *
 *  每项的门（逐字，`k = data.src`、`t = disabled`、`C = Qs()`、`A = !C && !t`）：
 *    · 左组所有项 `invisible: !k || C || t`、`disabled: !k || t`
 *      —— `C = Qs()` 是运行时能力谓词（静态代码未命名其业务含义，**不能**解释成 clip 类型判断）。
 *      MTV 没有该谓词 ⇒ 按「拿不到证据就不写」的等价做法：`invisible` 取 `!src`，`disabled` 取 `!src`。
 *    · `upscale` 另有包内硬编码开关 `w2e`（若为 true 则禁用）——静态包读到的是 `false`。
 *    · `video_frame_capture` / `more` 是 `buttonType:"more"`（下拉菜单），`tooltipInsideTrigger:!0`。
 *    · `video_creation` / `multi_view` 带 `badge:"beta"` + `showBadge:!0`
 *      ⇒ 绝对定位角标 `top-0.5 right-0.5 size-2 rounded-full bg-accent-primary`。
 *    · `more` 的菜单项：`scene_breakdown`（`video.filmAnalysis`=解析）+ 条件项
 *      `authenticityCheck`（`T.invisible` 为假时才加入，`showBadge:N`）。
 *
 *  ⇒ MTV 能对上官方主行位置的：`upscale`(增强) / `scale`(全屏) / `download`(下载)。
 *    §96：键名一律照官方 `xXe` 逐字（`scale` @1974297 · `video_frame_capture` @1975961），
 *    不再用 MTV 自造的 `fullscreen` / `captureFrame`（老布局由 `migrateVideoLayoutToV4` 改名）。
 *    `saveToLibrary`(保存到素材库)、`video_frame_capture`(截帧菜单) 也是官方项，
 *    但 MTV 的语义与官方不同（官方是「选素材库文件夹」/「三帧下拉」），**进 ⋯ 菜单**保留能力。
 *    官方其余项 MTV **无实现**（替换/移除/多视角浮动编辑器、首尾帧/magic edit、
 *    场景解析、真实性检查）⇒ 按「不编造」不占位，不注册。
 *    MTV 自有项（复制视频 / 查看提示词 / 反推提示词）一律只进 ⋯ 菜单。
 */
export const VIDEO_BUTTONS: ToolbarButtonDef[] = [
  /* ══ §113 zone 划分按官方三组改名（`'常用'` → `Primary` / `Pin` / `Secondary`）══
     原因（§108 实测）：`buildLayout` 用 **zone 名字**作 `Map` 键，原来视频所有键都写 `'常用'`
     ⇒ 三组被并成一组、组间分隔线永不渲染。官方是 **3 组 + 2 条 `w-px h-[18px] bg-primary-border`**
     （真机 CDP 9222：组1 宽 334 / 组2 pin 41.8 / 组3 宽 124）。
     老布局的迁移见 `migrateVideoLayoutToV5`（幂等）。 */
  // ── 左组（官方 `F` 里 MTV 有对应物的那两颗：clip / upscale 的位置）──
  //    官方 `clip` 的 handle 是 `open(nodeId,"video-clip")`（时间范围裁剪浮层）；
  //    MTV 没有该浮层 ⇒ 不注册，不占位。
  /* ══ §108 官方视频 `upscale` 的图标 = `pq`，**字形 = 本仓 `enhance.svg`**（不是 `redraw`）══
     官方源码（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1967837 逐字）：
       `{node:s.jsx(pq,{size:20}),key:"upscale",buttonType:"obsidian",handle:()=>L("upscale"),
         dataTestId:At.CANVAS.NODE.VIDEO.UPSCALE_BTN,tooltip:y("video.hdUpscaleShort"),…}`
     ⚠️ §96 曾按**上一代构建**（`vendor-pkg-canvas-CvbAwZyy.js` @1974773 的 `gq`）把它定成 `redraw`。
        该结论在 r100 构建里**不成立**，两条独立实测都指向 `enhance`：
       ① 官方真机工具栏 DOM（CDP 9222 · `app.tapnow.media/canvas/86b84122-…` ·
          node `video-661bd819-c8ea-460b-984a-8763a447fa8f` 选中态）：第 1 组第 2 颗键的 svg 逐字
          `viewBox="0 0 20 20" fill="none"` + **单条** `path fill="currentColor"`，path 长 **1604**；
       ② 与本仓资产离线比对（`src/assets/official-icons/`）：1604 这条 path 与
          `enhance.svg` **逐字相同**（全部命中 = true），与 `redraw.svg`（path 长 2465）**不匹配**。
     ⇒ 视频 `upscale` 用 `enhance`；`redraw` 仍归图像卡的「重绘」（`IMAGE_BUTTONS.repaint`）。 */
  { key: 'upscale',        label: '增强',        icon: 'mdi:image-auto-adjust',          officialIcon: 'enhance',    defaultZone: 'Primary' },
  /* §93 官方图标 = `Tpe`（`vendor-libs-BqrVOBEZ.js` @1918790
     `VEt=p("outline","camera","Camera",CCr)`，路径表 `CCr` @1918553 两条 path、24 viewBox、stroke）。
     ⇒ 用 tabler 图标集的同一个 `camera`（同图集、同 path 数据），尺寸照官方 `size:20`。 */
  /* §96 键名 = 官方逐字 `video_frame_capture`（`vendor-pkg-canvas-CvbAwZyy.js` @1975961
     `{…,key:"video_frame_capture",buttonType:"more",…}`；MTV 旧键名 `captureFrame` 是自造）。
     持久化布局的旧键改名由 `migrateVideoLayoutToV4` 负责（见下）。 */
  { key: 'video_frame_capture', label: '截帧',   icon: 'tabler:camera',                  defaultZone: 'Primary' },
  createMoreButton('Primary'),
  /* ══ §113 第 2 组 = 官方 `pin`（**2026-10-15 用户裁决：加，按官方三组结构**）══
     官方源码（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1969928 区逐字）：
       `U=v0(e),B=Fe(Hp),G=a.useMemo(()=>[O,...U?[[U]]:[],F],[O,U,F])` ⇒ 顺序 = 左组 → pin 组 → 右组。
     `v0`（pin 工具工厂）@838584 逐字：
       `function v0(e){const t=JD(),{pinnable:n}=nLe(e),{pins:o}=pJ(e),{togglePinOnNode:r}=MJ();
        return a.useMemo(()=>!t||!n?null:{key:"pin",buttonType:"unwrapped",node:s.jsx(eLe,{pins:o,onToggle:i=>r(e,i)})},[t,n,o,e,r])}`
     ⇒ 工具对象**只有 3 个字段** `{key:"pin",buttonType:"unwrapped",node}`：**没有**
        `tooltip` / `disabled` / `invisible` / `lockedTooltip`；门 = `!readonly && pinnable`。
     ⇒ 与图像/文本**共用同一支 `v0`**（图像组装 `XWe` @1711336 也调它）⇒ MTV 直接复用同一个
        `PinToolbarButton`（`src/components/nodes/shared/toolbar/PinToolbarButton.tsx`），无需新组件。
     MTV 侧基建已就位：`services/canvasPin.ts:100` `'ai-video': 'video'`（`resolvePinnable` 走
        `hasSrc` 门）、`NodeLabel.tsx:189` 的 `pin-indicator-slot`。
     ⚠️ **裁决变更登记**：`tests/components/videoNodeOfficialToolbarBar93.test.tsx` 早前把 `pin`
        写进「MTV 无实现 ⇒ 不许占位」名单（早前裁决）；**该条被 2026-10-15 用户新裁决推翻**，
        已把用例改成「按官方加入 pin（独立第 2 组）」，断言没有被悄悄删除。 */
  { key: 'pin',            label: 'Pin',         icon: 'mdi:pin-outline',                officialIcon: 'pin',         defaultZone: 'Pin' },
  // ── 右组（官方 `F` 逐字顺序：saveToLibrary → download → scale）──
  { key: 'saveToLibrary',  label: '保存到素材库',icon: 'mdi:bookmark-plus-outline',      officialIcon: 'save-to-library', defaultZone: 'Secondary' },
  { key: 'download',       label: '下载',        icon: 'mdi:download',                   officialIcon: 'download',   defaultZone: 'Secondary' },
  /* §96 键名 = 官方逐字 `scale`（官方 `xXe` 右组 `I` @1974297 `{key:"scale",tooltip:y("common.fullScreen")}`；
     官方 handle 的 `case"scale"` 就是全屏 `b(e)` @1971440）；MTV 旧键名 `fullscreen` 是自造，
     持久化改名见 `migrateVideoLayoutToV4`。tooltip 文案不变（官方 `common.fullScreen` =「全屏查看」）。 */
  { key: 'scale',          label: '全屏查看',    icon: 'mdi:fullscreen',                 officialIcon: 'fullscreen', defaultZone: 'Secondary' },
  // ── 以下只进「⋯ 浏览全部」（MTV 自有 / 语义与官方不同）──
  { key: 'copyFile',       label: '复制视频',    icon: 'mdi:content-copy',               defaultZone: 'Primary', defaultHidden: true },
  { key: 'showPrompt',     label: '查看提示词',  icon: 'mdi:message-text-outline',       defaultZone: 'Primary', defaultHidden: true },
  { key: 'reversePrompt',  label: '反推提示词',  icon: 'mdi:text-search',                defaultZone: 'Primary', defaultHidden: true },
];

/** 全景图节点按钮 */
export const PANORAMA_BUTTONS: ToolbarButtonDef[] = [
  { key: 'upload',         label: '上传全景图',  icon: 'mdi:upload',                    defaultZone: '常用' },
  { key: 'toggleMode',     label: '切换视图模式',icon: 'mdi:rotate-3d',                  defaultZone: '常用' },
  { key: 'screenshot',     label: '截图当前视角',icon: 'mdi:camera',                     defaultZone: '常用' },
  { key: 'fullscreen',     label: '全屏显示',    icon: 'mdi:fullscreen',                defaultZone: '常用' },
  createMoreButton('常用'),
];

/** 图像节点按钮
 *
 *  ★ 布局原则：**主行严格照官方源码**，MTV 自有按钮一律只进「⋯ 浏览全部」菜单。
 *
 *  ★ 图像工具栏的官方结构 —— 下列每条**都在本地产物 `vendor-pkg-canvas-CvbAwZyy.js`
 *    （4,832,071 字节 / 4,570,188 字符）中逐字复核到**，标注最小化符号名 + JS 字符偏移：
 *
 *    · **左组** = `JWe`（`JWe=(e,t)=>{` @1710907；返回的数组 @1715597 起
 *      `return o?[]:[{node:s.jsx(vhe,{size:20}),buttonType:"obsidian",…` —— `o` 为真时整体返回 `[]`）。
 *      逐字顺序（`key` 的偏移）：
 *        `key:"crop"` @1715768（`dataTestId:"canvas.node.image.crop_btn"` @1715779）
 *        · `key:"multi_angle"` @1715958 · `key:"redraw"` @1716260 · `key:"relight"` @1716452
 *        · `buttonType:"more",key:"more"` @1716601
 *    · **中组（置顶）** = `function _0(e){const t=sL(),{pinnable:n}=iLe(e),…}` @846316 ——
 *      返回 `{key:"pin",buttonType:"unwrapped",node:s.jsx(sLe,{pins:o,onToggle:i=>r(e,i)})}`；
 *      门 = `!t||!n`（只读或不可 pin ⇒ `null`），`buttonType:"unwrapped"` @846448。
 *      该函数**视频工具栏共用**（见上面 VIDEO_BUTTONS 段的 `_0(e)`）。
 *    · **右组** = `eoe`（`eoe=(e,t)=>{` @1709395）—— 返回 3 颗（`key` 的偏移）：
 *        `tooltip:n("library.saveToLibrary"),key:"saveToLibrary"` @1710047
 *        · `tooltip:n("common.download"),key:"download"` @1710261
 *        · `tooltip:n("common.fullScreen"),key:"scale"` @1710771
 *      ⚠️ 右组的键里**没有** `fullscreen` —— 全文件 `key:"fullscreen"` **0 命中**。
 *    · **组装** = `eqe` @1718815，顺序表达式 @1718872 逐字：
 *      `l=a.useMemo(()=>[r,...i?[[i]]:[],o],[r,i,o])` —— 其中 `o=eoe(e,t)`、`r=JWe(e,t)`、`i=_0(e)`
 *      ⇒ `[左组, (pin组)?, 右组]`；pin 组缺席时不留空组。
 *    · **组间分隔线**（渲染器 @1064824 逐字）：
 *      `g!==u.length-1 && s.jsx("div",{className:"w-px h-[18px] bg-primary-border"})`
 *    · **工具栏容器** = `kd`：`kd=a.memo(function({nodeId:t,nodeTitle:n,tools:o})` @1071365。
 *    · **⋯ 菜单**（`more` 的 `menuItems`，逐字顺序 + 偏移）：
 *        `key:"outpainting"` @1716737 → `key:"erase"` @1716949 → `key:"annotation"` @1717133
 *        → `key:"enhance"` @1717341 → `key:"resizePixels"` @1717531 → `key:"cutout"` @1717679
 *        → `key:"quickSplit"` @1717840（`subActions:[{key:"split_2x2"…` @1717911，宫格面板 `ZWe`）
 *        → `key:"authenticityCheck"` @1718622（条件项：`...M.invisible?[]:[{…}]`）。共 **8 项**。
 *
 *  ⚠️ **旧注释里的 4 个锚点未能在本地这批产物中复核到** ——
 *    原注：`zoom-slider-3ZcFvYQO.js` @3386555 的 `ptt` @3083219（左组）· `hx` @1223252（置顶）
 *    · `LJ` @3081708（右组）· `ftt` @3091189（组装）。
 *    实测：这 4 个偏移在本地产物里**都落在与工具栏无关的代码上**（例如 @1223252 是 `uN=(e,t)=>{…}` 的
 *    renderText/label 映射器、@3091189 是视频面板的 `continuityPreset/direction/duration`），
 *    而 `zoom-slider-3ZcFvYQO.js` 这个文件名**根本不在本地 dump 里**
 *    （本地只有 `index-BDGj8rGN.js` / `page-DLReZAzU.js` / `vendor-*` 若干）。
 *    最小化标识符名随构建而变 ⇒ 这只能说明旧注释**引用的是另一构建的产物名**，
 *    **不足以断言其造假**；但既然无法复核，本段一律改用上面那批**本地产物里实测到**的锚点。
 *    同一段其它同类句子同样**未复核**：`page-DPdEgTS0.js`、locale 包 `index-BiTZf8mJ.js`、
 *    以及桌面版 `course-api-base-url-DmmB7bTf.js` + 提取包 `components/03-video-toolbar-actions.js`
 *    —— 这些产物名在本地 dump 中均不存在。
 *
 *  ★ MTV 侧现状（据本文件 `IMAGE_BUTTONS` + `DEFAULT_IMAGE_LAYOUT` 读出，非官方产物证据）：
 *    主行 9 个位置**已与官方一一对齐** ——
 *      Primary   = `crop` · `cameraStudio`(↔官方 `multi_angle`) · `repaint`(↔官方 `redraw`)
 *                  · `relight` · `more`
 *      Pin       = `pin`(↔官方 `_0` 的置顶)
 *      Secondary = `saveToLibrary` · `download` · `scale`(↔官方 `scale`，§99 改名前是 MTV 自造的 `fullscreen`)
 *    差额只在 **⋯ 菜单**：官方 8 项里 MTV 无 `resizePixels`(调整像素) 与
 *    `authenticityCheck`(Seedance 校验) 两项 ⇒ 按「不编造」不占位。 */
export const IMAGE_BUTTONS: ToolbarButtonDef[] = [
  // ── 主行左组（官方 ptt 组；MTV 有对应物的在前，⋯ 压尾）──
  { key: 'crop',           label: '裁剪',        icon: 'mdi:crop',                       officialIcon: 'crop',        defaultZone: 'Primary' },
  { key: 'cameraStudio',   label: '多角度',      icon: 'mdi:camera-control',             officialIcon: 'multi-angle', defaultZone: 'Primary' },
  { key: 'repaint',        label: '重绘',        icon: 'mdi:message-text-outline',       officialIcon: 'redraw',      defaultZone: 'Primary' },
  { key: 'relight',        label: '打光',        icon: 'mdi:lightbulb-on-outline',       officialIcon: 'relight',     defaultZone: 'Primary' }, // ← 官方 relight（以「打光」模式打开摄影棚）
  createMoreButton('Primary'),
  // ── 中组：官方 `hx` 的置顶（pin，`buttonType:"unwrapped"`）──
  //    ★ 悬浮气泡文案 = 官方 i18n `pin.toolbar.tooltip` = **"Pin"**（逐字，中文包里也是 "Pin"）；
  //      官方选中若干分组后会换成 `pin.toolbar.tooltipPinnedColors` =「已 Pin：{{colors}}」。
  { key: 'pin',            label: 'Pin',         icon: 'mdi:pin-outline',                officialIcon: 'pin',         defaultZone: 'Pin' },
  // ── 主行右组（官方 LJ 组 = saveToLibrary / download / scale）──
  { key: 'saveToLibrary',  label: '保存到素材库',icon: 'mdi:bookmark-plus-outline',      officialIcon: 'save-to-library', defaultZone: 'Secondary' },
  { key: 'download',       label: '下载',        icon: 'mdi:download',                   officialIcon: 'download',   defaultZone: 'Secondary' },
  /* §99 键名 = 官方逐字 `scale`（`vendor-pkg-canvas-CvbAwZyy.js` @1710782）：
     `{node:s.jsx(Mx,{size:20}),buttonType:"obsidian",dataTestId:…IMAGE.FULLSCREEN_BTN,
       handle:()=>{…trackCanvasNodeFunctionClicked("image",e,"full_screen"),
                   trackFullscreenOpenClick({node_id:e,project_id:p||null,entry:"fullscreen_button",
                     images_count:y.length>0?y.length:1,is_variants:y.length>1}),d(e)},
       tooltip:n("common.fullScreen"),key:"scale",disabled:t,invisible:t,lockedTooltip:c("scale")}`
     判据：① 埋点首参逐字 `"image"`；② 事件带 `images_count`/`is_variants`；③ `lockedTooltip` 的键也是 `"scale"`。
     同一段（@1708000–@1714000）里图像右组 `LJ` 的键只有三颗，逐字顺序 = `saveToLibrary` · `download` · `scale`。
     MTV 旧键名 `fullscreen` 是自造（`vendor-pkg-canvas` 里 `key:"fullscreen"` **0 命中**）；
     持久化布局的改名由 `migrateImageLayoutToV12` 负责（独立一份映射，不复用视频的）。 */
  { key: 'scale',          label: '全屏查看',    icon: 'mdi:fullscreen',                 officialIcon: 'fullscreen', defaultZone: 'Secondary' },
  // ── 以下全部只进「⋯ 浏览全部」菜单。**顺序 = 官方 `menuItems` 的顺序**，逐字（`ptt` @3083219）：
  //     outpainting(扩图) → erase(擦除) → annotation(标注) → enhance(增强) → resizePixels(调整像素)
  //     → cutout(抠图) → quickSplit(快速切分) → authenticityCheck(Seedance 校验)
  //    文案取官方中文包（`index-BiTZf8mJ.js` locale：outpainting/erase/annotation/enhance.title/
  //    resize.title/matting/quickSplit）—— MTV 的按钮语义↔官方项一一对应关系：
  //     · expand        ↔ 官方 `outpainting`（扩图）
  //     · matting       ↔ 官方 `erase`（擦除；MTV 是遮罩编辑器，即官方 `drawMaskErase` 那套）
  //     · annotate      ↔ 官方 `annotation`（标注）
  //     · upscale       ↔ 官方 `enhance`（增强；MTV 是本地 ONNX 超分，同属画质增强）
  //     · subjectMatting↔ 官方 `cutout`（官方 i18n key 就是 `image.matting` = 抠图）
  //     · multiGrid     ↔ 官方 `quickSplit`（快速切分）
  //   官方还有 `resizePixels`(调整像素) / `authenticityCheck`(Seedance 校验) 两项 MTV 未实现 ⇒ 不占位。
  { key: 'expand',         label: '扩图',        icon: 'mdi:arrow-expand-all',           officialIcon: 'expand',     defaultZone: 'Primary', defaultHidden: true }, // ← 官方 outpainting
  { key: 'matting',        label: '擦除',        icon: 'mdi:circle-edit-outline',        officialIcon: 'erase',      defaultZone: 'Primary', defaultHidden: true }, // ← 官方 erase
  { key: 'annotate',       label: '标注',        icon: 'mdi:draw-pen',                   officialIcon: 'annotate',   defaultZone: 'Primary', defaultHidden: true }, // ← 官方 annotation
  { key: 'upscale',        label: '增强',        icon: 'mdi:image-auto-adjust',          officialIcon: 'enhance',    defaultZone: 'Primary', defaultHidden: true }, // ← 官方 enhance（图标 `LU`）
  { key: 'subjectMatting', label: '抠图',        icon: 'mdi:hexagon-outline',            officialIcon: 'cutout',     defaultZone: 'Primary', defaultHidden: true }, // ← 官方 cutout（图标 `fre`）
  { key: 'multiGrid',      label: '快速切分',    icon: 'mdi:grid',                       officialIcon: 'quick-split', defaultZone: 'Primary', defaultHidden: true }, // ← 官方 quickSplit（图标 `mre`）
  // ── MTV 自有（官方两份产物里都没有对应项）—— 一律排在官方项之后 ──
  //    `customGrid` = MTV 的自由裁切线（官方 `quickSplit` 只到 8×8 均匀宫格，没有自由线）
  { key: 'customGrid',     label: '自定义裁切',  icon: 'mdi:grid-large',                 defaultZone: 'Primary', defaultHidden: true },
  { key: 'compose',        label: '多图编辑',    icon: 'mdi:layers-triple-outline',      defaultZone: 'Primary', defaultHidden: true },
  { key: 'upload',         label: '上传图片',    icon: 'mdi:upload',                     officialIcon: 'replace',    defaultZone: 'Primary', defaultHidden: true },
  { key: 'reversePrompt',  label: '反推提示词',  icon: 'mdi:text-search',                defaultZone: 'Primary', defaultHidden: true },
  { key: 'copyFile',       label: '复制图像',    icon: 'mdi:content-copy',               defaultZone: 'Primary', defaultHidden: true },
  { key: 'history',        label: '生成历史',    icon: 'mdi:history',                    defaultZone: 'Primary', defaultHidden: true },
  /* 图片往返（MTV 自有）：把本卡源图送到本机桥接服务 → 外部编辑器（PS 等）编辑 → 回传自动建下游卡。
     图标 = 用户给的 icons8 `adobe-photoshop`，按 MTV 图标语言重绘（见 official-icons/roundtrip.svg）。 */
  { key: 'roundtrip',      label: '图片往返',    icon: 'mdi:image-sync-outline',          officialIcon: 'roundtrip',  defaultZone: 'Primary', defaultHidden: true },
];

/** 音频节点按钮 */
export const AUDIO_BUTTONS: ToolbarButtonDef[] = [
  { key: 'togglePlay',     label: '播放/暂停',   icon: 'mdi:play-pause',                defaultZone: '常用' },
  { key: 'speechToText',   label: '语音转文本',  icon: 'mdi:microphone-message',         defaultZone: '常用' },
  { key: 'transcribe',     label: '转录音频',    icon: 'mdi:text-box-search-outline',   defaultZone: '常用' },
  { key: 'copyFile',      label: '复制音频',    icon: 'mdi:content-copy',             defaultZone: '常用' },
  { key: 'upload',         label: '上传音频',    icon: 'mdi:upload',                     defaultZone: '常用' },
  { key: 'fullscreen',     label: '全屏显示',    icon: 'mdi:fullscreen',                defaultZone: '常用' },
  createMoreButton('常用'),
];

// ── 默认布局 ──

function buildLayout(buttons: ToolbarButtonDef[], version = 1): ToolbarLayout {
  const zoneMap = new Map<string, string[]>();
  for (const btn of buttons) {
    // 官方：`defaultHidden` 的项不进主行，只由 ⋯ 菜单收纳（见 getHiddenDefaultToolbarButtons）
    if (btn.defaultHidden) continue;
    const keys = zoneMap.get(btn.defaultZone) || [];
    keys.push(btn.key);
    zoneMap.set(btn.defaultZone, keys);
  }
  const zones: ToolbarZoneLayout[] = [];
  let idx = 0;
  for (const [name, buttonKeys] of zoneMap) {
    zones.push({ id: `zone-${idx++}`, name, buttonKeys });
  }
  return { zones, version };
}

/** 文本卡工具栏**只许有官方那 5 颗**：把历史布局（localStorage 里存过的）残留的
    `more`（⋯ 浏览全部）与 MTV 自有 `clearEmptyLines`/`showPrompt` 一并剔除 ✓
    （用户：文本卡工具栏没有「浏览全部」，不是官方的不要） */
const TEXT_UNOFFICIAL_KEYS = new Set<string>([TOOLBAR_MORE_KEY, 'clearEmptyLines', 'showPrompt']);
export function stripUnofficialTextKeys(layout: ToolbarLayout): ToolbarLayout {
  return {
    ...layout,
    zones: layout.zones
      .map((zone) => ({ ...zone, buttonKeys: zone.buttonKeys.filter((key) => !TEXT_UNOFFICIAL_KEYS.has(key)) }))
      .filter((zone) => zone.buttonKeys.length > 0),
  };
}

export const DEFAULT_TEXT_LAYOUT      = stripUnofficialTextKeys(buildLayout(TEXT_BUTTONS, 5));
export const DEFAULT_VIDEO_LAYOUT     = buildLayout(VIDEO_BUTTONS, 5);
export const DEFAULT_PANORAMA_LAYOUT  = buildLayout(PANORAMA_BUTTONS, 2);
export const DEFAULT_IMAGE_LAYOUT     = buildLayout(IMAGE_BUTTONS, 12);
export const DEFAULT_AUDIO_LAYOUT     = buildLayout(AUDIO_BUTTONS, 3);

/**
 * 迁移图像工具栏的新内置能力与默认分区。
 * 只有能精确识别为历史默认值的布局才会整体换新；其他布局仅执行必要的能力迁移，
 * 保留用户已有的分区、排序和删减结果。
 */
function migrateImageLayoutToV7(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 7) return layout;

  let cameraStudioInserted = layout.zones.some((zone) => zone.buttonKeys.includes('cameraStudio'));

  let zones = layout.zones.map((zone) => {
    const buttonKeys: string[] = [];
    for (const key of zone.buttonKeys) {
      if (key === 'multiAngle') {
        if (!cameraStudioInserted) {
          buttonKeys.push('cameraStudio');
          cameraStudioInserted = true;
        }
        continue;
      }
      buttonKeys.push(key);
    }
    return { ...zone, buttonKeys };
  });

  if (!cameraStudioInserted && layout.version < 3) {
    const targetIndex = zones.findIndex((zone) => zone.name === 'Primary');
    if (targetIndex >= 0) {
      zones[targetIndex] = { ...zones[targetIndex], buttonKeys: [...zones[targetIndex].buttonKeys, 'cameraStudio'] };
    } else {
      zones.push({ id: 'zone-camera-studio', name: 'Primary', buttonKeys: ['cameraStudio'] });
    }
  }

  if (!zones.some((zone) => zone.buttonKeys.includes('history'))) {
    const targetIndex = zones.findIndex((zone) => zone.name === 'Secondary');
    if (targetIndex >= 0) {
      zones[targetIndex] = { ...zones[targetIndex], buttonKeys: [...zones[targetIndex].buttonKeys, 'history'] };
    } else if (zones.length > 0) {
      const lastIndex = zones.length - 1;
      zones[lastIndex] = { ...zones[lastIndex], buttonKeys: [...zones[lastIndex].buttonKeys, 'history'] };
    } else {
      zones = [{ id: 'zone-image-history', name: 'Secondary', buttonKeys: ['history'] }];
    }
  }

  if (layout.version === 4) {
    zones = zones.map((zone) => {
      const historyIndex = zone.buttonKeys.indexOf('history');
      const fullscreenIndex = zone.buttonKeys.indexOf('fullscreen');
      if (historyIndex < 0 || fullscreenIndex !== historyIndex + 1) return zone;
      const buttonKeys = [...zone.buttonKeys];
      [buttonKeys[historyIndex], buttonKeys[fullscreenIndex]] = [
        buttonKeys[fullscreenIndex],
        buttonKeys[historyIndex],
      ];
      return { ...zone, buttonKeys };
    });
  }

  // v5 和短暂使用过的 v6 默认布局都迁移到“复制、历史、全屏”右侧分区。
  const legacyDefaultLayouts = [
    [
      ['matting', 'expand', 'multiGrid', 'cameraStudio', 'repaint', 'upscale', 'subjectMatting'],
      ['annotate', 'crop', 'compose', 'upload', 'copyFile', 'fullscreen', 'history'],
    ],
    [
      [
        'matting', 'expand', 'multiGrid', 'cameraStudio', 'repaint', 'upscale',
        'subjectMatting', 'annotate', 'crop', 'compose', 'upload', 'copyFile',
      ],
      ['fullscreen', 'history'],
    ],
  ];
  const usesLegacyDefaultLayout = legacyDefaultLayouts.some((legacyZones) => (
    zones.length === legacyZones.length
    && zones.every((zone, index) => (
      zone.buttonKeys.length === legacyZones[index].length
      && zone.buttonKeys.every((key, keyIndex) => key === legacyZones[index][keyIndex])
    ))
  ));

  if (usesLegacyDefaultLayout) return getDefaultLayout('ai-image');

  return { ...layout, zones, version: 7 };
}

/** v8 默认布局（图像主行 8 项 + ⋯）的逐字快照 —— 只用于识别「没被用户改过的旧默认」 */
const LEGACY_IMAGE_DEFAULT_V8 = [
  'crop', 'cameraStudio', 'repaint', 'matting', 'annotate', 'expand', 'upscale', 'fullscreen',
  'more', 'multiGrid', 'subjectMatting', 'compose', 'upload', 'reversePrompt', 'copyFile', 'history',
];

/**
 * v9：图像主行按**官方源码**收敛（官方 `ptt` 主行 = 裁剪/多角度/重绘/打光 + ⋯ ‖ 右组），
 * MTV 自有按钮改由 ⋯ 菜单收纳（`defaultHidden`）。
 * 只有**精确等于 v8 默认**的布局才整体换新；用户动过的布局原样返回 ——
 * 版本号刻意**不在这里**推进，交给下面统一的「补 more」步骤收尾（否则会跳过那次补 more）。
 */
function migrateImageLayoutToV9(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 9) return layout;
  const isLegacyV8Default = layout.zones.length === 1
    && layout.zones[0].buttonKeys.length === LEGACY_IMAGE_DEFAULT_V8.length
    && layout.zones[0].buttonKeys.every((key, index) => key === LEGACY_IMAGE_DEFAULT_V8[index]);
  if (isLegacyV8Default) return getDefaultLayout('ai-image');
  return layout;
}

/**
 * v10：补入官方新增的两个工具（`relight` 打光 / `download` 下载）——**只增不删**，
 * 用户自己的分区、排序、隐藏一律保留（与当年补「相机工作室 / 历史」同一套做法）。
 * 版本号同样不在这里推进，交给下面统一的「补 more」步骤收尾。
 */
function migrateImageLayoutToV10(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 10) return layout;
  const zones = layout.zones.map((zone) => ({ ...zone, buttonKeys: [...zone.buttonKeys] }));
  const ensure = (key: string, anchorKey: string) => {
    if (zones.some((zone) => zone.buttonKeys.includes(key))) return;
    const target = zones.find((zone) => zone.buttonKeys.includes(anchorKey))
      ?? zones.find((zone) => zone.name === 'Primary')
      ?? zones[0];
    if (!target) return;
    const at = target.buttonKeys.indexOf(anchorKey);
    target.buttonKeys.splice(at >= 0 ? at : target.buttonKeys.length, 0, key);
  };
  // 只补「官方新增能力」里 MTV 真的新加的那个；download 若用户布局里没有，可从「⋯ 浏览全部」随手加回
  ensure('relight', 'more');
  return { ...layout, zones };
}

/** v10 默认布局（主行 7 个 + ⋯）的逐字快照 —— 用于识别「就是上一版默认」的布局 */
const LEGACY_IMAGE_DEFAULT_V10 = [
  ['Primary', ['crop', 'cameraStudio', 'repaint', 'relight', 'more']],
  ['Secondary', ['download', 'fullscreen']],
];

/**
 * v11：主行补齐官方的**完整 9 个**（`裁剪/多角度/重绘/打光/⋯ 丨置顶丨 保存到素材库/下载/全屏查看`）。
 * 只有「精确等于 v10 默认」的布局才整体换成新默认（含新的 `Pin` 分组）；
 * 其余布局原样保留（新工具会出现在 ⋯ 菜单里），版本号交给「补 more」步骤收尾。
 */
function migrateImageLayoutToV11(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 11) return layout;
  const isLegacyV10Default = layout.zones.length === LEGACY_IMAGE_DEFAULT_V10.length
    && layout.zones.every((zone, index) => (
      zone.buttonKeys.length === LEGACY_IMAGE_DEFAULT_V10[index][1].length
      && zone.buttonKeys.every((key, keyIndex) => key === LEGACY_IMAGE_DEFAULT_V10[index][1][keyIndex])
    ));
  if (isLegacyV10Default) return getDefaultLayout('ai-image');
  return layout;
}

/**
 * 图像工具栏 v12：**键名改成官方逐字 `scale`**（`vendor-pkg-canvas-CvbAwZyy.js` @1710782）。
 *
 * | 旧键（MTV 自造） | 新键（官方逐字） | 官方原文 |
 * |---|---|---|
 * | `fullscreen` | `scale` | @1710782 `{node:s.jsx(Mx,{size:20}),…,tooltip:n("common.fullScreen"),key:"scale",disabled:t,invisible:t,lockedTooltip:c("scale")}` |
 *
 * 官方判据（同处逐字）：① 埋点首参 `"image"`
 * （`trackCanvasNodeFunctionClicked("image",e,"full_screen")`）；② 事件带 `images_count`/`is_variants`
 * （`trackFullscreenOpenClick({…,images_count:…,is_variants:…})`）；③ `lockedTooltip: c("scale")` 的键也是 `"scale"`。
 * 同一段里图像右组 `LJ` 的键只有三颗，逐字顺序 = `saveToLibrary` · `download` · `scale`。
 *
 * 老用户**已经持久化**的布局里存的是旧键 ⇒ 在这里读入时改名，
 * 分区 / 排序 / 删减一律原样保留，只换键名（与视频那套 `migrateVideoLayoutToV4` 同一做法）。
 * ⚠️ 图像**独立一份映射**，**不复用** `VIDEO_KEY_RENAMES` —— 否则跨节点串味。
 *
 * ⚠️ 本函数必须跑在 `migrateImageLayoutToV7/V9/V10/V11` **之后**：那几条迁移的锚点
 * （`legacyDefaultLayouts` / `LEGACY_IMAGE_DEFAULT_V8` / `LEGACY_IMAGE_DEFAULT_V10` / v4 的换位）
 * 描述的是**改名前的旧持久化布局**，里面就是 `fullscreen`。见 `migrateToolbarLayout` 的调用链。
 *
 * **幂等**：跑第二遍时旧键已不存在 ⇒ 逐键 map 找不到对应项、原样返回；
 * 即使不依赖 `version` 门也不会重复改名。另：若同一份布局里**已经**有新键
 * （例如用户手工编辑过），则旧键直接丢弃，避免出现两颗同键按钮。
 *
 * 注意刻意**不在这里推进版本号** —— 交给 `migrateToolbarLayout` 末尾统一的「补 more」步骤收尾
 * （与 v9/v10/v11 同一规矩，否则会跳过那次补 more）。
 */
const IMAGE_KEY_RENAMES: ReadonlyMap<string, string> = new Map([
  ['fullscreen', 'scale'],
]);

function migrateImageLayoutToV12(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 12) return layout;
  const seenKeys = new Set(layout.zones.flatMap((zone) => zone.buttonKeys));
  const zones = layout.zones.map((zone) => ({
    ...zone,
    buttonKeys: zone.buttonKeys.flatMap((key) => {
      const officialKey = IMAGE_KEY_RENAMES.get(key);
      if (!officialKey) return [key];
      if (seenKeys.has(officialKey)) return [];   // 新键已在布局里 ⇒ 丢掉旧键（不产生重复项）
      seenKeys.add(officialKey);
      return [officialKey];
    }),
  }));
  return { ...layout, zones };
}

/**
 * 为音频工具栏补入一次本地「语音转文本」按钮。
 * 只插入用户还没手动移除过的布局，插入位置紧跟播放/暂停。
 * 这里不升版本号，留给下面统一的“更多”按钮迁移去收尾。
 */
function migrateAudioLayout(layout: ToolbarLayout): ToolbarLayout {
  if (layout.zones.some((zone) => zone.buttonKeys.includes('speechToText'))) return layout;

  const zones = layout.zones.map((zone) => ({ ...zone, buttonKeys: [...zone.buttonKeys] }));
  const zoneIndex = zones.findIndex((zone) => zone.buttonKeys.includes('togglePlay'));
  if (zoneIndex >= 0) {
    const insertAt = zones[zoneIndex].buttonKeys.indexOf('togglePlay') + 1;
    zones[zoneIndex].buttonKeys.splice(insertAt, 0, 'speechToText');
    return { ...layout, zones };
  }
  if (zones.length > 0) {
    zones[0].buttonKeys.unshift('speechToText');
    return { ...layout, zones };
  }
  return { ...layout, zones: [{ id: 'zone-audio-asr', name: '常用', buttonKeys: ['speechToText'] }] };
}

/** 旧文本默认布局（v2）的逐字快照 —— 只用于识别「没被用户改过的旧默认」 */
const LEGACY_TEXT_DEFAULT_V2: [string, string[]][] = [
  ['常用', ['copy', 'clearEmptyLines', 'showPrompt', 'fullscreen', 'more']],
];

/**
 * 文本工具栏 v3：主行按官方 `not` 收敛（`pin → 复制全部 → 保存到素材库 → 全屏`，外加 MTV 的 ⋯）。
 *  · 精确等于 v2 旧默认 ⇒ 整体换新默认；
 *  · 用户动过的布局 ⇒ **只增不删**：补入官方新增的 `pin` / `saveToLibrary`（插在 `copy` 两侧），
 *    原有的分区、排序、删减一律保留（版本号交给统一的「补 more」步骤收尾）。
 */
function migrateTextLayoutToV3(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 3) return layout;

  const isLegacyDefault = layout.zones.length === LEGACY_TEXT_DEFAULT_V2.length
    && layout.zones.every((zone, index) => (
      zone.name === LEGACY_TEXT_DEFAULT_V2[index][0]
      && zone.buttonKeys.length === LEGACY_TEXT_DEFAULT_V2[index][1].length
      && zone.buttonKeys.every((key, keyIndex) => key === LEGACY_TEXT_DEFAULT_V2[index][1][keyIndex])
    ));
  if (isLegacyDefault) return getDefaultLayout('ai-text');

  const zones = layout.zones.map((zone) => ({ ...zone, buttonKeys: [...zone.buttonKeys] }));
  const ensureBefore = (key: string, anchorKey: string) => {
    if (zones.some((zone) => zone.buttonKeys.includes(key))) return;
    const target = zones.find((zone) => zone.buttonKeys.includes(anchorKey)) ?? zones[0];
    if (!target) return;
    const at = target.buttonKeys.indexOf(anchorKey);
    target.buttonKeys.splice(at >= 0 ? at : 0, 0, key);
  };
  const ensureAfter = (key: string, anchorKey: string) => {
    if (zones.some((zone) => zone.buttonKeys.includes(key))) return;
    const target = zones.find((zone) => zone.buttonKeys.includes(anchorKey)) ?? zones[zones.length - 1];
    if (!target) return;
    const at = target.buttonKeys.indexOf(anchorKey);
    target.buttonKeys.splice(at >= 0 ? at + 1 : target.buttonKeys.length, 0, key);
  };
  ensureBefore('pin', 'copy');
  ensureAfter('saveToLibrary', 'copy');
  return { ...layout, zones };
}

/**
 * 文本工具栏 v4：补上官方**第 1 组**「背景颜色」（`p = [ {背景色 color-picker} ]`，`mQ`）。
 * 官方那是个**独立分组**（与第 2 组之间一根分隔线）⇒ 这里也开一个独立分区放在最前。
 * 只增不删：已有 `color-picker` 就原样返回；用户自己的分区/排序不受影响。
 */
function migrateTextLayoutToV4(layout: ToolbarLayout): ToolbarLayout {
  if (layout.zones.some((zone) => zone.buttonKeys.includes('color-picker'))) return layout;
  return {
    ...layout,
    zones: [{ id: 'zone-text-color', name: 'Color', buttonKeys: ['color-picker'] }, ...layout.zones.map((z) => ({ ...z, buttonKeys: [...z.buttonKeys] }))],
  };
}

/**
 * 文本工具栏 v5：把 MTV 自有项（清除空行 / 查看提示词）**从主行挪进 ⋯ 浏览全部**。
 *
 * 官方文本卡主行只有 `[背景颜色] 丨 [pin, 复制全部, 保存到素材库, 全屏]`，**没有这两项**；
 * 用户定案「MTV 多出的一律只进 ⋯」⇒ 老布局里这两项要从主行摘掉，并确保 ⋯ 键存在
 * （旧布局把全部键都塞在主行 ⇒ `hiddenDefaultButtons` 为空 ⇒ **⋯ 不渲染** ✗
 *   这正是用户报的「文本卡片上方工具栏没有浏览全部按钮」）。
 */
const TEXT_MTV_ONLY_KEYS: readonly string[] = ['clearEmptyLines', 'showPrompt'];

function migrateTextLayoutToV5(layout: ToolbarLayout): ToolbarLayout {
  const zones = layout.zones.map((zone) => ({
    ...zone,
    buttonKeys: zone.buttonKeys.filter((key) => !TEXT_MTV_ONLY_KEYS.includes(key)),
  }));
  if (!zones.some((zone) => zone.buttonKeys.includes(TOOLBAR_MORE_KEY))) {
    const last = zones[zones.length - 1];
    if (last) zones[zones.length - 1] = { ...last, buttonKeys: [...last.buttonKeys, TOOLBAR_MORE_KEY] };
    else zones.push({ id: 'zone-more', name: 'Primary', buttonKeys: [TOOLBAR_MORE_KEY] });
  }
  return { ...layout, zones };
}

/**
 * 视频工具栏 v3：主行按**桌面版 0.4.99 官方源码**收敛
 * （左组 `增强 · 截帧 · ⋯` 丨 右组 `保存到素材库 · 下载 · 全屏`，
 *  见 `VIDEO_BUTTONS` 上的逐字节记账）。
 *
 * 旧默认（v2 = `复制视频 · 截取帧 · 查看提示词 · 反推提示词 · 全屏预览 · ⋯`）里
 * 三颗 MTV 自有项（复制视频 / 查看提示词 / 反推提示词）要**从主行摘下来**（改由 ⋯ 收纳），
 * 并补入官方新增的 `saveToLibrary` / `download` / `upscale`。
 * 只有**精确等于 v2 默认**的布局才整体换新；用户动过的布局原样保留（新键会落进 ⋯ 菜单）。
 */
/** 旧视频默认布局（v2）的逐字快照 —— 只用于识别「没被用户改过的旧默认」。
 *  ⚠️ §96：里面的 `captureFrame` / `fullscreen` 是**改名前的旧键**，必须原样保留
 *  （它描述的是「老用户 localStorage 里存着的那份」）；改名由 `migrateVideoLayoutToV4` 负责。 */
const LEGACY_VIDEO_DEFAULT_V2: [string, string[]][] = [
  ['常用', ['copyFile', 'captureFrame', 'showPrompt', 'reversePrompt', 'fullscreen', TOOLBAR_MORE_KEY]],
];

function migrateVideoLayoutToV3(layout: ToolbarLayout): ToolbarLayout {
  /* §96：v3 已经跑过这条迁移（targetVersion 从 3 抬到 4 之后，v3 布局也会进这个函数）
     ⇒ 加版本门，保证「用户主动删掉的 upscale/download 不会被二次补回」。 */
  if (layout.version >= 3) return layout;
  const isLegacyDefault = layout.zones.length === LEGACY_VIDEO_DEFAULT_V2.length
    && layout.zones.every((zone, index) => (
      zone.name === LEGACY_VIDEO_DEFAULT_V2[index][0]
      && zone.buttonKeys.length === LEGACY_VIDEO_DEFAULT_V2[index][1].length
      && zone.buttonKeys.every((key, keyIndex) => key === LEGACY_VIDEO_DEFAULT_V2[index][1][keyIndex])
    ));
  if (isLegacyDefault) return getDefaultLayout('ai-video');
  /* 用户动过的布局：**只增不删**（与图像/文本那两条迁移同一口径）——补官方新增能力，
     保留原有分区/排序/删减。
     ⚠️ 这里的锚点（`captureFrame` / `fullscreen`）是**改名前的旧键**：本函数必须跑在
     `migrateVideoLayoutToV4`（改名）**之前** —— 见 `migrateToolbarLayout` 的调用链。 */
  const zones = layout.zones.map((zone) => ({ ...zone, buttonKeys: [...zone.buttonKeys] }));
  const existing = new Set(zones.flatMap((zone) => zone.buttonKeys));
  const push = (key: string, beforeKey: string) => {
    if (existing.has(key)) return;
    const target = zones.find((zone) => zone.buttonKeys.includes(beforeKey)) ?? zones[zones.length - 1];
    if (!target) return;
    const at = target.buttonKeys.indexOf(beforeKey);
    target.buttonKeys.splice(at >= 0 ? at : target.buttonKeys.length, 0, key);
    existing.add(key);
  };
  push('upscale', 'captureFrame');
  push('download', 'fullscreen');
  return { ...layout, zones };
}

/**
 * 视频工具栏 v4：**键名改成官方 `xXe` 逐字**（`vendor-pkg-canvas-CvbAwZyy.js`）。
 *
 * | 旧键（MTV 自造） | 新键（官方逐字） | 官方原文 |
 * |---|---|---|
 * | `fullscreen`       | `scale`                | @1974297 `{key:"scale",tooltip:y("common.fullScreen")}` |
 * | `captureFrame`     | `video_frame_capture`  | @1975961 `{…,key:"video_frame_capture",buttonType:"more",…}` |
 *
 * 老用户**已经持久化**的布局里存的是旧键 ⇒ 在这里读入时改名，
 * 保证已存布局不丢（分区 / 排序 / 删减一律原样保留，只换键名）。
 *
 * **幂等**：跑第二遍时旧键已不存在 ⇒ 逐键 map 找不到对应项、原样返回；
 * 即使不依赖 `version` 门也不会重复改名。另：若同一份布局里**已经**有新键
 * （例如用户手工编辑过），则旧键直接丢弃，避免出现两颗同键按钮。
 */
const VIDEO_KEY_RENAMES: ReadonlyMap<string, string> = new Map([
  ['fullscreen', 'scale'],
  ['captureFrame', 'video_frame_capture'],
]);

function migrateVideoLayoutToV4(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 4) return layout;
  const seenKeys = new Set(layout.zones.flatMap((zone) => zone.buttonKeys));
  const zones = layout.zones.map((zone) => ({
    ...zone,
    buttonKeys: zone.buttonKeys.flatMap((key) => {
      const officialKey = VIDEO_KEY_RENAMES.get(key);
      if (!officialKey) return [key];
      if (seenKeys.has(officialKey)) return [];   // 新键已在布局里 ⇒ 丢掉旧键（不产生重复项）
      seenKeys.add(officialKey);
      return [officialKey];
    }),
  }));
  return { ...layout, zones };
}

/**
 * 视频工具栏 v5（§113）：**按官方拆成三段 + 补入官方 `pin` 组**。
 *
 * 官方依据（`live-assets-r100/vendor-pkg-canvas-DuoOicPr.js` @1969928 区逐字）：
 *   `G=a.useMemo(()=>[O,...U?[[U]]:[],F],[O,U,F])` ⇒ **左组 → pin 组 → 右组**；
 *   组间分隔线 = `w-px h-[18px] bg-primary-border`（真机 CDP 9222 实测 2 条）。
 *   而 `VIDEO_BUTTONS` 原来把三组的 `defaultZone` **全写成 `'常用'`** ⇒ `buildLayout` 的
 *   `Map` 按**名字**合并 ⇒ 只剩 1 个 zone、分隔线分支永不执行（§108 实测）。
 *
 * 两条分支（与 §96/§99 的 v3→v4 / v11→v12 同一套做法）：
 *  · **精确等于 v4 旧默认**（单 zone `'常用'` = `upscale·video_frame_capture·more·saveToLibrary·download·scale`）
 *    ⇒ 整体换成新默认（`Primary | Pin | Secondary`，版本号已随 `buildLayout` 抬到 5）；
 *  · **用户动过的布局** ⇒ **只增不删**：原分区 / 排序 / 删减一律保留，只把 `pin` 作为
 *    **独立一组**插到「含 `more` 的那一组」之后（= 官方「左组 → pin → 右组」的相对位置）。
 *
 * **幂等**：① `version >= 5` 直接返回；② 即使不带版本门，`zones.some(z=>z.buttonKeys.includes('pin'))`
 * 也会让插入只发生一次（不会长出第二个 Pin 组）。
 * ⚠️ 本函数必须跑在 `migrateVideoLayoutToV3`（锚点是**改名前的旧键**）与 `migrateVideoLayoutToV4`
 *    （改名）**之后** —— 见 `migrateToolbarLayout` 的调用链。
 */
/** 旧视频默认布局（v4）的逐字快照 —— 只用于识别「没被用户改过的旧默认」 */
const LEGACY_VIDEO_DEFAULT_V4: [string, string[]][] = [
  ['常用', ['upscale', 'video_frame_capture', TOOLBAR_MORE_KEY, 'saveToLibrary', 'download', 'scale']],
];

function migrateVideoLayoutToV5(layout: ToolbarLayout): ToolbarLayout {
  if (layout.version >= 5) return layout;
  const isLegacyDefault = layout.zones.length === LEGACY_VIDEO_DEFAULT_V4.length
    && layout.zones.every((zone, index) => (
      zone.name === LEGACY_VIDEO_DEFAULT_V4[index][0]
      && zone.buttonKeys.length === LEGACY_VIDEO_DEFAULT_V4[index][1].length
      && zone.buttonKeys.every((key, keyIndex) => key === LEGACY_VIDEO_DEFAULT_V4[index][1][keyIndex])
    ));
  if (isLegacyDefault) return getDefaultLayout('ai-video');

  const zones = layout.zones.map((zone) => ({ ...zone, buttonKeys: [...zone.buttonKeys] }));
  if (!zones.some((zone) => zone.buttonKeys.includes('pin'))) {
    const pinZone: ToolbarZoneLayout = { id: 'zone-video-pin', name: 'Pin', buttonKeys: ['pin'] };
    const anchor = zones.findIndex((zone) => zone.buttonKeys.includes(TOOLBAR_MORE_KEY));
    if (anchor >= 0) zones.splice(anchor + 1, 0, pinZone);
    else zones.push(pinZone);
  }
  return { ...layout, zones };
}

/**
 * 为旧布局补入一次“更多”按钮。布局升到当前版本后，用户主动隐藏“更多”不会再被补回。
 */
export function migrateToolbarLayout(nodeType: string, layout: ToolbarLayout): ToolbarLayout {
  // 版本号按节点类型各自推进：给音频加按钮不该把文本、视频的布局也重新迁移一遍
  const targetVersion = nodeType === 'ai-image'
    ? 12
    : nodeType === 'ai-audio'
      ? 3
      : nodeType === 'ai-text'
        ? 5
        : nodeType === 'ai-video'
          ? 5
          : nodeType === 'ai-panorama'
            ? 2
            : layout.version;
  if (layout.version >= targetVersion) return layout;

  const migrated = nodeType === 'ai-image'
    /* §99：先 v7/v9/v10/v11（锚点是**改名前的旧键** `fullscreen`）→ 最后 v12（旧键改名成官方逐字 `scale`）。 */
    ? migrateImageLayoutToV12(migrateImageLayoutToV11(migrateImageLayoutToV10(migrateImageLayoutToV9(migrateImageLayoutToV7(layout)))))
    : nodeType === 'ai-audio'
      ? migrateAudioLayout(layout)
      : nodeType === 'ai-text'
        ? migrateTextLayoutToV5(migrateTextLayoutToV4(migrateTextLayoutToV3(layout)))
        : nodeType === 'ai-video'
          /* §96：先 v3（补 `upscale`/`download`，锚点是**旧键名**）→ 再 v4（旧键改名成官方逐字）
             → §113 再 v5（拆三段 + 补官方 `pin` 组）。 */
          ? { ...migrateVideoLayoutToV5(migrateVideoLayoutToV4(migrateVideoLayoutToV3(layout))), version: targetVersion }
          : layout;
  if (migrated.version >= targetVersion) return migrated;

  const moreButton = getButtonRegistry(nodeType).find((button) => button.key === TOOLBAR_MORE_KEY);
  if (!moreButton) return migrated;

  let zones = migrated.zones.map((zone) => ({ ...zone, buttonKeys: [...zone.buttonKeys] }));
  const alreadyAdded = zones.some((zone) => zone.buttonKeys.includes(TOOLBAR_MORE_KEY));
  if (!alreadyAdded) {
    let targetIndex = zones.findIndex((zone) => zone.name === moreButton.defaultZone);
    if (targetIndex < 0) targetIndex = zones.length - 1;

    if (targetIndex >= 0) {
      const targetZone = zones[targetIndex];
      const buttonKeys = [...targetZone.buttonKeys];
      const composeIndex = nodeType === 'ai-image' ? buttonKeys.indexOf('compose') : -1;
      buttonKeys.splice(composeIndex >= 0 ? composeIndex + 1 : buttonKeys.length, 0, TOOLBAR_MORE_KEY);
      zones[targetIndex] = { ...targetZone, buttonKeys };
    } else {
      zones = [{ id: 'zone-more', name: moreButton.defaultZone, buttonKeys: [TOOLBAR_MORE_KEY] }];
    }
  }

  return { ...migrated, zones, version: targetVersion };
}

/** 根据 nodeType 获取按钮注册表 */
export function getButtonRegistry(nodeType: string): ToolbarButtonDef[] {
  switch (nodeType) {
    case 'ai-text':     return TEXT_BUTTONS;
    case 'ai-video':    return VIDEO_BUTTONS;
    case 'ai-panorama': return PANORAMA_BUTTONS;
    case 'ai-image':    return IMAGE_BUTTONS;
    case 'ai-audio':    return AUDIO_BUTTONS;
    default:            return [];
  }
}

/** 返回未出现在当前布局中的已注册按钮；“更多”自身不收纳自己。 */
export function getHiddenDefaultToolbarButtons(
  registry: ToolbarButtonDef[],
  activeButtonKeys: ReadonlySet<string>,
): ToolbarButtonDef[] {
  return registry.filter((button) => (
    button.key !== TOOLBAR_MORE_KEY && !activeButtonKeys.has(button.key)
  ));
}

/** 根据 nodeType 获取默认布局 */
export function getDefaultLayout(nodeType: string): ToolbarLayout {
  const deepClone = (layout: ToolbarLayout): ToolbarLayout => ({
    ...layout,
    zones: layout.zones.map((z: ToolbarZoneLayout) => ({ ...z, buttonKeys: [...z.buttonKeys] })),
  });
  switch (nodeType) {
    case 'ai-text':     return stripUnofficialTextKeys(deepClone(DEFAULT_TEXT_LAYOUT));
    case 'ai-video':    return deepClone(DEFAULT_VIDEO_LAYOUT);
    case 'ai-panorama': return deepClone(DEFAULT_PANORAMA_LAYOUT);
    case 'ai-image':    return deepClone(DEFAULT_IMAGE_LAYOUT);
    case 'ai-audio':    return deepClone(DEFAULT_AUDIO_LAYOUT);
    default:            return { zones: [], version: 1 };
  }
}
