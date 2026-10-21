/**
 * settings/PluginSettings —— 「插件」页签（安装 / 市场 / 已安装清单 / 开发规范）
 *
 * 版式 = **官方设计语言**（官方设置面板里没有「插件」这一页）：
 *   · 外壳 `SettingsPaneBody` + 面板头 `SettingsPaneHeader`（18/500 #f5f5f5 + 14 #7a7a7a）
 *   · 每项 = 官方 `SettingsRow`（`section`：`flex w-full flex-col gap-4 border-border/60 border-b pb-5`）
 *   · 卡片 = 官方 `.o-card` / `.o-card__row`；标签 = 官方 Badge（`.o-badge--*`）
 *   · 市场条目里的 `<details>` = 官方 chip 形态的 `summary`（`.o-kind`）+ `.o-details__body`
 *   · 开发规范弹窗 = 官方 Dialog（`.o-dialog o-dialog--lg`：Header / Body / Footer）
 *   · 拖放区官方没有对应组件 ⇒ 官方 token 组合的 `.o-dropzone`（虚线边 / 圆形图标座 / 12px 说明）
 *   ⚠️ 行为一字未改：Manifest 校验、Python 二次确认、原生拖拽事件、注册表修复全在。
 */
import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import pluginDeveloperGuide from '../../../doc/插件开发规范.md?raw';
import { isTauriEnv, saveBinaryToLocalFile } from '../../services/fileService';
import { readLocalPluginPackage, selectNativePluginDirectory } from '../../services/fs/pluginPackageFiles';
import { confirmAction } from '../../services/confirmDialog';
import {
  comparePluginVersions,
  loadPluginMarketplace,
  resolveGithubPlugin,
} from '../../services/plugins/pluginMarketplace';
import type { PluginMarketplaceItem } from '../../services/plugins/pluginMarketplace';
import { parsePluginManifest } from '../../services/plugins/pluginManifest';
import { getPythonPluginRuntimeStatus } from '../../services/plugins/pluginRuntime';
import { useAppStore } from '../../store/useAppStore';
import { getNodeTypeConfig } from '../../types';
import type {
  PluginCategory,
  PluginManifest,
  PluginPackageResourcePayload,
  PythonPluginRuntimeStatus,
} from '../../types/plugin';
import ChatMarkdown from '../chat/ChatMarkdown';
import ModalOverlay from '../shared/ModalOverlay';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow } from './SettingsPane';
import {
  OfficialBadge,
  OfficialButton,
  OfficialInput,
  OfficialNote,
} from './official/OfficialControls';

const CATEGORY_LABELS: Record<PluginCategory, string> = {
  content: '内容处理',
  media: '媒体处理',
  workflow: '工作流',
  utility: '通用工具',
};

function isUpdateAvailable(latest: string, current: string): boolean {
  try {
    return comparePluginVersions(latest, current) > 0;
  } catch {
    return latest !== current;
  }
}

const EXAMPLE_MANIFEST = JSON.stringify({
  apiVersion: 1,
  id: 'com.ai-canvas.example-uppercase',
  name: '文本大写示例',
  version: '1.0.0',
  author: 'MTV 导演画布',
  description: '演示如何读取文本节点输出并写回结构化结果',
  category: 'content',
  keywords: ['文本', '示例'],
  entry: 'main.js',
  permissions: ['node.read', 'node.write', 'models.read', 'models.invoke'],
  contributes: {
    nodeTools: [{
      id: 'uppercase-output',
      title: '输出转大写',
      description: '把当前节点的 output 转为大写',
      placements: ['node-context-menu', 'node-toolbar'],
      icon: 'lucide:case-upper',
      dialog: {
        title: '输出转大写',
        description: '可选填写前缀；确认后插件会处理当前节点输出。',
        submitLabel: '转换',
        fields: [{
          id: 'prefix',
          label: '结果前缀',
          type: 'text',
          placeholder: '例如：标题：',
        }],
      },
      nodeTypes: ['ai-text', 'source-text'],
      inputFields: ['output'],
      output: { mode: 'update-current', fields: ['output'] },
    }],
    nodes: [{
      id: 'prompt-writer',
      title: '提示词写作节点',
      description: '选择已配置模型生成文本，可连接其他文本节点作为上下文。',
      icon: 'lucide:sparkles',
      inputs: [{ id: 'context', label: '上下文', type: 'text', multiple: true }],
      outputs: [{ id: 'result', label: '文本结果', type: 'text' }],
      fields: [
        { id: 'prompt', label: '提示词', type: 'textarea', required: true },
        { id: 'model', label: '模型', type: 'model', modelCategories: ['text'], required: true },
      ],
    }],
  },
}, null, 2);

