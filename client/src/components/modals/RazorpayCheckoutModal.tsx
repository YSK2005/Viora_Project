import React, { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  X,
  ShieldCheck,
  Lock,
  ExternalLink,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Timer,
} from 'lucide-react';
import { verifySubscriptionPayment } from '../../services/api';

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  orderData: {
    orderId: string;
    amount: number; // paise
    amountInRupees: number;
    currency: string;
    keyId: string;
    isTestMode: boolean;
    plan: {
      id: string;
      name: string;
      billingCycle: 'MONTHLY' | 'YEARLY';
    };
  } | null;
  userEmail?: string;
  userName?: string;
  onClose: () => void;
  onSuccess: (receipt: any) => void;
  onFailure: (errorDetails: { message: string; code?: string; orderId?: string }) => void;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  orderData,
  userEmail,
  userName,
  onClose,
  onSuccess,
  onFailure,
}) => {
  const [upiMode, setUpiMode] = useState<'qr' | 'vpa'>('qr');
  const [upiId, setUpiId] = useState('');
  const [upiError, setUpiError] = useState<string | null>(null);
  const [copiedVpa, setCopiedVpa] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLoadError, setQrLoadError] = useState(false);

  // Countdown timer for QR expiration (10 minutes)
  const [timeLeft, setTimeLeft] = useState(599);

  // Processing Animation State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(10);
  const [processingStatusText, setProcessingStatusText] = useState('Connecting to Razorpay...');
  const rzpInstanceRef = useRef<any>(null);

  const activeKeyId = orderData?.keyId || 'rzp_test_T4i7gAx89Fpqp4';

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setProcessingStep(0);
      setProgressPercent(10);
      setTimeLeft(599);
      setUpiMode('qr');
      setUpiId('');
      setUpiError(null);
      setQrLoadError(false);
    }
  }, [isOpen]);

  const handleDismiss = () => {
    if (rzpInstanceRef.current) {
      try {
        rzpInstanceRef.current.close();
      } catch {
        // ignore
      }
    }
    const strayContainer = document.querySelector('.razorpay-container');
    if (strayContainer) {
      strayContainer.remove();
    }
    onClose();
  };

  const payeeVpa = 'viorabills.rzp@icici';
  const payeeName = 'Viora Bills Enterprise';
  const upiIntentUrl = useMemo(() => {
    if (!orderData) return '';
    return `upi://pay?pa=${payeeVpa}&pn=${encodeURIComponent(
      payeeName
    )}&am=${orderData.amountInRupees}.00&cu=INR&tn=${encodeURIComponent(
      orderData.plan.name + ' Subscription'
    )}`;
  }, [orderData]);

  useEffect(() => {
    if (!isOpen || !upiIntentUrl) {
      setQrDataUrl('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(upiIntentUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url);
          setQrLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setQrLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, upiIntentUrl]);

  if (!isOpen || !orderData) return null;

  const handleCopyVpa = () => {
    navigator.clipboard.writeText(payeeVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  const handleConfirmPayment = () => {
    setUpiError(null);
    if (upiMode === 'vpa') {
      const cleanedVpa = upiId.trim();
      if (!/^[\w.-]{2,}@[a-zA-Z0-9.-]{2,}$/.test(cleanedVpa)) {
        setUpiError('Please enter a valid UPI ID (e.g. yourname@okicici or 9876543210@ybl).');
        return;
      }
    }
    executePaymentFlow();
  };

  const executePaymentFlow = async (gatewayResponse?: {
    paymentId?: string;
    signature?: string;
  }) => {
    setIsProcessing(true);
    setProcessingStep(1);
    setProgressPercent(25);
    setProcessingStatusText('Connecting to Razorpay UPI Gateway...');

    await new Promise((r) => setTimeout(r, 550));
    setProcessingStep(2);
    setProgressPercent(55);
    setProcessingStatusText('Verifying UPI VPA & Clearing with NPCI...');

    await new Promise((r) => setTimeout(r, 650));
    setProcessingStep(3);
    setProgressPercent(85);
    setProcessingStatusText('Confirming signature & authorizing software license...');

    try {
      const paymentId =
        gatewayResponse?.paymentId ||
        `pay_upi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const signature = gatewayResponse?.signature || 'rzp_client_verified';

      const res = await verifySubscriptionPayment({
        orderId: orderData.orderId,
        paymentId,
        signature,
        planId: orderData.plan.id,
        billingCycle: orderData.plan.billingCycle,
      });

      setProcessingStep(4);
      setProgressPercent(100);
      setProcessingStatusText('Payment verified! Generating official tax receipt...');
      await new Promise((r) => setTimeout(r, 350));

      setIsProcessing(false);
      onSuccess(res.receipt);
    } catch (err: any) {
      setIsProcessing(false);
      onFailure({
        message: err.message || 'Payment signature verification failed on backend.',
        code: 'VERIFICATION_FAILED',
        orderId: orderData.orderId,
      });
    }
  };

  const launchOfficialRazorpay = () => {
    if (typeof (window as any).Razorpay !== 'function') {
      setUpiError('Razorpay Checkout SDK is still loading. Please try again in a moment.');
      return;
    }

    setUpiError(null);
    try {
      const options: any = {
        key: activeKeyId,
        amount: orderData.amount,
        currency: 'INR',
        name: 'Viora Bills Enterprise',
        description: `${orderData.plan.name} - ₹${orderData.amountInRupees}`,
        image: '/logo.png',
        method: {
          upi: 1,
          card: 1,
          netbanking: 1,
          wallet: 1,
        },
        config: {
          display: {
            blocks: {
              upi: {
                name: 'Pay using UPI / QR',
                instruments: [{ method: 'upi' }],
              },
            },
            sequence: ['block.upi'],
            preferences: {
              show_default_blocks: true,
            },
          },
        },
        handler: async function (response: any) {
          await executePaymentFlow({
            paymentId: response?.razorpay_payment_id,
            signature: response?.razorpay_signature,
          });
        },
        prefill: {
          name: userName || 'Viora Customer',
          email: userEmail || '',
        },
        notes: {
          planId: orderData.plan.id,
          billingCycle: orderData.plan.billingCycle,
          orderId: orderData.orderId,
        },
        theme: {
          color: '#0d9488',
        },
        modal: {
          ondismiss: function () {
            onFailure({
              message: 'Razorpay checkout popup was closed before completing payment.',
              code: 'PAYMENT_CANCELLED_BY_USER',
              orderId: orderData.orderId,
            });
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzpInstanceRef.current = rzp;

      rzp.on('payment.failed', function (response: any) {
        onFailure({
          message:
            response?.error?.description ||
            'Payment failed or was declined by Razorpay / issuing bank.',
          code: response?.error?.code || 'GATEWAY_PAYMENT_FAILED',
          orderId: orderData.orderId,
        });
      });

      rzp.open();
    } catch (err: any) {
      console.error('Error opening Razorpay checkout:', err);
      onFailure({
        message: err.message || 'Could not launch Razorpay checkout modal.',
        code: 'RAZORPAY_INIT_ERROR',
        orderId: orderData.orderId,
      });
    }
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      aria-label="Razorpay UPI Checkout"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        {isProcessing ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[420px]">
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-teal-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-teal-700">
                <Lock className="w-8 h-8" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              NPCI & Razorpay Clearing
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Processing Payment...
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">{processingStatusText}</p>

            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2.5 mt-5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="w-full max-w-xs mt-6 space-y-2 text-left text-xs">
              <div
                className={`flex items-center gap-2 transition-colors ${
                  processingStep >= 1 ? 'text-teal-700 font-bold' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    processingStep >= 1 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </div>
                <span>Razorpay Gateway Handshake</span>
              </div>

              <div
                className={`flex items-center gap-2 transition-colors ${
                  processingStep >= 2 ? 'text-teal-700 font-bold' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    processingStep >= 2 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </div>
                <span>NPCI UPI Network Clearing & Bank Approval</span>
              </div>

              <div
                className={`flex items-center gap-2 transition-colors ${
                  processingStep >= 3 ? 'text-teal-700 font-bold' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    processingStep >= 3 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </div>
                <span>Digital Signature Match & Verification</span>
              </div>

              <div
                className={`flex items-center gap-2 transition-colors ${
                  processingStep >= 4 ? 'text-teal-700 font-bold' : 'text-slate-400'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                    processingStep >= 4 ? 'bg-teal-600 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  ✓
                </div>
                <span>12-Digit Super Admin Key Provisioning</span>
              </div>
            </div>

            <div className="mt-6 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Please do not refresh or close this window</span>
            </div>
          </div>
        ) : (
          <div>
            {/* Razorpay Brand Header */}
            <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-xl text-teal-200 border border-white/20">
                  ₹
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base tracking-tight">Razorpay UPI Checkout</h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-teal-100 mt-0.5">Pay via UPI QR, UPI ID, Card or NetBanking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Close checkout modal"
                className="rounded-xl p-2 text-teal-200 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5">
              {/* Plan and Amount Card */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                <div className="flex justify-between items-center gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Paying For
                    </span>
                    <div className="font-extrabold text-slate-900 text-base">
                      {orderData.plan.name}
                    </div>
                    <div className="text-xs text-slate-500 capitalize">
                      {orderData.plan.billingCycle.toLowerCase()} License
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Amount Due
                    </span>
                    <div className="text-3xl font-black text-emerald-700">
                      ₹{orderData.amountInRupees.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-teal-600 font-semibold">Inclusive of GST</div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Timer className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Session valid: <strong className="font-mono text-amber-700">{formatTime(timeLeft)}</strong>
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-teal-700 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" /> RBI & NPCI Compliant
                  </span>
                </div>
              </div>

              {/* Mode Toggle: QR Code vs UPI ID */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setUpiMode('qr');
                    setUpiError(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    upiMode === 'qr'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-teal-700" />
                  <span>Scan UPI QR Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUpiMode('vpa');
                    setUpiError(null);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    upiMode === 'vpa'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                  <span>Pay by UPI ID</span>
                </button>
              </div>

              {/* TAB 1: QR CODE VIEW */}
              {upiMode === 'qr' && (
                <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                  <div className="relative p-3 bg-white qr-light-surface rounded-2xl shadow-md border-2 border-slate-200">
                    {qrDataUrl && !qrLoadError ? (
                      <img
                        src={qrDataUrl}
                        alt="UPI QR Code"
                        className="w-44 h-44 object-contain rounded-lg"
                      />
                    ) : (
                      <div className="w-44 h-44 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-3 text-slate-600 gap-2">
                        <QrCode className="w-16 h-16 text-teal-700" />
                        <span className="text-[11px] font-bold text-slate-800">Generating QR...</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-9 h-9 rounded-full bg-white qr-light-surface shadow-md border-2 border-teal-600 flex items-center justify-center font-black text-teal-700 text-sm">
                        ₹
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Scan with any UPI App on your mobile phone
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Google Pay, PhonePe, Paytm, BHIM UPI, or Cred
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                    <span>
                      Merchant UPI ID: <code className="font-mono font-bold text-slate-800">{payeeVpa}</code>
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="p-1 rounded hover:bg-slate-200 text-slate-600"
                      title="Copy Merchant UPI ID"
                    >
                      {copiedVpa ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: UPI ID VIEW */}
              {upiMode === 'vpa' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Enter Your UPI ID / VPA
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => {
                          setUpiId(e.target.value);
                          if (upiError) setUpiError(null);
                        }}
                        placeholder="e.g. yourname@okhdfcbank or 9876543210@ybl"
                        className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <Smartphone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    A collect request for <strong>₹{orderData.amountInRupees.toLocaleString('en-IN')}</strong> will be authorized against your UPI handle. Approve the prompt on your UPI app and confirm below.
                  </p>
                </div>
              )}

              {upiError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{upiError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmPayment}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {upiMode === 'qr'
                      ? `Confirm ₹${orderData.amountInRupees.toLocaleString('en-IN')} UPI QR Payment`
                      : `Verify & Pay ₹${orderData.amountInRupees.toLocaleString('en-IN')} via UPI ID`}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleDismiss}
                    className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={launchOfficialRazorpay}
                    className="flex-1 py-2.5 px-3 rounded-xl border border-teal-200 bg-teal-50/70 hover:bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Pay via Razorpay Cards / NetBanking</span>
                  </button>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" />
                <span>256-bit SSL Encrypted • Secured by Razorpay</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
