//! 本地图片往返桥：画布经 Tauri IPC 下单，外部图片编辑器经 loopback HTTP 取图、编辑、回图。
//!
//! WHY：Photoshop 这类编辑器没有 Tauri 上下文，只能通过本机 HTTP 拿素材。把「回环监听 +
//! 逐任务令牌 + 文件生命周期」收在这一个模块里，画布 IPC 就不必向渲染层暴露文件系统细节。

mod http;
mod store;

pub use store::RoundtripJobView;
use store::{JobStore, NewJobSpec, RoundtripError};

use base64::Engine;
use reqwest::header::CONTENT_LENGTH;
use serde::Deserialize;
use serde_json::{json, Value};
use std::io::Read;
use std::net::{Ipv4Addr, TcpListener};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Manager, State};
use tokio_util::sync::CancellationToken;

/// 结果就绪事件：画布据此立刻导入，没监听者时发射失败也不会影响回传成功。
pub const ROUNDTRIP_JOB_COMPLETED_EVENT: &str = "roundtrip://job-completed";

/// 反向推送事件：编辑器主动推来一张图时画布立刻导入；漏了事件还有轮询命令兜底。
pub const ROUNDTRIP_CANVAS_IMAGE_EVENT: &str = "roundtrip://canvas-image";

/// 默认端口固定成 8791，UXP 面板与文件监听启动器都按它硬编码。
const DEFAULT_PORT: u16 = 8791;
/// 端口被占用时向后顺延的候选数量（含默认端口本身）。
const PORT_CANDIDATES: u16 = 6;
const PORT_BIND_RETRIES: u8 = 3;
const PORT_BIND_RETRY_DELAY: Duration = Duration::from_millis(50);
/// 清扫周期：TTL 与租约的最坏响应延迟就是这个值。
const SWEEP_INTERVAL: Duration = Duration::from_secs(15);
const REMOTE_CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const REMOTE_TOTAL_TIMEOUT: Duration = Duration::from_secs(30);

/// `roundtrip_create_job` 的入参；`source` 支持本地路径、http(s) URL 与 data URL。
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoundtripCreateInput {
    pub source: String,
    #[serde(default)]
    pub source_mime: Option<String>,
    pub source_node_id: String,
    pub project_id: String,
    pub canvas_id: String,
}

struct BridgeSession {
    port: u16,
    store: Arc<JobStore>,
    cancellation: CancellationToken,
}

/// 桥的进程内状态：同一时刻最多一个监听，重复 start 直接返回当前端口。
#[derive(Default)]
pub struct RoundtripState {
    session: Mutex<Option<BridgeSession>>,
}

#[tauri::command]
pub fn roundtrip_bridge_start(
    app: AppHandle,
    state: State<'_, RoundtripState>,
    port: Option<u16>,
) -> Result<u16, String> {
    let mut session = state
        .session
        .lock()
        .map_err(|_| "图片往返桥状态锁不可用".to_string())?;
    if let Some(current) = session.as_ref() {
        // 幂等：已经跑着就报当前端口，调用方不需要自己记端口。
        return Ok(current.port);
    }
    let (sources_dir, results_dir, pushed_dir) = roundtrip_dirs(&app)?;
    let store =
        Arc::new(JobStore::new(sources_dir, results_dir, pushed_dir).map_err(String::from)?);
    let (listener, bound_port) = bind_loopback(port.unwrap_or(DEFAULT_PORT))?;
    let cancellation = CancellationToken::new();
    http::spawn_server(app, Arc::clone(&store), listener, cancellation.clone());
    spawn_sweeper(Arc::clone(&store), cancellation.clone());
    *session = Some(BridgeSession {
        port: bound_port,
        store,
        cancellation,
    });
    Ok(bound_port)
}

#[tauri::command]
pub fn roundtrip_bridge_stop(state: State<'_, RoundtripState>) -> Result<(), String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "图片往返桥状态锁不可用".to_string())?
        .take();
    if let Some(session) = session {
        session.cancellation.cancel();
    }
    Ok(())
}

#[tauri::command]
pub fn roundtrip_bridge_status(state: State<'_, RoundtripState>) -> Result<Value, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "图片往返桥状态锁不可用".to_string())?;
    let (running, port, editor_online) = match session.as_ref() {
        Some(current) => (
            true,
            Some(current.port),
            current.store.editor_online(store::now_ms()),
        ),
        None => (false, None, false),
    };
    Ok(json!({
        "running": running,
        "port": port,
        "editorOnline": editor_online,
    }))
}

