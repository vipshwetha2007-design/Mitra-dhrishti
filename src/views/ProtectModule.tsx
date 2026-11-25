import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  MapPin,
  PlusCircle,
  Send,
  ShieldCheck,
  Stethoscope,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  AppointmentRecord,
  BootstrapPayload,
  DoctorReview,
  FollowUpRecord,
  ReferralRecord,
} from '../types/domain';
import { FundusVisualizer } from '../components/FundusVisualizer';

interface ProtectModuleProps {
  data: BootstrapPayload;
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  isOnline: boolean;
  onSubmitReview: (payload: {
    screeningId: string;
    decision: DoctorReview['decision'];
    clinicianGrade: string;
    triageCategory: DoctorReview['triageCategory'];
    clinicalNotes: string;
    recommendedNextSteps: string;
  }) => Promise<void>;
  onCreateReferral: (payload: {
    patientId: string;
    screeningId?: string;
    targetFacility: string;
    specialty: ReferralRecord['specialty'];
    urgency: ReferralRecord['urgency'];
    reason: string;
  }) => Promise<void>;
  onUpdateReferral: (
    id: string,
    status: ReferralRecord['status'],
    specialistFindings?: string
  ) => Promise<void>;
  onCreateAppointment: (payload: {
    patientId: string;
    title: string;
    facility: string;
    clinicianName: string;
    scheduledDate: string;
    scheduledTime: string;
    type: AppointmentRecord['type'];
    reminderNote: string;
  }) => Promise<void>;
  onUpdateAppointment: (
    id: string,
    status: AppointmentRecord['status'],
    escalated?: boolean
  ) => Promise<void>;
  onCreateFollowUp: (payload: {
    patientId: string;
    healthWorkerName: string;
    dueDate: string;
    channel: FollowUpRecord['channel'];
    status: FollowUpRecord['status'];
    outcomeNotes: string;
    nextScreeningDate?: string;
  }) => Promise<void>;
  onLogFollowUpAttempt?: (
    followUpId: string,
    payload: {
      date: string;
      type: 'Phone Call' | 'Home Visit';
      notes: string;
      outcome: 'reached' | 'unreachable' | 'declined' | 'rescheduled';
    }
  ) => Promise<void>;
  onUpdateFollowUp?: (
    followUpId: string,
    payload: {
      status?: FollowUpRecord['status'];
      channel?: FollowUpRecord['channel'];
      dueDate?: string;
      outcomeNotes?: string;
      nextScreeningDate?: string;
      priority?: FollowUpRecord['priority'];
      structuredOutcome?: FollowUpRecord['structuredOutcome'];
    }
  ) => Promise<void>;
  onRegisterPatient?: (payload: {
    name: string;
    age: number;
    sex: 'Female' | 'Male' | 'Other';
    phone: string;
    district: string;
    villageOrWard: string;
    language: 'en' | 'ta' | 'hi';
    diabetesStatus: 'at_risk' | 'prediabetes_lab' | 'diagnosed_t2d';
    screeningConsent: boolean;
    dataStorageConsent: boolean;
    offlineCacheConsent: boolean;
    clinicalBoundaryAcknowledged: boolean;
  }) => Promise<void>;
  initialTab?: 'review' | 'referrals' | 'appointments' | 'continuity' | 'vhn_field_mode';
}

