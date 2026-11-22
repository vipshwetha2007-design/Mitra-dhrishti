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
    a.download = 'mritidhristi-simulink-output-template.csv';
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
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#12598C]">
            District-Level Healthcare Capacity Planning (Not Patient-Level Diagnosis)
          </p>
          <h1 className="font-display text-2xl font-bold text-[#0B2540]">
            MATLAB Simulink Resource Planning Analytics
          </h1>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 shrink-0"
        >
          <Download className="h-4 w-4 text-[#0D9488]" />
          Download Simulink CSV Template
        </button>
      </div>

      {/* Explicit Transparency Notice */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Simulation Mode Transparency:</strong> Because MATLAB/Simulink runtime is not installed in this cloud container, default scenarios run in{' '}
          <strong>Explicitly Labelled Illustrative Analytical Simulation Mode</strong>. Use the CSV Import Interface below to load genuine exported MATLAB Simulink (SimEvents) run outputs.
        </div>
      </div>

      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs font-medium ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 6 Scenario Selector Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {data.simulations.map((sim) => {
          const active = selected?.id === sim.id;
          return (
            <button
              key={sim.id}
              type="button"
              onClick={() => setSelectedId(sim.id)}
              className={`rounded-2xl border p-4 text-left transition-colors ${
                active
                  ? 'border-[#0D9488] bg-teal-50/40 shadow-xs'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-sm font-bold text-[#0B2540]">{sim.name}</span>
                <span className="font-mono text-xs font-bold text-[#0F766E] tabular-nums">
                  {sim.avgWaitTimeMinutes}m wait
                </span>
              </div>
              <div className="mt-1 text-[11px] font-medium text-slate-500">{sim.source}</div>
              <p className="mt-2 text-xs text-slate-600 line-clamp-2">{sim.description}</p>
              <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between font-mono text-[11px] text-slate-700 tabular-nums">
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
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div>
              <div className="text-xs font-semibold text-[#0F766E]">{selected.source}</div>
              <h2 className="font-display text-lg font-bold text-[#0B2540]">
                {selected.name} — Hourly Queue &amp; Waiting Time Curve
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Primary Bottleneck: <strong>{selected.bottleneck}</strong>
              </p>
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selected.hourlyQueueCurve} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 11, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="queueLength" name="Queue Length (Patients)" stroke="#0B2540" strokeWidth={2.5} />
                  <Line type="monotone" dataKey="waitMinutes" name="Wait Time (Minutes)" stroke="#D97706" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
            <h3 className="font-display text-base font-bold text-[#0B2540]">
              District Capacity Parameters
            </h3>
            <div className="divide-y divide-slate-100 text-xs">
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
                <div key={k} className="flex items-center justify-between py-2">
                  <span className="text-slate-600">{k}</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Multi-Scenario Bar Comparison */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-display text-base font-bold text-[#0B2540] mb-1">
          Cross-Scenario Operational Comparison
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Compare wait times (minutes), queue lengths, and resource utilization (%) across all modeled scenarios.
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={comparisonData} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} />
              <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="waitMin" name="Avg Wait (min)" fill="#12598C" radius={[5, 5, 0, 0]} />
              <Bar dataKey="queue" name="Avg Queue" fill="#D97706" radius={[5, 5, 0, 0]} />
              <Bar dataKey="utilization" name="Utilization (%)" fill="#0D9488" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* MATLAB Simulink CSV Import Interface */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#0D9488]" />
            <h2 className="font-display text-base font-bold text-[#0B2540]">
              Import Actual MATLAB Simulink CSV Outputs (Administrator Only)
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setCsvText(SAMPLE_SIMULINK_CSV)}
            className="text-xs font-semibold text-[#0D9488] hover:underline"
          >
            Load Sample Simulink CSV Format
          </button>
        </div>

        <form onSubmit={handleImportSubmit} className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-100">
              <Upload className="h-3.5 w-3.5 text-[#0D9488]" />
              Choose .csv file
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFile} className="hidden" />
            </label>
            <span className="text-slate-500">
              Expected headers: <code>scenarioKey,name,dailyPatientArrivals,camerasAvailable,...</code>
            </span>
          </div>

          <textarea
            rows={4}
            required
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste exported MATLAB Simulink CSV rows here..."
            className="w-full rounded-xl border border-slate-300 p-3 font-mono text-[11px]"
          />

          <button
            type="submit"
            disabled={importing || !isOnline || !csvText.trim()}
            className="rounded-xl bg-[#0B2540] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#113556] disabled:opacity-50"
          >
            {importing ? 'Importing...' : 'Import Simulink Scenarios'}
          </button>
        </form>
      </section>
    </div>
  );
};
