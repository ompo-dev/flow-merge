use std::{
  collections::HashMap,
  io::{Read, Write},
  sync::{Arc, Mutex},
  thread,
  time::{SystemTime, UNIX_EPOCH},
};

use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State as TauriState};
use tokio::sync::broadcast;

pub const TERMINAL_EVENT_NAME: &str = "terminal://output";
const TERMINAL_PROMPT_MARKER: &str = "__FLOW_MERGE_PROMPT__:";
const MAX_TERMINAL_OUTPUT_BYTES: usize = 400_000;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalSessionShell {
  Cmd,
  Powershell,
  Bash,
  Zsh,
}

impl TerminalSessionShell {
  fn default_for_platform() -> Self {
    if cfg!(windows) {
      Self::Powershell
    } else {
      Self::Bash
    }
  }

  fn from_optional(value: Option<Self>) -> Self {
    value.unwrap_or_else(Self::default_for_platform)
  }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalSessionStatus {
  Idle,
  Running,
  Exited,
  Error,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TerminalSignal {
  Sigint,
  Eof,
  Kill,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSessionSnapshot {
  pub id: String,
  pub project_id: String,
  pub shell: TerminalSessionShell,
  pub working_directory: String,
  pub status: TerminalSessionStatus,
  pub output: String,
  pub prompt_marker: String,
  pub created_at: String,
  pub updated_at: String,
  pub exit_code: Option<i32>,
  pub cols: u16,
  pub rows: u16,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOutputEvent {
  pub id: String,
  pub project_id: String,
  pub shell: TerminalSessionShell,
  pub working_directory: String,
  pub status: TerminalSessionStatus,
  pub output: String,
  pub prompt_marker: String,
  pub created_at: String,
  pub updated_at: String,
  pub exit_code: Option<i32>,
  pub cols: u16,
  pub rows: u16,
  pub channel: String,
  pub chunk: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalOpenSessionInput {
  pub project_id: String,
  pub session_id: Option<String>,
  pub shell: Option<TerminalSessionShell>,
  pub working_directory: Option<String>,
  pub cols: Option<u16>,
  pub rows: Option<u16>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalAttachSessionInput {
  pub project_id: String,
  pub session_id: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalWriteInput {
  pub project_id: String,
  pub session_id: String,
  pub data: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalResizeInput {
  pub project_id: String,
  pub session_id: String,
  pub cols: u16,
  pub rows: u16,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalSignalInput {
  pub project_id: String,
  pub session_id: String,
  pub signal: TerminalSignal,
}

struct TerminalSessionRecord {
  id: String,
  project_id: String,
  shell: TerminalSessionShell,
  working_directory: String,
  status: TerminalSessionStatus,
  output: String,
  created_at: String,
  updated_at: String,
  exit_code: Option<i32>,
  cols: u16,
  rows: u16,
  prompt_marker: String,
  master: Box<dyn portable_pty::MasterPty + Send>,
  writer: Box<dyn Write + Send>,
  killer: Box<dyn ChildKiller + Send + Sync>,
  events: broadcast::Sender<TerminalOutputEvent>,
}

pub struct TerminalRuntimeState {
  sessions: Arc<Mutex<HashMap<String, Arc<Mutex<TerminalSessionRecord>>>>>,
}

impl Default for TerminalRuntimeState {
  fn default() -> Self {
    Self {
      sessions: Arc::new(Mutex::new(HashMap::new())),
    }
  }
}

fn now_string() -> String {
  match SystemTime::now().duration_since(UNIX_EPOCH) {
    Ok(duration) => duration.as_millis().to_string(),
    Err(_) => "0".to_string(),
  }
}

fn trim_output(output: &str) -> String {
  if output.len() <= MAX_TERMINAL_OUTPUT_BYTES {
    return output.to_string();
  }

  output[(output.len() - MAX_TERMINAL_OUTPUT_BYTES)..].to_string()
}

fn normalize_output_lines(output: &str) -> Vec<String> {
  output
    .replace("\r\n", "\n")
    .replace('\r', "\n")
    .lines()
    .map(|line| line.trim_end_matches('\u{0}').trim_end().to_string())
    .collect()
}

fn infer_working_directory_from_prompt(prompt_marker: &str, output: &str) -> Option<String> {
  normalize_output_lines(output)
    .into_iter()
    .rev()
    .find_map(|line| {
      let trimmed = line.trim();
      let prompt = trimmed.strip_prefix(prompt_marker)?.trim();
      let prompt = prompt.strip_suffix('>').unwrap_or(prompt);
      let prompt = prompt.strip_suffix('$').unwrap_or(prompt);
      let prompt = prompt.strip_suffix('#').unwrap_or(prompt);
      let normalized = prompt.trim();
      if normalized.is_empty() {
        None
      } else {
        Some(normalized.to_string())
      }
    })
}

fn snapshot_from_record(session: &TerminalSessionRecord) -> TerminalSessionSnapshot {
  TerminalSessionSnapshot {
    id: session.id.clone(),
    project_id: session.project_id.clone(),
    shell: session.shell.clone(),
    working_directory: session.working_directory.clone(),
    status: session.status.clone(),
    output: session.output.clone(),
    prompt_marker: session.prompt_marker.clone(),
    created_at: session.created_at.clone(),
    updated_at: session.updated_at.clone(),
    exit_code: session.exit_code,
    cols: session.cols,
    rows: session.rows,
  }
}

fn event_from_record(
  session: &TerminalSessionRecord,
  channel: &str,
  chunk: String,
) -> TerminalOutputEvent {
  TerminalOutputEvent {
    id: session.id.clone(),
    project_id: session.project_id.clone(),
    shell: session.shell.clone(),
    working_directory: session.working_directory.clone(),
    status: session.status.clone(),
    output: session.output.clone(),
    prompt_marker: session.prompt_marker.clone(),
    created_at: session.created_at.clone(),
    updated_at: session.updated_at.clone(),
    exit_code: session.exit_code,
    cols: session.cols,
    rows: session.rows,
    channel: channel.to_string(),
    chunk,
  }
}

fn emit_terminal_event(app: &AppHandle, event: TerminalOutputEvent) {
  if let Err(error) = app.emit(TERMINAL_EVENT_NAME, event) {
    log::error!("failed to emit terminal event: {}", error);
  }
}

fn publish_terminal_event(
  app: &AppHandle,
  sender: &broadcast::Sender<TerminalOutputEvent>,
  event: TerminalOutputEvent,
) {
  let _ = sender.send(event.clone());
  emit_terminal_event(app, event);
}

fn resolve_terminal_spec(
  shell: TerminalSessionShell,
) -> (TerminalSessionShell, String, Vec<String>, Vec<(String, String)>) {
  match shell {
    TerminalSessionShell::Cmd => (
      TerminalSessionShell::Cmd,
      if cfg!(windows) {
        "cmd.exe".to_string()
      } else {
        "sh".to_string()
      },
      if cfg!(windows) {
        vec![
          "/Q".to_string(),
          "/K".to_string(),
          "prompt".to_string(),
          format!("{TERMINAL_PROMPT_MARKER}$P$G"),
        ]
      } else {
        vec!["-i".to_string()]
      },
      Vec::new(),
    ),
    TerminalSessionShell::Powershell => (
      TerminalSessionShell::Powershell,
      if cfg!(windows) {
        "powershell.exe".to_string()
      } else {
        "pwsh".to_string()
      },
      vec![
        "-NoLogo".to_string(),
        "-NoProfile".to_string(),
        "-NoExit".to_string(),
        "-Command".to_string(),
        format!(
          "function global:prompt {{ \"{TERMINAL_PROMPT_MARKER}$($executionContext.SessionState.Path.CurrentLocation)> \" }}"
        ),
      ],
      Vec::new(),
    ),
    TerminalSessionShell::Bash => (
      TerminalSessionShell::Bash,
      "bash".to_string(),
      vec![
        "--noprofile".to_string(),
        "--norc".to_string(),
        "-i".to_string(),
      ],
      vec![("PS1".to_string(), format!("{TERMINAL_PROMPT_MARKER}\\w$ "))],
    ),
    TerminalSessionShell::Zsh => (
      TerminalSessionShell::Zsh,
      "zsh".to_string(),
      vec!["-f".to_string(), "-i".to_string()],
      vec![("PROMPT".to_string(), format!("{TERMINAL_PROMPT_MARKER}%~$ "))],
    ),
  }
}

fn append_terminal_output(session: &mut TerminalSessionRecord, chunk: &str) {
  session.output = trim_output(&format!("{}{}", session.output, chunk));
  if let Some(next_working_directory) =
    infer_working_directory_from_prompt(&session.prompt_marker, &session.output)
  {
    session.working_directory = next_working_directory;
  }

  let has_prompt = normalize_output_lines(chunk)
    .into_iter()
    .any(|line| line.trim_start().starts_with(&session.prompt_marker));
  session.status = if has_prompt {
    TerminalSessionStatus::Idle
  } else {
    TerminalSessionStatus::Running
  };
  session.updated_at = now_string();
}

fn get_session_arc(
  sessions: &HashMap<String, Arc<Mutex<TerminalSessionRecord>>>,
  project_id: &str,
  session_id: &str,
) -> Result<Arc<Mutex<TerminalSessionRecord>>, String> {
  let Some(session) = sessions.get(session_id) else {
    return Err("Sessao de terminal nao encontrada.".to_string());
  };
  let belongs_to_project = {
    let record = session
      .lock()
      .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
    record.project_id == project_id
  };

  if !belongs_to_project {
    return Err("Sessao de terminal nao pertence a este projeto.".to_string());
  }

  Ok(Arc::clone(session))
}

fn spawn_output_reader(
  app: AppHandle,
  session: Arc<Mutex<TerminalSessionRecord>>,
  mut reader: Box<dyn Read + Send>,
) {
  thread::spawn(move || {
    let mut buffer = [0_u8; 4096];

    loop {
      match reader.read(&mut buffer) {
        Ok(0) => break,
        Ok(size) => {
          let chunk = String::from_utf8_lossy(&buffer[..size]).to_string();
          let (event, sender) = {
            let mut record = match session.lock() {
              Ok(record) => record,
              Err(_) => break,
            };
            append_terminal_output(&mut record, &chunk);
            (
              event_from_record(&record, "terminal.output", chunk.clone()),
              record.events.clone(),
            )
          };
          publish_terminal_event(&app, &sender, event);
        }
        Err(error) => {
          let (event, sender) = {
            let mut record = match session.lock() {
              Ok(record) => record,
              Err(_) => break,
            };
            record.status = TerminalSessionStatus::Error;
            record.updated_at = now_string();
            append_terminal_output(
              &mut record,
              &format!("\n[terminal read error] {}\n", error),
            );
            (
              event_from_record(
                &record,
                "terminal.exit",
                format!("\n[terminal read error] {}\n", error),
              ),
              record.events.clone(),
            )
          };
          publish_terminal_event(&app, &sender, event);
          break;
        }
      }
    }
  });
}

fn spawn_exit_watcher(
  app: AppHandle,
  session: Arc<Mutex<TerminalSessionRecord>>,
  mut child: Box<dyn portable_pty::Child + Send + Sync>,
) {
  thread::spawn(move || {
    let wait_result = child.wait();
    let (event, sender) = {
      let mut record = match session.lock() {
        Ok(record) => record,
        Err(_) => return,
      };

      match wait_result {
        Ok(status) => {
          record.status = TerminalSessionStatus::Exited;
          record.exit_code = Some(status.exit_code() as i32);
        }
        Err(error) => {
          record.status = TerminalSessionStatus::Error;
          record.exit_code = Some(1);
          record.output = trim_output(&format!("{}\n[terminal wait error] {}\n", record.output, error));
        }
      }
      record.updated_at = now_string();
      (
        event_from_record(&record, "terminal.exit", String::new()),
        record.events.clone(),
      )
    };

    publish_terminal_event(&app, &sender, event);
  });
}

pub fn terminal_open_session_internal(
  input: TerminalOpenSessionInput,
  app: &AppHandle,
  state: &TerminalRuntimeState,
) -> Result<TerminalSessionSnapshot, String> {
  let requested_id = input.session_id.clone();
  {
    let mut sessions = state
      .sessions
      .lock()
      .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;

    if let Some(session_id) = requested_id.as_deref() {
      if let Some(existing) = sessions.get(session_id).cloned() {
        let should_reuse = {
          let record = existing
            .lock()
            .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
          if record.project_id != input.project_id {
            return Err("Sessao de terminal nao pertence a este projeto.".to_string());
          }
          !matches!(
            record.status,
            TerminalSessionStatus::Exited | TerminalSessionStatus::Error
          )
        };

        if should_reuse {
          let record = existing
            .lock()
            .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
          return Ok(snapshot_from_record(&record));
        }

        sessions.remove(session_id);
      }
    }
  }

  let shell = TerminalSessionShell::from_optional(input.shell.clone());
  let (resolved_shell, program, args, env_overrides) = resolve_terminal_spec(shell);
  let pty_system = native_pty_system();
  let pair = pty_system
    .openpty(PtySize {
      rows: input.rows.unwrap_or(30),
      cols: input.cols.unwrap_or(120),
      pixel_width: 0,
      pixel_height: 0,
    })
    .map_err(|error| format!("Nao foi possivel abrir o terminal local: {error}"))?;

  let mut command = CommandBuilder::new(program);
  command.args(args);
  if let Some(working_directory) = input.working_directory.as_deref() {
    if !working_directory.trim().is_empty() {
      command.cwd(working_directory.trim());
    }
  }
  for (key, value) in env_overrides {
    command.env(key, value);
  }

  let child = pair
    .slave
    .spawn_command(command)
    .map_err(|error| format!("Nao foi possivel iniciar o shell local: {error}"))?;
  let killer = child.clone_killer();
  let reader = pair
    .master
    .try_clone_reader()
    .map_err(|error| format!("Nao foi possivel ler a saida do terminal: {error}"))?;
  let writer = pair
    .master
    .take_writer()
    .map_err(|error| format!("Nao foi possivel escrever no terminal: {error}"))?;
  let master = pair.master;
  let (events, _) = broadcast::channel(256);

  let now = now_string();
  let session_id = requested_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
  let session = Arc::new(Mutex::new(TerminalSessionRecord {
    id: session_id.clone(),
    project_id: input.project_id.clone(),
    shell: resolved_shell,
    working_directory: input
      .working_directory
      .clone()
      .filter(|value| !value.trim().is_empty())
      .unwrap_or_else(|| ".".to_string()),
    status: TerminalSessionStatus::Idle,
    output: String::new(),
    created_at: now.clone(),
    updated_at: now,
    exit_code: None,
    cols: input.cols.unwrap_or(120),
    rows: input.rows.unwrap_or(30),
    prompt_marker: TERMINAL_PROMPT_MARKER.to_string(),
    master,
    writer,
    killer,
    events,
  }));

  spawn_output_reader(app.clone(), Arc::clone(&session), reader);
  spawn_exit_watcher(app.clone(), Arc::clone(&session), child);

  {
    let mut sessions = state
      .sessions
      .lock()
      .map_err(|_| "Falha ao registrar a sessao de terminal.".to_string())?;
    sessions.insert(session_id, Arc::clone(&session));
  }

  let record = session
    .lock()
    .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
  Ok(snapshot_from_record(&record))
}

pub fn terminal_attach_session_internal(
  input: TerminalAttachSessionInput,
  state: &TerminalRuntimeState,
) -> Result<TerminalSessionSnapshot, String> {
  let sessions = state
    .sessions
    .lock()
    .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;
  let session = get_session_arc(&sessions, &input.project_id, &input.session_id)?;
  let record = session
    .lock()
    .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
  Ok(snapshot_from_record(&record))
}

pub fn terminal_list_sessions_internal(
  project_id: Option<String>,
  state: &TerminalRuntimeState,
) -> Result<Vec<TerminalSessionSnapshot>, String> {
  let sessions = state
    .sessions
    .lock()
    .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;

  sessions
    .values()
    .map(|session| {
      let record = session
        .lock()
        .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
      if project_id
        .as_ref()
        .map(|value| value == &record.project_id)
        .unwrap_or(true)
      {
        Ok(Some(snapshot_from_record(&record)))
      } else {
        Ok(None)
      }
    })
    .collect::<Result<Vec<_>, String>>()
    .map(|entries| entries.into_iter().flatten().collect())
}

pub fn terminal_write_input_internal(
  input: TerminalWriteInput,
  state: &TerminalRuntimeState,
) -> Result<TerminalSessionSnapshot, String> {
  let sessions = state
    .sessions
    .lock()
    .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;
  let session = get_session_arc(&sessions, &input.project_id, &input.session_id)?;
  drop(sessions);

  let mut record = session
    .lock()
    .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
  record
    .writer
    .write_all(input.data.as_bytes())
    .map_err(|error| format!("Nao foi possivel enviar o input ao terminal: {error}"))?;
  record
    .writer
    .flush()
    .map_err(|error| format!("Nao foi possivel sincronizar o terminal: {error}"))?;
  record.status = TerminalSessionStatus::Running;
  record.updated_at = now_string();
  Ok(snapshot_from_record(&record))
}

pub fn terminal_resize_session_internal(
  input: TerminalResizeInput,
  state: &TerminalRuntimeState,
) -> Result<TerminalSessionSnapshot, String> {
  let sessions = state
    .sessions
    .lock()
    .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;
  let session = get_session_arc(&sessions, &input.project_id, &input.session_id)?;
  drop(sessions);

  let mut record = session
    .lock()
    .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
  record
    .master
    .resize(PtySize {
      rows: input.rows,
      cols: input.cols,
      pixel_width: 0,
      pixel_height: 0,
    })
    .map_err(|error| format!("Nao foi possivel redimensionar o terminal: {error}"))?;
  record.cols = input.cols;
  record.rows = input.rows;
  record.updated_at = now_string();
  Ok(snapshot_from_record(&record))
}

pub fn terminal_send_signal_internal(
  input: TerminalSignalInput,
  state: &TerminalRuntimeState,
) -> Result<TerminalSessionSnapshot, String> {
  let sessions = state
    .sessions
    .lock()
    .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;
  let session = get_session_arc(&sessions, &input.project_id, &input.session_id)?;
  drop(sessions);

  let mut record = session
    .lock()
    .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;

  match input.signal {
    TerminalSignal::Sigint => {
      record
        .writer
        .write_all(&[3])
        .map_err(|error| format!("Nao foi possivel enviar SIGINT: {error}"))?;
      record
        .writer
        .flush()
        .map_err(|error| format!("Nao foi possivel sincronizar o terminal: {error}"))?;
    }
    TerminalSignal::Eof => {
      record
        .writer
        .write_all(&[4])
        .map_err(|error| format!("Nao foi possivel enviar EOF: {error}"))?;
      record
        .writer
        .flush()
        .map_err(|error| format!("Nao foi possivel sincronizar o terminal: {error}"))?;
    }
    TerminalSignal::Kill => {
      record
        .killer
        .kill()
        .map_err(|error| format!("Nao foi possivel encerrar o terminal: {error}"))?;
    }
  }

  record.updated_at = now_string();
  Ok(snapshot_from_record(&record))
}

pub fn terminal_close_session_internal(
  input: TerminalAttachSessionInput,
  state: &TerminalRuntimeState,
) -> Result<TerminalSessionSnapshot, String> {
  let session = {
    let mut sessions = state
      .sessions
      .lock()
      .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;
    let session = get_session_arc(&sessions, &input.project_id, &input.session_id)?;
    sessions.remove(&input.session_id);
    session
  };

  let mut record = session
    .lock()
    .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
  let _ = record.killer.kill();
  record.status = TerminalSessionStatus::Exited;
  record.updated_at = now_string();
  Ok(snapshot_from_record(&record))
}

pub fn terminal_subscribe_session(
  project_id: &str,
  session_id: &str,
  state: &TerminalRuntimeState,
) -> Result<(TerminalSessionSnapshot, broadcast::Receiver<TerminalOutputEvent>), String> {
  let sessions = state
    .sessions
    .lock()
    .map_err(|_| "Falha ao acessar o runtime de terminal.".to_string())?;
  let session = get_session_arc(&sessions, project_id, session_id)?;
  drop(sessions);

  let record = session
    .lock()
    .map_err(|_| "Falha ao acessar a sessao de terminal.".to_string())?;
  Ok((snapshot_from_record(&record), record.events.subscribe()))
}

#[tauri::command]
pub fn terminal_open_session(
  input: TerminalOpenSessionInput,
  app: AppHandle,
  state: TauriState<'_, TerminalRuntimeState>,
) -> Result<TerminalSessionSnapshot, String> {
  terminal_open_session_internal(input, &app, &state)
}

#[tauri::command]
pub fn terminal_attach_session(
  input: TerminalAttachSessionInput,
  state: TauriState<'_, TerminalRuntimeState>,
) -> Result<TerminalSessionSnapshot, String> {
  terminal_attach_session_internal(input, &state)
}

#[tauri::command]
pub fn terminal_list_sessions(
  project_id: Option<String>,
  state: TauriState<'_, TerminalRuntimeState>,
) -> Result<Vec<TerminalSessionSnapshot>, String> {
  terminal_list_sessions_internal(project_id, &state)
}

#[tauri::command]
pub fn terminal_write_input(
  input: TerminalWriteInput,
  state: TauriState<'_, TerminalRuntimeState>,
) -> Result<TerminalSessionSnapshot, String> {
  terminal_write_input_internal(input, &state)
}

#[tauri::command]
pub fn terminal_resize_session(
  input: TerminalResizeInput,
  state: TauriState<'_, TerminalRuntimeState>,
) -> Result<TerminalSessionSnapshot, String> {
  terminal_resize_session_internal(input, &state)
}

#[tauri::command]
pub fn terminal_send_signal(
  input: TerminalSignalInput,
  state: TauriState<'_, TerminalRuntimeState>,
) -> Result<TerminalSessionSnapshot, String> {
  terminal_send_signal_internal(input, &state)
}

#[tauri::command]
pub fn terminal_close_session(
  input: TerminalAttachSessionInput,
  state: TauriState<'_, TerminalRuntimeState>,
) -> Result<TerminalSessionSnapshot, String> {
  terminal_close_session_internal(input, &state)
}

#[cfg(test)]
mod tests {
  use super::{infer_working_directory_from_prompt, trim_output, TERMINAL_PROMPT_MARKER};

  #[test]
  fn infers_windows_prompt_directory() {
    let output = "__FLOW_MERGE_PROMPT__:C:\\Projects\\Teste\\Nova pasta>";
    assert_eq!(
      infer_working_directory_from_prompt(TERMINAL_PROMPT_MARKER, output),
      Some("C:\\Projects\\Teste\\Nova pasta".to_string()),
    );
  }

  #[test]
  fn infers_bash_prompt_directory() {
    let output = "__FLOW_MERGE_PROMPT__:/Users/maico/workspace$ ";
    assert_eq!(
      infer_working_directory_from_prompt(TERMINAL_PROMPT_MARKER, output),
      Some("/Users/maico/workspace".to_string()),
    );
  }

  #[test]
  fn trims_terminal_output_from_the_start() {
    let output = "a".repeat(410_000);
    let trimmed = trim_output(&output);

    assert_eq!(trimmed.len(), 400_000);
    assert!(trimmed.chars().all(|value| value == 'a'));
  }
}
