import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Package,
  Receipt,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Plus,
  Copy,
  Check,
  RotateCw,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ExternalLink,
  Lock,
  Unlock,
  Activity,
  Settings,
  ArrowRight,
} from 'lucide-react';
import {
  fetchSuperAdminOverview,
  toggleAdminBilling,
  fetchAdminAccessCodes,
  createAdminAccessCode,
  updateAdminAccessCode,
  deleteAdminAccessCode,
} from '../../services/api';
import { AdminAccessCode, SuperAdminOverview } from '../../types';
import { ProductsView } from './ProductsView';

interface SuperAdminViewProps {
  userEmail: string;
  onOpenProducts: () => void;
  onOpenSettings: () => void;
  onRefreshParent?: () => void;
}

function format12Digits(code: string): string {
  const clean = code.replace(/\D/g, '');
  if (clean.length === 12) {
    return `${clean.slice(0, 4)}  ${clean.slice(4, 8)}  ${clean.slice(8, 12)}`;
  }
  return code;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({
  userEmail,
  onOpenProducts,
  onOpenSettings,
  onRefreshParent,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'admin_codes' | 'oversight'>(
    'overview'
  );
  const [overview, setOverview] = useState<SuperAdminOverview | null>(null);
  const [adminCodes, setAdminCodes] = useState<AdminAccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingBilling, setTogglingBilling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create Admin Access Code form states
  const [label, setLabel] = useState('Main Billing Counter');
  const [assignmentType, setAssignmentType] = useState<'SELF' | 'STAFF'>('SELF');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffName, setStaffName] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [role, setRole] = useState<'OWNER' | 'ACCOUNTANT' | 'VIEWER'>('OWNER');
  const [canGenerateBills, setCanGenerateBills] = useState(true);
  const [enableBusinessBillingNow, setEnableBusinessBillingNow] = useState(true);
  const [creatingCode, setCreatingCode] = useState(false);
  const [newlyGeneratedCode, setNewlyGeneratedCode] = useState<AdminAccessCode | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, codes] = await Promise.all([
        fetchSuperAdminOverview(),
        fetchAdminAccessCodes(),
      ]);
      setOverview(ov);
      setAdminCodes(codes);
    } catch (err) {
      console.error('Failed to load Super Admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const showNotice = (msg: string) => {
    setErrorMsg(null);
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const showError = (msg: string) => {
    setNotice(null);
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  };

  const handleToggleMasterBilling = async () => {
    if (!overview) return;
    const nextState = !overview.business.allowAdminBilling;
    setTogglingBilling(true);
    try {
      const res = await toggleAdminBilling(nextState);
      showNotice(
        res.message ||
          (nextState
            ? 'Admin billing authorized!'
            : 'Admin billing paused.')
      );
      await loadAll();
      onRefreshParent?.();
    } catch (err: any) {
      showError(`Error updating billing authorization: ${err.message}`);
    } finally {
      setTogglingBilling(false);
    }
  };

  const handleGenerateAdminCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;

    const assignedEmail =
      assignmentType === 'SELF' ? userEmail : staffEmail.trim().toLowerCase();

    if (assignmentType === 'STAFF' && !assignedEmail) {
      showError('Please enter the Admin staff email address.');
      return;
    }

    setCreatingCode(true);
    try {
      const result = await createAdminAccessCode({
        label: label.trim(),
        assignedEmail,
        name: assignmentType === 'STAFF' ? staffName.trim() || label.trim() : undefined,
        password: assignmentType === 'STAFF' && staffPassword ? staffPassword : undefined,
        role,
        canGenerateBills,
        enableBusinessBilling: enableBusinessBillingNow,
      });

      setNewlyGeneratedCode(result.adminCode);
      setLabel('');
      setStaffEmail('');
      setStaffName('');
      setStaffPassword('');
      showNotice(`Generated 12-digit Admin Access Code: ${result.adminCode.code}`);
      await loadAll();
      onRefreshParent?.();
    } catch (err: any) {
      showError(`Error generating Admin Access Code: ${err.message}`);
    } finally {
      setCreatingCode(false);
    }
  };

  const handleToggleCodeField = async (
    codeItem: AdminAccessCode,
    payload: { canGenerateBills?: boolean; isActive?: boolean; rotateCode?: boolean }
  ) => {
    try {
      await updateAdminAccessCode(codeItem.id, payload);
      showNotice(
        payload.rotateCode
          ? 'Generated fresh 12-digit Admin Access Code'
          : payload.isActive === false
          ? 'Revoked Admin Access Code & terminated active sessions'
          : 'Updated Admin terminal permissions'
      );
      await loadAll();
    } catch (err: any) {
      showError(`Failed to update code: ${err.message}`);
    }
  };

  const handleDeleteCode = async (codeItem: AdminAccessCode) => {
    if (!window.confirm(`Delete Admin Access Code "${codeItem.label}"? Any active Admin terminal using it will be signed out.`)) {
      return;
    }
    try {
      await deleteAdminAccessCode(codeItem.id);
      showNotice('Admin Access Code deleted.');
      await loadAll();
    } catch (err: any) {
      showError(`Error deleting code: ${err.message}`);
    }
  };

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <span className="text-sm text-slate-500">Loading Super Admin Control Desk...</span>
      </div>
    );
  }

  const biz = overview?.business;
  const sub = overview?.subscription;
  const stats = overview?.stats;
  const checklist = overview?.setupChecklist;
  const isBillingAllowed = Boolean(biz?.allowAdminBilling);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {notice && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{notice}</span>
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-[11px] underline text-emerald-700">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center justify-between gap-2 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-[11px] underline text-rose-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Hero Control Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-7 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-yellow-300" />
              Verified Super Admin (Email + 12-Digit Key)
            </span>
            {sub && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">
                {sub.planName} • Active
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {biz?.name || 'Your Business Workspace'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
            Signed in as <strong>{userEmail}</strong>. Manage your master Product Catalog, generate 12-digit Admin Access Codes, and authorize Admins on Port 5173 to issue GST bills.
          </p>
        </div>

        {/* Master Billing Authorization Toggle Card */}
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 min-w-[300px]">
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
              Admin Billing Status (Port 5173)
            </div>
            <div className="flex items-center gap-2 mt-1">
              {isBillingAllowed ? (
                <span className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
                  <Unlock className="w-4 h-4" /> BILLING AUTHORIZED
                </span>
              ) : (
                <span className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                  <Lock className="w-4 h-4" /> BILLING PAUSED
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={togglingBilling}
            onClick={handleToggleMasterBilling}
            className={`px-4 py-2.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 ${
              isBillingAllowed
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            {togglingBilling ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isBillingAllowed ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Pause Billing</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span>Allow Admin Billing</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { key: 'overview', label: 'Overview & Checklist', icon: Activity },
          { key: 'products', label: 'Manage Product Catalog', icon: Package },
          { key: 'admin_codes', label: 'Admin Access Codes (Port 5173)', icon: KeyRound },
          { key: 'oversight', label: 'Bills & Audit Trail', icon: Receipt },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition-colors duration-100 whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={loadAll}
          className="ml-auto p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* TAB 1: Overview & Setup Checklist */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Interactive Onboarding Checklist */}
          <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="font-bold text-base text-slate-900">
                  Launch Workflow Checklist (Before Admin Generates Bills)
                </h2>
                <p className="text-xs text-slate-500">
                  Complete these steps so your Admin Billing Desk (Port 5173) can generate official GST bills.
                </p>
              </div>
              <a
                href="http://localhost:5173"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-bold text-xs hover:bg-teal-100 transition-colors"
              >
                <span>Open Billing Admin Desk (5173)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 ${
                  checklist?.hasActiveProducts
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    {checklist?.hasActiveProducts ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Package className="w-4 h-4 text-indigo-600" />
                    )}
                    <span>1. Add Products ({stats?.activeProductsCount || 0})</span>
                  </div>
                  <p className="text-slate-600">
                    Add products, unit prices & GST % for your billing team to pick from.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('admin_codes')}
                className={`p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-3 ${
                  checklist?.hasActiveAdminCode
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-indigo-50/70 border-indigo-200 hover:bg-indigo-100/60'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    {checklist?.hasActiveAdminCode ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <KeyRound className="w-4 h-4 text-indigo-600" />
                    )}
                    <span>2. Generate Admin Code ({stats?.activeAdminCodesCount || 0})</span>
                  </div>
                  <p className="text-slate-600">
                    Create 12-digit Admin Access Code(s) required for Port 5173 login.
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
              </button>

              <div
                className={`p-4 rounded-2xl border text-left flex items-start justify-between gap-3 ${
                  checklist?.isAdminBillingAllowed
                    ? 'bg-emerald-50/70 border-emerald-200'
                    : 'bg-amber-50 border-amber-300'
                }`}
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    {checklist?.isAdminBillingAllowed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                    )}
                    <span>3. Authorize Admin Billing</span>
                  </div>
                  <p className="text-slate-600">
                    {checklist?.isAdminBillingAllowed
                      ? 'Enabled! Admins can create & issue GST bills.'
                      : 'Click "Allow Admin Billing" in the top banner to unlock billing.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                Catalog Products
              </span>
              <div className="text-3xl font-black text-slate-900">
                {stats?.activeProductsCount || 0}
              </div>
              <button
                type="button"
                onClick={onOpenProducts}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Manage Products →
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                Active Admin Codes
              </span>
              <div className="text-3xl font-black text-indigo-600">
                {stats?.activeAdminCodesCount || 0}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('admin_codes')}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Issue / Manage Codes →
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                GST Bills Issued
              </span>
              <div className="text-3xl font-black text-slate-900">
                {stats?.issuedInvoicesCount || 0}
                <span className="text-xs font-normal text-slate-400 ml-1">
                  / {sub?.invoiceLimit === -1 ? '∞' : sub?.invoiceLimit || '—'}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Total drafts & issued: {stats?.totalInvoicesCount || 0}
              </span>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block whitespace-nowrap">
                Billed Revenue (Issued)
              </span>
              <div className="text-3xl font-black text-emerald-700">
                ₹{Number(stats?.totalBilledRevenue || 0).toLocaleString('en-IN')}
              </div>
              <button
                type="button"
                onClick={onOpenSettings}
                className="text-xs text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1"
              >
                <Settings className="w-3 h-3" /> Company GST Settings →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Full Product Catalog Management */}
      {activeTab === 'products' && (
        <div className="animate-in fade-in duration-150">
          <ProductsView readOnly={false} onCatalogChanged={loadAll} />
        </div>
      )}

      {/* TAB 3: Admin Access Code Generator & Permissions */}
      {activeTab === 'admin_codes' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-in fade-in duration-150">
          {/* Left: Generate New Admin Code Form */}
          <div className="lg:col-span-2 rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-5 h-fit">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Generate 12-Digit Admin Access Code</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Admins strictly require a code generated here to sign into Billing Admin Desk (Port 5173).
              </p>
            </div>

            {newlyGeneratedCode && (
              <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
                  <span>✅ New Admin Code Ready!</span>
                  <button
                    type="button"
                    onClick={() => copyCode(newlyGeneratedCode.id, newlyGeneratedCode.code)}
                    className="text-emerald-800 underline text-[11px]"
                  >
                    {copiedId === newlyGeneratedCode.id ? 'Copied!' : 'Copy Code'}
                  </button>
                </div>
                <div className="bg-white rounded-xl p-2.5 border border-emerald-200 text-center">
                  <code className="text-lg font-mono font-black tracking-widest text-emerald-800">
                    {format12Digits(newlyGeneratedCode.code)}
                  </code>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Assigned to: <strong>{newlyGeneratedCode.assignedEmail || userEmail}</strong>
                </p>
              </div>
            )}

            <form onSubmit={handleGenerateAdminCode} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Terminal / Counter Label *
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="e.g. POS Counter 1, Main Billing Desk"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Who will use this Admin code?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentType('SELF')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      assignmentType === 'SELF'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    My Email ({userEmail.split('@')[0]})
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignmentType('STAFF')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      assignmentType === 'STAFF'
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Staff / Operator Email
                  </button>
                </div>
              </div>

              {assignmentType === 'STAFF' && (
                <div className="space-y-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Operator Name
                    </label>
                    <input
                      type="text"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Operator Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="billing.staff@company.com"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Initial Password (if new account, min 12 chars)
                    </label>
                    <input
                      type="password"
                      minLength={12}
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="Min 12 characters"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Admin Desk Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                >
                  <option value="OWNER">OWNER — Full Billing, Payments & Credit Notes</option>
                  <option value="ACCOUNTANT">ACCOUNTANT — Create, Issue Bills & Payments</option>
                  <option value="VIEWER">VIEWER — Read-Only Invoice Viewer</option>
                </select>
              </div>

              <div className="space-y-2 pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={canGenerateBills}
                    onChange={(e) => setCanGenerateBills(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Allow this Admin code to generate & issue GST bills</span>
                </label>

                {!isBillingAllowed && (
                  <label className="flex items-center gap-2 text-xs text-emerald-800 font-semibold cursor-pointer bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <input
                      type="checkbox"
                      checked={enableBusinessBillingNow}
                      onChange={(e) => setEnableBusinessBillingNow(e.target.checked)}
                      className="rounded text-emerald-600"
                    />
                    <span>Also authorize Master Workspace Billing immediately</span>
                  </label>
                )}
              </div>

              <button
                type="submit"
                disabled={creatingCode}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {creatingCode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Generating 12-Digit Code...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    <span>Generate 12-Digit Admin Code</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right: Active & Revoked Admin Access Codes List */}
          <div className="lg:col-span-3 rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Issued Admin Access Codes ({adminCodes.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Control bill generation permissions or revoke codes at any time.
                </p>
              </div>
              <a
                href="http://localhost:5173"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold inline-flex items-center gap-1 hover:bg-teal-100"
              >
                <span>Open Port 5173</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="divide-y divide-slate-100 flex-1 overflow-y-auto">
              {adminCodes.length === 0 ? (
                <div className="p-12 text-center text-xs text-slate-400">
                  No Admin Access Codes generated yet. Create one using the form on the left.
                </div>
              ) : (
                adminCodes.map((ac) => (
                  <div key={ac.id} className="p-5 hover:bg-slate-50/70 transition-colors space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{ac.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {ac.role}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ac.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {ac.isActive ? 'ACTIVE' : 'REVOKED'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Operator Email: <strong className="text-slate-700">{ac.assignedEmail || 'Any workspace member'}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                        <code className="text-sm font-mono font-black tracking-wider text-indigo-900">
                          {format12Digits(ac.code)}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode(ac.id, ac.code)}
                          className="p-1 rounded hover:bg-indigo-200/50 text-indigo-700"
                          title="Copy 12-Digit Code"
                        >
                          {copiedId === ac.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleCodeField(ac, { canGenerateBills: !ac.canGenerateBills })
                        }
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
                          ac.canGenerateBills
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {ac.canGenerateBills ? (
                          <>
                            <ToggleRight className="w-4 h-4 text-emerald-600" />
                            <span>Bill Generation: Allowed</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 text-amber-600" />
                            <span>Bill Generation: Paused</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleCodeField(ac, { rotateCode: true })}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium inline-flex items-center gap-1"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Rotate Key</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleCodeField(ac, { isActive: !ac.isActive })}
                          className={`px-2.5 py-1 rounded-lg font-semibold ${
                            ac.isActive
                              ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {ac.isActive ? 'Revoke Access' : 'Restore Access'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteCode(ac)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          title="Delete Code"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Bills Oversight & Audit Trail */}
      {activeTab === 'oversight' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-150">
          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-teal-600" />
                <span>Recent Bills Generated by Admin Desk</span>
              </h3>
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {(overview?.recentInvoices || []).length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No bills generated yet.</div>
              ) : (
                overview?.recentInvoices.map((inv) => (
                  <div key={inv.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div>
                      <div className="font-bold text-slate-900">{inv.invoiceNumber}</div>
                      <div className="text-[11px] text-slate-500">
                        {inv.customerName} • {inv.invoiceDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">
                        ₹{inv.grandTotal.toLocaleString('en-IN')}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          inv.status === 'ISSUED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Immutable Security & Catalog Audit Log</span>
              </h3>
            </div>
            <div className="divide-y divide-slate-100 text-xs max-h-[420px] overflow-y-auto">
              {(overview?.recentAuditLogs || []).length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">No audit events recorded yet.</div>
              ) : (
                overview?.recentAuditLogs.map((log) => (
                  <div key={log.id} className="p-4 space-y-1 hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {log.action}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Actor: <strong>{log.user?.email || 'System'}</strong> • Target: {log.entityType}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
