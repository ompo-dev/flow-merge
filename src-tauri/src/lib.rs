use std::{collections::HashMap, convert::Infallible, str::FromStr, sync::Arc};

mod terminal;

use async_stream::stream;
use axum::{
  body::{Body, Bytes},
  extract::{Path, State as AxumState},
  http::{HeaderMap, Method, Response, StatusCode, Uri},
  response::{
    sse::{Event, KeepAlive, Sse},
    IntoResponse,
  },
  routing::{any, post},
  Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
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
const MCP_REQUEST_EVENT_NAME: &str = "mcp://request";
const MCP_PROTOCOL_VERSION: &str = "2025-11-25";
const MCP_FALLBACK_PROTOCOL_VERSION: &str = "2025-03-26";
const MCP_DEFAULT_SERVER_NAME: &str = "flow-merge-local";
const TERMINAL_BRIDGE_ENDPOINT_PATH: &str = "/terminal";
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
  mcp: McpServerState,
  terminal_bridge: TerminalBridgeState,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpRuntimeConfig {
  pub enabled: bool,
  pub auth_token: String,
  pub server_name: String,
}

impl Default for McpRuntimeConfig {
  fn default() -> Self {
    Self {
      enabled: false,
      auth_token: String::new(),
      server_name: MCP_DEFAULT_SERVER_NAME.to_string(),
    }
  }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpRuntimeStatus {
  pub available: bool,
  pub running: bool,
  pub port: u16,
  pub base_url: String,
  pub endpoint_url: String,
  pub enabled: bool,
  pub server_name: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpBridgeRequest {
  pub request_id: String,
  pub kind: String,
  pub payload: Option<Value>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpBridgeResponse {
  pub request_id: String,
  pub ok: bool,
  pub payload: Option<Value>,
  pub error: Option<String>,
}

#[derive(Clone)]
struct McpServerState {
  config: Arc<Mutex<McpRuntimeConfig>>,
  pending: Arc<Mutex<HashMap<String, oneshot::Sender<McpBridgeResponse>>>>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalBridgeRuntimeConfig {
  pub enabled: bool,
  pub auth_token: String,
}

impl Default for TerminalBridgeRuntimeConfig {
  fn default() -> Self {
    Self {
      enabled: false,
      auth_token: String::new(),
    }
  }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalBridgeRuntimeStatus {
  pub available: bool,
  pub running: bool,
  pub port: u16,
  pub base_url: String,
  pub endpoint_url: String,
  pub enabled: bool,
}

#[derive(Clone)]
struct TerminalBridgeState {
  config: Arc<Mutex<TerminalBridgeRuntimeConfig>>,
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

fn parse_jsonrpc_id(body: &Value) -> Option<Value> {
  body.get("id").cloned()
}

fn jsonrpc_body(value: &Value) -> Response<Body> {
  Response::builder()
    .status(StatusCode::OK)
    .header("content-type", "application/json")
    .body(Body::from(value.to_string()))
    .unwrap_or_else(|_| Response::new(Body::from(value.to_string())))
}

fn jsonrpc_success(id: Value, result: Value) -> Response<Body> {
  jsonrpc_body(&json!({
    "jsonrpc": "2.0",
    "id": id,
    "result": result,
  }))
}

fn jsonrpc_error(
  id: Option<Value>,
  code: i64,
  message: &str,
  data: Option<Value>,
  status: StatusCode,
) -> Response<Body> {
  let body = json!({
    "jsonrpc": "2.0",
    "id": id.unwrap_or(Value::Null),
    "error": {
      "code": code,
      "message": message,
      "data": data,
    }
  });

  Response::builder()
    .status(status)
    .header("content-type", "application/json")
    .body(Body::from(body.to_string()))
    .unwrap_or_else(|_| Response::new(Body::from(body.to_string())))
}

fn accepted_empty_response() -> Response<Body> {
  Response::builder()
    .status(StatusCode::ACCEPTED)
    .body(Body::empty())
    .unwrap_or_else(|_| Response::new(Body::empty()))
}

fn local_base_url(port: u16) -> String {
  format!("http://127.0.0.1:{port}")
}

fn local_mcp_url(port: u16) -> String {
  format!("{}/mcp", local_base_url(port))
}

fn local_terminal_bridge_url(port: u16) -> String {
  format!("{}{TERMINAL_BRIDGE_ENDPOINT_PATH}", local_base_url(port))
}

fn is_allowed_local_host(host: &str) -> bool {
  let without_port = host.split(':').next().unwrap_or_default().trim();
  matches!(without_port, "127.0.0.1" | "localhost")
}

fn is_allowed_origin(origin: &str) -> bool {
  let trimmed = origin.trim();
  if trimmed.is_empty() || trimmed == "null" {
    return true;
  }

  let Ok(url) = Url::parse(trimmed) else {
    return false;
  };

  // Electron / IDE fetches often use custom schemes, not http://127.0.0.1.
  match url.scheme() {
    "vscode-file" | "cursor" | "cursor-app" => return true,
    _ => {}
  }

  if let Some(host) = url.host_str() {
    if matches!(host, "127.0.0.1" | "localhost" | "[::1]") {
      return true;
    }
    if url.scheme() == "https"
      && matches!(
        host,
        "cursor.com"
          | "www.cursor.com"
          | "cursor.sh"
          | "vscode.dev"
          | "github.dev"
          | "cursorapi.com"
      )
    {
      return true;
    }
  }

  false
}

fn extract_mcp_token(uri: &Uri, headers: &HeaderMap) -> Option<String> {
  if let Some(query) = parse_query(uri) {
    if let Some(token) = query.get("token") {
      let trimmed = token.trim();
      if !trimmed.is_empty() {
        return Some(trimmed.to_string());
      }
    }
  }

  if let Some(value) = headers.get("x-flow-merge-mcp-token") {
    if let Ok(token) = value.to_str() {
      let trimmed = token.trim();
      if !trimmed.is_empty() {
        return Some(trimmed.to_string());
      }
    }
  }

  headers
    .get("authorization")
    .and_then(|value| value.to_str().ok())
    .map(|value| value.trim())
    .and_then(|value| value.strip_prefix("Bearer "))
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(str::to_string)
}

fn extract_terminal_bridge_token(uri: &Uri, headers: &HeaderMap) -> Option<String> {
  if let Some(query) = parse_query(uri) {
    if let Some(token) = query.get("token") {
      let trimmed = token.trim();
      if !trimmed.is_empty() {
        return Some(trimmed.to_string());
      }
    }
  }

  if let Some(value) = headers.get("x-flow-merge-terminal-token") {
    if let Ok(token) = value.to_str() {
      let trimmed = token.trim();
      if !trimmed.is_empty() {
        return Some(trimmed.to_string());
      }
    }
  }

  headers
    .get("authorization")
    .and_then(|value| value.to_str().ok())
    .map(|value| value.trim())
    .and_then(|value| value.strip_prefix("Bearer "))
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(str::to_string)
}

fn apply_terminal_bridge_cors_headers(response: &mut Response<Body>) {
  let headers = response.headers_mut();
  headers.insert(
    "access-control-allow-origin",
    axum::http::HeaderValue::from_static("*"),
  );
  headers.insert(
    "access-control-allow-methods",
    axum::http::HeaderValue::from_static("GET,POST,DELETE,OPTIONS"),
  );
  headers.insert(
    "access-control-allow-headers",
    axum::http::HeaderValue::from_static(
      "authorization,content-type,x-flow-merge-terminal-token",
    ),
  );
  headers.insert(
    "cache-control",
    axum::http::HeaderValue::from_static("no-store"),
  );
}

fn terminal_bridge_empty_response(status: StatusCode) -> Response<Body> {
  let mut response = Response::builder()
    .status(status)
    .body(Body::empty())
    .unwrap_or_else(|_| Response::new(Body::empty()));
  apply_terminal_bridge_cors_headers(&mut response);
  response
}

fn terminal_bridge_json_response(status: StatusCode, payload: Value) -> Response<Body> {
  let mut response = Response::builder()
    .status(status)
    .header("content-type", "application/json")
    .body(Body::from(payload.to_string()))
    .unwrap_or_else(|_| Response::new(Body::from(payload.to_string())));
  apply_terminal_bridge_cors_headers(&mut response);
  response
}

fn terminal_bridge_error_response(
  status: StatusCode,
  error_code: &str,
  message: &str,
) -> Response<Body> {
  terminal_bridge_json_response(
    status,
    json!({
      "error": error_code,
      "message": message,
    }),
  )
}

async fn mcp_runtime_status_payload(
  runtime: &RuntimeServerState,
  mcp: &McpServerState,
) -> McpRuntimeStatus {
  let running = *runtime.running.lock().await;
  let config = mcp.config.lock().await.clone();

  McpRuntimeStatus {
    available: true,
    running,
    port: runtime.port,
    base_url: local_base_url(runtime.port),
    endpoint_url: local_mcp_url(runtime.port),
    enabled: config.enabled,
    server_name: config.server_name,
  }
}

async fn terminal_bridge_runtime_status_payload(
  runtime: &RuntimeServerState,
  terminal_bridge: &TerminalBridgeState,
) -> TerminalBridgeRuntimeStatus {
  let running = *runtime.running.lock().await;
  let config = terminal_bridge.config.lock().await.clone();

  TerminalBridgeRuntimeStatus {
    available: true,
    running,
    port: runtime.port,
    base_url: local_base_url(runtime.port),
    endpoint_url: local_terminal_bridge_url(runtime.port),
    enabled: config.enabled,
  }
}

async fn validate_mcp_http_request(
  uri: &Uri,
  headers: &HeaderMap,
  runtime: &RuntimeServerState,
  mcp: &McpServerState,
) -> Option<Response<Body>> {
  if let Some(host) = headers.get("host").and_then(|value| value.to_str().ok()) {
    if !is_allowed_local_host(host) {
      return Some(jsonrpc_error(
        None,
        -32001,
        "Forbidden host",
        None,
        StatusCode::FORBIDDEN,
      ));
    }
  }

  if let Some(origin) = headers.get("origin").and_then(|value| value.to_str().ok()) {
    if !is_allowed_origin(origin) {
      return Some(jsonrpc_error(
        None,
        -32001,
        "Forbidden origin",
        None,
        StatusCode::FORBIDDEN,
      ));
    }
  }

  if let Some(protocol_version) = headers
    .get("mcp-protocol-version")
    .and_then(|value| value.to_str().ok())
  {
    if protocol_version != MCP_PROTOCOL_VERSION && protocol_version != MCP_FALLBACK_PROTOCOL_VERSION {
      return Some(jsonrpc_error(
        None,
        -32602,
        "Unsupported MCP protocol version",
        Some(json!({
          "supported": [MCP_PROTOCOL_VERSION, MCP_FALLBACK_PROTOCOL_VERSION],
          "requested": protocol_version,
        })),
        StatusCode::BAD_REQUEST,
      ));
    }
  }

  let config = mcp.config.lock().await.clone();
  if !config.enabled {
    return Some(jsonrpc_error(
      None,
      -32002,
      "Flow Merge MCP is disabled",
      None,
      StatusCode::SERVICE_UNAVAILABLE,
    ));
  }

  let token = extract_mcp_token(uri, headers);
  if token.as_deref() != Some(config.auth_token.as_str()) {
    return Some(jsonrpc_error(
      None,
      -32003,
      "Invalid MCP token",
      None,
      StatusCode::UNAUTHORIZED,
    ));
  }

  if !*runtime.running.lock().await {
    return Some(jsonrpc_error(
      None,
      -32004,
      "Flow Merge local runtime is not running",
      None,
      StatusCode::SERVICE_UNAVAILABLE,
    ));
  }

  None
}

async fn validate_terminal_bridge_http_request(
  uri: &Uri,
  headers: &HeaderMap,
  runtime: &RuntimeServerState,
  terminal_bridge: &TerminalBridgeState,
) -> Option<Response<Body>> {
  if let Some(host) = headers.get("host").and_then(|value| value.to_str().ok()) {
    if !is_allowed_local_host(host) {
      return Some(terminal_bridge_error_response(
        StatusCode::FORBIDDEN,
        "forbidden_host",
        "Forbidden host",
      ));
    }
  }

  let config = terminal_bridge.config.lock().await.clone();
  if !config.enabled {
    return Some(terminal_bridge_error_response(
      StatusCode::SERVICE_UNAVAILABLE,
      "terminal_bridge_disabled",
      "Flow Merge terminal bridge is disabled",
    ));
  }

  let token = extract_terminal_bridge_token(uri, headers);
  if token.as_deref() != Some(config.auth_token.as_str()) {
    return Some(terminal_bridge_error_response(
      StatusCode::UNAUTHORIZED,
      "invalid_terminal_bridge_token",
      "Invalid terminal bridge token",
    ));
  }

  if !*runtime.running.lock().await {
    return Some(terminal_bridge_error_response(
      StatusCode::SERVICE_UNAVAILABLE,
      "runtime_unavailable",
      "Flow Merge local runtime is not running",
    ));
  }

  None
}

fn mcp_server_capabilities() -> Value {
  json!({
    "logging": {},
    "tools": {},
    "resources": {},
    "prompts": {},
  })
}

fn mcp_server_info() -> Value {
  json!({
    "name": "flow-merge",
    "title": "Flow Merge Local MCP",
    "version": env!("CARGO_PKG_VERSION"),
    "description": "Local-first MCP server backed by the Flow Merge desktop runtime and direct workspace mutation tools.",
  })
}

fn mcp_instructions() -> String {
  "Use Flow Merge to inspect the local workspace, read workflow JSON and node catalog data, create projects or workflows when needed, and apply deterministic change sets to the same local canvas used by the desktop app. Do not route requests through the in-app AI; the MCP client should reason with its own model and use these tools directly.".to_string()
}

fn mcp_tools_list() -> Value {
  json!({
    "tools": [
      {
        "name": "flow_merge_workspace_snapshot",
        "title": "Workspace snapshot",
        "description": "Return the local Flow Merge workspace summary, active workflow, license status, and MCP availability.",
        "inputSchema": {
          "type": "object",
          "additionalProperties": false
        }
      },
      {
        "name": "flow_merge_get_node_catalog",
        "title": "Get node catalog",
        "description": "Read the local Flow Merge node catalog, including node types, schemas, config fields, and defaults.",
        "inputSchema": {
          "type": "object",
          "additionalProperties": false
        }
      },
      {
        "name": "flow_merge_get_workflow",
        "title": "Get workflow",
        "description": "Read the full JSON of the active workflow or a specific workflow by id.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "workflowId": {
              "type": "string",
              "description": "Optional workflow id. Falls back to the active workflow."
            }
          },
          "additionalProperties": false
        }
      },
      {
        "name": "flow_merge_create_project",
        "title": "Create project",
        "description": "Create a local Flow Merge project and optionally activate it in the desktop app.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "Project name."
            },
            "description": {
              "type": "string"
            },
            "accent": {
              "type": "string",
              "description": "Optional accent color, e.g. #58a6ff."
            },
            "surface": {
              "type": "string",
              "enum": ["app", "landing"]
            },
            "activate": {
              "type": "boolean",
              "description": "When false, restore the previously active project/workflow after creation."
            }
          },
          "required": ["name"],
          "additionalProperties": false
        }
      },
      {
        "name": "flow_merge_create_workflow",
        "title": "Create workflow",
        "description": "Create a workflow in the target project and optionally activate it in the desktop app.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "Workflow name."
            },
            "projectId": {
              "type": "string",
              "description": "Optional target project id. Defaults to the active project."
            },
            "description": {
              "type": "string"
            },
            "accent": {
              "type": "string"
            },
            "surface": {
              "type": "string",
              "enum": ["app", "landing"]
            },
            "tags": {
              "type": "array",
              "items": { "type": "string" }
            },
            "activate": {
              "type": "boolean",
              "description": "When false, restore the previously active project/workflow after creation."
            }
          },
          "required": ["name"],
          "additionalProperties": false
        }
      },
      {
        "name": "flow_merge_apply_workspace_change_set",
        "title": "Apply workspace change set",
        "description": "Apply deterministic project, workflow, and canvas-tool mutations directly to the local Flow Merge workspace.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "operations": {
              "type": "array",
              "description": "Ordered workspace operations. Supported types: update_project, toggle_project_active, delete_project, duplicate_project, update_workflow, toggle_workflow_active, delete_workflow, duplicate_workflow, set_active_project, set_active_tool."
            }
          },
          "required": ["operations"],
          "additionalProperties": false
        }
      },
      {
        "name": "flow_merge_set_active_workflow",
        "title": "Set active workflow",
        "description": "Switch the active project and workflow inside the local Flow Merge desktop app.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "workflowId": {
              "type": "string",
              "description": "Workflow id to activate."
            }
          },
          "required": ["workflowId"],
          "additionalProperties": false
        }
      },
      {
        "name": "flow_merge_apply_workflow_change_set",
        "title": "Apply workflow change set",
        "description": "Apply a deterministic batch of node and edge mutations directly to a local Flow Merge workflow.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "workflowId": {
              "type": "string",
              "description": "Optional target workflow id. Defaults to the active workflow."
            },
            "activate": {
              "type": "boolean",
              "description": "When false, Flow Merge restores the previously active workflow after applying the change set."
            },
              "workflowPatch": {
                "type": "object",
                "description": "Optional workflow metadata patch. Supports name, description, accent, surface, tags, and active."
              },
              "operations": {
                "type": "array",
                "description": "Ordered operations. Supported types: create_node, create_shape, update_node, move_node, resize_node, duplicate_node, delete_node, create_edge, delete_edge. create_node accepts nodeType, optional alias, optional position {x,y}, and optional data. create_shape accepts shapeType plus optional size, text, fill, and strokeColor. update, move, resize, duplicate, and delete operations reference nodes with node { nodeId | alias | label }. create_edge uses source and target references. delete_edge accepts edgeId or source/target references."
              }
            },
            "required": ["operations"],
            "additionalProperties": false
          }
      }
    ]
  })
}

