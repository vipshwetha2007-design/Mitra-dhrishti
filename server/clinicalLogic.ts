import type {
  InterventionRecord,
  LifestyleInput,
  RiskFactorContribution,
  SimulinkScenarioResult,
} from '../src/types/domain.ts';

/**
 * EXPERIMENTAL RULE-BASED LIFESTYLE SCREENING SCORE
 * Clearly labelled as non-diagnostic and experimental; inspired by general
 * cardiometabolic risk factor domains (age, central adiposity, activity,
 * diet, family history, sleep, smoking/alcohol) without claiming clinical
 * diagnostic validation.
 */
export function evaluateExperimentalLifestyleRisk(inputs: LifestyleInput) {
  const heightM = Math.max(1.2, Math.min(2.3, inputs.heightCm / 100));
  const bmi = Number((inputs.weightKg / (heightM * heightM)).toFixed(1));

  const agePoints = inputs.age < 35 ? 2 : inputs.age < 45 ? 7 : inputs.age < 55 ? 12 : 16;
  const dietPoints =
    inputs.dietQuality === 'balanced_traditional'
      ? 2
      : inputs.dietQuality === 'moderate_refined'
      ? 9
      : 16;
  const sleepPoints =
    inputs.sleepHours >= 7 && inputs.sleepHours <= 8.5
      ? 2
      : inputs.sleepHours >= 6
      ? 6
      : 11;
  const activityPoints =
    inputs.dailySteps >= 8000
      ? 2
      : inputs.dailySteps >= 5000
      ? 8
      : 15;
  const weightPoints = bmi < 23 ? 2 : bmi < 25 ? 6 : bmi < 27.5 ? 10 : 14;
  const waistPoints = inputs.waistCm < 80 ? 2 : inputs.waistCm < 90 ? 7 : 12;
  const familyPoints =
    inputs.familyHistory === 'none'
      ? 0
      : inputs.familyHistory === 'one_parent'
      ? 6
      : 10;
  const smokingPoints =
    inputs.smokingStatus === 'never'
      ? 0
      : inputs.smokingStatus === 'former'
      ? 2
      : 4;
  const alcoholPoints =
    inputs.alcoholUse === 'none'
      ? 0
      : inputs.alcoholUse === 'occasional'
      ? 1
      : 2;

  const contributions: RiskFactorContribution[] = [
    {
      factor: 'Dietary Pattern',
      points: dietPoints,
      maxPoints: 16,
      modifiable: true,
      summary:
        inputs.dietQuality === 'balanced_traditional'
          ? 'Whole grains, millets, pulses, and vegetables predominate.'
          : inputs.dietQuality === 'moderate_refined'
          ? 'Moderate refined white rice/maida and sweetened beverages.'
          : 'High refined carbohydrates, sugary drinks, or frequent fried snacks.',
    },
    {
      factor: 'Physical Activity & Daily Steps',
      points: activityPoints,
      maxPoints: 15,
      modifiable: true,
      summary: `${inputs.dailySteps.toLocaleString()} steps/day (target ≥ 8,000 steps/day or 150 min/week brisk walking).`,
    },
    {
      factor: 'Body Weight (BMI)',
      points: weightPoints,
      maxPoints: 14,
      modifiable: true,
      summary: `BMI ${bmi} kg/m² (South Asian healthy screening reference < 23 kg/m²).`,
    },
    {
      factor: 'Waist Circumference',
      points: waistPoints,
      maxPoints: 12,
      modifiable: true,
      summary: `${inputs.waistCm} cm central waist measurement.`,
    },
    {
      factor: 'Sleep Duration & Quality',
      points: sleepPoints,
      maxPoints: 11,
      modifiable: true,
      summary: `${inputs.sleepHours} hrs/night (target 7–8.5 hours consistent sleep).`,
    },
    {
      factor: 'Age',
      points: agePoints,
      maxPoints: 16,
      modifiable: false,
      summary: `${inputs.age} years old.`,
    },
    {
      factor: 'Family History of Diabetes',
      points: familyPoints,
      maxPoints: 10,
      modifiable: false,
      summary:
        inputs.familyHistory === 'none'
          ? 'No known first-degree family history.'
          : inputs.familyHistory === 'one_parent'
          ? 'One parent diagnosed with Type 2 diabetes.'
          : 'Both parents or sibling diagnosed with Type 2 diabetes.',
    },
    {
      factor: 'Tobacco / Smoking',
      points: smokingPoints,
      maxPoints: 4,
      modifiable: true,
      summary: `Smoking status: ${inputs.smokingStatus}.`,
    },
    {
      factor: 'Alcohol Consumption',
      points: alcoholPoints,
      maxPoints: 2,
      modifiable: true,
      summary: `Alcohol intake: ${inputs.alcoholUse}.`,
    },
  ];

  const totalScore = Math.min(
    100,
    contributions.reduce((sum, item) => sum + item.points, 0)
  );

  const riskCategory: 'Low' | 'Moderate' | 'Elevated' =
    totalScore < 32 ? 'Low' : totalScore < 60 ? 'Moderate' : 'Elevated';

  const topModifiableFactors = contributions
    .filter((c) => c.modifiable)
    .sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints)
    .slice(0, 3)
    .map((c) => c.factor);

  const recommendations: string[] = [];
  if (dietPoints >= 9) {
    recommendations.push(
      'Shift 50% of plate to non-starchy South Indian vegetables (poriyal/kootu), add sambar/dal protein, and swap polished rice portions with millets (ragi/thinai/kambu) or hand-pounded brown rice.'
    );
  } else {
    recommendations.push(
      'Maintain balanced traditional Indian meals with portion-controlled grains, dal, curd, and leafy greens.'
    );
  }
  if (activityPoints >= 8) {
    recommendations.push(
      'Build toward 7,500–8,500 daily steps using two 15-minute post-meal brisk walks (after lunch and dinner).'
    );
  }
  if (sleepPoints >= 6) {
    recommendations.push(
      'Aim for a consistent 7–8 hour sleep schedule and avoid screens or heavy meals 90 minutes before bedtime.'
    );
  }
  if (waistPoints >= 7 || weightPoints >= 10) {
    recommendations.push(
      'Focus on gradual 5–7% weight and waist reduction over 6 months through sustainable nutrition and resistance exercises.'
    );
  }
  if (riskCategory !== 'Low') {
    recommendations.push(
      'Discuss laboratory blood glucose screening (Fasting Plasma Glucose and HbA1c) with an authorised clinician at your PHC or clinic.'
    );
  }

  const explanation =
    `Experimental rule-based lifestyle score is ${totalScore}/100 (${riskCategory} lifestyle risk tier). ` +
    `Primary modifiable focus areas: ${topModifiableFactors.join(', ')}. ` +
    `Important: Lifestyle inputs alone cannot diagnose diabetes; confirmed diagnosis requires clinician-interpreted laboratory testing (HbA1c or Fasting Plasma Glucose).`;

  return {
    experimentalScore: totalScore,
    riskCategory,
    scoringModelLabel: 'Experimental Rule-Based Lifestyle Screening Score (Prototype v0.1 — Non-Diagnostic)',
    contributions,
    topModifiableFactors,
    explanation,
    recommendations,
    bmi,
  };
}

