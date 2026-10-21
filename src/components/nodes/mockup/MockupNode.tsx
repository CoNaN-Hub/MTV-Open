import { lazy, memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BaseNodeData } from '../../../types';
import type { MockupCamera, MockupCapture } from '../../../types/mockup';
import { useAppStore } from '../../../store/useAppStore';
import Select from '../../shared/Select';
import NodeLabel from '../shared/NodeLabel';
import NodeResizeHandles from '../shared/NodeResizeHandles';
import NodeToolbarShell from '../shared/NodeToolbarShell';
import { useNodeRename } from '../shared/useNodeRename';
import { resolveMockupSources, MOCKUP_DEVICES, mockupDevice, clampFoldAngle, mockupRenderKey } from './mockupModel';
import { saveMockupSnapshot } from '../../../services/mockupSnapshotService';
import type { MockupViewportHandle } from './MockupViewport';

const MockupViewport = lazy(() => import('./MockupViewport'));

function liveKey(id: string) {
  const state = useAppStore.getState();
  const node = state.nodes.find((item) => item.id === id);
  if (!node) return undefined;
  const sources = resolveMockupSources(id, state.nodes, state.edges);
  const source = sources.find((item) => item.nodeId === node.data.mockupSourceNodeId) ?? sources[0];
  return mockupRenderKey(node.data, source);
}

