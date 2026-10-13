import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useAppSelector } from '@/store/hooks';
import { Logo } from '@/components/Shared/Logo';
import { Button } from '@/components/ui/button';
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
  Award,
  CheckCircle2,
  Stethoscope,
  Activity,
  ArrowRight,
  X,
  PhoneCall,
  Sparkles,
  BadgeCheck,
} from 'lucide-react';

const SEEDED_CREDENTIALS = [
  { role: 'Admin', email: 'admin@pulsecare.test', note: 'Full hospital system access, staff, analytics & billing' },
  { role: 'Receptionist', email: 'reception@pulsecare.test', note: 'Patient registration, walk-in appointments, billing' },
  { role: 'Doctor (Cardio)', email: 'dr.smith@pulsecare.test', note: 'Schedule view, patient queue, consultation tokens' },
  { role: 'Doctor (Pediatrics)', email: 'dr.chen@pulsecare.test', note: 'Schedule & queue management' },
  { role: 'Doctor (Orthopedics)', email: 'dr.patel@pulsecare.test', note: 'Schedule & leave tracking' },
  { role: 'Patient', email: 'patient1@pulsecare.test', note: 'Self-booking, appointments slip, bills & ID card' },
];

const SPECIALTY_HIGHLIGHTS = [
  { name: 'Cardiology', doctors: '6 Specialists', icon: HeartPulse, color: 'text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/40 dark:border-rose-900' },
  { name: 'Pediatrics', doctors: '4 Specialists', icon: Users, color: 'text-emerald-600 bg-emerald-50/70 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900' },
  { name: 'Orthopedics', doctors: '5 Specialists', icon: Activity, color: 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/40 dark:border-blue-900' },
  { name: 'General Medicine', doctors: '8 Specialists', icon: Stethoscope, color: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900' },
];

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Select Clinical Specialist',
    desc: 'Browse certified physicians across departments with real-time slot availability, fees, and leave sync.',
  },
  {
    step: '02',
    title: 'Reserve 30-Min Consultation',
    desc: 'Instant slot reservation backed by strict atomic validation and concurrency locks to eliminate double-booking.',
  },
  {
    step: '03',
    title: 'Receive Daily Queue Token',
    desc: 'Automated sequential token number (#1, #2...) per doctor with downloadable slip & check-in QR code.',
  },
  {
    step: '04',
    title: 'Itemized Billing & Care History',
    desc: 'Transparent PDF tax invoices, digital prescription dispensing, and lifetime clinical visit history.',
  },
];