fn mcp_resources_list() -> Value {
  json!({
    "resources": [
      {
        "uri": "flowmerge://workspace/snapshot",
        "name": "workspace-snapshot",
        "title": "Workspace snapshot",
        "description": "Resumo do workspace local do Flow Merge.",
        "mimeType": "application/json"
      },
      {
        "uri": "flowmerge://license/status",
        "name": "license-status",
        "title": "License status",
        "description": "Estado comercial e de acesso da conta autenticada.",
        "mimeType": "application/json"
      },
      {
        "uri": "flowmerge://workflow/active",
        "name": "active-workflow",
        "title": "Active workflow",
        "description": "JSON do workflow atualmente ativo.",
        "mimeType": "application/json"
      },
        {
          "uri": "flowmerge://catalog/nodes",
          "name": "node-catalog",
          "title": "Node catalog",
          "description": "Catalogo local de node types, schemas, config fields e defaults do Flow Merge.",
          "mimeType": "application/json"
        },
        {
          "uri": "flowmerge://canvas/tools",
          "name": "canvas-tools",
          "title": "Canvas tools",
          "description": "Ferramentas de desenho e edicao do canvas local.",
          "mimeType": "application/json"
        }
      ]
    })
  }

fn mcp_resource_templates_list() -> Value {
  json!({
    "resourceTemplates": [
      {
        "uriTemplate": "flowmerge://workflow/{workflowId}",
        "name": "workflow-by-id",
        "title": "Workflow by id",
        "description": "Leia qualquer workflow local do Flow Merge pelo id.",
        "mimeType": "application/json"
      }
    ]
  })
}

