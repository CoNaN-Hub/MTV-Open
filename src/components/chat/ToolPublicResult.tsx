/**
 * ToolPublicResult —— 官方**新版**（`vendor-pkg-canvas-CvbAwZyy.js`，2026-10 线上构建）新增的
 * 「详细过程」(progressDetails) 里的**工具结果块**，1:1 复刻官方 `TT`。
 *
 * 官方逐字：
 * ```js
 * TT = ({payload, omitTexts, hideErrors = false}) => {
 *   const {t: o} = se();
 *   const {sections, truncated} = OX(payload, omitTexts);        // 纯函数层见 services/chat/toolPublicResult.ts
 *   const visible = hideErrors ? sections.filter(d => d.kind !== 'errors') : sections;
 *   if (!visible.length && !truncated) return null;
 *   const fallback = {summary:'Result', output:'Output', errors:'Error output', file:'File contents'};
 *   return <div className="mt-1 space-y-1.5 pl-6" data-tool-public-result="">
 *     {visible.map((d,u) => <div key={`${d.kind}-${u}`}>
 *        <div className="text-xs text-muted-foreground/60">{t(`chatAdapter.progressDetails.${d.kind}`, fallback[d.kind])}</div>
 *        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-foreground/5
 *                        p-2 font-mono text-xs text-foreground/70">{d.text}</pre></div>)}
 *     {truncated ? <p className="text-xs text-muted-foreground">
 *        {t('chatAdapter.progressDetails.truncated','Partial result — more data may remain. …')}</p> : null}
 *   </div>;
 * };
 * ```
 * 挂载点（官方 `zae` = `ToolActivityDetailList`，新版 @2447495）在**每个工具行内部**、chips 行**之前**：
 * ```js
 * o ? <TT payload={g} hideErrors omitTexts={[label.displayText, description, ...Mae]} /> : null
 * ```
 * 另有 `AgentToolEventCard`（无 `hideErrors`）与桌面确认卡两处挂载点。
 *
 * 官方词典四语言（新版逐字）：zh 详细过程/结果/输出/错误输出/文件内容/当前为部分结果… ·
 * en Detailed progress/Result/Output/Error output/File contents/… ·
 * ja 詳しい進捗/結果/出力/エラー出力/ファイル内容/… · ko 상세 진행/결과/출력/오류 출력/파일 내용/…
 */
import { useT } from '../../i18n';
import {
  TOOL_PUBLIC_RESULT_FALLBACK,
  toolPublicResultSections,
  type ToolPublicResultKind,
} from '../../services/chat/toolPublicResult';

export interface ToolPublicResultProps {
  /** 工具事件内容（官方 `payload`）。 */
  payload: unknown;
  /** 已在别处显示过的文本（行标签/描述/官方 `Mae`）——保持一致不再重复列出。 */
  omitTexts?: readonly string[];
  /** 官方 `hideErrors`：工具行内不显示错误输出（错误由确认卡等别处承载）。 */
  hideErrors?: boolean;
}

/** 官方 `TT`。 */
export default function ToolPublicResult({ payload, omitTexts, hideErrors = false }: ToolPublicResultProps) {
  const t = useT();
  const { sections, truncated } = toolPublicResultSections(payload, omitTexts);
  const visible = hideErrors ? sections.filter((section) => section.kind !== 'errors') : sections;
  if (visible.length === 0 && !truncated) return null;
  /* 官方 `t(key, fallback)`；MTV 的 `t()` 缺键时回落 key 本身 ⇒ 手动补官方英文兜底。 */
  const labelOf = (kind: ToolPublicResultKind) => {
    const key = `chatAdapter.progressDetails.${kind}`;
    const translated = t(key);
    return translated === key ? TOOL_PUBLIC_RESULT_FALLBACK[kind] : translated;
  };

  return (
    <div className="mt-1 space-y-1.5 pl-6" data-tool-public-result="">
      {visible.map((section, index) => (
        <div key={`${section.kind}-${index}`}>
          <div className="text-xs text-muted-foreground/60">{labelOf(section.kind)}</div>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-foreground/5 p-2 font-mono text-xs text-foreground/70">
            {section.text}
          </pre>
        </div>
      ))}
      {truncated ? (
        <p className="text-xs text-muted-foreground">{t('chatAdapter.progressDetails.truncated')}</p>
      ) : null}
    </div>
  );
}
