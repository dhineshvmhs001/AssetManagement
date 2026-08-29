import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  applySkin,
  persistPref,
  readSkin,
  readStored,
  resolveTheme,
} from './skin';
import { normalizeSkin } from './skins';
import { DEFAULT_LOADER, LOADER_KINDS, normalizeLoader } from '../ui/loaders';

const ThemeContext = createContext(null);

function getInitialColorMode() {
  return readStored('asset-theme', ['light', 'dark', 'system'], 'light');
}

function getInitialDensity() {
  return readStored('asset-density', ['comfortable', 'compact'], 'comfortable');
}

function getInitialLoader() {
  return readStored('asset-loader', LOADER_KINDS, DEFAULT_LOADER);
}

export function ThemeProvider({ children }) {
  const [colorMode, setColorModeState] = useState(getInitialColorMode);
  const [skin, setSkinState] = useState(readSkin);
  const [density, setDensityState] = useState(getInitialDensity);
  const [loader, setLoaderState] = useState(getInitialLoader);
  const [theme, setTheme] = useState(() => resolveTheme(getInitialColorMode()));

  useEffect(() => {
    const next = resolveTheme(colorMode);
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    persistPref('asset-theme', colorMode);
  }, [colorMode]);

  useEffect(() => {
    if (colorMode !== 'system') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next = resolveTheme('system');
      setTheme(next);
      document.documentElement.setAttribute('data-theme', next);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [colorMode]);

  useEffect(() => {
    applySkin(skin);
    persistPref('asset-skin', skin);
  }, [skin]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    persistPref('asset-density', density);
  }, [density]);

  useEffect(() => {
    persistPref('asset-loader', loader);
  }, [loader]);

  const value = useMemo(
    () => ({
      colorMode,
      theme,
      isDark: theme === 'dark',
      setColorMode: setColorModeState,
      toggleTheme: () => setColorModeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
      skin,
      setSkin: (next) => setSkinState(normalizeSkin(next)),
      density,
      setDensity: setDensityState,
      loader,
      setLoader: (next) => setLoaderState(normalizeLoader(next)),
    }),
    [colorMode, theme, skin, density, loader],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
