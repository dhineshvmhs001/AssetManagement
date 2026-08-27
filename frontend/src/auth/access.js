// HR maintains people and raises asset requests. Inventory, vendors,
// assignment, and the rest stay with Admin / Asset Manager / Asset Team.

const HR_PATHS = ['/employees', '/tickets'];

export function homePath(role) {
  return role === 'HR' ? '/employees' : '/dashboard';
}

export function canAccessPath(role, pathname) {
  if (role !== 'HR') {
    return true;
  }
  return HR_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function navForRole(role, items) {
  if (role !== 'HR') {
    return items;
  }
  return items.filter((item) => HR_PATHS.includes(item.to));
}
