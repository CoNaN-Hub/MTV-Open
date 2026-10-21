/**
 * SkillCreateDialog —— 官方「创建技能」对话框 1:1 复刻。
 *
 * 官方 DOM 实测（CDP 9222，`+` 菜单 → 技能 → 创建技能）逐字：
 * ```
 * <div role="dialog" data-testid="common-dialog-content"
 *      class="fixed left-[50%] top-[50%] z-50 text-popover-foreground min-w-[300px]
 *             translate-x-[-50%] translate-y-[-50%] flex h-[min(640px,85vh)] w-[680px]
 *             max-w-[calc(100vw-32px)] flex-col items-start overflow-hidden rounded-3xl
 *             border border-border bg-chat-bubble-header p-6">
 *   <div class="flex h-9 w-full shrink-0 items-center justify-between gap-3">
 *     <div class="flex min-w-0 items-baseline gap-x-2">
 *       <h2 class="tracking-tight text-lg font-extrabold leading-7 text-white">创建技能</h2>
 *       <span class="truncate text-base font-medium leading-5 text-white/60">个人</span></div>
 *     <button class="flex size-8 shrink-0 aspect-square cursor-pointer items-center justify-center
 *                    rounded-md text-text-text-secondary transition-colors hover:bg-white/10
 *                    hover:text-text-text-primary" aria-label="关闭"><lucide-x 20/1.5/></button></div>
 *   … 技能名称 + info tooltip + input（placeholder 输入名称） …
 *   … 描述     + info tooltip + textarea h-[72px]（placeholder 输入描述） …
 *   … 指令     + textarea min-h-0 flex-1（placeholder 输入指令） …
 *   <div class="flex w-full shrink-0 items-center justify-end gap-4">
 *     取消（disabled:opacity-40 / hover:bg-white/10 hover:text-white/60）
 *     创建（bg-white text-black hover:opacity-90 / disabled:opacity-40）</div>
 * </div>
 * ```
 *
 * 校验文案取官方 `chatAdapter.addMenu.skills.errors.*`（zh 逐字）：
 *   nameRequired「请输入技能名称」· nameInvalid「名称只能包含小写字母、数字和连字符，最长 64 字符」
 *   descriptionRequired「请输入描述」· descriptionTooLong「描述不能超过 1024 个字符」
 *   instructionsRequired「请输入指令」· instructionsTooLong「指令不能超过 20000 个字符」
 *
 * 落地：MTV 的 `createSkillFromContent(fileName, content)`（`store.skills.ts`）——
 * 生成一份 `SKILL.md`（frontmatter 带 name/description + 正文 = 指令），
 * 与「上传 Skill 文件」走同一条本地链路（**不需要后端**）。
 */
