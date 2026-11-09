import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
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
  formatHumanDate,
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
}) => {
  const [waOpened, setWaOpened] = useState(false);
  const [gmailOpened, setGmailOpened] = useState(false);

  // B14: Escape key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset status when invoice changes
  useEffect(() => {
    if (!isOpen) {
      setWaOpened(false);
      setGmailOpened(false);
    }
  }, [isOpen, invoice?.id]);

  if (!isOpen || !invoice) return null;

  const { customerPhone10, customerEmail } =
    getInvoiceDispatchUrls(invoice, customer, business);

  const businessHasPhone = Boolean(
    invoice.businessPhoneSnapshot || business?.phone
  );
  const businessHasEmail = Boolean(
    invoice.businessEmailSnapshot || business?.email
  );

  const handleOpenWhatsApp = () => {
    if (openWhatsAppDispatch(invoice, customer, business)) {
      setWaOpened(true);
    }
  };

  const handleOpenGmail = () => {
    if (openGmailDispatch(invoice, customer, business)) {
      setGmailOpened(true);
    }
  };

  const custName =
    invoice.customerNameSnapshot ||
    invoice.customerName ||
    customer?.name ||
    'Customer';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-700 via-purple-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Invoice Issued Successfully
              </h3>
              <p className="text-xs text-purple-200">
                Share prefilled invoice details with customer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Invoice Summary Card */}
          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold text-purple-600">
                Official Invoice
              </div>
              <div className="font-mono font-bold text-slate-800 text-sm">
                #{invoice.invoiceNumber}
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
                {/* B15: Format due date nicely */}
                <span>Due: {formatHumanDate(invoice.dueDate)}</span>
              </div>
            </div>
          </div>

          {/* Dispatch Cards */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Share via Communication Channels:
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
                      <span>WhatsApp Share</span>
                      {waOpened && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold inline-flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Opened in WhatsApp
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                      {customerPhone10 ? (
                        <span>+91 {customerPhone10}</span>
                      ) : (
                        <span className="italic text-slate-400">
                          No 10-digit phone on customer profile
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {customerPhone10 ? (
                  <button
                    onClick={handleOpenWhatsApp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-xs transition-colors flex-shrink-0"
                  >
                    <span>{waOpened ? 'Reopen WhatsApp' : 'Share via WhatsApp'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Phone unavailable
                  </span>
                )}
              </div>
            </div>

            {/* 2. Gmail Card */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                customerEmail
                  ? 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50'
                  : 'border-slate-200 bg-slate-50/50 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>Gmail Compose</span>
                      {gmailOpened && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-semibold inline-flex items-center gap-0.5">
                          <Check className="w-2.5 h-2.5" /> Email Draft Opened
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600 mt-0.5 truncate max-w-[200px]">
                      {customerEmail ? (
                        <span>{customerEmail}</span>
                      ) : (
                        <span className="italic text-slate-400">
                          No email address on customer profile
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {customerEmail ? (
                  <button
                    onClick={handleOpenGmail}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs transition-colors flex-shrink-0"
                  >
                    <span>{gmailOpened ? 'Reopen Gmail' : 'Compose in Gmail'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-medium">
                    Email unavailable
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Mandatory verification notices */}
          {(!businessHasPhone || !businessHasEmail) && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Company profile warning:</span> Configure
                your company WhatsApp and Gmail in Settings so customers know how to
                contact you.
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">
            Clicking opens prefilled message in WhatsApp or Gmail.
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-white hover:border-slate-400 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
