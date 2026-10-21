//! 图片往返桥的任务仓库。
//!
//! WHY：桥有 HTTP 面与 Tauri 命令面两个入口，但任务状态机只有一份。
//! 令牌校验、TTL/租约判定与文件清理集中在这里，两边的规则才不会走偏。

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

/// 源图 mime 白名单：只收浏览器一定能解码的四种静态/动图格式。
pub const SOURCE_MIME_WHITELIST: [&str; 4] = ["image/png", "image/jpeg", "image/webp", "image/gif"];
/// 任务整体存活 30 分钟，到点即 `expired`，防止画布留下永远等不到的结果。
pub const JOB_TTL_MS: i64 = 30 * 60 * 1000;
/// 领取租约 2 分钟：编辑器崩了/用户关掉面板后任务必须回到队列，否则画布一直挂着。
pub const CLAIM_LEASE_MS: i64 = 2 * 60 * 1000;
/// 编辑器心跳 15 秒没来即视为离线（UXP 面板 5 秒一 ping，留三倍余量）。
pub const EDITOR_OFFLINE_MS: i64 = 15 * 1000;
/// 回传必须是扁平化 PNG；50 MB 足够 8K 画布，再大就不是「往返」而是搬运工程文件了。
pub const MAX_RESULT_BYTES: usize = 50 * 1024 * 1024;
pub const MAX_SOURCE_BYTES: usize = 50 * 1024 * 1024;
/// 心跳里代表「Photoshop UXP 面板」的角色名，只有它才算编辑器在线。
pub const CLIENT_ROLE_UXP: &str = "uxp";
/// 待取回的推送图最多留 20 条：画布漏掉事件时还能靠轮询补上，更旧的推送已没人认领，
/// 留着只会白占磁盘（每条最大 50 MB）。
pub const MAX_PENDING_PUSHES: usize = 20;
/// 原始文件名只做元数据展示，截断上限防止脏字段把事件载荷撑爆。
const MAX_PUSH_FILE_NAME_CHARS: usize = 256;
const TOKEN_BYTES: usize = 24;
const PNG_SIGNATURE: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a];

static JOB_SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// 桥的错误分类：HTTP 面靠它映射状态码，命令面统一转成 String。
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RoundtripError {
    /// 令牌缺失或不匹配 —— 按桥的约定一律回 400，不暴露「任务存在但令牌错」。
    Unauthorized(String),
    NotFound(String),
    Conflict(String),
    Invalid(String),
    Internal(String),
}

impl RoundtripError {
    pub fn message(&self) -> &str {
        match self {
            Self::Unauthorized(message)
            | Self::NotFound(message)
            | Self::Conflict(message)
            | Self::Invalid(message)
            | Self::Internal(message) => message,
        }
    }
}

impl fmt::Display for RoundtripError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message())
    }
}

impl From<RoundtripError> for String {
    fn from(error: RoundtripError) -> Self {
        error.to_string()
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Queued,
    Claimed,
    Editing,
    Completed,
    Cancelled,
    Expired,
}

impl JobStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Queued => "queued",
            Self::Claimed => "claimed",
            Self::Editing => "editing",
            Self::Completed => "completed",
            Self::Cancelled => "cancelled",
            Self::Expired => "expired",
        }
    }

    fn is_active(self) -> bool {
        matches!(self, Self::Queued | Self::Claimed | Self::Editing)
    }
}

/// 回给画布的任务视图。`result_path` 是结果 PNG 的绝对路径，画布据此导入。
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundtripJobView {
    pub job_id: String,
    pub source_node_id: String,
    pub project_id: String,
    pub canvas_id: String,
    pub status: JobStatus,
    pub created_at: i64,
    pub expires_at: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub claimed_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Clone, Debug)]
pub struct NewJobSpec {
    pub source_node_id: String,
    pub project_id: String,
    pub canvas_id: String,
}

/// `GET /jobs/next` 的领取结果：令牌只在这里与创建响应里各出现一次。
#[derive(Clone, Debug)]
pub struct ClaimedJob {
    pub view: RoundtripJobView,
    pub token: String,
    pub source_mime: String,
}

/// 一次「编辑器 → 画布」的图片推送。
///
/// WHY 不套用任务状态机：推送由编辑器发起，没有令牌也没有队列语义，只需要「落盘 +
/// 等画布取走」。因此它只有路径、元数据与接收时间，`pending` 到 ack 为止。
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct RoundtripPush {
    pub path: String,
    pub file_name: String,
    pub label: Option<String>,
    pub project_id: Option<String>,
    pub received_at: i64,
}

