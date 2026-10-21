import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import type { AuthUser } from '@/store/authSlice';
import {
  LayoutDashboard, Users, Calendar, FileText,
  Award, BarChart3, LogOut, Menu, ChevronRight,
  // Optional 5th module & Phase 2 icons (uncomment if re-enabling):
  // Pill, FlaskConical, Boxes, Settings
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Logo } from '@/components/Shared/Logo';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: Array<AuthUser['role']>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'] },

  // =========================================================================
  // CORE 4 MODULES (Outpatient Clinical Workflow)
  // =========================================================================

  // 1. Patient Registration & Profile Management (PAT-XXXX)
  { label: 'Patients', href: '/admin/patients', icon: Users, roles: ['admin', 'receptionist'] },

  // 2. Doctor & Staff / Department Management (DOC-XXXX)
  { label: 'Staff & Doctors', href: '/admin/staff', icon: Award, roles: ['admin'] },

  // 3. Outpatient Appointment Scheduling & Queue Management (APT-XXXX)
  { label: 'Book Appointment', href: '/patient/book-appointment', icon: Calendar, roles: ['patient'] },
  { label: 'Appointments', href: '/patient/appointments', icon: Calendar, roles: ['patient'] },
  { label: 'Appointments', href: '/admin/appointments', icon: Calendar, roles: ['admin', 'receptionist'] },
  { label: 'Appointments', href: '/doctor/schedule', icon: Calendar, roles: ['doctor'] },

  // 4. Billing, Invoicing & POS Payment Settlement (INV-XXXX)
  { label: 'Billing & Invoices', href: '/admin/billing', icon: FileText, roles: ['admin', 'receptionist'] },
  { label: 'My Bills', href: '/patient/billing', icon: FileText, roles: ['patient'] },

  // =========================================================================
  // OPTIONAL 5th MODULE: Pharmacy & Prescriptions (Uncomment if presenting 5)
  // =========================================================================
  // { label: 'Pharmacy', href: '/admin/pharmacy', icon: Pill, roles: ['admin'] },
  // { label: 'Prescriptions', href: '/doctor/prescriptions', icon: Pill, roles: ['doctor'] },
  // { label: 'Dispensing', href: '/nurse/dispensing', icon: Pill, roles: ['nurse'] },
  // { label: 'Prescriptions', href: '/patient/prescriptions', icon: Pill, roles: ['patient'] },

  // =========================================================================
  // DE-SCOPED EXTENSION MODULES (Preserved for Phase 2 Enterprise Roadmap)
  // =========================================================================

  // [DE-SCOPED 1] Laboratory Management
  // { label: 'Lab Orders', href: '/doctor/lab', icon: FlaskConical, roles: ['doctor'] },
  // { label: 'Lab Tests', href: '/admin/lab', icon: FlaskConical, roles: ['admin'] },
  // { label: 'Lab Results', href: '/patient/lab', icon: FlaskConical, roles: ['patient'] },

  // [DE-SCOPED 2] Hospital Consumable Inventory
  // { label: 'Inventory', href: '/admin/inventory', icon: Boxes, roles: ['admin'] },
  // { label: 'Inventory', href: '/nurse/inventory', icon: Boxes, roles: ['nurse'] },

  // [DE-SCOPED 3] Medical Document Management
  // { label: 'Documents', href: '/admin/documents', icon: FileText, roles: ['admin'] },
  // { label: 'Documents', href: '/doctor/documents', icon: FileText, roles: ['doctor'] },
  // { label: 'My Documents', href: '/patient/documents', icon: FileText, roles: ['patient'] },

  // [DE-SCOPED 4] Settings Module
  // { label: 'Settings', href: '/admin/settings', icon: Settings, roles: ['admin'] },

  // Reporting & Performance Analytics Dashboard (Summarizes Core 4)
  { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['admin', 'doctor', 'nurse', 'receptionist'] },
];

interface SidebarProps {
  onCloseMobile?: () => void;
}

export function Sidebar({ onCloseMobile }: SidebarProps) {
  const { user } = usePermissions();
  const { logoutMutation } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(item => user && item.roles.includes(user.role));

  return (
    <aside className={cn(
      'flex flex-col h-full bg-white dark:bg-slate-900 border-r border-border transition-all duration-300 shadow-sm md:shadow-none',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo area */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {collapsed ? (
          <Logo iconOnly size="sm" />
        ) : (
          <Logo size="md" />
        )}
        <div className="flex items-center gap-1 ml-auto">
          {/* Collapse desktop toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden md:flex text-slate-500"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          {/* Mobile close button */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden text-slate-500"
              aria-label="Close sidebar"
            >
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {visibleItems.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => onCloseMobile?.()}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all group',
              isActive
                ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
            )}
          >
            <item.icon className="w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="p-3 border-t border-border bg-slate-50/50 dark:bg-slate-900/50">
        {!collapsed && user && (
          <div className="px-3 py-2 mb-1.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
            <p className="text-[13px] font-bold text-slate-900 dark:text-white truncate">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 capitalize tracking-wide font-medium">
              {user.role}
            </p>
          </div>
        )}
        <button
          onClick={() => logoutMutation.mutate()}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
