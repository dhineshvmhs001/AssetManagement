import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { canAccessPath, homePath } from './access';

export default function RequireAccess() {
  const { user } = useAuth();
  const { pathname } = useLocation();

  if (!canAccessPath(user?.role, pathname)) {
    return <Navigate to={homePath(user?.role)} replace />;
  }

  return <Outlet />;
}

export function RoleHomeRedirect() {
  const { isLoggedIn, user } = useAuth();
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={homePath(user?.role)} replace />;
}

