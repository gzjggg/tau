# Tau Desktop

Native window for the Tau web UI (Tauri 2 + WebView2 on Windows).

**Product repo only** ([gzjggg/tau](https://github.com/gzjggg/tau)) — desktop work is **not** pushed to `tau-pr` / upstream.

## Phases

| Phase | Status |
|-------|--------|
| D1 Independent window + launcher | Done |
| D2 Bundled `public/` + loopback API | Done |
| **D3 NSIS installer + docs/CI** | **Done** (unsigned personal release) |

## Install (D3)

1. Build: `cd apps/desktop && npm run package`
2. Run `dist/desktop/Tau_*_x64-setup.exe` (or under `src-tauri/target/release/bundle/nsis/`)
3. Installs for **current user** (no admin) under `%LOCALAPPDATA%\Programs\Tau\`
4. Start Menu folder: **Tau**
5. Start Pi with this product package; default `client: "desktop"` auto-opens the app

Full notes: [docs/desktop-install.md](../../docs/desktop-install.md)

### Uninstall

Windows Settings → Apps → **Tau**, or NSIS uninstaller.

### Signing

Installers are **unsigned**. SmartScreen may warn until you code-sign.

## Architecture

| Layer | Role |
|-------|------|
| Bundled `public/` | Same UI as browser |
| Pi + Tau extension | HTTP/WS on `127.0.0.1:<port>` |
| Desktop shell | Instance discovery, titlebar, taskbar icon, single-instance |

Closing the window does **not** exit Pi.

## Build

```bash
cd apps/desktop
npm install
npm run package
```

| Output | Path |
|--------|------|
| Binary | `src-tauri/target/release/tau-desktop.exe` |
| NSIS | `src-tauri/target/release/bundle/nsis/Tau_*_x64-setup.exe` |
| Copy + manifest | `dist/desktop/` |

Requirements: Windows x64, Rust, MSVC, Node 18+.

## Configure Pi

```json
{
  "tau": {
    "client": "desktop",
    "desktopFallback": "browser",
    "desktopPath": "%LOCALAPPDATA%/Programs/Tau/tau-desktop.exe"
  }
}
```

(`desktopPath` optional if the default install location is used.)

- Browser only: `TAU_CLIENT=browser`
- No auto-open: `TAU_AUTO_OPEN=0`

## CI

`.github/workflows/desktop-windows.yml` — tag `desktop-v*` or manual dispatch builds the NSIS artifact.

## Chrome notes

- Frameless window + themed titlebar
- Taskbar glyph follows **Windows system** light/dark
- Maximize ↔ dual rounded restore icon
