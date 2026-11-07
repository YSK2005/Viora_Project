import React, { useState } from 'react';
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
import { InvoicePreviewModal } from './components/modals/InvoicePreviewModal';
import { InvoiceDispatchModal } from './components/modals/InvoiceDispatchModal';
import {
  NavigationKey,
  Invoice,
  DashboardSummary,
  SystemHealth,
  BusinessProfile,
} from './types';
import {
  fetchHealth,
  fetchInvoices,
  fetchDashboardSummary,
  fetchBusiness,
  issueInvoice,
} from './services/api';
import {
  FileCheck2,
} from 'lucide-react';
import { useEffect, useCallback } from 'react';

export const App: React.FC = () => {
  const [currentNav, setCurrentNav] = useState<NavigationKey>('dashboard');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [isSimulatedEmpty, setIsSimulatedEmpty] = useState(false);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [dispatchingInvoice, setDispatchingInvoice] = useState<Invoice | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({ status: 'checking' });
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [health, invData, summary, biz] = await Promise.all([
      fetchHealth(),
      fetchInvoices(),
      fetchDashboardSummary(),
      fetchBusiness().catch(() => null),
    ]);

    setSystemHealth(health);
    setInvoices(invData.invoices);
    setDashboardSummary(summary);
    if (biz) setBusinessProfile(biz);
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
    // Check company WhatsApp & Gmail before issuing
    const cleanBizPhone = (businessProfile?.phone || '').replace(/\D/g, '');
    const hasBizWhatsApp = cleanBizPhone.length >= 10;
    const hasBizEmail = Boolean(businessProfile?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessProfile.email.trim()));

    if (!hasBizWhatsApp || !hasBizEmail) {
      alert('Company WhatsApp number (min 10 digits) and Gmail/Email are mandatory to issue and send invoices. Opening Settings to configure them.');
      setCurrentNav('settings');
      return;
    }

    // Check customer contact
    const custDigits = (inv.customerPhoneSnapshot || '').replace(/\D/g, '').slice(-10);
    const hasCustPhone = custDigits.length === 10;
    const hasCustEmail = Boolean(inv.customerEmailSnapshot && inv.customerEmailSnapshot.trim().length > 0);

    if (!hasCustPhone && !hasCustEmail) {
      alert('Customer must have at least one valid contact method (10-digit phone for WhatsApp or email for Gmail) to receive the invoice.');
      return;
    }

    if (!window.confirm(`Issue invoice for ${inv.customerName}? An official sequential invoice number will be assigned.`)) return;

    try {
      const issued = await issueInvoice(inv.id);
      setActionNotice(`Invoice ${issued.invoiceNumber} has been officially issued!`);
      setTimeout(() => setActionNotice(null), 3500);
      loadData();
      setDispatchingInvoice(issued);
    } catch (err: any) {
      alert(`Error issuing invoice: ${err.message}`);
    }
  };

  const handleDashboardDateRangeChange = async (startDate?: string, endDate?: string) => {
    try {
      const summary = await fetchDashboardSummary({ startDate, endDate });
      setDashboardSummary(summary);
    } catch (err) {
      console.error('Failed to filter dashboard summary:', err);
    }
  };

  const handleOpenNewInvoice = () => {
    setEditingInvoice(null);
    setIsNewInvoiceOpen(true);
  };

  const handleEditDraft = (inv: Invoice) => {
    setEditingInvoice(inv);
    setIsNewInvoiceOpen(true);
  };

  return (
    <>
      {/* Toast Alert */}
      {actionNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-950 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 no-print">
          <FileCheck2 className="w-4 h-4 text-brand-400" />
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
            onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
            onNewInvoice={handleOpenNewInvoice}
            isSimulatedEmpty={isSimulatedEmpty}
            onSimulateEmptyToggle={setIsSimulatedEmpty}
            onNavigateToCustomers={() => setCurrentNav('customers')}
            onNavigateToProducts={() => setCurrentNav('products')}
            onDateRangeChange={handleDashboardDateRangeChange}
          />
        )}

        {currentNav === 'invoices' && (
          <InvoicesView
            invoices={invoices}
            onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
            onNewInvoice={handleOpenNewInvoice}
            onIssueInvoice={handleIssueInvoice}
            onRecordPayment={(inv) => setPaymentInvoice(inv)}
            onEditDraft={handleEditDraft}
            isSimulatedEmpty={isSimulatedEmpty}
            onSimulateEmptyToggle={setIsSimulatedEmpty}
          />
        )}

        {currentNav === 'customers' && <CustomersView />}

        {currentNav === 'products' && <ProductsView />}

        {currentNav === 'payments' && (
          <PaymentsView
            onSelectInvoice={(invId) => setPreviewInvoiceId(invId)}
            onOpenRecordPayment={() => {
              const payable = invoices.find(
                (inv) => inv.status === 'ISSUED' && (inv.balanceRemaining === undefined || inv.balanceRemaining > 0)
              );
              if (payable) {
                setPaymentInvoice(payable);
              } else {
                alert('No outstanding issued invoices available for payment. Please issue an invoice first.');
              }
            }}
          />
        )}

        {currentNav === 'reports' && <ReportsView />}

        {currentNav === 'settings' && <SettingsView />}
      </AppLayout>

      {/* New / Edit Invoice Modal */}
      <NewInvoiceModal
        isOpen={isNewInvoiceOpen}
        editingInvoice={editingInvoice}
        onClose={() => {
          setIsNewInvoiceOpen(false);
          setEditingInvoice(null);
        }}
        onSuccess={(saved) => {
          loadData();
          if (saved?.status === 'ISSUED') {
            setActionNotice(`Invoice ${saved.invoiceNumber} issued officially!`);
            setDispatchingInvoice(saved);
          } else {
            setActionNotice('Draft invoice saved successfully');
          }
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

      {/* Professional Invoice Preview & Print Modal */}
      <InvoicePreviewModal
        invoiceId={previewInvoiceId}
        isOpen={Boolean(previewInvoiceId)}
        onClose={() => setPreviewInvoiceId(null)}
        onIssueSuccess={() => {
          loadData();
        }}
        onOpenPayment={(inv) => {
          setPaymentInvoice(inv);
        }}
      />

      {/* Direct WhatsApp and Gmail Dispatch Modal upon Issuance */}
      <InvoiceDispatchModal
        isOpen={Boolean(dispatchingInvoice)}
        invoice={dispatchingInvoice}
        onClose={() => setDispatchingInvoice(null)}
      />
    </>
  );
};

export default App;
