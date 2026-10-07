import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppSelector } from '@/store/hooks';
import { Logo } from '@/components/Shared/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users,
  Calendar,
  FileText,
  Clock,
  ShieldCheck,
  Printer,
  ChevronRight,
  KeyRound,
  HeartPulse,
} from 'lucide-react';

const CORE_MODULES = [
  {
    id: 'patients',
    title: 'Patient Registration & Management',
    tagline: 'Records, Emergency Contacts & ID Cards',
    icon: Users,
    color: 'from-teal-500/10 to-teal-600/20 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800',
    description:
      'Seamless demographic onboarding with atomic PAT-xxxx patient IDs, comprehensive blood group & emergency contact profiles, safe multi-field search, and instant printable patient identification cards.',
    highlights: [
      'Atomic PAT-xxxx sequence numbering',
      'Instant printable PDF patient ID card',
      'Name, phone, email & ID safe regex search',
      'Secure medical records and profile management',
    ],
  },
  {
    id: 'doctors',
    title: 'Doctor & Department Directory',
    tagline: 'Specializations & Leave Management',
    icon: HeartPulse,
    color: 'from-emerald-500/10 to-emerald-600/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    description:
      'Multi-department physician catalog with consultation fees, weekly schedule matrix, and active leave tracking that automatically suspends booking slots during doctor time off.',
    highlights: [
      'Doctor profiles by department & specialization',
      'Doctor time-off & leave window enforcement',
      'Automatic slot blackout during approved leaves',
      'Consultation fee and schedule visibility',
    ],
  },
  {
    id: 'appointments',
    title: 'Appointment Booking & Scheduling',
    tagline: 'Conflict Prevention & Daily Queue Tokens',
    icon: Calendar,
    color: 'from-cyan-500/10 to-cyan-600/20 text-cyan-600 dark:cyan-400 border-cyan-200 dark:border-cyan-800',
    description:
      'Real-time 30-minute slot availability engine with atomic daily queue tokens (#1, #2...) per doctor and date, strict double-booking rejection, walk-in staff scheduling, and printable slips.',
    highlights: [
      'Sequential atomic queue token per doctor/date',
      'Zero double-booking partial unique indexing',
      'Staff walk-in booking & patient self-service',
      'Downloadable appointment verification slips',
    ],
  },
  {
    id: 'billing',
    title: 'Itemized Billing & Invoicing',
    tagline: 'Categorized Line Items & PDF Statements',
    icon: FileText,
    color: 'from-blue-500/10 to-blue-600/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    description:
      'Categorized line-item charges (consultation, medicine, procedures), pure centralized totals recalculation with discounts and tax, draft modification, payment tracking, and server-generated invoice PDFs.',
    highlights: [
      'Central pure function invoice totals calculation',
      'Itemized categorization with draft line removal',
      'Payment recording: partial & fully paid status',
      'Server-side printable tax invoices via pdf-lib',
    ],
  },
];

const SEEDED_CREDENTIALS = [
  { role: 'Admin', email: 'admin@pulsecare.test', note: 'Full hospital system access, staff, analytics & billing' },
  { role: 'Receptionist', email: 'reception@pulsecare.test', note: 'Patient registration, walk-in appointments, billing' },
  { role: 'Doctor (Cardio)', email: 'dr.smith@pulsecare.test', note: 'View schedule, patient queue, consultation tokens' },
  { role: 'Doctor (Pediatrics)', email: 'dr.chen@pulsecare.test', note: 'Schedule & queue management' },
  { role: 'Doctor (Orthopedics)', email: 'dr.patel@pulsecare.test', note: 'Schedule & leave tracking' },
  { role: 'Patient', email: 'patient1@pulsecare.test', note: 'Self-booking, appointments slip, bills & ID card' },
];

