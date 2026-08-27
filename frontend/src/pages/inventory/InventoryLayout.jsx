import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { isTypingTarget } from '../../keyboard/keys';
import { allowNav } from '../../keyboard/navGuard';
import { useKeyboard } from '../../keyboard/KeyboardProvider';
import './Inventory.css';

const LINKS = [
  { to: '/inventory', label: 'Asset list', end: true },
  { to: '/inventory/add', label: 'Add asset' },
  { to: '/inventory/import', label: 'Bulk import' },
];

function subIndex(pathname) {
  if (pathname.startsWith('/inventory/add')) {
    return 1;
  }
  if (pathname.startsWith('/inventory/import')) {
    return 2;
  }
  if (pathname === '/inventory') {
    return 0;
  }
  return -1;
}

export default function InventoryLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const kbd = useKeyboard();

  useEffect(() => {
    function onKey(e) {
      if (kbd?.helpOpen || isTypingTarget(e.target)) {
        return;
      }
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        return;
      }
      const i = subIndex(pathname);
      if (i < 0) {
        return;
      }
      e.preventDefault();
      if (!allowNav()) {
        return;
      }
      const next = e.key === 'ArrowRight' ? (i + 1) % LINKS.length : (i - 1 + LINKS.length) % LINKS.length;
      navigate(LINKS[next].to);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kbd?.helpOpen, navigate, pathname]);

  return (
    <div className="inv">
      <nav className="inv-sub" aria-label="Inventory">
        {LINKS.map((link) => (
          <NavLink key={link.to} to={link.to} end={Boolean(link.end)} tabIndex={-1}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
