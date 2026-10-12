import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AppointmentRow } from '@/components/Shared/AppointmentRow';
import { AlertItem } from '@/components/Shared/AlertItem';
import { DashboardSkeleton } from '@/components/Shared/DashboardSkeleton';
import { Calendar, FlaskConical, Pill, FileText, ClipboardList } from 'lucide-react';

interface Appointment {
  _id: string; timeSlot?: string; status?: string; type?: string; reason?: string; tokenNumber?: number;
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
  doctor?: { specialization?: string };
}
interface LabOrder {
  _id: string; orderId?: string; testName?: string;
  priority?: string; status?: string; createdAt?: string;
  patient?: { userId?: { firstName?: string; lastName?: string } };
}
interface Prescription { _id: string; status?: string; }

const APPT_SPARK = [4, 6, 5, 8, 7, 9, 8, 12, 10, 12];
const LAB_SPARK  = [2, 4, 3, 6, 5, 7, 6, 8, 7, 8];
const RX_SPARK   = [1, 2, 2, 3, 4, 3, 4, 5, 5, 5];

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(appt: Appointment): string {
  const u = appt.patient?.userId;
  return u ? `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() : 'PT';
}

function getPatientName(appt: Appointment): string {
  const u = appt.patient?.userId;
  return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Unknown Patient';
}

function labDotColor(lab: LabOrder): string {
  if (lab.priority === 'urgent' || lab.status === 'critical') return '#ef4444';
  if (lab.status === 'pending' || lab.status === 'processing') return '#f59e0b';
  return '#22c55e';
}

export function DoctorDashboard() {
  const user = useAppSelector(s => s.auth.user);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const apptQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['doctor-dashboard', 'appointments', today],
    queryFn: () => api.get(`/appointments?date=${today}`).then(r => r.data),
  });

  const labQ = useQuery<{ success: boolean; data: LabOrder[] }>({
    queryKey: ['doctor-dashboard', 'lab'],
    queryFn: () => api.get('/lab/orders?limit=5').then(r => r.data),
  });

  const rxQ = useQuery<{ success: boolean; data: Prescription[] }>({
    queryKey: ['doctor-dashboard', 'prescriptions'],
    queryFn: () => api.get('/pharmacy/prescriptions?status=active').then(r => r.data),
  });

  const todayAppts = apptQ.data?.data ?? [];
  const labOrders  = labQ.data?.data ?? [];
  const activePrescriptions = rxQ.data?.data ?? [];

  const criticalLabs = labOrders.filter(l => l.priority === 'urgent' || l.status === 'critical');

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (apptQ.isLoading && labQ.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {greetingByHour()}, Dr. {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {dateLabel} · {todayAppts.length} patients scheduled today
            {criticalLabs.length > 0 && ` · ${criticalLabs.length} critical lab result${criticalLabs.length > 1 ? 's' : ''} need review`}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            to="/doctor/schedule"
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition-all shadow-xs hover:shadow-emerald-600/20"
          >
            My Schedule & Queue →
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Today's Patients"    value={apptQ.isLoading ? '…' : apptQ.isError ? '—' : todayAppts.length}
          trend={`${todayAppts.filter(a => a.status === 'confirmed').length} confirmed`} trendDir="up"
          color="green" icon={<Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />} sparklineData={APPT_SPARK} isLoading={apptQ.isLoading}
        />
        <KpiCard
          title="Pending Lab Orders"  value={labQ.isLoading ? '…' : labQ.isError ? '—' : labOrders.length}
          subtitle={`${criticalLabs.length} critical`}
          trend={criticalLabs.length > 0 ? `${criticalLabs.length} critical` : 'All normal'} trendDir={criticalLabs.length > 0 ? 'down' : 'neutral'}
          color="purple" icon={<FlaskConical className="w-5 h-5 text-teal-600 dark:text-teal-400" />} sparklineData={LAB_SPARK} isLoading={labQ.isLoading}
        />
        <KpiCard
          title="Active Prescriptions" value={rxQ.isLoading ? '…' : rxQ.isError ? '—' : activePrescriptions.length}
          trend="Active" trendDir="neutral"
          color="amber" icon={<Pill className="w-5 h-5 text-amber-600 dark:text-amber-400" />} sparklineData={RX_SPARK} isLoading={rxQ.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's schedule */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Today's Consultation Schedule</h2>
            <Link to="/doctor/schedule" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="px-5 divide-y divide-slate-100 dark:divide-slate-800">
            {apptQ.isLoading && (
              <div className="space-y-3 py-3">
                {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />)}
              </div>
            )}
            {apptQ.isError && <p className="text-sm text-rose-500 py-3">Failed to load schedule</p>}
            {!apptQ.isLoading && !apptQ.isError && todayAppts.length === 0 && (
              <p className="text-xs text-slate-400 py-8 text-center">No patients scheduled for today</p>
            )}
            {todayAppts.slice(0, 6).map(appt => (
              <AppointmentRow
                key={appt._id}
                initials={getInitials(appt)}
                name={getPatientName(appt)}
                meta={[appt.doctor?.specialization, appt.reason, appt.patient?.patientId].filter(Boolean).join(' · ')}
                time={appt.timeSlot ?? '—'}
                status={appt.status ?? 'scheduled'}
                tokenNumber={appt.tokenNumber}
              />
            ))}
          </div>
          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-100 text-right">
            <Link to="/doctor/schedule" className="text-xs font-medium text-emerald-600 hover:text-emerald-800">
              Full schedule →
            </Link>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* Quick actions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
              {[
                { icon: <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Prescribe',         sub: 'New prescription',    to: '/doctor/prescriptions/new' },
                { icon: <FlaskConical className="w-4 h-4 text-teal-600 dark:text-teal-400" />, label: 'Order Lab',         sub: 'Request test',        to: '/doctor/lab/new' },
                { icon: <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Certificate',     sub: 'Medical certificate', to: '/doctor/documents' },
                { icon: <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Patient Notes',     sub: 'Clinical notes',      to: '/doctor/patients' },
              ].map(({ icon, label, sub, to }) => (
                <Link
                  key={label} to={to}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/70 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 flex items-center justify-center shrink-0 group-hover:bg-white dark:group-hover:bg-slate-700">
                    {icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate">{label}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Lab results feed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recent Lab Orders</h2>
              </div>
              <Link to="/doctor/lab" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                View all →
              </Link>
            </div>
            <div className="px-5 py-3">
              {labQ.isLoading && <div className="h-16 animate-pulse bg-slate-50 dark:bg-slate-800/60 rounded-xl my-2" />}
              {labQ.isError && <p className="text-sm text-rose-500 py-3">Failed to load lab results</p>}
              {!labQ.isLoading && !labQ.isError && labOrders.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No recent lab results</p>
              )}
              {labOrders.slice(0, 4).map(lab => {
                const dotColor = labDotColor(lab);
                const patName = lab.patient?.userId
                  ? `${lab.patient.userId.firstName ?? ''} ${lab.patient.userId.lastName ?? ''}`.trim()
                  : '—';
                return (
                  <AlertItem key={lab._id} dotColor={dotColor}
                    time={lab.createdAt ? new Date(lab.createdAt).toLocaleDateString() : undefined}
                  >
                    {(lab.priority === 'urgent' || lab.status === 'critical') && <strong>URGENT — </strong>}
                    {lab.testName ?? 'Lab result'}{patName !== '—' && ` · ${patName}`}
                  </AlertItem>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
