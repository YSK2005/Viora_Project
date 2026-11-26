import React from 'react';
import { XCircle, RefreshCw, HelpCircle, ArrowLeft, ShieldAlert } from 'lucide-react';

interface PaymentFailedViewProps {
  errorDetails?: {
    message?: string;
    code?: string;
    orderId?: string;
  } | null;
  onRetry: () => void;
  onViewPlans: () => void;
}

export const PaymentFailedView: React.FC<PaymentFailedViewProps> = ({
  errorDetails,
  onRetry,
  onViewPlans,
}) => {
  const details = errorDetails || {
    message: 'The transaction was cancelled or declined by your financial institution.',
    code: 'TRANSACTION_DECLINED',
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white rounded-3xl shadow-2xl border border-red-100 overflow-hidden text-center transition-all duration-300">
        {/* Banner Header with Smooth Gradient & Rock-Solid Halo */}
        <div className="bg-gradient-to-b from-red-600 via-rose-700 to-rose-800 py-12 px-6 text-white relative">
          {/* Steady, non-flickering central cross */}
          <div className="mx-auto w-24 h-24 rounded-full bg-white flex items-center justify-center text-red-600 shadow-2xl mb-4 ring-8 ring-white/30 transform transition-transform duration-500 hover:scale-105">
            <XCircle className="w-14 h-14 stroke-[2.5]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-red-400/30 text-red-100 text-xs font-bold backdrop-blur-md mb-2 border border-red-300/30">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Razorpay Transaction Unsuccessful</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Payment Incomplete</h1>
          <p className="mt-2 text-red-100 text-sm max-w-md mx-auto">
            We were unable to process your subscription payment. No charges were deducted from your bank account.
          </p>
        </div>

        {/* Diagnostic Error Details */}
        <div className="p-8 space-y-6">
          <div className="rounded-2xl bg-red-50/70 border border-red-200/80 p-6 text-left space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-red-200/60">
              <span className="text-xs font-bold uppercase tracking-wider text-red-800">
                Diagnostic Details
              </span>
              <span className="text-xs font-mono font-bold text-red-700 bg-red-100 px-2.5 py-1 rounded">
                {details.code || 'ERR_PAYMENT_DECLINED'}
              </span>
            </div>

            <div className="text-sm text-slate-800 font-semibold">
              {details.message}
            </div>

            {details.orderId && (
              <div className="text-xs text-slate-500 pt-1">
                Gateway Reference: <code className="font-mono text-slate-700 font-bold">{details.orderId}</code>
              </div>
            )}
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry Payment with Razorpay</span>
            </button>

            <button
              type="button"
              onClick={onViewPlans}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Choose Another Plan</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-center gap-2">
            <HelpCircle className="w-4 h-4 text-slate-400" />
            <span>Need assistance? Contact us at <strong>support@viorabills.com</strong> or call <strong>+91 98765 43210</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
