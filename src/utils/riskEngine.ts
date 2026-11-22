import type { LifestyleInput, RiskFactorContribution } from '../types/domain';

/**
 * Client-side mirror of the experimental rule-based lifestyle risk engine
 * so offline lifestyle assessments and real-time What-If simulations work
 * seamlessly with zero network connectivity.
 */
export function evaluateClientExperimentalRisk(inputs: LifestyleInput) {
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
          ? 'Whole grains, millets, pulses, and vegetables.'
          : inputs.dietQuality === 'moderate_refined'
          ? 'Moderate refined rice/maida and sweetened drinks.'
          : 'High refined carbs, sugary beverages, or frequent fried snacks.',
    },
    {
      factor: 'Physical Activity & Daily Steps',
      points: activityPoints,
      maxPoints: 15,
      modifiable: true,
      summary: `${inputs.dailySteps.toLocaleString()} steps/day (target ≥ 8,000 steps/day).`,
    },
    {
      factor: 'Body Weight (BMI)',
      points: weightPoints,
      maxPoints: 14,
      modifiable: true,
      summary: `BMI ${bmi} kg/m² (South Asian screening reference < 23 kg/m²).`,
    },
    {
      factor: 'Waist Circumference',
      points: waistPoints,
      maxPoints: 12,
      modifiable: true,
      summary: `${inputs.waistCm} cm waist measurement.`,
    },
    {
      factor: 'Sleep Duration & Quality',
      points: sleepPoints,
      maxPoints: 11,
      modifiable: true,
      summary: `${inputs.sleepHours} hrs/night (target 7–8.5 hrs).`,
    },
    {
      factor: 'Age',
      points: agePoints,
      maxPoints: 16,
      modifiable: false,
      summary: `${inputs.age} years.`,
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
          ? 'One parent with Type 2 diabetes.'
          : 'Both parents or sibling with Type 2 diabetes.',
    },
    {
      factor: 'Tobacco / Smoking',
      points: smokingPoints,
      maxPoints: 4,
      modifiable: true,
      summary: `Status: ${inputs.smokingStatus}.`,
    },
    {
      factor: 'Alcohol Consumption',
      points: alcoholPoints,
      maxPoints: 2,
      modifiable: true,
      summary: `Status: ${inputs.alcoholUse}.`,
    },
  ];

  const experimentalScore = Math.min(
    100,
    contributions.reduce((acc, c) => acc + c.points, 0)
  );
  const riskCategory: 'Low' | 'Moderate' | 'Elevated' =
    experimentalScore < 32 ? 'Low' : experimentalScore < 60 ? 'Moderate' : 'Elevated';

  const topModifiableFactors = contributions
    .filter((c) => c.modifiable)
    .sort((a, b) => b.points / b.maxPoints - a.points / a.maxPoints)
    .slice(0, 3)
    .map((c) => c.factor);

  const recommendations: string[] = [];
  if (dietPoints >= 9) {
    recommendations.push(
      'Swap part of white rice portions with ragi/thinai/kambu millets and fill half the plate with non-starchy South Indian vegetables and dal.'
    );
  } else {
    recommendations.push('Continue balanced traditional meals with steady fibre and pulse protein.');
  }
  if (activityPoints >= 8) {
    recommendations.push('Aim for two 15-minute brisk walks after lunch and dinner to reach 7,500–8,500 daily steps.');
  }
  if (sleepPoints >= 6) {
    recommendations.push('Maintain a consistent 7–8 hour sleep window and wind down screens 60 minutes before bed.');
  }
  if (waistPoints >= 7 || weightPoints >= 10) {
    recommendations.push('Target gradual 5–7% weight/waist reduction over 6 months with weekly coaching check-ins.');
  }
  if (riskCategory !== 'Low') {
    recommendations.push('Schedule clinician-guided HbA1c and Fasting Plasma Glucose laboratory testing.');
  }

  return {
    experimentalScore,
    riskCategory,
    bmi,
    scoringModelLabel: 'Experimental Rule-Based Lifestyle Screening Score (Prototype v0.1 — Non-Diagnostic)',
    contributions,
    topModifiableFactors,
    explanation: `Experimental rule-based score: ${experimentalScore}/100 (${riskCategory}). Top modifiable drivers: ${topModifiableFactors.join(', ')}. Lifestyle inputs alone cannot diagnose diabetes.`,
    recommendations,
  };
}
