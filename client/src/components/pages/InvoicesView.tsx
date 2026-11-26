import React from 'react';
import { Invoice, DashboardSummary } from '../../types';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { FileText, CheckCircle2, Clock, FileEdit, AlertCircle, RefreshCw, AlertTriangle, FilePlus } from 'lucide-react';

interface InvoicesViewProps {
  summary?: DashboardSummary | null;
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  onIssueInvoice: (inv: Invoice) => void;
  onRecordPayment: (inv: Invoice) => void;
  onEditDraft?: (inv: Invoice) => void;
  onDeleteDraft?: (inv: Invoice) => void;
  onCancelInvoice?: (inv: Invoice) => void;
  onDuplicateInvoice?: (inv: Invoice) => void;
  initialCustomerFilter?: string;
  isLoading?: boolean;
  error?: string | null;
  isStale?: boolean;
  onRetry?: () => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  summary,
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  onEditDraft,
  onDeleteDraft,
  onCancelInvoice,
  onDuplicateInvoice,
  initialCustomerFilter = '',
  isLoading: _isLoading = false,
  error = null,
  isStale = false,
  onRetry,
}) => {
  const issuedCount = summary?.metrics.totalInvoices.count ?? invoices.filter((i) => i.status === 'ISSUED').length;
  const draftCount = summary?.metrics.totalInvoices.draftCount ?? invoices.filter((i) => i.status === 'DRAFT').length;
  const paidCount = summary?.metrics.totalInvoices.paidCount ?? invoices.filter((i) => i.paymentStatus === 'PAID').length;
  const pendingCount = summary
    ? summary.metrics.totalInvoices.partialCount + summary.metrics.totalInvoices.unpaidCount
    : invoices.filter((i) => i.status === 'ISSUED' && (i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIALLY_PAID')).length;

  return (
    <div className="space-y-6">
      {/* Top Header with Title and Prominent Orange Create Invoice Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#0D1A33] p-5 sm:p-6 rounded-2xl border border-[#D5E4F5] dark:border-[#17274B] shadow-card">
        <div>
          <h2 className="text-xl font-extrabold text-[#0D1A33] dark:text-white tracking-tight">
            Invoice Registry & Billing
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate, issue, dispatch, and track Indian GST invoices with automated numbering and calculations
          </p>
        </div>

        <button
          onClick={onNewInvoice}
          type="button"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-[#FF6A2B] hover:bg-[#E85215] text-white shadow-orange hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex-shrink-0"
        >
          <FilePlus className="w-4 h-4" />
          <span>+ Create Invoice</span>
        </button>
      </div>

      {/* Error & Stale Data Banner */}
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

      {/* Stale Data Indicator */}
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {/* Issued */}
        <div className="bg-white dark:bg-[#0D1A33] rounded-xl border border-[#D5E4F5]/80 dark:border-[#17274B] p-4 shadow-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#F4F8FD] dark:bg-navy-900 border border-[#D5E4F5] text-[#4E77BD]">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Issued Invoices</div>
            <div className="text-xl font-extrabold text-[#0D1A33] dark:text-white mt-0.5">{issuedCount}</div>
          </div>
        </div>

        {/* Draft */}
        <div className="bg-white dark:bg-[#0D1A33] rounded-xl border border-[#D5E4F5]/80 dark:border-[#17274B] p-4 shadow-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#F0F4FA] dark:bg-navy-900 border border-[#C4D3EC] text-[#0D1A33] dark:text-slate-300">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Draft Invoices</div>
            <div className="text-xl font-extrabold text-[#0D1A33] dark:text-white mt-0.5">{draftCount}</div>
          </div>
        </div>

        {/* Paid */}
        <div className="bg-white dark:bg-[#0D1A33] rounded-xl border border-[#D5E4F5]/80 dark:border-[#17274B] p-4 shadow-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Settled (Paid)</div>
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-0.5">{paidCount}</div>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white dark:bg-[#0D1A33] rounded-xl border border-[#D5E4F5]/80 dark:border-[#17274B] p-4 shadow-card flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#FFF5F0] dark:bg-sunset-950/30 border border-[#FFD0BC] text-[#FF6A2B]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Awaiting Payment</div>
            <div className="text-xl font-extrabold text-[#FF6A2B] mt-0.5">{pendingCount}</div>
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
        onDuplicateInvoice={onDuplicateInvoice}
        initialCustomerFilter={initialCustomerFilter}
      />
    </div>
  );
};
