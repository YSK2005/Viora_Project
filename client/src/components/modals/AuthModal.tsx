import {useDialog} from '../../hooks/useDialog';
import React, { useState } from 'react';
import { loginUser, registerUser, AuthResponse } from '../../services/api';
import { Lock, Mail, User as UserIcon, Building2, AlertCircle, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onSuccess: (data: AuthResponse) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onSuccess }) => {
  const dialogProps = useDialog(isOpen, undefined, 'Auth Modal');
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Full Name is required');
        if (!email.trim()) throw new Error('Email is required');
        if (password.length < 12) throw new Error('Password must be at least 12 characters');

        const authData = await registerUser({
          email: email.trim(),
          password,
          name: name.trim(),
          businessName: businessName.trim() || undefined,
        });
        onSuccess(authData);
      } else {
        if (!email.trim() || !password) throw new Error('Please enter email and password');
        const authData = await loginUser({
          email: email.trim(),
          password,
        });
        onSuccess(authData);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      {...dialogProps}
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-teal-700 to-slate-900 px-6 py-6 text-white text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 mb-3 backdrop-blur-md">
            <Lock className="h-6 w-6 text-teal-300" />
          </div>
          <h2 id="auth-modal-title" className="text-2xl font-bold tracking-tight">
            {isRegister ? 'Create Viora Bills Account' : 'Sign in to Viora Bills'}
          </h2>
          <p className="mt-1 text-sm text-teal-100">
            {isRegister
              ? 'Set up your company workspace and start issuing invoices'
              : 'Enter your credentials to access your billing dashboard'}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5 text-sm text-red-800"
            >
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    aria-label="Full Name" autoComplete="name" value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vipul Kumawat"
                    className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Business / Company Name (Optional)
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    aria-label="Business / Company Name" autoComplete="organization" value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Acme Tech Solutions"
                    className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                aria-label="Email Address" autoComplete="username" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="password"
                required
                aria-label="Password" autoComplete={isRegister ? "new-password" : "current-password"} minLength={isRegister ? 12 : 1} maxLength={128} value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'Min 12 characters' : 'Enter your password'}
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-700 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isRegister ? 'Creating Account...' : 'Signing In...'}</span>
              </>
            ) : (
              <span>{isRegister ? 'Create Account & Continue' : 'Sign In to Workspace'}</span>
            )}
          </button>

          <div className="pt-2 text-center text-sm text-slate-600">
            {isRegister ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setError(null);
                  }}
                  className="font-semibold text-teal-700 hover:text-teal-800 underline"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setError(null);
                  }}
                  className="font-semibold text-teal-700 hover:text-teal-800 underline"
                >
                  Create one now
                </button>
              </p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
