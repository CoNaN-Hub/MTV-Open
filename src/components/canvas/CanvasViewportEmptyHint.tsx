/**
 * CanvasViewportEmptyHint —— 官方「当前视窗没有节点」胶囊，逐字移植。
 *
 * 官方出处：`vendor-pkg-canvas-CvbAwZyy.js`（只读产物）
 *   组件 `fwt` @3561288–3561855 逐字：
 *   ```js
 *   function fwt(){
 *     const{t:e}=se(),{fitView:t,getNodes:n}=pt(),o=cn(c=>c.nodes),
 *           {shouldShowEmptyHint:r,dismissEmptyHint:i}=uwt(o),
 *           l=a.useCallback(()=>{const c=n(),d=pwt(c);
 *             d?.id&&(t({nodes:[{id:d.id}],padding:.5,duration:500,maxZoom:mwt}),i())},[t,n,i]);
 *     return r?s.jsx(Zu,{position:"bottom-center",className:"pointer-events-auto",children:s.jsxs("div",{
 *       className:"flex items-center gap-4 rounded-full bg-tap-background-primary/90 px-4 py-2 shadow-lg backdrop-blur-md border border-tap-border-primary",
 *       children:[s.jsx("span",{className:"text-sm text-tap-text-2",children:e("canvas.viewportEmpty.message")}),
 *                 s.jsx(Wt,{size:"sm",onClick:l,children:e("canvas.viewportEmpty.recenter")})]})}):null}
 *   ```
 *   挂载点 `!Ct&&!de&&s.jsx(fwt,{})` @3569115。
 *
 * ── 官方两个门控（本次已查证）──────────────────────────────────────────────
 *   · `de = Ud("viewportEmptyHint")` @3564080；`Ud` @336948 =
 *     `e=>store(t=>t.mergedPolicy.canvasControls?.hiddenItems?.includes(e)??!1)`
 *     = **TapNow 平台策略**（`C2e` @634272 的默认策略里 `canvasControls.hiddenItems`
 *       确实含 `"viewportEmptyHint"`）。**MTV 没有这套平台策略配置** ⇒ MTV 侧无 `de` 可用，
 *       按「恒渲染」处理（挂载点不写任何策略判断）。
 *   · `Ct` @3566290 = `window.location.host.includes("mediastorm")` ——
 *     ⚠️ **推翻「疑似教程/活动门控」的猜测**：它是「当前 host 是否含 mediastorm」的
 *     品牌/域名开关，mediastorm 域名下**不渲染**本提示。MTV 的 host 不是 mediastorm
 *     （桌面端是 tauri 自定义协议 / localhost）⇒ 恒为 false ⇒ 不影响渲染，MTV 侧不移植该判断。
 */
import { useCallback } from 'react';
import { Panel, useReactFlow } from '@xyflow/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { OfficialButton } from '../settings/official/OfficialControls';
import {
  pickLastNode,
  useViewportEmptyHint,
  VIEWPORT_EMPTY_FIT_MAX_ZOOM,
} from '../../hooks/useViewportEmptyHint';

