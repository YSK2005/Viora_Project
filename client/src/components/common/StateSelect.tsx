import React, { useState } from 'react';
import { Plus, Check, X, MapPin } from 'lucide-react';
import { getAllStates, addCustomState } from '../../utils/states';

interface StateSelectProps {
  value: string;
  onChange: (state: string) => void;
  label?: string;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export const StateSelect: React.FC<StateSelectProps> = ({
  value,
  onChange,
  label,
  id,
  className = '',
  disabled = false,
}) => {
  const [states, setStates] = useState<string[]>(() => getAllStates());
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__ADD_NEW__') {
      setIsAddingCustom(true);
      setErrorMsg(null);
    } else {
      onChange(val);
    }
  };

  const handleSaveCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = customInput.trim();
    if (!clean) {
      setErrorMsg('State name cannot be empty');
      return;
    }
    const res = addCustomState(clean);
    setStates(res.states);
    if (res.added) {
      onChange(res.added);
    }
    setCustomInput('');
    setIsAddingCustom(false);
    setErrorMsg(null);
  };

  const handleCancelCustom = () => {
    setIsAddingCustom(false);
    setCustomInput('');
    setErrorMsg(null);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="block text-xs font-semibold text-slate-700">
            {label}
          </label>
          {!isAddingCustom && !disabled && (
            <button
              type="button"
              onClick={() => {
                setIsAddingCustom(true);
                setErrorMsg(null);
              }}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 hover:text-purple-800 hover:underline"
            >
              <Plus className="w-3 h-3" />
              <span>Add State</span>
            </button>
          )}
        </div>
      )}

      {isAddingCustom ? (
        <div className="p-2.5 bg-purple-50/70 border border-purple-200 rounded-lg space-y-2 animate-in fade-in duration-150">
          <div className="text-[11px] font-medium text-purple-900 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-purple-600" />
            <span>Add Custom State / Union Territory</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              autoFocus
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSaveCustom();
                } else if (e.key === 'Escape') {
                  handleCancelCustom();
                }
              }}
              placeholder="e.g. Daman, New Region, etc."
              className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-purple-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
            />
            <button
              type="button"
              onClick={() => handleSaveCustom()}
              className="px-2.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-md shadow-xs flex items-center gap-1 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={handleCancelCustom}
              className="px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {errorMsg && (
            <p className="text-[10px] text-rose-600 font-medium">{errorMsg}</p>
          )}
        </div>
      ) : (
        <div className="relative">
          <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-colors cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
          >
            {/* If current value is not in list yet, show it */}
            {value && !states.some((s) => s.toLowerCase() === value.toLowerCase()) && (
              <option value={value}>{value}</option>
            )}
            {states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
            <option disabled value="">
              ──────────
            </option>
            <option value="__ADD_NEW__" className="text-purple-700 font-semibold">
              + Add Custom State...
            </option>
          </select>
        </div>
      )}
    </div>
  );
};
