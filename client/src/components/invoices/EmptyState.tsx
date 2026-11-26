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
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white dark:bg-[#0D1A33] rounded-2xl border border-[#D5E4F5] dark:border-[#17274B] shadow-card">
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-[#FFF5F0] dark:bg-sunset-950/40 border border-[#FFD0BC] dark:border-sunset-900 flex items-center justify-center text-[#FF6A2B] shadow-xs">
          <ReceiptText className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0D1A33] text-white flex items-center justify-center text-[10px] font-bold shadow-md">
          0
        </div>
      </div>

      <h3 className="text-base font-bold text-[#0D1A33] dark:text-white mb-1">
        {isFiltered ? 'No matching invoices found' : 'No invoices created yet'}
      </h3>
      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
        {isFiltered
          ? 'No invoices match your current search query or filter criteria. Try resetting your filters to view all records.'
          : 'Get started by creating your first GST tax invoice. Track payment collections and generate reports effortlessly.'}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {isFiltered && onResetFilters && (
          <button
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-[#F4F8FD] dark:bg-navy-900 hover:bg-[#EAF2FB] rounded-xl border border-[#D5E4F5] dark:border-navy-800 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Filters
          </button>
        )}
        {onNewInvoice && (
          <button
            onClick={onNewInvoice}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-[#FF6A2B] hover:bg-[#E85215] rounded-xl shadow-orange transition-all transform hover:-translate-y-0.5"
          >
            <FilePlus2 className="w-4 h-4" />
            + Create First Invoice
          </button>
        )}
      </div>
    </div>
  );
};
