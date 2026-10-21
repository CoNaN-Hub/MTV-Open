/**
 * SkillForm —— 官方「技能表单」（`Bj`，`vendor-pkg-canvas-ChpWx5JY.js` @170400-176200）1:1 复刻。
 *
 * 官方面板里 **创建技能 / 编辑技能 是同一个组件**，只靠 `mode` 区分：
 * ```
 * Bj = forwardRef(function ({ mode, skill = null, active = true, onClose, onSaveSuccess, showTitle = true }, ref) {
 *   const [form, setForm] = useState({ name:'', description:'', instructions:'' });
 *   const [discardOpen, setDiscardOpen] = useState(false);
 *   const idPrefix = mode === 'create' ? 'create-skill' : 'edit-skill';
 *   useEffect(() => { setForm(mode === 'edit' && skill ? { name: skill.name, description: skill.description,
 *                        instructions: skill.instructions } : EMPTY); setDiscardOpen(false); }, [active, mode, skill]);
 *   const dirty   = !same(form, initial);              // n0e
 *   const hasAny  = !!(form.name.trim() || form.description.trim() || form.instructions.trim());
 *   const canSubmit = mode === 'create' ? hasAny && !pending : dirty && !pending;   // I
 *   const canCancel = dirty && !pending;                                            // M
 *   const requestClose = () => { if (pending) return; if (dirty) { setDiscardOpen(true); return; } onClose(); }; // A
 *   const cancel = () => { if (canCancel) requestClose(); };                        // P
 *   const submit = async () => {
 *     if (!canSubmit || pending || (mode === 'edit' && !dirty)) return;
 *     const v = validate({ name: name.trim(), description: description.trim(), instructions: instructions.trim() });
 *     if (!v.valid && v.errorKey) { toast.error(t(v.errorKey)); return; }           // 校验只在提交时用 toast，无内联报错
 *     if (mode === 'create') await create(...), toast.success(t('…createSuccess'));
 *     else await update({ skill_name: skill.name, name, description, instructions }),
 *          toast.success(t('…updateSuccess')), onSaveSuccess?.(name);
 *     onClose();
 *   };
 *   return <>
 *     <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
 *       {showTitle ? <div className="flex min-w-0 shrink-0 items-baseline gap-x-2">
 *          <p className="text-lg font-extrabold leading-7 text-white">{t(mode==='create'?'…createSkill':'…editSkill')}</p>
 *          <span className="truncate text-base font-medium leading-5 text-white/60">{t('…sourcePersonal')}</span></div> : null}
 *       … 技能名称（input#<prefix>-name + ⓘ）· 描述（textarea h-[72px] + ⓘ）· 指令（textarea min-h-0 flex-1）…
 *       <div className="flex w-full shrink-0 items-center justify-end gap-4">
 *         取消 disabled={!canCancel} / 创建|保存 disabled={!canSubmit}</div>
 *     </div>
 *     <AlertDialog> … 放弃更改？ / 未保存的更改将会丢失。 / 取消 · 放弃 … </AlertDialog>
 *   </>;
 * });
 * ```
 *
 * 官方量测（CDP 9222 · 管理技能 → 点技能卡 → 编辑技能，`edit-skill-*` 三字段）：
 * ```
 * input#edit-skill-name   value="visual-art-director"   font Inter 14px（**不是等宽**）
 * textarea#edit-skill-description h-[72px]             class 含 `bg-card-background` `focus-visible:border-white/16`
 * textarea#edit-skill-instructions   min-h-0 flex-1
 * 页脚 取消 disabled=true / 保存 disabled=true（**未改动时两颗都禁用**）
 * 改任一字段 ⇒ 两颗都启用；改回原值 ⇒ 两颗又都禁用（脏检测 = 与初值逐字段相等）
 * 名称填非法字符（大写/空格）时**没有内联报错**，保存仍可点 ⇒ 校验只在提交时以 toast 报错
 * 点取消（脏）⇒ `<div role="alertdialog" class="… max-w-lg … rounded-lg border border-border bg-chat-bubble-header">`
 *   标题「放弃更改？」(text-lg font-extrabold leading-7 text-white)
 *   描述「未保存的更改将会丢失。」(text-sm leading-5 text-white/60)
 *   按钮「取消」(border border-white/10 bg-transparent text-white/40) · 「放弃」(bg-destructive)
 * ```
 *
 * 落地差异（MTV 无服务端）：官方的三个字段是 `PUT {skill_name, name, description, instructions}`；
 * MTV 写本地 `SKILL.md`（frontmatter = name/description + 正文 = instructions），
 * 与「创建技能」「上传 Skill 文件」同一条本地链路（`store.skills.ts`）。
 */
