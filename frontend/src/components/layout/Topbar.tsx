import { Moon, Sun, Search, Menu } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAppSelector } from '@/store/hooks';
import { NotificationDropdown } from './NotificationDropdown';

interface TopbarProps {
  onToggleMobile?: () => void;
}

export function Topbar({ onToggleMobile }: TopbarProps) {
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
    <header className="relative z-40 h-16 border-b border-border bg-white dark:bg-slate-900 flex items-center px-4 sm:px-6 gap-3 sm:gap-4 shrink-0 shadow-xs">
      {/* Mobile hamburger menu button */}
      {onToggleMobile && (
        <button
          onClick={onToggleMobile}
          className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
        </button>
      )}

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600/60 dark:text-emerald-400/60" />
          <Input
            placeholder="Search patients, appointments, charts..."
            className="pl-10 h-9 rounded-full bg-slate-100/70 dark:bg-slate-800/60 border-transparent focus:border-emerald-500/50 focus:bg-white dark:focus:bg-slate-900 text-xs transition-all w-full"
          />
        </div>
      </div>

      {/* Right Utility Group (Bell, Theme Toggle, Profile Avatar) - shifted to far right */}
      <div className="flex items-center gap-2 sm:gap-3 ml-auto">
        <NotificationDropdown />

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDark}
          aria-label="Toggle theme"
          className="rounded-full text-slate-600 dark:text-slate-300 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {user && (
          <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <span className="text-emerald-700 dark:text-emerald-300 font-bold text-xs tracking-wider">
                {user.firstName[0]}{user.lastName[0]}
              </span>
            </div>
            <div className="hidden sm:block text-left text-xs leading-tight">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-[10px] text-slate-400 capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
