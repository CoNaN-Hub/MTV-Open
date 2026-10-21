// @vitest-environment jsdom
/**
 * `FormCard` / `FormFieldBlock` / 9 个控件 / `SubmissionRows` / `FormSubmissionSummaryCard`
 * 的**真实 DOM** 回归（jsdom + @testing-library/react）。
 *
 * 断言对齐 `vendor-pkg-canvas-ChpWx5JY.js` 的逐字 class 与结构：
 *  · `ase`（FormCard）  @2189040–@2192338
 *  · `ise`（FormFieldBlock） @2186920–@2188287
 *  · `Qoe`/`Zoe`/`Joe`/`ese`/`tse`/`nse`/`ose`/`sse`/`rse` @2176875–@2186807
 *  · `tF`（SubmissionRows） / `lse`（FormSubmissionSummaryCard） @2188360–@2193284
 *
 * 验证分级 = (b) jsdom。（**没有** (a) live CDP：live 画布当前没有这些卡片，且明令不许点。）
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormCard } from '../../src/components/chat/FormCard';
import { FormSubmissionSummaryCard, SubmissionRows } from '../../src/components/chat/FormSubmissionSummaryCard';
import { useAppStore } from '../../src/store/useAppStore';
import { FORM_LABELS, type FormDefinition, type FormField } from '../../src/services/chat/formSubmission';

afterEach(cleanup);

beforeEach(() => {
  useAppStore.setState({ messages: [] });
});

type FormFieldSpec = Omit<Partial<FormField>, 'options'> & {
  id: string;
  label: string;
  options?: Array<{ value: string; label: string; file_id?: string; description?: string }>;
};

function field(spec: FormFieldSpec): FormField {
  return {
    type: 'text',
    required: false,
    multiline: false,
    ...spec,
  } as FormField;
}

function content(form: Partial<FormDefinition>, toolCallId = 'tc-1') {
  return {
    tool_call_id: toolCallId,
    tool: 'show_form',
    status: 'completed',
    request: { fields: [], title: '表单', ...form },
  };
}

/** 官方三点：提交按钮类串（启用态 / 禁用态）。 */
const SUBMIT_ENABLED =
  'cursor-pointer bg-[var(--form-btn-bg,rgba(255,255,255,0.10))] text-[var(--form-btn-fg,#d4d4d8)] shadow-[inset_0_0_0_1px_var(--form-btn-ring,transparent)] hover:bg-[var(--form-btn-bg-hover,rgba(255,255,255,0.16))]';