import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import OfficialTooltip from './OfficialTooltip';

/** 官方常量（`chatAdapter.addMenu.skills.errors.*` 的阈值）。 */
const NAME_MAX = 64;
const DESCRIPTION_MAX = 1024;
const INSTRUCTIONS_MAX = 20000;

/** 官方 `bk` = 字段标签（整行宽）。 */
const LABEL_CLASS = 'w-full truncate text-sm font-medium leading-5 text-white/60';
/**
 * 官方 `z(bk, "w-auto")` —— `z` 是 **clsx + tailwind-merge**，`w-auto` 会**覆盖**掉 `w-full`，
 * 于是「技能名称 / 描述」的标签是自适应宽度、ⓘ 紧跟在文字后面。
 *
 * ⚠️ 第 59 轮修（用户实测「MTV 的 ⓘ 位置不对」）：MTV 没有 tailwind-merge，
 * 把 `w-full w-auto` 一起写上去时**谁赢由编译后 CSS 顺序决定**（实测 `w-full` 赢）
 * ⇒ 标签撑满整行、ⓘ 被挤到对话框最右侧（MTV 实测 ⓘ x=1601，官方 x=1007=紧跟标签）。
 * 正确做法与官方等价：这里直接**不写** `w-full`。
 */
const LABEL_INLINE_CLASS = 'truncate text-sm font-medium leading-5 text-white/60';
/**
 * ⚠️ 第 59 轮（用户明确选择「放开中文/任意字符」）：**不再校验名称字符集**。
 * 官方的 `nameInvalid`（只允许小写字母/数字/连字符）是因为官方把 `name` 当**标识**：
 * 服务端 `PUT {skill_name, name, …}` 的 key、以及输入框里 `/name` 引用都吃它；
 * MTV 用 `id` 当主键、`fileName` 单独保存、展示名取 `manifest.name` ⇒ 中文名不会破坏任何链路
 * （唯一差别：frontmatter 的 `name:` 与文件名不同，而 MTV 本来就是这样显示的）。
 * 仍保留官方文案里的**长度**上限（`nameTooLong`）⇒ 名称的 ⓘ 气泡也换成这条官方文案。
 */
/** 官方 textarea **不显示**滚动条（用户图：官方两个框右侧干干净净）。
 *  MTV 的 v3 类名只设了 `overflow-y-auto`，WebView 会画原生滚动条（深色主题下是一条亮条）。
 *  `scrollbar-width` 只管 Firefox ⇒ 必须同时隐藏 webkit 滚动条（仓库既有写法同此）。 */
const HIDE_SCROLLBAR_CLASS = '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]';
/** 官方 `r0e`（input）/ `w3`（textarea）共同部分；`bg-card-background`（MTV 的 `--card-background` 与 `--card` 同值 #1f1f1f）。 */
const FIELD_CLASS = 'w-full flex items-center justify-center gap-2.5 self-stretch rounded-[12px] border border-white/10 bg-card px-3 py-2 text-sm leading-5 text-text-text-primary outline-none placeholder:text-text-text-tertiary focus-visible:border-white/[0.16]';
const TEXTAREA_CLASS = 'w-full resize-none rounded-[12px] border border-white/10 bg-card px-3 py-2 text-sm leading-5 text-text-text-primary outline-none placeholder:text-text-text-tertiary focus-visible:border-white/[0.16] overflow-y-auto';
const INFO_BUTTON_CLASS = 'inline-flex shrink-0 cursor-help items-center justify-center text-white/40 transition-colors hover:text-white/60';
/**
 * ⚠️ 第 59 轮（用户实测「提示没有 / 在最底层」）：官方 tooltip 类串自带 `z-50`，而 MTV 这个技能对话框
 * 是 `z-[130]`（官方是 `z-50`）⇒ 气泡被对话框盖住（描述那个只在左边露一角，技能名称那个完全看不见）。
 * 这里把**这两个**气泡抬到 `z-[200]`（Tailwind v3 里 arbitrary 值后置，实测生效；真机复测 z-index=200）。
 */
