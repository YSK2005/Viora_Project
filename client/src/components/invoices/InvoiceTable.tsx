import React, { useState, useMemo } from 'react';
import { Invoice } from '../../types';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { EmptyState } from './EmptyState';
import {
  Search,
  Filter,
  Eye,
  FilePlus,
  CreditCard,
  SendHorizontal,
  Download,
  FileEdit,
  MessageCircle,
  Mail,
  Trash2,
  Ban,
  Calendar,
} from 'lucide-react';
import { downloadInvoicePdf } from '../../services/api';
import { openWhatsAppDispatch, openGmailDispatch } from '../../utils/dispatchInvoice';

interface InvoiceTableProps {
  invoices: Invoice[];
  onSelectInvoice?: (invoice: Invoice) => void;
  onNewInvoice?: () => void;
  onIssueInvoice?: (invoice: Invoice) => void;
  onRecordPayment?: (invoice: Invoice) => void;
  onEditDraft?: (invoice: Invoice) => void;
  onDeleteDraft?: (invoice: Invoice) => void;
  onCancelInvoice?: (invoice: Invoice) => void;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  onEditDraft,
  onDeleteDraft,
  onCancelInvoice,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'PAID' | 'UNPAID'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Filtered invoices (B4: Apply search, status, and date filters)
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      let matchesStatus = true;
      if (statusFilter === 'DRAFT') matchesStatus = inv.status === 'DRAFT';
      else if (statusFilter === 'ISSUED') matchesStatus = inv.status === 'ISSUED';
      else if (statusFilter === 'CANCELLED') matchesStatus = inv.status === 'CANCELLED';
      else if (statusFilter === 'PAID') matchesStatus = inv.paymentStatus === 'PAID';
      else if (statusFilter === 'UNPAID')
        matchesStatus = inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIALLY_PAID';

      const q = searchQuery.toLowerCase().trim();
      const customer = (inv.customerName || '').toLowerCase();
      const num = (inv.invoiceNumber || '').toLowerCase();
      const matchesSearch = !q || num.includes(q) || customer.includes(q);

      let matchesDate = true;
      const invDate = inv.invoiceDate;
      if (startDate && invDate < startDate) matchesDate = false;
      if (endDate && invDate > endDate) matchesDate = false;

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [invoices, statusFilter, searchQuery, startDate, endDate]);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
      {/* Header toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">Invoices & Receivables</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              {filteredInvoices.length} {filteredInvoices.length === 1 ? 'record' : 'records'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            PostgreSQL billing registry: drafts, issued invoices, and payment statuses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNewInvoice && (
            <button
              onClick={onNewInvoice}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all hover:shadow"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>New Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice # or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Date Range Filters (B4) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-0 p-0 text-xs text-slate-700 focus:ring-0"
              title="From date"
            />
            <span className="text-slate-300">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-0 p-0 text-xs text-slate-700 focus:ring-0"
              title="To date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[10px] text-purple-600 hover:text-purple-800 ml-1 font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-xs font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          {(['ALL', 'DRAFT', 'ISSUED', 'PAID', 'UNPAID', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === tab
                  ? 'bg-purple-700 text-white font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {tab === 'ALL'
                ? 'All'
                : tab === 'DRAFT'
                ? 'Drafts'
                : tab === 'ISSUED'
                ? 'Issued'
                : tab === 'PAID'
                ? 'Paid'
                : tab === 'UNPAID'
                ? 'Unpaid'
                : 'Cancelled'}
            </button>
          ))}
        </div>
      </div>

      {/* Table content */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          onNewInvoice={onNewInvoice}
          onResetFilters={() => {
            setSearchQuery('');
            setStatusFilter('ALL');
            setStartDate('');
            setEndDate('');
          }}
          isFiltered={Boolean(searchQuery || statusFilter !== 'ALL' || startDate || endDate)}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Invoice Date</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => onSelectInvoice?.(inv)}
                  className="hover:bg-purple-50/30 transition-colors cursor-pointer group"
                >
                  <td className="py-3.5 px-4 sm:px-6 font-mono font-medium text-slate-900 group-hover:text-purple-700">
                    {inv.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    {inv.customerName || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {inv.invoiceDate}
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                    {inv.dueDate}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatAmount(Number(inv.grandTotal))}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {inv.status === 'ISSUED' ? (
                      <InvoiceStatusBadge paymentStatus={inv.paymentStatus} />
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>
                  <td
                    className="py-3.5 px-4 sm:px-6 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectInvoice?.(inv)}
                        title="Preview & Print"
                        className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await downloadInvoicePdf(inv.id, inv.invoiceNumber);
                          } catch (err: any) {
                            alert(`Download error: ${err.message}`);
                          }
                        }}
                        title="Download A4 PDF"
                        className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {/* B11: Edit and Delete for Draft Invoices */}
                      {inv.status === 'DRAFT' && onEditDraft && (
                        <button
                          type="button"
                          onClick={() => onEditDraft(inv)}
                          title="Edit Draft"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                      )}

                      {inv.status === 'DRAFT' && onDeleteDraft && (
                        <button
                          type="button"
                          onClick={() => onDeleteDraft(inv)}
                          title="Delete Draft"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      {inv.status === 'DRAFT' && onIssueInvoice && (
                        <button
                          type="button"
                          onClick={() => onIssueInvoice(inv)}
                          title="Issue Official Invoice"
                          className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md flex items-center gap-1"
                        >
                          <SendHorizontal className="w-3 h-3 text-purple-600" />
                          Issue
                        </button>
                      )}

                      {/* Share actions for Issued Invoices */}
                      {inv.status === 'ISSUED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openWhatsAppDispatch(inv)}
                            title="Open WhatsApp message draft"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openGmailDispatch(inv)}
                            title="Compose Gmail draft"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* B11: Cancel Issued Unpaid Invoices */}
                      {inv.status === 'ISSUED' &&
                        inv.paymentStatus === 'UNPAID' &&
                        onCancelInvoice && (
                          <button
                            type="button"
                            onClick={() => onCancelInvoice(inv)}
                            title="Cancel Invoice"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}

                      {inv.status === 'ISSUED' &&
                        inv.paymentStatus !== 'PAID' &&
                        onRecordPayment && (
                          <button
                            type="button"
                            onClick={() => onRecordPayment(inv)}
                            title="Record Payment"
                            className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md flex items-center gap-1"
                          >
                            <CreditCard className="w-3 h-3 text-purple-600" />
                            Pay
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer info */}
      <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
        <div>
          Showing {filteredInvoices.length} of {invoices.length} invoices
        </div>
      </div>
    </div>
  );
};