fn mcp_prompts_list() -> Value {
  json!({
    "prompts": [
      {
        "name": "build_local_workflow",
        "title": "Build local workflow",
        "description": "Guide the MCP client to inspect the workspace and apply a deterministic change set in Flow Merge.",
        "arguments": [
          {
            "name": "goal",
            "description": "Desired workflow outcome or operator loop.",
            "required": true
          }
        ]
      },
      {
        "name": "analyze_active_workflow",
        "title": "Analyze active workflow",
        "description": "Ask Flow Merge to inspect the active workflow and explain the operational impact."
      },
      {
        "name": "integrate_project_signal",
        "title": "Integrate project signal",
        "description": "Guide the MCP client to connect a signal from the current codebase to the local canvas using direct tools.",
        "arguments": [
          {
            "name": "signal",
            "description": "The signal or source to integrate, e.g. funnel events, errors, churn markers.",
            "required": true
          }
        ]
      }
    ]
  })
}

fn mcp_prompt_result(name: &str, arguments: Option<&Value>) -> Option<Value> {
  match name {
      "build_local_workflow" => {
        let goal = arguments
          .and_then(|value| value.get("goal"))
          .and_then(Value::as_str)
          .unwrap_or("um novo workflow no canvas");

      Some(json!({
        "description": "Build a local Flow Merge workflow",
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": format!("Monte um workflow local no Flow Merge para {}. Primeiro leia o workspace snapshot, as canvas tools e o catalogo de nodes. Se necessario, crie projeto ou workflow com um workspace change set. Depois use apenas as ferramentas deterministicas do MCP para aplicar um workflow change set no canvas local.", goal)
              }
            }
          ]
        }))
      }
    "analyze_active_workflow" => Some(json!({
      "description": "Analyze the active Flow Merge workflow",
        "messages": [
          {
            "role": "user",
            "content": {
              "type": "text",
              "text": "Leia o workflow ativo do Flow Merge e explique o que ele mede ou executa. Identifique gaps e proponha a proxima acao operacional. Se for necessario mudar o canvas, descreva o change set antes de aplica-lo com as ferramentas deterministicas."
            }
          }
        ]
      })),
    "integrate_project_signal" => {
      let signal = arguments
        .and_then(|value| value.get("signal"))
        .and_then(Value::as_str)
        .unwrap_or("um sinal do projeto atual");

      Some(json!({
        "description": "Integrate a project signal into Flow Merge",
          "messages": [
            {
              "role": "user",
              "content": {
                "type": "text",
                "text": format!("Use o workspace atual do Flow Merge para integrar {} ao canvas local. Leia o snapshot do workspace, as canvas tools e o catalogo de nodes, escolha o workflow certo e aplique change sets deterministicos para criar ou ajustar o fluxo.", signal)
              }
            }
          ]
        }))
    }
    _ => None,
  }
}

