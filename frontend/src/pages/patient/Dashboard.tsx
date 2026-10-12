import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AlertItem } from '@/components/Shared/AlertItem';
import { DashboardSkeleton } from '@/components/Shared/DashboardSkeleton';
import { Button } from '@/components/ui/button';
import { downloadPdf } from '@/lib/downloadPdf';
import { Calendar, Pill, FlaskConical, DollarSign, FileText } from 'lucide-react';

interface Appointment {
  _id: string; date?: string; timeSlot?: string; status?: string; reason?: string; tokenNumber?: number;
  doctor?: { specialization?: string; userId?: { firstName?: string; lastName?: string } };
}
interface Invoice { _id: string; invoiceId?: string; totalAmount?: number; status?: string; createdAt?: string; }
interface Prescription { _id: string; status?: string; medicationName?: string; dosage?: string; daysSupply?: number; }
interface LabResult { _id: string; testName?: string; status?: string; createdAt?: string; }

type TimelineEvent =
  | { kind: 'lab';    _id: string; title: string; sub: string; date: string; icon: React.ReactNode; iconBg: string }
  | { kind: 'appt';   _id: string; title: string; sub: string; date: string; icon: React.ReactNode; iconBg: string }
  | { kind: 'bill';   _id: string; title: string; sub: string; date: string; icon: React.ReactNode; iconBg: string }
  | { kind: 'script'; _id: string; title: string; sub: string; date: string; icon: React.ReactNode; iconBg: string };

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatApptDate(dateStr?: string): { day: string; month: string; bg: string; text: string } {
  if (!dateStr) return { day: '—', month: '—', bg: 'bg-slate-100', text: 'text-slate-500' };
  const d = new Date(dateStr);
  const day   = d.getDate().toString();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const daysAway = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (daysAway <= 3)  return { day, month, bg: 'bg-blue-50',    text: 'text-blue-700' };
  if (daysAway <= 14) return { day, month, bg: 'bg-emerald-50', text: 'text-emerald-700' };
  return { day, month, bg: 'bg-slate-100', text: 'text-slate-500' };
}

