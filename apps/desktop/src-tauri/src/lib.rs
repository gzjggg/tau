mod instance;

use instance::{list_instances, loopback_url, port_healthy, TauInstance};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

/// Parse `--port N` or `--port=N` from process args (used by Tau extension launcher).
fn port_from_args() -> Option<u16> {
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        if a == "--port" {
            return args.next().and_then(|p| p.parse().ok());
        }
        if let Some(rest) = a.strip_prefix("--port=") {
            return rest.parse().ok();
        }
    }
    None
}

fn navigate_main(app: &AppHandle, port: u16) -> Result<(), String> {
    let url_str = loopback_url(port);
    let parsed = Url::parse(&url_str).map_err(|e| e.to_string())?;

    if let Some(win) = app.get_webview_window("main") {
        win.navigate(parsed).map_err(|e| e.to_string())?;
        let _ = win.set_focus();
        let _ = win.unminimize();
        let _ = win.show();
        return Ok(());
    }

    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(parsed))
        .title("Tau")
        .inner_size(1280.0, 860.0)
        .decorations(false)
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

fn resource_icon_path(app: &AppHandle, name: &str) -> Option<PathBuf> {
    // Prefer resource dir (bundled), then dev path next to exe / CARGO_MANIFEST_DIR
    if let Ok(dir) = app.path().resource_dir() {
        let p = dir.join(name);
        if p.exists() {
            return Some(p);
        }
        let p2 = dir.join("icons").join(name);
        if p2.exists() {
            return Some(p2);
        }
    }
    // Dev: apps/desktop/src-tauri/icons/<name>
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("icons").join(name);
    if manifest.exists() {
        return Some(manifest);
    }
    None
}

#[tauri::command]
fn list_tau_instances() -> Vec<TauInstance> {
    list_instances()
}

#[tauri::command]
fn open_instance(app: AppHandle, port: u16) -> Result<(), String> {
    if port == 0 {
        return Err("invalid port".into());
    }
    if !port_healthy(port) {
        return Err(format!(
            "No healthy Tau at 127.0.0.1:{port}. Start Pi with Tau first."
        ));
    }
    navigate_main(&app, port)
}

#[tauri::command]
fn window_minimize(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn window_toggle_maximize(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_maximized().unwrap_or(false) {
            win.unmaximize().map_err(|e| e.to_string())?;
        } else {
            win.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn window_close(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("main") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Switch taskbar / window icon: dark chrome → light glyph; light chrome → black glyph.
#[tauri::command]
fn set_theme_chrome(app: AppHandle, dark: bool) -> Result<(), String> {
    let name = if dark {
        "icon-dark.png"
    } else {
        "icon-light.png"
    };
    let Some(path) = resource_icon_path(&app, name) else {
        return Err(format!("icon not found: {name}"));
    };
    let icon = tauri::image::Image::from_path(&path).map_err(|e| e.to_string())?;
    if let Some(win) = app.get_webview_window("main") {
        win.set_icon(icon).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn focus_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            let port = {
                let mut it = argv.iter().skip(1);
                let mut found = None;
                while let Some(a) = it.next() {
                    if a == "--port" {
                        found = it.next().and_then(|p| p.parse().ok());
                        break;
                    }
                    if let Some(rest) = a.strip_prefix("--port=") {
                        found = rest.parse().ok();
                        break;
                    }
                }
                found
            };
            if let Some(port) = port {
                let _ = navigate_main(app, port);
            } else {
                focus_main(app);
            }
        }))
        .invoke_handler(tauri::generate_handler![
            list_tau_instances,
            open_instance,
            window_minimize,
            window_toggle_maximize,
            window_close,
            set_theme_chrome
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            // Default icon: dark-mode friendly light glyph until UI reports theme
            if let Some(path) = resource_icon_path(&handle, "icon-dark.png") {
                if let Ok(icon) = tauri::image::Image::from_path(&path) {
                    if let Some(win) = handle.get_webview_window("main") {
                        let _ = win.set_icon(icon);
                    }
                }
            }
            let forced = port_from_args();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(250));
                if let Some(port) = forced {
                    let _ = navigate_main(&handle, port);
                    return;
                }
                let healthy = list_instances();
                if healthy.len() == 1 {
                    let _ = navigate_main(&handle, healthy[0].port);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Tau desktop");
}
