const ROLES = {
  ADMIN: 'ADMIN',
  HR: 'HR',
  MANAGER: 'MANAGER',
  ASSET_MANAGER: 'ASSET_MANAGER',
  ASSET_TEAM: 'ASSET_TEAM',
  EMPLOYEE: 'EMPLOYEE',
};

const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.HR]: 'HR',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.ASSET_MANAGER]: 'Asset Manager',
  [ROLES.ASSET_TEAM]: 'Asset Team',
  [ROLES.EMPLOYEE]: 'Employee',
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role;
}

module.exports = { ...ROLES, ROLES, ROLE_LABELS, roleLabel };
