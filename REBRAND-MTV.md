# MTV 导演画布 (com.mtv.H) — 重品牌说明

本工程由上游 `Tenney95/AI-Canvas-tauri` 派生并重品牌，与 `D:\\Ftv` 完全无关（独立副本）。

## 已应用的改动

- productName / 窗口标题: **MTV 导演画布**
- identifier: **com.mtv.H**
- 版本: 1.0.0
- 图标: `src-tauri/icons/` 全套已生成（`app-icon.png` 1024px 源图 → `icon.ico` / png 全尺寸 / iOS / Android 共 53 个文件），`bundle.icon` 与 NSIS `installerIcon` 均已指向光栅图标；矢量版 `mtv-logo.svg` 保留备用
- MCP 适配器: `ai-canvas-mcp.mjs` → `mtv-mcp.mjs`（已 rename 并打包为资源）
- **已删除上游 auto-updater**（否则打包后会从 Tenney95 自动覆盖回 AI Canvas）
- **开发端口 1420 → 5180**，全工程无 5170 占用（避开 FTV 后端 5170）

## 你在本机要做的事

1. 安装依赖：`npm install`（上游依赖 `@tenney95/xiaoluo-image-editor` 是作者私有包，若 404 需处理）
2. 开发运行：`npm run tauri dev`
3. 打包 exe：`npm run tauri build`（图标已就绪，无需再处理）
       
       
4. 你的 88 处 FTV 热补丁：上游无 FTV 的 Node 后端(5170)，无法直接迁移；
     
   建议把 `FTV-patches/manifest.json` 中前端部分反向 port 进 `src/` 的 React 组件。

构建工具链：Rust + Node 22 + Tauri 2 CLI（本沙箱无，请在本机执行）。

