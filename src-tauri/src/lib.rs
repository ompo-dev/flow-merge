use std::{collections::HashMap, str::FromStr, sync::Arc};

use axum::{
  body::{Body, Bytes},
  extract::State as AxumState,
  http::{HeaderMap, Method, Response, StatusCode, Uri},
  routing::any,
  Router,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State as TauriState};
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::{
  net::TcpListener,
  sync::{oneshot, Mutex},
  time::{timeout, Duration},
};
use url::Url;

const RUNTIME_PORT: u16 = 45431;
const RUNTIME_EVENT_NAME: &str = "runtime://webhook";
const UPDATER_EVENT_NAME: &str = "updater://state";
const UPDATER_CHECK_INTERVAL_MS: u64 = 6 * 60 * 60 * 1000;
const DEV_UPDATER_PUBLIC_KEY: &str = include_str!("../updater.dev.pubkey");

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWebhookRoute {
  pub path: String,
  pub workflow_id: String,
  pub node_id: String,
  pub method: String,
  pub secret_token: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
  pub running: bool,
  pub port: u16,
  pub base_url: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWebhookDelivery {
  pub delivery_id: String,
  pub workflow_id: String,
  pub node_id: String,
  pub method: String,
  pub path: String,
  pub headers: HashMap<String, String>,
  pub body_text: String,
  pub body_json: Option<serde_json::Value>,
  pub query: Option<HashMap<String, String>>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeWebhookCompletion {
  pub delivery_id: String,
  pub status: u16,
  pub body: String,
  pub headers: Option<HashMap<String, String>>,
}

#[derive(Clone)]
struct RuntimeServerState {
  routes: Arc<Mutex<HashMap<String, RuntimeWebhookRoute>>>,
  pending: Arc<Mutex<HashMap<String, oneshot::Sender<RuntimeWebhookCompletion>>>>,
  running: Arc<Mutex<bool>>,
  port: u16,
}

#[derive(Clone)]
struct HttpRuntimeState {
  app_handle: AppHandle,
  shared: RuntimeServerState,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReleaseChannel {
  Stable,
  Beta,
  Internal,
}

impl Default for ReleaseChannel {
  fn default() -> Self {
    Self::Stable
  }
}

impl ReleaseChannel {
  fn as_str(&self) -> &'static str {
    match self {
      Self::Stable => "stable",
      Self::Beta => "beta",
      Self::Internal => "internal",
    }
  }

  fn release_tag(&self) -> String {
    format!("channel-{}", self.as_str())
  }
}

impl FromStr for ReleaseChannel {
  type Err = String;

  fn from_str(value: &str) -> Result<Self, Self::Err> {
    match value.trim().to_lowercase().as_str() {
      "stable" => Ok(Self::Stable),
      "beta" => Ok(Self::Beta),
      "internal" => Ok(Self::Internal),
      other => Err(format!("invalid release channel: {other}")),
    }
  }
}

struct PendingUpdate {
  channel: ReleaseChannel,
  version: String,
  update: Update,
  bytes: Vec<u8>,
}

#[derive(Clone)]
struct UpdaterRuntimeState {
  pending: Arc<Mutex<Option<PendingUpdate>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdaterConfigPayload {
  enabled: bool,
  repository: Option<String>,
  current_version: String,
  default_channel: String,
  channels: Vec<String>,
  check_interval_ms: u64,
  feed_urls: HashMap<String, String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdaterCheckPayload {
  enabled: bool,
  current_version: String,
  channel: String,
  feed_url: Option<String>,
  available: bool,
  version: Option<String>,
  body: Option<String>,
  date: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdaterEventPayload {
  state: String,
  channel: String,
  current_version: String,
  version: Option<String>,
  body: Option<String>,
  date: Option<String>,
  downloaded_bytes: Option<u64>,
  total_bytes: Option<u64>,
  error: Option<String>,
}

fn normalize_path(path: &str) -> String {
  let trimmed = path.trim();
  if trimmed.is_empty() {
    return "/".to_string();
  }
  if trimmed.starts_with('/') {
    trimmed.to_string()
  } else {
    format!("/{}", trimmed)
  }
}

fn default_runtime_response(status: StatusCode, body: &str) -> Response<Body> {
  Response::builder()
    .status(status)
    .header("content-type", "application/json")
    .body(Body::from(body.to_string()))
    .unwrap_or_else(|_| Response::new(Body::from(body.to_string())))
}

fn configured_repository() -> Option<String> {
  option_env!("FLOW_MERGE_UPDATE_REPOSITORY")
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(str::to_string)
}

fn configured_public_key() -> String {
  option_env!("FLOW_MERGE_UPDATE_PUBLIC_KEY")
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .unwrap_or(DEV_UPDATER_PUBLIC_KEY.trim())
    .to_string()
}

fn updater_feed_urls(repository: &str) -> HashMap<String, String> {
  [
    ReleaseChannel::Stable,
    ReleaseChannel::Beta,
    ReleaseChannel::Internal,
  ]
  .into_iter()
  .map(|channel| {
    (
      channel.as_str().to_string(),
      format!(
        "https://github.com/{repository}/releases/download/{}/latest.json",
        channel.release_tag()
      ),
    )
  })
  .collect()
}

fn updater_url_for_channel(channel: ReleaseChannel) -> Result<Url, String> {
  let repository = configured_repository().ok_or_else(|| {
    "updater repository is not configured. Set FLOW_MERGE_UPDATE_REPOSITORY at build time."
      .to_string()
  })?;

  let url = format!(
    "https://github.com/{repository}/releases/download/{}/latest.json",
    channel.release_tag()
  );
  Url::parse(&url).map_err(|error| format!("failed to build updater URL: {error}"))
}

fn emit_updater_event(app: &AppHandle, payload: UpdaterEventPayload) {
  if let Err(error) = app.emit(UPDATER_EVENT_NAME, payload) {
    log::error!("failed to emit updater event: {}", error);
  }
}

fn parse_query(uri: &Uri) -> Option<HashMap<String, String>> {
  let query = uri.query()?;
  let mut values = HashMap::new();

  for pair in query.split('&') {
    let mut parts = pair.splitn(2, '=');
    let key = parts.next().unwrap_or_default().to_string();
    let value = parts.next().unwrap_or_default().to_string();
    if !key.is_empty() {
      values.insert(key, value);
    }
  }

  Some(values)
}

async fn handle_runtime_webhook(
  AxumState(state): AxumState<HttpRuntimeState>,
  method: Method,
  uri: Uri,
  headers: HeaderMap,
  body: Bytes,
) -> Response<Body> {
  let path = normalize_path(uri.path());
  let route = {
    let routes = state.shared.routes.lock().await;
    routes.get(&path).cloned()
  };

  let Some(route) = route else {
    return default_runtime_response(
      StatusCode::NOT_FOUND,
      r#"{"error":"route_not_found"}"#,
    );
  };

  if route.method.to_uppercase() != method.as_str().to_uppercase() {
    return default_runtime_response(
      StatusCode::METHOD_NOT_ALLOWED,
      r#"{"error":"method_not_allowed"}"#,
    );
  }

  if let Some(secret) = &route.secret_token {
    let header_token = headers
      .get("x-flow-merge-token")
      .and_then(|value| value.to_str().ok())
      .map(|value| value.to_string())
      .or_else(|| {
        headers
          .get("authorization")
          .and_then(|value| value.to_str().ok())
          .map(|value| value.trim_start_matches("Bearer ").to_string())
      });

    if header_token.as_deref() != Some(secret.as_str()) {
      return default_runtime_response(
        StatusCode::UNAUTHORIZED,
        r#"{"error":"invalid_secret"}"#,
      );
    }
  }

  let delivery_id = uuid::Uuid::new_v4().to_string();
  let body_text = String::from_utf8(body.to_vec()).unwrap_or_default();
  let body_json = serde_json::from_str::<serde_json::Value>(&body_text).ok();
  let headers_map = headers
    .iter()
    .filter_map(|(key, value)| value.to_str().ok().map(|v| (key.to_string(), v.to_string())))
    .collect::<HashMap<_, _>>();
  let delivery = RuntimeWebhookDelivery {
    delivery_id: delivery_id.clone(),
    workflow_id: route.workflow_id.clone(),
    node_id: route.node_id.clone(),
    method: method.to_string(),
    path,
    headers: headers_map,
    body_text,
    body_json,
    query: parse_query(&uri),
  };

  let (sender, receiver) = oneshot::channel::<RuntimeWebhookCompletion>();
  {
    let mut pending = state.shared.pending.lock().await;
    pending.insert(delivery_id.clone(), sender);
  }

  if let Err(error) = state.app_handle.emit(RUNTIME_EVENT_NAME, &delivery) {
    log::error!("failed to emit webhook event: {}", error);
    let mut pending = state.shared.pending.lock().await;
    pending.remove(&delivery_id);
    return default_runtime_response(
      StatusCode::INTERNAL_SERVER_ERROR,
      r#"{"error":"emit_failed"}"#,
    );
  }

  match timeout(Duration::from_secs(30), receiver).await {
    Ok(Ok(completion)) => {
      let mut response = Response::builder()
        .status(StatusCode::from_u16(completion.status).unwrap_or(StatusCode::OK))
        .body(Body::from(completion.body))
        .unwrap_or_else(|_| Response::new(Body::from("ok")));

      if let Some(headers) = completion.headers {
        for (key, value) in headers {
          if let (Ok(name), Ok(parsed)) = (
            axum::http::header::HeaderName::try_from(key),
            axum::http::HeaderValue::from_str(&value),
          ) {
            response.headers_mut().insert(name, parsed);
          }
        }
      }

      response
    }
    _ => {
      let mut pending = state.shared.pending.lock().await;
      pending.remove(&delivery_id);
      default_runtime_response(
        StatusCode::ACCEPTED,
        r#"{"ok":true,"queued":true}"#,
      )
    }
  }
}

#[tauri::command]
async fn runtime_status(
  state: TauriState<'_, RuntimeServerState>,
) -> Result<RuntimeStatus, String> {
  let running = *state.running.lock().await;
  Ok(RuntimeStatus {
    running,
    port: state.port,
    base_url: format!("http://127.0.0.1:{}", state.port),
  })
}

#[tauri::command]
async fn runtime_sync_webhooks(
  routes: Vec<RuntimeWebhookRoute>,
  state: TauriState<'_, RuntimeServerState>,
) -> Result<usize, String> {
  let mut next_routes = HashMap::new();
  for route in routes {
    next_routes.insert(normalize_path(&route.path), route);
  }

  let count = next_routes.len();
  let mut shared_routes = state.routes.lock().await;
  *shared_routes = next_routes;
  Ok(count)
}

#[tauri::command]
async fn runtime_complete_webhook_delivery(
  completion: RuntimeWebhookCompletion,
  state: TauriState<'_, RuntimeServerState>,
) -> Result<bool, String> {
  let sender = {
    let mut pending = state.pending.lock().await;
    pending.remove(&completion.delivery_id)
  };

  if let Some(sender) = sender {
    sender
      .send(completion)
      .map_err(|_| "failed to complete delivery".to_string())?;
    return Ok(true);
  }

  Ok(false)
}

#[tauri::command]
async fn updater_get_config(app: AppHandle) -> Result<UpdaterConfigPayload, String> {
  let repository = configured_repository();
  let feed_urls = repository
    .as_deref()
    .map(updater_feed_urls)
    .unwrap_or_default();

  Ok(UpdaterConfigPayload {
    enabled: repository.is_some(),
    repository,
    current_version: app.package_info().version.to_string(),
    default_channel: ReleaseChannel::Stable.as_str().to_string(),
    channels: vec!["stable".into(), "beta".into(), "internal".into()],
    check_interval_ms: UPDATER_CHECK_INTERVAL_MS,
    feed_urls,
  })
}

#[tauri::command]
async fn updater_check(
  channel: Option<String>,
  app: AppHandle,
) -> Result<UpdaterCheckPayload, String> {
  let channel = channel
    .as_deref()
    .map(ReleaseChannel::from_str)
    .transpose()?
    .unwrap_or_default();
  let feed_url = updater_url_for_channel(channel).ok();
  let current_version = app.package_info().version.to_string();

  if feed_url.is_none() {
    return Ok(UpdaterCheckPayload {
      enabled: false,
      current_version,
      channel: channel.as_str().to_string(),
      feed_url: None,
      available: false,
      version: None,
      body: None,
      date: None,
    });
  }

  emit_updater_event(
    &app,
    UpdaterEventPayload {
      state: "checking".into(),
      channel: channel.as_str().into(),
      current_version: current_version.clone(),
      version: None,
      body: None,
      date: None,
      downloaded_bytes: None,
      total_bytes: None,
      error: None,
    },
  );

  let updater = app
    .updater_builder()
    .endpoints(vec![feed_url.clone().expect("checked above")])
    .map_err(|error| format!("failed to configure updater endpoint: {error}"))?
    .build()
    .map_err(|error| format!("failed to create updater: {error}"))?;

  match updater.check().await {
    Ok(Some(update)) => {
      let payload = UpdaterCheckPayload {
        enabled: true,
        current_version: current_version.clone(),
        channel: channel.as_str().to_string(),
        feed_url: feed_url.map(|url| url.to_string()),
        available: true,
        version: Some(update.version.clone()),
        body: update.body.clone(),
        date: update.date.map(|date| date.to_string()),
      };

      emit_updater_event(
        &app,
        UpdaterEventPayload {
          state: "available".into(),
          channel: channel.as_str().into(),
          current_version,
          version: payload.version.clone(),
          body: payload.body.clone(),
          date: payload.date.clone(),
          downloaded_bytes: None,
          total_bytes: None,
          error: None,
        },
      );

      Ok(payload)
    }
    Ok(None) => {
      emit_updater_event(
        &app,
        UpdaterEventPayload {
          state: "idle".into(),
          channel: channel.as_str().into(),
          current_version: current_version.clone(),
          version: None,
          body: None,
          date: None,
          downloaded_bytes: None,
          total_bytes: None,
          error: None,
        },
      );

      Ok(UpdaterCheckPayload {
        enabled: true,
        current_version,
        channel: channel.as_str().to_string(),
        feed_url: feed_url.map(|url| url.to_string()),
        available: false,
        version: None,
        body: None,
        date: None,
      })
    }
    Err(error) => {
      emit_updater_event(
        &app,
        UpdaterEventPayload {
          state: "error".into(),
          channel: channel.as_str().into(),
          current_version,
          version: None,
          body: None,
          date: None,
          downloaded_bytes: None,
          total_bytes: None,
          error: Some(error.to_string()),
        },
      );
      Err(format!("failed to check for updates: {error}"))
    }
  }
}

#[tauri::command]
async fn updater_download(
  channel: Option<String>,
  app: AppHandle,
  state: TauriState<'_, UpdaterRuntimeState>,
) -> Result<UpdaterCheckPayload, String> {
  let channel = channel
    .as_deref()
    .map(ReleaseChannel::from_str)
    .transpose()?
    .unwrap_or_default();
  let feed_url = updater_url_for_channel(channel).ok();
  let current_version = app.package_info().version.to_string();

  let Some(feed_url) = feed_url else {
    return Ok(UpdaterCheckPayload {
      enabled: false,
      current_version,
      channel: channel.as_str().to_string(),
      feed_url: None,
      available: false,
      version: None,
      body: None,
      date: None,
    });
  };

  let updater = app
    .updater_builder()
    .endpoints(vec![feed_url.clone()])
    .map_err(|error| format!("failed to configure updater endpoint: {error}"))?
    .build()
    .map_err(|error| format!("failed to create updater: {error}"))?;

  let Some(update) = updater
    .check()
    .await
    .map_err(|error| format!("failed to check for updates: {error}"))?
  else {
    emit_updater_event(
      &app,
      UpdaterEventPayload {
        state: "idle".into(),
        channel: channel.as_str().into(),
        current_version: current_version.clone(),
        version: None,
        body: None,
        date: None,
        downloaded_bytes: None,
        total_bytes: None,
        error: None,
      },
    );

    return Ok(UpdaterCheckPayload {
      enabled: true,
      current_version,
      channel: channel.as_str().to_string(),
      feed_url: Some(feed_url.to_string()),
      available: false,
      version: None,
      body: None,
      date: None,
    });
  };

  let version = update.version.clone();
  let body = update.body.clone();
  let date = update.date.map(|value| value.to_string());
  emit_updater_event(
    &app,
    UpdaterEventPayload {
      state: "downloading".into(),
      channel: channel.as_str().into(),
      current_version: current_version.clone(),
      version: Some(version.clone()),
      body: body.clone(),
      date: date.clone(),
      downloaded_bytes: Some(0),
      total_bytes: None,
      error: None,
    },
  );

  let mut downloaded_bytes = 0_u64;
  let bytes = update
    .download(
      |chunk_length, total_bytes| {
        downloaded_bytes += chunk_length as u64;
        emit_updater_event(
          &app,
          UpdaterEventPayload {
            state: "downloading".into(),
            channel: channel.as_str().into(),
            current_version: current_version.clone(),
            version: Some(version.clone()),
            body: body.clone(),
            date: date.clone(),
            downloaded_bytes: Some(downloaded_bytes),
            total_bytes,
            error: None,
          },
        );
      },
      || {},
    )
    .await
    .map_err(|error| {
      emit_updater_event(
        &app,
        UpdaterEventPayload {
          state: "error".into(),
          channel: channel.as_str().into(),
          current_version: current_version.clone(),
          version: Some(version.clone()),
          body: body.clone(),
          date: date.clone(),
          downloaded_bytes: Some(downloaded_bytes),
          total_bytes: None,
          error: Some(error.to_string()),
        },
      );
      format!("failed to download update: {error}")
    })?;

  {
    let mut pending = state.pending.lock().await;
    *pending = Some(PendingUpdate {
      channel,
      version: version.clone(),
      update,
      bytes,
    });
  }

  emit_updater_event(
    &app,
    UpdaterEventPayload {
      state: "ready_to_install".into(),
      channel: channel.as_str().into(),
      current_version: current_version.clone(),
      version: Some(version.clone()),
      body: body.clone(),
      date: date.clone(),
      downloaded_bytes: Some(downloaded_bytes),
      total_bytes: Some(downloaded_bytes),
      error: None,
    },
  );

  Ok(UpdaterCheckPayload {
    enabled: true,
    current_version,
    channel: channel.as_str().to_string(),
    feed_url: Some(feed_url.to_string()),
    available: true,
    version: Some(version),
    body,
    date,
  })
}

#[tauri::command]
async fn updater_install_ready(
  app: AppHandle,
  state: TauriState<'_, UpdaterRuntimeState>,
) -> Result<bool, String> {
  let current_version = app.package_info().version.to_string();
  let pending = {
    let mut guard = state.pending.lock().await;
    guard.take()
  };

  let Some(pending) = pending else {
    return Ok(false);
  };

  emit_updater_event(
    &app,
    UpdaterEventPayload {
      state: "installing".into(),
      channel: pending.channel.as_str().into(),
      current_version,
      version: Some(pending.version.clone()),
      body: pending.update.body.clone(),
      date: pending.update.date.map(|value| value.to_string()),
      downloaded_bytes: None,
      total_bytes: None,
      error: None,
    },
  );

  pending
    .update
    .install(&pending.bytes)
    .map_err(|error| format!("failed to install update: {error}"))?;

  Ok(true)
}

fn spawn_runtime_server(app_handle: AppHandle, shared: RuntimeServerState) {
  let http_state = HttpRuntimeState {
    app_handle,
    shared: shared.clone(),
  };

  tauri::async_runtime::spawn(async move {
    let listener = match TcpListener::bind(("127.0.0.1", shared.port)).await {
      Ok(listener) => listener,
      Err(error) => {
        log::error!("failed to bind runtime server: {}", error);
        return;
      }
    };

    {
      let mut running = shared.running.lock().await;
      *running = true;
    }

    let router = Router::new()
      .route("/", any(handle_runtime_webhook))
      .route("/*path", any(handle_runtime_webhook))
      .with_state(http_state);

    if let Err(error) = axum::serve(listener, router).await {
      log::error!("runtime server crashed: {}", error);
    }

    {
      let mut running = shared.running.lock().await;
      *running = false;
    }
  });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let runtime_state = RuntimeServerState {
        routes: Arc::new(Mutex::new(HashMap::new())),
        pending: Arc::new(Mutex::new(HashMap::new())),
        running: Arc::new(Mutex::new(false)),
        port: RUNTIME_PORT,
      };
      let updater_state = UpdaterRuntimeState {
        pending: Arc::new(Mutex::new(None)),
      };

      app.manage(runtime_state.clone());
      app.manage(updater_state);
      spawn_runtime_server(app.handle().clone(), runtime_state);
      app.handle().plugin(tauri_plugin_process::init())?;
      app.handle().plugin(
        tauri_plugin_updater::Builder::new()
          .pubkey(configured_public_key())
          .build(),
      )?;

      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      runtime_status,
      runtime_sync_webhooks,
      runtime_complete_webhook_delivery,
      updater_get_config,
      updater_check,
      updater_download,
      updater_install_ready
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
