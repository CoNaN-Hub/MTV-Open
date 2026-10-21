//! 图片往返桥的 loopback HTTP 面：外部编辑器（Photoshop UXP / 文件监听启动器）走这里取图回图。
//!
//! WHY：只绑 127.0.0.1 并在每个请求上复查对端地址，浏览器端的 CORS 只放行回环来源，
//! 令牌逐任务生成，因此即使别的本机进程扫到这个端口也拿不到画布里的素材。

use super::store::{
    accept_source_mime, now_ms, RoundtripError, RoundtripJobView, CLIENT_ROLE_UXP,
    MAX_RESULT_BYTES, MAX_SOURCE_BYTES,
};
use super::{JobStore, ROUNDTRIP_CANVAS_IMAGE_EVENT, ROUNDTRIP_JOB_COMPLETED_EVENT};
use axum::body::Bytes;
use axum::extract::{ConnectInfo, DefaultBodyLimit, Path, Request, State as AxumState};
use axum::http::{
    header::{AUTHORIZATION, CONTENT_TYPE, ORIGIN, VARY},
    HeaderMap, Method, StatusCode,
};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::{json, Value};
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

/// 整个 multipart 请求体的上限：50 MB 结果 + 表单字段与边界开销。
const MAX_BODY_BYTES: usize = 56 * 1024 * 1024;
/// 单个文本字段（sourceNodeId 等）不允许被当成上传通道滥用。
const MAX_FIELD_BYTES: usize = 8 * 1024;

#[derive(Clone)]
struct HttpState {
    app: AppHandle,
    store: Arc<JobStore>,
}

impl IntoResponse for RoundtripError {
    fn into_response(self) -> Response {
        let status = match self {
            Self::Unauthorized(_) | Self::Invalid(_) => StatusCode::BAD_REQUEST,
            Self::NotFound(_) => StatusCode::NOT_FOUND,
            Self::Conflict(_) => StatusCode::CONFLICT,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        };
        (
            status,
            Json(json!({ "ok": false, "error": self.message() })),
        )
            .into_response()
    }
}

/// 路由表单独成函数：`{id}` 这类路径语法或路由冲突会让 axum 在注册时 panic，
/// 拆出来后单元测试可以只构造路由表就把这类问题挡在启动之前。
fn roundtrip_routes() -> Router<HttpState> {
    Router::new()
        .route("/api/roundtrip/health", get(health))
        .route("/api/roundtrip/heartbeat", post(heartbeat))
        .route("/api/roundtrip/jobs", post(create_job))
        .route("/api/roundtrip/jobs/next", get(claim_next))
        .route("/api/roundtrip/jobs/{id}", get(job_view))
        .route("/api/roundtrip/jobs/{id}/source", get(job_source))
        .route("/api/roundtrip/jobs/{id}/result", post(job_result))
        .route("/api/roundtrip/jobs/{id}/cancel", post(job_cancel))
        .route("/api/roundtrip/results/{id}", get(job_result_bytes))
        .route("/api/roundtrip/push", post(push_image))
}

fn build_router(state: HttpState) -> Router {
    roundtrip_routes()
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(middleware::from_fn_with_state(state.clone(), guard_request))
        .with_state(state)
}

/// 在 Tauri 运行时里起动 axum；监听 socket 由命令侧同步绑定，绑定失败就不会走到这里。
pub(super) fn spawn_server(
    app: AppHandle,
    store: Arc<JobStore>,
    listener: std::net::TcpListener,
    cancellation: CancellationToken,
) {
    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("[roundtrip] 无法接管回环监听器: {error}");
                return;
            }
        };
        let state = HttpState { app, store };
        let router = build_router(state);
        let served = axum::serve(
            listener,
            router.into_make_service_with_connect_info::<SocketAddr>(),
        )
        .with_graceful_shutdown(cancellation.cancelled_owned())
        .await;
        if let Err(error) = served {
            eprintln!("[roundtrip] HTTP 服务异常退出: {error}");
        }
    });
}