function MockupNode({ id, data, selected = false, dragging = false }: NodeProps) {
  const nodeData = data as BaseNodeData;
  const nodes = useAppStore((state) => state.nodes);
  const edges = useAppStore((state) => state.edges);
  const single = useAppStore((state) => state.selectedNodeIds.length === 1);
  const [playing, setPlaying] = useState(false);
  const [failure, setFailure] = useState<{ key: string; message: string }>();
  const [retry, setRetry] = useState(0);
  const [exporting, setExporting] = useState(false);
  const viewer = useRef<MockupViewportHandle>(null);
  const alive = useRef(true);
  const saving = useRef<string | undefined>(undefined);
  const angleGesture = useRef(false);
  const { displayLabel, handleRename } = useNodeRename(id, nodeData, '样机');
  const sources = useMemo(() => resolveMockupSources(id, nodes, edges), [id, nodes, edges]);
  const source = sources.find((item) => item.nodeId === nodeData.mockupSourceNodeId) ?? sources[0];
  const device = mockupDevice(nodeData.mockupDeviceId);
  const angle = clampFoldAngle(nodeData.mockupFoldAngle);
  const key = mockupRenderKey(nodeData, source);
  const snapshotValid = nodeData.mockupSnapshotKey === key && Boolean(nodeData.imageUrl);
  const editable = selected && single && !dragging;
  const error = failure?.key === key ? failure.message : undefined;
  const showViewer = !error && (editable || !snapshotValid);
  const width = Math.max(100, Number(nodeData.nodeWidth) || 720);
  const height = Math.max(100, Number(nodeData.nodeHeight) || 720);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Never expose a stale screenshot as the downstream image after an input/settings change.
  useEffect(() => {
    if (!snapshotValid && nodeData.imageUrl) {
      useAppStore.getState().updateNodeDataTransient(id, {
        imageUrl: undefined, filePath: undefined, fileName: undefined, mockupSnapshotKey: undefined, status: 'idle',
      });
    }
  }, [id, key, snapshotValid, nodeData.imageUrl]);

  const commit = useCallback((patch: Partial<BaseNodeData>) => {
    useAppStore.getState().updateNodeData(id, patch);
  }, [id]);
  const onError = useCallback((message: string) => setFailure({ key, message }), [key]);
  const onCamera = useCallback((camera: MockupCamera) => {
    const state = useAppStore.getState();
    const previous = state.nodes.find((item) => item.id === id)?.data.mockupCamera;
    if (JSON.stringify(previous) !== JSON.stringify(camera)) state.updateNodeData(id, { mockupCamera: camera });
  }, [id]);
  const onCapture = useCallback((capture: MockupCapture) => {
    const state = useAppStore.getState();
    const current = state.nodes.find((item) => item.id === id)?.data;
    if (current?.mockupSnapshotKey === key || saving.current === key || liveKey(id) !== key) return;
    saving.current = key;
    void saveMockupSnapshot(id, capture, false, () => alive.current && liveKey(id) === key, key)
      .catch(() => { if (alive.current) onError('预览保存失败，请重试'); })
      .finally(() => { if (saving.current === key) saving.current = undefined; });
  }, [id, key, onError]);
  const outputImage = async () => {
    if (!viewer.current || exporting) return;
    setExporting(true);
    try {
      const capture = viewer.current.capture();
      const saved = await saveMockupSnapshot(id, capture, true, () => alive.current && liveKey(id) === key);
      if (!saved && alive.current) useAppStore.getState().showToast('画布状态已变化，请重新截图', 'info');
    } catch (cause) { onError(cause instanceof Error ? cause.message : '样机截图失败'); }
    finally { if (alive.current) setExporting(false); }
  };
  const beginAngle = () => {
    if (!angleGesture.current) useAppStore.getState().commitToHistory();
    angleGesture.current = true;
    setPlaying(false);
  };
  const stopAngle = () => { angleGesture.current = false; };
  const pause = () => {
    if (playing) commit({ mockupFoldAngle: clampFoldAngle(viewer.current?.angle()) });
    setPlaying(!playing);
  };
  return (
    <div className="node-wrapper relative mockup-node-wrapper">
      <NodeLabel kind="mockup" label={displayLabel} nodeId={id} onRename={handleRename} />
      <div className={`node mockup-node ${selected ? 'selected' : ''}`} style={{ width, height }}>
        <Handle type="source" position={Position.Left} id="left" className="node-handle handle-source handle-image" />
        <Handle type="source" position={Position.Right} id="right" className="node-handle handle-source handle-image" />
        <div className={`mockup-content ${editable ? 'nodrag nopan' : ''}`}>
          {showViewer ? (
            <Suspense fallback={<div className="mockup-message">正在加载 3D 样机…</div>}>
              <MockupViewport key={`${device.id}:${source?.nodeId}:${retry}`} ref={viewer}
                deviceId={device.id} imageUrl={source?.url} camera={nodeData.mockupCamera}
                angle={angle} playing={playing && editable} interactive={editable}
                onCapture={onCapture} onCamera={onCamera} onError={onError} />
            </Suspense>
          ) : snapshotValid ? <img className="mockup-snapshot" src={nodeData.imageUrl} alt={`${device.label} 样机`} draggable={false} /> : null}
          {error && <div className="mockup-message nodrag nopan" role="alert">
            <span>{error}</span><button type="button" className="ui-btn ui-btn--sm" onClick={() => { setFailure(undefined); setRetry((value) => value + 1); }}>重试</button>
          </div>}
        </div>
        <NodeResizeHandles nodeId={id} isVisible={selected} minWidth={100} minHeight={100} />
      </div>
      <NodeToolbarShell visible={editable} isDragging={dragging}>
        <div className="mockup-toolbar nodrag nopan" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          {sources.length > 1 && <Select size="sm" fixedMenu aria-label="样机输入图片" value={source?.nodeId ?? ''}
            options={sources.map((item) => ({ value: item.nodeId, label: item.label }))}
            onChange={(value) => commit({ mockupSourceNodeId: value })} />}
          {device.id === 'iphone-duo' && <>
            <button type="button" className="ui-btn ui-btn--sm ui-btn--ghost" aria-pressed={playing} onClick={pause}>{playing ? '暂停' : '播放'}</button>
            <input type="range" min="0" max="180" step="1" value={angle} aria-label="折叠角度"
              onPointerDown={beginAngle} onPointerUp={stopAngle} onPointerCancel={stopAngle}
              onKeyDown={beginAngle} onKeyUp={stopAngle} onBlur={stopAngle}
              onChange={(event) => { beginAngle(); useAppStore.getState().updateNodeDataTransient(id, { mockupFoldAngle: Number(event.target.value) }); }} />
            <span className="mockup-angle">{Math.round(angle)}°</span>
          </>}
          <button type="button" className="ui-btn ui-btn--sm ui-btn--ghost" onClick={() => viewer.current?.reset()}>重置视角</button>
          <button type="button" className="ui-btn ui-btn--sm" disabled={exporting || Boolean(error)} onClick={() => void outputImage()}>{exporting ? '正在截图…' : '截图为图片'}</button>
        </div>
      </NodeToolbarShell>
      <NodeToolbarShell visible={editable} isDragging={dragging} placement="bottom">
        <div className="mockup-dock nodrag nopan" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <div className="mockup-devices" role="group" aria-label="选择样机类型">
            {MOCKUP_DEVICES.map((item) => <button key={item.id} type="button"
              className={`ui-btn ui-btn--sm ui-btn--ghost ${item.id === device.id ? 'is-active' : ''}`} aria-pressed={item.id === device.id}
              onClick={() => { setPlaying(false); commit({ mockupDeviceId: item.id, mockupCamera: undefined }); }}>{item.label}</button>)}
          </div>
          <p>{source ? '拖动设备旋转 · 拖动卡片边缘移动 · 滚轮缩放画布' : '把图片卡片连到左侧 +，即可替换屏幕内容'}</p>
        </div>
      </NodeToolbarShell>
    </div>
  );
}
export default memo(MockupNode);
