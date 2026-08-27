import { NavLink, Outlet } from 'react-router-dom';
import '../inventory/Inventory.css';

const LINKS = [
  { to: '/vendors', label: 'Vendor list', end: true },
  { to: '/vendors/add', label: 'Add vendor' },
];

export default function VendorLayout() {
  return (
    <div className="inv">
      <nav className="inv-sub" aria-label="Vendors">
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
