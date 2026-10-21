/**
 * settings/FileAppSettings — 文件与应用设置子页。
 * 展示并配置项目数据目录、默认根目录与应用可执行文件目录，
 * 支持在系统文件管理器中打开这些目录，并监听磁盘变更事件刷新路径。
 *
 * 版式 = **官方设计语言**（官方设置面板里没有「文件与应用」这一页）：
 *   · 外壳 `SettingsPaneBody` + 面板头 `SettingsPaneHeader`（18/500 #f5f5f5 + 14 #7a7a7a）
 *   · 每项 = 官方 `SettingsRow`（`section`：`flex w-full flex-col gap-4 border-b border-border/60 pb-5`，
 *     左 `h3` 14/500 #f5f5f5 + `p` 14 #7a7a7a）；路径这种长值放不进两栏 ⇒ `stacked`
 *   · 只读长路径 = `.o-path`（官方 Input 的边框/圆角/内边距，但**可换行**，避免被 `h-9` 裁掉）
 *   · 动作 = 官方 Button（`.o-btn`）
 */
import { useEffect, useState } from 'react';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { Icon } from '@iconify/react';
import { useShallow } from 'zustand/react/shallow';
import {
  getAppExecutableDir,
  getBaseDir,
  getDefaultBaseDir,
  getProjectDataDir,
  openDirectoryInFileManager,
  PROJECT_DISK_CHANGED_EVENT,
} from '../../services/fileService';
import { useAppStore } from '../../store/useAppStore';
import {
  chooseDirectorBlenderInstallation,
  detectDirectorBlenderInstallation,
  type DirectorBlenderInstallationCandidate,
} from '../../services/directorBlenderRuntimeService';
import { OfficialButton } from './official/OfficialControls';
import { SettingsPaneBody, SettingsPaneHeader, SettingsRow } from './SettingsPane';
import { useT } from '../../i18n';

interface ExternalEditorRow {
  id: string;
  label: string;
  path?: string;
  description: string;
  onChoose: () => Promise<void>;
}

function formatBlenderInstallation(candidate: DirectorBlenderInstallationCandidate): string {
  const version = candidate.versionHint?.trim();
  if (!version || candidate.displayName.includes(version)) return candidate.displayName;
  return `${candidate.displayName} · ${version}`;
}

