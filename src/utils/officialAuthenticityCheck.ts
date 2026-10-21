/**
 * officialAuthenticityCheck —— 官方**内容校验（authenticityCheck）状态徽标**的取值与判定。
 *
 * 官方出处：`course-api-base-url-CGXqZmAy.js`@257900–259600（组件 `KP = h.memo(function({status,assetType,
 * variant="inline",size=12,presentation="default",disableTooltip=false}){…})`）逐字：
 *
 * ```js
 * if (t === bs.UNKNOWN) return null;                                  // ← 未知：**什么都不渲染**
 * if (t === bs.APPROVED) {                                            // ← 通过：标题行里的「对号」
 *   const p = o === "node-title";
 *   return u(l.jsx("span",{className:"inline-flex items-center shrink-0",
 *     children: p ? l.jsx(uR,{size:r,className:"text-foreground/70"})   // uR = tabler CircleCheck
 *                 : l.jsx(i_,{size:d,className:"text-primary"}) }),
 *     a("authenticityCheck.tooltip.approved"));
 * }
 * if (V3(t)) … statusText.pending（`text-[rgba(255,255,255,0.4)]`）/ tooltip.pending …      // PENDING / PROCESSING
 * if (t === bs.REJECTED || t === bs.REJECTED_INVALID) {                // ← 驳回
 *   const p = t === bs.REJECTED_INVALID;
 *   … 标题行：l.jsx(a_,{size:r,className:"text-tap-stateWarning/60"})（非 invalid 时）
 *     行内：  <span className="text-[#D36A6A]">{statusText.invalidParameter|rejected}</span>
 * }
 * ```
 *
 * ★★ 结论（用户问：「卡片名称后的对号在什么情况下出现」）：
 *    **对号 = 该卡片的文件通过了服务端内容校验（`bs.APPROVED`）**，
 *    而**不是**「这张卡是不是从素材库来的」—— MTV 旧实现按「有本地图 + 非参考卡」判定（见
 *    `ImageNode.tsx` 旧 `showCheck`），语义与官方**不一致**。
 *
 * 官方的状态来源（@257900 附近）：一个按 **file id** 缓存的 review-status store，
 * `xi(o => r ? o.statuses[r] ?? bs.UNKNOWN : bs.UNKNOWN)`（@422711 `E$` / `Qlt`），
 * 由 `$me(files)` → `Wme(files)` 拉取「审核状态」写进 `setStatuses`（@330895）。
 * 枚举取值（`bs`）：`UNKNOWN | APPROVED | REJECTED | REJECTED_INVALID | PENDING | PROCESSING`。
 *
 * ⚠️ MTV 现状：**没有**这条审核状态接口/store（全仓无 `compliance`/`review_status` 消费点）
 *    ⇒ 按官方 `UNKNOWN` 语义，对号**不渲染**。这里保留官方口径的读取入口：
 *    一旦节点数据上出现 `authenticityStatus`（或官方字段名 `complianceStatus`），
 *    就会按官方分支自动点亮，不需要再改组件。
 */

/** 官方 `bs`（审核状态枚举）的 MTV 侧同名字面量 */
export type AuthenticityStatus =
  | 'unknown'
  | 'approved'
  | 'pending'
  | 'processing'
  | 'rejected'
  | 'rejected_invalid';

/**
 * 把后端可能给出的状态值归一成官方 `bs` 语义。
 * 官方字段名是 `compliance_status`（`Jfe`@259680 `complianceStatus: t.compliance_status`），
 * 数值口径见 `B_`@245481：`0 = UNSPECIFIED`、`1 = APPROVED`、`2 = REJECTED`。
 */
/**
 * 官方 `S$`（`vendor-packages-jvPqKqU8.js`@173898，**逐字**）：
 * ```js
 * function gle(e){return e==="pending"||e==="processing"}
 * ```
 * 画布 chunk 顶部 `import{…,ad as S$}from"./vendor-packages-jvPqKqU8.js"` ⇒ `S$` = `ad` = `gle`。
 * ⚠️ 它**同时**覆盖 `PENDING` 与 `PROCESSING`（官方 `Ob` 的「进行中」分支用它，不是单判 pending）。
 */
export function isAuthenticityInProgress(status: AuthenticityStatus): boolean {
  return status === 'pending' || status === 'processing';
}

export function authenticityStatusOf(value: unknown): AuthenticityStatus {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value === 1) return 'approved';
    if (value === 2) return 'rejected';
    return 'unknown';
  }
  if (typeof value !== 'string') return 'unknown';
  switch (value.trim().toLowerCase()) {
    case 'approved':
    case 'compliance_status_approved':
      return 'approved';
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'rejected':
    case 'compliance_status_rejected':
      return 'rejected';
    case 'rejected_invalid':
    case 'rejected-invalid':
    case 'invalid':
      return 'rejected_invalid';
    default:
      return 'unknown';
  }
}
