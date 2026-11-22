import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock,
  Filter,
  Flame,
  FlaskConical,
  Heart,
  Sliders,
  Target,
  TrendingDown,
  TrendingUp,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  BootstrapPayload,
  CheckpointRecord,
  LanguageCode,
  LifestyleInput,
} from '../types/domain';
import { evaluateClientExperimentalRisk } from '../utils/riskEngine';

interface PreventModuleProps {
  data: BootstrapPayload;
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  isOnline: boolean;
  onSubmitAssessment: (patientId: string, inputs: LifestyleInput) => Promise<void>;
  onSubmitHabit: (payload: {
    patientId: string;
    date: string;
    healthyIndianDiet: boolean;
    stepsAchieved: number;
    sleepHours: number;
    weightKg?: number;
    waistCm?: number;
    barrierReported?: string;
  }) => Promise<void>;
  onToggleLesson: (patientId: string, lessonId: string) => Promise<void>;
  onCompleteCheckpoint?: (payload: {
    patientId: string;
    day: number;
    weightKg?: number;
    waistCm?: number;
    notes?: string;
  }) => Promise<void>;
  onRegisterPatient: (payload: {
    name: string;
    age: number;
    sex: 'Female' | 'Male' | 'Other';
    phone: string;
    district: string;
    villageOrWard: string;
    language: LanguageCode;
    diabetesStatus: 'at_risk' | 'prediabetes_lab' | 'diagnosed_t2d';
    screeningConsent: boolean;
    dataStorageConsent: boolean;
    offlineCacheConsent: boolean;
    clinicalBoundaryAcknowledged: boolean;
  }) => Promise<void>;
  onRecordLab: (payload: {
    patientId: string;
    testedAt: string;
    hba1cPercent?: number;
    fastingGlucoseMgDl?: number;
    clinicalNotes: string;
  }) => Promise<void>;
}

const QUESTIONS = [
  { key: 'age', title: '1. Age (Years)', desc: 'Age is a non-modifiable baseline risk factor for Type 2 diabetes.' },
  { key: 'dietQuality', title: '2. Typical Daily Diet', desc: 'Select the pattern closest to your regular South/North Indian meals and beverages.' },
  { key: 'sleepHours', title: '3. Nightly Sleep Duration', desc: 'Average hours of sleep per night over the past two weeks.' },
  { key: 'dailySteps', title: '4. Physical Activity & Daily Steps', desc: 'Typical daily walking steps or equivalent brisk activity.' },
  { key: 'weightKg', title: '5. Weight & Height', desc: 'Used to compute Body Mass Index (South Asian screening reference < 23 kg/m²).' },
  { key: 'waistCm', title: '6. Waist Circumference (cm)', desc: 'Measured around the abdomen at navel level; central adiposity is modifiable.' },
  { key: 'familyHistory', title: '7. Family History of Diabetes', desc: 'History of Type 2 diabetes in parents or siblings.' },
  { key: 'smokingStatus', title: '8. Tobacco / Smoking Status', desc: 'Current or past smoking increases vascular and metabolic risk.' },
  { key: 'alcoholUse', title: '9. Alcohol Consumption', desc: 'Frequency of alcoholic beverage intake.' },
] as const;