export default function FileAppSettings({ active }: { active: boolean }) {
  const t = useT();
  const { config, updateConfig, saveConfig, currentProjectId } = useAppStore(useShallow((state) => ({
    config: state.config,
    updateConfig: state.updateConfig,
    saveConfig: state.saveConfig,
    currentProjectId: state.currentProjectId,
  })));
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [defaultBaseDir, setDefaultBaseDir] = useState<string | null>(null);
  const [appExecutableDir, setAppExecutableDir] = useState<string | null>(null);
  const [dirLoading, setDirLoading] = useState(false);
  const [blenderInstallation, setBlenderInstallation] =
    useState<DirectorBlenderInstallationCandidate | null>(null);
  const [blenderLoading, setBlenderLoading] = useState(true);
  const [blenderError, setBlenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const refreshDirectories = () => {
      setDirLoading(true);
      Promise.all([
        currentProjectId ? getProjectDataDir(currentProjectId) : Promise.resolve(null),
        getDefaultBaseDir(),
        getAppExecutableDir(),
      ])
        .then(([nextProjectDir, nextDefaultBaseDir, nextAppExecutableDir]) => {
          if (cancelled) return;
          setProjectDir(nextProjectDir);
          setDefaultBaseDir(nextDefaultBaseDir);
          setAppExecutableDir(nextAppExecutableDir);
        })
        .catch(() => {
          if (cancelled) return;
          setProjectDir(null);
          setDefaultBaseDir(null);
          setAppExecutableDir(null);
        })
        .finally(() => {
          if (!cancelled) setDirLoading(false);
        });
    };
    refreshDirectories();
    window.addEventListener(PROJECT_DISK_CHANGED_EVENT, refreshDirectories);
    return () => {
      cancelled = true;
      window.removeEventListener(PROJECT_DISK_CHANGED_EVENT, refreshDirectories);
    };
  }, [active, currentProjectId]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void detectDirectorBlenderInstallation()
      .then((candidate) => {
        if (cancelled) return;
        setBlenderInstallation(candidate);
        setBlenderError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        setBlenderInstallation(null);
        setBlenderError(error instanceof Error ? error.message : 'Blender 安装检测失败');
      })
      .finally(() => {
        if (!cancelled) setBlenderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active]);

  const chooseDirectory = async (
    title: string,
    patch: (path: string) => Record<string, string>,
  ) => {
    try {
      const selected = await openDialog({ directory: true, title });
      if (selected && typeof selected === 'string') {
        updateConfig(patch(selected));
        await saveConfig();
      }
    } catch {
      useAppStore.getState().showToast(t('目录选择或保存失败，请重试'), 'error');
    }
  };

  const chooseApplication = async (
    title: string,
    name: string,
    patch: (path: string) => Record<string, string>,
  ) => {
    try {
      const selected = await openDialog({
        multiple: false,
        title,
        filters: [{ name, extensions: ['exe', 'app'] }],
      });
      if (selected && typeof selected === 'string') {
        updateConfig(patch(selected));
        await saveConfig();
      }
    } catch {
      useAppStore.getState().showToast(t('程序选择或保存失败，请重试'), 'error');
    }
  };

  const chooseBlender = async () => {
    setBlenderLoading(true);
    setBlenderError(null);
    try {
      setBlenderInstallation(await chooseDirectorBlenderInstallation());
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setBlenderError(error instanceof Error ? error.message : 'Blender 选择失败');
      }
    } finally {
      setBlenderLoading(false);
    }
  };

  const baseDataDir = config.baseDataDir;
  const editors: ExternalEditorRow[] = [
    {
      id: 'photoshop',
      label: 'Photoshop',
      path: config.photoshopPath,
      description: t('用于图片节点的「在 PS 中打开」'),
      onChoose: () => chooseApplication(t('选择 Photoshop.exe'), 'Photoshop', (photoshopPath) => ({ photoshopPath })),
    },
    {
      id: 'jianying',
      label: '剪映专业版',
      path: config.jianyingPath,
      description: t('用于视频节点的「在剪映中打开」'),
      onChoose: () => chooseApplication(t('选择剪映专业版'), '剪映专业版', (jianyingPath) => ({ jianyingPath })),
    },
    {
      id: 'premiere',
      label: 'Adobe Premiere Pro',
      path: config.premierePath,
      description: t('用于视频节点的「在 PR 中打开」'),
      onChoose: () => chooseApplication(t('选择 Adobe Premiere Pro'), 'Adobe Premiere Pro', (premierePath) => ({ premierePath })),
    },
  ];

  return (
    <SettingsPaneBody>
      <SettingsPaneHeader
        title={t('文件与应用')}
        description={t('项目数据目录、保存根目录与外部编辑器路径。')}
      />

      <div className="o-stack mt-8">
        <SettingsRow
          stacked
          title={t('保存根目录')}
          description={`${t('文件保存为：')}${baseDataDir || t('系统目录')}/{项目ID}/...`}
        >
          <div className="o-inline">
            <div className={baseDataDir ? 'o-path o-mono flex-1' : 'o-path o-path--empty flex-1'}>
              {baseDataDir || t('未设置（使用系统默认目录）')}
            </div>
            <OfficialButton
              variant="default"
              size="sm"
              className="shrink-0"
              onClick={() => chooseDirectory(t('选择文件保存根目录'), (path) => ({ baseDataDir: path }))}
            >
              {baseDataDir ? t('更换') : t('选择文件夹')}
            </OfficialButton>
          </div>
        </SettingsRow>

        <SettingsRow stacked title={t('应用所在目录')} description={t('MTV 主程序所在的目录。')}>
          <div className={dirLoading || !appExecutableDir
            ? 'o-path o-path--empty'
            : 'o-path o-mono'}
          >
            {dirLoading ? t('加载中…') : appExecutableDir || t('仅在 Tauri 桌面环境中可用')}
          </div>
        </SettingsRow>

        <SettingsRow stacked title={t('默认存储目录')} description={t('未手动指定保存根目录时使用的系统默认位置。')}>
          <div className={dirLoading || !defaultBaseDir
            ? 'o-path o-path--empty'
            : 'o-path o-mono'}
          >
            {dirLoading ? t('加载中…') : defaultBaseDir || t('仅在 Tauri 桌面环境中可用')}
          </div>
        </SettingsRow>

        <SettingsRow stacked title={t('当前项目目录')} description={t('当前画布的项目数据实际落盘位置。')}>
          {dirLoading ? (
            <div className="o-muted-t text-xs">{t('加载中…')}</div>
          ) : projectDir ? (
            <div className="o-inline">
              <div className="o-path o-mono flex-1">{projectDir}</div>
              <OfficialButton
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={async () => {
                  try {
                    const dir = baseDataDir || await getBaseDir();
                    if (dir) await openDirectoryInFileManager(dir);
                  } catch (error) {
                    console.warn('无法打开文件夹:', error);
                  }
                }}
              >
                <Icon icon="lucide:folder-open" width={16} />
                {t('打开文件夹')}
              </OfficialButton>
            </div>
          ) : (
            <div className="o-muted-t text-xs">{t('仅在 Tauri 桌面环境中可用')}</div>
          )}
        </SettingsRow>

        <div className="o-section__head">
          <div>
            <div className="o-section__title">{t('外部编辑器')}</div>
            <p className="o-section__desc">
              {t('手动路径优先，未设置时自动检测常见安装位置。')}
            </p>
          </div>
        </div>

        {editors.map((editor) => (
          <SettingsRow key={editor.id} stacked title={editor.label} description={editor.description}>
            <div className="o-inline">
              <div className={editor.path ? 'o-path o-mono flex-1' : 'o-path o-path--empty flex-1'}>
                {editor.path || t('未设置（自动检测）')}
              </div>
              <OfficialButton
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => { void editor.onChoose(); }}
              >
                {editor.path ? t('更换') : t('选择文件')}
              </OfficialButton>
            </div>
          </SettingsRow>
        ))}

        <SettingsRow
          stacked
          title="Blender"
          description={t('自动检测常见安装位置；多个版本可手动选择。Windows 选择 blender.exe，macOS 选择 Blender.app。记住本机选择，每次启动前重新校验。')}
        >
          <div className="o-inline">
            <div className={blenderInstallation ? 'o-path o-mono flex-1' : 'o-path o-path--empty flex-1'}>
              {blenderLoading
                ? t('检测中…')
                : blenderInstallation
                  ? formatBlenderInstallation(blenderInstallation)
                  : t('未检测到唯一安装，请选择 Blender 应用')}
            </div>
            <OfficialButton
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={blenderLoading}
              onClick={() => { void chooseBlender(); }}
            >
              {blenderInstallation ? t('重新选择') : t('选择 Blender')}
            </OfficialButton>
          </div>
          {blenderError && (
            <p className="o-field__error" role="alert">{blenderError}</p>
          )}
        </SettingsRow>
      </div>
    </SettingsPaneBody>
  );
}