const TOOLTIP_CLASS = 'max-w-[260px] z-[200]';
/** 官方 `o0e`：取消（幽灵，脏了才可点）。 */
const CANCEL_BUTTON_CLASS = 'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium leading-5 text-white/40 transition-colors hover:bg-white/10 hover:text-white/60 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/40';
/** 官方 `s0e`：创建 / 保存（白底黑字）。 */
const SUBMIT_BUTTON_CLASS = 'flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium leading-5 text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40';

export type SkillFormMode = 'create' | 'edit';

export interface SkillFormValue {
  name: string;
  description: string;
  instructions: string;
}

export interface SkillFormSkill extends SkillFormValue {
  /** MTV 的技能主键（官方的 `skill.name` 既当主键又当展示名，MTV 两者分开）。 */
  id: string;
}

export interface SkillFormProps {
  mode: SkillFormMode;
  /** 官方 `skill`：编辑态的初值；create 态传 `null`。 */
  skill?: SkillFormSkill | null;
  /** 官方 `active`：为 false 时清空表单。 */
  active?: boolean;
  onClose: () => void;
  /** 官方 `onSaveSuccess(name)`：保存成功后回传最终名称（管理面板拿它更新详情页标题）。 */
  onSaveSuccess?: (name: string) => void;
  /** 官方 `showTitle`：标题行（「创建技能/编辑技能 + 个人」）默认显示。 */
  showTitle?: boolean;
}

/** 官方 `requestClose`（`Bj` 的 imperative handle）：脏 ⇒ 弹「放弃更改？」，否则直接关。 */
export interface SkillFormHandle {
  requestClose: () => void;
}

const EMPTY_FORM: SkillFormValue = { name: '', description: '', instructions: '' };

function initialForm(mode: SkillFormMode, skill?: SkillFormSkill | null): SkillFormValue {
  if (mode === 'edit' && skill) {
    return { name: skill.name, description: skill.description, instructions: skill.instructions };
  }
  return EMPTY_FORM;
}

/** 官方 `n0e`：逐字段相等（脏检测）。 */
function sameForm(a: SkillFormValue, b: SkillFormValue): boolean {
  return a.name === b.name && a.description === b.description && a.instructions === b.instructions;
}

/** 官方 `Npe({name, description, instructions})`：提交时校验，返回要 toast 的文案（已在 trim 之后调用）。 */
function validateSkillForm(value: SkillFormValue): string | null {
  if (!value.name) return '请输入技能名称';
  if (value.name.length > NAME_MAX) return '技能名称不能超过 64 个字符';
  if (!value.description) return '请输入描述';
  if (value.description.length > DESCRIPTION_MAX) return '描述不能超过 1024 个字符';
  if (!value.instructions) return '请输入指令';
  if (value.instructions.length > INSTRUCTIONS_MAX) return '指令不能超过 20000 个字符';
  return null;
}

/** 与「创建技能」「上传 Skill 文件」同一条本地落盘格式（frontmatter + 正文）。 */
function buildSkillDocument(value: SkillFormValue): string {
  return ['---', `name: ${value.name}`, `description: ${value.description}`, '---', '', value.instructions, ''].join('\n');
}