impl RoundtripPush {
    /// 轮询兜底（`roundtrip_pending_pushes`）的条目形态：画布只认这四个键。
    pub fn view(&self) -> Value {
        let mut view = json!({
            "path": self.path,
            "fileName": self.file_name,
            "receivedAt": self.received_at,
        });
        insert_optional(&mut view, "label", self.label.as_deref());
        view
    }

    /// 事件载荷形态：比轮询多一个 projectId，画布据此知道这张图属于哪个工程。
    pub fn event_payload(&self) -> Value {
        let mut payload = json!({
            "path": self.path,
            "fileName": self.file_name,
        });
        insert_optional(&mut payload, "label", self.label.as_deref());
        insert_optional(&mut payload, "projectId", self.project_id.as_deref());
        payload
    }
}

/// 空标签/空工程号不进 JSON：前端用「键不存在」判断比判空串更省事。
fn insert_optional(target: &mut Value, key: &str, value: Option<&str>) {
    if let Some(value) = value.filter(|value| !value.is_empty()) {
        target[key] = Value::String(value.to_string());
    }
}

#[derive(Clone, Debug)]
struct Job {
    id: String,
    token: String,
    source_node_id: String,
    project_id: String,
    canvas_id: String,
    status: JobStatus,
    created_at: i64,
    expires_at: i64,
    claimed_at: Option<i64>,
    completed_at: Option<i64>,
    message: Option<String>,
    source_path: PathBuf,
    source_mime: String,
    result_path: Option<PathBuf>,
}

impl Job {
    fn view(&self) -> RoundtripJobView {
        RoundtripJobView {
            job_id: self.id.clone(),
            source_node_id: self.source_node_id.clone(),
            project_id: self.project_id.clone(),
            canvas_id: self.canvas_id.clone(),
            status: self.status,
            created_at: self.created_at,
            expires_at: self.expires_at,
            claimed_at: self.claimed_at,
            completed_at: self.completed_at,
            result_path: self
                .result_path
                .as_ref()
                .map(|path| path.to_string_lossy().into_owned()),
            message: self.message.clone(),
        }
    }
}

#[derive(Default)]
struct StoreInner {
    jobs: HashMap<String, Job>,
    /// 创建顺序，`/jobs/next` 按它取最老的任务，避免 HashMap 顺序不确定。
    order: Vec<String>,
    /// 待取回的推送，按接收顺序排列（最旧在前），对外输出时反过来。
    pushes: Vec<RoundtripPush>,
    editor_seen_ms: Option<i64>,
}

pub struct JobStore {
    inner: Mutex<StoreInner>,
    sources_dir: PathBuf,
    results_dir: PathBuf,
    pushed_dir: PathBuf,
}

impl JobStore {
    pub fn new(
        sources_dir: PathBuf,
        results_dir: PathBuf,
        pushed_dir: PathBuf,
    ) -> Result<Self, RoundtripError> {
        for directory in [&sources_dir, &results_dir, &pushed_dir] {
            fs::create_dir_all(directory).map_err(|error| {
                RoundtripError::Internal(format!("创建图片往返目录失败: {error}"))
            })?;
        }
        Ok(Self {
            inner: Mutex::new(StoreInner::default()),
            sources_dir,
            results_dir,
            pushed_dir,
        })
    }

    /// 只给单元测试断言「源图确实落盘/被清理」用，生产代码不需要知道目录。
    #[cfg(test)]
    pub fn sources_dir(&self) -> &std::path::Path {
        &self.sources_dir
    }

