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
  User,
  Copy,
} from 'lucide-react';
import { PaginationToolbar } from '../common/PaginationToolbar';
import { downloadInvoicePdf, fetchInvoices, apiFetch } from '../../services/api';
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
  onDuplicateInvoice?: (invoice: Invoice) => void;
  initialCustomerFilter?: string;
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
  onDuplicateInvoice,
  initialCustomerFilter = '',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState(initialCustomerFilter);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'ISSUED' | 'CANCELLED' | 'PAID' | 'UNPAID'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Synchronize initialCustomerFilter prop changes
  React.useEffect(() => {
    if (initialCustomerFilter !== undefined) {
      setCustomerFilter(initialCustomerFilter);
    }
  }, [initialCustomerFilter]);

  // Extract list of unique customers for the dropdown
  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>();
    invoices.forEach((inv) => {
      const name = inv.customerName || '';
      if (name) map.set(name, name);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [invoices]);

  const [remoteInvoices,setRemoteInvoices]=useState<Invoice[]>([]);
  const [totalCount,setTotalCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [listError,setListError]=useState('');
  const [revision,setRevision]=useState(0);
  const [selected,setSelected]=useState<string[]>([]);
  React.useEffect(()=>{
    let active=true;setLoading(true);setListError('');setSelected([]);
    const timer=setTimeout(async()=>{
      const result=await fetchInvoices({page,limit:pageSize,status:['DRAFT','ISSUED','CANCELLED'].includes(statusFilter)?statusFilter:undefined,
        paymentStatus:statusFilter==='PAID'?'PAID':statusFilter==='UNPAID'?'UNSETTLED':undefined,
        search:searchQuery,customerName:customerFilter||undefined,startDate,endDate});
      if(!active)return;
      if(!result.isBackendConnected)setListError('Unable to load invoices. Retry without changing your filters.');
      else {setRemoteInvoices(result.invoices);setTotalCount(result.totalCount);}
      setLoading(false);
    },200);
    return ()=>{active=false;clearTimeout(timer);};
  },[page,pageSize,statusFilter,searchQuery,customerFilter,startDate,endDate,revision,invoices]);
  const exportSelected=()=>{
    const rows=remoteInvoices.filter(i=>selected.includes(i.id));
    const cell=(value:unknown)=>'"'+String(value??'').replace(/^[=+@-]/,"'").replace(/"/g,'""')+'"';
    const csv=['Invoice,Customer,Date,Total,Credited,Balance',...rows.map(i=>[i.invoiceNumber,i.customerName,i.invoiceDate,i.grandTotal,i.creditedTotal||0,i.balanceRemaining].map(cell).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='selected-invoices.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const deleteSelected=async()=>{
    if(!confirm('Permanently delete '+selected.length+' selected drafts? Issued invoices cannot be deleted.'))return;
    try{const res=await apiFetch('/invoices/bulk-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:selected})});const json=await res.json();if(!res.ok)throw Error(json.error?.message||'Delete failed');setRevision(n=>n+1);}catch(error){setListError(error instanceof Error?error.message:'Delete failed');}
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleStatusChange = (val: any) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleCustomerChange = (val: string) => {
    setCustomerFilter(val);
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const paginatedInvoices = remoteInvoices;

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <div className="bg-white dark:bg-[#0D1A33] rounded-2xl border border-[#D5E4F5]/80 dark:border-[#17274B] shadow-card overflow-hidden">
      {/* Header toolbar */}
      <div className="p-4 sm:p-5 border-b border-[#D5E4F5]/80 dark:border-[#17274B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#0D1A33] dark:text-white">Invoices & Receivables</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-[#F4F8FD] dark:bg-navy-900 text-[#4E77BD] border border-[#D5E4F5] dark:border-navy-800">
              {totalCount} {totalCount === 1 ? 'record' : 'records'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            PostgreSQL billing registry: drafts, issued invoices, and payment statuses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNewInvoice && (
            <button
              onClick={onNewInvoice}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#FF6A2B] hover:bg-[#E85215] text-white shadow-orange transition-all hover:shadow-md"
            >
              <FilePlus className="w-3.5 h-3.5" />
              <span>+ New Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and search bar */}
      <div className="p-3 sm:p-4 bg-[#F4F8FD]/60 dark:bg-navy-950/60 border-b border-[#D5E4F5]/80 dark:border-[#17274B] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice # or customer..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-[#0D1A33] border border-[#D5E4F5] dark:border-navy-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#FF6A2B]/20 focus:border-[#FF6A2B] placeholder:text-slate-400 transition-all"
            />
          </div>

          {/* Customer Dropdown Filter (R10) */}
          <div className="relative min-w-[160px] max-w-xs">
            <div className="flex items-center gap-1 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5">
              <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <select
                aria-label="Filter by customer"
                value={customerFilter}
                onChange={(e) => handleCustomerChange(e.target.value)}
                className="w-full border-0 bg-transparent p-0 text-xs text-slate-700 focus:ring-0 cursor-pointer"
              >
                <option value="">All Customers</option>
                {uniqueCustomers.map((cust) => (
                  <option key={cust} value={cust}>
                    {cust}
                  </option>
                ))}
              </select>
              {customerFilter && (
                <button
                  type="button"
                  onClick={() => handleCustomerChange('')}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-bold ml-1"
                  title="Clear customer filter"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Date Range Filters (B4) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0 text-xs text-slate-700 focus:ring-0"
              title="From date"
            />
            <span className="text-slate-300">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="border-0 p-0 text-xs text-slate-700 focus:ring-0"
              title="To date"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="text-[10px] text-[#FF6A2B] hover:text-[#E85215] ml-1 font-bold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-[#0D1A33] p-1 rounded-xl border border-[#D5E4F5] dark:border-navy-800 text-xs font-medium">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-0.5" />
          {(['ALL', 'DRAFT', 'ISSUED', 'PAID', 'UNPAID', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleStatusChange(tab)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                statusFilter === tab
                  ? 'bg-[#FF6A2B] text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-[#0D1A33] dark:hover:text-white hover:bg-[#F4F8FD] dark:hover:bg-navy-900'
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
      {loading && <p role="status" className="p-4">Loading invoices…</p>}
      {listError && <p role="alert" className="p-4 text-red-700">{listError} <button className="underline" onClick={()=>setRevision(n=>n+1)}>Retry</button></p>}
      {totalCount === 0 ? (
        <EmptyState
          onNewInvoice={onNewInvoice}
          onResetFilters={() => {
            setSearchQuery('');
            setCustomerFilter('');
            setStatusFilter('ALL');
            setStartDate('');
            setEndDate('');
          }}
          isFiltered={Boolean(searchQuery || customerFilter || statusFilter !== 'ALL' || startDate || endDate)}
        />
      ) : (
        <>
          {/* Mobile View: Responsive Cards for screens <= 1024px / 375px */}
          <div className="block lg:hidden divide-y divide-slate-100">
            {paginatedInvoices.map((inv) => (
              <div
                key={inv.id}
                onClick={() => onSelectInvoice?.(inv)}
                className="p-4 hover:bg-[#F4F8FD] transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-mono font-bold text-sm text-[#0D1A33] hover:text-[#FF6A2B]">
                      {inv.invoiceNumber}
                    </div>
                    <div className="font-medium text-xs text-slate-700 mt-0.5">
                      {inv.customerName || '—'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-navy-950">
                      {formatAmount(Number(inv.grandTotal))}
                    </div>
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <InvoiceStatusBadge status={inv.status} />
                      {inv.status === 'ISSUED' && (
                        <InvoiceStatusBadge paymentStatus={inv.paymentStatus} />
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 mt-2">
                  <div className="flex items-center gap-2">
                    <span>Date: {inv.invoiceDate}</span>
                    <span>•</span>
                    <span>Due: {inv.dueDate}</span>
                  </div>
                </div>

                {/* Action buttons on mobile */}
                <div
                  className="flex items-center flex-wrap gap-1.5 pt-3 mt-2 border-t border-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onSelectInvoice?.(inv)}
                    className="px-2.5 py-1 text-xs font-semibold text-navy-900 bg-slate-100 hover:bg-[#8FB4E3]/20 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-navy-700" />
                    <span>View</span>
                  </button>

                  {onDuplicateInvoice && (
                    <button
                      type="button"
                      onClick={() => onDuplicateInvoice(inv)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                      title="Duplicate invoice"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await downloadInvoicePdf(inv.id, inv.invoiceNumber);
                      } catch (err: any) {
                        alert(`Download error: ${err.message}`);
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>

                  {inv.status === 'DRAFT' && onEditDraft && (
                    <button
                      type="button"
                      onClick={() => onEditDraft(inv)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}

                  {inv.status === 'DRAFT' && onIssueInvoice && (
                    <button
                      type="button"
                      onClick={() => onIssueInvoice(inv)}
                      className="px-2.5 py-1 text-xs font-semibold text-white bg-[#FF6A2B] hover:bg-[#e85b1f] shadow-sm rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <SendHorizontal className="w-3.5 h-3.5" />
                      <span>Issue</span>
                    </button>
                  )}

                  {inv.status === 'DRAFT' && onDeleteDraft && (
                    <button
                      type="button"
                      onClick={() => onDeleteDraft(inv)}
                      className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}

                  {inv.status === 'ISSUED' && inv.paymentStatus !== 'PAID' && onRecordPayment && (
                    <button
                      type="button"
                      onClick={() => onRecordPayment(inv)}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Pay</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D5E4F5] bg-[#F0F5FB] text-[11px] font-bold text-navy-800 uppercase tracking-wider">
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
                {paginatedInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => onSelectInvoice?.(inv)}
                    className="hover:bg-[#F4F8FD] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-navy-900 group-hover:text-[#FF6A2B] transition-colors">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {inv.customerName || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {inv.invoiceDate}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {inv.dueDate}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-navy-950">
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
                          aria-label={`Preview invoice ${inv.invoiceNumber}`}
                          className="p-1.5 text-slate-400 hover:text-[#FF6A2B] hover:bg-[#FFF2EC] rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {/* Explicit Duplicate Action */}
                        {onDuplicateInvoice && (
                          <button
                            type="button"
                            onClick={() => onDuplicateInvoice(inv)}
                            title="Duplicate invoice as fresh draft"
                            aria-label={`Duplicate invoice ${inv.invoiceNumber}`}
                            className="p-1.5 text-slate-400 hover:text-navy-900 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}

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
                          className="p-1.5 text-slate-400 hover:text-[#FF6A2B] hover:bg-[#FFF2EC] rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* B11: Edit and Delete for Draft Invoices */}
                        {inv.status === 'DRAFT' && onEditDraft && (
                          <button
                            type="button"
                            onClick={() => onEditDraft(inv)}
                            title="Edit Draft Invoice"
                            aria-label={`Edit draft invoice ${inv.invoiceNumber}`}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <FileEdit className="w-3.5 h-3.5 text-slate-600" />
                            <span>Edit</span>
                          </button>
                        )}

                        {inv.status === 'DRAFT' && onDeleteDraft && (
                          <button
                            type="button"
                            onClick={() => onDeleteDraft(inv)}
                            title="Delete Draft Invoice"
                            aria-label={`Delete draft invoice ${inv.invoiceNumber}`}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {inv.status === 'DRAFT' && onIssueInvoice && (
                          <button
                            type="button"
                            onClick={() => onIssueInvoice(inv)}
                            title="Issue Official Invoice"
                            aria-label={`Issue official invoice ${inv.invoiceNumber}`}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#FF6A2B] hover:bg-[#e85b1f] shadow-sm rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <SendHorizontal className="w-3 h-3 text-white" />
                            <span>Issue</span>
                          </button>
                        )}

                        {/* Share actions for Issued Invoices */}
                        {inv.status === 'ISSUED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openWhatsAppDispatch(inv)}
                              title="Open WhatsApp message draft"
                              aria-label={`Share invoice ${inv.invoiceNumber} via WhatsApp`}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openGmailDispatch(inv)}
                              title="Compose Gmail draft"
                              aria-label={`Share invoice ${inv.invoiceNumber} via Gmail`}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
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
                              aria-label={`Cancel invoice ${inv.invoiceNumber}`}
                              className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
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
                              aria-label={`Record payment for invoice ${inv.invoiceNumber}`}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <CreditCard className="w-3 h-3 text-emerald-600" />
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
        </>
      )}

      <div className="p-4 border-t border-slate-200/80 bg-[#F0F5FB]/40 flex flex-wrap items-center gap-3 no-print">
        <label className="flex items-center gap-2 text-xs font-semibold text-navy-900 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-[#FF6A2B] focus:ring-[#FF6A2B]"
            checked={selected.length === remoteInvoices.length && selected.length > 0}
            onChange={(e) => setSelected(e.target.checked ? remoteInvoices.map((i) => i.id) : [])}
          />
          Select current page
        </label>
        {remoteInvoices.map((i) => (
          <label key={i.id} className="flex items-center gap-1 text-xs font-mono text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-[#FF6A2B] focus:ring-[#FF6A2B]"
              checked={selected.includes(i.id)}
              onChange={(e) =>
                setSelected((ids) => (e.target.checked ? [...ids, i.id] : ids.filter((id) => id !== i.id)))
              }
            />
            {i.invoiceNumber}
          </label>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            disabled={!selected.length}
            onClick={exportSelected}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-navy-900 disabled:opacity-40 transition-colors shadow-sm"
          >
            Export selected CSV
          </button>
          <button
            disabled={!selected.length || selected.some((id) => remoteInvoices.find((i) => i.id === id)?.status !== 'DRAFT')}
            onClick={deleteSelected}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-40 transition-colors shadow-sm"
          >
            Delete selected drafts
          </button>
        </div>
      </div>
      {/* Pagination Toolbar */}
      <PaginationToolbar
        currentPage={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={(p) => setPage(p)}
        onPageSizeChange={(sz) => {
          setPageSize(sz);
          setPage(1);
        }}
        itemLabel="invoices"
      />
    </div>
  );
};
