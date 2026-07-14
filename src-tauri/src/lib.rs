use std::{
  path::PathBuf,
  process::{Child, Command, Stdio},
  sync::Mutex,
};

use tauri::{Manager, RunEvent};

struct ApiSidecar(Mutex<Option<Child>>);

fn api_sidecar_candidates(resource_dir: PathBuf) -> Vec<PathBuf> {
  let binary_name = "darktasks-api-x86_64-pc-windows-msvc.exe";
  vec![
    resource_dir.join("binaries").join(binary_name),
    resource_dir.join(binary_name),
  ]
}

fn start_api_sidecar(app: &tauri::App) {
  let Ok(resource_dir) = app.path().resource_dir() else {
    eprintln!("DarkTasks API sidecar skipped: resource directory was not found.");
    return;
  };

  let Some(api_path) = api_sidecar_candidates(resource_dir.clone())
    .into_iter()
    .find(|path| path.exists())
  else {
    eprintln!("DarkTasks API sidecar skipped: bundled API executable was not found.");
    return;
  };

  let mut command = Command::new(api_path);
  command
    .current_dir(resource_dir)
    .env("API_HOST", "127.0.0.1")
    .env("API_PORT", "8787")
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  match command.spawn() {
    Ok(child) => {
      app.manage(ApiSidecar(Mutex::new(Some(child))));
    }
    Err(error) => {
      eprintln!("DarkTasks API sidecar failed to start: {error}");
    }
  }
}

fn stop_api_sidecar(app: &tauri::AppHandle) {
  if let Some(sidecar) = app.try_state::<ApiSidecar>() {
    if let Ok(mut child) = sidecar.0.lock() {
      if let Some(mut child) = child.take() {
        let _ = child.kill();
        let _ = child.wait();
      }
    }
  }
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
  if !url.starts_with("https://www.linkedin.com/") {
    return Err("External URL is not allowed.".to_string());
  }

  Command::new("cmd")
    .args(["/C", "start", "", &url])
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .spawn()
    .map_err(|error| error.to_string())?;

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![open_external_url])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      start_api_sidecar(app);
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app, event| {
      if let RunEvent::ExitRequested { .. } = event {
        stop_api_sidecar(app);
      }
    });
}
