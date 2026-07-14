/**
 * Desktop chrome — custom titlebar + theme-aware window icon (Tau Desktop / Tauri).
 * Window controls use official @tauri-apps window API (ACL-safe).
 */

import { themes, getCurrentTheme } from './themes.js';

let installed = false;
let lastTaskbarLight = null; // true = light glyph (for dark OS taskbar)

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

/** Windows taskbar is usually dark in dark mode — need light glyph then. */
function osPrefersDark() {
  try {
    return !!window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  } catch {
    return true;
  }
}

/**
 * Taskbar icon: follow OS chrome, not app UI theme.
 * dark OS taskbar → light Pi; light OS taskbar → black Pi.
 */
function taskbarWantsLightGlyph() {
  return osPrefersDark();
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
      return;
    }
    const max = await win.isMaximized();
    if (max) await win.unmaximize();
    else await win.maximize();
    return;
  } catch (e) {
    console.warn('[desktop-chrome] maximize via window API failed', e);
  }
  try {
    await coreInvoke('window_toggle_maximize');
  } catch (e) {
    console.warn('[desktop-chrome] maximize invoke failed', e);
  }
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
    <div class="desktop-titlebar-drag" data-tauri-drag-region>
      <img class="desktop-titlebar-icon" id="desktop-titlebar-icon" alt="" width="16" height="16" draggable="false" />
      <span class="desktop-titlebar-title">Tau</span>
    </div>
    <div class="desktop-titlebar-controls">
      <button type="button" class="desktop-tb-btn" id="desktop-tb-min" aria-label="Minimize" title="Minimize">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 5h8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
      </button>
      <button type="button" class="desktop-tb-btn" id="desktop-tb-max" aria-label="Maximize" title="Maximize">
        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
      </button>
      <button type="button" class="desktop-tb-btn desktop-tb-close" id="desktop-tb-close" aria-label="Close" title="Close">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>
      </button>
    </div>
  `;
  document.body.prepend(bar);
  document.documentElement.classList.add('tau-desktop');
  document.body.classList.add('tau-desktop');

  const controls = bar.querySelector('.desktop-titlebar-controls');
  // Ensure controls never become drag regions
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
  bind('desktop-tb-min', () => { void windowMinimize(); });
  bind('desktop-tb-max', () => { void windowToggleMaximize(); });
  bind('desktop-tb-close', () => { void windowClose(); });

  // Double-click title to maximize (Windows habit)
  bar.querySelector('.desktop-titlebar-drag')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    void windowToggleMaximize();
  });
}

function markUrl(darkUi, size) {
  // darkUi true → light-colored Pi mark asset (*-dark.png naming = glyph for dark backgrounds)
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
  link.href = href;

  const small = markUrl(darkUi, 32);
  const tbIcon = document.getElementById('desktop-titlebar-icon');
  if (tbIcon) tbIcon.src = small;

  document.querySelectorAll('img.brand-mark-icon, img.tau-icon.brand-mark-icon').forEach((img) => {
    img.src = small;
    img.style.background = 'transparent';
  });
}

async function syncTaskbarIcon() {
  const lightGlyph = taskbarWantsLightGlyph();
  if (lastTaskbarLight === lightGlyph) return;
  lastTaskbarLight = lightGlyph;
  // dark=true in Rust means "use light glyph" (for dark chrome/taskbar)
  try {
    await coreInvoke('set_theme_chrome', { dark: lightGlyph });
  } catch (e) {
    console.warn('[desktop-chrome] set_theme_chrome failed', e);
  }
}

/**
 * Sync titlebar surface with app theme; taskbar icon with OS scheme.
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
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-solid').trim()
    || (darkUi ? '#212121' : '#f4f1ec');
  meta.content = bg;

  await syncTaskbarIcon();
}

export function installDesktopChrome() {
  if (!isTauDesktop() || installed) return;
  installed = true;
  ensureTitlebar();
  void syncDesktopChrome();

  const obs = new MutationObserver(() => {
    void syncDesktopChrome(document.documentElement.getAttribute('data-theme') || getCurrentTheme());
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      lastTaskbarLight = null;
      void syncTaskbarIcon();
    });
  } catch { /* ignore */ }
}
