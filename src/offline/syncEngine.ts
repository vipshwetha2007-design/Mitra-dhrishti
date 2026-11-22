import { offlineDb, type PendingOfflineAction } from './db';

export function createIdempotencyKey(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${rand}`;
}

export async function enqueueOfflineAction(action: Omit<PendingOfflineAction, 'id' | 'status'>) {
  const record: PendingOfflineAction = {
    ...action,
    status: 'pending',
  };
  await offlineDb.pendingActions.add(record);
  return record;
}

export async function getPendingActions(): Promise<PendingOfflineAction[]> {
  return offlineDb.pendingActions.where('status').anyOf(['pending', 'error']).sortBy('createdAt');
}

export async function getAllQueuedAndHistory() {
  const pending = await offlineDb.pendingActions.toArray();
  const history = await offlineDb.syncHistory.orderBy('syncedAt').reverse().limit(30).toArray();
  const cachedPatientsCount = await offlineDb.patients.count();
  const cachedReportsCount = await offlineDb.cachedReports.count();
  const cachedAssessmentsCount = await offlineDb.assessments.count();
  const cachedHabitsCount = await offlineDb.habitLogs.count();

  return {
    pending,
    history,
    stats: {
      cachedPatientsCount,
      cachedReportsCount,
      cachedAssessmentsCount,
      cachedHabitsCount,
    },
  };
}

export async function synchronizePendingQueue(token: string): Promise<{
  syncedCount: number;
  duplicateCount: number;
  errorCount: number;
  message: string;
}> {
  const pending = await getPendingActions();
  if (pending.length === 0) {
    return { syncedCount: 0, duplicateCount: 0, errorCount: 0, message: 'All local actions are already synchronized.' };
  }

  for (const item of pending) {
    if (item.id !== undefined) {
      await offlineDb.pendingActions.update(item.id, { status: 'syncing', errorMessage: undefined });
    }
  }

  const response = await fetch('/api/sync/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      actions: pending.map((p) => ({
        idempotencyKey: p.idempotencyKey,
        type: p.type,
        createdAt: p.createdAt,
        payload: p.payload,
      })),
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({ error: 'Sync request failed' }));
    for (const item of pending) {
      if (item.id !== undefined) {
        await offlineDb.pendingActions.update(item.id, {
          status: 'error',
          errorMessage: errBody.error || 'Server rejected sync batch',
        });
      }
    }
    throw new Error(errBody.error || 'Synchronization failed');
  }

  const data = (await response.json()) as {
    syncedAt: string;
    results: {
      idempotencyKey: string;
      status: 'synced' | 'duplicate_skipped' | 'rejected';
      resourceId?: string;
      message: string;
    }[];
  };

  let syncedCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;

  for (const res of data.results) {
    const matched = pending.find((p) => p.idempotencyKey === res.idempotencyKey);
    await offlineDb.syncHistory.add({
      syncedAt: data.syncedAt,
      idempotencyKey: res.idempotencyKey,
      actionType: matched?.type || 'UNKNOWN',
      outcome: res.status,
      message: res.message,
    });

    if (matched?.id !== undefined) {
      if (res.status === 'synced') {
        syncedCount++;
        await offlineDb.pendingActions.delete(matched.id);
      } else if (res.status === 'duplicate_skipped') {
        duplicateCount++;
        await offlineDb.pendingActions.delete(matched.id);
      } else {
        errorCount++;
        await offlineDb.pendingActions.update(matched.id, {
          status: 'error',
          errorMessage: res.message,
        });
      }
    }
  }

  return {
    syncedCount,
    duplicateCount,
    errorCount,
    message: `Synced ${syncedCount} item(s), skipped ${duplicateCount} duplicate(s), ${errorCount} error(s).`,
  };
}
