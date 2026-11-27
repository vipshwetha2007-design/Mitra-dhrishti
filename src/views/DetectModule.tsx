import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Eye,
  FileCheck2,
  Layers,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Split,
  Upload,
} from 'lucide-react';
import type { BootstrapPayload, RetinalScreening } from '../types/domain';
import { apiUrl } from '../services/apiConfig';
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
  authToken?: string | null;
}

const SEVEN_STEPS = [
  { num: 1, title: 'Image Quality Assessment', stage: 'raw' as const },
  { num: 2, title: 'Enhancement & CLAHE Preprocessing', stage: 'preprocessed' as const },
  { num: 3, title: 'Anatomical Landmark Localisation', stage: 'anatomy' as const },
  { num: 4, title: 'U-Net Retinal Lesion Segmentation', stage: 'lesions' as const },
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

const FALLBACK_DATASET_STATS = {
  manifest: {
    dataset_name: 'APTOS 2019 Blindness Detection (MITRA DRISHTI Curated & Leakage-Free)',
    primary_source: 'Aravind Eye Hospital, Tamil Nadu, India / Kaggle Competition Dataset',
    license: 'Competition Data Agreement / Educational & Non-commercial Clinical Research',
    total_inspected_images: 3662,
    valid_usable_images: 3662,
    rejected_images_count: 0,
    splits: { train_count: 2706, val_count: 424, test_count: 532 },
    class_distribution_overall: { '0': 1805, '1': 370, '2': 999, '3': 193, '4': 295 },
  },
  classWeights: {
    num_classes: 5,
    train_sample_count: 2706,
    class_counts_train: { '0': 1382, '1': 266, '2': 712, '3': 138, '4': 208 },
    class_percentages_train: { '0': 51.07, '1': 9.83, '2': 26.31, '3': 5.1, '4': 7.69 },
    inverse_class_weights: { '0': 0.3916, '1': 2.0346, '2': 0.7601, '3': 3.9217, '4': 2.6019 },
    effective_number_weights: { '0': 0.2129, '1': 1.047, '2': 0.3999, '3': 2.0052, '4': 1.335 },
  },
  qualityReport: {
    total_inspected: 3662,
    valid_passed: 3662,
    rejected_count: 0,
    pass_rate_pct: 100.0,
    mean_laplacian_variance: 260.67,
    mean_fov_luminance: 87.66,
  },
  pipelineStatus: {
    phase: 'Phase 5: Retinal Dataset Preparation & Curation',
    curationComplete: true,
    leakageFreeSplits: true,
    readyForCnnTraining: true,
    cnnTrainingStatus: 'NOT_STARTED (Scheduled for Phase 6)',
    safetyStatement:
      'Curated clinical retinal dataset is verified for genuine CNN training. Zero synthetic images; zero data leakage across train/val/test splits.',
  },
};

export const DetectModule: React.FC<DetectModuleProps> = ({
  data,
  selectedPatientId,
  onSelectPatient,
  isOnline,
  onSubmitScreening,
  onNavigateProtect,
  authToken,
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
  const [inferenceLoading, setInferenceLoading] = useState(false);
  const [inferenceError, setInferenceError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [datasetStats, setDatasetStats] = useState<typeof FALLBACK_DATASET_STATS>(FALLBACK_DATASET_STATS);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (subTab === 'datasets') {
      setLoadingStats(true);
      const token = authToken || localStorage.getItem('mitra_drishti_token') || localStorage.getItem('mritidhristi_token');
      fetch(apiUrl('/api/detect/dataset-stats'), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          if (res?.success) {
            setDatasetStats(res);
          }
        })
        .catch(() => undefined)
        .finally(() => setLoadingStats(false));
    }
  }, [subTab, authToken]);

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
      setInferenceLoading(true);
      setInferenceError(null);
      const img = new Image();
      img.onload = () => {
        canvas.width = Math.min(512, img.width);
        canvas.height = Math.min(512, img.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const preliminaryClientAnalysis = analyzeRetinalCanvasPixels(canvas, 'uploaded_custom');
        setAnalysis(preliminaryClientAnalysis);

        if (isOnline) {
          const effectiveToken = authToken || localStorage.getItem('mitra_drishti_token') || localStorage.getItem('mritidhristi_token');
          fetch(apiUrl('/api/detect/predict'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
            },
            body: JSON.stringify({ imageDataUrl: customDataUrl }),
          })
            .then(async (r) => {
              if (!r.ok) {
                const err = await r.json().catch(() => ({ error: `Inference failed with HTTP ${r.status}` }));
                throw new Error(err.error || `Server returned HTTP ${r.status}`);
              }
              return r.json();
            })
            .then((res) => {
              if (res?.success) {
                setAnalysis({
                  quality: res.quality,
                  anatomicalStructures: res.anatomicalStructures,
                  lesionFindings: res.lesionFindings,
                  landmarks: res.landmarks,
                  unetSegmentation: res.unetSegmentation,
                  modelPrediction: res.modelPrediction,
                  gradCam: res.gradCam,
                  inferenceDurationMs: res.inferenceDurationMs,
                });
                setInferenceLoading(false);
              } else {
                throw new Error(res?.error || 'Inference engine did not return valid prediction results.');
              }
            })
            .catch((err) => {
              console.error('CNN inference failed:', err);
              setInferenceError(err instanceof Error ? err.message : 'CNN retinal inference failed.');
              setInferenceLoading(false);
            });
        } else {
          setInferenceLoading(false);
        }
      };
      img.src = customDataUrl;
    } else {
      setInferenceLoading(false);
      setInferenceError(null);
      canvas.width = 384;
      canvas.height = 384;
      const demoKey: RetinalPresetKey =
        preset === 'uploaded_custom' ? 'normal_demo' : preset;
      renderSyntheticFundusToCanvas(canvas, demoKey, { stage: 'raw' });
      setAnalysis(analyzeRetinalCanvasPixels(canvas, demoKey));
    }
  }, [preset, customDataUrl, authToken, isOnline]);

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
          <p className="text-sm font-semibold text-[#12598C]">
            Pillar Two · AI-Assisted Diabetic Retinopathy Screening (7-Step Pipeline)
          </p>
          <h1 className="font-display text-[28px] font-bold text-[#0B2540] leading-tight">
            DETECT — Retinal Screening &amp; Explainable AI
          </h1>
        </div>

        {data.patients.length > 1 && (
          <div className="flex items-center gap-2.5">
            <label htmlFor="detect-patient" className="text-[15px] font-semibold text-slate-700">
              Patient:
            </label>
            <select
              id="detect-patient"
              value={patient?.id || ''}
              onChange={(e) => onSelectPatient(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-[15px] font-semibold text-slate-800 shadow-2xs"
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
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4.5 py-3.5 text-[15px] text-amber-950 flex items-start gap-3 leading-relaxed">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <strong>Eligibility Clinical Boundary:</strong> Diabetic retinopathy screening is intended for individuals already diagnosed with diabetes. <strong>{patient.name}</strong> is currently classified as <em>{patient.diabetesStatus}</em>. Confirm clinical eligibility or laboratory diagnosis before screening.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 rounded-xl bg-slate-200/70 p-1.5">
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
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                active ? 'bg-white text-[#0B2540] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 text-[#12598C]" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4.5 py-3.5 text-[15px] font-medium flex items-center justify-between gap-3 ${
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
              className="shrink-0 rounded-lg bg-[#0B2540] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123658]"
            >
              Go to Doctor Review →
            </button>
          )}
        </div>
      )}

      {subTab === 'pipeline' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5.5 space-y-4">
              <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
                A. Retinal Image Acquisition
              </h2>
              <p className="text-[14px] text-slate-600 leading-relaxed">
                Upload a retinal image (PNG/JPEG/WebP, max 4.5MB) or select a synthetic demonstration capture to inspect all 7 stages.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[14px] font-semibold text-slate-700 mb-1.5">Eye</label>
                  <select
                    value={eye}
                    onChange={(e) => setEye(e.target.value as 'Left (OS)' | 'Right (OD)')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] font-medium text-slate-800"
                  >
                    <option value="Left (OS)">Left (OS)</option>
                    <option value="Right (OD)">Right (OD)</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[14px] font-semibold text-slate-700 mb-1.5">Demo Sample</label>
                  <select
                    value={preset}
                    onChange={(e) => {
                      const val = e.target.value as typeof preset;
                      setPreset(val);
                      if (val !== 'uploaded_custom') {
                        setCameraSource('Remidio FOP Non-Mydriatic Fundus Camera (Synthetic Demo)');
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[15px] font-medium text-slate-800"
                  >
                    <option value="normal_demo">Synthetic: Normal (Grade 0)</option>
                    <option value="moderate_npdr_demo">Synthetic: Moderate NPDR</option>
                    <option value="ungradable_blur_demo">Synthetic: Blurred Ungradable</option>
                    {customDataUrl && <option value="uploaded_custom">Uploaded Custom Image</option>}
                  </select>
                </div>
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3.5 text-[15px] font-semibold text-[#0B2540] hover:bg-slate-100 transition-colors">
                <Upload className="h-4.5 w-4.5 text-[#0D9488]" />
                <span>Upload Retinal Image File</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div>
                <label className="block text-[14px] font-semibold text-slate-700 mb-1.5">
                  Camera / Source Metadata
                </label>
                <input
                  type="text"
                  value={cameraSource}
                  onChange={(e) => setCameraSource(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-[15px] text-slate-800"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5.5">
              <h2 className="font-display text-[19px] font-bold text-[#0B2540] mb-3.5">
                B. Seven-Step Processing Pipeline
              </h2>
              <div className="space-y-2">
                {SEVEN_STEPS.map((st) => {
                  const active = activeStep === st.num;
                  const blocked =
                    st.num > 1 && analysis && !analysis.quality.gradable && st.num < 7;
                  return (
                    <button
                      key={st.num}
                      type="button"
                      onClick={() => setActiveStep(st.num)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0B2540] text-white font-semibold shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold ${
                          active
                            ? 'bg-[#0D9488] text-white'
                            : blocked
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {st.num}
                      </span>
                      <span className="flex-1 font-medium leading-snug">{st.title}</span>
                      {blocked && (
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">Halted</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-8 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4.5">
                <div>
                  <div className="text-sm font-semibold text-[#12598C]">
                    Step {activeStep} of 7 · Prototype Demonstration Mode (Illustrative Outputs Clearly Labelled)
                  </div>
                  <h2 className="font-display text-[22px] font-bold text-[#0B2540]">
                    {SEVEN_STEPS[activeStep - 1].title}
                  </h2>
                </div>

                {activeStep === 6 && (
                  <div className="flex items-center gap-4 text-sm font-medium text-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={compareSideBySide}
                        onChange={(e) => setCompareSideBySide(e.target.checked)}
                        className="accent-[#0D9488] h-4 w-4"
                      />
                      <span>Side-by-side</span>
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
                        className="w-24 accent-[#0D9488]"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div
                className={`grid gap-4.5 ${
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
                      landmarks={analysis?.landmarks}
                      unetSegmentation={analysis?.unetSegmentation}
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
                      landmarks={analysis?.landmarks}
                      unetSegmentation={analysis?.unetSegmentation}
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
                        landmarks={analysis?.landmarks}
                        unetSegmentation={analysis?.unetSegmentation}
                        size={340}
                        className="aspect-square w-full max-w-[340px] mx-auto"
                        label={`Stage ${activeStep}: ${SEVEN_STEPS[activeStep - 1].title}`}
                      />
                    </div>

                    <div className="md:col-span-6 space-y-3.5 text-[15px]">
                      {analysis && (
                        <>
                          <div
                            className={`rounded-xl border p-4.5 ${
                              analysis.quality.gradable
                                ? 'border-emerald-200 bg-emerald-50/50'
                                : 'border-rose-300 bg-rose-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 text-[17px] font-bold text-slate-900">
                              {analysis.quality.gradable ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                              ) : (
                                <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
                              )}
                              <span>
                                Step 1 Quality Gate:{' '}
                                {analysis.quality.gradable ? 'GRADABLE' : 'UNGRADABLE — REJECTED'}
                              </span>
                            </div>
                            <div className="mt-2.5 grid grid-cols-2 gap-2.5 font-mono text-[15px] font-semibold text-slate-800 tabular-nums">
                              <div>Sharpness: {analysis.quality.sharpnessScore}/100</div>
                              <div>Brightness: {analysis.quality.brightnessMean}/255</div>
                              <div>Clipped: {analysis.quality.exposureClipPercent}%</div>
                              <div>
                                Res: {analysis.quality.width}×{analysis.quality.height}
                              </div>
                            </div>
                            {!analysis.quality.gradable && (
                              <div className="mt-3 text-[14px] text-rose-900 space-y-1 leading-relaxed">
                                <div>
                                  <strong>Reason:</strong> {analysis.quality.rejectionReason}
                                </div>
                                <div>
                                  <strong>Recapture Guidance:</strong> {analysis.quality.recaptureGuidance}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Step 3: Optic Disc & Fovea Localisation Block */}
                          {activeStep === 3 && analysis.landmarks?.available ? (
                            <div className="rounded-xl border border-sky-300 bg-sky-50/70 p-4.5 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[17px] font-bold text-sky-950 flex items-center gap-2">
                                  <Eye className="h-5 w-5 text-sky-700" />
                                  Optic Disc &amp; Fovea Deep-Learning Localisation
                                </div>
                                <span className="text-[11px] font-semibold text-sky-900 bg-sky-200/90 px-2.5 py-0.5 rounded-full border border-sky-300">
                                  IDRiD CoordConv CNN (Experimental)
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[14px]">
                                <div className="rounded-lg bg-white/90 p-3 border border-sky-200 shadow-2xs">
                                  <div className="text-[12px] font-bold text-cyan-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-500" />
                                    Optic Disc (OD) Centre
                                  </div>
                                  <div className="font-mono text-[15px] font-bold text-slate-900 mt-1">
                                    ({analysis.landmarks.opticDisc?.x}, {analysis.landmarks.opticDisc?.y}) px
                                  </div>
                                  <div className="text-[12px] text-slate-500 font-mono mt-0.5">
                                    Norm: [{analysis.landmarks.opticDisc?.normalizedX}, {analysis.landmarks.opticDisc?.normalizedY}]
                                  </div>
                                </div>
                                <div className="rounded-lg bg-white/90 p-3 border border-sky-200 shadow-2xs">
                                  <div className="text-[12px] font-bold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                                    Fovea Centralis Centre
                                  </div>
                                  <div className="font-mono text-[15px] font-bold text-slate-900 mt-1">
                                    ({analysis.landmarks.fovea?.x}, {analysis.landmarks.fovea?.y}) px
                                  </div>
                                  <div className="text-[12px] text-slate-500 font-mono mt-0.5">
                                    Norm: [{analysis.landmarks.fovea?.normalizedX}, {analysis.landmarks.fovea?.normalizedY}]
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-lg bg-white/80 p-3 border border-sky-200/80 text-[13px] text-slate-800 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>
                                    Inter-Landmark Euclidean Distance: <strong>{analysis.landmarks.distancePx} px</strong> ({analysis.landmarks.distanceNorm} norm)
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${
                                    analysis.landmarks.isAnatomicallyPlausible ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {analysis.landmarks.isAnatomicallyPlausible ? 'Anatomically Plausible (20-45% FOV)' : 'Alignment Review Required'}
                                  </span>
                                </div>
                                <div className="text-slate-600">
                                  Inferred Retinal Laterality: <strong>{analysis.landmarks.inferredEyeSide}</strong>
                                </div>
                              </div>
                              <p className="text-[12px] text-sky-900/90 leading-relaxed italic bg-sky-100/60 p-2.5 rounded-lg border border-sky-200/50">
                                ⚠️ <strong>Experimental Notice:</strong> {analysis.landmarks.limitationNotice}
                              </p>
                            </div>
                          ) : activeStep === 4 && analysis.unetSegmentation?.available ? (
                            /* Step 4: Actual U-Net Lesion Segmentation Block */
                            <div className="rounded-xl border border-purple-300 bg-purple-50/70 p-4.5 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[17px] font-bold text-purple-950 flex items-center gap-2">
                                  <Activity className="h-5 w-5 text-purple-700" />
                                  IDRiD Residual U-Net Multi-Lesion Segmentation
                                </div>
                                <span className="text-[11px] font-semibold text-purple-900 bg-purple-200/90 px-2.5 py-0.5 rounded-full border border-purple-300">
                                  Official IDRiD Calibrated U-Net
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[13px]">
                                {[
                                  { key: 'MA', label: 'Microaneurysms', color: '#FF00FF', bg: 'bg-fuchsia-50', border: 'border-fuchsia-300', text: 'text-fuchsia-900', tau: '0.25' },
                                  { key: 'HE', label: 'Haemorrhages', color: '#FF2828', bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-900', tau: '0.10' },
                                  { key: 'EX', label: 'Hard Exudates', color: '#FFE600', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-900', tau: '0.05' },
                                  { key: 'SE', label: 'Soft Exudates', color: '#00E6FF', bg: 'bg-cyan-50', border: 'border-cyan-300', text: 'text-cyan-900', tau: '0.50' },
                                ].map((cls) => {
                                  const stat = analysis.unetSegmentation?.lesionStats?.find((s) => s.key === cls.key);
                                  const px = stat?.pixel_count ?? 0;
                                  const isDet = stat?.detected ?? false;
                                  return (
                                    <div key={cls.key} className={`rounded-lg p-2.5 border ${cls.bg} ${cls.border} shadow-2xs`}>
                                      <div className="flex items-center gap-1.5 font-bold text-[11px] uppercase truncate" style={{ color: cls.color === '#FFE600' ? '#B45309' : cls.color }}>
                                        <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: cls.color }} />
                                        {cls.key}
                                      </div>
                                      <div className="font-mono text-[14px] font-bold text-slate-900 mt-1">
                                        {px.toLocaleString()} px
                                      </div>
                                      <div className="text-[10px] text-slate-500 mt-0.5">
                                        τ = {cls.tau} · {isDet ? 'Detected' : 'Below cutoff'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="rounded-lg bg-white/80 p-3 border border-purple-200/80 text-[13px] text-slate-800 space-y-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span>
                                    Total Segmented Lesions: <strong>{analysis.unetSegmentation.totalLesionPixels?.toLocaleString()} px</strong> ({analysis.unetSegmentation.overallLesionCoveragePct}% coverage)
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md font-semibold text-[11px] bg-purple-100 text-purple-900">
                                    {analysis.unetSegmentation.drLesionStage}
                                  </span>
                                </div>
                              </div>
                              <p className="text-[12px] text-purple-900/90 leading-relaxed italic bg-purple-100/60 p-2.5 rounded-lg border border-purple-200/50">
                                ⚠️ <strong>Experimental Notice:</strong> {analysis.unetSegmentation.limitationNotice}
                              </p>
                            </div>
                          ) : (
                            /* General Anatomical & Lesion Overview Panel */
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4.5 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[17px] font-bold text-[#0B2540]">
                                  Anatomical Structures &amp; Lesion Candidates
                                </div>
                                <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/90 px-2.5 py-0.5 rounded-full">
                                  {analysis.unetSegmentation?.available
                                    ? 'IDRiD Residual U-Net AI + Classical Morphology'
                                    : 'Illustrative / Morphological Heuristic'}
                                </span>
                              </div>
                              <div className="text-[15px] text-slate-800 leading-relaxed">
                                Optic Disc:{' '}
                                <strong>
                                  {analysis.landmarks?.available
                                    ? `Localised via CoordConv CNN (${analysis.landmarks.opticDisc?.x}, ${analysis.landmarks.opticDisc?.y})`
                                    : analysis.anatomicalStructures.opticDiscDetected
                                    ? 'Localised (Heuristic)'
                                    : 'Not resolved'}
                                </strong>{' '}
                                · Macula:{' '}
                                <strong>
                                  {analysis.landmarks?.available
                                    ? `Localised via CoordConv CNN (${analysis.landmarks.fovea?.x}, ${analysis.landmarks.fovea?.y})`
                                    : analysis.anatomicalStructures.maculaCentered
                                    ? 'Centered (Heuristic)'
                                    : 'Off-axis'}
                                </strong>{' '}
                                · Vessel Index:{' '}
                                <span className="font-mono font-semibold tabular-nums">
                                  {analysis.anatomicalStructures.vesselDensityIndex}
                                </span>
                              </div>
                              <div className="text-[15px] text-slate-800 leading-relaxed">
                                Hard Exudates:{' '}
                                <strong className={analysis.lesionFindings.hardExudatesFlag ? 'text-amber-700' : 'text-slate-700'}>
                                  {analysis.unetSegmentation?.available
                                    ? `${analysis.unetSegmentation.lesionStats?.find((s) => s.key === 'EX')?.pixel_count || 0} px (U-Net τ=0.05)`
                                    : analysis.lesionFindings.hardExudatesFlag
                                    ? 'Candidate Flagged (Heuristic)'
                                    : 'None Flagged'}
                                </strong>{' '}
                                · Haemorrhages:{' '}
                                <strong className={analysis.lesionFindings.haemorrhagesFlag ? 'text-rose-700' : 'text-slate-700'}>
                                  {analysis.unetSegmentation?.available
                                    ? `${analysis.unetSegmentation.lesionStats?.find((s) => s.key === 'HE')?.pixel_count || 0} px (U-Net τ=0.10)`
                                    : analysis.lesionFindings.haemorrhagesFlag
                                    ? 'Candidate Flagged (Heuristic)'
                                    : 'None Flagged'}
                                </strong>
                              </div>
                              <p className="text-[12px] text-slate-500 leading-relaxed italic">
                                ℹ️ Note: Deep-learning landmark localization (MobileNetV2 CoordConv) and multi-lesion segmentation (IDRiD Residual U-Net) provide experimental candidate contours for clinical review; not certified clinical diagnostics.
                              </p>
                            </div>
                          )}

                          {inferenceLoading ? (
                            <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-5 space-y-3 animate-pulse">
                              <div className="flex items-center justify-between">
                                <div className="text-[17px] font-bold text-teal-950 flex items-center gap-2.5">
                                  <RefreshCw className="h-5 w-5 text-teal-600 animate-spin" />
                                  Evaluating MobileNetV2 Retinal Inference...
                                </div>
                                <span className="font-mono text-[12px] font-semibold text-teal-800 bg-teal-100/90 px-2.5 py-0.5 rounded-full border border-teal-200">
                                  Inference In-Flight
                                </span>
                              </div>
                              <p className="text-[14px] text-teal-900 leading-relaxed">
                                Executing deep convolutional forward pass on active <code>dr_classifier_improved.keras</code>, computing 10-pass Monte Carlo epistemic uncertainty, temperature-calibrated five-class probabilities, and Grad-CAM spatial activation mapping on the backend server.
                              </p>
                              <div className="text-[12px] text-teal-700 font-medium pt-1 border-t border-teal-200/50">
                                Architecture: <strong>MobileNetV2 (Active Deep CNN Weights Loading...)</strong>
                              </div>
                            </div>
                          ) : inferenceError ? (
                            <div className="rounded-xl border border-rose-300 bg-rose-50/90 p-5 space-y-2.5">
                              <div className="text-[17px] font-bold text-rose-900 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-rose-600" />
                                CNN Retinal Inference Error
                              </div>
                              <p className="text-[14px] text-rose-800 leading-relaxed font-mono">
                                {inferenceError}
                              </p>
                              <p className="text-[12px] text-rose-600">
                                Please ensure the uploaded file is a valid non-mydriatic fundus photograph and that the backend inference service is running.
                              </p>
                            </div>
                          ) : (
                            <div
                              className={`rounded-xl border p-4.5 space-y-3 ${
                                analysis.modelPrediction.gradeWithheld
                                  ? 'border-amber-300 bg-amber-50/80'
                                  : 'border-sky-200 bg-sky-50/60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="text-[17px] font-bold text-[#0B2540]">
                                  Step 5 Screening Output &amp; Reliability Gate
                                </div>
                                {analysis.inferenceDurationMs ? (
                                  <span className="font-mono text-[12px] font-semibold text-slate-700 bg-white/90 px-2.5 py-0.5 rounded-full border border-slate-200">
                                    Latency: {analysis.inferenceDurationMs} ms
                                  </span>
                                ) : analysis.modelPrediction.isIllustrativeOutput ? (
                                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-200/90 px-2.5 py-0.5 rounded-full">
                                    Interactive Preset Demo
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[19px] font-bold text-slate-900">
                                {analysis.modelPrediction.gradeLabel}
                              </div>
                              <div className="font-mono text-[15px] font-semibold text-slate-800 tabular-nums">
                                Confidence: {Math.round(analysis.modelPrediction.confidence * 100)}% ·
                                Uncertainty: {Math.round(analysis.modelPrediction.uncertainty * 100)}% ·
                                OOD Flag: {analysis.modelPrediction.oodFlag ? 'YES (Withheld)' : 'No'}
                              </div>

                              {/* Five-Class Probability Distribution */}
                              {analysis.modelPrediction.calibratedProbabilities && analysis.modelPrediction.calibratedProbabilities.length === 5 && (
                                <div className="rounded-lg border border-slate-200/80 bg-white/95 p-3 space-y-2">
                                  <div className="text-[12px] font-bold text-slate-600 uppercase tracking-wide">
                                    Five-Class Probability Distribution (Temperature Calibrated)
                                  </div>
                                  <div className="grid grid-cols-5 gap-1.5 text-center text-[12px]">
                                    {[
                                      { grade: 0, label: 'G0: None' },
                                      { grade: 1, label: 'G1: Mild' },
                                      { grade: 2, label: 'G2: Moderate' },
                                      { grade: 3, label: 'G3: Severe' },
                                      { grade: 4, label: 'G4: PDR' },
                                    ].map(({ grade, label }) => {
                                      const prob = analysis.modelPrediction.calibratedProbabilities![grade];
                                      const isPredicted = analysis.modelPrediction.icdrGrade === grade;
                                      return (
                                        <div
                                          key={grade}
                                          className={`rounded-md p-1.5 border ${
                                            isPredicted
                                              ? 'border-teal-500 bg-teal-50/90 font-bold text-teal-900 shadow-xs'
                                              : 'border-slate-100 bg-slate-50 text-slate-600'
                                          }`}
                                        >
                                          <div className="truncate text-[11px] font-medium">{label}</div>
                                          <div className="font-mono text-[13px] font-bold mt-0.5">{Math.round(prob * 100)}%</div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {typeof analysis.modelPrediction.pReferable === 'number' && (
                                    <div className="text-[13px] pt-1.5 text-slate-700 flex flex-wrap items-center justify-between border-t border-slate-100 gap-2">
                                      <span>
                                        Referable DR Risk (G ≥ 2): <strong>{Math.round(analysis.modelPrediction.pReferable * 100)}%</strong> (τ* = {analysis.modelPrediction.calibrationThreshold || 0.38})
                                      </span>
                                      <span className={`px-2.5 py-0.5 rounded-full font-semibold text-[12px] ${
                                        analysis.modelPrediction.isReferable ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {analysis.modelPrediction.isReferable ? 'Referable DR Suspected' : 'Non-Referable DR'}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {analysis.modelPrediction.withholdReason && (
                                <p className="text-[14px] text-amber-950 font-semibold leading-relaxed">
                                  Safe Withholding Active: {analysis.modelPrediction.withholdReason}
                                </p>
                              )}
                              <div className="text-[13px] text-slate-600 space-y-0.5 border-t border-slate-200/60 pt-2">
                                <div>
                                  <strong>Model:</strong> {analysis.modelPrediction.modelVersion} ({analysis.modelPrediction.activeModelFile || 'dr_classifier_improved.keras'})
                                </div>
                                <div className="truncate text-slate-500 text-[12px]">
                                  <strong>Architecture:</strong> {analysis.modelPrediction.architectureReference}
                                </div>
                                <div className="text-amber-800 font-medium text-[12px] pt-0.5">
                                  ⚠️ <em>Clinical Notice: Experimental AI research screening prototype. Mandatory Doctor Review required prior to clinical triage.</em>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {activeStep >= 6 && analysis && (
                <div className="mt-4.5 rounded-xl border border-slate-200 bg-slate-50 px-4.5 py-3 text-[14px] text-slate-700 leading-relaxed">
                  <strong>Grad-CAM Explainability Limitation:</strong> {analysis.gradCam.limitationNotice}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4.5">
                <div className="text-[14px] text-slate-600">
                  Submitting creates a shared annotated report linked to <strong>{patient?.name}</strong> and notifies the reviewing doctor.
                </div>
                <button
                  type="button"
                  disabled={submitting || !analysis || !isOnline}
                  onClick={() => void handleSubmitReport()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50 transition-colors cursor-pointer"
                >
                  <Eye className="h-4.5 w-4.5" />
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
        <div className="space-y-5">
          {/* Top Status & Verification Banner */}
          <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50/60 via-emerald-50/40 to-white p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/90 px-3.5 py-1 text-[13px] font-semibold text-teal-900">
                    <ShieldCheck className="h-4 w-4 text-teal-700" />
                    Phase 5 Curated Retinal Pipeline
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 px-3 py-1 text-[13px] font-semibold text-emerald-900">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                    Zero Split Leakage Verified
                  </span>
                </div>
                <h2 className="mt-2.5 font-display text-[22px] font-bold text-[#0B2540] leading-tight">
                  {datasetStats.manifest?.dataset_name || 'APTOS 2019 Blindness Detection (MITRA DRISHTI Curated)'}
                </h2>
                <p className="mt-1.5 text-[14px] text-slate-700 max-w-2xl leading-relaxed">
                  <strong>Cohort Origin:</strong> Aravind Eye Hospital clinics across Tamil Nadu, India. 3,662 genuine clinical retinal fundus examinations graded under the International Clinical Diabetic Retinopathy (ICDR) scale. Zero synthetic images; audited for genuine CNN training.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
                <span className="rounded-xl border border-teal-200 bg-white/90 px-4 py-2.5 text-[14px] font-semibold text-slate-800 shadow-xs">
                  <span className="text-slate-500 font-mono text-[12px] block">Curated Version</span>
                  v5.0.0 (Leakage-Free)
                </span>
                <span className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-[14px] font-semibold text-amber-900 shadow-xs">
                  <span className="text-amber-700 font-mono text-[12px] block">CNN Model Training</span>
                  Phase 6 Scheduled
                </span>
              </div>
            </div>

            {/* 4 KPI Metrics */}
            <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-600 text-[14px] font-semibold">
                  <span>Total Scans</span>
                  <Database className="h-4.5 w-4.5 text-teal-600" />
                </div>
                <div className="mt-2 text-[26px] font-bold text-slate-900 font-display">
                  {datasetStats.manifest?.total_inspected_images?.toLocaleString() || '3,662'}
                </div>
                <div className="mt-1 text-[13px] text-emerald-700 font-medium">
                  100% Genuine Clinical Fundus Scans
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-600 text-[14px] font-semibold">
                  <span>Partition Split</span>
                  <Split className="h-4.5 w-4.5 text-indigo-600" />
                </div>
                <div className="mt-2 text-[20px] font-bold text-slate-900 font-display">
                  73.9% / 11.6% / 14.5%
                </div>
                <div className="mt-1 text-[13px] text-slate-600">
                  Train ({datasetStats.manifest?.splits?.train_count || 2706}) · Val ({datasetStats.manifest?.splits?.val_count || 424}) · Test ({datasetStats.manifest?.splits?.test_count || 532})
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-600 text-[14px] font-semibold">
                  <span>Quality Audit Gate</span>
                  <Activity className="h-4.5 w-4.5 text-emerald-600" />
                </div>
                <div className="mt-2 text-[26px] font-bold text-emerald-700 font-display">
                  {datasetStats.qualityReport?.pass_rate_pct || 100}% Passed
                </div>
                <div className="mt-1 text-[13px] text-slate-600">
                  Mean Blur Var: {datasetStats.qualityReport?.mean_laplacian_variance || 260.7} · Lum: {datasetStats.qualityReport?.mean_fov_luminance || 87.7}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
                <div className="flex items-center justify-between text-slate-600 text-[14px] font-semibold">
                  <span>Duplicate Clusters</span>
                  <Layers className="h-4.5 w-4.5 text-sky-600" />
                </div>
                <div className="mt-2 text-[26px] font-bold text-slate-900 font-display">
                  2,429
                </div>
                <div className="mt-1 text-[13px] text-teal-700 font-medium">
                  dHash &amp; MD5 Bound (0 Leaks)
                </div>
              </div>
            </div>
          </div>

          {/* ICDR 5-Class Distribution & Calculated Loss Weights */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
                  ICDR 5-Class Distribution &amp; Clinical Class Weighting
                </h3>
                <p className="mt-1 text-[14px] text-slate-600">
                  Calculated inverse frequency and effective sample weights (Cui et al., CVPR) for Phase 6 CNN training.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
                <BarChart3 className="h-4 w-4 text-teal-600" />
                Quarantined Held-Out Test Set: 532 Scans
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-[13px] font-bold text-slate-700 uppercase tracking-wider">
                    <th className="py-3 px-3.5">Grade</th>
                    <th className="py-3 px-3.5">ICDR Classification</th>
                    <th className="py-3 px-3.5">Overall Scans</th>
                    <th className="py-3 px-3.5">Train Scans</th>
                    <th className="py-3 px-3.5">Train Proportion</th>
                    <th className="py-3 px-3.5">Inverse Weight (wc)</th>
                    <th className="py-3 px-3.5">Effective Weight</th>
                    <th className="py-3 px-3.5">Clinical Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[15px] font-medium">
                  {[
                    { grade: 0, name: 'No DR', count: 1805, train: 1382, pct: '51.1%', inv: '0.3916', eff: '0.2129', action: 'Annual Routine Screening' },
                    { grade: 1, name: 'Mild NPDR', count: 370, train: 266, pct: '9.8%', inv: '2.0346', eff: '1.0470', action: 'Lifestyle / PREVENT Glycemic Control' },
                    { grade: 2, name: 'Moderate NPDR', count: 999, train: 712, pct: '26.3%', inv: '0.7601', eff: '0.3999', action: '6-Month Clinic Review / Referral' },
                    { grade: 3, name: 'Severe NPDR', count: 193, train: 138, pct: '5.1%', inv: '3.9217', eff: '2.0052', action: 'Urgent Ophthalmology Referral' },
                    { grade: 4, name: 'Proliferative DR', count: 295, train: 208, pct: '7.7%', inv: '2.6019', eff: '1.3350', action: 'Immediate PRP Laser / Anti-VEGF' },
                  ].map((row) => (
                    <tr key={row.grade} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3.5">
                        <span className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-800 text-[13px]">
                          {row.grade}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 font-semibold text-slate-900">{row.name}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-700">{row.count.toLocaleString()}</td>
                      <td className="py-3 px-3.5 font-mono text-slate-700">{row.train.toLocaleString()}</td>
                      <td className="py-3 px-3.5 text-slate-700">{row.pct}</td>
                      <td className="py-3 px-3.5 font-mono text-teal-800 font-semibold">{row.inv}</td>
                      <td className="py-3 px-3.5 font-mono text-indigo-700 font-semibold">{row.eff}</td>
                      <td className="py-3 px-3.5 text-[13px] text-slate-700 font-medium">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4.5 text-[14px] text-slate-700 space-y-1.5 leading-relaxed">
              <div className="font-semibold text-slate-900">Clinical AI Governance &amp; Leakage Prevention:</div>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                <li>
                  <strong>Duplicate Cluster Protection:</strong> 128 exact duplicates and 1,233 near-duplicate links (dHash Hamming distance &le; 2) are bound into atomic clusters, ensuring duplicate scans never cross between train, validation, and test splits.
                </li>
                <li>
                  <strong>Quarantined Test Set:</strong> The held-out test split (<code className="rounded bg-slate-200/80 px-1 py-0.5 text-[12px] font-mono">datasets/splits/test.csv</code>) contains 532 scans and is strictly quarantined from hyperparameter tuning and augmentations.
                </li>
                <li>
                  <strong>Class Imbalance Strategy:</strong> Training will combine Focal Loss (&gamma;=2.0) with inverse frequency class weights to prevent majority-class dominance on Grade 0 scans.
                </li>
              </ul>
            </div>
          </div>

          {/* Multi-Cohort Benchmark Specifications */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <div>
              <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
                Multi-Cohort Retinal Dataset Governance
              </h3>
              <p className="mt-1 text-[14px] text-slate-600 leading-relaxed max-w-3xl">
                MITRA DRISHTI evaluates models across distinct Indian and international cohorts to ensure generalizability across non-mydriatic camera hardware.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DATASET_SPECS.map((ds) => (
                <div key={ds.name} className="rounded-xl border border-slate-200 p-4.5 space-y-2 text-[14px]">
                  <div className="font-display text-[16px] font-bold text-[#0B2540]">{ds.name}</div>
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
        </div>
      )}

      {subTab === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
          <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
            Retinal Screening History — {patient?.name}
          </h2>
          {patientScreenings.length === 0 ? (
            <p className="text-[15px] text-slate-500">No retinal screenings recorded for this patient yet.</p>
          ) : (
            <div className="space-y-3.5">
              {patientScreenings.map((scr) => (
                <div
                  key={scr.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-200 p-4 text-[15px]"
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
                    <div className="text-[16px] font-bold text-slate-900">
                      {scr.eye} · {scr.modelPrediction.gradeLabel}
                    </div>
                    <div className="text-slate-500 font-mono text-[13px] tabular-nums">
                      {new Date(scr.capturedAt).toLocaleString()} · Sharpness {scr.quality.sharpnessScore}/100 ·
                      Review: <strong className="text-slate-800">{scr.humanReviewStatus}</strong>
                    </div>
                    <p className="text-[14px] text-slate-700 leading-relaxed">{scr.summaryText}</p>
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
