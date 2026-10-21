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
    // Smart redirect for appointment paths
    if (location.pathname.includes('/appointments')) {
      if (user.role === 'doctor') return <Navigate to="/doctor/schedule" replace />;
      if (user.role === 'patient') return <Navigate to="/patient/appointments" replace />;
      if (user.role === 'admin' || user.role === 'receptionist') return <Navigate to="/admin/appointments" replace />;
    }
    // If user is trying to access another role's section, gracefully redirect them to their own dashboard
    if (
      location.pathname.startsWith('/admin') ||
      location.pathname.startsWith('/doctor') ||
      location.pathname.startsWith('/patient') ||
      location.pathname.startsWith('/nurse')
    ) {
      return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children ?? <Outlet />}</>;
}