/**
 * Clinician laboratory guideline helper (ICMR / ADA reference ranges)
 */
export function interpretLaboratoryResult(hba1cPercent?: number, fastingGlucoseMgDl?: number): string {
  const parts: string[] = [];
  if (typeof hba1cPercent === 'number' && !Number.isNaN(hba1cPercent)) {
    if (hba1cPercent < 5.7) {
      parts.push(`HbA1c ${hba1cPercent.toFixed(1)}%: Within normal guideline reference (< 5.7%).`);
    } else if (hba1cPercent < 6.5) {
      parts.push(`HbA1c ${hba1cPercent.toFixed(1)}%: Prediabetes reference range (5.7%–6.4%) — clinician counselling & prevention programme advised.`);
    } else {
      parts.push(`HbA1c ${hba1cPercent.toFixed(1)}%: Meets diabetes threshold (≥ 6.5%) — requires physician confirmation and eligibility check for annual retinal screening.`);
    }
  }
  if (typeof fastingGlucoseMgDl === 'number' && !Number.isNaN(fastingGlucoseMgDl)) {
    if (fastingGlucoseMgDl < 100) {
      parts.push(`FPG ${fastingGlucoseMgDl} mg/dL: Normal fasting reference (< 100 mg/dL).`);
    } else if (fastingGlucoseMgDl < 126) {
      parts.push(`FPG ${fastingGlucoseMgDl} mg/dL: Impaired fasting glucose range (100–125 mg/dL).`);
    } else {
      parts.push(`FPG ${fastingGlucoseMgDl} mg/dL: Meets diabetes threshold (≥ 126 mg/dL) — confirm with physician per ICMR/ADA protocol.`);
    }
  }
  if (parts.length === 0) {
    return 'Awaiting laboratory HbA1c or Fasting Plasma Glucose values recorded by an authorised clinician.';
  }
  return parts.join(' ');
}