export function PatientDashboard() {
  const user = useAppSelector(s => s.auth.user);

  const apptQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['patient-dashboard', 'appointments'],
    queryFn: () => api.get('/appointments?status=completed,confirmed,scheduled&limit=5').then(r => r.data),
  });

  const billsQ = useQuery<{ success: boolean; data: Invoice[] }>({
    queryKey: ['patient-dashboard', 'billing'],
    queryFn: () => api.get('/billing?status=unpaid&limit=20').then(r => r.data),
  });

  const rxQ = useQuery<{ success: boolean; data: Prescription[] }>({
    queryKey: ['patient-dashboard', 'prescriptions'],
    queryFn: () => api.get('/pharmacy/prescriptions?status=active').then(r => r.data),
  });

  const labQ = useQuery<{ success: boolean; data: LabResult[] }>({
    queryKey: ['patient-dashboard', 'lab'],
    queryFn: () => api.get('/lab/results?limit=5').then(r => r.data),
  });

  const upcomingAppts   = apptQ.data?.data ?? [];
  const allBills        = billsQ.data?.data ?? [];
  const activePrescriptions = rxQ.data?.data ?? [];
  const labResults      = labQ.data?.data ?? [];

  const unpaidBills     = allBills.filter((b: Invoice) => b.status === 'unpaid');
  const outstandingAmt  = unpaidBills.reduce((sum, b) => sum + (b.totalAmount ?? 0), 0);

  const newLabCount = labQ.data?.data?.filter((l: LabResult) => l.status === 'resulted' || l.status === 'pending').length ?? 0;

  const upcomingCount = upcomingAppts.filter(
    (a: Appointment) => a.status !== 'completed' && a.status !== 'cancelled'
  ).length;

  const nextAppt = upcomingAppts[0];
  const nextApptLabel = nextAppt?.date
    ? `Next appointment: ${new Date(nextAppt.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
    : 'No upcoming appointments';

  const timeline: TimelineEvent[] = [
    ...labResults.slice(0, 2).map(r => ({
      kind: 'lab' as const, _id: r._id,
      title: `Lab Result: ${r.testName ?? 'Test'}`,
      sub: r.status === 'resulted' ? 'Results ready for review' : `Status: ${r.status ?? '—'}`,
      date: formatDate(r.createdAt),
      icon: <FlaskConical className="w-4 h-4 text-emerald-600" />, iconBg: 'bg-emerald-50',
    })),
    ...upcomingAppts.map(a => ({
      kind: 'appt' as const, _id: a._id,
      title: a.status === 'completed' ? 'Appointment Completed' : 'Upcoming Appointment',
      sub: a.doctor?.userId
        ? `Dr. ${a.doctor.userId.firstName} ${a.doctor.userId.lastName} · ${a.doctor.specialization ?? ''}`
        : a.reason ?? 'Scheduled visit',
      date: formatDate(a.date),
      icon: <Calendar className="w-4 h-4 text-sky-600" />, iconBg: 'bg-sky-50',
    })),
    ...allBills.filter(b => b.status === 'paid').slice(0, 1).map(b => ({
      kind: 'bill' as const, _id: b._id,
      title: `Invoice Paid — ${b.invoiceId ?? b._id.slice(-6)}`,
      sub: `$${(b.totalAmount ?? 0).toLocaleString()} · Payment received`,
      date: formatDate(b.createdAt),
      icon: <DollarSign className="w-4 h-4 text-amber-600" />, iconBg: 'bg-amber-50',
    })),
    ...activePrescriptions.slice(0, 1).map(p => ({
      kind: 'script' as const, _id: p._id,
      title: `Prescription Active`,
      sub: [p.medicationName, p.dosage, p.daysSupply ? `${p.daysSupply} days` : ''].filter(Boolean).join(' · ') || 'Active prescription',
      date: 'Active',
      icon: <Pill className="w-4 h-4 text-violet-600" />, iconBg: 'bg-violet-50',
    })),
  ].slice(0, 5);

  if (apptQ.isLoading && billsQ.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {greetingByHour()}, {user?.firstName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{nextApptLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadPdf('/patients/me/id-card', 'patient-id-card.pdf')}
            className="text-xs h-9 gap-1.5 rounded-xl border-slate-200 dark:border-slate-800"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Download ID Card
          </Button>
          <Link
            to="/patient/book-appointment"
            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition-all shadow-xs hover:shadow-emerald-600/20"
          >
            + Book Appointment
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          title="Upcoming Appointments" value={apptQ.isLoading ? '…' : upcomingCount}
          trend={nextAppt?.date ? `Next: ${new Date(nextAppt.date).toLocaleDateString('en-US', { weekday: 'short' })}` : 'None'}
          trendDir="neutral" color="blue" icon={<Calendar className="w-5 h-5 text-emerald-600" />} isLoading={apptQ.isLoading}
        />
        <KpiCard
          title="Active Prescriptions" value={rxQ.isLoading ? '…' : activePrescriptions.length}
          trend="Active" trendDir="up" color="green" icon={<Pill className="w-5 h-5 text-emerald-600" />} isLoading={rxQ.isLoading}
        />
        <KpiCard
          title="Lab Results"          value={labQ.isLoading ? '…' : labResults.length}
          trend={newLabCount > 0 ? `${newLabCount} new` : 'Up to date'} trendDir="neutral"
          color="purple" icon={<FlaskConical className="w-5 h-5 text-teal-600" />} isLoading={labQ.isLoading}
        />
        <KpiCard
          title="Outstanding Balance"  value={billsQ.isLoading ? '…' : outstandingAmt > 0 ? `$${outstandingAmt.toLocaleString()}` : '$0'}
          trend={unpaidBills.length > 0 ? `${unpaidBills.length} due` : 'All paid'} trendDir={unpaidBills.length > 0 ? 'down' : 'neutral'}
          color="amber" icon={<DollarSign className="w-5 h-5 text-amber-600" />} isLoading={billsQ.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Appointments - 7 or 8 columns on large screens */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">My Appointments</h2>
            <Link to="/patient/appointments" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="p-4 sm:p-5 flex-1 divide-y divide-slate-100 dark:divide-slate-800">
            {apptQ.isLoading && (
              <div className="space-y-3 py-2">
                {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />)}
              </div>
            )}
            {!apptQ.isLoading && upcomingAppts.length === 0 && (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-slate-400">No upcoming appointments scheduled</p>
                <Link
                  to="/patient/book-appointment"
                  className="inline-block text-xs font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 px-4 py-2 rounded-xl hover:bg-emerald-100"
                >
                  Book an Appointment
                </Link>
              </div>
            )}
            {upcomingAppts.map(appt => {
              const dateParts = formatApptDate(appt.date);
              const docName = appt.doctor?.userId
                ? `Dr. ${appt.doctor.userId.firstName} ${appt.doctor.userId.lastName}`
                : 'Doctor TBD';
              return (
                <div key={appt._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 ${dateParts.bg} rounded-xl flex flex-col items-center justify-center shrink-0 border border-slate-200/40 dark:border-slate-700`}>
                      <span className={`text-sm font-extrabold ${dateParts.text} leading-none`}>{dateParts.day}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${dateParts.text} opacity-75`}>{dateParts.month}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">{docName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {appt.timeSlot ?? '—'} · {appt.doctor?.specialization ?? 'General'}
                        {appt.reason ? ` · ${appt.reason}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {appt.tokenNumber !== undefined && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 whitespace-nowrap">
                        Token #{appt.tokenNumber}
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${
                      appt.status === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {appt.status === 'confirmed' ? 'Confirmed' : 'Scheduled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column - 5 or 4 columns on large screens */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-5">
          {/* Quick actions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs p-5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2.5">
              {[
                { icon: <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Book Appt',   sub: 'Schedule visit',   to: '/patient/book-appointment' },
                { icon: <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'Refill Rx',     sub: 'Request refill',  to: '/patient/prescriptions' },
                { icon: <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />, label: 'Pay Bill',     sub: outstandingAmt > 0 ? `$${outstandingAmt.toLocaleString()} due` : 'No balance due', to: '/patient/billing' },
                { icon: <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />, label: 'My Records',   sub: 'Documents & Lab',  to: '/patient/documents' },
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

          {/* Active prescriptions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Active Prescriptions</h2>
              <Link to="/patient/prescriptions" className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline">
                View all →
              </Link>
            </div>
            <div className="px-5 py-3">
              {rxQ.isLoading && <div className="h-16 animate-pulse bg-slate-50 dark:bg-slate-800/60 rounded-xl my-2" />}
              {!rxQ.isLoading && activePrescriptions.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No active prescriptions</p>
              )}
              {activePrescriptions.slice(0, 3).map(rx => (
                <AlertItem key={rx._id} dotColor="#10b981">
                  <strong>{rx.medicationName ?? 'Medication'}</strong>
                  {rx.dosage && ` — ${rx.dosage}`}
                  {rx.daysSupply && <span className="text-slate-400"> · {rx.daysSupply} days</span>}
                </AlertItem>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Health Activity Timeline */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <h3 className="text-[13px] font-bold text-slate-900">Health Activity Timeline</h3>
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No recent activity</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {timeline.map(event => (
              <div key={`${event.kind}-${event._id}`} className="flex items-center gap-3 py-3 px-4">
                <div className={`w-8 h-8 ${event.iconBg} rounded-xl flex items-center justify-center text-base flex-shrink-0`}>
                  {event.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-slate-900 truncate">{event.title}</p>
                  <p className="text-[10px] text-slate-400 truncate">{event.sub}</p>
                </div>
                <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0">{event.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
