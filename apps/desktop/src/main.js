const { invoke } = window.__TAURI__.core;

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const refreshBtn = document.getElementById("refresh-btn");
const titleIcon = document.getElementById("titlebar-icon");
const brandMark = document.getElementById("brand-mark");

// Chooser uses dark chrome by default → light Pi glyph (no white plate)
const ICON_DARK_CHROME = "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 46"><g fill="#f2f0ec">${/* filled at runtime via PNG from resource */""}</g></svg>`
);

// Prefer filesystem icons served? Chooser is asset protocol — use invoke for theme only.
// Embed tiny transparent PNG via canvas after load from relative path if we copy icons to src/
// Fall back: draw via unicode τ is weak — copy icons into src/assets

async function setChrome(dark) {
  document.documentElement.dataset.desktopChrome = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    dark ? "#131316" : "#f4f1ec"
  );
  // Asset-relative icons (copied next to styles)
  const light = "./assets/pi-mark-light.png";
  const darkI = "./assets/pi-mark-dark.png";
  const src = dark ? darkI : light;
  if (titleIcon) titleIcon.src = src;
  if (brandMark) brandMark.src = src;
  try {
    await invoke("set_theme_chrome", { dark });
  } catch (_) {}
}

// Prefer OS preference for chooser page
const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)")?.matches;
setChrome(!prefersLight);

document.getElementById("tb-min")?.addEventListener("click", () => {
  invoke("window_minimize").catch(() => {});
});
document.getElementById("tb-max")?.addEventListener("click", () => {
  invoke("window_toggle_maximize").catch(() => {});
});
document.getElementById("tb-close")?.addEventListener("click", () => {
  invoke("window_close").catch(() => {});
});

function shortPath(p) {
  if (!p) return "(unknown cwd)";
  const parts = p.replace(/\\/g, "/").split("/");
  if (parts.length <= 3) return p;
  return "…/" + parts.slice(-3).join("/");
}

async function connect(port) {
  statusEl.textContent = `正在连接 127.0.0.1:${port}…`;
  try {
    await invoke("open_instance", { port });
  } catch (e) {
    statusEl.textContent = String(e);
  }
}

function render(instances) {
  listEl.innerHTML = "";
  if (!instances.length) {
    listEl.hidden = true;
    emptyEl.hidden = false;
    statusEl.textContent = "未发现可用实例";
    return;
  }

  emptyEl.hidden = true;
  listEl.hidden = false;
  statusEl.textContent =
    instances.length === 1
      ? "发现 1 个实例（可点击连接；若已自动进入可忽略）"
      : `发现 ${instances.length} 个实例，请选择：`;

  for (const inst of instances) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    const title = document.createElement("div");
    title.className = "card-title";
    const left = document.createElement("span");
    left.textContent = `端口 ${inst.port}`;
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "healthy";
    title.append(left, badge);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = `${shortPath(inst.cwd)}  ·  pid ${inst.pid}`;

    btn.append(title, meta);
    btn.addEventListener("click", () => connect(inst.port));
    listEl.appendChild(btn);
  }
}

async function refresh() {
  statusEl.textContent = "正在查找本机 Tau 实例…";
  try {
    const instances = await invoke("list_tau_instances");
    render(instances || []);
  } catch (e) {
    statusEl.textContent = "扫描失败: " + String(e);
    listEl.hidden = true;
    emptyEl.hidden = false;
  }
}

refreshBtn.addEventListener("click", refresh);
refresh();
setInterval(refresh, 4000);

// silence unused
void ICON_DARK_CHROME;