async fn dispatch_mcp_bridge_request(
  app: &AppHandle,
  state: &McpServerState,
  kind: &str,
  payload: Value,
) -> Result<Value, String> {
  let request_id = uuid::Uuid::new_v4().to_string();
  let request = McpBridgeRequest {
    request_id: request_id.clone(),
    kind: kind.to_string(),
    payload: Some(payload),
  };
  let (sender, receiver) = oneshot::channel::<McpBridgeResponse>();

  {
    let mut pending = state.pending.lock().await;
    pending.insert(request_id.clone(), sender);
  }

  if let Err(error) = app.emit(MCP_REQUEST_EVENT_NAME, &request) {
    let mut pending = state.pending.lock().await;
    pending.remove(&request_id);
    return Err(format!("failed to emit MCP request: {error}"));
  }

  match timeout(Duration::from_secs(120), receiver).await {
    Ok(Ok(response)) => {
      if response.ok {
        Ok(response.payload.unwrap_or_else(|| json!({})))
      } else {
        Err(response
          .error
          .unwrap_or_else(|| "Flow Merge MCP bridge returned an unknown error.".to_string()))
      }
    }
    Ok(Err(_)) => Err("Flow Merge MCP bridge dropped the request.".to_string()),
    Err(_) => {
      let mut pending = state.pending.lock().await;
      pending.remove(&request_id);
      Err("Flow Merge MCP bridge timed out.".to_string())
    }
  }
}

  fn tool_result_text(name: &str, payload: &Value) -> String {
    match name {
    "flow_merge_apply_workspace_change_set" => {
      let updated_projects = payload
        .get("updatedProjectIds")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
      let duplicated_projects = payload
        .get("duplicatedProjectIds")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
      let updated_workflows = payload
        .get("updatedWorkflowIds")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
      let duplicated_workflows = payload
        .get("duplicatedWorkflowIds")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
      let active_tool = payload
        .get("activeTool")
        .and_then(Value::as_str)
        .unwrap_or("select");

      format!(
        "Workspace change set aplicado no Flow Merge.\n\nProjetos atualizados: {updated_projects}\nProjetos duplicados: {duplicated_projects}\nWorkflows atualizados: {updated_workflows}\nWorkflows duplicados: {duplicated_workflows}\nFerramenta ativa: {active_tool}"
      )
    }
    "flow_merge_apply_workflow_change_set" => {
        let workflow_id = payload
          .get("workflowId")
          .and_then(Value::as_str)
          .unwrap_or("active workflow");
      let created = payload
        .get("createdNodes")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
      let edges = payload
        .get("createdEdgeCount")
        .and_then(Value::as_u64)
        .unwrap_or(0);
      let updated = payload
        .get("updatedNodeIds")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);
      let deleted = payload
        .get("deletedNodeIds")
        .and_then(Value::as_array)
        .map(Vec::len)
        .unwrap_or(0);

        format!(
          "Change set aplicado no Flow Merge.\n\nWorkflow alvo: {workflow_id}\nNodes criados: {created}\nNodes atualizados: {updated}\nNodes removidos: {deleted}\nEdges criadas: {edges}"
        )
      }
    "flow_merge_create_project" => {
      let project_name = payload
        .get("project")
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("novo projeto");
      let workflow_name = payload
        .get("defaultWorkflow")
        .and_then(|value| value.get("name"))
        .and_then(Value::as_str)
        .unwrap_or("workflow inicial");

      format!("Projeto criado no Flow Merge: {project_name}\nWorkflow inicial: {workflow_name}")
    }
    "flow_merge_create_workflow" => {
      let workflow_name = payload
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or("novo workflow");
      let project_id = payload
        .get("projectId")
        .and_then(Value::as_str)
        .unwrap_or("projeto ativo");

      format!("Workflow criado no Flow Merge: {workflow_name}\nProjeto: {project_id}")
    }
    _ => serde_json::to_string_pretty(payload).unwrap_or_else(|_| payload.to_string()),
  }
}

