import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/auth';

async function seedPlansAndRoles() {
  console.log('🚀 Seeding Subscription Plans, Roles, and System Settings...');

  // 1. Seed System Settings
  const defaultSettings = [
    {
      key: 'PLATFORM_NAME',
      value: 'Viora Bills Enterprise Cloud',
      category: 'GENERAL',
      description: 'Public platform branding name',
    },
    {
      key: 'SUPPORT_EMAIL',
      value: 'support@viorabills.com',
      category: 'GENERAL',
      description: 'Support contact email displayed to customers',
    },
    {
      key: 'SUPPORT_PHONE',
      value: '+91 98765 43210',
      category: 'GENERAL',
      description: 'Helpline contact number',
    },
    {
      key: 'RAZORPAY_KEY_ID',
      value: 'rzp_test_T4i7gAx89Fpqp4',
      category: 'PAYMENT',
      description: 'Razorpay API Key ID (Sandbox / Live)',
    },
    {
      key: 'RAZORPAY_KEY_SECRET',
      value: 'viora_secret_fallback_key_2026',
      category: 'PAYMENT',
      description: 'Razorpay Key Secret used for HMAC SHA256 verification',
    },
    {
      key: 'RAZORPAY_MODE',
      value: 'TEST',
      category: 'PAYMENT',
      description: 'Gateway environment mode: TEST or LIVE',
    },
    {
      key: 'DEFAULT_GST_RATE',
      value: '18',
      category: 'BILLING',
      description: 'Default GST tax rate percentage',
    },
    {
      key: 'MAINTENANCE_MODE',
      value: 'OFF',
      category: 'SECURITY',
      description: 'Toggle platform maintenance banner',
    },
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, category: s.category, description: s.description },
      create: s,
    });
  }
  console.log('✅ System Settings seeded');

  // 2. Seed Subscription Plans in INR
  const plans = [
    {
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
      name: 'Professional Plan',
      slug: 'pro',
      description: 'Our most popular plan for expanding SMEs and high-volume billing teams.',
      monthlyPrice: 1499,
      yearlyPrice: 14390,
      invoiceLimit: -1, // Unlimited
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
  ];

  for (const p of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        monthlyPrice: p.monthlyPrice,
        yearlyPrice: p.yearlyPrice,
        invoiceLimit: p.invoiceLimit,
        businessLimit: p.businessLimit,
        features: p.features,
        isActive: p.isActive,
      },
      create: p,
    });
  }
  console.log('✅ Subscription Plans seeded in INR');

  // 3. Seed Super Admin, Admin, and Customer Accounts
  const seededAccounts = [
    {
      email: 'superadmin@viora.test',
      name: 'Global Super Admin',
      password: 'SuperAdmin123!',
      role: 'SUPER_ADMIN' as const,
    },
    {
      email: 'admin@viora.test',
      name: 'Viora Billing Admin',
      password: 'AdminPassword123!',
      role: 'OWNER' as const,
    },
    {
      email: 'customer@viora.test',
      name: 'SaaS Client Customer',
      password: 'Customer123!',
      role: 'CUSTOMER' as const,
    },
  ];

  const defaultBiz = await prisma.business.findFirst();

  for (const acc of seededAccounts) {
    let user = await prisma.user.findUnique({ where: { email: acc.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: acc.email,
          name: acc.name,
          passwordHash: hashPassword(acc.password),
          role: acc.role,
        },
      });
      console.log(`✅ Created user: ${acc.email} (${acc.role})`);
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: acc.role,
          passwordHash: hashPassword(acc.password),
        },
      });
      console.log(`🔄 Updated user: ${acc.email} with role ${acc.role}`);
    }

    if (defaultBiz && acc.role !== 'CUSTOMER') {
      const membership = await prisma.businessMembership.findUnique({
        where: {
          userId_businessId: {
            userId: user.id,
            businessId: defaultBiz.id,
          },
        },
      });
      if (!membership) {
        await prisma.businessMembership.create({
          data: {
            userId: user.id,
            businessId: defaultBiz.id,
            role: 'OWNER',
          },
        });
      }
    }

    // Give customer account an active Pro subscription in demo
    if (acc.role === 'CUSTOMER') {
      const proPlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'pro' } });
      if (proPlan) {
        const existingSub = await prisma.subscription.findFirst({
          where: { userId: user.id, status: 'ACTIVE' },
        });
        if (!existingSub) {
          await prisma.subscription.create({
            data: {
              userId: user.id,
              planId: proPlan.id,
              status: 'ACTIVE',
              billingCycle: 'MONTHLY',
              amountPaid: 1499,
              currency: 'INR',
              razorpayOrderId: 'order_demo_initial_pro',
              razorpayPaymentId: 'pay_demo_success_12345',
              razorpaySignature: 'mock_sig_initial_verified',
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
            },
          });
          console.log(`✅ Provisioned initial active Pro subscription for ${acc.email}`);
        }
      }
    }
  }

  console.log('🎉 Super Admin, Admin, and Customer accounts successfully initialized!');
}

seedPlansAndRoles()
  .catch((e) => {
    console.error('Error seeding plans and roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
