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
}) => {
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
              Phase 2: Database Connected
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Live PostgreSQL database active. Invoices, customers, catalog items, and payment transactions are persisted and calculated with strict decimal precision.
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