#[tauri::command]
pub fn roundtrip_create_job(
    state: State<'_, RoundtripState>,
    input: RoundtripCreateInput,
) -> Result<RoundtripJobView, String> {
    let store = require_store(&state)?;
    let (bytes, mime) = resolve_source(&input).map_err(String::from)?;
    let spec = NewJobSpec {
        source_node_id: input.source_node_id,
        project_id: input.project_id,
        canvas_id: input.canvas_id,
    };
    // 令牌只交给编辑器（它在 /jobs/next 里拿），画布不需要持有。
    store
        .create(spec, &bytes, mime, store::now_ms())
        .map(|(view, _token)| view)
        .map_err(String::from)
}

#[tauri::command]
pub fn roundtrip_job_status(
    state: State<'_, RoundtripState>,
    job_id: String,
) -> Result<RoundtripJobView, String> {
    require_store(&state)?.view(&job_id).map_err(String::from)
}

#[tauri::command]
pub fn roundtrip_job_cancel(
    state: State<'_, RoundtripState>,
    job_id: String,
) -> Result<RoundtripJobView, String> {
    // 命令面是本进程的画布，属于第一方调用，因此不需要任务令牌。
    require_store(&state)?
        .cancel_local(&job_id, store::now_ms())
        .map_err(String::from)
}

/// 轮询兜底：返回还没被画布 ack 的推送，最新在前。
#[tauri::command]
pub fn roundtrip_pending_pushes(state: State<'_, RoundtripState>) -> Result<Vec<Value>, String> {
    require_store(&state)?
        .pending_pushes()
        .map_err(String::from)
}

/// 画布取走推送后确认：把它从待取列表移除（文件也一并删除）。
#[tauri::command]
pub fn roundtrip_ack_push(state: State<'_, RoundtripState>, path: String) -> Result<(), String> {
    require_store(&state)?.ack_push(&path).map_err(String::from)
}

fn require_store(state: &State<'_, RoundtripState>) -> Result<Arc<JobStore>, String> {
    let session = state
        .session
        .lock()
        .map_err(|_| "图片往返桥状态锁不可用".to_string())?;
    session
        .as_ref()
        .map(|current| Arc::clone(&current.store))
        .ok_or_else(|| "图片往返桥尚未启动，请先调用 roundtrip_bridge_start".to_string())
}

/// 源图、结果图与推送图都写在应用数据目录下，卸载/清理时随应用数据一起消失。
fn roundtrip_dirs(app: &AppHandle) -> Result<(PathBuf, PathBuf, PathBuf), String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("无法获取应用数据目录: {error}"))?
        .join("roundtrip");
    Ok((
        root.join("sources"),
        root.join("results"),
        root.join("pushed"),
    ))
}

/// 只绑回环地址；端口被占则顺延，全部失败时给出可读的区间错误。
fn bind_loopback(port: u16) -> Result<(TcpListener, u16), String> {
    let mut last_error = None;
    for offset in 0..PORT_CANDIDATES {
        let candidate = port.saturating_add(offset);
        for attempt in 0..PORT_BIND_RETRIES {
            match TcpListener::bind((Ipv4Addr::LOCALHOST, candidate)) {
                Ok(listener) => {
                    listener
                        .set_nonblocking(true)
                        .map_err(|error| format!("无法配置图片往返桥监听器: {error}"))?;
                    let bound = listener
                        .local_addr()
                        .map_err(|error| format!("无法读取图片往返桥端口: {error}"))?
                        .port();
                    return Ok((listener, bound));
                }
                Err(error) => {
                    last_error = Some(error);
                    // 刚 stop 过的端口要等旧 accept 任务放下监听，短暂重试即可。
                    if attempt + 1 < PORT_BIND_RETRIES {
                        std::thread::sleep(PORT_BIND_RETRY_DELAY);
                    }
                }
            }
        }
    }
    let last_port = port.saturating_add(PORT_CANDIDATES - 1);
    let error = last_error
        .map(|error| error.to_string())
        .unwrap_or_else(|| "端口不可用".to_string());
    Err(format!(
        "无法在 127.0.0.1 的 {port}-{last_port} 端口区间启动图片往返桥: {error}"
    ))
}

