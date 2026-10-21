/**
 * PileFavoriteButton —— 官方**预览卡片上的「收藏」按钮** `oQe` @2941561 的逐字移植
 * （`zoom-slider-3ZcFvYQO.js`）。
 *
 * 官方逐字：
 * ```js
 * const rQe = [];                                          // @2941548 —— nodeToFiles 的缺省空列表
 * function oQe({ node: e }) {
 *   const { t } = Fe(), [n, s] = useState(!1),
 *         r = Qd(f => f.nodeToFiles[e.id] ?? rQe),         // 节点 → 已登记文件 id
 *         o = useMemo(() => g8(e, r), [e, r]),             // 解析资产身份（g8 @582802）
 *         i = nc(f => { if (o) return f.statuses[o.sourceFileId] }),   // 收藏态（undefined = 未拉到）
 *         a = i !== void 0, c = i === true;                // 已拉到？ / 已收藏？
 *   let d = t("common.loading"); a && (d = t(c ? "common.unfavorite" : "common.favorite"));
 *   useEffect(() => { o && B_([o.sourceFileId], "gallery_open") }, [o]);      // 预取/埋点
 *   const u = useCallback(async () => {
 *     if (!(!o || !a || n)) { s(!0); try { await L_(o.sourceFileId, o.asset) } finally { s(!1) } }
 *   }, [a, n, o]);
 *   if (!o) return null;                                   // ← 解析不到资产 ⇒ 整个按钮不渲染
 *   let p = l.jsx(Wo, { size: 16, className: "animate-spin motion-reduce:animate-none" });
 *   a && (p = c ? l.jsx(rh, { size: 16, className: "text-[#FBBC05]" }) : l.jsx(Rg, { size: 16 }));
 *   return l.jsx(hJ, { "aria-label": d, "aria-pressed": a ? c : void 0,
 *                      "aria-busy": !a || n, disabled: !a || n,
 *                      onClick: () => { u() }, children: p })
 * }
 * ```
 * 渲染位置由官方 `pJ` @2932627（= `PILE_RENDER_CLASSES.previewActions`）提供 ——
 * `absolute left-3 top-3 z-30`，默认 `opacity-0`、`group-hover/display-node` 才显形。
 * 按钮本体 = 官方 `hJ` @2932227（= `PILE_RENDER_CLASSES.previewActionButton`）。
 *
 * ⚠️ MTV 偏离（逐条）：
 *  1. 形参 `{node}` → `{node, mediaSrc}`：官方 `g8` 用 `Qd.nodeToFiles[e.id]` 反查已登记文件，
 *     再 `Xs(URL)` 兜底；MTV 没有 `nodeToFiles` 索引（见 `utils/officialFavorites.ts` 文件头）
 *     ⇒ 由调用方把已经算好的媒体地址传进来（画廊里就是 `display.content.displaySrc/playbackSrc`）。
 *  2. `B_([sourceFileId],"gallery_open")`（官方按打开时机批量预取收藏态 + 埋点）MTV 无服务端
 *     ⇒ **调用点在下方保留为注释**，不建空函数（见 `store/store.favorites.ts` ⚠️②）。
 *  3. `disabled` 在 MTV 下恒等于 `busy`（`a` 恒真，原因见 `hooks/useFavoriteStatus.ts`），
 *     官方那支「收藏态未拉到 ⇒ 永久 spinner」的路径在 MTV 下只由 `sourceFileId` 为空触发，
 *     而那种情况已经被 `if (!o) return null` 挡在前面 —— 与官方渲染结果一致。
 */
import { useCallback, useMemo, useState } from 'react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { useFavoriteStatus } from '../../hooks/useFavoriteStatus';
import { favoriteTargetOf, type FavoriteNodeLike } from '../../utils/officialFavorites';
import { PILE_RENDER_CLASSES } from '../../utils/officialPile';
import { OfficialIcon } from '../sidebar/OfficialIcon';
import { OfficialStarFilledIcon, OfficialStarIcon } from './shared/officialFavoriteIcons';

export interface PileFavoriteButtonProps {
  /** 官方 `oQe({node})` 的 `node`（MTV 只需 `id` / `type` / `data` 三个字段） */
  node: FavoriteNodeLike;
  /**
   * ⚠️ MTV 偏离①：官方 `g8` 从 `Qd.nodeToFiles[node.id]` + `Xs(url)` 自己解析媒体地址；
   * MTV 没有该索引 ⇒ 调用方把已算好的媒体地址传进来（画廊成员就是预览用的那个 src）。
   */
  mediaSrc?: string;
}

export default function PileFavoriteButton({ node, mediaSrc }: PileFavoriteButtonProps) {
  const t = useT();
  /** 官方 `[n,s] = useState(!1)` —— 本次点击的 in-flight 忙态 */
  const [busy, setBusy] = useState(false);
  /** 官方 `o = useMemo(()=>g8(e,r),[e,r])` */
  const target = useMemo(() => favoriteTargetOf(node, mediaSrc), [node, mediaSrc]);
  const sourceFileId = target?.sourceFileId;
  /** 官方 `i = nc(f => { if(o) return f.statuses[o.sourceFileId] })` */
  const status = useFavoriteStatus(sourceFileId);
  /** 官方 `a = i !== void 0` / `c = i === true` */
  const statusLoaded = status !== undefined;
  const favorited = status === true;
  const toggleFavorite = useAppStore((state) => state.toggleFavorite);

  /** 官方 `let d = t("common.loading"); a && (d = t(c ? "common.unfavorite" : "common.favorite"))` */
  const label = statusLoaded ? t(favorited ? '取消收藏' : '收藏') : t('加载中...');

  /* 官方 `useEffect(()=>{ o && B_([o.sourceFileId],"gallery_open") },[o])`
     ⚠️ MTV 偏离②：`B_`（按 gallery_open 时机批量拉收藏态 + 埋点）无接收方 —— 见文件头。 */

  /** 官方 `u` */
  const handleClick = useCallback(async () => {
    if (!target || !statusLoaded || busy) return;
    setBusy(true);
    try {
      await toggleFavorite(target.sourceFileId, target.asset);
    } finally {
      setBusy(false);
    }
  }, [busy, statusLoaded, target, toggleFavorite]);

  /** 官方 `if(!o) return null` */
  if (!target) return null;

  return (
    <button
      type="button"
      aria-label={label}
      /* 官方 `aria-pressed: a ? c : void 0` —— React 的 `aria-pressed={undefined}` 与官方 `void 0` 一致 */
      aria-pressed={statusLoaded ? favorited : undefined}
      aria-busy={!statusLoaded || busy}
      disabled={!statusLoaded || busy}
      onClick={() => { void handleClick(); }}
      className={PILE_RENDER_CLASSES.previewActionButton}
    >
      {/* 官方 `p`：busy/未拉到 ⇒ `Wo`(loader-2)；已收藏 ⇒ `rh`(star-filled, #FBBC05)；否则 `Rg`(star) */}
      {!statusLoaded || busy ? (
        <OfficialIcon name="actions-spinner" size={16} className="animate-spin motion-reduce:animate-none" />
      ) : favorited ? (
        <OfficialStarFilledIcon size={16} className="text-[#FBBC05]" />
      ) : (
        <OfficialStarIcon size={16} />
      )}
    </button>
  );
}
