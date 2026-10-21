/**
 * canvasPin.ts —— 官方「Pin（画布标记分组）」的数据模型，**逐字照抄** TapNowExtract
 *   `zoom-slider-3ZcFvYQO.js`：
 *     @1175949 `hh`            = 6 个色组（id 就是 hex，无 #）
 *     @1178019 `MAe/$g/PAe/DAe/FAe/C7/OAe/zAe/mB` = 读写与开关的纯函数
 *     @1222010 `uIe` + `L7`    = pinnable 判定（只读排除 · 按节点类型 · text/world 免 src）
 *     @1213314 `Qke`           = 卡片/标题上的 pin 指示器
 *     @1215298 `nIe`           = popover 里的色点开关
 *     @1216596 `rIe`           = 按钮的 popover 壳（6 色开关）
 *     @1218276 `iIe` + `_B`    = 26px 舞台（图钉 + 色点，位置公式）
 *   存储位置：节点 `data.color_pins: string[]`
 */
import type { NodeType } from '../types';

export interface PinGroup {
  /** = hex 去掉 `#`（官方 id 就是它） */
  id: string;
  hex: string;
  /** MTV i18n 的键就是中文原文（颜色名） */
  label: string;
}

/** 官方 `hh`（6 组，顺序即 popover/指示器里的顺序） */
export const PIN_GROUPS: readonly PinGroup[] = [
  { id: 'F0606B', hex: '#F0606B', label: '红色' },
  { id: 'F4A14B', hex: '#F4A14B', label: '橙色' },
  { id: 'EDC63D', hex: '#EDC63D', label: '黄色' },
  { id: '4FC978', hex: '#4FC978', label: '绿色' },
  { id: '4EA8FF', hex: '#4EA8FF', label: '蓝色' },
  { id: 'A55CF0', hex: '#A55CF0', label: '紫色' },
];

const PIN_GROUP_MAP = new Map(PIN_GROUPS.map((g) => [g.id, g]));

/** 官方 `kAe`：合法色组 id */
export function isPinGroupId(value: unknown): value is string {
  return typeof value === 'string' && PIN_GROUP_MAP.has(value);
}

/** 官方 `IAe` */
export function pinGroupById(id: string | null | undefined): PinGroup | undefined {
  return id ? PIN_GROUP_MAP.get(id) : undefined;
}

