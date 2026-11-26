import React, { useState, useEffect } from 'react';
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Loader2,
  ArrowRight,
  AlertCircle,
  Layers,
  FileText,
} from 'lucide-react';
import { SubscriptionPlan, BillingCycle } from '../../types';
import { fetchSubscriptionPlans, createSubscriptionOrder } from '../../services/api';
import { RazorpayCheckoutModal } from '../modals/RazorpayCheckoutModal';

interface PricingViewProps {
  onPaymentSuccess: (receipt: any) => void;
  onPaymentFailed: (details: any) => void;
  onRequireAuth?: () => void;
  isAuthenticated: boolean;
  userEmail?: string;
  userName?: string;
}

const FALLBACK_PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_starter',
    name: 'Starter Plan',
    slug: 'starter',
    description: 'Ideal for freelance professionals and early-stage small businesses in India.',
    monthlyPrice: 499,
    yearlyPrice: 4790,
    invoiceLimit: 100,
    businessLimit: 1,
    features: [
      'Up to 100 GST Invoices / month',
      '1 Business Workspace + Super Admin Product Catalog',
      'Customer Directory & Statements',
      'Generate Admin Access Codes for Billing Staff',
      'Email & WhatsApp Invoice Dispatch',
      'Automatic CGST / SGST / IGST calculation',
    ],
    isActive: true,
  },
  {
    id: 'plan_pro',
    name: 'Professional Plan',
    slug: 'pro',
    description: 'Our most popular plan for expanding SMEs and high-volume billing teams.',
    monthlyPrice: 1499,
    yearlyPrice: 14390,
    invoiceLimit: -1,
    businessLimit: 3,
    features: [
      'Unlimited GST Invoices & Bills',
      'Up to 3 Business Workspaces',
      'Unlimited Admin Desk Access Codes',
      'Automated Recurring Invoices & Credit Notes',
      'Real-Time Super Admin Billing Authorization Controls',
      'Full Customer Activity Ledger Statements',
      'Priority WhatsApp & Email Support',
    ],
    isActive: true,
  },
  {
    id: 'plan_enterprise',
    name: 'Enterprise Plan',
    slug: 'enterprise',
    description: 'Custom multi-entity invoicing and deep platform administration for large enterprises.',
    monthlyPrice: 4999,
    yearlyPrice: 47990,
    invoiceLimit: -1,
    businessLimit: 10,
    features: [
      'Unlimited Invoices across 10 Businesses',
      'Granular Per-Terminal Admin Access Control',
      'Custom Invoice Branding & Watermarks',
      'Complete Audit Log & Security History',
      'High-speed Bulk PDF Generation',
      'REST API & Webhook Access',
      'Dedicated Account Manager & 24/7 Support',
    ],
    isActive: true,
  },
];