const PLATFORM_PILLARS = [
  {
    title: 'Patient Portal & Digital Identity',
    tagline: 'Instant Registration & Printable ID Cards',
    icon: Users,
    desc: 'Instant onboarding with atomic PAT-xxxx IDs, emergency contacts, blood group profiling, and instant printable patient cards.',
    badges: ['Atomic PAT-ID Generation', 'Printable PDF Card', 'Safe RegEx Search', 'Profile Records'],
  },
  {
    title: 'Doctor Schedule & Leave Engine',
    tagline: 'Automated Slot Blackout & Roster Matrix',
    icon: HeartPulse,
    desc: 'Physician profiles by department, weekly session schedules, consultation fees, and active leave tracking that blocks slots automatically.',
    badges: ['Roster Matrix', 'Live Leave Blackout', 'Department Routing', 'Consultation Pricing'],
  },
  {
    title: 'Conflict-Free Queue Tokens',
    tagline: 'Daily Sequential Tokens #1, #2... per Physician',
    icon: Calendar,
    desc: 'Real-time 30-minute availability engine with sequential daily queue tokens per doctor and date, walk-in scheduling, and slip downloads.',
    badges: ['Atomic Queue Tokens', 'Zero Double-Booking', 'Walk-in Reception Desk', 'Printable PDF Slips'],
  },
  {
    title: 'Itemized Billing & Tax Invoices',
    tagline: 'Categorized Line-Items & PDF Receipts',
    icon: FileText,
    desc: 'Consultation, laboratory, and medicine line items with pure centralized tax/discount recalculation and server-generated invoice PDFs.',
    badges: ['Pure Function Totals', 'Server PDF-Lib Engine', 'Payment Status Tracking', 'Audit Reconciliation'],
  },
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

  return (
    <div className="min-h-screen bg-[#fafbfc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-emerald-600 selection:text-white font-sans antialiased">
      {/* Seeded Credentials Drawer */}
      {showCreds && (
        <aside className="bg-emerald-950 text-white border-b border-emerald-800/80 px-4 py-3 sticky top-0 z-50 shadow-md" aria-label="Demo Credentials">
          <div className="max-w-7xl mx-auto text-xs">
            <div className="flex items-center justify-between font-medium text-emerald-100 mb-2">
              <span className="flex items-center gap-1.5 font-semibold text-white">
                <KeyRound className="w-4 h-4 text-emerald-300" />
                Seeded Demo Accounts (Password for all roles: <code className="bg-emerald-900/80 text-emerald-200 px-1.5 py-0.5 rounded font-mono border border-emerald-700/80">Password@123</code>)
              </span>
              <button
                onClick={() => setShowCreds(false)}
                className="hover:text-white text-emerald-200 flex items-center gap-1 p-1 rounded hover:bg-emerald-900/60"
              >
                <span>Close</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {SEEDED_CREDENTIALS.map((c) => (
                <div key={c.email} className="p-2.5 bg-emerald-950/70 rounded-lg border border-emerald-800/80/80">
                  <span className="font-bold text-emerald-300 block">{c.role}</span>
                  <code className="font-mono text-[11px] text-emerald-100 truncate block mt-0.5">{c.email}</code>
                </div>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Modern Glassmorphic Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Logo size="md" />

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#services" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Specialties
            </a>
            <a href="#workflow" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              How It Works
            </a>
            <a href="#modules" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Clinical Modules
            </a>
            <a href="#trust" className="hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
              Security
            </a>
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCreds(!showCreds)}
              className="text-xs text-slate-600 hover:text-emerald-700 dark:text-slate-300 dark:hover:text-emerald-300 gap-1.5 hidden sm:flex border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Demo Roles
            </Button>
            <Link to="/sign-in">
              <Button variant="ghost" size="sm" className="text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-700">
                Sign In
              </Button>
            </Link>
            <Link to="/sign-up">
              <Button size="sm" className="text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-5 shadow-sm shadow-emerald-600/25">
                Book Consultation
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section — Dribbble Medical Consulting style */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-32 bg-gradient-to-b from-teal-50/50 via-[#fafbfc] to-[#fafbfc] dark:from-slate-900/40 dark:via-slate-950 dark:to-slate-950">
        {/* Subtle decorative radial gradients */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-tr from-teal-300/15 via-emerald-200/10 to-transparent blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-emerald-50/700/5 blur-2xl pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Headings & Call to actions */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <motion.div {...fadeIn} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80/80 dark:border-emerald-800/80 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-50/700 animate-ping" />
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Next-Generation Healthcare Hospital Suite</span>
              </motion.div>

              <motion.h1
                {...fadeIn}
                className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.12]"
              >
                Find & Consult With{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-700 dark:from-emerald-400 dark:to-teal-300">
                  Certified Medical
                </span>{' '}
                Specialists Today.
              </motion.h1>

              <motion.p
                {...fadeIn}
                className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed"
              >
                Experience conflict-free patient onboarding, automatic doctor roster synchronization, daily sequential queue tokens, and verified itemized tax statements.
              </motion.p>

              {/* CTAs */}
              <motion.div {...fadeIn} className="flex flex-wrap items-center gap-4 pt-2">
                <Link to="/sign-up">
                  <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-full px-7 shadow-lg shadow-emerald-700/20 gap-2 h-12 text-sm sm:text-base">
                    Book Consultation <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/sign-in">
                  <Button size="lg" variant="outline" className="font-semibold rounded-full px-6 border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-900 h-12 text-sm sm:text-base">
                    Physician & Staff Portal
                  </Button>
                </Link>
              </motion.div>

              {/* Trust Indicators Bar */}
              <motion.div {...fadeIn} className="pt-6 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-6 sm:gap-10 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Zero Double-Booking</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Instant Queue Token #</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">HIPAA Compliant RBAC</span>
                </div>
              </motion.div>
            </div>

            {/* Right Column: Hero Interactive Consultation Showcase Card (Dribbble style) */}
            <motion.div
              {...fadeIn}
              className="lg:col-span-5 relative"
            >
              <div className="relative mx-auto max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 border border-slate-200/80 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/60 space-y-6">
                {/* Header widget */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Stethoscope className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Active Queue Status</h2>
                      <p className="text-xs text-slate-500">OPD Clinical Sessions Active</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                  </span>
                </div>

                {/* Quick Consultation Booking Preview Widget */}
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                      Featured Specialist On Duty
                    </span>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">Dr. Vikram Sharma, MD</p>
                        <p className="text-xs text-slate-500">Chief of Cardiology • 12 Yrs Exp</p>
                      </div>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        ₹800 / Visit
                      </span>
                    </div>
                  </div>

                  {/* Token Highlight */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-emerald-50/700/10 border border-emerald-500/20 text-center">
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-medium">Next Available Token</p>
                      <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">#07</p>
                      <p className="text-[10px] text-slate-500">Today, 02:30 PM</p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">Average Wait Time</p>
                      <p className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-0.5">8 min</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">98% On-Schedule</p>
                    </div>
                  </div>

                  <Link to="/sign-up" className="block">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl h-11 text-sm shadow-md shadow-emerald-700/20">
                      Reserve Appointment Now
                    </Button>
                  </Link>
                </div>

                {/* Floating pill badge */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Printable Slip Included
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    SMS & Email Reminders
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Specialties Section */}
      <section id="services" className="py-16 bg-white dark:bg-slate-900 border-y border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
                Clinical Expertise
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                Explore Clinical Specialties
              </h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
              Access board-certified specialists with transparent scheduling, comprehensive bio profiles, and leave availability indicators.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SPECIALTY_HIGHLIGHTS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.name}
                  className="p-6 rounded-2xl bg-[#fafbfc] dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-teal-900/5 transition-all group"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center border mb-4 ${s.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {s.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{s.doctors}</p>
                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    <span>View Doctors</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works Workflow Section */}
      <section id="workflow" className="py-20 bg-[#fafbfc] dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
              Seamless Patient Journey
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              How PulseCare Simplifies Your Visit
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base">
              Engineered from the ground up to prevent scheduling collisions and long OPD waiting queues.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {WORKFLOW_STEPS.map((w) => (
              <div
                key={w.step}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden"
              >
                <div className="text-4xl font-black text-emerald-600/15 dark:text-emerald-400/15 absolute top-4 right-4">
                  {w.step}
                </div>
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center mb-4">
                  {w.step}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{w.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4 Core Pillars / Modules Showcase */}
      <section id="modules" className="py-20 bg-white dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
              Full-Stack Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Hospital Operations Modules
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base">
              A robust clinical operating system tested with automated concurrency locks and transactional integrity.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {PLATFORM_PILLARS.map((m, idx) => {
              const Icon = m.icon;
              return (
                <div
                  key={m.title}
                  className="bg-[#fafbfc] dark:bg-slate-800/40 rounded-3xl p-7 border border-slate-200/80 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all space-y-5"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-700/20">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
                      Module 0{idx + 1}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{m.title}</h3>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">{m.tagline}</p>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {m.desc}
                  </p>

                  <div className="pt-3 border-t border-slate-200/70 dark:border-slate-700/60 flex flex-wrap gap-2">
                    {m.badges.map((b) => (
                      <span
                        key={b}
                        className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security & Reliability Section */}
      <section id="trust" className="py-16 bg-[#fafbfc] dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
              <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-2xl font-black text-slate-900 dark:text-white">100%</p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Conflict-Free Slots</p>
              <p className="text-[11px] text-slate-400">Database atomic locks</p>
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
              <Clock className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-2xl font-black text-slate-900 dark:text-white">&lt; 15 min</p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">OPD Wait Time</p>
              <p className="text-[11px] text-slate-400">Sequential token queue</p>
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
              <Printer className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto" />
              <p className="text-2xl font-black text-slate-900 dark:text-white">3 Types</p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Printable PDF Docs</p>
              <p className="text-[11px] text-slate-400">Cards, slips & invoices</p>
            </div>
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-center space-y-2">
              <Award className="w-6 h-6 text-rose-600 dark:text-rose-400 mx-auto" />
              <p className="text-2xl font-black text-slate-900 dark:text-white">4 Roles</p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Granular Access</p>
              <p className="text-[11px] text-slate-400">Admin, Doctor, Staff, Patient</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-20 bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white border-t border-emerald-800/80/80 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-50/700/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6 relative z-10">
          <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-900/80 text-emerald-200 border border-emerald-700/80 inline-block">
            Start Your Consultation
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Ready to experience seamless clinical healthcare?
          </h2>
          <p className="text-emerald-200 text-base max-w-2xl mx-auto leading-relaxed">
            Join thousands of patients and clinical specialists on PulseCare HMS. Register your patient ID in under 60 seconds.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link to="/sign-up">
              <Button size="lg" className="bg-white text-teal-900 hover:bg-emerald-50/70 font-bold px-8 rounded-full shadow-xl h-12 text-base">
                Register as Patient
              </Button>
            </Link>
            <Link to="/sign-in">
              <Button size="lg" variant="outline" className="text-white border-emerald-500/50 hover:bg-emerald-900/50 font-bold px-8 rounded-full h-12 text-base">
                Sign In to Portal
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Modern Clean Footer */}
      <footer className="mt-auto py-10 bg-white dark:bg-slate-950 border-t border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span>© 2026 PulseCare HMS. Clinical Healthcare Platform.</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => setShowCreds(true)}
              className="hover:text-emerald-600 dark:hover:text-emerald-400 underline font-medium"
            >
              Demo Credentials
            </button>
            <Link to="/sign-in" className="hover:text-emerald-600 dark:hover:text-emerald-400 underline font-medium">
              Staff Portal
            </Link>
            <Link to="/sign-up" className="hover:text-emerald-600 dark:hover:text-emerald-400 underline font-medium">
              Patient Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
