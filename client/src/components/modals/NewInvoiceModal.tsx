import React, { useState } from 'react';
import { X, FilePlus, IndianRupee, Calendar, User, Mail } from 'lucide-react';
import { Invoice } from '../../types';

interface NewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (invoice: Omit<Invoice, 'id' | 'isMock'>) => void;
}

export const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<'PENDING' | 'PAID' | 'DRAFT'>('PENDING');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !amount) return;

    const num = Math.floor(Math.random() * 900) + 100;
    const today = new Date().toISOString().split('T')[0];

    onSubmit({
      invoiceNumber: `INV-2025-${num}`,
      customerName,
      customerEmail: customerEmail || `${customerName.toLowerCase().replace(/\s+/g, '')}@example.com`,
      issueDate: today,
      dueDate: dueDate || today,
      amount: Number(amount),
      status,
      currency: 'INR',
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Create New Invoice</h3>
              <p className="text-[11px] text-slate-500">Phase 1 Preview: Mock invoice creation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer / Company Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Reliance Retail Enterprises"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="accounts@customer.com"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (INR ₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Initial Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            >
              <option value="PENDING">Pending (Awaiting Payment)</option>
              <option value="PAID">Paid (Settled)</option>
              <option value="DRAFT">Draft</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-all"
            >
              Save Invoice (Preview)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
