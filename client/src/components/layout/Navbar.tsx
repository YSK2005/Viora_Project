import React, { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  ChevronDown,
  User,
  Settings,
  LogOut,
  CheckCircle,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { NavigationKey, SystemHealth } from '../../types';

interface NavbarProps {
  currentNav: NavigationKey;
  onOpenMobile: () => void;
  systemHealth: SystemHealth;
}

const PAGE_TITLES: Record<NavigationKey, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard Overview',
    subtitle: 'Real-time billing analytics and operational metrics',
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
  systemHealth,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

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
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Phase 1
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block truncate">
            {currentPage.subtitle}
          </p>
        </div>
      </div>

      {/* Right side: Search + Health + Notifications + Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Search Input Placeholder */}
        <div className="relative hidden xl:block w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search records, invoices... (Ctrl + K)"
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>

        {/* Backend Server Status Indicator */}
        <div
          className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
            systemHealth.status === 'healthy'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
          title={`Backend Server Status: ${systemHealth.status}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              systemHealth.status === 'healthy'
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-amber-500'
            }`}
          />
          <span className="text-[11px]">
            {systemHealth.status === 'healthy' ? 'API Active' : 'API Standby'}
          </span>
        </div>

        {/* Notifications Area */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            className="p-2 text-slate-500 hover:text-navy-900 hover:bg-slate-100 rounded-lg relative transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-teal-600 rounded-full" />
          </button>

          {/* Notifications Dropdown Placeholder */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-popover border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Notifications</span>
                <span className="text-[11px] text-teal-700 font-medium">Mark all read</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                <div className="p-3 text-xs hover:bg-slate-50 flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800">API Health check active</p>
                    <p className="text-[11px] text-slate-500">GET /api/health responding with 200 OK</p>
                    <span className="text-[10px] text-slate-400">Just now</span>
                  </div>
                </div>
                <div className="p-3 text-xs hover:bg-slate-50 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-teal-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-slate-800">Phase 1 Foundation Ready</p>
                    <p className="text-[11px] text-slate-500">Prisma schema & Express architecture loaded</p>
                    <span className="text-[10px] text-slate-400">10m ago</span>
                  </div>
                </div>
              </div>
              <div className="p-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Menu Placeholder */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            aria-label="User profile menu"
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-lg bg-navy-900 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
              VA
            </div>

            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-navy-900 leading-tight">
                Viora Admin
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                Finance Manager
              </span>
            </div>

            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-popover border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-navy-900">Viora Admin User</p>
                <p className="text-[11px] text-slate-400">admin@vioratech.com</p>
                <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                  Role: Administrator
                </span>
              </div>

              <div className="py-1 text-xs">
                <button
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  Profile Details
                </button>
                <button
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  Preferences
                </button>
                <button
                  onClick={() => setShowProfileMenu(false)}
                  className="w-full px-4 py-2 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  Help & Documentation
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={() => {
                    alert('Phase 1 Foundation: Real authentication will be configured in subsequent phase.');
                    setShowProfileMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
