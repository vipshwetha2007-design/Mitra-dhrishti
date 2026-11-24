import React, { useState } from 'react';
import { Download, Eye, FileText, FlaskConical, Printer } from 'lucide-react';
import type { BootstrapPayload } from '../types/domain';
import { FundusVisualizer } from '../components/FundusVisualizer';

interface ReportsViewProps {
  data: BootstrapPayload;
  searchQuery: string;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ data, searchQuery }) => {
  const [filter, setFilter] = useState<'all' | 'retinal' | 'lifestyle' | 'labs'>('all');
  const q = searchQuery.trim().toLowerCase();

  const patientMap = new Map(data.patients.map((p) => [p.id, p]));

  const filteredScreenings = data.screenings.filter((s) => {
    const pat = patientMap.get(s.patientId);
    return (
      !q ||
      s.modelPrediction.gradeLabel.toLowerCase().includes(q) ||
      (pat?.name.toLowerCase().includes(q) ?? false) ||
      (pat?.mrn.toLowerCase().includes(q) ?? false)
    );
  });

  const filteredAssessments = data.assessments.filter((asm) => {
    const pat = patientMap.get(asm.patientId);
    return (
      !q ||
      asm.riskCategory.toLowerCase().includes(q) ||
      asm.topModifiableFactors.some((f) => f.toLowerCase().includes(q)) ||
      (pat?.name.toLowerCase().includes(q) ?? false) ||
      (pat?.mrn.toLowerCase().includes(q) ?? false)
    );
  });

  const filteredLabs = data.labs.filter((lab) => {
    const pat = patientMap.get(lab.patientId);
    return (
      !q ||
      (lab.guidelineInterpretation?.toLowerCase().includes(q) ?? false) ||
      (pat?.name.toLowerCase().includes(q) ?? false) ||
      (pat?.mrn.toLowerCase().includes(q) ?? false)
    );
  });

  const exportSummaryJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      disclaimer: data.meta.clinicalDisclaimer,
      patients: data.patients.map((p) => ({ mrn: p.mrn, name: p.name, district: p.district })),
      assessments: data.assessments,
      labs: data.labs,
      screenings: data.screenings.map(({ imageDataUrl: _omit, ...rest }) => rest),
      doctorReviews: data.doctorReviews,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mitra-drishti-clinical-reports-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#0F766E]">Unified Longitudinal Health Records</p>
          <h1 className="font-display text-2xl font-bold text-[#0B2540]">
            Annotated Screening &amp; Prevention Reports
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
          </button>
          <button
            type="button"
            onClick={exportSummaryJson}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#0B2540] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#113556]"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-200/70 p-1 w-fit">
        {[
          { id: 'all', label: 'All Reports' },
          { id: 'retinal', label: `Retinal Screenings (${filteredScreenings.length})` },
          { id: 'lifestyle', label: `Lifestyle Assessments (${filteredAssessments.length})` },
          { id: 'labs', label: `Laboratory Results (${filteredLabs.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filter === tab.id ? 'bg-white text-[#0B2540] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Annotated Retinal Screening Reports */}
      {(filter === 'all' || filter === 'retinal') && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#0B2540] flex items-center gap-2">
            <Eye className="h-4 w-4 text-[#12598C]" />
            Step 7 Annotated Retinal Screening Reports
          </h2>
          {filteredScreenings.length > 0 ? (
            filteredScreenings.map((scr) => {
              const pat = patientMap.get(scr.patientId);
              const rev = data.doctorReviews.find((r) => r.screeningId === scr.id);
              return (
                <article
                  key={scr.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start"
                >
                  <div className="lg:col-span-4 grid grid-cols-2 gap-2.5">
                    <FundusVisualizer
                      preset={scr.imagePreset}
                      imageDataUrl={scr.imageDataUrl}
                      stage="raw"
                      size={180}
                      className="aspect-square w-full"
                      label={scr.eye}
                    />
                    <FundusVisualizer
                      preset={scr.imagePreset}
                      imageDataUrl={scr.imageDataUrl}
                      stage="gradcam"
                      hotspots={scr.gradCam.hotspots}
                      size={180}
                      className="aspect-square w-full"
                      label="Grad-CAM"
                    />
                  </div>
                  <div className="lg:col-span-8 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-display text-sm font-bold text-[#0B2540]">
                        {pat?.name || scr.patientId} ({pat?.mrn}) · {scr.eye}
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(scr.capturedAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-800 font-semibold">
                      AI Assist Output: {scr.modelPrediction.gradeLabel}
                    </div>
                    <div className="font-mono text-[11px] text-slate-600 tabular-nums">
                      Quality: {scr.quality.gradable ? 'Gradable' : 'Ungradable'} (Sharpness {scr.quality.sharpnessScore}/100) ·
                      Confidence: {Math.round(scr.modelPrediction.confidence * 100)}% ·
                      Human Review: <strong>{scr.humanReviewStatus}</strong>
                    </div>
                    <p className="text-slate-600">{scr.summaryText}</p>
                    {rev && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-slate-800">
                        <strong>Clinician Review ({rev.doctorName}):</strong> {rev.clinicianGrade} · Triage:{' '}
                        <strong>{rev.triageCategory}</strong>. {rev.clinicalNotes}
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500">
                      Clinical boundary: AI retinal output is screening assistance only and requires authorised clinician interpretation.
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              <Eye className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No retinal screening reports found</p>
              <p className="text-slate-400 mt-1">
                {q
                  ? `No retinal screenings match the search query "${q}".`
                  : 'No retinal screening examinations recorded yet.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Lifestyle Risk Assessment Reports */}
      {(filter === 'all' || filter === 'lifestyle') && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#0B2540] flex items-center gap-2">
            <FileText className="h-4 w-4 text-[#0D9488]" />
            Lifestyle Risk Assessment Reports (Experimental)
          </h2>
          {filteredAssessments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredAssessments.map((asm) => {
                const pat = patientMap.get(asm.patientId);
                return (
                  <div key={asm.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B2540]">
                        {pat?.name || asm.patientId} ({pat?.mrn})
                      </span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(asm.assessedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="font-mono text-sm font-bold text-[#0F766E] tabular-nums">
                      Score: {asm.experimentalScore}/100 ({asm.riskCategory} Risk Tier)
                    </div>
                    <div className="text-slate-600">
                      Top Modifiable Drivers: <strong>{asm.topModifiableFactors.join(', ')}</strong>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{asm.explanation}</p>
                    <div className="text-[11px] text-slate-500">
                      {asm.scoringModelLabel} · {asm.recordedOffline ? 'Captured Offline & Synced' : 'Online Capture'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              <FileText className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No lifestyle assessment reports found</p>
              <p className="text-slate-400 mt-1">
                {q
                  ? `No assessments match the search query "${q}".`
                  : 'No lifestyle questionnaires completed yet.'}
              </p>
            </div>
          )}
        </section>
      )}

      {/* Laboratory Reports */}
      {(filter === 'all' || filter === 'labs') && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-bold text-[#0B2540] flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-indigo-700" />
            Clinician-Recorded Laboratory Reports (HbA1c &amp; FPG)
          </h2>
          {filteredLabs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredLabs.map((lab) => {
                const pat = patientMap.get(lab.patientId);
                return (
                  <div key={lab.id} className="rounded-2xl border border-slate-200 bg-white p-5 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B2540]">{pat?.name || lab.patientId}</span>
                      <span className="font-mono text-[11px] text-slate-500">{lab.testedAt.slice(0, 10)}</span>
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      HbA1c: {lab.hba1cPercent ?? '—'}% · Fasting Glucose: {lab.fastingGlucoseMgDl ?? '—'} mg/dL
                    </div>
                    <p className="text-slate-700">{lab.guidelineInterpretation}</p>
                    <div className="text-[11px] text-slate-500">Recorded by {lab.recordedByName}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
              <FlaskConical className="mx-auto h-8 w-8 text-slate-300 mb-2" />
              <p className="font-semibold text-slate-700">No laboratory reports found</p>
              <p className="text-slate-400 mt-1">
                {q
                  ? `No lab results match the search query "${q}".`
                  : 'No laboratory tests (HbA1c/FPG) recorded yet.'}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
