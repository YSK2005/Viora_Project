import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Search,
  Sun,
  Moon,
  Bell,
  CheckCircle2,
  ChevronDown,
  Building2,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { NavigationKey, SystemHealth, User, UserRole, BusinessProfile } from '../../types';

interface NavbarProps {
  currentNav: NavigationKey;
  onOpenMobile: () => void;
  systemHealth?: SystemHealth;
  user?: User | null;
  userRole?: UserRole | null;
  businessProfile?: BusinessProfile | null;
  onLogout?: () => void;
  onOpenGlobalSearch?: () => void;
}

const PAGE_TITLES: Record<NavigationKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: 'Real-time billing, revenue analytics, and GST summary',
  },
  invoices: {
    title: 'Invoices & Billing',
    subtitle: 'Manage, generate, and track GST-compliant tax invoices',
  },
  customers: {
    title: 'Customer Directory',
    subtitle: 'Client accounts, GSTIN profiles, and contact details',
  },
  products: {
    title: 'Products & Services',
    subtitle: 'Item catalog, unit pricing, HSN codes, and GST rates',
  },
  payments: {
    title: 'Payment Records',
    subtitle: 'Payment tracking, bank transfers, UPI receipts, and reversals',
  },
  reports: {
    title: 'Reports & Analytics',
    subtitle: 'Sales timelines, GST tax summaries, and revenue insights',
  },
  credits: {
    title: 'Credit Notes',
    subtitle: 'Full and partial credits against issued invoices',
  },
  statements: {
    title: 'Customer Statements',
    subtitle: 'Ledger statements, invoices, payments, and balances',
  },
  recurring: {
    title: 'Recurring Invoices',
    subtitle: 'Automated subscriptions, client retainers, and schedules',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Company profile, branding logo, GSTIN, and configuration',
  },
  superadmin: {
    title: 'Super Admin Control Center',
    subtitle: 'Global system settings, Razorpay gateway keys, multi-tenant businesses & subscription plans',
  },
  customer_portal: {
    title: 'Customer License & Subscription',
    subtitle: 'Active software subscription, billing cycles, and official tax payment receipts',
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
  systemHealth,
  user,
  userRole,
  businessProfile,
  onLogout,
  onOpenGlobalSearch,
}) => {
  const currentPage = PAGE_TITLES[currentNav] || { title: 'Viora Bills', subtitle: '' };

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viora_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('viora_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('viora_theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);

  const isDbHealthy = systemHealth?.database?.status === 'connected';

  return (
    <header className="h-18 bg-white border-b border-[#D5E4F5]/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-subtle dark:bg-[#0D1A33] dark:border-[#17274B]">
      {/* Left side: Hamburger + Page Title */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onOpenMobile}
          type="button"
          className="lg:hidden p-2 text-slate-500 hover:text-[#0D1A33] hover:bg-[#F0F5FB] rounded-xl transition-colors"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-[#0D1A33] dark:text-white truncate tracking-tight">
            {currentPage.title}
          </h1>
          {currentPage.subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate">
              {currentPage.subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right side: Global Search, Notifications, Theme & Profile Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Global Search Button */}
        <button
          onClick={onOpenGlobalSearch}
          type="button"
          aria-label="Search records and invoices (Ctrl + K)"
          className="hidden sm:flex items-center justify-between w-64 md:w-72 px-3 py-1.5 text-xs bg-[#F4F8FD] dark:bg-navy-950 border border-[#D5E4F5] dark:border-navy-800 rounded-xl text-slate-500 hover:border-[#8FB4E3] hover:bg-white dark:hover:bg-navy-900 transition-all text-left shadow-2xs group"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-[#FF6A2B] transition-colors flex-shrink-0" />
            <span className="text-slate-500 dark:text-slate-400 truncate">Search invoices, clients...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-md text-slate-500 dark:text-slate-400 shadow-2xs flex-shrink-0">
            Ctrl K
          </kbd>
        </button>

        {/* Mobile Search Icon */}
        <button
          onClick={onOpenGlobalSearch}
          type="button"
          className="sm:hidden p-2 text-slate-500 hover:text-[#0D1A33] hover:bg-[#F0F5FB] rounded-xl transition-colors"
          aria-label="Search records"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Notification Bell with indicator */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setIsNotificationsOpen((prev) => !prev)}
            type="button"
            className="p-2 text-slate-500 hover:text-[#0D1A33] hover:bg-[#F0F5FB] dark:hover:bg-navy-800 rounded-xl transition-colors relative"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF6A2B] ring-2 ring-white dark:ring-[#0D1A33]" />
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#0D1A33] border border-[#D5E4F5] dark:border-[#17274B] rounded-2xl shadow-popover p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-navy-800">
                <h3 className="text-xs font-bold text-[#0D1A33] dark:text-white uppercase tracking-wider">
                  Notifications
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live
                </span>
              </div>
              <div className="py-3 space-y-2.5 text-xs">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-[#F4F8FD] dark:bg-navy-900 border border-[#D5E4F5]/60 dark:border-navy-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-[#0D1A33] dark:text-white">
                      {isDbHealthy ? 'System Operating Normally' : 'Database Connection Checking'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      GST tax calculations and invoice number sequencing are active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          type="button"
          className="p-2 text-slate-500 hover:text-[#0D1A33] dark:text-slate-400 dark:hover:text-slate-200 hover:bg-[#F0F5FB] dark:hover:bg-navy-800 rounded-xl transition-colors"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative pl-1 sm:pl-2" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileOpen((prev) => !prev)}
            type="button"
            className="flex items-center gap-2.5 p-1 sm:p-1.5 rounded-xl hover:bg-[#F0F5FB] dark:hover:bg-navy-800 transition-colors border border-transparent hover:border-[#D5E4F5] dark:hover:border-navy-700"
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0D1A33] to-[#1F345F] text-white flex items-center justify-center text-xs font-bold shadow-xs border border-white/20">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'V'}
            </div>
            <div className="hidden lg:flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-[#0D1A33] dark:text-white truncate max-w-[130px]">
                {user?.name || 'Administrator'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                {businessProfile?.name || 'Viora Bills'}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden lg:block" />
          </button>

          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#0D1A33] border border-[#D5E4F5] dark:border-[#17274B] rounded-2xl shadow-popover p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2 border-b border-slate-100 dark:border-navy-800">
                <p className="text-xs font-bold text-[#0D1A33] dark:text-white truncate">
                  {user?.name || 'User'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {user?.email || 'user@viora.test'}
                </p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 text-[9.5px] font-bold rounded-md bg-[#FF6A2B]/10 text-[#FF6A2B] border border-[#FF6A2B]/20 uppercase tracking-wider">
                    {userRole || 'OWNER'}
                  </span>
                  {businessProfile?.gstin && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      GST: {businessProfile.gstin.slice(0, 8)}...
                    </span>
                  )}
                </div>
              </div>

              {businessProfile && (
                <div className="p-2 border-b border-slate-100 dark:border-navy-800 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Building2 className="w-3.5 h-3.5 text-[#8FB4E3]" />
                    <span className="truncate">{businessProfile.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Indian GST Active ({businessProfile.state || 'Karnataka'})</span>
                  </div>
                </div>
              )}

              {onLogout && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
