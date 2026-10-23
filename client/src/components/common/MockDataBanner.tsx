import React from 'react';
import { Info, Sparkles } from 'lucide-react';

interface MockDataBannerProps {
  onDismiss?: () => void;
}

export const MockDataBanner: React.FC<MockDataBannerProps> = () => {
  return (
    <div className="bg-gradient-to-r from-teal-50 via-teal-50/70 to-slate-50 border-b border-teal-200/80 px-4 py-2.5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-teal-900">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100/90 px-2 py-0.5 font-semibold text-teal-800 border border-teal-300/60 uppercase tracking-wider text-[10px]">
            <Sparkles className="w-3 h-3 text-teal-600" />
            Phase 1 Preview
          </span>
          <span className="flex items-center gap-1 text-slate-600">
            <Info className="w-3.5 h-3.5 text-teal-700 flex-shrink-0" />
            Displaying verified mock data for UI and architectural evaluation. Real records activate in Phase 2 via PostgreSQL & Prisma.
          </span>
        </div>
        <div className="text-[11px] font-medium text-teal-800 hidden md:block">
          Viora Tech Internship Project • Foundation Milestone
        </div>
      </div>
    </div>
  );
};
