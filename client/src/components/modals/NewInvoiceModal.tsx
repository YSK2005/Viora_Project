import React, { useState, useEffect } from 'react';
import { X, FilePlus, Trash2, Plus } from 'lucide-react';
import { Customer, Product } from '../../types';
import { fetchCustomers, fetchProducts, createInvoice } from '../../services/api';

interface NewInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ItemRow {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
}

export const NewInvoiceModal: React.FC<NewInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('Payment due within 15 days of invoice date.');
  const [items, setItems] = useState<ItemRow[]>([
    { productId: '', description: '', quantity: 1, unitPrice: 0, discountAmount: 0, taxRate: 18 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    Promise.all([fetchCustomers(), fetchProducts()]).then(([cRes, pRes]) => {
      setCustomers(cRes.customers);
      setProducts(pRes.products);
      if (cRes.customers.length > 0 && !customerId) {
        setCustomerId(cRes.customers[0].id);
      }
    }).catch((err) => {
      console.error('Failed to load customers or products:', err);
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find((p) => p.id === prodId);
    const next = [...items];
    if (prod) {
      next[index] = {
        ...next[index],
        productId: prod.id,
        description: prod.name,
        unitPrice: prod.unitPrice,
        taxRate: prod.taxRate,
      };
    } else {
      next[index] = {
        ...next[index],
        productId: '',
      };
    }
    setItems(next);
  };

  const updateItemField = (index: number, field: keyof ItemRow, value: any) => {
    const next = [...items];
    next[index] = { ...next[index], [field]: value };
    setItems(next);
  };

  const addItemRow = () => {
    setItems([
      ...items,
      { productId: '', description: '', quantity: 1, unitPrice: 0, discountAmount: 0, taxRate: 18 },
    ]);
  };

  const removeItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Live client estimated total for immediate feedback (final computed on server)
  const estimatedTotals = items.reduce(
    (acc, it) => {
      const base = it.quantity * it.unitPrice;
      const taxable = Math.max(0, base - (it.discountAmount || 0));
      const tax = taxable * ((it.taxRate || 0) / 100);
      return {
        subtotal: acc.subtotal + base,
        discount: acc.discount + (it.discountAmount || 0),
        tax: acc.tax + tax,
        grandTotal: acc.grandTotal + taxable + tax,
      };
    },
    { subtotal: 0, discount: 0, tax: 0, grandTotal: 0 }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError('Please select or register a customer first');
      return;
    }

    for (let i = 0; i < items.length; i++) {
      if (!items[i].description.trim()) {
        setError(`Item #${i + 1} must have a description`);
        return;
      }
      if (items[i].quantity <= 0) {
        setError(`Item #${i + 1} quantity must be greater than zero`);
        return;
      }
      if (items[i].discountAmount > items[i].quantity * items[i].unitPrice) {
        setError(`Item #${i + 1} discount cannot exceed the item price`);
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await createInvoice({
        customerId,
        invoiceDate,
        dueDate,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId || null,
          descriptionSnapshot: it.description.trim(),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discountAmount: Number(it.discountAmount) || 0,
          taxRate: Number(it.taxRate) || 0,
        })),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/40 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-3xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-200">
              <FilePlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Create New Invoice (Draft)</h3>
              <p className="text-[11px] text-slate-500">Totals are verified and calculated with Decimal precision on the server</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Top Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Customer <span className="text-rose-500">*</span>
              </label>
              {customers.length === 0 ? (
                <div className="text-xs text-rose-600">
                  No customers found. Please create a customer first!
                </div>
              ) : (
                <select
                  required
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Line Items
              </label>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((row, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    {/* Catalog Pre-fill */}
                    <div className="sm:col-span-4">
                      <select
                        value={row.productId}
                        onChange={(e) => handleProductSelect(idx, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      >
                        <option value="">-- Choose from Catalog (or custom) --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{p.unitPrice})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Item Description */}
                    <div className="sm:col-span-8">
                      <input
                        type="text"
                        required
                        placeholder="Description of goods or service"
                        value={row.description}
                        onChange={(e) => updateItemField(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">Quantity</span>
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        required
                        value={row.quantity}
                        onChange={(e) => updateItemField(idx, 'quantity', Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">Unit Price (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={row.unitPrice}
                        onChange={(e) => updateItemField(idx, 'unitPrice', Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">Discount (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.discountAmount}
                        onChange={(e) => updateItemField(idx, 'discountAmount', Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 block mb-0.5">GST Rate (%)</span>
                      <select
                        value={row.taxRate}
                        onChange={(e) => updateItemField(idx, 'taxRate', Number(e.target.value))}
                        className="w-full px-2 py-1 text-xs bg-white border border-slate-200 rounded-lg"
                      >
                        <option value="0">0%</option>
                        <option value="5">5%</option>
                        <option value="12">12%</option>
                        <option value="18">18%</option>
                        <option value="28">28%</option>
                      </select>
                    </div>

                    <div className="flex items-end justify-between sm:justify-end gap-2 pt-3 sm:pt-0">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Item Total</span>
                        <span className="font-semibold text-xs text-navy-900">
                          ₹
                          {(
                            Math.max(0, row.quantity * row.unitPrice - row.discountAmount) *
                            (1 + row.taxRate / 100)
                          ).toFixed(2)}
                        </span>
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(idx)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes and Grand Total Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-3 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Terms / Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span>₹{estimatedTotals.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Discounts:</span>
                <span>-₹{estimatedTotals.discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total Tax (GST):</span>
                <span>₹{estimatedTotals.tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-navy-900 pt-2 border-t border-slate-200">
                <span>Estimated Grand Total:</span>
                <span className="text-teal-700">₹{estimatedTotals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || customers.length === 0}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Invoice...' : 'Save as Draft Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
