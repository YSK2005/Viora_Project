import React, { useState, useEffect } from 'react';
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  Loader2,
  QrCode,
  ArrowRight,
} from 'lucide-react';
import { SubscriptionPlan, BillingCycle } from '../../types';
import { fetchSubscriptionPlans, createSubscriptionOrder } from '../../services/api';
import { RazorpayCheckoutModal } from '../modals/RazorpayCheckoutModal';

interface PricingViewProps {
  onPaymentSuccess: (receipt: any) => void;
  onPaymentFailed: (details: any) => void;
  onRequireAuth?: () => void;
  isAuthenticated: boolean;
}

export const PricingView: React.FC<PricingViewProps> = ({
  onPaymentSuccess,
  onPaymentFailed,
  onRequireAuth,
  isAuthenticated,
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('MONTHLY');
  const [loading, setLoading] = useState(true);
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<any | null>(null);

  useEffect(() => {
    fetchSubscriptionPlans()
      .then((data) => {
        if (data && data.length > 0) {
          setPlans(data);
        } else {
          // Fallback static plans in INR
          setPlans([
            {
              id: 'plan_test_5',
              name: 'Razorpay Test Plan',
              slug: 'test-5',
              description: 'Instant ₹5 gateway test for Razorpay live checkout testing.',
              monthlyPrice: 5,
              yearlyPrice: 50,
              invoiceLimit: 5,
              businessLimit: 1,
              features: [
                '₹5 Live Gateway Transaction Test',
                'Official Razorpay Checkout Popup',
                'Full Payment Processing Animation',
                'Instant License Activation & Tax Receipt',
              ],
              isActive: true,
            },
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
                '1 Business Workspace',
                'Customer Directory & Statements',
                'Professional PDF Invoice Templates',
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
                'Automated Recurring Invoices',
                'Credit Notes & Balance Reversals',
                'Multi-user Roles (Owner & Accountant)',
                'Full Customer Activity Ledger Statements',
                'Bulk Draft Actions & CSV Exports',
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
                'Super Admin System Control Access',
                'Custom Invoice Branding & Watermarks',
                'Complete Audit Log & Security History',
                'High-speed Bulk PDF Generation',
                'REST API & Webhook Access',
                'Dedicated Account Manager & 24/7 Support',
              ],
              isActive: true,
            },
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSelectPlan = async (plan: SubscriptionPlan) => {
    if (!isAuthenticated) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    setSubscribingPlanId(plan.id);
    try {
      const order = await createSubscriptionOrder(plan.id, billingCycle);
      setActiveOrder(order);
    } catch (err: any) {
      alert(`Could not initiate order: ${err.message}`);
    } finally {
      setSubscribingPlanId(null);
    }
  };

  /**
   * Dedicated ₹5 Quick Test Payment
   */
  const handlePayTest5Rupees = async () => {
    if (!isAuthenticated) {
      if (onRequireAuth) onRequireAuth();
      return;
    }

    // Find the ₹5 test plan or use plan_test_5
    const testPlan = plans.find((p) => p.slug === 'test-5' || p.monthlyPrice === 5) || {
      id: 'plan_test_5',
      name: 'Razorpay Test Plan',
    };

    setSubscribingPlanId('plan_test_5');
    try {
      const order = await createSubscriptionOrder(testPlan.id, 'MONTHLY');
      setActiveOrder(order);
    } catch (err: any) {
      alert(`Could not initiate ₹5 test order: ${err.message}`);
    } finally {
      setSubscribingPlanId(null);
    }
  };

  // Filter out the ₹5 test plan from standard SaaS grid so it sits prominently in its own Hero Test Banner
  const regularPlans = plans.filter((p) => p.slug !== 'test-5' && p.monthlyPrice !== 5);

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-12">
      {/* Header Banner */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          Transparent INR Pricing
        </span>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight sm:text-5xl">
          Choose the Perfect Plan for Your Billing Needs
        </h1>
        <p className="text-slate-600 text-base sm:text-lg">
          Simple, predictable subscription plans in Indian Rupees with official Razorpay checkout. No simulations.
        </p>

        {/* Monthly / Annual Billing Toggle */}
        <div className="flex items-center justify-center pt-4">
          <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setBillingCycle('MONTHLY')}
              className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                billingCycle === 'MONTHLY'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
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
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Annual Billing</span>
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  billingCycle === 'YEARLY'
                    ? 'bg-teal-900/60 text-teal-200'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Prominent ₹5 Live Razorpay Gateway Test Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-700 to-slate-900 text-white p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6 border border-emerald-400/30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 flex-shrink-0">
            <Zap className="w-7 h-7 text-yellow-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-yellow-400 text-slate-950">
                Official Razorpay Test
              </span>
              <span className="text-xs text-emerald-200 font-mono">
                Key: rzp_test_T4i7gAx89Fpqp4
              </span>
            </div>
            <h3 className="text-xl font-black tracking-tight mt-1">
              Pay ₹5 by UPI QR Code or UPI ID
            </h3>
            <p className="text-xs text-emerald-100 mt-0.5 max-w-xl">
              Scan dynamic UPI QR Code with Google Pay, PhonePe, Paytm, BHIM, or enter your UPI ID. Instant verification & license activation.
            </p>

            {/* Test Credentials Helper */}
            <div className="mt-3 pt-3 border-t border-emerald-500/30 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="text-[10px] text-emerald-200 block uppercase font-bold">💳 Test Card (Success)</span>
                <code className="font-mono font-bold text-white tracking-wider">4111 1111 1111 1111</code>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="text-[10px] text-emerald-200 block uppercase font-bold">📅 Expiry / CVV</span>
                <span className="font-mono font-bold text-white">12/28 • 123</span>
              </div>
              <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                <span className="text-[10px] text-emerald-200 block uppercase font-bold">📱 Test UPI / OTP</span>
                <span className="font-mono font-bold text-white">success@razorpay • 123456</span>
              </div>
            </div>
            <p className="text-[11px] text-yellow-200/90 mt-2 font-medium">
              💡 Tip: Real personal bank cards will show as "inoperative" in test mode. Use the official test card above to simulate a 100% successful transaction.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={subscribingPlanId === 'plan_test_5'}
          onClick={handlePayTest5Rupees}
          className="w-full md:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-emerald-50 text-emerald-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 transition-all transform hover:scale-105 flex-shrink-0 disabled:opacity-50"
        >
          {subscribingPlanId === 'plan_test_5' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              <span>Launching Razorpay...</span>
            </>
          ) : (
            <>
              <QrCode className="w-4 h-4 text-emerald-700" />
              <span>⚡ Pay ₹5 via UPI QR Code</span>
              <ArrowRight className="w-4 h-4 text-emerald-700" />
            </>
          )}
        </button>
      </div>

      {/* Pricing Cards Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {regularPlans.map((plan) => {
            const isPopular = plan.slug === 'pro';
            const price =
              billingCycle === 'YEARLY'
                ? Number(plan.yearlyPrice)
                : Number(plan.monthlyPrice);
            const periodLabel = billingCycle === 'YEARLY' ? '/ year' : '/ month';

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl bg-white border p-8 flex flex-col justify-between transition-all duration-200 hover:shadow-2xl ${
                  isPopular
                    ? 'border-2 border-teal-600 shadow-xl shadow-teal-700/10 ring-4 ring-teal-500/10'
                    : 'border-slate-200 shadow-md'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-xs font-black px-4 py-1.5 rounded-full shadow-md uppercase tracking-wider">
                      <Zap className="w-3.5 h-3.5" /> Most Popular
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 min-h-[36px]">{plan.description}</p>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight text-slate-900">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{periodLabel}</span>
                  </div>
                  <div className="text-[11px] text-teal-700 font-medium mt-1">Inclusive of GST</div>

                  {/* Feature Checklist */}
                  <div className="mt-8 space-y-3.5 border-t border-slate-100 pt-6">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      What's Included:
                    </span>
                    <ul className="space-y-3">
                      {(plan.features || []).map((feature, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
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
                <div className="mt-8 pt-6 border-t border-slate-100">
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
                        <span>Launching Razorpay...</span>
                      </>
                    ) : (
                      <>
                        <span>Subscribe with Razorpay</span>
                      </>
                    )}
                  </button>
                  <p className="text-center text-[10px] text-slate-400 mt-2">
                    Official Razorpay Checkout • UPI, Cards & NetBanking
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust & Guarantee Section */}
      <div className="rounded-3xl bg-slate-50 border border-slate-200/80 p-8 max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm">Official Razorpay Certified Gateway</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              100% PCI-DSS compliant Indian payments. Cancel or switch plans at any time from your Customer Portal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Questions? Call <strong>+91 98765 43210</strong></span>
        </div>
      </div>

      {/* Official Razorpay Checkout & Processing Overlay */}
      <RazorpayCheckoutModal
        isOpen={!!activeOrder}
        orderData={activeOrder}
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
