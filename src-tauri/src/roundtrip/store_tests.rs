use super::*;

const PNG: &[u8] = &[
    0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
];

struct TempStore {
    store: JobStore,
    root: PathBuf,
}

impl TempStore {
    fn new(name: &str) -> Self {
        let sequence = JOB_SEQUENCE.fetch_add(1, Ordering::AcqRel);
        let root = std::env::temp_dir().join(format!(
            "roundtrip-store-{}-{}-{sequence}",
            name,
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let store = JobStore::new(
            root.join("sources"),
            root.join("results"),
            root.join("pushed"),
        )
        .unwrap();
        Self { store, root }
    }

    fn spec() -> NewJobSpec {
        NewJobSpec {
            source_node_id: "node-1".to_string(),
            project_id: "project-1".to_string(),
            canvas_id: "canvas-1".to_string(),
        }
    }
}

impl Drop for TempStore {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn job_view_serializes_to_camel_case_json() {
    let temp = TempStore::new("view");
    let (view, token) = temp
        .store
        .create(TempStore::spec(), PNG, "image/png".to_string(), 50_000)
        .unwrap();
    let queued = serde_json::to_value(&view).unwrap();
    assert_eq!(queued["jobId"], view.job_id);
    assert_eq!(queued["sourceNodeId"], "node-1");
    assert_eq!(queued["projectId"], "project-1");
    assert_eq!(queued["canvasId"], "canvas-1");
    assert_eq!(queued["status"], "queued");
    assert!(queued["createdAt"].is_number());
    assert!(queued["expiresAt"].is_number());
    // 可选字段没有值时不出现，前端用 `undefined` 判断即可
    for absent in ["claimedAt", "completedAt", "resultPath", "message"] {
        assert!(queued.get(absent).is_none(), "{absent} 不应出现");
    }

    temp.store.claim_next(50_000).unwrap().unwrap();
    let completed = temp
        .store
        .complete(&view.job_id, &token, PNG, 50_500)
        .unwrap();
    let done = serde_json::to_value(&completed).unwrap();
    assert_eq!(done["status"], "completed");
    assert!(done["claimedAt"].is_number());
    assert!(done["completedAt"].is_number());
    assert!(done["resultPath"].as_str().unwrap().ends_with(".png"));
}

#[test]
fn token_comparison_is_exact_for_equal_unequal_and_short_inputs() {
    assert!(token_matches("abcdef", "abcdef"));
    assert!(!token_matches("abcdef", "abcdeg"));
    assert!(!token_matches("abcdef", "abcde"));
    assert!(!token_matches("abcdef", "abcdef0"));
    assert!(!token_matches("abcdef", ""));
    assert!(token_matches("", ""));
}

#[test]
fn jobs_expire_after_ttl_and_source_files_are_deleted() {
    let temp = TempStore::new("ttl");
    let (view, _token) = temp
        .store
        .create(TempStore::spec(), PNG, "image/png".to_string(), 1_000)
        .unwrap();
    assert_eq!(view.status, JobStatus::Queued);
    assert_eq!(view.expires_at, 1_000 + JOB_TTL_MS);
    let source_path = temp
        .store
        .sources_dir()
        .join(format!("{}.png", view.job_id));
    assert!(source_path.is_file());

    temp.store.sweep(1_000 + JOB_TTL_MS).unwrap();
    let expired = temp.store.view(&view.job_id).unwrap();
    assert_eq!(expired.status, JobStatus::Expired);
    assert!(!source_path.exists(), "过期后源图必须被删除");
}

#[test]
fn claim_lease_timeout_requeues_the_job() {
    let temp = TempStore::new("lease");
    let (view, token) = temp
        .store
        .create(TempStore::spec(), PNG, "image/png".to_string(), 10_000)
        .unwrap();
    let claimed = temp.store.claim_next(11_000).unwrap().unwrap();
    assert_eq!(claimed.view.status, JobStatus::Claimed);
    assert_eq!(claimed.token, token, "领取时返回的令牌必须与创建时一致");
    assert!(temp.store.claim_next(11_500).unwrap().is_none());

    // 下载源图后进入 editing，但租约仍然按领取时间计算
    let (path, mime) = temp
        .store
        .source_for_download(&view.job_id, &token, 11_600)
        .unwrap();
    assert!(path.is_file());
    assert_eq!(mime, "image/png");
    assert_eq!(
        temp.store.view(&view.job_id).unwrap().status,
        JobStatus::Editing
    );

    temp.store.sweep(11_600 + CLAIM_LEASE_MS).unwrap();
    let requeued = temp.store.view(&view.job_id).unwrap();
    assert_eq!(requeued.status, JobStatus::Queued);
    assert_eq!(requeued.claimed_at, None);
    assert!(temp
        .store
        .claim_next(11_700 + CLAIM_LEASE_MS)
        .unwrap()
        .is_some());
}

#[test]
fn completion_deletes_the_source_and_keeps_the_result_path() {
    let temp = TempStore::new("complete");
    let (view, token) = temp
        .store
        .create(TempStore::spec(), PNG, "image/png".to_string(), 20_000)
        .unwrap();
    temp.store.claim_next(20_000).unwrap().unwrap();
    let source_path = temp
        .store
        .sources_dir()
        .join(format!("{}.png", view.job_id));

    let completed = temp
        .store
        .complete(&view.job_id, &token, PNG, 20_500)
        .unwrap();
    assert_eq!(completed.status, JobStatus::Completed);
    assert_eq!(completed.completed_at, Some(20_500));
    assert!(!source_path.exists(), "完成后源图必须被删除");
    let result_path = completed.result_path.unwrap();
    assert!(PathBuf::from(&result_path).is_file());
    assert!(result_path.ends_with(&format!("{}.png", view.job_id)));
}

#[test]
fn wrong_or_missing_tokens_are_unauthorized() {
    let temp = TempStore::new("token");
    let (view, token) = temp
        .store
        .create(TempStore::spec(), PNG, "image/png".to_string(), 30_000)
        .unwrap();
    temp.store.claim_next(30_000).unwrap().unwrap();

    for candidate in ["", "deadbeef", &"0".repeat(token.len())] {
        assert!(matches!(
            temp.store
                .source_for_download(&view.job_id, candidate, 30_100),
            Err(RoundtripError::Unauthorized(_))
        ));
    }
    assert!(temp
        .store
        .source_for_download(&view.job_id, &token, 30_100)
        .is_ok());
}

#[test]
fn source_mime_whitelist_rejects_anything_outside_the_four_formats() {
    for allowed in SOURCE_MIME_WHITELIST {
        assert_eq!(ensure_whitelisted(allowed).unwrap(), allowed);
    }
    assert!(ensure_whitelisted("image/svg+xml").is_err());
    assert!(ensure_whitelisted("image/bmp").is_err());
    assert!(ensure_whitelisted("application/octet-stream").is_err());

    // 魔数优先于声明：声明成 jpeg 的 PNG 仍然按 PNG 处理
    assert_eq!(
        accept_source_mime(PNG, Some("image/jpeg")).unwrap(),
        "image/png"
    );
    // 无法嗅探时退回声明值，并统一大小写与别名
    assert_eq!(
        accept_source_mime(b"not-an-image", Some("IMAGE/JPG")).unwrap(),
        "image/jpeg"
    );
    assert!(accept_source_mime(b"not-an-image", Some("image/svg+xml")).is_err());
    assert!(accept_source_mime(b"not-an-image", None).is_err());
    assert!(matches!(
        accept_source_mime(b"GIF89a-not-really", Some("image/gif")),
        Ok(mime) if mime == "image/gif"
    ));
    assert!(accept_source_mime(b"\x00\x01\x02", Some("image/bmp")).is_err());
}

#[test]
fn editor_goes_offline_fifteen_seconds_after_the_last_heartbeat() {
    let temp = TempStore::new("editor");
    assert!(!temp.store.editor_online(1_000));
    temp.store.touch_editor(1_000);
    assert!(temp.store.editor_online(1_000 + EDITOR_OFFLINE_MS - 1));
    assert!(!temp.store.editor_online(1_000 + EDITOR_OFFLINE_MS));
}

#[test]
fn cancelled_jobs_drop_their_source_file() {
    let temp = TempStore::new("cancel");
    let (view, _token) = temp
        .store
        .create(TempStore::spec(), PNG, "image/png".to_string(), 40_000)
        .unwrap();
    let source_path = temp
        .store
        .sources_dir()
        .join(format!("{}.png", view.job_id));
    let cancelled = temp.store.cancel_local(&view.job_id, 40_100).unwrap();
    assert_eq!(cancelled.status, JobStatus::Cancelled);
    assert!(!source_path.exists());
}

/// 推送落盘用的字节；mime 的嗅探与白名单由 accept_source_mime 负责，这里只需是合法 PNG。
const PUSH_PNG: &[u8] = &[
    0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a, 0x10, 0x20, 0x30, 0x40,
];

#[test]
fn pushes_land_on_disk_newest_first_and_ack_removes_them() {
    let temp = TempStore::new("push");
    let first = temp
        .store
        .record_push(
            PUSH_PNG,
            "image/png",
            Some("first.png"),
            Some("标签一".to_string()),
            Some("project-1".to_string()),
            1_000,
        )
        .unwrap();
    assert_eq!(first.file_name, "first.png");
    assert_eq!(first.received_at, 1_000);
    assert!(PathBuf::from(&first.path).is_file(), "推送图必须落盘");
    assert_eq!(
        PathBuf::from(&first.path).parent().unwrap(),
        temp.store.pushed_dir()
    );
    assert!(first.path.ends_with(".png"), "文件名 UUID 后缀跟 mime 走");

    let second = temp
        .store
        .record_push(PUSH_PNG, "image/png", None, None, None, 2_000)
        .unwrap();
    let saved_name = PathBuf::from(&second.path)
        .file_name()
        .unwrap()
        .to_string_lossy()
        .into_owned();
    assert_eq!(second.file_name, saved_name, "没有原始文件名时退回保存名");
    let pending = temp.store.pending_pushes().unwrap();
    assert_eq!(pending.len(), 2);
    assert_eq!(pending[0]["path"], second.path, "最新在前");
    assert_eq!(pending[1]["path"], first.path);

    temp.store.ack_push(&first.path).unwrap();
    assert!(!PathBuf::from(&first.path).exists(), "ack 后文件应删除");
    let pending = temp.store.pending_pushes().unwrap();
    assert_eq!(pending.len(), 1);
    // 重复 ack 是幂等操作，不该报错
    temp.store.ack_push(&first.path).unwrap();
    assert_eq!(temp.store.pending_pushes().unwrap().len(), 1);
}

#[test]
fn identical_retries_collapse_into_a_single_pending_push() {
    let temp = TempStore::new("push-dedupe");
    let first = temp
        .store
        .record_push(
            PUSH_PNG,
            "image/png",
            Some("dup.png"),
            Some("l".to_string()),
            Some("p".to_string()),
            1_000,
        )
        .unwrap();
    let retry = temp
        .store
        .record_push(
            PUSH_PNG,
            "image/png",
            Some("dup.png"),
            Some("l".to_string()),
            Some("p".to_string()),
            2_000,
        )
        .unwrap();
    assert_ne!(retry.path, first.path, "重试是新文件");
    assert!(!PathBuf::from(&first.path).exists(), "被折叠的旧文件要删掉");
    let pending = temp.store.pending_pushes().unwrap();
    assert_eq!(pending.len(), 1, "同一次推送的重试不该出现两条");
    assert_eq!(pending[0]["receivedAt"], 2_000);

    // 标签/工程不同就是另一次推送，不折叠
    temp.store
        .record_push(
            PUSH_PNG,
            "image/png",
            Some("dup.png"),
            Some("other".to_string()),
            Some("p".to_string()),
            3_000,
        )
        .unwrap();
    assert_eq!(temp.store.pending_pushes().unwrap().len(), 2);
}

#[test]
fn pending_pushes_are_capped_at_twenty_and_the_oldest_files_go_away() {
    let temp = TempStore::new("push-cap");
    let mut paths = Vec::new();
    for index in 0..(MAX_PENDING_PUSHES + 3) {
        let name = format!("img-{index}.png");
        let push = temp
            .store
            .record_push(
                PUSH_PNG,
                "image/png",
                Some(name.as_str()),
                None,
                None,
                index as i64,
            )
            .unwrap();
        paths.push(push.path);
    }
    let pending = temp.store.pending_pushes().unwrap();
    assert_eq!(pending.len(), MAX_PENDING_PUSHES);
    assert_eq!(pending[0]["fileName"], "img-22.png", "最新在前");
    assert_eq!(pending[MAX_PENDING_PUSHES - 1]["fileName"], "img-3.png");
    for path in &paths[..3] {
        assert!(!PathBuf::from(path).exists(), "被挤掉的推送要连文件一起删");
    }
    assert!(PathBuf::from(paths.last().unwrap()).is_file());
}

/// 取 JSON 对象的键名并排序：用来断言「载荷里的键正好是这几个」。
fn sorted_keys(value: &serde_json::Value) -> Vec<&str> {
    let mut keys: Vec<&str> = value
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect();
    keys.sort_unstable();
    keys
}

#[test]
fn pending_push_json_uses_exactly_the_documented_keys() {
    let temp = TempStore::new("push-json");
    let push = temp
        .store
        .record_push(
            PUSH_PNG,
            "image/png",
            Some("keys.png"),
            Some("l".to_string()),
            Some("p".to_string()),
            7_000,
        )
        .unwrap();

    let view = push.view();
    assert_eq!(
        sorted_keys(&view),
        vec!["fileName", "label", "path", "receivedAt"]
    );
    assert_eq!(view["path"], push.path);
    assert_eq!(view["label"], "l");
    assert!(view["receivedAt"].is_number());
    assert!(view.get("projectId").is_none(), "轮询条目不带 projectId");

    // 事件载荷比轮询多一个 projectId，空值一律不出现
    let payload = push.event_payload();
    assert_eq!(
        sorted_keys(&payload),
        vec!["fileName", "label", "path", "projectId"]
    );
    assert_eq!(payload["projectId"], "p");

    let bare = RoundtripPush {
        path: "E:/tmp/a.png".to_string(),
        file_name: "a.png".to_string(),
        label: None,
        project_id: None,
        received_at: 1,
    };
    assert_eq!(sorted_keys(&bare.event_payload()), vec!["fileName", "path"]);
}

#[test]
fn record_push_rejects_empty_and_oversize_payloads() {
    let temp = TempStore::new("push-limit");
    assert!(temp
        .store
        .record_push(PUSH_PNG, "image/png", Some("a.png"), None, None, 1)
        .is_ok());
    assert!(matches!(
        temp.store
            .record_push(&[], "image/png", None, None, None, 1),
        Err(RoundtripError::Invalid(_))
    ));

    let oversize = vec![0_u8; MAX_RESULT_BYTES + 1];
    assert!(matches!(
        temp.store
            .record_push(&oversize, "image/png", Some("big.png"), None, None, 1),
        Err(RoundtripError::Invalid(message)) if message.contains("上限")
    ));
    // 被拒的推送不该留下任何空文件
    assert_eq!(temp.store.pending_pushes().unwrap().len(), 1);
}
