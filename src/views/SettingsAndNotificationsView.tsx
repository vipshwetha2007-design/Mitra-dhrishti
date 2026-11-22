import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Globe,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import type { AppNavView, BootstrapPayload, LanguageCode } from '../types/domain';

interface NotificationsViewProps {
  data: BootstrapPayload;
  onMarkRead: (id: string) => void;
  onNavigate: (view: AppNavView) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  data,
  onMarkRead,
  onNavigate,
}) => {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold text-[#0F766E]">Clinical Alerts &amp; Care Reminders</p>
        <h1 className="font-display text-2xl font-bold text-[#0B2540]">Notifications Center</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100">
        {data.notifications.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No notifications available for this role.
          </div>
        ) : (
          data.notifications.map((n) => (
            <div
              key={n.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 ${
                n.read ? 'opacity-75' : 'bg-teal-50/25'
              }`}
            >
              <div className="flex items-start gap-3">
                {n.severity === 'urgent' || n.severity === 'warning' ? (
                  <AlertCircle
                    className={`h-5 w-5 shrink-0 mt-0.5 ${
                      n.severity === 'urgent' ? 'text-rose-600' : 'text-amber-600'
                    }`}
                  />
                ) : n.severity === 'success' ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <Bell className="h-5 w-5 shrink-0 mt-0.5 text-sky-600" />
                )}
                <div>
                  <div className="text-sm font-semibold text-slate-900">{n.title}</div>
                  <p className="mt-0.5 text-xs text-slate-600">{n.message}</p>
                  <div className="mt-1 font-mono text-[11px] text-slate-400">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Mark Read
                  </button>
                )}
                {n.actionView && (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkRead(n.id);
                      onNavigate(n.actionView!);
                    }}
                    className="rounded-lg bg-[#0B2540] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#113556]"
                  >
                    Open →
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface SettingsViewProps {
  data: BootstrapPayload;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  token: string | null;
  onOpenAuthModal: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  data,
  language,
  onLanguageChange,
  token,
  onOpenAuthModal,
}) => {
  const [rbacResult, setRbacResult] = useState<string | null>(null);
  const [testingRbac, setTestingRbac] = useState(false);

  const testBackendRbac = async () => {
    setTestingRbac(true);
    setRbacResult(null);
    try {
      const res = await fetch('/api/audit-logs', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const body = await res.json();
      if (res.ok) {
        setRbacResult(
          `HTTP ${res.status} OK — Role '${data.user.role}' authorized to read ${body.logs?.length ?? 0} server audit records.`
        );
      } else {
        setRbacResult(
          `HTTP ${res.status} Forbidden — Server RBAC blocked role '${data.user.role}': "${body.error}". Attempt logged to Audit Trail.`
        );
      }
    } catch {
      setRbacResult('Unable to reach backend API (offline mode active).');
    } finally {
      setTestingRbac(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <p className="text-xs font-semibold text-[#0F766E]">Preferences, Privacy &amp; Backend Verification</p>
        <h1 className="font-display text-2xl font-bold text-[#0B2540]">
          Platform Settings &amp; Governance
        </h1>
      </div>

      {/* Language Selection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-[#0D9488]" />
          <h2 className="font-display text-base font-bold text-[#0B2540]">
            Interface Language (Primary: English &amp; Tamil · Hindi Architecture Ready)
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {[
            { code: 'en', title: 'English (Primary)', desc: 'Full clinical & dashboard localization' },
            { code: 'ta', title: 'தமிழ் · Tamil (Primary)', desc: 'Full navigation, hero & lesson localization' },
            { code: 'hi', title: 'हिन्दी · Hindi (Scaffold)', desc: 'Architecture ready for clinical translation review' },
          ].map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => onLanguageChange(opt.code as LanguageCode)}
              className={`rounded-xl border p-3.5 text-left transition-colors ${
                language === opt.code
                  ? 'border-[#0D9488] bg-teal-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold text-slate-900">{opt.title}</div>
              <div className="mt-1 text-slate-600">{opt.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Security & Live Backend RBAC Verification */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#0D9488]" />
            <h2 className="font-display text-base font-bold text-[#0B2540]">
              Role-Based Access Control (RBAC) Live Verification
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="text-xs font-semibold text-[#0D9488] hover:underline"
          >
            Switch Role / Sign In
          </button>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Permissions are enforced on Express backend APIs — not merely hidden in the UI. Click below to call the restricted <code>GET /api/audit-logs</code> endpoint under your active role (<strong>{data.user.role}</strong>).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={testingRbac}
            onClick={() => void testBackendRbac()}
            className="rounded-xl bg-[#0B2540] px-4 py-2 text-xs font-semibold text-white hover:bg-[#113556]"
          >
            {testingRbac ? 'Testing API...' : 'Test Backend RBAC Endpoint'}
          </button>
          {rbacResult && (
            <span className="text-xs font-mono text-slate-800">{rbacResult}</span>
          )}
        </div>
      </section>

      {/* Clinical Boundary & Architecture Summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#0D9488]" />
          <h2 className="font-display text-base font-bold text-[#0B2540]">
            Clinical Boundary &amp; Deployment Notes
          </h2>
        </div>
        <p className="leading-relaxed">{data.meta.clinicalDisclaimer}</p>
        <p className="leading-relaxed">
          Regulatory compliance (e.g., DISHA / DPDP Act / CDSCO SaMD) is treated as an engineering requirement to be formally verified prior to any clinical deployment — never automatically claimed by a prototype.
        </p>
      </section>
    </div>
  );
};
