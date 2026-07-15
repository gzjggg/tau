# gzTau Desktop — install & release (D3)

Product repository only: [gzjggg/gzTau](https://github.com/gzjggg/gzTau).  
**Do not** ship desktop artifacts via `tau-pr` / upstream PRs.

In-app chrome still shows the short label **Tau**. Product / installer / Start Menu name is **gzTau**.

## What you get

| Artifact | Description |
|----------|-------------|
| `tau-desktop.exe` | Portable / post-install binary (crate name) |
| `gzTau_<version>_x64-setup.exe` | NSIS installer (current user, no admin) |
| WebView2 | Installer can bootstrap runtime if missing |

Closing gzTau Desktop does **not** exit Pi.

## Install (end user)

1. Build or download `gzTau_*_x64-setup.exe`.
2. Run the installer (current user → `%LOCALAPPDATA%\Programs\gzTau\`).
3. Start Menu → **gzTau**.
4. Point Pi at this product package and start Pi; with `client: "desktop"` the extension launches Desktop automatically.

### Configure Pi

```json
{
  "packages": ["C:/path/to/gzTau"],
  "tau": {
    "client": "desktop",
    "desktopFallback": "browser",
    "autoOpenBrowser": true
  }
}
```

If auto-launch cannot find the app:

```json
"tau": {
  "desktopPath": "C:/Users/<you>/AppData/Local/Programs/gzTau/tau-desktop.exe"
}
```

Or environment: `TAU_DESKTOP_PATH=...`

### Uninstall

Windows **Settings → Apps → gzTau → Uninstall**.

## Build (developer)

```bash
cd apps/desktop
npm install
npm run package
```

## Signing

D3 ships **unsigned** for personal use.

## CI

`.github/workflows/desktop-windows.yml` — tags `desktop-v*` or `workflow_dispatch`.

## Version map

| Component | Version field |
|-----------|----------------|
| Desktop app / NSIS | `apps/desktop/src-tauri/tauri.conf.json` → `version` |
| Cargo crate | `apps/desktop/src-tauri/Cargo.toml` |
| npm workspace meta | `apps/desktop/package.json` |
| gzTau product package | root `package.json` |