    /// 同上：测试要确认推送落盘与被 ack 后删除。
    #[cfg(test)]
    pub fn pushed_dir(&self) -> &std::path::Path {
        &self.pushed_dir
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, StoreInner>, RoundtripError> {
        self.inner
            .lock()
            .map_err(|_| RoundtripError::Internal("图片往返任务锁不可用".to_string()))
    }

    pub fn create(
        &self,
        spec: NewJobSpec,
        source: &[u8],
        source_mime: String,
        now_ms: i64,
    ) -> Result<(RoundtripJobView, String), RoundtripError> {
        if source.is_empty() {
            return Err(RoundtripError::Invalid("源图内容为空".to_string()));
        }
        if source.len() > MAX_SOURCE_BYTES {
            return Err(RoundtripError::Invalid(format!(
                "源图超过 {} MB 上限",
                MAX_SOURCE_BYTES / (1024 * 1024)
            )));
        }
        let token = random_token()?;
        let mut inner = self.lock()?;
        sweep_locked(&mut inner, now_ms);
        let job_id = next_job_id(&inner, now_ms);
        let source_path = self
            .sources_dir
            .join(format!("{job_id}.{}", extension_for_mime(&source_mime)));
        fs::write(&source_path, source)
            .map_err(|error| RoundtripError::Internal(format!("写入源图失败: {error}")))?;
        let job = Job {
            id: job_id.clone(),
            token: token.clone(),
            source_node_id: spec.source_node_id,
            project_id: spec.project_id,
            canvas_id: spec.canvas_id,
            status: JobStatus::Queued,
            created_at: now_ms,
            expires_at: now_ms + JOB_TTL_MS,
            claimed_at: None,
            completed_at: None,
            message: None,
            source_path,
            source_mime,
            result_path: None,
        };
        let view = job.view();
        inner.order.push(job_id.clone());
        inner.jobs.insert(job_id, job);
        Ok((view, token))
    }

    pub fn view(&self, job_id: &str) -> Result<RoundtripJobView, RoundtripError> {
        let inner = self.lock()?;
        Ok(find_job(&inner, job_id)?.view())
    }

    /// 只校验令牌不改变状态，供 `GET /jobs/:id` 使用。
    pub fn authorize_view(&self, job_id: &str, token: &str) -> Result<(), RoundtripError> {
        let inner = self.lock()?;
        authorize(&inner, job_id, token)
    }

    /// 无令牌的内部取消：只有本进程的画布命令走这条路。
    pub fn cancel_local(
        &self,
        job_id: &str,
        now_ms: i64,
    ) -> Result<RoundtripJobView, RoundtripError> {
        let mut inner = self.lock()?;
        sweep_locked(&mut inner, now_ms);
        let job = find_job_mut(&mut inner, job_id)?;
        finish_job(job, JobStatus::Cancelled, Some("画布已取消该任务"));
        Ok(job.view())
    }

    pub fn cancel(
        &self,
        job_id: &str,
        token: &str,
        now_ms: i64,
    ) -> Result<RoundtripJobView, RoundtripError> {
        let mut inner = self.lock()?;
        sweep_locked(&mut inner, now_ms);
        authorize(&inner, job_id, token)?;
        let job = find_job_mut(&mut inner, job_id)?;
        finish_job(job, JobStatus::Cancelled, Some("编辑器已取消该任务"));
        Ok(job.view())
    }

    pub fn claim_next(&self, now_ms: i64) -> Result<Option<ClaimedJob>, RoundtripError> {
        let mut inner = self.lock()?;
        sweep_locked(&mut inner, now_ms);
        let candidate = inner.order.iter().find_map(|job_id| {
            let job = inner.jobs.get(job_id)?;
            (job.status == JobStatus::Queued).then(|| job.id.clone())
        });
        let Some(job_id) = candidate else {
            return Ok(None);
        };
        let job = find_job_mut(&mut inner, &job_id)?;
        job.status = JobStatus::Claimed;
        job.claimed_at = Some(now_ms);
        job.message = None;
        Ok(Some(ClaimedJob {
            view: job.view(),
            token: job.token.clone(),
            source_mime: job.source_mime.clone(),
        }))
    }

    /// 下载源图；首次成功访问把 `claimed` 提升为 `editing`，让画布看到编辑已开始。
    pub fn source_for_download(
        &self,
        job_id: &str,
        token: &str,
        now_ms: i64,
    ) -> Result<(PathBuf, String), RoundtripError> {
        let mut inner = self.lock()?;
        sweep_locked(&mut inner, now_ms);
        authorize(&inner, job_id, token)?;
        let job = find_job_mut(&mut inner, job_id)?;
        match job.status {
            JobStatus::Claimed => {
                job.status = JobStatus::Editing;
            }
            JobStatus::Editing => {}
            other => {
                return Err(RoundtripError::Conflict(format!(
                    "任务当前状态 {} 不允许下载源图",
                    other.as_str()
                )));
            }
        }
        if !job.source_path.is_file() {
            return Err(RoundtripError::Conflict("源图已被清理".to_string()));
        }
        Ok((job.source_path.clone(), job.source_mime.clone()))
    }

    pub fn complete(
        &self,
        job_id: &str,
        token: &str,
        result: &[u8],
        now_ms: i64,
    ) -> Result<RoundtripJobView, RoundtripError> {
        if result.is_empty() {
            return Err(RoundtripError::Invalid("回传结果为空".to_string()));
        }
        if result.len() > MAX_RESULT_BYTES {
            return Err(RoundtripError::Invalid(format!(
                "回传结果超过 {} MB 上限",
                MAX_RESULT_BYTES / (1024 * 1024)
            )));
        }
        if !result.starts_with(&PNG_SIGNATURE) {
            return Err(RoundtripError::Invalid(
                "回传结果必须是扁平化的 PNG".to_string(),
            ));
        }
        let mut inner = self.lock()?;
        sweep_locked(&mut inner, now_ms);
        authorize(&inner, job_id, token)?;
        let result_path = self.results_dir.join(format!("{job_id}.png"));
        fs::write(&result_path, result)
            .map_err(|error| RoundtripError::Internal(format!("写入结果 PNG 失败: {error}")))?;
        let job = find_job_mut(&mut inner, job_id)?;
        if !matches!(job.status, JobStatus::Claimed | JobStatus::Editing) {
            return Err(RoundtripError::Conflict(format!(
                "任务当前状态 {} 不接受回传结果",
                job.status.as_str()
            )));
        }
        let source_path = job.source_path.clone();
        job.status = JobStatus::Completed;
        job.completed_at = Some(now_ms);
        job.result_path = Some(result_path);
        job.message = None;
        let _ = fs::remove_file(source_path);
        Ok(job.view())
    }

    pub fn result_for_download(&self, job_id: &str) -> Result<PathBuf, RoundtripError> {
        let inner = self.lock()?;
        let job = find_job(&inner, job_id)?;
        let path = job
            .result_path
            .clone()
            .ok_or_else(|| RoundtripError::NotFound("该任务还没有结果".to_string()))?;
        if !path.is_file() {
            return Err(RoundtripError::NotFound("结果文件已被清理".to_string()));
        }
        Ok(path)
    }

    /// 记录一次编辑器推来的图片：落盘 + 进待取列表 + 淘汰最旧的。
    ///
    /// mime 与体积由调用方（HTTP 面）先过白名单与上限；这里再兜一层体积校验，
    /// 因为命令面未来也可能直接调用它。
    pub fn record_push(
        &self,
        source: &[u8],
        mime: &str,
        original_name: Option<&str>,
        label: Option<String>,
        project_id: Option<String>,
        now_ms: i64,
    ) -> Result<RoundtripPush, RoundtripError> {
        if source.is_empty() {
            return Err(RoundtripError::Invalid("推送图片内容为空".to_string()));
        }
        if source.len() > MAX_RESULT_BYTES {
            return Err(RoundtripError::Invalid(format!(
                "推送图片超过 {} MB 上限",
                MAX_RESULT_BYTES / (1024 * 1024)
            )));
        }
        // 客户端文件名只当元数据，绝不参与拼路径（一律写进 pushed_dir 下的随机名）；
        // 但仍取其最后一段并截断，避免路径串或超长串进入事件载荷。
        let saved_name = format!("{}.{}", random_push_id()?, extension_for_mime(mime));
        let file_name = original_name
            .map(|name| {
                name.rsplit(['/', '\\'])
                    .next()
                    .unwrap_or(name)
                    .trim()
                    .chars()
                    .take(MAX_PUSH_FILE_NAME_CHARS)
                    .collect::<String>()
            })
            .filter(|name| !name.is_empty())
            .unwrap_or_else(|| saved_name.clone());
        let path = self.pushed_dir.join(&saved_name);
        fs::write(&path, source)
            .map_err(|error| RoundtripError::Internal(format!("写入推送图片失败: {error}")))?;

        let mut inner = self.lock()?;
        // 重试折叠：编辑器超时重发同一次推送（同名 + 同标签 + 同工程）时只留最新那份，
        // 否则画布会导入两张一模一样的图。
        if let Some(index) = inner.pushes.iter().position(|push| {
            push.file_name == file_name && push.label == label && push.project_id == project_id
        }) {
            let previous = inner.pushes.remove(index);
            let _ = fs::remove_file(&previous.path);
        }
        inner.pushes.push(RoundtripPush {
            path: path.to_string_lossy().into_owned(),
            file_name,
            label,
            project_id,
            received_at: now_ms,
        });
        // 只保留最近 20 条；被挤掉的推送连文件一起删，画布长期不取时不会堆积大图。
        while inner.pushes.len() > MAX_PENDING_PUSHES {
            let evicted = inner.pushes.remove(0);
            let _ = fs::remove_file(&evicted.path);
        }
        Ok(inner
            .pushes
            .last()
            .cloned()
            .expect("刚 push 过，列表必定非空"))
    }

    /// 待取回的推送，最新在前；画布漏掉事件时可以整表拉取后自己判重。
    pub fn pending_pushes(&self) -> Result<Vec<Value>, RoundtripError> {
        let inner = self.lock()?;
        Ok(inner.pushes.iter().rev().map(|push| push.view()).collect())
    }

    /// 画布取走推送后记账：按绝对路径移出待取列表并删掉文件。
    ///
    /// 找不到该路径时按幂等处理而不是报错：画布可能重复 ack，一次重复调用（甚至网络重发）
    /// 不该变成前端要处理的失败。
    pub fn ack_push(&self, path: &str) -> Result<(), RoundtripError> {
        let mut inner = self.lock()?;
        let Some(index) = inner.pushes.iter().position(|push| push.path == path) else {
            return Ok(());
        };
        let push = inner.pushes.remove(index);
        let _ = fs::remove_file(&push.path);
        Ok(())
    }

    pub fn touch_editor(&self, now_ms: i64) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.editor_seen_ms = Some(now_ms);
        }
    }

    pub fn editor_online(&self, now_ms: i64) -> bool {
        let Ok(inner) = self.inner.lock() else {
            return false;
        };
        inner
            .editor_seen_ms
            .is_some_and(|seen| now_ms.saturating_sub(seen) < EDITOR_OFFLINE_MS)
    }

    /// 周期清扫：TTL 到期、租约超时、过期源文件删除，全部在这里收口。
    pub fn sweep(&self, now_ms: i64) -> Result<(), RoundtripError> {
        let mut inner = self.lock()?;
        sweep_locked(&mut inner, now_ms);
        Ok(())
    }
}

