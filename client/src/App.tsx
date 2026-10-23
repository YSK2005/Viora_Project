import React, { useState, useEffect } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardView } from './components/pages/DashboardView';
import { InvoicesView } from './components/pages/InvoicesView';
import { PlaceholderView } from './components/pages/PlaceholderView';
import { NewInvoiceModal } from './components/modals/NewInvoiceModal';
import { NavigationKey, Invoice, SystemHealth } from './types';
import { fetchHealth, fetchInvoices, FALLBACK_MOCK_INVOICES } from './services/api';

export const App: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavigationKey>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>(FALLBACK_MOCK_INVOICES);
  const [isSimulatedEmpty, setIsSimulatedEmpty] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({ status: 'checking' });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Poll system health and load invoices on mount
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      const [health, invoiceData] = await Promise.all([
        fetchHealth(),
        fetchInvoices(),
      ]);

      if (isMounted) {
        setSystemHealth(health);
        if (invoiceData.invoices && invoiceData.invoices.length > 0) {
          setInvoices(invoiceData.invoices);
        }
      }
    };

    loadInitialData();

    // Periodic check every 15 seconds
    const interval = setInterval(async () => {
      const health = await fetchHealth();
      if (isMounted) setSystemHealth(health);
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Handle adding new preview invoice
  const handleCreateInvoice = (newInvData: Omit<Invoice, 'id' | 'isMock'>) => {
    const created: Invoice = {
      ...newInvData,
      id: `mock-inv-${Date.now()}`,
      isMock: true,
    };
    setInvoices((prev) => [created, ...prev]);
    setIsSimulatedEmpty(false);
  };

  return (
    <>
      <AppLayout
        currentNav={currentNav}
        onNavigate={setCurrentNav}
        systemHealth={systemHealth}
      >
        {currentNav === 'dashboard' && (
          <DashboardView
            invoices={invoices}
            onSelectInvoice={setSelectedInvoice}
            onNewInvoice={() => setIsModalOpen(true)}
            isSimulatedEmpty={isSimulatedEmpty}
            onSimulateEmptyToggle={setIsSimulatedEmpty}
          />
        )}

        {currentNav === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            onSelectInvoice={setSelectedInvoice}
            onNewInvoice={() => setIsModalOpen(true)}
            isSimulatedEmpty={isSimulatedEmpty}
            onSimulateEmptyToggle={setIsSimulatedEmpty}
          />
        )}

        {currentNav !== 'dashboard' && currentNav !== 'invoices' && (
          <PlaceholderView
            navKey={currentNav}
            onNavigateToDashboard={() => setCurrentNav('dashboard')}
          />
        )}
      </AppLayout>

      {/* New Invoice Modal */}
      <NewInvoiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateInvoice}
      />

      {/* Selected Invoice Details Quick View Modal / Drawer */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-md p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-xs text-teal-700 font-semibold uppercase tracking-wider">
                  Invoice Details Preview
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  {selectedInvoice.invoiceNumber}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-900 text-right">
                  {selectedInvoice.customerName}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Contact:</span>
                <span className="text-slate-700 font-mono text-[11px]">
                  {selectedInvoice.customerEmail}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Billing Date:</span>
                <span className="text-slate-700">{selectedInvoice.issueDate}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Payment Due:</span>
                <span className="text-slate-700">{selectedInvoice.dueDate}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Status:</span>
                <span className="font-semibold text-teal-700">{selectedInvoice.status}</span>
              </div>
              <div className="flex justify-between py-2 border-t border-slate-200 text-sm font-bold">
                <span className="text-slate-800">Total Billed:</span>
                <span className="text-teal-800">
                  {new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    maximumFractionDigits: 0,
                  }).format(selectedInvoice.amount)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-navy-900 hover:bg-navy-800 rounded-lg transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