export const PreventModule: React.FC<PreventModuleProps> = ({
  data,
  selectedPatientId,
  onSelectPatient,
  isOnline,
  onSubmitAssessment,
  onSubmitHabit,
  onToggleLesson,
  onCompleteCheckpoint,
  onRegisterPatient,
  onRecordLab,
}) => {
  const [subTab, setSubTab] = useState<'assessment' | 'whatif' | 'programme' | 'labs' | 'register'>('assessment');
  const [stepIdx, setStepIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const patient =
    data.patients.find((p) => p.id === selectedPatientId) || data.patients[0];
  const patientAssessments = data.assessments.filter((a) => a.patientId === patient?.id);
  const latestAssessment = patientAssessments[0];
  const programme = data.programmes.find((p) => p.patientId === patient?.id);
  const patientHabits = data.habitLogs.filter((h) => h.patientId === patient?.id);
  const patientLabs = data.labs.filter((l) => l.patientId === patient?.id);
  const patientInterventions = data.interventions.filter((i) => i.patientId === patient?.id);

  const [inputs, setInputs] = useState<LifestyleInput>({
    age: patient?.age ?? 36,
    sex: patient?.sex ?? 'Female',
    dietQuality: latestAssessment?.inputs.dietQuality ?? 'moderate_refined',
    sleepHours: latestAssessment?.inputs.sleepHours ?? 7,
    dailySteps: latestAssessment?.inputs.dailySteps ?? 6500,
    weightKg: latestAssessment?.inputs.weightKg ?? 66,
    heightCm: latestAssessment?.inputs.heightCm ?? 164,
    waistCm: latestAssessment?.inputs.waistCm ?? 84,
    familyHistory: latestAssessment?.inputs.familyHistory ?? 'one_parent',
    smokingStatus: latestAssessment?.inputs.smokingStatus ?? 'never',
    alcoholUse: latestAssessment?.inputs.alcoholUse ?? 'none',
  });

  useEffect(() => {
    if (patient) {
      setInputs((prev) => ({
        ...prev,
        age: patient.age,
        sex: patient.sex,
        weightKg: latestAssessment?.inputs.weightKg ?? prev.weightKg,
        waistCm: latestAssessment?.inputs.waistCm ?? prev.waistCm,
      }));
    }
  }, [patient?.id, latestAssessment?.id]);

  // Checkpoint Completion Form State
  const [activeCheckpointModal, setActiveCheckpointModal] = useState<CheckpointRecord | null>(null);
  const [cpWeight, setCpWeight] = useState<number>(programme?.currentWeightKg ?? 60);
  const [cpWaist, setCpWaist] = useState<number>(programme?.currentWaistCm ?? 78);
  const [cpNotes, setCpNotes] = useState<string>('');

  // Curriculum Filter States
  const [lessonPhaseTab, setLessonPhaseTab] = useState<0 | 1 | 2>(1); // Default Phase 1 (Weeks 1-24)
  const [lessonCategoryTab, setLessonCategoryTab] = useState<string>('All');
  const [lessonSearch, setLessonSearch] = useState<string>('');

  const [whatIf, setWhatIf] = useState<LifestyleInput>(inputs);
  const baseEval = useMemo(() => evaluateClientExperimentalRisk(inputs), [inputs]);
  const whatIfEval = useMemo(() => evaluateClientExperimentalRisk(whatIf), [whatIf]);

  const [habitDate, setHabitDate] = useState(new Date().toISOString().slice(0, 10));
  const [habitDiet, setHabitDiet] = useState(true);
  const [habitSteps, setHabitSteps] = useState(7200);
  const [habitSleep, setHabitSleep] = useState(7.5);
  const [habitWeight, setHabitWeight] = useState(programme?.currentWeightKg ?? 60);
  const [habitWaist, setHabitWaist] = useState(programme?.currentWaistCm ?? 78);
  const [habitBarrier, setHabitBarrier] = useState('');

  const [labHba1c, setLabHba1c] = useState('');
  const [labFpg, setLabFpg] = useState('');
  const [labDate, setLabDate] = useState(new Date().toISOString().slice(0, 10));
  const [labNotes, setLabNotes] = useState('');

  const [regForm, setRegForm] = useState({
    name: '',
    age: 42,
    sex: 'Female' as 'Female' | 'Male' | 'Other',
    phone: '+91 ',
    district: 'Chennai South',
    villageOrWard: 'Adyar Urban PHC',
    language: 'en' as LanguageCode,
    diabetesStatus: 'at_risk' as 'at_risk' | 'prediabetes_lab' | 'diagnosed_t2d',
    screeningConsent: false,
    dataStorageConsent: false,
    offlineCacheConsent: true,
    clinicalBoundaryAcknowledged: false,
  });

  const handleSaveAssessment = async () => {
    if (!patient) return;
    setSubmitting(true);
    setBannerMsg(null);
    try {
      await onSubmitAssessment(patient.id, inputs);
      setWhatIf(inputs);
      setBannerMsg({
        type: 'success',
        text: isOnline
          ? 'Lifestyle assessment calculated and saved to backend records.'
          : 'Offline mode: Assessment calculated locally and queued in IndexedDB for sync.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save assessment.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setSubmitting(true);
    setBannerMsg(null);
    try {
      await onSubmitHabit({
        patientId: patient.id,
        date: habitDate,
        healthyIndianDiet: habitDiet,
        stepsAchieved: Number(habitSteps),
        sleepHours: Number(habitSleep),
        weightKg: Number(habitWeight),
        waistCm: Number(habitWaist),
        barrierReported: habitBarrier.trim() || undefined,
      });
      setHabitBarrier('');
      setBannerMsg({
        type: 'success',
        text: isOnline
          ? 'Daily habit logged and adaptive intervention ladder evaluated.'
          : 'Offline mode: Habit log saved to IndexedDB pending queue.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to log habit.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient) return;
    setSubmitting(true);
    setBannerMsg(null);
    try {
      await onRecordLab({
        patientId: patient.id,
        testedAt: labDate,
        hba1cPercent: labHba1c ? Number(labHba1c) : undefined,
        fastingGlucoseMgDl: labFpg ? Number(labFpg) : undefined,
        clinicalNotes: labNotes,
      });
      setLabHba1c('');
      setLabFpg('');
      setLabNotes('');
      setBannerMsg({
        type: 'success',
        text: 'Laboratory result recorded and interpreted per ICMR/ADA reference thresholds.',
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Only authorised doctors/admins may record clinical lab results.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setBannerMsg(null);
    try {
      await onRegisterPatient(regForm);
      setBannerMsg({
        type: 'success',
        text: `Patient ${regForm.name} registered with verified informed consent.`,
      });
      setRegForm((prev) => ({
        ...prev,
        name: '',
        screeningConsent: false,
        dataStorageConsent: false,
        clinicalBoundaryAcknowledged: false,
      }));
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Patient registration failed.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteCp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patient || !activeCheckpointModal || !onCompleteCheckpoint) return;
    setSubmitting(true);
    setBannerMsg(null);
    try {
      await onCompleteCheckpoint({
        patientId: patient.id,
        day: activeCheckpointModal.day,
        weightKg: cpWeight,
        waistCm: cpWaist,
        notes: cpNotes,
      });
      setActiveCheckpointModal(null);
      setBannerMsg({
        type: 'success',
        text: `${activeCheckpointModal.day}-Day Checkpoint recorded successfully.`,
      });
    } catch (err) {
      setBannerMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to complete checkpoint.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openCheckpointForm = (cp: CheckpointRecord) => {
    setActiveCheckpointModal(cp);
    setCpWeight(cp.measurements?.weightKg ?? programme?.currentWeightKg ?? 60);
    setCpWaist(cp.measurements?.waistCm ?? programme?.currentWaistCm ?? 78);
    setCpNotes(cp.measurements?.notes ?? cp.notes ?? '');
  };

  // Accurate longitudinal chart data without fabricating missing weight or waist
  const progressChartData = [...patientHabits]
    .reverse()
    .map((h) => ({
      date: h.date.slice(5),
      steps: Math.round(h.stepsAchieved / 100),
      weight: typeof h.weightKg === 'number' ? h.weightKg : null,
      waist: typeof h.waistCm === 'number' ? h.waistCm : null,
      sleep: h.sleepHours,
    }));

  const recentHabits = patientHabits.slice(0, 7);
  const avgSteps7d =
    recentHabits.length > 0
      ? Math.round(recentHabits.reduce((acc, h) => acc + h.stepsAchieved, 0) / recentHabits.length)
      : null;
  const avgSleep7d =
    recentHabits.length > 0
      ? Number((recentHabits.reduce((acc, h) => acc + h.sleepHours, 0) / recentHabits.length).toFixed(1))
      : null;
  const dietAdherence7d =
    recentHabits.length > 0
      ? Math.round((recentHabits.filter((h) => h.healthyIndianDiet).length / recentHabits.length) * 100)
      : null;
  const loggingStreakDays = patientHabits.length;

  const filteredLessons = useMemo(() => {
    return (programme?.lessons || []).filter((l) => {
      if (lessonPhaseTab !== 0 && l.phase !== lessonPhaseTab) return false;
      if (lessonCategoryTab !== 'All' && l.category !== lessonCategoryTab) return false;
      if (lessonSearch.trim()) {
        const q = lessonSearch.toLowerCase();
        return (
          l.title.toLowerCase().includes(q) ||
          (l.titleTa && l.titleTa.toLowerCase().includes(q)) ||
          l.summary.toLowerCase().includes(q) ||
          String(l.week).includes(q)
        );
      }
      return true;
    });
  }, [programme?.lessons, lessonPhaseTab, lessonCategoryTab, lessonSearch]);

  const completedLessonsCount = (programme?.lessons || []).filter((l) => l.completed).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#0F766E]">
            Pillar One · Type 2 Diabetes Lifestyle Risk &amp; 12-Month Prevention
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0B2540]">
            PREVENT — Risk Assessment &amp; Prevention Programme
          </h1>
        </div>

        {data.patients.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="prevent-patient-select" className="text-xs font-semibold text-slate-600">
              Active Patient:
            </label>
            <select
              id="prevent-patient-select"
              value={patient?.id || ''}
              onChange={(e) => onSelectPatient(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-[#0D9488] focus:outline-none"
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

      <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-200/70 p-1">
        {[
          { id: 'assessment', label: '9-Input Risk Assessment', icon: ClipboardCheck },
          { id: 'whatif', label: 'What-If Simulator', icon: Sliders },
          { id: 'programme', label: '12-Month Programme & Habits', icon: Activity },
          { id: 'labs', label: 'Clinical Testing (HbA1c/FPG)', icon: FlaskConical },
          { id: 'register', label: 'Patient Registration & Consent', icon: UserPlus },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSubTab(tab.id as typeof subTab);
                setBannerMsg(null);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                active ? 'bg-white text-[#0B2540] shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-[#0D9488]" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {bannerMsg && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            bannerMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {bannerMsg.text}
        </div>
      )}

      {!isOnline && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950">
          <WifiOff className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            <strong>Offline-First Active:</strong> 9-input lifestyle assessments, What-If simulations, and daily habit logs save locally in Dexie IndexedDB and synchronize automatically once connectivity returns.
          </span>
        </div>
      )}

      {subTab === 'assessment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
              <span className="font-semibold text-[#0F766E]">
                Step {stepIdx + 1} of {QUESTIONS.length}
              </span>
              <span className="font-mono tabular-nums">
                {Math.round(((stepIdx + 1) / QUESTIONS.length) * 100)}% complete
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-6">
              <div
                className="h-full rounded-full bg-[#0D9488] transition-all duration-200"
                style={{ width: `${((stepIdx + 1) / QUESTIONS.length) * 100}%` }}
              />
            </div>

            <h2 className="font-display text-lg font-bold text-[#0B2540]">
              {QUESTIONS[stepIdx].title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{QUESTIONS[stepIdx].desc}</p>

            <div className="mt-6 min-h-[150px]">
              {stepIdx === 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Age</span>
                    <span className="font-mono text-lg font-bold text-[#0B2540] tabular-nums">
                      {inputs.age} years
                    </span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={85}
                    value={inputs.age}
                    onChange={(e) => setInputs({ ...inputs, age: Number(e.target.value) })}
                    className="w-full accent-[#0D9488]"
                  />
                </div>
              )}

              {stepIdx === 1 && (
                <div className="space-y-2.5">
                  {[
                    {
                      val: 'balanced_traditional',
                      label: 'Balanced Traditional Indian Meals',
                      sub: 'Daily vegetables (poriyal/kootu), dal/pulses, millets or moderate whole grains, minimal sugary drinks.',
                    },
                    {
                      val: 'moderate_refined',
                      label: 'Moderate Refined Carbohydrates',
                      sub: 'Mostly polished white rice/refined flour with occasional sweetened tea/coffee or snacks.',
                    },
                    {
                      val: 'high_refined_sugars',
                      label: 'High Refined Carbs / Sugary Snacks',
                      sub: 'Frequent sweetened drinks, deep-fried snacks, bakery items, and low vegetable/fibre intake.',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        setInputs({
                          ...inputs,
                          dietQuality: opt.val as LifestyleInput['dietQuality'],
                        })
                      }
                      className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                        inputs.dietQuality === opt.val
                          ? 'border-[#0D9488] bg-teal-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-900">{opt.label}</div>
                      <div className="mt-0.5 text-xs text-slate-600">{opt.sub}</div>
                    </button>
                  ))}
                </div>
              )}

              {stepIdx === 2 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Nightly Sleep</span>
                    <span className="font-mono text-lg font-bold text-[#0B2540] tabular-nums">
                      {inputs.sleepHours} hours
                    </span>
                  </div>
                  <input
                    type="range"
                    min={4}
                    max={11}
                    step={0.5}
                    value={inputs.sleepHours}
                    onChange={(e) => setInputs({ ...inputs, sleepHours: Number(e.target.value) })}
                    className="w-full accent-[#0D9488]"
                  />
                </div>
              )}

              {stepIdx === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Average Daily Steps</span>
                    <span className="font-mono text-lg font-bold text-[#0B2540] tabular-nums">
                      {inputs.dailySteps.toLocaleString()} steps/day
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1000}
                    max={15000}
                    step={250}
                    value={inputs.dailySteps}
                    onChange={(e) => setInputs({ ...inputs, dailySteps: Number(e.target.value) })}
                    className="w-full accent-[#0D9488]"
                  />
                </div>
              )}

              {stepIdx === 4 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      min={30}
                      max={200}
                      value={inputs.weightKg}
                      onChange={(e) => setInputs({ ...inputs, weightKg: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Height (cm)</label>
                    <input
                      type="number"
                      min={120}
                      max={220}
                      value={inputs.heightCm}
                      onChange={(e) => setInputs({ ...inputs, heightCm: Number(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                    />
                  </div>
                  <div className="sm:col-span-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2.5 text-xs text-slate-700">
                    Calculated BMI: <strong className="font-mono tabular-nums">{baseEval.bmi} kg/m²</strong>
                  </div>
                </div>
              )}

              {stepIdx === 5 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600">Waist Circumference</span>
                    <span className="font-mono text-lg font-bold text-[#0B2540] tabular-nums">
                      {inputs.waistCm} cm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={140}
                    value={inputs.waistCm}
                    onChange={(e) => setInputs({ ...inputs, waistCm: Number(e.target.value) })}
                    className="w-full accent-[#0D9488]"
                  />
                </div>
              )}

              {stepIdx === 6 && (
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { val: 'none', label: 'No known family history of Type 2 diabetes' },
                    { val: 'one_parent', label: 'One parent has Type 2 diabetes' },
                    { val: 'both_parents_or_sibling', label: 'Both parents or a sibling have Type 2 diabetes' },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() =>
                        setInputs({
                          ...inputs,
                          familyHistory: opt.val as LifestyleInput['familyHistory'],
                        })
                      }
                      className={`rounded-xl border p-3.5 text-left text-sm font-medium ${
                        inputs.familyHistory === opt.val
                          ? 'border-[#0D9488] bg-teal-50/50 text-[#0B2540]'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {stepIdx === 7 && (
                <div className="grid grid-cols-3 gap-2.5">
                  {(['never', 'former', 'current'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setInputs({ ...inputs, smokingStatus: val })}
                      className={`rounded-xl border p-3.5 text-center text-sm font-semibold capitalize ${
                        inputs.smokingStatus === val
                          ? 'border-[#0D9488] bg-teal-50/50 text-[#0B2540]'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              )}

              {stepIdx === 8 && (
                <div className="grid grid-cols-3 gap-2.5">
                  {(['none', 'occasional', 'regular'] as const).map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setInputs({ ...inputs, alcoholUse: val })}
                      className={`rounded-xl border p-3.5 text-center text-sm font-semibold capitalize ${
                        inputs.alcoholUse === val
                          ? 'border-[#0D9488] bg-teal-50/50 text-[#0B2540]'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={stepIdx === 0}
                onClick={() => setStepIdx((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              {stepIdx < QUESTIONS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStepIdx((s) => Math.min(QUESTIONS.length - 1, s + 1))}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B2540] px-5 py-2 text-xs font-semibold text-white hover:bg-[#113556]"
                >
                  Next Question
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSaveAssessment()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#0D9488] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {submitting
                    ? 'Saving...'
                    : isOnline
                    ? 'Save Assessment Result'
                    : 'Save Offline to Queue'}
                </button>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="text-[11px] font-semibold text-amber-800">
                {baseEval.scoringModelLabel}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="font-display text-3xl font-bold text-[#0B2540] tabular-nums">
                    {baseEval.experimentalScore}
                    <span className="text-base font-normal text-slate-400"> / 100</span>
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-[#0F766E]">
                    {baseEval.riskCategory} Lifestyle Risk Tier
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs text-slate-600 leading-relaxed">{baseEval.explanation}</p>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-[#0B2540] mb-2">
                  Top 3 Modifiable Risk Factors
                </div>
                <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700">
                  {baseEval.topModifiableFactors.map((f) => (
                    <li key={f} className="font-medium">
                      {f}
                    </li>
                  ))}
                </ol>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
                <div className="text-xs font-bold text-[#0B2540]">Contributing Factor Breakdown</div>
                {baseEval.contributions.slice(0, 6).map((c) => (
                  <div key={c.factor} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">
                        {c.factor} {c.modifiable ? '(Modifiable)' : '(Baseline)'}
                      </span>
                      <span className="font-mono tabular-nums text-slate-500">
                        {c.points}/{c.maxPoints}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-[#0D9488]"
                        style={{ width: `${(c.points / c.maxPoints) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-bold text-[#0B2540]">Recommended Next Steps</h3>
              <ul className="mt-2.5 space-y-2 text-xs text-slate-700">
                {baseEval.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {subTab === 'whatif' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-[#0B2540]">
                Interactive What-If Lifestyle Explorer
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Illustrative scenario only — not a medical diagnosis or validated clinical prognosis. Adjust modifiable habits to observe experimental score changes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setWhatIf(inputs)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0"
            >
              Reset to Baseline
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Daily Steps</span>
                  <span className="font-mono tabular-nums">{whatIf.dailySteps.toLocaleString()} steps</span>
                </div>
                <input
                  type="range"
                  min={1500}
                  max={14000}
                  step={500}
                  value={whatIf.dailySteps}
                  onChange={(e) => setWhatIf({ ...whatIf, dailySteps: Number(e.target.value) })}
                  className="w-full accent-[#0D9488]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Nightly Sleep</span>
                  <span className="font-mono tabular-nums">{whatIf.sleepHours} hrs</span>
                </div>
                <input
                  type="range"
                  min={4.5}
                  max={9.5}
                  step={0.5}
                  value={whatIf.sleepHours}
                  onChange={(e) => setWhatIf({ ...whatIf, sleepHours: Number(e.target.value) })}
                  className="w-full accent-[#0D9488]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Target Weight</span>
                  <span className="font-mono tabular-nums">{whatIf.weightKg} kg</span>
                </div>
                <input
                  type="range"
                  min={45}
                  max={120}
                  value={whatIf.weightKg}
                  onChange={(e) => setWhatIf({ ...whatIf, weightKg: Number(e.target.value) })}
                  className="w-full accent-[#0D9488]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Target Waist Circumference</span>
                  <span className="font-mono tabular-nums">{whatIf.waistCm} cm</span>
                </div>
                <input
                  type="range"
                  min={65}
                  max={130}
                  value={whatIf.waistCm}
                  onChange={(e) => setWhatIf({ ...whatIf, waistCm: Number(e.target.value) })}
                  className="w-full accent-[#0D9488]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dietary Pattern Shift</label>
                <select
                  value={whatIf.dietQuality}
                  onChange={(e) =>
                    setWhatIf({
                      ...whatIf,
                      dietQuality: e.target.value as LifestyleInput['dietQuality'],
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium"
                >
                  <option value="balanced_traditional">Balanced Traditional Indian Meals (Millets, Greens, Dal)</option>
                  <option value="moderate_refined">Moderate Refined Carbs</option>
                  <option value="high_refined_sugars">High Refined Carbs &amp; Sugary Drinks</option>
                </select>
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-white border border-slate-200 p-4">
                  <div className="text-[11px] font-semibold text-slate-500">Current Score</div>
                  <div className="mt-1 font-display text-2xl font-bold text-slate-800 tabular-nums">
                    {baseEval.experimentalScore}
                  </div>
                  <div className="text-xs text-slate-500">{baseEval.riskCategory}</div>
                </div>
                <div className="rounded-xl bg-white border border-[#0D9488] p-4">
                  <div className="text-[11px] font-semibold text-[#0F766E]">Simulated Score</div>
                  <div className="mt-1 font-display text-2xl font-bold text-[#0F766E] tabular-nums">
                    {whatIfEval.experimentalScore}
                  </div>
                  <div className="text-xs text-[#0F766E] font-medium">{whatIfEval.riskCategory}</div>
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200 p-4 text-xs text-slate-700">
                <strong>Illustrative Change:</strong>{' '}
                <span className="font-mono font-bold tabular-nums">
                  {whatIfEval.experimentalScore - baseEval.experimentalScore > 0 ? '+' : ''}
                  {whatIfEval.experimentalScore - baseEval.experimentalScore} points
                </span>{' '}
                (Projected BMI <span className="font-mono tabular-nums">{whatIfEval.bmi}</span> kg/m²).
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'programme' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-base font-bold text-[#0B2540]">
                    12-Month Prevention Roadmap
                  </h2>
                  <p className="text-xs text-slate-500">
                    Phase 1: Learning (Months 1–6) · Phase 2: Maintenance (Months 7–12)
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-[#0F766E] tabular-nums">
                  Month {programme?.currentMonth ?? 1} / 12 · Adherence {programme?.adherencePercent ?? 50}%
                </span>
              </div>

              {/* Checkpoint Milestone Cards */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                {(programme?.checkpoints || []).map((cp) => (
                  <div
                    key={cp.day}
                    className={`rounded-xl border p-3 text-xs transition-all flex flex-col justify-between ${
                      cp.status === 'completed'
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : cp.status === 'due'
                        ? 'border-amber-300 bg-amber-50/70 shadow-sm'
                        : cp.status === 'missed'
                        ? 'border-rose-300 bg-rose-50/70'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-slate-900">{cp.title || cp.label}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold capitalize ${
                            cp.status === 'completed'
                              ? 'bg-emerald-200/60 text-emerald-800'
                              : cp.status === 'due'
                              ? 'bg-amber-200/80 text-amber-900 animate-pulse'
                              : cp.status === 'missed'
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-slate-200/60 text-slate-700'
                          }`}
                        >
                          {cp.status}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 font-mono">
                        Due: {cp.dueDate}
                      </div>
                      {cp.completedAt && (
                        <div className="text-[10px] text-emerald-700">
                          Completed: {cp.completedAt.slice(0, 10)}
                        </div>
                      )}
                      {cp.baselineComparison?.summary && (
                        <div className="mt-1.5 rounded bg-emerald-100/70 p-1.5 text-[10px] font-medium text-emerald-800">
                          {cp.baselineComparison.summary}
                        </div>
                      )}
                    </div>

                    {!cp.completed && (cp.status === 'due' || cp.status === 'missed') && onCompleteCheckpoint && (
                      <button
                        type="button"
                        onClick={() => openCheckpointForm(cp)}
                        className="mt-2.5 w-full rounded-lg bg-[#0D9488] py-1 text-[11px] font-semibold text-white hover:bg-[#0F766E] shadow-sm transition-colors"
                      >
                        Complete Checkpoint
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Checkpoint Completion Form / Drawer */}
              {activeCheckpointModal && (
                <form
                  onSubmit={handleCompleteCp}
                  className="mt-4 rounded-xl border border-teal-300 bg-teal-50/50 p-4 text-xs space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-teal-200/70 pb-2">
                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4 text-[#0D9488]" />
                      <span className="font-bold text-[#0B2540]">
                        Record {activeCheckpointModal.day}-Day Checkpoint ({activeCheckpointModal.title || activeCheckpointModal.label})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCheckpointModal(null)}
                      className="text-slate-500 hover:text-slate-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Weight (kg) · Baseline: {programme?.baselineWeightKg ?? '—'} kg
                      </label>
                      <input
                        type="number"
                        step={0.1}
                        min={25}
                        max={250}
                        required
                        value={cpWeight}
                        onChange={(e) => setCpWeight(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono"
                      />
                      {programme && (
                        <div className="mt-1 text-[10px] font-mono font-medium text-slate-600">
                          Change vs baseline:{' '}
                          <span
                            className={
                              cpWeight <= programme.baselineWeightKg
                                ? 'text-emerald-700 font-bold'
                                : 'text-amber-700 font-bold'
                            }
                          >
                            {(cpWeight - programme.baselineWeightKg).toFixed(1)} kg
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Waist (cm) · Baseline: {programme?.baselineWaistCm ?? '—'} cm
                      </label>
                      <input
                        type="number"
                        step={0.5}
                        min={45}
                        max={180}
                        required
                        value={cpWaist}
                        onChange={(e) => setCpWaist(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono"
                      />
                      {programme && (
                        <div className="mt-1 text-[10px] font-mono font-medium text-slate-600">
                          Change vs baseline:{' '}
                          <span
                            className={
                              cpWaist <= programme.baselineWaistCm
                                ? 'text-emerald-700 font-bold'
                                : 'text-amber-700 font-bold'
                            }
                          >
                            {(cpWaist - programme.baselineWaistCm).toFixed(1)} cm
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Checkpoint Observations &amp; Clinical Notes
                    </label>
                    <input
                      type="text"
                      value={cpNotes}
                      onChange={(e) => setCpNotes(e.target.value)}
                      placeholder="e.g. Consistent millet breakfast swaps, evening walks maintained without joint pain"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveCheckpointModal(null)}
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-lg bg-[#0D9488] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50"
                    >
                      {submitting ? 'Saving Checkpoint...' : 'Submit & Complete Checkpoint'}
                    </button>
                  </div>
                </form>
              )}

              {/* Longitudinal Progress Chart with Steps, Weight, and Waist */}
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-bold text-slate-800">
                    Longitudinal Trajectory: Steps, Weight &amp; Waist
                  </div>
                  <div className="flex items-center gap-3 text-[11px] font-medium">
                    <span className="flex items-center gap-1 text-[#0B2540]">
                      <span className="h-2 w-2 rounded-full bg-[#0B2540]" /> Weight (kg)
                    </span>
                    <span className="flex items-center gap-1 text-[#0D9488]">
                      <span className="h-2 w-2 rounded-full bg-[#0D9488]" /> Waist (cm)
                    </span>
                    <span className="flex items-center gap-1 text-[#2563EB]">
                      <span className="h-2 w-2 rounded-full bg-[#2563EB]" /> Steps (×100)
                    </span>
                  </div>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={progressChartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                      <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                      <Line
                        type="monotone"
                        dataKey="weight"
                        name="Weight (kg)"
                        stroke="#0B2540"
                        strokeWidth={2}
                        connectNulls={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="waist"
                        name="Waist (cm)"
                        stroke="#0D9488"
                        strokeWidth={2}
                        connectNulls={true}
                      />
                      <Line
                        type="monotone"
                        dataKey="steps"
                        name="Steps (×100)"
                        stroke="#2563EB"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Longitudinal Health Metrics Grid */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-100">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                    <Flame className="h-3.5 w-3.5 text-blue-600" />
                    <span>7-Day Steps Avg</span>
                  </div>
                  <div className="mt-1 font-display text-lg font-bold text-slate-900 tabular-nums">
                    {avgSteps7d !== null ? `${avgSteps7d.toLocaleString()} /day` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500">Benchmark: 7,000+</div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                    <Clock className="h-3.5 w-3.5 text-indigo-600" />
                    <span>7-Day Sleep Avg</span>
                  </div>
                  <div className="mt-1 font-display text-lg font-bold text-slate-900 tabular-nums">
                    {avgSleep7d !== null ? `${avgSleep7d} hrs` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500">Target: 7–8.5 hrs</div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                    <Heart className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Plate Adherence</span>
                  </div>
                  <div className="mt-1 font-display text-lg font-bold text-emerald-700 tabular-nums">
                    {dietAdherence7d !== null ? `${dietAdherence7d}%` : '—'}
                  </div>
                  <div className="text-[10px] text-slate-500">Traditional Plate</div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] font-medium">
                    <CheckSquare className="h-3.5 w-3.5 text-teal-600" />
                    <span>Habit Streak</span>
                  </div>
                  <div className="mt-1 font-display text-lg font-bold text-slate-900 tabular-nums">
                    {loggingStreakDays} days
                  </div>
                  <div className="text-[10px] text-slate-500">Consecutive log active</div>
                </div>
              </div>

              {/* Baseline vs Latest Measurements & Historical Score Timeline */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5">
                  <div className="font-bold text-slate-800">Baseline vs. Latest Trajectory</div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600">Body Weight:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {programme?.baselineWeightKg ?? '—'} kg → {programme?.currentWeightKg ?? '—'} kg
                      {programme && programme.currentWeightKg && programme.baselineWeightKg && (
                        <span className="ml-1 text-emerald-700">
                          ({(programme.currentWeightKg - programme.baselineWeightKg).toFixed(1)} kg)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-600">Central Waist:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {programme?.baselineWaistCm ?? '—'} cm → {programme?.currentWaistCm ?? '—'} cm
                      {programme && programme.currentWaistCm && programme.baselineWaistCm && (
                        <span className="ml-1 text-emerald-700">
                          ({(programme.currentWaistCm - programme.baselineWaistCm).toFixed(1)} cm)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1.5">
                  <div className="font-bold text-slate-800">Historical Assessment Timeline</div>
                  {patientAssessments.slice(0, 3).map((a, idx) => (
                    <div key={a.id} className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-600 font-mono">
                        {a.assessedAt.slice(0, 10)} {idx === 0 ? '(Latest)' : idx === patientAssessments.length - 1 ? '(Baseline)' : ''}
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {a.experimentalScore}/100 ({a.riskCategory})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Complete 52-Week Curriculum Component */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-[#0D9488]" />
                    <h2 className="font-display text-base font-bold text-[#0B2540]">
                      52-Week Indian Nutrition &amp; Prevention Curriculum
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Structured 12-month curriculum: Phase 1 (Weeks 1–24) &amp; Phase 2 (Weeks 25–52)
                  </p>
                </div>
                <div className="rounded-xl bg-teal-50 border border-teal-200 px-3 py-1.5 text-right">
                  <div className="text-[11px] font-bold text-teal-900">
                    {completedLessonsCount} of 52 weeks completed
                  </div>
                  <div className="mt-1 h-1.5 w-32 bg-teal-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 rounded-full transition-all"
                      style={{ width: `${Math.round((completedLessonsCount / 52) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Phase Tabs & Category Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setLessonPhaseTab(1)}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      lessonPhaseTab === 1 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Phase 1 (Weeks 1–24)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonPhaseTab(2)}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      lessonPhaseTab === 2 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Phase 2 (Weeks 25–52)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLessonPhaseTab(0)}
                    className={`rounded-md px-3 py-1 transition-colors ${
                      lessonPhaseTab === 0 ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All 52 Weeks
                  </button>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  {['All', 'Indian Nutrition', 'Physical Activity', 'Sleep & Stress', 'Monitoring'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setLessonCategoryTab(cat)}
                      className={`rounded-full px-2.5 py-0.5 font-medium transition-colors whitespace-nowrap ${
                        lessonCategoryTab === cat
                          ? 'bg-[#0B2540] text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lesson Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search lessons by topic, millet, exercise, or Tamil keywords..."
                  value={lessonSearch}
                  onChange={(e) => setLessonSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Lessons List */}
              <div className="divide-y divide-slate-100 max-h-[580px] overflow-y-auto pr-1">
                {filteredLessons.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No lessons found matching the selected filters.
                  </div>
                ) : (
                  filteredLessons.map((les) => (
                    <div key={les.id} className="py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-bold text-slate-800">Week {les.week}</span>
                            <span>·</span>
                            <span>Phase {les.phase} ({les.phase === 1 ? 'Learning' : 'Maintenance'})</span>
                            <span>·</span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {les.category}
                            </span>
                            <span>·</span>
                            <span>{les.durationMinutes} min</span>
                          </div>

                          <div className="text-sm font-bold text-slate-900 mt-1">
                            {les.title}
                          </div>
                          <div className="text-xs font-medium text-[#0F766E] mt-0.5">
                            {les.titleTa}
                          </div>

                          <p className="mt-1 text-xs text-slate-600">{les.summary}</p>
                          {les.summaryTa && (
                            <p className="mt-0.5 text-xs text-slate-500 italic">{les.summaryTa}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => patient && void onToggleLesson(patient.id, les.id)}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                            les.completed
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-[#0B2540] text-white hover:bg-[#113556]'
                          }`}
                        >
                          {les.completed ? '✓ Completed' : 'Mark Done'}
                        </button>
                      </div>

                      {/* Practical Activity & Measurable Target Cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        {les.practicalActivity && (
                          <div className="rounded-lg bg-teal-50/70 border border-teal-100 p-2 flex items-start gap-1.5 text-teal-900">
                            <Activity className="h-3.5 w-3.5 text-teal-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Activity: </span>
                              {les.practicalActivity}
                            </div>
                          </div>
                        )}
                        {les.measurableHabitTarget && (
                          <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-2 flex items-start gap-1.5 text-blue-900">
                            <Target className="h-3.5 w-3.5 text-blue-700 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Weekly Target: </span>
                              {les.measurableHabitTarget}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-5">
            <form
              onSubmit={handleSaveHabit}
              className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3.5"
            >
              <h2 className="font-display text-base font-bold text-[#0B2540]">
                Log Daily Habits &amp; Weekly Check-In
              </h2>
              <p className="text-xs text-slate-500">
                Works offline via IndexedDB. Reporting a barrier or low steps automatically evaluates the deterministic intervention ladder.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={habitDate}
                    onChange={(e) => setHabitDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Steps Achieved</label>
                  <input
                    type="number"
                    min={0}
                    max={40000}
                    value={habitSteps}
                    onChange={(e) => setHabitSteps(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sleep (hrs)</label>
                  <input
                    type="number"
                    step={0.5}
                    min={3}
                    max={14}
                    value={habitSleep}
                    onChange={(e) => setHabitSleep(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={habitWeight}
                    onChange={(e) => setHabitWeight(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Waist (cm)</label>
                  <input
                    type="number"
                    step={0.5}
                    value={habitWaist}
                    onChange={(e) => setHabitWaist(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs font-mono tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={habitDiet}
                  onChange={(e) => setHabitDiet(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#0D9488]"
                />
                Followed balanced Indian plate (vegetables + dal + controlled rice/millet)
              </label>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Barriers or Symptoms (Optional — e.g., &quot;rain&quot;, &quot;shift fatigue&quot;, or &quot;blurred vision&quot;)
                </label>
                <input
                  type="text"
                  value={habitBarrier}
                  onChange={(e) => setHabitBarrier(e.target.value)}
                  placeholder="Share any challenge so your coach can adapt activities"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#0D9488] py-2.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60"
              >
                {submitting ? 'Logging...' : isOnline ? 'Log Daily Check-In' : 'Queue Habit Log Offline'}
              </button>
            </form>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-bold text-[#0B2540]">
                Deterministic Adaptive Intervention Ladder
              </h3>
              <p className="mt-1 text-[11px] text-slate-500">
                Clinical escalations use strict deterministic rules. Experimental educational message selection is isolated to pre-approved coaching tips only.
              </p>

              <div className="mt-3 space-y-2.5">
                {patientInterventions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No active barrier interventions triggered. Try logging &lt; 4,000 steps or a barrier note to test the ladder.
                  </p>
                ) : (
                  patientInterventions.slice(0, 4).map((intv) => (
                    <div
                      key={intv.id}
                      className={`rounded-xl border p-3 text-xs ${
                        intv.actionType === 'clinician_escalation'
                          ? 'border-rose-200 bg-rose-50/70'
                          : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">
                        Step {intv.ladderStep} · {intv.triggerRule}
                      </div>
                      <p className="mt-1 text-slate-700">{intv.recommendedMessage}</p>
                      {intv.experimentalBanditArm && (
                        <div className="mt-1.5 text-[11px] text-[#0F766E]">
                          {intv.experimentalBanditArm}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'labs' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-display text-base font-bold text-[#0B2540]">
                Clinical Laboratory Testing Guidance
              </h2>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Lifestyle risk assessments can highlight modifiable habits, but <strong>never diagnose diabetes</strong>. Diagnostic confirmation requires laboratory blood testing ordered and interpreted by an authorised healthcare professional.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-bold text-[#0B2540]">HbA1c (Glycated Haemoglobin)</div>
                  <ul className="mt-2 space-y-1 text-slate-600 font-mono text-[11px]">
                    <li>Normal reference: &lt; 5.7%</li>
                    <li>Prediabetes range: 5.7% – 6.4%</li>
                    <li>Diabetes threshold: ≥ 6.5%</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="font-bold text-[#0B2540]">Fasting Plasma Glucose (FPG)</div>
                  <ul className="mt-2 space-y-1 text-slate-600 font-mono text-[11px]">
                    <li>Normal reference: &lt; 100 mg/dL</li>
                    <li>Impaired fasting: 100 – 125 mg/dL</li>
                    <li>Diabetes threshold: ≥ 126 mg/dL</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="font-display text-sm font-bold text-[#0B2540] mb-3">
                Recorded Laboratory History ({patient?.name})
              </h3>
              {patientLabs.length === 0 ? (
                <p className="text-xs text-slate-500">No laboratory records entered yet.</p>
              ) : (
                <div className="space-y-3">
                  {patientLabs.map((lab) => (
                    <div key={lab.id} className="rounded-xl border border-slate-200 p-3.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[#0B2540] tabular-nums">
                          HbA1c: {lab.hba1cPercent ?? '—'}% · FPG: {lab.fastingGlucoseMgDl ?? '—'} mg/dL
                        </span>
                        <span className="text-slate-500">
                          {lab.testedAt.slice(0, 10)} · Recorded by {lab.recordedByName}
                        </span>
                      </div>
                      <p className="mt-1.5 text-slate-700 font-medium">{lab.guidelineInterpretation}</p>
                      {lab.clinicalNotes && (
                        <p className="mt-1 text-slate-500">Clinician notes: {lab.clinicalNotes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="font-display text-base font-bold text-[#0B2540]">
              Record Laboratory Result (Clinician Only)
            </h3>
            {data.user.role === 'patient' ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-950 flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>Role Permission Boundary:</strong> Only authorised Doctors or Administrators may enter laboratory diagnostic values. Switch to the <strong>Doctor</strong> demo role in the top bar to test clinician lab recording.
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveLab} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Test Date</label>
                  <input
                    type="date"
                    required
                    value={labDate}
                    onChange={(e) => setLabDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">HbA1c (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="3.5"
                      max="18"
                      value={labHba1c}
                      onChange={(e) => setLabHba1c(e.target.value)}
                      placeholder="e.g., 6.4"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">FPG (mg/dL)</label>
                    <input
                      type="number"
                      min="40"
                      max="600"
                      value={labFpg}
                      onChange={(e) => setLabFpg(e.target.value)}
                      placeholder="e.g., 118"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Clinician Interpretation Notes
                  </label>
                  <textarea
                    rows={3}
                    value={labNotes}
                    onChange={(e) => setLabNotes(e.target.value)}
                    placeholder="Document guideline context and follow-up plan..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || !isOnline}
                  className="w-full rounded-xl bg-[#0B2540] py-2.5 text-xs font-semibold text-white hover:bg-[#113556] disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Clinician Lab Record'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {subTab === 'register' && (
        <form
          onSubmit={handleRegister}
          className="rounded-2xl border border-slate-200 bg-white p-6 max-w-3xl space-y-4"
        >
          <div>
            <h2 className="font-display text-lg font-bold text-[#0B2540]">
              Patient Registration &amp; Informed Consent
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Creates a shared longitudinal patient record across Prevent, Detect, and Protect. Primary languages: English and Tamil (Hindi ready).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                minLength={2}
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                placeholder="e.g., Muthuvel Krishnan"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                <input
                  type="number"
                  required
                  min={18}
                  max={100}
                  value={regForm.age}
                  onChange={(e) => setRegForm({ ...regForm, age: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sex</label>
                <select
                  value={regForm.sex}
                  onChange={(e) =>
                    setRegForm({ ...regForm, sex: e.target.value as 'Female' | 'Male' | 'Other' })
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
              <input
                type="text"
                required
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Language</label>
              <select
                value={regForm.language}
                onChange={(e) =>
                  setRegForm({ ...regForm, language: e.target.value as LanguageCode })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="hi">हिन्दी (Hindi Scaffold)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
              <input
                type="text"
                required
                value={regForm.district}
                onChange={(e) => setRegForm({ ...regForm, district: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PHC / Ward / Village</label>
              <input
                type="text"
                required
                value={regForm.villageOrWard}
                onChange={(e) => setRegForm({ ...regForm, villageOrWard: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Baseline Clinical Status (Recorded by Patient/Clinician)
            </label>
            <select
              value={regForm.diabetesStatus}
              onChange={(e) =>
                setRegForm({
                  ...regForm,
                  diabetesStatus: e.target.value as 'at_risk' | 'prediabetes_lab' | 'diagnosed_t2d',
                })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="at_risk">Lifestyle Prevention Cohort (No Diabetes Diagnosis)</option>
              <option value="prediabetes_lab">Prediabetes (Lab Confirmed by Clinician)</option>
              <option value="diagnosed_t2d">Already Diagnosed with Type 2 Diabetes (Eligible for Retinal Screening)</option>
            </select>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-xs text-slate-700">
            <div className="font-bold text-[#0B2540]">Mandatory Informed Consent</div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={regForm.screeningConsent}
                onChange={(e) => setRegForm({ ...regForm, screeningConsent: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[#0D9488]"
              />
              <span>I consent to participate in lifestyle risk screening and prevention programme tracking.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={regForm.dataStorageConsent}
                onChange={(e) => setRegForm({ ...regForm, dataStorageConsent: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[#0D9488]"
              />
              <span>I consent to longitudinal record storage shared with my assigned healthcare team.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={regForm.offlineCacheConsent}
                onChange={(e) => setRegForm({ ...regForm, offlineCacheConsent: e.target.checked })}
                className="mt-0.5 h-4 w-4 accent-[#0D9488]"
              />
              <span>Allow minimized local IndexedDB caching for offline habit tracking.</span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={regForm.clinicalBoundaryAcknowledged}
                onChange={(e) =>
                  setRegForm({ ...regForm, clinicalBoundaryAcknowledged: e.target.checked })
                }
                className="mt-0.5 h-4 w-4 accent-[#0D9488]"
              />
              <span>
                I understand Mritidhristi is a non-diagnostic screening prototype and does not replace physician diagnosis.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={submitting || !isOnline}
            className="rounded-xl bg-[#0D9488] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[#0F766E] disabled:opacity-50"
          >
            {submitting ? 'Registering...' : 'Register Patient & Create Programme'}
          </button>
        </form>
      )}
    </div>
  );
};
