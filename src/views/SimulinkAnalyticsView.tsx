import React, { useState } from 'react';
import { Cpu, Download, Info, Upload } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BootstrapPayload, SimulinkScenarioResult } from '../types/domain';

interface SimulinkAnalyticsViewProps {
  data: BootstrapPayload;
  isOnline: boolean;
  onImportCsv: (csvText: string) => Promise<void>;
}

const SAMPLE_SIMULINK_CSV = `scenarioKey,name,dailyPatientArrivals,camerasAvailable,screeningCapacityPerDay,imageThroughputPerHour,ophthalmologistsAvailable,avgQueueLength,avgWaitTimeMinutes,healthWorkerWorkloadPct,referralDemandPerWeek,description,estimatedMonthlyCostInr,bottleneck
normal,Imported Simulink: District Baseline,135,6,155,25,3,8,21,72,46,Actual MATLAB Simulink Discrete-Event output run #42,495000,Balanced baseline across 4 PHCs
camera_shortage,Imported Simulink: Mobile Van Maintenance,135,4,104,17,3,27,53,88,41,Simulink output with 2 fundus units offline for calibration,462000,Fundus capture desk saturation`;

export const SimulinkAnalyticsView: React.FC<SimulinkAnalyticsViewProps> = ({
  data,
  isOnline,
  onImportCsv,
}) => {
  const [selectedId, setSelectedId] = useState<string>(data.simulations[0]?.id || '');
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const selected: SimulinkScenarioResult | undefined =
    data.simulations.find((s) => s.id === selectedId) || data.simulations[0];

  const comparisonData = data.simulations.map((s) => ({
    name: s.name.length > 22 ? `${s.name.slice(0, 20)}…` : s.name,
    waitMin: s.avgWaitTimeMinutes,
    queue: s.avgQueueLength,
    utilization: s.resourceUtilizationPct,
    costLakhs: Number((s.estimatedMonthlyCostInr / 100000).toFixed(2)),
  }));

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_SIMULINK_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mitra-drishti-simulink-output-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setFeedback(null);
    try {
      await onImportCsv(csvText);
      setCsvText('');
      setFeedback({
        type: 'success',
        text: 'Imported MATLAB Simulink CSV output rows into district simulation analytics.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Only District Administrators may import Simulink CSV outputs.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[14px] font-semibold text-[#12598C] uppercase tracking-wide">
            District-Level Healthcare Capacity Planning (Not Patient-Level Diagnosis)
          </p>
          <h1 className="font-display text-[28px] font-bold text-[#0B2540] leading-tight">
            MATLAB Simulink Resource Planning Analytics
          </h1>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4.5 py-2.5 text-[14px] font-semibold text-slate-800 hover:bg-slate-50 shrink-0 shadow-2xs transition-colors"
        >
          <Download className="h-4.5 w-4.5 text-[#0D9488]" />
          Download Simulink CSV Template
        </button>
      </div>

      {/* Explicit Transparency Notice */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 text-[14px] text-amber-950 flex items-start gap-3 shadow-2xs leading-relaxed">
        <Info className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Simulation Mode Transparency:</strong> Because MATLAB/Simulink runtime is not installed in this cloud container, default scenarios run in{' '}
          <strong>Explicitly Labelled Illustrative Analytical Simulation Mode</strong>. Use the CSV Import Interface below to load genuine exported MATLAB Simulink (SimEvents) run outputs.
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-5 py-3.5 text-[14px] font-medium leading-relaxed ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 6 Scenario Selector Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.simulations.map((sim) => {
          const active = selected?.id === sim.id;
          return (
            <button
              key={sim.id}
              type="button"
              onClick={() => setSelectedId(sim.id)}
              className={`rounded-2xl border p-5 text-left transition-colors shadow-2xs ${
                active
                  ? 'border-[#0D9488] bg-teal-50/40 shadow-xs ring-1 ring-[#0D9488]'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[16px] font-bold text-[#0B2540]">{sim.name}</span>
                <span className="font-mono text-[14px] font-bold text-[#0F766E] tabular-nums">
                  {sim.avgWaitTimeMinutes}m wait
                </span>
              </div>
              <div className="mt-1 text-[13px] font-medium text-slate-500">{sim.source}</div>
              <p className="mt-2 text-[14px] text-slate-700 line-clamp-2 leading-relaxed">{sim.description}</p>
              <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between font-mono text-[13px] text-slate-800 tabular-nums">
                <span>Arrivals: {sim.dailyPatientArrivals}/d</span>
                <span>Util: {sim.resourceUtilizationPct}%</span>
                <span>Queue: {sim.avgQueueLength}</span>
              </div>
            </button>
          );
        })}
      </section>

      {/* Selected Scenario Deep Dive */}
      {selected && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <div>
              <div className="text-[13px] font-semibold text-[#0F766E] uppercase tracking-wide">{selected.source}</div>
              <h2 className="font-display text-[20px] font-bold text-[#0B2540] mt-0.5">
                {selected.name} — Hourly Queue &amp; Waiting Time Curve
              </h2>
              <p className="text-[14px] text-slate-700 mt-1 leading-relaxed">
                Primary Bottleneck: <strong className="text-slate-900">{selected.bottleneck}</strong>
              </p>
            </div>

            <div className="h-64 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selected.hourlyQueueCurve} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '13px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="queueLength" name="Queue Length (Patients)" stroke="#0B2540" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="waitMinutes" name="Wait Time (Minutes)" stroke="#D97706" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h3 className="font-display text-[19px] font-bold text-[#0B2540]">
              District Capacity Parameters
            </h3>
            <div className="divide-y divide-slate-100 text-[14px]">
              {[
                ['Daily Patient Arrivals', `${selected.dailyPatientArrivals} patients/day`],
                ['Fundus Cameras Available', `${selected.camerasAvailable} units`],
                ['Screening Capacity', `${selected.screeningCapacityPerDay} patients/day`],
                ['Image-Processing Throughput', `${selected.imageThroughputPerHour} images/hour`],
                ['Ophthalmologists Available', `${selected.ophthalmologistsAvailable} specialists`],
                ['Health-Worker Workload', `${selected.healthWorkerWorkloadPct}%`],
                ['Weekly Referral Demand', `${selected.referralDemandPerWeek} referrals/week`],
                ['Average Queue Length', `${selected.avgQueueLength} patients`],
                ['Average Waiting Time', `${selected.avgWaitTimeMinutes} minutes`],
                ['Resource Utilization', `${selected.resourceUtilizationPct}%`],
                ['Estimated Monthly Cost', `₹${selected.estimatedMonthlyCostInr.toLocaleString('en-IN')}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-2.5">
                  <span className="text-slate-700">{k}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Multi-Scenario Bar Comparison */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-[20px] font-bold text-[#0B2540] mb-1">
          Cross-Scenario Operational Comparison
        </h2>
        <p className="text-[14px] text-slate-600 mb-5 leading-relaxed">
          Compare wait times (minutes), queue lengths, and resource utilization (%) across all modeled scenarios.
        </p>
        <div className="h-68 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '13px' }} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="waitMin" name="Avg Wait (min)" fill="#12598C" radius={[5, 5, 0, 0]} />
              <Bar dataKey="queue" name="Avg Queue" fill="#D97706" radius={[5, 5, 0, 0]} />
              <Bar dataKey="utilization" name="Utilization (%)" fill="#0D9488" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* MATLAB Simulink CSV Import Interface */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-[#0D9488]" />
            <h2 className="font-display text-[19px] font-bold text-[#0B2540]">
              Import Actual MATLAB Simulink CSV Outputs (Administrator Only)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCsvText(SAMPLE_SIMULINK_CSV)}
            className="text-[14px] font-semibold text-[#0D9488] hover:underline"
          >
            Load Sample Simulink CSV Format
          </button>
        </div>

        <form onSubmit={handleImportSubmit} className="space-y-4 text-[14px]">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs">
              <Upload className="h-4 w-4 text-[#0D9488]" />
              Choose .csv file
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" />
            </label>
            <span className="text-[13px] text-slate-600">
              Expected headers: <code>scenarioKey,name,dailyPatientArrivals,camerasAvailable,...</code>
            </span>
          </div>

          <textarea
            rows={4}
            required
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste exported MATLAB Simulink CSV rows here..."
            className="w-full rounded-xl border border-slate-300 p-3.5 font-mono text-[13px] focus:border-[#0D9488] focus:ring-1 focus:ring-[#0D9488] outline-none"
          />

          <button
            type="submit"
            disabled={importing || !isOnline || !csvText.trim()}
            className="rounded-xl bg-[#0B2540] px-6 py-3 text-[15px] font-semibold text-white hover:bg-[#113556] disabled:opacity-50 transition-colors shadow-sm"
          >
            {importing ? 'Importing...' : 'Import Simulink Scenarios'}
          </button>
        </form>
      </section>
    </div>
  );
};
