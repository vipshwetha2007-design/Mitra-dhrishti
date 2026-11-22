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
  Shield,
  ShieldCheck,
  Sparkles,
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

  const patient = data.patients[0];
  const latestAssessment = data.assessments[0];
  const latestScreening = data.screenings[0];
  const latestReview = data.doctorReviews.find((r) => r.screeningId === latestScreening?.id);
  const programme = data.programmes[0];
  const upcomingApt =
    data.appointments.find((a) => a.status === 'Confirmed' || a.status === 'Pending Confirmation') ||
    data.appointments[0];

  // 6-Month series matching reference dashboard curve (Jan - Jun)
  const healthSeries = useMemo(() => {
    const all = [
      { month: 'Jan', riskScore: 32, activity: 42, sleep: 36 },
      { month: 'Feb', riskScore: 48, activity: 70, sleep: 52 },
      { month: 'Mar', riskScore: 42, activity: 68, sleep: 56 },
      { month: 'Apr', riskScore: 36, activity: 62, sleep: 46 },
      { month: 'May', riskScore: 54, activity: 74, sleep: 58 },
      { month: 'Jun', riskScore: 55, activity: 76, sleep: 60 },
    ];
    return range === '3m' ? all.slice(3) : all;
  }, [range]);

  const adherence = programme?.adherencePercent ?? 72;
  const ringCircumference = 2 * Math.PI * 36;
  const ringOffset = ringCircumference - (adherence / 100) * ringCircumference;

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
        <div className="relative z-10 px-6 py-6 sm:px-8 max-w-xl">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0B2540]">
            Welcome back, {firstName}!
          </h1>
          <p className="mt-1 text-sm sm:text-base font-bold text-[#143B5A]">
            Your health. Our priority.
          </p>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 font-normal">
            Prevent diabetes. Detect complications. Protect your future.
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onNavigate('prevent')}
              className="inline-flex items-center gap-2 rounded-full bg-[#0D9488] hover:bg-[#0F766E] px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <span>Explore Your Health</span>
              <ArrowRight className="h-4 w-4" />
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
              <div className="font-display text-sm font-extrabold tracking-wide text-[#0B2540]">
                PREVENT
              </div>
              <div className="text-xs text-slate-600 truncate mt-0.5">
                Manage Your Diabetes Risk
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-xs font-bold text-emerald-700">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Low Risk
                </span>
                <span className="text-emerald-600 font-semibold flex items-center">
                  ↓ 12%
                </span>
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
              <div className="font-display text-sm font-extrabold tracking-wide text-[#0B2540]">
                DETECT
              </div>
              <div className="text-xs text-slate-600 truncate mt-0.5">
                AI Retinal Screening
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>No DR Detected</span>
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
              <div className="font-display text-sm font-extrabold tracking-wide text-[#0B2540]">
                PROTECT
              </div>
              <div className="text-xs text-slate-600 truncate mt-0.5">
                Stay on Track with Care
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span>All Good</span>
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
            <div className="lg:col-span-5 rounded-2xl border border-blue-100/70 bg-white p-4.5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#0B2540]" />
                    <h2 className="font-display text-sm font-bold text-[#0B2540]">
                      Health Overview
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                    <span>{range === '6m' ? 'Last 6 Months' : 'Last 3 Months'}</span>
                    <ChevronDown
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setRange((r) => (r === '6m' ? '3m' : '6m'))}
                    />
                  </div>
                </div>

                {/* Legend matching reference screenshot */}
                <div className="mt-2.5 flex items-center justify-end gap-3 text-[11px] font-medium text-slate-600">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                    Risk Score
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#10B981]" />
                    Activity
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-[#8B5CF6]" />
                    Sleep
                  </span>
                </div>
              </div>

              {/* 6-Month Smooth Line Chart */}
              <div className="h-48 w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={healthSeries} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      axisLine={{ stroke: '#E2E8F0' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tick={{ fontSize: 10, fill: '#64748B' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: '12px',
                        borderColor: '#E2E8F0',
                        fontSize: '11px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="riskScore"
                      name="Risk Score"
                      stroke="#2563EB"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#2563EB', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="activity"
                      name="Activity"
                      stroke="#10B981"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#10B981', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="sleep"
                      name="Sleep"
                      stroke="#8B5CF6"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#8B5CF6', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Card B: Retinal Screening Result */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-4.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-[#0B2540]" />
                  <h2 className="font-display text-sm font-bold text-[#0B2540]">
                    Retinal Screening Result
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="text-xs font-semibold text-[#0284C7] hover:underline whitespace-nowrap cursor-pointer"
                >
                  View Report →
                </button>
              </div>

              {/* Fundus Circle + Diagnosis Info + Grad-CAM CTA */}
              <div className="my-auto py-2 flex items-center gap-4">
                {/* Circular Fundus Photography */}
                <div
                  onClick={() => setShowGradCamPreview((v) => !v)}
                  className="relative h-24 w-24 sm:h-26 sm:w-26 shrink-0 rounded-full overflow-hidden border border-slate-200 shadow-inner cursor-pointer group"
                  title="Click to toggle Grad-CAM overlay"
                >
                  {showGradCamPreview ? (
                    <FundusVisualizer
                      preset={latestScreening?.imagePreset || 'normal_retina'}
                      stage="gradcam"
                      hotspots={latestScreening?.gradCam.hotspots || []}
                      size={120}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <img
                      src="/assets/dashboard/fundus_circle.png"
                      alt="Retinal Fundus"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                  {showGradCamPreview && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center text-[9px] font-bold text-white uppercase tracking-wider">
                      Grad-CAM
                    </div>
                  )}
                </div>

                {/* Status, ICDR Grade, and Grad-CAM trigger */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span className="font-display text-sm font-bold text-[#0B2540] leading-tight">
                      No DR Detected
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">
                    ICDR Grade: 0
                  </div>
                  <div className="text-[11px] text-slate-500">
                    (No Signs of DR)
                  </div>

                  {/* View Grad-CAM Button + Colorful Heatmap Thumbnail */}
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowGradCamPreview((v) => !v)}
                      className="rounded-lg bg-[#EBF4FD] hover:bg-[#D8EDFD] px-3 py-1.5 text-xs font-semibold text-[#0284C7] transition-colors cursor-pointer"
                    >
                      {showGradCamPreview ? 'Show Fundus' : 'View Grad-CAM'}
                    </button>
                    <div
                      onClick={() => setShowGradCamPreview((v) => !v)}
                      className="h-8 w-8 rounded-lg overflow-hidden border border-sky-200 cursor-pointer shadow-2xs hover:scale-110 transition-transform shrink-0"
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
            </div>

            {/* Card C: Prevention Programme */}
            <div className="lg:col-span-3 rounded-2xl border border-blue-100/70 bg-white p-4.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-[#0B2540]" />
                <h2 className="font-display text-sm font-bold text-[#0B2540]">
                  Prevention Programme
                </h2>
              </div>

              {/* Circular Progress Ring + Checklist */}
              <div className="my-auto py-2 flex items-center gap-3.5">
                {/* SVG Progress Ring */}
                <div className="relative h-20 w-20 shrink-0">
                  <svg className="h-20 w-20 -rotate-90" viewBox="0 0 88 88">
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
                    <span className="font-display text-lg font-extrabold text-[#0B2540] tabular-nums">
                      {adherence}%
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium">
                      6 / 12 Months
                    </span>
                  </div>
                </div>

                {/* Checklist from reference */}
                <div className="space-y-1.5 text-xs text-slate-700 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Healthy Diet</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Regular Exercise</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Good Sleep</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
                    <span className="truncate">Weight Goal</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <span className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
                    <span className="truncate">Activity Goal</span>
                  </div>
                </div>
              </div>

              {/* Continue Programme Button */}
              <button
                type="button"
                onClick={() => onNavigate('prevent')}
                className="w-full rounded-xl bg-[#EAF3FA] hover:bg-[#DCEBF7] py-2 text-xs font-semibold text-[#0B2540] transition-colors text-center cursor-pointer"
              >
                Continue Programme →
              </button>
            </div>
          </div>

          {/* Row 2: Upcoming Appointments, Quick Actions, Health Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
            {/* Card D: Upcoming Appointments */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-4.5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-[#0B2540]" />
                    <h2 className="font-display text-sm font-bold text-[#0B2540]">
                      Upcoming Appointments
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('appointments')}
                    className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
                  >
                    View All →
                  </button>
                </div>

                {/* Appointment Date Badge & Details */}
                <div className="mt-3.5 flex items-start gap-3">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-[#EAF4FD] px-3 py-2 text-center shrink-0 w-14">
                    <span className="font-mono text-lg font-extrabold text-[#0284C7] leading-none">
                      28
                    </span>
                    <span className="mt-0.5 text-[11px] font-bold text-[#0284C7]">
                      Nov
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-[#0B2540] truncate">
                      {upcomingApt?.title || 'Follow-up Consultation'}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {upcomingApt?.scheduledTime || '10:30 AM'} • {upcomingApt?.facility || 'City Hospital'}
                    </div>
                    <div className="mt-1">
                      <span className="inline-block rounded-full bg-[#E8F8EE] px-2.5 py-0.5 text-[10px] font-bold text-[#10B981]">
                        Confirmed
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Orange Callout Reminder Banner */}
              <div className="mt-3 rounded-xl bg-[#FEF6EE] border border-[#FEE4C8] px-3.5 py-2.5 text-xs text-[#9A4200] flex items-center gap-2.5">
                <Bell className="h-4 w-4 text-[#EA580C] shrink-0" />
                <span>
                  <strong>Reminder:</strong> Your appointment is tomorrow at 10:30 AM
                </span>
              </div>
            </div>

            {/* Card E: Quick Actions (4 Colorful Cards) */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-4.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-[#0B2540]" />
                <h2 className="font-display text-sm font-bold text-[#0B2540]">
                  Quick Actions
                </h2>
              </div>

              <div className="grid grid-cols-4 gap-2.5 my-auto py-2">
                {/* 1. Take Risk Assessment */}
                <button
                  type="button"
                  onClick={() => onNavigate('prevent')}
                  className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-[#E8F8EE] hover:bg-[#D5F3DF] transition-all cursor-pointer group shadow-2xs"
                >
                  <BarChart2 className="h-5 w-5 text-[#059669] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-[#065F46] leading-tight">
                    Take<br />Risk Assessment
                  </span>
                </button>

                {/* 2. Upload Retinal Image */}
                <button
                  type="button"
                  onClick={() => onNavigate('detect')}
                  className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-[#EBF4FD] hover:bg-[#D5EAFB] transition-all cursor-pointer group shadow-2xs"
                >
                  <Eye className="h-5 w-5 text-[#0284C7] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-[#0369A1] leading-tight">
                    Upload<br />Retinal Image
                  </span>
                </button>

                {/* 3. View Reports */}
                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-[#F3EEFD] hover:bg-[#E6DBFB] transition-all cursor-pointer group shadow-2xs"
                >
                  <FileText className="h-5 w-5 text-[#7C3AED] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-[#6D28D9] leading-tight">
                    View<br />Reports
                  </span>
                </button>

                {/* 4. Book Appointment */}
                <button
                  type="button"
                  onClick={() => onNavigate('appointments')}
                  className="flex flex-col items-center justify-center text-center p-2.5 rounded-xl bg-[#FFF4E5] hover:bg-[#FEE7CA] transition-all cursor-pointer group shadow-2xs"
                >
                  <Calendar className="h-5 w-5 text-[#EA580C] mb-1.5 group-hover:scale-110 transition-transform" />
                  <span className="text-[11px] font-bold text-[#C2410C] leading-tight">
                    Book<br />Appointment
                  </span>
                </button>
              </div>
            </div>

            {/* Card F: Health Insights */}
            <div className="lg:col-span-4 rounded-2xl border border-blue-100/70 bg-white p-4.5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-[#0B2540]" />
                <h2 className="font-display text-sm font-bold text-[#0B2540]">
                  Health Insights
                </h2>
              </div>

              <div className="my-auto py-2 flex items-center justify-between gap-3">
                {/* Insights Bullets */}
                <div className="space-y-2 text-xs text-slate-700 min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">Your risk is lower than last month!</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">Keep up the healthy lifestyle.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">Next screening in 6 months.</span>
                  </div>
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
          <div className="rounded-2xl border border-blue-100/70 bg-white p-4 lg:p-4.5 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#0B2540]" />
                <h2 className="font-display text-sm font-bold text-[#0B2540]">
                  Alerts &amp; Notifications
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('notifications')}
                className="text-xs font-semibold text-[#0284C7] hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>

            <div className="space-y-3">
              {/* Item 1: Doctor Review Required */}
              <div
                onClick={() => onNavigate('protect')}
                className="flex items-start gap-3 rounded-xl p-2 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="h-5 w-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#0B2540]">
                    Doctor Review Required
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Retinal image needs review
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    2h ago
                  </div>
                </div>
              </div>

              {/* Item 2: Appointment Tomorrow */}
              <div
                onClick={() => onNavigate('appointments')}
                className="flex items-start gap-3 rounded-xl p-2 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="h-5 w-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#0B2540]">
                    Appointment Tomorrow
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Follow-up consultation
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    3h ago
                  </div>
                </div>
              </div>

              {/* Item 3: Sync Complete */}
              <div
                onClick={() => onNavigate('offline')}
                className="flex items-start gap-3 rounded-xl p-2 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-[#0B2540]">
                    Sync Complete
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    Your data is updated
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    4h ago
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. System Status Card */}
          <div className="rounded-2xl border border-blue-100/70 bg-white p-3.5 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-emerald-600" />
              <span className="font-display text-xs font-bold text-[#0B2540]">
                System Status
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Online</span>
            </div>
          </div>

          {/* 3. Offline Mode Available Card */}
          <div
            onClick={() => onNavigate('offline')}
            className="rounded-2xl border border-[#C5ECD2] bg-[#EAF8EE] p-3.5 shadow-xs flex items-center gap-3 cursor-pointer hover:bg-[#DFF5E5] transition-colors"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <Wifi className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#065F46]">
                Offline Mode Available
              </div>
              <div className="text-[11px] text-slate-600 leading-tight mt-0.5">
                Access core features without internet
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
