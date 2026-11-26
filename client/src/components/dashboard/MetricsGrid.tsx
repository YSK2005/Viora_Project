import React from 'react';
import { StatCard } from './StatCard';
import { IndianRupee, FileText, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { DashboardSummary } from '../../types';

interface MetricsGridProps {
  summary?: DashboardSummary | null;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ summary }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const totalSalesVal = summary ? summary.metrics.totalSales.amount : 0;
  const invoiceCountVal = summary ? summary.metrics.totalInvoices.count : 0;
  const paidCountVal = summary ? summary.metrics.totalInvoices.paidCount : 0;
  const pendingCountVal = summary
    ? summary.metrics.totalInvoices.partialCount + summary.metrics.totalInvoices.unpaidCount
    : 0;
  const outstandingVal = summary ? summary.metrics.outstandingBalance.amount : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {/* 1. Total Revenue */}
      <StatCard
        title="Total Revenue"
        value={formatCurrency(totalSalesVal)}
        icon={IndianRupee}
        variant="sunset"
        subtext="Cumulative gross billing"
      />

      {/* 2. Total Invoices */}
      <StatCard
        title="Total Invoices"
        value={String(invoiceCountVal)}
        icon={FileText}
        variant="dusk"
        subtext={`${summary?.metrics.totalInvoices.draftCount || 0} drafts in progress`}
      />

      {/* 3. Paid Invoices */}
      <StatCard
        title="Paid Invoices"
        value={String(paidCountVal)}
        icon={CheckCircle2}
        variant="emerald"
        subtext="Fully settled invoices"
      />

      {/* 4. Pending Invoices */}
      <StatCard
        title="Pending Invoices"
        value={String(pendingCountVal)}
        icon={Clock}
        variant="amber"
        subtext="Awaiting client payment"
      />

      {/* 5. Overdue / Outstanding */}
      <StatCard
        title="Overdue Balance"
        value={formatCurrency(outstandingVal)}
        icon={AlertTriangle}
        variant="rose"
        subtext="Unpaid receivables"
      />
    </div>
  );
};
