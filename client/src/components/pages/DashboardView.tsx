import React from 'react';
import { MetricsGrid } from '../dashboard/MetricsGrid';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { Invoice, DashboardSummary } from '../../types';
import {
  FilePlus,
  Sparkles,
  Database,
  Layers,
  FileCheck2,
  Users,
  Package,
} from 'lucide-react';

interface DashboardViewProps {
  summary?: DashboardSummary | null;
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  isSimulatedEmpty: boolean;
  onSimulateEmptyToggle: (val: boolean) => void;
  onNavigateToCustomers?: () => void;
  onNavigateToProducts?: () => void;
  onDateRangeChange?: (startDate?: string, endDate?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  invoices,
  onSelectInvoice,
  onNewInvoice,
  isSimulatedEmpty,
  onSimulateEmptyToggle,
  onNavigateToCustomers,
  onNavigateToProducts,
  onDateRangeChange,
}) => {
  const [selectedPreset, setSelectedPreset] = React.useState<'ALL' | 'TODAY' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customStart, setCustomStart] = React.useState('');
  const [customEnd, setCustomEnd] = React.useState('');

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const monthStartStr = todayStr.slice(0, 7) + '-01';

  const handlePresetSelect = (preset: 'ALL' | 'TODAY' | 'MONTH' | 'CUSTOM') => {
    setSelectedPreset(preset);
    if (preset === 'ALL') {
      onDateRangeChange?.(undefined, undefined);
    } else if (preset === 'TODAY') {
      onDateRangeChange?.(todayStr, todayStr);
    } else if (preset === 'MONTH') {
      onDateRangeChange?.(monthStartStr, todayStr);
    }
  };

  const handleApplyCustomDates = () => {
    if (customStart || customEnd) {
      onDateRangeChange?.(customStart || undefined, customEnd || undefined);
    }
  };

  const isZeroData = summary && summary.metrics.totalInvoices.count === 0 && summary.metrics.totalInvoices.draftCount === 0;

  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-navy-900 tracking-tight">
              {summary?.business?.name || 'Viora Tech Solutions'}
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <Sparkles className="w-3 h-3 text-teal-600" />
              Real-time Analytics Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live PostgreSQL database active. Sales, collections, outstanding balances, and customer ledger entries are persisted and calculated with strict decimal precision.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={onNewInvoice}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-sm transition-all hover:shadow"
          >
            <FilePlus className="w-4 h-4" />
            <span>Create Invoice</span>
          </button>
        </div>
      </div>

      {/* Date Range Selector Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Reporting Window:</span>
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
            <button
              onClick={() => handlePresetSelect('ALL')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedPreset === 'ALL'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => handlePresetSelect('TODAY')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedPreset === 'TODAY'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handlePresetSelect('MONTH')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedPreset === 'MONTH'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setSelectedPreset('CUSTOM')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                selectedPreset === 'CUSTOM'
                  ? 'bg-white text-navy-900 shadow-xs'
                  : 'text-slate-600 hover:text-navy-900'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {selectedPreset === 'CUSTOM' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <button
              onClick={handleApplyCustomDates}
              className="px-3 py-1 font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Empty Database Notice if applicable */}
      {isZeroData && (
        <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center">
          <h4 className="text-sm font-semibold text-navy-900 mb-1">No invoices found for this reporting period</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-3">
            All analytics and financial summaries reflect real persisted database records. Create and issue your first invoice to populate real-time sales and payment analytics.
          </p>
          <button
            onClick={onNewInvoice}
            className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-white border border-teal-300 hover:bg-teal-50 rounded-lg shadow-xs"
          >
            + Create New Invoice
          </button>
        </div>
      )}

      {/* Overview Metric Cards (Real PostgreSQL Calculations) */}
      <section aria-label="Financial Overview">
        <MetricsGrid summary={summary} />
      </section>

      {/* Secondary Quick Counts & Entity Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={onNavigateToCustomers}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card hover:border-teal-300 transition-colors cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-navy-900">Active Customer Directory</div>
              <div className="text-[11px] text-slate-500">
                {summary?.counts.customers ?? 0} registered client accounts
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-teal-700 hover:underline">Manage →</span>
        </div>

        <div
          onClick={onNavigateToProducts}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card hover:border-teal-300 transition-colors cursor-pointer flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-navy-900">Products & Services Catalog</div>
              <div className="text-[11px] text-slate-500">
                {summary?.counts.products ?? 0} billing catalog items
              </div>
            </div>
          </div>
          <span className="text-xs font-semibold text-teal-700 hover:underline">Manage →</span>
        </div>
      </section>

      {/* Recent Invoices Table */}
      <section aria-label="Recent Invoices">
        <InvoiceTable
          invoices={invoices}
          onSelectInvoice={onSelectInvoice}
          onNewInvoice={onNewInvoice}
          isSimulatedEmpty={isSimulatedEmpty}
          onSimulateEmptyToggle={onSimulateEmptyToggle}
        />
      </section>

      {/* Phase 2 Architecture Verification */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-2">
            <Database className="w-4 h-4 text-teal-600" />
            PostgreSQL 18 & Prisma ORM
          </div>
          <p className="text-xs text-slate-500">
            6 core relational models with foreign keys, indexes, and soft deletion protection for audited historical records.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-2">
            <FileCheck2 className="w-4 h-4 text-teal-600" />
            Decimal-Safe Arithmetic
          </div>
          <p className="text-xs text-slate-500">
            All money calculations use PostgreSQL NUMERIC and decimal.js without floating-point inaccuracies.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-2">
            <Layers className="w-4 h-4 text-teal-600" />
            Atomic Transactions
          </div>
          <p className="text-xs text-slate-500">
            Invoice issuance, sequential numbering, and idempotency-locked payment settlements run within ACID transactions.
          </p>
        </div>
      </section>
    </div>
  );
};
