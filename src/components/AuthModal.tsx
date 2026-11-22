import React, { useState } from 'react';
import { Building2, Lock, Shield, Stethoscope, User, X } from 'lucide-react';
import type { LanguageCode, UserAccount, UserRole } from '../types/domain';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onSwitchDemoRole: (role: UserRole) => Promise<void>;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    language: LanguageCode;
  }) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  currentUser,
  onSwitchDemoRole,
  onLogin,
  onRegister,
}) => {
  const [tab, setTab] = useState<'demo' | 'login' | 'register'>('demo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('patient');
  const [regLang, setRegLang] = useState<LanguageCode>('en');

  if (!open) return null;

  const handleDemo = async (role: UserRole) => {
    setError(null);
    setLoading(true);
    try {
      await onSwitchDemoRole(role);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to switch role.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onLogin(email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await onRegister({ name, email, password, role: regRole, language: regLang });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-[#F8FAFC]">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              Account &amp; Role-Based Access
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Active session: {currentUser.name} ({currentUser.role}) · Server-verified Bearer token in memory
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Segmented tabs */}
        <div className="flex gap-1 border-b border-slate-200 bg-slate-50 p-2 px-6">
          <button
            type="button"
            onClick={() => {
              setTab('demo');
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === 'demo' ? 'bg-white text-[#0B2540] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Synthetic Role Demos
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === 'login' ? 'bg-white text-[#0B2540] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Email Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              tab === 'register' ? 'bg-white text-[#0B2540] shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register Account
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}

          {tab === 'demo' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed">
                Switch between three authenticated synthetic personas. Every switch issues a fresh server session token and enforces backend role permissions on all APIs.
              </p>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleDemo('patient')}
                className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors ${
                  currentUser.role === 'patient'
                    ? 'border-[#0D9488] bg-teal-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    Shwetha V · Patient Portal
                  </div>
                  <div className="text-xs text-slate-500">
                    Personal prevention assessment, 12-month programme, retinal screening status, offline habit sync
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleDemo('doctor')}
                className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors ${
                  currentUser.role === 'doctor'
                    ? 'border-[#0D9488] bg-teal-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    Dr. Arvind Raman · Doctor / Clinician Workspace
                  </div>
                  <div className="text-xs text-slate-500">
                    Retinal AI review &amp; Grad-CAM sign-off, HbA1c/FPG entry, triage protocols, referrals &amp; follow-ups
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => void handleDemo('admin')}
                className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors ${
                  currentUser.role === 'admin'
                    ? 'border-[#0D9488] bg-teal-50/50'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-900">
                    Meenakshi Sundaram · District Administrator
                  </div>
                  <div className="text-xs text-slate-500">
                    District screening throughput, referral queues, MATLAB Simulink 6-scenario analytics &amp; audit logs
                  </div>
                </div>
              </button>
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="clinician@hospital.org"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-[#0D9488] focus:outline-none focus:ring-2 focus:ring-[#0D9488]/20"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B2540] py-2.5 text-sm font-semibold text-white hover:bg-[#113556] disabled:opacity-60"
              >
                <Lock className="h-4 w-4" />
                {loading ? 'Verifying...' : 'Sign In Securely'}
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Kavitha R"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-[#0D9488] focus:outline-none"
                  >
                    <option value="patient">Patient</option>
                    <option value="doctor">Doctor / Healthcare Worker</option>
                    <option value="admin">District Administrator</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.org"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
                  <select
                    value={regLang}
                    onChange={(e) => setRegLang(e.target.value as LanguageCode)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:border-[#0D9488] focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                    <option value="hi">हिन्दी (Hindi Scaffold)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Password (min. 8 characters, salted scrypt hash on server)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0D9488] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0D9488] py-2.5 text-sm font-semibold text-white hover:bg-[#0F766E] disabled:opacity-60"
              >
                <Shield className="h-4 w-4" />
                {loading ? 'Creating Account...' : 'Create Protected Account'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
