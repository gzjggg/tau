# Tau Desktop — install & release (D3)

Product repository only: [gzjggg/tau](https://github.com/gzjggg/tau).  
**Do not** ship desktop artifacts via `tau-pr` / upstream PRs.

## What you get

| Artifact | Description |
|----------|-------------|
| `tau-desktop.exe` | Portable / post-install binary |
| `Tau_<version>_x64-setup.exe` | NSIS installer (current user, no admin) |
| WebView2 | Installer can bootstrap runtime if missing |

Closing Tau Desktop does **not** exit Pi.

## Install (end user)

1. Build or download `Tau_*_x64-setup.exe`.
2. Run the installer (current user → `%LOCALAPPDATA%\Programs\Tau\`).
3. Start Menu → **Tau**.
4. Point Pi at this product package and start Pi; with `client: "desktop"` the extension launches Tau automatically.

### Configure Pi

```json
{
  "packages": ["C:/path/to/tau"],
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
  "desktopPath": "C:/Users/<you>/AppData/Local/Programs/Tau/tau-desktop.exe"
}
```

Or environment: `TAU_DESKTOP_PATH=...`

### Uninstall

Windows **Settings → Apps → Tau → Uninstall**, or the Start Menu uninstall entry if provided by NSIS.

## Build (developer)

```bash
cd apps/desktop
npm install
npm run package
# → src-tauri/target/release/bundle/nsis/Tau_*_x64-setup.exe
# → dist/desktop/ (copy + manifest.json)
```

Requirements: Windows x64, Rust stable, MSVC Build Tools, Node 18+, network for first WebView2 bootstrapper fetch if needed.

## Signing

D3 ships **unsigned** for personal use. SmartScreen may warn on first run — expected without a code-signing certificate.

When you later obtain a cert:

1. Sign `tau-desktop.exe` and the NSIS setup with `signtool`.
2. Optionally enable Tauri updater with signed releases (out of scope for D3).

## CI

GitHub Actions workflow: `.github/workflows/desktop-windows.yml`

- Trigger: `push` tags `desktop-v*` or manual `workflow_dispatch`
- Builds NSIS on `windows-latest`
- Uploads installer as a workflow artifact

## Version map

| Component | Version field |
|-----------|----------------|
| Desktop app / NSIS | `apps/desktop/src-tauri/tauri.conf.json` → `version` |
| Cargo crate | `apps/desktop/src-tauri/Cargo.toml` |
| npm workspace meta | `apps/desktop/package.json` |
| Tau product package | root `package.json` |

Bump all of the above together for a desktop release.
