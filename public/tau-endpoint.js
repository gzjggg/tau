/**
 * API / WebSocket base resolution for browser (same-origin) and gzTau Desktop (loopback port).
 *
 * Sources (first wins):
 * 1. window.__TAU_ENDPOINT__ = { http, ws }
 * 2. ?tauPort=38471 query (desktop / debug)
 * 3. Same origin (classic browser mirror)
 */

function normalizeHttp(base) {
  if (!base) return '';
  return String(base).replace(/\/$/, '');
}

export function getTauHttpBase() {
  try {
    if (window.__TAU_ENDPOINT__?.http) {
      return normalizeHttp(window.__TAU_ENDPOINT__.http);
    }
  } catch { /* ignore */ }
  try {
    const p = new URLSearchParams(location.search).get('tauPort');
    if (p && /^\d+$/.test(p)) return `http://127.0.0.1:${p}`;
  } catch { /* ignore */ }
  // Browser: relative same-origin
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    return '';
  }
  return '';
}

export function getWsUrl() {
  try {
    if (window.__TAU_ENDPOINT__?.ws) return window.__TAU_ENDPOINT__.ws;
  } catch { /* ignore */ }
  try {
    const p = new URLSearchParams(location.search).get('tauPort');
    if (p && /^\d+$/.test(p)) return `ws://127.0.0.1:${p}/ws`;
  } catch { /* ignore */ }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export function apiUrl(path) {
  if (!path) return path;
  if (/^https?:\/\//i.test(path) || path.startsWith('ws')) return path;
  const base = getTauHttpBase();
  if (!base) return path;
  return base + (path.startsWith('/') ? path : `/${path}`);
}

export function setTauEndpoint(port) {
  const n = Number(port);
  if (!n) return;
  window.__TAU_ENDPOINT__ = {
    http: `http://127.0.0.1:${n}`,
    ws: `ws://127.0.0.1:${n}/ws`,
  };
}

/** Rewrite relative /api/* fetch to loopback when desktop endpoint is set. */
export function installApiFetchRewrite() {
  if (window.__TAU_FETCH_REWRITTEN__) return;
  window.__TAU_FETCH_REWRITTEN__ = true;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      if (typeof input === 'string') {
        if (input.startsWith('/api/') || input.startsWith('/ws')) {
          input = apiUrl(input);
        }
      }
    } catch { /* ignore */ }
    return orig(input, init);
  };
}

export function hasTauEndpoint() {
  return !!getTauHttpBase() || (location.protocol === 'http:' || location.protocol === 'https:');
}
