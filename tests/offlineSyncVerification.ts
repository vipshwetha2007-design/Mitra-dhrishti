import http from 'http';
import { createMritidhristiApp } from '../server.ts';
import { store } from '../server/store.ts';

let passed = 0;
let failed = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

async function runOfflineSyncTests() {
  console.log('===================================================================');
  console.log(' MITRA DRISHTI PHASE 10: OFFLINE SYNCHRONIZATION & CONFLICT RESOLUTION');
  console.log('===================================================================');

  process.env.MRITIDHRISTI_TEST = 'true';
  const app = await createMritidhristiApp({ skipFrontend: true });
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Authenticate sessions
    const docLogin = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'doctor' }),
    });
    const { token: docToken } = await docLogin.json();

    const patLogin = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient' }),
    });
    const { token: patToken } = await patLogin.json();

    // 2. Test VHN Rural Patient Registration via Offline Batch
    const ruralIdempotencyKey = `vhn-reg-${Date.now()}-abc123`;
    const regPayload = {
      actions: [
        {
          idempotencyKey: ruralIdempotencyKey,
          type: 'VHN_PATIENT_REGISTER',
          createdAt: new Date().toISOString(),
          payload: {
            name: 'Muthulakshmi R (Rural Cohort)',
            age: 52,
            sex: 'Female',
            phone: '9842112345',
            district: 'Madurai',
            villageOrWard: 'Keeladi - East Colony',
            language: 'ta',
            diabetesStatus: 'diagnosed_t2d',
            screeningConsent: true,
            dataStorageConsent: true,
            offlineCacheConsent: true,
            clinicalBoundaryAcknowledged: true,
          },
        },
      ],
    };

    const regRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
      body: JSON.stringify(regPayload),
    });
    const regData = await regRes.json();

    assert(regRes.status === 200, 'POST /api/sync/batch returns HTTP 200 for doctor');
    assert(regData.results[0].status === 'synced', 'VHN rural patient successfully registered and synchronized');
    const createdPatientId = regData.results[0].resourceId;
    assert(Boolean(createdPatientId), `Assigned patient resourceId: ${createdPatientId}`);

    // Verify patient actually exists in database
    const enrolled = store.data.patients.find((p) => p.id === createdPatientId);
    assert(Boolean(enrolled), 'Registered patient present in server persistent memory');
    assert(enrolled?.villageOrWard === 'Keeladi - East Colony', 'Location correctly saved');

    // 3. Test Idempotency: re-submitting exact same idempotencyKey must return duplicate_skipped
    const dupRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
      body: JSON.stringify(regPayload),
    });
    const dupData = await dupRes.json();
    assert(dupData.results[0].status === 'duplicate_skipped', 'Idempotency key prevents duplicate patient creation');

    // 4. Test unauthorized patient attempting VHN patient registration
    const unauthRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${patToken}` },
      body: JSON.stringify({
        actions: [
          {
            idempotencyKey: `unauth-vhn-${Date.now()}`,
            type: 'VHN_PATIENT_REGISTER',
            createdAt: new Date().toISOString(),
            payload: {
              name: 'Hacker Registration',
              age: 30,
              sex: 'Male',
              phone: '9999999999',
              district: 'Madurai',
              villageOrWard: 'City',
              language: 'en',
              diabetesStatus: 'at_risk',
              screeningConsent: true,
              dataStorageConsent: true,
              offlineCacheConsent: true,
              clinicalBoundaryAcknowledged: true,
            },
          },
        ],
      }),
    });
    const unauthData = await unauthRes.json();
    assert(unauthData.results[0].status === 'rejected', 'Unauthorized patient account cannot register rural patients via offline sync');

    // 5. Test Habit Log Offline Sync
    const habitKey = `habit-${Date.now()}-xyz987`;
    const habitRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
      body: JSON.stringify({
        actions: [
          {
            idempotencyKey: habitKey,
            type: 'HABIT_LOG',
            createdAt: new Date().toISOString(),
            payload: {
              patientId: createdPatientId,
              date: new Date().toISOString().slice(0, 10),
              healthyIndianDiet: true,
              stepsAchieved: 7500,
              sleepHours: 7.5,
              weightKg: 64.5,
              waistCm: 84.0,
            },
          },
        ],
      }),
    });
    const habitData = await habitRes.json();
    assert(habitData.results[0].status === 'synced', 'Offline habit log synchronized successfully');

    // 6. Test Checkpoint Offline Sync
    const cpKey = `cp-30-${Date.now()}`;
    const cpRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
      body: JSON.stringify({
        actions: [
          {
            idempotencyKey: cpKey,
            type: 'CHECKPOINT_COMPLETE',
            createdAt: new Date().toISOString(),
            payload: {
              patientId: createdPatientId,
              day: 30,
              weightKg: 63.8,
              waistCm: 83.5,
              notes: '30-day field check by VHN. Patient walking daily in village.',
            },
          },
        ],
      }),
    });
    const cpData = await cpRes.json();
    assert(cpData.results[0].status === 'synced', 'Offline 30-Day checkpoint completion synchronized');

    // 7. Test Appointment Offline Sync
    const aptKey = `apt-van-${Date.now()}`;
    const aptRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
      body: JSON.stringify({
        actions: [
          {
            idempotencyKey: aptKey,
            type: 'APPOINTMENT_REQUEST',
            createdAt: new Date().toISOString(),
            payload: {
              patientId: createdPatientId,
              title: 'Mobile Retinal Screening Van — Keeladi Camp',
              facility: 'Mobile Van Unit 01 (Keeladi Panchayat Hall)',
              clinicianName: 'Dr. Arvind Raman',
              scheduledDate: '2026-11-28',
              scheduledTime: '10:00 AM',
              type: 'Retinal Screening',
              reminderNote: 'VHN accompanied transport arranged.',
            },
          },
        ],
      }),
    });
    const aptData = await aptRes.json();
    assert(aptData.results[0].status === 'synced', 'Offline Mobile Screening Van appointment synchronized');

    // 8. Test CLINICAL CONFLICT RESOLUTION (Doctor Override Precedence)
    // Create a follow-up and have doctor mark it 'Completed'
    const testFuId = `fu-test-${Date.now()}`;
    store.data.followUps.push({
      id: testFuId,
      patientId: createdPatientId,
      healthWorkerName: 'Anitha K (VHN)',
      dueDate: '2026-12-01',
      channel: 'Home Visit',
      status: 'Completed', // Doctor closed it
      outcomeNotes: 'Clinician signed off after full dilated eye exam at District Hospital.',
    });

    // Now an offline VHN sync comes in trying to revert/update status to 'Scheduled'
    const conflictKey = `vhn-fu-conflict-${Date.now()}`;
    const conflictRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${docToken}` },
      body: JSON.stringify({
        actions: [
          {
            idempotencyKey: conflictKey,
            type: 'VHN_FOLLOWUP_UPDATE',
            createdAt: new Date().toISOString(),
            payload: {
              followUpId: testFuId,
              status: 'Scheduled', // Outdated client state attempting to overwrite server doctor status
              outcomeNotes: 'Outdated field visit note.',
              attempt: {
                date: '2026-11-20',
                type: 'Home Visit',
                notes: 'Visited house; reminded family.',
                outcome: 'reached',
              },
            },
          },
        ],
      }),
    });
    const conflictData = await conflictRes.json();
    assert(conflictData.results[0].status === 'conflict_resolved', 'Clinical conflict resolution triggered');
    assert(conflictData.results[0].message.includes('CLINICAL_OVERRIDE_PRESERVED'), 'Clinician Completed disposition preserved over offline status');

    const preservedFu = store.data.followUps.find((f) => f.id === testFuId);
    assert(preservedFu?.status === 'Completed', 'Doctor Completed status was NOT overwritten by outdated client state');
    assert(Boolean(preservedFu?.contactAttempts?.length), 'Field visit attempt was safely preserved in history log');

  } finally {
    server.close();
  }

  console.log('-------------------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runOfflineSyncTests().catch((err) => {
  console.error('Fatal offline test error:', err);
  process.exit(1);
});
