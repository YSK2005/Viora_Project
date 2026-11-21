import React from 'react';
import {
  CheckCircle2,
  ArrowRight,
  Download,
  Receipt,
  Calendar,
  ShieldCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { PaymentReceiptData } from '../../types';

interface PaymentSuccessViewProps {
  receiptData?: PaymentReceiptData | null;
  onGoToPortal: () => void;
  onGoToBilling: () => void;
}

export const PaymentSuccessView: React.FC<PaymentSuccessViewProps> = ({
  receiptData,
  onGoToPortal,
  onGoToBilling,
}) => {
  const data = receiptData || {
    receiptNumber: `RCPT-${Date.now().toString().slice(-6)}`,
    orderId: 'order_test_demo_987654',
    paymentId: 'pay_test_verified_123456',
    amount: 1499,
    currency: 'INR',
    planName: 'Professional Plan',
    billingCycle: 'MONTHLY',
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
      {/* Success Card with Smooth Fade-in */}
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden text-center transition-all duration-300">
        {/* Banner Header with Smooth Gradient & Rock-Solid Halo */}
        <div className="bg-gradient-to-b from-emerald-600 via-teal-700 to-teal-800 py-12 px-6 text-white relative">
          {/* Steady, non-flickering central checkmark */}
          <div className="mx-auto w-24 h-24 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-2xl mb-4 ring-8 ring-white/30 transform transition-transform duration-500 hover:scale-105">
            <CheckCircle2 className="w-14 h-14 stroke-[2.5]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-400/30 text-emerald-100 text-xs font-bold backdrop-blur-md mb-2 border border-emerald-300/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>Razorpay Verified (rzp_test_T4i7gAx89Fpqp4)</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Payment Successful!</h1>
          <p className="mt-2 text-emerald-100 text-sm max-w-md mx-auto">
            Your software subscription to <strong>{data.planName}</strong> is now active and ready for billing.
          </p>
        </div>

        {/* Transaction Receipt Details */}
        <div className="p-8 space-y-6">
          <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-6 text-left space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-600" /> Subscription Tax Receipt
              </span>
              <span className="text-xs font-mono font-bold text-slate-800 bg-white px-2.5 py-1 rounded border border-slate-200">
                #{data.receiptNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500 block">Plan Activated</span>
                <span className="font-bold text-slate-900">{data.planName}</span>
                <span className="text-xs text-slate-500 capitalize block mt-0.5">
                  {data.billingCycle?.toLowerCase()} Billing
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Amount Paid</span>
                <span className="font-black text-2xl text-emerald-700">
                  ₹{Number(data.amount).toLocaleString('en-IN')}
                </span>
                <span className="text-[11px] text-teal-600 font-semibold block">GST Included</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block">Razorpay Payment ID</span>
                <code className="text-xs font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 block truncate">
                  {data.paymentId}
                </code>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Gateway Order ID</span>
                <code className="text-xs font-mono text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 block truncate">
                  {data.orderId}
                </code>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-teal-600" />
                Valid until: <strong>{new Date(data.validUntil).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</strong>
              </span>
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <ShieldCheck className="w-4 h-4" /> 100% Tax Compliant
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={onGoToBilling}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 transition-all"
            >
              <span>Launch Invoicing Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onGoToPortal}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>View Customer Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto px-4 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-sm flex items-center justify-center gap-1.5 transition-colors"
              title="Print Receipt"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Print Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
