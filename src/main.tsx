/**
 * React 应用入口，根据查询参数选择视图，并在挂载前应用主题。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
/* ★ 库 CSS 必须**先于**应用 CSS 加载（官方构建同序）：
   `nodes-group.css` 里官方那套缩放控制点规则（`.react-flow__resize-control.handle{width:0}` /
   `.react-flow__node.selected …{width:24px}`）与库规则**同特异性**，靠的就是"应用 CSS 在后"才能生效。
   原来这行在 `Canvas.tsx` 里 ⇒ 库 CSS 被排到应用 CSS 之后，官方规则全被盖掉 ✗ */
import '@xyflow/react/dist/style.css'
import './index.css'
import RootView from './RootView'
import { setLocale } from './i18n'
import { initializeIconCache } from './services/iconCacheService'

// 复用同一入口，通过 ?view= 区分视图类型（assets / video-editor / style-guide）
const searchParams = new URLSearchParams(window.location.search)
const view = searchParams.get('view')

if (/Windows NT/i.test(navigator.userAgent)) {
  // Windows 走 ClearType 次像素抗锯齿，见 base.css 的 font-smoothing 分支
  document.documentElement.setAttribute('data-os', 'windows')
}

async function mountRoot() {
  initializeIconCache()
  /* 语言/主题由 App 的常规引导流程加载（独立窗口那套预加载已随独立窗口移除） */
  setLocale(undefined)
  const { installMcpScreenshotResponder } = await import('./services/mcp/mcpUiRuntimeService')
  void installMcpScreenshotResponder()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RootView view={view} />
    </StrictMode>,
  )
}

void mountRoot()
