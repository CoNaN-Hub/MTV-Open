/**
 * PileGalleryProvider —— 官方 **堆叠画廊的会话层**（逐字对照 `zoom-slider-3ZcFvYQO.js`）
 *
 * 官方三件套（同一文件 @2979100 起）：
 * ```js
 * const EJ = h.createContext(null);
 * function rct({children:e}){                                  // ← Provider
 *   const [t, n] = h.useState(null),
 *         s = h.useCallback(a => { n(c => c || a) }, []),       // openGallery：**已开就不覆盖**
 *         r = h.useCallback(a => { n(c => !c || c.previewMode === a ? c : {...c, previewMode: a}) }, []),
 *         o = h.useCallback(() => { n(null) }, []),             // closeGallery
 *         i = h.useMemo(() => ({session: t, openGallery: s, setPreviewMode: r, closeGallery: o}),
 *                       [o, s, t, r]);
 *   return l.jsx(EJ.Provider, {value: i, children: e});
 * }
 * function _J(){ const e = h.useContext(EJ); if(!e) throw new Error("PileGalleryProvider is missing"); return e; }
 * function oct(){                                              // ← Host
 *   const {session:e, setPreviewMode:t, closeGallery:n} = _J(),
 *         s = e?.pileId,
 *         r = xn(h.useCallback(a => { const c = s ? a.nodeLookup.get(s) : void 0; return JQe(c) }, [s])),
 *         o = QQe({sessionId: s ?? null, portalContainer: e?.portalContainer ?? null,
 *                  eligible: !!(e?.canEdit && r.length > 0)}),
 *         i = o.portalContainer ? yi.createPortal(l.jsx(SJ,{phase:o.phase, fixed:o.portalContainer===document.body}), o.portalContainer) : null;
 *   return e ? l.jsxs(l.Fragment, {children:[l.jsx(WQe,{...}), i]}) : i;
 * }
 * function JQe(e){ return e?.type !== he.PILE ? UG : e.data.displayMembers ?? UG }
 * ```
 *
 * MTV 对应关系：
 *   · `rct` → `PileGalleryProvider`（本文件的 Provider）
 *   · `_J`  → `usePileGallery()`（本文件）
 *   · `oct` → `PileGalleryHost`（本文件）
 *   · `JQe` → 直接读 zustand store 的 `pileMemberIds`（MTV 的堆叠成员**不在 React Flow 的
 *             `node.data.displayMembers` 上**，而在 store 里；两者语义相同，见 `utils/officialPile.ts`）
 *   · `WQe` → `./PileGallery`
 *
 * ⚠️ 官方 `oct` 还渲染一个 `SJ`（新手提示气泡，phase = `"prompt" | "success"`），
 *    它依赖官网的 **tip 系统**（`LE` / `shouldShowTip` / `neverShowTip` / `HG.pileGalleryDragToCanvas`），
 *    MTV **没有这套子系统** ⇒ 这里把 `QQe` 的状态机逐条保留但让它恒为 `null`
 *    （见下方 `usePileGalleryHost` 的 `⚠️ MTV 偏离` 注释），`SJ` 气泡本就不渲染。
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { pileMemberIds } from '../../utils/officialPile';
import PileGallery from './PileGallery';
import {
  PileGalleryContext,
  usePileGallery,
  type PileGalleryPreviewMode,
  type PileGallerySession,
} from './pileGalleryContext';

/** 官方 `rct` 的轻量再导出（组件模块只导出组件，类型走 `pileGalleryContext.ts`）。
 *  ⚠️ 这里**不能再导出常量/hook**：`react-refresh/only-export-components` 是提交门禁。 */
export type { PileGalleryOpenInput, PileGalleryPreviewMode, PileGallerySession } from './pileGalleryContext';

/** 官方 `rct` */
export function PileGalleryProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PileGallerySession | null>(null);
  /* ★ 官方逐字：`n(c => c || a)` —— **已有会话时不覆盖**。
     这条很关键：堆叠节点在画廊开着的时候再点卡片不会把快照重置（`uJe` 那边也有 `m` 的判断兜底）。 */
  const openGallery = useCallback((next: PileGallerySession) => {
    setSession((current) => current || next);
  }, []);
  /* ★ 官方逐字：`n(c => !c || c.previewMode === a ? c : {...c, previewMode:a})`
     —— 无会话 / 模式相同 ⇒ 原样返回（不触发重渲染） */
  const setPreviewMode = useCallback((mode: PileGalleryPreviewMode) => {
    setSession((current) =>
      !current || current.previewMode === mode ? current : { ...current, previewMode: mode },
    );
  }, []);
  const closeGallery = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({ session, openGallery, setPreviewMode, closeGallery }),
    [session, openGallery, setPreviewMode, closeGallery],
  );
  return <PileGalleryContext.Provider value={value}>{children}</PileGalleryContext.Provider>;
}

