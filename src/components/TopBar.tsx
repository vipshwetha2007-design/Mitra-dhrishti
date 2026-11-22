import React, { useState } from 'react';
import {
  Bell,
  ChevronDown,
  Download,
  Globe,
  Menu,
  Search,
  UserCheck,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  AppNavView,
  LanguageCode,
  NotificationItem,
  UserAccount,
} from '../types/domain';
import type { TranslationBundle } from '../i18n/translations';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface TopBarProps {
  user: UserAccount;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  t: TranslationBundle;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isOnline: boolean;
  simulateOffline: boolean;
  onToggleSimulateOffline: () => void;
  pendingSyncCount: number;
  notifications: NotificationItem[];
  onNavigate: (view: AppNavView) => void;
  onOpenAuthModal: () => void;
  onOpenMobileMenu: () => void;
  onMarkNotificationRead: (id: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  language,
  onLanguageChange,
  t,
  searchQuery,
  onSearchChange,
  isOnline,
  simulateOffline,
  onToggleSimulateOffline,
  pendingSyncCount,
  notifications,
  onNavigate,
  onOpenAuthModal,
  onOpenMobileMenu,
  onMarkNotificationRead,
}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();

  const unread = notifications.filter((n) => !n.read);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-blue-100/60 bg-[#EAF3FA]/95 backdrop-blur-md">
        <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
          {/* Left: Mobile Menu + Rounded-Full Search Bar */}
          <div className="flex flex-1 items-center gap-3 min-w-0 max-w-xl">
            <button
              type="button"
              onClick={onOpenMobileMenu}
              className="flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              aria-label="Open navigation menu"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="relative flex-1 min-w-0 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search patients, reports, or services..."
                aria-label="Global search"
                className="w-full rounded-full border border-blue-100/80 bg-white py-2 pl-10 pr-4 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0D9488] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20 shadow-2xs"
              />
            </div>
          </div>

          {/* Right: Online Status, Notifications, Language, PWA, Profile Avatar */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Online Status Badge matching reference */}
            <button
              type="button"
              onClick={onToggleSimulateOffline}
              title={
                simulateOffline
                  ? 'Simulated Offline Mode active — click to restore connectivity'
                  : 'Click to simulate offline mode for testing IndexedDB queue'
              }
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs ${
                isOnline
                  ? 'border border-emerald-200/80 bg-[#E8F8EE] text-[#10B981] hover:bg-[#D5F3DF]'
                  : 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  isOnline ? 'bg-[#10B981]' : 'bg-amber-500'
                }`}
              />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
              {pendingSyncCount > 0 && (
                <span className="font-mono tabular-nums text-[10px] text-amber-800">
                  · {pendingSyncCount}
                </span>
              )}
            </button>

            {/* Language Selector (EN / TA / HI) */}
            <div className="hidden lg:flex items-center gap-1 rounded-full border border-blue-100/80 bg-white px-2.5 py-1 shadow-2xs">
              <Globe className="h-3.5 w-3.5 text-slate-400" />
              <select
                aria-label="Select language"
                value={language}
                onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
                className="bg-transparent text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="en">EN</option>
                <option value="ta">தமிழ்</option>
                <option value="hi">हिन्दी (Beta)</option>
              </select>
            </div>

            {/* In-App PWA Install Button */}
            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={() => void install()}
                className="hidden xl:flex items-center gap-1.5 rounded-full bg-[#0B2540] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#113556] transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" />
                Install App
              </button>
            )}

            {/* Notifications Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full border border-blue-100/80 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unread.length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#EF4444] text-[10px] font-bold text-white shadow-xs">
                    {unread.length}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-xl z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="font-display text-sm font-semibold text-slate-900">
                      Alerts &amp; Notifications
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        onNavigate('notifications');
                      }}
                      className="text-xs font-medium text-[#0D9488] hover:underline"
                    >
                      View all
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500">
                        No notifications for this account.
                      </div>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            onMarkNotificationRead(n.id);
                            setNotifOpen(false);
                            if (n.actionView) onNavigate(n.actionView);
                          }}
                          className={`block w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                            n.read ? 'opacity-70' : 'bg-teal-50/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {new Date(n.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Role Switch Trigger matching reference */}
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-2 rounded-full border border-blue-100/80 bg-white pl-1 pr-3 py-1 text-left hover:bg-slate-50 transition-colors shrink-0 shadow-2xs"
            >
              <img
                src="/assets/dashboard/avatar_shwetha_64.png"
                alt={user.name}
                className="h-8 w-8 rounded-full object-cover border border-white shadow-2xs shrink-0"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="hidden sm:block min-w-0">
                <div className="truncate text-xs font-bold text-[#0B2540] leading-tight">
                  {user.name}
                </div>
                <div className="text-[10px] text-slate-500 capitalize flex items-center gap-0.5">
                  <span>{user.role === 'admin' ? 'District Admin' : user.role}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </div>
              </div>
            </button>
          </div>
        </div>
      </header>
        </div>
      </header>

      {/* iOS Install Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                Install Mritidhristi on iOS
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              1. Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.<br />
              2. Scroll down and select <strong>Add to Home Screen</strong>.<br />
              3. Launch Mritidhristi offline directly from your home screen.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-lg bg-[#0B2540] py-2 text-sm font-medium text-white hover:bg-[#113556]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
