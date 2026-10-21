/**
 * `DesktopConfirmationCard` —— 官方 `$Qe`（`vendor-pkg-canvas-ChpWx5JY.js` **@2162950**，
 * `$Qe=({content:e,onAnswer:t})=>{...}`）的**逐字**复刻。
 *
 * 官方原文（逐字，`_rawat.mjs` 原始窗口 + `_hits.mjs` 读出）：
 * ```js
 * $Qe=({content:e,onAnswer:t})=>{
 *   const{t:n}=se(),[o,r]=a.useState(!1),i=a.useRef(void 0),l=a.useRef(null),c=a.useRef(null),
 *         d=a.useMemo(()=>e.request??e.result??{},[e.request,e.result]),
 *         u=String(d.confirmation_id??""),p=String(d.confirmation_kind??""),
 *         {desktopCapability:m,desktopPermissionPolicy:f,openSettingsModal:h,
 *          runAgentClientAction:g,runAgentDesktopAction:x}=Pn(),
 *         y=qe(hs),b=u?Ff(e,u,y):"pending",_=y.pendingConfirmation,
 *         v=a.useMemo(()=>Boe(d),[d]),
 *         w=a.useMemo(()=>{...localDirectoryGrants 显示名...},[...]),
 *         C=!!u&&!!p&&b==="pending"&&_?.confirmationId===u&&_.status==="pending"&&(!_.kind||_.kind===p),
 *         S=!p||!f||f.isKindEnabled(p),N=VQe.has(p),{getDownloadFileItems:T}=qp({showTransferPanel:!0});
 *   a.useEffect(()=>{!u||l.current===u||(l.current=u,i.current=LQe(u))},[u]);
 *   const E=..., k=..., I=...;
 *   if(a.useEffect(...auto confirm...),!u||!p||Of(e,u,y))return null;
 *   const M=C&&!o&&S;
 *   return s.jsxs("div",{"data-testid":"desktop-confirmation-card", ...})
 * }
 * ```
 *
 * ── ⚠️ 本轮**未接线**的三处外部依赖（全部用 props 注入；官方从全局拿，MTV 没有）────────
 *   1. **Tapflow 上下文** `Pn()` @178441 → {@link DesktopConfirmationCardBridge}。
 *      官方 context 默认值（@177889）逐字：
 *      ``c0e={available:!1,reason:"not-desktop",message:""}``
 *      `desktopPermissionPolicy` 官方默认 `undefined` ⇒ `S = !p||!f||...` = `true`。
 *      `openSettingsModal` 官方默认 `()=>{}`。
 *      ⚠️ MTV **无生产者**：`agent-host-provider-qxBBhMjS.js` 的 Provider 在 MTV 不存在
 *      ⇒ `runAgentClientAction` / `runAgentDesktopAction` 默认 `undefined`，此时按官方
 *      「runner 不可用」分支产出一条**失败 answer**（官方逐字文案），不伪造成功。
 *   2. **store `hs`**（`pendingConfirmation` / `resolvedConfirmations` / `localDirectoryGrants`）
 *      → {@link DesktopConfirmationCardBridge.store}。未注入时 `C=false`（按钮均禁用），
 *      与官方「store 里没有这张 pending 卡」的语义一致。
 *   3. `qp({showTransferPanel:!0}).getDownloadFileItems` 与 `VT`（nodeRef → file item）
 *      → {@link DesktopConfirmationCardBridge.getDownloadFileItems} / `nodeRefToFileItem`。
 *
 * ── 本卡不含任何图标（§3.7 + 本轮 `_rawat` 复核：JSX 里只有 div/span/button/文本）──────
 *
 * 验证分级：**(b) jsdom**（`tests/components/desktopConnectorMcpCardsDom.test.tsx`）
 * + 纯函数 **(d) 源码级**（`tests/services/chat/desktopConfirmationCard.test.ts`）。
 * **没有**做 (a) live 画布实测（live 画布已有会话、本卡不在 DOM 里，且不许点用户 live 画布）。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToolEventContent } from '../../services/chat/agentContents';
import {
  buildDesktopAnswerPayload,
  canInteractWithDesktopConfirmation,
  DESKTOP_CLIENT_ACTION_KINDS,
  desktopConfirmationEnvelope,
  desktopConfirmationId,
  desktopConfirmationKind,
  desktopConfirmationPolicyAllows,
  desktopConfirmationSummary,
  desktopConfirmationTitleDefault,
  dedupeTrimmedStrings,
  expandDesktopRequestJson,
  isDesktopConfirmationInFlight,
  readDesktopConfirmationResultCache,
  resolveDesktopConfirmationStatus,
  writeDesktopConfirmationResultCache,
  type OfficialConfirmationStoreSlice,
} from '../../services/chat/desktopConfirmationCard';
import { useDesktopConnectorMcpText } from '../../services/chat/desktopConnectorMcpStrings';
import { z } from './officialClassNames';

/**
 * 官方 `Qs.DESKTOP_PERMISSIONS`（§3.8，逐字）：
 * `Qs` = `vendor-packages-jvPqKqU8.js` 的 `s2` @597316
 * ``{GENERAL:"general",...,DESKTOP_PERMISSIONS:"desktop_permissions",...}``。
 */
