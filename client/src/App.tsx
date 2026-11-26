const CreditsView = lazy(() => import('./components/pages/CreditsView').then((m) => ({ default: m.CreditsView })));
const StatementsView = lazy(() => import('./components/pages/StatementsView').then((m) => ({ default: m.StatementsView })));
const RecurringView = lazy(() => import('./components/pages/RecurringView').then((m) => ({ default: m.RecurringView })));
const SuperAdminView = lazy(() => import('./components/pages/SuperAdminView').then((m) => ({ default: m.SuperAdminView })));
const CustomerPortalView = lazy(() => import('./components/pages/CustomerPortalView').then((m) => ({ default: m.CustomerPortalView })));
const PricingView = lazy(() => import('./components/pages/PricingView').then((m) => ({ default: m.PricingView })));
const PaymentSuccessView = lazy(() => import('./components/pages/PaymentSuccessView').then((m) => ({ default: m.PaymentSuccessView })));
const PaymentFailedView = lazy(() => import('./components/pages/PaymentFailedView').then((m) => ({ default: m.PaymentFailedView })));
import { PageSkeleton } from './components/common/PageSkeleton';
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import {
  NavigationKey,
  Invoice,
  DashboardSummary,
  BusinessProfile,
  SystemHealth,
  User,
  UserRole,
  PaymentReceiptData,
} from './types';
import { AppLayout } from './components/layout/AppLayout';
const DashboardView = lazy(() => import('./components/pages/DashboardView').then((m) => ({ default: m.DashboardView })));
const InvoicesView = lazy(() => import('./components/pages/InvoicesView').then((m) => ({ default: m.InvoicesView })));
const CustomersView = lazy(() => import('./components/pages/CustomersView').then((m) => ({ default: m.CustomersView })));
const ProductsView = lazy(() => import('./components/pages/ProductsView').then((m) => ({ default: m.ProductsView })));
const PaymentsView = lazy(() => import('./components/pages/PaymentsView').then((m) => ({ default: m.PaymentsView })));
const ReportsView = lazy(() => import('./components/pages/ReportsView').then((m) => ({ default: m.ReportsView })));
const SettingsView = lazy(() => import('./components/pages/SettingsView').then((m) => ({ default: m.SettingsView })));
import { NewInvoiceModal } from './components/modals/NewInvoiceModal';
import { InvoicePreviewModal } from './components/modals/InvoicePreviewModal';
import { RecordPaymentModal } from './components/modals/RecordPaymentModal';
import { InvoiceDispatchModal } from './components/modals/InvoiceDispatchModal';
import { AuthModal } from './components/modals/AuthModal';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import {
  fetchInvoices,
  fetchInvoiceDetails,
  fetchDashboardSummary,
  fetchBusiness,
  fetchHealth,
  fetchCurrentUser,
  logoutUser,
  issueInvoice,
  deleteDraftInvoice,
  cancelInvoice,
  AuthResponse,
} from './services/api';
import { getActivePortal, PortalRole } from './utils/portal';
import { FileCheck2, ShieldAlert, RefreshCw, ExternalLink } from 'lucide-react';

function getDefaultNavForPortal(portal: PortalRole): NavigationKey {
  if (portal === 'SUPER_ADMIN') return 'superadmin';
  if (portal === 'CUSTOMER') return 'customer_portal';
  return 'dashboard';
}

