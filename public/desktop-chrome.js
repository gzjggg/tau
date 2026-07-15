/**
 * Desktop chrome — custom titlebar (gzTau Desktop / Tauri). In-app title label: Tau.
 * - Window controls: official window API
 * - Taskbar icon: ONLY via Rust OS SystemUsesLightTheme (never WebView matchMedia)
 * - In-app marks (titlebar/sidebar): follow app UI theme
 */

import { themes, getCurrentTheme } from './themes.js';

let installed = false;
let maxUnlisten = null;

const SVG_MAXIMIZE =
  '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">' +
  '<rect x="1.75" y="1.75" width="8.5" height="8.5" rx="1.6" ry="1.6" stroke="currentColor" stroke-width="1.2" fill="none"/>' +
  '</svg>';

/** Restore: two overlapping rounded squares (matches system-style dual-window glyph) */
const SVG_RESTORE =
  '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">' +
  // back (upper-right)
  '<rect x="3.4" y="1.5" width="7.1" height="7.1" rx="1.55" ry="1.55" stroke="currentColor" stroke-width="1.15" fill="none"/>' +
  // front (lower-left) — filled with current titlebar bg via CSS var fallback to opaque
  '<rect x="1.5" y="3.4" width="7.1" height="7.1" rx="1.55" ry="1.55" stroke="currentColor" stroke-width="1.15" fill="var(--bg-solid, #212121)"/>' +
  '</svg>';

export function isTauDesktop() {
  try {
    return !!(window.__TAURI__ && (window.__TAURI__.core || window.__TAURI__.window));
  } catch {
    return false;
  }
}

function coreInvoke(cmd, args) {
  const core = window.__TAURI__?.core;
  if (!core?.invoke) return Promise.reject(new Error('no tauri core'));
  return core.invoke(cmd, args);
}

async function appWindow() {
  const w = window.__TAURI__?.window;
  if (w?.getCurrentWindow) return w.getCurrentWindow();
  if (w?.getCurrent) return w.getCurrent();
  throw new Error('no tauri window API');
}

function isDarkTheme(themeId = getCurrentTheme()) {
  const t = themes[themeId];
  return t ? !!t.dark : true;
}

async function updateMaximizeButton() {
  const btn = document.getElementById('desktop-tb-max');
  if (!btn) return;
  let maximized = false;
  try {
    maximized = !!(await (await appWindow()).isMaximized());
  } catch {
    try {
      // no-op fallback
    } catch { /* ignore */ }
  }
  btn.innerHTML = maximized ? SVG_RESTORE : SVG_MAXIMIZE;
  btn.setAttribute('aria-label', maximized ? 'Restore' : 'Maximize');
  btn.title = maximized ? '还原' : '最大化';
  btn.dataset.maximized = maximized ? '1' : '0';
}

async function windowMinimize() {
  try {
    await (await appWindow()).minimize();
    return;
  } catch (e) {
    console.warn('[desktop-chrome] minimize via window API failed', e);
  }
  try {
    await coreInvoke('window_minimize');
  } catch (e) {
    console.warn('[desktop-chrome] minimize invoke failed', e);
  }
}

async function windowToggleMaximize() {
  try {
    const win = await appWindow();
    if (typeof win.toggleMaximize === 'function') {
      await win.toggleMaximize();
    } else {
      const max = await win.isMaximized();
      if (max) await win.unmaximize();
      else await win.maximize();
    }
  } catch (e) {
    console.warn('[desktop-chrome] maximize via window API failed', e);
    try {
      await coreInvoke('window_toggle_maximize');
    } catch (e2) {
      console.warn('[desktop-chrome] maximize invoke failed', e2);
    }
  }
  // State settles after the shell animates
  requestAnimationFrame(() => {
    void updateMaximizeButton();
  });
  setTimeout(() => {
    void updateMaximizeButton();
  }, 80);
  setTimeout(() => {
    void updateMaximizeButton();
  }, 200);
}

async function windowClose() {
  try {
    await (await appWindow()).close();
    return;
  } catch (e) {
    console.warn('[desktop-chrome] close via window API failed', e);
  }
  try {
    await coreInvoke('window_close');
  } catch (e) {
    console.warn('[desktop-chrome] close invoke failed', e);
  }
}

