import React from 'react';
import { StatCard } from './StatCard';
import { IndianRupee, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { DashboardSummary } from '../../types';

interface MetricsGridProps {
  summary?: DashboardSummary | null;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({ summary }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  const totalSalesVal = summary ? summary.metrics.totalSales.amount : 0;
  const invoiceCountVal = summary ? summary.metrics.totalInvoices.count : 0;
  const collectedVal = summary ? summary.metrics.amountCollected.amount : 0;
  const outstandingVal = summary ? summary.metrics.outstandingBalance.amount : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* 1. Total Sales */}
      <StatCard
        title="Total Sales"
        value={formatCurrency(totalSalesVal)}
        icon={IndianRupee}
        accent="purple"
      />

      {/* 2. Total Invoices */}
      <StatCard
        title="Total Invoices"
        value={String(invoiceCountVal)}
        icon={FileText}
        accent="purple"
      />

      {/* 3. Amount Collected */}
      <StatCard
        title="Amount Collected"
        value={formatCurrency(collectedVal)}
        icon={CheckCircle2}
        accent="purple"
      />

      {/* 4. Outstanding Payments */}
      <StatCard
        title="Outstanding Receivables"
        value={formatCurrency(outstandingVal)}
        icon={AlertCircle}
        accent="purple"
      />
    </div>
  );
};
