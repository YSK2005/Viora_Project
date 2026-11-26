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
  FileMinus,
  FileSpreadsheet,
  Sliders,
  Sparkles,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { NavigationKey, User, UserRole } from '../../types';
import { BillyWordmark } from '../common/BillyWordmark';

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

  const navItems: NavItem[] = React.useMemo(() => {
    if (userRole === 'SUPER_ADMIN') {
      return [
        { key: 'superadmin', label: 'Super Admin Control', icon: Sliders, badge: 'MASTER' },
        { key: 'pricing', label: 'Subscription Plans', icon: Sparkles, badge: 'INR ₹' },
        { key: 'dashboard', label: 'Billing Dashboard', icon: LayoutDashboard },
        { key: 'invoices', label: 'All Invoices', icon: Receipt },
        { key: 'customers', label: 'Customers', icon: Users },
        { key: 'products', label: 'Master Products', icon: Package },
        { key: 'settings', label: 'System Settings', icon: Settings },
      ];
    }
    if (userRole === 'CUSTOMER') {
      return [
        { key: 'customer_portal', label: 'My Subscription', icon: ShieldCheck, badge: 'PORTAL' },
        { key: 'pricing', label: 'Upgrade / Plans', icon: Sparkles, badge: 'INR ₹' },
        { key: 'dashboard', label: 'Billing Software', icon: LayoutDashboard },
        { key: 'invoices', label: 'Invoices & Bills', icon: Receipt },
        { key: 'payments', label: 'Receipts & Payments', icon: CreditCard },
      ];
    }
    // OWNER, ACCOUNTANT, VIEWER (Billing Suite Admin)
    return [
      { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { key: 'invoices', label: 'Invoices', icon: Receipt },
      { key: 'customers', label: 'Customers', icon: Users },
      { key: 'products', label: 'Products & Services', icon: Package },
      { key: 'payments', label: 'Payments', icon: CreditCard },
      { key: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      { key: 'credits', label: 'Credit Notes', icon: FileMinus },
      { key: 'statements', label: 'Customer Statements', icon: FileSpreadsheet },
      { key: 'recurring', label: 'Recurring Invoices', icon: Repeat },
      { key: 'pricing', label: 'Software License', icon: Sparkles, badge: 'INR ₹' },
      { key: 'settings', label: 'Business Settings', icon: Settings },
    ];
  }, [userRole]);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0D1A33]/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container - Midnight Navy */}
      <aside
        {...(isMobileOpen ? dialogProps : {})}
        ref={dialogProps.ref}
        data-sidebar
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#0D1A33] border-r border-[#17274B] text-white transition-all duration-300 ease-in-out shadow-xl ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${
          isMobileOpen ? 'translate-x-0 visible' : '-translate-x-full invisible lg:visible lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-[#17274B]/80 bg-[#0D1A33]">
          <div className="flex items-center gap-3 overflow-hidden">
            {/* Logo Icon */}
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex-shrink-0 bg-white flex items-center justify-center p-1 border border-white/20">
              <img src="/logo.png" alt="Viora Bills" className="w-full h-full object-contain rounded-lg" />
            </div>

            {/* Brand Title & Tagline */}
            {!isCollapsed && (
              <div className="flex items-center min-w-0 pl-1">
                <BillyWordmark className="h-10 w-auto select-none" />
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={onCloseMobile}
            type="button"
            className="lg:hidden p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            type="button"
            className="hidden lg:flex p-1.5 rounded-lg text-[#8FB4E3] hover:text-white hover:bg-white/10 transition-colors"
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

        {/* Navigation list */}
        <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 pb-2 text-[10.5px] font-bold text-[#8FB4E3]/70 uppercase tracking-widest">
              Navigation
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
                className={`w-full flex items-center rounded-xl text-sm font-medium transition-all group relative ${
                  isCollapsed
                    ? 'justify-center px-2 py-3'
                    : 'justify-between px-3.5 py-2.5'
                } ${
                  isActive
                    ? 'bg-[#FF6A2B] text-white font-semibold shadow-md'
                    : 'text-slate-200 hover:bg-white/10 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-colors ${
                      isActive
                        ? 'text-white'
                        : 'text-[#8FB4E3] group-hover:text-white'
                    }`}
                  />
                  {!isCollapsed && (
                    <span className="truncate tracking-tight">{item.label}</span>
                  )}
                </div>

                {!isCollapsed && item.badge && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-[#17274B] text-[#8FB4E3] group-hover:bg-[#233B69]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout at Bottom */}
        {user && (
          <div className="p-3 border-t border-[#17274B] bg-[#070E1E]/80">
            {!isCollapsed ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#FF6A2B] text-white flex items-center justify-center text-xs font-bold shadow-xs flex-shrink-0">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 pr-1">
                      <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                      <p className="text-[10px] text-[#8FB4E3] truncate">{user.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 text-[9.5px] font-bold rounded-md uppercase tracking-wider flex-shrink-0 ${
                      userRole === 'SUPER_ADMIN'
                        ? 'bg-[#FF6A2B]/20 text-[#FF8A58] border border-[#FF6A2B]/40'
                        : userRole === 'CUSTOMER'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : userRole === 'OWNER'
                        ? 'bg-[#FF6A2B]/20 text-[#FF8A58] border border-[#FF6A2B]/40'
                        : userRole === 'ACCOUNTANT'
                        ? 'bg-[#8FB4E3]/20 text-[#8FB4E3] border border-[#8FB4E3]/40'
                        : 'bg-white/10 text-slate-300 border border-white/20'
                    }`}
                  >
                    {userRole || 'USER'}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-rose-300 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors border border-rose-500/20"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2.5">
                <div
                  title={`${user.name} (${userRole || 'USER'})`}
                  className="w-9 h-9 rounded-full bg-[#FF6A2B] text-white flex items-center justify-center text-xs font-bold border border-white/20 shadow-xs"
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title="Sign Out"
                    aria-label="Sign Out"
                    className="p-2 text-rose-300 hover:text-white hover:bg-rose-500/20 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
};
