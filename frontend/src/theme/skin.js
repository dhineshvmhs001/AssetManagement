import { normalizeSkin } from './skins';

const STORAGE_KEY = 'asset-skin';

export function envSkin() {
  return normalizeSkin(import.meta.env.VITE_SKIN);
}

export function readSkin() {
  try {
    const fromQuery = new URLSearchParams(window.location.search).get('skin');
    if (fromQuery === 'reset') {
      localStorage.removeItem(STORAGE_KEY);
      return envSkin();
    }
    if (fromQuery) {
      const skin = normalizeSkin(fromQuery);
      localStorage.setItem(STORAGE_KEY, skin);
      return skin;
    }
  } catch {
    /* ignore */
  }
  return envSkin();
}

export function applySkin(skin) {
  document.documentElement.setAttribute('data-skin', normalizeSkin(skin));
}
