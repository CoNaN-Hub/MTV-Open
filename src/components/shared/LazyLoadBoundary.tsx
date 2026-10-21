/**
 * 为根视图和按需功能提供统一懒加载占位与错误边界，避免单个异步模块拖垮整页。
 */
import { Component, type ComponentProps, type ErrorInfo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import officialLoadingCanvas from '../../assets/loading-canvas.webp';

type LazyLoadVariant = 'root' | 'feature';

interface LazyLoadFallbackProps {
  label: string;
  variant?: LazyLoadVariant;
}

interface LazyLoadBoundaryProps extends LazyLoadFallbackProps {
  children: ReactNode;
}

interface LazyLoadBoundaryState {
  failed: boolean;
}

export function LazyLoadFallback({ label, variant = 'feature' }: LazyLoadFallbackProps) {
  if (variant === 'root') {
    /* ══════════════════════════════════════════════════════════════════════
       2026 round 100：官方**根加载屏**已找到 ⇒ root 变体改为 1:1 复刻官方 `L`。
       ── 官方逐字（新构建哈希 `3ba264df7660179133784731923a0a6ab5d87cf0`）──────────
       `D:\DEEPSEEK\live-assets-r100\loading-overlay-DoLoNJJU.js`（全文 1,325 字节）：
           const n="https://fe-assets.tapnow.media/3ba264df76…/assets/loading-BWU_g4Wm.webp",
           r=()=>a.jsxs(t.div,{
             role:"status","aria-live":"polite","aria-label":"Loading canvas",
             className:"fixed inset-0 z-50 flex items-center justify-center bg-black",
             initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},
             transition:{duration:1,ease:"easeOut"},
             "data-testid":s.COMMON.LOADING.OVERLAY,
             children:[
               a.jsx(t.div,{
                 initial:{opacity:0,scale:.95},animate:{opacity:1,scale:1},exit:{opacity:0,scale:1},
                 transition:{duration:.3,delay:.1,ease:"easeOut",exit:{duration:.8,ease:"easeOut"}},
                 children:a.jsx(t.img,{src:n,alt:"Loading",className:"w-16 h-16 object-contain",
                   animate:{scale:[.95,1.05,.95]},
                   transition:{duration:2,repeat:1/0,ease:"easeInOut"}})}),
               a.jsx("span",{className:"sr-only",children:"Loading canvas, please wait..."})
             ]});
       解码（**实测**，非推断）：
         · `a` = `g` = `te` = react/jsx-runtime（vendor-libs 导出表 `te as g` @8936031）
         · `t` = `dd` = `oks` = framer-motion 的 `motion`（`oks=fur(i2r,Aur)` @1522781）
         · `s.COMMON.LOADING.OVERLAY` = "common-loading-overlay"（vendor-packages-JNk8f0_N.js
           @643361 逐字：`LOADING:{OVERLAY:"common-loading-overlay"}`）
       ⇒ 本仓 motion.div / motion.div / motion.img 三层与官方三个元素一一对应。
       ⇒ 官方根容器**没有可见文字**（唯一文字是 `sr-only` 的 "Loading canvas, please wait..."），
         故本轮按官方**删掉**原可见文案「正在加载{label}」；`label` prop 保留（feature 变体仍在用）。

       ── `bg-black` 而非 `bg-background`（照官方写死，勿改）────────────────────
       官方逐字就是 `bg-black`(#000)。上一轮把根加载屏底色从 MTV 的 `#000000` 换成了官方令牌
       `--background`(#0f0f0f)；本轮按「官方逐字优先」改回 `bg-black`。这是本文件唯一一处
       不用官方令牌而用写死颜色的地方，理由就是官方源码写死。

       ── `exit` 在当前挂载方式下不触发（与官方的差异已记录）──────────────────
       官方把 `L`（本组件）挂在**两处**（`page-BFzZXoBV.js`，偏移均为本人实测）：
         ① @52315 `t.jsx(Te,{children:!be&&t.jsx(dt,{},"loader")})`
            — `Te` = `fB` = `aks` = **AnimatePresence**（`aks` 定义 @1446520，签名为
              `{children,custom,initial,onExitComplete,presenceAffectsLayout,mode,propagate,
               anchorX,root}`）。官方**有** AnimatePresence 包裹且带 `key="loader"`
              ⇒ 这处 `exit:{opacity:0}` 会真正跑。
         ② @49613 `if(n&&!c)return t.jsx(dt,{});` — 官方另一处**裸挂**（无 AnimatePresence、
            无 key）⇒ 这处 `exit` 同样不触发。
       MTV 的根加载屏是 `src/RootView.tsx` @31 的 React `Suspense` fallback
       （`fallback={<LazyLoadFallback label={viewLabel} variant="root" />}`）；该文件全文 44 行
       **没有** `AnimatePresence`（本人 read 全文确认）。Suspense 解析时是**整棵 fallback
       子树一起卸载**，不是在常驻的 AnimatePresence 下替换 children ⇒ 在这里补一个
       AnimatePresence 也不可能让 `exit` 跑起来（那属于自造结构，官方没有）。
       且 `RootView.tsx` 不在本轮白名单内。
       ⇒ 决策：**照官方原样写上 initial/animate/exit**（保留 `exit`，不删不改）。这与官方 @49613
         的裸挂行为**完全一致**（那处 `exit` 也不触发）；与官方 @52315 相比仅缺少 AnimatePresence
         包裹，差异已在此记录。

       ── 上一轮 round 96 的原始依据（**基于旧构建，已全部失效**，保留仅为历史记录）──────
       旧前提「**官方没有根级加载屏**」已被新构建推翻：官方确有 `loading-overlay-DoLoNJJU.js`。
       旧证据：《`D:\DEEPSEEK\TapNowExtract\web\resources\web\index.html`》（旧首页，无加载屏）、
       旧 `index-BDGj8rGN.js` 的 `@1023323` / `@1137085` / `@1001942`，以及旧那道 `#8888a0` 转圈弧。
       ⚠️ 以上旧偏移一律**失效**，不得再作为依据引用（本轮依据只有新构建那一份）。
       ══════════════════════════════════════════════════════════════════════ */
    /* 官方逐字（见上方注释）：容器 → motion.div，内层 → motion.div，图 → motion.img。 */
    return (
      <motion.div
        role="status"
        aria-live="polite"
        aria-label="Loading canvas"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        data-testid="common-loading-overlay"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={
            {
              duration: 0.3,
              delay: 0.1,
              ease: 'easeOut',
              /* 官方逐字带 `exit`（@52315 那处由 AnimatePresence 驱动；本仓挂载方式见上注释）。
                 ⚠️ framer-motion 的 `Transition` 类型**不含** `exit` 键（`npx tsc -b` 实测
                 TS2353: `'exit' does not exist in type 'Transition<any>'`），且 `Transition`
                 并未从 `framer-motion` 再导出。这里只加**一次类型断言**，值仍逐字照官方；
                 断言在编译期擦除 ⇒ 运行时对象与官方完全一致。 */
              exit: { duration: 0.8, ease: 'easeOut' },
            } as ComponentProps<typeof motion.div>['transition']
          }
        >
          <motion.img
            src={officialLoadingCanvas}
            alt="Loading"
            className="w-16 h-16 object-contain"
            animate={{ scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
        <span className="sr-only">Loading canvas, please wait...</span>
      </motion.div>
    );
  }

  return (
    <div
      className="fixed bottom-5 left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-card px-3 py-2 shadow-xl"
      role="status"
      aria-live="polite"
    >
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border border-border border-t-primary"
        aria-hidden="true"
      />
      <span className="text-xs text-muted-foreground">正在加载{label}</span>
    </div>
  );
}

export default class LazyLoadBoundary extends Component<
  LazyLoadBoundaryProps,
  LazyLoadBoundaryState
> {
  state: LazyLoadBoundaryState = { failed: false };

  static getDerivedStateFromError(): LazyLoadBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[LazyLoadBoundary] ${this.props.label}加载失败`, error, info.componentStack);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.failed) return this.props.children;

    if (this.props.variant === 'root') {
      return (
        <div
          className="flex min-h-screen w-screen items-center justify-center bg-background px-6 text-foreground"
          role="alert"
        >
          <div className="flex max-w-sm flex-col items-center text-center">
            <h1 className="text-lg font-semibold">应用加载失败</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {this.props.label}暂时无法加载，请重新尝试。
            </p>
            <button
              type="button"
              className="mt-5 rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={this.handleRetry}
            >
              重试
            </button>
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed bottom-5 left-1/2 z-[300] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 items-center gap-4 rounded-md border border-border bg-card px-4 py-3 shadow-xl"
        role="alert"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{this.props.label}加载失败</p>
          <p className="mt-0.5 text-xs text-muted-foreground">画布仍可继续使用</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={this.handleRetry}
        >
          重试
        </button>
      </div>
    );
  }
}
