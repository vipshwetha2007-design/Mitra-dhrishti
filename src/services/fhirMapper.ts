/**
 * MITRA DRISHTI — PREVENT • DETECT • PROTECT
 * HL7 FHIR R4 (Release 4) Resource Mapper & Interoperability Engine
 * File: src/services/fhirMapper.ts
 * Standards: HL7 FHIR R4, SNOMED-CT, LOINC, Ayushman Bharat Digital Mission (ABDM) Profile
 */

import type { PatientRecord, RetinalScreening, ReferralRecord, AppointmentRecord } from '../types/domain';

export interface FhirBundle {
  resourceType: 'Bundle';
  type: 'collection' | 'transaction';
  timestamp: string;
  entry: Array<{
    fullUrl: string;
    resource: Record<string, unknown>;
  }>;
}

/**
 * Maps a MITRA DRISHTI PatientRecord to an HL7 FHIR R4 Patient Resource.
 */
export function mapToFhirPatient(patient: PatientRecord): Record<string, unknown> {
  const genderMap: Record<string, string> = {
    Male: 'male',
    Female: 'female',
    Other: 'other',
    Unspecified: 'unknown',
  };

  const birthYear = new Date().getFullYear() - (patient.age || 45);

  return {
    resourceType: 'Patient',
    id: patient.id,
    identifier: [
      {
        system: 'https://mitradrishti.health.gov.in/mrn',
        value: patient.mrn,
        use: 'official',
      },
    ],
    name: [
      {
        text: patient.name,
        family: patient.name.split(' ').slice(1).join(' ') || 'Beneficiary',
        given: [patient.name.split(' ')[0] || patient.name],
      },
    ],
    telecom: patient.phone
      ? [
          {
            system: 'phone',
            value: patient.phone,
            use: 'mobile',
          },
        ]
      : [],
    gender: genderMap[patient.sex] || 'unknown',
    birthDate: `${birthYear}-01-01`,
    address: [
      {
        line: [patient.villageOrWard || 'Rural Health Block'],
        district: patient.district || 'District Health Mission',
        state: 'Tamil Nadu',
        country: 'India',
      },
    ],
    communication: [
      {
        language: {
          coding: [
            {
              system: 'urn:ietf:bcp:47',
              code: patient.language === 'ta' ? 'ta-IN' : patient.language === 'hi' ? 'hi-IN' : 'en-IN',
              display: patient.language === 'ta' ? 'Tamil' : patient.language === 'hi' ? 'Hindi' : 'English',
            },
          ],
        },
        preferred: true,
      },
    ],
  };
}

/**
 * Maps a RetinalScreening to an HL7 FHIR R4 Observation Resource (Diabetic Retinopathy Screening Finding).
 */
export function mapToFhirScreeningObservation(
  screening: RetinalScreening,
  patient: PatientRecord
): Record<string, unknown> {
  const icdrSnomedMap: Record<number, { code: string; display: string }> = {
    0: { code: '238131007', display: 'No diabetic retinopathy (finding)' },
    1: { code: '312991008', display: 'Mild nonproliferative diabetic retinopathy (disorder)' },
    2: { code: '312992001', display: 'Moderate nonproliferative diabetic retinopathy (disorder)' },
    3: { code: '312993006', display: 'Severe nonproliferative diabetic retinopathy (disorder)' },
    4: { code: '390834007', display: 'Proliferative diabetic retinopathy (disorder)' },
  };

  const grade = screening.modelPrediction?.icdrGrade ?? 0;
  const snomed = icdrSnomedMap[grade] || icdrSnomedMap[0];

  return {
    resourceType: 'Observation',
    id: `obs-retinal-${screening.id}`,
    status: screening.humanReviewStatus === 'confirmed' ? 'final' : 'preliminary',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'exam',
            display: 'Exam',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '69729-2',
          display: 'Eye finding by ophthalmoscopy',
        },
      ],
      text: 'Diabetic Retinopathy Screening Assessment',
    },
    subject: {
      reference: `Patient/${patient.id}`,
      display: patient.name,
    },
    effectiveDateTime: screening.capturedAt,
    bodySite: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: screening.eye.includes('Right') ? '362503005' : '362502000',
          display: screening.eye.includes('Right') ? 'Entire right eye' : 'Entire left eye',
        },
      ],
    },
    valueCodeableConcept: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: snomed.code,
          display: snomed.display,
        },
      ],
      text: screening.modelPrediction?.gradeLabel || snomed.display,
    },
    component: [
      {
        code: {
          coding: [{ system: 'https://mitradrishti.health.gov.in/codes', code: 'gradcam-hotspots' }],
          text: 'Explainable AI Grad-CAM Hotspots',
        },
        valueInteger: screening.gradCam?.hotspots?.length || 0,
      },
      {
        code: {
          coding: [{ system: 'https://mitradrishti.health.gov.in/codes', code: 'model-confidence' }],
          text: 'Calibrated Softmax Confidence',
        },
        valueQuantity: {
          value: screening.modelPrediction?.confidence || 0.0,
          unit: 'probability',
        },
      },
    ],
  };
}

/**
 * Maps a ReferralRecord to an HL7 FHIR R4 ServiceRequest Resource.
 */
export function mapToFhirReferralServiceRequest(
  referral: ReferralRecord,
  patient: PatientRecord
): Record<string, unknown> {
  const priorityMap: Record<string, string> = {
    Routine: 'routine',
    Priority: 'urgent',
    Urgent: 'stat',
  };

  return {
    resourceType: 'ServiceRequest',
    id: `req-referral-${referral.id}`,
    status: referral.status === 'Completed' ? 'completed' : 'active',
    intent: 'order',
    priority: priorityMap[referral.urgency] || 'routine',
    code: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '408443003',
          display: 'Referral to ophthalmologist',
        },
      ],
      text: referral.reason || 'Ophthalmology evaluation for diabetic retinopathy',
    },
    subject: {
      reference: `Patient/${patient.id}`,
      display: patient.name,
    },
    authoredOn: referral.createdAt,
    requester: {
      display: referral.createdByDoctorName || 'Medical Officer / Screening Team',
    },
    performer: [
      {
        display: referral.targetFacility,
      },
    ],
  };
}

/**
 * Creates a complete longitudinal HL7 FHIR R4 Bundle for patient interoperability.
 */
export function createPatientFhirBundle(
  patient: PatientRecord,
  screenings: RetinalScreening[] = [],
  referrals: ReferralRecord[] = []
): FhirBundle {
  const entries: FhirBundle['entry'] = [
    {
      fullUrl: `urn:uuid:${patient.id}`,
      resource: mapToFhirPatient(patient),
    },
  ];

  for (const s of screenings) {
    entries.push({
      fullUrl: `urn:uuid:${s.id}`,
      resource: mapToFhirScreeningObservation(s, patient),
    });
  }

  for (const r of referrals) {
    entries.push({
      fullUrl: `urn:uuid:${r.id}`,
      resource: mapToFhirReferralServiceRequest(r, patient),
    });
  }

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: entries,
  };
}