/**
 * Deterministic rule-based Adaptive Intervention Ladder.
 * Experimental contextual-bandit arm is strictly restricted to pre-approved
 * educational framing and NEVER modifies clinical escalation rules.
 */
const PREAPPROVED_EDUCATIONAL_ARMS = [
  'Arm A (Family Routine Framing): Pair a 10-minute evening walk with a family phone call after dinner.',
  'Arm B (Traditional Food Swap): Replace one evening snack with roasted chana, sundal, or buttermilk.',
  'Arm C (Micro-Habit Start): Begin with just 5 minutes of gentle indoor walking after lunch for 3 days.',
];

export function evaluateAdaptiveIntervention(params: {
  patientId: string;
  stepsAchieved: number;
  sleepHours: number;
  barrierReported?: string;
  missedCheckInsCount: number;
}): InterventionRecord | null {
  const now = new Date().toISOString();
  const armIndex = Math.abs(params.stepsAchieved + params.patientId.length) % PREAPPROVED_EDUCATIONAL_ARMS.length;

  // Step 5: Clinical symptom / severe warning escalation (strictly deterministic, no bandit)
  if (
    params.barrierReported &&
    /dizzy|chest|blurred vision|vision|numb|faint|severe/i.test(params.barrierReported)
  ) {
    return {
      id: `int-${Date.now()}`,
      patientId: params.patientId,
      triggeredAt: now,
      triggerRule: 'Deterministic Rule L5: Reported clinical warning symptom in check-in barrier',
      ladderStep: 5,
      actionType: 'clinician_escalation',
      recommendedMessage:
        'Concerning symptom noted in check-in. Escalated immediately to assigned clinician / PHC medical officer for direct evaluation.',
      status: 'escalated',
    };
  }

  // Step 4: Repeated missed check-ins -> escalate to health coach
  if (params.missedCheckInsCount >= 2) {
    return {
      id: `int-${Date.now()}`,
      patientId: params.patientId,
      triggeredAt: now,
      triggerRule: 'Deterministic Rule L4: ≥ 2 consecutive missed weekly check-ins',
      ladderStep: 4,
      actionType: 'coach_escalation',
      recommendedMessage:
        'Assigned health worker notified for supportive phone follow-up to review programme barriers.',
      status: 'active',
    };
  }

  // Step 2/3: Low daily steps or barrier reported -> simpler alternative + pre-approved educational framing
  if (params.stepsAchieved < 4000 || (params.barrierReported && params.barrierReported.trim().length > 0)) {
    return {
      id: `int-${Date.now()}`,
      patientId: params.patientId,
      triggeredAt: now,
      triggerRule:
        params.stepsAchieved < 4000
          ? 'Deterministic Rule L2: Daily steps below 4,000 threshold'
          : 'Deterministic Rule L1: Patient reported adherence barrier',
      ladderStep: params.stepsAchieved < 4000 ? 2 : 1,
      actionType: params.stepsAchieved < 4000 ? 'simpler_activity' : 'barrier_check',
      recommendedMessage:
        'Offer simpler low-impact activity option (10-min seated stretches or short post-meal walk) and adjust reminder timing.',
      experimentalBanditArm: `Experimental Educational Selector (Pre-Approved Only) → ${PREAPPROVED_EDUCATIONAL_ARMS[armIndex]}`,
      status: 'active',
    };
  }

  if (params.sleepHours < 6) {
    return {
      id: `int-${Date.now()}`,
      patientId: params.patientId,
      triggeredAt: now,
      triggerRule: 'Deterministic Rule L3: Logged sleep < 6 hours',
      ladderStep: 3,
      actionType: 'reminder_adjust',
      recommendedMessage:
        'Shift evening activity reminder earlier by 1 hour and share wind-down sleep hygiene guide.',
      experimentalBanditArm: `Experimental Educational Selector (Pre-Approved Only) → ${PREAPPROVED_EDUCATIONAL_ARMS[0]}`,
      status: 'active',
    };
  }

  return null;
}

