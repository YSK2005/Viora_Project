import { useDialog } from '../../hooks/useDialog';
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
  Repeat,
  Sliders,
  Sparkles,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { NavigationKey, User, UserRole } from '../../types';
import { BillyWordmark } from '../common/BillyWordmark';
import { getActivePortal } from '../../utils/portal';

interface SidebarProps {
  currentNav: NavigationKey;
  onNavigate: (key: NavigationKey) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  user?: User | null;
  userRole?: UserRole | null;
  onLogout?: () => void;
}

interface NavItem {
  key: NavigationKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentNav,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  user,
  userRole,
  onLogout,
}) => {
  const dialogProps = useDialog(isMobileOpen, onCloseMobile, 'Main navigation');
  const activePortal = getActivePortal();

  const navItems: NavItem[] = React.useMemo(() => {
    // 1. CUSTOMER PORTAL (Port 5174): Strictly Software Purchase, License & 12-Digit Super Admin Key
    if (activePortal === 'CUSTOMER' || userRole === 'CUSTOMER') {
      return [
        { key: 'customer_portal', label: 'My License & Key', icon: ShieldCheck, badge: 'PORTAL' },
        { key: 'pricing', label: 'Buy / Upgrade Plan', icon: Sparkles, badge: 'INR ₹' },
      ];
    }

    // 2. SUPER ADMIN PORTAL (Port 5175): Strictly Product Catalog, Admin Code Generation & Billing Authorization
    if (activePortal === 'SUPER_ADMIN' || userRole === 'SUPER_ADMIN') {
      return [
        { key: 'superadmin', label: 'Control Center', icon: Sliders, badge: 'CONTROL' },
        { key: 'products', label: 'Product Catalog', icon: Package, badge: 'MANAGE' },
        { key: 'invoices', label: 'Bills Oversight', icon: Receipt },
        { key: 'customers', label: 'Client Directory', icon: Users },
        { key: 'reports', label: 'Sales & GST Analytics', icon: BarChart3 },
        { key: 'settings', label: 'Company & Tax Setup', icon: Settings },
      ];
    }

    // 3. ADMIN DESK PORTAL (Port 5173): Strictly Bill Generation, Clients, Read-Only Catalog & Collections
    return [
      { key: 'dashboard', label: 'Billing Dashboard', icon: LayoutDashboard },
      { key: 'invoices', label: 'Generate & Issue Bills', icon: Receipt },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'products', label: 'Product Catalog', icon: Package, badge: 'CATALOG' },
      { key: 'payments', label: 'Bill Collections', icon: CreditCard },
      { key: 'credits', label: 'Credit Notes', icon: Receipt },
      { key: 'statements', label: 'Customer Statements', icon: Users },
      { key: 'recurring', label: 'Recurring Bills', icon: Repeat },
      { key: 'reports', label: 'Sales Reports', icon: BarChart3 },
    ];
  }, [activePortal, userRole]);

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-navy-950/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      <div
        {...(isMobileOpen ? dialogProps : {})}
        ref={dialogProps.ref}
        data-sidebar
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-navy-950 border-r border-navy-800 transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen
            ? 'translate-x-0 visible'
            : '-translate-x-full invisible lg:visible lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-navy-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-white flex items-center justify-center p-0.5">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain rounded-lg" />
            </div>

            {!isCollapsed && (
              <div className="flex items-center min-w-0 pl-1">
                <BillyWordmark className="h-9 w-auto select-none" />
              </div>
            )}
          </div>

          <button
            onClick={onToggleCollapse}
            type="button"
            className="hidden lg:flex p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-navy-800 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        <button className="lg:hidden p-3 text-white" onClick={onCloseMobile} aria-label="Close navigation">
          Close menu
        </button>

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[11px] font-semibold text-navy-500 uppercase tracking-wider">
              {activePortal === 'CUSTOMER'
                ? 'Customer Purchase Portal'
                : activePortal === 'SUPER_ADMIN'
                ? 'Super Admin Panel'
                : 'Billing Admin Desk'}
            </div>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentNav === item.key;

            return (
              <button
                key={item.key}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  onNavigate(item.key);
                  onCloseMobile();
                }}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg text-sm font-medium transition-all group relative ${
                  isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'
                } ${
                  isActive
                    ? 'bg-brand-400/10 text-brand-400 font-semibold'
                    : 'text-navy-400 hover:bg-navy-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive ? 'text-brand-400' : 'text-navy-500 group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      isActive
                        ? 'bg-brand-400/20 text-brand-300'
                        : 'bg-navy-800 text-navy-400 group-hover:bg-navy-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-brand-400 rounded-r-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout at Bottom */}
        {user && (
          <div className="p-3 border-t border-navy-800 bg-navy-900/60">
            {!isCollapsed ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                    <p className="text-[11px] text-navy-400 truncate">{user.email}</p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider whitespace-nowrap flex-shrink-0 ${
                      activePortal === 'SUPER_ADMIN'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : activePortal === 'CUSTOMER'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                    }`}
                  >
                    {activePortal === 'SUPER_ADMIN'
                      ? 'SUPER ADMIN'
                      : activePortal === 'CUSTOMER'
                      ? 'BUYER'
                      : userRole || 'ADMIN'}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-rose-300 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-500/20"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  title={`${user.name} (${activePortal})`}
                  className="w-8 h-8 rounded-full bg-teal-600/30 text-teal-300 flex items-center justify-center text-xs font-bold border border-teal-500/30"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sign Out"
                    aria-label="Sign Out"
                    className="p-1.5 text-rose-400 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};
