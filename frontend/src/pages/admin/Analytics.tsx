import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import {
  BarChart3, TrendingUp, Calendar, DollarSign, Activity,
  CheckCircle2, Clock, CreditCard, Users
} from 'lucide-react';
import { Link } from 'react-router-dom';

// ---- Types ----
interface AppointmentAnalytics {
  volumeByPeriod: { _id: string; count: number }[];
  byStatus: { _id: string; count: number }[];
  byDoctor: { _id: string; doctorName: string; count: number }[];
}

interface RevenueAnalytics {
  byMonth: { _id: string; revenue: number; count?: number }[];
  outstanding: number;
  paymentMethods: { _id: string; count: number; total?: number; amount?: number }[];
}

interface AppointmentItem {
  _id: string;
  status?: string;
  date?: string;
  timeSlot?: string;
  type?: string;
  doctor?: { specialization?: string; userId?: { firstName?: string; lastName?: string } };
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
}

interface InvoiceItem {
  _id: string;
  invoiceId?: string;
  total: number;
  balance: number;
  status: string;
  createdAt?: string;
}

// ---- Gen-Z Cool Green Color Palette ----
const CHART_COLORS = ['#059669', '#10b981', '#0d9488', '#0284c7', '#6366f1', '#f59e0b', '#ef4444'];

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
      <div className="h-64 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200/60 dark:border-slate-800" />
    </div>
  );
}