import { Fragment, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';

/**
 * 官方容器（CDP 实测，从「管理技能 → 添加 → 创建技能」进入）：
 * ```html
 * <div role="dialog" data-testid="common-dialog-content"
 *      class="fixed left-[50%] top-[50%] z-50 text-popover-foreground min-w-[300px]
 *             translate-x-[-50%] translate-y-[-50%] inline-flex h-[min(640px,85vh)] w-[720px]
 *             max-w-[calc(100vw-32px)] flex-col items-start gap-4 overflow-hidden rounded-3xl
 *             border border-border p-6 bg-chat-bubble-header outline-none focus:outline-none transition-none duration-200
 *             data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0
 *             data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.98] data-[state=open]:zoom-in-[0.98]">
 * ```
 * 实测：`720×640 · padding 24px · border-radius 24px · background rgb(26,26,26)`。
 *
 * 行序（官方逐字）：
 *  1) `<div class="flex h-9 w-full shrink-0 items-center justify-between gap-3">`
 *       · **返回**：`<button class="group flex min-w-0 max-w-[50%] cursor-pointer items-center gap-1 rounded-md py-1 pr-2 transition-colors hover:bg-white/10">
 *                    <chevron-left/><span class="truncate text-base font-medium leading-5 text-white/60 group-hover:text-white/90">返回</span></button>`
 *       · 关闭：`size-8 rounded-md text-text-text-secondary hover:bg-white/10 hover:text-text-text-primary`
 *  2) `<h2 class="text-lg font-semibold leading-none tracking-tight sr-only">创建技能</h2>`
 *  3) `<div class="flex h-full min-h-0 w-full flex-1 flex-col gap-4">`
 *       · 标题行（在体内，**不在** h-9 那行）：
 *         `<div class="flex min-w-0 shrink-0 items-baseline gap-x-2">
 *            <p class="text-lg font-extrabold leading-7 text-white">创建技能</p>
 *            <span class="truncate text-base font-medium leading-5 text-white/60">个人</span></div>`
 *       · 字段区 / 底部按钮（同前）
 */
/** 官方常量（同源校验规则）。 */
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const INSTRUCTIONS_MAX = 20000;
const NAME_PATTERN = /^[a-z0-9-]+$/;

/* 居中用 CSS 独立的 `translate` 属性，不用 Tailwind v3 的 `translate-x/y-[-50%]`：
   后者写的是 `transform`，会被开合动画（framer-motion `scale` / `animate-in zoom-in-*`）覆盖
   ⇒ 动画期间不居中、动画结束再跳（用户实测「从下面闪一下出来」）。 */
const DIALOG_CLASS = 'fixed left-[50%] top-[50%] z-[130] text-popover-foreground min-w-[300px] inline-flex h-[min(640px,85vh)] w-[720px] max-w-[calc(100vw-32px)] flex-col items-start gap-4 overflow-hidden rounded-3xl border border-border bg-chat-bubble-header p-6 outline-none';
const DIALOG_CENTER_STYLE = { translate: '-50% -50%' } as React.CSSProperties;
const FIELD_CLASS = 'flex w-full items-center justify-center gap-2.5 self-stretch rounded-[12px] border border-white/10 bg-card px-3 py-2 text-sm leading-5 text-text-text-primary outline-none placeholder:text-text-text-tertiary focus-visible:border-white/[0.16]';
const INFO_BUTTON_CLASS = 'inline-flex shrink-0 cursor-help items-center justify-center text-white/40 transition-colors hover:text-white/60';
const LABEL_CLASS = 'truncate text-sm font-medium leading-5 text-white/60';
const FOOTER_BUTTON_BASE = 'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium leading-5 disabled:cursor-not-allowed disabled:opacity-40';

export interface SkillCreateDialogProps {
  open: boolean;
  onClose: () => void;
  /** 官方左上角「返回」：从「管理技能 → 添加 → 创建技能」进来时回到管理面板。 */
  onBack?: () => void;
  onCreated?: (name: string) => void;
}

export default function SkillCreateDialog({ open, onClose, onBack, onCreated }: SkillCreateDialogProps) {
  const t = useT();
  const createSkillFromContent = useAppStore((state) => state.createSkillFromContent);
  const showToast = useAppStore((state) => state.showToast);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');

  const nameInvalid = name.length > 0 && (!NAME_PATTERN.test(name) || name.length > NAME_MAX);
  const canSubmit =
    name.trim().length > 0 && !nameInvalid && description.trim().length > 0 && instructions.trim().length > 0;

  const reset = useCallback(() => {
    setName('');
    setDescription('');
    setInstructions('');
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    const fileName = `${name}.md`;
    const content = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      '---',
      '',
      instructions,
      '',
    ].join('\n');
    void createSkillFromContent(fileName, content).then((skill) => {
      showToast(`技能「${skill.name}」创建成功`);
      onCreated?.(skill.name);
      reset();
      onClose();
    });
  }, [canSubmit, createSkillFromContent, description, instructions, name, onClose, onCreated, reset, showToast]);

  /* ⚠️ 动画必须在**对话框自己**身上（它就是那个 `position:fixed` 的根）：
     带 transform 的祖先是 `position:fixed` 后代的包含块 ⇒ 外面再套 `motion.div` 会让
     `left:50%/top:50%` 相对那个零尺寸外壳解析，动画期间弹窗偏到别处、结束后跳回
     （用户实测「从画布下方跳出来」）。 */
  const body = (
    <motion.div
      role="dialog"
      aria-modal="true"
      data-testid="skill-create-dialog"
      className={DIALOG_CLASS}
      style={DIALOG_CENTER_STYLE}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
        {/* 官方第 1 行：只有「返回」+ 关闭（标题在体内那一行） */}
        <div className="flex h-9 w-full shrink-0 items-center justify-between gap-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="group flex min-w-0 max-w-[50%] cursor-pointer items-center gap-1 rounded-md py-1 pr-2 transition-colors hover:bg-white/10"
            >
              <Icon icon="tabler:chevron-left" width={16} height={16} strokeWidth={1.75} />
              <span className="truncate text-base font-medium leading-5 text-white/60 group-hover:text-white/90">
                {t('返回')}
              </span>
            </button>
          ) : <span />}
          <button
            type="button"
            aria-label={t('关闭')}
            onClick={handleClose}
            className="flex size-8 shrink-0 aspect-square cursor-pointer items-center justify-center rounded-md text-text-text-secondary transition-colors hover:bg-white/10 hover:text-text-text-primary"
          >
            <Icon icon="lucide:x" width={20} height={20} strokeWidth={1.5} className="aspect-square shrink-0" />
          </button>
        </div>

        <h2 className="sr-only">{t('创建技能')}</h2>

        {/* 官方标题行：在体内，`items-baseline gap-x-2` */}
        <div className="flex min-w-0 shrink-0 items-baseline gap-x-2">
          <p className="text-lg font-extrabold leading-7 text-white">{t('创建技能')}</p>
          <span className="truncate text-base font-medium leading-5 text-white/60">{t('个人')}</span>
        </div>

        <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
          <div className="flex min-h-0 w-full flex-1 flex-col gap-6">
            <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-3 self-stretch">
              {/* 技能名称 */}
              <div className="flex w-full flex-col gap-1.5">
                <div className="flex w-full items-center gap-1.5">
                  <label htmlFor="create-skill-name" className={`${LABEL_CLASS} w-auto`}>
                    {t('技能名称')}
                  </label>
                  <button
                    type="button"
                    aria-label={t('只允许小写字母、数字和连字符')}
                    className={INFO_BUTTON_CLASS}
                  >
                    <Icon icon="tabler:info-circle" width={14} height={14} strokeWidth={1.5} />
                  </button>
                </div>
                <input
                  id="create-skill-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('输入名称')}
                  className={FIELD_CLASS}
                  autoComplete="off"
                  spellCheck={false}
                />
                {nameInvalid ? (
                  <p className="text-xs leading-4 text-destructive">{t('名称只能包含小写字母、数字和连字符，最长 64 字符')}</p>
                ) : null}
              </div>

              {/* 描述 */}
              <div className="flex w-full flex-col gap-1.5">
                <div className="flex w-full items-center gap-1.5">
                  <label htmlFor="create-skill-description" className={`${LABEL_CLASS} w-auto`}>
                    {t('描述')}
                  </label>
                  <button
                    type="button"
                    aria-label={t('Agent 会根据这些描述决定在对话中使用哪些技能。')}
                    className={INFO_BUTTON_CLASS}
                  >
                    <Icon icon="tabler:info-circle" width={14} height={14} strokeWidth={1.5} />
                  </button>
                </div>
                <textarea
                  id="create-skill-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX))}
                  placeholder={t('输入描述')}
                  className={`${FIELD_CLASS} resize-none h-[72px] overflow-y-auto`}
                />
              </div>

              {/* 指令 */}
              <div className="flex min-h-0 w-full flex-1 flex-col gap-1.5">
                <label htmlFor="create-skill-instructions" className={`${LABEL_CLASS} w-full`}>
                  {t('指令')}
                </label>
                <textarea
                  id="create-skill-instructions"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value.slice(0, INSTRUCTIONS_MAX))}
                  placeholder={t('输入指令')}
                  className={`${FIELD_CLASS} resize-none min-h-0 flex-1 overflow-y-auto`}
                />
              </div>
            </div>

            {/* 底部按钮（官方：右对齐 gap-4；取消 = 幽灵，创建 = 白底黑字） */}
            <div className="flex w-full shrink-0 items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleClose}
                className={`${FOOTER_BUTTON_BASE} text-white/40 transition-colors hover:bg-white/10 hover:text-white/60`}
              >
                {t('取消')}
              </button>
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={`${FOOTER_BUTTON_BASE} bg-white text-black transition-opacity hover:opacity-90`}
              >
                {t('创建')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (typeof document === 'undefined' || !document.body) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        /* 官方**没有遮罩层**（CDP 实测：`fixed inset-0` 且底色非透明的元素 0 个），
           只有这一个 dialog 本身；开合动画靠 `animate-in fade-in-0 zoom-in-[0.98]` /
           `animate-out fade-out-0 zoom-out-[0.98]`（`duration-200`）。
           ⚠️ 动画已挪进 `body` 自己的 `motion.div`（见上），这里**不能再套一层**：
           带 transform 的祖先是 `position:fixed` 后代的包含块 ⇒ 会「先跑到别处再跳回」。 */
        <Fragment key="skill-create-dialog">{body}</Fragment>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
