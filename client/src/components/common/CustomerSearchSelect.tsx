import React, { useState, useEffect, useRef } from 'react';
import { Customer } from '../../types';
import { fetchCustomers } from '../../services/api';
import { Search, Check, ChevronDown, X, Loader2 } from 'lucide-react';

interface CustomerSearchSelectProps {
  value: string;
  onChange: (customerId: string, customer?: Customer) => void;
  disabled?: boolean;
  required?: boolean;
}

export const CustomerSearchSelect: React.FC<CustomerSearchSelectProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load customer list on query or open
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetchCustomers({ search: searchQuery.trim(), limit: 50 });
        if (active) {
          setCustomers(res.customers);
          if (value && !selectedCustomer) {
            const found = res.customers.find((c) => c.id === value);
            if (found) setSelectedCustomer(found);
          }
        }
      } catch (err) {
        console.error('Error fetching customers for select:', err);
      } finally {
        if (active) setIsLoading(false);
      }
    }, searchQuery ? 200 : 0);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery, value, selectedCustomer]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = (customer: Customer) => {
    setSelectedCustomer(customer);
    onChange(customer.id, customer);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(null);
    onChange('', undefined);
    setSearchQuery('');
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < customers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : customers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < customers.length) {
        handleSelect(customers[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Selected Customer Card or Search Box */}
      {selectedCustomer && !isOpen ? (
        <div
          onClick={() => !disabled && setIsOpen(true)}
          className={`flex items-center justify-between p-2.5 bg-white border border-slate-300 rounded-lg cursor-pointer hover:border-teal-500 transition-colors ${
            disabled ? 'opacity-60 cursor-not-allowed' : ''
          }`}
          role="button"
          tabIndex={0}
          aria-label={`Selected customer: ${selectedCustomer.name}. Click to change.`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0 font-bold text-xs border border-teal-200">
              {selectedCustomer.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-xs truncate">
                {selectedCustomer.name}
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-2 truncate">
                {selectedCustomer.phone && <span>+91 {selectedCustomer.phone.slice(-10)}</span>}
                {selectedCustomer.gstin && (
                  <span className="font-mono text-[10px] bg-slate-100 px-1 rounded">
                    {selectedCustomer.gstin}
                  </span>
                )}
              </div>
            </div>
          </div>
          {!disabled && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear customer selection"
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            required={required && !value}
            disabled={disabled}
            placeholder="Type customer name, phone, or GSTIN to discover..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
              setHighlightedIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={isOpen}
            aria-autocomplete="list"
            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
          />
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />
          )}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100"
        >
          {customers.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              {isLoading ? 'Searching customer database...' : 'No customers found matching search'}
            </div>
          ) : (
            customers.map((c, idx) => {
              const isSelected = c.id === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={c.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(c)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 text-xs cursor-pointer flex items-center justify-between transition-colors ${
                    isHighlighted ? 'bg-teal-50/80 text-teal-900' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-900 truncate flex items-center gap-2">
                      <span>{c.name}</span>
                      {c.state && (
                        <span className="text-[10px] text-slate-400 font-normal">({c.state})</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5 truncate">
                      {c.phone && <span>Ph: +91 {c.phone.slice(-10)}</span>}
                      {c.gstin && (
                        <span className="font-mono text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                          {c.gstin}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-teal-600 flex-shrink-0" />}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
