import React, { useState, useMemo } from 'react';
import { MetricsGrid } from '../dashboard/MetricsGrid';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { Invoice, DashboardSummary } from '../../types';
import {
  FilePlus,
  Users,
  Package,
  CreditCard,
  ArrowUpRight,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

interface DashboardViewProps {
  summary?: DashboardSummary | null;
  invoices: Invoice[];
  userName?: string;
  businessName?: string;
  onSelectInvoice: (inv: Invoice) => void;
  onNewInvoice: () => void;
  onIssueInvoice?: (inv: Invoice) => void;
  onRecordPayment?: (inv: Invoice) => void;
  onEditDraft?: (inv: Invoice) => void;
  onDeleteDraft?: (inv: Invoice) => void;
  onCancelInvoice?: (inv: Invoice) => void;
  onDuplicateInvoice?: (inv: Invoice) => void;
  onNavigateToCustomers?: () => void;
  onNavigateToProducts?: () => void;
  onNavigateToPayments?: () => void;
  onNavigateToInvoices?: () => void;
  onDateRangeChange?: (startDate?: string, endDate?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  summary,
  invoices,
  userName = 'Administrator',
  businessName = 'Viora Bills Workspace',
  onSelectInvoice,
  onNewInvoice,
  onIssueInvoice,
  onRecordPayment,
  onEditDraft,
  onDeleteDraft,
  onCancelInvoice,
  onDuplicateInvoice,
  onNavigateToCustomers,
  onNavigateToProducts,
  onNavigateToPayments,
  onNavigateToInvoices,
  onDateRangeChange,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<'ALL' | 'TODAY' | 'MONTH' | 'CUSTOM'>('ALL');
  const [chartTimeframe, setChartTimeframe] = useState<'MONTHLY' | 'QUARTERLY' | 'YEARLY'>('MONTHLY');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

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

  // Compute Revenue Timeline for the Chart
  const revenueChartData = useMemo(() => {
    const monthlyBuckets: Record<string, { label: string; revenue: number; count: number }> = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Generate last 6 calendar months
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyBuckets[key] = {
        label: `${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
        revenue: 0,
        count: 0,
      };
    }

    invoices.forEach((inv) => {
      if (inv.status === 'ISSUED' && inv.invoiceDate) {
        const d = new Date(inv.invoiceDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyBuckets[key]) {
          monthlyBuckets[key].revenue += Number(inv.grandTotal || 0);
          monthlyBuckets[key].count += 1;
        }
      }
    });

    const entries = Object.values(monthlyBuckets);
    const maxRevenue = Math.max(...entries.map((e) => e.revenue), 1000);

    return { entries, maxRevenue };
  }, [invoices]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* 1. Welcome Section & Quick Action CTA */}
      <section className="bg-white dark:bg-[#0D1A33] rounded-2xl border border-[#D5E4F5] dark:border-[#17274B] p-6 sm:p-7 shadow-card relative overflow-hidden">
        {/* Subtle background flourish */}
        <div className="absolute top-0 right-0 w-80 h-full bg-gradient-to-l from-[#F4F8FD] to-transparent dark:from-navy-950 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#FFF5F0] dark:bg-sunset-950/40 border border-[#FFD0BC] dark:border-sunset-900 text-[#FF6A2B] text-[10.5px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>BILLING | INVOICING | PAYMENTS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-[#0D1A33] dark:text-white tracking-tight">
              Welcome back, {userName}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Managing billing and GST invoices for{' '}
              <span className="font-semibold text-[#0D1A33] dark:text-slate-200">{businessName}</span>.
              Track your revenue pipeline, collect receivables, and generate compliant invoices with ease.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={onNewInvoice}
              type="button"
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold bg-[#FF6A2B] hover:bg-[#E85215] text-white shadow-orange hover:shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              <FilePlus className="w-4 h-4" />
              <span>+ Create Invoice</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. Date Range Filter Toolbar */}
      <div className="bg-white dark:bg-[#0D1A33] rounded-xl border border-[#D5E4F5]/80 dark:border-[#17274B] p-3 shadow-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Reporting Window:</span>
          <div className="inline-flex rounded-lg bg-[#F0F5FB] dark:bg-navy-900 p-0.5 border border-[#D5E4F5]/60 dark:border-navy-800">
            {(['ALL', 'TODAY', 'MONTH', 'CUSTOM'] as const).map((preset) => (
              <button
                key={preset}
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  selectedPreset === preset
                    ? 'bg-white dark:bg-[#0D1A33] text-[#0D1A33] dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-[#0D1A33] dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                {preset === 'ALL' ? 'All Time' : preset === 'TODAY' ? 'Today' : preset === 'MONTH' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>
        </div>

        {selectedPreset === 'CUSTOM' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2.5 py-1 bg-[#F4F8FD] dark:bg-navy-950 border border-[#D5E4F5] dark:border-navy-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF6A2B]"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2.5 py-1 bg-[#F4F8FD] dark:bg-navy-950 border border-[#D5E4F5] dark:border-navy-800 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#FF6A2B]"
            />
            <button
              onClick={handleApplyCustomDates}
              className="px-3 py-1 font-bold text-white bg-[#FF6A2B] hover:bg-[#E85215] rounded-lg shadow-2xs"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* 3. Summary Metric Cards (5 Core Cards) */}
      <section aria-label="Financial Overview">
        <MetricsGrid summary={summary} />
      </section>

      {/* 4. Revenue Analytics Area & Quick Actions Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Revenue Trend Chart (2 columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0D1A33] rounded-2xl border border-[#D5E4F5]/90 dark:border-[#17274B] p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#F0F4FA] dark:border-navy-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#F4F8FD] dark:bg-navy-900 border border-[#D5E4F5] text-[#4E77BD]">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0D1A33] dark:text-white">
                    Revenue Analytics
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Gross billed invoice amounts across recent cycles
                  </p>
                </div>
              </div>

              {/* Timeframe Filter Tabs */}
              <div className="inline-flex rounded-lg bg-[#F0F5FB] dark:bg-navy-900 p-0.5 border border-[#D5E4F5]/60 dark:border-navy-800 text-[11px]">
                {(['MONTHLY', 'QUARTERLY', 'YEARLY'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setChartTimeframe(tab)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                      chartTimeframe === tab
                        ? 'bg-white dark:bg-[#0D1A33] text-[#0D1A33] dark:text-white shadow-2xs'
                        : 'text-slate-500 hover:text-[#0D1A33] dark:text-slate-400'
                    }`}
                  >
                    {tab.charAt(0) + tab.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Visual Bar / Trend Graphic with Dusk Blue Styling */}
            <div className="mt-6 space-y-4">
              <div className="h-44 sm:h-52 w-full flex items-end gap-3 sm:gap-4 pt-6 pb-2 px-2">
                {revenueChartData.entries.map((entry, idx) => {
                  const heightPercent = Math.max(8, Math.round((entry.revenue / revenueChartData.maxRevenue) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-[#0D1A33] text-white py-1 px-2 rounded-md shadow-lg pointer-events-none whitespace-nowrap mb-1">
                        {formatCurrency(entry.revenue)} ({entry.count} inv)
                      </div>
                      {/* Bar with Dusk Blue gradient */}
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[42px] rounded-t-lg bg-gradient-to-t from-[#8FB4E3] to-[#B6D1EF] dark:from-[#4E77BD] dark:to-[#8FB4E3] hover:from-[#FF6A2B] hover:to-[#FFAF8F] transition-all shadow-xs"
                      />
                      {/* Month Label */}
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {entry.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#F0F4FA] dark:border-navy-800 flex items-center justify-between text-xs text-slate-500">
            <span>Showing verified issued GST invoices</span>
            <span className="font-bold text-[#0D1A33] dark:text-white">
              Max cycle: {formatCurrency(revenueChartData.maxRevenue)}
            </span>
          </div>
        </div>

        {/* Right: Quick Actions Cards (1 column) */}
        <div className="bg-white dark:bg-[#0D1A33] rounded-2xl border border-[#D5E4F5]/90 dark:border-[#17274B] p-5 sm:p-6 shadow-card flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0D1A33] dark:text-white mb-1">
              Quick Actions
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
              Fast shortcuts to primary billing workflows
            </p>

            <div className="space-y-3">
              {/* 1. Create Invoice */}
              <button
                onClick={onNewInvoice}
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#FFF5F0] dark:bg-sunset-950/30 border border-[#FFD0BC] dark:border-sunset-900/40 hover:bg-[#FFE9DE] transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#FF6A2B] text-white flex items-center justify-center shadow-xs">
                    <FilePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0D1A33] dark:text-white">Create Invoice</div>
                    <div className="text-[10px] text-slate-500">Draft new GST bill</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#FF6A2B] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>

              {/* 2. Add Customer */}
              <button
                onClick={onNavigateToCustomers}
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F4F8FD] dark:bg-navy-950/40 border border-[#D5E4F5] dark:border-navy-800 hover:bg-[#EAF2FB] transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#8FB4E3] text-[#0D1A33] flex items-center justify-center shadow-xs">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0D1A33] dark:text-white">Add Customer</div>
                    <div className="text-[10px] text-slate-500">{summary?.counts.customers ?? 0} clients registered</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#4E77BD] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>

              {/* 3. Add Product or Service */}
              <button
                onClick={onNavigateToProducts}
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-[#F0F4FA] dark:bg-navy-950/40 border border-[#C4D3EC] dark:border-navy-800 hover:bg-[#E1E9F5] transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#0D1A33] text-white flex items-center justify-center shadow-xs">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0D1A33] dark:text-white">Add Product/Service</div>
                    <div className="text-[10px] text-slate-500">{summary?.counts.products ?? 0} catalog items</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#0D1A33] dark:text-slate-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>

              {/* 4. Record Payment */}
              <button
                onClick={onNavigateToPayments}
                type="button"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100/60 transition-colors group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#0D1A33] dark:text-white">Record Payment</div>
                    <div className="text-[10px] text-slate-500">Log bank/UPI transfer</div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#F0F4FA] dark:border-navy-800 text-center">
            <button
              onClick={onNavigateToInvoices}
              className="text-xs font-bold text-[#FF6A2B] hover:text-[#E85215] hover:underline"
            >
              View All Invoices & Records →
            </button>
          </div>
        </div>
      </div>

      {/* 5. Recent Activity / Invoices Table */}
      <section aria-label="Recent Invoices" className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-base font-bold text-[#0D1A33] dark:text-white">
              Recent Billing Activity
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest generated and issued tax invoices
            </p>
          </div>
          {onNavigateToInvoices && (
            <button
              onClick={onNavigateToInvoices}
              type="button"
              className="text-xs font-bold text-[#FF6A2B] hover:text-[#E85215] hover:underline flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <InvoiceTable
          invoices={invoices}
          onSelectInvoice={onSelectInvoice}
          onNewInvoice={onNewInvoice}
          onIssueInvoice={onIssueInvoice}
          onRecordPayment={onRecordPayment}
          onEditDraft={onEditDraft}
          onDeleteDraft={onDeleteDraft}
          onCancelInvoice={onCancelInvoice}
          onDuplicateInvoice={onDuplicateInvoice}
        />
      </section>
    </div>
  );
};
