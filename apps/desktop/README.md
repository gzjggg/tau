# gzTau Desktop

Native window for the gzTau web UI (Tauri 2 + WebView2 on Windows).

**Product repo only** ([gzjggg/gzTau](https://github.com/gzjggg/gzTau)) — not synced to `tau-pr` / upstream.

In-app window title / titlebar label remains **Tau**; product name, installer, and Start Menu use **gzTau**.

## Phases

| Phase | Status |
|-------|--------|
| D1 Independent window + launcher | Done |
| D2 Bundled `public/` + loopback API | Done |
| D3 NSIS installer + docs/CI | Done (unsigned personal release) |

## Install (D3)

1. Build: `cd apps/desktop && npm run package`
2. Run `dist/desktop/gzTau_*_x64-setup.exe`
3. Installs for **current user** under `%LOCALAPPDATA%\Programs\gzTau\`
4. Start Menu folder: **gzTau**
5. Start Pi with this product package; default `client: "desktop"` auto-opens the app

Full notes: [docs/desktop-install.md](../../docs/desktop-install.md)

### Uninstall

Windows Settings → Apps → **gzTau**, or NSIS uninstaller.

### Signing

Installers are **unsigned**. SmartScreen may warn until you code-sign.

## Architecture

| Layer | Role |
|-------|------|
| Bundled `public/` | Same UI as browser (in-app brand **Tau**) |
| Pi + gzTau extension | HTTP/WS on `127.0.0.1:<port>` |
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
| Stable copy | `apps/desktop/bin/tau-desktop.exe` |
| NSIS | `dist/desktop/gzTau_*_x64-setup.exe` |

## Configure Pi

```json
{
  "tau": {
    "client": "desktop",
    "desktopFallback": "browser",
    "desktopPath": "%LOCALAPPDATA%/Programs/gzTau/tau-desktop.exe"
  }
}
```

(`desktopPath` optional if the default install / bin path is found.)

## CI

`.github/workflows/desktop-windows.yml` — tag `desktop-v*` or manual dispatch.
