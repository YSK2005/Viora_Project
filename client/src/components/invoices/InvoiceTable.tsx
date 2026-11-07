import React, { useState, useMemo } from 'react';
import { Invoice } from '../../types';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { EmptyState } from './EmptyState';
import {
  Search,
  Filter,
  Eye,
  FilePlus,
  ArrowUpDown,
  SlidersHorizontal,
  CreditCard,
  SendHorizontal,
  Download,
  FileEdit,
  MessageCircle,
  Mail,
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
  onSimulateEmptyToggle?: (isEmpty: boolean) => void;
  isSimulatedEmpty?: boolean;
}

export const InvoiceTable: React.FC<InvoiceTableProps> = ({
  invoices,
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  onEditDraft,
  onSimulateEmptyToggle,
  isSimulatedEmpty = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'PAID' | 'UNPAID'>('ALL');

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (isSimulatedEmpty) return [];

    return invoices.filter((inv) => {
      let matchesStatus = true;
      if (statusFilter === 'DRAFT') matchesStatus = inv.status === 'DRAFT';
      else if (statusFilter === 'ISSUED') matchesStatus = inv.status === 'ISSUED';
      else if (statusFilter === 'PAID') matchesStatus = inv.paymentStatus === 'PAID';
      else if (statusFilter === 'UNPAID') matchesStatus = inv.paymentStatus === 'UNPAID' || inv.paymentStatus === 'PARTIALLY_PAID';

      const q = searchQuery.toLowerCase().trim();
      const customer = (inv.customerName || '').toLowerCase();
      const num = (inv.invoiceNumber || '').toLowerCase();
      const matchesSearch = !q || num.includes(q) || customer.includes(q);

      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, searchQuery, isSimulatedEmpty]);

  // Format currency in standard Indian format (INR)
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
          {/* Empty state preview toggle */}
          {onSimulateEmptyToggle && (
            <button
              onClick={() => onSimulateEmptyToggle(!isSimulatedEmpty)}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isSimulatedEmpty
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Test empty state design"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {isSimulatedEmpty ? 'Empty State: ON' : 'Simulate Empty State'}
            </button>
          )}

          <button
            onClick={onNewInvoice}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all hover:shadow"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>New Invoice</span>
          </button>
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="px-4 py-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by invoice number or customer name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>

        {/* Status Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3 h-3" />
            Filter:
          </span>
          {(['ALL', 'ISSUED', 'DRAFT', 'PAID', 'UNPAID'] as const).map((filter) => {
            const isActive = statusFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-navy-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {filter === 'ALL' ? 'All' : filter.charAt(0) + filter.slice(1).toLowerCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Content or Empty State */}
      {filteredInvoices.length === 0 ? (
        <div className="p-6">
          <EmptyState
            onNewInvoice={onNewInvoice}
            onResetFilters={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
              if (isSimulatedEmpty && onSimulateEmptyToggle) {
                onSimulateEmptyToggle(false);
              }
            }}
            isFiltered={Boolean(searchQuery || statusFilter !== 'ALL')}
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4 hidden sm:table-cell">
                  <div className="flex items-center gap-1">
                    Invoice Date
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 hidden md:table-cell">Due Date</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-center">Lifecycle</th>
                <th className="py-3 px-4 text-center">Payment</th>
                <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => onSelectInvoice?.(inv)}
                >
                  {/* Invoice Number */}
                  <td className="py-3.5 px-4 sm:px-6 font-semibold text-purple-700 group-hover:underline">
                    {inv.invoiceNumber}
                  </td>

                  {/* Customer */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{inv.customerName || 'Customer'}</div>
                    {inv.customerEmail && (
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                        {inv.customerEmail}
                      </div>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-slate-500 hidden sm:table-cell">
                    {inv.invoiceDate}
                  </td>

                  {/* Due Date */}
                  <td className="py-3.5 px-4 text-slate-500 hidden md:table-cell">
                    {inv.dueDate}
                  </td>

                  {/* Amount */}
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {formatAmount(inv.grandTotal)}
                  </td>

                  {/* Lifecycle Status Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <InvoiceStatusBadge status={inv.status} />
                  </td>

                  {/* Payment Status Badge */}
                  <td className="py-3.5 px-4 text-center">
                    {inv.status === 'ISSUED' ? (
                      <InvoiceStatusBadge paymentStatus={inv.paymentStatus} />
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3.5 px-4 sm:px-6 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelectInvoice?.(inv)}
                        title="Preview & Print"
                        aria-label={`Preview invoice ${inv.invoiceNumber}`}
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
                        aria-label={`Download PDF for invoice ${inv.invoiceNumber}`}
                        className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-md transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>

                      {inv.status === 'DRAFT' && onEditDraft && (
                        <button
                          type="button"
                          onClick={() => onEditDraft(inv)}
                          title="Edit Draft"
                          aria-label={`Edit draft invoice ${inv.invoiceNumber}`}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                      )}

                      {inv.status === 'DRAFT' && onIssueInvoice && (
                        <button
                          type="button"
                          onClick={() => onIssueInvoice(inv)}
                          title="Issue Official Invoice"
                          aria-label={`Issue official invoice ${inv.invoiceNumber}`}
                          className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md flex items-center gap-1"
                        >
                          <SendHorizontal className="w-3 h-3 text-purple-600" />
                          Issue
                        </button>
                      )}

                      {inv.status === 'ISSUED' && (
                        <>
                          <button
                            type="button"
                            onClick={() => openWhatsAppDispatch(inv)}
                            title="Direct Send to Customer on WhatsApp"
                            aria-label={`Send invoice ${inv.invoiceNumber} via WhatsApp`}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openGmailDispatch(inv)}
                            title="Direct Send to Customer via Gmail"
                            aria-label={`Send invoice ${inv.invoiceNumber} via Gmail`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {inv.status === 'ISSUED' && inv.paymentStatus !== 'PAID' && onRecordPayment && (
                        <button
                          type="button"
                          onClick={() => onRecordPayment(inv)}
                          title="Record Payment"
                          aria-label={`Record payment for invoice ${inv.invoiceNumber}`}
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
