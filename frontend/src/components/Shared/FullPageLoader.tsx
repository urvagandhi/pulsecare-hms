import { HeartPulse } from 'lucide-react';

interface FullPageLoaderProps {
  label?: string;
  sublabel?: string;
}

export function FullPageLoader({
  label = 'Loading PulseCare Workspace...',
  sublabel = 'Synchronizing medical records & session',
}: FullPageLoaderProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
      <div className="relative flex items-center justify-center">
        {/* Soft pulsing halo */}
        <div className="absolute w-24 h-24 rounded-full bg-emerald-50/800/15 animate-ping duration-1000" />
        
        {/* Outer spinning border ring */}
        <div className="w-20 h-20 rounded-full border-4 border-teal-100 dark:border-teal-900 border-t-teal-600 dark:border-t-teal-400 animate-spin" />
        
        {/* Inner brand emblem */}
        <div className="absolute w-12 h-12 rounded-full bg-white dark:bg-slate-900 shadow-md flex items-center justify-center border border-slate-100 dark:border-slate-800">
          <HeartPulse className="w-6 h-6 text-emerald-600 dark:text-emerald-400 animate-pulse" />
        </div>
      </div>

      <div className="mt-6 text-center space-y-1.5">
        <p className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-200">
          {label}
        </p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          {sublabel}
        </p>
      </div>
    </div>
  );
}

export default FullPageLoader;

