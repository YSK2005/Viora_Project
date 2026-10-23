import React, { useState, useEffect, useCallback } from 'react';
import { PaymentRecord } from '../../types';
import { fetchPayments } from '../../services/api';
import {
  CreditCard,
  AlertCircle,
  Loader2,
  Calendar,
  IndianRupee,
} from 'lucide-react';

export const PaymentsView: React.FC = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPayments();
      setPayments(res.payments);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(amt);
  };

  const totalCollected = payments.reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-navy-900 tracking-tight">Payment Receipts & Inflows</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Live Database
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time audit log of settlements, UPI receipts, and bank transfers
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] text-emerald-800 font-semibold uppercase tracking-wider">
              Total Collections
            </div>
            <div className="text-base font-bold text-emerald-900">
              {formatCurrency(totalCollected)}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading payments ledger...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 rounded-xl border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-rose-900">Failed to load payments</h4>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200/80 shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mx-auto mb-3">
            <CreditCard className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No payments recorded yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
            Payments are recorded against issued invoices. Issue an invoice and record client payments to build the audit ledger.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 font-mono text-[10px] hidden md:table-cell">Request Key</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-semibold text-teal-700">
                      {p.invoiceNumber || 'INV'}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-navy-900">
                      {p.customerName || 'Customer'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.paymentDate}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {p.method}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {p.reference || '—'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[10px] text-slate-400 hidden md:table-cell truncate max-w-xs">
                      {p.requestKey}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-bold text-emerald-700">
                      {formatCurrency(p.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
