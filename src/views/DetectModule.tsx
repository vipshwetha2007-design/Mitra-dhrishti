import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  FileCheck2,
  Layers,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import type { BootstrapPayload, RetinalScreening } from '../types/domain';
import { FundusVisualizer } from '../components/FundusVisualizer';
import {
  analyzeRetinalCanvasPixels,
  renderSyntheticFundusToCanvas,
  type PipelineAnalysisOutput,
  type RetinalPresetKey,
} from '../utils/retinalPipeline';

interface DetectModuleProps {
  data: BootstrapPayload;
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  isOnline: boolean;
  onSubmitScreening: (
    payload: Omit<RetinalScreening, 'id' | 'capturedAt' | 'humanReviewStatus' | 'summaryText'>
  ) => Promise<void>;
  onNavigateProtect: () => void;
}

const SEVEN_STEPS = [
  { num: 1, title: 'Image Quality Assessment', stage: 'raw' as const },
  { num: 2, title: 'Enhancement & CLAHE Preprocessing', stage: 'preprocessed' as const },
  { num: 3, title: 'Anatomical Structure Detection', stage: 'anatomy' as const },
  { num: 4, title: 'Lesion Detection (Illustrative)', stage: 'lesions' as const },
  { num: 5, title: 'CNN ICDR 5-Class DR Grading', stage: 'raw' as const },
  { num: 6, title: 'Grad-CAM Explainability', stage: 'gradcam' as const },
  { num: 7, title: 'Annotated Report Generation', stage: 'gradcam' as const },
];

const DATASET_SPECS = [
  {
    name: 'APTOS 2019 Blindness Detection',
    role: 'Primary DR grading experiments (5-class ICDR 0–4)',
    splitRule: 'Stratified split with duplicate/near-duplicate hash check; never mixed into external test fold.',
    metrics: 'Sensitivity, Specificity, Quadratic Weighted Kappa, Macro F1, ROC-AUC',
    status: 'Loader & validation interface defined (no weights fabricated)',
  },
  {
    name: 'IDRiD (Indian Diabetic Retinopathy Image Dataset)',
    role: 'Indian fundus grading + pixel-level lesion segmentation (EX, HE, SE, MA)',
    splitRule: 'Strict official train/test partition preserving Indian clinical imaging characteristics.',
    metrics: 'AUC-PR for Hard Exudates & Haemorrhages; Microaneurysm experimental benchmark',
    status: 'Lesion mask & Indian calibration interface ready',
  },
  {
    name: 'DRIVE (Digital Retinal Images for Vessel Extraction)',
    role: 'Retinal vessel segmentation & anatomical landmark verification',
    splitRule: 'Used exclusively for Step 3 vessel/optic-disc anatomy — NEVER interchanged with DR grading labels.',
    metrics: 'Vessel Dice / IoU, Sensitivity, Specificity',
    status: 'Anatomy pipeline specification documented',
  },
  {
    name: 'Messidor-2',
    role: 'External validation cohort (held-out out-of-distribution generalization)',
    splitRule: 'Zero training exposure; strict patient-level eye pairing to prevent leakage.',
    metrics: 'Referable DR (≥ Grade 2) Sensitivity, Specificity, External AUC',
    status: 'External evaluation harness ready (access-gated dataset)',
  },
];

