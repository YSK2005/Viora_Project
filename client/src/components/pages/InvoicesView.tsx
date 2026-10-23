import React from 'react';
import { Invoice } from '../../types';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface InvoicesViewProps {
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  isSimulatedEmpty: boolean;
  onSimulateEmptyToggle: (val: boolean) => void;
}

export const InvoicesView: React.FC<InvoicesViewProps> = ({
  invoices,
  onSelectInvoice,
  onNewInvoice,
  isSimulatedEmpty,
  onSimulateEmptyToggle,
}) => {
  const paidCount = invoices.filter((i) => i.status === 'PAID').length;
  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length;

  return (
    <div className="space-y-6">
      {/* Quick Summary Pill Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Total Invoices</div>
            <div className="text-base font-bold text-slate-900">{invoices.length}</div>
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

        <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Overdue</div>
            <div className="text-base font-bold text-rose-700">{overdueCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <InvoiceTable
        invoices={invoices}
        onSelectInvoice={onSelectInvoice}
        onNewInvoice={onNewInvoice}
        isSimulatedEmpty={isSimulatedEmpty}
        onSimulateEmptyToggle={onSimulateEmptyToggle}
      />
    </div>
  );
};
