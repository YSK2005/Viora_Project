import React from 'react';
import { FilePlus2, ReceiptText, RefreshCw } from 'lucide-react';

interface EmptyStateProps {
  onNewInvoice?: () => void;
  onResetFilters?: () => void;
  isFiltered?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  onNewInvoice,
  onResetFilters,
  isFiltered = false,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-xl border border-slate-200/80 shadow-card">
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
          <ReceiptText className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-navy-800 text-white flex items-center justify-center text-xs shadow-md">
          0
        </div>
      </div>

      <h3 className="text-base font-semibold text-slate-900 mb-1">
        {isFiltered ? 'No matching invoices found' : 'No invoices created yet'}
      </h3>
      <p className="text-sm text-slate-500 max-w-sm mb-6">
        {isFiltered
          ? 'No invoices match your current search query or status filter. Try clearing your filters.'
          : 'Get started by creating your first professional GST-ready invoice. Track payments and billing effortlessly.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {isFiltered && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset Filters
          </button>
        )}
        <button
          onClick={onNewInvoice}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-all hover:shadow"
        >
          <FilePlus2 className="w-4 h-4" />
          Create First Invoice
        </button>
      </div>
    </div>
  );
};