export const DetectModule: React.FC<DetectModuleProps> = ({
  data,
  selectedPatientId,
  onSelectPatient,
  isOnline,
  onSubmitScreening,
  onNavigateProtect,
}) => {
  const [subTab, setSubTab] = useState<'pipeline' | 'datasets' | 'history'>('pipeline');
  const [preset, setPreset] = useState<
    'normal_demo' | 'moderate_npdr_demo' | 'ungradable_blur_demo' | 'uploaded_custom'
  >('moderate_npdr_demo');
  const [customDataUrl, setCustomDataUrl] = useState<string | undefined>(undefined);
  const [eye, setEye] = useState<'Left (OS)' | 'Right (OD)'>('Left (OS)');
  const [cameraSource, setCameraSource] = useState(
    'Remidio FOP Non-Mydriatic Fundus Camera (Synthetic Demo)'
  );
  const [activeStep, setActiveStep] = useState(1);
  const [gradCamOpacity, setGradCamOpacity] = useState(0.65);
  const [compareSideBySide, setCompareSideBySide] = useState(true);
  const [analysis, setAnalysis] = useState<PipelineAnalysisOutput | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const patient =
    data.patients.find((p) => p.id === selectedPatientId) || data.patients[0];
  const isEligible = patient?.diabetesStatus === 'diagnosed_t2d';
  const patientScreenings = data.screenings.filter((s) => s.patientId === patient?.id);

  useEffect(() => {
    const canvas = hiddenCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (preset === 'uploaded_custom' && customDataUrl) {
      const img = new Image();
      img.onload = () => {
        canvas.width = Math.min(512, img.width);
        canvas.height = Math.min(512, img.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setAnalysis(analyzeRetinalCanvasPixels(canvas, 'uploaded_custom'));
      };
      img.src = customDataUrl;
    } else {
      canvas.width = 384;
      canvas.height = 384;
      const demoKey: RetinalPresetKey =
        preset === 'uploaded_custom' ? 'normal_demo' : preset;
      renderSyntheticFundusToCanvas(canvas, demoKey, { stage: 'raw' });
      setAnalysis(analyzeRetinalCanvasPixels(canvas, demoKey));
    }
  }, [preset, customDataUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFeedback(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setFeedback({
        type: 'error',
        text: 'Upload rejected: Only PNG, JPEG, or WebP fundus images are permitted.',
      });
      return;
    }
    if (file.size > 4.5 * 1024 * 1024) {
      setFeedback({
        type: 'error',
        text: 'Upload rejected: File exceeds 4.5 MB safety limit.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCustomDataUrl(reader.result);
        setPreset('uploaded_custom');
        setCameraSource(`Uploaded File: ${file.name}`);
        setActiveStep(1);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitReport = async () => {
    if (!patient || !analysis) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await onSubmitScreening({
        patientId: patient.id,
        eye,
        cameraSource,
        imagePreset: preset,
        imageDataUrl: preset === 'uploaded_custom' ? customDataUrl : undefined,
        quality: analysis.quality,
        anatomicalStructures: analysis.anatomicalStructures,
        lesionFindings: analysis.lesionFindings,
        modelPrediction: analysis.modelPrediction,
        gradCam: analysis.gradCam,
      });
      setFeedback({
        type: 'success',
        text: analysis.quality.gradable
          ? 'Annotated screening report saved and queued for mandatory Doctor Review in Pillar 3 (Protect).'
          : 'Ungradable image rejection recorded in patient history with recapture recommendation.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save retinal screening.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const currentStage = SEVEN_STEPS[activeStep - 1]?.stage ?? 'raw';

  return (
    <div className="space-y-5">
      <canvas ref={hiddenCanvasRef} className="hidden" />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#12598C]">
            Pillar Two · AI-Assisted Diabetic Retinopathy Screening (7-Step Pipeline)
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0B2540]">
            DETECT — Retinal Screening &amp; Explainable AI
          </h1>
        </div>

        {data.patients.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="detect-patient" className="text-xs font-semibold text-slate-600">
              Patient:
            </label>
            <select
              id="detect-patient"
              value={patient?.id || ''}
              onChange={(e) => onSelectPatient(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
            >
              {data.patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.mrn}) · {p.diabetesStatus === 'diagnosed_t2d' ? 'Diagnosed T2D' : 'Not T2D'}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {!isEligible && patient && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Eligibility Clinical Boundary:</strong> Diabetic retinopathy screening is intended for individuals already diagnosed with diabetes. <strong>{patient.name}</strong> is currently classified as <em>{patient.diabetesStatus}</em>. Confirm clinical eligibility or laboratory diagnosis before screening.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-200/70 p-1">
        {[
          { id: 'pipeline', label: 'Acquisition & 7-Step Pipeline', icon: Layers },
          { id: 'datasets', label: 'Dataset Architecture (APTOS/IDRiD/DRIVE/Messidor-2)', icon: Database },
          { id: 'history', label: `Screening History (${patientScreenings.length})`, icon: FileCheck2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id as typeof subTab)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                active ? 'bg-white text-[#0B2540] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-[#12598C]" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.type === 'success' && (
            <button
              type="button"
              onClick={onNavigateProtect}
              className="shrink-0 rounded-lg bg-[#0B2540] px-3 py-1.5 text-xs font-semibold text-white"
            >
              Go to Doctor Review →
            </button>
          )}
        </div>
      )}

      {subTab === 'pipeline' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3.5">
              <h2 className="font-display text-base font-bold text-[#0B2540]">
                A. Retinal Image Acquisition
              </h2>
              <p className="text-xs text-slate-500">
                Upload a retinal image (PNG/JPEG/WebP, max 4.5MB) or select a synthetic demonstration capture to inspect all 7 stages.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Eye</label>
                  <select
                    value={eye}
                    onChange={(e) => setEye(e.target.value as 'Left (OS)' | 'Right (OD)')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="Left (OS)">Left (OS)</option>
                    <option value="Right (OD)">Right (OD)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Demo Sample</label>
                  <select
                    value={preset}
                    onChange={(e) => {
                      const val = e.target.value as typeof preset;
                      setPreset(val);
                      if (val !== 'uploaded_custom') {
                        setCameraSource('Remidio FOP Non-Mydriatic Fundus Camera (Synthetic Demo)');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium"
                  >
                    <option value="normal_demo">Synthetic: Normal (Grade 0)</option>
                    <option value="moderate_npdr_demo">Synthetic: Moderate NPDR</option>
                    <option value="ungradable_blur_demo">Synthetic: Blurred Ungradable</option>
                    {customDataUrl && <option value="uploaded_custom">Uploaded Custom Image</option>}
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs font-semibold text-[#0B2540] hover:bg-slate-100 transition-colors">
                <Upload className="h-4 w-4 text-[#0D9488]" />
                <span>Upload Retinal Image File</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Camera / Source Metadata
                </label>
                <input
                  type="text"
                  value={cameraSource}
                  onChange={(e) => setCameraSource(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-sm font-bold text-[#0B2540] mb-3">
                B. Seven-Step Processing Pipeline
              </h2>
              <div className="space-y-1.5">
                {SEVEN_STEPS.map((st) => {
                  const active = activeStep === st.num;
                  const blocked =
                    st.num > 1 && analysis && !analysis.quality.gradable && st.num < 7;
                  return (
                    <button
                      key={st.num}
                      type="button"
                      onClick={() => setActiveStep(st.num)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors ${
                        active
                          ? 'bg-[#0B2540] text-white font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] ${
                          active
                            ? 'bg-[#0D9488] text-white'
                            : blocked
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {st.num}
                      </span>
                      <span className="truncate flex-1">{st.title}</span>
                      {blocked && (
                        <span className="text-[10px] font-semibold text-rose-500">Halted</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <div className="text-xs font-semibold text-[#12598C]">
                    Step {activeStep} of 7 · Prototype Demonstration Mode (Illustrative Outputs Clearly Labelled)
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#0B2540]">
                    {SEVEN_STEPS[activeStep - 1].title}
                  </h2>
                </div>

                {activeStep === 6 && (
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compareSideBySide}
                        onChange={(e) => setCompareSideBySide(e.target.checked)}
                        className="accent-[#0D9488]"
                      />
                      Side-by-side
                    </label>
                    <label className="flex items-center gap-2">
                      <span>Heatmap</span>
                      <input
                        type="range"
                        min={0.15}
                        max={0.95}
                        step={0.05}
                        value={gradCamOpacity}
                        onChange={(e) => setGradCamOpacity(Number(e.target.value))}
                        className="w-20 accent-[#0D9488]"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div
                className={`grid gap-4 ${
                  activeStep === 6 && compareSideBySide
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 md:grid-cols-12 items-start'
                }`}
              >
                {activeStep === 6 && compareSideBySide ? (
                  <>
                    <FundusVisualizer
                      preset={preset}
                      imageDataUrl={customDataUrl}
                      stage="raw"
                      size={320}
                      className="aspect-square w-full max-w-[340px] mx-auto"
                      label="Original Fundus Capture"
                    />
                    <FundusVisualizer
                      preset={preset}
                      imageDataUrl={customDataUrl}
                      stage="gradcam"
                      gradCamOpacity={gradCamOpacity}
                      hotspots={analysis?.gradCam.hotspots}
                      size={320}
                      className="aspect-square w-full max-w-[340px] mx-auto"
                      label="Grad-CAM Explainability Overlay (Illustrative)"
                    />
                  </>
                ) : (
                  <>
                    <div className="md:col-span-6">
                      <FundusVisualizer
                        preset={preset}
                        imageDataUrl={customDataUrl}
                        stage={currentStage}
                        gradCamOpacity={gradCamOpacity}
                        hotspots={analysis?.gradCam.hotspots}
                        size={340}
                        className="aspect-square w-full max-w-[340px] mx-auto"
                        label={`Stage ${activeStep}: ${SEVEN_STEPS[activeStep - 1].title}`}
                      />
                    </div>

                    <div className="md:col-span-6 space-y-3 text-xs">
                      {analysis && (
                        <>
                          <div
                            className={`rounded-xl border p-4 ${
                              analysis.quality.gradable
                                ? 'border-emerald-200 bg-emerald-50/50'
                                : 'border-rose-300 bg-rose-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              {analysis.quality.gradable ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              ) : (
                                <ShieldAlert className="h-4 w-4 text-rose-600" />
                              )}
                              <span>
                                Step 1 Quality Gate:{' '}
                                {analysis.quality.gradable ? 'GRADABLE' : 'UNGRADABLE — REJECTED'}
                              </span>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-700 tabular-nums">
                              <div>Sharpness: {analysis.quality.sharpnessScore}/100</div>
                              <div>Brightness: {analysis.quality.brightnessMean}/255</div>
                              <div>Clipped Exposure: {analysis.quality.exposureClipPercent}%</div>
                              <div>
                                Resolution: {analysis.quality.width}×{analysis.quality.height}
                              </div>
                            </div>
                            {!analysis.quality.gradable && (
                              <div className="mt-2.5 text-rose-900 space-y-1">
                                <div>
                                  <strong>Reason:</strong> {analysis.quality.rejectionReason}
                                </div>
                                <div>
                                  <strong>Recapture Guidance:</strong> {analysis.quality.recaptureGuidance}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                            <div className="font-bold text-[#0B2540]">
                              Anatomy &amp; Lesion Candidates ({analysis.lesionFindings.implementationStatus})
                            </div>
                            <div className="text-slate-700">
                              Optic Disc: {analysis.anatomicalStructures.opticDiscDetected ? 'Localized' : 'Not resolved'} ·
                              Macula: {analysis.anatomicalStructures.maculaCentered ? 'Centered' : 'Off-axis'} ·
                              Vessel Index:{' '}
                              <span className="font-mono tabular-nums">
                                {analysis.anatomicalStructures.vesselDensityIndex}
                              </span>
                            </div>
                            <div className="text-slate-700">
                              Hard Exudates:{' '}
                              <strong>{analysis.lesionFindings.hardExudatesFlag ? 'Candidate Flagged' : 'None Flagged'}</strong>{' '}
                              · Haemorrhages:{' '}
                              <strong>{analysis.lesionFindings.haemorrhagesFlag ? 'Candidate Flagged' : 'None Flagged'}</strong>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              {analysis.lesionFindings.microaneurysmsExperimentalNote}
                            </p>
                          </div>

                          <div
                            className={`rounded-xl border p-4 space-y-1.5 ${
                              analysis.modelPrediction.gradeWithheld
                                ? 'border-amber-300 bg-amber-50/80'
                                : 'border-sky-200 bg-sky-50/60'
                            }`}
                          >
                            <div className="font-bold text-[#0B2540]">
                              Step 5 Screening Output &amp; Reliability Gate
                            </div>
                            <div className="text-sm font-bold text-slate-900">
                              {analysis.modelPrediction.gradeLabel}
                            </div>
                            <div className="font-mono text-[11px] text-slate-600 tabular-nums">
                              Confidence: {Math.round(analysis.modelPrediction.confidence * 100)}% ·
                              Uncertainty: {Math.round(analysis.modelPrediction.uncertainty * 100)}% ·
                              OOD Flag: {analysis.modelPrediction.oodFlag ? 'YES (Withheld)' : 'No'}
                            </div>
                            {analysis.modelPrediction.withholdReason && (
                              <p className="text-amber-950 font-medium">
                                Safe Withholding Active: {analysis.modelPrediction.withholdReason}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-600">
                              Model: {analysis.modelPrediction.modelVersion} · Requires mandatory clinician review.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {activeStep >= 6 && analysis && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                  <strong>Grad-CAM Explainability Limitation:</strong> {analysis.gradCam.limitationNotice}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="text-xs text-slate-500">
                  Submitting creates a shared annotated report linked to <strong>{patient?.name}</strong> and notifies the reviewing doctor.
                </div>
                <button
                  type="button"
                  disabled={submitting || !analysis || !isOnline}
                  onClick={() => void handleSubmitReport()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50"
                >
                  <Eye className="h-4 w-4" />
                  {submitting
                    ? 'Generating Report...'
                    : isOnline
                    ? 'Generate & Submit Annotated Report (Step 7)'
                    : 'Requires Connectivity to Submit for Doctor Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'datasets' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B2540]">
              Dataset Integration &amp; Evaluation Governance
            </h2>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-3xl">
              Mritidhristi never treats retinal datasets as interchangeable and never fabricates training accuracy, AUC, or clinical weights. Each dataset serves a strict role with patient-level splits and leakage prevention.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DATASET_SPECS.map((ds) => (
              <div key={ds.name} className="rounded-xl border border-slate-200 p-4 space-y-2 text-xs">
                <div className="font-display text-sm font-bold text-[#0B2540]">{ds.name}</div>
                <div className="text-slate-700">
                  <strong>Role:</strong> {ds.role}
                </div>
                <div className="text-slate-600">
                  <strong>Leakage &amp; Split Rule:</strong> {ds.splitRule}
                </div>
                <div className="text-slate-600">
                  <strong>Evaluation Metrics:</strong> {ds.metrics}
                </div>
                <div className="pt-1 font-semibold text-[#0F766E]">{ds.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-display text-base font-bold text-[#0B2540]">
            Retinal Screening History — {patient?.name}
          </h2>
          {patientScreenings.length === 0 ? (
            <p className="text-xs text-slate-500">No retinal screenings recorded for this patient yet.</p>
          ) : (
            <div className="space-y-3">
              {patientScreenings.map((scr) => (
                <div
                  key={scr.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200 p-4 text-xs"
                >
                  <FundusVisualizer
                    preset={scr.imagePreset}
                    imageDataUrl={scr.imageDataUrl}
                    stage="gradcam"
                    hotspots={scr.gradCam.hotspots}
                    size={100}
                    className="h-20 w-20 shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="font-semibold text-slate-900">
                      {scr.eye} · {scr.modelPrediction.gradeLabel}
                    </div>
                    <div className="text-slate-500 font-mono text-[11px] tabular-nums">
                      {new Date(scr.capturedAt).toLocaleString()} · Sharpness {scr.quality.sharpnessScore}/100 ·
                      Review: <strong className="text-slate-800">{scr.humanReviewStatus}</strong>
                    </div>
                    <p className="text-slate-600">{scr.summaryText}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
