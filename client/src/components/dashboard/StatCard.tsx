import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtext?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon: LucideIcon;
  variant?: 'sunset' | 'dusk' | 'emerald' | 'amber' | 'rose' | 'navy';
}

export const StatCard: React.FC<StatCardProps> = React.memo(({
  title,
  value,
  subtext,
  trend,
  icon: Icon,
  variant = 'dusk',
}) => {
  const variantStyles = {
    sunset: {
      bgIcon: 'bg-[#FFF5F0] text-[#FF6A2B] border-[#FFD0BC]',
      badge: 'bg-[#FFF5F0] text-[#FF6A2B]',
    },
    dusk: {
      bgIcon: 'bg-[#F4F8FD] text-[#4E77BD] border-[#D5E4F5]',
      badge: 'bg-[#F4F8FD] text-[#4E77BD]',
    },
    navy: {
      bgIcon: 'bg-[#F0F4FA] text-[#0D1A33] border-[#C4D3EC]',
      badge: 'bg-[#F0F4FA] text-[#0D1A33]',
    },
    emerald: {
      bgIcon: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
      badge: 'bg-emerald-50 text-emerald-700',
    },
    amber: {
      bgIcon: 'bg-amber-50 text-amber-700 border-amber-200/80',
      badge: 'bg-amber-50 text-amber-700',
    },
    rose: {
      bgIcon: 'bg-rose-50 text-rose-700 border-rose-200/80',
      badge: 'bg-rose-50 text-rose-700',
    },
  }[variant];

  return (
    <div className="bg-white dark:bg-[#0D1A33] rounded-xl border border-[#D5E4F5]/80 dark:border-[#17274B] p-5 shadow-card hover:shadow-card-hover transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
            {title}
          </p>
          <h3 className="text-2xl font-extrabold text-[#0D1A33] dark:text-white mt-1.5 tracking-tight truncate">
            {value}
          </h3>
        </div>
        <div className={`p-3 rounded-xl border ${variantStyles.bgIcon} flex-shrink-0 shadow-2xs`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-3.5 flex items-center justify-between text-xs pt-3 border-t border-[#F0F4FA] dark:border-navy-800">
          {subtext && <span className="text-slate-500 dark:text-slate-400 truncate">{subtext}</span>}
          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {trend.value}
            </span>
          )}
        </div>
      )}
    </div>
  );
});
