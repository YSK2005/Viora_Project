import React from 'react';
import {
  Menu,
  Search,
} from 'lucide-react';
import { NavigationKey, SystemHealth } from '../../types';

interface NavbarProps {
  currentNav: NavigationKey;
  onOpenMobile: () => void;
  systemHealth?: SystemHealth;
  onOpenGlobalSearch?: () => void;
}

const PAGE_TITLES: Record<NavigationKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: '',
  },
  invoices: {
    title: 'Invoices & Billing',
    subtitle: 'Manage, generate, and track GST tax invoices',
  },
  customers: {
    title: 'Customer Directory',
    subtitle: 'Client accounts, GSTIN profiles, and contact details',
  },
  products: {
    title: 'Products & Services',
    subtitle: 'Item catalog, unit pricing, and GST tax rates',
  },
  payments: {
    title: 'Payment Records',
    subtitle: 'Payment tracking, bank transfers, UPI receipts, and reversals',
  },
  reports: {
    title: 'Sales & Tax Reports',
    subtitle: 'Sales timelines, GST tax summaries, and revenue insights',
  },
  settings: {
    title: 'Business Settings',
    subtitle: 'Company profile, branding logo, GSTIN, and sequential numbering',
  },
};

export const Navbar: React.FC<NavbarProps> = ({
  currentNav,
  onOpenMobile,
  onOpenGlobalSearch,
}) => {
  const currentPage = PAGE_TITLES[currentNav];

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-subtle">
      {/* Left side: Hamburger + Page Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onOpenMobile}
          type="button"
          className="lg:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-bold text-navy-900 truncate tracking-tight">
              {currentPage.title}
            </h1>
          </div>
          {currentPage.subtitle ? (
            <p className="text-xs text-slate-400 hidden sm:block truncate">
              {currentPage.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right side: Search */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Search Button */}
        <button
          onClick={onOpenGlobalSearch}
          type="button"
          className="xl:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open search"
          title="Search (Ctrl + K)"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Desktop Search Button */}
        <button
          onClick={onOpenGlobalSearch}
          type="button"
          className="hidden xl:flex items-center justify-between w-72 pl-3 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:border-slate-300 hover:bg-slate-100/80 transition-all text-left shadow-sm group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
            <span className="text-slate-500 font-medium">Search records, invoices...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white border border-slate-200 rounded text-slate-500 shadow-2xs">
            Ctrl K
          </kbd>
        </button>
      </div>
    </header>
  );
};
