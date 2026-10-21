/**
 * DreaminaLoginModal — 即梦 OAuth 登录引导弹窗
 *
 * 展示官方 dreamina_cli OAuth 设备授权流程：打开授权链接 → 输入验证码 → 自动同步登录状态。
 * 运行态由父组件通过 Rust 命令 / 事件驱动传入。
 */
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import type { DreaminaRuntime } from '../../types';
import { OfficialButton, OfficialInput, OfficialNote } from './official/OfficialControls';
import { useT } from '../../i18n';

interface DreaminaLoginModalProps {
  isOpen: boolean;
  runtime: DreaminaRuntime | null;
  onClose: () => void;
  onOpenUrl: (url: string) => void;
  onCopy: (text: string, label: string) => void;
}

export default function DreaminaLoginModal({
  isOpen,
  runtime,
  onClose,
  onOpenUrl,
  onCopy,
}: DreaminaLoginModalProps) {
  const t = useT();
  const phase = runtime?.phase || 'preparing';
  const authUrl = runtime?.verificationUrl || '';
  const userCode = runtime?.userCode || '';
  const ready = phase === 'oauth_ready' || phase === 'polling';
  const waiting = phase === 'preparing' || phase === 'starting';

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-tauri-drag-region
          className="o-dialog-overlay o-dialog-stage"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
        >
          <motion.div
            className="o-dialog o-dialog--md"
            role="dialog"
            aria-modal="true"
            aria-label={t('即梦登录')}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="o-dialog__close"
              aria-label={t('关闭即梦登录窗口')}
              onClick={onClose}
            >
              <Icon icon="lucide:x" width={16} height={16} />
            </button>

            <header className="o-dialog__header">
              <h3 className="o-dialog__title">{t('即梦账号')}</h3>
              <p className="o-dialog__desc">
                {runtime?.message || t('OAuth 登录已启动，请按下方步骤完成授权。')}
              </p>
            </header>

            <div className="o-dialog__body flex flex-col gap-5">
              {waiting && (
                <div className="o-inline">
                  <Icon icon="lucide:loader-circle" width={16} className="settings-spin" />
                  <span className="o-field__desc">{t('正在准备授权链接，请稍候…')}</span>
                </div>
              )}

              {ready && (
                <div className="o-section">
                  <div className="o-section__head">
                    <div>
                      <h4 className="o-section__title">{t('OAuth 登录（2 步）')}</h4>
                    </div>
                  </div>

                  <label className="o-field">
                    <span className="o-field__label">{t('1) 打开即梦授权链接')}</span>
                    <div className="o-inline">
                      <OfficialInput
                        className="flex-1 min-w-0"
                        readOnly
                        aria-label={t('即梦授权链接')}
                        value={authUrl}
                      />
                      <OfficialButton
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={!authUrl}
                        onClick={() => authUrl && onOpenUrl(authUrl)}
                      >
                        {t('打开')}
                      </OfficialButton>
                      <OfficialButton
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!authUrl}
                        onClick={() => authUrl && onCopy(authUrl, t('授权链接'))}
                      >
                        {t('复制')}
                      </OfficialButton>
                    </div>
                  </label>

                  <label className="o-field">
                    <span className="o-field__label">{t('2) 在授权页面输入验证码')}</span>
                    <div className="o-inline">
                      <OfficialInput
                        className="flex-1 min-w-0"
                        readOnly
                        aria-label={t('即梦验证码')}
                        value={userCode}
                      />
                      <OfficialButton
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!userCode}
                        onClick={() => userCode && onCopy(userCode, t('验证码'))}
                      >
                        {t('复制验证码')}
                      </OfficialButton>
                    </div>
                  </label>

                  <span className="o-state o-state--wait">
                    <span className="o-dot" />
                    {t('请打开授权链接，在页面输入验证码；系统会自动同步登录状态。')}
                  </span>
                </div>
              )}

              {phase === 'failed' && (
                <OfficialNote tone="danger" icon={<Icon icon="lucide:circle-alert" width={16} />}>
                  {runtime?.error || t('登录失败，请重试。')}
                </OfficialNote>
              )}
            </div>

            <footer className="o-dialog__footer">
              <OfficialButton type="button" variant="outline" size="md" onClick={onClose}>
                {t('收起登录引导')}
              </OfficialButton>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
