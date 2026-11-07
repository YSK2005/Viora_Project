import React, { useState, useEffect, useCallback } from 'react';
import { Customer } from '../../types';
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from '../../services/api';
import { StateSelect } from '../common/StateSelect';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Trash2,
  AlertCircle,
  Loader2,
  FileText,
  X,
  CheckCircle2,
  FileEdit,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [customerState, setCustomerState] = useState('Karnataka');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchCustomers({ search: searchQuery });
      setCustomers(res.customers);
    } catch (err: any) {
      setError(err.message || 'Failed to load customers');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName('');
    setPhone('');
    setEmail('');
    setBillingAddress('');
    setGstin('');
    setCustomerState('Karnataka');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setName(c.name);
    setPhone(c.phone ? c.phone.replace(/\D/g, '').slice(-10) : '');
    setEmail(c.email || '');
    setBillingAddress(c.billingAddress);
    setGstin(c.gstin || '');
    setCustomerState(c.state || 'Karnataka');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (!billingAddress.trim()) {
      setFormError('Billing address is required.');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const hasPhone = cleanPhone.length === 10;
    const hasEmail = Boolean(email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));

    if (!hasPhone && !hasEmail) {
      setFormError('At least one contact method (10-digit Phone Number or valid Email) is mandatory so invoices can be sent to this customer.');
      return;
    }

    if (phone.trim() && cleanPhone.length !== 10) {
      setFormError('Phone number must be exactly 10 digits.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          name: name.trim(),
          phone: cleanPhone || '',
          email: email.trim() || undefined,
          billingAddress: billingAddress.trim(),
          gstin: gstin.trim() || undefined,
          state: customerState.trim() || undefined,
        });
        setToastMessage('Customer details updated successfully');
      } else {
        await createCustomer({
          name: name.trim(),
          phone: cleanPhone || '',
          email: email.trim() || undefined,
          billingAddress: billingAddress.trim(),
          gstin: gstin.trim() || undefined,
          state: customerState.trim() || undefined,
        });
        setToastMessage('Customer created successfully');
      }

      setTimeout(() => setToastMessage(null), 3000);
      setIsModalOpen(false);
      setEditingCustomer(null);
      setName('');
      setPhone('');
      setEmail('');
      setBillingAddress('');
      setGstin('');
      setCustomerState('Karnataka');
      setFormError(null);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (customer: Customer) => {
    const hasInvoices = customer._count && customer._count.invoices > 0;
    const confirmMsg = hasInvoices
      ? `This customer has ${customer._count?.invoices} historical invoices. Archiving will retain all historical records. Proceed?`
      : `Are you sure you want to delete ${customer.name}?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteCustomer(customer.id);
      setToastMessage(hasInvoices ? 'Customer archived successfully' : 'Customer removed');
      setTimeout(() => setToastMessage(null), 3000);
      loadData();
    } catch (err: any) {
      alert(`Error removing customer: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-900 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-teal-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-navy-900 tracking-tight">Customer Directory</h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
              Live Database
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage client profiles, GSTINs, and billing addresses connected to PostgreSQL
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-sm transition-all hover:shadow"
        >
          <Plus className="w-4 h-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Search and Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-card flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, email, or GSTIN..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
        </div>
        <div className="text-xs text-slate-400 ml-auto hidden sm:block">
          Total: {customers.length} registered
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading customer accounts...</p>
        </div>
      ) : error ? (
        <div className="p-8 bg-rose-50 rounded-xl border border-rose-200 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-rose-900">Failed to load customers</h4>
          <p className="text-xs text-rose-600 mt-1">{error}</p>
          <button
            onClick={loadData}
            className="mt-3 px-3 py-1.5 text-xs font-medium text-rose-800 bg-rose-100 hover:bg-rose-200 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200/80 shadow-card">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mx-auto mb-3">
            <Users className="w-7 h-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No customers found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mb-5">
            {searchQuery
              ? 'No client accounts match your search filter. Try clearing the search query.'
              : 'Add your first customer to start creating professional GST invoices.'}
          </p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 sm:px-6">Customer Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 hidden md:table-cell">Billing Address</th>
                  <th className="py-3 px-4 text-center">GSTIN</th>
                  <th className="py-3 px-4 text-center">Invoices</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="font-semibold text-navy-900">{c.name}</div>
                      {c.isArchived && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200 mt-0.5">
                          Archived
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {c.phone ? (
                        <div className="flex items-center gap-1.5 text-slate-700 font-mono text-xs">
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>+91 {c.phone.replace(/\D/g, '').slice(-10)}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">No phone</span>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-0.5">
                          <Mail className="w-3.5 h-3.5 text-rose-500" />
                          <span>{c.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 hidden md:table-cell text-slate-600 max-w-xs truncate">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <span className="truncate">{c.billingAddress}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {c.gstin ? (
                        <span className="font-mono text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {c.gstin}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unregistered</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                        <FileText className="w-3 h-3" />
                        {c._count?.invoices ?? 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEditModal(c)}
                          title="Edit Customer Details"
                          aria-label={`Edit ${c.name}`}
                          className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          title="Delete or Archive Customer"
                          aria-label={`Delete ${c.name}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {editingCustomer ? 'Edit Customer Details' : 'Add New Customer'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingCustomer ? 'Updates reflected across future invoices' : 'Persisted directly in PostgreSQL database'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingCustomer(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="p-2.5 bg-purple-50/70 border border-purple-100 rounded-lg text-[11px] text-purple-900">
                <span className="font-semibold text-purple-700">Contact Requirement: </span>
                At least one contact method (<strong>10-digit Phone</strong> for WhatsApp or <strong>Email</strong> for Gmail) is mandatory to send invoices.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer / Business Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Tata Consultancy Services Ltd"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number (10 Digits) {!email.trim() && <span className="text-rose-500">*</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-medium text-slate-400 select-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        let clean = digits;
                        if (digits.length > 10 && digits.startsWith('91')) {
                          clean = digits.slice(-10);
                        } else if (digits.length === 11 && digits.startsWith('0')) {
                          clean = digits.slice(1);
                        } else {
                          clean = digits.slice(0, 10);
                        }
                        setPhone(clean);
                      }}
                      placeholder="9876543210"
                      className="w-full pl-10 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">10 digits used for WhatsApp delivery</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address (Gmail) {!phone.trim() && <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="accounts@tata.com"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Used for direct Gmail delivery</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="Street address, City, State, PIN code"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    GSTIN (Tax Identifier, optional)
                  </label>
                  <input
                    type="text"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="29ABCDE1234F1Z5"
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>

                <StateSelect
                  id="customerState"
                  label="State (Place of Supply)"
                  value={customerState}
                  onChange={(val) => setCustomerState(val)}
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingCustomer(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
