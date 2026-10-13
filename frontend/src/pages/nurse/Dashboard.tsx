import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { DashboardSkeleton } from '@/components/Shared/DashboardSkeleton';
import { Users, Calendar, CheckCircle2, Clock, Activity, BarChart3 } from 'lucide-react';

interface Patient {
  _id: string;
  patientId?: string;
  userId?: { firstName?: string; lastName?: string; email?: string };
}

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
  doctor?: { specialization?: string; userId?: { firstName?: string; lastName?: string } };
}

const CHECKIN_SPARK = [3, 5, 4, 6, 7, 8, 9, 10, 11, 12];
const APPT_SPARK    = [5, 8, 7, 9, 8, 12, 11, 14, 13, 15];
const TRIAGE_SPARK  = [2, 3, 2, 4, 3, 5, 4, 6, 5, 6];

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function NurseDashboard() {
  const user = useAppSelector(s => s.auth.user);

  const apptsQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['nurse-dashboard', 'appointments'],
    queryFn: () => api.get('/appointments?limit=15').then(r => r.data),
    retry: 1,
  });

  const patientsQ = useQuery<{ success: boolean; data: Patient[] }>({
    queryKey: ['nurse-dashboard', 'patients'],
    queryFn: () => api.get('/patients?limit=10').then(r => r.data),
    retry: 1,
  });

  const appointments: Appointment[] = apptsQ.data?.data ?? [];
  const patients: Patient[] = patientsQ.data?.data ?? [];

  const confirmedAppts = appointments.filter(a => a.status === 'confirmed');
  const inProgressAppts = appointments.filter(a => a.status === 'inProgress');
  const completedAppts = appointments.filter(a => a.status === 'completed');

  if (apptsQ.isLoading && patientsQ.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {greetingByHour()}, Nurse {user?.firstName} {user?.lastName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Clinical Nursing Station · {confirmedAppts.length} patients ready for intake & triage
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/analytics"
            className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-4 py-2 rounded-xl transition-all border border-emerald-200/80 dark:border-emerald-800 inline-flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Station Analytics
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          title="Triage Intake Queue"
          value={apptsQ.isLoading ? '…' : confirmedAppts.length}
          trend={`${inProgressAppts.length} in consultation`}
          trendDir="neutral"
          color="amber"
          icon={<Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          sparklineData={TRIAGE_SPARK}
          isLoading={apptsQ.isLoading}
        />
        <KpiCard
          title="Scheduled Visits Today"
          value={apptsQ.isLoading ? '…' : appointments.length}
          trend="Total in queue"
          trendDir="up"
          color="green"
          icon={<Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          sparklineData={APPT_SPARK}
          isLoading={apptsQ.isLoading}
        />
        <KpiCard
          title="Attended Patients"
          value={apptsQ.isLoading ? '…' : completedAppts.length}
          trend="Discharged"
          trendDir="up"
          color="purple"
          icon={<CheckCircle2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          sparklineData={CHECKIN_SPARK}
          isLoading={apptsQ.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Patient intake queue */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Patient Care & Intake Queue
            </h2>
            <span className="text-xs font-semibold text-slate-400">Live Intake</span>
          </div>
          <div className="px-5 divide-y divide-slate-100 dark:divide-slate-800">
            {apptsQ.isLoading && (
              <div className="space-y-3 py-3">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />)}
              </div>
            )}
            {apptsQ.isError && <p className="text-sm text-rose-500 py-3">Failed to load intake queue</p>}
            {!apptsQ.isLoading && appointments.length === 0 && (
              <p className="text-xs text-slate-400 py-8 text-center">No patients currently in intake queue</p>
            )}
            {appointments.slice(0, 7).map(appt => {
              const pat = appt.patient?.userId;
              const patName = pat ? `${pat.firstName ?? ''} ${pat.lastName ?? ''}`.trim() : 'Patient';
              const doc = appt.doctor?.userId;
              const docName = doc ? `Dr. ${doc.firstName ?? ''} ${doc.lastName ?? ''}`.trim() : 'Attending Physician';

              return (
                <div key={appt._id} className="flex items-center justify-between py-3 text-xs gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 dark:text-slate-200 truncate">
                      {patName}
                      {appt.tokenNumber && (
                        <span className="ml-2 font-mono text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-800">
                          #{appt.tokenNumber}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {appt.timeSlot ? `${appt.timeSlot} · ` : ''}{appt.reason || 'General Intake'} · {docName}
                    </p>
                  </div>
                  <span className="shrink-0 capitalize font-medium text-[10px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    {appt.status ?? 'scheduled'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 space-y-5">
          {/* Quick tools */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Nursing Station Tools</h2>
            <div className="space-y-2">
              <Link
                to="/analytics"
                className="flex items-center justify-between p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-800/60 bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-100/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all"
              >
                <span>Station Analytics & Reports</span>
                <span>→</span>
              </Link>
            </div>
          </div>

          {/* Recent patients admitted */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Active Patient Records
              </h2>
            </div>
            <div className="p-4 space-y-2.5">
              {patientsQ.isLoading && <div className="h-16 animate-pulse bg-slate-50 dark:bg-slate-800/60 rounded-xl" />}
              {patients.slice(0, 4).map(p => {
                const name = p.userId ? `${p.userId.firstName ?? ''} ${p.userId.lastName ?? ''}`.trim() : 'Patient';
                return (
                  <div key={p._id} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{name}</p>
                      <p className="text-[10px] text-slate-400">{p.patientId || p._id}</p>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Registered</span>
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
