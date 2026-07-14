const invoke = (...args) => window.__TAURI__.core.invoke(...args);

async function appWindow() {
  const w = window.__TAURI__.window;
  if (w.getCurrentWindow) return w.getCurrentWindow();
  if (w.getCurrent) return w.getCurrent();
  throw new Error("no window api");
}

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const emptyEl = document.getElementById("empty");
const refreshBtn = document.getElementById("refresh-btn");
const titleIcon = document.getElementById("titlebar-icon");
const brandMark = document.getElementById("brand-mark");

function osDark() {
  return !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
}

async function setChrome(darkOs) {
  // dark OS → light glyph assets
  document.documentElement.dataset.desktopChrome = darkOs ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    darkOs ? "#131316" : "#f4f1ec"
  );
  const src = darkOs ? "./assets/pi-mark-dark.png" : "./assets/pi-mark-light.png";
  if (titleIcon) titleIcon.src = src;
  if (brandMark) brandMark.src = src;
  try {
    await invoke("set_theme_chrome", { dark: darkOs });
  } catch (e) {
    console.warn("set_theme_chrome", e);
  }
}

setChrome(osDark());
try {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    setChrome(e.matches);
  });
} catch { /* ignore */ }

async function winMin() {
  try {
    await (await appWindow()).minimize();
  } catch (e1) {
    try {
      await invoke("window_minimize");
    } catch (e2) {
      console.warn(e1, e2);
    }
  }
}
async function winMax() {
  try {
    const win = await appWindow();
    if (win.toggleMaximize) await win.toggleMaximize();
    else if (await win.isMaximized()) await win.unmaximize();
    else await win.maximize();
  } catch (e1) {
    try {
      await invoke("window_toggle_maximize");
    } catch (e2) {
      console.warn(e1, e2);
    }
  }
}
async function winClose() {
  try {
    await (await appWindow()).close();
  } catch (e1) {
    try {
      await invoke("window_close");
    } catch (e2) {
      console.warn(e1, e2);
    }
  }
}

function bindBtn(id, fn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.webkitAppRegion = "no-drag";
  el.addEventListener("mousedown", (e) => e.stopPropagation());
  el.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  });
}
bindBtn("tb-min", () => void winMin());
bindBtn("tb-max", () => void winMax());
bindBtn("tb-close", () => void winClose());

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