export const App: React.FC = () => {
  const activePortal = getActivePortal();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [billingAuthorized, setBillingAuthorized] = useState<boolean>(true);
  const [billingBlockReason, setBillingBlockReason] = useState<string | null>(null);

  const [currentNav, setCurrentNav] = useState<NavigationKey>(() =>
    getDefaultNavForPortal(activePortal)
  );
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [dispatchingInvoice, setDispatchingInvoice] = useState<Invoice | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({ status: 'checking' });
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('');
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<PaymentReceiptData | null>(null);
  const [paymentFailureData, setPaymentFailureData] = useState<{
    message?: string;
    code?: string;
    orderId?: string;
  } | null>(null);

  useEffect(() => {
    if (activePortal === 'CUSTOMER') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePortal]);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      if (activePortal === 'CUSTOMER') {
        const health = await fetchHealth();
        setSystemHealth(health);
        setIsStale(false);
        return;
      }

      const [health, invData, summary, biz, me] = await Promise.all([
        fetchHealth(),
        fetchInvoices(),
        fetchDashboardSummary(),
        fetchBusiness().catch(() => null),
        fetchCurrentUser().catch(() => null),
      ]);

      setSystemHealth(health);
      if (me) {
        setBillingAuthorized(Boolean(me.billingAuthorized));
        setBillingBlockReason(me.billingBlockReason || null);
      }
      if (health.status !== 'healthy' || !invData.isBackendConnected || !summary || !biz) {
        throw new Error('Billing data is unavailable. Previously loaded records have been retained.');
      }
      setInvoices(invData.invoices);
      setDashboardSummary(summary);
      if (biz) setBusinessProfile(biz);
      setIsStale(false);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      setLoadError(err.message || 'Failed to connect to backend server');
      setIsStale(true);
    }
  }, [activePortal]);

  const checkAuth = useCallback(async () => {
    setIsAuthChecking(true);
    try {
      const data = await fetchCurrentUser();
      if (data && data.user) {
        setCurrentUser(data.user);
        setUserRole(data.role);
        setBusinessProfile(data.business);
        setBillingAuthorized(Boolean(data.billingAuthorized));
        setBillingBlockReason(data.billingBlockReason || null);
        setIsAuthChecking(false);
        setCurrentNav(getDefaultNavForPortal(activePortal));
        return true;
      }
    } catch (err) {
      console.warn('Initial session check failed:', err);
    }
    setCurrentUser(null);
    setUserRole(null);
    setIsAuthChecking(false);
    return false;
  }, [activePortal]);

  useEffect(() => {
    checkAuth().then((authenticated) => {
      if (authenticated) {
        loadData();
      }
    });

    const timer = setInterval(async () => {
      try {
        const health = await fetchHealth();
        setSystemHealth(health);
      } catch {
        setSystemHealth({ status: 'offline' });
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [checkAuth, loadData]);

  const handleAuthSuccess = (data: AuthResponse) => {
    setCurrentUser(data.user);
    setUserRole(data.role);
    setBusinessProfile(data.business);
    setBillingAuthorized(Boolean(data.billingAuthorized));
    setBillingBlockReason(data.billingBlockReason || null);
    setIsAuthChecking(false);
    setCurrentNav(getDefaultNavForPortal(activePortal));
    loadData();
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      setLoadError('Sign out failed. Please retry.');
      return;
    }
    setCurrentUser(null);
    setUserRole(null);
    setBusinessProfile(null);
    setInvoices([]);
    setDashboardSummary(null);
    setBillingAuthorized(true);
    setBillingBlockReason(null);
    setCurrentNav(getDefaultNavForPortal(activePortal));
  };

  const handleNavigate = (nav: NavigationKey) => {
    if (activePortal === 'CUSTOMER') {
      if (['customer_portal', 'pricing', 'payment_success', 'payment_failed'].includes(nav)) {
        setCurrentNav(nav);
      }
      return;
    }
    if (activePortal === 'SUPER_ADMIN') {
      if (['superadmin', 'products', 'invoices', 'customers', 'reports', 'settings'].includes(nav)) {
        setCurrentNav(nav);
      }
      return;
    }
    if (['dashboard', 'invoices', 'customers', 'products', 'payments', 'reports', 'credits', 'statements', 'recurring'].includes(nav)) {
      setCurrentNav(nav);
    }
  };

  const handleIssueInvoice = async (inv: Invoice) => {
    if (activePortal === 'ADMIN' && !billingAuthorized) {
      alert(
        billingBlockReason ||
          'Bill generation is currently disabled by your Super Admin. Please authorize Admin billing on Port 5175.'
      );
      return;
    }
    try {
      inv = await fetchInvoiceDetails(inv.id);
    } catch {
      setLoadError('Unable to load invoice details. Please retry.');
      return;
    }
    const cleanBizPhone = (businessProfile?.phone || '').replace(/\D/g, '');
    const hasBizWhatsApp = cleanBizPhone.length >= 10;
    const hasBizEmail = Boolean(
      businessProfile?.email &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessProfile.email.trim())
    );

    if (!hasBizWhatsApp || !hasBizEmail) {
      alert(
        'Company WhatsApp number (min 10 digits) and official email are mandatory to issue and send invoices. Configure them inside Super Admin Company Settings (Port 5175).'
      );
      if (activePortal === 'SUPER_ADMIN') setCurrentNav('settings');
      return;
    }

    const custDigits = (inv.customerPhoneSnapshot || '').replace(/\D/g, '').slice(-10);
    const hasCustPhone = custDigits.length === 10;
    const hasCustEmail = Boolean(
      inv.customerEmailSnapshot && inv.customerEmailSnapshot.trim().length > 0
    );

    if (!hasCustPhone && !hasCustEmail) {
      alert(
        'Customer must have at least one valid contact method (10-digit phone for WhatsApp or email for Gmail) to receive the invoice.'
      );
      return;
    }

    if (
      !window.confirm(
        `Issue invoice for ${inv.customerName}? An official sequential invoice number will be assigned.`
      )
    )
      return;

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

  const handleDeleteDraft = async (inv: Invoice) => {
    if (
      !window.confirm(
        `Are you sure you want to delete draft invoice ${inv.invoiceNumber}? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      await deleteDraftInvoice(inv.id);
      setActionNotice(`Draft invoice ${inv.invoiceNumber} deleted successfully`);
      setTimeout(() => setActionNotice(null), 3000);
      loadData();
    } catch (err: any) {
      alert(`Error deleting draft: ${err.message}`);
    }
  };

  const handleCancelInvoice = async (inv: Invoice) => {
    if (
      !window.confirm(
        `Are you sure you want to cancel invoice ${inv.invoiceNumber}? It will be marked as CANCELLED and remain in records for audit purposes.`
      )
    ) {
      return;
    }
    try {
      await cancelInvoice(inv.id);
      setActionNotice(`Invoice ${inv.invoiceNumber} has been cancelled`);
      setTimeout(() => setActionNotice(null), 3000);
      loadData();
    } catch (err: any) {
      alert(`Error cancelling invoice: ${err.message}`);
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
    if (activePortal === 'ADMIN' && !billingAuthorized) {
      alert(
        billingBlockReason ||
          'Bill generation is currently disabled by Super Admin. Please enable "Allow Admin Billing" inside Super Admin Panel (Port 5175).'
      );
      return;
    }
    setEditingInvoice(null);
    setIsNewInvoiceOpen(true);
  };

  const handleEditDraft = async (inv: Invoice) => {
    try {
      if (!inv.items || inv.items.length === 0) {
        const full = await fetchInvoiceDetails(inv.id);
        setEditingInvoice(full);
      } else {
        setEditingInvoice(inv);
      }
      setIsNewInvoiceOpen(true);
    } catch (err: any) {
      console.error('Failed to load full invoice for editing:', err);
      setEditingInvoice(inv);
      setIsNewInvoiceOpen(true);
    }
  };

  const handleDuplicateInvoice = async (inv: Invoice) => {
    if (activePortal === 'ADMIN' && !billingAuthorized) {
      alert(billingBlockReason || 'Bill generation is currently disabled by Super Admin.');
      return;
    }
    try {
      let full = inv;
      if (!inv.items || inv.items.length === 0) {
        full = await fetchInvoiceDetails(inv.id);
      }
      setEditingInvoice({
        ...full,
        id: '',
        invoiceNumber: `COPY OF ${full.invoiceNumber}`,
        status: 'DRAFT',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      } as any);
      setIsNewInvoiceOpen(true);
    } catch (err: any) {
      alert(`Could not duplicate invoice: ${err.message}`);
    }
  };

  if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
    return (
      <main className="p-8 max-w-xl mx-auto">
        <h1 className="text-3xl font-bold">404 — Page not found</h1>
        <p className="my-4">This page does not exist.</p>
        <a className="underline" href="/">
          Go to portal home
        </a>
      </main>
    );
  }

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4 animate-pulse">
          <FileCheck2 className="w-6 h-6" />
        </div>
        <div className="text-white font-bold text-lg tracking-tight">Viora Bills</div>
        <div className="text-slate-400 text-xs mt-1">Verifying secure portal session...</div>
      </div>
    );
  }

  if (!currentUser) return <AuthModal isOpen onSuccess={handleAuthSuccess} />;

  return (
    <>
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {actionNotice || ''}
      </div>

      {actionNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 no-print"
        >
          <FileCheck2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <span>{actionNotice}</span>
        </div>
      )}

      <AppLayout
        currentNav={currentNav}
        onNavigate={handleNavigate}
        systemHealth={systemHealth}
        user={currentUser}
        userRole={userRole}
        onLogout={handleLogout}
        onOpenGlobalSearch={() => setIsGlobalSearchOpen(true)}
      >
        {loadError && activePortal !== 'CUSTOMER' && (
          <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-4 text-red-900">
            {loadError}{' '}
            <button onClick={loadData} className="underline font-semibold">
              Retry
            </button>
          </div>
        )}

        {/* Explicit Super Admin Billing Lock Banner inside Admin Desk (Port 5173) */}
        {activePortal === 'ADMIN' && !billingAuthorized && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 flex-shrink-0">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-950">
                  Billing Generation Locked by Super Admin
                </h3>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  {billingBlockReason ||
                    'Your Super Admin must authorize bill generation before this terminal can create or issue invoices.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={loadData}
                className="px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Check Authorization</span>
              </button>
              <a
                href="http://localhost:5175"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <span>Open Super Admin (5175)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        <Suspense fallback={<PageSkeleton />}>
          {/* PORTAL 1: CUSTOMER PURCHASE PORTAL (Port 5174) */}
          {activePortal === 'CUSTOMER' && currentNav === 'customer_portal' && (
            <CustomerPortalView
              userEmail={currentUser.email}
              onUpgradePlan={() => setCurrentNav('pricing')}
            />
          )}
          {activePortal === 'CUSTOMER' && currentNav === 'pricing' && (
            <PricingView
              isAuthenticated={Boolean(currentUser)}
              userEmail={currentUser.email}
              userName={currentUser.name}
              onPaymentSuccess={(receipt: any) => {
                setActiveReceiptData(receipt);
                setCurrentNav('payment_success');
              }}
              onPaymentFailed={(failInfo: any) => {
                setPaymentFailureData(failInfo);
                setCurrentNav('payment_failed');
              }}
            />
          )}
          {activePortal === 'CUSTOMER' && currentNav === 'payment_success' && (
            <PaymentSuccessView
              receiptData={activeReceiptData}
              userEmail={currentUser.email}
              onGoToPortal={() => setCurrentNav('customer_portal')}
            />
          )}
          {activePortal === 'CUSTOMER' && currentNav === 'payment_failed' && (
            <PaymentFailedView
              errorDetails={paymentFailureData}
              onRetry={() => setCurrentNav('pricing')}
              onViewPlans={() => setCurrentNav('pricing')}
            />
          )}

          {/* PORTAL 2: SUPER ADMIN CONTROL (Port 5175) */}
          {activePortal === 'SUPER_ADMIN' && currentNav === 'superadmin' && (
            <SuperAdminView
              userEmail={currentUser.email}
              onOpenProducts={() => setCurrentNav('products')}
              onOpenSettings={() => setCurrentNav('settings')}
              onRefreshParent={loadData}
            />
          )}

          {/* PORTAL 3: ADMIN BILLING DESK (Port 5173) + Shared Authorized Management Views */}
          {activePortal === 'ADMIN' && currentNav === 'dashboard' && (
            <DashboardView
              summary={dashboardSummary}
              invoices={invoices}
              onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
              onNewInvoice={handleOpenNewInvoice}
              onIssueInvoice={handleIssueInvoice}
              onRecordPayment={(inv) => setPaymentInvoice(inv)}
              onEditDraft={handleEditDraft}
              onDeleteDraft={handleDeleteDraft}
              onCancelInvoice={handleCancelInvoice}
              onNavigateToCustomers={() => setCurrentNav('customers')}
              onNavigateToProducts={() => setCurrentNav('products')}
              onDateRangeChange={handleDashboardDateRangeChange}
            />
          )}

          {activePortal !== 'CUSTOMER' && currentNav === 'invoices' && (
            <InvoicesView
              summary={dashboardSummary}
              invoices={invoices}
              onSelectInvoice={(inv) => setPreviewInvoiceId(inv.id)}
              onNewInvoice={handleOpenNewInvoice}
              onIssueInvoice={handleIssueInvoice}
              onRecordPayment={(inv) => setPaymentInvoice(inv)}
              onEditDraft={handleEditDraft}
              onDeleteDraft={handleDeleteDraft}
              onCancelInvoice={handleCancelInvoice}
              onDuplicateInvoice={handleDuplicateInvoice}
              initialCustomerFilter={selectedCustomerFilter}
              error={loadError}
              isStale={isStale}
              onRetry={loadData}
            />
          )}

          {activePortal !== 'CUSTOMER' && currentNav === 'customers' && (
            <CustomersView
              onViewCustomerInvoices={(custName) => {
                setSelectedCustomerFilter(custName);
                setCurrentNav('invoices');
              }}
            />
          )}

          {activePortal !== 'CUSTOMER' && currentNav === 'products' && (
            <ProductsView readOnly={activePortal === 'ADMIN'} />
          )}

          {activePortal === 'ADMIN' && currentNav === 'payments' && (
            <PaymentsView
              userRole={userRole}
              onSelectInvoice={(invId) => setPreviewInvoiceId(invId)}
              onOpenRecordPayment={() => {
                const payable = invoices.find(
                  (inv) =>
                    inv.status === 'ISSUED' &&
                    (inv.balanceRemaining === undefined || inv.balanceRemaining > 0)
                );
                if (payable) {
                  setPaymentInvoice(payable);
                } else {
                  alert(
                    'No outstanding issued invoices available for payment. Please issue an invoice first.'
                  );
                }
              }}
            />
          )}

          {activePortal !== 'CUSTOMER' && currentNav === 'reports' && <ReportsView />}
          {activePortal === 'SUPER_ADMIN' && currentNav === 'settings' && <SettingsView />}
          {activePortal === 'ADMIN' && currentNav === 'credits' && (
            <CreditsView onChanged={loadData} canIssue={userRole === 'OWNER' || userRole === 'ACCOUNTANT'} />
          )}
          {activePortal === 'ADMIN' && currentNav === 'statements' && <StatementsView />}
          {activePortal === 'ADMIN' && currentNav === 'recurring' && (
            <RecurringView onInvoiceCreated={loadData} />
          )}
        </Suspense>
      </AppLayout>

      {activePortal !== 'CUSTOMER' && (
        <>
          <NewInvoiceModal
            isOpen={isNewInvoiceOpen}
            editingInvoice={editingInvoice}
            enforceCatalogOnly={activePortal === 'ADMIN'}
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

          {paymentInvoice && (
            <RecordPaymentModal
              key={paymentInvoice.id}
              invoice={paymentInvoice}
              isOpen={Boolean(paymentInvoice)}
              onClose={() => setPaymentInvoice(null)}
              onSuccess={() => {
                loadData();
                setActionNotice('Payment recorded successfully');
                setTimeout(() => setActionNotice(null), 3000);
              }}
            />
          )}

          <InvoicePreviewModal
            invoiceId={previewInvoiceId}
            isOpen={Boolean(previewInvoiceId)}
            onClose={() => setPreviewInvoiceId(null)}
            onIssueSuccess={() => {
              loadData();
            }}
            onOpenPayment={(inv) => {
              setPreviewInvoiceId(null);
              setPaymentInvoice(inv);
            }}
            onEditDraft={handleEditDraft}
          />

          <InvoiceDispatchModal
            isOpen={Boolean(dispatchingInvoice)}
            invoice={dispatchingInvoice}
            business={businessProfile}
            onClose={() => setDispatchingInvoice(null)}
          />

          <GlobalSearchModal
            isOpen={isGlobalSearchOpen}
            onClose={() => setIsGlobalSearchOpen(false)}
            onSelectInvoice={(invoiceId) => {
              setIsGlobalSearchOpen(false);
              setPreviewInvoiceId(invoiceId);
            }}
            onSelectCustomer={(customerName) => {
              setIsGlobalSearchOpen(false);
              setSelectedCustomerFilter(customerName);
              setCurrentNav('invoices');
            }}
            onSelectProduct={(_productName) => {
              setIsGlobalSearchOpen(false);
              setCurrentNav('products');
            }}
          />
        </>
      )}
    </>
  );
};

export default App;
