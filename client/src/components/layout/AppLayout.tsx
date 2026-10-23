import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { MockDataBanner } from '../common/MockDataBanner';
import { NavigationKey, SystemHealth } from '../../types';

interface AppLayoutProps {
  children: React.ReactNode;
  currentNav: NavigationKey;
  onNavigate: (key: NavigationKey) => void;
  systemHealth: SystemHealth;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  currentNav,
  onNavigate,
  systemHealth,
}) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const isDbConnected = systemHealth.database?.status === 'connected';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Banner indicating PostgreSQL live mode */}
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
          />

          {/* Main View Container */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>

          {/* Minimal Enterprise Footer */}
          <footer className="py-4 px-6 border-t border-slate-200/80 bg-white text-center text-xs text-slate-400">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
              <div>
                © {new Date().getFullYear()} Viora Bills. Built for Viora Tech Internship.
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="text-teal-700 font-semibold">
                  Phase 2: Database and Backend Active
                </span>
                <span>•</span>
                <span>PostgreSQL 18 · Prisma ORM · Node.js · Express · React · TypeScript</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
