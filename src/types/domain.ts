export type UserRole = 'patient' | 'doctor' | 'admin';

export type LanguageCode = 'en' | 'ta' | 'hi';

export type AppNavView =
  | 'dashboard'
  | 'prevent'
  | 'detect'
  | 'protect'
  | 'reports'
  | 'appointments'
  | 'referrals'
  | 'notifications'
  | 'offline'
  | 'simulink'
  | 'settings';

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  title: string;
  facility?: string;
  patientId?: string;
  language: LanguageCode;
  isSynthetic: boolean;
}

export interface ConsentRecord {
  id: string;
  patientId: string;
  screeningConsent: boolean;
  dataStorageConsent: boolean;
  offlineCacheConsent: boolean;
  clinicalBoundaryAcknowledged: boolean;
  consentedAt: string;
  language: LanguageCode;
}

export interface PatientRecord {
  id: string;
  mrn: string;
  name: string;
  age: number;
  sex: 'Female' | 'Male' | 'Other';
  phone: string;
  district: string;
  villageOrWard: string;
  language: LanguageCode;
  diabetesStatus: 'at_risk' | 'prediabetes_lab' | 'diagnosed_t2d';
  assignedHealthWorker: string;
  assignedDoctorId: string;
  registeredAt: string;
  consent: ConsentRecord;
  isSynthetic: boolean;
}

export interface LifestyleInput {
  age: number;
  sex?: 'Female' | 'Male' | 'Other';
  dietQuality: 'balanced_traditional' | 'moderate_refined' | 'high_refined_sugars';
  sleepHours: number;
  dailySteps: number;
  weightKg: number;
  heightCm: number;
  waistCm: number;
  familyHistory: 'none' | 'one_parent' | 'both_parents_or_sibling';
  smokingStatus: 'never' | 'former' | 'current';
  alcoholUse: 'none' | 'occasional' | 'regular';
}

export interface RiskFactorContribution {
  factor: string;
  points: number;
  maxPoints: number;
  modifiable: boolean;
  summary: string;
}

export interface LifestyleAssessment {
  id: string;
  patientId: string;
  assessedAt: string;
  inputs: LifestyleInput;
  experimentalScore: number; // 0-100 rule-based experimental score
  riskCategory: 'Low' | 'Moderate' | 'Elevated';
  scoringModelLabel: string;
  contributions: RiskFactorContribution[];
  topModifiableFactors: string[];
  explanation: string;
  recommendations: string[];
  recordedOffline: boolean;
  syncStatus: 'synced' | 'pending';
  idempotencyKey?: string;
}

export interface LabResult {
  id: string;
  patientId: string;
  recordedByDoctorId: string;
  recordedByName: string;
  testedAt: string;
  hba1cPercent?: number;
  fastingGlucoseMgDl?: number;
  guidelineInterpretation: string;
  clinicalNotes: string;
}

export interface WeeklyLesson {
  id: string;
  week: number;
  phase: 1 | 2;
  title: string;
  titleTa: string;
  category: 'Indian Nutrition' | 'Physical Activity' | 'Sleep & Stress' | 'Monitoring';
  durationMinutes: number;
  summary: string;
  summaryTa?: string;
  practicalActivity?: string;
  measurableHabitTarget?: string;
  completed: boolean;
  completedAt?: string;
}

export interface HabitLog {
  id: string;
  patientId: string;
  date: string;
  healthyIndianDiet: boolean;
  stepsAchieved: number;
  sleepHours: number;
  weightKg?: number;
  waistCm?: number;
  barrierReported?: string;
  recordedOffline: boolean;
  syncStatus: 'synced' | 'pending';
  idempotencyKey?: string;
}

export interface InterventionRecord {
  id: string;
  patientId: string;
  triggeredAt: string;
  triggerRule: string;
  ladderStep: 1 | 2 | 3 | 4 | 5;
  actionType: 'barrier_check' | 'simpler_activity' | 'reminder_adjust' | 'coach_escalation' | 'clinician_escalation';
  recommendedMessage: string;
  experimentalBanditArm?: string;
  status: 'active' | 'resolved' | 'escalated';
}

export interface CheckpointRecord {
  day: 30 | 60 | 90 | 180 | 365;
  title: string;
  label?: string; // backward compatibility
  dueDate: string;
  completed: boolean;
  completedAt?: string;
  status: 'upcoming' | 'due' | 'completed' | 'missed';
  notes?: string;
  measurements?: {
    weightKg?: number;
    waistCm?: number;
    notes?: string;
  };
  baselineComparison?: {
    weightChangeKg?: number;
    waistChangeCm?: number;
    scoreChange?: number;
    summary?: string;
  };
}

export interface PreventionProgramme {
  id: string;
  patientId: string;
  startedAt: string;
  currentMonth: number; // 1-12
  phase: 'PHASE 1: LEARNING (Months 1-6)' | 'PHASE 2: MAINTENANCE (Months 7-12)';
  adherencePercent: number;
  baselineWeightKg: number;
  currentWeightKg: number;
  baselineWaistCm: number;
  currentWaistCm: number;
  checkpoints: CheckpointRecord[];
  lessons: WeeklyLesson[];
}

export interface ImageQualityAssessment {
  sharpnessScore: number; // 0-100
  brightnessMean: number; // 0-255
  exposureClipPercent: number; // 0-100
  width: number;
  height: number;
  gradable: boolean;
  rejectionReason?: string;
  recaptureGuidance?: string;
}

export type ICDRGrade = 0 | 1 | 2 | 3 | 4 | null;

