import React, { useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  Cpu,
  FileWarning,
  Lock,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AppNavView, BootstrapPayload } from '../types/domain';

interface AdminDashboardProps {
  data: BootstrapPayload;
  onNavigate: (view: AppNavView) => void;
  token?: string | null;
  onRefresh?: () => void;
  onToast?: (msg: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  data,
  onNavigate,
  token,
  onRefresh,
  onToast,
}) => {
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState<'doctor' | 'admin'>('doctor');
  const [staffFacility, setStaffFacility] = useState('');
  const [staffTitle, setStaffTitle] = useState('');
  const [staffLang, setStaffLang] = useState<'en' | 'ta' | 'hi'>('en');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  const handleProvisionStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setStaffError('Admin session token missing.');
      return;
    }
    setStaffLoading(true);
    setStaffSuccess(null);
    setStaffError(null);
    try {
      const res = await fetch('/api/admin/staff-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          password: staffPassword,
          role: staffRole,
          facility: staffFacility || undefined,
          title: staffTitle || undefined,
          language: staffLang,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to provision staff account');
      setStaffSuccess(
        `Successfully provisioned ${staffRole === 'doctor' ? 'Clinician' : 'Administrator'} account for ${resData.user.name} (${resData.user.email}).`
      );
      setStaffName('');
      setStaffEmail('');
      setStaffPassword('');
      setStaffFacility('');
      setStaffTitle('');
      if (onRefresh) onRefresh();
      if (onToast) onToast(`Staff account provisioned for ${resData.user.name}`);
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : 'Error provisioning staff account');
    } finally {
      setStaffLoading(false);
    }
  };
  const totalScreenings = data.screenings.length;
  const ungradableCount = data.screenings.filter((s) => !s.quality.gradable).length;
  const rejectionRate =
    totalScreenings > 0 ? Math.round((ungradableCount / totalScreenings) * 100) : 0;

  const avgSimWait =
    data.simulations.length > 0
      ? Math.round(
          data.simulations.reduce((acc, s) => acc + s.avgWaitTimeMinutes, 0) /
            data.simulations.length
        )
      : 0;

  const scenarioChartData = data.simulations.slice(0, 6).map((s) => ({
    name: s.name.replace(/^\d+\.\s*/, ''),
    waitMinutes: s.avgWaitTimeMinutes,
    queueLength: s.avgQueueLength,
    utilization: s.resourceUtilizationPct,
  }));

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Admin Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-100/70 bg-gradient-to-r from-[#061727] via-[#0B2540] to-[#124E78] p-6 text-white shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-400/15 border border-teal-300/30 px-3.5 py-1 text-[13px] font-semibold text-teal-200 mb-2">
              <Building2 className="h-4 w-4" />
              <span>District Health Programme Oversight · {data.user.facility || 'District Administration'}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight">
              District Analytics &amp; Resource Capacity
            </h1>
            <p className="mt-1.5 text-[14px] sm:text-[15px] text-slate-100 max-w-2xl leading-relaxed">
              Monitor live application records across PHCs, provision clinical staff, and compare district capacity scenarios modeled for MATLAB Simulink integration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('simulink')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0D9488] px-4.5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#14B8A6] shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Cpu className="h-4.5 w-4.5" />
            <span>Open Simulink 6-Scenario Planner</span>
          </button>
        </div>
      </section>

      {/* Data Provenance Transparency Banner */}
      <div className="rounded-2xl border border-blue-100/80 bg-[#EAF4FD]/90 px-4.5 py-3.5 text-[14px] text-sky-950 flex flex-wrap items-center justify-between gap-2 shadow-2xs leading-relaxed">
        <span>
          <strong>Data Provenance:</strong> Operational counters below combine{' '}
          <span className="font-semibold text-[#0B2540]">
            {data.patients.filter((p) => !p.isSynthetic).length} live session record(s)
          </span>{' '}
          and{' '}
          <span className="font-semibold text-[#0B2540]">
            {data.patients.filter((p) => p.isSynthetic).length} synthetic prototype record(s)
          </span>
          . Simulation charts use explicitly labelled illustrative queueing outputs unless a MATLAB Simulink CSV is imported.
        </span>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 lg:gap-4.5">
        <div className="rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[14px] font-semibold text-slate-700">Registered Patients</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-50 text-[#0D9488]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-[26px] font-bold text-[#0B2540] tabular-nums">
            {data.patients.length}
          </div>
          <div className="mt-1 text-[13px] text-slate-600">Shared 3-pillar cohort</div>
        </div>

        <div className="rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[14px] font-semibold text-slate-700">Assessments Done</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-[26px] font-bold text-[#0B2540] tabular-nums">
            {data.assessments.length}
          </div>
          <div className="mt-1 text-[13px] text-slate-600">Prevent lifestyle scores</div>
        </div>

        <div className="rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[14px] font-semibold text-slate-700">Retinal Screenings</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-[26px] font-bold text-[#0B2540] tabular-nums">
            {totalScreenings}
          </div>
          <div className="mt-1 text-[13px] text-slate-600">
            {data.doctorReviews.length} doctor-reviewed
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[14px] font-semibold text-slate-700">Quality Rejection</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <FileWarning className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-[26px] font-bold text-[#0B2540] tabular-nums">
            {rejectionRate}%
          </div>
          <div className="mt-1 text-[13px] text-slate-600">
            {ungradableCount} ungradable capture(s)
          </div>
        </div>

        <div className="rounded-2xl border border-blue-100/70 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[14px] font-semibold text-slate-700">Avg Sim Wait Time</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2.5 font-display text-[26px] font-bold text-[#0B2540] tabular-nums">
            {avgSimWait} min
          </div>
          <div className="mt-1 text-[13px] text-slate-600">Across 6 scenarios</div>
        </div>
      </section>

      {/* Two Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5">
        {/* Facility Utilization Chart */}
        <div className="rounded-2xl border border-blue-100/70 bg-white p-5 lg:p-6 shadow-xs">
          <div className="mb-4">
            <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
              District Facility Resource Utilization
            </h2>
            <p className="mt-0.5 text-[14px] text-slate-600">
              Daily screening capacity vs. current utilization percentage across PHCs and mobile units
            </p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.districtResources} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
                <XAxis dataKey="facilityName" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '13px', borderColor: '#E2E8F0' }} />
                <Legend wrapperStyle={{ fontSize: '13px' }} />
                <Bar dataKey="dailyCapacity" name="Daily Capacity (Patients)" fill="#0B2540" radius={[6, 6, 0, 0]} />
                <Bar dataKey="currentUtilizationPct" name="Utilization (%)" fill="#0D9488" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Simulink Scenario Comparison Preview */}
        <div className="rounded-2xl border border-blue-100/70 bg-white p-5 lg:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                Simulink Scenario Comparison (Wait &amp; Queue)
              </h2>
              <p className="mt-0.5 text-[14px] text-slate-600">
                Illustrative analytical capacity model — import MATLAB CSV in Simulink Analytics
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('simulink')}
              className="text-[14px] font-semibold text-[#0D9488] hover:underline whitespace-nowrap cursor-pointer"
            >
              Inspect All 6 →
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scenarioChartData} margin={{ top: 8, right: 12, left: -16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '13px', borderColor: '#E2E8F0' }} />
                <Legend wrapperStyle={{ fontSize: '13px' }} />
                <Bar dataKey="waitMinutes" name="Avg Wait (min)" fill="#12598C" radius={[6, 6, 0, 0]} />
                <Bar dataKey="queueLength" name="Avg Queue" fill="#D97706" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Staff Provisioning Section (Controlled Administrator Workflow) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 mb-5 gap-2">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-teal-50 p-2.5 text-[#0D9488]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
                Clinical Staff &amp; Administrator Provisioning
              </h2>
              <p className="mt-0.5 text-[14px] text-slate-600">
                Authorized onboarding workflow: Only verified district administrators can provision Doctor or Admin accounts.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold text-emerald-800 border border-emerald-200">
            Protected RBAC Control
          </span>
        </div>

        {staffSuccess && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-[14px] font-semibold text-emerald-800">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
            <span>{staffSuccess}</span>
          </div>
        )}

        {staffError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-[14px] font-semibold text-rose-800">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-rose-600" />
            <span>{staffError}</span>
          </div>
        )}

        <form onSubmit={handleProvisionStaff} className="space-y-4.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                minLength={2}
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Dr. K. Senthil / Admin Officer"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-1.5">Work Email</label>
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="clinician@hospital.org"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-1.5">Assigned Role</label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as 'doctor' | 'admin')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 bg-white focus:border-[#0D9488] focus:outline-none"
              >
                <option value="doctor">Doctor / Clinician (Grading &amp; Clinical Care)</option>
                <option value="admin">District Administrator (Analytics &amp; Simulink)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-1.5">Facility / Hospital</label>
              <input
                type="text"
                value={staffFacility}
                onChange={(e) => setStaffFacility(e.target.value)}
                placeholder="e.g. Madurai Medical College Hospital"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-1.5">Professional Title</label>
              <input
                type="text"
                value={staffTitle}
                onChange={(e) => setStaffTitle(e.target.value)}
                placeholder="e.g. Senior Medical Officer (Ophthalmology)"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 focus:border-[#0D9488] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-1.5">Preferred Language</label>
              <select
                value={staffLang}
                onChange={(e) => setStaffLang(e.target.value as 'en' | 'ta' | 'hi')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 bg-white focus:border-[#0D9488] focus:outline-none"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="hi">हिन्दी (Hindi)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[15px] font-semibold text-slate-700 mb-1.5">
              Initial Password (min. 8 characters, hashed with salted scrypt on server)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              placeholder="Set a secure initial password for the staff member"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-slate-900 focus:border-[#0D9488] focus:outline-none"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-1 gap-2">
            <p className="text-[13px] text-slate-600">
              Account credentials will be verified via scrypt. An audit event <span className="font-mono text-slate-800 font-semibold">STAFF_ACCOUNT_PROVISIONED</span> will be permanently recorded.
            </p>
            <button
              type="submit"
              disabled={staffLoading || !token}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2540] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#124E78] transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Lock className="h-4 w-4 text-teal-400" />
              {staffLoading ? 'Provisioning Staff...' : 'Provision Staff Account'}
            </button>
          </div>
        </form>
      </section>

      {/* Audit Trail Snapshot */}
      <section className="rounded-2xl border border-blue-100/70 bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-blue-100/60 px-5 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#0D9488]" />
            <h2 className="font-display text-[18px] font-bold text-[#0B2540]">
              Recent Security &amp; Clinical Audit Trail
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('offline')}
            className="text-[14px] font-semibold text-[#0D9488] hover:underline"
          >
            Full Audit &amp; Sync Logs →
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 text-[13px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Actor &amp; Role</th>
                <th className="px-4 py-3.5">Action</th>
                <th className="px-4 py-3.5">Outcome</th>
                <th className="px-5 py-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[15px]">
              {data.auditLogs.slice(0, 8).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3.5 font-mono text-[13px] text-slate-600 whitespace-nowrap tabular-nums">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3.5 text-slate-900 font-medium whitespace-nowrap">
                    {log.userName} · <span className="capitalize text-slate-600">{log.role}</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-[13px] text-slate-800">{log.action}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`font-semibold ${
                        log.outcome === 'SUCCESS'
                          ? 'text-emerald-700'
                          : log.outcome === 'DENIED'
                          ? 'text-rose-700'
                          : 'text-amber-700'
                      }`}
                    >
                      {log.outcome}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
