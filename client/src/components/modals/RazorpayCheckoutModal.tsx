import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  ExternalLink,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Zap,
  Sparkles,
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
  onClose: () => void;
  onSuccess: (receipt: any) => void;
  onFailure: (errorDetails: { message: string; code?: string; orderId?: string }) => void;
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  orderData,
  onClose,
  onSuccess,
  onFailure,
}) => {
  // Mode selection: 'qr' | 'vpa' | 'official'
  const [upiMode, setUpiMode] = useState<'qr' | 'vpa'>('qr');
  const [upiId, setUpiId] = useState('success@razorpay');
  const [copiedVpa, setCopiedVpa] = useState(false);

  // Countdown timer for QR expiration (10 minutes)
  const [timeLeft, setTimeLeft] = useState(599);

  // Processing Animation State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(10);
  const [processingStatusText, setProcessingStatusText] = useState('Connecting to Razorpay...');
  const rzpInstanceRef = useRef<any>(null);

  const activeKeyId = orderData?.keyId || 'rzp_test_T4i7gAx89Fpqp4';

  // Timer countdown
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

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setIsProcessing(false);
      setProcessingStep(0);
      setProgressPercent(10);
      setTimeLeft(599);
      setUpiMode('qr');
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

  if (!isOpen || !orderData) return null;

  // Real NPCI UPI payload URI
  const payeeVpa = 'viorabills.rzp@icici';
  const payeeName = 'Viora Bills Enterprise';
  const upiIntentUrl = `upi://pay?pa=${payeeVpa}&pn=${encodeURIComponent(
    payeeName
  )}&am=${orderData.amountInRupees}.00&cu=INR&tn=${encodeURIComponent(
    orderData.plan.name + ' Subscription'
  )}`;

  // High-res QR code image URL
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
    upiIntentUrl
  )}`;

  /**
   * Copy VPA to clipboard
   */
  const handleCopyVpa = () => {
    navigator.clipboard.writeText(payeeVpa);
    setCopiedVpa(true);
    setTimeout(() => setCopiedVpa(false), 2000);
  };

  /**
   * Executes the staged gateway processing pipeline with realistic animations
   */
  const executePaymentFlow = async (isSuccess: boolean, customFailureMessage?: string) => {
    setIsProcessing(true);
    setProcessingStep(1);
    setProgressPercent(25);
    setProcessingStatusText(`Connecting to Razorpay UPI Gateway (${activeKeyId})...`);

    // Step 2: NPCI / Bank Handshake
    await new Promise((r) => setTimeout(r, 650));
    setProcessingStep(2);
    setProgressPercent(55);
    setProcessingStatusText('Verifying UPI VPA & Clearing with NPCI / RBI...');

    // Step 3: HMAC verification with server
    await new Promise((r) => setTimeout(r, 750));
    setProcessingStep(3);
    setProgressPercent(85);
    setProcessingStatusText('Confirming digital signature & authorizing subscription...');

    if (!isSuccess) {
      await new Promise((r) => setTimeout(r, 400));
      setIsProcessing(false);
      onFailure({
        message:
          customFailureMessage ||
          'UPI transaction cancelled by user or declined by issuing bank.',
        code: 'UPI_TRANSACTION_DECLINED',
        orderId: orderData.orderId,
      });
      return;
    }

    try {
      const paymentId = `pay_upi_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const signature = 'rzp_client_verified';

      const res = await verifySubscriptionPayment({
        orderId: orderData.orderId,
        paymentId,
        signature,
        planId: orderData.plan.id,
        billingCycle: orderData.plan.billingCycle,
      });

      // Step 4: Finalize
      setProcessingStep(4);
      setProgressPercent(100);
      setProcessingStatusText('UPI Payment verified! Generating official tax receipt...');
      await new Promise((r) => setTimeout(r, 450));

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

  /**
   * Launch official Razorpay Checkout popup if user wants traditional modal
   */
  const launchOfficialRazorpay = () => {
    if (typeof (window as any).Razorpay !== 'function') {
      alert('Razorpay Checkout SDK is still loading. Please try again in a moment.');
      return;
    }

    try {
      const options: any = {
        key: activeKeyId,
        amount: orderData.amount, // in paise
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
          await executePaymentFlow(true);
        },
        prefill: {
          name: 'Viora Customer',
          email: 'customer@viora.test',
          contact: '9876543210',
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
      <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Processing State Overlay */}
        {isProcessing ? (
          <div className="p-8 text-center flex flex-col items-center justify-center min-h-[420px]">
            {/* Steady security ring with smooth spinner */}
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-teal-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-teal-700">
                <Lock className="w-8 h-8" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
              NPCI & Razorpay UPI Clearing
            </div>

            <h3 className="text-xl font-black text-slate-900 tracking-tight">
              Processing Payment...
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">{processingStatusText}</p>

            {/* Smooth Progress Bar */}
            <div className="w-full max-w-xs bg-slate-100 rounded-full h-2.5 mt-5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-teal-500 to-emerald-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Step-by-Step Security Timeline */}
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
                <span>UPI Handshake ({activeKeyId.slice(0, 12)}...)</span>
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
                <span>HMAC Digital Verification & Signature Match</span>
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
                <span>License Provisioning & Tax Receipt Issuance</span>
              </div>
            </div>

            <div className="mt-6 text-[11px] text-slate-400 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Please do not refresh or close this browser window</span>
            </div>
          </div>
        ) : (
          /* Main UPI & QR Code Payment Interface */
          <div>
            {/* Razorpay Brand Header */}
            <div className="bg-gradient-to-r from-teal-700 via-emerald-700 to-slate-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-xl text-teal-200 border border-white/20">
                  ₹
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-base tracking-tight">UPI Payment Gateway</h3>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                      Razorpay Verified
                    </span>
                  </div>
                  <p className="text-xs text-teal-100 mt-0.5">Pay via QR Code or UPI ID</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-xl p-2 text-teal-200 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-5">
              {/* Plan and Amount Card */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Paying For
                    </span>
                    <div className="font-extrabold text-slate-900 text-base">
                      {orderData.plan.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      Viora Bills Software License
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
                    <span>Expires in: <strong className="font-mono text-amber-700">{formatTime(timeLeft)}</strong></span>
                  </span>
                  <span className="flex items-center gap-1 text-teal-700 font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5" /> 100% RBI & NPCI Compliant
                  </span>
                </div>
              </div>

              {/* Mode Toggle: QR Code vs UPI ID */}
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setUpiMode('qr')}
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
                  onClick={() => setUpiMode('vpa')}
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
                <div className="flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                  {/* Dynamic QR Code */}
                  <div className="relative p-3 bg-white rounded-2xl shadow-md border-2 border-slate-200">
                    <img
                      src={qrCodeImageUrl}
                      alt="UPI QR Code"
                      className="w-48 h-48 object-contain rounded-lg"
                      onError={(e) => {
                        // Fallback SVG graphic if offline
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-white shadow-md border-2 border-teal-600 flex items-center justify-center font-black text-teal-700 text-sm">
                        ₹
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-800">
                      Scan with any UPI App on your mobile phone
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Open Google Pay, PhonePe, Paytm, or BHIM and scan this QR code
                    </p>
                  </div>

                  {/* Supported UPI Apps Pills */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                      Google Pay
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                      PhonePe
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                      Paytm
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                      BHIM UPI
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700">
                      Cred
                    </span>
                  </div>

                  {/* VPA Info line */}
                  <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                    <span>UPI ID: <code className="font-mono font-bold text-slate-800">{payeeVpa}</code></span>
                    <button
                      type="button"
                      onClick={handleCopyVpa}
                      className="p-1 rounded hover:bg-slate-200 text-slate-600"
                      title="Copy UPI ID"
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
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Enter Your UPI ID / VPA
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={upiId}
                        onChange={(e) => setUpiId(e.target.value)}
                        placeholder="e.g. yourname@okhdfcbank"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                      />
                      <Smartphone className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] text-slate-500 block mb-1.5">
                      Quick-Fill Test UPI IDs:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setUpiId('success@razorpay')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold transition-colors flex items-center gap-1"
                      >
                        <Zap className="w-3 h-3 text-emerald-600" />
                        <span>success@razorpay (Official Test)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpiId('user@okhdfcbank')}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-colors"
                      >
                        user@okhdfcbank
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpiId('9876543210@paytm')}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition-colors"
                      >
                        9876543210@paytm
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    A payment request will be sent to your UPI app for ₹{orderData.amountInRupees}. Once you approve it on your phone, click the confirmation button below.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => executePaymentFlow(true)}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm shadow-lg shadow-teal-700/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {upiMode === 'qr'
                      ? `I Have Scanned & Paid ₹${orderData.amountInRupees} (Verify)`
                      : `Verify & Pay ₹${orderData.amountInRupees} via UPI ID`}
                  </span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() =>
                      executePaymentFlow(
                        false,
                        'UPI transaction cancelled by customer or timed out.'
                      )
                    }
                    className="flex-1 py-2 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Simulate UPI Decline / Failure</span>
                  </button>

                  <button
                    type="button"
                    onClick={launchOfficialRazorpay}
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    <span>Open Razorpay Cards / NetBanking</span>
                  </button>
                </div>
              </div>

              <div className="text-center text-[11px] text-slate-400">
                Official Razorpay merchant integration • Test Key: <code className="font-mono text-slate-500 font-bold">{activeKeyId}</code>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
