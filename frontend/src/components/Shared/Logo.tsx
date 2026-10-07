
interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  iconOnly?: boolean;
}

export function Logo({ size = 'md', showText = true, className = '', iconOnly = false }: LogoProps) {
  const sizeMap = {
    sm: { box: 'w-7 h-7', icon: 'w-4 h-4', text: 'text-base', sub: 'text-[10px]' },
    md: { box: 'w-9 h-9', icon: 'w-5 h-5', text: 'text-lg', sub: 'text-xs' },
    lg: { box: 'w-12 h-12', icon: 'w-7 h-7', text: 'text-2xl', sub: 'text-xs' },
    xl: { box: 'w-16 h-16', icon: 'w-9 h-9', text: 'text-3xl', sub: 'text-sm' },
  };

  const dim = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {/* Pulse / Medical Cross emblem */}
      <div
        className={`${dim.box} rounded-xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 flex items-center justify-center shadow-sm shadow-teal-900/10 shrink-0 text-white`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`${dim.icon} text-white drop-shadow`}
        >
          {/* Medical Pulse Heartbeat Wave */}
          <path d="M2 12h3.5l2-5 3.5 10 3-8 2 5 2-2h4" />
          {/* Subtle Top & Bottom Cross Nodes */}
          <circle cx="10.5" cy="4" r="1.2" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      </div>

      {showText && !iconOnly && (
        <div className="flex flex-col leading-none">
          <div className="flex items-center gap-1.5">
            <span className={`font-bold tracking-tight text-slate-900 dark:text-white ${dim.text}`}>
              Pulse<span className="text-teal-600 dark:text-teal-400">Care</span>
            </span>
            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-200 dark:border-teal-800 tracking-wider">
              HMS
            </span>
          </div>
          <span className={`text-muted-foreground font-medium hidden sm:inline-block ${dim.sub} mt-0.5`}>
            Hospital Management System
          </span>
        </div>
      )}
    </div>
  );
}