export const DESKTOP_PERMISSIONS_SETTINGS_SECTION = 'desktop_permissions';

/** 官方 `c0e` @177889：Tapflow context 的 `desktopCapability` 默认值。 */
export interface DesktopCapability {
  available: boolean;
  reason?: string;
  message?: string;
}

/** 官方 `v` @15511（Provider 侧 `useMemo` 产物）的**读侧形状**。 */
export interface DesktopPermissionPolicy {
  autoConfirm?: boolean;
  isKindEnabled?: (kind: string) => boolean;
  shouldAutoConfirm?: (kind: string, payload: unknown) => boolean;
}

/** 官方 `qe(hs)` 的 store 切片（在 {@link OfficialConfirmationStoreSlice} 之上补已授权目录）。 */
export interface DesktopConfirmationStoreSlice extends OfficialConfirmationStoreSlice {
  localDirectoryGrants?: { grantId: string; displayName?: string | null }[];
}

/**
 * 官方 `Pn()` @178441 返回的 Tapflow 上下文中，`$Qe` 真正读的 5 个字段
 * + store 切片 + 下载项两个回调。
 */
export interface DesktopConfirmationCardBridge {
  desktopCapability?: DesktopCapability;
  desktopPermissionPolicy?: DesktopPermissionPolicy | null;
  openSettingsModal?: (section: string) => void;
  /** 官方 `runAgentClientAction(kind, payload, extra)`；`batch_download_files` 走它。 */
  runAgentClientAction?: (
    kind: string,
    payload: Record<string, unknown>,
    extra?: unknown,
  ) => Promise<unknown>;
  /** 官方 `runAgentDesktopAction(kind, payload)`。 */
  runAgentDesktopAction?: (kind: string, payload: Record<string, unknown>) => Promise<unknown>;
  /** 官方 `qe.getState().addLocalDirectoryGrant`。 */
  addLocalDirectoryGrant?: (grant: { grantId: string; displayName: string }) => void;
  /** 官方 `qp({showTransferPanel:!0}).getDownloadFileItems`。 */
  getDownloadFileItems?: (items: unknown[]) => unknown;
  /** 官方 `VT`：nodeRef → 下载项。 */
  nodeRefToFileItem?: (nodeRef: string) => unknown;
  store?: DesktopConfirmationStoreSlice | null;
}

