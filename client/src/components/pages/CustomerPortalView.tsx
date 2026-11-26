import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  Receipt,
  AlertCircle,
  Clock,
  Sparkles,
  Loader2,
  RefreshCw,
  ExternalLink,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Package,
  ShieldCheck,
} from 'lucide-react';
import { fetchMySubscription, cancelSubscription } from '../../services/api';

interface CustomerPortalViewProps {
  userEmail: string;
  onUpgradePlan: () => void;
}

function format12Digits(code?: string | null): string {
  if (!code) return '••••  ••••  ••••';
  const clean = code.replace(/\D/g, '');
  if (clean.length === 12) {
    return `${clean.slice(0, 4)}  ${clean.slice(4, 8)}  ${clean.slice(8, 12)}`;
  }
  return code;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  userEmail,
  onUpgradePlan,
}) => {
  const [data, setData] = useState<{
    hasActiveSubscription: boolean;
    subscription: any | null;
    history: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealCode, setRevealCode] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadSubscription = () => {
    setLoading(true);
    setError(null);
    fetchMySubscription()
      .then((res) => setData(res))
      .catch((err) => setError(err.message || 'Failed to load subscription details'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  const handleCopyCode = (code?: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCancel = async () => {
    if (
      !window.confirm(
        'Are you sure you want to cancel your subscription? Super Admin & Admin access will stop once cancelled.'
      )
    ) {
      return;
    }
    setCancelling(true);
    setError(null);
    try {
      await cancelSubscription();
      loadSubscription();
    } catch (err: any) {
      setError(err.message || 'Could not cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <span className="text-sm text-slate-500">Loading your software license & access key...</span>
      </div>
    );
  }

  const sub = data?.hasActiveSubscription ? data.subscription : null;
  const superAdminCode: string | undefined = sub?.superAdminAccessCode;
  const bizStats = sub?.business?._count;
  const isBillingAllowed = Boolean(sub?.business?.allowAdminBilling);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
            SaaS Buyer Account Portal (Port 5174)
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
            My Software License & Super Admin Access Key
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Purchase your Viora Bills software subscription via Razorpay to unlock your 12-digit Super Admin Access Code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onUpgradePlan}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>{sub ? 'Upgrade / Switch Plan' : 'Buy Subscription Plan'}</span>
          </button>

          {sub && (
            <a
              href="http://localhost:5175"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-2 transition-all"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Open Super Admin (5175)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Subscription + 12-Digit Super Admin Key */}
      {sub ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subscription Hero Card */}
            <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-7 shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <CreditCard className="w-52 h-52" />
              </div>

              <div className="relative z-10 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active License
                  </span>
                  <span className="text-xs text-slate-400 capitalize">
                    {sub.billingCycle.toLowerCase()} Billing • ₹{Number(sub.amountPaid).toLocaleString('en-IN')}
                  </span>
                </div>

                <h2 className="text-3xl font-black tracking-tight">{sub.plan.name}</h2>
                <p className="text-slate-300 text-sm max-w-xl">{sub.plan.description}</p>

                <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-teal-400" />
                    <span>
                      Valid until:{' '}
                      <strong>
                        {new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', {
                          dateStyle: 'long',
                        })}
                      </strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <span>
                      Workspace: <strong>{sub.business?.name || 'Provisioned'}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex flex-wrap items-center gap-3 pt-6 mt-6 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={onUpgradePlan}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upgrade / Change Plan</span>
                </button>

                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancel}
                  className="px-3.5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-red-400 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel License
                </button>
              </div>
            </div>

            {/* 12-Digit Super Admin Access Code Card */}
            <div className="rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-900 text-white p-7 shadow-2xl border border-indigo-400/30 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                    <KeyRound className="w-4 h-4 text-yellow-300" /> Super Admin Key
                  </span>
                  <button
                    type="button"
                    onClick={() => setRevealCode((v) => !v)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-indigo-100"
                    title={revealCode ? 'Hide 12-digit code' : 'Reveal 12-digit code'}
                  >
                    {revealCode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <h3 className="text-lg font-extrabold tracking-tight">
                  12-Digit Super Admin Code
                </h3>

                <div className="bg-slate-950/50 border border-white/15 rounded-2xl p-4 text-center">
                  <code className="text-xl font-mono font-black tracking-widest text-yellow-300 select-all">
                    {revealCode ? format12Digits(superAdminCode) : '••••  ••••  ••••'}
                  </code>
                </div>

                <p className="text-[11px] text-indigo-100 leading-relaxed">
                  Sign into <strong>Port 5175</strong> using email{' '}
                  <strong className="text-white">{userEmail}</strong> + password + this 12-digit code.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyCode(superAdminCode)}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-indigo-50 text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied 12-Digit Code!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy 12-Digit Access Code</span>
                    </>
                  )}
                </button>

                <a
                  href="http://localhost:5175"
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/40 border border-indigo-300/30 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Go to Super Admin (Port 5175)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* 3-Step Software Setup Progress Bar */}
          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span>Your 3-Step Billing Software Activation Workflow</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Step 1: Subscription Purchased</span>
                </div>
                <p className="text-emerald-700">
                  Active license & 12-digit Super Admin Access Code issued on Port 5174.
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border space-y-1 ${
                  (bizStats?.products || 0) > 0 && (bizStats?.adminAccessCodes || 0) > 0
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-indigo-50 border-indigo-200'
                }`}
              >
                <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span>Step 2: Super Admin Setup (Port 5175)</span>
                  </span>
                  <a
                    href="http://localhost:5175"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-700 underline text-[11px] whitespace-nowrap flex-shrink-0"
                  >
                    Open →
                  </a>
                </div>
                <p className="text-slate-600">
                  Products added: <strong>{bizStats?.products ?? 0}</strong> • Admin Codes:{' '}
                  <strong>{bizStats?.adminAccessCodes ?? 0}</strong>
                </p>
              </div>

              <div
                className={`p-4 rounded-2xl border space-y-1 ${
                  isBillingAllowed
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                  <span>Step 3: Admin Billing Desk (Port 5173)</span>
                  <a
                    href="http://localhost:5173"
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 underline text-[11px] whitespace-nowrap flex-shrink-0"
                  >
                    Open →
                  </a>
                </div>
                <p className="text-slate-600">
                  Billing Status:{' '}
                  <strong className={isBillingAllowed ? 'text-emerald-700' : 'text-amber-700'}>
                    {isBillingAllowed ? 'Authorized for Bills' : 'Awaiting Super Admin Approval'}
                  </strong>
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* No Active Subscription Banner */
        <div className="rounded-3xl bg-amber-50 border border-amber-200 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">No Active Software Subscription</h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto">
            Subscribe to any INR plan via Razorpay / UPI to unlock your <strong>12-Digit Super Admin Access Code</strong>, add your products on Port 5175, and generate GST bills on Port 5173.
          </p>
          <button
            type="button"
            onClick={onUpgradePlan}
            className="px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-2"
          >
            <span>Browse Subscription Plans & Buy Now</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Subscription Billing History */}
      <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-teal-700" />
              <span>Subscription Payment Receipts</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Official Indian tax receipts for your Viora Bills SaaS software purchases.
            </p>
          </div>
          <button
            type="button"
            onClick={loadSubscription}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-6">Receipt / Date</th>
                <th className="py-3 px-6">Plan Purchased</th>
                <th className="py-3 px-6">12-Digit Code</th>
                <th className="py-3 px-6">Gateway Reference</th>
                <th className="py-3 px-6">Amount (INR)</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {(data?.history || []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No payment history recorded yet.
                  </td>
                </tr>
              ) : (
                data?.history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">#{item.receiptNumber.slice(0, 8)}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-bold text-slate-900">{item.plan.name}</span>
                      <div className="text-[11px] text-slate-400 capitalize">{item.billingCycle.toLowerCase()}</div>
                    </td>
                    <td className="py-4 px-6">
                      {item.status === 'ACTIVE' && item.superAdminAccessCode ? (
                        <code className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 whitespace-nowrap">
                          {format12Digits(item.superAdminAccessCode)}
                        </code>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <code className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {item.razorpayPaymentId || item.razorpayOrderId || 'N/A'}
                      </code>
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      ₹{Number(item.amountPaid).toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                          item.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="text-teal-700 hover:text-teal-900 font-semibold text-xs hover:underline"
                      >
                        Print Receipt
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
