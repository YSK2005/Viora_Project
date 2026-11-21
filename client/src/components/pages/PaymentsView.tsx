import {useDialog} from '../../hooks/useDialog';
import React, { useState, useEffect, useCallback } from 'react';
import { PaymentRecord, UserRole } from '../../types';
import { fetchPayments, reversePayment } from '../../services/api';
import {
  CreditCard,
  AlertCircle,
  Loader2,
  Calendar,
  IndianRupee,
  Search,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  RotateCcw,
  X,
  ShieldAlert,
} from 'lucide-react';

interface PaymentsViewProps {
  userRole?: UserRole | null;
  onSelectInvoice?: (invoiceId: string) => void;
  onOpenRecordPayment?: () => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  userRole,
  onSelectInvoice,
  onOpenRecordPayment,
}) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [method, setMethod] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reversal modal state
  const [reversingPayment, setReversingPayment] = useState<PaymentRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);
  const [reversalError, setReversalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dialogProps=useDialog(Boolean(reversingPayment),()=>{if(!isReversing)setReversingPayment(null);},'Reverse payment');
  const canReverse = userRole === 'OWNER' || userRole === 'ACCOUNTANT';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchPayments({
        page,
        limit,
        search: search.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        method: method !== 'ALL' ? method : undefined,
      });
      setPayments(res.payments);
      setTotalCount(res.totalCount);
    } catch (err: any) {
      setError(err.message || 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, [page, search, startDate, endDate, method]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amt: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amt);
  };

  const handleOpenReverse = (payment: PaymentRecord) => {
    setReversingPayment(payment);
    setReversalReason('');
    setReversalError(null);
  };

  const handleConfirmReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPayment) return;
    if (!reversalReason.trim() || reversalReason.trim().length < 5) {
      setReversalError('Please provide a substantive reversal reason (at least 5 characters).');
      return;
    }

    setIsReversing(true);
    setReversalError(null);
    try {
      await reversePayment(reversingPayment.id, reversalReason.trim());
      setNotice(`Payment of ${formatCurrency(reversingPayment.amount)} has been reversed.`);
      setTimeout(() => setNotice(null), 4000);
      setReversingPayment(null);
      setReversalReason('');
      await loadData();
    } catch (err: any) {
      setReversalError(err.message || 'Failed to reverse payment');
    } finally {
      setIsReversing(false);
    }
  };

  const totalCollectedOnPage = payments
    .filter((p) => !p.isReversed)
    .reduce((acc, p) => acc + p.amount, 0);
  const totalPages = Math.ceil(totalCount / limit) || 1;

  const handleClearFilters = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setMethod('ALL');
    setPage(1);
  };

  const hasActiveFilters = Boolean(search || startDate || endDate || method !== 'ALL');

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <RotateCcw className="w-4 h-4 text-rose-400" />
          <span>{notice}</span>
        </div>
      )}

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
            Real-time audit log of settlements, UPI receipts, bank transfers, and recorded reversals
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] text-emerald-800 font-semibold uppercase tracking-wider">
                Active on Page ({payments.filter((p) => !p.isReversed).length})
              </div>
              <div className="text-base font-bold text-emerald-900">
                {formatCurrency(totalCollectedOnPage)}
              </div>
            </div>
          </div>

          {onOpenRecordPayment && (
            <button
              onClick={onOpenRecordPayment}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all focus:ring-2 focus:ring-purple-400 focus:outline-none"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search invoice #, customer name, reference..."
            aria-label="Search payment records"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        {/* Method Filter */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="method-filter" className="text-xs text-slate-500 font-medium">Method:</label>
          <select
            id="method-filter"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            <option value="ALL">All Methods</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
            <option value="CARD">Card</option>
            <option value="CASH">Cash</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-400" /> Date:
          </span>
          <input
            type="date"
            value={startDate}
            aria-label="Start date filter"
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={endDate}
            aria-label="End date filter"
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="text-xs text-purple-700 hover:underline font-medium ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-3" />
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
          <div className="w-14 h-14 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 mx-auto mb-3">
            <CreditCard className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">
            {hasActiveFilters ? 'No matching payment records found' : 'No payments recorded yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {hasActiveFilters
              ? 'Try modifying your search query or expanding the date filter range.'
              : 'Payments are recorded against issued invoices. Issue an invoice and record client payments to build the audit ledger.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
          {/* Mobile Card View (<= 768px) */}
          <div className="block md:hidden divide-y divide-slate-100">
            {payments.map((p) => (
              <div
                key={p.id}
                className={`p-4 transition-colors ${
                  p.isReversed ? 'bg-rose-50/30' : 'hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    {onSelectInvoice ? (
                      <button
                        onClick={() => onSelectInvoice(p.invoiceId)}
                        className="inline-flex items-center gap-1 font-semibold text-purple-700 text-sm hover:underline"
                      >
                        <span>{p.invoiceNumber || 'INV'}</span>
                        <ExternalLink className="w-3 h-3 text-purple-500" />
                      </button>
                    ) : (
                      <span className="font-semibold text-purple-700 text-sm">{p.invoiceNumber || 'INV'}</span>
                    )}
                    <div className="font-medium text-navy-900 text-xs mt-0.5">{p.customerName || 'Customer'}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${p.isReversed ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                      {formatCurrency(p.amount)}
                    </div>
                    {p.isReversed ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 mt-1">
                        REVERSED
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 mt-1">
                        {p.method.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span>{p.paymentDate}</span>
                    {p.reference && <span className="text-slate-400 font-mono">• {p.reference}</span>}
                  </div>

                  {!p.isReversed && canReverse && (
                    <button
                      onClick={() => handleOpenReverse(p)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:underline px-2 py-1 rounded bg-rose-50 border border-rose-200/60"
                      title="Reverse this payment with recorded reason"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reverse</span>
                    </button>
                  )}
                </div>

                {p.isReversed && p.reversedReason && (
                  <div className="mt-2 text-[11px] bg-rose-50 text-rose-800 px-2.5 py-1.5 rounded border border-rose-200">
                    <span className="font-semibold">Reversal Reason: </span>
                    {p.reversedReason}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 font-mono text-[10px]">Status</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Amount</th>
                  {canReverse && <th className="py-3 px-4 text-center">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className={`transition-colors ${
                      p.isReversed ? 'bg-rose-50/30 text-slate-400' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-3.5 px-4 sm:px-6">
                      {onSelectInvoice ? (
                        <button
                          onClick={() => onSelectInvoice(p.invoiceId)}
                          className="inline-flex items-center gap-1 font-semibold text-purple-700 hover:text-purple-900 hover:underline"
                        >
                          <span>{p.invoiceNumber || 'INV'}</span>
                          <ExternalLink className="w-3 h-3 text-purple-500" />
                        </button>
                      ) : (
                        <span className="font-semibold text-purple-700">{p.invoiceNumber || 'INV'}</span>
                      )}
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
                        {p.method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {p.reference || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.isReversed ? (
                        <div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            REVERSED
                          </span>
                          {p.reversedReason && (
                            <div className="text-[10px] text-rose-700 mt-0.5 truncate max-w-xs" title={p.reversedReason}>
                              {p.reversedReason}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          CLEARED
                        </span>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 sm:px-6 text-right font-bold ${p.isReversed ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                      {formatCurrency(p.amount)}
                    </td>
                    {canReverse && (
                      <td className="py-3.5 px-4 text-center">
                        {!p.isReversed && (
                          <button
                            onClick={() => handleOpenReverse(p)}
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors focus:ring-2 focus:ring-rose-400 focus:outline-none"
                            title="Reverse this payment entry"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Reverse</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount} payments
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium text-slate-700">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                  className="p-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Reversal Modal */}
      {reversingPayment && (
        <div
          {...dialogProps}
          aria-modal="true"
          aria-labelledby="reverse-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="reverse-modal-title" className="text-sm font-bold text-navy-900">
                    Reverse Payment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Reverses financial impact while preserving original record for audit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReversingPayment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close reversal modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReverse} className="p-6 space-y-4">
              {reversalError && (
                <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{reversalError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice:</span>
                  <span className="font-semibold text-navy-900">{reversingPayment.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-medium text-navy-900">{reversingPayment.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Amount:</span>
                  <span className="font-bold text-rose-600">{formatCurrency(reversingPayment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Original Date:</span>
                  <span className="text-slate-700">{reversingPayment.paymentDate}</span>
                </div>
              </div>

              <div>
                <label htmlFor="reversal-reason-input" className="block text-xs font-semibold text-navy-900 mb-1">
                  Reason for Reversal <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="reversal-reason-input"
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="e.g., Check bounced, duplicate transfer entered, client disputed charge..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Required for compliance and immutable audit log. Minimum 5 characters.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReversingPayment(null)}
                  disabled={isReversing}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReversing || !reversalReason.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isReversing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Reversal</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};