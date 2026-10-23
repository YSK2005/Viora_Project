import React from 'react';
import { MetricsGrid } from '../dashboard/MetricsGrid';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { Invoice } from '../../types';
import {
  FilePlus,
  Sparkles,
  Database,
  Layers,
  FileCheck2,
} from 'lucide-react';

interface DashboardViewProps {
  invoices: Invoice[];
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  isSimulatedEmpty: boolean;
  onSimulateEmptyToggle: (val: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  invoices,
  onSelectInvoice,
  onNewInvoice,
  isSimulatedEmpty,
  onSimulateEmptyToggle,
}) => {
  return (
    <div className="space-y-6">
      {/* Welcome & Quick Action Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-navy-900 tracking-tight">
              Welcome back to Viora Bills
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              <Sparkles className="w-3 h-3 text-teal-600" />
              Internship Project
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Phase 1 Foundation is active. Review operational analytics below and test the interactive invoice table, responsive layouts, and REST API health indicators.
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

      {/* Overview Metric Cards */}
      <section aria-label="Financial Overview">
        <MetricsGrid />
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

      {/* Phase 1 Verification & Roadmap Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-2">
            <Layers className="w-4 h-4 text-teal-600" />
            Monorepo Architecture
          </div>
          <p className="text-xs text-slate-500">
            Clean separation between <code className="text-teal-700 bg-teal-50 px-1 py-0.5 rounded">/client</code> (React + Vite + Tailwind) and <code className="text-navy-800 bg-slate-100 px-1 py-0.5 rounded">/server</code> (Express + TypeScript + Zod).
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-2">
            <Database className="w-4 h-4 text-teal-600" />
            PostgreSQL & Prisma Ready
          </div>
          <p className="text-xs text-slate-500">
            Schema is fully modeled with User, Customer, Product, Invoice, InvoiceItem, and Payment entities prepared for Phase 2 migrations.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-900 mb-2">
            <FileCheck2 className="w-4 h-4 text-teal-600" />
            API Standards
          </div>
          <p className="text-xs text-slate-500">
            Standardized response formats, robust error handling middleware, and <code className="text-teal-700 bg-teal-50 px-1 py-0.5 rounded">GET /api/health</code> verification endpoint.
          </p>
        </div>
      </section>
    </div>
  );
};
