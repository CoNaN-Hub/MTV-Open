/**
 * useFavoriteStatus —— 官方收藏态读取端 `nc(f => f.statuses[sourceFileId])` @21670 的 MTV 版。
 *
 * 官方两个消费点读的都是「**可能为 `undefined`** 的布尔」：
 *   · `oQe` @2941561（卡片收藏按钮）：`i = nc(f => { if(o) return f.statuses[o.sourceFileId] })`，
 *     再 `a = i !== void 0`（收藏态已拉到？）/ `c = i === true`（已收藏？）
 *   · `Qge` @436698（查看器底条）：`b = nc(G => g ? G.statuses[g.sourceFileId] : void 0)`
 * ⚠️ MTV 偏离：官方 `undefined` = **服务端还没回**（此时按钮 spinner + disabled）；
 *    MTV 无服务端，`config.favoriteSourceFileIds` 就是真值 ⇒ 未命中回落 `false`，
 *    因此 `undefined` 只在 `sourceFileId` 为空时出现（调用方本来就该像官方那样提前 `return null`）。
 */
import { useAppStore } from '../store/useAppStore';

export function useFavoriteStatus(sourceFileId: string | undefined): boolean | undefined {
  return useAppStore((state) =>
    sourceFileId
      ? /* 官方 `nc.getStatus(n) = t().statuses[n] ?? !1` —— 没有记录就是「未收藏」（不是「未知」） */
        state.favoriteStatuses[sourceFileId]
        ?? state.config.favoriteSourceFileIds?.[sourceFileId]
        ?? false
      : undefined,
  );
}