/// 对端地址复查 + CORS：两者都在路由之前，任何端点都不存在「忘了鉴权」的分支。
async fn guard_request(
    AxumState(_state): AxumState<HttpState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    request: Request,
    next: Next,
) -> Response {
    if !is_loopback(peer.ip()) {
        return forbidden("图片往返桥只接受本机回环连接");
    }
    let origin = request
        .headers()
        .get(ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::to_owned);
    if let Some(origin) = origin.as_deref() {
        if !is_allowed_origin(origin) {
            return forbidden("图片往返桥不接受该来源");
        }
    }
    if request.method() == Method::OPTIONS {
        let mut response = StatusCode::NO_CONTENT.into_response();
        if let Some(origin) = origin.as_deref() {
            apply_cors(response.headers_mut(), origin);
        }
        return response;
    }
    let mut response = next.run(request).await;
    if let Some(origin) = origin.as_deref() {
        apply_cors(response.headers_mut(), origin);
    }
    response
}

fn forbidden(message: &str) -> Response {
    (
        StatusCode::FORBIDDEN,
        Json(json!({ "ok": false, "error": message })),
    )
        .into_response()
}

fn is_loopback(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(address) => address.is_loopback(),
        IpAddr::V6(address) => address.is_loopback(),
    }
}

/// 只放行回环来源；UXP 的 `Origin: null` 也放行，但它不会带凭据，因此不回 credentials 头。
fn is_allowed_origin(origin: &str) -> bool {
    if origin.eq_ignore_ascii_case("null") {
        return true;
    }
    let Ok(parsed) = url::Url::parse(origin) else {
        return false;
    };
    if parsed.scheme() != "http" {
        return false;
    }
    matches!(
        parsed.host_str().map(str::to_ascii_lowercase).as_deref(),
        Some("127.0.0.1") | Some("localhost")
    )
}

fn apply_cors(headers: &mut HeaderMap, origin: &str) {
    if let Ok(value) = origin.parse() {
        headers.insert("access-control-allow-origin", value);
    }
    headers.insert(
        "access-control-allow-methods",
        "GET, POST, OPTIONS".parse().expect("静态头合法"),
    );
    headers.insert(
        "access-control-allow-headers",
        "authorization, content-type".parse().expect("静态头合法"),
    );
    headers.insert("access-control-max-age", "600".parse().expect("静态头合法"));
    headers.insert(VARY, "origin".parse().expect("静态头合法"));
}

fn bearer(headers: &HeaderMap) -> Result<String, RoundtripError> {
    let token = headers
        .get(AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::trim)
        .filter(|token| !token.is_empty())
        .ok_or_else(|| RoundtripError::Unauthorized("缺少任务令牌".to_string()))?;
    Ok(token.to_string())
}

async fn health() -> impl IntoResponse {
    Json(json!({ "ok": true }))
}

/// 心跳：只有 `{"role":"uxp"}` 会刷新在线时间，其他请求体只做状态查询。
async fn heartbeat(
    AxumState(state): AxumState<HttpState>,
    body: Bytes,
) -> Result<Json<Value>, RoundtripError> {
    let role = serde_json::from_slice::<Value>(&body)
        .ok()
        .and_then(|value| {
            value
                .get("role")
                .and_then(Value::as_str)
                .map(str::to_ascii_lowercase)
        });
    if role.as_deref() == Some(CLIENT_ROLE_UXP) {
        state.store.touch_editor(now_ms());
    }
    Ok(Json(json!({
        "ok": true,
        "editorOnline": state.store.editor_online(now_ms()),
    })))
}

