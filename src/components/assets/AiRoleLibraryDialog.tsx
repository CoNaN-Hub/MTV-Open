/**
 * AiRoleLibraryDialog —— 官方「AI角色库」全屏弹窗（1:1 移植官方 9444 实测 DOM/CSS）
 *
 * 官方来源：`page-DPdEgTS0.js` + 实测 dump `t823-I-airole.html` / `t825-D-airole.html`（992 行）
 * ```html
 * <div role="dialog" class="fixed z-[200] flex items-stretch transition-all duration-300 inset-20">
 *   <div class="relative w-full overflow-hidden flex flex-col rounded-2xl"
 *        style="background: rgba(8,8,8,0.72); backdrop-filter: blur(56px); border:1px solid rgba(255,255,255,.1);
 *               box-shadow: rgba(0,0,0,.38) 0 24px 72px, …">
 *     <div class="flex items-center gap-4 px-4 pt-4 pb-3 shrink-0">
 *       <h2 class="flex-1 text-2xl font-bold text-white/90 tracking-[-0.6px] pl-2">AI角色库</h2>
 *       <button class="size-9 … rounded-full hover:bg-white/10 text-white/40 hover:text-white/80">×18</button>
 *     </div>
 *     <div class="flex flex-1 min-h-0 gap-4 px-4 pb-4">
 *       <div class="w-[190px] shrink-0 overflow-y-auto py-3 pr-3 border-r border-white/[0.06]">
 *         <div class="flex flex-col gap-1">
 *           <div role="button" class="… min-h-9 rounded-lg px-2 bg-white/[0.06]"><span class="…15/600 text-white/92">全部角色</span></div>
 *           <div class="h-2.5"></div>                       ← 「全部角色」后 10px 空档
 *           <div><div role="button" class="… min-h-9 rounded-lg px-2 hover:bg-white/[0.04]">
 *                  <span class="…15/500 text-white/62">古代历史</span>
 *                  <button class="size-4 rounded-[4px] text-white/30 hover:text-white/72">chevron-right 12×12</button>
 *           </div></div>  …
 *         </div>
 *       </div>
 *       <div class="flex-1 flex flex-col min-w-0 overflow-hidden">
 *         <div class="flex flex-col gap-2.5 py-2 shrink-0">
 *           <div class="flex items-center flex-wrap text-sm"><span class="flex items-center">
 *             <button class="text-white/80 font-medium cursor-default">全部角色</button></span></div>
 *           <div class="flex items-center gap-2 flex-wrap">
 *             <button class="flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-lg border text-[13px] font-medium
 *                            border-white/[0.08] text-white/60 hover:bg-white/[0.06]">＋13 <span>性别</span></button> …
 *           </div>
 *         </div>
 *         <div class="flex-1 overflow-y-auto pl-4 pr-1.5 py-4">
 *           <div class="grid gap-3" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
 *             <div class="flex flex-col rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.06]">
 *               <div class="relative aspect-[3/4] bg-white/[0.04] overflow-hidden"><img class="w-full h-full object-cover"></div>
 *               <div class="flex flex-col gap-1 px-2.5 py-2">
 *                 <span class="text-sm font-medium text-white/90 leading-snug line-clamp-2">诸侯国君</span>
 *                 <p class="text-xs text-white/50 truncate leading-snug">男 · 中年 · 壮硕 · 威严</p>
 *               </div>
 *             </div>
 *           </div>
 *         </div>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 * ```
 * 另外官方还有 z-[199] 全屏背板：`background: rgba(0,0,0,0.5); backdrop-filter: blur(8px)`（1444 实测）。
 *
 * 数据：`src/data/aiRoleCatalog.ts`（脚本从官方实测 dump 抽取：90 张卡片原文 + 36 项两级分类 + 9 个筛选组）。
 * ⚠️ 官方每个分类下的**卡片集合**来自官方云端接口（弹窗按分类分页拉取），本轮只采到默认「全部角色」首屏 90 张
 *    ⇒ 切换左列分类只切**选中态**，卡片仍显示这 90 张（已登记为待补项）。筛选 chip 中
 *    性别/年龄段/体格/气质 4 维可直接用卡片副标题过滤，其余 5 维官方目录无该字段 ⇒ 渲染为不可用态。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AiRoleDetailDialog from './AiRoleDetailDialog';
import { applyAiRoleCharacterToCanvas } from '../../services/assetRowActions';
import { useAppStore } from '../../store/useAppStore';
import {
  AI_ROLE_FILTERS, AI_ROLE_FILTER_VALUES, AI_ROLE_TREE,
  aiRolePageRange, aiRolePageId, loadAiRolePage, AI_ROLE_PAGE_SIZE,
  type AiRoleCharacter,
} from '../../data/aiRoleCatalog';
/** 官方 ⋯ 菜单同款下拉：`w-[200px] rounded-2xl bg-[#2F2F2F] p-2 px-1 blur[28px]`，`align=start sideOffset=4` */

