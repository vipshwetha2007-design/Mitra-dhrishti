import Dexie, { type Table } from 'dexie';
import type {
  HabitLog,
  LifestyleAssessment,
  PatientRecord,
  RetinalScreening,
} from '../types/domain';

export interface PendingOfflineAction {
  id?: number;
  idempotencyKey: string;
  type:
    | 'LIFESTYLE_ASSESSMENT'
    | 'HABIT_LOG'
    | 'LESSON_COMPLETE'
    | 'CHECKPOINT_COMPLETE'
    | 'VHN_PATIENT_REGISTER'
    | 'VHN_FOLLOWUP_UPDATE'
    | 'APPOINTMENT_REQUEST';
  patientId: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
}

export interface SyncHistoryRecord {
  id?: number;
  syncedAt: string;
  idempotencyKey: string;
  actionType: string;
  outcome: 'synced' | 'duplicate_skipped' | 'conflict_resolved' | 'rejected';
  message: string;
}

export interface CachedPatientSummary {
  id: string;
  mrn: string;
  name: string;
  district: string;
  language: string;
  diabetesStatus: string;
  cachedAt: string;
}

export interface CachedReportSummary {
  id: string;
  patientId: string;
  capturedAt: string;
  eye: string;
  gradeLabel: string;
  humanReviewStatus: string;
  summaryText: string;
}

/**
 * MITRA DRISHTI IndexedDB Offline Store (Dexie.js)
 * Security boundary: Never stores auth bearer tokens, passwords, or unrestricted cohort PHI.
 * Only permitted patient workflow summaries and queued offline mutations are cached locally.
 */
class MritidhristiOfflineDB extends Dexie {
  patients!: Table<CachedPatientSummary, string>;
  assessments!: Table<LifestyleAssessment, string>;
  habitLogs!: Table<HabitLog, string>;
  cachedReports!: Table<CachedReportSummary, string>;
  pendingActions!: Table<PendingOfflineAction, number>;
  syncHistory!: Table<SyncHistoryRecord, number>;

  constructor() {
    super('MritidhristiOfflineDB');
    this.version(1).stores({
      patients: 'id, mrn, district',
      assessments: 'id, patientId, assessedAt, syncStatus',
      habitLogs: 'id, patientId, date, syncStatus',
      cachedReports: 'id, patientId, capturedAt',
      pendingActions: '++id, idempotencyKey, type, patientId, status, createdAt',
      syncHistory: '++id, syncedAt, outcome',
    });
  }
}

export const offlineDb = new MritidhristiOfflineDB();

export async function cachePermittedSnapshot(params: {
  patients: PatientRecord[];
  assessments: LifestyleAssessment[];
  habitLogs: HabitLog[];
  screenings: RetinalScreening[];
}) {
  try {
    const now = new Date().toISOString();
    await offlineDb.transaction(
      'rw',
      offlineDb.patients,
      offlineDb.assessments,
      offlineDb.habitLogs,
      offlineDb.cachedReports,
      async () => {
        await offlineDb.patients.clear();
        await offlineDb.patients.bulkPut(
          params.patients.map((p) => ({
            id: p.id,
            mrn: p.mrn,
            name: p.name,
            district: p.district,
            language: p.language,
            diabetesStatus: p.diabetesStatus,
            cachedAt: now,
          }))
        );
        await offlineDb.assessments.bulkPut(params.assessments);
        await offlineDb.habitLogs.bulkPut(params.habitLogs);
        await offlineDb.cachedReports.clear();
        await offlineDb.cachedReports.bulkPut(
          params.screenings.map((s) => ({
            id: s.id,
            patientId: s.patientId,
            capturedAt: s.capturedAt,
            eye: s.eye,
            gradeLabel: s.modelPrediction.gradeLabel,
            humanReviewStatus: s.humanReviewStatus,
            summaryText: s.summaryText,
          }))
        );
      }
    );
  } catch (err) {
    console.error('IndexedDB snapshot cache failed:', err);
  }
}

export async function clearOfflinePatientCache() {
  await offlineDb.transaction(
    'rw',
    offlineDb.patients,
    offlineDb.assessments,
    offlineDb.habitLogs,
    offlineDb.cachedReports,
    async () => {
      await offlineDb.patients.clear();
      await offlineDb.assessments.clear();
      await offlineDb.habitLogs.clear();
      await offlineDb.cachedReports.clear();
    }
  );
}
