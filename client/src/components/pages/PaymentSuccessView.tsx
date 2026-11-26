import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Receipt,
  Calendar,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  KeyRound,
  Copy,
  Check,
  Mail,
} from 'lucide-react';
import { PaymentReceiptData } from '../../types';

interface PaymentSuccessViewProps {
  receiptData?: PaymentReceiptData | null;
  userEmail?: string;
  onGoToPortal: () => void;
}

function format12Digits(code?: string | null): string {
  if (!code) return 'PENDING-CODE';
  const clean = code.replace(/\D/g, '');
  if (clean.length === 12) {
    return `${clean.slice(0, 4)}  ${clean.slice(4, 8)}  ${clean.slice(8, 12)}`;
  }
  return code;
}

export const PaymentSuccessView: React.FC<PaymentSuccessViewProps> = ({
  receiptData,
  userEmail,
  onGoToPortal,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);

  const data: PaymentReceiptData = receiptData || {
    receiptNumber: `RCPT-${Date.now().toString().slice(-6)}`,
    orderId: 'N/A',
    paymentId: 'N/A',
    amount: 0,
    currency: 'INR',
    planName: 'Active Software Subscription',
    billingCycle: 'MONTHLY',
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString(),
    superAdminAccessCode: '',
    boundEmail: userEmail || '',
  };

  const rawCode = data.superAdminAccessCode || '';
  const boundEmail = data.boundEmail || userEmail || 'Your purchasing email';

  const handleCopyCode = () => {
    if (!rawCode) return;
    navigator.clipboard.writeText(rawCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 sm:px-6">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden text-center transition-all duration-300">
        {/* Banner Header */}
        <div className="bg-gradient-to-b from-emerald-600 via-teal-700 to-teal-800 py-10 px-6 text-white relative">
          <div className="mx-auto w-20 h-20 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-2xl mb-4 ring-8 ring-white/30">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-400/30 text-emerald-100 text-xs font-bold backdrop-blur-md mb-2 border border-emerald-300/30">
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>Razorpay Verified Subscription</span>
          </div>

          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Payment Successful!</h1>
          <p className="mt-2 text-emerald-100 text-sm max-w-md mx-auto">
            Your subscription to <strong>{data.planName}</strong> is active. Use the 12-digit code below to unlock your Super Admin Control Panel.
          </p>
        </div>

        <div className="p-8 space-y-6">
          {/* 12-Digit Super Admin Access Code Spotlight */}
          {rawCode && (
            <div className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 border border-indigo-400/30 shadow-xl text-left space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                  <KeyRound className="w-4 h-4 text-yellow-300" />
                  12-Digit Super Admin Access Code
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  ACTIVE KEY
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/10 rounded-xl p-4 border border-white/15">
                <code className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-yellow-300 select-all">
                  {format12Digits(rawCode)}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3.5 py-2 rounded-lg bg-white text-slate-900 hover:bg-indigo-50 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors flex-shrink-0"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied 12 Digits</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-xs text-slate-300 flex items-start gap-2">
                <Mail className="w-4 h-4 text-indigo-300 flex-shrink-0 mt-0.5" />
                <span>
                  Strictly bound to email <strong className="text-white">{boundEmail}</strong>. Sign into{' '}
                  <strong className="text-white">Super Admin Panel (Port 5175)</strong> with this email + password + 12-digit code to add products and generate Admin billing codes.
                </span>
              </div>
            </div>
          )}

          {/* Transaction Receipt Details */}
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
            <a
              href="http://localhost:5175"
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all"
            >
              <KeyRound className="w-4 h-4" />
              <span>Open Super Admin (Port 5175)</span>
              <ExternalLink className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={onGoToPortal}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>View My License & Receipts</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="w-full sm:w-auto px-4 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-sm flex items-center justify-center gap-1.5 transition-colors"
              title="Print Receipt"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
