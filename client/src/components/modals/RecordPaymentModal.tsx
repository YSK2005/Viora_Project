import React, { useState } from 'react';
import { X, CreditCard, IndianRupee, Hash, AlertCircle } from 'lucide-react';
import { Invoice } from '../../types';
import { recordInvoicePayment } from '../../services/api';

interface RecordPaymentModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !invoice) return null;

  const [amount, setAmount] = useState(String(invoice.balanceRemaining || ''));
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amt);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payAmt = Number(amount);

    if (isNaN(payAmt) || payAmt <= 0) {
      setError('Payment amount must be greater than zero');
      return;
    }

    if (payAmt > invoice.balanceRemaining) {
      setError(`Payment amount cannot exceed outstanding balance (${formatCurrency(invoice.balanceRemaining)})`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const requestKey = `PAY-${invoice.id.slice(-6)}-${Date.now()}`;
      await recordInvoicePayment(invoice.id, {
        amount: payAmt,
        method,
        reference: reference.trim() || undefined,
        requestKey,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment recording failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Record Payment</h3>
              <p className="text-[11px] text-slate-500">{invoice.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Invoice Summary Pill */}
        <div className="mx-6 mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-600">
            <span>Customer:</span>
            <span className="font-semibold text-navy-900">{invoice.customerName}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total Invoiced:</span>
            <span>{formatCurrency(invoice.grandTotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Already Paid:</span>
            <span className="text-emerald-700">{formatCurrency(invoice.totalPaid)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
            <span>Balance Outstanding:</span>
            <span className="text-amber-700">{formatCurrency(invoice.balanceRemaining)}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                max={invoice.balanceRemaining}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-rose-500">*</span>
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            >
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
              <option value="CHEQUE">Cheque / Demand Draft</option>
              <option value="CARD">Debit / Credit Card</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / Transaction ID / UTR Number
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. AXIS992148201 / UPI12345"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || invoice.balanceRemaining <= 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
