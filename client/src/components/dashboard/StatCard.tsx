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
  accent: 'teal' | 'navy' | 'emerald' | 'amber' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  trend,
  icon: Icon,
  accent,
}) => {
  const accentStyles = {
    teal: {
      bgIcon: 'bg-teal-50 text-teal-700 border-teal-200/60',
      badge: 'bg-teal-50 text-teal-700',
    },
    purple: {
      bgIcon: 'bg-purple-50 text-purple-700 border-purple-200/60',
      badge: 'bg-purple-50 text-purple-700',
    },
    navy: {
      bgIcon: 'bg-navy-100 text-navy-800 border-navy-200/60',
      badge: 'bg-slate-100 text-slate-700',
    },
    emerald: {
      bgIcon: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      badge: 'bg-emerald-50 text-emerald-700',
    },
    amber: {
      bgIcon: 'bg-amber-50 text-amber-700 border-amber-200/60',
      badge: 'bg-amber-50 text-amber-700',
    },
  }[accent];

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1 tracking-tight">{value}</h3>
        </div>
        <div className={`p-2.5 rounded-xl border ${accentStyles.bgIcon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtext || trend) && (
        <div className="mt-4 flex items-center justify-between text-xs pt-3 border-t border-slate-100">
          {subtext && <span className="text-slate-500">{subtext}</span>}
          {trend && (
            <span
              className={`inline-flex items-center gap-1 font-semibold ${
                trend.isPositive ? 'text-emerald-600' : 'text-amber-600'
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
};
