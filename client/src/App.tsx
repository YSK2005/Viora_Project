import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardView } from './components/pages/DashboardView';
import { InvoicesView } from './components/pages/InvoicesView';
import { CustomersView } from './components/pages/CustomersView';
import { ProductsView } from './components/pages/ProductsView';
import { PaymentsView } from './components/pages/PaymentsView';
import { ReportsView } from './components/pages/ReportsView';
import { SettingsView } from './components/pages/SettingsView';
import { NewInvoiceModal } from './components/modals/NewInvoiceModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import {
  NavigationKey,
  Invoice,
  DashboardSummary,
  SystemHealth,
} from './types';
import {
  fetchHealth,
  fetchInvoices,
  fetchDashboardSummary,
  issueInvoice,
} from './services/api';
import {
  SendHorizontal,
  CreditCard,
  Receipt,
  FileCheck2,
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavigationKey>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [isSimulatedEmpty, setIsSimulatedEmpty] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({ status: 'checking' });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [health, invData, summary] = await Promise.all([
      fetchHealth(),
      fetchInvoices(),
      fetchDashboardSummary(),
    ]);

    setSystemHealth(health);
    setInvoices(invData.invoices);
    setDashboardSummary(summary);
  }, []);

  useEffect(() => {
    loadData();

    // Health poll every 20s
    const timer = setInterval(async () => {
      const health = await fetchHealth();
      setSystemHealth(health);
    }, 20000);

    return () => clearInterval(timer);
  }, [loadData]);

  const handleIssueInvoice = async (inv: Invoice) => {
    if (!window.confirm(`Issue invoice for ${inv.customerName}? An official sequential invoice number will be assigned.`)) return;

    try {
      const issued = await issueInvoice(inv.id);
      setActionNotice(`Invoice ${issued.invoiceNumber} has been officially issued!`);
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
      if (selectedInvoice && selectedInvoice.id === inv.id) {
        setSelectedInvoice(issued);
      }
    } catch (err: any) {
      alert(`Error issuing invoice: ${err.message}`);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <>
      {/* Toast Alert */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-teal-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <FileCheck2 className="w-4 h-4 text-teal-400" />
          <span>{actionNotice}</span>
        </div>
      )}

      <AppLayout
        currentNav={currentNav}
        onNavigate={setCurrentNav}
        systemHealth={systemHealth}
      >
        {currentNav === 'dashboard' && (
          <DashboardView
            summary={dashboardSummary}
            invoices={invoices}
            onSelectInvoice={setSelectedInvoice}
            onNewInvoice={() => setIsNewInvoiceOpen(true)}
            isSimulatedEmpty={isSimulatedEmpty}
            onSimulateEmptyToggle={setIsSimulatedEmpty}
            onNavigateToCustomers={() => setCurrentNav('customers')}
            onNavigateToProducts={() => setCurrentNav('products')}
          />
        )}

        {currentNav === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            onSelectInvoice={setSelectedInvoice}
            onNewInvoice={() => setIsNewInvoiceOpen(true)}
            onIssueInvoice={handleIssueInvoice}
            onRecordPayment={(inv) => setPaymentInvoice(inv)}
            isSimulatedEmpty={isSimulatedEmpty}
            onSimulateEmptyToggle={setIsSimulatedEmpty}
          />
        )}

        {currentNav === 'customers' && <CustomersView />}

        {currentNav === 'products' && <ProductsView />}

        {currentNav === 'payments' && <PaymentsView />}

        {currentNav === 'reports' && <ReportsView />}

        {currentNav === 'settings' && <SettingsView />}
      </AppLayout>

      {/* New Invoice Modal */}
      <NewInvoiceModal
        isOpen={isNewInvoiceOpen}
        onClose={() => setIsNewInvoiceOpen(false)}
        onSuccess={() => {
          loadData();
          setActionNotice('Draft invoice created successfully in PostgreSQL');
          setTimeout(() => setActionNotice(null), 3000);
        }}
      />

      {/* Record Payment Modal */}
      <RecordPaymentModal
        invoice={paymentInvoice}
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        onSuccess={() => {
          loadData();
          setActionNotice('Payment recorded and applied to invoice balance');
          setTimeout(() => setActionNotice(null), 3000);
        }}
      />

      {/* Selected Invoice Details Quick View Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] text-teal-700 font-bold uppercase tracking-wider">
                    {selectedInvoice.status} INVOICE
                  </span>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">
                    {selectedInvoice.invoiceNumber}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="py-4 space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Customer:</span>
                <span className="font-semibold text-slate-900">{selectedInvoice.customerName}</span>
              </div>
              {selectedInvoice.customerEmail && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-700 font-mono text-[11px]">
                    {selectedInvoice.customerEmail}
                  </span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Invoice Date:</span>
                <span className="text-slate-700">{selectedInvoice.invoiceDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Due Date:</span>
                <span className="text-slate-700">{selectedInvoice.dueDate}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Payment Status:</span>
                <span className="font-semibold text-teal-700">{selectedInvoice.paymentStatus || 'UNPAID'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Subtotal:</span>
                <span className="text-slate-800">{formatCurrency(selectedInvoice.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Total Tax (GST):</span>
                <span className="text-slate-800">{formatCurrency(selectedInvoice.taxTotal)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-slate-200 text-sm font-bold">
                <span className="text-slate-900">Grand Total:</span>
                <span className="text-navy-900">{formatCurrency(selectedInvoice.grandTotal)}</span>
              </div>
              <div className="flex justify-between py-1 text-xs">
                <span className="text-slate-500">Total Paid:</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(selectedInvoice.totalPaid)}</span>
              </div>
              <div className="flex justify-between py-1 text-xs font-semibold">
                <span className="text-amber-800">Outstanding Balance:</span>
                <span className="text-amber-700">{formatCurrency(selectedInvoice.balanceRemaining)}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {selectedInvoice.status === 'DRAFT' && (
                  <button
                    onClick={() => handleIssueInvoice(selectedInvoice)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm"
                  >
                    <SendHorizontal className="w-3.5 h-3.5" />
                    Issue Invoice
                  </button>
                )}

                {selectedInvoice.status === 'ISSUED' && selectedInvoice.paymentStatus !== 'PAID' && (
                  <button
                    onClick={() => {
                      const inv = selectedInvoice;
                      setSelectedInvoice(null);
                      setPaymentInvoice(inv);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Record Payment
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default App;
