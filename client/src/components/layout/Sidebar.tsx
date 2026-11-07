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
} from 'lucide-react';
import { NavigationKey } from '../../types';
import { BillyWordmark } from '../common/BillyWordmark';

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
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-navy-950 border-r border-navy-800 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-navy-800">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo Icon */}
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-white flex items-center justify-center p-0.5">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>

            {/* Brand Title */}
            {!isCollapsed && (
              <div className="flex items-center min-w-0 pl-1">
                <BillyWordmark className="h-9 w-auto select-none" />
              </div>
            )}
          </div>

          {/* Collapse toggle (desktop only) */}
          <button
            onClick={onToggleCollapse}
            type="button"
            className="hidden lg:flex p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-navy-800 transition-colors"
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
            <div className="px-3 pb-2 text-[11px] font-semibold text-navy-500 uppercase tracking-wider">
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
                    ? 'bg-brand-400/10 text-brand-400 font-semibold'
                    : 'text-navy-400 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive
                        ? 'text-brand-400'
                        : 'text-navy-500 group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                      isActive
                        ? 'bg-brand-400/20 text-brand-300'
                        : 'bg-navy-800 text-navy-400 group-hover:bg-navy-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Left active accent bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-brand-400 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};
