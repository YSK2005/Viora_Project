import React from 'react';
import { Invoice } from '../../types';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { FileText, CheckCircle2, Clock, FileEdit } from 'lucide-react';

interface InvoicesViewProps {
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  onIssueInvoice: (inv: Invoice) => void;
  onRecordPayment: (inv: Invoice) => void;
  isSimulatedEmpty: boolean;
  onSimulateEmptyToggle: (val: boolean) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  isSimulatedEmpty,
  onSimulateEmptyToggle,
}) => {
  const issuedCount = invoices.filter((i) => i.status === 'ISSUED').length;
  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;
  const paidCount = invoices.filter((i) => i.paymentStatus === 'PAID').length;
  const pendingCount = invoices.filter(
    (i) => i.status === 'ISSUED' && (i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIALLY_PAID')
  ).length;

  return (
    <div className="space-y-6">
      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Issued Invoices</div>
            <div className="text-base font-bold text-navy-900">{issuedCount}</div>
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
        isSimulatedEmpty={isSimulatedEmpty}
        onSimulateEmptyToggle={onSimulateEmptyToggle}
      />
    </div>
  );
};
