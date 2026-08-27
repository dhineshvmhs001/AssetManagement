import { NavLink, Outlet } from 'react-router-dom';
import '../inventory/Inventory.css';

const LINKS = [
  { to: '/tickets', label: 'Ticket list', end: true },
  { to: '/tickets/add', label: 'Create ticket' },
];

export default function TicketLayout() {
  return (
    <div className="inv">
      <nav className="inv-sub" aria-label="Tickets">
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
