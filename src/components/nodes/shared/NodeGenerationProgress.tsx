import { useAppStore } from '../../../store/useAppStore';

interface NodeGenerationProgressProps {
  nodeId: string;
  fallbackLabel: string;
  overlay?: boolean;
  compactSpinner?: boolean;
  /**
   * ★ 只画「文案 + 进度条」，**不带**自带底色 / spinner —— 供**图片节点**把 ComfyUI 真实进度
   * 叠在官方 `node-loading` 生成动效之上用 ✓（官方生成态是纯氛围，没有进度条 ✓；
   * ComfyUI 进度是 MTV 独有信息 → 保留信息但不去改官方观感 ✓）
   */
  bare?: boolean;
}

export default function NodeGenerationProgress({
  nodeId,
  fallbackLabel,
  overlay = false,
  compactSpinner = false,
  bare = false,
}: NodeGenerationProgressProps) {
  const progress = useAppStore((state) => {
    const candidate = state.comfyNodeProgress[nodeId];
    return candidate?.projectId === state.currentProjectId ? candidate : null;
  });

  /* §96 空标签 ⇒ **不渲染**文案节点（不是渲染一个空 `<span>`）。
     缘由：官方节点生成态覆盖层 `Kp`（`vendor-pkg-canvas-CvbAwZyy.js` @1045343）里
     **没有任何文本节点**，官方全套产物里也没有「生成视频中」这条串 ⇒ 视频卡按官方**留空**。
     对其余调用方（`AudioNode` 生成音频中 / `AnimationNode` Sprite Sheet / `ImageNode` bare）
     **零影响**：它们传的 `fallbackLabel` 都非空 ⇒ 下面的分支与改动前逐字相同。 */
  const hasLabel = fallbackLabel.length > 0;

  if (!progress) {
    /* bare：只在**真拿到 ComfyUI 进度**时才画（图片节点生成时以官方动效打底 ✓）*/
    if (bare) return null;
    if (overlay) {
      // 节点已有内容时以浮层形式保留生成中的可见反馈（含性能模式，仅 spinner 不受降级影响）
      return (
        <div className="generation-progress-overlay">
          <div className="spinner large" />
          {hasLabel && <span className="text-xs">{fallbackLabel}</span>}
        </div>
      );
    }
    return (
      <div className="node-preview-loading">
        <div className={compactSpinner ? 'spinner' : 'spinner large'} />
        {hasLabel && <span>{fallbackLabel}</span>}
      </div>
    );
  }

  const determinate = progress.percent !== undefined;
  const detail = determinate && progress.value !== undefined && progress.max !== undefined
    ? `${progress.value} / ${progress.max} · ${progress.percent}%`
    : fallbackLabel;

  const body = (
    <>
      <div className="flex w-full max-w-[220px] items-center justify-between gap-3 text-[11px]">
        {/* §97 尾款：MTV 偏紫灰令牌族 `canvas-*` 全仓移除时，本文件被白名单挡住 ⇒ 这里补完。
            正文 → 官方 `--foreground`(#f5f5f5)；次级 → 官方 `--text-text-secondary`(#9c9c9c)。
            依据：官方 `:root` 逐字（原始字节 dump `live-assets-r100/index-DlJQu0XZ.css`）。 */}
        <span className="font-medium text-foreground">ComfyUI</span>
        {/* §96：`detail` 为空时不渲染（视频卡留空；其余调用方 detail 恒非空 ⇒ 行为不变） */}
        {detail.length > 0 && <span className="truncate text-text-text-secondary">{detail}</span>}
      </div>
      <div
        className={`ui-progress w-full max-w-[220px]${determinate ? '' : ' ui-progress--indeterminate'}`}
        role="progressbar"
        aria-label={`ComfyUI · ${fallbackLabel}`}
        aria-valuemin={determinate ? 0 : undefined}
        aria-valuemax={determinate ? 100 : undefined}
        aria-valuenow={determinate ? progress.percent : undefined}
      >
        <div className="ui-progress__bar" style={determinate ? { width: `${progress.percent}%` } : undefined} />
      </div>
    </>
  );

  if (bare) {
    return (
      <div className="generation-progress-bare" data-comfy-progress={progress.stage}>
        {body}
      </div>
    );
  }

  return (
    <div
      className={overlay
        ? 'generation-progress-overlay'
        : 'node-preview-loading px-5'}
      data-comfy-progress={progress.stage}
    >
      {body}
    </div>
  );
}