function ensureTitlebar() {
  if (document.getElementById('desktop-titlebar')) return;

  const bar = document.createElement('div');
  bar.id = 'desktop-titlebar';
  bar.className = 'desktop-titlebar';
  bar.innerHTML = `
    <div class="desktop-titlebar-left" data-tauri-drag-region>
      <img class="desktop-titlebar-icon" id="desktop-titlebar-icon" alt="" width="16" height="16" draggable="false" />
    </div>
    <div class="desktop-titlebar-center" data-tauri-drag-region>
      <span class="desktop-titlebar-title">Tau</span>
    </div>
    <div class="desktop-titlebar-controls">
      <button type="button" class="desktop-tb-btn" id="desktop-tb-min" aria-label="Minimize" title="最小化">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
      </button>
      <button type="button" class="desktop-tb-btn" id="desktop-tb-max" aria-label="Maximize" title="最大化" data-maximized="0">
        ${SVG_MAXIMIZE}
      </button>
      <button type="button" class="desktop-tb-btn desktop-tb-close" id="desktop-tb-close" aria-label="Close" title="关闭">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
      </button>
    </div>
  `;
  document.body.prepend(bar);
  document.documentElement.classList.add('tau-desktop');
  document.body.classList.add('tau-desktop');

  const controls = bar.querySelector('.desktop-titlebar-controls');
  controls?.style.setProperty('-webkit-app-region', 'no-drag');
  controls?.style.setProperty('app-region', 'no-drag');

  const bind = (id, fn) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });
    el.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
  };
  bind('desktop-tb-min', () => {
    void windowMinimize();
  });
  bind('desktop-tb-max', () => {
    void windowToggleMaximize();
  });
  bind('desktop-tb-close', () => {
    void windowClose();
  });

  bar.querySelector('.desktop-titlebar-center')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    void windowToggleMaximize();
  });
  bar.querySelector('.desktop-titlebar-left')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    void windowToggleMaximize();
  });

  void updateMaximizeButton();
  void wireMaximizeListeners();
}

async function wireMaximizeListeners() {
  try {
    if (maxUnlisten) {
      maxUnlisten();
      maxUnlisten = null;
    }
    const win = await appWindow();
    if (typeof win.onResized === 'function') {
      maxUnlisten = await win.onResized(() => {
        void updateMaximizeButton();
      });
    }
    if (typeof win.onScaleChanged === 'function') {
      await win.onScaleChanged(() => {
        void updateMaximizeButton();
      });
    }
  } catch (e) {
    console.debug('[desktop-chrome] maximize listeners', e);
  }
  // Fallback: poll rarely while focused (covers drag-maximize to top edge)
  window.addEventListener('focus', () => {
    void updateMaximizeButton();
  });
}

function markUrl(darkUi, size) {
  if (size === 192) {
    return darkUi ? '/icons/pi-mark-dark-192.png' : '/icons/pi-mark-light-192.png';
  }
  return darkUi ? '/icons/pi-mark-dark.png' : '/icons/pi-mark-light.png';
}

function updateInAppMarks(darkUi) {
  const href = markUrl(darkUi, 192);
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }
  // Favicon for in-page only — does NOT drive Windows taskbar in Tauri
  link.href = href;

  const small = markUrl(darkUi, 32);
  const tbIcon = document.getElementById('desktop-titlebar-icon');
  if (tbIcon) tbIcon.src = small;

  document.querySelectorAll('img.brand-mark-icon, img.tau-icon.brand-mark-icon').forEach((img) => {
    img.src = small;
    img.style.background = 'transparent';
  });
}

/**
 * Re-apply taskbar icon from Windows SystemUsesLightTheme (Rust).
 * Never pass WebView prefers-color-scheme — that often tracks Apps theme, not taskbar.
 */
async function syncTaskbarIconFromOs() {
  try {
    await coreInvoke('sync_taskbar_icon');
  } catch (e) {
    // Older builds: set_theme_chrome now also ignores bool and uses OS
    try {
      await coreInvoke('set_theme_chrome', { dark: true });
    } catch (e2) {
      console.warn('[desktop-chrome] taskbar icon sync failed', e, e2);
    }
  }
}

/**
 * Sync titlebar/in-app marks with app theme; taskbar always from OS.
 */
export async function syncDesktopChrome(themeId = getCurrentTheme()) {
  if (!isTauDesktop()) return;
  ensureTitlebar();
  const darkUi = isDarkTheme(themeId);
  document.documentElement.dataset.desktopChrome = darkUi ? 'dark' : 'light';

  updateInAppMarks(darkUi);

  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  const bg =
    getComputedStyle(document.documentElement).getPropertyValue('--bg-solid').trim() ||
    (darkUi ? '#212121' : '#f4f1ec');
  meta.content = bg;

  void updateMaximizeButton();
  // Only once per install path for taskbar — OS-driven, not theme-driven
  await syncTaskbarIconFromOs();
}

export function installDesktopChrome() {
  if (!isTauDesktop() || installed) return;
  installed = true;
  ensureTitlebar();
  void syncDesktopChrome();

  const obs = new MutationObserver(() => {
    // Theme change: update in-app chrome only; still re-sync OS taskbar (idempotent)
    void syncDesktopChrome(document.documentElement.getAttribute('data-theme') || getCurrentTheme());
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
