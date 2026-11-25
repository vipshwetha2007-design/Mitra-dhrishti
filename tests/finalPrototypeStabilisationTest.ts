import http from 'http';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

async function runEndToEndVerification() {
  console.log('===================================================================');
  console.log(' MITRA DRISHTI: FINAL END-TO-END PROTOTYPE STABILISATION TEST');
  console.log(' APEXFORGE 2K26 | PREVENT • DETECT • PROTECT COMPLETE PATIENT JOURNEY');
  console.log('===================================================================');

  const baseUrl = 'http://localhost:3000';

  // ---------------------------------------------------------------------------
  // STEP 1: PATIENT REGISTRATION & AUTHENTICATION
  // ---------------------------------------------------------------------------
  console.log('\n[*] 1. Patient Registration & Authentication...');
  const testEmail = `patient.test.${Date.now()}@mritidhristi.local`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ramu S (ApexForge Demo Patient)',
      email: testEmail,
      password: 'SecurePassword123!',
      role: 'patient',
      language: 'en',
    }),
  });
  assert(regRes.status === 201, `Patient registered successfully (HTTP ${regRes.status})`);
  const regBody = await regRes.json();
  const patientToken = regBody.token;
  const patientId = regBody.user.patientId || regBody.user.id;
  assert(Boolean(patientToken), 'Received valid JWT Bearer session token');
  assert(Boolean(patientId), `Assigned patient ID: ${patientId}`);

  // ---------------------------------------------------------------------------
  // STEP 2: PREVENT RISK ASSESSMENT
  // ---------------------------------------------------------------------------
  console.log('\n[*] 2. PILLAR 1 (PREVENT) — Lifestyle Diabetes Risk Assessment...');
  const assessRes = await fetch(`${baseUrl}/api/prevent/assessments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`,
    },
    body: JSON.stringify({
      patientId,
      age: 54,
      sex: 'Female',
      dietQuality: 'high_refined_sugars',
      sleepHours: 6.5,
      dailySteps: 3500,
      weightKg: 78.5,
      heightCm: 158,
      waistCm: 96,
      familyHistory: 'both_parents_or_sibling',
      smokingStatus: 'never',
      alcoholUse: 'none',
    }),
  });
  assert(assessRes.status === 201, `Assessment saved (HTTP ${assessRes.status})`);
  const assessBody = await assessRes.json();
  assert(assessBody.riskCategory === 'Elevated' || assessBody.riskCategory === 'Moderate', `Computed clinical risk tier: ${assessBody.riskCategory} (Score: ${assessBody.experimentalScore})`);
  assert(assessBody.recommendations.length > 0, `Generated tailored prevention recommendations (${assessBody.recommendations.length} action items)`);

  // ---------------------------------------------------------------------------
  // STEP 3 & 4: DETECT RETINAL SCAN UPLOAD & GENUINE MOBILENETV2 INFERENCE
  // ---------------------------------------------------------------------------
  console.log('\n[*] 3 & 4. PILLAR 2 (DETECT) — Genuine MobileNetV2 Retinal Inference...');
  const idridImgPath = path.join(
    process.cwd(),
    'B. Disease Grading',
    'B. Disease Grading',
    '1. Original Images',
    'b. Testing Set',
    'IDRiD_001.jpg'
  );
  assert(fs.existsSync(idridImgPath), `IDRiD clinical test scan exists: ${idridImgPath}`);

  const imgBuffer = fs.readFileSync(idridImgPath);
  const dataUrl = `data:image/jpeg;base64,${imgBuffer.toString('base64')}`;

  const t0 = Date.now();
  const predRes = await fetch(`${baseUrl}/api/detect/predict`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`,
    },
    body: JSON.stringify({ imageDataUrl: dataUrl }),
  });
  const inferenceElapsedMs = Date.now() - t0;
  assert(predRes.status === 200, `Predict endpoint returned HTTP 200 (in ${inferenceElapsedMs} ms)`);
  const predBody = await predRes.json();

  assert(predBody.success === true, 'Inference execution flagged success');
  assert(predBody.quality.gradable === true, 'Quality gate passed for genuine clinical scan');
  assert(predBody.modelPrediction.isImprovedModel === true, 'Active model confirmed: MobileNetV2 Improved');
  assert(predBody.modelPrediction.activeModelFile === 'dr_classifier_improved.keras', `Model file: ${predBody.modelPrediction.activeModelFile}`);
  assert(predBody.modelPrediction.calibrationThreshold === 0.38, 'Referable DR screening threshold: tau* = 0.38');
  assert([0, 1, 2, 3, 4].includes(predBody.modelPrediction.icdrGrade), `Predicted ICDR Grade: Grade ${predBody.modelPrediction.icdrGrade}`);
  assert(predBody.modelPrediction.calibratedProbabilities.length === 5, `5-Class Calibrated Probabilities: ${JSON.stringify(predBody.modelPrediction.calibratedProbabilities)}`);
  assert(predBody.modelPrediction.isReferable === true, `Referable DR Triage: isReferable=${predBody.modelPrediction.isReferable} (p=${predBody.modelPrediction.pReferable})`);
  assert(predBody.gradCam.available === true, 'Grad-CAM activation heatmap synthesized');
  assert(predBody.gradCam.hotspots.length > 0, `Candidate microvascular hotspots identified (${predBody.gradCam.hotspots.length} hotspots)`);

  // Record screening in patient record
  const screeningRes = await fetch(`${baseUrl}/api/detect/screenings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${patientToken}`,
    },
    body: JSON.stringify({
      patientId,
      eye: 'Right (OD)',
      cameraSource: 'Remidio FOP Non-Mydriatic Fundus Camera (Clinical)',
      imagePreset: 'uploaded_custom',
      imageDataUrl: dataUrl,
      quality: predBody.quality,
      anatomicalStructures: predBody.anatomicalStructures,
      lesionFindings: predBody.lesionFindings,
      modelPrediction: predBody.modelPrediction,
      gradCam: predBody.gradCam,
    }),
  });
  const screeningBody = await screeningRes.json();
  if (screeningRes.status !== 201) {
    console.log('Screening submission error details:', JSON.stringify(screeningBody, null, 2));
  }
  assert(screeningRes.status === 201, `Screening report submitted and queued for review (HTTP ${screeningRes.status})`);
  const screeningId = screeningBody.id;
  assert(Boolean(screeningId), `Screening report ID: ${screeningId}`);

  // ---------------------------------------------------------------------------
  // STEP 5: DOCTOR REVIEW IN PILLAR 3 (PROTECT)
  // ---------------------------------------------------------------------------
  console.log('\n[*] 5. PILLAR 3 (PROTECT) — Ophthalmologist Review & Sign-Off...');
  const docLoginRes = await fetch(`${baseUrl}/api/auth/demo-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'doctor' }),
  });
  const docBody = await docLoginRes.json();
  const docToken = docBody.token;

  const reviewRes = await fetch(`${baseUrl}/api/protect/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`,
    },
    body: JSON.stringify({
      screeningId,
      patientId,
      decision: 'confirmed',
      clinicianGrade: 'Grade 4 — Proliferative Diabetic Retinopathy',
      triageCategory: 'Urgent Ophthalmology (< 2 weeks)',
      clinicalNotes: 'Verified bilateral neovascularization with active microaneurysm cluster. Immediate pan-retinal photocoagulation (PRP) evaluation required.',
      recommendedNextSteps: 'Laser photocoagulation consultation at tertiary vitreoretinal center.',
    }),
  });
  assert(reviewRes.status === 201, `Doctor review recorded & signed off (HTTP ${reviewRes.status})`);

  // ---------------------------------------------------------------------------
  // STEP 6: APPOINTMENT BOOKING & DEDUPLICATION
  // ---------------------------------------------------------------------------
  console.log('\n[*] 6. Appointment Booking & Deduplication Persistence...');
  const aptPayload = {
    patientId,
    title: 'Urgent Vitreoretinal PRP Laser Consultation',
    facility: 'Aravind Eye Hospital - Vitreoretinal Clinic',
    clinicianName: 'Dr. S. Meenakshi, MS (Ophthalmology)',
    scheduledDate: '2026-12-08',
    scheduledTime: '09:00 AM',
    type: 'Ophthalmology Referral',
    reminderNote: 'Mandatory dilated fundus exam. Do not drive to clinic.',
  };

  const bookRes = await fetch(`${baseUrl}/api/protect/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`,
    },
    body: JSON.stringify(aptPayload),
  });
  assert(bookRes.status === 201, `Appointment scheduled with status Confirmed (HTTP ${bookRes.status})`);
  const aptBody = await bookRes.json();
  const appointmentId = aptBody.id;
  assert(Boolean(appointmentId), `Appointment ID: ${appointmentId}`);

  // Test deduplication on immediate repeated submission
  const dupBookRes = await fetch(`${baseUrl}/api/protect/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`,
    },
    body: JSON.stringify(aptPayload),
  });
  assert(dupBookRes.status === 200, `Repeated submission returns HTTP 200 without duplicate creation`);
  const dupBody = await dupBookRes.json();
  assert(dupBody.id === appointmentId, `Deduplication verified: Returned existing ID ${dupBody.id}`);

  // ---------------------------------------------------------------------------
  // STEP 7: PATIENT VIEW VISIBILITY & PERSISTENCE AFTER REFRESH
  // ---------------------------------------------------------------------------
  console.log('\n[*] 7. Patient View Visibility & Persistence...');
  const patBootRes = await fetch(`${baseUrl}/api/bootstrap`, {
    headers: { Authorization: `Bearer ${patientToken}` },
  });
  const patBoot = await patBootRes.json();
  const visibleApt = patBoot.appointments.find((a: any) => a.id === appointmentId);
  assert(Boolean(visibleApt), 'Appointment is visible in Patient Dashboard bootstrap');
  assert(visibleApt?.status === 'Confirmed', `Appointment status: ${visibleApt?.status}`);
  assert(visibleApt?.scheduledDate === '2026-12-08', `Scheduled date: ${visibleApt?.scheduledDate}`);

  // ---------------------------------------------------------------------------
  // STEP 8: OFFLINE DATA CAPTURE & ONLINE SYNCHRONISATION
  // ---------------------------------------------------------------------------
  console.log('\n[*] 8. Offline Data Capture & Sync Verification...');
  const offlineBatchPayload = {
    actions: [
      {
        idempotencyKey: `final-van-apt-${Date.now()}`,
        type: 'APPOINTMENT_REQUEST',
        createdAt: new Date().toISOString(),
        payload: {
          patientId,
          title: 'Mobile Retinal Screening Van Visit',
          facility: 'Rural Van Unit 02 - Keeladi Camp',
          clinicianName: 'Dr. Arvind Raman',
          scheduledDate: '2026-12-12',
          scheduledTime: '11:00 AM',
          type: 'Retinal Screening',
          reminderNote: 'Bring Aadhaar / MRN card.',
        },
      },
      {
        idempotencyKey: `final-habit-${Date.now()}`,
        type: 'HABIT_LOG',
        createdAt: new Date().toISOString(),
        payload: {
          patientId,
          date: '2026-11-26',
          healthyIndianDiet: true,
          stepsAchieved: 8200,
          sleepHours: 8.0,
          weightKg: 71.2,
          waistCm: 95.0,
        },
      },
    ],
  };

  const syncRes = await fetch(`${baseUrl}/api/sync/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`,
    },
    body: JSON.stringify(offlineBatchPayload),
  });
  assert(syncRes.status === 200, `Batch sync endpoint returned HTTP 200`);
  const syncBody = await syncRes.json();
  const syncedCount = syncBody.results.filter((r: any) => r.status === 'synced').length;
  assert(syncedCount === 2, `Synchronized 2 offline queued actions (syncedCount: ${syncedCount})`);
  assert(syncBody.results.every((r: any) => r.status === 'synced'), 'All offline actions successfully synced');

  // Re-sync to verify idempotency
  const resyncRes = await fetch(`${baseUrl}/api/sync/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${docToken}`,
    },
    body: JSON.stringify(offlineBatchPayload),
  });
  const resyncBody = await resyncRes.json();
  assert(resyncBody.results.every((r: any) => r.status === 'duplicate_skipped'), 'Repeated sync skipped duplicates safely');

  console.log('-------------------------------------------------------------------');
  console.log(`Final End-to-End Test Completed: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runEndToEndVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
