import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/utils/auth';

async function seedPlansAndRoles() {
  console.log('🚀 Seeding Subscription Plans, Demo Accounts, and 12-Digit Access Codes...');

  // 1. Seed System Settings (Razorpay Gateway config used strictly by Customer Purchase Portal)
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
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, category: s.category, description: s.description },
      create: s,
    });
  }
  console.log('✅ System Settings seeded');

  // 2. Remove legacy ₹5 test plan if present (deactivate if historical subscriptions exist, otherwise delete)
  const legacyTestPlans = await prisma.subscriptionPlan.findMany({
    where: {
      OR: [{ id: 'plan_test_5' }, { slug: 'test-5' }],
    },
    include: {
      _count: { select: { subscriptions: true } },
    },
  });

  for (const legacy of legacyTestPlans) {
    if (legacy._count.subscriptions === 0) {
      await prisma.subscriptionPlan.delete({ where: { id: legacy.id } }).catch(() => {});
    } else {
      await prisma.subscriptionPlan.update({
        where: { id: legacy.id },
        data: { isActive: false },
      });
    }
  }

  // 3. Seed Production Subscription Plans in INR
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
        '1 Business Workspace + Super Admin Product Catalog',
        'Customer Directory & Statements',
        'Generate Admin Access Codes for Billing Staff',
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

  // 3. Seed Demo Customer (Software Buyer -> Super Admin) & Demo Billing Admin
  const customerEmail = 'customer@viora.test';
  const adminEmail = 'admin@viora.test';

  let customerUser = await prisma.user.findUnique({ where: { email: customerEmail } });
  if (!customerUser) {
    customerUser = await prisma.user.create({
      data: {
        email: customerEmail,
        name: 'SaaS Client Customer',
        passwordHash: hashPassword('Customer123!'),
        role: 'CUSTOMER',
      },
    });
  } else {
    customerUser = await prisma.user.update({
      where: { id: customerUser.id },
      data: {
        role: 'CUSTOMER',
        passwordHash: hashPassword('Customer123!'),
      },
    });
  }

  let adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Viora Billing Admin',
        passwordHash: hashPassword('AdminPassword123!'),
        role: 'OWNER',
      },
    });
  } else {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        role: 'OWNER',
        passwordHash: hashPassword('AdminPassword123!'),
      },
    });
  }

  // Legacy global SUPER_ADMIN test account kept intact for any automated unit helpers
  await prisma.user.upsert({
    where: { email: 'superadmin@viora.test' },
    update: { role: 'SUPER_ADMIN', passwordHash: hashPassword('SuperAdmin123!') },
    create: {
      email: 'superadmin@viora.test',
      name: 'Global Super Admin',
      passwordHash: hashPassword('SuperAdmin123!'),
      role: 'SUPER_ADMIN',
    },
  });

  // Ensure default business workspace belongs to customerUser and allows admin billing for demo
  let defaultBiz =
    (await prisma.business.findFirst({ where: { ownerUserId: customerUser.id } })) ||
    (await prisma.business.findFirst());

  if (!defaultBiz) {
    defaultBiz = await prisma.business.create({
      data: {
        name: 'Viora Tech Solutions Pvt Ltd',
        address: '4th Block Koramangala, Bengaluru, Karnataka - 560034',
        phone: '+91 98765 43210',
        email: customerEmail,
        gstin: '29AABCV1234F1Z5',
        state: 'Karnataka',
        invoicePrefix: 'VTS',
        ownerUserId: customerUser.id,
        allowAdminBilling: true,
      },
    });
  } else {
    defaultBiz = await prisma.business.update({
      where: { id: defaultBiz.id },
      data: {
        ownerUserId: customerUser.id,
        allowAdminBilling: true,
      },
    });
  }

  // Link both customerUser (as OWNER/SuperAdmin of workspace) and adminUser (as billing operator)
  for (const u of [customerUser, adminUser]) {
    await prisma.businessMembership.upsert({
      where: { userId_businessId: { userId: u.id, businessId: defaultBiz.id } },
      update: { role: 'OWNER' },
      create: { userId: u.id, businessId: defaultBiz.id, role: 'OWNER' },
    });
  }

  // Ensure active Pro Subscription for customerUser with 12-digit Super Admin Code '123456789012'
  const proPlan = await prisma.subscriptionPlan.findUnique({ where: { slug: 'pro' } });
  if (proPlan) {
    const existingDemoCodeSub = await prisma.subscription.findFirst({
      where: { userId: customerUser.id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (existingDemoCodeSub) {
      // Ensure it has a valid 12-digit code and businessId
      const codeConflict = await prisma.subscription.findFirst({
        where: { superAdminAccessCode: '123456789012', id: { not: existingDemoCodeSub.id } },
      });
      await prisma.subscription.update({
        where: { id: existingDemoCodeSub.id },
        data: {
          businessId: defaultBiz.id,
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
          superAdminAccessCode: existingDemoCodeSub.superAdminAccessCode || (codeConflict ? '123456789099' : '123456789012'),
          superAdminCodeIssuedAt: existingDemoCodeSub.superAdminCodeIssuedAt || new Date(),
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId: customerUser.id,
          planId: proPlan.id,
          businessId: defaultBiz.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          amountPaid: 1499,
          currency: 'INR',
          razorpayOrderId: 'order_demo_initial_pro',
          razorpayPaymentId: 'pay_demo_success_12345',
          razorpaySignature: 'mock_sig_initial_verified',
          superAdminAccessCode: '123456789012',
          superAdminCodeIssuedAt: new Date(),
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
        },
      });
    }
  }

  // Ensure seeded 12-digit Admin Access Code '987654321098' for demo Admin Desk login
  await prisma.adminAccessCode.upsert({
    where: { code: '987654321098' },
    update: {
      businessId: defaultBiz.id,
      assignedEmail: adminEmail,
      isActive: true,
      canGenerateBills: true,
    },
    create: {
      businessId: defaultBiz.id,
      code: '987654321098',
      label: 'Primary Billing Counter',
      assignedEmail: adminEmail,
      role: 'OWNER',
      canGenerateBills: true,
      isActive: true,
      createdByUserId: customerUser.id,
    },
  });

  console.log('✅ Seeded Customer (customer@viora.test) + 12-digit Super Admin Code');
  console.log('✅ Seeded Billing Admin (admin@viora.test) + 12-digit Admin Code: 987654321098');
}

seedPlansAndRoles()
  .catch((e) => {
    console.error('Error seeding plans and roles:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
