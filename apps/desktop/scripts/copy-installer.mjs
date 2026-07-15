/**
 * After `tauri build`, copy the *current* NSIS installer into dist/desktop.
 * Binaries stay gitignored under dist/.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.resolve(__dirname, "..");
const confPath = path.join(desktopRoot, "src-tauri", "tauri.conf.json");
const conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
const version = conf.version || "0.0.0";
const product = conf.productName || "gzTau";

const nsisDir = path.join(
  desktopRoot,
  "src-tauri",
  "target",
  "release",
  "bundle",
  "nsis"
);
const distDir = path.resolve(desktopRoot, "../../dist/desktop");

if (!fs.existsSync(nsisDir)) {
  console.error("[package] NSIS output not found:", nsisDir);
  process.exit(1);
}

const prefer = `${product}_${version}_x64-setup.exe`;
const all = fs
  .readdirSync(nsisDir)
  .filter((f) => f.toLowerCase().endsWith("-setup.exe"));

const pick = all.includes(prefer)
  ? [prefer]
  : all.sort().slice(-1);

if (!pick.length) {
  console.error("[package] No installer .exe in", nsisDir);
  process.exit(1);
}

fs.mkdirSync(distDir, { recursive: true });
// Clean previous copies of this product's setups so dist stays tidy
for (const f of fs.readdirSync(distDir)) {
  if (f.toLowerCase().endsWith("-setup.exe") || f === "manifest.json") {
    try {
      fs.unlinkSync(path.join(distDir, f));
    } catch { /* ignore */ }
  }
}

const files = [];
for (const f of pick) {
  const src = path.join(nsisDir, f);
  const dest = path.join(distDir, f);
  fs.copyFileSync(src, dest);
  const st = fs.statSync(dest);
  files.push({
    name: f,
    path: path.join("dist/desktop", f).replace(/\\/g, "/"),
    sizeBytes: st.size,
  });
  console.log(`[package] ${dest} (${(st.size / 1024 / 1024).toFixed(2)} MiB)`);
}

const manifest = {
  product,
  version,
  builtAt: new Date().toISOString(),
  identifier: conf.identifier,
  files,
  installHint:
    "Current-user NSIS → %LOCALAPPDATA%\\Programs\\gzTau\\ (no admin). Unsigned personal build.",
  note: "Product repo gzjggg/gzTau only — not tau-pr. In-app title remains Tau.",
};
fs.writeFileSync(path.join(distDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("[package] manifest.json written for", product, version);

// Stable path next to source package so path-install finds desktop without NSIS
const binDir = path.join(desktopRoot, "bin");
const releaseExe = path.join(
  desktopRoot,
  "src-tauri",
  "target",
  "release",
  process.platform === "win32" ? "tau-desktop.exe" : "tau-desktop"
);
if (fs.existsSync(releaseExe)) {
  fs.mkdirSync(binDir, { recursive: true });
  const binExe = path.join(binDir, path.basename(releaseExe));
  fs.copyFileSync(releaseExe, binExe);
  console.log("[package] stable binary →", binExe);
}