export function AdminAnalytics() {
  const { user } = usePermissions();
  const role = user?.role ?? 'admin';
  const isAdmin = role === 'admin';
  const isDoctor = role === 'doctor';
  const isReceptionistOrNurse = role === 'receptionist' || role === 'nurse';

  const [period, setPeriod] = useState<'month' | 'week' | 'day'>('month');

  // Admin: Appointment Analytics Endpoint
  const apptQuery = useQuery<{ success: boolean; data: AppointmentAnalytics }>({
    queryKey: ['analytics', 'appointments', period],
    queryFn: () => api.get(`/analytics/appointments?period=${period}`).then(r => r.data),
    enabled: isAdmin,
    retry: 1,
  });

  // Admin: Revenue Analytics Endpoint
  const revenueQuery = useQuery<{ success: boolean; data: RevenueAnalytics }>({
    queryKey: ['analytics', 'revenue'],
    queryFn: () => api.get('/analytics/revenue').then(r => r.data),
    enabled: isAdmin,
    retry: 1,
  });

  // Doctor & Staff: Appointment list fallback for personal / staff analytics
  const staffApptsQuery = useQuery<{ success: boolean; data: AppointmentItem[] }>({
    queryKey: ['staff-analytics', 'appointments'],
    queryFn: () => api.get('/appointments?limit=200').then(r => r.data),
    enabled: !isAdmin,
    retry: 1,
  });

  // Receptionist / Nurse: Billing list for financial queues
  const staffBillingQuery = useQuery<{ success: boolean; data: InvoiceItem[] }>({
    queryKey: ['staff-analytics', 'billing'],
    queryFn: () => api.get('/billing?limit=100').then(r => r.data),
    enabled: isReceptionistOrNurse,
    retry: 1,
  });

  // Derived Doctor Analytics
  const doctorStats = useMemo(() => {
    if (!isDoctor && !isReceptionistOrNurse) return null;
    const list = staffApptsQuery.data?.data ?? [];
    const total = list.length;
    const completed = list.filter(a => a.status === 'completed').length;
    const confirmed = list.filter(a => a.status === 'confirmed').length;
    const scheduled = list.filter(a => a.status === 'scheduled').length;
    const cancelled = list.filter(a => a.status === 'cancelled' || a.status === 'noShow').length;

    // Group by status for chart
    const statusCounts: Record<string, number> = {};
    list.forEach(a => {
      const s = a.status ?? 'scheduled';
      statusCounts[s] = (statusCounts[s] ?? 0) + 1;
    });
    const statusData = Object.entries(statusCounts).map(([name, count]) => ({ _id: name, count }));

    return { total, completed, confirmed, scheduled, cancelled, statusData, list };
  }, [staffApptsQuery.data, isDoctor, isReceptionistOrNurse]);

  const appt = apptQuery.data?.data;
  const revenue = revenueQuery.data?.data;

  // Safe KPI calculations for Admin
  const totalVolumeInPeriod = useMemo(() => {
    if (!appt?.volumeByPeriod) return 0;
    return appt.volumeByPeriod.reduce((acc, curr) => acc + (curr.count || 0), 0);
  }, [appt?.volumeByPeriod]);

  const totalRevenueMTD = useMemo(() => {
    if (!revenue?.byMonth?.length) return 0;
    return revenue.byMonth[0]?.revenue ?? 0;
  }, [revenue?.byMonth]);

  return (
    <div className="space-y-7 pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isAdmin ? 'System Analytics & Insights' : isDoctor ? 'Doctor Clinical Analytics' : 'Operational Analytics'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {isAdmin
                  ? 'Real-time hospital operations, clinical trends, and revenue reporting'
                  : isDoctor
                  ? 'Consultation trends, patient queue completion, and status distribution'
                  : 'Operational load, appointment throughput, and front-desk metrics'}
              </p>
            </div>
          </div>
        </div>

        {/* Admin Period Toggle */}
        {isAdmin && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200/70 dark:border-slate-700/60 self-start sm:self-auto">
            {(['month', 'week', 'day'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all capitalize ${
                  period === p
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p}ly
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ADMIN VIEW */}
      {/* ========================================================================= */}
      {isAdmin && (
        <>
          {/* Top KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Consultations</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {apptQuery.isLoading ? '…' : totalVolumeInPeriod.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> Filtered by active {period}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Revenue (Recent)</span>
                  <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {revenueQuery.isLoading ? '…' : `$${totalRevenueMTD.toLocaleString()}`}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-1">
                    Current month billed volume
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Outstanding Balance</span>
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {revenueQuery.isLoading ? '…' : `$${(revenue?.outstanding ?? 0).toLocaleString()}`}
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
                    Total uncollected invoices
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-800/60 transition-all">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Active Doctors</span>
                  <div className="w-8 h-8 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {apptQuery.isLoading ? '…' : (appt?.byDoctor?.length ?? 0)}
                  </p>
                  <p className="text-[11px] text-sky-700 dark:text-sky-400 font-medium mt-1">
                    Practitioners with scheduled visits
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Section: Appointment Trends */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Appointment Distribution & Volume
              </h2>
            </div>

            {apptQuery.isLoading && <SectionSkeleton />}
            {apptQuery.isError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs">
                Failed to load appointment analytics data. Please refresh or check connection.
              </div>
            )}

            {appt && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Volume Bar Chart */}
                <Card className="lg:col-span-8 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Consultation Volume by Period ({period})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    {appt.volumeByPeriod.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                        No appointment data recorded for this period
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={[...appt.volumeByPeriod].reverse()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                          <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                            itemStyle={{ color: '#34d399' }}
                          />
                          <Bar dataKey="count" fill="#059669" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Status Pie Chart */}
                <Card className="lg:col-span-4 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Distribution by Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    {appt.byStatus.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                        No status data available
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={appt.byStatus}
                            dataKey="count"
                            nameKey="_id"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                          >
                            {appt.byStatus.map((_entry, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Top Doctors Table */}
                <Card className="lg:col-span-12 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Top Clinicians by Patient Consultations
                    </CardTitle>
                    <Link to="/admin/staff" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                      Manage Staff →
                    </Link>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-left bg-slate-50/50 dark:bg-slate-800/40 text-slate-500">
                            <th className="py-3 px-5 font-semibold">Doctor Name</th>
                            <th className="py-3 px-5 font-semibold">Reference ID</th>
                            <th className="py-3 px-5 font-semibold text-right">Consultation Volume</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {appt.byDoctor.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-6 text-center text-slate-400">
                                No doctor consultation data available
                              </td>
                            </tr>
                          ) : (
                            appt.byDoctor.map((row, i) => (
                              <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                                <td className="py-3 px-5 font-bold text-slate-800 dark:text-slate-200">
                                  {row.doctorName || 'Dr. Medical Staff'}
                                </td>
                                <td className="py-3 px-5 text-slate-400 font-mono text-[11px]">
                                  {row._id}
                                </td>
                                <td className="py-3 px-5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                                  {row.count} visits
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>

          {/* Section: Revenue & Invoicing */}
          <section className="space-y-4 pt-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Financial & Revenue Performance
            </h2>

            {revenueQuery.isLoading && <SectionSkeleton />}
            {revenueQuery.isError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs">
                Failed to load revenue analytics. Please refresh or verify billing permissions.
              </div>
            )}

            {revenue && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Revenue Trend Line */}
                <Card className="lg:col-span-8 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Monthly Billed Revenue Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    {revenue.byMonth.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                        No revenue recorded yet
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={[...revenue.byMonth].reverse()} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                          <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                          <YAxis
                            tick={{ fontSize: 11, fill: '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                          />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px' }}
                            formatter={(v: any) => [`$${Number(v ?? 0).toLocaleString()}`, 'Revenue']}
                          />
                          <Line type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={3} dot={{ fill: '#059669', r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Payment Methods Breakdown */}
                <Card className="lg:col-span-4 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
                  <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                    <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Payment Channels
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Total Unpaid Balance</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        ${(revenue.outstanding ?? 0).toLocaleString()}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Collected by Method
                      </p>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {revenue.paymentMethods.length === 0 ? (
                          <p className="text-xs text-slate-400 py-3 text-center">No payment transactions recorded</p>
                        ) : (
                          revenue.paymentMethods.map((m, i) => (
                            <div key={i} className="flex items-center justify-between py-2 text-xs">
                              <span className="capitalize font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                {m._id || 'Standard'}
                              </span>
                              <div className="text-right">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  ${Number(m.total ?? m.amount ?? 0).toLocaleString()}
                                </span>
                                <span className="text-[10px] text-slate-400 block">{m.count} txns</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </>
      )}

      {/* ========================================================================= */}
      {/* DOCTOR VIEW */}
      {/* ========================================================================= */}
      {isDoctor && (
        <div className="space-y-6">
          {/* Doctor KPI summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500">Total Consultations</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {staffApptsQuery.isLoading ? '…' : doctorStats?.total ?? 0}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">Recorded patient visits</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500">Completed Visits</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {staffApptsQuery.isLoading ? '…' : doctorStats?.completed ?? 0}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Successfully attended
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500">Upcoming / Confirmed</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {staffApptsQuery.isLoading ? '…' : (doctorStats?.confirmed ?? 0) + (doctorStats?.scheduled ?? 0)}
                </p>
                <p className="text-[11px] text-teal-700 font-medium mt-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> In consultation queue
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500">Completion Ratio</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {staffApptsQuery.isLoading
                    ? '…'
                    : doctorStats?.total
                    ? `${Math.round(((doctorStats.completed) / doctorStats.total) * 100)}%`
                    : '100%'}
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-1">Consultation efficiency</p>
              </CardContent>
            </Card>
          </div>

          {/* Doctor Chart & Queue */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <Card className="lg:col-span-7 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
              <CardHeader className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <CardTitle className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Appointment Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5">
                {doctorStats?.statusData?.length === 0 ? (
                  <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                    No status metrics found
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={doctorStats?.statusData ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                      <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-5 rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
                  Clinical Queue Quick Actions
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                  Hospital-wide billing and administrative cashflows are restricted to administrators. You can manage your live queue, write prescriptions, and review patient charts directly below:
                </p>
                <div className="space-y-2">
                  <Link
                    to="/doctor/schedule"
                    className="flex items-center justify-between p-3 rounded-xl border border-emerald-200/80 dark:border-emerald-800/60 bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-100/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold transition-all"
                  >
                    <span>Open Live Schedule Queue</span>
                    <span>→</span>
                  </Link>
                  <Link
                    to="/doctor/dashboard"
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all"
                  >
                    <span>Return to Doctor Dashboard</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
                PulseCare Clinical Operations · Logged in as Dr. {user?.firstName} {user?.lastName}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECEPTIONIST / NURSE / PATIENT VIEW */}
      {/* ========================================================================= */}
      {isReceptionistOrNurse && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500">Total Bookings</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {staffApptsQuery.isLoading ? '…' : doctorStats?.total ?? 0}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium mt-1">Processed check-ins</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500">Confirmed Today</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {staffApptsQuery.isLoading ? '…' : doctorStats?.confirmed ?? 0}
                </p>
                <p className="text-[11px] text-teal-700 font-medium mt-1">Confirmed appointments</p>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500">Pending Invoices</span>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">
                  {staffBillingQuery.isLoading
                    ? '…'
                    : (staffBillingQuery.data?.data?.filter(i => i.status !== 'paid').length ?? 0)}
                </p>
                <p className="text-[11px] text-amber-700 font-medium mt-1">In billing queue</p>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl border-slate-200/80 dark:border-slate-800 shadow-xs p-6">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2">
              Front-Desk Operations
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Access patient intake and scheduling queues to book or confirm upcoming visits:
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/admin/appointments"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold text-xs shadow-xs hover:bg-emerald-500 transition-all"
              >
                <Calendar className="w-3.5 h-3.5" /> Appointments Management
              </Link>
              <Link
                to="/admin/patients"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition-all"
              >
                <Users className="w-3.5 h-3.5" /> Patient Directory
              </Link>
              <Link
                to="/admin/billing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs hover:bg-slate-50 transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" /> Billing Desk
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