/// 编辑器推任务：multipart 上传源图 + 画布三个标识。
async fn create_job(
    AxumState(state): AxumState<HttpState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, RoundtripError> {
    let parts = multipart_parts(&headers, &body)?;
    let file = take_file_part(&parts)?;
    let source_node_id = required_field(&parts, "sourceNodeId")?;
    let project_id = required_field(&parts, "projectId")?;
    let canvas_id = required_field(&parts, "canvasId")?;
    if file.data.len() > MAX_SOURCE_BYTES {
        return Err(RoundtripError::Invalid(format!(
            "源图超过 {} MB 上限",
            MAX_SOURCE_BYTES / (1024 * 1024)
        )));
    }
    let mime = accept_source_mime(&file.data, file.content_type.as_deref())?;
    let (view, token) = state.store.create(
        super::store::NewJobSpec {
            source_node_id,
            project_id,
            canvas_id,
        },
        &file.data,
        mime,
        now_ms(),
    )?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "ok": true,
            "jobId": view.job_id,
            "sourceNodeId": view.source_node_id,
            "status": view.status,
            "createdAt": view.created_at,
            "expiresAt": view.expires_at,
            "token": token,
        })),
    )
        .into_response())
}

/// 领取最老的排队任务；没有任务必须是 204，编辑器据此进入轮询等待而不是报错。
async fn claim_next(AxumState(state): AxumState<HttpState>) -> Result<Response, RoundtripError> {
    let Some(claimed) = state.store.claim_next(now_ms())? else {
        return Ok(StatusCode::NO_CONTENT.into_response());
    };
    let view = &claimed.view;
    Ok(Json(json!({
        "ok": true,
        "jobId": view.job_id,
        "sourceNodeId": view.source_node_id,
        "status": view.status,
        "createdAt": view.created_at,
        "expiresAt": view.expires_at,
        "claimedAt": view.claimed_at,
        "token": claimed.token,
        "sourceMime": claimed.source_mime,
        "sourceUrl": format!("/api/roundtrip/jobs/{}/source", view.job_id),
    }))
    .into_response())
}

