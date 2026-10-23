import React from 'react';
import { InvoiceStatus } from '../../types';
import { CheckCircle2, Clock, AlertTriangle, FileEdit } from 'lucide-react';

interface Props {
  status: InvoiceStatus;
}

export const InvoiceStatusBadge: React.FC<Props> = ({ status }) => {
  switch (status) {
    case 'PAID':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Paid
        </span>
      );
    case 'PENDING':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3.5 h-3.5" />
          Pending
        </span>
      );
    case 'OVERDUE':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          Overdue
        </span>
      );
    case 'DRAFT':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <FileEdit className="w-3.5 h-3.5" />
          Draft
        </span>
      );
  }
};
