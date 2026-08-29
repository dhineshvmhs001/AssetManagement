import { normalizeSkin, SKINS } from './skins';

const YEAR = 60 * 60 * 24 * 365;

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${YEAR}; SameSite=Lax`;
}

export function envSkin() {
  return normalizeSkin(import.meta.env.VITE_SKIN);
}

export function readStored(name, allowed, fallback) {
  try {
    const fromCookie = readCookie(name);
    if (allowed.includes(fromCookie)) {
      return fromCookie;
    }
    const fromStorage = localStorage.getItem(name);
    if (allowed.includes(fromStorage)) {
      return fromStorage;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function persistPref(name, value) {
  try {
    writeCookie(name, value);
    localStorage.setItem(name, value);
  } catch {
    /* ignore */
  }
}

export function readSkin() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('skin');
    if (fromQuery === 'reset') {
      persistPref('asset-skin', envSkin());
      return envSkin();
    }
    if (fromQuery) {
      return normalizeSkin(fromQuery);
    }
  } catch {
    /* ignore */
  }
  return normalizeSkin(readStored('asset-skin', SKINS, envSkin()));
}

export function applySkin(skin) {
  document.documentElement.setAttribute('data-skin', normalizeSkin(skin));
}

export function systemIsDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(colorMode) {
  if (colorMode === 'system') {
    return systemIsDark() ? 'dark' : 'light';
  }
  return colorMode === 'dark' ? 'dark' : 'light';
}