const EXAMPLE_SOURCE = `definePlugin({
  tools: {
    "uppercase-output": (input) => ({
      data: {
        output: String(input.parameters.prefix || "") + String(input.node.data.output || "").toUpperCase()
      },
      message: "已将节点输出转换为大写"
    }),
    "prompt-writer": (input) => {
      if (!input.effectResult) {
        return {
          effect: {
            type: "model.generate",
            modelId: String(input.node.values.model || ""),
            prompt: [String(input.node.values.prompt || ""), ...(input.inputs.context || [])].join("\\n")
          }
        };
      }
      if (!input.effectResult.ok) throw new Error(input.effectResult.error || "模型调用失败");
      return {
        data: { outputs: { result: String(input.effectResult.value.text || "") } },
        message: "文本生成完成"
      };
    }
  }
});`;

const PYTHON_EXAMPLE_MANIFEST = JSON.stringify({
  apiVersion: 1,
  runtime: 'python',
  id: 'com.ai-canvas.example-python-uppercase',
  name: 'Python 文本大写示例',
  version: '1.0.0',
  author: 'MTV 导演画布',
  description: '演示可信 Python 插件读取文本节点并返回结构化结果',
  category: 'content',
  keywords: ['Python', '文本', '示例'],
  entry: 'main.py',
  permissions: ['node.read', 'node.write'],
  contributes: {
    nodeTools: [{
      id: 'python-uppercase-output',
      title: 'Python 输出转大写',
      placements: ['node-context-menu'],
      nodeTypes: ['ai-text', 'source-text'],
      inputFields: ['output'],
      output: { mode: 'update-current', fields: ['output'] },
    }],
  },
}, null, 2);

const PYTHON_EXAMPLE_SOURCE = `def uppercase_output(input_value):
    output = str(input_value["node"]["data"].get("output", ""))
    return {
        "data": {"output": output.upper()},
        "message": "已使用本机 Python 转换输出",
    }

define_plugin({"tools": {"python-uppercase-output": uppercase_output}})
`;

const PLUGIN_GUIDE_FILE_NAME = 'AI-Canvas-插件开发规范.md';
const MAX_DROPPED_PLUGIN_FILES = 256;
const IGNORED_PLUGIN_METADATA_ENTRIES = new Set(['.git', '.hg', '.svn']);

interface PluginUploadFile {
  file: File;
  path: string;
}

type PluginDirectoryPickerResult = string | string[] | null;

// 插件安装只消费 Manifest 声明的产物，版本库内部文件不属于插件包。
// eslint-disable-next-line react-refresh/only-export-components
export function isIgnoredPluginMetadataEntry(name: string): boolean {
  return IGNORED_PLUGIN_METADATA_ENTRIES.has(name.trim().toLocaleLowerCase());
}

// 独立导出用于验证桌面/浏览器分流；无组件状态或模块级副作用。
// eslint-disable-next-line react-refresh/only-export-components
export async function routePluginDirectorySelection({
  tauri,
  openNativeDirectory,
  openBrowserDirectory,
  installFromPaths,
}: {
  tauri: boolean;
  openNativeDirectory: () => Promise<PluginDirectoryPickerResult>;
  openBrowserDirectory: () => void;
  installFromPaths: (paths: string[]) => Promise<void>;
}): Promise<void> {
  if (!tauri) {
    openBrowserDirectory();
    return;
  }

  const selected = await openNativeDirectory();
  const directory = Array.isArray(selected) ? selected[0] : selected;
  if (typeof directory === 'string' && directory.trim()) {
    await installFromPaths([directory]);
  }
}

const PLUGIN_PERMISSION_LABELS: Record<string, string> = {
  'node.read': '读取声明的画布节点字段',
  'node.write': '修改节点或创建插件节点',
  'models.read': '读取脱敏模型目录',
  'models.invoke': '调用可能产生费用的模型',
  'files.connected.read': '读取当前节点及直接输入连线的项目资源',
  'files.output.create': '在当前项目目录创建新的文本输出',
  'plugin.resources.read': '读取当前插件 revision 声明的包资源',
  'ui.custom': '在主窗口隔离弹窗中运行自定义界面代码（可能影响界面响应）',
};

function permissionSummary(manifest: PluginManifest): string {
  return manifest.permissions
    .map((permission) => PLUGIN_PERMISSION_LABELS[permission] ?? permission)
    .join('；');
}

function pluginOperationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return fallback;
}

