import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { FullPageLoader } from '@/components/Shared/FullPageLoader';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: Array<'admin' | 'doctor' | 'nurse' | 'receptionist' | 'patient'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAppSelector(s => s.auth);
  const location = useLocation();

  if (isLoading) {
    return <FullPageLoader label="Authenticating session..." sublabel="Securing hospital workspace and role permissions" />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