export default function CanvasViewportEmptyHint() {
  const t = useT();
  /** 官方 `pt()` = React Flow `useReactFlow()` */
  const { fitView, getNodes } = useReactFlow();
  /** 官方 `cn(c=>c.nodes)` = 画布节点表；MTV 的对应物是画布 store 的 `nodes` */
  const nodes = useAppStore((state) => state.nodes);
  const { shouldShowEmptyHint, dismissEmptyHint } = useViewportEmptyHint(nodes);

  /** 官方 `l` 逐字：fitView 到**最后一个**节点（`pwt`），参数 padding/duration/maxZoom 逐字 */
  const recenter = useCallback(() => {
    const current = getNodes();
    const last = pickLastNode(current);
    if (!last?.id) return;
    void fitView({
      nodes: [{ id: last.id }],
      padding: 0.5,
      duration: 500,
      maxZoom: VIEWPORT_EMPTY_FIT_MAX_ZOOM,
    });
    dismissEmptyHint();
  }, [fitView, getNodes, dismissEmptyHint]);

  if (!shouldShowEmptyHint) return null;

  return (
    <Panel position="bottom-center" className="pointer-events-auto">
      {/* 官方类串**逐字保留**（含两个官方死类，勿修）：
            `bg-tap-background-primary/90` 与 `border-tap-border-primary`
            在官方 6 份 CSS 产物里 **0 命中**，真机 `getComputedStyle(documentElement)`
            读到 `--tap-background-primary` / `--tap-border-primary` 均为**空** ⇒ 官方自己也
            不生成任何规则（它们是死类）。**不要给它们编颜色。**
          ⚠️ 描边**不是** currentColor：官方有全局 `*{border-color:var(--border)}`，
             真机 computed `borderColor = rgba(255,255,255,0.1)`；MTV 的 v3 preflight 用的
             也是同一个 `var(--border)`（`styles/base.css`@61 = `#ffffff1a`）⇒ 本来就一致。
          末尾两个类是 MTV 自有的适配钩子（不删任何官方类）：
            · `o-scope`：官方 Button（`Wt` → `.o-btn`）的 `--o-*` 令牌定义在 `.o-scope` 作用域里
              （`styles/official-controls.css`@40-88）⇒ 不挂它会**没样式**。顺带给的
              `color: var(--o-foreground)` = `#f5f5f5`，与官方真机继承色 rgb(245,245,245) 一致。
            · `canvas-viewport-empty-hint`：只为把 v4 的 `shadow-lg` 取值链钉回来，
              见 `styles/canvas-viewport-empty-hint.css` 文件头。*/}
      <div className="flex items-center gap-4 rounded-full bg-tap-background-primary/90 px-4 py-2 shadow-lg backdrop-blur-md border border-tap-border-primary o-scope canvas-viewport-empty-hint">
        <span className="text-sm text-tap-text-2">{t('当前视窗没有节点，可点击按钮快速回到内容区域')}</span>
        {/* 官方 `s.jsx(Wt,{size:"sm",…})` **没有显式 variant** ⇒ 落 `defaultVariants.variant="default"`
            = `bg-primary text-primary-foreground shadow hover:bg-primary/90`（蓝色实心）。
            ⚠️ MTV 的 `OfficialButton` 默认 `variant='outline'`（透明底 + 描边）⇒ 必须显式传
            `variant="default"`，否则会渲染成一颗**没有蓝底**的按钮，与截图不符。

            ⚠️⚠️ 真机实测（官方页面，提示**已显示**时量的）：
            官方按钮的真机 class 串里**没有 `text-sm`** —— cva base 有 `text-sm`，`size:"sm"` 又加
            `text-xs`，而官方 `I(...)` = **clsx + tailwind-merge** ⇒ 冲突类只留后者，`text-sm` 被删。
            **MTV 没有 `clsx`/`tailwind-merge` 依赖**（仓库里 5 处都注明过这点，
            见 `src/components/chat/officialClassNames.ts`）⇒ 若照抄 cva 的 base+size 两个类串，
            `text-sm`(14px) 与 `text-xs`(12px) 谁赢就取决于 CSS 顺序，**有变成 14px 的风险**。
            这里用 MTV 既有的 `.o-btn` + `.o-btn--sm` 端口：`.o-btn--sm` 在 `official-controls.css`
            里排在 `.o-btn` **之后**（@185 vs @99）⇒ `font-size:12px / line-height:16px` 稳定胜出，
            与官方真机读数（12px / 16px / 500 字重）一致。该顺序由
            `tests/components/canvasViewportEmptyHint.test.tsx` 钉住。
            · 真机按钮读数：72×32 · r10 · pad 0 12 · gap 8 · bg rgb(31,162,220) · color rgb(250,250,250)
              与 `.o-btn--default` + `.o-btn--sm` + `.o-scope` 的 `--o-primary/--o-primary-foreground` 一致。
            · **两处共享控件的偏差已在本胶囊内按官方真机值钉回**（见
              `styles/canvas-viewport-empty-hint.css` 的 `.canvas-viewport-empty-hint .o-btn`）：
              ① `cursor`：官方真机 = `default`，MTV `.o-btn` = `pointer`；
              ② `box-shadow`：官方读 `--shadow`（`0px 2px 4px 0px #0000001a, 0px 1px 2px -1px #0000001a`，
                 已按实测补进 `.o-scope`），MTV `.o-btn--default` 是 `shadow-sm`。
              两条**只作用在本胶囊**（选择器特异性 0,2,0 > `.o-btn--default` 的 0,1,0），
              不改 MTV 其它官方按钮 —— 那属于共享控件的全仓问题，不在本功能范围内。 */}
        <OfficialButton variant="default" size="sm" onClick={recenter}>
          {t('回到节点')}
        </OfficialButton>
      </div>
    </Panel>
  );
}