fn parse_terminal_bridge_request_body<T: for<'de> Deserialize<'de>>(
  body: &Bytes,
) -> Result<T, Response<Body>> {
  serde_json::from_slice(body).map_err(|error| {
    terminal_bridge_error_response(
      StatusCode::BAD_REQUEST,
      "invalid_terminal_payload",
      &format!("Invalid terminal payload: {error}"),
    )
  })
}

fn terminal_query_value(uri: &Uri, key: &str) -> Option<String> {
  parse_query(uri).and_then(|query| query.get(key).cloned())
}

fn terminal_required_query_value(uri: &Uri, key: &str) -> Result<String, Response<Body>> {
  terminal_query_value(uri, key).ok_or_else(|| {
    terminal_bridge_error_response(
      StatusCode::BAD_REQUEST,
      "missing_query_param",
      &format!("Missing query param: {key}"),
    )
  })
}

async fn handle_terminal_bridge_status(
  AxumState(state): AxumState<HttpRuntimeState>,
  method: Method,
) -> Response<Body> {
  if method == Method::OPTIONS {
    return terminal_bridge_empty_response(StatusCode::NO_CONTENT);
  }

  if method != Method::GET {
    return terminal_bridge_error_response(
      StatusCode::METHOD_NOT_ALLOWED,
      "method_not_allowed",
      "Use GET for terminal bridge status.",
    );
  }

  terminal_bridge_json_response(
    StatusCode::OK,
    serde_json::to_value(
      terminal_bridge_runtime_status_payload(&state.shared, &state.terminal_bridge).await,
    )
    .unwrap_or_else(|_| json!({ "available": false })),
  )
}

async fn handle_terminal_bridge_sessions(
  AxumState(state): AxumState<HttpRuntimeState>,
  method: Method,
  uri: Uri,
  headers: HeaderMap,
  body: Bytes,
) -> Response<Body> {
  if method == Method::OPTIONS {
    return terminal_bridge_empty_response(StatusCode::NO_CONTENT);
  }

  if let Some(response) = validate_terminal_bridge_http_request(
    &uri,
    &headers,
    &state.shared,
    &state.terminal_bridge,
  )
  .await
  {
    return response;
  }

  match method {
    Method::GET => {
      let project_id = terminal_query_value(&uri, "projectId");
      match terminal::terminal_list_sessions_internal(
        project_id,
        state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
      ) {
        Ok(sessions) => terminal_bridge_json_response(
          StatusCode::OK,
          serde_json::to_value(sessions).unwrap_or_else(|_| json!([])),
        ),
        Err(error) => terminal_bridge_error_response(
          StatusCode::INTERNAL_SERVER_ERROR,
          "terminal_list_failed",
          &error,
        ),
      }
    }
    Method::POST => {
      let input = match parse_terminal_bridge_request_body::<terminal::TerminalOpenSessionInput>(&body) {
        Ok(input) => input,
        Err(response) => return response,
      };

      match terminal::terminal_open_session_internal(
        input,
        &state.app_handle,
        state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
      ) {
        Ok(snapshot) => terminal_bridge_json_response(
          StatusCode::OK,
          serde_json::to_value(snapshot).unwrap_or_else(|_| json!({})),
        ),
        Err(error) => terminal_bridge_error_response(
          StatusCode::BAD_REQUEST,
          "terminal_open_failed",
          &error,
        ),
      }
    }
    _ => terminal_bridge_error_response(
      StatusCode::METHOD_NOT_ALLOWED,
      "method_not_allowed",
      "Use GET or POST on /terminal/sessions.",
    ),
  }
}

async fn handle_terminal_bridge_session(
  AxumState(state): AxumState<HttpRuntimeState>,
  Path(session_id): Path<String>,
  method: Method,
  uri: Uri,
  headers: HeaderMap,
) -> Response<Body> {
  if method == Method::OPTIONS {
    return terminal_bridge_empty_response(StatusCode::NO_CONTENT);
  }

  if let Some(response) = validate_terminal_bridge_http_request(
    &uri,
    &headers,
    &state.shared,
    &state.terminal_bridge,
  )
  .await
  {
    return response;
  }

  let project_id = match terminal_required_query_value(&uri, "projectId") {
    Ok(project_id) => project_id,
    Err(response) => return response,
  };
  let input = terminal::TerminalAttachSessionInput {
    project_id,
    session_id,
  };

  match method {
    Method::GET => match terminal::terminal_attach_session_internal(
      input,
      state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
    ) {
      Ok(snapshot) => terminal_bridge_json_response(
        StatusCode::OK,
        serde_json::to_value(snapshot).unwrap_or_else(|_| json!({})),
      ),
      Err(error) => terminal_bridge_error_response(
        StatusCode::NOT_FOUND,
        "terminal_session_not_found",
        &error,
      ),
    },
    Method::DELETE => match terminal::terminal_close_session_internal(
      input,
      state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
    ) {
      Ok(snapshot) => terminal_bridge_json_response(
        StatusCode::OK,
        serde_json::to_value(snapshot).unwrap_or_else(|_| json!({})),
      ),
      Err(error) => terminal_bridge_error_response(
        StatusCode::BAD_REQUEST,
        "terminal_close_failed",
        &error,
      ),
    },
    _ => terminal_bridge_error_response(
      StatusCode::METHOD_NOT_ALLOWED,
      "method_not_allowed",
      "Use GET or DELETE on /terminal/sessions/{sessionId}.",
    ),
  }
}

