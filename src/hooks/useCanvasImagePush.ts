/**
 * useCanvasImagePush —— 画布侧接收「外部编辑器主动推来的图片」。
 *
 * 为什么单独一个 hook：
 *   · 桥接服务必须**先起来**，PS 面板才推得进来 ⇒ 画布挂载时顺手把服务拉起（幂等）；
 *   · 推送是**事件**（`roundtrip://canvas-image`）—— 快，但画布没开时事件会丢；
 *   · 所以还有一条**轮询兜底**：挂载/切项目时拉一次 `roundtrip_pending_pushes` 补齐
 *     （Rust 侧保留最多 20 条待认领，认领后即删）。
 *
 * 只负责「收」；「发」在 `ImageNodeToolbar` 里（走 `startImageRoundtrip`）。
 */
import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { isTauriEnv } from '../services/fs/core';
import {
  drainPushedCanvasImages,
  ensureRoundtripBridge,
  listenForPushedCanvasImages,
} from '../services/imageRoundtripService';

export function useCanvasImagePush(): void {
  const currentProjectId = useAppStore((s) => s.currentProjectId);

  useEffect(() => {
    if (!isTauriEnv() || !currentProjectId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      try {
        await ensureRoundtripBridge();
      } catch {
        /* 桥起不来不影响画布本身；推送收不到而已 */
        return;
      }
      if (cancelled) return;
      try {
        unsubscribe = await listenForPushedCanvasImages();
        await drainPushedCanvasImages();
      } catch {
        /* 监听失败也不影响画布 */
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [currentProjectId]);
}
