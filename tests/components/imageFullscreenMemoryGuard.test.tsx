import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/hooks/useImageViewportGesture', () => ({
  useImageViewportGesture: () => ({
    containerRef: vi.fn(),
    containerEl: { current: null },
    scale: 1,
    tx: 0,
    ty: 0,
    dragging: false,
    gesturing: false,
    cursor: 'default',
    onPointerDown: vi.fn(),
    reset: vi.fn(),
    zoomTo: vi.fn(),
  }),
}));

import ZoomableImage from '../../src/components/shared/ZoomableImage';

const imageNodeSource = readFileSync(
  new URL('../../src/components/nodes/ImageNode.tsx', import.meta.url),
  'utf8',
);
const zoomableImageSource = readFileSync(
  new URL('../../src/components/shared/ZoomableImage.tsx', import.meta.url),
  'utf8',
);
const nodesCssSource = readFileSync(
  new URL('../../src/styles/nodes.css', import.meta.url),
  'utf8',
);
const nodesImageCssSource = readFileSync(
  new URL('../../src/styles/nodes-image.css', import.meta.url),
  'utf8',
);

describe('image fullscreen memory guard', () => {
  it('reuses the displayed source and suspends the canvas preview without origin flight', () => {
    /* 图卡全屏入口现在是官方媒体查看器（MediaViewer），不再是 MTV 的 FullscreenOverlay */
    const viewerStart = imageNodeSource.indexOf('<MediaViewer');
    const viewerEnd = imageNodeSource.indexOf('/>', viewerStart);
    const fullscreenPreview = imageNodeSource.slice(viewerStart, viewerEnd);
    const canvasPreviewStart = imageNodeSource.indexOf('className="image-preview-container"');
    const canvasPreviewEnd = imageNodeSource.indexOf(') : isUploading ? (', canvasPreviewStart);
    const canvasPreview = imageNodeSource.slice(canvasPreviewStart, canvasPreviewEnd);
    const suspendedPreviewStart = canvasPreview.indexOf('{!shouldSuspendCanvasPreview && (');
    /* ⚠️ 原来这里取 `canvasPreview.lastIndexOf('</>')` —— 那个 `</>` 是**片段的收尾**（真实结束位置），
       而不是本意要的 `) : isUploading ? (` 边界 ⇒ 该切片其实一路吃到片段末尾。
       后果：任何在它之前的区块（如「图片加载失败」覆盖层）一改大小，`lastIndexOf` 命中的
       `</>` 就会移位，切片随之前后伸缩 —— 断言便会莫名其妙地失败（2026 本轮实测踩到）。
       改用片段收尾作**稳定**结束锚点：语义即「`!shouldSuspendCanvasPreview` 分支的全部内容」。 */
    const suspendedPreviewEnd = canvasPreview.indexOf('</>', suspendedPreviewStart);
    const suspendedPreview = canvasPreview.slice(suspendedPreviewStart, suspendedPreviewEnd);

    expect(viewerStart).toBeGreaterThan(-1);
    expect(fullscreenPreview).toContain('mediaType="image"');
    /* 复用正在展示的源（官方也是「入口媒体」） */
    expect(fullscreenPreview).toContain('entrySrc={displaySrc ?? \'\'}');
    expect(fullscreenPreview).not.toContain('originRect=');
    expect(imageNodeSource).not.toContain('fullscreenOrigin');
    expect(imageNodeSource).not.toContain('imagePreviewRef');
    expect(suspendedPreviewStart).toBeGreaterThan(-1);
    expect(suspendedPreviewEnd).toBeGreaterThan(suspendedPreviewStart);
    expect(imageNodeSource).toContain('const shouldSuspendCanvasPreview = isFullscreen');
    expect(imageNodeSource).toContain('|| isMatting');
    expect(imageNodeSource).toContain('|| isAnnotate');
    expect(imageNodeSource).toContain('|| isCompose');
    expect(suspendedPreview).toContain('src={previewFetchSrc}');
    expect(suspendedPreview).toContain('data.mattingMask');
    expect(suspendedPreview).toContain('annotationLayer');
    expect(suspendedPreview).toContain('isUpscaling');
    expect(suspendedPreview).toContain('isMattingRunning');
  });

  it('does not permanently promote the idle image or retain the layout flight path', () => {
    const html = renderToStaticMarkup(<ZoomableImage src="asset://preview.png" />);

    expect(html).not.toMatch(/will-change:\s*transform/);
    expect(zoomableImageSource).not.toContain('originRect');
    expect(zoomableImageSource).not.toContain('useLayoutEffect');
    expect(zoomableImageSource).not.toContain('.animate(');
  });

  it('shows an intentional static placeholder without decoding another image', () => {
    const placeholderStart = imageNodeSource.indexOf('className="image-preview-suspended');
    const placeholderEnd = imageNodeSource.indexOf('{!shouldSuspendCanvasPreview && (', placeholderStart);
    const placeholder = imageNodeSource.slice(placeholderStart, placeholderEnd);

    expect(placeholderStart).toBeGreaterThan(-1);
    expect(placeholderEnd).toBeGreaterThan(placeholderStart);
    expect(imageNodeSource).toContain('{shouldSuspendCanvasPreview && (');
    expect(placeholder).toContain("{t('编辑中')}");
    expect(placeholder).not.toContain('src={displaySrc}');
    expect(placeholder).not.toContain('<img');
    expect(placeholder).not.toContain('<canvas');
    expect(placeholder).not.toContain('blur');
    expect(placeholder).not.toContain('filter');
    expect(placeholder).not.toContain('will-change');
    expect(imageNodeSource).not.toContain('prepareSuspendedCanvasPreview');
    expect(imageNodeSource).not.toContain('createObjectURL');
    expect(imageNodeSource).not.toContain('toBlob');
    /* 全屏走官方媒体查看器：它只渲染「入口媒体 + 历史缩略图」，不会额外解码画布预览 */
    expect(imageNodeSource).toContain('<MediaViewer');
    expect(imageNodeSource).toContain('entrySrc={displaySrc ?? \'\'}');
  });

  it('disables expensive effects only for the image fullscreen overlay', () => {
    const sharedOverlayIndex = nodesCssSource.indexOf('.fullscreen-overlay--transparent {');
    const imageOverlayIndex = nodesCssSource.indexOf(
      '.fullscreen-overlay--transparent.fullscreen-overlay--image-preview',
    );

    expect(imageOverlayIndex).toBeGreaterThan(sharedOverlayIndex);
    expect(nodesCssSource).toMatch(
      /\.fullscreen-overlay--transparent\.fullscreen-overlay--image-preview\s*\{(?=[^}]*-webkit-backdrop-filter:\s*none)(?=[^}]*backdrop-filter:\s*none)[^}]*\}/s,
    );
    expect(nodesCssSource).toMatch(
      /\.fullscreen-overlay--image-preview\s+\.zoomable-image-stage\s*\{(?=[^}]*animation:\s*none)(?=[^}]*will-change:\s*auto)[^}]*\}/s,
    );
  });

  it('uses a static depth mask for image editors instead of full-window blur', () => {
    const depthMaskStart = nodesImageCssSource.indexOf('body > :is(');
    const depthMaskEnd = nodesImageCssSource.indexOf('\n}', depthMaskStart);
    const depthMask = nodesImageCssSource.slice(depthMaskStart, depthMaskEnd);

    expect(depthMaskStart).toBeGreaterThan(-1);
    expect(depthMaskEnd).toBeGreaterThan(depthMaskStart);
    expect(depthMask).toContain('.fullscreen-overlay--transparent.composer-overlay');
    expect(depthMask).toContain('.fullscreen-overlay--transparent.crop-overlay');
    expect(depthMask).toContain('.matting-overlay');
    expect(depthMask).toContain('.point-edit-overlay.point-edit-overlay');
    expect(depthMask).toContain('.fullscreen-overlay--transparent.customgrid-overlay');
    expect(depthMask).toContain('.fullscreen-overlay.camera-studio-overlay');
    expect(depthMask).toContain('.fullscreen-overlay--transparent.image-node-fullscreen-overlay');
    expect(depthMask).toContain(
      'radial-gradient(ellipse at center, var(--black-alpha-30) 0%, var(--black-alpha-60) 100%)',
    );
    expect(depthMask).toContain(
      'linear-gradient(var(--black-alpha-50), var(--black-alpha-50))',
    );
    expect(depthMask).toContain('var(--black-alpha-60)');
    expect(depthMask).toContain('-webkit-backdrop-filter: none');
    expect(depthMask).toContain('backdrop-filter: none');
    expect(depthMask).not.toMatch(/backdrop-filter:\s*blur/);
  });
});