async fn job_view(
    AxumState(state): AxumState<HttpState>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<RoundtripJobView>, RoundtripError> {
    let token = bearer(&headers)?;
    state.store.authorize_view(&job_id, &token)?;
    Ok(Json(state.store.view(&job_id)?))
}

async fn job_source(
    AxumState(state): AxumState<HttpState>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
) -> Result<Response, RoundtripError> {
    let token = bearer(&headers)?;
    let (path, mime) = state.store.source_for_download(&job_id, &token, now_ms())?;
    let bytes = std::fs::read(&path)
        .map_err(|error| RoundtripError::Internal(format!("读取源图失败: {error}")))?;
    Ok(raw_response(bytes, &mime))
}

async fn job_result(
    AxumState(state): AxumState<HttpState>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, RoundtripError> {
    let token = bearer(&headers)?;
    let parts = multipart_parts(&headers, &body)?;
    let file = take_file_part(&parts)?;
    if let Some(content_type) = file.content_type.as_deref() {
        let normalized = super::store::normalize_mime(content_type).unwrap_or_default();
        if normalized != "image/png" {
            return Err(RoundtripError::Invalid(
                "回传结果必须是 image/png".to_string(),
            ));
        }
    }
    if file.data.len() > MAX_RESULT_BYTES {
        return Err(RoundtripError::Invalid(format!(
            "回传结果超过 {} MB 上限",
            MAX_RESULT_BYTES / (1024 * 1024)
        )));
    }
    let view = state
        .store
        .complete(&job_id, &token, &file.data, now_ms())?;
    // 画布同时轮询状态，但事件能让它在编辑器提交的瞬间就更新；没有监听者时只返回 Err，不上报。
    let _ = state.app.emit(ROUNDTRIP_JOB_COMPLETED_EVENT, &view);
    Ok(Json(json!({
        "ok": true,
        "jobId": view.job_id,
        "status": view.status,
        "resultUrl": format!("/api/roundtrip/results/{}", view.job_id),
        "completedAt": view.completed_at,
    }))
    .into_response())
}

async fn job_cancel(
    AxumState(state): AxumState<HttpState>,
    Path(job_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<RoundtripJobView>, RoundtripError> {
    let token = bearer(&headers)?;
    Ok(Json(state.store.cancel(&job_id, &token, now_ms())?))
}

async fn job_result_bytes(
    AxumState(state): AxumState<HttpState>,
    Path(job_id): Path<String>,
) -> Result<Response, RoundtripError> {
    let path = state.store.result_for_download(&job_id)?;
    let bytes = std::fs::read(&path)
        .map_err(|error| RoundtripError::Internal(format!("读取结果图失败: {error}")))?;
    Ok(raw_response(bytes, "image/png"))
}

/// 反向推送：编辑器（Photoshop UXP 面板）主动把一张图推给画布。
///
/// WHY 不带 Bearer 令牌：推送是编辑器发起的，它手上没有任务令牌（令牌是画布派单时才发的）。
/// 能进门靠的是 `guard_request` 里的回环对端复查 + CORS 白名单：非本机连接在中间件就被挡掉，
/// 本机的其他进程本来就拿不到更多东西——它推的是自己的图，不是读画布里的素材。
async fn push_image(
    AxumState(state): AxumState<HttpState>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<Response, RoundtripError> {
    let parts = multipart_parts(&headers, &body)?;
    let upload = parse_push_upload(&parts)?;
    let push = state.store.record_push(
        &upload.data,
        &upload.mime,
        upload.file_name.as_deref(),
        upload.label,
        upload.project_id,
        now_ms(),
    )?;
    // 画布通常在线，事件是快路径；它没监听时发射失败不影响推送成功，漏掉的由轮询兜底。
    let payload = push.event_payload();
    let _ = state.app.emit(ROUNDTRIP_CANVAS_IMAGE_EVENT, payload);
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "ok": true,
            "path": push.path,
            "fileName": push.file_name,
        })),
    )
        .into_response())
}

fn raw_response(bytes: Vec<u8>, mime: &str) -> Response {
    let mut response = Response::new(axum::body::Body::from(bytes));
    response
        .headers_mut()
        .insert(CONTENT_TYPE, mime.parse().expect("mime 已归一化"));
    response
        .headers_mut()
        .insert("cache-control", "no-store".parse().expect("静态头合法"));
    response
}

// ---------------------------------------------------------------------------
// 极简 multipart 解析
//
// WHY 不引 axum 的 Multipart 提取器：它的分片默认尺寸上限远小于 50 MB 的 PNG，
// 而桥只需要「一组文本字段 + 一个文件字段」这一种形态，自己解析更可控也更好测。
// ---------------------------------------------------------------------------

struct MultipartPart {
    name: Option<String>,
    /// 客户端原始文件名，只当元数据回给画布，绝不参与拼路径。
    file_name: Option<String>,
    content_type: Option<String>,
    data: Vec<u8>,
}

fn multipart_parts(headers: &HeaderMap, body: &[u8]) -> Result<Vec<MultipartPart>, RoundtripError> {
    let boundary = headers
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(content_type_boundary)
        .ok_or_else(|| RoundtripError::Invalid("请求不是 multipart/form-data".to_string()))?;
    parse_multipart(body, &boundary)
}