async fn handle_terminal_bridge_input(
  AxumState(state): AxumState<HttpRuntimeState>,
  Path(session_id): Path<String>,
  method: Method,
  uri: Uri,
  headers: HeaderMap,
  body: Bytes,
) -> Response<Body> {
  if method == Method::OPTIONS {
    return terminal_bridge_empty_response(StatusCode::NO_CONTENT);
  }

  if method != Method::POST {
    return terminal_bridge_error_response(
      StatusCode::METHOD_NOT_ALLOWED,
      "method_not_allowed",
      "Use POST on /terminal/sessions/{sessionId}/input.",
    );
  }

  if let Some(response) = validate_terminal_bridge_http_request(
    &uri,
    &headers,
    &state.shared,
    &state.terminal_bridge,
  )
  .await
  {
    return response;
  }

  let mut input = match parse_terminal_bridge_request_body::<terminal::TerminalWriteInput>(&body) {
    Ok(input) => input,
    Err(response) => return response,
  };
  input.session_id = session_id;

  match terminal::terminal_write_input_internal(
    input,
    state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
  ) {
    Ok(snapshot) => terminal_bridge_json_response(
      StatusCode::OK,
      serde_json::to_value(snapshot).unwrap_or_else(|_| json!({})),
    ),
    Err(error) => terminal_bridge_error_response(
      StatusCode::BAD_REQUEST,
      "terminal_input_failed",
      &error,
    ),
  }
}

async fn handle_terminal_bridge_resize(
  AxumState(state): AxumState<HttpRuntimeState>,
  Path(session_id): Path<String>,
  method: Method,
  uri: Uri,
  headers: HeaderMap,
  body: Bytes,
) -> Response<Body> {
  if method == Method::OPTIONS {
    return terminal_bridge_empty_response(StatusCode::NO_CONTENT);
  }

  if method != Method::POST {
    return terminal_bridge_error_response(
      StatusCode::METHOD_NOT_ALLOWED,
      "method_not_allowed",
      "Use POST on /terminal/sessions/{sessionId}/resize.",
    );
  }

  if let Some(response) = validate_terminal_bridge_http_request(
    &uri,
    &headers,
    &state.shared,
    &state.terminal_bridge,
  )
  .await
  {
    return response;
  }

  let mut input = match parse_terminal_bridge_request_body::<terminal::TerminalResizeInput>(&body) {
    Ok(input) => input,
    Err(response) => return response,
  };
  input.session_id = session_id;

  match terminal::terminal_resize_session_internal(
    input,
    state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
  ) {
    Ok(snapshot) => terminal_bridge_json_response(
      StatusCode::OK,
      serde_json::to_value(snapshot).unwrap_or_else(|_| json!({})),
    ),
    Err(error) => terminal_bridge_error_response(
      StatusCode::BAD_REQUEST,
      "terminal_resize_failed",
      &error,
    ),
  }
}

async fn handle_terminal_bridge_signal(
  AxumState(state): AxumState<HttpRuntimeState>,
  Path(session_id): Path<String>,
  method: Method,
  uri: Uri,
  headers: HeaderMap,
  body: Bytes,
) -> Response<Body> {
  if method == Method::OPTIONS {
    return terminal_bridge_empty_response(StatusCode::NO_CONTENT);
  }

  if method != Method::POST {
    return terminal_bridge_error_response(
      StatusCode::METHOD_NOT_ALLOWED,
      "method_not_allowed",
      "Use POST on /terminal/sessions/{sessionId}/signal.",
    );
  }

  if let Some(response) = validate_terminal_bridge_http_request(
    &uri,
    &headers,
    &state.shared,
    &state.terminal_bridge,
  )
  .await
  {
    return response;
  }

  let mut input = match parse_terminal_bridge_request_body::<terminal::TerminalSignalInput>(&body) {
    Ok(input) => input,
    Err(response) => return response,
  };
  input.session_id = session_id;

  match terminal::terminal_send_signal_internal(
    input,
    state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
  ) {
    Ok(snapshot) => terminal_bridge_json_response(
      StatusCode::OK,
      serde_json::to_value(snapshot).unwrap_or_else(|_| json!({})),
    ),
    Err(error) => terminal_bridge_error_response(
      StatusCode::BAD_REQUEST,
      "terminal_signal_failed",
      &error,
    ),
  }
}

