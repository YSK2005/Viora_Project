import React from 'react';
import { StatCard } from './StatCard';
import { IndianRupee, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface MetricsGridProps {
  totalSales?: number;
  totalInvoicesCount?: number;
  amountCollected?: number;
  outstandingAmount?: number;
}

export const MetricsGrid: React.FC<MetricsGridProps> = ({
  totalSales = 1248500,
  totalInvoicesCount = 142,
  amountCollected = 985200,
  outstandingAmount = 263300,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {/* 1. Total Sales */}
      <StatCard
        title="Total Sales"
        value={formatCurrency(totalSales)}
        subtext="Fiscal Year 2025-26"
        trend={{ value: '+14.2%', isPositive: true }}
        icon={IndianRupee}
        accent="teal"
      />

      {/* 2. Total Invoices */}
      <StatCard
        title="Total Invoices"
        value={String(totalInvoicesCount)}
        subtext="114 paid · 20 pending"
        trend={{ value: '+8 new this week', isPositive: true }}
        icon={FileText}
        accent="navy"
      />

      {/* 3. Amount Collected */}
      <StatCard
        title="Amount Collected"
        value={formatCurrency(amountCollected)}
        subtext="78.9% collection efficiency"
        trend={{ value: '+5.4%', isPositive: true }}
        icon={CheckCircle2}
        accent="emerald"
      />

      {/* 4. Outstanding Payments */}
      <StatCard
        title="Outstanding Payments"
        value={formatCurrency(outstandingAmount)}
        subtext="8 overdue receivables"
        trend={{ value: 'Action required', isPositive: false }}
        icon={AlertCircle}
        accent="amber"
      />
    </div>
  );
};
