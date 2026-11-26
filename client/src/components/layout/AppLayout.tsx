import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MockDataBanner } from '../common/MockDataBanner';
import { NavigationKey, SystemHealth, User, UserRole, BusinessProfile } from '../../types';

interface AppLayoutProps {
  children: React.ReactNode;
  currentNav: NavigationKey;
  onNavigate: (key: NavigationKey) => void;
  systemHealth: SystemHealth;
  user?: User | null;
  userRole?: UserRole | null;
  businessProfile?: BusinessProfile | null;
  onLogout?: () => void;
  onOpenGlobalSearch?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentNav,
  onNavigate,
  systemHealth,
  user,
  userRole,
  businessProfile,
  onLogout,
  onOpenGlobalSearch,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isDbConnected = systemHealth.database?.status === 'connected';

  return (
    <div className="min-h-screen bg-[#F0F5FB] dark:bg-navy-950 flex flex-col font-sans">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* MockDataBanner returns null — kept for code compatibility */}
      <MockDataBanner isDbConnected={isDbConnected} />

      <div className="flex-1 flex relative">
        {/* Collapsible Sidebar */}
        <Sidebar
          currentNav={currentNav}
          onNavigate={onNavigate}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
          user={user}
          userRole={userRole}
          onLogout={onLogout}
        />

        {/* Main Content Area */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
            isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'
          }`}
        >
          {/* Top Navbar */}
          <Navbar
            currentNav={currentNav}
            onOpenMobile={() => setIsMobileOpen(true)}
            systemHealth={systemHealth}
            user={user}
            userRole={userRole}
            businessProfile={businessProfile}
            onLogout={onLogout}
            onOpenGlobalSearch={onOpenGlobalSearch}
          />

          {/* Main View Container */}
          <main id="main-content" tabIndex={-1} className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>

          {/* Footer */}
          <footer className="py-4 px-6 border-t border-slate-200/80 bg-white text-center text-xs text-slate-400">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
              <div>
                © {new Date().getFullYear()} Viora Bills. Smart Business Invoicing.
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
