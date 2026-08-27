import { NavLink, Outlet } from 'react-router-dom';
import '../inventory/Inventory.css';

const LINKS = [
  { to: '/employees', label: 'Employee list', end: true },
  { to: '/employees/add', label: 'Add employee' },
];

export default function EmployeeLayout() {
  return (
    <div className="inv">
      <nav className="inv-sub" aria-label="Employees">
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
