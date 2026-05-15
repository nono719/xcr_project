import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, type Role } from '../hooks/useAuth';
import { Spin } from 'antd';

export function PrivateRoute({ children }: { children: JSX.Element }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <div className="h-screen flex items-center justify-center"><Spin /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return children;
}

export function RoleRoute({ children, roles }: { children: JSX.Element; roles: Role[] }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="h-screen flex items-center justify-center"><Spin /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}
