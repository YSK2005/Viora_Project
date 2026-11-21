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
} from 'lucide-react';
import { fetchMySubscription, cancelSubscription } from '../../services/api';

interface CustomerPortalViewProps {
  onUpgradePlan: () => void;
  onLaunchWorkspace: () => void;
}

export const CustomerPortalView: React.FC<CustomerPortalViewProps> = ({
  onUpgradePlan,
  onLaunchWorkspace,
}) => {
  const [data, setData] = useState<{
    hasActiveSubscription: boolean;
    subscription: any | null;
    history: any[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel your recurring subscription? You will still retain access until the end of the current billing cycle.')) {
      return;
    }
    setCancelling(true);
    try {
      await cancelSubscription();
      alert('Subscription has been cancelled.');
      loadSubscription();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
        <span className="text-sm text-slate-500">Loading your customer subscription portal...</span>
      </div>
    );
  }

  const sub = data?.subscription;

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
            Customer Account Portal
          </span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-2">
            My Software Subscription & Invoices
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your Viora Bills software license, Razorpay payment receipts, and billing cycles.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onUpgradePlan}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold text-xs shadow-md shadow-emerald-700/20 flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>⚡ Test Razorpay ₹5</span>
          </button>

          <button
            type="button"
            onClick={onLaunchWorkspace}
            className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md shadow-teal-700/20 flex items-center gap-2 transition-all"
          >
            <span>Launch Invoicing Software</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Subscription Hero Card */}
      {sub ? (
        <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 text-white p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <CreditCard className="w-64 h-64" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Active License
                </span>
                <span className="text-xs text-slate-400 capitalize">
                  {sub.billingCycle.toLowerCase()} Billing
                </span>
              </div>

              <h2 className="text-3xl font-black tracking-tight">{sub.plan.name}</h2>
              <p className="text-slate-300 text-sm max-w-xl">{sub.plan.description}</p>

              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-teal-400" />
                  <span>Valid until: <strong>{new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN', { dateStyle: 'long' })}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-400" />
                  <span>Auto-renews on: <strong>{new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')}</strong></span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-start md:items-end justify-between gap-4 border-t md:border-t-0 md:border-l border-slate-700/60 pt-4 md:pt-0 md:pl-8">
              <div>
                <span className="text-xs text-slate-400 block">Subscription Fee</span>
                <div className="text-3xl font-black text-white">
                  ₹{Number(sub.amountPaid).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-teal-300 font-medium">Billed with Razorpay</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onUpgradePlan}
                  className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Upgrade / Change</span>
                </button>

                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancel}
                  className="px-3.5 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-red-400 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel Plan
                </button>
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
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            You do not currently have an active plan. Subscribe to one of our INR pricing plans to start generating GST bills and managing clients.
          </p>
          <button
            type="button"
            onClick={onUpgradePlan}
            className="px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-md transition-all inline-flex items-center gap-2"
          >
            <span>Browse Subscription Plans</span>
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
              Official Indian tax invoices for your Viora Bills SaaS software purchases.
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
                <th className="py-3 px-6">Gateway Reference</th>
                <th className="py-3 px-6">Amount (INR)</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {(data?.history || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    No payment history recorded yet.
                  </td>
                </tr>
              ) : (
                data?.history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">#{item.receiptNumber}</div>
                      <div className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-bold text-slate-900">{item.plan.name}</span>
                      <div className="text-[11px] text-slate-400 capitalize">{item.billingCycle.toLowerCase()}</div>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="text-teal-700 hover:text-teal-900 font-semibold text-xs hover:underline"
                      >
                        Print Tax Receipt
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
