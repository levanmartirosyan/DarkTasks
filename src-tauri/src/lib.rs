use std::{
    fs::{create_dir_all, OpenOptions},
    io::Write,
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::Duration,
};

use tauri::{Manager, RunEvent};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

struct ApiSidecar(Mutex<Option<Child>>);

fn api_sidecar_candidates(resource_dir: PathBuf) -> Vec<PathBuf> {
    let binary_names = [
        "darktasks-api.exe",
        "darktasks-api-x86_64-pc-windows-msvc.exe",
    ];
    let mut candidates = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            for binary_name in binary_names {
                candidates.push(exe_dir.join(binary_name));
            }
        }
    }

    for binary_name in binary_names {
        candidates.push(resource_dir.join("binaries").join(binary_name));
        candidates.push(resource_dir.join(binary_name));
    }

    candidates
}

fn api_log_path(app: &tauri::App) -> Option<PathBuf> {
    let log_dir = app.path().app_log_dir().ok()?;
    let _ = create_dir_all(&log_dir);
    Some(log_dir.join("darktasks-api.log"))
}

fn write_api_log(app: &tauri::App, message: &str) {
    let Some(path) = api_log_path(app) else {
        return;
    };

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{message}");
    }
}

fn api_port_is_running() -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], 8787));
    TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok()
}

fn start_api_sidecar(app: &tauri::App) {
    if api_port_is_running() {
        write_api_log(
            app,
            "DarkTasks API sidecar skipped: port 8787 is already in use.",
        );
        return;
    }

    let Ok(resource_dir) = app.path().resource_dir() else {
        write_api_log(app, "DarkTasks API sidecar skipped: resource directory was not found.");
        return;
    };

    let candidates = api_sidecar_candidates(resource_dir.clone());
    let Some(api_path) = candidates.iter().find(|path| path.exists()).cloned() else {
        write_api_log(app, "DarkTasks API sidecar skipped: bundled API executable was not found.");
        for candidate in candidates {
            write_api_log(app, &format!("Missing candidate: {}", candidate.display()));
        }
        return;
    };

    write_api_log(app, &format!("Starting DarkTasks API: {}", api_path.display()));
    write_api_log(app, &format!("API working directory: {}", resource_dir.display()));

    let mut command = Command::new(api_path);
    command
        .current_dir(resource_dir)
        .env("API_HOST", "127.0.0.1")
        .env("API_PORT", "8787")
        .stdin(Stdio::null());

    if let Some(path) = api_log_path(app) {
        if let Ok(stdout) = OpenOptions::new().create(true).append(true).open(&path) {
            let stderr = stdout.try_clone().ok();
            command.stdout(Stdio::from(stdout));
            if let Some(stderr) = stderr {
                command.stderr(Stdio::from(stderr));
            } else {
                command.stderr(Stdio::null());
            }
        } else {
            command.stdout(Stdio::null()).stderr(Stdio::null());
        }
    } else {
        command.stdout(Stdio::null()).stderr(Stdio::null());
    }

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    match command.spawn() {
        Ok(child) => {
            write_api_log(app, "DarkTasks API sidecar started.");
            app.manage(ApiSidecar(Mutex::new(Some(child))));
        }
        Err(error) => {
            write_api_log(app, &format!("DarkTasks API sidecar failed to start: {error}"));
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
fn stop_api_sidecar_for_update(app: tauri::AppHandle) -> Result<(), String> {
    stop_api_sidecar(&app);
    Ok(())
}

#[tauri::command]
fn open_external_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://www.linkedin.com/") {
        return Err("External URL is not allowed.".to_string());
    }

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut command = Command::new("explorer.exe");
        command.arg(&url);
        command.creation_flags(CREATE_NO_WINDOW);
        command
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut command = Command::new("open");
        command.arg(&url);
        command
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut command = Command::new("xdg-open");
        command.arg(&url);
        command
    };

    command
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_external_url,
            stop_api_sidecar_for_update
        ])
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
