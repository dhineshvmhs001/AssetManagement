import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { navForRole } from '../../auth/access';
import ThemeToggle from '../common/ThemeToggle';
import { Icon } from './NavIcons';
import './AppShell.css';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/inventory', label: 'Inventory', icon: 'inventory' },
  { to: '/vendors', label: 'Vendors', icon: 'vendors' },
  { to: '/assignment', label: 'Assignment', icon: 'assignment' },
  { to: '/maintenance', label: 'Maintenance', icon: 'maintenance' },
  { to: '/employees', label: 'Employees', icon: 'employees' },
  { to: '/tickets', label: 'Tickets', icon: 'tickets' },
  { to: '/my-assets', label: 'My assets', icon: 'assignment' },
  { to: '/activity', label: 'Activity Log', icon: 'activity' },
  { to: '/reports', label: 'Reports', icon: 'reports' },
];

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const items = navForRole(user?.role, NAV);
  const inInventory = pathname.startsWith('/inventory');
  const current = items.find((item) =>
    item.to === '/inventory' ? inInventory : pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
  const title = current?.label === 'Dashboard' ? 'My Dashboard' : current?.label || 'Asset Management';

  return (
    <div className="app-frame">
      <div className="app-shell">
        <aside className="app-rail">
          <div className="app-logo" title="Asset Management">
            <img src="/logo.png" alt="" />
          </div>
          <nav className="app-nav" aria-label="Main">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to !== '/inventory'}
                title={item.label}
                aria-label={item.label}
                tabIndex={-1}
                className={({ isActive }) =>
                  item.to === '/inventory' && inInventory ? 'active' : isActive ? 'active' : undefined
                }
              >
                <Icon name={item.icon} />
              </NavLink>
            ))}
          </nav>
          <button type="button" className="app-rail-logout" tabIndex={-1} onClick={logout} title="Log out" aria-label="Log out">
            <Icon name="logout" />
          </button>
        </aside>

        <div className="app-main">
          <header className="app-topbar">
            <h1 className="app-title">{title}</h1>
            <label className="app-search">
              <Icon name="search" />
              <input id="app-search" type="search" placeholder="Search..." aria-label="Search" />
            </label>
            <div className="app-userbox">
              <ThemeToggle embedded tabIndex={-1} />
              <div className="app-user-meta">
                <div className="app-user-name">{user?.name}</div>
                <div className="app-user-role">{user?.roleLabel || user?.role}</div>
              </div>
              <div className="app-avatar" aria-hidden="true">
                {initials(user?.name)}
              </div>
            </div>
          </header>
          <div className="app-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