/**
 * 官方 `QQe({sessionId, portalContainer, eligible})` @2977996 —— 画廊宿主的「提示阶段」状态机。
 *
 * 官方逐字（unfold 后）：
 * ```js
 * const [s, r] = h.useState(null);            // phase: null | "prompt" | "success"
 * const o = h.useRef(null), i = h.useRef(null);
 * const a = LE(f => f.neverShowTip);          // tip store
 * const c = useCallback(() => { clearTimeout(o.current); o.current = null }, []);
 * useEffect(() => { if(!e || !t) return; c(); i.current = t; r(null) }, [c, t, e]);
 * useEffect(() => c, [c]);
 * const d = useCallback(() => {               // handleGalleryOpened
 *   const f = LE.getState();
 *   r(n && f.isHydrated && f.shouldShowTip(HG.pileGalleryDragToCanvas) ? "prompt" : null);
 * }, [n]);
 * const u = useCallback(() => { r(f => f === "prompt" ? null : f) }, []);   // handleGalleryClosing
 * const p = useCallback(() => {               // handleDragCollapseActivated
 *   if(s !== "prompt") return;
 *   r("success"); a(HG.pileGalleryDragToCanvas); c();
 *   o.current = setTimeout(() => { o.current = null; r(null) }, ZQe);
 * }, [c, a, s]);
 * ```
 *
 * ⚠️ MTV 偏离：官方 `a`/`d`/`p` 里的 tip 读写（`LE`、`neverShowTip`、`shouldShowTip`、
 *    `HG.pileGalleryDragToCanvas`、`ZQe`）依赖官网的**新手引导 tip 子系统**，MTV 未移植
 *    ⇒ `phase` **恒为 `null`**（等价于官方「这个 tip 已经看过了」的状态）✓
 * ⚠️ MTV 偏离：官方那个 `o`/`i` 两个 ref（定时器 + portal 记忆）**只服务于 tip 气泡**：
 *    · `o` 是 tip 自动隐藏的 `setTimeout` ⇒ 无 tip 即无定时器；
 *    · `i` 让 portal 在 `closeGallery()` 把 session 置空后**仍可复用**，但官方 `oct` 在没有 session 时
 *      本来就只渲染那个 tip portal ⇒ 对 `WQe`（画廊本体）没有任何作用。
 *    MTV 的 `PileGalleryHost` 在 `!session` 时直接返回 `null`（官方等价行为），
 *    因此这两个 ref 一并去掉；顺带避开 eslint `react-hooks/refs`（render 期读 ref）与
 *    `set-state-in-effect`（官方在 effect 里 `r(null)`）两条规则 ✓
 */
function usePileGalleryHost(input: {
  sessionId: string | null;
  portalContainer: HTMLElement | null;
  eligible: boolean;
}) {
  void input.sessionId;
  void input.portalContainer;
  void input.eligible; // ⚠️ MTV 偏离：仅用于 tip 是否展示，tip 子系统缺失 ⇒ 不消费
  /* 官方 `const [s, r] = h.useState(null)` —— 状态机保留，只是没有任何路径能把它置成 `"prompt"` */
  const [phase, setPhase] = useState<'prompt' | 'success' | null>(null);
  return {
    phase,
    /* 官方 `d` —— 进 tip；MTV 无 tip 子系统 ⇒ 恒 null（保持「不再提示」语义） */
    handleGalleryOpened: useCallback(() => setPhase(null), []),
    /* 官方 `u` —— 只在拼写阶段收起提示 */
    handleGalleryClosing: useCallback(() => setPhase((p) => (p === 'prompt' ? null : p)), []),
    /* 官方 `p` —— 拖拽收起时把提示切成 success */
    handleDragCollapseActivated: useCallback(() => {
      setPhase((p) => (p === 'prompt' ? 'success' : p));
    }, []),
  };
}

/** 官方 `oct` */
export function PileGalleryHost() {
  const { session, setPreviewMode, closeGallery } = usePileGallery();
  const nodes = useAppStore((s) => s.nodes);
  const pileId = session?.pileId;

  /* 官方 `JQe(pileNode)`：堆叠节点的成员引用。
     MTV 的堆叠成员在 store 上（`pileMemberIds`），语义等同官方的 `node.data.displayMembers`。 */
  const members = useMemo(() => {
    if (!pileId) return [];
    const pile = nodes.find((n) => n.id === pileId);
    if (!pile) return [];
    return pileMemberIds(pile as never)
      .map((mid) => nodes.find((n) => n.id === mid))
      .filter((n): n is NonNullable<typeof n> => Boolean(n));
  }, [nodes, pileId]);

  const host = usePileGalleryHost({
    sessionId: pileId ?? null,
    portalContainer: session?.portalContainer ?? null,
    eligible: Boolean(session?.canEdit && members.length > 0),
  });
  void host.phase; // ⚠️ MTV 偏离：官方用 phase 驱动新手提示气泡（无该子系统，见 usePileGalleryHost）

  /* ⚠️ MTV 偏离：官方这里 `createPortal(<SJ phase fixed/>, host.portalContainer)` 渲染新手提示气泡；
     MTV 无该子系统（见 `usePileGalleryHost` 注释）⇒ 不渲染任何东西。 */
  if (!session) return null;

  return (
    <PileGallery
      pileId={session.pileId}
      members={members}
      canEdit={session.canEdit}
      portalContainer={session.portalContainer}
      snapshot={session.snapshot}
      initialZoom={session.initialZoom}
      previewMode={session.previewMode}
      sourceImageVariant={session.sourceImageVariant}
      onPreviewModeChange={setPreviewMode}
      onOpened={host.handleGalleryOpened}
      onClosing={host.handleGalleryClosing}
      onDragCollapseActivated={host.handleDragCollapseActivated}
      onClosed={closeGallery}
    />
  );
}
