import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AppointmentRow } from '@/components/Shared/AppointmentRow';
import { AlertItem } from '@/components/Shared/AlertItem';
import { StatBar } from '@/components/Shared/StatBar';
import { StatusBadge } from '@/components/Shared/StatusBadge';
import { DashboardSkeleton } from '@/components/Shared/DashboardSkeleton';
import { Users, Calendar, DollarSign, Clock, Bell, UserPlus, ClipboardList, BarChart3, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';

// Minimal types for dashboard queries
interface Patient {
  _id: string;
}

interface Appointment {
  _id: string;
  timeSlot?: string;
  status?: string;
  type?: string;
  reason?: string;
  tokenNumber?: number;
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
  doctor?: { specialization?: string; userId?: { firstName?: string; lastName?: string } };
}

interface DashboardInvoice {
  _id: string;
  invoiceId: string;
  patient?: { userId?: { firstName?: string; lastName?: string } };
  total: number;
  balance: number;
  status: 'draft' | 'issued' | 'paid' | 'partial' | 'overdue' | 'void';
  createdAt: string;
}

const DEPT_STATS = [
  { label: 'Cardiology',   value: 82, color: '#6366f1' },
  { label: 'General Med',  value: 67, color: '#10b981' },
  { label: 'Orthopedics',  value: 45, color: '#f59e0b' },
  { label: 'Neurology',    value: 58, color: '#0ea5e9' },
];

const PATIENT_SPARK  = [40, 45, 38, 52, 48, 60, 55, 70, 65, 80];
const APPT_SPARK     = [20, 28, 22, 35, 30, 42, 38, 48, 44, 50];
const REVENUE_SPARK  = [30, 40, 35, 50, 45, 58, 52, 65, 60, 75];
const STAFF_SPARK    = [28, 30, 29, 32, 31, 33, 30, 32, 31, 32];

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(a?: Appointment | null): string {
  const u = a?.patient?.userId;
  return u ? `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() : 'PT';
}

function getPatientName(a: Appointment): string {
  const u = a.patient?.userId;
  return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Unknown Patient';
}

function getDoctorMeta(a: Appointment): string {
  const u = a.doctor?.userId;
  const spec = a.doctor?.specialization ?? '';
  return u ? `${spec} · Dr. ${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : spec;
}

export function AdminDashboard() {
  const user = useAppSelector(s => s.auth.user);
  const isAdmin = user?.role === 'admin';
  const [apptTab, setApptTab] = useState<'today' | 'upcoming'>('today');

  const patientsQ = useQuery<{ success: boolean; data: Patient[] }>({
    queryKey: ['admin-dash', 'patients'],
    queryFn: () => api.get('/patients?limit=1000').then(r => r.data),
  });

  const apptQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['appointments', 'today'],
    queryFn: () => api.get('/appointments?date=today&limit=10').then(r => r.data),
  });

  const upcomingQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['appointments', 'upcoming'],
    queryFn: () => api.get('/appointments?status=scheduled,confirmed&limit=10').then(r => r.data),
  });

  // Admin-only revenue analytics endpoint
  const revenueQ = useQuery<{
    success: boolean;
    data: {
      byMonth: { _id: string; revenue: number; count: number }[];
      outstanding: number;
    };
  }>({
    queryKey: ['analytics-revenue'],
    queryFn: () => api.get('/analytics/revenue').then(r => r.data),
    enabled: isAdmin,
  });

  // Billing list endpoint accessible to both admin and receptionist
  const invoicesQ = useQuery<{
    success: boolean;
    data: DashboardInvoice[];
    meta?: { total: number };
  }>({
    queryKey: ['admin-dash', 'invoices-attention'],
    queryFn: () => api.get('/billing?status=issued,partial,draft&limit=5').then(r => r.data),
  });

  const totalPatients   = patientsQ.data?.data?.length ?? 0;
  const todayAppts      = apptQ.data?.data ?? [];
  const upcomingAppts   = upcomingQ.data?.data ?? [];
  const pendingInvoices = invoicesQ.data?.data ?? [];
  const mtdRevenue      = revenueQ.data?.data?.byMonth?.[0]?.revenue ?? 0;

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const alerts = [
    ...(todayAppts.slice(0, 1).map((a) => ({
      dotColor: '#3b82f6',
      text: `Appointment today: ${getPatientName(a)} (${a.timeSlot ?? 'scheduled'})`,
      time: 'Today',
    }))),
    ...(pendingInvoices.slice(0, 1).map((inv) => ({
      dotColor: '#f59e0b',
      text: `Invoice ${inv.invoiceId} awaiting settlement (₹${inv.balance.toFixed(2)})`,
      time: 'Attention',
    }))),
    {
      dotColor: '#22c55e',
      text: 'PulseCare HMS core modules active & operational',
      time: 'Now',
    },
  ].slice(0, 3);

  const isInitialLoading = patientsQ.isLoading && apptQ.isLoading;
  if (isInitialLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {greetingByHour()}, {user?.firstName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {dateLabel} · Hospital Operational Center
          </p>
        </div>
        {isAdmin ? (
          <Link
            to="/admin/analytics"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-4 py-2 rounded-xl transition-all border border-emerald-200/80 dark:border-emerald-800 shrink-0 self-start sm:self-auto"
          >
            <BarChart3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Analytics Overview →
          </Link>
        ) : (
          <Link
            to="/admin/billing"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 px-4 py-2 rounded-xl transition-all border border-emerald-200/80 dark:border-emerald-800 shrink-0 self-start sm:self-auto"
          >
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            Billing Overview →
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Total Patients"
          value={patientsQ.isLoading ? '…' : patientsQ.isError ? '—' : totalPatients.toLocaleString()}
          trend="Active Records"
          trendDir="up"
          color="blue"
          icon={<Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          sparklineData={PATIENT_SPARK}
          isLoading={patientsQ.isLoading}
        />
        <KpiCard
          title="Appointments Today"
          value={apptQ.isLoading ? '…' : todayAppts.length}
          trend={`${todayAppts.filter(a => a.status === 'scheduled').length} pending`}
          trendDir="neutral"
          color="green"
          icon={<Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          sparklineData={APPT_SPARK}
          isLoading={apptQ.isLoading}
        />
        {isAdmin ? (
          <KpiCard
            title="Revenue (MTD)"
            value={revenueQ.isLoading ? '…' : revenueQ.isError ? '—' : `₹${(mtdRevenue / 1000).toFixed(1)}K`}
            trend={revenueQ.data?.data?.outstanding ? `₹${revenueQ.data.data.outstanding.toLocaleString()} outstanding` : 'Up to date'}
            trendDir="up"
            color="amber"
            icon={<DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            sparklineData={REVENUE_SPARK}
            isLoading={revenueQ.isLoading}
          />
        ) : (
          <KpiCard
            title="Pending Invoices"
            value={invoicesQ.isLoading ? '…' : (invoicesQ.data?.meta?.total ?? pendingInvoices.length)}
            trend="Awaiting payment"
            trendDir="neutral"
            color="amber"
            icon={<DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
            sparklineData={REVENUE_SPARK}
            isLoading={invoicesQ.isLoading}
          />
        )}
        <KpiCard
          title="Upcoming Visits"
          value={upcomingQ.isLoading ? '…' : upcomingAppts.length}
          trend="Scheduled ahead"
          trendDir="up"
          color="purple"
          icon={<Clock className="w-5 h-5 text-teal-600 dark:text-teal-400" />}
          sparklineData={STAFF_SPARK}
          isLoading={upcomingQ.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Appointments card */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 gap-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Appointments Queue</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                {(['today', 'upcoming'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setApptTab(tab)}
                    className={cn(
                      'px-3 py-1 text-xs font-semibold rounded-lg transition-all capitalize',
                      apptTab === tab ? 'bg-white dark:bg-slate-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <Link to="/admin/appointments" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                View all →
              </Link>
            </div>
          </div>
          <div className="px-4 divide-y divide-slate-50">
            {apptTab === 'today' && (
              <>
                {apptQ.isLoading && (
                  <div className="space-y-3 py-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />)}
                  </div>
                )}
                {!apptQ.isLoading && todayAppts.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-6 text-center">No appointments scheduled today</p>
                )}
                {todayAppts.map(appt => (
                  <AppointmentRow
                    key={appt._id}
                    initials={getInitials(appt)}
                    name={getPatientName(appt)}
                    meta={getDoctorMeta(appt)}
                    time={appt.timeSlot ?? '—'}
                    status={appt.status ?? 'scheduled'}
                    tokenNumber={appt.tokenNumber}
                  />
                ))}
              </>
            )}
            {apptTab === 'upcoming' && (
              <>
                {upcomingQ.isLoading && (
                  <div className="space-y-3 py-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />)}
                  </div>
                )}
                {!upcomingQ.isLoading && upcomingAppts.length === 0 && (
                  <p className="text-[12px] text-slate-400 py-6 text-center">No upcoming appointments</p>
                )}
                {upcomingAppts.map(appt => (
                  <AppointmentRow
                    key={appt._id}
                    initials={getInitials(appt)}
                    name={getPatientName(appt)}
                    meta={getDoctorMeta(appt)}
                    time={appt.timeSlot ?? '—'}
                    status={appt.status ?? 'scheduled'}
                    tokenNumber={appt.tokenNumber}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* Quick Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
              {[
                { icon: <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'New Patient',      sub: 'Register',       to: '/admin/patients' },
                { icon: <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Appointments',     sub: 'Manage visits',  to: '/admin/appointments' },
                { icon: <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />, label: 'Billing',          sub: 'Manage bills',   to: '/admin/billing' },
                ...(isAdmin
                  ? [{ icon: <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />, label: 'Staff & Team', sub: 'Manage team',    to: '/admin/staff' }]
                  : [{ icon: <ClipboardList className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Patient List', sub: 'Directory',      to: '/admin/patients' }]),
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

          {/* Live Alerts */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Operational Alerts</h2>
            </div>
            <div className="px-5 py-3">
              {alerts.map((a, i) => <AlertItem key={i} dotColor={a.dotColor} time={a.time}>{a.text}</AlertItem>)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid — department load + invoices needing attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-slate-900">Department Load</h2>
            {isAdmin && (
              <Link to="/admin/analytics" className="text-[11px] text-indigo-600 hover:underline font-semibold">
                View report →
              </Link>
            )}
          </div>
          {DEPT_STATS.map(d => (
            <StatBar key={d.label} label={d.label} value={d.value} max={100} color={d.color} />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <h2 className="text-[13px] font-bold text-slate-900">Invoices Needing Attention</h2>
            <Link to="/admin/billing" className="text-[11px] text-indigo-600 hover:underline font-semibold">
              View all →
            </Link>
          </div>
          <div className="px-4 divide-y divide-slate-50">
            {invoicesQ.isLoading && (
              <div className="space-y-2 py-3">
                {[1, 2, 3].map(i => <div key={i} className="h-7 bg-slate-100 rounded animate-pulse" />)}
              </div>
            )}
            {invoicesQ.isError && (
              <p className="text-sm text-red-500 px-4 py-2">Failed to load invoices</p>
            )}
            {!invoicesQ.isLoading && pendingInvoices.length === 0 && (
              <p className="text-[12px] text-slate-400 py-6 text-center">No invoices requiring attention</p>
            )}
            {pendingInvoices.map(inv => {
              const patName = inv.patient?.userId
                ? `${inv.patient.userId.firstName ?? ''} ${inv.patient.userId.lastName ?? ''}`.trim()
                : 'Patient';
              const createdLabel = inv.createdAt
                ? new Date(inv.createdAt).toLocaleDateString()
                : '—';
              return (
                <div key={inv._id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-slate-800 truncate">
                      {inv.invoiceId} · {patName}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Total: ₹{inv.total.toFixed(2)} · Balance: ₹{inv.balance.toFixed(2)} · {createdLabel}
                    </p>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
