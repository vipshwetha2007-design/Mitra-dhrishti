import React from 'react';
import {
  Activity,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Eye,
  FileText,
  Home,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react';
import type { AppNavView, UserRole } from '../types/domain';
import type { TranslationBundle } from '../i18n/translations';

interface SidebarProps {
  activeView: AppNavView;
  onNavigate: (view: AppNavView) => void;
  role: UserRole;
  t: TranslationBundle;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  unreadCount: number;
  pendingSyncCount: number;
  isOnline: boolean;
}

interface NavItem {
  id: AppNavView;
  label: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  statusIndicator?: 'online' | 'offline';
  roles: UserRole[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onNavigate,
  role,
  t,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  unreadCount,
  pendingSyncCount,
  isOnline,
}) => {
  const primaryItems: NavItem[] = [
    {
      id: 'dashboard',
      label: t.nav.dashboard,
      icon: Home,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'prevent',
      label: t.nav.prevent,
      subtitle: t.nav.preventSub,
      icon: Activity,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'detect',
      label: t.nav.detect,
      subtitle: t.nav.detectSub,
      icon: Eye,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'protect',
      label: t.nav.protect,
      subtitle: t.nav.protectSub,
      icon: role === 'doctor' ? Stethoscope : ShieldCheck,
      roles: ['patient', 'doctor', 'admin'],
    },
  ];

  const secondaryItems: NavItem[] = [
    {
      id: 'reports',
      label: role === 'patient' ? t.nav.reports : 'Clinical Reports',
      icon: FileText,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'appointments',
      label: t.nav.appointments,
      icon: Calendar,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'referrals',
      label: t.nav.referrals,
      icon: Send,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'notifications',
      label: t.nav.notifications,
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'offline',
      label: t.nav.offline,
      icon: RefreshCw,
      badge: pendingSyncCount > 0 ? pendingSyncCount : undefined,
      statusIndicator: isOnline ? 'online' : 'offline',
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'simulink',
      label: t.nav.simulink,
      icon: Cpu,
      roles: ['patient', 'doctor', 'admin'],
    },
    {
      id: 'settings',
      label: t.nav.settings,
      icon: Settings,
      roles: ['patient', 'doctor', 'admin'],
    },
  ];

  const renderItem = (item: NavItem) => {
    if (!item.roles.includes(role)) return null;
    const Icon = item.icon;
    const active = activeView === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          onNavigate(item.id);
          onCloseMobile();
        }}
        title={collapsed ? item.label : undefined}
        className={`group flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left transition-all ${
          active
            ? 'bg-gradient-to-r from-[#00A3A6] to-[#00C2B2] text-white shadow-md font-semibold'
            : 'text-slate-300 hover:bg-white/10 hover:text-white'
        }`}
      >
        <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-slate-300 group-hover:text-white'}`} />
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium leading-tight">{item.label}</div>
            {item.subtitle && (
              <div className="truncate text-[10px] text-slate-300/80 mt-0.5">{item.subtitle}</div>
            )}
          </div>
        )}
        {!collapsed && item.badge !== undefined && (
          <span className="shrink-0 rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums leading-none">
            {item.badge}
          </span>
        )}
        {!collapsed && item.badge === undefined && item.statusIndicator && (
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              item.statusIndicator === 'online' ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
            aria-label={item.statusIndicator === 'online' ? 'Connected' : 'Offline'}
          />
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#06182C] via-[#07203A] to-[#06182C] text-white">
      {/* Brand Lockup */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4 border-b border-white/10">
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 text-left min-w-0"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-teal-400/30">
            <svg viewBox="0 0 40 40" className="h-7 w-7" aria-hidden="true">
              <path
                d="M20 33 C20 33 7 25 7 15.5 C7 10.5 11 7.5 15 7.5 C17.6 7.5 19.2 9 20 10.6 C20.8 9 22.4 7.5 25 7.5 C29 7.5 33 10.5 33 15.5 C33 25 20 33 20 33 Z"
                fill="none"
                stroke="#2DD4BF"
                strokeWidth="2.8"
                strokeLinejoin="round"
              />
              <rect x="18" y="13.5" width="4" height="11" rx="1" fill="#FFFFFF" />
              <rect x="14.5" y="17" width="11" height="4" rx="1" fill="#FFFFFF" />
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-lg font-bold tracking-tight text-white leading-none">
                Mritidhristi
              </div>
              <div className="mt-1 text-[11px] font-medium text-teal-200/85 truncate">
                {t.appTagline}
              </div>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex h-7 w-7 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          className="flex lg:hidden h-8 w-8 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Close navigation menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Primary Pillars */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5" aria-label="Primary Navigation">
        {primaryItems.map(renderItem)}

        <div className="my-3 border-t border-white/10" />

        {secondaryItems.map(renderItem)}
      </nav>

      {/* Bottom Promo Card from Reference Image */}
      {!collapsed && (
        <div className="p-3">
          <div className="overflow-hidden rounded-2xl border border-teal-500/30 bg-[#07243E] shadow-sm relative group cursor-pointer" onClick={() => onNavigate('prevent')}>
            <img
              src="/assets/dashboard/sidebar_card.png"
              alt="A Healthier Tomorrow, Together"
              className="w-full h-auto object-cover rounded-2xl"
              onError={(e) => {
                // Fallback styling if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 border-r border-slate-900/15 ${
          collapsed ? 'w-[76px]' : 'w-[235px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[264px] max-w-[82vw] h-full shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