async function computeSourceDigest(source: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function reviewPluginInstall(
  manifest: PluginManifest,
  source: string,
  action: '安装' | '更新',
  sourceLabel: string,
): Promise<string | null> {
  const sourceDigest = await computeSourceDigest(source);
  if (manifest.runtime !== 'python') return sourceDigest;
  const confirmed = await confirmAction(
    `${action}可信 Python 插件「${manifest.name}」？\n\n`
    + `来源：${sourceLabel}\n`
    + `代码 SHA-256：${sourceDigest}\n`
    + `宿主代办权限：${permissionSummary(manifest) || '无'}\n\n`
    + 'Python 插件会以你的当前系统权限运行，可以读取或修改本机文件、访问网络和环境变量，也可以启动其他程序。'
    + '\n\n只对你信任并已审查源码的插件继续。下一步 Rust 原生确认必须显示相同的完整摘要。',
    { title: `${action}可信 Python 插件` },
  );
  return confirmed ? sourceDigest : null;
}

async function confirmTrustedPythonEnable(manifest: PluginManifest, sourceDigest?: string): Promise<boolean> {
  if (manifest.runtime !== 'python') return true;
  return confirmAction(
    `启用可信 Python 插件「${manifest.name}」？\n\n`
    + `已登记代码 SHA-256：${sourceDigest ?? '旧记录待原生迁移'}\n`
    + `宿主代办权限：${permissionSummary(manifest) || '无'}\n\n`
    + '启用后插件会以你的当前系统权限运行，可以读取或修改本机文件、访问网络和环境变量，也可以启动其他程序。'
    + '\n\n继续后还必须通过 Rust 原生确认，且完整摘要应与这里一致。',
    { title: '启用可信 Python 插件' },
  );
}

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

async function readDirectoryEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];
  while (true) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
      reader.readEntries(resolve, reject);
    });
    if (batch.length === 0) return entries;
    entries.push(...batch);
    if (entries.length > MAX_DROPPED_PLUGIN_FILES) throw new Error('插件文件夹包含的文件过多');
  }
}

async function collectDroppedEntry(
  entry: FileSystemEntry,
  parentPath: string,
  output: PluginUploadFile[],
): Promise<void> {
  if (isIgnoredPluginMetadataEntry(entry.name)) return;
  if (output.length >= MAX_DROPPED_PLUGIN_FILES) throw new Error('插件文件夹包含的文件过多');
  const path = `${parentPath}${entry.name}`;
  if (isFileEntry(entry)) {
    const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));
    output.push({ file, path });
    return;
  }
  if (!isDirectoryEntry(entry)) return;
  const entries = await readDirectoryEntries(entry);
  for (const child of entries) await collectDroppedEntry(child, `${path}/`, output);
}

async function droppedPluginFiles(dataTransfer: DataTransfer): Promise<PluginUploadFile[]> {
  const entries = Array.from(dataTransfer.items)
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => Boolean(entry));

  if (entries.length === 0) {
    return Array.from(dataTransfer.files).map((file) => ({ file, path: file.name }));
  }
  const files: PluginUploadFile[] = [];
  for (const entry of entries) await collectDroppedEntry(entry, '', files);
  return files;
}

/** 声明了 ui 的插件必须同时带上界面产物，否则 Rust 侧会以「缺少界面产物」拒绝暂存。 */
async function resolveUiSource(
  files: PluginUploadFile[],
  prefix: string,
  manifest: PluginManifest,
): Promise<string | undefined> {
  if (!manifest.ui) return undefined;
  const target = `${prefix}${manifest.ui.entry}`;
  const found = files.find(({ path }) => path === target);
  if (!found) throw new Error(`插件声明了自定义界面，但同级目录缺少 ${manifest.ui.entry}`);
  return found.file.text();
}

async function resolveResourcePayloads(
  files: PluginUploadFile[],
  prefix: string,
  manifest: PluginManifest,
): Promise<PluginPackageResourcePayload[]> {
  return Promise.all((manifest.resources ?? []).map(async (resource) => {
    const target = `${prefix}${resource.path}`;
    const found = files.find(({ path }) => path === target);
    if (!found) throw new Error(`插件包缺少资源 ${resource.path}`);
    if (found.file.size !== resource.bytes) throw new Error(`插件包资源 ${resource.path} 字节数不匹配`);
    return { id: resource.id, bytes: Array.from(new Uint8Array(await found.file.arrayBuffer())) };
  }));
}