export const PricingView: React.FC<PricingViewProps> = ({
  onPaymentSuccess,
  onPaymentFailed,
  onRequireAuth,
  isAuthenticated,
  userEmail,
  userName,
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscriptionPlans()
      .then((data) => {
        const cleanPlans = (data || []).filter(
          (p) => p.slug !== 'test-5' && p.id !== 'plan_test_5' && Number(p.monthlyPrice) > 10
        );
        setPlans(cleanPlans.length > 0 ? cleanPlans : FALLBACK_PLANS);
      })
      .catch(() => {
        setPlans(FALLBACK_PLANS);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!isAuthenticated) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    setErrorBanner(null);
    setSubscribingPlanId(plan.id);
    try {
      const order = await createSubscriptionOrder(plan.id, billingCycle);
      setActiveOrder(order);
    } catch (err: any) {
      setErrorBanner(err.message || 'Could not initiate Razorpay checkout order. Please try again.');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8 space-y-10">
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          Transparent INR Pricing • Instant 12-Digit Key Activation
        </span>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight sm:text-5xl">
          Choose the Perfect Plan for Your Business
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base max-w-2xl mx-auto">
          Subscribe in Indian Rupees via Razorpay UPI QR, UPI ID, Cards, or NetBanking to receive your email-bound{' '}
          <strong className="text-slate-900 dark:text-white">12-Digit Super Admin Access Code</strong>.
        </p>

        {/* Monthly / Annual Billing Toggle */}
        <div className="flex items-center justify-center pt-3">
          <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200 dark:border-slate-700 shadow-inner">
            <button
              type="button"
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                billingCycle === 'MONTHLY'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('YEARLY')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'YEARLY'
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Annual Billing</span>
              <span
                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                  billingCycle === 'YEARLY'
                    ? 'bg-teal-900/70 text-emerald-200'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="max-w-3xl mx-auto p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="underline text-rose-700 hover:text-rose-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pricing Cards Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
          <span className="text-xs text-slate-500">Loading subscription plans...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7 items-stretch pt-2">
          {plans.map((plan) => {
            const isPopular = plan.slug === 'pro';
            const price =
              billingCycle === 'YEARLY'
                ? Number(plan.yearlyPrice)
                : Number(plan.monthlyPrice);
            const annualSavings =
              billingCycle === 'YEARLY'
                ? Math.max(0, Number(plan.monthlyPrice) * 12 - Number(plan.yearlyPrice))
                : 0;
            const periodLabel = billingCycle === 'YEARLY' ? '/ year' : '/ month';

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl bg-white dark:bg-slate-900 border p-7 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${
                  isPopular
                    ? 'border-2 border-teal-600 shadow-xl shadow-teal-700/10 ring-4 ring-teal-500/10'
                    : 'border-slate-200 dark:border-slate-700 shadow-md'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full shadow-md uppercase tracking-wider whitespace-nowrap">
                      <Zap className="w-3.5 h-3.5" /> Most Popular
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</h3>
                    {annualSavings > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold whitespace-nowrap">
                        Save ₹{annualSavings.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 min-h-[36px] leading-relaxed">
                    {plan.description}
                  </p>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{periodLabel}</span>
                  </div>
                  <div className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold mt-1">
                    Inclusive of 18% GST • Full Tax Invoice
                  </div>

                  {/* Quick Capacity Pills */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                      <FileText className="w-3 h-3 text-teal-600" />
                      {plan.invoiceLimit === -1 ? 'Unlimited Invoices' : `${plan.invoiceLimit} Invoices/mo`}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-semibold">
                      <Layers className="w-3 h-3 text-indigo-600" />
                      {plan.businessLimit} {plan.businessLimit === 1 ? 'Workspace' : 'Workspaces'}
                    </span>
                  </div>

                  {/* Feature Checklist */}
                  <div className="mt-6 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                      What's Included
                    </span>
                    <ul className="space-y-2.5">
                      {(plan.features || []).map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300">
                          <div className="h-4 w-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </div>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Checkout CTA */}
                <div className="mt-7 pt-5 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    disabled={subscribingPlanId === plan.id}
                    onClick={() => handleSelectPlan(plan)}
                    className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                      isPopular
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg shadow-teal-700/25'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    } disabled:opacity-50`}
                  >
                    {subscribingPlanId === plan.id ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Preparing Checkout...</span>
                      </>
                    ) : (
                      <>
                        <span>Subscribe with Razorpay</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] text-slate-400 mt-2">
                    Official Razorpay Checkout • UPI QR, Cards & NetBanking
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust & Guarantee Section */}
      <div className="rounded-3xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 p-7 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-sm">Official Razorpay Certified Gateway</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              PCI-DSS compliant Indian payments. Your 12-digit Super Admin Access Code activates immediately after verification.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 flex-shrink-0">
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Support: <strong>+91 98765 43210</strong></span>
        </div>
      </div>

      {/* Official Razorpay Checkout & Processing Overlay */}
      <RazorpayCheckoutModal
        isOpen={!!activeOrder}
        orderData={activeOrder}
        userEmail={userEmail}
        userName={userName}
        onClose={() => setActiveOrder(null)}
        onSuccess={(receipt) => {
          setActiveOrder(null);
          onPaymentSuccess(receipt);
        }}
        onFailure={(errorDetails) => {
          setActiveOrder(null);
          onPaymentFailed(errorDetails);
        }}
      />
    </div>
  );
};