fn find_job<'a>(inner: &'a StoreInner, job_id: &str) -> Result<&'a Job, RoundtripError> {
    inner
        .jobs
        .get(job_id)
        .ok_or_else(|| RoundtripError::NotFound(format!("任务 {job_id} 不存在")))
}

fn find_job_mut<'a>(
    inner: &'a mut StoreInner,
    job_id: &str,
) -> Result<&'a mut Job, RoundtripError> {
    inner
        .jobs
        .get_mut(job_id)
        .ok_or_else(|| RoundtripError::NotFound(format!("任务 {job_id} 不存在")))
}

fn authorize(inner: &StoreInner, job_id: &str, token: &str) -> Result<(), RoundtripError> {
    let job = find_job(inner, job_id)?;
    if !token_matches(&job.token, token) {
        return Err(RoundtripError::Unauthorized(
            "任务令牌缺失或不正确".to_string(),
        ));
    }
    Ok(())
}

/// 恒定时间比较：长度不同直接失败，长度相同时用 XOR 累积差异，避免按字节提前返回。
pub fn token_matches(expected: &str, provided: &str) -> bool {
    if expected.len() != provided.len() {
        return false;
    }
    expected
        .bytes()
        .zip(provided.bytes())
        .fold(0_u8, |difference, (left, right)| {
            difference | (left ^ right)
        })
        == 0
}

