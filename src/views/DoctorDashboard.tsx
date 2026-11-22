import React from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  Send,
  Stethoscope,
  Users,
} from 'lucide-react';
import type { AppNavView, BootstrapPayload } from '../types/domain';
import { FundusVisualizer } from '../components/FundusVisualizer';

interface DoctorDashboardProps {
  data: BootstrapPayload;
  searchQuery: string;
  onNavigate: (view: AppNavView, selectedPatientId?: string) => void;
}

export const DoctorDashboard: React.FC<DoctorDashboardProps> = ({
  data,
  searchQuery,
  onNavigate,
}) => {
  const pendingScreenings = data.screenings.filter(
    (s) => s.humanReviewStatus === 'pending_review' || s.humanReviewStatus === 'recapture_requested'
  );
  const openReferrals = data.referrals.filter((r) => r.status === 'Pending' || r.status === 'Accepted');
  const missedAppointments = data.appointments.filter((a) => a.status === 'Missed');
  const activeEscalations = data.followUps.filter((f) => f.status === 'Escalated');

  const q = searchQuery.trim().toLowerCase();
  const filteredPatients = data.patients.filter(
    (p) =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q) ||
      p.district.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      {/* Clinician Header Banner */}
      <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-[#0B2540] to-[#0F4C5C] p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-teal-200">
              Clinician &amp; Healthcare Worker Workspace · {data.user.facility || 'District Care Network'}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight">
              Welcome, {data.user.name}
            </h1>
            <p className="mt-1 text-sm text-slate-200 max-w-2xl">
              Review AI-assisted retinal screenings, validate Grad-CAM explanations, record laboratory HbA1c/FPG values, and coordinate ophthalmology referrals.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('protect')}
              className="rounded-xl bg-[#0D9488] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#14B8A6] transition-colors whitespace-nowrap"
            >
              Open Clinical Review Queue ({pendingScreenings.length})
            </button>
            <button
              type="button"
              onClick={() => onNavigate('detect')}
              className="rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              New Retinal Screening
            </button>
          </div>
        </div>
      </section>

      {/* 4 KPI Summary Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Assigned Cohort</span>
            <Users className="h-4 w-4 text-[#0D9488]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0B2540] tabular-nums">
            {data.patients.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {data.patients.filter((p) => p.diabetesStatus === 'diagnosed_t2d').length} eligible for retinal screening
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Unreviewed Screenings</span>
            <Eye className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-rose-700 tabular-nums">
            {pendingScreenings.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Mandatory physician confirmation required
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Active Referrals</span>
            <Send className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#0B2540] tabular-nums">
            {openReferrals.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {data.referrals.filter((r) => r.status === 'Completed').length} completed with specialist feedback
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold">Missed / Escalated</span>
            <CalendarClock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-amber-700 tabular-nums">
            {missedAppointments.length + activeEscalations.length}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {missedAppointments.length} missed appointments · {activeEscalations.length} VHN escalations
          </div>
        </div>
      </section>

      {/* Pending Clinical Review Cards */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#0B2540]">
                Retinal Screenings Requiring Doctor Review
              </h2>
              <p className="text-xs text-slate-500">
                AI outputs are screening assistance only — confirm, modify, or request recapture.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('protect')}
              className="text-xs font-semibold text-[#0D9488] hover:underline"
            >
              Open Protect →
            </button>
          </div>

          {pendingScreenings.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-6 text-center">
              <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-600" />
              <div className="mt-2 text-sm font-semibold text-slate-900">
                All retinal screenings reviewed
              </div>
              <p className="mt-1 text-xs text-slate-600">
                No unreviewed AI-assisted findings remain in your queue.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingScreenings.map((scr) => {
                const pat = data.patients.find((p) => p.id === scr.patientId);
                return (
                  <div
                    key={scr.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200 p-3.5 hover:bg-slate-50/80 transition-colors"
                  >
                    <FundusVisualizer
                      preset={scr.imagePreset}
                      imageDataUrl={scr.imageDataUrl}
                      stage="gradcam"
                      hotspots={scr.gradCam.hotspots}
                      size={112}
                      className="h-24 w-24 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-900 text-sm">
                          {pat?.name || scr.patientId}
                        </span>
                        <span>·</span>
                        <span className="font-mono">{pat?.mrn}</span>
                        <span>·</span>
                        <span>{scr.eye}</span>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-rose-700">
                        {scr.modelPrediction.gradeLabel}
                      </div>
                      <p className="mt-1 text-xs text-slate-600 line-clamp-2">{scr.summaryText}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate('protect', scr.patientId)}
                      className="shrink-0 rounded-lg bg-[#0B2540] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#113556]"
                    >
                      Review Case
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Missed Appointments & Escalations */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-[#0B2540]">
              Follow-up Escalations &amp; Missed Visits
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('appointments')}
              className="text-xs font-semibold text-[#0D9488] hover:underline"
            >
              Manage →
            </button>
          </div>
          <div className="space-y-3">
            {missedAppointments.map((apt) => {
              const pat = data.patients.find((p) => p.id === apt.patientId);
              return (
                <div
                  key={apt.id}
                  className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Missed: {apt.title}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-700">
                    {pat?.name} ({pat?.mrn}) · Scheduled {apt.scheduledDate}
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('protect', apt.patientId)}
                    className="mt-2 text-xs font-semibold text-[#0B2540] hover:underline"
                  >
                    Open patient continuity record →
                  </button>
                </div>
              );
            })}

            {data.interventions
              .filter((i) => i.status !== 'resolved')
              .slice(0, 3)
              .map((intv) => {
                const pat = data.patients.find((p) => p.id === intv.patientId);
                return (
                  <div
                    key={intv.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                  >
                    <div className="text-xs font-semibold text-slate-900">
                      Adaptive Ladder Step {intv.ladderStep} · {pat?.name}
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{intv.recommendedMessage}</p>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {/* Shared Patient Cohort Table */}
      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#0B2540]">
              Shared Patient Registry (Prevent · Detect · Protect)
            </h2>
            <p className="text-xs text-slate-500">
              All three pillars read and write to unified longitudinal patient records.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Showing {filteredPatients.length} of {data.patients.length} patient(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3 font-semibold">Patient / MRN</th>
                <th className="px-4 py-3 font-semibold">Clinical Status</th>
                <th className="px-4 py-3 font-semibold">Latest Risk Score</th>
                <th className="px-4 py-3 font-semibold">Latest Lab (HbA1c / FPG)</th>
                <th className="px-4 py-3 font-semibold">Retinal Review</th>
                <th className="px-5 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((pat) => {
                const asm = data.assessments.find((a) => a.patientId === pat.id);
                const lab = data.labs.find((l) => l.patientId === pat.id);
                const scr = data.screenings.find((s) => s.patientId === pat.id);
                return (
                  <tr key={pat.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{pat.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">
                        {pat.mrn} · {pat.age}y {pat.sex} · {pat.district}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {pat.diabetesStatus === 'diagnosed_t2d'
                        ? 'Diagnosed Type 2 Diabetes'
                        : pat.diabetesStatus === 'prediabetes_lab'
                        ? 'Prediabetes (Lab Confirmed)'
                        : 'Lifestyle Prevention'}
                    </td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-slate-800">
                      {asm ? `${asm.experimentalScore}/100 (${asm.riskCategory})` : 'Not assessed'}
                    </td>
                    <td className="px-4 py-3.5 font-mono tabular-nums text-slate-800">
                      {lab
                        ? `${lab.hba1cPercent ?? '—'}% / ${lab.fastingGlucoseMgDl ?? '—'} mg/dL`
                        : 'Pending lab'}
                    </td>
                    <td className="px-4 py-3.5">
                      {scr ? (
                        <span
                          className={`font-semibold ${
                            scr.humanReviewStatus === 'confirmed'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {scr.humanReviewStatus.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-400">Not screened</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => onNavigate('protect', pat.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0B2540] hover:bg-slate-100"
                      >
                        <Stethoscope className="h-3.5 w-3.5 text-[#0D9488]" />
                        Open Chart
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
