import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FileText,
  Users,
  Package,
  X,
  Loader2,
  CornerDownLeft,
} from 'lucide-react';
import { apiFetch } from '../../services/api';

interface SearchResultItem {
  id: string;
  type: 'invoice' | 'customer' | 'product';
  title: string;
  subtitle: string;
  badge?: string;
  extra?: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectInvoice: (invoiceId: string) => void;
  onSelectCustomer: (customerName: string) => void;
  onSelectProduct: (productName: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectInvoice,
  onSelectCustomer,
  onSelectProduct,
}) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<{
    invoices: any[];
    customers: any[];
    products: any[];
  }>({ invoices: [], customers: [], products: [] });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setResults({ invoices: [], customers: [], products: [] });
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Debounced API search
  useEffect(() => {
    if (!query.trim()) {
      setResults({ invoices: [], customers: [], products: [] });
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(`/search?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) throw new Error('Search failed');
        const json = await res.json();
        if (active) {
          setResults(json.data || { invoices: [], customers: [], products: [] });
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Global search error:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  // Flattened items for keyboard navigation
  const flatItems: SearchResultItem[] = [
    ...results.invoices.map((inv) => ({
      id: inv.id,
      type: 'invoice' as const,
      title: `Invoice #${inv.invoiceNumber}`,
      subtitle: `${inv.customerName} • ${inv.invoiceDate}`,
      badge: inv.status,
      extra: `₹${Number(inv.grandTotal).toLocaleString('en-IN')}`,
    })),
    ...results.customers.map((c) => ({
      id: c.id,
      type: 'customer' as const,
      title: c.name,
      subtitle: [c.phone ? `+91 ${c.phone}` : null, c.email].filter(Boolean).join(' • '),
      badge: c.state || 'Customer',
      extra: c.gstin ? `GST: ${c.gstin}` : undefined,
    })),
    ...results.products.map((p) => ({
      id: p.id,
      type: 'product' as const,
      title: p.name,
      subtitle: `${p.unit || 'PCS'} • GST ${p.taxRate}%`,
      badge: p.isActive ? 'Active' : 'Inactive',
      extra: `₹${Number(p.unitPrice).toLocaleString('en-IN')}`,
    })),
  ];

  const handleSelect = (item: SearchResultItem) => {
    onClose();
    if (item.type === 'invoice') {
      onSelectInvoice(item.id);
    } else if (item.type === 'customer') {
      onSelectCustomer(item.title);
    } else if (item.type === 'product') {
      onSelectProduct(item.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        handleSelect(flatItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Global Search Command Palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative border-b border-slate-200 px-4 py-3.5 flex items-center gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-teal-600 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type to search invoices, clients, or catalog products..."
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
          />
          {isLoading && <Loader2 className="w-4 h-4 text-teal-600 animate-spin flex-shrink-0" />}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-medium text-slate-400 bg-white border border-slate-200 rounded shadow-xs">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
          {!query.trim() ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-medium text-slate-600">Quickly find records across all categories</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Search by invoice number, customer name, phone, GSTIN, or product name
              </p>
            </div>
          ) : flatItems.length === 0 && !isLoading ? (
            <div className="py-12 text-center text-xs text-slate-500">
              No matching invoices, customers, or products found for "{query}".
            </div>
          ) : (
            flatItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl cursor-pointer flex items-center justify-between transition-colors ${
                    isSelected ? 'bg-teal-50/80 text-teal-950' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                        item.type === 'invoice'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : item.type === 'customer'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {item.type === 'invoice' && <FileText className="w-4 h-4" />}
                      {item.type === 'customer' && <Users className="w-4 h-4" />}
                      {item.type === 'product' && <Package className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900 truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0 text-right">
                    {item.extra && (
                      <span className="font-mono text-xs font-semibold text-slate-900">
                        {item.extra}
                      </span>
                    )}
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-teal-600 hidden sm:block" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] mr-1">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] mr-1">
                ↓
              </kbd>
              to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] mr-1">
                ↵
              </kbd>
              to select
            </span>
          </div>
          <span>Total matches: {flatItems.length}</span>
        </div>
      </div>
    </div>
  );
};
