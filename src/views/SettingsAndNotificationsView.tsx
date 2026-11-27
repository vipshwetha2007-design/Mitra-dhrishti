import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Globe,
  Lock,
  Server,
  ShieldCheck,
} from 'lucide-react';
import type { AppNavView, BootstrapPayload, LanguageCode } from '../types/domain';
import { apiUrl, getApiBaseUrl, setApiBaseUrl } from '../services/apiConfig';

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
    <div className="space-y-6">
      <div>
        <p className="text-[14px] font-semibold text-[#0F766E] uppercase tracking-wide">Clinical Alerts &amp; Care Reminders</p>
        <h1 className="font-display text-[28px] font-bold text-[#0B2540] leading-tight">Notifications Center</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 shadow-sm overflow-hidden">
        {data.notifications.length === 0 ? (
          <div className="p-8 text-center text-[14px] text-slate-500">
            No notifications available for this role.
          </div>
        ) : (
          data.notifications.map((n) => (
            <div
              key={n.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 ${
                n.read ? 'opacity-75' : 'bg-teal-50/25'
              }`}
            >
              <div className="flex items-start gap-3.5">
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
                  <div className="text-[15px] font-semibold text-slate-900">{n.title}</div>
                  <p className="mt-1 text-[14px] text-slate-700 leading-relaxed">{n.message}</p>
                  <div className="mt-1.5 font-mono text-[12px] text-slate-500">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                {!n.read && (
                  <button
                    type="button"
                    onClick={() => onMarkRead(n.id)}
                    className="rounded-xl border border-slate-300 px-3.5 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
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
                    className="rounded-xl bg-[#0B2540] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#113556] transition-colors shadow-sm"
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
  const [apiUrlInput, setApiUrlInput] = useState(getApiBaseUrl());
  const [apiSaveStatus, setApiSaveStatus] = useState<string | null>(null);

  const handleSaveApiUrl = () => {
    setApiBaseUrl(apiUrlInput);
    setApiSaveStatus('Saved! Reloading to apply configuration...');
    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const testBackendRbac = async () => {
    setTestingRbac(true);
    setRbacResult(null);
    try {
      const res = await fetch(apiUrl('/api/audit-logs'), {
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
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-[14px] font-semibold text-[#0F766E] uppercase tracking-wide">Preferences, Privacy &amp; Backend Verification</p>
        <h1 className="font-display text-[28px] font-bold text-[#0B2540] leading-tight">
          Platform Settings &amp; Governance
        </h1>
      </div>

      {/* Language Selection */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Globe className="h-5 w-5 text-[#0D9488]" />
          <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
            Interface Language (Primary: English &amp; Tamil · Hindi Architecture Ready)
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[14px]">
          {[
            { code: 'en', title: 'English (Primary)', desc: 'Full clinical & dashboard localization' },
            { code: 'ta', title: 'தமிழ் · Tamil (Primary)', desc: 'Full navigation, hero & lesson localization' },
            { code: 'hi', title: 'हिन्दी · Hindi (Scaffold)', desc: 'Architecture ready for clinical translation review' },
          ].map((opt) => (
            <button
              key={opt.code}
              type="button"
              onClick={() => onLanguageChange(opt.code as LanguageCode)}
              className={`rounded-xl border p-4 text-left transition-colors ${
                language === opt.code
                  ? 'border-[#0D9488] bg-teal-50/50 shadow-xs'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="font-bold text-[15px] text-slate-900">{opt.title}</div>
              <div className="mt-1.5 text-[13px] text-slate-600 leading-relaxed">{opt.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* Security & Live Backend RBAC Verification */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-[#0D9488]" />
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Role-Based Access Control (RBAC) Live Verification
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="text-[14px] font-semibold text-[#0D9488] hover:underline"
          >
            Switch Role / Sign In
          </button>
        </div>
        <p className="text-[14px] text-slate-700 leading-relaxed">
          Permissions are enforced on Express backend APIs — not merely hidden in the UI. Click below to call the restricted <code>GET /api/audit-logs</code> endpoint under your active role (<strong>{data.user.role}</strong>).
        </p>
        <div className="flex flex-wrap items-center gap-3.5 pt-1">
          <button
            type="button"
            disabled={testingRbac}
            onClick={() => void testBackendRbac()}
            className="rounded-xl bg-[#0B2540] px-4.5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#113556] transition-colors shadow-sm"
          >
            {testingRbac ? 'Testing API...' : 'Test Backend RBAC Endpoint'}
          </button>
          {rbacResult && (
            <span className="text-[13px] font-mono text-slate-800 leading-relaxed">{rbacResult}</span>
          )}
        </div>
      </section>

      {/* Backend API Gateway Configuration */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Server className="h-5 w-5 text-[#0F766E]" />
          <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
            Backend API Gateway Configuration
          </h2>
        </div>
        <p className="text-[14px] text-slate-700 leading-relaxed">
          Configure the active MITRA DRISHTI backend service URL (Express &amp; Python AI inference daemon). In local development and unified deployments, leave empty to use same-origin relative endpoints.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            placeholder="e.g. https://api.yourdomain.com or leave empty for same-origin"
            value={apiUrlInput}
            onChange={(e) => setApiUrlInput(e.target.value)}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-[14px] font-mono text-slate-800 focus:border-[#0F766E] focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSaveApiUrl}
            className="rounded-xl bg-[#0F766E] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0D655E] transition-colors shadow-sm"
          >
            Save Gateway URL
          </button>
        </div>
        {apiSaveStatus && (
          <p className="text-[13px] text-emerald-600 font-medium">{apiSaveStatus}</p>
        )}
        <div className="text-[12px] text-slate-500 font-mono">
          Active Endpoint: {getApiBaseUrl() ? `${getApiBaseUrl()}/api/...` : 'Relative Origin (/api/...)'}
        </div>
      </section>

      {/* Clinical Boundary & Architecture Summary */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 text-[14px] text-slate-700 shadow-sm leading-relaxed">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-[#0D9488]" />
          <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
            Clinical Boundary &amp; Deployment Notes
          </h2>
        </div>
        <p>{data.meta.clinicalDisclaimer}</p>
        <p>
          Regulatory compliance (e.g., DISHA / DPDP Act / CDSCO SaMD) is treated as an engineering requirement to be formally verified prior to any clinical deployment — never automatically claimed by a prototype.
        </p>
      </section>
    </div>
  );
};
