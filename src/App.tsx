/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { TRANSLATIONS } from './i18n/translations';
import { cachePermittedSnapshot } from './offline/db';
import {
  createIdempotencyKey,
  enqueueOfflineAction,
  getPendingActions,
  synchronizePendingQueue,
} from './offline/syncEngine';
import { evaluateClientExperimentalRisk } from './utils/riskEngine';
import type {
  AppointmentRecord,
  AppNavView,
  BootstrapPayload,
  DoctorReview,
  FollowUpRecord,
  LanguageCode,
  LifestyleAssessment,
  LifestyleInput,
  ReferralRecord,
  RetinalScreening,
  UserRole,
} from './types/domain';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { AdminDashboard } from './views/AdminDashboard';
import { DetectModule } from './views/DetectModule';
import { DoctorDashboard } from './views/DoctorDashboard';
import { OfflineSyncView } from './views/OfflineSyncView';
import { PatientDashboard } from './views/PatientDashboard';
import { PreventModule } from './views/PreventModule';
import { ProtectModule } from './views/ProtectModule';
import { ReportsView } from './views/ReportsView';
import { NotificationsView, SettingsView } from './views/SettingsAndNotificationsView';
import { SimulinkAnalyticsView } from './views/SimulinkAnalyticsView';

export default function App() {
  // Security: Bearer token stored in React memory and synchronized to local prototype storage
  const [token, setTokenState] = useState<string | null>(() => {
    return localStorage.getItem('mitra_drishti_token') || localStorage.getItem('mritidhristi_token');
  });

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('mitra_drishti_token', newToken);
    } else {
      localStorage.removeItem('mitra_drishti_token');
      localStorage.removeItem('mritidhristi_token');
    }
  };

  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<AppNavView>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string>('pat-1');
  const [language, setLanguage] = useState<LanguageCode>('en');
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Offline-first connectivity & queue state
  const [browserOnline, setBrowserOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [simulateOffline, setSimulateOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncTick, setSyncTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const isOnline = browserOnline && !simulateOffline;
  const t = TRANSLATIONS[language];

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => {
      setToast((prev) => (prev === message ? null : prev));
    }, 4500);
  }, []);

  // Register PWA Service Worker
  useEffect(() => {
    try {
      registerSW({ immediate: true });
    } catch {
      // Service worker optional in restricted preview frames
    }
  }, []);

  // Browser online/offline event listeners
  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const items = await getPendingActions();
    setPendingSyncCount(items.length);
    setSyncTick((n) => n + 1);
  }, []);

  const fetchBootstrap = useCallback(async (authToken: string) => {
    const res = await fetch('/api/bootstrap', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to load workspace' }));
      throw new Error(err.error || 'Failed to load workspace');
    }
    const payload = (await res.json()) as BootstrapPayload;
    setData(payload);
    if (payload.patients.length > 0) {
      setSelectedPatientId((prev) =>
        payload.patients.some((p) => p.id === prev) ? prev : payload.patients[0].id
      );
    }
    await cachePermittedSnapshot({
      patients: payload.patients,
      assessments: payload.assessments,
      habitLogs: payload.habitLogs,
      screenings: payload.screenings,
    });
    await refreshPendingCount();
    return payload;
  }, [refreshPendingCount]);

  // Authenticated helper for API requests
  const apiFetch = useCallback(
    async <T,>(url: string, options?: RequestInit): Promise<T> => {
      if (!token) throw new Error('No active authenticated session.');
      const res = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(options?.headers || {}),
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      return body as T;
    },
    [token]
  );

  // Initialize default synthetic Patient demo session on startup
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setFatalError(null);
      try {
        const res = await fetch('/api/auth/demo-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'patient' }),
        });
        if (!res.ok) throw new Error('Unable to initialize prototype session');
        const auth = (await res.json()) as { token: string };
        if (!active) return;
        setToken(auth.token);
        await fetchBootstrap(auth.token);
      } catch (err) {
        if (!active) return;
        setFatalError(err instanceof Error ? err.message : 'Unable to connect to MITRA DRISHTI API');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchBootstrap]);

  const handleSyncNow = useCallback(async (): Promise<string> => {
    if (!token) return 'Sign in required to synchronize.';
    if (!isOnline) return 'Currently offline — pending actions remain safely queued in IndexedDB.';
    const res = await synchronizePendingQueue(token);
    await fetchBootstrap(token);
    showToast(res.message);
    return res.message;
  }, [token, isOnline, fetchBootstrap, showToast]);

  // Auto-synchronize when connectivity is restored and pending actions exist
  useEffect(() => {
    if (isOnline && token && pendingSyncCount > 0) {
      void handleSyncNow();
    }
  }, [isOnline, token, pendingSyncCount, handleSyncNow]);

  // Auth handlers
  const handleSwitchDemoRole = async (role: UserRole) => {
    const res = await fetch('/api/auth/demo-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Role switch failed');
    setToken(body.token);
    await fetchBootstrap(body.token);
    setActiveView('dashboard');
    showToast(`Switched to ${body.user.name} (${body.user.role}).`);
  };

  const handleLogin = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Login failed');
    setToken(body.token);
    await fetchBootstrap(body.token);
    setActiveView('dashboard');
    showToast(`Signed in as ${body.user.name}.`);
  };

  const handleRegisterAccount = async (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    language: LanguageCode;
  }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || 'Registration failed');
    setToken(body.token);
    setLanguage(payload.language);
    await fetchBootstrap(body.token);
    setActiveView('dashboard');
    showToast(`Account created for ${body.user.name}.`);
  };

  // Pillar 1: Prevent handlers (Offline-capable!)
  const handleSubmitAssessment = async (patientId: string, inputs: LifestyleInput) => {
    if (!isOnline) {
      const idempotencyKey = createIdempotencyKey('asm');
      const localEval = evaluateClientExperimentalRisk(inputs);
      await enqueueOfflineAction({
        idempotencyKey,
        type: 'LIFESTYLE_ASSESSMENT',
        patientId,
        summary: `Lifestyle Assessment (Experimental Score ${localEval.experimentalScore}/100 · ${localEval.riskCategory})`,
        payload: { patientId, ...inputs },
        createdAt: new Date().toISOString(),
      });
      const localRecord: LifestyleAssessment = {
        id: `offline-${idempotencyKey}`,
        patientId,
        assessedAt: new Date().toISOString(),
        inputs,
        experimentalScore: localEval.experimentalScore,
        riskCategory: localEval.riskCategory,
        scoringModelLabel: localEval.scoringModelLabel,
        contributions: localEval.contributions,
        topModifiableFactors: localEval.topModifiableFactors,
        explanation: localEval.explanation,
        recommendations: localEval.recommendations,
        recordedOffline: true,
        syncStatus: 'pending',
        idempotencyKey,
      };
      setData((prev) =>
        prev ? { ...prev, assessments: [localRecord, ...prev.assessments] } : prev
      );
      await refreshPendingCount();
      showToast('Saved lifestyle assessment offline to IndexedDB queue.');
      return;
    }

    await apiFetch('/api/prevent/assessments', {
      method: 'POST',
      body: JSON.stringify({ patientId, ...inputs }),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleSubmitHabit = async (payload: {
    patientId: string;
    date: string;
    healthyIndianDiet: boolean;
    stepsAchieved: number;
    sleepHours: number;
    weightKg?: number;
    waistCm?: number;
    barrierReported?: string;
  }) => {
    if (!isOnline) {
      const idempotencyKey = createIdempotencyKey('hab');
      await enqueueOfflineAction({
        idempotencyKey,
        type: 'HABIT_LOG',
        patientId: payload.patientId,
        summary: `Habit Check-in (${payload.date} · ${payload.stepsAchieved} steps · ${payload.sleepHours}h sleep)`,
        payload,
        createdAt: new Date().toISOString(),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              habitLogs: [
                {
                  id: `offline-${idempotencyKey}`,
                  ...payload,
                  recordedOffline: true,
                  syncStatus: 'pending',
                  idempotencyKey,
                },
                ...prev.habitLogs,
              ],
            }
          : prev
      );
      await refreshPendingCount();
      showToast('Queued daily habit log in Dexie IndexedDB.');
      return;
    }

    await apiFetch('/api/prevent/habits', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleCompleteCheckpoint = async (payload: {
    patientId: string;
    day: number;
    weightKg?: number;
    waistCm?: number;
    notes?: string;
  }) => {
    if (!isOnline) {
      const idempotencyKey = createIdempotencyKey('cp');
      await enqueueOfflineAction({
        idempotencyKey,
        type: 'CHECKPOINT_COMPLETE',
        patientId: payload.patientId,
        summary: `Completed ${payload.day}-Day Checkpoint offline`,
        payload,
        createdAt: new Date().toISOString(),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              programmes: prev.programmes.map((pr) => {
                if (pr.patientId !== payload.patientId) return pr;
                return {
                  ...pr,
                  currentWeightKg: payload.weightKg ?? pr.currentWeightKg,
                  currentWaistCm: payload.waistCm ?? pr.currentWaistCm,
                  checkpoints: pr.checkpoints.map((cp) => {
                    if (cp.day !== payload.day) return cp;
                    const weightChangeKg =
                      payload.weightKg !== undefined
                        ? Math.round((payload.weightKg - pr.baselineWeightKg) * 10) / 10
                        : undefined;
                    const waistChangeCm =
                      payload.waistCm !== undefined
                        ? Math.round((payload.waistCm - pr.baselineWaistCm) * 10) / 10
                        : undefined;
                    const parts: string[] = [];
                    if (weightChangeKg !== undefined) parts.push(weightChangeKg <= 0 ? `Weight reduced by ${Math.abs(weightChangeKg)} kg` : `Weight increased by ${weightChangeKg} kg`);
                    if (waistChangeCm !== undefined) parts.push(waistChangeCm <= 0 ? `Waist reduced by ${Math.abs(waistChangeCm)} cm` : `Waist increased by ${waistChangeCm} cm`);
                    return {
                      ...cp,
                      completed: true,
                      completedAt: new Date().toISOString(),
                      status: 'completed',
                      measurements: {
                        weightKg: payload.weightKg,
                        waistCm: payload.waistCm,
                        notes: payload.notes,
                      },
                      baselineComparison: {
                        weightChangeKg,
                        waistChangeCm,
                        summary: parts.join('; ') || 'Checkpoint completed offline.',
                      },
                    };
                  }),
                };
              }),
            }
          : prev
      );
      await refreshPendingCount();
      showToast('Checkpoint completion queued offline.');
      return;
    }

    await apiFetch(`/api/prevent/checkpoints/${payload.day}/complete`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
    showToast(`${payload.day}-Day Checkpoint recorded successfully.`);
  };

  const handleToggleLesson = async (patientId: string, lessonId: string) => {
    if (!isOnline) {
      const idempotencyKey = createIdempotencyKey('les');
      await enqueueOfflineAction({
        idempotencyKey,
        type: 'LESSON_COMPLETE',
        patientId,
        summary: `Marked prevention lesson ${lessonId} complete offline`,
        payload: { patientId, lessonId },
        createdAt: new Date().toISOString(),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              programmes: prev.programmes.map((pr) =>
                pr.patientId !== patientId
                  ? pr
                  : {
                      ...pr,
                      lessons: pr.lessons.map((l) =>
                        l.id === lessonId ? { ...l, completed: !l.completed } : l
                      ),
                    }
              ),
            }
          : prev
      );
      await refreshPendingCount();
      showToast('Lesson progress queued offline.');
      return;
    }

    await apiFetch(`/api/prevent/lessons/${lessonId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ patientId }),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleRegisterPatient = async (payload: {
    name: string;
    age: number;
    sex: 'Female' | 'Male' | 'Other';
    phone: string;
    district: string;
    villageOrWard: string;
    language: LanguageCode;
    diabetesStatus: 'at_risk' | 'prediabetes_lab' | 'diagnosed_t2d';
    screeningConsent: boolean;
    dataStorageConsent: boolean;
    offlineCacheConsent: boolean;
    clinicalBoundaryAcknowledged: boolean;
  }) => {
    const created = await apiFetch<{ id: string }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) {
      await fetchBootstrap(token);
      setSelectedPatientId(created.id);
    }
  };

  const handleRecordLab = async (payload: {
    patientId: string;
    testedAt: string;
    hba1cPercent?: number;
    fastingGlucoseMgDl?: number;
    clinicalNotes: string;
  }) => {
    await apiFetch('/api/clinical/labs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
  };

  // Pillar 2: Detect handler
  const handleSubmitScreening = async (
    payload: Omit<RetinalScreening, 'id' | 'capturedAt' | 'humanReviewStatus' | 'summaryText'>
  ) => {
    await apiFetch('/api/detect/screenings', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
  };

  // Pillar 3: Protect handlers
  const handleSubmitReview = async (payload: {
    screeningId: string;
    decision: DoctorReview['decision'];
    clinicianGrade: string;
    triageCategory: DoctorReview['triageCategory'];
    clinicalNotes: string;
    recommendedNextSteps: string;
  }) => {
    await apiFetch('/api/protect/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleCreateReferral = async (payload: {
    patientId: string;
    screeningId?: string;
    targetFacility: string;
    specialty: ReferralRecord['specialty'];
    urgency: ReferralRecord['urgency'];
    reason: string;
  }) => {
    await apiFetch('/api/protect/referrals', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleUpdateReferral = async (
    id: string,
    status: ReferralRecord['status'],
    specialistFindings?: string
  ) => {
    await apiFetch(`/api/protect/referrals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, specialistFindings }),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleCreateAppointment = async (payload: {
    patientId: string;
    title: string;
    facility: string;
    clinicianName: string;
    scheduledDate: string;
    scheduledTime: string;
    type: AppointmentRecord['type'];
    reminderNote: string;
  }) => {
    await apiFetch('/api/protect/appointments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleUpdateAppointment = async (
    id: string,
    status: AppointmentRecord['status'],
    escalated?: boolean
  ) => {
    await apiFetch(`/api/protect/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, escalated }),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleCreateFollowUp = async (payload: {
    patientId: string;
    healthWorkerName: string;
    dueDate: string;
    channel: FollowUpRecord['channel'];
    status: FollowUpRecord['status'];
    outcomeNotes: string;
    nextScreeningDate?: string;
  }) => {
    await apiFetch('/api/protect/followups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleLogFollowUpAttempt = async (
    followUpId: string,
    payload: {
      date: string;
      type: 'Phone Call' | 'Home Visit';
      notes: string;
      outcome: 'reached' | 'unreachable' | 'declined' | 'rescheduled';
    }
  ) => {
    await apiFetch(`/api/protect/followups/${followUpId}/attempts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
    showToast('Contact attempt logged.');
  };

  const handleUpdateFollowUp = async (
    followUpId: string,
    payload: {
      status?: FollowUpRecord['status'];
      channel?: FollowUpRecord['channel'];
      dueDate?: string;
      outcomeNotes?: string;
      nextScreeningDate?: string;
      priority?: FollowUpRecord['priority'];
      structuredOutcome?: FollowUpRecord['structuredOutcome'];
    }
  ) => {
    await apiFetch(`/api/protect/followups/${followUpId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    if (token) await fetchBootstrap(token);
    showToast('Follow-up record updated.');
  };

  const handleMarkNotificationRead = async (id: string) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          }
        : prev
    );
    if (isOnline && token) {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
    }
  };

  const handleImportSimulinkCsv = async (csvText: string) => {
    await apiFetch('/api/admin/simulink/import', {
      method: 'POST',
      body: JSON.stringify({ csvText }),
    });
    if (token) await fetchBootstrap(token);
  };

  const handleNavigate = (view: AppNavView, patId?: string) => {
    if (patId) setSelectedPatientId(patId);
    // Keep Appointments & Referrals smoothly accessible via Protect tabs or dedicated views
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-[#0D9488]" />
          <h1 className="mt-4 font-display text-lg font-bold text-[#0B2540]">
            Initializing MITRA DRISHTI
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Loading role-scoped healthcare records and IndexedDB offline sync engine...
          </p>
        </div>
      </div>
    );
  }

  if (fatalError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7FA] p-6">
        <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center">
          <h1 className="font-display text-lg font-bold text-rose-800">
            Unable to Load Application
          </h1>
          <p className="mt-2 text-xs text-slate-600">{fatalError || 'Unknown startup error.'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl bg-[#0B2540] px-5 py-2 text-xs font-semibold text-white"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const unreadCount = data.notifications.filter((n) => !n.read).length;

  return (
    <div className="flex min-h-screen bg-[#EAF3FA] text-[#0F2438]">
      <Sidebar
        activeView={activeView}
        onNavigate={(v) => handleNavigate(v)}
        role={data.user.role}
        t={t}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        unreadCount={unreadCount}
        pendingSyncCount={pendingSyncCount}
        isOnline={isOnline}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={data.user}
          language={language}
          onLanguageChange={setLanguage}
          t={t}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isOnline={isOnline}
          simulateOffline={simulateOffline}
          onToggleSimulateOffline={() => {
            setSimulateOffline((prev) => {
              const next = !prev;
              showToast(
                next
                  ? 'Offline Test Mode enabled. Supported Prevent actions now queue in IndexedDB.'
                  : 'Connectivity restored. Checking pending sync queue...'
              );
              return next;
            });
          }}
          pendingSyncCount={pendingSyncCount}
          notifications={data.notifications}
          onNavigate={(v) => handleNavigate(v)}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onMarkNotificationRead={(id) => void handleMarkNotificationRead(id)}
        />

        {/* Main Workspace Canvas */}
        <main className="flex-1 px-4 py-5 lg:px-6 max-w-[1600px] w-full mx-auto">
          {activeView === 'dashboard' && data.user.role === 'patient' && (
            <PatientDashboard
              data={data}
              t={t}
              isOnline={isOnline}
              pendingSyncCount={pendingSyncCount}
              onNavigate={(v) => handleNavigate(v)}
              onSyncNow={() => void handleSyncNow()}
            />
          )}

          {activeView === 'dashboard' && data.user.role === 'doctor' && (
            <DoctorDashboard
              data={data}
              searchQuery={searchQuery}
              onNavigate={handleNavigate}
            />
          )}

          {activeView === 'dashboard' && data.user.role === 'admin' && (
            <AdminDashboard
              data={data}
              onNavigate={(v) => handleNavigate(v)}
              token={token}
              onRefresh={() => {
                if (token) fetchBootstrap(token);
              }}
              onToast={showToast}
            />
          )}

          {activeView === 'prevent' && (
            <PreventModule
              data={data}
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
              isOnline={isOnline}
              onSubmitAssessment={handleSubmitAssessment}
              onSubmitHabit={handleSubmitHabit}
              onToggleLesson={handleToggleLesson}
              onCompleteCheckpoint={handleCompleteCheckpoint}
              onRegisterPatient={handleRegisterPatient}
              onRecordLab={handleRecordLab}
            />
          )}

          {activeView === 'detect' && (
            <DetectModule
              data={data}
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
              isOnline={isOnline}
              authToken={token}
              onSubmitScreening={handleSubmitScreening}
              onNavigateProtect={() => handleNavigate('protect')}
            />
          )}

          {(activeView === 'protect' ||
            activeView === 'appointments' ||
            activeView === 'referrals') && (
            <ProtectModule
              data={data}
              selectedPatientId={selectedPatientId}
              onSelectPatient={setSelectedPatientId}
              isOnline={isOnline}
              initialTab={
                activeView === 'appointments'
                  ? 'appointments'
                  : activeView === 'referrals'
                  ? 'referrals'
                  : 'review'
              }
              onSubmitReview={handleSubmitReview}
              onCreateReferral={handleCreateReferral}
              onUpdateReferral={handleUpdateReferral}
              onCreateAppointment={handleCreateAppointment}
              onUpdateAppointment={handleUpdateAppointment}
              onCreateFollowUp={handleCreateFollowUp}
              onLogFollowUpAttempt={handleLogFollowUpAttempt}
              onUpdateFollowUp={handleUpdateFollowUp}
              onRegisterPatient={handleRegisterPatient}
            />
          )}

          {activeView === 'reports' && (
            <ReportsView data={data} searchQuery={searchQuery} />
          )}

          {activeView === 'notifications' && (
            <NotificationsView
              data={data}
              onMarkRead={(id) => void handleMarkNotificationRead(id)}
              onNavigate={(v) => handleNavigate(v)}
            />
          )}

          {activeView === 'offline' && (
            <OfflineSyncView
              data={data}
              isOnline={isOnline}
              simulateOffline={simulateOffline}
              onToggleSimulateOffline={() => setSimulateOffline((v) => !v)}
              onSyncNow={handleSyncNow}
              onNavigate={(v) => handleNavigate(v)}
              refreshTick={syncTick}
            />
          )}

          {activeView === 'simulink' && (
            <SimulinkAnalyticsView
              data={data}
              isOnline={isOnline}
              onImportCsv={handleImportSimulinkCsv}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              data={data}
              language={language}
              onLanguageChange={setLanguage}
              token={token}
              onOpenAuthModal={() => setAuthModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Live Toast Notification */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-slate-700 bg-[#0B2540] px-4 py-3 text-xs font-medium text-white shadow-xl"
        >
          {toast}
        </div>
      )}

      {/* Role Switcher & Secure Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentUser={data.user}
        onSwitchDemoRole={handleSwitchDemoRole}
        onLogin={handleLogin}
        onRegister={handleRegisterAccount}
      />
    </div>
  );
}
