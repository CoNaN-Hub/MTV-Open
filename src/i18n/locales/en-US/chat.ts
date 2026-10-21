/**
 * 对话面板（chat）
 */
const chat = {
  // ── 输入卡占位（官方 chatAdapter.input.*）──
  '随心输入': 'Type anything',
  '描述创意或需求, ': 'Describe ideas, ',
  '使用技能': 'use skills, ',
  '添加画布内容': 'add canvas content, ',
  '引用参考或使用应用': 'add references or use Apps',
  '我们来讨论：{title}': "Let's discuss: {title}",
  /* 官方 `chatAdapter.userMessage.showMore` / `showLess`（用户消息折叠展开） */
  '展开': 'Show more',
  '收起': 'Show less',
  /* ── 官方 chatAdapter 文案补齐（原来这些中文源串在 en/ja/ko 里**一个都没有** ⇒ 直接吐中文）──
     值取自官方 en/ja/ko 包（`index-DjCL4F9p.js`）；官方没有 ja/ko 条目的键按官方回落英文。 */
  '文件': 'Outputs',
  '暂无输出': 'No outputs yet',
  '在对话中讨论': 'Discuss in chat',
  '聊天记录': 'Chat history',
  '引用文本': 'Quoted Text',
  '用量统计': 'Usage',
  '头脑风暴': 'Brainstorm',
  '技能': 'Skill',
  '更新': 'Update',
  '更新中': 'Updating',
  '编辑这部分': 'Edit this section',
  '今天一起创作点什么？': 'What are we making today?',
  '添加本地文件夹': 'Add local folder',
  '上传技能文件夹': 'Upload skill folder',
  '暂无技能': 'No Skills yet',
  /* 技能子面板（官方 `chatAdapter.addMenu.skills.*` 逐字） */
  '搜索': 'Search',
  '暂无已启用技能': 'No enabled Skills',
  '创建技能': 'Create skill',
  '管理技能': 'Manage skill',
  /* 官方 `chatAdapter.addMenu.skills.editSkill` / `common.save` / `updateSuccess` 等逐字 */
  '编辑技能': 'Edit Skill',
  '技能更新成功': 'Skill updated successfully',
  '技能创建成功': 'Skill created successfully',
  /* 「从画布添加」拾取模式浮条（官方 `insertFromCanvasPick.*` + `common.exit` 逐字） */
  '点击节点以添加为引用': 'Click nodes to add as reference',
  '退出': 'Exit',
  /* 官方 `nodeSelectionMode.selectLabel`（拾取模式跟随光标提示条的前缀） */
  '选择': 'Select',
  /* 官方 `chatAdapter.modelOptions.models.auto.description`（zh 原文；en/ja/ko 为 MTV 补齐） */
  '平衡速度、思考强度与成本。': 'Balances speed, thinking effort, and cost.',
  /* 官方「创建技能」/「管理技能」对话框（`chatAdapter.addMenu.skills.*`） */
  '应用': 'Apps',
  '技能名称': 'Skill name',
  '输入名称': 'Enter name',
  '描述': 'Description',
  '输入描述': 'Enter description',
  '指令': 'Instructions',
  '输入指令': 'Enter instruction',
  '只允许小写字母、数字和连字符': 'Only lowercase letters, numbers, and hyphens are allowed.',
  'Agent 会根据这些描述决定在对话中使用哪些技能。': 'The Agent uses these descriptions to decide which Skills to use in a conversation.',
  '名称只能包含小写字母、数字和连字符，最长 64 字符': 'Use 1-64 lowercase letters, numbers, and hyphens only',
  /* 官方 `chatAdapter.addMenu.skills.errors.*`（提交时逐条校验；官方 en 逐字） */
  '请输入技能名称': 'Skill name is required',
  '技能名称不能超过 64 个字符': 'Skill name must be at most 64 characters',
  '请输入描述': 'Description is required',
  '描述不能超过 1024 个字符': 'Description must be at most 1024 characters',
  '请输入指令': 'Instructions are required',
  '指令不能超过 20000 个字符': 'Instructions must be at most 20000 characters',
  '取消': 'Cancel',
  '创建': 'Create',
  /* 官方「放弃编辑」确认框（`discardEditTitle` / `discardEditDesc` / `common.discard`） */
  '放弃更改？': 'Discard changes?',
  '未保存的更改将会丢失。': 'Your unsaved changes will be lost.',
  '放弃': 'Discard',
  /* 官方 `chatAdapter.addMenu.skills.{useInChat,uninstall,back}` */
  '在对话中使用': 'Use in chat',
  '卸载': 'Uninstall',
  '返回': 'Back',
  '个人': 'Personal',
  '本地文件夹': 'Local folder',
  '关闭': 'Close',
  '暂无应用': 'No apps yet',
  '移除技能': 'Remove Skill',
  '从画布添加': 'Insert from canvas',
  '开始对话，内容会自动同步到这里。': 'Start a conversation and content will sync here automatically.',
  /* 官方 `chatAdapter.feedback.thumbsUp/thumbsDown`（原文「好评/差评」） */
  '好评': 'Good response',
  /* 官方 `chatAdapter.mediaDetail.viewOnCanvas`（`applyToCanvas` 复用 character.ts 里已有的「添加到画布」） */
  '在画布上查看': 'View on Canvas',
  '差评': 'Bad response',
  /* 以下为 MTV 自有 UI 文案（官方无对应键，`AgentApprovalCard` 的供应商模型选择器等） */
  '添加': 'Add',
  '等待你的决定': 'Waiting for your decision',
  '换一批建议': 'New suggestions',
  '没有匹配的模型': 'No matching models',
  '每批最多 {count} 个；筛选和翻页会保留已选项。': 'Up to {count} per batch; filtering and paging keep your selections.',
  '模型目录已过期，请拒绝本次选择并重新读取目录。': 'The model catalog expired. Reject this selection and reload the catalog.',
  '清空已选': 'Clear selection',
  '取消本页此类选择': 'Deselect this category on this page',
  '全部分类': 'All categories',
  '筛选结果 {count} 个': '{count} filtered results',
  '上一页': 'Previous page',
  '下一页': 'Next page',
  '搜索模型名称或 ID': 'Search model name or ID',
  '选取本页此类（受批次上限限制）': 'Select this category on this page (batch limit applies)',
  '已开启头脑风暴': 'Brainstorm enabled',
  '已关闭头脑风暴': 'Brainstorm disabled',
  '已在新会话中继续': 'Continued in a new conversation',
  '在新会话中继续': 'Continue in a new conversation',
  '智能体大纲': 'Agent outline',
  'Agent 正忙——完成后再试': 'Agent is busy — try again once it finishes',
  '按安装时识别的入口与 Skill 目录展示。': 'Shown by the entry point and Skill directory detected at install time.',
  '上传附件': 'Upload attachment',
  '已处理': 'Worked',
  '处理了 {duration}': 'Worked for {duration}',
  '松开以添加附件': 'Drop to add attachment',
  '已达到附件数量上限（最多{maxAttachments}个）': 'Attachment limit reached ({{maxAttachments}} max)',
  '这条消息无法显示': 'This message could not be displayed.',
  '更多操作': 'More actions',
  '清空内容': 'Clear content',
  '暂不支持预览该文件类型': 'Preview not supported for this file type',
  // ── ChatHeader ──
  '收起对话': 'Collapse chat',
  '未命名对话': 'New Chat',
  '暂无历史记录': 'No history yet',
  /* ── 会话下拉 · legacy 分组 / 只读徽标 / 分页 / banner（官方 `chatAdapter.conversation.*`）──
     官方词典逐字（canvas chunk @3541093）：
     legacySectionTitle / readOnlyLabel / loadMoreLegacy / loading / legacyReadOnlyBanner / starterReplayViewOnlyBanner。
     ⚠️ `conversation.deleteFailed`（zh「删除失败」）本仓库已存在于本文件族以外的 settings.ts，且 en/ja 值与官方一致，
     按「已有词条不重复落库」的原则这里不重复登记（ko 官方值 "삭제 실패" 与既有 "삭제에 실패했습니다" 措辞略异，见落地报告诚实清单）。 */
  '历史对话（仅可查看）': 'History (view only)',
  '仅可查看': 'View only',
  '加载更多': 'Load more',
  '加载对话中...': 'Loading conversation...',
  '旧版聊天记录已归档。请复制内容至新版 Agent 窗口继续对话。': 'Archived. Continue in the new Agent.',
  '新手教程演示记录，仅供回看。': 'Starter tutorial demo. View only.',
  '刚刚': 'just now',
  '返回会话列表': 'Back to conversation list',
  'AI 助手': 'AI Assistant',
  '任务中心': 'Task Center',
  '任务中心，{count} 个进行中': 'Task Center, {count} in progress',
  '项目记忆': 'Project memory',
  '子智能体': 'Sub-agents',

  // ── EmptyChatState ──
  '新建对话': 'New conversation',
  '历史记录': 'History',
  '试试这些：': 'Try these:',
  '现在有几个失败节点？': 'How many failed nodes are there?',
  '选中 3 号节点': 'Select node #3',
  '删除失败节点': 'Delete failed nodes',
  '打开 AI 助手': 'Open AI Assistant',
  '智能体中心': 'Agent Center',
  '直接开始对话，或按需安装智能体来扩展专业能力。没有智能体时，默认助手仍可正常使用。':
    'Start chatting right away, or install agents when you need specialist capabilities. The default assistant keeps working without any agents.',
  '默认助手': 'Default assistant',
  '始终可用': 'Always available',
  '不安装智能体也能继续使用聊天、画布、工作流和模型功能。':
    'Chat, canvas, workflows, and models keep working without installed agents.',
  '上传智能体': 'Upload agent',
  '文件夹会保持只读链接；压缩包会导入软件管理目录。上传只做预检，不会执行包内脚本。':
    'Folders stay read-only links; archives are imported into app-managed storage. Upload only validates the package and never runs bundled scripts.',
  '选择压缩包': 'Choose archive',
  '支持 .aicanvas-agent、.tgz 和 .tar.gz': 'Supports .aicanvas-agent, .tgz, and .tar.gz',
  '{count} 个已安装': '{count} installed',
  '还没有安装外部智能体': 'No external agents installed',
  '这不会影响默认助手和软件其他功能。': 'This does not affect the default assistant or other app features.',
  '正在读取智能体目录…': 'Loading agent catalog…',
  '智能体目录当前受限（{code}）': 'The agent catalog is currently degraded ({code})',
  '链接文件夹': 'Linked folder',
  '托管压缩包': 'Managed archive',
  '{count} 个 Skill': '{count} Skill(s)',
  '{count} 条预检提醒': '{count} validation warning(s)',
  '可用': 'Ready',
  '受限': 'Degraded',
  '无效': 'Invalid',
  '来源丢失': 'Source missing',
  '启用智能体 {name}': 'Enable agent {name}',
  '停用智能体 {name}': 'Disable agent {name}',
  '移除智能体 {name}': 'Remove agent {name}',
  '已启用': 'Enabled',
  '已停用': 'Disabled',
  'MCP 只读': 'MCP read-only',
  '仅允许 MCP 客户端列出、加载和读取该智能体中的 Skill，不会执行包内脚本。':
    'Only lets MCP clients list, load, and read Skills from this agent. Bundled scripts are never executed.',
  '允许 MCP 读取智能体 {name} 的 Skill': 'Allow MCP to read Skills from agent {name}',
  '禁止 MCP 读取智能体 {name} 的 Skill': 'Stop MCP from reading Skills from agent {name}',
  '已允许': 'Allowed',
  '未允许': 'Not allowed',
  '智能体 MCP 权限保存失败': 'Failed to save agent MCP permission',
  '我的 Skill': 'My Skills',
  '暂无可调用 Skill': 'No callable Skills yet',
  '已安装智能体「{name}」': 'Installed agent “{name}”',
  '智能体上传失败': 'Agent upload failed',
  '智能体状态保存失败': 'Failed to save agent state',
  '确定从软件中移除智能体「{name}」？外部文件不会被删除。':
    'Remove agent “{name}” from the app? External files will not be deleted.',
  '已移除智能体「{name}」': 'Removed agent “{name}”',
  '移除智能体失败': 'Failed to remove agent',

  // ── ConversationList ──
  '对话': 'Conversations',
  '新对话': 'New conversation',
  '搜索对话': 'Search conversations',
  '搜索对话…': 'Search conversations…',
  '没有匹配的对话': 'No matching conversations',
  '还没有对话': 'No conversations yet',
  '置顶': 'Pinned',
  '最近': 'Recent',
  '打开“{title}”的操作菜单': 'Open the menu for "{title}"',
  '重命名': 'Rename',
  '取消置顶': 'Unpin',
  '归档': 'Archive',
  '移入回收站': 'Move to trash',
  '排队': 'Queued',
  '规划': 'Planning',
  '运行': 'Running',
  '工具': 'Tool',
  '待确认': 'Awaiting confirmation',
  '暂停': 'Paused',
  '失败': 'Failed',

  // ── ChatInput ──
  '全部': 'All',
  '节点': 'Node',
  '未配置': 'Not configured',
  '请先配置对应供应商': 'Configure the provider first',
  '{name}（引用参考图）': '{name} (references image)',
  '{name}（引用设定文字）': '{name} (references text)',
  '上传 Skill 失败': 'Failed to upload Skill',
  '撤销 {name} 的读取授权': 'Revoke read access for {name}',
  '输入消息，@n 节点 · @a 资产 · @m 模型 · / 调用 Skill':
    'Type a message. @n nodes · @a assets · @m models · / for Skills',
  '节点与模型引用': 'Node and model references',
  '画布节点': 'Canvas nodes',
  '资产库': 'Asset library',
  '模型': 'Model',
  '没有匹配"{query}"的{noun}': 'No {noun} matching "{query}"',
  '暂无可引用的{noun}': 'No {noun} to reference yet',
  'Skill 引用': 'Skill references',
  '上传 Skill': 'Upload Skill',
  '上传 Skill 文件': 'Upload a Skill file',
  '没有匹配"{query}"的 Skill': 'No Skill matching "{query}"',
  '引用画布节点或媒体模型': 'Reference canvas nodes or media models',
  '调用 Skill': 'Invoke a Skill',
  '授权当前对话读取本地文件': 'Authorize this conversation to read local files',
  '选择文本文件；授权仅在当前对话和本次运行期间有效':
    'Choose text files; the grant is valid only for this conversation and this run',
  '调整当前任务': 'Adjust the current task',
  '在下一个安全步骤调整当前任务': 'Adjust the current task at the next safe step',
  '将消息加入队列': 'Queue this message',
  '发送消息': 'Send message',
  '当前任务完成后发送': 'Send after the current task finishes',
  '重要操作执行前会请求确认': 'Important actions require confirmation before running',
  '角色': 'Character',
  '场景': 'Scene',
  '道具': 'Prop',
  '图片': 'Image',
  '视频': 'Video',
  '音频': 'Audio',
  '资产': 'Asset',

  // ── GenerationConfirmModeSwitch（**官方词典路径**，取值逐字取自官方 zh/en 表）──
  'chatAdapter.confirmMode.ask': 'Ask',
  'chatAdapter.confirmMode.askTitle': 'Ask before acting',
  'chatAdapter.confirmMode.askDesc': 'TapNow pauses so you can approve each action.',
  'chatAdapter.confirmMode.auto': 'Act',
  'chatAdapter.confirmMode.autoTitle': 'Act without asking',
  'chatAdapter.confirmMode.autoDesc': 'TapNow works without asking for approval.',
  'chatAdapter.localPermissionMenu.alwaysConfirmDescription': 'Always ask for generation and every local file or folder operation.',
  'chatAdapter.localPermissionMenu.autoExceptDeleteDescription': 'Auto-run generation and safe local ops in mounted folders. Delete still needs confirmation.',
  'chatAdapter.localPermissionMenu.learnMore': 'Learn more',
  // ── 官方 `chatAdapter.fork.*`（`JV` @2583040 / `Xrt` @2581826；官方词典 @3565510–@3565668 逐字）──
  'chatAdapter.fork.fromConversation': 'Continued from chat',
  'chatAdapter.fork.viewPreviousHistory': 'View previous history',
  'chatAdapter.fork.hidePreviousHistory': 'Hide previous history',

  // ── ContextUsageIndicator ──
  '模型配置声明': 'declared in model config',
  '按模型 ID 推断': 'inferred from model ID',
  '未识别模型，使用保守默认值': 'unrecognized model, using a conservative default',
  '上下文占用（估算）：约 {tokens} token': 'Context usage (estimated): about {tokens} tokens',
  '模型上下文窗口：{tokens} token（{source}）': 'Model context window: {tokens} tokens ({source})',
  '输入预算：{tokens} token，已用约 {percent}%': 'Input budget: {tokens} tokens, about {percent}% used',
  '接近上限时会自动压缩较早的对话，不会删除原始历史':
    'Earlier messages are compressed automatically when nearing the limit; the original history is never deleted',
  '上下文占用约 {percent}%': 'Context usage about {percent}%',

  // ── ChatMessages ──
  '开始对话': 'Start a conversation',
  '用自然语言操作画布，AI 助手帮你完成': 'Control the canvas in natural language, and the AI assistant will help',
  '加载更早消息（还有 {count} 条）': 'Load earlier messages ({count} remaining)',
  '回到最新消息，{count} 条未读': 'Back to latest, {count} unread',
  '回到最新消息': 'Back to latest messages',
  '最新消息': 'Latest',

  // ── ChatPanel toast ──
  '已添加到画布': 'Added to canvas',
  '添加节点失败': 'Failed to add node',
  '产物已保存到项目': 'Artifact saved to project',
  '保存失败': 'Save failed',
  '该确认已过期，请重新发起操作': 'This confirmation has expired; please retry the action',
  '已暂停任务': 'Task paused',
  '已继续任务': 'Task resumed',
  '无法继续该任务': 'Cannot resume this task',
  '已停止任务': 'Task stopped',
  '已跳过当前步骤，可继续或重新规划': 'Current step skipped; you can continue or replan',
  '该步骤已无法跳过': 'This step can no longer be skipped',
  '该任务当前状态无法重新规划': 'This task cannot be replanned in its current state',
  '正在重新规划任务': 'Replanning the task',
  '无法重新规划该任务': 'Cannot replan this task',
  '已回退该任务的画布修改': 'Canvas changes from this task have been rolled back',
  '无法回退任务': 'Cannot roll back the task',
  '已授权 {count} 个文件': 'Authorized {count} file(s)',
  '未新增文件授权': 'No new file grants',
  '文件授权失败': 'File authorization failed',
  '引用的节点已不存在': 'The referenced node no longer exists',

  // ── MessageBubble ──
  '正在分析请求': 'Analyzing the request',
  '正在生成媒体内容...': 'Generating media…',
  '生成的图片': 'Generated image',
  '您的浏览器不支持视频播放': 'Your browser does not support video playback',
  '生成的音乐': 'Generated music',
  '生成的语音': 'Generated voice',
  '您的浏览器不支持音频播放': 'Your browser does not support audio playback',
  '已生成但未保存到项目：{error}': 'Generated but not saved to the project: {error}',
  '写入项目目录失败': 'Failed to write to the project directory',
  '保存中': 'Saving',
  '重试保存': 'Retry save',
  /* ── 官方 `chatAdapter.agentEvent.toolDescriptions.*.failed_one`（媒体生成失败文案族）──
     官方**没有**「Media generation failed: {error}」这种句式（`媒体生成失败` 在 4 个官方产物里
     命中数 = 0）⇒ 原来的 `'媒体生成失败：{error}'` 已删除，改用官方 tool-event 失败描述。
     取值逐字取自 en `toolDescriptions` 块（`legacyToolEvent` 之后，@**3602627** 起）：
       · `gen_image.failed_one` @3604383 / `gen_video.failed_one` @3605285
       · `fallback.failed_one` = "Failed to run {{label}}."（音频档：官方**无** `gen_audio`，
         用官方通用模板 + 官方 `featureTag.audio` = `Audio`）
       · `canvas.agent.generationFailed` = "Generation failed"（类型未知时）
     下方每条的注释给出官方 offset。 */
  '图片生成失败，本次生成不会消耗积分。': 'Failed to generate the image. This generation will not consume credits.',
  '视频生成失败，本次生成不会消耗积分。': 'Failed to produce the video. This generation will not consume credits.',
  /* 官方 `fallback.failed_one`("Failed to run {{label}}.") + `featureTag.audio`("Audio") 合成。 */
  '音频 执行失败。': 'Failed to run Audio.',
  /* 官方 `canvas.agent.generationFailed`。 */
  '生成失败': 'Generation failed',
  '未知错误': 'Unknown error',
  '正在创建画布节点...': 'Creating canvas node…',
  '节点创建失败：{error}': 'Node creation failed: {error}',
  /* ── 官方 `chatAdapter.errors.*`：错误横幅的**唯一**文案来源 ──
     key = 官方 zh 词典原文（MTV 约定「中文原文即 key」，zh 无需词条）。
     取值逐字取自 `live-assets-new/vendor-pkg-canvas-CvbAwZyy.js` 的 `errors` 块：
     en **@3616735**（`messageNotSent` 起）→ `agentErrorFallback`/`compactionTimeout`/`runtimeStreamTimeout`
     在 **@3617412** 邻域。
     ⚠️ 原 `'响应失败'`（= 'Response failed'）是 **MTV 自造兜底**，官方没有这个键/句子；
     它随 `MessageBubble` 里 `status==='error'` 那条渲染路径一起删除（官方只有 `agent_error` item 一条
     横幅通路，`data-testid="agent-error-banner"` 全 bundle 命中数 = 1）。 */
  '抱歉，发生了错误。请稍后重试。': 'Sorry, an error occurred. Please try again later.',
  '流式处理出错，请重试。': 'Stream processing error, please try again.',
  '您无权使用此模型。请升级套餐或选择其他模型。': 'You do not have permission to use this model. Please upgrade your plan or select another model.',
  '复制失败': 'Failed to copy',
  '您无权访问此会话。': 'You do not have permission to access this conversation.',
  '当前使用已达上限，请稍后重试。': 'Rate limit reached, please try again later.',
  '输入内容超过长度限制。': 'Input exceeds the maximum length limit.',
  '该消息无法显示。': 'This message could not be displayed.',
  '消息发送失败，请稍后重试。': 'Failed to send message, please try again.',
  '余额不足，无法发起对话。': 'Insufficient balance to start conversation.',
  'Agent 本轮执行失败，请重试。': 'The Agent run failed. Please try again.',
  '云端任务在压缩上下文期间超时，本轮已停止。此前完成的操作不会回滚；继续时请复用已有成果。': 'The cloud run timed out while compacting context and has stopped. Earlier actions were not rolled back; reuse existing results when continuing.',
  '云端任务长时间未返回进展，已超时。可以重试继续。': 'The cloud run stopped returning progress and timed out. You can retry to continue.',
  '响应中断': 'Response interrupted',
  '消息已复制': 'Message copied',
  '复制消息': 'Copy message',
  '复制': 'Copy',
  /* 官方通用「节点选择模式」+ 图片卡「添加参考图」下拉（nodeSelectionMode.* / image.promptBar.*） */
  '从画布选择参考': 'Select reference from canvas',
  '选择节点连接': 'Select to Connect',
  '点击节点以创建连线': 'Click on a node to create a connection',
  '添加参考图': 'Add reference image',
  '从画布选择': 'Select from canvas',
  '从设备上传': 'Upload from device',
  /* 官方 `chatAdapter.feedback.*`（代码块右下角两个按钮）：copy/copied/wrap/unwrap */
  '已复制': 'Copied',
  '自动换行': 'Wrap',
  '不换行': 'No wrap',
  '编辑并再次发送': 'Edit and resend',
  '再次生成回答': 'Regenerate the answer',
  '再次生成': 'Regenerate',

  // ── SourceList ──
  '来源（{count}）': 'Sources ({count})',

  // ── AgentTaskTimeline · 状态 ──
  '排队中': 'Queued',
  '规划中': 'Planning',
  '执行中': 'Running',
  '调用工具': 'Calling tool',
  '等待确认': 'Awaiting confirmation',
  '已暂停': 'Paused',
  '已完成': 'Completed',
  '已停止': 'Stopped',
  '运行记录': 'Run log',
  '等待确认：{title}': 'Awaiting confirmation: {title}',
  '等待用户确认': 'Awaiting user confirmation',
  '准备{title}': 'Preparing {title}',
  '正在{title}': 'Running {title}',
  '正在等待执行': 'Waiting to run',
  '正在分析工具结果': 'Analyzing tool results',
  '正在调用工具': 'Calling a tool',
  '正在整理结果': 'Compiling results',
  '{count} 步': '{count} step(s)',
  '{count} 次拒绝': '{count} denial(s)',
  '{count} 次重试': '{count} retry/retries',

  // ── AgentTaskTimeline · 暂停原因 ──
  '你已暂停': 'Paused by you',
  '已达模型轮次上限': 'Model round limit reached',
  '已达工具调用上限': 'Tool call limit reached',
  '工具结果已达上限': 'Tool result limit reached',
  '上下文接近模型上限': 'Context is near the model limit',
  '已达任务总预算上限': 'Total task budget reached',
  '上下文压缩失败': 'Context compression failed',
  '已跳过步骤，需重新规划': 'Step skipped; replan required',
  '已请求重新规划': 'Replan requested',
  '应用重启后暂停': 'Paused after app restart',

  // ── AgentTaskTimeline · 工具活动 ──
  '正在搜索网页': 'Searching the web',
  '正在浏览网页': 'Browsing a web page',
  '正在查看已授权文件': 'Listing authorized files',
  '正在读取文件': 'Reading a file',
  '正在读取接口文档': 'Reading provider docs',

  // ── AgentTaskTimeline · 控制 ──
  '已注入 Skill': 'Skill injected',
  '继续': 'Resume',
  '跳过此步': 'Skip this step',
  '重新规划': 'Replan',
  '停止': 'Stop',
  '回退任务画布修改': 'Roll back canvas changes',

  // ── AgentStepCard ──
  '等待': 'Waiting',
  '完成': 'Done',
  '跳过': 'Skipped',
  '重试 {count}': 'retried {count}',

  // ── AgentApprovalCard ──
  '需要你选择': 'Needs your choice',
  '画布修改': 'Canvas change',
  '写入文件': 'Write file',
  '永久删除': 'Permanent delete',
  '生成媒体': 'Generate media',
  '保存记忆': 'Save memory',
  'API 配置': 'API config',
  '资产库写入': 'Asset library write',
  '{label}待确认': '{label} pending confirmation',
  '不会写入 API Key；新连接保持空白，已有连接保留原值。':
    'API keys are never written; new connections stay blank and existing ones keep their values.',
  '生图': 'Image',
  '选择{kind}模型': 'Choose a {kind} model',
  '模型未配置或当前不可用': 'Model not configured or currently unavailable',
  '暂无可用模型，请先在设置中完成模型配置。': 'No available models; configure them in Settings first.',
  '勾选要接入的模型（已选 {selected} / {total}）': 'Select models to add ({selected}/{total} selected)',
  '拒绝': 'Reject',
  '确认生成': 'Confirm generate',
  '接入选中的 {count} 个模型': 'Add {count} selected model(s)',
  '确认执行': 'Confirm',

  // ── ProjectMemoryPanel ──
  '偏好': 'Preference',
  '事实': 'Fact',
  '约束': 'Constraint',
  '决定': 'Decision',
  '保存': 'Save',
  '来源对话已删除': 'Source conversation deleted',
  '来自对话': 'From conversation',
  '禁用（不再发送给模型）': 'Disable (stop sending to the model)',
  '启用': 'Enable',
  '编辑': 'Edit',
  '删除': 'Delete',
  '{count} 条': '{count} item(s)',
  '还没有项目记忆': 'No project memory yet',
  '对话中助手会在你确认后保存偏好、事实、约束和决定，': 'During conversations the assistant saves preferences, facts, constraints and decisions after your confirmation,',
  '之后的对话会自动参考这些记忆。': 'and later conversations reference these memories automatically.',

  // ── AgentToolDetails ──
  '未设置': 'Not set',
  '是': 'Yes',
  '否': 'No',
  '调用详情': 'Call details',
  '参数': 'Parameters',
  '用户指定': 'User-specified',
  '项目默认': 'Project default',
  '模型默认': 'Model default',
  '有效值': 'Resolved',
  '参考素材': 'References',
  '素材已不可用': 'Asset no longer available',
  '用户上传素材': 'User-uploaded asset',
  '对象': 'Entities',
  '变更': 'Changes',
  '结果': 'Result',

  // ── AgentExecutionRationale ──
  '执行依据': 'Execution rationale',
  '{count} 项': '{count} item(s)',
  '来自可验证的任务事件，不包含模型隐藏思维。': 'From verifiable task events; no hidden model reasoning.',

  // ── SubAgentPanel ──
  '{count} 个': '{count}',

  // ── ChatMarkdown ──
  '代码已复制': 'Code copied',
  '复制代码': 'Copy code',

  // ── ChatReferenceText ──
  '{label}，节点已不存在': '{label} — node no longer exists',
  '定位节点 {label}': 'Locate node {label}',
  '重新选择模型，当前为 {label}': 'Reselect model, currently {label}',
  '节点已不存在': 'Node no longer exists',
  '在画布中定位': 'Locate on canvas',
  '重新选择模型': 'Reselect model',

  // ── ChatComposerEditor ──
  '对话消息': 'Conversation message',

  /* ── 「画布素材预览」对话框（官方 `pIt` / `uIt`，canvas chunk @4564243 / @4565328）──
     官方这三个串是**行内二选一兜底** `l=(C,N)=>i.language.startsWith("zh")?C:N`
     （zh 取中文、否则取英文），**不是** i18n 词典条目 ⇒ en 就是官方英文原文逐字；
     ja/ko 按官方行为（非 zh ⇒ 英文）取同一串，参考 `authenticityStrings.test.ts` 的「缺键回退英文」先例。 */
  '画布素材预览': 'Canvas resource preview',
  '在画布中打开': 'Open in Canvas',
  '在画布中查看此素材。': 'Open this resource in Canvas.',
};

export default chat;
