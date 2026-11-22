import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildDefaultSimulinkScenarios,
  evaluateExperimentalLifestyleRisk,
  interpretLaboratoryResult,
} from './clinicalLogic.ts';
import type {
  AppointmentRecord,
  AuditLogEntry,
  DistrictResourceMetric,
  DoctorReview,
  FollowUpRecord,
  HabitLog,
  InterventionRecord,
  LabResult,
  LifestyleAssessment,
  NotificationItem,
  PatientRecord,
  PreventionProgramme,
  ReferralRecord,
  RetinalScreening,
  SimulinkScenarioResult,
  UserAccount,
  UserRole,
  WeeklyLesson,
} from '../src/types/domain.ts';

export interface StoredUser extends UserAccount {
  passwordSalt?: string;
  passwordHash?: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  role: UserRole;
  createdAt: number;
  expiresAt: number;
}

export interface PersistentDatabase {
  users: StoredUser[];
  patients: PatientRecord[];
  assessments: LifestyleAssessment[];
  labs: LabResult[];
  programmes: PreventionProgramme[];
  habitLogs: HabitLog[];
  interventions: InterventionRecord[];
  screenings: RetinalScreening[];
  doctorReviews: DoctorReview[];
  referrals: ReferralRecord[];
  appointments: AppointmentRecord[];
  followUps: FollowUpRecord[];
  notifications: NotificationItem[];
  districtResources: DistrictResourceMetric[];
  simulations: SimulinkScenarioResult[];
  auditLogs: AuditLogEntry[];
  processedIdempotencyKeys: Record<string, { syncedAt: string; resourceId: string }>;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.resolve(DATA_DIR, 'mritidhristi_store.json');
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

function buildDefaultLessons(): WeeklyLesson[] {
  return [
    {
      id: 'les-1',
      week: 1,
      phase: 1,
      title: 'Balanced South Indian Plate (Thali Proportions)',
      titleTa: 'சமச்சீரான தென்னிந்திய உணவுத் தட்டு',
      category: 'Indian Nutrition',
      durationMinutes: 6,
      summary: 'Fill half your plate with poriyal/kootu greens, one quarter with sambar/dal or sprouts, and one quarter with hand-pounded rice or millets.',
      completed: true,
      completedAt: '2026-10-02T09:00:00Z',
    },
    {
      id: 'les-2',
      week: 2,
      phase: 1,
      title: '15-Minute Post-Meal Walking for Glucose Stability',
      titleTa: 'உணவுக்குப் பின் 15 நிமிட நடைப்பயிற்சி',
      category: 'Physical Activity',
      durationMinutes: 5,
      summary: 'Light brisk walking 15–20 minutes after lunch and dinner gently lowers post-meal blood glucose spikes.',
      completed: true,
      completedAt: '2026-10-10T10:15:00Z',
    },
    {
      id: 'les-3',
      week: 3,
      phase: 1,
      title: 'Millet Swaps: Ragi, Thinai & Kambu in Daily Meals',
      titleTa: 'தினசரி உணவில் சிறுதானிய மாற்றங்கள்',
      category: 'Indian Nutrition',
      durationMinutes: 7,
      summary: 'Practical ways to blend ragi dosa, thinai upma, and vegetable dalia without losing family meal enjoyment.',
      completed: true,
      completedAt: '2026-10-18T11:30:00Z',
    },
    {
      id: 'les-4',
      week: 4,
      phase: 1,
      title: 'Restorative Sleep & Stress Cortisol Balance',
      titleTa: 'நல்ல தூக்கம் மற்றும் மன அழுத்த சமநிலை',
      category: 'Sleep & Stress',
      durationMinutes: 6,
      summary: 'Consistent 7–8 hour sleep routines support insulin sensitivity and reduce late-night cravings.',
      completed: false,
    },
    {
      id: 'les-5',
      week: 12,
      phase: 1,
      title: '90-Day Checkpoint: Understanding HbA1c & Fasting Glucose',
      titleTa: '90-நாள் சோதனை: HbA1c மற்றும் சர்க்கரை அளவு வழிகாட்டி',
      category: 'Monitoring',
      durationMinutes: 8,
      summary: 'How laboratory blood tests complement lifestyle tracking — and why clinical interpretation belongs to your doctor.',
      completed: false,
    },
    {
      id: 'les-6',
      week: 28,
      phase: 2,
      title: 'Maintenance Phase: Festival Meals & Travel Continuity',
      titleTa: 'பராமரிப்பு கட்டம்: பண்டிகை உணவு மற்றும் பயண வழிகாட்டி',
      category: 'Indian Nutrition',
      durationMinutes: 6,
      summary: 'Long-term maintenance strategies for Months 7–12 to sustain waist and step habits during celebrations.',
      completed: false,
    },
  ];
}

function createSyntheticSeedData(): PersistentDatabase {
  const shwethaRisk = evaluateExperimentalLifestyleRisk({
    age: 34,
    dietQuality: 'balanced_traditional',
    sleepHours: 7.5,
    dailySteps: 8200,
    weightKg: 60,
    heightCm: 162,
    waistCm: 78,
    familyHistory: 'one_parent',
    smokingStatus: 'never',
    alcoholUse: 'none',
  });

  const karthikRisk = evaluateExperimentalLifestyleRisk({
    age: 52,
    dietQuality: 'high_refined_sugars',
    sleepHours: 5.5,
    dailySteps: 3100,
    weightKg: 84,
    heightCm: 170,
    waistCm: 99,
    familyHistory: 'both_parents_or_sibling',
    smokingStatus: 'former',
    alcoholUse: 'occasional',
  });

  const lakshmiRisk = evaluateExperimentalLifestyleRisk({
    age: 46,
    dietQuality: 'moderate_refined',
    sleepHours: 6.5,
    dailySteps: 5400,
    weightKg: 71,
    heightCm: 158,
    waistCm: 88,
    familyHistory: 'one_parent',
    smokingStatus: 'never',
    alcoholUse: 'none',
  });

  const users: StoredUser[] = [
    {
      id: 'usr-patient-1',
      email: 'shwetha@mritidhristi.demo',
      name: 'Shwetha V',
      role: 'patient',
      title: 'Patient (Synthetic Demo)',
      patientId: 'pat-1',
      language: 'en',
      isSynthetic: true,
    },
    {
      id: 'usr-doctor-1',
      email: 'dr.arvind@mritidhristi.demo',
      name: 'Dr. Arvind Raman',
      role: 'doctor',
      title: 'Medical Officer & Ophthalmology Liaison',
      facility: 'Chennai District Hospital & PHC Network',
      language: 'en',
      isSynthetic: true,
    },
    {
      id: 'usr-admin-1',
      email: 'admin.chennai@mritidhristi.demo',
      name: 'Meenakshi Sundaram',
      role: 'admin',
      title: 'District Health Programme Administrator',
      facility: 'Kanchipuram–Chennai Health District',
      language: 'en',
      isSynthetic: true,
    },
  ];

  const patients: PatientRecord[] = [
    {
      id: 'pat-1',
      mrn: 'MRD-TN-01042',
      name: 'Shwetha V',
      age: 34,
      sex: 'Female',
      phone: '+91 98400 00101',
      district: 'Chennai South',
      villageOrWard: 'Adyar Urban PHC Ward 173',
      language: 'en',
      diabetesStatus: 'diagnosed_t2d',
      assignedHealthWorker: 'Anitha K (VHN)',
      assignedDoctorId: 'usr-doctor-1',
      registeredAt: '2026-05-14T08:30:00Z',
      consent: {
        id: 'con-1',
        patientId: 'pat-1',
        screeningConsent: true,
        dataStorageConsent: true,
        offlineCacheConsent: true,
        clinicalBoundaryAcknowledged: true,
        consentedAt: '2026-05-14T08:30:00Z',
        language: 'en',
      },
      isSynthetic: true,
    },
    {
      id: 'pat-2',
      mrn: 'MRD-TN-01089',
      name: 'Karthik Subramanian',
      age: 52,
      sex: 'Male',
      phone: '+91 98400 00202',
      district: 'Kanchipuram',
      villageOrWard: 'Sriperumbudur Block PHC',
      language: 'ta',
      diabetesStatus: 'diagnosed_t2d',
      assignedHealthWorker: 'Selvi M (CHW)',
      assignedDoctorId: 'usr-doctor-1',
      registeredAt: '2026-06-03T10:15:00Z',
      consent: {
        id: 'con-2',
        patientId: 'pat-2',
        screeningConsent: true,
        dataStorageConsent: true,
        offlineCacheConsent: true,
        clinicalBoundaryAcknowledged: true,
        consentedAt: '2026-06-03T10:15:00Z',
        language: 'ta',
      },
      isSynthetic: true,
    },
    {
      id: 'pat-3',
      mrn: 'MRD-TN-01114',
      name: 'Lakshmi Narayanan',
      age: 46,
      sex: 'Female',
      phone: '+91 98400 00303',
      district: 'Chengalpattu',
      villageOrWard: 'Tambaram PHC',
      language: 'ta',
      diabetesStatus: 'prediabetes_lab',
      assignedHealthWorker: 'Anitha K (VHN)',
      assignedDoctorId: 'usr-doctor-1',
      registeredAt: '2026-08-21T09:10:00Z',
      consent: {
        id: 'con-3',
        patientId: 'pat-3',
        screeningConsent: true,
        dataStorageConsent: true,
        offlineCacheConsent: true,
        clinicalBoundaryAcknowledged: true,
        consentedAt: '2026-08-21T09:10:00Z',
        language: 'ta',
      },
      isSynthetic: true,
    },
  ];

  const assessments: LifestyleAssessment[] = [
    {
      id: 'asm-1',
      patientId: 'pat-1',
      assessedAt: '2026-11-12T08:15:00Z',
      inputs: {
        age: 34,
        dietQuality: 'balanced_traditional',
        sleepHours: 7.5,
        dailySteps: 8200,
        weightKg: 60,
        heightCm: 162,
        waistCm: 78,
        familyHistory: 'one_parent',
        smokingStatus: 'never',
        alcoholUse: 'none',
      },
      experimentalScore: shwethaRisk.experimentalScore,
      riskCategory: shwethaRisk.riskCategory,
      scoringModelLabel: shwethaRisk.scoringModelLabel,
      contributions: shwethaRisk.contributions,
      topModifiableFactors: shwethaRisk.topModifiableFactors,
      explanation: shwethaRisk.explanation,
      recommendations: shwethaRisk.recommendations,
      recordedOffline: false,
      syncStatus: 'synced',
    },
    {
      id: 'asm-2',
      patientId: 'pat-2',
      assessedAt: '2026-11-15T11:00:00Z',
      inputs: {
        age: 52,
        dietQuality: 'high_refined_sugars',
        sleepHours: 5.5,
        dailySteps: 3100,
        weightKg: 84,
        heightCm: 170,
        waistCm: 99,
        familyHistory: 'both_parents_or_sibling',
        smokingStatus: 'former',
        alcoholUse: 'occasional',
      },
      experimentalScore: karthikRisk.experimentalScore,
      riskCategory: karthikRisk.riskCategory,
      scoringModelLabel: karthikRisk.scoringModelLabel,
      contributions: karthikRisk.contributions,
      topModifiableFactors: karthikRisk.topModifiableFactors,
      explanation: karthikRisk.explanation,
      recommendations: karthikRisk.recommendations,
      recordedOffline: true,
      syncStatus: 'synced',
    },
    {
      id: 'asm-3',
      patientId: 'pat-3',
      assessedAt: '2026-11-18T14:20:00Z',
      inputs: {
        age: 46,
        dietQuality: 'moderate_refined',
        sleepHours: 6.5,
        dailySteps: 5400,
        weightKg: 71,
        heightCm: 158,
        waistCm: 88,
        familyHistory: 'one_parent',
        smokingStatus: 'never',
        alcoholUse: 'none',
      },
      experimentalScore: lakshmiRisk.experimentalScore,
      riskCategory: lakshmiRisk.riskCategory,
      scoringModelLabel: lakshmiRisk.scoringModelLabel,
      contributions: lakshmiRisk.contributions,
      topModifiableFactors: lakshmiRisk.topModifiableFactors,
      explanation: lakshmiRisk.explanation,
      recommendations: lakshmiRisk.recommendations,
      recordedOffline: false,
      syncStatus: 'synced',
    },
  ];

  const labs: LabResult[] = [
    {
      id: 'lab-1',
      patientId: 'pat-1',
      recordedByDoctorId: 'usr-doctor-1',
      recordedByName: 'Dr. Arvind Raman',
      testedAt: '2026-10-28T07:45:00Z',
      hba1cPercent: 6.6,
      fastingGlucoseMgDl: 118,
      guidelineInterpretation: interpretLaboratoryResult(6.6, 118),
      clinicalNotes: 'Well-managed early Type 2 diabetes on lifestyle therapy; eligible for annual retinal screening.',
    },
    {
      id: 'lab-2',
      patientId: 'pat-2',
      recordedByDoctorId: 'usr-doctor-1',
      recordedByName: 'Dr. Arvind Raman',
      testedAt: '2026-11-05T08:10:00Z',
      hba1cPercent: 8.4,
      fastingGlucoseMgDl: 168,
      guidelineInterpretation: interpretLaboratoryResult(8.4, 168),
      clinicalNotes: 'Suboptimal glycaemic control; prioritized for retinal imaging and diabetology medication review.',
    },
    {
      id: 'lab-3',
      patientId: 'pat-3',
      recordedByDoctorId: 'usr-doctor-1',
      recordedByName: 'Dr. Arvind Raman',
      testedAt: '2026-11-10T08:00:00Z',
      hba1cPercent: 6.1,
      fastingGlucoseMgDl: 112,
      guidelineInterpretation: interpretLaboratoryResult(6.1, 112),
      clinicalNotes: 'Prediabetes range confirmed on lab panel; enrolled in 12-month lifestyle prevention programme.',
    },
  ];

  const programmes: PreventionProgramme[] = [
    {
      id: 'prog-1',
      patientId: 'pat-1',
      startedAt: '2026-05-20T09:00:00Z',
      currentMonth: 6,
      phase: 'PHASE 1: LEARNING (Months 1-6)',
      adherencePercent: 72,
      baselineWeightKg: 63.5,
      currentWeightKg: 60.0,
      baselineWaistCm: 83,
      currentWaistCm: 78,
      checkpoints: [
        { day: 30, label: '30-Day Checkpoint', status: 'completed', notes: 'Established post-dinner walking and millet breakfast swaps.' },
        { day: 60, label: '60-Day Checkpoint', status: 'completed', notes: 'Weight -1.4 kg; consistent 7.5h sleep achieved.' },
        { day: 90, label: '90-Day Checkpoint', status: 'completed', notes: 'Waist reduced by 3 cm; lab review scheduled.' },
        { day: 180, label: 'Month 6 Transition', status: 'due', notes: 'Ready to transition from Phase 1 (Learning) to Phase 2 (Maintenance).' },
        { day: 365, label: '12-Month Outcome', status: 'upcoming', notes: 'Annual longitudinal review & HbA1c re-evaluation.' },
      ],
      lessons: buildDefaultLessons(),
    },
    {
      id: 'prog-2',
      patientId: 'pat-2',
      startedAt: '2026-09-01T09:00:00Z',
      currentMonth: 3,
      phase: 'PHASE 1: LEARNING (Months 1-6)',
      adherencePercent: 48,
      baselineWeightKg: 86,
      currentWeightKg: 84,
      baselineWaistCm: 101,
      currentWaistCm: 99,
      checkpoints: [
        { day: 30, label: '30-Day Checkpoint', status: 'completed', notes: 'Reduced sweetened tea frequency.' },
        { day: 60, label: '60-Day Checkpoint', status: 'completed', notes: 'Shift work barrier noted for evening walks.' },
        { day: 90, label: '90-Day Checkpoint', status: 'due', notes: 'Health worker coaching follow-up scheduled.' },
        { day: 180, label: 'Month 6 Transition', status: 'upcoming', notes: 'Pending Phase 1 completion.' },
        { day: 365, label: '12-Month Outcome', status: 'upcoming', notes: 'Annual review.' },
      ],
      lessons: buildDefaultLessons().map((l, idx) => ({ ...l, completed: idx === 0 })),
    },
    {
      id: 'prog-3',
      patientId: 'pat-3',
      startedAt: '2026-09-15T09:00:00Z',
      currentMonth: 2,
      phase: 'PHASE 1: LEARNING (Months 1-6)',
      adherencePercent: 64,
      baselineWeightKg: 72.5,
      currentWeightKg: 71,
      baselineWaistCm: 90,
      currentWaistCm: 88,
      checkpoints: [
        { day: 30, label: '30-Day Checkpoint', status: 'completed', notes: 'Consistent morning walk group attendance.' },
        { day: 60, label: '60-Day Checkpoint', status: 'due', notes: 'Review portion sizes and waist tracking.' },
        { day: 90, label: '90-Day Checkpoint', status: 'upcoming', notes: 'Repeat FPG/HbA1c discussion.' },
        { day: 180, label: 'Month 6 Transition', status: 'upcoming', notes: 'Phase 2 entry.' },
        { day: 365, label: '12-Month Outcome', status: 'upcoming', notes: 'Annual review.' },
      ],
      lessons: buildDefaultLessons().map((l, idx) => ({ ...l, completed: idx < 2 })),
    },
  ];

  const habitLogs: HabitLog[] = [
    { id: 'hab-1', patientId: 'pat-1', date: '2026-11-17', healthyIndianDiet: true, stepsAchieved: 7800, sleepHours: 7.5, weightKg: 60.4, waistCm: 78.5, recordedOffline: false, syncStatus: 'synced' },
    { id: 'hab-2', patientId: 'pat-1', date: '2026-11-18', healthyIndianDiet: true, stepsAchieved: 8450, sleepHours: 7.8, weightKg: 60.2, waistCm: 78.2, recordedOffline: false, syncStatus: 'synced' },
    { id: 'hab-3', patientId: 'pat-1', date: '2026-11-19', healthyIndianDiet: true, stepsAchieved: 8120, sleepHours: 7.2, weightKg: 60.1, waistCm: 78.0, recordedOffline: true, syncStatus: 'synced' },
    { id: 'hab-4', patientId: 'pat-1', date: '2026-11-20', healthyIndianDiet: false, stepsAchieved: 6200, sleepHours: 6.8, weightKg: 60.0, waistCm: 78.0, barrierReported: 'Heavy rain prevented outdoor evening walk', recordedOffline: false, syncStatus: 'synced' },
    { id: 'hab-5', patientId: 'pat-1', date: '2026-11-21', healthyIndianDiet: true, stepsAchieved: 8600, sleepHours: 7.6, weightKg: 60.0, waistCm: 78.0, recordedOffline: false, syncStatus: 'synced' },
    { id: 'hab-6', patientId: 'pat-2', date: '2026-11-19', healthyIndianDiet: false, stepsAchieved: 2900, sleepHours: 5.5, weightKg: 84.2, waistCm: 99, barrierReported: 'Late night shift fatigue', recordedOffline: true, syncStatus: 'synced' },
  ];

  const interventions: InterventionRecord[] = [
    {
      id: 'int-1',
      patientId: 'pat-2',
      triggeredAt: '2026-11-19T19:00:00Z',
      triggerRule: 'Deterministic Rule L2: Daily steps below 4,000 threshold',
      ladderStep: 2,
      actionType: 'simpler_activity',
      recommendedMessage: 'Offer simpler indoor 10-minute post-meal walking alternative due to late-shift fatigue.',
      experimentalBanditArm: 'Experimental Educational Selector (Pre-Approved Only) → Arm C (Micro-Habit Start): Begin with just 5 minutes of gentle indoor walking after lunch for 3 days.',
      status: 'active',
    },
  ];

  const screenings: RetinalScreening[] = [
    {
      id: 'scr-1',
      patientId: 'pat-1',
      capturedAt: '2026-11-16T09:40:00Z',
      eye: 'Right (OD)',
      cameraSource: 'Remidio FOP Non-Mydriatic Fundus Camera (Synthetic Demo Capture)',
      imagePreset: 'normal_demo',
      quality: {
        sharpnessScore: 88,
        brightnessMean: 124,
        exposureClipPercent: 1.4,
        width: 512,
        height: 512,
        gradable: true,
      },
      anatomicalStructures: {
        opticDiscDetected: true,
        vesselDensityIndex: 0.78,
        maculaCentered: true,
      },
      lesionFindings: {
        hardExudatesFlag: false,
        haemorrhagesFlag: false,
        microaneurysmsExperimentalNote: 'Microaneurysm detection is marked as an experimental/advanced research capability requiring high-resolution IDRiD-calibrated models.',
        implementationStatus: 'Illustrative / Prototype Heuristic',
      },
      modelPrediction: {
        modelVersion: 'mritidhristi-prototype-icdr-v0.1 (Illustrative)',
        architectureReference: 'EfficientNet-B3 / ResNet-50 Pipeline Interface (No Clinical Weights Loaded)',
        icdrGrade: 0,
        gradeLabel: 'ICDR Grade 0 — No Apparent DR (Illustrative Screening Assist)',
        confidence: 0.91,
        uncertainty: 0.09,
        oodFlag: false,
        gradeWithheld: false,
        isIllustrativeOutput: true,
      },
      gradCam: {
        available: true,
        hotspots: [
          { x: 0.66, y: 0.48, radius: 0.16, intensity: 0.45 },
          { x: 0.45, y: 0.50, radius: 0.18, intensity: 0.35 },
        ],
        limitationNotice: 'Grad-CAM highlights coarse spatial regions influencing model activation; it does not localize exact micro-lesion boundaries or confirm clinical diagnosis.',
      },
      humanReviewStatus: 'confirmed',
      summaryText: 'Gradable fundus capture. Illustrative screening output indicates ICDR Grade 0; reviewed and confirmed by Dr. Arvind Raman for routine 12-month follow-up.',
    },
    {
      id: 'scr-2',
      patientId: 'pat-2',
      capturedAt: '2026-11-21T10:15:00Z',
      eye: 'Left (OS)',
      cameraSource: 'Forus 3nethra Classic Fundus Camera (Synthetic Demo Capture)',
      imagePreset: 'moderate_npdr_demo',
      quality: {
        sharpnessScore: 81,
        brightnessMean: 118,
        exposureClipPercent: 2.1,
        width: 512,
        height: 512,
        gradable: true,
      },
      anatomicalStructures: {
        opticDiscDetected: true,
        vesselDensityIndex: 0.74,
        maculaCentered: true,
      },
      lesionFindings: {
        hardExudatesFlag: true,
        haemorrhagesFlag: true,
        microaneurysmsExperimentalNote: 'Microaneurysm candidates require ophthalmologist slit-lamp / OCT confirmation (experimental module).',
        implementationStatus: 'Illustrative / Prototype Heuristic',
      },
      modelPrediction: {
        modelVersion: 'mritidhristi-prototype-icdr-v0.1 (Illustrative)',
        architectureReference: 'EfficientNet-B3 / ResNet-50 Pipeline Interface (No Clinical Weights Loaded)',
        icdrGrade: 2,
        gradeLabel: 'ICDR Grade 2 — Moderate NPDR Suspected (Illustrative Screening Assist)',
        confidence: 0.82,
        uncertainty: 0.18,
        oodFlag: false,
        gradeWithheld: false,
        isIllustrativeOutput: true,
      },
      gradCam: {
        available: true,
        hotspots: [
          { x: 0.38, y: 0.42, radius: 0.15, intensity: 0.88 },
          { x: 0.54, y: 0.62, radius: 0.14, intensity: 0.79 },
          { x: 0.46, y: 0.49, radius: 0.12, intensity: 0.65 },
        ],
        limitationNotice: 'Grad-CAM highlights coarse spatial regions influencing model activation; it does not localize exact micro-lesion boundaries or confirm clinical diagnosis.',
      },
      humanReviewStatus: 'pending_review',
      summaryText: 'Gradable fundus capture showing illustrative lesion candidates near posterior pole. Awaiting mandatory doctor clinical review and triage decision.',
    },
  ];

  const doctorReviews: DoctorReview[] = [
    {
      id: 'rev-1',
      screeningId: 'scr-1',
      patientId: 'pat-1',
      doctorId: 'usr-doctor-1',
      doctorName: 'Dr. Arvind Raman',
      reviewedAt: '2026-11-16T14:20:00Z',
      decision: 'confirmed',
      clinicianGrade: 'No Apparent Diabetic Retinopathy (Clinician Confirmed)',
      triageCategory: 'Routine (12 months)',
      clinicalNotes: 'Clear optic disc margins and healthy macular reflex. No exudates or haemorrhages identified on review.',
      recommendedNextSteps: 'Continue 12-month prevention programme and repeat retinal screening in 12 months (or 6 months if HbA1c rises).',
    },
  ];

  const referrals: ReferralRecord[] = [
    {
      id: 'ref-1',
      patientId: 'pat-2',
      screeningId: 'scr-2',
      createdByDoctorId: 'usr-doctor-1',
      createdByDoctorName: 'Dr. Arvind Raman',
      createdAt: '2026-11-21T12:00:00Z',
      targetFacility: 'Regional Institute of Ophthalmology, Egmore',
      specialty: 'Ophthalmology',
      urgency: 'Priority',
      reason: 'Pending clinician confirmation of suspected Moderate NPDR with HbA1c 8.4% — dilated fundus exam and OCT evaluation.',
      status: 'Pending',
    },
  ];

  const appointments: AppointmentRecord[] = [
    {
      id: 'apt-1',
      patientId: 'pat-1',
      title: 'Follow-up Consultation & Month-6 Checkpoint',
      facility: 'Adyar Urban PHC / City Hospital',
      clinicianName: 'Dr. Arvind Raman',
      scheduledDate: '2026-11-28',
      scheduledTime: '10:30 AM',
      type: 'Follow-up Consultation',
      status: 'Confirmed',
      reminderNote: 'Bring latest home step log and waist measurement record.',
    },
    {
      id: 'apt-2',
      patientId: 'pat-2',
      title: 'Ophthalmology Dilated Exam & Diabetology Review',
      facility: 'Regional Institute of Ophthalmology',
      clinicianName: 'Dr. Priya Natarajan (Ophthalmologist)',
      scheduledDate: '2026-11-25',
      scheduledTime: '09:15 AM',
      type: 'Ophthalmology Referral',
      status: 'Pending Confirmation',
      reminderNote: 'Requires online hospital slot confirmation; bring PHC referral slip.',
    },
    {
      id: 'apt-3',
      patientId: 'pat-3',
      title: '90-Day HbA1c & Fasting Glucose Lab Test',
      facility: 'Tambaram Primary Health Centre',
      clinicianName: 'Dr. Arvind Raman',
      scheduledDate: '2026-11-19',
      scheduledTime: '08:00 AM',
      type: 'Lab Testing (HbA1c/FPG)',
      status: 'Missed',
      reminderNote: '8-hour overnight fasting required prior to blood draw.',
      escalated: true,
    },
  ];

  const followUps: FollowUpRecord[] = [
    {
      id: 'fu-1',
      patientId: 'pat-1',
      healthWorkerName: 'Anitha K (VHN)',
      dueDate: '2026-12-05',
      channel: 'In-Person PHC',
      status: 'Scheduled',
      outcomeNotes: 'Transition counselling from Phase 1 Learning to Phase 2 Maintenance.',
      nextScreeningDate: '2027-05-16',
    },
    {
      id: 'fu-2',
      patientId: 'pat-3',
      healthWorkerName: 'Anitha K (VHN)',
      dueDate: '2026-11-23',
      channel: 'Phone Call',
      status: 'Escalated',
      outcomeNotes: 'Escalated due to missed 2026-11-19 lab appointment. Reschedule fasting glucose draw.',
    },
  ];

  const notifications: NotificationItem[] = [
    {
      id: 'not-1',
      roleTargets: ['doctor', 'admin'],
      patientId: 'pat-2',
      severity: 'urgent',
      title: 'Doctor Review Required',
      message: 'Retinal screening for Karthik Subramanian (MRD-TN-01089) awaits clinical confirmation & triage.',
      createdAt: '2026-11-21T10:20:00Z',
      read: false,
      actionView: 'protect',
    },
    {
      id: 'not-2',
      roleTargets: ['patient', 'doctor'],
      patientId: 'pat-1',
      severity: 'info',
      title: 'Upcoming Follow-up Consultation',
      message: 'Follow-up consultation confirmed for 28 Nov at 10:30 AM · Adyar Urban PHC / City Hospital.',
      createdAt: '2026-11-21T16:00:00Z',
      read: false,
      actionView: 'appointments',
    },
    {
      id: 'not-3',
      roleTargets: ['patient', 'doctor', 'admin'],
      patientId: 'pat-1',
      severity: 'success',
      title: 'Offline Sync Ready',
      message: 'IndexedDB offline queue is initialized and synchronized with backend records.',
      createdAt: '2026-11-22T01:00:00Z',
      read: false,
      actionView: 'offline',
    },
    {
      id: 'not-4',
      roleTargets: ['doctor', 'admin'],
      patientId: 'pat-3',
      severity: 'warning',
      title: 'Missed Lab Appointment Escalated',
      message: 'Lakshmi Narayanan missed 19 Nov HbA1c test; VHN phone follow-up assigned.',
      createdAt: '2026-11-20T12:30:00Z',
      read: false,
      actionView: 'protect',
    },
  ];

  const districtResources: DistrictResourceMetric[] = [
    {
      id: 'res-1',
      facilityName: 'Adyar Urban PHC',
      type: 'PHC',
      fundusCameras: 2,
      ophthalmologists: 0,
      healthWorkers: 6,
      dailyCapacity: 45,
      currentUtilizationPct: 76,
      connectivityProfile: 'Stable Broadband',
    },
    {
      id: 'res-2',
      facilityName: 'Sriperumbudur Block PHC',
      type: 'PHC',
      fundusCameras: 1,
      ophthalmologists: 0,
      healthWorkers: 5,
      dailyCapacity: 30,
      currentUtilizationPct: 88,
      connectivityProfile: 'Offline-First Rural',
    },
    {
      id: 'res-3',
      facilityName: 'Tambaram Taluk Hospital',
      type: 'District Hospital',
      fundusCameras: 2,
      ophthalmologists: 2,
      healthWorkers: 9,
      dailyCapacity: 55,
      currentUtilizationPct: 71,
      connectivityProfile: 'Stable Broadband',
    },
    {
      id: 'res-4',
      facilityName: 'Chengalpattu Mobile Eye Van #1',
      type: 'Mobile Screening Unit',
      fundusCameras: 1,
      ophthalmologists: 1,
      healthWorkers: 4,
      dailyCapacity: 25,
      currentUtilizationPct: 82,
      connectivityProfile: 'Intermittent 4G',
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'aud-1',
      timestamp: '2026-11-16T14:20:00Z',
      userId: 'usr-doctor-1',
      userName: 'Dr. Arvind Raman',
      role: 'doctor',
      action: 'DOCTOR_REVIEW_SUBMITTED',
      resourceType: 'RetinalScreening',
      resourceId: 'scr-1',
      outcome: 'SUCCESS',
      details: 'Confirmed ICDR Grade 0 screening assist and set Routine 12-month triage.',
    },
    {
      id: 'aud-2',
      timestamp: '2026-11-21T10:15:00Z',
      userId: 'usr-doctor-1',
      userName: 'Dr. Arvind Raman',
      role: 'doctor',
      action: 'RETINAL_SCREENING_CREATED',
      resourceType: 'RetinalScreening',
      resourceId: 'scr-2',
      outcome: 'SUCCESS',
      details: 'Uploaded gradable fundus capture for pat-2 (synthetic demo); pending clinical review.',
    },
    {
      id: 'aud-3',
      timestamp: '2026-11-21T12:00:00Z',
      userId: 'usr-doctor-1',
      userName: 'Dr. Arvind Raman',
      role: 'doctor',
      action: 'REFERRAL_CREATED',
      resourceType: 'Referral',
      resourceId: 'ref-1',
      outcome: 'SUCCESS',
      details: 'Generated Priority Ophthalmology referral to RIO Egmore.',
    },
  ];

  return {
    users,
    patients,
    assessments,
    labs,
    programmes,
    habitLogs,
    interventions,
    screenings,
    doctorReviews,
    referrals,
    appointments,
    followUps,
    notifications,
    districtResources,
    simulations: buildDefaultSimulinkScenarios(),
    auditLogs,
    processedIdempotencyKeys: {},
  };
}

class MritidhristiStore {
  private db: PersistentDatabase;
  private sessions = new Map<string, SessionRecord>();

