// HR maintains people and raises asset requests. Inventory, vendors,
// assignment, and the rest stay with Admin / Asset Manager / Asset Team.
// Manager only sees tickets for people who report to them.

const HR_PATHS = ['/employees', '/tickets'];
const EMPLOYEE_PATHS = ['/my-assets'];
const MANAGER_PATHS = ['/tickets'];

export function homePath(role) {
  if (role === 'HR') {
    return '/employees';
  }
  if (role === 'EMPLOYEE') {
    return '/my-assets';
  }
  if (role === 'MANAGER') {
    return '/tickets';
  }
  return '/dashboard';
}

export function canAccessPath(role, pathname) {
  if (role === 'HR') {
    return HR_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }
  if (role === 'EMPLOYEE') {
    return EMPLOYEE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }
  if (role === 'MANAGER') {
    if (pathname === '/tickets/add' || pathname.startsWith('/tickets/add/')) {
      return false;
    }
    return MANAGER_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  }
  return true;
}

export function navForRole(role, items) {
  if (role === 'HR') {
    return items.filter((item) => HR_PATHS.includes(item.to));
  }
  if (role === 'EMPLOYEE') {
    return items.filter((item) => EMPLOYEE_PATHS.includes(item.to));
  }
  if (role === 'MANAGER') {
    return items.filter((item) => MANAGER_PATHS.includes(item.to));
  }
  return items.filter((item) => item.to !== '/my-assets');
}