/// 结束任务并清掉源图：结果文件保留给画布导入，源图没有任何留存价值。
fn finish_job(job: &mut Job, status: JobStatus, message: Option<&str>) {
    if !job.status.is_active() {
        return;
    }
    job.status = status;
    job.message = message.map(str::to_owned);
    job.completed_at = None;
    let _ = fs::remove_file(&job.source_path);
}

fn sweep_locked(inner: &mut StoreInner, now_ms: i64) {
    for job_id in inner.order.clone() {
        let Some(job) = inner.jobs.get_mut(&job_id) else {
            continue;
        };
        if !job.status.is_active() {
            continue;
        }
        if now_ms >= job.expires_at {
            job.status = JobStatus::Expired;
            job.message = Some("任务已超过 30 分钟有效期".to_string());
            let _ = fs::remove_file(job.source_path.clone());
            continue;
        }
        let Some(claimed_at) = job.claimed_at else {
            continue;
        };
        if matches!(job.status, JobStatus::Claimed | JobStatus::Editing)
            && now_ms.saturating_sub(claimed_at) >= CLAIM_LEASE_MS
        {
            // 编辑器丢了租约只影响这一单：退回队列并清空领取时间，令牌仍有效。
            job.status = JobStatus::Queued;
            job.claimed_at = None;
            job.message = Some("编辑器领取超时，任务已重新排队".to_string());
        }
    }
}