const SkillForm = forwardRef<SkillFormHandle, SkillFormProps>(function SkillForm({
  mode,
  skill = null,
  active = true,
  onClose,
  onSaveSuccess,
  showTitle = true,
}, ref) {
  const t = useT();
  const createSkillFromContent = useAppStore((state) => state.createSkillFromContent);
  const updateSkillContent = useAppStore((state) => state.updateSkillContent);
  const showToast = useAppStore((state) => state.showToast);

  const [form, setForm] = useState<SkillFormValue>(() => initialForm(mode, skill));
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const idPrefix = mode === 'create' ? 'create-skill' : 'edit-skill';
  const initial = useMemo(
    () => initialForm(mode, skill),
    /* 官方依赖 `[active, mode, skill]`；这里按字段展开，避免调用方每次渲染都换新对象导致表单被重置。 */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, skill?.id, skill?.name, skill?.description, skill?.instructions],
  );

  /* 官方：`active` 变 false 时清空表单并收起放弃确认；变 true 时用初值填充。 */
  useEffect(() => {
    if (!active) {
      setForm(EMPTY_FORM);
      setDiscardOpen(false);
      return;
    }
    setForm(initialForm(mode, skill));
    setDiscardOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, skill?.id, skill?.name, skill?.description, skill?.instructions]);

  /* 官方：`active` 时把焦点给 `#<prefix>-name`。 */
  useEffect(() => {
    if (active) nameInputRef.current?.focus({ preventScroll: true });
  }, [active, mode, skill?.name]);

  const dirty = !sameForm(form, initial);
  const hasAny = Boolean(form.name.trim() || form.description.trim() || form.instructions.trim());
  const canSubmit = mode === 'create' ? hasAny && !saving : dirty && !saving;
  const canCancel = dirty && !saving;

  /** 官方 `A`：脏 ⇒ 先问，再关。 */
  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose, saving]);

  useImperativeHandle(ref, () => ({ requestClose }), [requestClose]);

  const handleCancel = useCallback(() => {
    if (canCancel) requestClose();
  }, [canCancel, requestClose]);

  /** 官方 `j`：放弃确认框里的「放弃」。 */
  const handleDiscard = useCallback(() => {
    setDiscardOpen(false);
    onClose();
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || saving || (mode === 'edit' && !dirty)) return;
    const value: SkillFormValue = {
      name: form.name.trim(),
      description: form.description.trim(),
      instructions: form.instructions.trim(),
    };
    const errorText = validateSkillForm(value);
    if (errorText) {
      showToast(t(errorText), 'error');
      return;
    }
    setSaving(true);
    try {
      if (mode === 'create') {
        await createSkillFromContent(`${value.name}.md`, buildSkillDocument(value));
        showToast(t('技能创建成功'));
      } else {
        if (!skill) return;
        const updated = await updateSkillContent(skill.id, buildSkillDocument(value));
        if (!updated) {
          showToast(t('保存技能失败'), 'error');
          return;
        }
        showToast(t('技能更新成功'));
        onSaveSuccess?.(value.name);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }, [
    canSubmit, createSkillFromContent, dirty, form.description, form.instructions, form.name,
    mode, onClose, onSaveSuccess, saving, showToast, skill, t, updateSkillContent,
  ]);

  /* 官方：`mode==='edit' && !skill` ⇒ 不渲染。 */
  if (mode === 'edit' && !skill) return null;

  return (
    <>
      <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
        {showTitle ? (
          <div className="flex min-w-0 shrink-0 items-baseline gap-x-2">
            <p className="text-lg font-extrabold leading-7 text-white">
              {mode === 'create' ? t('创建技能') : t('编辑技能')}
            </p>
            <span className="truncate text-base font-medium leading-5 text-white/60">{t('个人')}</span>
          </div>
        ) : null}

        <div className="flex min-h-0 w-full flex-1 flex-col gap-6">
          <div className="flex min-h-0 w-full flex-1 flex-col items-start gap-3 self-stretch">
            {/* 技能名称 */}
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex w-full items-center gap-1.5">
                <label htmlFor={`${idPrefix}-name`} className={LABEL_INLINE_CLASS}>{t('技能名称')}</label>
                {/* 官方 `Un`(Radix Tooltip Provider, `delayDuration:200`) + `Bn asChild`(按钮) +
                    `Yn`(TooltipContent, `side:"top"`, `className:"max-w-[260px]"`)。
                    CDP 实测（9222）：悬停 ⓘ ⇒ 气泡 192×32 居中悬浮在 ⓘ **上方**（gap≈3px）。
                    ⚠️ 第 59 轮修：此前 MTV 只有裸 `<button aria-label>`，**悬停什么都不出**。 */}
                <OfficialTooltip
                  content={t('技能名称不能超过 64 个字符')}
                  side="top"
                  sideOffset={4}
                  delayDuration={200}
                  className={TOOLTIP_CLASS}
                >
                  <button
                    type="button"
                    aria-label={t('技能名称不能超过 64 个字符')}
                    className={INFO_BUTTON_CLASS}
                  >
                    <Icon icon="tabler:info-circle" width={14} height={14} strokeWidth={1.5} />
                  </button>
                </OfficialTooltip>
              </div>
              <input
                ref={nameInputRef}
                id={`${idPrefix}-name`}
                type="text"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('输入名称')}
                className={FIELD_CLASS}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* 描述 */}
            <div className="flex w-full flex-col gap-1.5">
              <div className="flex w-full items-center gap-1.5">
                <label htmlFor={`${idPrefix}-description`} className={LABEL_INLINE_CLASS}>{t('描述')}</label>
                <OfficialTooltip
                  content={t('Agent 会根据这些描述决定在对话中使用哪些技能。')}
                  side="top"
                  sideOffset={4}
                  delayDuration={200}
                  className={TOOLTIP_CLASS}
                >
                  <button
                    type="button"
                    aria-label={t('Agent 会根据这些描述决定在对话中使用哪些技能。')}
                    className={INFO_BUTTON_CLASS}
                  >
                    <Icon icon="tabler:info-circle" width={14} height={14} strokeWidth={1.5} />
                  </button>
                </OfficialTooltip>
              </div>
              <textarea
                id={`${idPrefix}-description`}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder={t('输入描述')}
                className={`${TEXTAREA_CLASS} h-[72px] ${HIDE_SCROLLBAR_CLASS}`}
                rows={2}
              />
            </div>

            {/* 指令 */}
            <div className="flex min-h-0 w-full flex-1 flex-col gap-1.5">
              <label htmlFor={`${idPrefix}-instructions`} className={LABEL_CLASS}>{t('指令')}</label>
              <textarea
                id={`${idPrefix}-instructions`}
                value={form.instructions}
                onChange={(event) => setForm((prev) => ({ ...prev, instructions: event.target.value }))}
                placeholder={t('输入指令')}
                className={`${TEXTAREA_CLASS} min-h-0 flex-1 ${HIDE_SCROLLBAR_CLASS}`}
              />
            </div>
          </div>

          {/* 官方页脚：右对齐 gap-4；取消（脏才可点）+ 创建/保存（未改动 / 无内容时禁用）。 */}
          <div className="flex w-full shrink-0 items-center justify-end gap-4">
            <button type="button" onClick={handleCancel} disabled={!canCancel} className={CANCEL_BUTTON_CLASS}>
              {t('取消')}
            </button>
            <button type="button" onClick={() => { void handleSubmit(); }} disabled={!canSubmit} className={SUBMIT_BUTTON_CLASS}>
              {mode === 'create' ? t('创建') : t('保存')}
            </button>
          </div>
        </div>
      </div>

      {/*
        官方「放弃更改？」确认框（CDP 实测逐字）：
        `<div role="alertdialog" class="fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg
             translate-x-[-50%] translate-y-[-50%] gap-4 p-6 shadow-lg duration-200 …
             sm:rounded-lg rounded-lg border border-border bg-chat-bubble-header">`
        实测 512×157 · p 24px · radius 12px · gap 16px · bg rgb(26,26,26)；
        标题 `text-lg font-extrabold leading-7 text-white`，描述 `text-sm leading-5 text-white/60`，
        按钮 = 取消（`border border-white/10 bg-transparent text-white/40`）/ 放弃（`bg-destructive`）。
      */}
      {typeof document !== 'undefined' && document.body ? createPortal(
        <AnimatePresence>
          {discardOpen ? (
            <Fragment key="skill-form-discard">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-[160] bg-black/80"
                aria-hidden="true"
              />
              <motion.div
                role="alertdialog"
                aria-modal="true"
                aria-label={t('放弃更改？')}
                data-testid="skill-form-discard-dialog"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-[50%] top-[50%] z-[161] grid w-full max-w-lg gap-4 rounded-lg border border-border bg-chat-bubble-header p-6 shadow-lg"
                style={{ translate: '-50% -50%' }}
              >
                <div className="flex flex-col space-y-2 text-left">
                  <h2 className="text-lg font-extrabold leading-7 text-white">{t('放弃更改？')}</h2>
                  <p className="text-sm leading-5 text-white/60">{t('未保存的更改将会丢失。')}</p>
                </div>
                <div className="flex flex-row justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setDiscardOpen(false)}
                    className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-white/40 shadow-sm transition-colors hover:bg-white/10 hover:text-white/60"
                  >
                    {t('取消')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow transition-colors hover:bg-destructive/90"
                  >
                    {t('放弃')}
                  </button>
                </div>
              </motion.div>
            </Fragment>
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}
    </>
  );
});

export default SkillForm;
