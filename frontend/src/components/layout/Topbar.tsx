import { Bell, Moon, Sun, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/store/hooks';

export function Topbar() {
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const user = useAppSelector(s => s.auth.user);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleDark = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
    // classList update handled by useEffect
  };

  return (
    <header className="h-16 border-b border-border bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center px-6 gap-4">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
          <Input
            placeholder="Search patients, appointments, charts..."
            className="pl-10 h-9 rounded-full bg-slate-100/70 dark:bg-slate-800/60 border-transparent focus:border-emerald-500/50 focus:bg-white dark:focus:bg-slate-900 text-xs transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative rounded-full text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">
          <Bell className="w-4 h-4" />
          <Badge className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-[9px] bg-emerald-600 text-white font-bold rounded-full">
            3
          </Badge>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          className="rounded-full text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {user && (
          <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold text-xs tracking-wider">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