fn next_job_id(inner: &StoreInner, now_ms: i64) -> String {
    loop {
        let sequence = JOB_SEQUENCE.fetch_add(1, Ordering::AcqRel) + 1;
        let candidate = format!("rt-{now_ms:x}-{sequence:x}");
        if !inner.jobs.contains_key(&candidate) {
            return candidate;
        }
    }
}

fn random_token() -> Result<String, RoundtripError> {
    let mut bytes = [0_u8; TOKEN_BYTES];
    getrandom::fill(&mut bytes)
        .map_err(|error| RoundtripError::Internal(format!("生成任务令牌失败: {error}")))?;
    Ok(to_hex(&bytes))
}

/// 推送文件名用 UUIDv4 形态：每次推送都是新文件，画布不会覆盖上一张还没取走的图。
fn random_push_id() -> Result<String, RoundtripError> {
    let mut bytes = [0_u8; 16];
    getrandom::fill(&mut bytes)
        .map_err(|error| RoundtripError::Internal(format!("生成推送文件名失败: {error}")))?;
    // 按 RFC 4122 打上版本 4 与变体位，再拼成 8-4-4-4-12。
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    let hex = to_hex(&bytes);
    Ok(format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    ))
}

fn to_hex(bytes: &[u8]) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(DIGITS[(byte >> 4) as usize] as char);
        encoded.push(DIGITS[(byte & 0x0f) as usize] as char);
    }
    encoded
}

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}

fn extension_for_mime(mime: &str) -> &'static str {
    match mime {
        "image/jpeg" => "jpg",
        "image/webp" => "webp",
        "image/gif" => "gif",
        _ => "png",
    }
}

/// 按魔数识别图片类型；能嗅探出内容时以内容为准，声明值只作为兜底。
pub fn sniff_image_mime(bytes: &[u8]) -> Option<&'static str> {
    if bytes.starts_with(&PNG_SIGNATURE) {
        return Some("image/png");
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return Some("image/jpeg");
    }
    if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        return Some("image/gif");
    }
    if bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP" {
        return Some("image/webp");
    }
    None
}

/// 归一化 mime：去掉 `;charset=` 参数、统一小写、把 image/jpg 归到 image/jpeg。
pub fn normalize_mime(raw: &str) -> Option<String> {
    let mime = raw
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    match mime.as_str() {
        "" => None,
        "image/jpg" => Some("image/jpeg".to_string()),
        "image/pjpeg" => Some("image/jpeg".to_string()),
        other => Some(other.to_string()),
    }
}

pub fn ensure_whitelisted(mime: &str) -> Result<String, RoundtripError> {
    if SOURCE_MIME_WHITELIST.contains(&mime) {
        return Ok(mime.to_string());
    }
    Err(RoundtripError::Invalid(format!(
        "不支持的图片类型 {mime}，仅接受 {}",
        SOURCE_MIME_WHITELIST.join("、")
    )))
}

/// 源图 mime 判定：魔数优先，其次调用方声明，最后白名单校验。
pub fn accept_source_mime(bytes: &[u8], declared: Option<&str>) -> Result<String, RoundtripError> {
    if let Some(sniffed) = sniff_image_mime(bytes) {
        return ensure_whitelisted(sniffed);
    }
    let declared = declared
        .and_then(normalize_mime)
        .ok_or_else(|| RoundtripError::Invalid("无法识别源图类型".to_string()))?;
    ensure_whitelisted(&declared)
}

/// 单元测试与生产代码共用同一份状态机，测试放在同目录的独立文件里控制文件长度。
#[cfg(test)]
#[path = "store_tests.rs"]
mod tests;
