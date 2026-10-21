import type { BaseNodeData } from '../types';
import type { MockupCapture } from '../types/mockup';
import { generateId, useAppStore } from '../store/useAppStore';
import { derivedNodePlacement } from '../store/store.utils';
import { buildNodeFileName, saveDataUrlToProjectData } from './fileService';
import { registerCanvasDerivation, isCanvasDerivationFresh, completeCanvasDerivation } from './canvasDerivationGuard';
import { nearestAspectRatioForImage, nodeSizeForAspectRatio } from '../utils/nodeBounds';

/** A settled preview is a derived output; export creates one image and one edge in one history step. */
export async function saveMockupSnapshot(id: string, capture: MockupCapture, exportNode = false, isCurrent = () => true, snapshotKey?: string) {
  const guard = registerCanvasDerivation(useAppStore.getState(), id);
  if (!guard) return false;
  const fresh = () => isCurrent() && isCanvasDerivationFresh(guard, useAppStore.getState());
  try {
    if (!fresh()) return false;
    let imageUrl = capture.dataUrl;
    let filePath: string | undefined;
    const fileName = buildNodeFileName('样机', 'png', 'mockup');
    try {
      const saved = await saveDataUrlToProjectData(capture.dataUrl, guard.projectId, fileName);
      if (saved) { imageUrl = saved.assetUrl || capture.dataUrl; filePath = saved.filePath; }
    } catch { /* Browser mode retains a serializable data URL. */ }
    if (!fresh()) return false;
    const store = useAppStore.getState();
    const source = store.nodes.find((node) => node.id === id);
    if (!source) return false;
    const output = { imageUrl, filePath, fileName, imageWidth: capture.width, imageHeight: capture.height, status: 'success' as const };
    if (exportNode) {
      const newId = `node-${generateId()}`;
      const box = nodeSizeForAspectRatio(capture.width / capture.height);
      store.addNodesWithEdges([{
        id: newId, type: 'source-image', ...derivedNodePlacement(source, 60),
        data: { ...output, label: '样机截图', type: 'source-image', role: 'source', hide_inputbar: true,
          aspectRatio: nearestAspectRatioForImage(capture.width, capture.height).aspectRatio,
          nodeWidth: box.width, nodeHeight: box.height } as BaseNodeData,
      }], [{ id: `edge-${generateId()}`, source: id, sourceHandle: 'right', target: newId, targetHandle: 'left' }]);
      store.showToast('样机截图已创建为图片节点', 'success');
    } else {
      store.updateNodeDataTransient(id, { ...output, mockupSnapshotKey: snapshotKey });
    }
    return true;
  } finally { completeCanvasDerivation(guard); }
}
