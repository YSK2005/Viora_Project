import React from 'react';
import { Database, Sparkles } from 'lucide-react';

interface MockDataBannerProps {
  isDbConnected?: boolean;
}

export const MockDataBanner: React.FC<MockDataBannerProps> = ({ isDbConnected = true }) => {
  return (
    <div className="bg-gradient-to-r from-teal-50 via-teal-50/70 to-slate-50 border-b border-teal-200/80 px-4 py-2 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-teal-900">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100/90 px-2 py-0.5 font-semibold text-teal-800 border border-teal-300/60 uppercase tracking-wider text-[10px]">
            {isDbConnected ? (
              <>
                <Database className="w-3 h-3 text-teal-700" />
                Phase 2 Live
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 text-teal-600" />
                Phase 1 Preview
              </>
            )}
          </span>
          <span className="flex items-center gap-1 text-slate-700 font-medium">
            {isDbConnected ? (
              <span>
                PostgreSQL Database Connected · Real financial records, Decimal arithmetic, and ACID transactions active.
              </span>
            ) : (
              <span>
                Displaying fallback preview records. Start backend with PostgreSQL to connect live data.
              </span>
            )}
          </span>
        </div>
        <div className="text-[11px] font-medium text-teal-800 hidden md:block">
          Viora Tech Internship Project • Phase 2 Milestone
        </div>
      </div>
    </div>
  );
};
