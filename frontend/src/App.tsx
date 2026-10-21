import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { store } from '@/store';
import { queryClient } from '@/lib/queryClient';
import { useAppSelector } from '@/store/hooks';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthInitializer } from '@/components/Auth/AuthInitializer';
import { SignIn } from '@/pages/public/SignIn';
import { SignUp } from '@/pages/public/SignUp';
import { Landing } from '@/pages/public/Landing';
import { Unauthorized } from '@/pages/public/Unauthorized';
import { NotFound } from '@/pages/public/NotFound';
import { AdminDashboard } from '@/pages/admin/Dashboard';
import { AdminPatients } from '@/pages/admin/Patients';
import { AdminStaff } from '@/pages/admin/Staff';
import { AdminAppointments } from '@/pages/admin/Appointments';
import { AdminBilling } from '@/pages/admin/Billing';
import { DoctorDashboard } from '@/pages/doctor/Dashboard';
import { DoctorSchedule } from '@/pages/doctor/Schedule';
import { NurseDashboard } from '@/pages/nurse/Dashboard';
import { PatientDashboard } from '@/pages/patient/Dashboard';
import { BookAppointment } from '@/pages/patient/BookAppointment';
import { PatientAppointments } from '@/pages/patient/Appointments';
import { PatientBilling } from '@/pages/patient/Billing';
import { PatientInvoiceDetail } from '@/pages/patient/InvoiceDetail';
import { AdminAnalytics } from '@/pages/admin/Analytics';

import { ComingSoon } from '@/pages/public/ComingSoon';


function DashboardRouter() {
  const user = useAppSelector(s => s.auth.user);

  if (!user) return <Navigate to="/sign-in" replace />;

  switch (user.role) {
    case 'admin':
      return <Navigate to="/admin/dashboard" replace />;
    case 'doctor':
      return <Navigate to="/doctor/dashboard" replace />;
    case 'nurse':
      return <Navigate to="/nurse/dashboard" replace />;
    case 'patient':
      return <Navigate to="/patient/dashboard" replace />;
    case 'receptionist':
      return <Navigate to="/admin/dashboard" replace />;
    default:
      return <Navigate to="/sign-in" replace />;
  }
}

function AppointmentsRouter() {
  const user = useAppSelector(s => s.auth.user);
  if (!user) return <Navigate to="/sign-in" replace />;
  switch (user.role) {
    case 'admin':
    case 'receptionist':
      return <Navigate to="/admin/appointments" replace />;
    case 'doctor':
      return <Navigate to="/doctor/schedule" replace />;
    case 'patient':
      return <Navigate to="/patient/appointments" replace />;
    default:
      return <Navigate to="/dashboard" replace />;
  }
}

function PatientsRouter() {
  const user = useAppSelector(s => s.auth.user);
  if (!user) return <Navigate to="/sign-in" replace />;
  switch (user.role) {
    case 'doctor':
      return <Navigate to="/doctor/patients" replace />;
    default:
      return <Navigate to="/admin/patients" replace />;
  }
}

export default function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthInitializer>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/sign-in" element={<SignIn />} />
            <Route path="/sign-up" element={<SignUp />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Protected routes */}
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/analytics" element={<AdminAnalytics />} />
              <Route path="/appointments" element={<AppointmentsRouter />} />
              <Route path="/patients" element={<PatientsRouter />} />

              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'receptionist']}>
                    <Routes>
                      {/* Core 4 Outpatient Modules */}
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="patients" element={<AdminPatients />} />
                      <Route path="staff" element={<AdminStaff />} />
                      <Route path="appointments" element={<AdminAppointments />} />
                      <Route path="billing" element={<AdminBilling />} />
                      <Route path="billing/:id" element={<AdminBilling />} />
                      <Route path="analytics" element={<AdminAnalytics />} />

                      {/* Phase 2 Enterprise Roadmap Routes */}
                      <Route path="pharmacy" element={<ComingSoon featureName="Pharmacy Management" />} />
                      <Route path="inventory" element={<ComingSoon featureName="Inventory Management" />} />
                      <Route path="lab" element={<ComingSoon featureName="Laboratory Management" />} />
                      <Route path="documents" element={<ComingSoon featureName="Document Management" />} />
                      <Route path="settings" element={<ComingSoon featureName="Hospital Settings" />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/doctor/*"
                element={
                  <ProtectedRoute allowedRoles={['doctor']}>
                    <Routes>
                      {/* Core 4 Outpatient Modules */}
                      <Route path="dashboard" element={<DoctorDashboard />} />
                      <Route path="schedule" element={<DoctorSchedule />} />
                      <Route path="appointments" element={<DoctorSchedule />} />
                      <Route path="patients" element={<AdminPatients />} />
                      <Route path="analytics" element={<AdminAnalytics />} />

                      {/* Phase 2 Enterprise Roadmap Routes */}
                      <Route path="prescriptions" element={<ComingSoon featureName="e-Prescriptions" />} />
                      <Route path="lab" element={<ComingSoon featureName="Lab Orders" />} />
                      <Route path="documents" element={<ComingSoon featureName="Clinical Documents" />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/nurse/*"
                element={
                  <ProtectedRoute allowedRoles={['nurse']}>
                    <Routes>
                      {/* Core 4 Outpatient Modules */}
                      <Route path="dashboard" element={<NurseDashboard />} />
                      <Route path="analytics" element={<AdminAnalytics />} />

                      {/* Phase 2 Enterprise Roadmap Routes */}
                      <Route path="dispensing" element={<ComingSoon featureName="Medication Dispensing" />} />
                      <Route path="inventory" element={<ComingSoon featureName="Ward Inventory" />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/patient/*"
                element={
                  <ProtectedRoute allowedRoles={['patient']}>
                    <Routes>
                      {/* Core 4 Outpatient Modules */}
                      <Route path="dashboard" element={<PatientDashboard />} />
                      <Route path="book-appointment" element={<BookAppointment />} />
                      <Route path="appointments" element={<PatientAppointments />} />
                      <Route path="billing" element={<PatientBilling />} />
                      <Route path="billing/:id" element={<PatientInvoiceDetail />} />
                      <Route path="analytics" element={<AdminAnalytics />} />

                      {/* Phase 2 Enterprise Roadmap Routes */}
                      <Route path="prescriptions" element={<ComingSoon featureName="My Prescriptions & Refills" />} />
                      <Route path="lab" element={<ComingSoon featureName="Diagnostic Lab Results" />} />
                      <Route path="lab/:id" element={<ComingSoon featureName="Diagnostic Lab Results" />} />
                      <Route path="documents" element={<ComingSoon featureName="Medical Documents" />} />
                    </Routes>
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </AuthInitializer>
        </BrowserRouter>
        <Toaster position="top-right" />
      </QueryClientProvider>
    </Provider>
  );
}