async fn handle_terminal_bridge_stream(
  AxumState(state): AxumState<HttpRuntimeState>,
  Path(session_id): Path<String>,
  method: Method,
  uri: Uri,
  headers: HeaderMap,
) -> Response<Body> {
  if method == Method::OPTIONS {
    return terminal_bridge_empty_response(StatusCode::NO_CONTENT);
  }

  if method != Method::GET {
    return terminal_bridge_error_response(
      StatusCode::METHOD_NOT_ALLOWED,
      "method_not_allowed",
      "Use GET on /terminal/sessions/{sessionId}/stream.",
    );
  }

  if let Some(response) = validate_terminal_bridge_http_request(
    &uri,
    &headers,
    &state.shared,
    &state.terminal_bridge,
  )
  .await
  {
    return response;
  }

  let project_id = match terminal_required_query_value(&uri, "projectId") {
    Ok(project_id) => project_id,
    Err(response) => return response,
  };

  let (snapshot, mut receiver) = match terminal::terminal_subscribe_session(
    &project_id,
    &session_id,
    state.app_handle.state::<terminal::TerminalRuntimeState>().inner(),
  ) {
    Ok(result) => result,
    Err(error) => {
      return terminal_bridge_error_response(
        StatusCode::NOT_FOUND,
        "terminal_stream_not_found",
        &error,
      );
    }
  };

  let event_stream = stream! {
    if let Ok(event) = Event::default().event("snapshot").json_data(snapshot) {
      yield Ok::<Event, Infallible>(event);
    }

    loop {
      match receiver.recv().await {
        Ok(output_event) => {
          if let Ok(event) = Event::default()
            .event(output_event.channel.as_str())
            .json_data(output_event)
          {
            yield Ok::<Event, Infallible>(event);
          }
        }
        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
      }
    }
  };

  let sse = Sse::new(event_stream).keep_alive(KeepAlive::default());
  let mut response = sse.into_response();
  apply_terminal_bridge_cors_headers(&mut response);
  response
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

async fn handle_mcp_get(
  AxumState(state): AxumState<HttpRuntimeState>,
  headers: HeaderMap,
  uri: Uri,
) -> Response<Body> {
  if let Some(response) =
    validate_mcp_http_request(&uri, &headers, &state.shared, &state.mcp).await
  {
    return response;
  }

  jsonrpc_error(
    None,
    -32005,
    "This Flow Merge MCP endpoint only supports POST for stateless requests.",
    None,
    StatusCode::METHOD_NOT_ALLOWED,
  )
}

async fn handle_mcp_delete(
  AxumState(state): AxumState<HttpRuntimeState>,
  headers: HeaderMap,
  uri: Uri,
) -> Response<Body> {
  if let Some(response) =
    validate_mcp_http_request(&uri, &headers, &state.shared, &state.mcp).await
  {
    return response;
  }

  Response::builder()
    .status(StatusCode::METHOD_NOT_ALLOWED)
    .body(Body::empty())
    .unwrap_or_else(|_| Response::new(Body::empty()))
}

async fn handle_mcp_post(
  AxumState(state): AxumState<HttpRuntimeState>,
  headers: HeaderMap,
  uri: Uri,
  body: Bytes,
) -> Response<Body> {
  if let Some(response) =
    validate_mcp_http_request(&uri, &headers, &state.shared, &state.mcp).await
  {
    return response;
  }

  let parsed_body = match serde_json::from_slice::<Value>(&body) {
    Ok(value) => value,
    Err(error) => {
      return jsonrpc_error(
        None,
        -32700,
        "Invalid JSON payload",
        Some(json!({ "error": error.to_string() })),
        StatusCode::BAD_REQUEST,
      );
    }
  };

  let id = parse_jsonrpc_id(&parsed_body);
  let method = parsed_body
    .get("method")
    .and_then(Value::as_str)
    .unwrap_or_default();
  let params = parsed_body.get("params").cloned().unwrap_or_else(|| json!({}));

  match method {
    "initialize" => {
      let requested_protocol = params
        .get("protocolVersion")
        .and_then(Value::as_str)
        .unwrap_or(MCP_PROTOCOL_VERSION);
      let negotiated_protocol = if requested_protocol == MCP_PROTOCOL_VERSION
        || requested_protocol == MCP_FALLBACK_PROTOCOL_VERSION
      {
        requested_protocol
      } else {
        MCP_PROTOCOL_VERSION
      };

      let result = json!({
        "protocolVersion": negotiated_protocol,
        "capabilities": mcp_server_capabilities(),
        "serverInfo": mcp_server_info(),
        "instructions": mcp_instructions(),
      });

      jsonrpc_success(id.unwrap_or_else(|| Value::Null), result)
    }
    "notifications/initialized" => accepted_empty_response(),
    "ping" => jsonrpc_success(id.unwrap_or_else(|| Value::Null), json!({})),
    "tools/list" => jsonrpc_success(id.unwrap_or_else(|| Value::Null), mcp_tools_list()),
    "resources/list" => {
      jsonrpc_success(id.unwrap_or_else(|| Value::Null), mcp_resources_list())
    }
    "resources/templates/list" => jsonrpc_success(
      id.unwrap_or_else(|| Value::Null),
      mcp_resource_templates_list(),
    ),
    "prompts/list" => jsonrpc_success(id.unwrap_or_else(|| Value::Null), mcp_prompts_list()),
    "prompts/get" => {
      let Some(name) = params.get("name").and_then(Value::as_str) else {
        return jsonrpc_error(
          id,
          -32602,
          "Prompt name is required",
          None,
          StatusCode::BAD_REQUEST,
        );
      };

      match mcp_prompt_result(name, params.get("arguments")) {
        Some(result) => jsonrpc_success(parse_jsonrpc_id(&parsed_body).unwrap_or(Value::Null), result),
        None => jsonrpc_error(
          parse_jsonrpc_id(&parsed_body),
          -32602,
          "Unknown prompt",
          None,
          StatusCode::BAD_REQUEST,
        ),
      }
    }
    "resources/read" => {
      let Some(uri) = params.get("uri").and_then(Value::as_str) else {
        return jsonrpc_error(
          id,
          -32602,
          "Resource uri is required",
          None,
          StatusCode::BAD_REQUEST,
        );
      };

      match dispatch_mcp_bridge_request(
        &state.app_handle,
        &state.mcp,
        "read_resource",
        json!({ "uri": uri }),
      )
      .await
      {
        Ok(result) => jsonrpc_success(parse_jsonrpc_id(&parsed_body).unwrap_or(Value::Null), result),
        Err(error) => jsonrpc_error(
          parse_jsonrpc_id(&parsed_body),
          -32010,
          &error,
          None,
          StatusCode::BAD_REQUEST,
        ),
      }
    }
    "tools/call" => {
      let Some(name) = params.get("name").and_then(Value::as_str) else {
        return jsonrpc_error(
          id,
          -32602,
          "Tool name is required",
          None,
          StatusCode::BAD_REQUEST,
        );
      };

      let bridge_result = match name {
        "flow_merge_workspace_snapshot" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "get_workspace_snapshot",
            json!({}),
          )
          .await
        }
        "flow_merge_get_node_catalog" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "get_node_catalog",
            json!({}),
          )
          .await
        }
        "flow_merge_get_workflow" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "get_workflow",
            params.get("arguments").cloned().unwrap_or_else(|| json!({})),
          )
          .await
        }
        "flow_merge_create_project" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "create_project",
            params.get("arguments").cloned().unwrap_or_else(|| json!({})),
          )
          .await
        }
        "flow_merge_create_workflow" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "create_workflow",
            params.get("arguments").cloned().unwrap_or_else(|| json!({})),
          )
          .await
        }
        "flow_merge_apply_workspace_change_set" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "apply_workspace_change_set",
            params.get("arguments").cloned().unwrap_or_else(|| json!({})),
          )
          .await
        }
        "flow_merge_set_active_workflow" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "set_active_workflow",
            params.get("arguments").cloned().unwrap_or_else(|| json!({})),
          )
          .await
        }
        "flow_merge_apply_workflow_change_set" => {
          dispatch_mcp_bridge_request(
            &state.app_handle,
            &state.mcp,
            "apply_workflow_change_set",
            params.get("arguments").cloned().unwrap_or_else(|| json!({})),
          )
          .await
        }
        _ => Err("Unknown Flow Merge MCP tool.".to_string()),
      };

      match bridge_result {
        Ok(payload) => jsonrpc_success(
          parse_jsonrpc_id(&parsed_body).unwrap_or(Value::Null),
          json!({
            "content": [
              {
                "type": "text",
                "text": tool_result_text(name, &payload)
              }
            ],
            "structuredContent": payload
          }),
        ),
        Err(error) => jsonrpc_success(
          parse_jsonrpc_id(&parsed_body).unwrap_or(Value::Null),
          json!({
            "content": [
              {
                "type": "text",
                "text": format!("Error: {error}")
              }
            ],
            "isError": true
          }),
        ),
      }
    }
    _ if id.is_none() => accepted_empty_response(),
    _ => jsonrpc_error(
      id,
      -32601,
      "Method not found",
      Some(json!({ "method": method })),
      StatusCode::BAD_REQUEST,
    ),
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
async fn mcp_status(
  runtime: TauriState<'_, RuntimeServerState>,
  mcp: TauriState<'_, McpServerState>,
) -> Result<McpRuntimeStatus, String> {
  Ok(mcp_runtime_status_payload(&runtime, &mcp).await)
}

