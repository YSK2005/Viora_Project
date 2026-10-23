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
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const totalSalesVal = summary ? summary.metrics.totalSales.amount : 0;
  const invoiceCountVal = summary ? summary.metrics.totalInvoices.count : 0;
  const draftCountVal = summary ? summary.metrics.totalInvoices.draftCount : 0;
  const collectedVal = summary ? summary.metrics.amountCollected.amount : 0;
  const collectionRate = summary ? summary.metrics.amountCollected.collectionRate : 0;
  const outstandingVal = summary ? summary.metrics.outstandingBalance.amount : 0;
  const unpaidCount = summary ? summary.metrics.totalInvoices.unpaidCount : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* 1. Total Sales */}
      <StatCard
        title="Total Sales"
        value={formatCurrency(totalSalesVal)}
        subtext="Issued Invoices (Excl. Drafts)"
        trend={
          totalSalesVal > 0
            ? { value: 'PostgreSQL Live', isPositive: true }
            : undefined
        }
        icon={IndianRupee}
        accent="teal"
      />

      {/* 2. Total Invoices */}
      <StatCard
        title="Total Invoices"
        value={String(invoiceCountVal)}
        subtext={`${draftCountVal} drafts in progress`}
        trend={
          invoiceCountVal > 0
            ? { value: `${invoiceCountVal} issued`, isPositive: true }
            : undefined
        }
        icon={FileText}
        accent="navy"
      />

      {/* 3. Amount Collected */}
      <StatCard
        title="Amount Collected"
        value={formatCurrency(collectedVal)}
        subtext={`${collectionRate}% collection efficiency`}
        trend={
          collectedVal > 0
            ? { value: 'Settled to date', isPositive: true }
            : undefined
        }
        icon={CheckCircle2}
        accent="emerald"
      />

      {/* 4. Outstanding Payments */}
      <StatCard
        title="Outstanding Receivables"
        value={formatCurrency(outstandingVal)}
        subtext={`${unpaidCount} unpaid/partial invoices`}
        trend={
          outstandingVal > 0
            ? { value: 'Pending collection', isPositive: false }
            : { value: 'All clear', isPositive: true }
        }
        icon={AlertCircle}
        accent="amber"
      />
    </div>
  );
};
