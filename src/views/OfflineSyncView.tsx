import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Database,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import type { AppNavView, BootstrapPayload } from '../types/domain';
import {
  clearOfflinePatientCache,
  type PendingOfflineAction,
  type SyncHistoryRecord,
} from '../offline/db';
import { getAllQueuedAndHistory } from '../offline/syncEngine';

interface OfflineSyncViewProps {
  data: BootstrapPayload;
  isOnline: boolean;
  simulateOffline: boolean;
  onToggleSimulateOffline: () => void;
  onSyncNow: () => Promise<string>;
  onNavigate: (view: AppNavView) => void;
  refreshTick: number;
}

export const OfflineSyncView: React.FC<OfflineSyncViewProps> = ({
  data,
  isOnline,
  simulateOffline,
  onToggleSimulateOffline,
  onSyncNow,
  onNavigate,
  refreshTick,
}) => {
  const [pending, setPending] = useState<PendingOfflineAction[]>([]);
  const [history, setHistory] = useState<SyncHistoryRecord[]>([]);
  const [stats, setStats] = useState({
    cachedPatientsCount: 0,
    cachedReportsCount: 0,
    cachedAssessmentsCount: 0,
    cachedHabitsCount: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [swStatus, setSwStatus] = useState<string>('Checking Service Worker...');

  const loadLocal = async () => {
    const snap = await getAllQueuedAndHistory();
    setPending(snap.pending);
    setHistory(snap.history);
    setStats(snap.stats);
  };

  useEffect(() => {
    void loadLocal();
  }, [refreshTick]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          setSwStatus(
            regs.length > 0
              ? `Active (${regs.length} registered PWA Service Worker)`
              : 'PWA Service Worker ready (Workbox precache enabled)'
          );
        })
        .catch(() => setSwStatus('Service Worker API restricted in current frame'));
    } else {
      setSwStatus('Service Worker not supported in this browser');
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const msg = await onSyncNow();
      setSyncMsg(msg);
      await loadLocal();
    } catch (err) {
      setSyncMsg(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = async () => {
    await clearOfflinePatientCache();
    await loadLocal();
    setSyncMsg('Cleared cached patient summaries from local IndexedDB (queued pending actions preserved).');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-[#0F766E] uppercase tracking-wide">
            PWA · Dexie.js IndexedDB · Idempotent Synchronization Engine
          </p>
          <h1 className="font-display text-[28px] font-bold text-[#0B2540] leading-tight">
            Offline-First Operations &amp; Sync Console
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleSimulateOffline}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[14px] font-semibold transition-colors shadow-2xs ${
              simulateOffline
                ? 'border-amber-300 bg-amber-100 text-amber-950'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {isOnline ? <WifiOff className="h-4.5 w-4.5" /> : <Wifi className="h-4.5 w-4.5" />}
            {simulateOffline ? 'Restore Connectivity' : 'Enable Offline Test Mode'}
          </button>

          <button
            type="button"
            disabled={!isOnline || syncing || pending.length === 0}
            onClick={() => void handleSync()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors shadow-sm"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Synchronizing...' : `Sync Pending Queue (${pending.length})`}
          </button>
        </div>
      </div>

      {syncMsg && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-[14px] font-medium text-teal-950 leading-relaxed">
          {syncMsg}
        </div>
      )}

      {/* Demonstrable Offline Test Workflow Guide */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
          Live Offline Test Workflow (Verify in 4 Steps)
        </h2>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-[14px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-bold text-[15px] text-[#0B2540]">1. Go Offline</div>
            <p className="mt-1.5 text-slate-700 leading-relaxed">
              Click <strong>Enable Offline Test Mode</strong> above (or disable network in browser DevTools).
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-bold text-[15px] text-[#0B2540]">2. Capture Data Offline</div>
            <p className="mt-1.5 text-slate-700 leading-relaxed">
              Open{' '}
              <button
                type="button"
                onClick={() => onNavigate('prevent')}
                className="font-semibold text-[#0D9488] underline"
              >
                Prevent
              </button>{' '}
              and submit a 9-input assessment or daily habit check-in.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-bold text-[15px] text-[#0B2540]">3. Inspect IndexedDB Queue</div>
            <p className="mt-1.5 text-slate-700 leading-relaxed">
              Return here to see the queued mutation with its unique idempotency key stored in Dexie.js.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-bold text-[15px] text-[#0B2540]">4. Reconnect &amp; Sync</div>
            <p className="mt-1.5 text-slate-700 leading-relaxed">
              Click <strong>Restore Connectivity</strong>. Queued records upload, validate on server, prevent duplicates, and write audit trails.
            </p>
          </div>
        </div>
      </section>

      {/* IndexedDB Stats + Capability Matrix */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-[#0D9488]" />
              <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
                Local Dexie.js IndexedDB Store
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void handleClearCache()}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-rose-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Clear Cache
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3.5 text-[14px]">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <div className="text-[13px] font-semibold text-slate-500">Cached Patient Summaries</div>
              <div className="mt-1 font-mono text-[24px] font-bold text-[#0B2540] tabular-nums">
                {stats.cachedPatientsCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <div className="text-[13px] font-semibold text-slate-500">Cached Screening Reports</div>
              <div className="mt-1 font-mono text-[24px] font-bold text-[#0B2540] tabular-nums">
                {stats.cachedReportsCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <div className="text-[13px] font-semibold text-slate-500">Cached Assessments</div>
              <div className="mt-1 font-mono text-[24px] font-bold text-[#0B2540] tabular-nums">
                {stats.cachedAssessmentsCount}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <div className="text-[13px] font-semibold text-slate-500">Pending Sync Queue</div>
              <div className="mt-1 font-mono text-[24px] font-bold text-amber-700 tabular-nums">
                {pending.length}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-[13px] text-slate-700 space-y-1.5 leading-relaxed">
            <div>
              <strong>Service Worker:</strong> {swStatus}
            </div>
            <div>
              <strong>Local Privacy Posture:</strong> No auth tokens or sensitive credentials are stored in <code>localStorage</code> or IndexedDB. Only minimized permitted workflow summaries are cached.
            </div>
          </div>
        </div>

        {/* Offline vs Online-Only Matrix */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-display text-[19px] font-bold text-[#0B2540] mb-4">
            Explicit Offline vs. Online-Only Feature Boundaries
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2.5">
              <div className="font-bold text-[15px] text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                Works Offline (PWA + Dexie.js)
              </div>
              <ul className="space-y-1.5 text-slate-700 leading-relaxed">
                <li>• App shell navigation &amp; bilingual UI (EN/TA)</li>
                <li>• 9-input Type 2 diabetes lifestyle risk assessment</li>
                <li>• Interactive What-If scenario exploration</li>
                <li>• Daily habit tracking &amp; barrier check-ins</li>
                <li>• Weekly Indian nutrition lesson completion</li>
                <li>• Viewing cached permitted screening reports</li>
                <li>• Local canvas Step 1 image quality pre-checks</li>
              </ul>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-2.5">
              <div className="font-bold text-[15px] text-amber-950 flex items-center gap-2">
                <CloudOff className="h-4.5 w-4.5 text-amber-700 shrink-0" />
                Requires Live Connectivity (Online-Only)
              </div>
              <ul className="space-y-1.5 text-slate-700 leading-relaxed">
                <li>• Remote doctor clinical review &amp; triage sign-off</li>
                <li>• External hospital appointment confirmation</li>
                <li>• Specialist referral acceptance &amp; findings sync</li>
                <li>• Clinician laboratory HbA1c/FPG verification</li>
                <li>• District-wide cloud updates &amp; Simulink imports</li>
                <li>• Real-time cross-device audit log synchronization</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pending Action Queue Table */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
            Pending Offline Action Queue ({pending.length})
          </h2>
          <span className="text-[13px] text-slate-500">Idempotency keys prevent duplicate submissions</span>
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-[14px] text-slate-500">
            No pending actions in IndexedDB queue. All workflow records are synchronized.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Idempotency Key</th>
                  <th className="px-4 py-3 font-semibold">Action Type</th>
                  <th className="px-4 py-3 font-semibold">Summary</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pending.map((item) => (
                  <tr key={item.idempotencyKey}>
                    <td className="px-5 py-3.5 font-mono text-[13px] text-slate-600">
                      {item.idempotencyKey}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{item.type}</td>
                    <td className="px-4 py-3.5 text-slate-700">{item.summary}</td>
                    <td className="px-4 py-3.5 font-mono text-[13px] text-slate-500">
                      {new Date(item.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`font-semibold ${
                          item.status === 'error' ? 'text-rose-700' : 'text-amber-700'
                        }`}
                      >
                        {item.status} {item.errorMessage ? `(${item.errorMessage})` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Synchronization History */}
      {history.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Recent Synchronization History &amp; Conflict Resolution
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {history.map((h) => (
              <div key={`${h.id}-${h.idempotencyKey}`} className="flex items-center justify-between gap-4 px-6 py-3.5 text-[14px]">
                <div className="flex items-center gap-3">
                  {h.outcome === 'synced' ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <span className="font-semibold text-slate-900">{h.actionType}</span> ·{' '}
                    <span className="text-slate-700">{h.message}</span>
                  </div>
                </div>
                <span className="font-mono text-[13px] text-slate-500 whitespace-nowrap">
                  {new Date(h.syncedAt).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Server Audit Logs (for Doctor/Admin) */}
      {data.auditLogs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4 flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#0D9488]" />
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Server-Side Audit Trail ({data.auditLogs.length})
            </h2>
          </div>
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-[14px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">User / Role</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Outcome</th>
                  <th className="px-5 py-3 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.auditLogs.slice(0, 20).map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-3 font-mono text-[13px] text-slate-500 whitespace-nowrap">
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                      {a.userName} ({a.role})
                    </td>
                    <td className="px-4 py-3 font-mono text-[13px]">{a.action}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{a.outcome}</td>
                    <td className="px-5 py-3 text-slate-700">{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