export interface AiRoleLibraryDialogProps {
  onClose: () => void;
}

export function AiRoleLibraryDialog({ onClose }: AiRoleLibraryDialogProps) {
  /** 左列选中项（官方 `nav`：三级 = filter_worldview / filter_theme / filter_scene；空 = 「全部角色」） */
  const [nav, setNav] = useState<{ worldview?: string; theme?: string; scene?: string }>({});
  /** 展开的一级 / 二级（官方 `openWorldviews` / `openThemes`，默认全部折叠） */
  const [openWorldviews, setOpenWorldviews] = useState<string[]>([]);
  const [openThemes, setOpenThemes] = useState<string[]>([]);
  /** 已生效的筛选：维度 → 取值（官方是**多选**：同一维度可勾多个，勾选即应用并关闭弹窗） */
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  /** 官方 chip 弹窗（radix popover：`side=bottom align=start`、`p-1.5 min-w-[140px] max-h-[240px]
   *  bg-[#1e1e1e] border border-white/[0.09] rounded-xl`、项 `h28 r12 pad 6/10 gap10 13/400 white/.55`
   *  + `16×16 r4 复选框 border 1.5 white/.40`，勾选态 `bg-white border-white`）
   *  —— 实测 t907/t908/t909：`w140 h112~240 · r16 · bg rgb(30,30,30) · pad6` */
  const [chipPop, setChipPop] = useState<{ key: string; left: number; top: number } | null>(null);
  /** ★ 卡片详情弹窗（官方 `Nge`，图9）：记录当前在 `cards` 里的下标，支持上一个/下一个 */
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  /** 官方分页：接口 `limit=60` + 滚到底加载下一页 ⇒ MTV 用「先 60 张 + 加载更多」等价（全量 8979 张） */
  const [visibleCount, setVisibleCount] = useState(60);
  /** ★ 官方是 `offset/limit=60` **逐页取**（范围 = 三级筛选）⇒ MTV 用「数据块（官方 `filter_theme` 子类）」
   *  逐块加载：点开范围先加载到 60 张，滚动到底再拉下一块（等价官方下一页） */
  const [chars, setChars] = useState<AiRoleCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const blockIdxRef = useRef(0);
  /** 已加载的原始页（与 `chars` 同步，供异步加载循环读最新值，避开闭包旧值） */
  const charsRef = useRef<AiRoleCharacter[]>([]);
  const pageRange = useMemo(() => aiRolePageRange(nav), [nav]);
  /** 仅按**三级分类**过滤（官方这些过滤在服务端做） */
  const filterNav = useCallback((c: AiRoleCharacter) => (!nav.worldview || c.worldview === nav.worldview)
    && (!nav.theme || c.theme === nav.theme)
    && (!nav.scene || c.filterScene === nav.scene), [nav]);
  /** chip 过滤：官方是**服务端按 9 个维度过滤**（同一维度内 OR，跨维度 AND） */
  const matchesChips = useCallback((c: AiRoleCharacter) => Object.entries(filters).every(([dim, values]) => {
    if (!values.length) return true;
    const idx = (AI_ROLE_FILTERS as readonly string[]).indexOf(dim);
    const v = c.attrs?.[dim] || (idx >= 0 && idx <= 3 ? c.slots[idx] : '');
    return values.includes(v);
  }), [filters]);
  /**
   * ★ 当前视图的**唯一**判定（nav + chip）—— 分页与渲染**必须**用同一个谓词。
   *
   * 官方语义：`GET …?filter_worldview=&filter_theme=&filter_scene=&offset=&limit=60`，
   * **筛选在服务端做** ⇒ 每页 60 张 = 「匹配当前 nav + 9 维 chip 的 60 张」。
   * MTV 没有服务端，只能在本地逐页加载后自己数 ⇒ 必须按同一谓词数（旧版只看 nav，
   * 于是选了 chip 之后首屏远不足 60 张、且「加载更多」的边界也是错的 ✗）。
   */
  const matchesView = useCallback((c: AiRoleCharacter) => filterNav(c) && matchesChips(c), [filterNav, matchesChips]);

  /**
   * 按顺序加载数据页，直到「匹配当前视图的卡」达到 `target` 张（或页区间耗尽）。
   * —— 等价官方 `offset` 从 0 涨到「够 target 张」。
   */
  const loadUntil = useCallback(async (target: number): Promise<void> => {
    const acc = charsRef.current.slice();
    let matched = acc.filter(matchesView).length;
    let i = blockIdxRef.current;
    while (i <= pageRange[1] && matched < target) {
      const id = aiRolePageId(i);
      i += 1;
      if (!id) break;
      const page = await loadAiRolePage(id);
      acc.push(...page);
      matched += page.filter(matchesView).length;
    }
    blockIdxRef.current = i;
    charsRef.current = acc;
    setChars(acc);
  }, [pageRange, matchesView]);

  /* 分类 / chip 变化 ⇒ 重新从区间头开始加载（官方重新 `offset=0`） */
  useEffect(() => {
    let alive = true;
    charsRef.current = [];
    blockIdxRef.current = pageRange[0];
    /* 重置放在异步回调里：effect 同步体里直接 setState 会触发级联渲染（react-hooks 规则） */
    const run = async () => {
      setChars([]);
      setVisibleCount(AI_ROLE_PAGE_SIZE);
      setLoading(true);
      await loadUntil(AI_ROLE_PAGE_SIZE);
      if (alive) setLoading(false);
    };
    void run();
    return () => { alive = false; };
  }, [loadUntil, pageRange]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  /** 右区第一行的**层级面包屑**（官方 `wge({parts})`）：全部角色 / 一级 / 二级 / 三级 */
  const crumb = useMemo<string[]>(() => {
    const out = ['全部角色'];
    if (nav.worldview) out.push(nav.worldview);
    if (nav.theme) out.push(nav.theme);
    if (nav.scene) out.push(nav.scene);
    return out;
  }, [nav]);
  const cards = useMemo<AiRoleCharacter[]>(
    () => chars.filter(matchesView),
    [chars, matchesView],
  );
  /**
   * 官方「下一页」= `offset += 60`：把渲染上限 +60，再把数据**补齐到这一页**。
   * ⚠️ 旧版这里用 `filterNav` 数、并且有一条 `useEffect(() => setVisibleCount(60), [cards])`
   *    —— 每次加载完新页 `chars` 变了、`cards` 随之变化 ⇒ 渲染上限被打回 60，
   *    等于「新加载的页看不见」。现在渲染上限只在**筛选/分类变化**时重置（见上面的加载 effect）。
   */
  const grow = useCallback(async () => {
    const target = visibleCount + AI_ROLE_PAGE_SIZE;
    setVisibleCount(target);
    await loadUntil(target);
  }, [visibleCount, loadUntil]);

  return createPortal(
    <>
      {/* 官方 z-[199] 背板 */}
      <div className="airole-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="airole-dialog" role="dialog" aria-modal="true" aria-label="AI角色库">
        <div className="airole-panel">
          <div className="airole-header">
            <h2 className="airole-title">{'AI角色库'}</h2>
            <button type="button" className="airole-close" aria-label="关闭" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6l-12 12" /><path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="airole-body">
            {/* 左列：官方 `Ige` 的**三级分类树**（接口 `/character-library/categories` 原样）：
                全部角色 → 世界观(filter_worldview) → 子类(filter_theme) → 场景(filter_scene)
                展开容器 `ml-2 mt-1 flex flex-col gap-1.5 border-l border-white/[0.06] pl-2 py-1`
                （三级用 `border-white/[0.05] gap-1`） */}
            <div className="airole-side">
              <div className="airole-side-list">
                {/* 全部角色（选中态 = 无任何 filter） */}
                <div
                  role="button"
                  tabIndex={0}
                  className={`airole-side-item${!nav.worldview ? ' is-active' : ''}`}
                  onClick={() => { setNav({}); setOpenWorldviews([]); setOpenThemes([]); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNav({}); } }}
                >
                  <span className="airole-side-label">{'全部角色'}</span>
                </div>
                {/* 官方：全部角色与第一个分类之间 `h-2.5` */}
                <div className="airole-side-spacer" />
                {AI_ROLE_TREE.map((w) => {
                  const wv = w.filter_worldview || w.label;
                  const wOpen = openWorldviews.includes(wv);
                  const wActive = nav.worldview === wv && !nav.theme && !nav.scene;
                  const wHasKids = (w.children?.length ?? 0) > 0;
                  return (
                    <div key={wv}>
                      <div
                        role="button"
                        tabIndex={0}
                        className={`airole-side-item${wActive ? ' is-active' : ''}`}
                        onClick={() => {
                          setNav({ worldview: wv });
                          setOpenWorldviews((prev) => (prev.includes(wv) ? prev : [...prev, wv]));
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNav({ worldview: wv }); } }}
                      >
                        <span className="airole-side-label">{w.label}</span>
                        {wHasKids ? (
                          <button
                            type="button"
                            tabIndex={-1}
                            className={`airole-side-chevron${wOpen ? ' is-open' : ''}`}
                            onClick={(e) => { e.stopPropagation(); setOpenWorldviews((prev) => (prev.includes(wv) ? prev.filter((x) => x !== wv) : [...prev, wv])); }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M9 6l6 6l-6 6" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                      {wOpen && wHasKids ? (
                        <div className="airole-side-sub">
                          {(w.children || []).map((t) => {
                            const th = t.filter_theme || t.label;
                            const tOpen = openThemes.includes(th);
                            const tActive = nav.theme === th && !nav.scene;
                            const tHasKids = (t.children?.length ?? 0) > 0;
                            return (
                              <div key={th}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className={`airole-side-item airole-side-item--child${tActive ? ' is-active' : ''}`}
                                  onClick={() => {
                                    setNav({ worldview: wv, theme: th });
                                    setOpenThemes((prev) => (prev.includes(th) ? prev : [...prev, th]));
                                  }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNav({ worldview: wv, theme: th }); } }}
                                >
                                  <span className="airole-side-label">{t.label}</span>
                                  {tHasKids ? (
                                    <button
                                      type="button"
                                      tabIndex={-1}
                                      className={`airole-side-chevron${tOpen ? ' is-open' : ''}`}
                                      onClick={(e) => { e.stopPropagation(); setOpenThemes((prev) => (prev.includes(th) ? prev.filter((x) => x !== th) : [...prev, th])); }}
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 6l6 6l-6 6" />
                                      </svg>
                                    </button>
                                  ) : null}
                                </div>
                                {tOpen && tHasKids ? (
                                  <div className="airole-side-sub airole-side-sub--3">
                                    {(t.children || []).map((s) => {
                                      const sc = s.filter_scene || s.label;
                                      return (
                                        <div
                                          key={sc}
                                          role="button"
                                          tabIndex={0}
                                          className={`airole-side-item airole-side-item--child airole-side-item--child2${nav.scene === sc ? ' is-active' : ''}`}
                                          onClick={() => setNav({ worldview: wv, theme: th, scene: sc })}
                                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setNav({ worldview: wv, theme: th, scene: sc }); } }}
                                        >
                                          <span className="airole-side-label">{s.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 右区：筛选摘要 + 9 个筛选 chip + 卡片网格 */}
            <div className="airole-main">
              <div className="airole-filters">
                <div className="airole-filter-summary">
                  {crumb.map((label, i) => (
                    <span className="airole-filter-summary-item" key={`${label}-${i}`}>
                      <button type="button" className="airole-filter-summary-btn">{label}</button>
                    </span>
                  ))}
                  {Object.entries(filters).filter(([, v]) => v.length).map(([dim, values]) => (
                    <span className="airole-filter-summary-item" key={dim}>
                      <button type="button" className="airole-filter-summary-btn airole-filter-summary-btn--on" onClick={() => setFilters((prev) => ({ ...prev, [dim]: [] }))}>
                        {values.join('/')}
                      </button>
                    </span>
                  ))}
                </div>
                <div className="airole-chips">
                  {AI_ROLE_FILTERS.map((key) => {
                    const values = filters[key] ?? [];
                    const on = values.length > 0;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`airole-chip${on ? ' is-on' : ''}`}
                        onClick={(e) => {
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const below = r.bottom + 6;
                          const h = Math.min(240, 12 + (AI_ROLE_FILTER_VALUES[key]?.length ?? 0) * 36);
                          setChipPop({ key, left: r.left, top: below + h > window.innerHeight - 8 ? Math.max(8, r.top - 6 - h) : below });
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="airole-chip-icon">
                          <path d="M12 5l0 14" /><path d="M5 12l14 0" />
                        </svg>
                        {/* 官方：勾选后 chip 文案 = 维度 + 值（实测「性别男」） */}
                        <span>{on ? `${key}${values.join('/')}` : key}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div
                className="airole-scroll"
                ref={scrollRef}
                /* ★ 官方是**无限滚动**（滚到底自动取下一页 `offset+=60`）⇒ 距底 240px 内自动加载 */
                onScroll={(e) => {
                  const el = e.currentTarget;
                  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
                    void grow();
                  }
                }}
              >
                {/* 官方加载态（`Cge`）：`flex flex-1 min-h-0 items-center justify-center` + 20px spinner `text-white/40` */}
                {loading ? (
                  <div className="airole-loading">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" className="airole-spinner">
                      <path d="M12 3a9 9 0 1 0 9 9" />
                    </svg>
                  </div>
                ) : (
                <>
                <div className="airole-grid">
                  {cards.slice(0, visibleCount).map((c, ci) => (
                    <div
                      className="airole-card"
                      key={`${c.name}-${c.img}`}
                      role="button"
                      tabIndex={0}
                      /* ★ 官方卡片 `Ege`：整卡可点 → `onClick: () => n(e)` 打开详情弹窗 */
                      onClick={() => setDetailIndex(ci)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailIndex(ci); } }}
                    >
                      <div className="airole-card-thumb">
                        {/* 官方 `Ege`：无图时占位 `◼`（`w-full h-full flex items-center justify-center
                            text-4xl text-white/[0.07] select-none`），有图 `w-full h-full object-cover` */}
                        {c.img ? (
                          <img src={c.img} alt={c.name} loading="lazy" />
                        ) : (
                          <div className="airole-card-thumb-empty">{'◼'}</div>
                        )}
                      </div>
                      <div className="airole-card-info">
                        <span className="airole-card-name">{c.name}</span>
                        <p className="airole-card-meta">{c.meta}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {/* ★ 官方是「60/页 + 无限滚动」（接口 `limit=60`，滚到底再取下一页）；
                    MTV 一次性渲染全部会卡（全量 8979 张）⇒ 同款语义：先 60 张，底部「加载更多」按钮 */}
                {cards.length === 0 ? (
                  <div className="airole-empty">{'未找到符合条件的角色'}</div>
                ) : visibleCount < cards.length ? (
                  <div className="airole-more">
                    <button type="button" className="airole-more-btn" onClick={() => { void grow(); }}>
                      {'加载更多'}
                    </button>
                  </div>
                ) : null}
                </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {chipPop ? (
        <>
          <div className="airole-pop-mask" onClick={() => setChipPop(null)} aria-hidden="true" />
          <div className="airole-pop" role="dialog" style={{ left: chipPop.left, top: chipPop.top }}>
            <div className="airole-pop-list">
              {(AI_ROLE_FILTER_VALUES[chipPop.key] ?? []).map((opt) => {
                const checked = (filters[chipPop.key] ?? []).includes(opt);
                return (
                  <label key={opt} className={`airole-pop-item${checked ? ' is-checked' : ''}`}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      className="airole-pop-box"
                      onClick={(e) => {
                        e.preventDefault();
                        /* 官方实测 t908：勾选**立即应用并关闭弹窗**；同一维度可多选（再次打开继续勾） */
                        setFilters((prev) => {
                          const cur = prev[chipPop.key] ?? [];
                          const next = cur.includes(opt) ? cur.filter((v) => v !== opt) : [...cur, opt];
                          return { ...prev, [chipPop.key]: next };
                        });
                        setChipPop(null);
                      }}
                    >
                      {checked ? (
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5l9 -9" />
                        </svg>
                      ) : null}
                    </button>
                    <span className="airole-pop-label">{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
      {/* ★ 卡片详情弹窗（官方 `Nge`：z-[210] 盖在角色库 z-200 之上；上一个/下一个在**当前筛选结果**内移动） */}
      {detailIndex !== null && cards[detailIndex] ? (
        <AiRoleDetailDialog
          character={cards[detailIndex]}
          onClose={() => setDetailIndex(null)}
          hasPrev={detailIndex > 0}
          hasNext={detailIndex < cards.length - 1}
          onPrev={() => setDetailIndex((i) => (i === null ? i : Math.max(0, i - 1)))}
          onNext={() => setDetailIndex((i) => (i === null ? i : Math.min(cards.length - 1, i + 1)))}
          /* 官方 `onAddToCanvas`：画布上新增**该角色的 4 张图**（3 张 3:4 + 1 张三视图），
             并**关闭详情弹窗与角色库面板**（用户实测反馈：MTV 原来不关、且画布显示不对） */
          onAddToCanvas={(ch) => {
            const ok = applyAiRoleCharacterToCanvas(ch);
            /* 官方 `onAddToCanvas` 结尾：`xe.success(d("assets.addSuccess"))` ⇒ 「资产添加成功」 */
            if (ok) useAppStore.getState().showToast('资产添加成功', 'success');
            setDetailIndex(null);
            onClose();
          }}
        />
      ) : null}
    </>,
    document.body,
  );
}
