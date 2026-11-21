import React, { useState, useEffect, useCallback } from 'react';
import {
  Repeat,
  Plus,
  Play,
  Pause,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  fetchRecurringSchedules,
  createRecurringSchedule,
  triggerRecurringSchedule,
  toggleRecurringSchedule,
  deleteRecurringSchedule,
  RecurringSchedule,
  fetchInvoices,
} from '../../services/api';
import { Invoice } from '../../types';

interface RecurringViewProps {
  onInvoiceCreated?: () => void;
}

export const RecurringView: React.FC<RecurringViewProps> = ({ onInvoiceCreated }) => {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New Schedule Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [frequency, setFrequency] = useState<'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY'>('MONTHLY');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSchedules = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchRecurringSchedules();
      setSchedules(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load recurring profiles');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handleOpenModal = async () => {
    setIsModalOpen(true);
    try {
      const invData = await fetchInvoices({ limit: 100 });
      setInvoices(invData.invoices);
      if (invData.invoices.length > 0) {
        setSelectedInvoiceId(invData.invoices[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load invoices for recurring template:', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) return;

    try {
      setIsSubmitting(true);
      await createRecurringSchedule({
        invoiceId: selectedInvoiceId,
        frequency,
      });
      setIsModalOpen(false);
      setNotice('Recurring schedule created successfully');
      setTimeout(() => setNotice(null), 3500);
      loadSchedules();
    } catch (err: any) {
      alert(`Error creating schedule: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrigger = async (schedule: RecurringSchedule) => {
    try {
      const res = await triggerRecurringSchedule(schedule.id);
      setNotice(`Draft invoice ${res.invoice.invoiceNumber} created from recurring schedule`);
      setTimeout(() => setNotice(null), 4000);
      loadSchedules();
      onInvoiceCreated?.();
    } catch (err: any) {
      alert(`Error generating invoice: ${err.message}`);
    }
  };

  const handleToggle = async (schedule: RecurringSchedule) => {
    try {
      await toggleRecurringSchedule(schedule.id);
      loadSchedules();
    } catch (err: any) {
      alert(`Error updating schedule: ${err.message}`);
    }
  };

  const handleDelete = async (schedule: RecurringSchedule) => {
    if (!window.confirm(`Delete recurring schedule for ${schedule.customerName}?`)) return;
    try {
      await deleteRecurringSchedule(schedule.id);
      loadSchedules();
    } catch (err: any) {
      alert(`Error deleting schedule: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-navy-900 tracking-tight flex items-center gap-2">
            <Repeat className="w-6 h-6 text-purple-600" />
            Recurring Invoices
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Automate recurring client billing, subscriptions, and retainer invoices on a scheduled basis.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          type="button"
          className="btn-primary flex items-center gap-2 shadow-sm"
          aria-label="Create new recurring schedule"
        >
          <Plus className="w-4 h-4" />
          <span>New Recurring Schedule</span>
        </button>
      </div>

      {notice && (
        <div role="status" className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Schedules List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200/90 p-8 text-center text-slate-400 text-sm">
          Loading recurring profiles...
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/90 p-12 text-center">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-navy-900 mb-1">No Recurring Invoices Configured</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Convert any existing invoice into a recurring subscription to automate regular billing for your clients.
          </p>
          <button
            onClick={handleOpenModal}
            className="btn-secondary text-xs"
            aria-label="Create your first recurring invoice schedule"
          >
            Create First Schedule
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden shadow-card">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/90 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Client / Invoice</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Next Run Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-navy-900">{s.customerName}</div>
                    <div className="text-[11px] text-slate-400">Template: {s.invoiceNumber}</div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {s.frequency}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-navy-900">
                    ₹{s.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{s.nextRunDate}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        s.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleTrigger(s)}
                        title="Generate invoice draft now"
                        aria-label={`Generate invoice draft now for ${s.customerName}`}
                        className="px-2 py-1 text-[11px] font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-md flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 text-purple-600" />
                        Run Now
                      </button>

                      <button
                        onClick={() => handleToggle(s)}
                        title={s.status === 'ACTIVE' ? 'Pause schedule' : 'Resume schedule'}
                        aria-label={s.status === 'ACTIVE' ? `Pause recurring schedule for ${s.customerName}` : `Resume recurring schedule for ${s.customerName}`}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
                      >
                        {s.status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        onClick={() => handleDelete(s)}
                        title="Delete recurring schedule"
                        aria-label={`Delete recurring schedule for ${s.customerName}`}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-navy-900">Create Recurring Invoice Schedule</h3>
            <p className="text-xs text-slate-500">
              Select an existing invoice to serve as the template for automatic recurring generation.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor="templateInvoice" className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Invoice
                </label>
                <select
                  id="templateInvoice"
                  value={selectedInvoiceId}
                  onChange={(e) => setSelectedInvoiceId(e.target.value)}
                  className="form-input w-full text-xs"
                  required
                >
                  {invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - {inv.customerNameSnapshot || (inv as any).customerName || 'Customer'} (₹{inv.grandTotal})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="frequency" className="block text-xs font-semibold text-slate-700 mb-1">
                  Billing Frequency
                </label>
                <select
                  id="frequency"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as any)}
                  className="form-input w-full text-xs"
                >
                  <option value="WEEKLY">Weekly (Every 7 days)</option>
                  <option value="MONTHLY">Monthly (Every 1 month)</option>
                  <option value="QUARTERLY">Quarterly (Every 3 months)</option>
                  <option value="ANNUALLY">Annually (Every 1 year)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs"
                  aria-label="Cancel new recurring schedule"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !selectedInvoiceId}
                  className="btn-primary text-xs"
                  aria-label="Save recurring schedule"
                >
                  {isSubmitting ? 'Creating...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default RecurringView;
