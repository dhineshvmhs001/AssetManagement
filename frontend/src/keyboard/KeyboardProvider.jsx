import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { canAccessPath } from '../auth/access';
import { isTypingTarget, cycleRail } from './keys';
import { allowNav, pageHasForm } from './navGuard';
import ShortcutHelp from './ShortcutHelp';

const KeyboardContext = createContext(null);

const GO = {
  d: '/dashboard',
  i: '/inventory',
  v: '/vendors',
  a: '/assignment',
  m: '/maintenance',
  e: '/employees',
  t: '/tickets',
  l: '/activity',
  r: '/reports',
};

export function KeyboardProvider({ children }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [helpOpen, setHelpOpen] = useState(false);
  const pendingG = useRef(false);
  const gTimer = useRef(null);

  useEffect(() => {
    function clearG() {
      pendingG.current = false;
      if (gTimer.current) {
        clearTimeout(gTimer.current);
        gTimer.current = null;
      }
    }

    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (e.key === 'Escape') {
        if (helpOpen) {
          e.preventDefault();
          setHelpOpen(false);
          return;
        }
        if (/^\/inventory\/(?!add$|import$).+/.test(pathname)) {
          e.preventDefault();
          if (allowNav()) {
            navigate('/inventory');
          }
        }
        return;
      }

      if (isTypingTarget(e.target) && e.key !== 'Escape') {
        return;
      }

      if (e.key === 'Tab') {
        // On a form page, Tab must reach the form's own controls. Only take
        // it over for the sidebar rail on pages that have no form.
        if (helpOpen || pageHasForm()) {
          return;
        }
        e.preventDefault();
        cycleRail(e.shiftKey ? -1 : 1);
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }

      if (helpOpen) {
        return;
      }

      if (e.key === '/') {
        e.preventDefault();
        const list = document.getElementById('inv-list-search');
        const header = document.getElementById('app-search');
        (list || header)?.focus();
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        if (pathname.startsWith('/inventory')) {
          e.preventDefault();
          if (allowNav()) {
            navigate('/inventory/add');
          }
        }
        return;
      }

      if (pendingG.current) {
        const path = GO[e.key.toLowerCase()];
        clearG();
        if (path && canAccessPath(user?.role, path)) {
          e.preventDefault();
          if (allowNav()) {
            navigate(path);
          }
        }
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        e.preventDefault();
        pendingG.current = true;
        gTimer.current = setTimeout(clearG, 800);
      }
    }

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearG();
    };
  }, [helpOpen, navigate, pathname, user?.role]);

  const value = useMemo(() => ({ helpOpen, setHelpOpen }), [helpOpen]);

  return (
    <KeyboardContext.Provider value={value}>
      {children}
      {helpOpen && <ShortcutHelp onClose={() => setHelpOpen(false)} />}
    </KeyboardContext.Provider>
  );
}

export function useKeyboard() {
  return useContext(KeyboardContext);
}
