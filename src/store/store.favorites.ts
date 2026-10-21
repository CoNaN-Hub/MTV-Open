/**
 * store.favorites —— 官方「媒体收藏」store `nc` 的 MTV 移植
 * （`zoom-slider-3ZcFvYQO.js` @21670，逐字见下）。
 *
 * 官方 `nc`（`Ln` = zustand `create`）逐字：
 * ```js
 * const nc = Ln((e, t) => ({
 *   statuses: {}, favoriteMutationSeq: 0, lastFavoriteMutation: void 0,
 *   setStatuses: n => { const { statuses: s } = t(); let r = null;
 *     for (const [o, i] of Object.entries(n)) s[o] !== i && (r || (r = { ...s }), r[o] = i);
 *     r && e({ statuses: r }) },
 *   getStatus: n => t().statuses[n] ?? !1,
 *   toggleStatus: n => { const { statuses: s } = t(); e({ statuses: { ...s, [n]: !s[n] } }) },
 *   emitFavoriteMutation: n => { e(s => ({ favoriteMutationSeq: s.favoriteMutationSeq + 1,
 *     lastFavoriteMutation: { ...n, at: n.at ?? Date.now() } })) },
 * }))
 * ```
 * 官方写入器 `L_(sourceFileId, asset)` @432268 逐字：
 * ```js
 * function L_(e, t) {
 *   if (!e) return;
 *   const n = typeof t == "string" ? O_({ sourceUrl: t }) : t,
 *         s = nc.getState(), r = s.statuses[e] ?? !1;
 *   s.toggleStatus(e);                                   // ① 乐观切换
 *   try {
 *     const o = r ? await GU(e) : await nie(e, n);       // ② 服务端写入
 *     s.setStatuses({ [e]: o.is_favorited });            // ③ 以服务端返回为准
 *     s.emitFavoriteMutation({ sourceFileId: e, isFavorited: o.is_favorited,
 *                              assetId: o.asset_id, folderId: o.folder_id });
 *   } catch { s.setStatuses({ [e]: r }) }                // ④ 失败回滚
 * }
 * ```
 *
 * ★★ 持久化（MTV 侧，**不新建机制**）：与官方 Pin 的组名同一套路
 *    —— 落进 `AppConfig.favoriteSourceFileIds`（`types/index.ts` 的 `AppConfig:639` 旁），
 *    经 `updateConfig(...)` 改内存 + `void saveConfig({ silent:true })` 显式落盘，失败原样回滚
 *    （仓库既有同款写法：`hooks/useCanvasPinGroups.ts:46-60`）。
 *
 * ⚠️ MTV 偏离（逐条）：
 *  1. **没有服务端**：官方 `nie`/`GU`（收藏写入接口）MTV 不存在 ⇒ 第 ② 步换成「写本地配置」，
 *     第 ③ 步的「以服务端返回为准」换成「以落盘结果为准」（`saveConfig` 成功即等价）。
 *     `asset` 形参因此**只保留签名**（官方把它 POST 给服务端；MTV 无处可送）。
 *  2. **没有预取/埋点**：官方 `B_(ids,"gallery_open"|"viewer_open")` 按打开时机批量拉收藏态
 *     （`Wbe` 节流 + `$be` 乐观跳过）并上报；MTV 无服务端也无可上报端点 ⇒ 该函数无接收方，
 *     **不建**（两个消费点 `oQe`/`Qge` 里的调用点照官方保留为记账注释）。
 *  3. `favoriteMutationSeq` / `lastFavoriteMutation`（官方给远端同步用的变更广播）MTV 无订阅者
 *     ⇒ 不建；官方 `toggleStatus` 的语义已由 `toggleFavorite` 内联（官方也是先 `toggleStatus` 再写）。
 */
import type { StateCreator } from 'zustand';
import type { AppState } from './useAppStore';
import type { FavoriteAsset } from '../utils/officialFavorites';

export interface FavoritesSlice {
  /**
   * 官方 `nc.statuses`：`{ [sourceFileId]: boolean }`。
   * 渲染真值 = `favoriteStatuses[id] ?? config.favoriteSourceFileIds?.[id]`（见 `hooks/useFavoriteStatus.ts`）——
   * 前者是**乐观覆盖层**（点击瞬间），后者是持久层，两者在落盘成功后一致。
   */
  favoriteStatuses: Record<string, boolean>;
  /** 官方 `nc.setStatuses(patch)`：逐键比较、值没变就不产生新对象（避免无意义重渲染） */
  setFavoriteStatuses: (patch: Record<string, boolean>) => void;
  /**
   * 官方 `L_(sourceFileId, asset)` @432268 —— 乐观切换 + 落盘 + 失败回滚。
   * 返回 `Promise<void>`：官方 `oQe`/`Qge` 都在 `try/finally` 里等它（`aria-busy` 期间）。
   */
  toggleFavorite: (sourceFileId: string, asset: FavoriteAsset) => Promise<void>;
}

export const createFavoritesSlice: StateCreator<AppState, [], [], FavoritesSlice> = (set, get) => ({
  favoriteStatuses: {},

  /** 官方 `setStatuses`：只有真正变化的键才写新对象 */
  setFavoriteStatuses: (patch) => {
    const current = get().favoriteStatuses;
    let next: Record<string, boolean> | null = null;
    for (const [id, value] of Object.entries(patch)) {
      if (current[id] !== value) {
        next ??= { ...current };
        next[id] = value;
      }
    }
    if (next) set({ favoriteStatuses: next });
  },

  /**
   * 官方 `L_(e, t)`。`_asset` 只服务官方签名（见文件头 ⚠️①）。
   * 读初值用**渲染真值**（乐观层 → 持久层），与官方 `s.statuses[e] ?? !1` 的「未拉到视为未收藏」一致。
   */
  toggleFavorite: async (sourceFileId, _asset) => {
    if (!sourceFileId) return;
    const before = get().favoriteStatuses[sourceFileId]
      ?? get().config.favoriteSourceFileIds?.[sourceFileId]
      ?? false;
    const next = !before;
    /** ① 乐观切换（官方 `s.toggleStatus(e)`） */
    set({ favoriteStatuses: { ...get().favoriteStatuses, [sourceFileId]: next } });
    const persistedBefore = { ...(get().config.favoriteSourceFileIds ?? {}) };
    /** ② 写（官方走服务端；MTV = 显式落盘）—— 直接写**持久层**，不再写第二份真值 */
    get().updateConfig({ favoriteSourceFileIds: { ...persistedBefore, [sourceFileId]: next } });
    try {
      await get().saveConfig({ silent: true });
    } catch {
      /** ④ 失败回滚（官方 `s.setStatuses({ [e]: r })`） */
      get().setFavoriteStatuses({ [sourceFileId]: before });
      get().updateConfig({ favoriteSourceFileIds: persistedBefore });
    }
  },
});
