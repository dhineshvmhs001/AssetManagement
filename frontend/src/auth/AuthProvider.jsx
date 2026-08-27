import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearSession, getStoredUser, getToken, saveSession } from './session';
import { getMe, login as loginRequest, logout as logoutRequest } from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [token, setToken] = useState(getToken);

  useEffect(() => {
    function onLogout() {
      setToken(null);
      setUser(null);
    }
    window.addEventListener('asset-logout', onLogout);
    return () => window.removeEventListener('asset-logout', onLogout);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      return;
    }
    getMe().then((data) => {
      if (data.ok && data.user) {
        setUser(data.user);
      }
    });
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoggedIn: Boolean(token && user),
      async login(email, password, remember) {
        const data = await loginRequest(email, password, remember);
        if (!data.ok || !data.token || !data.user) {
          return data;
        }
        saveSession({ token: data.token, user: data.user, remember });
        setToken(data.token);
        setUser(data.user);
        return data;
      },
      async logout() {
        try {
          await logoutRequest();
        } catch {
          /* ignore */
        }
        clearSession();
        setToken(null);
        setUser(null);
      },
      async refreshUser() {
        if (!getToken()) {
          return;
        }
        const data = await getMe();
        if (data.ok && data.user) {
          setUser(data.user);
          return;
        }
        clearSession();
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
