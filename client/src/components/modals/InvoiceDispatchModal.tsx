import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Send,
  Mail,
  MessageCircle,
  ExternalLink,
  AlertCircle,
  User,
  Calendar,
  Check,
} from 'lucide-react';
import { Invoice, Customer, BusinessProfile } from '../../types';
import {
  getInvoiceDispatchUrls,
  openWhatsAppDispatch,
  openGmailDispatch,
  formatINR,
} from '../../utils/dispatchInvoice';

interface InvoiceDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  customer?: Partial<Customer> | null;
  business?: Partial<BusinessProfile> | null;
  autoDispatch?: boolean;
}

export const InvoiceDispatchModal: React.FC<InvoiceDispatchModalProps> = ({
  isOpen,
  onClose,
  invoice,
  customer,
  business,
  autoDispatch = true,
}) => {
  const [waSent, setWaSent] = useState(false);
  const [gmailSent, setGmailSent] = useState(false);

  const { whatsAppUrl, gmailUrl, customerPhone10, customerEmail } =
    invoice ? getInvoiceDispatchUrls(invoice, customer, business) : {
      whatsAppUrl: null,
      gmailUrl: null,
      customerPhone10: null,
      customerEmail: null,
    };

  // Automatically trigger WhatsApp & Gmail dispatch on issuance
  useEffect(() => {
    if (!isOpen || !invoice) {
      setWaSent(false);
      setGmailSent(false);
      return;
    }

    if (autoDispatch) {
      if (whatsAppUrl) {
        window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
        setWaSent(true);
      }
      if (gmailUrl) {
        const timer = setTimeout(() => {
          window.open(gmailUrl, '_blank', 'noopener,noreferrer');
          setGmailSent(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, invoice?.id, autoDispatch, whatsAppUrl, gmailUrl]);

  if (!isOpen || !invoice) return null;

  const businessHasPhone = Boolean(
    invoice.businessPhoneSnapshot || business?.phone
  );
  const businessHasEmail = Boolean(
    invoice.businessEmailSnapshot || business?.email
  );

  const handleSendWhatsApp = () => {
    if (openWhatsAppDispatch(invoice, customer, business)) {
      setWaSent(true);
    }
  };

  const handleSendGmail = () => {
    if (openGmailDispatch(invoice, customer, business)) {
      setGmailSent(true);
    }
  };

  const handleSendBoth = () => {
    if (whatsAppUrl) {
      window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
      setWaSent(true);
    }
    if (gmailUrl) {
      setTimeout(() => {
        window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        setGmailSent(true);
      }, 350);
    }
  };

  const custName =
    invoice.customerNameSnapshot ||
    invoice.customerName ||
    customer?.name ||
    'Customer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-navy-950/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-popover border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-purple-700 via-purple-800 to-indigo-900 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center flex-shrink-0 text-white">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-200">
                Invoice Officially Issued
              </div>
              <h2 className="text-base font-bold text-white leading-tight">
                Direct Dispatch to Customer
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Invoice Summary Pill */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">
                Invoice Number
              </div>
              <div className="font-mono font-bold text-slate-800 text-sm">
                {invoice.invoiceNumber}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                <span>{custName}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">
                Grand Total
              </div>
              <div className="font-extrabold text-purple-700 text-base">
                {formatINR(Number(invoice.grandTotal))}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 justify-end">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Due: {invoice.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Dispatch Cards */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Send Directly via Channels:
            </div>

            {/* 1. WhatsApp Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                customerPhone10
                  ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50'
                  : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>WhatsApp Dispatch</span>
                      {waSent && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold inline-flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Sent
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                      {customerPhone10 ? (
                        <span>+91 {customerPhone10}</span>
                      ) : (
                        <span className="text-rose-500 text-[10px]">
                          No 10-digit phone on customer profile
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {customerPhone10 ? (
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-xs flex items-center gap-1.5 transition-all flex-shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send on WhatsApp</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Unavailable
                  </span>
                )}
              </div>
            </div>

            {/* 2. Gmail Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                customerEmail
                  ? 'border-rose-200 bg-rose-50/40 hover:bg-rose-50/70'
                  : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Gmail / Email Dispatch</span>
                      {gmailSent && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-semibold inline-flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Sent
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5 truncate max-w-[210px] sm:max-w-[240px]">
                      {customerEmail ? (
                        <span>{customerEmail}</span>
                      ) : (
                        <span className="text-rose-500 text-[10px]">
                          No email address on customer profile
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {customerEmail ? (
                  <button
                    type="button"
                    onClick={handleSendGmail}
                    className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-xs flex items-center gap-1.5 transition-all flex-shrink-0"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Send via Gmail</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Unavailable
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Dual Dispatch Button */}
          {customerPhone10 && customerEmail && (
            <button
              type="button"
              onClick={handleSendBoth}
              className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <Send className="w-4 h-4" />
              <span>Instant Dispatch to Both (WhatsApp & Gmail)</span>
            </button>
          )}

          {/* Company Settings Warning if company phone or email is missing */}
          {(!businessHasPhone || !businessHasEmail) && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Company Profile Incomplete: </span>
                Ensure your company WhatsApp and Gmail are filled in{' '}
                <strong>Settings</strong> so customers have your contact details.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
