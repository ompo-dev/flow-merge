use std::{collections::HashMap, sync::Arc};

use axum::{
  body::{Body, Bytes},
  extract::State as AxumState,
  http::{HeaderMap, Method, Response, StatusCode, Uri},
  routing::any,
  Router,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State as TauriState};
use tokio::{
  net::TcpListener,
  sync::{oneshot, Mutex},
  time::{timeout, Duration},
};

const RUNTIME_PORT: u16 = 45431;
const RUNTIME_EVENT_NAME: &str = "runtime://webhook";

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

      app.manage(runtime_state.clone());
      spawn_runtime_server(app.handle().clone(), runtime_state);

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
      runtime_complete_webhook_delivery
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