fn content_type_boundary(content_type: &str) -> Option<String> {
    for segment in content_type.split(';').skip(1) {
        let segment = segment.trim();
        if let Some(value) = segment.strip_prefix("boundary=") {
            let value = value.trim().trim_matches('"');
            if !value.is_empty() && value.len() <= 128 {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn parse_multipart(body: &[u8], boundary: &str) -> Result<Vec<MultipartPart>, RoundtripError> {
    if boundary.is_empty() || boundary.len() > 128 {
        return Err(RoundtripError::Invalid("multipart 边界无效".to_string()));
    }
    let marker = format!("--{boundary}");
    let marker_bytes = marker.as_bytes();
    let delimiter = format!("\r\n--{boundary}");
    let delimiter_bytes = delimiter.as_bytes();
    let mut cursor = find_bytes(body, marker_bytes, 0)
        .map(|index| index + marker_bytes.len())
        .ok_or_else(|| RoundtripError::Invalid("multipart 主体缺少边界".to_string()))?;

    let mut parts = Vec::new();
    loop {
        if body[cursor..].starts_with(b"--") {
            break;
        }
        if body[cursor..].starts_with(b"\r\n") {
            cursor += 2;
        } else if body[cursor..].starts_with(b"\n") {
            cursor += 1;
        } else {
            return Err(RoundtripError::Invalid(
                "multipart 边界格式错误".to_string(),
            ));
        }
        let (headers_end, separator_len) = find_bytes(body, b"\r\n\r\n", cursor)
            .map(|index| (index, 4))
            .or_else(|| find_bytes(body, b"\n\n", cursor).map(|index| (index, 2)))
            .ok_or_else(|| RoundtripError::Invalid("multipart 分片缺少头部".to_string()))?;
        let (name, file_name, content_type) = parse_part_headers(&body[cursor..headers_end]);
        let content_start = headers_end + separator_len;
        let next = find_bytes(body, delimiter_bytes, content_start)
            .ok_or_else(|| RoundtripError::Invalid("multipart 分片未闭合".to_string()))?;
        parts.push(MultipartPart {
            name,
            file_name,
            content_type,
            data: body[content_start..next].to_vec(),
        });
        cursor = next + 2 + marker_bytes.len();
    }
    Ok(parts)
}

fn find_bytes(haystack: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() || from >= haystack.len() {
        return None;
    }
    haystack[from..]
        .windows(needle.len())
        .position(|window| window == needle)
        .map(|position| position + from)
}

/// 返回 `(name, filename, content-type)`：filename 只有推送面用得上，其余端点忽略。
fn parse_part_headers(raw: &[u8]) -> (Option<String>, Option<String>, Option<String>) {
    let text = String::from_utf8_lossy(raw);
    let mut name = None;
    let mut file_name = None;
    let mut content_type = None;
    for line in text.split('\n') {
        let line = line.trim_end_matches('\r');
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        match key.trim().to_ascii_lowercase().as_str() {
            "content-disposition" => {
                name = header_param(value, "name");
                file_name = header_param(value, "filename");
            }
            "content-type" => content_type = Some(value.trim().to_string()),
            _ => {}
        }
    }
    (name, file_name, content_type)
}

fn header_param(value: &str, key: &str) -> Option<String> {
    for segment in value.split(';') {
        let segment = segment.trim();
        let Some(rest) = segment.strip_prefix(key) else {
            continue;
        };
        let Some(rest) = rest.trim_start().strip_prefix('=') else {
            continue;
        };
        let parsed = rest.trim().trim_matches('"');
        if !parsed.is_empty() {
            return Some(parsed.to_string());
        }
    }
    None
}

fn take_file_part(parts: &[MultipartPart]) -> Result<&MultipartPart, RoundtripError> {
    parts
        .iter()
        .find(|part| part.name.as_deref() == Some("file"))
        .ok_or_else(|| RoundtripError::Invalid("multipart 缺少 file 字段".to_string()))
}

fn required_field(parts: &[MultipartPart], name: &str) -> Result<String, RoundtripError> {
    let part = parts
        .iter()
        .find(|part| part.name.as_deref() == Some(name))
        .ok_or_else(|| RoundtripError::Invalid(format!("multipart 缺少 {name} 字段")))?;
    if part.data.len() > MAX_FIELD_BYTES {
        return Err(RoundtripError::Invalid(format!("{name} 字段过长")));
    }
    let value = String::from_utf8(part.data.clone())
        .map_err(|_| RoundtripError::Invalid(format!("{name} 必须是 UTF-8 文本")))?;
    let value = value.trim().to_string();
    if value.is_empty() {
        return Err(RoundtripError::Invalid(format!("{name} 不能为空")));
    }
    Ok(value)
}

/// 可选文本字段：缺失、空白或非 UTF-8 都当作「没提供」，不因为一个脏字段拒掉整次推送；
/// 但超长仍然拒绝，避免有人把文本段当上传通道。
fn optional_field(parts: &[MultipartPart], name: &str) -> Result<Option<String>, RoundtripError> {
    let Some(part) = parts.iter().find(|part| part.name.as_deref() == Some(name)) else {
        return Ok(None);
    };
    if part.data.len() > MAX_FIELD_BYTES {
        return Err(RoundtripError::Invalid(format!("{name} 字段过长")));
    }
    let Ok(value) = String::from_utf8(part.data.clone()) else {
        return Ok(None);
    };
    let value = value.trim();
    Ok((!value.is_empty()).then(|| value.to_string()))
}

/// `POST /api/roundtrip/push` 的纯解析结果。
struct PushUpload {
    data: Vec<u8>,
    mime: String,
    file_name: Option<String>,
    label: Option<String>,
    project_id: Option<String>,
}

/// 推送请求的解析：不碰 Tauri、不落盘，体积与 mime 规则在这里就收紧，便于单测覆盖。
fn parse_push_upload(parts: &[MultipartPart]) -> Result<PushUpload, RoundtripError> {
    let file = take_file_part(parts)?;
    // 与结果图同一个上限：50 MB 足够 8K，再大就不是「推送一张图」而是搬运工程文件。
    if file.data.len() > MAX_RESULT_BYTES {
        return Err(RoundtripError::Invalid(format!(
            "推送图片超过 {} MB 上限",
            MAX_RESULT_BYTES / (1024 * 1024)
        )));
    }
    // 复用源图那一套白名单 + 魔数嗅探，推送面不再有第二份「能进来」的类型判断。
    let mime = accept_source_mime(&file.data, file.content_type.as_deref())?;
    Ok(PushUpload {
        data: file.data.clone(),
        mime,
        file_name: file.file_name.clone(),
        label: optional_field(parts, "label")?,
        project_id: optional_field(parts, "projectId")?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = &[
        0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x11, 0x22, 0x33,
    ];

    fn build_body(boundary: &str, fields: &[(&str, Option<&str>, &[u8])]) -> Vec<u8> {
        let mut body = Vec::new();
        for (name, content_type, data) in fields {
            body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
            body.extend_from_slice(
                format!("Content-Disposition: form-data; name=\"{name}\"\r\n").as_bytes(),
            );
            if let Some(content_type) = content_type {
                body.extend_from_slice(format!("Content-Type: {content_type}\r\n").as_bytes());
            }
            body.extend_from_slice(b"\r\n");
            body.extend_from_slice(data);
            body.extend_from_slice(b"\r\n");
        }
        body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
        body
    }

    fn headers_with_boundary(boundary: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}")
                .parse()
                .unwrap(),
        );
        headers
    }

    /// 推送面要带原始文件名，因此单独一个会写 filename 的构造器（其余旧用例不受影响）。
    fn build_push_body(
        boundary: &str,
        file_name: Option<&str>,
        content_type: Option<&str>,
        data: &[u8],
        fields: &[(&str, &str)],
    ) -> Vec<u8> {
        let mut body = Vec::new();
        for (name, value) in fields {
            body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
            body.extend_from_slice(
                format!("Content-Disposition: form-data; name=\"{name}\"\r\n\r\n").as_bytes(),
            );
            body.extend_from_slice(value.as_bytes());
            body.extend_from_slice(b"\r\n");
        }
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        let disposition = match file_name {
            Some(file_name) => format!(
                "Content-Disposition: form-data; name=\"file\"; filename=\"{file_name}\"\r\n"
            ),
            None => "Content-Disposition: form-data; name=\"file\"\r\n".to_string(),
        };
        body.extend_from_slice(disposition.as_bytes());
        if let Some(content_type) = content_type {
            body.extend_from_slice(format!("Content-Type: {content_type}\r\n").as_bytes());
        }
        body.extend_from_slice(b"\r\n");
        body.extend_from_slice(data);
        body.extend_from_slice(b"\r\n");
        body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
        body
    }

    #[test]
    fn multipart_parser_round_trips_binary_parts_and_text_fields() {
        let boundary = "----roundtrip-test-boundary";
        let body = build_body(
            boundary,
            &[
                ("sourceNodeId", None, b"node-42"),
                ("file", Some("image/png"), PNG),
            ],
        );
        let parts = multipart_parts(&headers_with_boundary(boundary), &body).unwrap();
        assert_eq!(parts.len(), 2);
        assert_eq!(required_field(&parts, "sourceNodeId").unwrap(), "node-42");
        let file = take_file_part(&parts).unwrap();
        assert_eq!(file.data, PNG, "二进制分片必须逐字节还原");
        assert_eq!(file.content_type.as_deref(), Some("image/png"));
    }

    #[test]
    fn multipart_parser_keeps_payloads_containing_the_partial_boundary_bytes() {
        let boundary = "----roundtrip-test-boundary";
        // 载荷里出现边界前缀（但没有 CRLF+完整边界）时不能被截断
        let payload = [b"--roundtrip".as_slice(), PNG].concat();
        let body = build_body(boundary, &[("file", Some("image/png"), &payload)]);
        let parts = multipart_parts(&headers_with_boundary(boundary), &body).unwrap();
        assert_eq!(take_file_part(&parts).unwrap().data, payload);
    }

    #[test]
    fn multipart_parser_rejects_missing_boundary_and_missing_file_field() {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, "application/json".parse().unwrap());
        assert!(multipart_parts(&headers, b"{}").is_err());
        assert!(content_type_boundary("multipart/form-data; boundary=").is_none());

        let boundary = "b";
        let body = build_body(boundary, &[("sourceNodeId", None, b"node-1")]);
        let parts = multipart_parts(&headers_with_boundary(boundary), &body).unwrap();
        assert!(matches!(
            take_file_part(&parts),
            Err(RoundtripError::Invalid(message)) if message.contains("file")
        ));
    }

    #[test]
    fn only_loopback_http_origins_and_null_are_accepted() {
        assert!(is_allowed_origin("http://127.0.0.1:8791"));
        assert!(is_allowed_origin("http://localhost:3000"));
        assert!(is_allowed_origin("null"));
        assert!(is_allowed_origin("NULL"));
        assert!(!is_allowed_origin("http://192.168.1.10:8791"));
        assert!(!is_allowed_origin("https://127.0.0.1:8791"));
        assert!(!is_allowed_origin("http://evil.example"));
        assert!(!is_allowed_origin("file://"));
        assert!(!is_allowed_origin(""));
    }

    #[test]
    fn loopback_peers_are_recognized_in_both_families() {
        assert!(is_loopback("127.0.0.1".parse().unwrap()));
        assert!(is_loopback("127.9.9.9".parse().unwrap()));
        assert!(is_loopback("::1".parse().unwrap()));
        assert!(!is_loopback("192.168.0.2".parse().unwrap()));
        assert!(!is_loopback("0.0.0.0".parse().unwrap()));
    }

    #[test]
    fn push_uploads_carry_metadata_and_reject_bad_types_or_oversize_payloads() {
        let boundary = "----roundtrip-push-boundary";
        let body = build_push_body(
            boundary,
            Some("cover art.png"),
            Some("image/png"),
            PNG,
            &[("label", "封面"), ("projectId", "project-7")],
        );
        let parts = multipart_parts(&headers_with_boundary(boundary), &body).unwrap();
        let upload = parse_push_upload(&parts).unwrap();
        assert_eq!(upload.data, PNG);
        assert_eq!(upload.mime, "image/png");
        assert_eq!(upload.file_name.as_deref(), Some("cover art.png"));
        assert_eq!(upload.label.as_deref(), Some("封面"));
        assert_eq!(upload.project_id.as_deref(), Some("project-7"));

        // 白名单外：内容与声明都过不了 accept_source_mime
        let svg = build_push_body(boundary, None, Some("image/svg+xml"), b"<svg/>", &[]);
        let parts = multipart_parts(&headers_with_boundary(boundary), &svg).unwrap();
        assert!(matches!(
            parse_push_upload(&parts),
            Err(RoundtripError::Invalid(_))
        ));

        // 缺 file 分片：只有文本字段时按 400 拒绝
        let missing = build_body(boundary, &[("label", None, b"x")]);
        let parts = multipart_parts(&headers_with_boundary(boundary), &missing).unwrap();
        assert!(matches!(
            parse_push_upload(&parts),
            Err(RoundtripError::Invalid(message)) if message.contains("file")
        ));

        // 空的 file 分片同样过不了类型识别
        let empty = build_push_body(boundary, None, None, b"", &[]);
        let parts = multipart_parts(&headers_with_boundary(boundary), &empty).unwrap();
        assert!(matches!(
            parse_push_upload(&parts),
            Err(RoundtripError::Invalid(_))
        ));

        // 超过 50 MB：体积在解析阶段就被拒，不会走到落盘
        let oversize = vec![0x89_u8; MAX_RESULT_BYTES + 1];
        let body = build_push_body(boundary, None, Some("image/png"), &oversize, &[]);
        let parts = multipart_parts(&headers_with_boundary(boundary), &body).unwrap();
        assert!(matches!(
            parse_push_upload(&parts),
            Err(RoundtripError::Invalid(message)) if message.contains("上限")
        ));
    }

    #[test]
    fn optional_fields_are_ignored_when_absent_blank_or_non_utf8() {
        let boundary = "b";
        let body = build_push_body(
            boundary,
            None,
            Some("image/png"),
            PNG,
            &[("label", "   "), ("projectId", "project-1")],
        );
        let parts = multipart_parts(&headers_with_boundary(boundary), &body).unwrap();
        assert_eq!(optional_field(&parts, "label").unwrap(), None);
        assert_eq!(
            optional_field(&parts, "projectId").unwrap().as_deref(),
            Some("project-1")
        );
        assert_eq!(optional_field(&parts, "missing").unwrap(), None);

        let mut parts = parts;
        parts.push(MultipartPart {
            name: Some("label".to_string()),
            file_name: None,
            content_type: None,
            data: vec![0xff, 0xfe],
        });
        assert_eq!(optional_field(&parts, "label").unwrap(), None);
    }

    #[test]
    fn push_route_is_registered_without_conflicts() {
        // axum 在注册冲突的路径时 panic：构造一次路由表就能把这类问题挡在启动之前。
        let _ = roundtrip_routes();
    }

    #[test]
    fn bearer_tokens_are_required_and_trimmed() {
        let mut headers = HeaderMap::new();
        assert!(matches!(
            bearer(&headers),
            Err(RoundtripError::Unauthorized(_))
        ));
        headers.insert(AUTHORIZATION, "Bearer  ".parse().unwrap());
        assert!(bearer(&headers).is_err());
        headers.insert(AUTHORIZATION, "Bearer abc123".parse().unwrap());
        assert_eq!(bearer(&headers).unwrap(), "abc123");
        headers.insert(AUTHORIZATION, "abc123".parse().unwrap());
        assert!(bearer(&headers).is_err());
    }
}
