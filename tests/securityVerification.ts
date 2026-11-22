import http from 'http';
import { createMritidhristiApp } from '../server.ts';
import { store } from '../server/store.ts';

interface TestCaseResult {
  id: number;
  name: string;
  category: string;
  expectedStatus: number;
  actualStatus: number;
  passed: boolean;
  notes: string;
}

const results: TestCaseResult[] = [];

function recordResult(res: TestCaseResult) {
  results.push(res);
  const statusBadge = res.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${statusBadge}] Test #${res.id}: ${res.name} (Expected: ${res.expectedStatus}, Got: ${res.actualStatus})`);
  if (!res.passed) {
    console.error(`       Failure Details: ${res.notes}`);
  }
}

async function runSecurityTests() {
  console.log('\n================================================================');
  console.log('   MRITIDHRISTI — PHASE 1 SECURITY AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  // Launch test instance with headless API mode
  process.env.MRITIDHRISTI_TEST = 'true';
  const app = await createMritidhristiApp({ skipFrontend: true });
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  console.log(`Security Test Server bound to ${baseUrl}\n`);

  try {
    // 0. Initial baseline synthetic tokens
    const adminDemoRes = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    const adminData = await adminDemoRes.json();
    const adminToken = adminData.token as string;

    const doctorDemoRes = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'doctor' }),
    });
    const doctorData = await doctorDemoRes.json();
    const doctorToken = doctorData.token as string;

    const patientDemoRes = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient' }),
    });
    const patientData = await patientDemoRes.json();
    const patientDemoToken = patientData.token as string;

    // --- TEST 1: Reject public registration with role: 'admin' ---
    const t1 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Admin',
        email: 'attacker_admin@test.local',
        password: 'Password123!',
        role: 'admin',
        language: 'en',
      }),
    });
    const t1Body = await t1.json();
    const t1Audit = store.data.auditLogs.find(
      (a) => a.action === 'PRIVILEGE_ESCALATION_ATTEMPT' && a.resourceId === 'attacker_admin@test.local'
    );
    recordResult({
      id: 1,
      name: 'Public registration attempt with role: "admin" rejected',
      category: 'Privilege Escalation Prevention',
      expectedStatus: 403,
      actualStatus: t1.status,
      passed: t1.status === 403 && !!t1Audit,
      notes: t1Audit ? 'Audit logged PRIVILEGE_ESCALATION_ATTEMPT' : 'Missing audit log',
    });

    // --- TEST 2: Reject public registration with role: 'doctor' ---
    const t2 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attacker Doctor',
        email: 'attacker_doctor@test.local',
        password: 'Password123!',
        role: 'doctor',
        language: 'en',
      }),
    });
    const t2Audit = store.data.auditLogs.find(
      (a) => a.action === 'PRIVILEGE_ESCALATION_ATTEMPT' && a.resourceId === 'attacker_doctor@test.local'
    );
    recordResult({
      id: 2,
      name: 'Public registration attempt with role: "doctor" rejected',
      category: 'Privilege Escalation Prevention',
      expectedStatus: 403,
      actualStatus: t2.status,
      passed: t2.status === 403 && !!t2Audit,
      notes: t2Audit ? 'Audit logged PRIVILEGE_ESCALATION_ATTEMPT' : 'Missing audit log',
    });

    // --- TEST 3: Legitimate public registration with role: 'patient' ---
    const validPatientEmail = `legit_pat_${Date.now()}@test.local`;
    const t3 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Legit Patient A',
        email: validPatientEmail,
        password: 'PatientSecurePass123!',
        role: 'patient',
        language: 'en',
      }),
    });
    const t3Body = await t3.json();
    const patientAToken = t3Body.token as string;
    const patientAUser = t3Body.user;
    const patientAId = patientAUser?.patientId as string;
    recordResult({
      id: 3,
      name: 'Legitimate public registration as patient succeeds',
      category: 'Patient Registration',
      expectedStatus: 201,
      actualStatus: t3.status,
      passed: t3.status === 201 && !!patientAToken && !!patientAId && patientAUser.role === 'patient',
      notes: `Created Patient ID ${patientAId}`,
    });

    // Register Patient B for data isolation verification
    const patientBEmail = `legit_pat_b_${Date.now()}@test.local`;
    const regB = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Legit Patient B',
        email: patientBEmail,
        password: 'PatientBSecurePass123!',
        language: 'en',
      }),
    });
    const regBBody = await regB.json();
    const patientBToken = regBBody.token as string;
    const patientBId = regBBody.user?.patientId as string;

    // --- TEST 4: Patient A accessing Patient B's assessment ---
    const t4 = await fetch(`${baseUrl}/api/prevent/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientAToken}`,
      },
      body: JSON.stringify({
        patientId: patientBId, // Malicious ID injection
        age: 45,
        dietQuality: 'balanced_traditional',
        sleepHours: 7,
        dailySteps: 8000,
        weightKg: 65,
        heightCm: 165,
        waistCm: 80,
        familyHistory: 'none',
        smokingStatus: 'never',
        alcoholUse: 'none',
      }),
    });
    recordResult({
      id: 4,
      name: 'Patient A denied submitting assessment for Patient B (Cross-Tenant)',
      category: 'Patient Data Isolation',
      expectedStatus: 403,
      actualStatus: t4.status,
      passed: t4.status === 403,
      notes: 'canAccessPatient enforced',
    });

    // --- TEST 5: Patient A booking appointment for Patient B ---
    const t5 = await fetch(`${baseUrl}/api/protect/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientAToken}`,
      },
      body: JSON.stringify({
        patientId: patientBId,
        title: 'Unauthorized Consultation',
        facility: 'City Hospital',
        clinicianName: 'Dr. Ramesh',
        scheduledDate: '2026-12-01',
        scheduledTime: '10:00 AM',
        type: 'Follow-up Consultation',
      }),
    });
    recordResult({
      id: 5,
      name: 'Patient A denied booking appointment for Patient B',
      category: 'Patient Data Isolation',
      expectedStatus: 403,
      actualStatus: t5.status,
      passed: t5.status === 403,
      notes: 'canAccessPatient enforced',
    });

    // --- TEST 6: Patient attempting to post clinical lab results ---
    const t6 = await fetch(`${baseUrl}/api/clinical/labs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientAToken}`,
      },
      body: JSON.stringify({
        patientId: patientAId,
        testDate: '2026-11-20',
        hba1cPercent: 7.2,
      }),
    });
    recordResult({
      id: 6,
      name: 'Patient denied posting clinical laboratory results',
      category: 'Role-Based Authorization',
      expectedStatus: 403,
      actualStatus: t6.status,
      passed: t6.status === 403,
      notes: 'requireRole([doctor, admin]) enforced',
    });

    // --- TEST 7: Patient attempting to submit doctor review ---
    const t7 = await fetch(`${baseUrl}/api/protect/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientAToken}`,
      },
      body: JSON.stringify({
        screeningId: 'scr-1',
        patientId: patientAId,
        icdrGrade: 'no_dr',
        lesionsFound: [],
        carePlan: 'routine_annual',
        clinicalImpression: 'Normal retina',
      }),
    });
    recordResult({
      id: 7,
      name: 'Patient denied submitting doctor clinical review',
      category: 'Role-Based Authorization',
      expectedStatus: 403,
      actualStatus: t7.status,
      passed: t7.status === 403,
      notes: 'requireRole([doctor]) enforced',
    });

    // --- TEST 8: Patient attempting to read audit logs ---
    const t8 = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: {
        Authorization: `Bearer ${patientAToken}`,
      },
    });
    recordResult({
      id: 8,
      name: 'Patient denied accessing system audit logs',
      category: 'Role-Based Authorization',
      expectedStatus: 403,
      actualStatus: t8.status,
      passed: t8.status === 403,
      notes: 'requireRole([doctor, admin]) enforced',
    });

    // --- TEST 9: Patient attempting clinic desk registration (POST /api/patients) ---
    const t9 = await fetch(`${baseUrl}/api/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientAToken}`,
      },
      body: JSON.stringify({
        name: 'Desk Created Patient',
        age: 50,
        sex: 'Female',
        phone: '9876543210',
        district: 'Madurai',
        villageOrWard: 'Ward 4',
        language: 'ta',
        diabetesStatus: 'diagnosed_t2d',
        screeningConsent: true,
        dataStorageConsent: true,
        offlineCacheConsent: true,
        clinicalBoundaryAcknowledged: true,
      }),
    });
    recordResult({
      id: 9,
      name: 'Patient denied performing clinic-desk patient onboarding (POST /api/patients)',
      category: 'Role-Based Authorization',
      expectedStatus: 403,
      actualStatus: t9.status,
      passed: t9.status === 403,
      notes: 'POST /api/patients restricted to staff',
    });

    // --- TEST 10: Admin provisioning a new Doctor account ---
    const provisionedDoctorEmail = `dr_anita_${Date.now()}@hospital.local`;
    const t10 = await fetch(`${baseUrl}/api/admin/staff-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Dr. Anita Selvaraj',
        email: provisionedDoctorEmail,
        password: 'DoctorPassword123!',
        role: 'doctor',
        facility: 'Thanjavur Medical College',
        title: 'Senior Medical Officer',
        language: 'ta',
      }),
    });
    const t10Body = await t10.json();
    recordResult({
      id: 10,
      name: 'Administrator successfully provisions doctor account',
      category: 'Staff Provisioning Workflow',
      expectedStatus: 201,
      actualStatus: t10.status,
      passed: t10.status === 201 && t10Body.user?.role === 'doctor',
      notes: `Provisioned user ID ${t10Body.user?.id}`,
    });

    // --- TEST 11: Non-admin (Patient/Doctor) attempting to provision staff accounts ---
    const t11 = await fetch(`${baseUrl}/api/admin/staff-accounts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        name: 'Rogue Admin',
        email: 'rogue_admin@test.local',
        password: 'Password123!',
        role: 'admin',
      }),
    });
    recordResult({
      id: 11,
      name: 'Non-administrator (Doctor) denied provisioning staff accounts',
      category: 'Staff Provisioning Security',
      expectedStatus: 403,
      actualStatus: t11.status,
      passed: t11.status === 403,
      notes: 'requireRole([admin]) strictly enforced',
    });

    // --- TEST 12: Newly provisioned doctor authenticates with credentials ---
    const t12 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: provisionedDoctorEmail,
        password: 'DoctorPassword123!',
      }),
    });
    const t12Body = await t12.json();
    const newDocToken = t12Body.token as string;
    recordResult({
      id: 12,
      name: 'Newly provisioned doctor successfully authenticates via /api/auth/login',
      category: 'Authentication & Session Verification',
      expectedStatus: 200,
      actualStatus: t12.status,
      passed: t12.status === 200 && !!newDocToken && t12Body.user.role === 'doctor',
      notes: 'Scrypt verification successful',
    });

    // --- TEST 13: Offline sync deduplication with idempotent replay ---
    const idempotencyKey = `idemp-sync-${Date.now()}`;
    const syncAction = {
      idempotencyKey,
      type: 'HABIT_LOG',
      createdAt: new Date().toISOString(),
      payload: {
        patientId: patientAId,
        date: '2026-11-22',
        healthyIndianDiet: true,
        stepsAchieved: 8500,
        sleepHours: 7.5,
        recordedOffline: true,
      },
    };

    // First submission
    const sync1 = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientAToken}`,
      },
      body: JSON.stringify({ actions: [syncAction] }),
    });
    const sync1Body = await sync1.json();

    // Replay identical idempotency key
    const sync2 = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientAToken}`,
      },
      body: JSON.stringify({ actions: [syncAction] }),
    });
    const sync2Body = await sync2.json();
    const replayedStatus = sync2Body.results?.[0]?.status;

    recordResult({
      id: 13,
      name: 'Offline sync idempotency prevents duplicates (duplicate_skipped)',
      category: 'Offline Sync & Idempotency',
      expectedStatus: 200,
      actualStatus: sync2.status,
      passed: sync2.status === 200 && replayedStatus === 'duplicate_skipped',
      notes: `Replayed status: ${replayedStatus}`,
    });

    // --- TEST 14: Audit logs verification (Zero credential leakage) ---
    const allAuditDetails = store.data.auditLogs.map((l) => `${l.action} ${l.details}`).join('\n');
    const leaksPassword =
      allAuditDetails.includes('Password123!') ||
      allAuditDetails.includes('PatientSecurePass123!') ||
      allAuditDetails.includes('DoctorPassword123!');
    recordResult({
      id: 14,
      name: 'Audit logs verification: Zero plaintext credential leakage',
      category: 'Audit & Compliance',
      expectedStatus: 200,
      actualStatus: 200,
      passed: !leaksPassword,
      notes: leaksPassword ? 'WARNING: Password string detected in audit log!' : 'No password strings found in audit entries',
    });

    // --- TEST 15: Doctor denied admin-only operation (Simulink CSV import) ---
    const t15 = await fetch(`${baseUrl}/api/admin/simulink/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newDocToken}`,
      },
      body: JSON.stringify({
        csvText: 'Scenario,Throughput,WaitTime\nBaseline,100,45\n',
      }),
    });
    recordResult({
      id: 15,
      name: 'Doctor denied accessing admin-only Simulink import operation',
      category: 'Role-Based Authorization',
      expectedStatus: 403,
      actualStatus: t15.status,
      passed: t15.status === 403,
      notes: 'Doctor blocked from admin endpoints',
    });

    // --- TEST 16: Unauthenticated request to protected endpoints ---
    const t16 = await fetch(`${baseUrl}/api/bootstrap`);
    recordResult({
      id: 16,
      name: 'Unauthenticated request to protected endpoint rejected with 401',
      category: 'Authentication & Session Verification',
      expectedStatus: 401,
      actualStatus: t16.status,
      passed: t16.status === 401,
      notes: 'requireAuth rejected anonymous request',
    });

    // --- TEST 17: Malformed request payloads rejected with 400 ---
    const t17 = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A', // too short (< 2)
        email: 'invalid-email-format',
        password: 'short', // < 8
      }),
    });
    recordResult({
      id: 17,
      name: 'Malformed registration payload rejected with 400 Bad Request',
      category: 'Payload Validation',
      expectedStatus: 400,
      actualStatus: t17.status,
      passed: t17.status === 400,
      notes: 'Zod validation error returned',
    });

    // --- TEST 18: Notification cross-patient read denial ---
    // Seed a notification belonging specifically to Patient B
    const notifBId = `not-b-${Date.now()}`;
    store.data.notifications.unshift({
      id: notifBId,
      patientId: patientBId,
      roleTargets: ['patient'],
      severity: 'info',
      title: 'Confidential Notification for Patient B',
      message: 'Private lab guidance.',
      createdAt: new Date().toISOString(),
      read: false,
    });
    store.persist();

    // Patient A attempts to read Patient B's notification
    const t18 = await fetch(`${baseUrl}/api/notifications/${notifBId}/read`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${patientAToken}`,
      },
    });
    recordResult({
      id: 18,
      name: 'Patient A denied acknowledging Patient B notification (Cross-Patient Read)',
      category: 'Patient Data Isolation',
      expectedStatus: 403,
      actualStatus: t18.status,
      passed: t18.status === 403,
      notes: 'Notification ownership check enforced',
    });

    // --- TEST 19: Notification read by authorized recipient ---
    const t19 = await fetch(`${baseUrl}/api/notifications/${notifBId}/read`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${patientBToken}`,
      },
    });
    recordResult({
      id: 19,
      name: 'Patient B successfully acknowledges their own notification',
      category: 'Patient Data Isolation',
      expectedStatus: 200,
      actualStatus: t19.status,
      passed: t19.status === 200,
      notes: 'Legitimate notification read verified',
    });

    // --- TEST 20: Login rate limiting (10 failed attempts trigger 429) ---
    const bruteForceEmail = `brute_target_${Date.now()}@test.local`;
    let rateLimitTriggered = false;
    let finalStatus = 401;

    for (let i = 0; i < 11; i++) {
      const rlRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: bruteForceEmail,
          password: `WrongPassword${i}!`,
        }),
      });
      finalStatus = rlRes.status;
      if (rlRes.status === 429) {
        rateLimitTriggered = true;
        break;
      }
    }

    const rlAudit = store.data.auditLogs.find(
      (a) => a.action === 'LOGIN_RATE_LIMIT_EXCEEDED' && a.resourceId === bruteForceEmail
    );
    recordResult({
      id: 20,
      name: 'Login rate limiter: 10 failed attempts triggers HTTP 429 Too Many Requests',
      category: 'Brute Force & Rate Limiting',
      expectedStatus: 429,
      actualStatus: finalStatus,
      passed: rateLimitTriggered && !!rlAudit,
      notes: rlAudit ? 'Audit logged LOGIN_RATE_LIMIT_EXCEEDED' : 'Audit record missing',
    });

    // --- TEST 21: Security headers check ---
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const csp = healthRes.headers.get('content-security-policy');
    const xcto = healthRes.headers.get('x-content-type-options');
    const xfo = healthRes.headers.get('x-frame-options');

    recordResult({
      id: 21,
      name: 'Security headers present (CSP, X-Content-Type-Options, X-Frame-Options)',
      category: 'Security Headers',
      expectedStatus: 200,
      actualStatus: healthRes.status,
      passed: !!csp && xcto === 'nosniff' && xfo === 'SAMEORIGIN',
      notes: `CSP: ${!!csp}, XCTO: ${xcto}, XFO: ${xfo}`,
    });

  } finally {
    server.close();
  }

  // Summary Report
  console.log('\n================================================================');
  console.log('                   TEST EXECUTION SUMMARY');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total Automated Tests Executed: ${total}`);
  console.log(`Passed:                        ${passed} (${Math.round((passed / total) * 100)}%)`);
  console.log(`Failed:                        ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    console.error('CRITICAL: Some automated security verification tests failed!');
    process.exit(1);
  } else {
    console.log('ALL 21 AUTOMATED SECURITY TESTS PASSED SUCCESSFULLY.');
    process.exit(0);
  }
}

runSecurityTests().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
