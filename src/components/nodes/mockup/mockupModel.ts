import type { BaseNodeData } from '../../../types';
import type { MockupDeviceId } from '../../../types/mockup';

// Device IDs / viewport proportions: Artigine MockupNode.Ds1mgdHg.js, readable lines 116–137.
export const MOCKUP_DEVICES: ReadonlyArray<{ id: MockupDeviceId; label: string; width: number; height: number }> = [
  { id: 'iphone-duo', label: 'iPhone Duo', width: 951, height: 669 },
  { id: 'iphone-18-pro', label: 'iPhone 18 Pro', width: 402, height: 874 },
  { id: 'macbook-pro', label: 'MacBook Pro 14″', width: 1512, height: 982 },
  { id: 'studio-display', label: 'Studio Display', width: 2560, height: 1440 },
];
export const mockupDevice = (id: unknown) => MOCKUP_DEVICES.find((device) => device.id === id) ?? MOCKUP_DEVICES[0];
export const clampFoldAngle = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(180, Math.max(0, value)) : 180;

/** Cover crop: horizontal excess is centered; vertical excess is cropped from the top. */
export function mockupCrop(width: number, height: number, targetWidth: number, targetHeight: number) {
  const ratio = targetWidth / targetHeight;
  if (width / height > ratio) {
    const cropWidth = height * ratio;
    return { x: (width - cropWidth) / 2, y: 0, width: cropWidth, height };
  }
  return { x: 0, y: 0, width, height: width / ratio };
}

export interface MockupSource { nodeId: string; label: string; url: string }
/** Stable, compact identity of the rendered inputs (never persist a second copy of a data URL). */
export function mockupRenderKey(data: BaseNodeData, source?: MockupSource): string {
  const value = JSON.stringify([mockupDevice(data.mockupDeviceId).id, clampFoldAngle(data.mockupFoldAngle),
    data.mockupCamera ?? null, data.nodeWidth ?? 720, data.nodeHeight ?? 720, source?.nodeId, source?.url]);
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `mockup-v1-${(hash >>> 0).toString(16)}`;
}

export function resolveMockupSources(
  id: string,
  nodes: ReadonlyArray<{ id: string; type?: string; data: BaseNodeData }>,
  edges: ReadonlyArray<{ source: string; target: string; data?: Record<string, unknown> }>,
): MockupSource[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  return edges.filter((edge) => edge.target === id)
    .map((edge, index) => ({ edge, order: typeof edge.data?.order === 'number' ? edge.data.order : index }))
    .sort((a, b) => a.order - b.order)
    .flatMap(({ edge }) => {
      const node = byId.get(edge.source);
      if (!node || seen.has(node.id)) return [];
      const url = node.data.imageUrl || node.data.thumbnailUrl;
      if (typeof url !== 'string' || !url.trim() || node.type?.includes('video')) return [];
      seen.add(node.id);
      return [{ nodeId: node.id, label: node.data.label || '图片', url }];
    });
}