#[tauri::command]
async fn mcp_configure(
  config: McpRuntimeConfig,
  runtime: TauriState<'_, RuntimeServerState>,
  mcp: TauriState<'_, McpServerState>,
) -> Result<McpRuntimeStatus, String> {
  let next = McpRuntimeConfig {
    enabled: config.enabled,
    auth_token: config.auth_token.trim().to_string(),
    server_name: if config.server_name.trim().is_empty() {
      MCP_DEFAULT_SERVER_NAME.to_string()
    } else {
      config.server_name.trim().to_string()
    },
  };

  let mut shared = mcp.config.lock().await;
  *shared = next;
  drop(shared);

  Ok(mcp_runtime_status_payload(&runtime, &mcp).await)
}

#[tauri::command]
async fn terminal_bridge_status(
  runtime: TauriState<'_, RuntimeServerState>,
  terminal_bridge: TauriState<'_, TerminalBridgeState>,
) -> Result<TerminalBridgeRuntimeStatus, String> {
  Ok(terminal_bridge_runtime_status_payload(&runtime, &terminal_bridge).await)
}

#[tauri::command]
async fn terminal_bridge_configure(
  config: TerminalBridgeRuntimeConfig,
  runtime: TauriState<'_, RuntimeServerState>,
  terminal_bridge: TauriState<'_, TerminalBridgeState>,
) -> Result<TerminalBridgeRuntimeStatus, String> {
  let next = TerminalBridgeRuntimeConfig {
    enabled: config.enabled,
    auth_token: config.auth_token.trim().to_string(),
  };

  let mut shared = terminal_bridge.config.lock().await;
  *shared = next;
  drop(shared);

  Ok(terminal_bridge_runtime_status_payload(&runtime, &terminal_bridge).await)
}

#[tauri::command]
async fn mcp_complete_request(
  response: McpBridgeResponse,
  mcp: TauriState<'_, McpServerState>,
) -> Result<bool, String> {
  let sender = {
    let mut pending = mcp.pending.lock().await;
    pending.remove(&response.request_id)
  };

  if let Some(sender) = sender {
    sender
      .send(response)
      .map_err(|_| "failed to complete MCP request".to_string())?;
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
  let mcp_state = app_handle.state::<McpServerState>().inner().clone();
  let terminal_bridge_state = app_handle.state::<TerminalBridgeState>().inner().clone();
  let http_state = HttpRuntimeState {
    app_handle,
    shared: shared.clone(),
    mcp: mcp_state,
    terminal_bridge: terminal_bridge_state,
  };

  tauri::async_runtime::spawn(async move {
    let listener = match TcpListener::bind(("127.0.0.1", shared.port)).await {
      Ok(listener) => listener,
      Err(error) => {
        log::error!("failed to bind runtime server: {}", error);
        return;
      }
    };

    let router = Router::new()
      .route("/mcp", post(handle_mcp_post).get(handle_mcp_get).delete(handle_mcp_delete))
      .route("/terminal/status", any(handle_terminal_bridge_status))
      .route("/terminal/sessions", any(handle_terminal_bridge_sessions))
      .route("/terminal/sessions/{sessionId}", any(handle_terminal_bridge_session))
      .route("/terminal/sessions/{sessionId}/input", any(handle_terminal_bridge_input))
      .route("/terminal/sessions/{sessionId}/resize", any(handle_terminal_bridge_resize))
      .route("/terminal/sessions/{sessionId}/signal", any(handle_terminal_bridge_signal))
      .route("/terminal/sessions/{sessionId}/stream", any(handle_terminal_bridge_stream))
      .route("/", any(handle_runtime_webhook))
      .route("/{*path}", any(handle_runtime_webhook))
      .with_state(http_state);

    {
      let mut running = shared.running.lock().await;
      *running = true;
    }

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
      let mcp_state = McpServerState {
        config: Arc::new(Mutex::new(McpRuntimeConfig::default())),
        pending: Arc::new(Mutex::new(HashMap::new())),
      };
      let terminal_bridge_state = TerminalBridgeState {
        config: Arc::new(Mutex::new(TerminalBridgeRuntimeConfig::default())),
      };

      app.manage(runtime_state.clone());
      app.manage(updater_state);
      app.manage(mcp_state);
      app.manage(terminal_bridge_state);
      app.manage(terminal::TerminalRuntimeState::default());
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
      mcp_status,
      mcp_configure,
      terminal_bridge_status,
      terminal_bridge_configure,
      mcp_complete_request,
      terminal::terminal_open_session,
      terminal::terminal_attach_session,
      terminal::terminal_list_sessions,
      terminal::terminal_write_input,
      terminal::terminal_resize_session,
      terminal::terminal_send_signal,
      terminal::terminal_close_session,
      updater_get_config,
      updater_check,
      updater_download,
      updater_install_ready
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
