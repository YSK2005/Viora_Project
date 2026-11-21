import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Sliders,
  Building2,
  Users,
  CreditCard,
  Package,
  Layers,
  Save,
  CheckCircle2,
  RefreshCw,
  Search,
  KeyRound,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import {
  fetchSuperAdminStats,
  fetchSuperAdminSettings,
  updateSuperAdminSettings,
  fetchSuperAdminTenants,
  fetchSuperAdminUsers,
  fetchSuperAdminProducts,
  fetchSubscriptionPlans,
  updateSuperAdminPlan,
} from '../../services/api';

interface SuperAdminViewProps {
  onSwitchToWorkspace: (businessId: string) => void;
}

export const SuperAdminView: React.FC<SuperAdminViewProps> = ({ onSwitchToWorkspace }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'tenants' | 'users' | 'plans' | 'products'>('overview');
  const [stats, setStats] = useState<any | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [tenants, setTenants] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, settingsList, tenantsData, plansData] = await Promise.all([
        fetchSuperAdminStats().catch(() => null),
        fetchSuperAdminSettings().catch(() => []),
        fetchSuperAdminTenants().catch(() => ({ tenants: [] })),
        fetchSubscriptionPlans().catch(() => []),
      ]);

      if (statsData) setStats(statsData);
      if (tenantsData?.tenants) setTenants(tenantsData.tenants);
      if (plansData) setPlans(plansData);

      const settingsMap: Record<string, string> = {};
      settingsList.forEach((s: any) => {
        settingsMap[s.key] = s.value;
      });
      setSettings(settingsMap);
    } catch (err) {
      console.error('Failed to load Super Admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTabChange = async (tab: typeof activeTab) => {
    setActiveTab(tab);
    if (tab === 'users' && usersList.length === 0) {
      const u = await fetchSuperAdminUsers().catch(() => ({ users: [] }));
      setUsersList(u.users || []);
    } else if (tab === 'products' && products.length === 0) {
      const p = await fetchSuperAdminProducts().catch(() => []);
      setProducts(p || []);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSaveMessage(null);
    try {
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        category: key.startsWith('RAZORPAY_') ? 'PAYMENT' : key.includes('GST') ? 'BILLING' : 'GENERAL',
      }));

      await updateSuperAdminSettings(payload);
      setSaveMessage('System settings and Razorpay configuration updated successfully.');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdatePlanPrice = async (planId: string, monthly: number, yearly: number) => {
    try {
      await updateSuperAdminPlan(planId, { monthlyPrice: monthly, yearlyPrice: yearly });
      alert('Plan pricing updated successfully!');
      const updated = await fetchSubscriptionPlans();
      setPlans(updated);
    } catch (err: any) {
      alert(`Failed to update plan: ${err.message}`);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
        <span className="text-sm text-slate-500">Loading Super Admin Control Panel...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-400" />
              Super Admin Control Center
            </span>
            <span className="text-xs text-slate-400">Global System Management</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            Platform System Overview & Control
          </h1>
          <p className="text-sm text-slate-300 max-w-xl">
            Configure payment gateways, manage tenant business workspaces, master product catalogs, and subscription pricing in INR.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs border border-white/20 flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        {[
          { key: 'overview', label: 'Platform Stats', icon: Layers },
          { key: 'settings', label: 'System Settings & Razorpay', icon: Sliders },
          { key: 'tenants', label: 'Tenant Businesses', icon: Building2 },
          { key: 'users', label: 'Platform Users', icon: Users },
          { key: 'plans', label: 'Subscription Plans (INR)', icon: CreditCard },
          { key: 'products', label: 'Global Products', icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key as any)}
              className={`px-4 py-3 text-xs font-bold rounded-xl flex items-center gap-2 transition-all whitespace-nowrap ${
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
      </div>

      {/* TAB 1: Platform Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Key Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Businesses</span>
              <div className="text-3xl font-black text-slate-900">{stats?.totalTenants || 0}</div>
              <span className="text-xs text-indigo-600 font-medium">Tenant Workspaces</span>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Platform Users</span>
              <div className="text-3xl font-black text-slate-900">{stats?.totalUsers || 0}</div>
              <span className="text-xs text-teal-600 font-medium">Admins & Customers</span>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Subscriptions</span>
              <div className="text-3xl font-black text-emerald-600">{stats?.activeSubscriptionsCount || 0}</div>
              <span className="text-xs text-slate-500 font-medium">Paying Customers</span>
            </div>

            <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-sm space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Subscription Revenue</span>
              <div className="text-3xl font-black text-slate-900">
                ₹{Number(stats?.totalRevenue || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-xs text-emerald-600 font-medium">Via Razorpay Gateway</span>
            </div>
          </div>

          {/* Recent Businesses Table */}
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900">Recent Tenant Businesses</h3>
                <p className="text-xs text-slate-500">Latest companies registered on Viora Bills</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-6">Business Name</th>
                    <th className="py-3 px-6">Contact Email / Phone</th>
                    <th className="py-3 px-6">Invoices Generated</th>
                    <th className="py-3 px-6">Clients</th>
                    <th className="py-3 px-6">Joined Date</th>
                    <th className="py-3 px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {(stats?.recentTenants || []).map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-bold text-slate-900">{t.name}</td>
                      <td className="py-4 px-6">
                        <div>{t.email}</div>
                        <div className="text-[11px] text-slate-400">{t.phone}</div>
                      </td>
                      <td className="py-4 px-6">{t.invoicesCount}</td>
                      <td className="py-4 px-6">{t.customersCount}</td>
                      <td className="py-4 px-6 text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => onSwitchToWorkspace(t.id)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline inline-flex items-center gap-1"
                        >
                          <span>Open Workspace</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: System Settings & Razorpay Keys */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 animate-in fade-in duration-150">
          {saveMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{saveMessage}</span>
            </div>
          )}

          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <span>Razorpay Payment Gateway Settings</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Configure your Razorpay API Credentials. In Test mode, mock checkout simulation is active.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Razorpay Key ID
                </label>
                <input
                  type="text"
                  value={settings['RAZORPAY_KEY_ID'] || ''}
                  onChange={(e) => setSettings({ ...settings, RAZORPAY_KEY_ID: e.target.value })}
                  placeholder="e.g. rzp_test_..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Razorpay Key Secret
                </label>
                <input
                  type="password"
                  value={settings['RAZORPAY_KEY_SECRET'] || ''}
                  onChange={(e) => setSettings({ ...settings, RAZORPAY_KEY_SECRET: e.target.value })}
                  placeholder="Razorpay API Key Secret"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Gateway Environment Mode
                </label>
                <select
                  value={settings['RAZORPAY_MODE'] || 'TEST'}
                  onChange={(e) => setSettings({ ...settings, RAZORPAY_MODE: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 bg-white"
                >
                  <option value="TEST">TEST (Sandbox Simulation)</option>
                  <option value="LIVE">LIVE (Real INR Transactions)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Default Platform GST Rate (%)
                </label>
                <input
                  type="number"
                  value={settings['DEFAULT_GST_RATE'] || '18'}
                  onChange={(e) => setSettings({ ...settings, DEFAULT_GST_RATE: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-bold text-base text-slate-900">General Platform Information</h3>
              <p className="text-xs text-slate-500 mt-1">Branding and customer support information</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Platform Name
                </label>
                <input
                  type="text"
                  value={settings['PLATFORM_NAME'] || ''}
                  onChange={(e) => setSettings({ ...settings, PLATFORM_NAME: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Support Email
                </label>
                <input
                  type="email"
                  value={settings['SUPPORT_EMAIL'] || ''}
                  onChange={(e) => setSettings({ ...settings, SUPPORT_EMAIL: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Support Phone
                </label>
                <input
                  type="text"
                  value={settings['SUPPORT_PHONE'] || ''}
                  onChange={(e) => setSettings({ ...settings, SUPPORT_PHONE: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {savingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Settings...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save System Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Tenants Directory */}
      {activeTab === 'tenants' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden space-y-4 p-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">Registered Tenant Entities</h3>
              <p className="text-xs text-slate-500">Every isolated business organization hosted on the platform</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search businesses..."
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:border-indigo-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-6">Business</th>
                  <th className="py-3 px-6">GSTIN / State</th>
                  <th className="py-3 px-6">Owner</th>
                  <th className="py-3 px-6">Invoices</th>
                  <th className="py-3 px-6">Clients</th>
                  <th className="py-3 px-6 text-right">Switch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {tenants
                  .filter((t) => !tenantSearch || t.name.toLowerCase().includes(tenantSearch.toLowerCase()))
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-6 font-bold text-slate-900">{t.name}</td>
                      <td className="py-4 px-6">
                        <div>{t.gstin || 'Unregistered'}</div>
                        <div className="text-[11px] text-slate-400">{t.state || 'Karnataka'}</div>
                      </td>
                      <td className="py-4 px-6">
                        {t.owners?.[0]?.name || 'N/A'}
                        <div className="text-[11px] text-slate-400">{t.owners?.[0]?.email}</div>
                      </td>
                      <td className="py-4 px-6 font-bold">{t.invoicesCount}</td>
                      <td className="py-4 px-6">{t.customersCount}</td>
                      <td className="py-4 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => onSwitchToWorkspace(t.id)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs"
                        >
                          Manage Workspace
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Platform Users */}
      {activeTab === 'users' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden p-6 space-y-4 animate-in fade-in duration-150">
          <div>
            <h3 className="font-bold text-base text-slate-900">All Registered Users</h3>
            <p className="text-xs text-slate-500">Super Admins, Business Owners, Accountants, and SaaS Customers</p>
          </div>

          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Email</th>
                  <th className="py-3 px-6">System Role</th>
                  <th className="py-3 px-6">Active Plan</th>
                  <th className="py-3 px-6">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {usersList.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-bold text-slate-900">{u.name}</td>
                    <td className="py-4 px-6">{u.email}</td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-bold ${
                        u.role === 'SUPER_ADMIN'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : u.role === 'CUSTOMER'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-teal-100 text-teal-800 border border-teal-200'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-900">{u.activePlan}</td>
                    <td className="py-4 px-6 text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Subscription Plans Pricing Editor */}
      {activeTab === 'plans' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-base text-slate-900">Manage Subscription Plans & INR Pricing</h3>
            <p className="text-xs text-slate-500 mt-1">Super Admin pricing controls for Indian Rupees</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <div key={p.id} className="rounded-3xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-lg text-slate-900">{p.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                    {p.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Monthly Price (INR ₹)</label>
                    <input
                      type="number"
                      defaultValue={Number(p.monthlyPrice)}
                      id={`monthly_${p.id}`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Annual Price (INR ₹)</label>
                    <input
                      type="number"
                      defaultValue={Number(p.yearlyPrice)}
                      id={`yearly_${p.id}`}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const m = Number((document.getElementById(`monthly_${p.id}`) as HTMLInputElement)?.value);
                    const y = Number((document.getElementById(`yearly_${p.id}`) as HTMLInputElement)?.value);
                    handleUpdatePlanPrice(p.id, m, y);
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors"
                >
                  Save Plan Pricing
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Global Products Catalog */}
      {activeTab === 'products' && (
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-6 space-y-4 animate-in fade-in duration-150">
          <div>
            <h3 className="font-bold text-base text-slate-900">Master Products Catalog</h3>
            <p className="text-xs text-slate-500">Global product and service listings across businesses</p>
          </div>

          <div className="overflow-x-auto -mx-6 -mb-6">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-6">Product / Service</th>
                  <th className="py-3 px-6">Unit Price (INR)</th>
                  <th className="py-3 px-6">GST Rate</th>
                  <th className="py-3 px-6">Unit</th>
                  <th className="py-3 px-6">Tenant Business</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-6 font-bold text-slate-900">{prod.name}</td>
                    <td className="py-4 px-6 font-bold text-slate-900">
                      ₹{Number(prod.unitPrice).toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 px-6">{Number(prod.taxRate)}%</td>
                    <td className="py-4 px-6">{prod.unit}</td>
                    <td className="py-4 px-6 text-slate-500">{prod.business?.name || 'Global'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