export function Landing() {
  const user = useAppSelector((s) => s.auth.user);
  const shouldReduceMotion = useReducedMotion();
  const [showCreds, setShowCreds] = useState(false);

  // If already authenticated, redirect directly to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const fadeIn = shouldReduceMotion
    ? { initial: {}, animate: {} }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5 },
      };

  const staggerItem = (index: number) =>
    shouldReduceMotion
      ? { initial: {}, animate: {} }
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay: index * 0.1 },
        };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-teal-500 selection:text-white">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo size="md" />

          <nav className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreds(!showCreds)}
              className="text-xs text-muted-foreground hover:text-teal-600 gap-1.5 hidden sm:flex"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Demo Logins
            </Button>
            <Link to="/sign-in">
              <Button variant="outline" size="sm" className="text-xs font-semibold">
                Sign In
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button size="sm" className="text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white">
                Register as Patient
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Demo Credentials Drawer / Notice */}
      {showCreds && (
        <aside className="bg-teal-50 dark:bg-teal-950/60 border-b border-teal-200 dark:border-teal-800 px-4 py-3" aria-label="Demo Credentials">
          <div className="max-w-7xl mx-auto text-xs">
            <div className="flex items-center justify-between font-semibold text-teal-900 dark:text-teal-200 mb-2">
              <span>Seeded Accounts (Password for all accounts: <code className="bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded font-mono border">Password@123</code>)</span>
              <button onClick={() => setShowCreds(false)} className="hover:underline text-teal-700 dark:text-teal-300">
                Hide ✕
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {SEEDED_CREDENTIALS.map((c) => (
                <div key={c.email} className="p-2 bg-white dark:bg-slate-900 rounded border border-teal-100 dark:border-teal-900">
                  <span className="font-bold text-teal-800 dark:text-teal-300">{c.role}:</span>{' '}
                  <code className="font-mono text-slate-700 dark:text-slate-300">{c.email}</code>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{c.note}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-teal-400/10 dark:bg-teal-500/5 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <motion.div {...fadeIn}>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-teal-600 dark:bg-teal-400 animate-pulse" />
              PulseCare HMS — Core Healthcare Suite
            </span>
          </motion.div>

          <motion.h1
            {...fadeIn}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15]"
          >
            Precision Hospital Operations,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400">
              Zero Confusion.
            </span>
          </motion.h1>

          <motion.p
            {...fadeIn}
            className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed"
          >
            A high-reliability clinical management system engineered for outpatient clinics and hospitals.
            Streamlined patient onboarding, specialist scheduling with leave tracking, conflict-free bookings with daily queue tokens, and itemized billing.
          </motion.p>

          <motion.div {...fadeIn} className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/sign-in">
              <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white font-semibold gap-2 shadow-md shadow-teal-700/20">
                Launch Portal <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button size="lg" variant="outline" className="font-semibold border-slate-300 dark:border-slate-700">
                Patient Registration
              </Button>
            </Link>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => setShowCreds(true)}
              className="text-teal-700 dark:text-teal-300 gap-1.5"
            >
              <KeyRound className="w-4 h-4" /> View Test Credentials
            </Button>
          </motion.div>

          {/* Quick Metrics Bar */}
          <motion.div
            {...fadeIn}
            className="pt-10 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left"
          >
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Reliability</span>
              </div>
              <p className="text-xl font-bold mt-1 text-slate-900 dark:text-white">Zero Double-Booking</p>
              <p className="text-xs text-muted-foreground mt-0.5">Strict atomic slot validation</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Queue System</span>
              </div>
              <p className="text-xl font-bold mt-1 text-slate-900 dark:text-white">Daily Queue Tokens</p>
              <p className="text-xs text-muted-foreground mt-0.5">Atomic sequential # per doctor</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                <Printer className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Documents</span>
              </div>
              <p className="text-xl font-bold mt-1 text-slate-900 dark:text-white">Printable PDFs</p>
              <p className="text-xs text-muted-foreground mt-0.5">ID cards, slips & invoices</p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Users className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Security</span>
              </div>
              <p className="text-xl font-bold mt-1 text-slate-900 dark:text-white">4 Distinct Roles</p>
              <p className="text-xs text-muted-foreground mt-0.5">Admin, Receptionist, Doctor, Patient</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4 Core Modules Showcase */}
      <section id="modules" className="py-16 bg-white dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
              Four Core Healthcare Modules
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-base">
              Carefully trimmed, hardened, and verified to deliver end-to-end clinical workflow excellence.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {CORE_MODULES.map((m, idx) => {
              const Icon = m.icon;
              return (
                <motion.div key={m.id} {...staggerItem(idx)}>
                  <Card className="h-full border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-6 sm:p-8 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className={`p-3 rounded-xl border bg-gradient-to-br ${m.color}`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-mono font-semibold uppercase text-muted-foreground tracking-wider">
                          Module 0{idx + 1}
                        </span>
                      </div>

                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{m.title}</h3>
                        <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mt-0.5">
                          {m.tagline}
                        </p>
                      </div>

                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        {m.description}
                      </p>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Key Capabilities
                        </p>
                        <ul className="grid grid-cols-1 gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                          {m.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-2">
                              <span className="text-teal-600 dark:text-teal-400 font-bold">✓</span>
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white border-t border-teal-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <h2 className="text-3xl font-extrabold sm:text-4xl tracking-tight">
            Ready to explore PulseCare HMS?
          </h2>
          <p className="text-teal-200 text-base max-w-2xl mx-auto">
            Log in using one of the pre-seeded role credentials or register a new patient account to experience the workflow.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link to="/sign-in">
              <Button size="lg" className="bg-white text-teal-900 hover:bg-teal-50 font-bold px-8 shadow-lg">
                Sign In Now
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button size="lg" variant="outline" className="text-white border-teal-400/40 hover:bg-teal-800/50 font-bold px-8">
                Patient Registration
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto py-8 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span>© 2026 PulseCare HMS. Licensed under Apache-2.0.</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowCreds(true)}
              className="hover:text-teal-600 underline text-xs"
            >
              Demo Credentials
            </button>
            <Link to="/sign-in" className="hover:text-teal-600 underline">
              Portal Access
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
