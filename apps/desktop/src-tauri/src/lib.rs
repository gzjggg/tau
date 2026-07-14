mod instance;

use instance::{list_instances, loopback_url, port_healthy, TauInstance};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

/// Baked-in icons so taskbar switch works even if resource_dir paths differ.
/// icon-dark.png = light glyph (for dark taskbar); icon-light.png = black glyph.
static ICON_LIGHT_GLYPH: &[u8] = include_bytes!("../icons/icon-dark.png");
static ICON_DARK_GLYPH: &[u8] = include_bytes!("../icons/icon-light.png");

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

/// Windows: AppsUseLightTheme == 0 ⇒ dark mode (dark taskbar → need light glyph).
#[cfg(windows)]
fn os_wants_light_glyph() -> bool {
    use std::ptr::null_mut;
    // Prefer registry; fall back to true (dark-taskbar-safe)
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
        // 0 = dark system chrome → light glyph
        data == 0
    }
}

#[cfg(not(windows))]
fn os_wants_light_glyph() -> bool {
    true
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

/// `dark: true` ⇒ light-colored glyph (for dark taskbar / dark chrome).
/// `dark: false` ⇒ black glyph (for light taskbar).
#[tauri::command]
fn set_theme_chrome(app: AppHandle, dark: bool) -> Result<(), String> {
    apply_window_icon(&app, dark)
}

fn focus_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

static INIT_ICON: OnceLock<()> = OnceLock::new();

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
            // Default: OS dark taskbar → light glyph (fixes invisible black icon)
            let light = os_wants_light_glyph();
            let _ = apply_window_icon(&handle, light);
            INIT_ICON.get_or_init(|| ());

            let forced = port_from_args();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(250));
                // Re-apply icon after window fully ready
                let _ = apply_window_icon(&handle, os_wants_light_glyph());
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
