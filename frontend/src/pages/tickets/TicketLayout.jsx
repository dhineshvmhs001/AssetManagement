import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import '../inventory/Inventory.css';

const LINKS = [
  { to: '/tickets', label: 'Ticket list', end: true },
  { to: '/tickets/add', label: 'Create ticket' },
];

export default function TicketLayout() {
  const { user } = useAuth();
  const links = user?.role === 'MANAGER' ? LINKS.filter((link) => link.to !== '/tickets/add') : LINKS;

  return (
    <div className="inv">
      <nav className="inv-sub" aria-label="Tickets">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={Boolean(link.end)} tabIndex={-1}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