  constructor() {
    this.db = this.load();
  }

  private load(): PersistentDatabase {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw) as PersistentDatabase;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.patients)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read local store, re-seeding synthetic dataset:', err);
    }
    const seeded = createSyntheticSeedData();
    this.persist(seeded);
    return seeded;
  }

  public persist(snapshot?: PersistentDatabase) {
    const data = snapshot ?? this.db;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist local store:', err);
    }
  }

  public get data(): PersistentDatabase {
    return this.db;
  }

  public createSession(user: StoredUser): SessionRecord {
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    const record: SessionRecord = {
      token,
      userId: user.id,
      role: user.role,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    };
    this.sessions.set(token, record);
    return record;
  }

  public getSession(token: string): { session: SessionRecord; user: StoredUser } | null {
    const session = this.sessions.get(token);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    const user = this.db.users.find((u) => u.id === session.userId);
    if (!user) return null;
    return { session, user };
  }

  public revokeSession(token: string) {
    this.sessions.delete(token);
  }

  public sanitizeUser(user: StoredUser): UserAccount {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      title: user.title,
      facility: user.facility,
      patientId: user.patientId,
      language: user.language,
      isSynthetic: user.isSynthetic,
    };
  }

  public appendAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const full: AuditLogEntry = {
      id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.db.auditLogs.unshift(full);
    if (this.db.auditLogs.length > 250) {
      this.db.auditLogs.length = 250;
    }
    this.persist();
    return full;
  }
}

export const store = new MritidhristiStore();
