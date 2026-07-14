/**
 * Desktop chrome — custom titlebar + theme-aware window icon when running inside Tau Desktop (Tauri).
 * No-ops in the regular browser.
 */

import { themes, getCurrentTheme } from './themes.js';

let installed = false;
let lastDark = null;

export function isTauDesktop() {
  try {
    return !!(window.__TAURI__ && window.__TAURI__.core);
  } catch {
    return false;
  }
}

function invoke(cmd, args) {
  return window.__TAURI__.core.invoke(cmd, args);
}

function isDarkTheme(themeId = getCurrentTheme()) {
  const t = themes[themeId];
  return t ? !!t.dark : true;
}

function ensureTitlebar() {
  if (document.getElementById('desktop-titlebar')) return;

  const bar = document.createElement('div');
  bar.id = 'desktop-titlebar';
  bar.className = 'desktop-titlebar';
  bar.innerHTML = `
    <div class="desktop-titlebar-drag" data-tauri-drag-region>
      <img class="desktop-titlebar-icon" id="desktop-titlebar-icon" alt="" width="16" height="16" />
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

  document.getElementById('desktop-tb-min')?.addEventListener('click', () => {
    invoke('window_minimize').catch(() => {});
  });
  document.getElementById('desktop-tb-max')?.addEventListener('click', () => {
    invoke('window_toggle_maximize').catch(() => {});
  });
  document.getElementById('desktop-tb-close')?.addEventListener('click', () => {
    invoke('window_close').catch(() => {});
  });
}

function markUrl(dark, size) {
  if (size === 192) {
    return dark ? '/icons/pi-mark-dark-192.png' : '/icons/pi-mark-light-192.png';
  }
  return dark ? '/icons/pi-mark-dark.png' : '/icons/pi-mark-light.png';
}

function updateFavicon(dark) {
  const href = markUrl(dark, 192);
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }
  link.href = href;

  const small = markUrl(dark, 32);
  const tbIcon = document.getElementById('desktop-titlebar-icon');
  if (tbIcon) tbIcon.src = small;

  // Sidebar / welcome brand: transparent glyph only
  document.querySelectorAll('img.brand-mark-icon, img.tau-icon.brand-mark-icon').forEach((img) => {
    img.src = small;
    img.style.background = 'transparent';
  });
}

/**
 * Sync titlebar surface + window/taskbar icon with current theme.
 */
export async function syncDesktopChrome(themeId = getCurrentTheme()) {
  if (!isTauDesktop()) return;
  ensureTitlebar();
  const dark = isDarkTheme(themeId);
  document.documentElement.dataset.desktopChrome = dark ? 'dark' : 'light';

  updateFavicon(dark);

  // theme-color meta for OS chrome hints
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-solid').trim()
    || (dark ? '#212121' : '#f4f1ec');
  meta.content = bg;

  if (lastDark === dark) return;
  lastDark = dark;
  try {
    await invoke('set_theme_chrome', { dark });
  } catch (e) {
    // Older desktop build without command — ignore
    console.debug('[desktop-chrome]', e);
  }
}

export function installDesktopChrome() {
  if (!isTauDesktop() || installed) return;
  installed = true;
  ensureTitlebar();
  syncDesktopChrome();

  // Observe theme attribute changes (applyTheme sets data-theme)
  const obs = new MutationObserver(() => {
    syncDesktopChrome(document.documentElement.getAttribute('data-theme') || getCurrentTheme());
  });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