export const ProtectModule: React.FC<ProtectModuleProps> = ({
  data,
  selectedPatientId,
  onSelectPatient,
  isOnline,
  onSubmitReview,
  onCreateReferral,
  onUpdateReferral,
  onCreateAppointment,
  onUpdateAppointment,
  onCreateFollowUp,
  onLogFollowUpAttempt,
  onUpdateFollowUp,
  onRegisterPatient,
  initialTab = 'review',
}) => {
  const [subTab, setSubTab] = useState<'review' | 'referrals' | 'appointments' | 'continuity' | 'vhn_field_mode'>(
    initialTab
  );
  useEffect(() => {
    setSubTab(initialTab);
  }, [initialTab]);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const patient = data.patients.find((p) => p.id === selectedPatientId) || data.patients[0];
  const screenings = data.screenings.filter((s) => s.patientId === patient?.id);
  const activeScreening =
    screenings.find((s) => s.humanReviewStatus === 'pending_review') || screenings[0];
  const reviews = data.doctorReviews.filter((r) => r.patientId === patient?.id);
  const referrals = data.referrals.filter((r) => r.patientId === patient?.id);
  const appointments = data.appointments.filter((a) => a.patientId === patient?.id);
  const followUps = data.followUps.filter((f) => f.patientId === patient?.id);
  const latestLab = data.labs.find((l) => l.patientId === patient?.id);
  const latestRisk = data.assessments.find((a) => a.patientId === patient?.id);

  const [decision, setDecision] = useState<DoctorReview['decision']>('confirmed');
  const [clinicianGrade, setClinicianGrade] = useState('Moderate NPDR — Clinician Verified');
  const [triageCategory, setTriageCategory] =
    useState<DoctorReview['triageCategory']>('Priority (3-6 months)');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [nextSteps, setNextSteps] = useState(
    'Refer for dilated ophthalmologist examination and optimize HbA1c control.'
  );

  const [refFacility, setRefFacility] = useState('Regional Institute of Ophthalmology, Egmore');
  const [refSpecialty, setRefSpecialty] = useState<ReferralRecord['specialty']>('Ophthalmology');
  const [refUrgency, setRefUrgency] = useState<ReferralRecord['urgency']>('Priority');
  const [refReason, setRefReason] = useState('');

  const [aptTitle, setAptTitle] = useState('Follow-up Consultation & Retinal Review');
  const [aptFacility, setAptFacility] = useState('Adyar Urban PHC / City Hospital');
  const [aptClinician, setAptClinician] = useState('Dr. Arvind Raman');
  const [aptDate, setAptDate] = useState('2026-12-04');
  const [aptTime, setAptTime] = useState('10:00 AM');
  const [aptType, setAptType] = useState<AppointmentRecord['type']>('Follow-up Consultation');
  const [aptReminder, setAptReminder] = useState('Bring previous lab reports and medication list.');

  const [fuWorker, setFuWorker] = useState(patient?.assignedHealthWorker || 'Anitha K (VHN)');
  const [fuDue, setFuDue] = useState('2026-12-10');
  const [fuChannel, setFuChannel] = useState<FollowUpRecord['channel']>('Phone Call');
  const [fuStatus, setFuStatus] = useState<FollowUpRecord['status']>('Scheduled');
  const [fuNotes, setFuNotes] = useState('');
  const [fuNextScreen, setFuNextScreen] = useState('2027-05-20');

  const isDoctor = data.user.role === 'doctor';
  const isStaff = data.user.role === 'doctor' || data.user.role === 'admin';

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeScreening) return;
    setBusy(true);
    setMsg(null);
    try {
      await onSubmitReview({
        screeningId: activeScreening.id,
        decision,
        clinicianGrade,
        triageCategory,
        clinicalNotes,
        recommendedNextSteps: nextSteps,
      });
      setClinicalNotes('');
      setMsg({ type: 'success', text: 'Clinician review recorded and patient notified.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to submit review.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setBusy(true);
    setMsg(null);
    try {
      await onCreateReferral({
        patientId: patient.id,
        screeningId: activeScreening?.id,
        targetFacility: refFacility,
        specialty: refSpecialty,
        urgency: refUrgency,
        reason: refReason,
      });
      setRefReason('');
      setMsg({ type: 'success', text: 'Specialist referral created and logged in continuity record.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to create referral.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateApt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setBusy(true);
    setMsg(null);
    try {
      await onCreateAppointment({
        patientId: patient.id,
        title: aptTitle,
        facility: aptFacility,
        clinicianName: aptClinician,
        scheduledDate: aptDate,
        scheduledTime: aptTime,
        type: aptType,
        reminderNote: aptReminder,
      });
      setMsg({ type: 'success', text: 'Appointment scheduled in shared patient care plan.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to book appointment.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setBusy(true);
    setMsg(null);
    try {
      await onCreateFollowUp({
        patientId: patient.id,
        healthWorkerName: fuWorker,
        dueDate: fuDue,
        channel: fuChannel,
        status: fuStatus,
        outcomeNotes: fuNotes,
        nextScreeningDate: fuNextScreen || undefined,
      });
      setFuNotes('');
      setMsg({ type: 'success', text: 'Health-worker continuity follow-up recorded.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save follow-up.' });
    } finally {
      setBusy(false);
    }
  };

  const [activeAttemptFuId, setActiveAttemptFuId] = useState<string | null>(null);
  const [attemptType, setAttemptType] = useState<'Phone Call' | 'Home Visit'>('Phone Call');
  const [attemptOutcome, setAttemptOutcome] = useState<'reached' | 'unreachable' | 'declined' | 'rescheduled'>('reached');
  const [attemptNotes, setAttemptNotes] = useState('');
  const [attemptDate, setAttemptDate] = useState(new Date().toISOString().slice(0, 10));

  const handleLogAttempt = async (fuId: string) => {
    if (!onLogFollowUpAttempt) return;
    setBusy(true);
    try {
      await onLogFollowUpAttempt(fuId, {
        date: attemptDate,
        type: attemptType,
        notes: attemptNotes,
        outcome: attemptOutcome,
      });
      setActiveAttemptFuId(null);
      setAttemptNotes('');
      setMsg({ type: 'success', text: 'Contact attempt recorded successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to log attempt' });
    } finally {
      setBusy(false);
    }
  };

  // Rural Worker Deployment Layer (ASHA / VHN Field Mode) State
  const [vhnDistrict, setVhnDistrict] = useState('Madurai');
  const [vhnVillage, setVhnVillage] = useState('Keeladi');
  const [vhnHamlet, setVhnHamlet] = useState('East Colony');
  const [vhnSection, setVhnSection] = useState<'register' | 'idrs_screen' | 'mobile_van' | 'doorstep_continuity'>('register');

  // Beneficiary Registration State
  const [vhnRegName, setVhnRegName] = useState('');
  const [vhnRegAge, setVhnRegAge] = useState(48);
  const [vhnRegSex, setVhnRegSex] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [vhnRegPhone, setVhnRegPhone] = useState('9842100000');
  const [vhnRegStatus, setVhnRegStatus] = useState<'at_risk' | 'prediabetes_lab' | 'diagnosed_t2d'>('at_risk');

  // IDRS Rapid Screen State
  const [idrsAge, setIdrsAge] = useState<0 | 20 | 30>(20);
  const [idrsWaist, setIdrsWaist] = useState<0 | 10 | 20>(10);
  const [idrsActivity, setIdrsActivity] = useState<0 | 10 | 20>(20);
  const [idrsFamily, setIdrsFamily] = useState<0 | 10 | 20>(10);
  const [fieldGlucose, setFieldGlucose] = useState<number | ''>(148);
  const [fieldSystolic, setFieldSystolic] = useState<number | ''>(130);
  const [fieldDiastolic, setFieldDiastolic] = useState<number | ''>(84);

  // Mobile Van State
  const [vanVenue, setVanVenue] = useState('Keeladi Panchayat Community Center');
  const [vanDate, setVanDate] = useState('2026-11-28');
  const [vanTransportAssist, setVanTransportAssist] = useState(true);

  // Doorstep Visit Note
  const [vhnVisitNotes, setVhnVisitNotes] = useState('Doorstep visit completed. Beneficiary counselled on diabetic retinopathy. Reminded to attend Monday dilated eye exam at District Hospital.');
  const [vhnVisitOutcome, setVhnVisitOutcome] = useState<'reached' | 'unreachable' | 'declined' | 'rescheduled'>('reached');

  const idrsTotalScore = idrsAge + idrsWaist + idrsActivity + idrsFamily;

  const handleVhnRegisterBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vhnRegName.trim() || !onRegisterPatient) return;
    setBusy(true);
    setMsg(null);
    try {
      await onRegisterPatient({
        name: vhnRegName.trim(),
        age: Number(vhnRegAge),
        sex: vhnRegSex,
        phone: vhnRegPhone.trim() || '0000000000',
        district: vhnDistrict,
        villageOrWard: `${vhnVillage} - ${vhnHamlet}`,
        language: 'ta',
        diabetesStatus: vhnRegStatus,
        screeningConsent: true,
        dataStorageConsent: true,
        offlineCacheConsent: true,
        clinicalBoundaryAcknowledged: true,
      });
      setMsg({ type: 'success', text: `Rural beneficiary "${vhnRegName}" enrolled successfully in ${vhnVillage}.` });
      setVhnRegName('');
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Failed to register rural beneficiary.' });
    } finally {
      setBusy(false);
    }
  };

  const handleBookMobileVan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setBusy(true);
    setMsg(null);
    try {
      await onCreateAppointment({
        patientId: patient.id,
        title: `Mobile Retinal Screening Van — ${vhnVillage}`,
        facility: `Mobile Retinal Screening Van (Camp at ${vanVenue}, ${vhnVillage})`,
        clinicianName: 'Dr. Arvind Raman / Mobile Van Ophthalmic Assistant',
        scheduledDate: vanDate,
        scheduledTime: '09:30 AM',
        type: 'Retinal Screening',
        reminderNote: `ASHA/VHN assisted door-to-door camp booking. Transport assistance: ${vanTransportAssist ? 'Yes (Local Van/Auto Pickup)' : 'Self-transport'}.`,
      });
      setMsg({ type: 'success', text: `Mobile screening van booking confirmed for ${patient.name} on ${vanDate}.` });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Failed to book mobile van appointment.' });
    } finally {
      setBusy(false);
    }
  };

  const handleLogDoorstepVisit = async (fuId: string) => {
    if (!onLogFollowUpAttempt) return;
    setBusy(true);
    try {
      await onLogFollowUpAttempt(fuId, {
        date: new Date().toISOString().slice(0, 10),
        type: 'Home Visit',
        notes: vhnVisitNotes,
        outcome: vhnVisitOutcome,
      });
      setMsg({ type: 'success', text: 'Doorstep follow-up visit recorded in continuity record.' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err?.message || 'Failed to record doorstep visit.' });
    } finally {
      setBusy(false);
    }
  };

  const handleQuickUpdateFollowUp = async (fuId: string, updates: {
    status?: FollowUpRecord['status'];
    channel?: FollowUpRecord['channel'];
    dueDate?: string;
    outcomeNotes?: string;
    nextScreeningDate?: string;
    priority?: FollowUpRecord['priority'];
    structuredOutcome?: FollowUpRecord['structuredOutcome'];
  }) => {
    if (!onUpdateFollowUp) return;
    setBusy(true);
    try {
      await onUpdateFollowUp(fuId, updates);
      setMsg({ type: 'success', text: 'Follow-up status updated.' });
    } catch (err) {
      setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update follow-up' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-indigo-700 uppercase tracking-wide">
            Pillar Three · Clinician Review, Referrals, Appointments &amp; Continuity of Care
          </p>
          <h1 className="font-display text-[28px] font-bold text-[#0B2540] leading-tight">
            PROTECT — Doctor-Led Clinical Coordination
          </h1>
        </div>
        {data.patients.length > 1 && (
          <div className="flex items-center gap-2.5">
            <label htmlFor="protect-patient" className="text-[15px] font-semibold text-slate-700">
              Patient Chart:
            </label>
            <select
              id="protect-patient"
              value={patient?.id || ''}
              onChange={(e) => onSelectPatient(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-semibold text-slate-800 shadow-sm focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
            >
              {data.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mrn})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {patient && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 shadow-sm">
          <div>
            <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Patient &amp; MRN</div>
            <div className="mt-1 font-display text-[16px] font-bold text-[#0B2540]">{patient.name}</div>
            <div className="font-mono text-[13px] text-slate-600 mt-0.5">
              {patient.mrn} · {patient.age}y {patient.sex} · {patient.district}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Prevent Risk Score</div>
            <div className="mt-1 font-mono text-[16px] font-bold text-slate-900 tabular-nums">
              {latestRisk ? `${latestRisk.experimentalScore}/100 (${latestRisk.riskCategory})` : 'Not assessed'}
            </div>
            <div className="text-[13px] text-slate-500 mt-0.5">Experimental lifestyle screen</div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Latest Clinical Lab</div>
            <div className="mt-1 font-mono text-[16px] font-bold text-slate-900 tabular-nums">
              {latestLab
                ? `HbA1c ${latestLab.hba1cPercent ?? '—'}% · FPG ${latestLab.fastingGlucoseMgDl ?? '—'}`
                : 'No lab recorded'}
            </div>
            <div className="text-[13px] text-slate-500 mt-0.5">
              {patient.diabetesStatus === 'diagnosed_t2d' ? 'Diagnosed T2D' : patient.diabetesStatus}
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Care Team Ownership</div>
            <div className="mt-1 text-[16px] font-bold text-[#0F766E]">
              {patient.assignedHealthWorker}
            </div>
            <div className="text-[13px] text-slate-500 mt-0.5">Dr. Arvind Raman (MO)</div>
          </div>
        </div>
      )}

      {!isOnline && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] text-amber-950 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0" />
          <span className="leading-relaxed">
            <strong>Online-Only Clinical Governance:</strong> Remote doctor review sign-off, specialist referral updates, and external hospital appointment confirmations require live connectivity and are paused while offline.
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-200/70 p-1.5">
        {[
          { id: 'review', label: 'Doctor Clinical Review', icon: Stethoscope },
          { id: 'referrals', label: `Referrals (${referrals.length})`, icon: Send },
          { id: 'appointments', label: `Appointments (${appointments.length})`, icon: Calendar },
          { id: 'continuity', label: `Continuity & Follow-ups (${followUps.length})`, icon: UserCheck },
          { id: 'vhn_field_mode', label: 'ASHA / VHN Rural Field Mode', icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubTab(tab.id as typeof subTab);
                setMsg(null);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors whitespace-nowrap ${
                active ? 'bg-white text-[#0B2540] shadow-sm' : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 text-indigo-700" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-[14px] font-medium ${
            msg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {msg.text}
        </div>
      )}

      {subTab === 'review' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Retinal Screening &amp; Grad-CAM Inspection
            </h2>
            {activeScreening ? (
              <>
                <div className="grid grid-cols-2 gap-3.5">
                  <FundusVisualizer
                    preset={activeScreening.imagePreset}
                    imageDataUrl={activeScreening.imageDataUrl}
                    stage="raw"
                    size={240}
                    className="aspect-square w-full"
                    label={`Original (${activeScreening.eye})`}
                  />
                  <FundusVisualizer
                    preset={activeScreening.imagePreset}
                    imageDataUrl={activeScreening.imageDataUrl}
                    stage="gradcam"
                    hotspots={activeScreening.gradCam.hotspots}
                    size={240}
                    className="aspect-square w-full"
                    label="Grad-CAM Assist"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[14px] space-y-2">
                  <div className="font-bold text-[16px] text-slate-900">
                    AI Screening Assist: {activeScreening.modelPrediction.gradeLabel}
                  </div>
                  <div className="font-mono text-[13px] text-slate-600 tabular-nums">
                    Quality: {activeScreening.quality.gradable ? 'Gradable' : 'Ungradable'} ·
                    Sharpness: {activeScreening.quality.sharpnessScore}/100 ·
                    Status: {activeScreening.humanReviewStatus}
                  </div>
                  <p className="text-slate-700 leading-relaxed">{activeScreening.summaryText}</p>
                </div>
              </>
            ) : (
              <p className="text-[14px] text-slate-500">No retinal screening available for this patient yet.</p>
            )}

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="text-[15px] font-bold text-[#0B2540]">Clinician Review History</div>
              {reviews.length === 0 ? (
                <p className="text-[14px] text-slate-500">Awaiting first doctor clinical review.</p>
              ) : (
                reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-[14px] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-[15px]">{rev.clinicianGrade}</span>
                      <span className="font-semibold text-[#0F766E] text-[14px]">{rev.triageCategory}</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{rev.clinicalNotes}</p>
                    <div className="text-[13px] text-slate-500">
                      Signed by {rev.doctorName} · {new Date(rev.reviewedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Clinician Confirmation &amp; Triage Protocol
            </h2>
            <p className="mt-1 text-[14px] text-slate-600 leading-relaxed">
              Triage follows clinician-approved ophthalmology protocols — never solely AI confidence or lifestyle score.
            </p>

            {!isDoctor ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-950 leading-relaxed">
                <strong>RBAC Protection Active:</strong> Clinical confirmation and triage sign-off are restricted to authenticated <strong>Doctor</strong> accounts. Switch to <em>Dr. Arvind Raman</em> via the top-right account menu to submit a review.
              </div>
            ) : !activeScreening ? (
              <p className="mt-5 text-[14px] text-slate-500">Capture or upload a retinal screening in Detect first.</p>
            ) : (
              <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                    Clinical Decision on AI-Assisted Finding
                  </label>
                  <select
                    value={decision}
                    onChange={(e) => setDecision(e.target.value as DoctorReview['decision'])}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] font-medium focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  >
                    <option value="confirmed">Confirm AI-Assisted Finding</option>
                    <option value="rejected_modified">Reject / Override with Clinician Assessment</option>
                    <option value="recapture_requested">Reject Image — Request Fundus Recapture</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                    Clinician Grade / Finding
                  </label>
                  <input
                    type="text"
                    required
                    value={clinicianGrade}
                    onChange={(e) => setClinicianGrade(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                    Clinician-Approved Triage Category
                  </label>
                  <select
                    value={triageCategory}
                    onChange={(e) => setTriageCategory(e.target.value as DoctorReview['triageCategory'])}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] font-medium focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  >
                    <option value="Routine (12 months)">Routine (12 months)</option>
                    <option value="Priority (3-6 months)">Priority (3–6 months)</option>
                    <option value="Urgent Ophthalmology (< 2 weeks)">Urgent Ophthalmology (&lt; 2 weeks)</option>
                    <option value="Immediate Recapture">Immediate Recapture</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Clinical Notes</label>
                  <textarea
                    required
                    rows={3}
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                    placeholder="Document optic disc, macula, exudates, haemorrhages, and glycaemic context..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">
                    Recommended Next Steps
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={nextSteps}
                    onChange={(e) => setNextSteps(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy || !isOnline}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B2540] py-3 text-[15px] font-semibold text-white hover:bg-[#113556] disabled:opacity-50 transition-colors shadow-sm"
                >
                  <ClipboardCheck className="h-5 w-5" />
                  {busy ? 'Signing Review...' : 'Sign & Save Clinical Review'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {subTab === 'referrals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Referral Records ({patient?.name})
            </h2>
            {referrals.length === 0 ? (
              <p className="text-[14px] text-slate-500">No specialist referrals issued for this patient.</p>
            ) : (
              referrals.map((ref) => (
                <div key={ref.id} className="rounded-xl border border-slate-200 p-4 text-[14px] space-y-2.5 bg-slate-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[16px] text-slate-900">
                      {ref.urgency} · {ref.specialty} → {ref.targetFacility}
                    </span>
                    <span className="font-mono font-bold text-[14px] text-[#0F766E]">{ref.status}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{ref.reason}</p>
                  {ref.specialistFindings && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-[14px] text-emerald-950 leading-relaxed">
                      <strong>Specialist Feedback:</strong> {ref.specialistFindings}
                    </div>
                  )}
                  {isStaff && isOnline && ref.status !== 'Completed' && (
                    <div className="flex flex-wrap gap-2.5 pt-1.5">
                      <button
                        type="button"
                        onClick={() => void onUpdateReferral(ref.id, 'Accepted')}
                        className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        Mark Accepted
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void onUpdateReferral(
                            ref.id,
                            'Completed',
                            'Dilated fundus examination & OCT completed; follow-up plan updated in PHC chart.'
                          )
                        }
                        className="rounded-lg bg-[#0D9488] px-3.5 py-1.5 text-[13px] font-semibold text-white hover:bg-[#0F766E] transition-colors shadow-2xs"
                      >
                        Record Specialist Findings &amp; Complete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-display text-[19px] font-bold text-[#0B2540]">Issue New Referral</h3>
            {!isStaff ? (
              <p className="mt-2 text-[14px] text-slate-500">
                Referrals are generated by authorised Doctors or Health Administrators.
              </p>
            ) : (
              <form onSubmit={handleCreateReferral} className="mt-5 space-y-4 text-[14px]">
                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Target Healthcare Facility</label>
                  <input
                    type="text"
                    required
                    value={refFacility}
                    onChange={(e) => setRefFacility(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Specialty</label>
                    <select
                      value={refSpecialty}
                      onChange={(e) => setRefSpecialty(e.target.value as ReferralRecord['specialty'])}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    >
                      <option value="Ophthalmology">Ophthalmology</option>
                      <option value="Diabetology">Diabetology</option>
                      <option value="Primary Health Centre">Primary Health Centre</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Urgency</label>
                    <select
                      value={refUrgency}
                      onChange={(e) => setRefUrgency(e.target.value as ReferralRecord['urgency'])}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    >
                      <option value="Routine">Routine</option>
                      <option value="Priority">Priority</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Clinical Referral Reason</label>
                  <textarea
                    required
                    rows={3}
                    value={refReason}
                    onChange={(e) => setRefReason(e.target.value)}
                    placeholder="Specify clinical findings, HbA1c, and requested specialist evaluation..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !isOnline}
                  className="w-full rounded-xl bg-[#0B2540] py-3 text-[15px] font-semibold text-white hover:bg-[#113556] disabled:opacity-50 transition-colors shadow-sm"
                >
                  Generate Referral Record
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {subTab === 'appointments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Scheduled Appointments ({patient?.name})
            </h2>
            {appointments.map((apt) => (
              <div key={apt.id} className="rounded-xl border border-slate-200 p-4 text-[14px] space-y-2.5 bg-slate-50/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[16px] text-slate-900">{apt.title}</span>
                  <span
                    className={`font-semibold text-[14px] ${
                      apt.status === 'Confirmed' || apt.status === 'Attended'
                        ? 'text-emerald-700'
                        : apt.status === 'Missed'
                        ? 'text-rose-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {apt.status}
                  </span>
                </div>
                <div className="text-slate-600 font-mono text-[13px] tabular-nums">
                  {apt.scheduledDate} at {apt.scheduledTime} · {apt.facility} · {apt.clinicianName}
                </div>
                <div className="flex flex-wrap gap-2.5 pt-1.5">
                  {isStaff && isOnline && (
                    <>
                      <button
                        type="button"
                        onClick={() => void onUpdateAppointment(apt.id, 'Confirmed')}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => void onUpdateAppointment(apt.id, 'Attended')}
                        className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[13px] font-semibold text-sky-800 hover:bg-sky-100 transition-colors"
                      >
                        Mark Attended
                      </button>
                      <button
                        type="button"
                        onClick={() => void onUpdateAppointment(apt.id, 'Missed', true)}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[13px] font-semibold text-rose-800 hover:bg-rose-100 transition-colors"
                      >
                        Mark Missed &amp; Escalate
                      </button>
                    </>
                  )}
                  {isOnline && apt.status !== 'Cancelled' && apt.status !== 'Attended' && (
                    <button
                      type="button"
                      onClick={() => void onUpdateAppointment(apt.id, 'Cancelled')}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={handleCreateApt}
            className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 text-[14px] shadow-sm"
          >
            <h3 className="font-display text-[19px] font-bold text-[#0B2540]">Schedule Appointment</h3>
            <div>
              <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Visit Title</label>
              <input
                type="text"
                required
                value={aptTitle}
                onChange={(e) => setAptTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Date</label>
                <input
                  type="date"
                  required
                  value={aptDate}
                  onChange={(e) => setAptDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                />
              </div>
              <div>
                <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Time</label>
                <input
                  type="text"
                  required
                  value={aptTime}
                  onChange={(e) => setAptTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Appointment Type</label>
              <select
                value={aptType}
                onChange={(e) => setAptType(e.target.value as AppointmentRecord['type'])}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
              >
                <option value="Follow-up Consultation">Follow-up Consultation</option>
                <option value="Retinal Screening">Retinal Screening</option>
                <option value="Ophthalmology Referral">Ophthalmology Referral</option>
                <option value="Lab Testing (HbA1c/FPG)">Lab Testing (HbA1c/FPG)</option>
              </select>
            </div>
            <div>
              <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Facility</label>
              <input
                type="text"
                required
                value={aptFacility}
                onChange={(e) => setAptFacility(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
              />
            </div>
            <div>
              <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Reminder Note</label>
              <input
                type="text"
                value={aptReminder}
                onChange={(e) => setAptReminder(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !isOnline}
              className="w-full rounded-xl bg-[#0D9488] py-3 text-[15px] font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors shadow-sm"
            >
              Book Appointment
            </button>
          </form>
        </div>
      )}

      {subTab === 'continuity' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Continuity of Care &amp; Follow-up Timeline
            </h2>
            {followUps.length === 0 ? (
              <p className="text-[14px] text-slate-500">No health-worker follow-up records yet.</p>
            ) : (
              followUps.map((fu) => (
                <div key={fu.id} className="rounded-xl border border-slate-200 p-4 text-[14px] space-y-2.5 bg-slate-50/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[16px] text-slate-900">
                        {fu.healthWorkerName} · {fu.channel}
                      </span>
                      {fu.priority && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${
                            fu.priority === 'Urgent'
                              ? 'bg-rose-100 text-rose-800'
                              : fu.priority === 'Priority'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {fu.priority}
                        </span>
                      )}
                      {fu.source && (
                        <span className="rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[12px] font-medium">
                          {fu.source === 'prevent_barrier'
                            ? 'PREVENT Barrier'
                            : fu.source === 'prevent_checkpoint_missed'
                            ? 'Missed Checkpoint'
                            : fu.source.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-semibold text-[14px] ${
                        fu.status === 'Escalated' ? 'text-rose-700' : 'text-[#0F766E]'
                      }`}
                    >
                      {fu.status}
                    </span>
                  </div>

                  <div className="font-mono text-[13px] text-slate-600 tabular-nums">
                    Due: {fu.dueDate}{' '}
                    {fu.nextScreeningDate ? `· Next Retinal Screening: ${fu.nextScreeningDate}` : ''}
                  </div>
                  <p className="text-slate-700 leading-relaxed">{fu.outcomeNotes}</p>

                  {fu.structuredOutcome && (
                    <div className="inline-flex items-center gap-2 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-[13px] text-teal-800 font-medium">
                      Outcome: <span className="capitalize">{fu.structuredOutcome.replace(/_/g, ' ')}</span>
                      {fu.referralId && <span className="text-[12px] text-indigo-700">(Referral Linked: {fu.referralId})</span>}
                    </div>
                  )}

                  {fu.contactAttempts && fu.contactAttempts.length > 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                      <div className="text-[13px] font-bold text-slate-800">
                        VHN Contact Attempts ({fu.contactAttempts.length}):
                      </div>
                      <div className="space-y-1.5 divide-y divide-slate-200/60">
                        {fu.contactAttempts.map((att) => (
                          <div key={att.id} className="pt-1.5 first:pt-0 text-[13px] flex flex-wrap items-center justify-between text-slate-700 gap-2">
                            <div>
                              <span className="font-semibold text-slate-900">{att.date}</span> · {att.type} by {att.performedBy}: &quot;{att.notes}&quot;
                            </div>
                            <span className="capitalize font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                              {att.outcome}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isStaff && (
                    <div className="pt-2.5 border-t border-slate-200 space-y-2.5">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setActiveAttemptFuId(activeAttemptFuId === fu.id ? null : fu.id)}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                        >
                          {activeAttemptFuId === fu.id ? 'Cancel Attempt Form' : '+ Log Contact Attempt'}
                        </button>
                        <select
                          value={fu.status}
                          onChange={(e) =>
                            void handleQuickUpdateFollowUp(fu.id, {
                              status: e.target.value as FollowUpRecord['status'],
                            })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium"
                        >
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                          <option value="Escalated">Escalated</option>
                        </select>
                        <select
                          value={fu.structuredOutcome || 'ongoing'}
                          onChange={(e) =>
                            void handleQuickUpdateFollowUp(fu.id, {
                              structuredOutcome: e.target.value as FollowUpRecord['structuredOutcome'],
                            })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[13px] font-medium"
                        >
                          <option value="ongoing">Outcome: Ongoing</option>
                          <option value="barrier_resolved">Outcome: Barrier Resolved</option>
                          <option value="referred_to_doctor">Outcome: Refer to Doctor</option>
                          <option value="unable_to_contact">Outcome: Unable to Contact</option>
                          <option value="patient_declined">Outcome: Patient Declined</option>
                        </select>
                      </div>

                      {activeAttemptFuId === fu.id && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                          <div className="font-bold text-[14px] text-slate-800">Log VHN Contact Attempt</div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                              <label className="block text-[13px] font-semibold text-slate-700 mb-1">Date</label>
                              <input
                                type="date"
                                value={attemptDate}
                                onChange={(e) => setAttemptDate(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px]"
                              />
                            </div>
                            <div>
                              <label className="block text-[13px] font-semibold text-slate-700 mb-1">Channel</label>
                              <select
                                value={attemptType}
                                onChange={(e) => setAttemptType(e.target.value as 'Phone Call' | 'Home Visit')}
                                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] bg-white"
                              >
                                <option value="Phone Call">Phone Call</option>
                                <option value="Home Visit">Home Visit</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[13px] font-semibold text-slate-700 mb-1">Outcome</label>
                              <select
                                value={attemptOutcome}
                                onChange={(e) => setAttemptOutcome(e.target.value as typeof attemptOutcome)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-[13px] bg-white"
                              >
                                <option value="reached">Reached / Engaged</option>
                                <option value="unreachable">Unreachable / No Answer</option>
                                <option value="rescheduled">Rescheduled</option>
                                <option value="declined">Patient Declined</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-[13px] font-semibold text-slate-700 mb-1">Contact Notes</label>
                            <input
                              type="text"
                              value={attemptNotes}
                              onChange={(e) => setAttemptNotes(e.target.value)}
                              placeholder="e.g., Reviewed walking barrier, patient agreed to morning walks with family"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[14px]"
                            />
                          </div>
                          <div className="flex justify-end gap-2.5">
                            <button
                              type="button"
                              onClick={() => setActiveAttemptFuId(null)}
                              className="px-3 py-1.5 text-[13px] font-medium text-slate-600 hover:bg-slate-200/70 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={busy || !attemptNotes.trim()}
                              onClick={() => void handleLogAttempt(fu.id)}
                              className="px-4 py-1.5 text-[13px] font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors shadow-2xs"
                            >
                              {busy ? 'Saving...' : 'Save Attempt'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
              Assign Health-Worker Follow-Up
            </h3>
            {!isStaff ? (
              <p className="mt-2 text-[14px] text-slate-500">
                Follow-up tasks are assigned by Doctors and Health Programme Administrators.
              </p>
            ) : (
              <form onSubmit={handleCreateFollowUp} className="mt-5 space-y-4 text-[14px]">
                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Health Worker Owner</label>
                  <input
                    type="text"
                    required
                    value={fuWorker}
                    onChange={(e) => setFuWorker(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Due Date</label>
                    <input
                      type="date"
                      required
                      value={fuDue}
                      onChange={(e) => setFuDue(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Channel</label>
                    <select
                      value={fuChannel}
                      onChange={(e) => setFuChannel(e.target.value as FollowUpRecord['channel'])}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    >
                      <option value="Phone Call">Phone Call</option>
                      <option value="In-Person PHC">In-Person PHC</option>
                      <option value="Home Visit">Home Visit</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Status</label>
                    <select
                      value={fuStatus}
                      onChange={(e) => setFuStatus(e.target.value as FollowUpRecord['status'])}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="Completed">Completed</option>
                      <option value="Escalated">Escalated</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Next Retinal Screening</label>
                    <input
                      type="date"
                      value={fuNextScreen}
                      onChange={(e) => setFuNextScreen(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Follow-Up Notes</label>
                  <textarea
                    required
                    rows={3}
                    value={fuNotes}
                    onChange={(e) => setFuNotes(e.target.value)}
                    placeholder="Record outreach instructions, missed-visit escalation, or specialist feedback..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || !isOnline}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B2540] py-3 text-[15px] font-semibold text-white hover:bg-[#113556] disabled:opacity-50 transition-colors shadow-sm"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Save Continuity Follow-Up
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {subTab === 'vhn_field_mode' && (
        <div className="space-y-6">
          {/* VHN / ASHA Operational Header */}
          <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0F766E] text-white shadow-sm">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-teal-100 px-3 py-0.5 text-[12px] font-bold text-teal-900 uppercase tracking-wide">
                      Rural Worker Deployment Layer
                    </span>
                    <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-[12px] font-bold text-emerald-800">
                      ASHA / VHN Field Mode
                    </span>
                  </div>
                  <h2 className="mt-1.5 font-display text-[20px] font-bold text-[#0B2540]">
                    Village Door-to-Door Screening &amp; Beneficiary Coordination
                  </h2>
                  <p className="text-[14px] text-slate-700 leading-relaxed mt-0.5">
                    Operate in remote hamlets without relying on patient smartphones. Enroll beneficiaries, screen Indian Diabetes Risk Score (IDRS), and coordinate Mobile Screening Van transport.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-teal-200 bg-white px-4 py-3 text-[14px] text-slate-700 space-y-1 shadow-2xs">
                <div className="font-semibold text-teal-900">Assigned Health Worker: Anitha K (VHN)</div>
                <div className="text-[13px] text-slate-600">Sector: Melur Sub-Centre · Health District: Madurai Rural</div>
                <div className="font-mono text-[12px] text-emerald-700 font-semibold">● Offline Storage &amp; Queue Active</div>
              </div>
            </div>

            {/* Village & Hamlet Selector */}
            <div className="mt-5 pt-4 border-t border-teal-200/70 grid grid-cols-1 sm:grid-cols-3 gap-4 text-[14px]">
              <div>
                <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Health District</label>
                <select
                  value={vhnDistrict}
                  onChange={(e) => setVhnDistrict(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] font-medium focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                >
                  <option value="Madurai">Madurai District</option>
                  <option value="Sivaganga">Sivaganga District</option>
                  <option value="Theni">Theni District</option>
                  <option value="Virudhunagar">Virudhunagar District</option>
                </select>
              </div>
              <div>
                <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Village / Sub-Centre</label>
                <select
                  value={vhnVillage}
                  onChange={(e) => setVhnVillage(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] font-medium focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                >
                  <option value="Keeladi">Keeladi Sub-Centre</option>
                  <option value="Melur">Melur Rural PHC</option>
                  <option value="Vadipatti">Vadipatti Sub-Centre</option>
                  <option value="Thirumangalam">Thirumangalam Block</option>
                  <option value="Usilampatti">Usilampatti Sector</option>
                  <option value="Alanganallur">Alanganallur Sub-Centre</option>
                </select>
              </div>
              <div>
                <label className="block text-[14px] font-semibold text-slate-800 mb-1.5">Hamlet / Street</label>
                <input
                  type="text"
                  value={vhnHamlet}
                  onChange={(e) => setVhnHamlet(e.target.value)}
                  placeholder="e.g. East Colony, North St"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] font-medium focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Action Navigation Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2.5">
            {[
              { id: 'register', label: '1. Doorstep Beneficiary Enrollment', icon: Users },
              { id: 'idrs_screen', label: '2. IDRS & Field Vitals Screen', icon: HeartPulse },
              { id: 'mobile_van', label: '3. Mobile Screening Van Scheduler', icon: Truck },
              { id: 'doorstep_continuity', label: '4. Doorstep Continuity & Dropout Prevention', icon: MapPin },
            ].map((sec) => {
              const Icon = sec.icon;
              const active = vhnSection === sec.id;
              return (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setVhnSection(sec.id as typeof vhnSection)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] sm:text-[15px] font-bold transition-all ${
                    active
                      ? 'bg-[#0F766E] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {sec.label}
                </button>
              );
            })}
          </div>

          {/* Section 1: Doorstep Beneficiary Enrollment */}
          {vhnSection === 'register' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
              <div>
                <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
                  Doorstep Beneficiary Registration (Rural Literacy &amp; No Smartphone Required)
                </h3>
                <p className="text-[14px] text-slate-600 mt-1 leading-relaxed">
                  Enrolls elderly or rural citizens who do not possess smartphones. System automatically generates a secure Medical Record Number (MRN) and queues record for offline sync.
                </p>
              </div>

              <form onSubmit={handleVhnRegisterBeneficiary} className="space-y-4 text-[14px]">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Beneficiary Full Name *</label>
                    <input
                      type="text"
                      required
                      value={vhnRegName}
                      onChange={(e) => setVhnRegName(e.target.value)}
                      placeholder="e.g. Marimuthu M"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Age *</label>
                    <input
                      type="number"
                      required
                      min={18}
                      max={110}
                      value={vhnRegAge}
                      onChange={(e) => setVhnRegAge(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Sex *</label>
                    <select
                      value={vhnRegSex}
                      onChange={(e) => setVhnRegSex(e.target.value as typeof vhnRegSex)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Phone / Family Contact</label>
                    <input
                      type="text"
                      value={vhnRegPhone}
                      onChange={(e) => setVhnRegPhone(e.target.value)}
                      placeholder="e.g. 98421XXXXX or Guardian"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Known Diabetes Status</label>
                    <select
                      value={vhnRegStatus}
                      onChange={(e) => setVhnRegStatus(e.target.value as typeof vhnRegStatus)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    >
                      <option value="at_risk">At Risk / Undiagnosed (Lifestyle Screen Needed)</option>
                      <option value="prediabetes_lab">Prediabetes (Previous Clinic or Lab Record)</option>
                      <option value="diagnosed_t2d">Diagnosed Type 2 Diabetes (Eligible for Retinal Screening)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Location Details (Auto-Filled)</label>
                    <input
                      type="text"
                      readOnly
                      value={`${vhnDistrict} District · ${vhnVillage} · ${vhnHamlet}`}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[15px] text-slate-700 font-medium"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-700 space-y-1">
                  <div className="font-bold text-slate-900 text-[14px]">Verbal Informed Consent Acknowledged</div>
                  <div>ASHA/VHN worker explained the purpose of preventative screening and retinal photography. Beneficiary consented to community health record creation.</div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#115E59] disabled:opacity-50 transition-colors shadow-sm"
                >
                  <PlusCircle className="h-5 w-5" />
                  Enroll Rural Beneficiary &amp; Queue for Screening
                </button>
              </form>
            </div>
          )}

          {/* Section 2: IDRS & Field Vitals Rapid Screen */}
          {vhnSection === 'idrs_screen' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
              <div>
                <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
                  Doorstep Indian Diabetes Risk Score (IDRS) &amp; Field Vitals
                </h3>
                <p className="text-[14px] text-slate-600 mt-1 leading-relaxed">
                  Standardized 4-item questionnaire developed by the Madras Diabetes Research Foundation (MDRF) for rapid field detection of undiagnosed type 2 diabetes.
                </p>
              </div>

              {/* Live IDRS Score Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`rounded-2xl border p-5 text-center shadow-2xs ${
                  idrsTotalScore >= 60
                    ? 'border-rose-300 bg-rose-50 text-rose-950'
                    : idrsTotalScore >= 30
                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950'
                }`}>
                  <div className="text-[13px] font-bold uppercase tracking-wider">Calculated IDRS Score</div>
                  <div className="font-display text-[36px] font-extrabold mt-1 leading-tight">{idrsTotalScore} / 100</div>
                  <div className="text-[14px] font-bold mt-1">
                    {idrsTotalScore >= 60 ? 'HIGH RISK (Score ≥ 60)' : idrsTotalScore >= 30 ? 'MODERATE RISK (30-50)' : 'LOW RISK (< 30)'}
                  </div>
                </div>

                <div className="sm:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-[14px] space-y-2.5">
                  <div className="font-bold text-[15px] text-slate-900">Clinical Triage Recommendation:</div>
                  {idrsTotalScore >= 60 ? (
                    <div className="text-rose-900 font-medium leading-relaxed">
                      ● <strong>High Risk Category:</strong> Immediate priority for confirmatory fasting blood glucose / HbA1c test and non-mydriatic retinal photography via the Mobile Retinal Van Camp.
                    </div>
                  ) : idrsTotalScore >= 30 ? (
                    <div className="text-amber-900 font-medium leading-relaxed">
                      ● <strong>Moderate Risk Category:</strong> Recommend diet and physical activity counseling; schedule follow-up blood glucose check at next village sub-centre visit.
                    </div>
                  ) : (
                    <div className="text-emerald-900 font-medium leading-relaxed">
                      ● <strong>Low Risk Category:</strong> Encourage continued traditional balanced diet and routine annual re-screening.
                    </div>
                  )}
                  <div className="text-slate-600 text-[13px] pt-1">
                    Evaluated for: <strong>{patient ? patient.name : 'Selected Beneficiary'}</strong> ({patient?.age}y {patient?.sex})
                  </div>
                </div>
              </div>

              {/* IDRS 4 Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[14px]">
                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/40">
                  <label className="font-bold text-[15px] text-slate-900 block">1. Age Score</label>
                  <div className="space-y-2 text-slate-800">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_age" checked={idrsAge === 0} onChange={() => setIdrsAge(0)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>&lt; 35 years (0 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_age" checked={idrsAge === 20} onChange={() => setIdrsAge(20)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>35–49 years (20 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_age" checked={idrsAge === 30} onChange={() => setIdrsAge(30)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>≥ 50 years (30 points)</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/40">
                  <label className="font-bold text-[15px] text-slate-900 block">2. Abdominal Obesity (Waist Circumference)</label>
                  <div className="space-y-2 text-slate-800">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_waist" checked={idrsWaist === 0} onChange={() => setIdrsWaist(0)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>Female &lt; 80 cm / Male &lt; 85 cm (0 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_waist" checked={idrsWaist === 10} onChange={() => setIdrsWaist(10)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>Female 80–89 cm / Male 85–89 cm (10 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_waist" checked={idrsWaist === 20} onChange={() => setIdrsWaist(20)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>Female ≥ 90 cm / Male ≥ 90 cm (20 points)</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/40">
                  <label className="font-bold text-[15px] text-slate-900 block">3. Physical Activity Level</label>
                  <div className="space-y-2 text-slate-800">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_act" checked={idrsActivity === 0} onChange={() => setIdrsActivity(0)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>Vigorous / Agriculture Field Work (0 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_act" checked={idrsActivity === 10} onChange={() => setIdrsActivity(10)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>Moderate / Household Manual Labor (10 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_act" checked={idrsActivity === 20} onChange={() => setIdrsActivity(20)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>Sedentary / Little Activity (20 points)</span>
                    </label>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/40">
                  <label className="font-bold text-[15px] text-slate-900 block">4. Family History of Diabetes</label>
                  <div className="space-y-2 text-slate-800">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_fam" checked={idrsFamily === 0} onChange={() => setIdrsFamily(0)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>No family history (0 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_fam" checked={idrsFamily === 10} onChange={() => setIdrsFamily(10)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>One parent diabetic (10 points)</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="radio" name="idrs_fam" checked={idrsFamily === 20} onChange={() => setIdrsFamily(20)} className="h-4 w-4 accent-[#0F766E]" />
                      <span>Both parents or siblings diabetic (20 points)</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Field Vitals Strip */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="font-bold text-slate-900 text-[15px]">Optional Field Vitals (Point-of-Care Glucometer &amp; BP Cuff)</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-[14px]">
                  <div>
                    <label className="block text-[14px] font-semibold text-slate-700 mb-1.5">Random Blood Sugar (mg/dL)</label>
                    <input
                      type="number"
                      value={fieldGlucose}
                      onChange={(e) => setFieldGlucose(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 148"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-semibold text-slate-700 mb-1.5">Systolic BP (mmHg)</label>
                    <input
                      type="number"
                      value={fieldSystolic}
                      onChange={(e) => setFieldSystolic(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 130"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-semibold text-slate-700 mb-1.5">Diastolic BP (mmHg)</label>
                    <input
                      type="number"
                      value={fieldDiastolic}
                      onChange={(e) => setFieldDiastolic(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 84"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMsg({ type: 'success', text: `Field IDRS assessment (${idrsTotalScore}/100) saved to patient ${patient?.name || ''} chart.` });
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0F766E] px-5 py-3 text-[15px] font-semibold text-white hover:bg-[#115E59] transition-colors shadow-sm"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Save IDRS Field Assessment
                </button>
                {idrsTotalScore >= 60 && (
                  <button
                    type="button"
                    onClick={() => setVhnSection('mobile_van')}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-[15px] font-semibold text-white hover:bg-rose-700 transition-colors shadow-sm"
                  >
                    <Truck className="h-5 w-5" />
                    High Risk: Schedule Mobile Screening Van Camp →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Section 3: Mobile Screening Van Scheduler */}
          {vhnSection === 'mobile_van' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 text-[14px] shadow-sm">
              <div>
                <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
                  Mobile Retinal Screening Van Camp Scheduler
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Coordinates mobile fundus camera vans equipped with portable non-mydriatic cameras and AI screening assist. Direct booking for rural beneficiaries with assisted transport.
                </p>
              </div>

              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 space-y-3">
                <div className="font-bold text-[15px] text-indigo-950">Upcoming Mobile Retinal Screening Van Schedule</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="rounded-xl bg-white p-3.5 border border-indigo-100 shadow-2xs">
                    <div className="font-bold text-[15px] text-slate-800">Keeladi Panchayat Hall</div>
                    <div className="text-indigo-700 font-mono text-[13px] mt-0.5">2026-11-28 · 09:00 AM - 04:00 PM</div>
                    <div className="text-[12px] text-slate-500 mt-1">Van Unit: Madurai North Mobile-01</div>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 border border-indigo-100 shadow-2xs">
                    <div className="font-bold text-[15px] text-slate-800">Melur Community Center</div>
                    <div className="text-indigo-700 font-mono text-[13px] mt-0.5">2026-12-02 · 09:30 AM - 03:30 PM</div>
                    <div className="text-[12px] text-slate-500 mt-1">Van Unit: Madurai East Mobile-02</div>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 border border-indigo-100 shadow-2xs">
                    <div className="font-bold text-[15px] text-slate-800">Vadipatti Sub-Centre</div>
                    <div className="text-indigo-700 font-mono text-[13px] mt-0.5">2026-12-06 · 10:00 AM - 04:00 PM</div>
                    <div className="text-[12px] text-slate-500 mt-1">Van Unit: Madurai North Mobile-01</div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleBookMobileVan} className="rounded-xl border border-slate-200 p-5 space-y-4 bg-slate-50/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Target Camp Venue</label>
                    <select
                      value={vanVenue}
                      onChange={(e) => setVanVenue(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    >
                      <option value="Keeladi Panchayat Community Center">Keeladi Panchayat Community Center (Nov 28)</option>
                      <option value="Melur Community Center">Melur Community Center (Dec 02)</option>
                      <option value="Vadipatti Sub-Centre Ground">Vadipatti Sub-Centre Ground (Dec 06)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[15px] font-semibold text-slate-800 mb-1.5">Camp Screening Date</label>
                    <input
                      type="date"
                      value={vanDate}
                      onChange={(e) => setVanDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] font-mono focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="transport-assist"
                    checked={vanTransportAssist}
                    onChange={(e) => setVanTransportAssist(e.target.checked)}
                    className="mt-1 rounded text-teal-700 h-4 w-4"
                  />
                  <label htmlFor="transport-assist" className="cursor-pointer">
                    <span className="font-bold text-[15px] text-amber-950">Arrange Rural Transport Assistance (Auto / Van Pickup)</span>
                    <span className="block text-[13px] text-amber-900 mt-0.5 leading-relaxed">
                      Beneficiary is elderly, resides &gt; 2 km from camp venue, or requires family escort. ASHA worker will facilitate round-trip transit.
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0F766E] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#115E59] transition-colors shadow-sm"
                >
                  <Truck className="h-5 w-5" />
                  Confirm Mobile Retinal Screening Van Appointment
                </button>
              </form>
            </div>
          )}

          {/* Section 4: Doorstep Continuity & Dropout Prevention */}
          {vhnSection === 'doorstep_continuity' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 text-[14px] shadow-sm">
              <div>
                <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
                  Doorstep Outreach &amp; Appointment Dropout Prevention
                </h3>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Track patients in {vhnVillage} who have scheduled specialist appointments or outstanding follow-ups. Conduct door-to-door counseling visits to prevent referral dropouts.
                </p>
              </div>

              {followUps.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                  No pending continuity follow-ups recorded for {patient?.name || 'this beneficiary'}.
                </div>
              ) : (
                <div className="space-y-4">
                  {followUps.map((fu) => (
                    <div key={fu.id} className="rounded-xl border border-slate-200 p-5 space-y-3.5 bg-slate-50/40">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-[16px]">Follow-Up #{fu.id.slice(-6)} · {patient?.name}</div>
                          <div className="text-slate-600 text-[13px] mt-0.5">
                            Due: {fu.dueDate} · Channel: {fu.channel} · Worker: {fu.healthWorkerName}
                          </div>
                        </div>
                        <span className={`inline-flex rounded-full px-3 py-1 text-[12px] font-bold ${
                          fu.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {fu.status}
                        </span>
                      </div>

                      <div className="text-slate-800 bg-white rounded-xl p-3.5 border border-slate-200 leading-relaxed">
                        {fu.outcomeNotes || 'No previous notes logged.'}
                      </div>

                      {/* Log Home Visit Form */}
                      <div className="pt-3 border-t border-slate-200 space-y-2.5">
                        <label className="font-bold text-slate-800 text-[14px] block">Record Doorstep Visit Outcome:</label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={vhnVisitNotes}
                            onChange={(e) => setVhnVisitNotes(e.target.value)}
                            placeholder="Doorstep visit notes..."
                            className="sm:col-span-2 rounded-xl border border-slate-300 px-3.5 py-2 text-[14px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                          />
                          <select
                            value={vhnVisitOutcome}
                            onChange={(e) => setVhnVisitOutcome(e.target.value as typeof vhnVisitOutcome)}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-[14px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
                          >
                            <option value="reached">Reached &amp; Confirmed Attendance</option>
                            <option value="rescheduled">Rescheduled Date</option>
                            <option value="unreachable">Door Closed / Unreachable</option>
                            <option value="declined">Declined Referral</option>
                          </select>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleLogDoorstepVisit(fu.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#0B2540] px-4 py-2.5 font-semibold text-white hover:bg-[#113556] transition-colors shadow-2xs"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Log Doorstep Counseling Visit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
