/**
 * MediaViewerFacts —— 官方「事实侧栏」（`tbe` @438982，逐字）
 *
 * 官方结构（`motion.aside.media-viewer__facts` 内部）：
 *   `dl.space-y-6.text-white/72`
 *     → 每项 `div.space-y-1.5`
 *         → `dt.text-[11px].font-semibold.uppercase.tracking-[0.12em].text-white/38`
 *         → `dd.break-words.text-sm.leading-5.text-white/74`
 *           或 loading 态：`<span class="sr-only">{common.loading}</span>` +
 *             `<span aria-hidden class="block h-5 w-20 animate-pulse rounded bg-white/10 motion-reduce:animate-none"/>`
 *
 * 字段装配与格式化的逐字口径见 `utils/mediaViewerFacts.ts`（纯函数，带单测）。
 *
 * ★ 模型名（官方 `fye` @443097）：**不能直接印原始 id**。
 *   官方 `gye` 里是 `const i = fye(model, t)` —— 查模型名表，命中用可读名、查不到回落原文、
 *   空则整条不渲染。MTV 侧等价物见 `hooks/useMediaModelDisplayName.ts`
 *   （`officialCardMeta` → `modelDisplayOverride` → 原文；自定义连接先展开 `cfg.modelId`/`cfg.name`）。
 */
import { useT } from '../../../../i18n';
import { useMediaModelDisplayName } from '../../../../hooks/useMediaModelDisplayName';
import { buildMediaFacts, type MediaFactInput } from '../../../../utils/mediaViewerFacts';

export type MediaViewerFactsProps = MediaFactInput;

export default function MediaViewerFacts({
  mediaType,
  width,
  height,
  createdAt,
  model,
  durationSeconds,
  loading,
}: MediaViewerFactsProps) {
  const t = useT();
  /** 官方 `fye(model, t)`：空 ⇒ `undefined`（下方 `buildMediaFacts` 据此整条不渲染） */
  const modelDisplayName = useMediaModelDisplayName(model, mediaType);
  const facts = buildMediaFacts(
    { mediaType, width, height, createdAt, model: modelDisplayName, durationSeconds, loading },
    {
      resolution: t('分辨率'),
      model: t('模型'),
      dateCreated: t('日期'),
      duration: t('时长'),
    },
  );
  if (facts.length === 0) return null;
  return (
    <dl className="space-y-6 text-white/72">
      {facts.map((fact) => (
        <div key={fact.label} className="space-y-1.5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/38">{fact.label}</dt>
          {fact.loading ? (
            <dd>
              <span className="sr-only">{t('加载中...')}</span>
              <span
                aria-hidden="true"
                className="block h-5 w-20 animate-pulse rounded bg-white/10 motion-reduce:animate-none"
              />
            </dd>
          ) : (
            <dd className="break-words text-sm leading-5 text-white/74">{fact.value}</dd>
          )}
        </div>
      ))}
    </dl>
  );
}
