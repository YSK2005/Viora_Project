import React, { useState, useEffect } from 'react';
import {
  Menu,
  Search,
  Sun,
  Moon,
} from 'lucide-react';
import { NavigationKey, SystemHealth } from '../../types';
import { getActivePortal } from '../../utils/portal';

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
  credits: {title:'Credit Notes',subtitle:'Full and partial credits against original invoice lines'},
  statements: {title:'Customer Statements',subtitle:'Current invoices, payments, credits and balances'},
  recurring: {title:'Recurring Invoices',subtitle:'Automated subscriptions, client retainers and periodic schedules'},
  settings: {
    title: 'Business Settings',
    subtitle: 'Company profile, branding logo, GSTIN, and sequential numbering',
  },
  superadmin: {
    title: 'Super Admin Control Desk',
    subtitle: 'Manage product catalog, generate Admin Access Codes, and authorize billing terminals',
  },
  customer_portal: {
    title: 'Customer License & 12-Digit Key',
    subtitle: 'Active software subscription, INR receipts, and your 12-digit Super Admin Access Code',
  },
  pricing: {
    title: 'Software Subscription Plans',
    subtitle: 'Choose a plan in INR (₹) to activate or upgrade your Viora Bills software license',
  },
  payment_success: {
    title: 'Subscription Payment Confirmed',
    subtitle: 'Razorpay transaction verified and subscription activated successfully',
  },
  payment_failed: {
    title: 'Payment Transaction Incomplete',
    subtitle: 'We could not complete your payment transaction',
  },
};

export const Navbar: React.FC<NavbarProps> = ({
  currentNav,
  onOpenMobile,
  onOpenGlobalSearch,
}) => {
  const currentPage = PAGE_TITLES[currentNav];
  const activePortal = getActivePortal();

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viora_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (activePortal === 'CUSTOMER') {
      document.title = 'Viora Bills — Customer License Portal (5174)';
    } else if (activePortal === 'SUPER_ADMIN') {
      document.title = 'Viora Bills — Super Admin Control (5175)';
    } else {
      document.title = 'Viora Bills — Billing Admin Desk (5173)';
    }
  }, [activePortal]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('viora_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('viora_theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

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
          <div className="flex items-center gap-2.5">
            <h1 className="text-base sm:text-lg font-bold text-navy-900 truncate tracking-tight">
              {currentPage.title}
            </h1>
            <span
              className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border whitespace-nowrap ${
                activePortal === 'CUSTOMER'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : activePortal === 'SUPER_ADMIN'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-teal-50 text-teal-700 border-teal-200'
              }`}
            >
              {activePortal === 'CUSTOMER'
                ? 'Port 5174 • Customer'
                : activePortal === 'SUPER_ADMIN'
                ? 'Port 5175 • Super Admin'
                : 'Port 5173 • Billing Desk'}
            </span>
          </div>
          {currentPage.subtitle ? (
            <p className="text-xs text-slate-400 hidden sm:block truncate">
              {currentPage.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right side: Dark Mode Toggle & Search */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* Mobile Search Button (Billing & Super Admin portals only) */}
        {getActivePortal() !== 'CUSTOMER' && (
          <button
            onClick={onOpenGlobalSearch}
            type="button"
            className="xl:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Open search dialog"
            title="Search (Ctrl + K)"
          >
            <Search className="w-5 h-5" />
          </button>
        )}

        {/* Desktop Search Button (Billing & Super Admin portals only) */}
        {getActivePortal() !== 'CUSTOMER' && (
          <button
            onClick={onOpenGlobalSearch}
            type="button"
            aria-label="Search records and invoices (Ctrl + K)"
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
        )}
      </div>
    </header>
  );
};
