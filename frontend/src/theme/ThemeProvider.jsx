import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { applySkin, readSkin } from './skin';

const STORAGE_KEY = 'asset-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const ThemeContext = createContext(null);

function readCookie() {
  const match = document.cookie.match(/(?:^|; )asset-theme=(light|dark)/);
  return match ? match[1] : null;
}

function writeCookie(theme) {
  document.cookie = `${STORAGE_KEY}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

function getInitialTheme() {
  try {
    const fromCookie = readCookie();
    if (fromCookie === 'dark' || fromCookie === 'light') {
      return fromCookie;
    }
    const fromStorage = localStorage.getItem(STORAGE_KEY);
    if (fromStorage === 'dark' || fromStorage === 'light') {
      return fromStorage;
    }
  } catch {
    /* ignore */
  }
  return 'light';
}

function persistTheme(theme) {
  try {
    writeCookie(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    persistTheme(theme);
  }, [theme]);

  useEffect(() => {
    applySkin(readSkin());
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
      setTheme,
    }),
    [theme],
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
