/**
 * downloadBlob — 媒体结果下载工具（移植自 FTV App-RefSlot.js 下载逻辑）
 *
 * FTV 原实现：下载生成结果时按 blob 的 MIME 类型推导文件扩展名，
 * 避免文件名丢失后缀（如 `a.download = e.title || '生成结果'` 在 Tauri 下会变成无扩展名文件）。
 *
 * 用法：
 *   const blob = await (await fetch(url)).blob();
 *   downloadBlob(blob, baseName);            // baseName 可带或不带扩展名
 *   // 或指定下载名：downloadBlob(blob, '我的成片', '生成结果')
 */
const MIME_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'application/json': 'json',
};

function extFromMime(mime: string | undefined): string | null {
  if (!mime) return null;
  const key = mime.split(';')[0].trim().toLowerCase();
  return MIME_EXT_MAP[key] ?? null;
}

function ensureExt(name: string, ext: string | null): string {
  if (ext && !name.toLowerCase().endsWith(`.${ext}`)) return `${name}.${ext}`;
  return name;
}

/**
 * 触发浏览器/WebView 下载。
 * @param blob   已获取的二进制内容
 * @param baseName 期望的文件名（可无扩展名）；Tauri 下 <a download> 会静默落到下载目录
 * @param fallbackName 当 baseName 为空时使用的兜底名（默认 'download'）
 */
export function downloadBlob(
  blob: Blob,
  baseName?: string,
  fallbackName = 'download',
): void {
  const ext = extFromMime(blob.type);
  const raw = (baseName && baseName.trim()) || fallbackName;
  const finalName = ensureExt(raw, ext);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