/** 官方 `Ln`/`Lj` 的位置（`Lj` 在 215… 偏移 25458 邻域，未解析）→ 用「有值就用」的等价策略。 */
function directoryGrantDisplayName(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export interface DesktopConfirmationCardProps {
  content: ToolEventContent;
  /** 官方 `onAnswer(confirmationId, action, payload?, reason?)`。 */
  onAnswer: (
    confirmationId: string,
    action: 'confirm' | 'reject',
    payload?: unknown,
    reason?: string,
  ) => void;
  bridge?: DesktopConfirmationCardBridge;
}

const DesktopConfirmationCard = memo(function DesktopConfirmationCard({
  content,
  onAnswer,
  bridge,
}: DesktopConfirmationCardProps) {
  const t = useDesktopConnectorMcpText();
  const [isWorking, setIsWorking] = useState(false);
  /** 官方 `i=a.useRef(void 0)`：缓存的 result（`LQe` 结果 / 本次运行结果）。 */
  const cachedResultRef = useRef<unknown>(undefined);
  /** 官方 `l=a.useRef(null)`：last confirmation id（读缓存的一次性守卫）。 */
  const cacheGuardRef = useRef<string | null>(null);
  /** 官方 `c=a.useRef(null)`：auto-confirm 一次性守卫。 */
  const autoConfirmGuardRef = useRef<string | null>(null);

  const envelope = useMemo(
    () => desktopConfirmationEnvelope(content),
    [content],
  );
  const confirmationId = desktopConfirmationId(envelope);
  const kind = desktopConfirmationKind(envelope);

  const desktopCapability: DesktopCapability = bridge?.desktopCapability ?? {
    available: false,
    reason: 'not-desktop',
    message: '',
  };
  const policy = bridge?.desktopPermissionPolicy ?? null;
  const openSettingsModal = bridge?.openSettingsModal;
  const runAgentClientAction = bridge?.runAgentClientAction;
  const runAgentDesktopAction = bridge?.runAgentDesktopAction;
  const store = bridge?.store ?? null;

  const cardStatus = confirmationId
    ? resolveDesktopConfirmationStatus(content, confirmationId, store)
    : 'pending';

  const requestPayload = useMemo(() => expandDesktopRequestJson(envelope), [envelope]);

  const authorizedFolder = useMemo(() => {
    const grantId =
      typeof requestPayload.directory_grant_id === 'string'
        ? requestPayload.directory_grant_id.trim()
        : '';
    if (!grantId) return undefined;
    return store?.localDirectoryGrants?.find((grant) => grant.grantId === grantId)?.displayName;
  }, [store?.localDirectoryGrants, requestPayload.directory_grant_id]);

  const canInteract = canInteractWithDesktopConfirmation(
    confirmationId,
    kind,
    cardStatus,
    store,
  );
  const policyAllows = desktopConfirmationPolicyAllows(kind, policy);
  const isClientAction = kind !== '' && DESKTOP_CLIENT_ACTION_KINDS.has(kind);

  /** 官方 `a.useEffect(()=>{!u||l.current===u||(l.current=u,i.current=LQe(u))},[u])`。 */
  useEffect(() => {
    if (!confirmationId || cacheGuardRef.current === confirmationId) return;
    cacheGuardRef.current = confirmationId;
    cachedResultRef.current = readDesktopConfirmationResultCache(confirmationId);
  }, [confirmationId]);

  /** 官方 `E` @2163xxx（逐字）。 */
  const buildRunnerExtra = useCallback(() => {
    if (kind !== 'batch_download_files') return undefined;
    const nodeRefs = dedupeTrimmedStrings(requestPayload.node_refs).map((nodeRef) =>
      bridge?.nodeRefToFileItem ? bridge.nodeRefToFileItem(nodeRef) : nodeRef,
    );
    if (nodeRefs.length === 0) return undefined;
    return { nodeFileItems: bridge?.getDownloadFileItems?.(nodeRefs) };
  }, [kind, requestPayload, bridge]);

  /** 官方 `k` @2163xxx（逐字确认流程）。 */
  const confirm = useCallback(async () => {
    if (!(canInteract && !isWorking && confirmationId && kind)) return;
    if (!policyAllows) {
      onAnswer(confirmationId, 'reject', undefined, 'desktop capability disabled in settings');
      return;
    }
    if (isClientAction && !runAgentClientAction) {
      onAnswer(
        confirmationId,
        'confirm',
        buildDesktopAnswerPayload(kind, {
          ok: false,
          error: 'Client action runner is unavailable in this client.',
        }),
      );
      return;
    }
    if (!isClientAction && !runAgentDesktopAction) {
      onAnswer(
        confirmationId,
        'confirm',
        buildDesktopAnswerPayload(kind, {
          ok: false,
          error: 'Desktop Host is unavailable in this client.',
        }),
      );
      return;
    }
    if (cachedResultRef.current) {
      const cached = cachedResultRef.current as Record<string, unknown>;
      const perKind = cached[kind];
      const payload =
        perKind && typeof perKind === 'object' && !Array.isArray(perKind)
          ? buildDesktopAnswerPayload(kind, perKind)
          : cached;
      onAnswer(confirmationId, 'confirm', payload);
      return;
    }
    setIsWorking(true);
    try {
      const result = isClientAction
        ? await runAgentClientAction!(kind, envelope, buildRunnerExtra())
        : await runAgentDesktopAction!(kind, envelope);
      const actionResult = result as { ok?: boolean; directory_grant_id?: unknown; display_name?: unknown };
      if (kind === 'desktop_fs' && actionResult?.ok) {
        const grantId =
          typeof actionResult.directory_grant_id === 'string'
            ? actionResult.directory_grant_id.trim()
            : '';
        if (grantId) {
          bridge?.addLocalDirectoryGrant?.({
            grantId,
            displayName: directoryGrantDisplayName(actionResult.display_name, grantId) ?? '',
          });
        }
      }
      const payload = buildDesktopAnswerPayload(kind, result);
      cachedResultRef.current = payload;
      writeDesktopConfirmationResultCache(confirmationId, payload);
      onAnswer(confirmationId, 'confirm', payload);
    } catch (error) {
      const payload = buildDesktopAnswerPayload(kind, {
        ok: false,
        error: error instanceof Error ? error.message : 'Desktop action failed.',
      });
      cachedResultRef.current = payload;
      writeDesktopConfirmationResultCache(confirmationId, payload);
      onAnswer(confirmationId, 'confirm', payload);
    } finally {
      setIsWorking(false);
    }
  }, [
    confirmationId,
    kind,
    canInteract,
    isWorking,
    isClientAction,
    policyAllows,
    buildRunnerExtra,
    onAnswer,
    envelope,
    runAgentClientAction,
    runAgentDesktopAction,
    bridge,
  ]);

  /** 官方 `I`（逐字）。 */
  const reject = useCallback(() => {
    if (!canInteract || !onAnswer || isWorking || !confirmationId) return;
    onAnswer(confirmationId, 'reject', undefined, 'user declined');
  }, [confirmationId, canInteract, isWorking, onAnswer]);
  /** 官方自动确认 effect（逐字）。 */
  useEffect(() => {
    if (!canInteract || !confirmationId || autoConfirmGuardRef.current === confirmationId) return;
    if (!policyAllows) {
      autoConfirmGuardRef.current = confirmationId;
      reject();
      return;
    }
    const autoConfirm =
      policy?.shouldAutoConfirm?.(kind, envelope) ?? policy?.autoConfirm === true;
    if (!isClientAction && autoConfirm) {
      autoConfirmGuardRef.current = confirmationId;
      void confirm();
    }
  }, [confirmationId, policy?.autoConfirm, policy?.shouldAutoConfirm, confirm, reject, canInteract, isClientAction, policyAllows, envelope, kind, policy]);

  /** 官方 `if(!u||!p||Of(e,u,y))return null;`（逐字；**在全部 hook 之后**）。 */
  if (!confirmationId || !kind || isDesktopConfirmationInFlight(content, confirmationId, store)) {
    return null;
  }

  const confirmEnabled = canInteract && !isWorking && policyAllows;

  return (
    <div
      data-testid="desktop-confirmation-card"
      className={z(
        'my-2 flex w-full flex-col gap-3 overflow-hidden rounded-2xl bg-[#1F1F1F] p-3 transition-opacity',
        (cardStatus === 'rejected' || cardStatus === 'skipped') && 'opacity-50',
        cardStatus === 'confirmed' && 'opacity-80',
      )}
    >
      <div className="flex flex-col gap-1 px-1">
        <div className="text-sm font-medium leading-5 text-[#F5F5F5]">
          {/* 官方逐字：key 是动态拼接，defaultValue = `BQe[p] || "Run a desktop action"`。 */}
          {t(`chatAdapter.desktopConfirmation.titles.${kind}`, desktopConfirmationTitleDefault(kind))}
        </div>
        <div className="whitespace-pre-wrap break-words text-xs leading-4 tracking-[0.12px] text-white/60">
          {desktopConfirmationSummary(
            t,
            kind,
            envelope,
            authorizedFolder,
            desktopCapability?.available,
          )}
        </div>
        {policyAllows ? null : (
          <div className="pt-1 text-xs leading-4 text-amber-200/80">
            {t(
              'chatAdapter.desktopConfirmation.disabledInSettings',
              'This capability is disabled in Desktop Permissions.',
            )}{' '}
            <button
              type="button"
              className="underline underline-offset-2 hover:text-amber-100"
              onClick={() => openSettingsModal?.(DESKTOP_PERMISSIONS_SETTINGS_SECTION)}
            >
              {t('chatAdapter.desktopConfirmation.openSettings', 'Open settings')}
            </button>
          </div>
        )}
      </div>
      {cardStatus === 'pending' ? (
        <div className="flex items-center gap-2">
          <span className="flex-1" />
          <button
            type="button"
            className={z(
              'inline-flex items-center rounded-lg bg-white/[0.09] px-3 py-2 text-xs font-normal leading-3 text-[#F5F5F5] transition-colors focus:outline-none',
              canInteract && !isWorking ? 'hover:bg-white/[0.14]' : 'cursor-not-allowed opacity-40',
            )}
            onClick={reject}
            disabled={!canInteract || isWorking}
          >
            {t('chatAdapter.desktopConfirmation.reject', 'Reject')}
          </button>
          <button
            type="button"
            className={z(
              'inline-flex items-center rounded-lg bg-[#F5F5F5] px-3 py-2 text-xs font-normal leading-3 text-[#0F0F0F] transition-opacity focus:outline-none',
              confirmEnabled ? 'hover:opacity-85' : 'cursor-not-allowed opacity-40',
            )}
            onClick={() => {
              void confirm();
            }}
            disabled={!confirmEnabled}
          >
            {isWorking
              ? t('chatAdapter.desktopConfirmation.working', 'Working…')
              : t('chatAdapter.desktopConfirmation.confirm', 'Confirm')}
          </button>
        </div>
      ) : (
        <div className="px-1 text-xs text-white/45">
          {cardStatus === 'confirmed'
            ? t('chatAdapter.desktopConfirmation.confirmed', 'Confirmed')
            : cardStatus === 'skipped'
              ? t('chatAdapter.desktopConfirmation.skipped', 'Skipped')
              : t('chatAdapter.desktopConfirmation.rejected', 'Rejected')}
        </div>
      )}
    </div>
  );
});

DesktopConfirmationCard.displayName = 'DesktopConfirmationCard';

export default DesktopConfirmationCard;
