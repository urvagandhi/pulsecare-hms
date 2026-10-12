import { useId } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

const COLOR_CONFIG = {
  blue:   { bar: 'from-emerald-400 to-teal-500',    iconBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400', spark: '#10b981' },
  green:  { bar: 'from-teal-400 to-emerald-600',   iconBg: 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',       spark: '#0d9488' },
  amber:  { bar: 'from-amber-400 to-emerald-500',   iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',     spark: '#f59e0b' },
  purple: { bar: 'from-teal-400 to-cyan-500',      iconBg: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400',       spark: '#06b6d4' },
  pink:   { bar: 'from-rose-400 to-emerald-500',    iconBg: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',       spark: '#f43f5e' },
} as const;

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendDir?: 'up' | 'down' | 'neutral';
  color: keyof typeof COLOR_CONFIG;
  icon: React.ReactNode;
  sparklineData?: number[];
  isLoading?: boolean;
}

export function KpiCard({
  title, value, subtitle, trend, trendDir = 'neutral',
  color, icon, sparklineData, isLoading,
}: KpiCardProps) {
  const uid = useId();
  const cfg = COLOR_CONFIG[color];
  const sparkData = (sparklineData ?? []).map((v, i) => ({ i, v }));

  return (
    <div className="relative bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className={cn('absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r', cfg.bar)} />
      <div className="p-4 pt-5">
        <div className="flex items-start justify-between mb-2">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-lg', cfg.iconBg)}>
            {icon}
          </div>
          {trend && (
            <span className={cn('text-[10px] font-bold px-2 py-1 rounded-full', {
              'bg-emerald-50 text-emerald-700': trendDir === 'up',
              'bg-red-50 text-red-600':         trendDir === 'down',
              'bg-slate-100 text-slate-500':    trendDir === 'neutral',
            })}>
              {trendDir === 'up' ? '↑ ' : trendDir === 'down' ? '↓ ' : ''}{trend}
            </span>
          )}
        </div>
        {isLoading ? (
          <div className="h-7 bg-slate-100 rounded animate-pulse my-1" />
        ) : (
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{value}</p>
        )}
        <p className="text-[11px] text-slate-500 mt-0.5">{title}</p>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {sparklineData && sparklineData.length > 0 && (
        <div className="h-10 px-1 pb-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`kpi-spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.spark} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={cfg.spark} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone" dataKey="v"
                stroke={cfg.spark} strokeWidth={1.5}
                fill={`url(#kpi-spark-${uid})`}
                dot={false} isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