export interface RetinalScreening {
  id: string;
  patientId: string;
  capturedAt: string;
  eye: 'Left (OS)' | 'Right (OD)';
  cameraSource: string;
  imagePreset: 'normal_demo' | 'moderate_npdr_demo' | 'ungradable_blur_demo' | 'uploaded_custom';
  imageDataUrl?: string;
  quality: ImageQualityAssessment;
  anatomicalStructures: {
    opticDiscDetected: boolean;
    vesselDensityIndex: number;
    maculaCentered: boolean;
  };
  lesionFindings: {
    hardExudatesFlag: boolean;
    haemorrhagesFlag: boolean;
    microaneurysmsExperimentalNote: string;
    implementationStatus: 'Illustrative / Prototype Heuristic';
  };
  modelPrediction: {
    modelVersion: string;
    architectureReference: string;
    icdrGrade: ICDRGrade;
    gradeLabel: string;
    confidence: number; // 0-1
    uncertainty: number; // 0-1
    oodFlag: boolean;
    gradeWithheld: boolean;
    withholdReason?: string;
    isIllustrativeOutput: boolean;
  };
  gradCam: {
    available: boolean;
    hotspots: { x: number; y: number; radius: number; intensity: number }[];
    limitationNotice: string;
  };
  humanReviewStatus: 'pending_review' | 'confirmed' | 'rejected_modified' | 'recapture_requested';
  summaryText: string;
}

export interface DoctorReview {
  id: string;
  screeningId: string;
  patientId: string;
  doctorId: string;
  doctorName: string;
  reviewedAt: string;
  decision: 'confirmed' | 'rejected_modified' | 'recapture_requested';
  clinicianGrade: string;
  triageCategory: 'Routine (12 months)' | 'Priority (3-6 months)' | 'Urgent Ophthalmology (< 2 weeks)' | 'Immediate Recapture';
  clinicalNotes: string;
  recommendedNextSteps: string;
}

export interface ReferralRecord {
  id: string;
  patientId: string;
  screeningId?: string;
  createdByDoctorId: string;
  createdByDoctorName: string;
  createdAt: string;
  targetFacility: string;
  specialty: 'Ophthalmology' | 'Diabetology' | 'Primary Health Centre';
  urgency: 'Routine' | 'Priority' | 'Urgent';
  reason: string;
  status: 'Pending' | 'Accepted' | 'Completed' | 'Cancelled';
  specialistFindings?: string;
  completedAt?: string;
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  title: string;
  facility: string;
  clinicianName: string;
  scheduledDate: string;
  scheduledTime: string;
  type: 'Follow-up Consultation' | 'Retinal Screening' | 'Ophthalmology Referral' | 'Lab Testing (HbA1c/FPG)';
  status: 'Confirmed' | 'Pending Confirmation' | 'Attended' | 'Missed' | 'Cancelled';
  reminderNote: string;
  escalated?: boolean;
}

export interface ContactAttempt {
  id: string;
  date: string;
  type: 'Phone Call' | 'Home Visit';
  notes: string;
  outcome: 'reached' | 'unreachable' | 'declined' | 'rescheduled';
  performedBy: string;
}

export interface FollowUpRecord {
  id: string;
  patientId: string;
  healthWorkerName: string;
  dueDate: string;
  channel: 'In-Person PHC' | 'Phone Call' | 'Home Visit';
  status: 'Scheduled' | 'Completed' | 'Escalated';
  outcomeNotes: string;
  nextScreeningDate?: string;
  source?: 'prevent_barrier' | 'prevent_checkpoint_missed' | 'missed_visit' | 'clinical_review' | 'manual';
  priority?: 'Routine' | 'Priority' | 'Urgent';
  createdAt?: string;
  contactAttempts?: ContactAttempt[];
  structuredOutcome?: 'barrier_resolved' | 'referred_to_doctor' | 'unable_to_contact' | 'patient_declined' | 'ongoing';
  referralId?: string;
}

export interface NotificationItem {
  id: string;
  roleTargets: UserRole[];
  patientId?: string;
  severity: 'info' | 'warning' | 'urgent' | 'success';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  actionView?: AppNavView;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  role: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: 'SUCCESS' | 'DENIED' | 'CONFLICT';
  details: string;
}

export interface DistrictResourceMetric {
  id: string;
  facilityName: string;
  type: 'PHC' | 'District Hospital' | 'Mobile Screening Unit';
  fundusCameras: number;
  ophthalmologists: number;
  healthWorkers: number;
  dailyCapacity: number;
  currentUtilizationPct: number;
  connectivityProfile: 'Stable Broadband' | 'Intermittent 4G' | 'Offline-First Rural';
}

export interface SimulinkScenarioResult {
  id: string;
  scenarioKey:
    | 'normal'
    | 'high_volume'
    | 'limited_connectivity'
    | 'camera_shortage'
    | 'ophthalmologist_shortage'
    | 'increased_referral';
  name: string;
  description: string;
  source: 'Illustrative Analytical Simulation (Not MATLAB Execution)' | 'Imported MATLAB Simulink CSV';
  dailyPatientArrivals: number;
  camerasAvailable: number;
  screeningCapacityPerDay: number;
  imageThroughputPerHour: number;
  ophthalmologistsAvailable: number;
  healthWorkerWorkloadPct: number;
  referralDemandPerWeek: number;
  avgQueueLength: number;
  avgWaitTimeMinutes: number;
  resourceUtilizationPct: number;
  estimatedMonthlyCostInr: number;
  bottleneck: string;
  hourlyQueueCurve: { hour: string; queueLength: number; waitMinutes: number }[];
}

export interface BootstrapPayload {
  user: UserAccount;
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
  meta: {
    dataProvenance: 'Synthetic Prototype Dataset + Live Session Mutations';
    clinicalDisclaimer: string;
    serverTime: string;
  };
}
