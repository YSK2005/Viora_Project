import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Users,
  Package,
  CreditCard,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { NavigationKey } from '../../types';

interface SidebarProps {
  currentNav: NavigationKey;
  onNavigate: (key: NavigationKey) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  key: NavigationKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'products', label: 'Products & Services', icon: Package },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'reports', label: 'Sales Reports', icon: BarChart3 },
  { key: 'settings', label: 'Business Settings', icon: Settings },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/90 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200/80">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Receipt className="w-5 h-5" />
            </div>

            {/* Brand Title */}
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-base text-navy-900 tracking-tight whitespace-nowrap">
                    Viora Bills
                  </span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-teal-100 text-teal-800 uppercase tracking-wider">
                    PRO
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 truncate">
                  Smart Business Invoicing
                </span>
              </div>
            )}
          </div>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={onToggleCollapse}
            type="button"
            className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Main Menu
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentNav === item.key;

            return (
              <button
                key={item.key}
                onClick={() => {
                  onNavigate(item.key);
                  onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg text-sm font-medium transition-all group relative ${
                  isCollapsed
                    ? 'justify-center px-2 py-3'
                    : 'justify-between px-3.5 py-2.5'
                } ${
                  isActive
                    ? 'bg-teal-50/90 text-teal-800 font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive
                        ? 'text-teal-700'
                        : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                      isActive
                        ? 'bg-teal-200/80 text-teal-900'
                        : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Left active accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-teal-600 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Info & Architecture badge */}
        <div className="p-3 border-t border-slate-200/80 bg-slate-50/60">
          {!isCollapsed ? (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <ShieldCheck className="w-4 h-4 text-teal-600 flex-shrink-0" />
                <span className="truncate">Viora Tech Intern</span>
              </div>
              <div className="mt-1 text-[11px] text-teal-700 font-medium">
                Phase 5: Production Verified
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                <span>Stack: React + PostgreSQL</span>
                <span className="font-mono text-teal-700">v1.0.0</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title="Viora Tech Internship Project">
              <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