fn spawn_sweeper(store: Arc<JobStore>, cancellation: CancellationToken) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::select! {
                _ = cancellation.cancelled() => break,
                _ = tokio::time::sleep(SWEEP_INTERVAL) => {
                    if let Err(error) = store.sweep(store::now_ms()) {
                        eprintln!("[roundtrip] 过期清扫失败: {error}");
                    }
                }
            }
        }
    });
}

/// 三种源形态统一解析成「字节 + mime」，并在这里就过白名单。
fn resolve_source(input: &RoundtripCreateInput) -> Result<(Vec<u8>, String), RoundtripError> {
    let source = input.source.trim();
    if source.is_empty() {
        return Err(RoundtripError::Invalid("源图为空".to_string()));
    }
    if let Some(rest) = source.strip_prefix("data:") {
        return resolve_data_url(rest);
    }
    if source.starts_with("http://") || source.starts_with("https://") {
        return resolve_remote_url(source);
    }
    resolve_local_path(strip_file_url(source), input.source_mime.as_deref())
}

fn resolve_data_url(rest: &str) -> Result<(Vec<u8>, String), RoundtripError> {
    let (meta, payload) = rest
        .split_once(',')
        .ok_or_else(|| RoundtripError::Invalid("data URL 缺少数据体".to_string()))?;
    if !meta.to_ascii_lowercase().contains("base64") {
        return Err(RoundtripError::Invalid(
            "仅支持 base64 编码的 data URL".to_string(),
        ));
    }
    let declared = meta
        .split(';')
        .next()
        .map(str::trim)
        .filter(|mime| !mime.is_empty());
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.trim())
        .map_err(|_| RoundtripError::Invalid("data URL 的 base64 数据无法解码".to_string()))?;
    let mime = store::accept_source_mime(&bytes, declared)?;
    Ok((bytes, mime))
}

fn resolve_remote_url(url: &str) -> Result<(Vec<u8>, String), RoundtripError> {
    let client = reqwest::blocking::Client::builder()
        .connect_timeout(REMOTE_CONNECT_TIMEOUT)
        .timeout(REMOTE_TOTAL_TIMEOUT)
        .build()
        .map_err(|error| RoundtripError::Internal(format!("创建图片下载客户端失败: {error}")))?;
    let response = client
        .get(url)
        .send()
        .map_err(|error| RoundtripError::Internal(format!("下载远程图片失败: {error}")))?;
    if !response.status().is_success() {
        return Err(RoundtripError::Internal(format!(
            "下载远程图片失败: HTTP {}",
            response.status()
        )));
    }
    let declared = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    let bytes = read_limited(response, store::MAX_SOURCE_BYTES)?;
    let mime = store::accept_source_mime(&bytes, declared.as_deref())?;
    Ok((bytes, mime))
}

fn resolve_local_path(
    path: &str,
    declared: Option<&str>,
) -> Result<(Vec<u8>, String), RoundtripError> {
    let path = Path::new(path);
    let bytes = std::fs::read(path)
        .map_err(|error| RoundtripError::Invalid(format!("读取本地图片失败: {error}")))?;
    if bytes.len() > store::MAX_SOURCE_BYTES {
        return Err(RoundtripError::Invalid(format!(
            "源图超过 {} MB 上限",
            store::MAX_SOURCE_BYTES / (1024 * 1024)
        )));
    }
    let declared = declared
        .map(str::to_owned)
        .or_else(|| mime_from_extension(path).map(str::to_owned));
    let mime = store::accept_source_mime(&bytes, declared.as_deref())?;
    Ok((bytes, mime))
}

fn read_limited(
    response: reqwest::blocking::Response,
    limit: usize,
) -> Result<Vec<u8>, RoundtripError> {
    if response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<usize>().ok())
        .is_some_and(|length| length > limit)
    {
        return Err(RoundtripError::Invalid(format!(
            "图片超过 {} MB 上限",
            limit / (1024 * 1024)
        )));
    }
    let mut bytes = Vec::new();
    response
        .take((limit + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| RoundtripError::Internal(format!("读取图片失败: {error}")))?;
    if bytes.len() > limit {
        return Err(RoundtripError::Invalid(format!(
            "图片超过 {} MB 上限",
            limit / (1024 * 1024)
        )));
    }
    Ok(bytes)
}

fn mime_from_extension(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("png") => Some("image/png"),
        Some("jpg") | Some("jpeg") => Some("image/jpeg"),
        Some("webp") => Some("image/webp"),
        Some("gif") => Some("image/gif"),
        _ => None,
    }
}

