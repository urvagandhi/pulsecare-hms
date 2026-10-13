import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AppointmentRow } from '@/components/Shared/AppointmentRow';
import { DashboardSkeleton } from '@/components/Shared/DashboardSkeleton';
import { Calendar, Users, BarChart3, CheckCircle2, Clock } from 'lucide-react';

interface Appointment {
  _id: string;
  appointmentId?: string;
  timeSlot?: string;
  status?: string;
  type?: string;
  reason?: string;
  tokenNumber?: number;
  date?: string;
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
  doctor?: { specialization?: string };
}

const APPT_SPARK = [4, 6, 5, 8, 7, 9, 8, 12, 10, 12];
const QUEUE_SPARK = [2, 4, 3, 6, 5, 7, 6, 8, 7, 8];
const COMPLETED_SPARK = [3, 5, 6, 7, 8, 9, 10, 11, 12, 14];

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

export function DoctorDashboard() {
  const user = useAppSelector(s => s.auth.user);
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Today's appointments for this doctor/hospital
  const apptQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['doctor-dashboard', 'appointments', today],
    queryFn: () => api.get(`/appointments?date=${today}`).then(r => r.data),
    retry: 1,
  });

  // Upcoming confirmed/scheduled appointments
  const upcomingQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['doctor-dashboard', 'upcoming'],
    queryFn: () => api.get('/appointments?status=scheduled,confirmed&limit=8').then(r => r.data),
    retry: 1,
  });

  // Completed consultations count
  const completedQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['doctor-dashboard', 'completed'],
    queryFn: () => api.get('/appointments?status=completed&limit=20').then(r => r.data),
    retry: 1,
  });

  const todayAppts = apptQ.data?.data ?? [];
  const upcomingAppts = upcomingQ.data?.data ?? [];
  const completedAppts = completedQ.data?.data ?? [];

  const confirmedCount = todayAppts.filter(a => a.status === 'confirmed').length;

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  if (apptQ.isLoading && upcomingQ.isLoading) {
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
            {confirmedCount > 0 && ` · ${confirmedCount} confirmed in consultation queue`}
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
          title="Today's Consultations"
          value={apptQ.isLoading ? '…' : apptQ.isError ? '—' : todayAppts.length}
          trend={`${confirmedCount} confirmed`}
          trendDir="up"
          color="green"
          icon={<Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          sparklineData={APPT_SPARK}
          isLoading={apptQ.isLoading}
        />
        <KpiCard
          title="Upcoming Queue"
          value={upcomingQ.isLoading ? '…' : upcomingQ.isError ? '—' : upcomingAppts.length}
          subtitle="Scheduled & Confirmed"
          trend="In queue"
          trendDir="neutral"
          color="purple"
          icon={<Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          sparklineData={QUEUE_SPARK}
          isLoading={upcomingQ.isLoading}
        />
        <KpiCard
          title="Completed Consultations"
          value={completedQ.isLoading ? '…' : completedQ.isError ? '—' : completedAppts.length}
          trend="Attended"
          trendDir="up"
          color="amber"
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          sparklineData={COMPLETED_SPARK}
          isLoading={completedQ.isLoading}
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
                {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />)}
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
          <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 text-right">
            <Link to="/doctor/schedule" className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline">
              Full schedule & queue →
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
                { icon: <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'My Schedule', sub: 'Consultation queue', to: '/doctor/schedule' },
                { icon: <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />, label: 'Patients', sub: 'Patient directory', to: '/doctor/patients' },
                { icon: <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Analytics', sub: 'Clinical metrics', to: '/analytics' },
                { icon: <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Appointments', sub: 'Today & upcoming', to: '/doctor/schedule' },
              ].map(({ icon, label, sub, to }) => (
                <Link
                  key={label}
                  to={to}
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

          {/* Upcoming Consultations Feed */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Upcoming Queue</h2>
              </div>
              <Link to="/doctor/schedule" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                View all →
              </Link>
            </div>
            <div className="px-5 py-3 divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingQ.isLoading && <div className="h-16 animate-pulse bg-slate-50 dark:bg-slate-800/60 rounded-xl my-2" />}
              {upcomingQ.isError && <p className="text-sm text-rose-500 py-3">Failed to load queue</p>}
              {!upcomingQ.isLoading && !upcomingQ.isError && upcomingAppts.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No upcoming appointments in queue</p>
              )}
              {upcomingAppts.slice(0, 5).map(appt => {
                const patName = getPatientName(appt);
                return (
                  <div key={appt._id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{patName}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {appt.timeSlot ? `${appt.timeSlot} · ` : ''}{appt.reason || 'General Consultation'}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                      {appt.tokenNumber ? `#${appt.tokenNumber}` : (appt.status ?? 'scheduled')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
