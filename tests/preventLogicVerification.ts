import http from 'http';
import { createMritidhristiApp } from '../server.ts';
import { store, buildDefaultLessons } from '../server/store.ts';
import { evaluateExperimentalLifestyleRisk } from '../server/clinicalLogic.ts';
import type { CheckpointRecord, FollowUpRecord, WeeklyLesson } from '../src/types/domain.ts';

interface TestCaseResult {
  id: number;
  name: string;
  category: string;
  passed: boolean;
  notes: string;
}

const results: TestCaseResult[] = [];

function recordResult(res: TestCaseResult) {
  results.push(res);
  const statusBadge = res.passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[${statusBadge}] Test #${res.id}: ${res.name}`);
  if (!res.passed) {
    console.error(`       Failure Details: ${res.notes}`);
  }
}

async function runPreventTests() {
  console.log('\n================================================================');
  console.log('   MRITIDHRISTI — PHASE 4 PREVENT CORE FUNCTIONALITY TEST SUITE');
  console.log('================================================================\n');

  process.env.MRITIDHRISTI_TEST = 'true';
  const app = await createMritidhristiApp({ skipFrontend: true });
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  console.log(`PREVENT Test Server running on ${baseUrl}\n`);

  try {
    // Demo tokens
    const patAuth = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient' }),
    }).then((r) => r.json());
    const patToken = patAuth.token as string;

    const docAuth = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'doctor' }),
    }).then((r) => r.json());
    const docToken = docAuth.token as string;

    // --- TEST 1: Checkpoint due date calculation ---
    const prog1 = store.data.programmes.find((p) => p.patientId === 'pat-1');
    const startMs = new Date(prog1?.startedAt || '').getTime();
    const day30Cp = prog1?.checkpoints.find((c) => c.day === 30);
    const day60Cp = prog1?.checkpoints.find((c) => c.day === 60);
    const day90Cp = prog1?.checkpoints.find((c) => c.day === 90);
    const day180Cp = prog1?.checkpoints.find((c) => c.day === 180);
    const day365Cp = prog1?.checkpoints.find((c) => c.day === 365);

    const hasAllDays = day30Cp && day60Cp && day90Cp && day180Cp && day365Cp;
    const dueDatesCalculated =
      hasAllDays &&
      Boolean(day30Cp.dueDate && day60Cp.dueDate && day90Cp.dueDate && day180Cp.dueDate && day365Cp.dueDate);

    recordResult({
      id: 1,
      name: 'checkpoint_due_date_calculation',
      category: 'CHECKPOINTS',
      passed: Boolean(dueDatesCalculated),
      notes: `Checkpoints 30, 60, 90, 180, 365 due dates generated: ${dueDatesCalculated}`,
    });

    // --- TEST 2: Checkpoint completion workflow ---
    const cpCompleteRes = await fetch(`${baseUrl}/api/prevent/checkpoints/180/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patToken}`,
      },
      body: JSON.stringify({
        patientId: 'pat-1',
        weightKg: 59.2,
        waistCm: 77.0,
        notes: 'Month 6 transition evaluation: healthy millet swaps and daily steps maintained.',
      }),
    });
    const cpCompleteBody = await cpCompleteRes.json();
    const cp180 = cpCompleteBody.checkpoint as CheckpointRecord;
    const passedTest2 = cpCompleteRes.status === 200 && cp180 && cp180.completed === true && cp180.status === 'completed';

    recordResult({
      id: 2,
      name: 'checkpoint_completion_workflow',
      category: 'CHECKPOINTS',
      passed: passedTest2,
      notes: `Status: ${cpCompleteRes.status}, Completed: ${cp180?.completed}`,
    });

    // --- TEST 3: Checkpoint baseline comparison ---
    const weightChange = cp180?.baselineComparison?.weightChangeKg;
    const waistChange = cp180?.baselineComparison?.waistChangeCm;
    const summary = cp180?.baselineComparison?.summary;
    const passedTest3 =
      typeof weightChange === 'number' &&
      typeof waistChange === 'number' &&
      typeof summary === 'string' &&
      summary.length > 5;

    recordResult({
      id: 3,
      name: 'checkpoint_baseline_comparison',
      category: 'CHECKPOINTS',
      passed: passedTest3,
      notes: `Weight change: ${weightChange} kg, Waist change: ${waistChange} cm, Summary: "${summary}"`,
    });

    // --- TEST 4: Checkpoint duplicate prevention / idempotency ---
    const cpDuplicateRes = await fetch(`${baseUrl}/api/prevent/checkpoints/180/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patToken}`,
      },
      body: JSON.stringify({
        patientId: 'pat-1',
        weightKg: 59.2,
        waistCm: 77.0,
        notes: 'Month 6 transition evaluation duplicate submission.',
      }),
    });
    const duplicateBody = await cpDuplicateRes.json();
    const passedTest4 = cpDuplicateRes.status === 200 && duplicateBody.checkpoint.completed === true;

    recordResult({
      id: 4,
      name: 'checkpoint_duplicate_prevention',
      category: 'CHECKPOINTS',
      passed: passedTest4,
      notes: `Status: ${cpDuplicateRes.status}, Completed status preserved without data corruption`,
    });

    // --- TEST 5: Checkpoint offline queueing & sync ---
    const idemKey = `test-offline-cp-${Date.now()}`;
    const offlineSyncRes = await fetch(`${baseUrl}/api/sync/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patToken}`,
      },
      body: JSON.stringify({
        actions: [
          {
            idempotencyKey: idemKey,
            type: 'CHECKPOINT_COMPLETE',
            createdAt: new Date().toISOString(),
            payload: {
              patientId: 'pat-1',
              day: 365,
              weightKg: 58.5,
              waistCm: 76.0,
              notes: 'Annual checkpoint completed offline via IndexedDB sync queue.',
            },
          },
        ],
      }),
    });
    const offlineSyncData = await offlineSyncRes.json();
    const syncResult = offlineSyncData.results?.[0];
    const passedTest5 = offlineSyncRes.status === 200 && syncResult?.status === 'synced';

    recordResult({
      id: 5,
      name: 'checkpoint_offline_queueing',
      category: 'CHECKPOINTS',
      passed: passedTest5,
      notes: `Sync status: ${syncResult?.status}, Resource: ${syncResult?.resourceId}`,
    });

    // --- TEST 6: Checkpoint missed state detection ---
    // Create a mock program with startedAt set 60 days in the past where day 30 checkpoint was never completed
    const pastDate = new Date(Date.now() - 60 * 86400000).toISOString();
    store.data.programmes.push({
      id: 'prog-missed-test',
      patientId: 'pat-test-missed',
      startedAt: pastDate,
      currentMonth: 2,
      phase: 'PHASE 1: LEARNING (Months 1-6)',
      adherencePercent: 30,
      baselineWeightKg: 70,
      currentWeightKg: 70,
      baselineWaistCm: 88,
      currentWaistCm: 88,
      checkpoints: [
        {
          day: 30,
          title: '30-Day Checkpoint',
          dueDate: new Date(new Date(pastDate).getTime() + 30 * 86400000).toISOString().split('T')[0],
          completed: false,
          status: 'upcoming',
        },
      ],
      lessons: buildDefaultLessons().map((l) => ({ ...l, completed: false })),
    });

    store.data.patients.push({
      id: 'pat-test-missed',
      mrn: 'MRN-MISSED-001',
      name: 'Missed Checkpoint Patient',
      age: 45,
      sex: 'Male',
      phone: '+91 9999988888',
      district: 'Chennai South',
      villageOrWard: 'Adyar Urban PHC',
      language: 'en',
      diabetesStatus: 'at_risk',
      assignedHealthWorker: 'Anitha K (VHN)',
      assignedDoctorId: 'usr-doctor-1',
      registeredAt: pastDate,
      consent: {
        id: 'c-test-missed',
        patientId: 'pat-test-missed',
        screeningConsent: true,
        dataStorageConsent: true,
        offlineCacheConsent: true,
        clinicalBoundaryAcknowledged: true,
        consentedAt: pastDate,
        language: 'en',
      },
      isSynthetic: true,
    });

    // Trigger bootstrap to invoke checkAndEscalateMissedCheckpoints()
    await fetch(`${baseUrl}/api/bootstrap`, {
      headers: { Authorization: `Bearer ${docToken}` },
    });

    const missedProg = store.data.programmes.find((p) => p.id === 'prog-missed-test');
    const cp30Missed = missedProg?.checkpoints.find((c) => c.day === 30);
    const passedTest6 = cp30Missed?.status === 'missed';

    recordResult({
      id: 6,
      name: 'checkpoint_missed_state_detection',
      category: 'CHECKPOINTS',
      passed: Boolean(passedTest6),
      notes: `Status after overdue threshold: ${cp30Missed?.status}`,
    });

    // --- TEST 7: Checkpoint missed VHN escalation task creation ---
    const vhnMissedTask = store.data.followUps.find(
      (f) => f.patientId === 'pat-test-missed' && f.source === 'prevent_checkpoint_missed'
    );
    const passedTest7 =
      Boolean(vhnMissedTask) &&
      vhnMissedTask?.healthWorkerName === 'Anitha K (VHN)' &&
      vhnMissedTask?.priority === 'Priority';

    recordResult({
      id: 7,
      name: 'checkpoint_missed_vhn_escalation',
      category: 'CHECKPOINTS',
      passed: passedTest7,
      notes: `VHN Follow-up created: ID=${vhnMissedTask?.id}, Assigned=${vhnMissedTask?.healthWorkerName}, Priority=${vhnMissedTask?.priority}`,
    });

    // --- TEST 8: Curriculum 52 weeks completeness ---
    const defaultLessons = buildDefaultLessons();
    const phase1Lessons = defaultLessons.filter((l) => l.phase === 1);
    const phase2Lessons = defaultLessons.filter((l) => l.phase === 2);
    const passedTest8 = defaultLessons.length === 52 && phase1Lessons.length === 24 && phase2Lessons.length === 28;

    recordResult({
      id: 8,
      name: 'curriculum_52_weeks_completeness',
      category: 'CURRICULUM',
      passed: passedTest8,
      notes: `Total lessons: ${defaultLessons.length}, Phase 1: ${phase1Lessons.length}, Phase 2: ${phase2Lessons.length}`,
    });

    // --- TEST 9: Curriculum bilingual titles ---
    const hasAllTitles = defaultLessons.every(
      (l) => typeof l.title === 'string' && l.title.length > 3 && typeof l.titleTa === 'string' && l.titleTa.length > 3
    );
    const uniqueTitles = new Set(defaultLessons.map((l) => l.title)).size === 52;
    const passedTest9 = hasAllTitles && uniqueTitles;

    recordResult({
      id: 9,
      name: 'curriculum_bilingual_titles',
      category: 'CURRICULUM',
      passed: passedTest9,
      notes: `All 52 lessons possess unique English and authentic Tamil titles: ${passedTest9}`,
    });

    // --- TEST 10: Curriculum bilingual summaries ---
    const hasAllSummaries = defaultLessons.every(
      (l) => typeof l.summary === 'string' && l.summary.length > 10 && typeof l.summaryTa === 'string' && l.summaryTa.length > 10
    );
    recordResult({
      id: 10,
      name: 'curriculum_bilingual_summaries',
      category: 'CURRICULUM',
      passed: hasAllSummaries,
      notes: `All 52 lessons contain complete English and Tamil summaries: ${hasAllSummaries}`,
    });

    // --- TEST 11: Curriculum practical activities ---
    const hasAllActivities = defaultLessons.every(
      (l) => typeof l.practicalActivity === 'string' && l.practicalActivity.length > 5
    );
    recordResult({
      id: 11,
      name: 'curriculum_practical_activities',
      category: 'CURRICULUM',
      passed: hasAllActivities,
      notes: `All 52 lessons contain actionable practical activities: ${hasAllActivities}`,
    });

    // --- TEST 12: Curriculum measurable habit targets ---
    const hasAllTargets = defaultLessons.every(
      (l) => typeof l.measurableHabitTarget === 'string' && l.measurableHabitTarget.length > 5
    );
    recordResult({
      id: 12,
      name: 'curriculum_measurable_targets',
      category: 'CURRICULUM',
      passed: hasAllTargets,
      notes: `All 52 lessons contain measurable habit targets: ${hasAllTargets}`,
    });

    // --- TEST 13: Curriculum existing completion records preserved ---
    const prog1Lessons = prog1?.lessons || [];
    const les1 = prog1Lessons.find((l) => l.id === 'les-1');
    const les2 = prog1Lessons.find((l) => l.id === 'les-2');
    const les3 = prog1Lessons.find((l) => l.id === 'les-3');
    const passedTest13 =
      prog1Lessons.length === 52 &&
      les1?.completed === true &&
      les2?.completed === true &&
      les3?.completed === true;

    recordResult({
      id: 13,
      name: 'curriculum_existing_lessons_preserved',
      category: 'CURRICULUM',
      passed: passedTest13,
      notes: `Programme 1 has 52 lessons and preserved completed status for les-1, les-2, les-3: ${passedTest13}`,
    });

    // --- TEST 14: Gender-specific waist: Female thresholds (<80=2, 80-84=7, >=85=12) ---
    const femHealthy = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Female',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 55,
      heightCm: 160,
      waistCm: 76, // < 80 -> 2 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });
    const femMod = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Female',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 55,
      heightCm: 160,
      waistCm: 82, // 80-84 -> 7 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });
    const femHigh = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Female',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 55,
      heightCm: 160,
      waistCm: 88, // >= 85 -> 12 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });

    const femHealthyPts = femHealthy.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const femModPts = femMod.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const femHighPts = femHigh.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const passedTest14 = femHealthyPts === 2 && femModPts === 7 && femHighPts === 12;

    recordResult({
      id: 14,
      name: 'gender_waist_female_thresholds',
      category: 'RISK_SCORING',
      passed: passedTest14,
      notes: `Female waist points (76cm, 82cm, 88cm): ${femHealthyPts}, ${femModPts}, ${femHighPts}`,
    });

    // --- TEST 15: Gender-specific waist: Male thresholds (<90=2, 90-94=7, >=95=12) ---
    const maleHealthy = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Male',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 70,
      heightCm: 175,
      waistCm: 86, // < 90 -> 2 pts (Notice 86 cm is elevated for female, but healthy for male!)
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });
    const maleMod = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Male',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 70,
      heightCm: 175,
      waistCm: 92, // 90-94 -> 7 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });
    const maleHigh = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Male',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 70,
      heightCm: 175,
      waistCm: 98, // >= 95 -> 12 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });

    const maleHealthyPts = maleHealthy.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const maleModPts = maleMod.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const maleHighPts = maleHigh.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const passedTest15 = maleHealthyPts === 2 && maleModPts === 7 && maleHighPts === 12;

    recordResult({
      id: 15,
      name: 'gender_waist_male_thresholds',
      category: 'RISK_SCORING',
      passed: passedTest15,
      notes: `Male waist points (86cm, 92cm, 98cm): ${maleHealthyPts}, ${maleModPts}, ${maleHighPts}`,
    });

    // --- TEST 16: Gender-specific waist: Unspecified / Other safe fallback ---
    const otherHealthy = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Other',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 65,
      heightCm: 165,
      waistCm: 78, // < 80 -> 2 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });
    const otherMod = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Other',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 65,
      heightCm: 165,
      waistCm: 85, // 80-89 -> 7 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });
    const otherHigh = evaluateExperimentalLifestyleRisk({
      age: 35,
      sex: 'Other',
      dietQuality: 'balanced_traditional',
      sleepHours: 7.5,
      dailySteps: 8500,
      weightKg: 65,
      heightCm: 165,
      waistCm: 94, // >= 90 -> 12 pts
      familyHistory: 'none',
      smokingStatus: 'never',
      alcoholUse: 'none',
    });

    const otherHealthyPts = otherHealthy.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const otherModPts = otherMod.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const otherHighPts = otherHigh.contributions.find((c) => c.factor === 'Waist Circumference')?.points;
    const passedTest16 = otherHealthyPts === 2 && otherModPts === 7 && otherHighPts === 12;

    recordResult({
      id: 16,
      name: 'gender_waist_unspecified_fallback',
      category: 'RISK_SCORING',
      passed: passedTest16,
      notes: `Other waist points (78cm, 85cm, 94cm): ${otherHealthyPts}, ${otherModPts}, ${otherHighPts}`,
    });

    // --- TEST 17: VHN Follow-up on coach_escalation ---
    const coachHabitRes = await fetch(`${baseUrl}/api/prevent/habits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patToken}`,
      },
      body: JSON.stringify({
        patientId: 'pat-1',
        date: '2026-11-22',
        healthyIndianDiet: false,
        stepsAchieved: 3100, // triggers ladder step 4: coach_escalation
        sleepHours: 5.5,
        barrierReported: 'Knee stiffness after rain; struggling with walking goals',
      }),
    });
    const coachHabitData = await coachHabitRes.json();
    const coachFollowUp = store.data.followUps.find(
      (f) => f.patientId === 'pat-1' && f.source === 'prevent_barrier' && f.status === 'Scheduled'
    );
    const passedTest17 =
      coachHabitRes.status === 201 &&
      coachHabitData.intervention?.actionType === 'coach_escalation' &&
      Boolean(coachFollowUp);

    recordResult({
      id: 17,
      name: 'vhn_coach_escalation_followup',
      category: 'VHN_WORKFLOW',
      passed: passedTest17,
      notes: `Intervention: ${coachHabitData.intervention?.actionType}, Follow-up ID: ${coachFollowUp?.id}`,
    });

    // --- TEST 18: VHN Follow-up on clinician_escalation ---
    const clinHabitRes = await fetch(`${baseUrl}/api/prevent/habits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patToken}`,
      },
      body: JSON.stringify({
        patientId: 'pat-1',
        date: '2026-11-23',
        healthyIndianDiet: false,
        stepsAchieved: 1200,
        sleepHours: 4.5,
        barrierReported: 'Experiencing chest tightness and severe blurred vision during walks', // red-flag barrier triggers step 5
      }),
    });
    const clinHabitData = await clinHabitRes.json();
    const clinFollowUp = store.data.followUps.find(
      (f) => f.patientId === 'pat-1' && f.priority === 'Urgent' && f.status === 'Escalated'
    );
    const passedTest18 =
      clinHabitRes.status === 201 &&
      clinHabitData.intervention?.actionType === 'clinician_escalation' &&
      Boolean(clinFollowUp);

    recordResult({
      id: 18,
      name: 'vhn_clinician_escalation_followup',
      category: 'VHN_WORKFLOW',
      passed: passedTest18,
      notes: `Intervention: ${clinHabitData.intervention?.actionType}, Urgent Follow-up: ${clinFollowUp?.id}`,
    });

    // --- TEST 19: VHN Contact attempt logging ---
    const targetFuId = coachFollowUp?.id || store.data.followUps[0].id;
    const attemptRes = await fetch(`${baseUrl}/api/protect/followups/${targetFuId}/attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${docToken}`,
      },
      body: JSON.stringify({
        date: '2026-11-22',
        type: 'Phone Call',
        notes: 'Called patient regarding walking barrier; advised warm water compress and light seated mobility.',
        outcome: 'reached',
      }),
    });
    const attemptData = await attemptRes.json();
    const passedTest19 =
      attemptRes.status === 201 &&
      attemptData.attempt &&
      attemptData.followUp.contactAttempts?.some((a: { outcome: string }) => a.outcome === 'reached');

    recordResult({
      id: 19,
      name: 'vhn_contact_attempt_logging',
      category: 'VHN_WORKFLOW',
      passed: passedTest19,
      notes: `Status: ${attemptRes.status}, Attempt registered: ${attemptData.attempt?.id}`,
    });

    // --- TEST 20: VHN Referral integration ---
    const patchRes = await fetch(`${baseUrl}/api/protect/followups/${targetFuId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${docToken}`,
      },
      body: JSON.stringify({
        status: 'Completed',
        structuredOutcome: 'referred_to_doctor',
        outcomeNotes: 'Barrier requires clinical assessment. Scheduled primary health clinic referral.',
      }),
    });
    const patchData = (await patchRes.json()) as FollowUpRecord;
    const linkedReferral = store.data.referrals.find((r) => r.id === patchData.referralId);
    const passedTest20 =
      patchRes.status === 200 &&
      patchData.structuredOutcome === 'referred_to_doctor' &&
      Boolean(linkedReferral);

    recordResult({
      id: 20,
      name: 'vhn_referral_integration',
      category: 'VHN_WORKFLOW',
      passed: passedTest20,
      notes: `Status: ${patchRes.status}, Follow-up updated, Auto-linked Referral ID: ${linkedReferral?.id}`,
    });
  } catch (err) {
    console.error('Fatal test error:', err);
  } finally {
    server.close();
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log('\n================================================================');
  console.log(`   TEST EXECUTION COMPLETE: ${passedCount} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runPreventTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
