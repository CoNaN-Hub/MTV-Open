/**
 * MediaViewerPrompt —— 官方媒体查看器里的「提示词」区块（`nbe` @440116，逐字）
 *
 * 官方结构：
 *   `section.w-full.select-text.text-left`
 *     → `span.mb-1.5.block.text-[11px].font-semibold.uppercase.tracking-[0.12em].text-white/35`（`imagePreview.prompt`）
 *     → `p.whitespace-pre-wrap.text-sm.leading-6.text-white/68`
 *   外层是 `.media-viewer__prompt`（宽度 = 媒体帧宽、`margin-top: var(--media-viewer-prompt-offset)`、`margin-inline:auto`）
 *
 * ⚠️ 官方正文里**没有**提示词 ⇒ 整块不渲染（`if(!e) return null`）。
 */
import { useT } from '../../../../i18n';

export interface MediaViewerPromptProps {
  prompt: string;
}

export default function MediaViewerPrompt({ prompt }: MediaViewerPromptProps) {
  const t = useT();
  if (!prompt) return null;
  return (
    <section className="w-full select-text text-left">
      {/* 官方 i18n `imagePreview.prompt`（中文包 =「提示词」） */}
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35">
        {t('提示词')}
      </span>
      <p className="whitespace-pre-wrap text-sm leading-6 text-white/68">{prompt}</p>
    </section>
  );
}
