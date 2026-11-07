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
    subtitle: 'Item catalog, SAC/HSN codes, and pricing rules',
  },
  payments: {
    title: 'Payment Records',
    subtitle: 'Payment tracking, bank transfers, UPI and settlements',
  },
  reports: {
    title: 'Sales & Tax Reports',
    subtitle: 'GSTR-1 summaries, monthly sales, and revenue insights',
  },
  settings: {
    title: 'Business Settings',
    subtitle: 'Company profile, GSTIN, banking, and invoice templates',
  },
};

export const Navbar: React.FC<NavbarProps> = ({
  currentNav,
  onOpenMobile,
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
        {/* Search Input Placeholder */}
        <div className="relative hidden xl:block w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records, invoices... (Ctrl + K)"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400 transition-all"
          />
        </div>
      </div>
    </header>
  );
};