export default function PluginSettings() {
  const inputRef = useRef<HTMLInputElement>(null);
  const plugins = useAppStore((state) => state.installedPlugins);
  const installPluginBundle = useAppStore((state) => state.installPluginBundle);
  const setPluginEnabled = useAppStore((state) => state.setPluginEnabled);
  const deletePlugin = useAppStore((state) => state.deletePlugin);
  const pluginRegistryRepairRequired = useAppStore((state) => state.pluginRegistryRepairRequired);
  const repairPluginRegistry = useAppStore((state) => state.repairPluginRegistry);
  const showToast = useAppStore((state) => state.showToast);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [marketplaceItems, setMarketplaceItems] = useState<PluginMarketplaceItem[]>([]);
  const [marketplaceLoading, setMarketplaceLoading] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState('');
  const [marketplaceQuery, setMarketplaceQuery] = useState('');
  const [repositoryInput, setRepositoryInput] = useState('');
  const [installingRepository, setInstallingRepository] = useState('');
  const [pythonStatus, setPythonStatus] = useState<PythonPluginRuntimeStatus | null>(null);
  const [pythonChecking, setPythonChecking] = useState(false);
  const [registryRepairing, setRegistryRepairing] = useState(false);
  const installedRepositories = useMemo(
    () => plugins.flatMap((plugin) => plugin.manifest.repository ? [plugin.manifest.repository] : []),
    [plugins],
  );

  const refreshMarketplace = useCallback(async (force = false) => {
    setMarketplaceLoading(true);
    setMarketplaceError('');
    try {
      setMarketplaceItems(await loadPluginMarketplace(installedRepositories, { force }));
    } catch (error) {
      setMarketplaceError(error instanceof Error ? error.message : '插件市场加载失败');
    } finally {
      setMarketplaceLoading(false);
    }
  }, [installedRepositories]);

  const refreshPythonStatus = useCallback(async () => {
    if (!isTauriEnv()) {
      setPythonStatus({ available: false, error: '请在 Tauri 桌面版中检测本机 Python' });
      return;
    }
    setPythonChecking(true);
    try {
      setPythonStatus(await getPythonPluginRuntimeStatus());
    } catch (error) {
      setPythonStatus({
        available: false,
        error: error instanceof Error ? error.message : 'Python 环境检测失败',
      });
    } finally {
      setPythonChecking(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshMarketplace(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshMarketplace]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshPythonStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshPythonStatus]);

  const visibleMarketplaceItems = useMemo(() => {
    const query = marketplaceQuery.trim().toLocaleLowerCase();
    if (!query) return marketplaceItems;
    return marketplaceItems.filter((item) => {
      if (item.status === 'error') return item.repository.toLocaleLowerCase().includes(query);
      return [
        item.manifest.name,
        item.manifest.description,
        item.manifest.author,
        item.repository,
        ...(item.manifest.keywords ?? []),
      ].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [marketplaceItems, marketplaceQuery]);

  const installGithubPlugin = async (repository: string, item?: PluginMarketplaceItem) => {
    if (!repository.trim() || installingRepository) return;
    setInstallingRepository(repository);
    try {
      const plugin = item?.status === 'ready'
        ? item
        : await resolveGithubPlugin(repository, { force: true });
      const action = plugins.some((installed) => installed.id === plugin.manifest.id) ? '更新' : '安装';
      const sourceDigest = await reviewPluginInstall(plugin.manifest, plugin.source, action, plugin.repository);
      if (!sourceDigest) return;
      await installPluginBundle(plugin.manifestText, plugin.source, {
        trustedPythonConfirmed: plugin.manifest.runtime === 'python',
        expectedSourceDigest: sourceDigest,
        uiSource: plugin.uiSource,
        resourcePayloads: plugin.resourcePayloads,
      });
      setRepositoryInput('');
      await refreshMarketplace(true);
    } catch (error) {
      showToast(pluginOperationErrorMessage(error, 'GitHub 插件安装失败'), 'error');
    } finally {
      setInstallingRepository('');
    }
  };

  const downloadDeveloperGuide = async () => {
    try {
      if (isTauriEnv()) {
        const savedPath = await saveBinaryToLocalFile(
          new TextEncoder().encode(pluginDeveloperGuide),
          PLUGIN_GUIDE_FILE_NAME,
          [{ name: 'Markdown 文档', extensions: ['md'] }],
        );
        if (savedPath) showToast('插件开发规范已保存');
        return;
      }

      const url = URL.createObjectURL(new Blob([pluginDeveloperGuide], { type: 'text/markdown;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = PLUGIN_GUIDE_FILE_NAME;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      showToast('插件开发规范已下载');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '插件开发规范下载失败', 'error');
    }
  };

  const installFiles = async (files: PluginUploadFile[]) => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const manifests = files.filter(({ file }) => file.name === 'manifest.json');
      if (manifests.length !== 1) throw new Error('插件文件夹必须且只能包含一个 manifest.json');
      const manifestFile = manifests[0];
      const manifestText = await manifestFile.file.text();
      const manifest = parsePluginManifest(manifestText);
      const prefix = manifestFile.path.slice(0, Math.max(0, manifestFile.path.length - manifestFile.file.name.length));
      const entryFile = files.find(({ path }) => path === `${prefix}${manifest.entry}`);
      if (!entryFile) throw new Error(`manifest.json 同级目录缺少 ${manifest.entry}`);
      const action = plugins.some((installed) => installed.id === manifest.id) ? '更新' : '安装';
      const source = await entryFile.file.text();
      const uiSource = await resolveUiSource(files, prefix, manifest);
      const resourcePayloads = await resolveResourcePayloads(files, prefix, manifest);
      const sourceDigest = await reviewPluginInstall(manifest, source, action, '本地文件夹');
      if (!sourceDigest) return;
      await installPluginBundle(manifestText, source, {
        trustedPythonConfirmed: manifest.runtime === 'python',
        expectedSourceDigest: sourceDigest,
        uiSource,
        resourcePayloads,
      });
    } catch (error) {
      showToast(pluginOperationErrorMessage(error, '插件安装失败'), 'error');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  // Tauri 原生目录选择/拖拽共用按 Manifest 读取的安装链。
  const installFromPaths = async (paths: string[], requireManifest = false) => {
    if (busy || paths.length === 0) return;
    setBusy(true);
    try {
      const bundle = await readLocalPluginPackage(paths, requireManifest);
      if (!bundle) return;
      const { manifestText, manifest, source, uiSource, resourcePayloads } = bundle;
      const action = plugins.some((installed) => installed.id === manifest.id) ? '更新' : '安装';
      const sourceDigest = await reviewPluginInstall(manifest, source, action, '本地文件夹');
      if (!sourceDigest) return;
      await installPluginBundle(manifestText, source, {
        trustedPythonConfirmed: manifest.runtime === 'python',
        expectedSourceDigest: sourceDigest,
        uiSource,
        resourcePayloads,
      });
    } catch (error) {
      showToast(pluginOperationErrorMessage(error, '插件安装失败'), 'error');
    } finally {
      setBusy(false);
    }
  };

  // 监听器只注册一次，但始终调用最新闭包（busy / plugins）
  const installFromPathsRef = useRef(installFromPaths);
  useEffect(() => {
    installFromPathsRef.current = installFromPaths;
  });

  useEffect(() => {
    if (!isTauriEnv()) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void (async () => {
      const { listen } = await import('@tauri-apps/api/event');
      if (cancelled) return;
      unlisten = await listen<{ paths: string[] }>('tauri://drag-drop', (event) => {
        void installFromPathsRef.current(event.payload?.paths ?? []);
      });
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const openPluginDirectory = async () => {
    if (busy) return;
    try {
      await routePluginDirectorySelection({
        tauri: isTauriEnv(),
        openNativeDirectory: selectNativePluginDirectory,
        openBrowserDirectory: () => inputRef.current?.click(),
        installFromPaths: (paths) => installFromPathsRef.current(paths, true),
      });
    } catch (error) {
      showToast(pluginOperationErrorMessage(error, '无法选择插件文件夹'), 'error');
    }
  };

  const togglePlugin = async (plugin: (typeof plugins)[number]) => {
    const enabled = !plugin.enabled;
    if (enabled && !(await confirmTrustedPythonEnable(plugin.manifest, plugin.sourceDigest))) return;
    await setPluginEnabled(plugin.id, enabled, {
      trustedPythonConfirmed: enabled && plugin.manifest.runtime === 'python',
    });
  };

  const handleRegistryRepair = async () => {
    if (registryRepairing) return;
    setRegistryRepairing(true);
    try {
      await repairPluginRegistry();
    } catch (error) {
      showToast(pluginOperationErrorMessage(error, '插件信任注册表修复失败'), 'error');
    } finally {
      setRegistryRepairing(false);
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    try {
      const files = await droppedPluginFiles(event.dataTransfer);
      // Tauri 原生拖拽下 DataTransfer 是空的，交给全局事件处理，避免误报和重复安装
      if (files.length === 0) return;
      await installFiles(files);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '无法读取插件文件夹', 'error');
    }
  };

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader
        title="插件"
        description="安装、启停与卸载本地插件，或从已登记的 GitHub Release 安装。"
      />

      <div className="o-stack mt-8">
        <SettingsRow
          stacked
          title="安装插件"
          description="JavaScript 插件使用 QuickJS 沙箱；可信 Python 插件使用本机 Python 和已安装依赖，并拥有当前用户的本机权限。"
        >
          <button
            type="button"
            className="o-dropzone"
            data-dragover={dragOver || undefined}
            disabled={busy}
            aria-busy={busy}
            onClick={() => void openPluginDirectory()}
            onDragOver={(event) => {
              event.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => void handleDrop(event)}
          >
            <span className="o-dropzone__title">
              {busy ? '正在校验并安装插件…' : '把插件文件夹拖到这里'}
            </span>
            <span className="o-dropzone__icon" aria-hidden="true">
              <Icon icon="lucide:upload" width={20} />
            </span>
            <span className="o-dropzone__hint">
              支持 manifest.json + main.js 或 main.py，点击这里也可以选择。
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            multiple
            {...({ webkitdirectory: '' } as Record<string, string>)}
            onChange={(event) => void installFiles(
              Array.from(event.currentTarget.files ?? []).map((file) => ({
                file,
                path: file.webkitRelativePath || file.name,
              })),
            )}
          />
        </SettingsRow>

        <SettingsRow
          title="本机 Python"
          description={
            pythonChecking
              ? '正在检测 Python 3…'
              : pythonStatus?.available
                ? `可用：${pythonStatus.command} · Python ${pythonStatus.version}`
                : pythonStatus?.error || '尚未检测'
          }
        >
          <div className="o-inline shrink-0">
            <OfficialBadge tone={pythonStatus?.available ? 'success' : 'warning'}>
              {pythonStatus?.available ? '可用' : '不可用'}
            </OfficialBadge>
            <OfficialButton
              variant="outline"
              size="sm"
              disabled={pythonChecking}
              onClick={() => void refreshPythonStatus()}
            >
              <Icon icon="lucide:refresh-cw" width={16} />
              重新检测
            </OfficialButton>
          </div>
        </SettingsRow>

        <SettingsRow
          title="插件开发规范"
          description="查看 Manifest、节点输入输出、权限和沙箱规则。"
        >
          <div className="o-inline shrink-0">
            <OfficialButton variant="outline" size="sm" onClick={() => setGuideOpen(true)}>
              <Icon icon="lucide:book-open-text" width={16} />
              查看规范
            </OfficialButton>
            <OfficialButton
              variant="outline"
              size="sm"
              aria-label="下载插件开发规范 Markdown"
              onClick={() => void downloadDeveloperGuide()}
            >
              <Icon icon="lucide:download" width={16} />
              下载
            </OfficialButton>
          </div>
        </SettingsRow>

        <SettingsRow
          title="开发者示例"
          description="安装文本工具和一个可调用模型的自定义写作节点。"
        >
          <div className="o-inline shrink-0">
            <OfficialButton
              variant="outline"
              size="sm"
              onClick={() => void installPluginBundle(EXAMPLE_MANIFEST, EXAMPLE_SOURCE).catch((error) => {
                showToast(pluginOperationErrorMessage(error, '示例插件安装失败'), 'error');
              })}
            >
              <Icon icon="lucide:file-code-2" width={16} />
              JavaScript
            </OfficialButton>
            <OfficialButton
              variant="outline"
              size="sm"
              onClick={() => void (async () => {
                const manifest = parsePluginManifest(PYTHON_EXAMPLE_MANIFEST);
                const sourceDigest = await reviewPluginInstall(
                  manifest,
                  PYTHON_EXAMPLE_SOURCE,
                  '安装',
                  '应用内置开发者示例',
                );
                if (!sourceDigest) return;
                await installPluginBundle(PYTHON_EXAMPLE_MANIFEST, PYTHON_EXAMPLE_SOURCE, {
                  trustedPythonConfirmed: true,
                  expectedSourceDigest: sourceDigest,
                });
              })().catch((error) => {
                showToast(pluginOperationErrorMessage(error, 'Python 示例安装失败'), 'error');
              })}
            >
              <Icon icon="lucide:file-code-2" width={16} />
              Python
            </OfficialButton>
          </div>
        </SettingsRow>

        <SettingsRow
          stacked
          title="插件市场"
          description="从已登记的 GitHub Release 安装插件，并检查已安装 GitHub 插件的新版本。"
        >
          <div className="o-inline">
            <input
              value={repositoryInput}
              onChange={(event) => setRepositoryInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void installGithubPlugin(repositoryInput);
              }}
              placeholder="GitHub 仓库地址，例如 owner/my-plugin"
              aria-label="GitHub 插件仓库地址"
              className="o-input min-w-0 flex-1"
            />
            <OfficialButton
              variant="default"
              size="sm"
              className="shrink-0"
              disabled={!repositoryInput.trim() || Boolean(installingRepository)}
              onClick={() => void installGithubPlugin(repositoryInput)}
            >
              {installingRepository === repositoryInput ? '读取中…' : '从仓库安装'}
            </OfficialButton>
            <OfficialButton
              variant="outline"
              size="icon-sm"
              className="shrink-0"
              aria-label="刷新插件市场"
              disabled={marketplaceLoading}
              onClick={() => void refreshMarketplace(true)}
            >
              <Icon icon="lucide:refresh-cw" width={14} className={marketplaceLoading ? 'animate-spin' : ''} />
            </OfficialButton>
          </div>

          {(marketplaceItems.length > 0 || marketplaceQuery) && (
            <OfficialInput
              value={marketplaceQuery}
              onChange={(event) => setMarketplaceQuery(event.target.value)}
              placeholder="搜索插件、作者或关键词"
              aria-label="搜索插件市场"
              leadingIcon={<Icon icon="lucide:search" width={16} />}
            />
          )}

          <div className="o-stack">
            {marketplaceLoading && marketplaceItems.length === 0 && (
              <div className="o-list__empty">正在读取 GitHub 插件列表…</div>
            )}
            {marketplaceError && (
              <OfficialNote tone="danger" icon={<Icon icon="lucide:circle-x" width={16} />}>
                {marketplaceError}
              </OfficialNote>
            )}
            {!marketplaceLoading && !marketplaceError && marketplaceItems.length === 0 && (
              <div className="o-list__empty">市场暂未收录插件，可先粘贴 GitHub 仓库地址安装。</div>
            )}
          {visibleMarketplaceItems.map((item) => {
            if (item.status === 'error') {
              return (
                <div key={item.repository} className="o-card">
                  <div className="o-card__row o-card__row--stack">
                    <div className="o-card__title o-truncate">{item.repository}</div>
                    <div className="o-field__error">{item.error}</div>
                  </div>
                </div>
              );
            }
            const installed = plugins.find((plugin) => plugin.id === item.manifest.id);
            const updateAvailable = installed
              ? isUpdateAvailable(item.manifest.version, installed.manifest.version)
              : false;
            const actionDisabled = Boolean(installed && !updateAvailable) || Boolean(installingRepository);
            return (
              <div key={item.repository} className="o-card">
                <div className="o-card__row o-card__row--center">
                  <span className="o-icon-tile o-icon-tile--primary">
                    <Icon icon="lucide:blocks" width={18} />
                  </span>
                  <div className="o-card__body">
                    <div className="o-inline o-inline--wrap">
                      <span className="o-card__title o-truncate">{item.manifest.name}</span>
                      <OfficialBadge tone="secondary">v{item.manifest.version}</OfficialBadge>
                      {item.featured && <OfficialBadge tone="warning">推荐</OfficialBadge>}
                      {item.manifest.runtime === 'python' && <OfficialBadge tone="danger">可信本机代码</OfficialBadge>}
                      {updateAvailable && <OfficialBadge tone="success">可更新</OfficialBadge>}
                    </div>
                    <p className="o-card__desc">
                      {item.manifest.description || '未提供说明'}
                    </p>
                    <details className="o-details mt-2">
                      <summary className="o-kind">详细信息</summary>
                      <div className="o-details__body">
                        <a
                          href={item.repository}
                          target="_blank"
                          rel="noreferrer"
                          className="o-link block truncate"
                        >
                          {item.repository.replace('https://github.com/', '')}
                        </a>
                        <div className="mt-1">
                          {CATEGORY_LABELS[item.manifest.category]} · 权限：{item.manifest.permissions.join('、')}
                        </div>
                      </div>
                    </details>
                  </div>
                  <OfficialButton
                    variant={updateAvailable ? 'default' : 'outline'}
                    size="sm"
                    className="shrink-0"
                    disabled={actionDisabled}
                    onClick={() => void installGithubPlugin(item.repository, item)}
                  >
                    {installingRepository === item.repository
                      ? '安装中…'
                      : updateAvailable
                        ? '更新'
                        : installed
                          ? '已安装'
                          : '安装'}
                  </OfficialButton>
                </div>
              </div>
            );
          })}
          {!marketplaceLoading && marketplaceItems.length > 0 && visibleMarketplaceItems.length === 0 && (
            <div className="o-list__empty">没有匹配的插件</div>
          )}
          </div>
        </SettingsRow>

        {pluginRegistryRepairRequired && (
          <OfficialNote tone="warning" icon={<Icon icon="lucide:shield-alert" width={16} />}>
            <div className="o-card__title">插件信任注册表需要修复</div>
            <p className="mt-1">
              原生注册表已损坏，当前插件已失败关闭。修复会停止全部插件调用并清理原生私有快照，安装记录会保留为停用状态。
            </p>
            <OfficialButton
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={registryRepairing}
              onClick={() => void handleRegistryRepair()}
            >
              {registryRepairing ? '修复中…' : '修复注册表'}
            </OfficialButton>
          </OfficialNote>
        )}

        <div className="o-list">
          {plugins.map((plugin) => {
            const nodeTypes = [...new Set(plugin.manifest.contributes.nodeTools.flatMap((tool) => tool.nodeTypes))];
            const customNodes = plugin.manifest.contributes.nodes ?? [];
            const inputFields = [...new Set(plugin.manifest.contributes.nodeTools.flatMap((tool) => tool.inputFields))];
            const outputFields = [...new Set(plugin.manifest.contributes.nodeTools.flatMap((tool) => tool.output.fields))];
            const placements = new Set(plugin.manifest.contributes.nodeTools.flatMap((tool) => tool.placements));
            const placementLabels = [
              placements.has('node-context-menu') ? '节点右键菜单' : null,
              placements.has('node-toolbar') ? '节点工具栏' : null,
            ].filter(Boolean).join('、');
            return (
              <div key={plugin.id} className="o-list__row">
                <span className="o-icon-tile o-icon-tile--primary">
                  <Icon icon="lucide:blocks" width={18} />
                </span>
                <div className="o-card__body">
                  <div className="o-inline o-inline--wrap">
                    <span className="o-card__title o-truncate">{plugin.manifest.name}</span>
                    <OfficialBadge tone="secondary">v{plugin.manifest.version}</OfficialBadge>
                    <OfficialBadge tone="primary">
                      {CATEGORY_LABELS[plugin.manifest.category]}
                    </OfficialBadge>
                    <OfficialBadge tone={plugin.manifest.runtime === 'python' ? 'danger' : 'success'}>
                      {plugin.manifest.runtime === 'python' ? 'Python · 可信本机代码' : 'JavaScript · 沙箱'}
                    </OfficialBadge>
                  </div>
                  <p className="o-card__desc">
                    {plugin.manifest.description || '未提供说明'}
                  </p>
                  <div className="o-inline o-inline--wrap mt-2">
                    {nodeTypes.map((nodeType) => (
                      <OfficialBadge key={nodeType} tone="secondary">{getNodeTypeConfig(nodeType).label}</OfficialBadge>
                    ))}
                    {customNodes.map((node) => (
                      <OfficialBadge key={node.id} tone="primary">{node.title}</OfficialBadge>
                    ))}
                  </div>
                  <details className="o-details mt-2">
                    <summary className="o-kind">详细信息</summary>
                    <div className="o-details__body">
                      API v{plugin.manifest.apiVersion} · {plugin.manifest.entry} · 入口：{placementLabels || (customNodes.length ? '节点选择器' : '未声明')}<br />
                      工具 {plugin.manifest.contributes.nodeTools.length} 个 · 自定义节点 {customNodes.length} 个<br />
                      读取：{inputFields.join('、') || '无'} · 写入：{outputFields.join('、') || '无'}<br />
                      权限：{plugin.manifest.permissions.join('、')}<br />
                      代码 SHA-256：
                      <span className="o-mono" title={plugin.sourceDigest}>{plugin.sourceDigest ?? '待原生迁移'}</span>
                    </div>
                  </details>
                </div>
                <div className="o-card__actions">
                  <OfficialButton
                    variant="ghost"
                    size="sm"
                    role="switch"
                    aria-checked={plugin.enabled}
                    onClick={() => void togglePlugin(plugin).catch((error) => {
                      showToast(error instanceof Error ? error.message : '插件状态保存失败', 'error');
                    })}
                  >
                    {plugin.enabled ? '已启用' : '已停用'}
                  </OfficialButton>
                  <OfficialButton
                    variant="ghost"
                    size="icon-sm"
                    className="o-icon-btn o-icon-btn--danger"
                    aria-label={`卸载 ${plugin.manifest.name}`}
                    onClick={() => {
                      void confirmAction(`确定卸载插件「${plugin.manifest.name}」吗？`, { title: '卸载插件' }).then((confirmed) => {
                        if (!confirmed) return;
                        void deletePlugin(plugin.id).catch((error) => {
                          showToast(error instanceof Error ? error.message : '插件卸载失败', 'error');
                        });
                      });
                    }}
                  >
                    <Icon icon="lucide:trash-2" width={16} />
                  </OfficialButton>
                </div>
              </div>
            );
          })}
          {plugins.length === 0 && (
            <div className="o-list__empty">还没有安装插件</div>
          )}
        </div>
      </div>

      <ModalOverlay
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
        ariaLabel="MTV 导演画布 插件开发规范"
        className="o-dialog o-dialog--lg"
        motionPreset="quick"
      >
        <button
          type="button"
          className="o-dialog__close"
          aria-label="关闭插件开发规范"
          onClick={() => setGuideOpen(false)}
        >
          <Icon icon="lucide:x" width={16} />
        </button>
        <header className="o-dialog__header">
          <h3 className="o-dialog__title">MTV 导演画布 插件开发规范</h3>
          <p className="o-dialog__desc">Plugin API v1 · 与当前插件运行时同步</p>
        </header>
        <div className="o-dialog__body text-[12px] leading-6" data-overlay-scrollbar="off">
          <ChatMarkdown value={pluginDeveloperGuide} />
        </div>
        <footer className="o-dialog__footer">
          <OfficialButton variant="outline" size="sm" onClick={() => void downloadDeveloperGuide()}>
            <Icon icon="lucide:download" width={16} />
            下载 Markdown
          </OfficialButton>
        </footer>
      </ModalOverlay>
    </SettingsPaneBody>
  );
}
