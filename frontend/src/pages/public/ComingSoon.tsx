import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowLeft, CheckCircle2, Shield } from 'lucide-react';

export function ComingSoon({ featureName }: { featureName?: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Guess module name from URL if not explicitly passed
  const path = location.pathname.toLowerCase();
  const title = featureName ?? (
    path.includes('prescription') || path.includes('pharmacy')
      ? 'e-Prescriptions & Pharmacy Management'
      : path.includes('lab')
        ? 'Laboratory Orders & Diagnostic Results'
        : path.includes('inventory')
          ? 'Consumable Hospital Inventory'
          : path.includes('document')
            ? 'Medical Documents & Records'
            : path.includes('setting')
              ? 'Hospital System Settings'
              : 'Enterprise Clinical Extension'
  );

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      <Card className="text-center p-8 rounded-2xl border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/60 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-xs">
          <Sparkles className="w-8 h-8" />
        </div>

        <span className="inline-block text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-200/80 dark:border-emerald-800">
          Enterprise Roadmap · v2.0 Next Release
        </span>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mt-3">
          {title}
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-lg mx-auto leading-relaxed">
          This extension module is scheduled for our upcoming <strong>v2.0 Enterprise Release</strong>.
          The current clinical deployment is actively running the <strong>4 Core Outpatient Modules</strong>:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-6 text-left max-w-lg mx-auto">
          {[
            'Module 1: Patient Registration & Profile (PAT-XXXX)',
            'Module 2: Doctor Schedule & Leave Management',
            'Module 3: Booking, Queue Tokens & Slips (APT-XXXX)',
            'Module 4: Invoicing, Payments & Receipts (INV-XXXX)',
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="text-xs h-9 gap-1.5 rounded-xl"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate('/dashboard')}
            className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
          >
            Go to Dashboard
          </Button>
        </div>
      </Card>

      <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <Shield className="w-4 h-4 text-emerald-600/70" />
        <span>PulseCare HMS — Academic Capstone Deployment (4CS504ME25)</span>
      </div>
    </div>
  );
}
