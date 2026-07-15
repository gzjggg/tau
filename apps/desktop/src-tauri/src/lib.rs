mod instance;

use instance::{list_instances, port_healthy, TauInstance};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

/// Baked-in icons so taskbar switch works even if resource_dir paths differ.
/// icon-dark.png = light glyph (for dark taskbar); icon-light.png = black glyph.
static ICON_LIGHT_GLYPH: &[u8] = include_bytes!("../icons/icon-dark.png");
static ICON_DARK_GLYPH: &[u8] = include_bytes!("../icons/icon-light.png");

/// Active Tau mirror port for the bundled UI (D2 — no navigate to external page).
static ACTIVE_PORT: Mutex<Option<u16>> = Mutex::new(None);

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

fn set_active_port(port: u16) {
    if let Ok(mut g) = ACTIVE_PORT.lock() {
        *g = Some(port);
    }
}

fn get_active_port_val() -> Option<u16> {
    ACTIVE_PORT.lock().ok().and_then(|g| *g)
}

fn image_from_bytes(bytes: &[u8]) -> Result<tauri::image::Image<'static>, String> {
    tauri::image::Image::from_bytes(bytes)
        .map(|i| i.to_owned())
        .map_err(|e| e.to_string())
}

fn apply_window_icon(app: &AppHandle, light_glyph: bool) -> Result<(), String> {
    let bytes = if light_glyph {
        ICON_LIGHT_GLYPH
    } else {
        ICON_DARK_GLYPH
    };
    let icon = image_from_bytes(bytes)?;
    if let Some(win) = app.get_webview_window("main") {
        win.set_icon(icon).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Windows: SystemUsesLightTheme == 0 ⇒ dark taskbar → light glyph.
#[cfg(windows)]
fn os_wants_light_glyph() -> bool {
    use std::ptr::null_mut;
    type HKEY = *mut std::ffi::c_void;
    const HKEY_CURRENT_USER: HKEY = 0x80000001u32 as HKEY;
    const KEY_READ: u32 = 0x20019;
    extern "system" {
        fn RegOpenKeyExW(
            hkey: HKEY,
            sub: *const u16,
            opt: u32,
            sam: u32,
            result: *mut HKEY,
        ) -> i32;
        fn RegQueryValueExW(
            hkey: HKEY,
            name: *const u16,
            reserved: *mut u32,
            ty: *mut u32,
            data: *mut u8,
            cb: *mut u32,
        ) -> i32;
        fn RegCloseKey(hkey: HKEY) -> i32;
    }
    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }
    unsafe {
        let mut hkey: HKEY = null_mut();
        let sub = wide(r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");
        if RegOpenKeyExW(HKEY_CURRENT_USER, sub.as_ptr(), 0, KEY_READ, &mut hkey) != 0 {
            return true;
        }
        let name = wide("SystemUsesLightTheme");
        let mut ty: u32 = 0;
        let mut data: u32 = 1;
        let mut cb: u32 = 4;
        let ok = RegQueryValueExW(
            hkey,
            name.as_ptr(),
            null_mut(),
            &mut ty,
            &mut data as *mut u32 as *mut u8,
            &mut cb,
        );
        RegCloseKey(hkey);
        if ok != 0 {
            return true;
        }
        data == 0
    }
}

#[cfg(not(windows))]
fn os_wants_light_glyph() -> bool {
    true
}

/// Bind active port, notify UI, keep **bundled** public/ shell (D2).
fn connect_port(app: &AppHandle, port: u16) -> Result<(), String> {
    if port == 0 {
        return Err("invalid port".into());
    }
    if !port_healthy(port) {
        return Err(format!(
            "No healthy gzTau at 127.0.0.1:{port}. Start Pi with the gzTau extension first."
        ));
    }
    set_active_port(port);
    let _ = app.emit("tau-port", port);
    let _ = apply_window_icon(app, os_wants_light_glyph());
    Ok(())
}

#[tauri::command]
fn list_tau_instances() -> Vec<TauInstance> {
    list_instances()
}

#[tauri::command]
fn get_active_port() -> Option<u16> {
    get_active_port_val()
}

#[tauri::command]
fn open_instance(app: AppHandle, port: u16) -> Result<(), String> {
    connect_port(&app, port)
}

#[tauri::command]
fn window_minimize(app: AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "no main window".to_string())?;
    win.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_maximize(app: AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "no main window".to_string())?;
    if win.is_maximized().unwrap_or(false) {
        win.unmaximize().map_err(|e| e.to_string())
    } else {
        win.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn window_close(app: AppHandle) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "no main window".to_string())?;
    win.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn sync_taskbar_icon(app: AppHandle) -> Result<(), String> {
    apply_window_icon(&app, os_wants_light_glyph())
}

/// Legacy: `dark` ignored — always OS system taskbar theme.
#[tauri::command]
fn set_theme_chrome(app: AppHandle, dark: bool) -> Result<(), String> {
    let _ = dark;
    apply_window_icon(&app, os_wants_light_glyph())
}

fn focus_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Windows taskbar identity (grouping / pinning) — matches NSIS product install.
#[cfg(windows)]
fn set_app_user_model_id() {
    // SetCurrentProcessExplicitAppUserModelID("com.gzjggg.gztau")
    type HRESULT = i32;
    extern "system" {
        fn SetCurrentProcessExplicitAppUserModelID(app_id: *const u16) -> HRESULT;
    }
    let id: Vec<u16> = "com.gzjggg.gztau\0".encode_utf16().collect();
    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(id.as_ptr());
    }
}

#[cfg(not(windows))]
fn set_app_user_model_id() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    set_app_user_model_id();

    // Resolve port before the webview boots so get_active_port works on first paint
    if let Some(port) = port_from_args() {
        if port_healthy(port) {
            set_active_port(port);
        }
    } else {
        let healthy = list_instances();
        if healthy.len() == 1 {
            set_active_port(healthy[0].port);
        }
    }

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
                let _ = connect_port(app, port);
            } else {
                focus_main(app);
            }
        }))
        .invoke_handler(tauri::generate_handler![
            list_tau_instances,
            get_active_port,
            open_instance,
            window_minimize,
            window_toggle_maximize,
            window_close,
            set_theme_chrome,
            sync_taskbar_icon
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let _ = apply_window_icon(&handle, os_wants_light_glyph());

            // Ensure main window exists with bundled public UI (D2)
            if app.get_webview_window("main").is_none() {
                let _ = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title("Tau")
                    .inner_size(1280.0, 860.0)
                    .decorations(false)
                    .build();
            }

            // Re-emit active port after UI mounts
            let handle2 = handle.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(400));
                let _ = apply_window_icon(&handle2, os_wants_light_glyph());
                if let Some(port) = get_active_port_val() {
                    let _ = handle2.emit("tau-port", port);
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running gzTau desktop");
}