/// `file:///E:/a.png` 在 Windows 上要去掉盘符前那个多余的斜杠，POSIX 的 `/home/a.png` 保持原样。
fn strip_file_url(source: &str) -> &str {
    let Some(rest) = source.strip_prefix("file://") else {
        return source;
    };
    let trimmed = rest.strip_prefix('/').unwrap_or(rest);
    let looks_like_drive = trimmed
        .as_bytes()
        .get(0)
        .is_some_and(u8::is_ascii_alphabetic)
        && trimmed.as_bytes().get(1) == Some(&b':');
    if rest.starts_with('/') && looks_like_drive {
        trimmed
    } else {
        rest
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = &[
        0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03, 0x04,
    ];

    fn input(source: &str, source_mime: Option<&str>) -> RoundtripCreateInput {
        RoundtripCreateInput {
            source: source.to_string(),
            source_mime: source_mime.map(str::to_owned),
            source_node_id: "node-1".to_string(),
            project_id: "project-1".to_string(),
            canvas_id: "canvas-1".to_string(),
        }
    }

    #[test]
    fn data_urls_are_decoded_and_whitelisted() {
        let encoded = base64::engine::general_purpose::STANDARD.encode(PNG);
        let (bytes, mime) =
            resolve_source(&input(&format!("data:image/png;base64,{encoded}"), None)).unwrap();
        assert_eq!(bytes, PNG);
        assert_eq!(mime, "image/png");

        let svg = base64::engine::general_purpose::STANDARD.encode(b"<svg/>");
        assert!(resolve_source(&input(&format!("data:image/svg+xml;base64,{svg}"), None)).is_err());
        assert!(resolve_source(&input("data:image/png;base64,not-base64!", None)).is_err());
        assert!(resolve_source(&input("data:image/png,plain", None)).is_err());
    }

    #[test]
    fn local_paths_fall_back_to_extension_then_sniffing() {
        let path = std::env::temp_dir().join(format!("roundtrip-src-{}.png", std::process::id()));
        std::fs::write(&path, PNG).unwrap();
        let (bytes, mime) = resolve_source(&input(&path.to_string_lossy(), None)).unwrap();
        assert_eq!(bytes, PNG);
        assert_eq!(mime, "image/png");

        // 扩展名与内容都不可信时以魔数为准：声明成 jpeg 仍按 PNG 处理
        let (_, declared_mime) =
            resolve_source(&input(&path.to_string_lossy(), Some("image/jpeg"))).unwrap();
        assert_eq!(declared_mime, "image/png");

        let _ = std::fs::remove_file(&path);
        assert!(resolve_source(&input(&path.to_string_lossy(), None)).is_err());
        assert!(resolve_source(&input("   ", None)).is_err());
        assert!(resolve_source(&input("/definitely/missing/image.bmp", None)).is_err());
    }

    #[test]
    fn file_urls_become_plain_paths_on_windows_and_posix() {
        assert_eq!(
            strip_file_url("file:///E:/art/a.png"),
            "E:/art/a.png",
            "Windows 盘符路径要去掉 file:// 后的多余斜杠"
        );
        assert_eq!(strip_file_url("file:///home/a.png"), "/home/a.png");
        assert_eq!(strip_file_url("E:/art/a.png"), "E:/art/a.png");
    }

    #[test]
    fn mime_extensions_cover_the_whitelist_and_nothing_else() {
        assert_eq!(mime_from_extension(Path::new("a.PNG")), Some("image/png"));
        assert_eq!(mime_from_extension(Path::new("a.jpeg")), Some("image/jpeg"));
        assert_eq!(mime_from_extension(Path::new("a.webp")), Some("image/webp"));
        assert_eq!(mime_from_extension(Path::new("a.gif")), Some("image/gif"));
        assert_eq!(mime_from_extension(Path::new("a.bmp")), None);
        assert_eq!(mime_from_extension(Path::new("a")), None);
    }

    #[test]
    fn free_ports_are_bound_on_loopback_only() {
        let (listener, port) = bind_loopback(0).unwrap();
        let address = listener.local_addr().unwrap();
        assert!(address.ip().is_loopback());
        assert_eq!(address.port(), port);

        // 固定端口被占时顺延到下一个可用端口，而不是直接失败
        let (fallback, fallback_port) = bind_loopback(port).unwrap();
        assert_ne!(fallback_port, port);
        assert!(fallback.local_addr().unwrap().ip().is_loopback());
    }
}
