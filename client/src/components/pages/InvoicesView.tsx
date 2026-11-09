import React from 'react';
import { Invoice } from '../../types';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { FileText, CheckCircle2, Clock, FileEdit, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react';

interface InvoicesViewProps {
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  onIssueInvoice: (inv: Invoice) => void;
  onRecordPayment: (inv: Invoice) => void;
  onEditDraft?: (inv: Invoice) => void;
  onDeleteDraft?: (inv: Invoice) => void;
  onCancelInvoice?: (inv: Invoice) => void;
  isLoading?: boolean;
  error?: string | null;
  isStale?: boolean;
  onRetry?: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  onEditDraft,
  onDeleteDraft,
  onCancelInvoice,
  isLoading: _isLoading = false,
  error = null,
  isStale = false,
  onRetry,
}) => {
  const issuedCount = invoices.filter((i) => i.status === 'ISSUED').length;
  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;
  const paidCount = invoices.filter((i) => i.paymentStatus === 'PAID').length;
  const pendingCount = invoices.filter(
    (i) => i.status === 'ISSUED' && (i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIALLY_PAID')
  ).length;

  return (
    <div className="space-y-6">
      {/* B18: Clear Error & Stale Data Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <div>
              <div className="text-xs font-bold text-rose-900">
                Failed to communicate with backend server
              </div>
              <div className="text-[11px] text-rose-700 mt-0.5">
                {error} {isStale && '(Displaying previously cached invoice data)'}
              </div>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Stale Data Indicator if no error banner active */}
      {!error && isStale && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Showing cached data. Backend server may be offline or restarting.</span>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="text-amber-800 font-semibold underline hover:text-amber-900"
            >
              Refresh Now
            </button>
          )}
        </div>
      )}

      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Issued Invoices</div>
            <div className="text-base font-bold text-slate-900">{issuedCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
            <FileEdit className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Draft Invoices</div>
            <div className="text-base font-bold text-slate-900">{draftCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Settled (Paid)</div>
            <div className="text-base font-bold text-emerald-700">{paidCount}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Awaiting Payment</div>
            <div className="text-base font-bold text-amber-700">{pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <InvoiceTable
        invoices={invoices}
        onSelectInvoice={onSelectInvoice}
        onNewInvoice={onNewInvoice}
        onIssueInvoice={onIssueInvoice}
        onRecordPayment={onRecordPayment}
        onEditDraft={onEditDraft}
        onDeleteDraft={onDeleteDraft}
        onCancelInvoice={onCancelInvoice}
      />
    </div>
  );
};
