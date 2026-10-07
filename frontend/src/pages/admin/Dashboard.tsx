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
      text: `Invoice ${inv.invoiceId} awaiting settlement ($${inv.balance.toFixed(2)})`,
      time: 'Attention',
    }))),
    {
      dotColor: '#22c55e',
      text: 'PulseCare HMS core modules active & operational',
      time: 'Now',
    },
  ].slice(0, 3);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {greetingByHour()}, {user?.firstName} 👋
          </h1>
          <p className="text-[12px] text-slate-500 mt-0.5">
            {dateLabel} · Hospital Overview
          </p>
        </div>
        {isAdmin ? (
          <Link
            to="/admin/analytics"
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
          >
            📊 Analytics →
          </Link>
        ) : (
          <Link
            to="/admin/billing"
            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors"
          >
            💰 Billing Overview →
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Patients"
          value={patientsQ.isLoading ? '…' : patientsQ.isError ? '—' : totalPatients.toLocaleString()}
          trend="Active Records"
          trendDir="up"
          color="blue"
          icon="🏥"
          sparklineData={PATIENT_SPARK}
          isLoading={patientsQ.isLoading}
        />
        <KpiCard
          title="Appointments Today"
          value={apptQ.isLoading ? '…' : todayAppts.length}
          trend={`${todayAppts.filter(a => a.status === 'scheduled').length} pending`}
          trendDir="neutral"
          color="green"
          icon="📅"
          sparklineData={APPT_SPARK}
          isLoading={apptQ.isLoading}
        />
        {isAdmin ? (
          <KpiCard
            title="Revenue (MTD)"
            value={revenueQ.isLoading ? '…' : revenueQ.isError ? '—' : `$${(mtdRevenue / 1000).toFixed(1)}K`}
            trend={revenueQ.data?.data?.outstanding ? `$${revenueQ.data.data.outstanding.toLocaleString()} outstanding` : 'Up to date'}
            trendDir="up"
            color="amber"
            icon="💰"
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
            icon="💰"
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
          icon="👥"
          sparklineData={STAFF_SPARK}
          isLoading={upcomingQ.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Appointments card - takes 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
            <h2 className="text-[13px] font-bold text-slate-900">Appointments</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
                {(['today', 'upcoming'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setApptTab(tab)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                      apptTab === tab ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <Link to="/admin/appointments" className="text-[11px] font-semibold text-indigo-600 hover:underline">
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
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <h2 className="text-[13px] font-bold text-slate-900 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '👤', label: 'New Patient',      sub: 'Register',       to: '/admin/patients' },
                { icon: '📅', label: 'Appointments',     sub: 'Manage visits',  to: '/admin/appointments' },
                { icon: '💰', label: 'Billing',          sub: 'Manage bills',   to: '/admin/billing' },
                ...(isAdmin
                  ? [{ icon: '👥', label: 'Staff & Team', sub: 'Manage team',    to: '/admin/staff' }]
                  : [{ icon: '📋', label: 'Patient List', sub: 'Directory',      to: '/admin/patients' }]),
              ].map(({ icon, label, sub, to }) => (
                <Link
                  key={label}
                  to={to}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                >
                  <span className="text-base">{icon}</span>
                  <div>
                    <p className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-700">{label}</p>
                    <p className="text-[10px] text-slate-400">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Live Alerts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
              <h2 className="text-[13px] font-bold text-slate-900">🔔 Live Alerts</h2>
            </div>
            <div className="px-4 py-1">
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
                      Total: ${inv.total.toFixed(2)} · Balance: ${inv.balance.toFixed(2)} · {createdLabel}
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
