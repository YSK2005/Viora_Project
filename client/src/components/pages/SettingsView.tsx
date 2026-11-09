import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BusinessProfile } from '../../types';
import { fetchBusiness, updateBusiness } from '../../services/api';
import { StateSelect } from '../common/StateSelect';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ImagePlus,
  X,
} from 'lucide-react';

const LOGO_STORAGE_KEY = 'viora_bills_logo';

export const SettingsView: React.FC = () => {
  const [business, setBusiness] = useState<BusinessProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('Karnataka');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');

  // Logo branding
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchBusiness();
      setBusiness(data);
      setName(data.name || '');
      setAddress(data.address || '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setGstin(data.gstin || '');
      setState(data.state || 'Karnataka');
      setInvoicePrefix(data.invoicePrefix || 'INV');
      if (data.logoUrl) {
        setLogoDataUrl(data.logoUrl);
        localStorage.setItem(LOGO_STORAGE_KEY, data.logoUrl);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load business profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Load saved logo from localStorage
    const saved = localStorage.getItem(LOGO_STORAGE_KEY);
    if (saved) setLogoDataUrl(saved);
  }, [loadData]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawData = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/png');
          setLogoDataUrl(dataUrl);
          localStorage.setItem(LOGO_STORAGE_KEY, dataUrl);
        } else {
          setLogoDataUrl(rawData);
          localStorage.setItem(LOGO_STORAGE_KEY, rawData);
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setLogoDataUrl(null);
    localStorage.removeItem(LOGO_STORAGE_KEY);
    if (fileInputRef.current) fileInputRef.current.value = '';
    try {
      await updateBusiness({ logoUrl: null });
    } catch {
      // Non-fatal
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Business / Organization name is required.');
      return;
    }
    if (!address.trim()) {
      setError('Official registered address is required.');
      return;
    }

    // Company WhatsApp validation
    const cleanDigits = phone.replace(/\D/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
      setError('Company WhatsApp / Phone number is mandatory (at least 10 digits) to send invoices to customers.');
      return;
    }

    // Company Gmail validation
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Company Gmail / Official email is mandatory to send invoices to customers.');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateBusiness({
        name: name.trim(),
        logoUrl: logoDataUrl,
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim() || null,
        state: state.trim() || 'Karnataka',
        invoicePrefix: invoicePrefix.trim().toUpperCase(),
      });
      setBusiness(updated);
      setSuccessMsg('Business settings updated and saved successfully');
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to save business settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-navy-950 text-white text-xs px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-brand-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-navy-900 tracking-tight">Business Profile & Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure your company details, logo, GSTIN, and invoice numbering
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200/80">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Loading organization profile...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-3 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 0: Company Branding & Logo */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-card space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <ImagePlus className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-semibold text-slate-900">Company Branding & Logo</h3>
              <span className="ml-auto text-[10px] font-medium text-accent-700 bg-accent-50 border border-accent-200 px-2 py-0.5 rounded">
                Used in Invoices & PDF
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Upload your company logo. It will appear on invoice previews and printed PDF documents.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 items-start">
              {/* Logo Preview */}
              <div className="flex-shrink-0">
                <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center overflow-hidden relative group">
                  {logoDataUrl ? (
                    <>
                      <img
                        src={logoDataUrl}
                        alt="Company logo preview"
                        className="w-full h-full object-contain p-2"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove logo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <ImagePlus className="w-8 h-8 text-slate-300 mx-auto mb-1" />
                      <span className="text-[10px] text-slate-400">No logo</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Upload Logo Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    onChange={handleLogoUpload}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-brand-400 file:text-black hover:file:bg-brand-500 file:cursor-pointer cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    PNG, JPG, SVG or WebP · Recommended: 400×400px or wider · Max 2MB
                  </p>
                </div>

                {logoDataUrl && (
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Logo saved — will appear on invoices and PDF documents
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Business Identification */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-card space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-semibold text-slate-900">Legal Business Information</h3>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Company / Legal Entity Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Acme Enterprises Pvt Ltd"
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Gmail / Email <span className="text-rose-500">*</span>
                  <span className="ml-1 text-[10px] text-purple-700 font-normal">(Mandatory for sending invoices)</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-purple-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="billing@company.com or yourbusiness@gmail.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Sender address for invoice emails</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company WhatsApp Number <span className="text-rose-500">*</span>
                  <span className="ml-1 text-[10px] text-purple-700 font-normal">(Mandatory for sending invoices)</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-purple-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Official WhatsApp contact on invoices</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Registered Address <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, City, State, PIN code"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GSTIN (Tax Identification Number)
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                />
              </div>

              <StateSelect
                id="businessState"
                label="State of Registration (for GST Supply Determination)"
                value={state}
                onChange={(val) => setState(val)}
              />
            </div>
          </div>

          {/* Section 2: Invoice Numbering Configuration */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-card space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-semibold text-slate-900">Invoice Numbering Sequence</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Invoice Number Prefix
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="INV"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-400/30 focus:border-brand-400"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Example: <code className="text-brand-600 font-bold">{invoicePrefix || 'INV'}-{new Date().getFullYear()}-000001</code>
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Next Sequence Counter
                </label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    disabled
                    value={business?.nextInvoiceNumber ?? 1}
                    className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-500 font-mono cursor-not-allowed"
                  />
                </div>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Managed sequentially by database transactions
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold bg-brand-400 hover:bg-brand-500 text-black shadow-sm transition-all hover:shadow disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Changes...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