describe('FormCard —— 卡片外壳（官方 ase）', () => {
  it('没有可解析字段 ⇒ 渲染 null', () => {
    const { container } = render(<FormCard content={content({ title: '表单' })} />);
    expect(container.firstChild).toBeNull();
  });

  it('卡片壳 class 与提交/跳过按钮逐字', () => {
    const onSubmitForm = vi.fn();
    const { container } = render(
      <FormCard
        content={content({ title: '表单标题', fields: [field({ id: 'a', label: 'A' })] })}
        onSubmitForm={onSubmitForm}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toBe(
      'mt-2 w-full min-w-0 max-w-[720px] space-y-5 rounded-[14px] bg-[var(--form-card-bg,#1f1f1f)] p-4 shadow-[inset_0_0_0_1px_var(--form-card-ring,rgba(255,255,255,0.08))]',
    );

    const title = container.querySelector('span.min-w-0.flex-1.break-words') as HTMLElement;
    expect(title.className).toBe(
      'min-w-0 flex-1 break-words text-sm font-semibold leading-5 text-[var(--form-title,#e4e4e7)]',
    );
    expect(title.textContent).toBe('表单标题');

    const submit = screen.getByRole('button', { name: '提交' });
    expect(submit.className).toBe(
      `inline-flex h-9 items-center justify-center rounded-full px-6 text-sm font-medium transition-all ${SUBMIT_ENABLED}`,
    );
    const skip = screen.getByRole('button', { name: '跳过' });
    expect(skip.className).toBe(
      'shrink-0 px-2 text-xs text-muted-foreground transition-colors cursor-pointer hover:text-chat-foreground',
    );
  });

  it('form_icon === "none" 隐藏标题图标；缺省时显示（undefined !== "none"）', () => {
    const { container: hidden } = render(
      <FormCard content={content({ form_icon: 'none', fields: [field({ id: 'a', label: 'A' })] })} />,
    );
    expect(hidden.querySelector('svg.tabler-icon-clipboard-list')).toBeNull();

    const { container: shown } = render(
      <FormCard content={content({ fields: [field({ id: 'a', label: 'A' })] })} />,
    );
    const icon = shown.querySelector('svg.tabler-icon-clipboard-list') as SVGElement;
    expect(icon).toBeTruthy();
    expect(icon.getAttribute('width')).toBe('16');
    expect(icon.getAttribute('stroke-width')).toBe('1.5');
    expect(icon.getAttribute('class')).toContain('shrink-0 text-muted-foreground');
  });

  it('description 只在未提交时渲染；字段块间距非 bubble 为 space-y-6', () => {
    const { container } = render(
      <FormCard
        content={content({
          description: '说明',
          fields: [field({ id: 'a', label: 'A' }), field({ id: 'b', label: 'B' })],
        })}
      />,
    );
    const desc = screen.getByText('说明');
    expect(desc.className).toBe(
      'text-xs leading-5 text-[var(--form-desc,var(--secondary-muted-foreground))]',
    );
    const fieldRow = container.querySelector('div.space-y-6') as HTMLElement;
    expect(fieldRow.children).toHaveLength(2);
  });

  it('display_type === "bubble"：去壳 + 字段块自带圆角底', () => {
    const { container } = render(
      <FormCard
        content={content({ display_type: 'bubble', fields: [field({ id: 'a', label: 'A' })] })}
      />,
    );
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toBe('mt-2 w-full min-w-0 max-w-[720px] space-y-5');
    const block = container.querySelector('div.rounded-xl') as HTMLElement;
    expect(block.className).toBe(
      'space-y-2.5 rounded-xl bg-[var(--form-section-bg,rgba(255,255,255,0.08))] px-4 py-3.5',
    );
    const label = screen.getByText('A') as HTMLElement;
    expect(label.className).toBe(
      'text-[13px] font-semibold leading-5 text-[var(--form-title,#e4e4e7)]',
    );
  });

  it('accent 写进 style 的 --form-* 变量；非法 accent 不写', () => {
    const { container: withAccent } = render(
      <FormCard content={content({ accent: 'danger', fields: [field({ id: 'a', label: 'A' })] })} />,
    );
    const card = withAccent.firstElementChild as HTMLElement;
    expect(card.getAttribute('style')).toContain('--form-card-bg');
    expect(card.getAttribute('style')).toContain('#f87171');

    const { container: without } = render(
      <FormCard content={content({ accent: 'not-a-color', fields: [field({ id: 'a', label: 'A' })] })} />,
    );
    expect((without.firstElementChild as HTMLElement).getAttribute('style')).toBeNull();
  });

  it('缺 onSubmitForm ⇒ 提交/跳过都进禁用态（官方 C = o || !t）', () => {
    render(<FormCard content={content({ fields: [field({ id: 'a', label: 'A' })] })} />);
    const submit = screen.getByRole('button', { name: '提交' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.className).toBe(
      'inline-flex h-9 items-center justify-center rounded-full px-6 text-sm font-medium transition-all bg-white/[0.03] text-muted-foreground/40 cursor-not-allowed',
    );
    expect((screen.getByRole('button', { name: '跳过' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit_label 覆盖默认提交文案', () => {
    render(
      <FormCard
        content={content({ submit_label: '发送', fields: [field({ id: 'a', label: 'A' })] })}
        onSubmitForm={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: '发送' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '提交' })).toBeNull();
  });
});

describe('FormCard —— 校验与提交', () => {
  it('必填未填 ⇒ 显示 errors[field.id]，不调 onSubmitForm', () => {
    const onSubmitForm = vi.fn();
    render(
      <FormCard
        content={content({ fields: [field({ id: 'a', label: '必填项', required: true })] })}
        onSubmitForm={onSubmitForm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    const error = screen.getByText(FORM_LABELS.zh.required);
    expect(error.className).toBe('text-xs leading-4 text-red-400');
    expect(onSubmitForm).not.toHaveBeenCalled();
  });

  it('必填标记是 ml-0.5 text-red-400 的 *', () => {
    const { container } = render(
      <FormCard
        content={content({ fields: [field({ id: 'a', label: 'X', required: true })] })}
        onSubmitForm={vi.fn()}
      />,
    );
    const star = container.querySelector('span.ml-0\\.5.text-red-400') as HTMLElement;
    expect(star.textContent).toBe('*');
  });

  it('填好后提交：参数为 (toolCallId, title, iZe 序列, false)，并清掉错误', () => {
    const onSubmitForm = vi.fn();
    render(
      <FormCard
        content={content(
          { title: '表单', fields: [field({ id: 'a', label: '文本', required: true })] },
          'tc-9',
        )}
        onSubmitForm={onSubmitForm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(screen.getByText(FORM_LABELS.zh.required)).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  hello  ' } });
    /* onChange 后错误应被清掉（官方 `y` 的 f(k => …delete I[T])`）。 */
    expect(screen.queryByText(FORM_LABELS.zh.required)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).toHaveBeenCalledTimes(1);
    expect(onSubmitForm).toHaveBeenCalledWith('tc-9', '表单', [
      { field_id: 'a', field_label: '文本', value: 'hello', display: 'hello' },
    ], false);
  });

  it('跳过：提交空数组 + skipped = true', () => {
    const onSubmitForm = vi.fn();
    render(
      <FormCard
        content={content({ title: '表单', fields: [field({ id: 'a', label: 'A' })] }, 'tc-2')}
        onSubmitForm={onSubmitForm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tc-2', '表单', [], true);
  });

  it('无 tool_call_id / tool_use_id ⇒ 提交短路（不调用 handler）', () => {
    const onSubmitForm = vi.fn();
    render(
      <FormCard
        content={{ request: { title: '表单', fields: [{ id: 'a', label: 'A' }] } }}
        onSubmitForm={onSubmitForm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).not.toHaveBeenCalled();
  });

  it('tool_use_id 是 tool_call_id 的兜底', () => {
    const onSubmitForm = vi.fn();
    render(
      <FormCard
        content={{
          tool_use_id: 'tu-1',
          request: { title: '表单', fields: [{ id: 'a', label: 'A' }] },
        }}
        onSubmitForm={onSubmitForm}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tu-1', '表单', [], true);
  });

  it('isLoading ⇒ 提交按钮进禁用态', () => {
    render(
      <FormCard
        content={content({ fields: [field({ id: 'a', label: 'A' })] })}
        onSubmitForm={vi.fn()}
        isLoading
      />,
    );
    expect((screen.getByRole('button', { name: '提交' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('FormCard —— 已提交回显（官方 cZe / w / v）', () => {
  const messages = [
    {
      contents: [
        {
          type: 'form_submission',
          content: {
            tool_call_id: 'tc-1',
            form_title: '表单',
            skipped: false,
            values: [{ field_id: 'a', field_label: '文本', value: 'hello', display: 'hello' }],
          },
        },
      ],
    },
  ];

  it('已提交 ⇒ 显示已提交状态字 + SubmissionRows + 修改按钮，隐藏 description', () => {
    render(
      <FormCard
        content={content({ title: '表单', description: '说明', fields: [field({ id: 'a', label: '文本' })] })}
        onSubmitForm={vi.fn()}
        messages={messages}
      />,
    );
    const badge = screen.getByText(FORM_LABELS.zh.submitted);
    expect(badge.className).toBe('inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground');
    expect(badge.querySelector('svg.tabler-icon-check')?.getAttribute('width')).toBe('12');
    expect(screen.queryByText('说明')).toBeNull();
    expect(screen.getByText('文本')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.getByRole('button', { name: /修改/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '提交' })).toBeNull();
  });

  it('skipped ⇒ 状态字用 labels.skipped 且不渲染 SubmissionRows', () => {
    render(
      <FormCard
        content={content({ title: '表单', fields: [field({ id: 'a', label: '文本' })] })}
        onSubmitForm={vi.fn()}
        messages={[
          {
            contents: [
              {
                type: 'form_submission',
                content: { tool_call_id: 'tc-1', form_title: '表单', skipped: true, values: [] },
              },
            ],
          },
        ]}
      />,
    );
    expect(screen.getByText(FORM_LABELS.zh.skipped)).toBeTruthy();
    expect(screen.getByRole('button', { name: /修改/ })).toBeTruthy();
  });

  it('点「修改」⇒ 回到表单态，提交值不预填（skipped 时）', () => {
    render(
      <FormCard
        content={content({ title: '表单', fields: [field({ id: 'a', label: '文本' })] })}
        onSubmitForm={vi.fn()}
        messages={[
          {
            contents: [
              {
                type: 'form_submission',
                content: { tool_call_id: 'tc-1', form_title: '表单', skipped: true, values: [] },
              },
            ],
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /修改/ }));
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByRole('button', { name: '提交' })).toBeTruthy();
  });

  it('点「修改」⇒ 非 skipped 时用已提交 value 回填', () => {
    render(
      <FormCard
        content={content({ title: '表单', fields: [field({ id: 'a', label: '文本' })] })}
        onSubmitForm={vi.fn()}
        messages={messages}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /修改/ }));
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('hello');
  });

  it('官方 cZe 走 messages 的 contents 通道；MTV store 适配器恒空 ⇒ 不回显', () => {
    const { container } = render(
      <FormCard
        content={content({ title: '表单', fields: [field({ id: 'a', label: 'A' })] })}
        onSubmitForm={vi.fn()}
      />,
    );
    expect(container.querySelector('button.cursor-pointer.hover\\:text-chat-foreground')).toBeTruthy();
    expect(screen.queryByText(FORM_LABELS.zh.submitted)).toBeNull();
  });
});

describe('9 个字段控件', () => {
  const renderField = (f: FormField, onSubmitForm = vi.fn()) => {
    const utils = render(
      <FormCard content={content({ title: '表单', fields: [f] })} onSubmitForm={onSubmitForm} />,
    );
    return { ...utils, onSubmitForm };
  };

  it('RadioFieldControl：短 label 无 description ⇒ 胶囊行 + aria-pressed + 再点置 null', () => {
    const onSubmitForm = vi.fn();
    renderField(
      field({ id: 'r', type: 'radio', label: 'R', options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ] }),
      onSubmitForm,
    );
    expect(screen.queryByRole('radiogroup')).toBeNull();
    const pill = screen.getByRole('button', { name: 'A' });
    expect(pill.className).toContain('h-9 cursor-pointer rounded-full px-3.5 text-xs font-medium');
    expect(pill.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(pill);
    expect(onSubmitForm).not.toHaveBeenCalled();
    expect(pill.getAttribute('aria-pressed')).toBe('true');

    /* 再次点击已选项 ⇒ onChange(null)（官方 `n(i ? null : r.value)`）。 */
    fireEvent.click(pill);
    expect(pill.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(pill);
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tc-1', '表单', [
      { field_id: 'r', field_label: 'R', value: 'a', display: 'A (a)' },
    ], false);
  });

  it('RadioFieldControl：长 label ⇒ radiogroup 网格（auto-fill 220px）', () => {
    const { container } = renderField(
      field({ id: 'r', type: 'radio', label: 'R', options: [
        { value: 'a', label: 'a'.repeat(15), description: 'D' },
        { value: 'b', label: 'B' },
      ] }),
    );
    const group = screen.getByRole('radiogroup');
    expect(group.className).toBe('grid gap-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2');
    const labels = container.querySelectorAll('label');
    expect(labels[0].className).toContain('flex min-h-10 w-full cursor-pointer items-start gap-2.5 rounded-md px-3 py-2.5');
    expect(container.querySelector('span.mt-0\\.5.block.break-words')?.textContent).toBe('D');
    fireEvent.click(screen.getAllByRole('radio')[1]);
    expect((screen.getAllByRole('radio')[1] as HTMLElement).getAttribute('aria-checked')).toBe('true');
  });

  it('CheckboxFieldControl：max_select 守卫 + 取消到空置 null', () => {
    const onSubmitForm = vi.fn();
    renderField(
      field({ id: 'c', type: 'checkbox', label: 'C', max_select: 1, options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ] }),
      onSubmitForm,
    );
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    fireEvent.click(screen.getByRole('button', { name: 'B' }));
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tc-1', '表单', [
      { field_id: 'c', field_label: 'C', value: ['a'], display: 'A (a)' },
    ], false);

    /* 取消唯一选中项 ⇒ 值回到 null ⇒ 非必填不报错。 */
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    expect(screen.queryByText(FORM_LABELS.zh.minSelect.replace('{count}', '1'))).toBeNull();
  });

  it('CheckboxFieldControl：min_select 报错', () => {
    renderField(
      field({ id: 'c', type: 'checkbox', label: 'C', required: true, min_select: 2, options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ] }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'A' }));
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(screen.getByText('至少选择 2 项')).toBeTruthy();
  });

  it('CheckboxFieldControl：网格态用 shadcn Checkbox（role=checkbox + data-state）', () => {
    renderField(
      field({ id: 'c', type: 'checkbox', label: 'C', options: [
        { value: 'a', label: 'a'.repeat(20) },
      ] }),
    );
    const box = screen.getByRole('checkbox');
    expect(box.getAttribute('data-state')).toBe('unchecked');
    expect(box.className).toContain('data-[state=checked]:bg-white data-[state=checked]:text-black');
    fireEvent.click(box);
    expect(screen.getByRole('checkbox').getAttribute('data-state')).toBe('checked');
  });

  it('SelectFieldControl：trigger/placeholder/选项类串 + 选中写值', () => {
    const onSubmitForm = vi.fn();
    renderField(
      field({ id: 's', type: 'select', label: 'S', options: [
        { value: 'a', label: 'Alpha' },
        { value: 'b', label: 'Beta' },
      ] }),
      onSubmitForm,
    );
    const trigger = screen.getByRole('combobox');
    expect(trigger.className).toContain(
      'h-9 w-full border-white/10 bg-white/[0.03] text-[13px] text-chat-foreground shadow-none focus:ring-0 data-[placeholder]:text-muted-foreground/60',
    );
    expect(screen.getByText('请选择')).toBeTruthy();

    fireEvent.click(trigger);
    const option = screen.getByRole('option', { name: 'Alpha' });
    expect(option.className).toContain('relative flex w-full cursor-default select-none items-center rounded-sm');
    fireEvent.click(option);
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tc-1', '表单', [
      { field_id: 's', field_label: 'S', value: 'a', display: 'Alpha (a)' },
    ], false);
  });

  it('SelectFieldControl：field.placeholder 优先于 labels.selectPlaceholder', () => {
    renderField(
      field({ id: 's', type: 'select', label: 'S', placeholder: '自定义', options: [{ value: 'a', label: 'A' }] }),
    );
    expect(screen.getByText('自定义')).toBeTruthy();
  });

  it('TextFieldControl：type=text & !multiline ⇒ input（h-9）', () => {
    renderField(field({ id: 't', type: 'text', label: 'T', placeholder: 'ph', max_length: 5 }));
    const input = screen.getByPlaceholderText('ph') as HTMLInputElement;
    expect(input.getAttribute('maxlength')).toBe('5');
    expect(input.className).toContain('border-white/10 bg-white/[0.03] text-[13px] md:text-[13px]');
    expect(input.className).toContain('h-9');
  });

  it('TextFieldControl：multiline ⇒ textarea rows=3 + min-h-[72px] resize-y', () => {
    renderField(field({ id: 't', type: 'text', label: 'T', multiline: true }));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.getAttribute('rows')).toBe('3');
    expect(textarea.className).toContain('min-h-[72px] resize-y leading-5');
    expect(textarea.getAttribute('data-slot')).toBe('textarea');
  });

  it('TextFieldControl：unknown 类型也走多行（官方 multiline = c !== "text" || multiline）', () => {
    renderField(field({ id: 't', type: 'textarea', label: 'T' }));
    expect(screen.getByRole('textbox').getAttribute('rows')).toBe('3');
  });

  it('RatingFieldControl：星数 clamp、实心/空心 stroke、再点置 null', () => {
    const onSubmitForm = vi.fn();
    const { container } = renderField(field({ id: 'g', type: 'rating', label: 'G', max: 20 }), onSubmitForm);
    /* clamp(round(20), 1, 10) = 10，再 clamp 上限 10 ⇒ 10 颗。 */
    const stars = container.querySelectorAll('button[aria-label$="/10"]');
    expect(stars).toHaveLength(10);
    expect(stars[0].getAttribute('aria-label')).toBe('1/10');

    fireEvent.click(stars[2]);
    expect(container.querySelectorAll('svg.tabler-icon-star-filled')).toHaveLength(3);
    const hollow = container.querySelector('svg.tabler-icon-star:not(.tabler-icon-star-filled)') as SVGElement;
    expect(hollow.getAttribute('stroke-width')).toBe('1.33');
    expect(screen.getByText('3/10')).toBeTruthy();

    fireEvent.click(stars[2]);
    expect(screen.queryByText('3/10')).toBeNull();
    expect(container.querySelectorAll('svg.tabler-icon-star-filled')).toHaveLength(0);

    /* 默认 max ⇒ 5 颗；aria-label 形如 `${i}/${n}`，外层类串逐字。 */
    const { container: five } = render(<FormCard content={content({ title: '表单', fields: [field({ id: 'g2', type: 'rating', label: 'G2' })] })} onSubmitForm={vi.fn()} />);
    const buttons = five.querySelectorAll('button[aria-label$="/5"]');
    expect(buttons).toHaveLength(5);
    expect((buttons[0] as HTMLElement).className).toBe(
      'cursor-pointer rounded-sm p-0.5 transition-transform hover:scale-110',
    );
    expect(five.querySelector('svg.tabler-icon-star')?.getAttribute('class')).toContain(
      'text-muted-foreground/50',
    );
  });

  it('RatingFieldControl：提交的是数字，display 是 `${v}/${max}`', () => {
    const onSubmitForm = vi.fn();
    renderField(field({ id: 'g', type: 'rating', label: 'G', max: 5 }), onSubmitForm);
    fireEvent.click(screen.getByLabelText('4/5'));
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tc-1', '表单', [
      { field_id: 'g', field_label: 'G', value: 4, display: '4/5' },
    ], false);
  });

  it('SliderFieldControl：默认 min/max/step + 单位后缀 + 值域', () => {
    const { container } = renderField(field({ id: 'sl', type: 'slider', label: 'SL', unit: 'px' }));
    const range = screen.getByRole('slider') as HTMLInputElement;
    expect(range.getAttribute('min')).toBe('0');
    expect(range.getAttribute('max')).toBe('100');
    expect(range.getAttribute('step')).toBe('1');
    expect(range.value).toBe('0');
    expect(container.querySelector('span.w-14.shrink-0.text-right')?.textContent).toBe('0px');
    expect(container.querySelector('input[type=range]')?.className).toContain('absolute inset-0');
    fireEvent.change(range, { target: { value: '42' } });
    expect(container.querySelector('span.w-14.shrink-0.text-right')?.textContent).toBe('42px');
  });

  it('DateFieldControl：注入 style + 触发按钮类串 + 选中写 yyyy-MM-dd 并关面板', () => {
    const onSubmitForm = vi.fn();
    const { container } = renderField(
      field({ id: 'd', type: 'date', label: 'D', placeholder: '选日期' }),
      onSubmitForm,
    );
    const style = document.getElementById('tap-agent-form-date-popover-style') as HTMLStyleElement;
    expect(style).toBeTruthy();
    expect(style.textContent).toContain('.agent-form-date-popover .rdp {');

    const button = screen.getByText('选日期').closest('button') as HTMLButtonElement;
    expect(button.className).toBe(
      'flex h-9 w-full cursor-pointer items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 text-[13px] transition-colors hover:bg-white/[0.06]',
    );
    expect(button.querySelector('svg.tabler-icon-calendar')?.getAttribute('width')).toBe('14');

    fireEvent.click(button);
    const popover = container.querySelector('.agent-form-date-popover') as HTMLElement;
    expect(popover.className).toBe(
      'z-50 w-fit border-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 focus:outline-none agent-form-date-popover w-auto rounded-xl border border-solid border-white/20 bg-[#1c1c1e] p-2',
    );
    expect(popover.querySelector('.rdp-day_selected')).toBeNull();

    const day = popover.querySelector('td button') as HTMLButtonElement;
    fireEvent.click(day);
    /* 面板关闭（官方 setOpen(false)）。 */
    expect(container.querySelector('.agent-form-date-popover')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    const submitted = onSubmitForm.mock.calls[0][2] as Array<{ value: string }>;
    expect(submitted[0].value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('DateFieldControl：日历承接 shadcn `Calendar` 的默认 class（z0 逐字）+ 官方 6 键覆盖', () => {
    const { container } = renderField(field({ id: 'd', type: 'date', label: 'D' }));
    fireEvent.click(screen.getByText('选择日期').closest('button') as HTMLButtonElement);
    const popover = container.querySelector('.agent-form-date-popover') as HTMLElement;

    expect(popover.querySelector('.rdp')).toBeTruthy();
    const months = popover.querySelector('.rdp > div') as HTMLElement;
    expect(months.className).toBe('flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0');
    const month = months.firstElementChild as HTMLElement;
    expect(month.className).toBe('space-y-4');
    const caption = month.firstElementChild as HTMLElement;
    expect(caption.className).toBe('flex justify-center pt-1 relative items-center');
    expect(caption.firstElementChild?.className).toBe('space-x-1 flex items-center');
    expect(popover.querySelector('button[aria-label="Previous Month"]')?.className).toBe(
      'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1',
    );
    expect(popover.querySelector('button[aria-label="Next Month"]')?.className).toBe(
      'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1',
    );
    expect(popover.querySelector('table')?.className).toBe('w-full border-collapse space-y-1');
    expect(popover.querySelector('thead tr')?.className).toBe('flex');
    expect(popover.querySelector('th')?.className).toBe(
      'text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]',
    );
    expect(popover.querySelector('tbody tr')?.className).toBe('flex w-full mt-2');

    /* 官方 `ose` 传入的 6 个键：cell / day 逐字来自官方调用点。 */
    expect(popover.querySelector('td')?.className).toBe(
      'relative p-0 text-center [&:has([aria-selected])]:rounded-md',
    );
    expect(popover.querySelector('td button')?.className).toContain(
      'inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-xs font-normal text-chat-foreground transition-colors aria-selected:font-medium aria-selected:opacity-100',
    );
    /* 该月之前的日子带官方 day_outside。 */
    expect(popover.querySelector('td button')?.className).toContain('text-muted-foreground/40');
  });

  it('DateFieldControl：已选日期 ⇒ 命中 day_selected（rdp-day_selected，供注入 CSS 用）', () => {
    render(
      <FormCard
        content={content({ title: '表单', fields: [field({ id: 'd', type: 'date', label: 'D' })] })}
        onSubmitForm={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('选择日期').closest('button') as HTMLButtonElement);
    fireEvent.click(document.querySelector('.rdp td button') as HTMLButtonElement);
    /* 面板已关闭，但值已写入 ⇒ 重新打开时该日带 rdp-day_selected。 */
    fireEvent.click(screen.getByText(/^\d{4}-\d{2}-\d{2}$/).closest('button') as HTMLButtonElement);
    expect(document.querySelector('.rdp .rdp-day_selected')).toBeTruthy();
  });

  it('NumberFieldControl：默认 step=1、减号/加号禁用规则、单位', () => {
    const onSubmitForm = vi.fn();
    const { container } = renderField(
      field({ id: 'n', type: 'number', label: 'N', min: 0, max: 2, unit: '个' }),
      onSubmitForm,
    );
    const minus = screen.getByLabelText('minus') as HTMLButtonElement;
    const plus = screen.getByLabelText('plus') as HTMLButtonElement;
    /* 值为 null ⇒ 两个按钮都不禁用（官方 c/d 都要求 o !== null）。 */
    expect(minus.disabled).toBe(false);
    expect(plus.disabled).toBe(false);
    expect(minus.className).toBe(
      'flex h-full w-8 shrink-0 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-chat-foreground disabled:cursor-not-allowed disabled:opacity-30',
    );
    expect(container.querySelector('span.text-\\[11px\\].text-muted-foreground')?.textContent).toBe('个');

    /* 从 null 起步 ⇒ 起点是 min=0，+1 ⇒ 1；再 +1 ⇒ 2（达到 max，加号禁用）。 */
    fireEvent.click(plus);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
    fireEvent.click(plus);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText('plus') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(minus);
    fireEvent.click(minus);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('0');
    expect((screen.getByLabelText('minus') as HTMLButtonElement).disabled).toBe(true);
  });

  it('NumberFieldControl：onBlur 会把越界值 clamp 回边界', () => {
    renderField(field({ id: 'n', type: 'number', label: 'N', min: 1, max: 5 }));
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } });
    expect(input.value).toBe('99');
    fireEvent.blur(input);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('5');
  });

  it('NumberFieldControl：清空 ⇒ null', () => {
    const onSubmitForm = vi.fn();
    renderField(field({ id: 'n', type: 'number', label: 'N' }), onSubmitForm);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '3' } });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tc-1', '表单', [
      { field_id: 'n', field_label: 'N', value: null, display: null },
    ], false);
  });

  it('ImageSelectFieldControl：网格 96px、file_id ⇒ img、无 file_id ⇒ IconPhoto、选中角标', () => {
    const onSubmitForm = vi.fn();
    const { container } = renderField(
      field({ id: 'img', type: 'image_select', label: 'IMG', max_select: 1, options: [
        { value: 'a', label: 'A', file_id: 'https://cdn.example/a.png' },
        { value: 'b', label: 'B' },
      ] }),
      onSubmitForm,
    );
    const grid = container.querySelector('div.grid') as HTMLElement;
    expect(grid.className).toBe('grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2');

    const buttons = grid.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].className).toContain('group relative cursor-pointer overflow-hidden rounded-lg transition-all');
    expect(buttons[0].querySelector('img')?.getAttribute('src')).toBe('https://cdn.example/a.png');
    expect(buttons[1].querySelector('svg.tabler-icon-photo')?.getAttribute('width')).toBe('22');

    fireEvent.click(buttons[0]);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[0].querySelector('span.absolute.right-1\\.5')).toBeTruthy();
    expect(buttons[0].querySelector('svg.tabler-icon-check')?.getAttribute('stroke-width')).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmitForm).toHaveBeenCalledWith('tc-1', '表单', [
      { field_id: 'img', field_label: 'IMG', value: ['a'], display: 'A (a)' },
    ], false);
  });

  it('ImageSelectFieldControl：选中项在 max_select 下不可再加', () => {
    const { container } = renderField(
      field({ id: 'img', type: 'image_select', label: 'IMG', max_select: 1, options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ] }),
    );
    const buttons = container.querySelectorAll('div.grid button');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
  });

  it('ThumbnailImage：onError ⇒ 退化成 IconPhoto 占位（官方 eF 的 broken 分支）', () => {
    const { container } = renderField(
      field({ id: 'img', type: 'image_select', label: 'IMG', options: [
        { value: 'a', label: 'A', file_id: 'not-a-url' },
      ] }),
    );
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(img.className).toContain('object-cover');
    fireEvent.error(img);
    const fallback = container.querySelector('span.flex.items-center.justify-center');
    expect(fallback?.querySelector('svg.tabler-icon-photo')?.getAttribute('width')).toBe('22');
  });

  it('FormFieldBlock：字段标题类串 + description 类串 + error 类串', () => {
    const { container } = renderField(
      field({ id: 't', type: 'text', label: '字段标题', description: '字段说明' }),
    );
    const label = screen.getByText('字段标题');
    expect(label.className).toBe('text-[13px] font-medium leading-5 text-chat-foreground');
    expect(screen.getByText('字段说明').className).toBe(
      'text-xs leading-5 text-[var(--form-desc,var(--secondary-muted-foreground))]',
    );
    const block = container.querySelector('div.space-y-2\\.5') as HTMLElement;
    expect(block.className).toBe('space-y-2.5');
    expect(container.querySelector('div.space-y-1')).toBeTruthy();
  });
});

