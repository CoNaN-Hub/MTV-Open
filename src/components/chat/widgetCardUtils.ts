/**
 * widget 族 / htmlPreview 的纯函数部分 —— 官方三个 helper（`ust` / `pst` / `RI`）与 className 合并器 `z`。
 *
 * 为什么单独一个 `.ts`（而不是塞进 `.tsx`）：仓库 ESLint 开了 `react-refresh/only-export-components`，
 * 组件文件里再导出普通函数会告警（`--max-warnings=0` 会红）；官方这三个 helper 本来就是模块级普通函数。
 */

/**
 * 官方 `z`（`classnames` 的压缩别名）在本文件用到**两种调用形状**，本函数逐字覆盖这两处：
 *   `z("relative", n)`、`z("flex h-full w-full overflow-hidden", r)`
 * ⇒ 过滤 falsy 后以单空格连接（即 `classnames` 对纯字符串入参的行为）。
 *
 * ⚠️ 未落地：`classnames` 的对象/数组入参形式 —— 官方的 widget 族/htmlPreview **没有用到**，
 *    不在此「顺手实现」，以免与 `classnames` 的真实语义分叉。
 */
export function officialCx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' ');
}

/** 官方 `ust` 的返回形状。 */
export interface HtmlDownloadPayload {
  filename: string;
  blob: Blob;
}

/**
 * 官方 `ust(e,t)`（@2467914，逐字）：
 * ```js
 * function ust(e,t){const n=t.split(/[\\/]/).pop()??"";return{filename:`${Array.from(n
 *   .replace(/\.html?$/i,"")
 *   .replace(/[<>:"/\\|?*]/g,"_")
 *   .replace(new RegExp("\\p{Cc}","gu"),"_")
 *   .replace(/^\.+|\.+$/g,"")
 *   .trim()).slice(0,120).join("")||"creative-page"}.html`,blob:new Blob([e],{type:"text/html;charset=utf-8"})}}
 * ```
 * 文件名规则：取 `artifactPath` 最后一段 → 去 `.html`/`.htm` → 非法字符 `<>:"/\|?*` → `_`
 * → Unicode 控制字符（`\p{Cc}`）→ `_` → 去首尾点 → `trim()` → **按码点截断 120** → 空则 `"creative-page"`，
 * 末缀 `.html`；MIME `text/html;charset=utf-8`。
 */
export function buildHtmlDownloadPayload(html: string, artifactPath: string): HtmlDownloadPayload {
  const lastSegment = artifactPath.split(/[\\/]/).pop() ?? '';
  const cleaned =
    Array.from(
      lastSegment
        .replace(/\.html?$/i, '')
        .replace(/[<>:"/\\|?*]/g, '_')
        .replace(new RegExp('\\p{Cc}', 'gu'), '_')
        .replace(/^\.+|\.+$/g, '')
        .trim(),
    )
      .slice(0, 120)
      .join('') || 'creative-page';
  return {
    filename: `${cleaned}.html`,
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
  };
}

/** 官方 `pst` 里 `URL.revokeObjectURL` 的延时：`6e4` = 60000 ms。 */
export const HTML_DOWNLOAD_OBJECT_URL_REVOKE_DELAY = 6e4;

/**
 * 官方 `pst(e,t)`（@2468224，逐字）：
 * ```js
 * function pst(e,t){const{filename:n,blob:o}=ust(e,t),r=URL.createObjectURL(o),i=document.createElement("a");
 *   i.href=r,i.download=n,i.hidden=!0;try{document.body.appendChild(i),i.click()}
 *   finally{i.remove(),setTimeout(()=>URL.revokeObjectURL(r),6e4)}}
 * ```
 */
export function downloadHtmlArtifact(html: string, artifactPath: string): void {
  const { filename, blob } = buildHtmlDownloadPayload(html, artifactPath);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  try {
    document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), HTML_DOWNLOAD_OBJECT_URL_REVOKE_DELAY);
  }
}

/**
 * 官方 `RI(e)`（@2468479，逐字）：
 * `const RI=e=>typeof window<"u"?`${window.location.origin}/share/artifact/${e}`:""`
 * ⇒ 分享链接形态 `${origin}/share/artifact/${token}`；SSR 返回空串。
 */
export function shareArtifactUrl(token: string): string {
  return typeof window === 'undefined' ? '' : `${window.location.origin}/share/artifact/${token}`;
}
