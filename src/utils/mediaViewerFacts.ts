/**
 * mediaViewerFacts —— 官方媒体查看器「事实侧栏」（`tbe` @438982）的字段装配（逐字口径）
 *
 * 官方字段（**只有这 4 个**，顺序逐字）：
 *   1. `imagePreview.resolution`  = `"{width} × {height}"`（`fileInfo?.width ?? resource?.width`）
 *   2. `imagePreview.model`       = `model?.trim()`（空 ⇒ **整行不渲染**）
 *   3. `imagePreview.dateCreated` = `new Date(v).toLocaleDateString()`
 *   4. `videoPreview.duration`    = **仅 `mediaType === "video"`**，`"{m}:{ss}"`（`Math.floor(t/60)` + 秒补零）
 * 行过滤：`f.filter(g => g.loading || !!g.value)`；全空 ⇒ 组件返回 null。
 * ⚠️ 没有 seed / 比例 / 参数 / 分组标题 / 复制 / 展开按钮；提示词也不在这里（见 `MediaViewerPrompt`）。
 */
export type MediaViewerMediaType = 'image' | 'video';

export interface MediaFactInput {
  mediaType: MediaViewerMediaType;
  width?: number;
  height?: number;
  createdAt?: number;
  model?: string;
  /** 秒数（仅视频） */
  durationSeconds?: number;
  /** 信息仍在加载（官方 `loading`）：有值就显示值，没值显示骨架 */
  loading?: boolean;
}

export interface MediaFact {
  label: string;
  value?: string;
  loading: boolean;
}

/** 官方 `"{c} × {d}"`（乘号 U+00D7，两边各一个空格） */
export function formatMediaResolution(width?: number, height?: number): string | undefined {
  return width && height ? `${width} × ${height}` : undefined;
}

/** 官方 `new Date(v).toLocaleDateString()` */
export function formatMediaDate(createdAt?: number): string | undefined {
  return createdAt ? new Date(createdAt).toLocaleDateString() : undefined;
}

/** 官方 `Jge`：`Math.round(秒)` → `"{m}:{ss}"` */
export function formatMediaDuration(seconds?: number): string | undefined {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return undefined;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** 官方 `tbe` 的字段装配（标签用官方中文包原文：分辨率 / 模型 / 日期 / 时长） */
export function buildMediaFacts(input: MediaFactInput, labels: {
  resolution: string;
  model: string;
  dateCreated: string;
  duration: string;
}): MediaFact[] {
  const resolution = formatMediaResolution(input.width, input.height);
  const date = formatMediaDate(input.createdAt);
  const model = input.model?.trim() || undefined;
  const duration = input.mediaType === 'video' ? formatMediaDuration(input.durationSeconds) : undefined;

  const facts: MediaFact[] = [
    { label: labels.resolution, value: resolution, loading: !!input.loading && !resolution },
  ];
  if (model) facts.push({ label: labels.model, value: model, loading: false });
  facts.push({ label: labels.dateCreated, value: date, loading: !!input.loading && !date });
  if (input.mediaType === 'video') {
    facts.push({ label: labels.duration, value: duration, loading: !!input.loading && !input.durationSeconds });
  }
  return facts.filter((fact) => fact.loading || !!fact.value);
}