describe('SubmissionRows / FormSubmissionSummaryCard', () => {
  it('SubmissionRows：未填字段显示 unansweredLabel + muted/50', () => {
    render(
      <SubmissionRows
        values={[
          { field_id: 'a', field_label: '文本', value: 'hello', display: 'hello' },
          { field_id: 'b', field_label: '空', value: null, display: null },
        ]}
        unansweredLabel={FORM_LABELS.zh.unanswered}
      />,
    );
    const rows = document.querySelectorAll('div.space-y-1\\.5 > div');
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toBe('flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-5');
    expect(rows[0].firstElementChild?.className).toBe('shrink-0 text-muted-foreground');
    expect(rows[1].lastElementChild?.className).toBe('min-w-0 break-words text-muted-foreground/50');
    expect(rows[1].lastElementChild?.textContent).toBe('未填写');
    expect(rows[0].lastElementChild?.className).toBe('min-w-0 break-words text-chat-foreground');
  });

  it('SubmissionRows：imageFields 命中时把 value 当 file_id 列表渲染 36px 缩略图', () => {
    const { container } = render(
      <SubmissionRows
        values={[{ field_id: 'img', field_label: '图', value: ['a'], display: 'A (a)' }]}
        unansweredLabel="未填写"
        imageFields={new Map([['img', new Map([['a', 'https://cdn.example/z.png']])]])}
      />,
    );
    expect(container.querySelector('span.flex.flex-wrap.items-center.gap-1\\.5')).toBeTruthy();
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://cdn.example/z.png');
    expect(img.className).toContain('h-9 w-9 rounded-md');
  });

  it('SubmissionRows：imageFields 未命中同名键 ⇒ 仍按 display 渲染', () => {
    const { container } = render(
      <SubmissionRows
        values={[{ field_id: 'img', field_label: '图', value: ['a'], display: 'A (a)' }]}
        unansweredLabel="未填写"
        imageFields={new Map()}
      />,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('A (a)')).toBeTruthy();
  });

  it('FormSubmissionSummaryCard：360px 壳 + 状态字（中文文案按内容侦测）', () => {
    render(
      <FormSubmissionSummaryCard
        content={{ tool_call_id: 'tc', form_title: '中文表单', skipped: false, values: [
          { field_id: 'a', field_label: '字段', value: 'v', display: 'V' },
        ] }}
      />,
    );
    const card = document.querySelector('div.w-full.min-w-0.max-w-\\[360px\\]') as HTMLElement;
    expect(card.className).toBe(
      'w-full min-w-0 max-w-[360px] space-y-2 rounded-xl bg-white/[0.04] px-3.5 py-3',
    );
    const header = card.firstElementChild as HTMLElement;
    expect(header.className).toBe('flex items-center gap-1.5');
    expect(header.querySelector('svg.tabler-icon-clipboard-list')?.getAttribute('width')).toBe('16');
    expect(screen.getByText('中文表单').className).toBe(
      'min-w-0 break-words text-xs font-medium leading-4 text-chat-foreground',
    );
    expect(screen.getByText('已提交').className).toBe('ml-auto shrink-0 text-[11px] text-muted-foreground');
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('FormSubmissionSummaryCard：英文内容 ⇒ 英文状态字（PM 按内容侦测，不走 i18n）', () => {
    render(
      <FormSubmissionSummaryCard
        content={{ tool_call_id: 'tc', form_title: 'English form', skipped: false, values: [] }}
      />,
    );
    expect(screen.getByText('Submitted')).toBeTruthy();
  });

  it('FormSubmissionSummaryCard：skipped ⇒ Skipped 且不渲染 rows', () => {
    const { container } = render(
      <FormSubmissionSummaryCard
        content={{ tool_call_id: 'tc', form_title: 'English form', skipped: true, values: [
          { field_id: 'a', field_label: 'X', value: 1, display: '1' },
        ] }}
      />,
    );
    expect(screen.getByText('Skipped')).toBeTruthy();
    expect(container.querySelector('div.space-y-1\\.5')).toBeNull();
  });

  it('FormSubmissionSummaryCard：缺 tool_call_id ⇒ 渲染 null（qoe 返回 null）', () => {
    const { container } = render(<FormSubmissionSummaryCard content={{ form_title: 'X' }} />);
    expect(container.firstChild).toBeNull();
  });

  it('FormSubmissionSummaryCard：英文 + 未填字段显示 Not answered', () => {
    render(
      <FormSubmissionSummaryCard
        content={{ tool_call_id: 'tc', form_title: 'Form', skipped: false, values: [
          { field_id: 'a', field_label: 'Label', value: null, display: null },
        ] }}
      />,
    );
    expect(screen.getByText('Not answered')).toBeTruthy();
  });
});
