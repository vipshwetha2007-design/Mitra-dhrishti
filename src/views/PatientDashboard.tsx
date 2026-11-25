import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart2,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Lightbulb,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wifi,
  Zap,
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
import type { AppNavView, BootstrapPayload } from '../types/domain';
import type { TranslationBundle } from '../i18n/translations';
import { FundusVisualizer } from '../components/FundusVisualizer';

const HealthOverviewTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-slate-200/90 bg-white/95 p-3.5 shadow-lg backdrop-blur-xs text-[13px] min-w-[170px]">
        <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-100">
          <span className="font-bold text-[14px] text-[#0B2540]">{label} 2026</span>
          <span className="text-[12px] text-slate-500 font-medium">Health Data</span>
        </div>
        <div className="space-y-1.5">
          {payload.map((entry: any) => {
            const isRisk = entry.dataKey === 'riskScore';
            const unit = isRisk ? 'pts' : '%';
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-3 text-slate-700">
                <span className="flex items-center gap-1.5 text-[13px] font-medium">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                  {entry.name}:
                </span>
                <span className="font-bold font-mono text-[14px] text-slate-900">
                  {entry.value !== undefined && entry.value !== null ? `${entry.value} ${unit}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

interface PatientDashboardProps {
  data: BootstrapPayload;
  t: TranslationBundle;
  isOnline: boolean;
  pendingSyncCount: number;
  onNavigate: (view: AppNavView) => void;
  onSyncNow: () => void;
}

export const PatientDashboard: React.FC<PatientDashboardProps> = ({
  data,
  t,
  isOnline,
  pendingSyncCount,
  onNavigate,
  onSyncNow,
}) => {
  const [range, setRange] = useState<'6m' | '3m'>('6m');
  const [showGradCamPreview, setShowGradCamPreview] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState({
    riskScore: true,
    activity: true,
    sleep: true,
  });

  const toggleSeries = (key: 'riskScore' | 'activity' | 'sleep') => {
    setVisibleSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next.riskScore && !next.activity && !next.sleep) {
        return prev;
      }
      return next;
    });
  };

  // 1. Patient-specific record retrieval
  const patient = data.patients.find((p) => p.id === data.user.patientId) || data.patients[0];

  const patientAssessments = useMemo(() => {
    return data.assessments
      .filter((a) => !patient || a.patientId === patient.id)
      .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime());
  }, [data.assessments, patient]);

  const latestAssessment = patientAssessments[0];
  const previousAssessment = patientAssessments[1];

  const patientScreenings = useMemo(() => {
    return data.screenings
      .filter((s) => !patient || s.patientId === patient.id)
      .sort((a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime());
  }, [data.screenings, patient]);

  const latestScreening = patientScreenings[0];
  const latestReview = data.doctorReviews.find((r) => r.screeningId === latestScreening?.id);

  const patientProgrammes = useMemo(() => {
    return data.programmes.filter((p) => !patient || p.patientId === patient.id);
  }, [data.programmes, patient]);
  const programme = patientProgrammes[0];

  const patientAppointments = useMemo(() => {
    return data.appointments
      .filter((a) => !patient || a.patientId === patient.id)
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [data.appointments, patient]);

  const upcomingApt =
    patientAppointments.find((a) => a.status === 'Confirmed' || a.status === 'Pending Confirmation') ||
    patientAppointments[0];

  const patientHabits = useMemo(() => {
    return data.habitLogs
      .filter((h) => !patient || h.patientId === patient.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data.habitLogs, patient]);

  const patientNotifications = useMemo(() => {
    return data.notifications
      .filter(
        (n) =>
          (!n.patientId || n.patientId === patient?.id) &&
          (n.roleTargets ? n.roleTargets.includes('patient') : true)
      )
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeB - timeA;
      })
      .slice(0, 3);
  }, [data.notifications, patient]);

  // Dynamic Delta & Risk Status for PREVENT
  const riskDelta = useMemo(() => {
    if (!latestAssessment || !previousAssessment) return null;
    return latestAssessment.experimentalScore - previousAssessment.experimentalScore;
  }, [latestAssessment, previousAssessment]);

  // Pillar 1: PREVENT Status calculation
  const preventStatus = useMemo(() => {
    if (!latestAssessment) {
      return {
        label: t.dashboard.notAssessed,
        deltaText: '',
        colorClass: 'text-slate-600',
        dotClass: 'bg-slate-400',
      };
    }
    const cat = latestAssessment.riskCategory;
    let label = t.dashboard.lowRisk;
    let colorClass = 'text-emerald-700';
    let dotClass = 'bg-emerald-500';

    if (cat === 'Moderate') {
      label = t.dashboard.moderateRisk;
      colorClass = 'text-amber-700';
      dotClass = 'bg-amber-500';
    } else if (cat === 'Elevated') {
      label = t.dashboard.highRisk;
      colorClass = 'text-rose-700';
      dotClass = 'bg-rose-500';
    }

    let deltaText = '';
    if (riskDelta !== null) {
      if (riskDelta < 0) {
        deltaText = `↓ ${Math.abs(riskDelta)}%`;
      } else if (riskDelta > 0) {
        deltaText = `↑ ${riskDelta}%`;
      } else {
        deltaText = '0%';
      }
    } else {
      deltaText = `${latestAssessment.experimentalScore}/100`;
    }

    return { label, deltaText, colorClass, dotClass };
  }, [latestAssessment, riskDelta, t]);

  // Pillar 2: DETECT Status calculation
  const detectStatus = useMemo(() => {
    if (!latestScreening) {
      return {
        label: t.dashboard.noScreeningsYet,
        isPending: false,
        isDr: false,
        colorClass: 'text-slate-600',
      };
    }

    if (latestScreening.humanReviewStatus === 'pending_review') {
      return {
        label: t.dashboard.pendingReview,
        isPending: true,
        isDr: false,
        colorClass: 'text-amber-700',
      };
    }

    const icdr = latestScreening.modelPrediction.icdrGrade ?? 0;
    if (icdr === 0) {
      return {
        label: t.dashboard.noDrDetected,
        isPending: false,
        isDr: false,
        colorClass: 'text-emerald-700',
      };
    }

    return {
      label: t.dashboard.drDetected,
      isPending: false,
      isDr: true,
      colorClass: 'text-rose-700',
    };
  }, [latestScreening, t]);

  // Pillar 3: PROTECT Status calculation
  const protectStatus = useMemo(() => {
    const hasPendingReview = latestScreening?.humanReviewStatus === 'pending_review';
    const hasOpenReferral = data.referrals.some(
      (r) => (!patient || r.patientId === patient.id) && (r.status === 'Pending' || r.status === 'Accepted')
    );
    const hasUnconfirmedApt = upcomingApt && upcomingApt.status === 'Pending Confirmation';

    const requiresAction = hasPendingReview || hasOpenReferral || hasUnconfirmedApt;

    if (requiresAction) {
      return {
        label: t.dashboard.actionRequired,
        actionRequired: true,
        colorClass: 'text-amber-700',
      };
    }

    return {
      label: t.dashboard.allGood,
      actionRequired: false,
      colorClass: 'text-emerald-700',
    };
  }, [latestScreening, data.referrals, patient, upcomingApt, t]);

  // Dynamic Health Overview aggregation
  const healthSeries = useMemo(() => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const numMonths = range === '3m' ? 3 : 6;
    
    let refYear = 2026;
    let refMonth = 10; // Nov = 10
    
    if (patientHabits.length > 0) {
      const latestHabitDate = new Date(patientHabits[0].date);
      if (!isNaN(latestHabitDate.getTime())) {
        refYear = latestHabitDate.getFullYear();
        refMonth = latestHabitDate.getMonth();
      }
    } else if (patientAssessments.length > 0) {
      const latestAsmDate = new Date(patientAssessments[0].assessedAt);
      if (!isNaN(latestAsmDate.getTime())) {
        refYear = latestAsmDate.getFullYear();
        refMonth = latestAsmDate.getMonth();
      }
    }

    const targetMonths: { year: number; monthIndex: number; label: string }[] = [];
    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(refYear, refMonth - i, 1);
      targetMonths.push({
        year: d.getFullYear(),
        monthIndex: d.getMonth(),
        label: monthNames[d.getMonth()],
      });
    }

    let populatedMonths = 0;

    const series = targetMonths.map((m) => {
      const asms = patientAssessments.filter((a) => {
        const ad = new Date(a.assessedAt);
        return ad.getFullYear() === m.year && ad.getMonth() === m.monthIndex;
      });

      const habits = patientHabits.filter((h) => {
        const hd = new Date(h.date);
        return hd.getFullYear() === m.year && hd.getMonth() === m.monthIndex;
      });

      let riskScore: number | null = null;
      if (asms.length > 0) {
        riskScore = Math.round(asms.reduce((acc, a) => acc + a.experimentalScore, 0) / asms.length);
      }

      let activity: number | null = null;
      let sleep: number | null = null;

      if (habits.length > 0) {
        const avgSteps = habits.reduce((acc, h) => acc + (h.stepsAchieved || 0), 0) / habits.length;
        activity = Math.min(100, Math.round((avgSteps / 10000) * 100));

        const avgSleep = habits.reduce((acc, h) => acc + (h.sleepHours || 0), 0) / habits.length;
        sleep = Math.min(100, Math.round((avgSleep / 8) * 100));
      }

      if (riskScore !== null || activity !== null || sleep !== null) {
        populatedMonths++;
      }

      return {
        month: m.label,
        year: m.year,
        riskScore: riskScore ?? undefined,
        activity: activity ?? undefined,
        sleep: sleep ?? undefined,
      };
    });

    // Requirement 9: Show honest empty state when historical trend points are insufficient (minimum 2 data points required to form a line)
    return populatedMonths >= 2 ? series : [];
  }, [range, patientAssessments, patientHabits]);

  // Dynamic Prevention Programme Checklist & Adherence
  const programmeChecklist = useMemo(() => {
    const dietCompleted =
      programme?.lessons.find((l) => l.category === 'Indian Nutrition')?.completed ||
      (patientHabits.length > 0 && patientHabits[0].healthyIndianDiet);

    const exerciseCompleted =
      programme?.lessons.find((l) => l.category === 'Physical Activity')?.completed ||
      (patientHabits.length > 0 && (patientHabits[0].stepsAchieved ?? 0) >= 8000);

    const sleepCompleted =
      programme?.lessons.find((l) => l.category === 'Sleep & Stress')?.completed ||
      (patientHabits.length > 0 && (patientHabits[0].sleepHours ?? 0) >= 7);

    const weightCompleted = programme
      ? programme.currentWeightKg <= programme.baselineWeightKg
      : false;

    const activityGoalCompleted =
      programme?.checkpoints.some((c) => c.status === 'completed') ||
      patientHabits.some((h) => (h.stepsAchieved ?? 0) >= 10000);

    return [
      { label: 'Healthy Diet', completed: !!dietCompleted },
      { label: 'Regular Exercise', completed: !!exerciseCompleted },
      { label: 'Good Sleep', completed: !!sleepCompleted },
      { label: 'Weight Goal', completed: !!weightCompleted },
      { label: 'Activity Goal', completed: !!activityGoalCompleted },
    ];
  }, [programme, patientHabits]);

  const adherence = useMemo(() => {
    if (programme?.adherencePercent !== undefined) {
      return programme.adherencePercent;
    }
    const completedCount = programmeChecklist.filter((c) => c.completed).length;
    return Math.round((completedCount / programmeChecklist.length) * 100);
  }, [programme, programmeChecklist]);

  const ringCircumference = 2 * Math.PI * 36;
  const ringOffset = ringCircumference - (adherence / 100) * ringCircumference;

  // Appointment dynamic date parsing & reminder banner text
  const appointmentInfo = useMemo(() => {
    if (!upcomingApt) return null;

    const aptDate = new Date(upcomingApt.scheduledDate + 'T00:00:00');
    const day = isNaN(aptDate.getTime()) ? '—' : aptDate.getDate();
    const month = isNaN(aptDate.getTime())
      ? '—'
      : aptDate.toLocaleString('default', { month: 'short' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(upcomingApt.scheduledDate + 'T00:00:00');
    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let reminderText = `Your appointment is scheduled for ${upcomingApt.scheduledDate} at ${upcomingApt.scheduledTime || '10:30 AM'}`;
    if (diffDays === 0) {
      reminderText = `Your appointment is today at ${upcomingApt.scheduledTime || '10:30 AM'}`;
    } else if (diffDays === 1) {
      reminderText = `Your appointment is tomorrow at ${upcomingApt.scheduledTime || '10:30 AM'}`;
    } else if (diffDays > 1) {
      reminderText = `Your appointment is in ${diffDays} days (${upcomingApt.scheduledDate}) at ${upcomingApt.scheduledTime || '10:30 AM'}`;
    }

    return { day, month, reminderText };
  }, [upcomingApt]);

  // Dynamic Health Insights derived from real patient differences
  const healthInsights = useMemo(() => {
    const items: { text: string; icon: 'check' | 'trending-up' | 'calendar' }[] = [];

    // Insight 1: Assessment delta / status
    if (latestAssessment && previousAssessment) {
      const delta = latestAssessment.experimentalScore - previousAssessment.experimentalScore;
      if (delta < 0) {
        items.push({
          text: `Your risk score dropped by ${Math.abs(delta)} points from previous assessment!`,
          icon: 'check',
        });
      } else if (delta > 0) {
        items.push({
          text: `Risk score increased by ${delta} points. Focus on: ${latestAssessment.topModifiableFactors?.slice(0, 2).join(', ') || 'diet and physical activity'}.`,
          icon: 'trending-up',
        });
      } else {
        items.push({
          text: `Lifestyle risk is stable at ${latestAssessment.experimentalScore}/100 (${latestAssessment.riskCategory} risk).`,
          icon: 'check',
        });
      }
    } else if (latestAssessment) {
      items.push({
        text: `Latest lifestyle risk: ${latestAssessment.riskCategory} (${latestAssessment.experimentalScore}/100). Focus on ${latestAssessment.topModifiableFactors?.[0] || 'balanced nutrition'}.`,
        icon: 'check',
      });
    } else {
      items.push({
        text: 'Take your lifestyle risk assessment to unlock personalized insights.',
        icon: 'check',
      });
    }

    // Insight 2: Activity habits average
    if (patientHabits.length > 0) {
      const avgSteps = Math.round(
        patientHabits.reduce((acc, h) => acc + (h.stepsAchieved || 0), 0) / patientHabits.length
      );
      if (avgSteps >= 8000) {
        items.push({
          text: `Averaging ${avgSteps.toLocaleString()} steps/day! Exceeding daily activity target.`,
          icon: 'check',
        });
      } else {
        items.push({
          text: `Averaging ${avgSteps.toLocaleString()} steps/day. Aim for 8,000 steps or 15-min post-meal walks.`,
          icon: 'trending-up',
        });
      }
    } else {
      items.push({
        text: 'Log daily steps and sleep in Prevent to track habit adherence.',
        icon: 'check',
      });
    }

    // Insight 3: Retinal screening schedule
    if (latestScreening) {
      if (latestScreening.humanReviewStatus === 'pending_review') {
        items.push({
          text: `Screening from ${latestScreening.capturedAt.slice(0, 10)} is pending clinician review.`,
          icon: 'calendar',
        });
      } else if ((latestScreening.modelPrediction.icdrGrade ?? 0) === 0) {
        items.push({
          text: 'No DR detected. Next routine retinal screening in 12 months.',
          icon: 'calendar',
        });
      } else {
        items.push({
          text: `ICDR Grade ${latestScreening.modelPrediction.icdrGrade} noted. Ophthalmology follow-up recommended.`,
          icon: 'calendar',
        });
      }
    } else {
      items.push({
        text: 'No retinal screening recorded yet. Schedule your AI fundus screening.',
        icon: 'calendar',
      });
    }

    return items;
  }, [latestAssessment, previousAssessment, patientHabits, latestScreening]);

  const firstName = (patient?.name || data.user.name || 'Shwetha').split(' ')[0];

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* 1. Large Hero Welcome Banner matching reference */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-100/70 bg-gradient-to-r from-[#DDEFFC] via-[#CEE6F9] to-[#0A223C] shadow-xs min-h-[148px] flex items-center">
        {/* Right Composite Artwork (Doctor holding glowing 3D shield, ECG line, Retinal HUD, Smart Care leaf) */}
        <div className="absolute right-0 top-0 bottom-0 w-full sm:w-3/5 lg:w-[58%] pointer-events-none overflow-hidden flex justify-end">
          <img
            src="/assets/dashboard/banner_crop.png"
            alt="Medical Shield & Retinal AI"
            className="hidden sm:block h-full w-auto object-cover object-right"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        {/* Left Interactive Content */}
        <div className="relative z-10 px-6 py-6 sm:px-8 max-w-md lg:max-w-lg">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B2540]">
            {t.hero.welcomeBack}, {firstName}!
          </h1>
          <p className="mt-1 text-base sm:text-[17px] font-bold text-[#143B5A]">
            {t.hero.subtitle}
          </p>
          <p className="mt-1 text-[14px] sm:text-[15px] text-slate-600 font-normal leading-relaxed">
            {t.hero.tagline}
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onNavigate('prevent')}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D9488] hover:bg-[#0F766E] px-5 py-2.5 text-[15px] font-semibold text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <span>{t.hero.exploreCta}</span>
              <ArrowRight className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </section>

      {/* 2. Three Main Pillar Cards matching reference */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3.5 lg:gap-4.5" aria-label="Three Healthcare Pillars">
        {/* PREVENT Card */}
        <div
          onClick={() => onNavigate('prevent')}
          className="group relative flex items-center justify-between rounded-2xl border border-[#C5ECD2] bg-[#EAF8EE] p-4 lg:p-4.5 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#059669] text-white shadow-2xs">
              <Activity className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[17px] font-bold tracking-wide text-[#0B2540]">
                {t.pillars.preventTitle}
              </div>
              <div className="text-[14px] text-slate-600 truncate mt-0.5">
                {t.pillars.preventDesc}
              </div>
              <div className={`mt-1.5 flex items-center gap-2 text-[14px] font-semibold ${preventStatus.colorClass}`}>
                <span className="flex items-center gap-1.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${preventStatus.dotClass}`} />
                  {preventStatus.label}
                </span>
                {preventStatus.deltaText && (
                  <span className="font-semibold flex items-center">
                    {preventStatus.deltaText}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 border border-emerald-200/80 text-slate-500 group-hover:text-emerald-700 group-hover:bg-white transition-colors">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        {/* DETECT Card */}
        <div
          onClick={() => onNavigate('detect')}
          className="group relative flex items-center justify-between rounded-2xl border border-[#C9E3FA] bg-[#EAF4FD] p-4 lg:p-4.5 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0284C7] text-white shadow-2xs">
              <Eye className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[17px] font-bold tracking-wide text-[#0B2540]">
                {t.pillars.detectTitle}
              </div>
              <div className="text-[14px] text-slate-600 truncate mt-0.5">
                {t.pillars.detectDesc}
              </div>
              <div className={`mt-1.5 flex items-center gap-1.5 text-[14px] font-semibold ${detectStatus.colorClass}`}>
                {detectStatus.isPending ? (
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                ) : detectStatus.isDr ? (
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                ) : latestScreening ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shrink-0" />
                )}
                <span className="truncate">{detectStatus.label}</span>
              </div>
            </div>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 border border-sky-200/80 text-slate-500 group-hover:text-sky-700 group-hover:bg-white transition-colors">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>

        {/* PROTECT Card */}
        <div
          onClick={() => onNavigate('protect')}
          className="group relative flex items-center justify-between rounded-2xl border border-[#DFD3F8] bg-[#F3EEFD] p-4 lg:p-4.5 shadow-2xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#7C3AED] text-white shadow-2xs">
              <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-[17px] font-bold tracking-wide text-[#0B2540]">
                {t.pillars.protectTitle}
              </div>
              <div className="text-[14px] text-slate-600 truncate mt-0.5">
                {t.pillars.protectDesc}
              </div>
              <div className={`mt-1.5 flex items-center gap-1.5 text-[14px] font-semibold ${protectStatus.colorClass}`}>
                {protectStatus.actionRequired ? (
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                )}
                <span>{protectStatus.label}</span>
              </div>
            </div>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 border border-purple-200/80 text-slate-500 group-hover:text-purple-700 group-hover:bg-white transition-colors">
            <ChevronRight className="h-4 w-4" />
          </div>
        </div>
      </section>

      {/* 3. Main Dashboard Grid: Left 9 Columns (6 Cards in 2 Rows) + Right 3 Columns Rail */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 lg:gap-5 items-start">
        {/* Left 9 Columns */}
        <div className="xl:col-span-9 space-y-4 lg:space-y-5">
          {/* Row 1: Health Overview, Retinal Screening Result, Prevention Programme */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Card A: Health Overview */}
            <div className="lg:col-span-5 rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-[#0B2540]" />
                    <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                      {t.dashboard.healthOverview}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[13px] font-medium text-slate-700 whitespace-nowrap shrink-0">
                    <span>{range === '6m' ? t.dashboard.last6Months : t.dashboard.last3Months}</span>
                    <ChevronDown
                      className="h-3.5 w-3.5 cursor-pointer text-slate-500"
                      onClick={() => setRange((r) => (r === '6m' ? '3m' : '6m'))}
                    />
                  </div>
                </div>

                {/* Interactive Legend Controlling & Identifying Series */}
                <div className="mt-3 flex items-center justify-end gap-2 text-[13px] font-medium text-slate-600">
                  <button
                    type="button"
                    onClick={() => toggleSeries('riskScore')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                      visibleSeries.riskScore
                        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/60 shadow-2xs'
                        : 'opacity-40 hover:opacity-70 text-slate-400 border border-transparent line-through'
                    }`}
                    title="Toggle Risk Score line"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[#2563EB] shrink-0" />
                    <span>{t.dashboard.riskScore}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSeries('activity')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                      visibleSeries.activity
                        ? 'bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/60 shadow-2xs'
                        : 'opacity-40 hover:opacity-70 text-slate-400 border border-transparent line-through'
                    }`}
                    title="Toggle Activity line"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[#10B981] shrink-0" />
                    <span>{t.dashboard.activity}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSeries('sleep')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all cursor-pointer ${
                      visibleSeries.sleep
                        ? 'bg-purple-50 text-purple-700 font-semibold border border-purple-200/60 shadow-2xs'
                        : 'opacity-40 hover:opacity-70 text-slate-400 border border-transparent line-through'
                    }`}
                    title="Toggle Sleep line"
                  >
                    <span className="h-2.5 w-2.5 rounded-full bg-[#8B5CF6] shrink-0" />
                    <span>{t.dashboard.sleep}</span>
                  </button>
                </div>
              </div>

              {/* Smooth Continuous Line Chart or Honest Empty State */}
              <div className="h-48 w-full mt-2">
                {healthSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={healthSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12, fill: '#475569' }}
                        axisLine={{ stroke: '#CBD5E1' }}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tick={{ fontSize: 11, fill: '#475569' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<HealthOverviewTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="riskScore"
                        name={t.dashboard.riskScore}
                        stroke="#2563EB"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#2563EB', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                        activeDot={{ r: 6.5, strokeWidth: 2, stroke: '#FFFFFF' }}
                        connectNulls
                        hide={!visibleSeries.riskScore}
                      />
                      <Line
                        type="monotone"
                        dataKey="activity"
                        name={t.dashboard.activity}
                        stroke="#10B981"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#10B981', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                        activeDot={{ r: 6.5, strokeWidth: 2, stroke: '#FFFFFF' }}
                        connectNulls
                        hide={!visibleSeries.activity}
                      />
                      <Line
                        type="monotone"
                        dataKey="sleep"
                        name={t.dashboard.sleep}
                        stroke="#8B5CF6"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#8B5CF6', strokeWidth: 1.5, stroke: '#FFFFFF' }}
                        activeDot={{ r: 6.5, strokeWidth: 2, stroke: '#FFFFFF' }}
                        connectNulls
                        hide={!visibleSeries.sleep}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center rounded-xl bg-slate-50/60 border border-dashed border-slate-200 text-center p-4">
                    <TrendingUp className="h-6 w-6 text-slate-300 mb-1" />
                    <p className="text-[15px] font-semibold text-slate-700">No longitudinal trend data available</p>
                    <p className="text-[13px] text-slate-500 mt-1 max-w-xs">
                      At least 2 months of longitudinal assessment or habit records are required to plot continuous trend lines.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Card B: Retinal Screening Result */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-[#0B2540]" />
                  <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                    {t.dashboard.retinalResult}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="text-[14px] font-semibold text-[#0284C7] hover:underline whitespace-nowrap cursor-pointer"
                >
                  {t.dashboard.viewReport}
                </button>
              </div>

              {latestScreening ? (
                /* Fundus Circle + Diagnosis Info + Grad-CAM CTA */
                <div className="my-auto py-2 flex items-center gap-3">
                  {/* Circular Fundus Photography */}
                  <div
                    onClick={() => setShowGradCamPreview((v) => !v)}
                    className="relative h-18 w-18 shrink-0 rounded-full overflow-hidden border border-slate-200 shadow-inner cursor-pointer group"
                    title="Click to toggle Grad-CAM overlay"
                  >
                    <FundusVisualizer
                      preset={latestScreening.imagePreset || 'normal_retina'}
                      imageDataUrl={latestScreening.imageDataUrl}
                      stage={showGradCamPreview ? 'gradcam' : 'raw'}
                      hotspots={latestScreening.gradCam?.hotspots || []}
                      size={120}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {showGradCamPreview && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-[10px] font-bold text-white uppercase tracking-wider">
                        Grad-CAM
                      </div>
                    )}
                  </div>

                  {/* Status, ICDR Grade, and Grad-CAM trigger */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {detectStatus.isPending ? (
                        <AlertCircle className="h-4.5 w-4.5 text-amber-600 shrink-0" />
                      ) : detectStatus.isDr ? (
                        <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                      ) : (
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
                      )}
                      <span className="font-display text-[15px] font-bold text-[#0B2540] leading-tight">
                        {detectStatus.label}
                      </span>
                    </div>
                    <div className="mt-1 text-[14px] font-semibold text-slate-800">
                      ICDR Grade {latestScreening.modelPrediction.icdrGrade ?? 0}
                    </div>
                    <div className="text-[13px] text-slate-500 leading-tight mt-0.5 line-clamp-2">
                      {latestReview?.clinicianGrade ? 'Clinician Verified' : latestScreening.modelPrediction.gradeLabel}
                    </div>

                    {/* View Grad-CAM Button + Colorful Heatmap Thumbnail */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowGradCamPreview((v) => !v)}
                        className="rounded-lg bg-[#EBF4FD] hover:bg-[#D8EDFD] px-3 py-1.5 text-[12.5px] font-semibold text-[#0284C7] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        {showGradCamPreview ? 'Show Fundus' : 'View Grad-CAM'}
                      </button>
                      <div
                        onClick={() => setShowGradCamPreview((v) => !v)}
                        className="h-7 w-7 rounded-lg overflow-hidden border border-sky-200 cursor-pointer shadow-2xs hover:scale-110 transition-transform shrink-0"
                        title="Grad-CAM Activation Map"
                      >
                        <img
                          src="/assets/dashboard/gradcam_sample.png"
                          alt="Grad-CAM Heatmap"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="my-auto py-4 flex flex-col items-center justify-center text-center">
                  <Eye className="h-8 w-8 text-slate-300 mb-1.5" />
                  <p className="text-[14px] font-semibold text-slate-700">{t.dashboard.noScreeningsYet}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate('detect')}
                    className="mt-2 text-[14px] font-semibold text-[#0284C7] hover:underline cursor-pointer"
                  >
                    Schedule Screening →
                  </button>
                </div>
              )}
            </div>

            {/* Card C: Prevention Programme */}
            <div className="lg:col-span-3 rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-[#0B2540]" />
                <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                  {t.dashboard.preventionProgramme}
                </h2>
              </div>

              {/* Circular Progress Ring + Checklist */}
              <div className="my-auto py-2 flex items-center gap-3">
                {/* SVG Progress Ring */}
                <div className="relative h-16 w-16 shrink-0">
                  <svg className="h-16 w-16 -rotate-90" viewBox="0 0 88 88">
                    <circle
                      cx="44"
                      cy="44"
                      r="36"
                      fill="none"
                      stroke="#E2E8F0"
                      strokeWidth="7.5"
                    />
                    <circle
                      cx="44"
                      cy="44"
                      r="36"
                      fill="none"
                      stroke="#0D9488"
                      strokeWidth="7.5"
                      strokeLinecap="round"
                      strokeDasharray={ringCircumference}
                      strokeDashoffset={ringOffset}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-display text-[17px] font-bold text-[#0B2540] tabular-nums">
                      {adherence}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-semibold leading-none">
                      {programme?.currentMonth || 1}/12 Mo
                    </span>
                  </div>
                </div>

                {/* Checklist from real programme data */}
                <div className="space-y-1.5 text-[13px] text-slate-700 min-w-0 flex-1">
                  {programmeChecklist.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 ${
                        item.completed ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
                      )}
                      <span className="leading-tight">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Continue Programme Button */}
              <button
                type="button"
                onClick={() => onNavigate('prevent')}
                className="w-full rounded-xl bg-[#EAF3FA] hover:bg-[#DCEBF7] py-2 text-[13.5px] font-semibold text-[#0B2540] transition-colors text-center cursor-pointer whitespace-nowrap"
              >
                {t.dashboard.continueProgramme}
              </button>
            </div>
          </div>

          {/* Row 2: Upcoming Appointments, Quick Actions, Health Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Card D: Upcoming Appointments */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-[#0B2540]" />
                    <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                      {t.dashboard.upcomingAppointments}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('appointments')}
                    className="text-[14px] font-semibold text-[#0284C7] hover:underline cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {t.dashboard.viewAll}
                  </button>
                </div>

                {appointmentInfo ? (
                  /* Appointment Date Badge & Details */
                  <div className="mt-3.5 flex items-start gap-3.5">
                    <div className="flex flex-col items-center justify-center rounded-xl bg-[#EAF4FD] px-3.5 py-2.5 text-center shrink-0 w-16">
                      <span className="font-mono text-[22px] font-extrabold text-[#0284C7] leading-none">
                        {appointmentInfo.day}
                      </span>
                      <span className="mt-1 text-[13px] font-bold text-[#0284C7]">
                        {appointmentInfo.month}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[16px] font-bold text-[#0B2540] leading-snug">
                        {upcomingApt?.title || 'Consultation'}
                      </div>
                      <div className="mt-0.5 text-[14px] text-slate-600">
                        {upcomingApt?.scheduledTime || '10:30 AM'} • {upcomingApt?.facility || 'Care Center'}
                      </div>
                      <div className="mt-1.5">
                        <span
                          className={`inline-block rounded-full px-3 py-0.5 text-[12px] font-bold ${
                            upcomingApt?.status === 'Confirmed'
                              ? 'bg-[#E8F8EE] text-[#10B981]'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {upcomingApt?.status || 'Scheduled'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-[14px] text-slate-500">
                    {t.dashboard.noAppointments}
                  </div>
                )}
              </div>

              {/* Dynamic Reminder Banner */}
              {appointmentInfo && (
                <div className="mt-3.5 rounded-xl bg-[#FEF6EE] border border-[#FEE4C8] px-4 py-2.5 text-[14px] text-[#9A4200] flex items-center gap-2.5">
                  <Bell className="h-4.5 w-4.5 text-[#EA580C] shrink-0" />
                  <span className="leading-snug">
                    <strong>Reminder:</strong> {appointmentInfo.reminderText}
                  </span>
                </div>
              )}
            </div>

            {/* Card E: Quick Actions (4 Colorful Cards) */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#0B2540]" />
                <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                  {t.dashboard.quickActions}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-2.5 my-auto py-2">
                {/* 1. Take Risk Assessment */}
                <button
                  type="button"
                  onClick={() => onNavigate('prevent')}
                  className="flex flex-col items-center justify-center text-center p-3 rounded-xl bg-[#E8F8EE] hover:bg-[#D5F3DF] transition-all cursor-pointer group shadow-2xs"
                >
                  <BarChart2 className="h-5 w-5 text-[#059669] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[13px] font-semibold text-[#065F46] leading-snug whitespace-pre-line text-center">
                    {t.dashboard.takeAssessment}
                  </span>
                </button>

                {/* 2. Upload Retinal Image */}
                <button
                  type="button"
                  onClick={() => onNavigate('detect')}
                  className="flex flex-col items-center justify-center text-center p-3 rounded-xl bg-[#EBF4FD] hover:bg-[#D5EAFB] transition-all cursor-pointer group shadow-2xs"
                >
                  <Eye className="h-5 w-5 text-[#0284C7] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[13px] font-semibold text-[#0369A1] leading-snug whitespace-pre-line text-center">
                    {t.dashboard.uploadImage}
                  </span>
                </button>

                {/* 3. View Reports */}
                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="flex flex-col items-center justify-center text-center p-3 rounded-xl bg-[#F3EEFD] hover:bg-[#E6DBFB] transition-all cursor-pointer group shadow-2xs"
                >
                  <FileText className="h-5 w-5 text-[#7C3AED] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[13px] font-semibold text-[#6D28D9] leading-snug whitespace-pre-line text-center">
                    {t.dashboard.viewReports}
                  </span>
                </button>

                {/* 4. Book Appointment */}
                <button
                  type="button"
                  onClick={() => onNavigate('appointments')}
                  className="flex flex-col items-center justify-center text-center p-3 rounded-xl bg-[#FFF4E5] hover:bg-[#FEE7CA] transition-all cursor-pointer group shadow-2xs"
                >
                  <Calendar className="h-5 w-5 text-[#EA580C] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[13px] font-semibold text-[#C2410C] leading-snug whitespace-pre-line text-center">
                    {t.dashboard.bookAppointment}
                  </span>
                </button>
              </div>
            </div>

            {/* Card F: Health Insights */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-[#0B2540]" />
                <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                  {t.dashboard.healthInsights}
                </h2>
              </div>

              <div className="my-auto py-2 flex items-center justify-between gap-3">
                {/* Dynamic Insights Bullets */}
                <div className="space-y-2 text-[14px] text-slate-700 min-w-0 flex-1">
                  {healthInsights.map((insight, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-snug">{insight.text}</span>
                    </div>
                  ))}
                </div>

                {/* Upward Trending Green Chart Graphics matching reference */}
                <div className="h-18 w-24 shrink-0 flex items-end justify-center">
                  <svg viewBox="0 0 90 60" className="h-full w-full">
                    <defs>
                      <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    {/* Rising bars in background */}
                    <rect x="10" y="44" width="8" height="16" rx="2" fill="#E2E8F0" />
                    <rect x="25" y="36" width="8" height="24" rx="2" fill="#E2E8F0" />
                    <rect x="40" y="28" width="8" height="32" rx="2" fill="#A7F3D0" />
                    <rect x="55" y="20" width="8" height="40" rx="2" fill="#6EE7B7" />
                    <rect x="70" y="10" width="8" height="50" rx="2" fill="#34D399" />
                    {/* Area under curve */}
                    <path
                      d="M 14 44 Q 40 35 55 20 T 78 8 L 78 60 L 14 60 Z"
                      fill="url(#trendGrad)"
                    />
                    {/* Rising line */}
                    <path
                      d="M 14 44 Q 40 35 55 20 T 78 8"
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    <circle cx="78" cy="8" r="3.5" fill="#059669" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 3 Columns Operational Rail */}
        <div className="xl:col-span-3 space-y-4">
          {/* 1. Alerts & Notifications Card */}
          <div className="rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#0B2540]" />
                <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                  {t.dashboard.alertsNotifications}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('notifications')}
                className="text-[14px] font-semibold text-[#0284C7] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                {t.dashboard.viewAll}
              </button>
            </div>

            <div className="space-y-3">
              {patientNotifications.length > 0 ? (
                patientNotifications.map((notif) => {
                  const isUrgent = notif.severity === 'urgent';
                  const isWarning = notif.severity === 'warning';
                  const isSuccess = notif.severity === 'success';

                  return (
                    <div
                      key={notif.id}
                      onClick={() => onNavigate(notif.actionView || 'notifications')}
                      className="flex items-start gap-3 rounded-xl p-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          isUrgent
                            ? 'bg-rose-100 text-rose-600'
                            : isWarning
                            ? 'bg-amber-100 text-amber-600'
                            : isSuccess
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-sky-100 text-sky-600'
                        }`}
                      >
                        {isUrgent || isWarning ? (
                          <AlertCircle className="h-4 w-4" />
                        ) : isSuccess ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Bell className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-bold text-[#0B2540] leading-snug">
                          {notif.title}
                        </div>
                        <div className="text-[13px] text-slate-600 line-clamp-2 leading-snug mt-0.5">
                          {notif.message}
                        </div>
                        <div className="text-[12px] text-slate-400 font-mono mt-1">
                          {new Date(notif.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-4 text-center text-[14px] text-slate-500">
                  {t.dashboard.noNotifications}
                </div>
              )}
            </div>
          </div>

          {/* 2. System Status Card */}
          <div className="rounded-2xl border border-blue-100/70 bg-white p-4 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4.5 w-4.5 text-emerald-600" />
              <span className="font-display text-[14px] font-bold text-[#0B2540]">
                {t.dashboard.systemStatus}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[14px] font-semibold text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>{t.dashboard.allSystemsOnline}</span>
            </div>
          </div>

          {/* 3. Offline Mode Available Card */}
          <div
            onClick={() => onNavigate('offline')}
            className="rounded-2xl border border-[#C5ECD2] bg-[#EAF8EE] p-4 shadow-xs flex items-center gap-3 cursor-pointer hover:bg-[#DFF5E5] transition-colors"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wifi className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-[#065F46]">
                {t.dashboard.offlineModeAvailable}
              </div>
              <div className="text-[13px] text-slate-700 leading-tight mt-0.5">
                {t.dashboard.offlineModeDesc}
              </div>
            </div>
          </div>

          {/* 4. MATLAB & Simulink Branding Badge */}
          <div className="px-2 pt-1 flex flex-col items-center gap-1 text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Powered by</span>
              <img
                src="/assets/dashboard/matlab_simulink_clean.png"
                alt="Powered by MATLAB & Simulink"
                className="h-10 w-auto object-contain opacity-85"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          </div>

          {/* 5. Shore Temple / Coastal Palms Watermark */}
          <div className="pt-2 px-1 opacity-55 pointer-events-none select-none">
            <img
              src="/assets/dashboard/temple_watermark.png"
              alt=""
              className="w-full h-auto object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