/** 官方 `MAe`：过滤非法值 + 去重，**保序** */
export function normalizePins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (!isPinGroupId(item) || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** 官方 `$g(data)`：从节点 data 读 `color_pins` */
export function readPins(data: unknown): string[] {
  if (!data || typeof data !== 'object') return [];
  return normalizePins((data as { color_pins?: unknown }).color_pins);
}

/** 官方 `mB(data, pins)`：写回（保持 data 其它字段不变） */
export function withPins<T extends object>(data: T, pins: string[]): T & { color_pins: string[] } {
  return { ...(data && typeof data === 'object' ? data : ({} as T)), color_pins: pins };
}

/** 官方 `PAe` */
export function isPinned(pins: string[]): boolean {
  return pins.length > 0;
}

/** 官方 `DAe`：primaryGroup = **最后一个** */
export function primaryPinGroupId(pins: string[]): string | undefined {
  return pins.length === 0 ? undefined : pins[pins.length - 1];
}

/** 官方 `FAe` / `C7` / `OAe` */
export function addPin(pins: string[], groupId: string): string[] {
  return pins.includes(groupId) ? pins : [...pins, groupId];
}
export function removePin(pins: string[], groupId: string): string[] {
  return pins.includes(groupId) ? pins.filter((id) => id !== groupId) : pins;
}
export function togglePin(pins: string[], groupId: string): string[] {
  return pins.includes(groupId) ? removePin(pins, groupId) : addPin(pins, groupId);
}

/** 官方 `_B(index, count, spread, y)`：色点相对舞台中心的位移（`Math.round`，与官方一致） */
export function pinDotOffset(index: number, count: number, spread = 3, y = -1): { x: number; y: number } {
  const center = (count - 1) / 2;
  return { x: Math.round((index - center) * spread), y };
}

/** 官方 `L7`：按节点类型的 `toolbarPinnable`（VIDEO_EDIT = false ⇒ 这里不登记） */
export const PINNABLE_KIND: Partial<Record<NodeType, 'image' | 'video' | 'audio' | 'text' | 'world'>> = {
  'ai-image': 'image',
  'source-image': 'image',
  'ai-video': 'video',
  'source-video': 'video',
  'ai-audio': 'audio',
  'source-audio': 'audio',
  'ai-text': 'text',
  'source-text': 'text',
  'ai-markdown': 'text',
  'ai-panorama': 'world',
};

export interface PinnableInfo {
  pinnable: boolean;
  mediaKind?: 'image' | 'video' | 'audio' | 'text' | 'world';
  hasSrc: boolean;
}

/**
 * 「有内容」判定 —— 官方源码里就是 `typeof data.src === "string" && data.src.length > 0`，
 * 但 MTV 的媒体字段名与官方不同（`imageUrl / videoUrl / audioUrl / thumbnailUrl / output`），
 * 所以这里把 MTV 的等价字段都算上；`src` 也保留（源节点/上传节点用它）。
 */
export function hasNodeMedia(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return ['src', 'imageUrl', 'videoUrl', 'audioUrl', 'thumbnailUrl', 'output'].some(
    (key) => typeof d[key] === 'string' && (d[key] as string).length > 0,
  );
}

/** 官方 `uIe(node)`：只读排除（调用方传 readonly）→ 类型表 → `text/world` 免 src、其余要「有内容」
 *  ⚠️ 调用方若已知「本卡有没有内容」（例如从卡片自己的 `displaySrc` 门算出来的），用 `hasContent`
 *     显式传进来 —— 这样 Pin 的门与**卡片自己的内容门**完全一致（官方两者也同源：都是 `data.src`）。 */
export function resolvePinnable(
  node: { type?: string; data?: unknown } | null | undefined,
  options: { readonly?: boolean; hasContent?: boolean } = {},
): PinnableInfo {
  if (!node || options.readonly) return { pinnable: false, hasSrc: false };
  const mediaKind = PINNABLE_KIND[node.type as NodeType];
  if (!mediaKind) return { pinnable: false, hasSrc: false };
  const hasSrc = typeof options.hasContent === 'boolean' ? options.hasContent : hasNodeMedia(node.data);
  return { pinnable: mediaKind === 'text' || mediaKind === 'world' || hasSrc, mediaKind, hasSrc };
}

/** 气泡文案：官方 `canvas.pin.toolbar.tooltip` = "Pin" / `tooltipPinnedColors` =「已 Pin：{{colors}}」 */
export function pinTooltip(pins: string[], t: (key: string, options?: Record<string, unknown>) => string): string {
  if (pins.length === 0) return t('Pin');
  const names = PIN_GROUPS.filter((g) => pins.includes(g.id)).map((g) => t(g.label));
  return t('已 Pin：{colors}', { colors: names.join('、') });
}

export interface CanvasPinGroupRow {
  groupId: string;
  group: PinGroup;
  nodeIds: string[];
  count: number;
}

/** 官方 `jAe(map)` + `BAe(nodes)`：把 `groupId → nodeIds` 转成**只含有节点的组**（按官方色组顺序） */
export function groupPins(byGroup: Map<string, string[]>): CanvasPinGroupRow[] {
  const rows: CanvasPinGroupRow[] = [];
  for (const group of PIN_GROUPS) {
    const nodeIds = byGroup.get(group.id);
    if (!nodeIds || nodeIds.length === 0) continue;
    rows.push({ groupId: group.id, group, nodeIds, count: nodeIds.length });
  }
  return rows;
}
