/* ★ 模型名唯一出口：界面只显示 displayName */
import { displayNameOfModelRef } from '../../services/models/display';
import Select from '../shared/Select';
import { Icon } from '@iconify/react';
import { Handle, Position } from '@xyflow/react';
import { memo, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { BaseNodeData } from '../../types';
import type { PluginJsonValue } from '../../types/plugin';
import { buildPluginModelCatalog } from '../../services/plugins/pluginModelCatalog';
import {
  executePluginNode,
  getAvailablePluginNodes,
} from '../../services/plugins/pluginRuntime';

function jsonRecord(value: unknown): Record<string, PluginJsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, PluginJsonValue>
    : {};
}

function PluginNode({ id, data, selected }: { id: string; data: BaseNodeData; selected?: boolean }) {
  const plugins = useAppStore((state) => state.installedPlugins);
  const config = useAppStore((state) => state.config);
  const updateNodeData = useAppStore((state) => state.updateNodeData);
  const showToast = useAppStore((state) => state.showToast);
  const [busy, setBusy] = useState(false);
  const available = useMemo(
    () => getAvailablePluginNodes(plugins).find((item) => (
      item.pluginId === data.pluginId && item.node.id === data.pluginNodeId
    )),
    [data.pluginId, data.pluginNodeId, plugins],
  );
  const values = jsonRecord(data.pluginValues);
  const outputs = jsonRecord(data.pluginOutputs);
  const categories = useMemo(
    () => available
      ? [...new Set(available.node.fields.flatMap((field) => field.modelCategories ?? []))]
      : [],
    [available],
  );
  const models = useMemo(
    () => buildPluginModelCatalog(config, categories),
    [categories, config],
  );

  const setValue = (fieldId: string, value: PluginJsonValue) => {
    updateNodeData(id, { pluginValues: { ...values, [fieldId]: value } });
  };

  const run = async () => {
    if (!available || busy) return;
    setBusy(true);
    try {
      await executePluginNode(available, id, models);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '插件节点执行失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!available) {
    return (
      <div className="w-80 rounded-xl border border-red-500/30 bg-card p-4 text-xs text-text-text-secondary">
        <div className="font-medium text-red-300">插件节点不可用</div>
        <div className="mt-1">请重新安装或启用插件：{String(data.pluginId || '未知插件')}</div>
      </div>
    );
  }

  return (
    <div className={`w-80 rounded-xl border bg-card shadow-xl transition-colors ${selected ? 'border-primary' : 'border-border'}`}>
      {available.node.inputs.map((port, index) => (
        <Handle
          key={port.id}
          id={`plugin-in-${port.id}`}
          type="target"
          position={Position.Left}
          style={{ top: `${((index + 1) / (available.node.inputs.length + 1)) * 100}%` }}
          title={`${port.label} · ${port.type}`}
        />
      ))}
      {available.node.outputs.map((port, index) => (
        <Handle
          key={port.id}
          id={`plugin-out-${port.id}`}
          type="source"
          position={Position.Right}
          style={{ top: `${((index + 1) / (available.node.outputs.length + 1)) * 100}%` }}
          title={`${port.label} · ${port.type}`}
        />
      ))}

      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-accent-primary">
          <Icon icon={available.node.icon} width={17} height={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-foreground">{available.node.title}</div>
          <div className="truncate text-[10px] text-text-text-tertiary">{available.pluginName}</div>
        </div>
        <button
          type="button"
          className="nodrag rounded-md bg-primary px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          disabled={busy}
          onClick={() => void run()}
        >
          {busy ? '运行中…' : '运行'}
        </button>
      </header>

      <div className="nodrag nowheel max-h-96 space-y-3 overflow-y-auto p-3">
        {available.node.description && (
          <p className="text-[11px] leading-4 text-text-text-tertiary">{available.node.description}</p>
        )}
        {available.node.fields.map((field) => {
          const value = values[field.id];
          const baseClass = 'mt-1 w-full rounded-md border border-border bg-secondary px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary/60';
          return (
            <label key={field.id} className="block text-[11px] text-text-text-secondary">
              <span>{field.label}{field.required && <span className="ml-1 text-red-400">*</span>}</span>
              {field.type === 'textarea' ? (
                <textarea
                  className={`${baseClass} resize-y`}
                  rows={3}
                  value={typeof value === 'string' ? value : ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setValue(field.id, event.currentTarget.value)}
                />
              ) : field.type === 'select' ? (
                <Select fixedMenu
                  className="min-w-0"
                  value={typeof value === 'string' ? value : ''}
                  onChange={(selectedOptionValue) => setValue(field.id, selectedOptionValue)}
                >
                  <option value="">{field.placeholder || '请选择'}</option>
                  {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              ) : field.type === 'boolean' ? (
                <input
                  className="ml-2 align-middle accent-primary"
                  type="checkbox"
                  checked={value === true}
                  onChange={(event) => setValue(field.id, event.currentTarget.checked)}
                />
              ) : field.type === 'model' ? (
                <Select fixedMenu
                  className="min-w-0"
                  value={typeof value === 'string' ? value : ''}
                  onChange={(selectedOptionValue) => setValue(field.id, selectedOptionValue)}
                >
                  <option value="">{models.length > 0 ? '选择可调用模型' : '暂无可调用模型'}</option>
                  {models
                    .filter((model) => field.modelCategories?.includes(model.category))
                    .map((model) => <option key={model.id} value={model.id}>{displayNameOfModelRef(model.id)} · {model.category}</option>)}
                </Select>
              ) : (
                <input
                  className={baseClass}
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={typeof value === 'string' || typeof value === 'number' ? value : ''}
                  placeholder={field.placeholder}
                  onChange={(event) => setValue(
                    field.id,
                    field.type === 'number' ? Number(event.currentTarget.value) : event.currentTarget.value,
                  )}
                />
              )}
              {field.description && <span className="mt-1 block text-[10px] text-text-text-tertiary">{field.description}</span>}
            </label>
          );
        })}
        {Object.keys(outputs).length > 0 && (
          <div className="rounded-md border border-border bg-secondary p-2 text-[10px] text-text-text-secondary">
            {available.node.outputs.map((port) => outputs[port.id] === undefined ? null : (
              <div key={port.id} className="truncate"><span className="text-text-text-tertiary">{port.label}：</span>{String(outputs[port.id])}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PluginNode);