/**
 * Six District-Level Resource Planning Scenarios (Simulink-Compatible Schema).
 * Clearly labelled as Illustrative Analytical Simulation Mode unless imported
 * from an actual MATLAB Simulink CSV export.
 */
export function buildDefaultSimulinkScenarios(): SimulinkScenarioResult[] {
  const makeCurve = (peakQueue: number, peakWait: number) => [
    { hour: '08:00', queueLength: Math.round(peakQueue * 0.25), waitMinutes: Math.round(peakWait * 0.3) },
    { hour: '10:00', queueLength: Math.round(peakQueue * 0.72), waitMinutes: Math.round(peakWait * 0.75) },
    { hour: '12:00', queueLength: peakQueue, waitMinutes: peakWait },
    { hour: '14:00', queueLength: Math.round(peakQueue * 0.8), waitMinutes: Math.round(peakWait * 0.85) },
    { hour: '16:00', queueLength: Math.round(peakQueue * 0.45), waitMinutes: Math.round(peakWait * 0.5) },
    { hour: '18:00', queueLength: Math.round(peakQueue * 0.18), waitMinutes: Math.round(peakWait * 0.22) },
  ];

  const source = 'Illustrative Analytical Simulation (Not MATLAB Execution)' as const;

  return [
    {
      id: 'sim-1',
      scenarioKey: 'normal',
      name: '1. Normal Conditions',
      description: 'Baseline district screening load across 4 PHCs and 1 District Hospital with full fundus camera and specialist staffing.',
      source,
      dailyPatientArrivals: 120,
      camerasAvailable: 6,
      screeningCapacityPerDay: 150,
      imageThroughputPerHour: 24,
      ophthalmologistsAvailable: 3,
      healthWorkerWorkloadPct: 68,
      referralDemandPerWeek: 42,
      avgQueueLength: 6,
      avgWaitTimeMinutes: 18,
      resourceUtilizationPct: 74,
      estimatedMonthlyCostInr: 485000,
      bottleneck: 'None — operating within planned capacity buffer',
      hourlyQueueCurve: makeCurve(9, 22),
    },
    {
      id: 'sim-2',
      scenarioKey: 'high_volume',
      name: '2. High Patient Volume',
      description: 'District-wide diabetes awareness camp increases daily screening arrivals by 85% without additional camera deployment.',
      source,
      dailyPatientArrivals: 222,
      camerasAvailable: 6,
      screeningCapacityPerDay: 165,
      imageThroughputPerHour: 26,
      ophthalmologistsAvailable: 3,
      healthWorkerWorkloadPct: 96,
      referralDemandPerWeek: 78,
      avgQueueLength: 29,
      avgWaitTimeMinutes: 54,
      resourceUtilizationPct: 97,
      estimatedMonthlyCostInr: 612000,
      bottleneck: 'Fundus capture desks & PHC health worker triage',
      hourlyQueueCurve: makeCurve(38, 68),
    },
    {
      id: 'sim-3',
      scenarioKey: 'limited_connectivity',
      name: '3. Limited Connectivity',
      description: 'Rural blocks experience 6-hour intermittent 4G blackouts; PWA offline capture continues locally while remote doctor review batches sync.',
      source,
      dailyPatientArrivals: 120,
      camerasAvailable: 6,
      screeningCapacityPerDay: 142,
      imageThroughputPerHour: 15,
      ophthalmologistsAvailable: 3,
      healthWorkerWorkloadPct: 76,
      referralDemandPerWeek: 42,
      avgQueueLength: 11,
      avgWaitTimeMinutes: 27,
      resourceUtilizationPct: 79,
      estimatedMonthlyCostInr: 505000,
      bottleneck: 'Asynchronous upload backlog for remote clinical review',
      hourlyQueueCurve: makeCurve(15, 34),
    },
    {
      id: 'sim-4',
      scenarioKey: 'camera_shortage',
      name: '4. Camera Shortage',
      description: 'Two of six fundus cameras undergo calibration maintenance, reducing district imaging capacity by 33%.',
      source,
      dailyPatientArrivals: 120,
      camerasAvailable: 4,
      screeningCapacityPerDay: 100,
      imageThroughputPerHour: 16,
      ophthalmologistsAvailable: 3,
      healthWorkerWorkloadPct: 84,
      referralDemandPerWeek: 36,
      avgQueueLength: 24,
      avgWaitTimeMinutes: 49,
      resourceUtilizationPct: 95,
      estimatedMonthlyCostInr: 452000,
      bottleneck: 'Fundus camera availability (1.2x arrival-to-service ratio)',
      hourlyQueueCurve: makeCurve(31, 61),
    },
    {
      id: 'sim-5',
      scenarioKey: 'ophthalmologist_shortage',
      name: '5. Ophthalmologist Shortage',
      description: 'Only 1 district ophthalmologist available during leave period; screening capture continues while specialist review queue grows.',
      source,
      dailyPatientArrivals: 120,
      camerasAvailable: 6,
      screeningCapacityPerDay: 150,
      imageThroughputPerHour: 24,
      ophthalmologistsAvailable: 1,
      healthWorkerWorkloadPct: 82,
      referralDemandPerWeek: 46,
      avgQueueLength: 34,
      avgWaitTimeMinutes: 72,
      resourceUtilizationPct: 98,
      estimatedMonthlyCostInr: 438000,
      bottleneck: 'Ophthalmologist clinical review & referral backlog',
      hourlyQueueCurve: makeCurve(42, 86),
    },
    {
      id: 'sim-6',
      scenarioKey: 'increased_referral',
      name: '6. Increased Referral Demand',
      description: 'Higher proportion of long-duration diabetes patients raises referable findings by 65%, straining tertiary ophthalmology slots.',
      source,
      dailyPatientArrivals: 145,
      camerasAvailable: 6,
      screeningCapacityPerDay: 150,
      imageThroughputPerHour: 23,
      ophthalmologistsAvailable: 2,
      healthWorkerWorkloadPct: 89,
      referralDemandPerWeek: 92,
      avgQueueLength: 26,
      avgWaitTimeMinutes: 58,
      resourceUtilizationPct: 93,
      estimatedMonthlyCostInr: 675000,
      bottleneck: 'Tertiary ophthalmology referral slot capacity',
      hourlyQueueCurve: makeCurve(33, 70),
    },
  ];
}
