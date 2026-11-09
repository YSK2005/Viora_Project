import { prisma } from '../src/config/prisma';
import { calculateInvoiceTotals, toDecimal } from '../src/utils/money';

async function main() {
  console.log('🌱 Seeding database with consistent, validated demo data...');

  // 1. Business Profile (Bangalore, Karnataka)
  let business = await prisma.business.findFirst();
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: 'Viora Tech Solutions Pvt Ltd',
        logoUrl: '/logo.png',
        address: '102 Innovation Hub, Outer Ring Road, Bellandur, Bengaluru, Karnataka - 560103',
        phone: '9876543210',
        email: 'billing@vioratech.com',
        gstin: '29ABCDE1234F1Z5',
        state: 'Karnataka',
        invoicePrefix: 'INV',
        nextInvoiceNumber: 3,
      },
    });
  } else {
    // Ensure company phone & email are valid 10-digit / email for invoice dispatch
    business = await prisma.business.update({
      where: { id: business.id },
      data: {
        phone: '9876543210',
        email: 'billing@vioratech.com',
        state: 'Karnataka',
      },
    });
  }

  // 2. Customers with consistent states, GSTINs, and 10-digit phones
  const customerCount = await prisma.customer.count({ where: { businessId: business.id } });
  let customer1, customer2, customer3;

  if (customerCount === 0) {
    // Intra-State Client (Karnataka)
    customer1 = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'InfyTech Global Systems',
        phone: '9845012345',
        email: 'accounts@infytech.in',
        billingAddress: '42 Electronics City, Phase 1, Hosur Road, Bengaluru, Karnataka - 560100',
        gstin: '29AAACI1234B1Z3',
        state: 'Karnataka',
      },
    });

    // Inter-State Client 1 (Maharashtra)
    customer2 = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'NexGen Digital Solutions LLP',
        phone: '9822233344',
        email: 'finance@nexgendigital.com',
        billingAddress: '15 High Tech Park, Hinjewadi Phase 1, Pune, Maharashtra - 411057',
        gstin: '27AABCN5678B1Z2',
        state: 'Maharashtra',
      },
    });

    // Inter-State Client 2 (Haryana)
    customer3 = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Apex Cloud Logistics Pvt Ltd',
        phone: '9811122233',
        email: 'billing@apexcloud.in',
        billingAddress: '88 Cyber City, DLF Phase 2, Gurugram, Haryana - 122002',
        gstin: '06AAACA9012C1Z8',
        state: 'Haryana',
      },
    });
  } else {
    const list = await prisma.customer.findMany({ where: { businessId: business.id } });
    customer1 = list[0];
    customer2 = list[1] || list[0];
    customer3 = list[2] || list[0];
  }

  // 3. Products
  const productCount = await prisma.product.count({ where: { businessId: business.id } });
  let prod1, prod2, prod3;

  if (productCount === 0) {
    prod1 = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Enterprise Cloud Invoicing Suite',
        description: 'Multi-tenant cloud billing and GST compliance software subscription',
        unit: 'MONTH',
        unitPrice: toDecimal(45000),
        taxRate: toDecimal(18),
        isActive: true,
      },
    });

    prod2 = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Cloud Infrastructure Architecture & Setup',
        description: 'Dedicated infrastructure engineering and database high-availability deployment',
        unit: 'HRS',
        unitPrice: toDecimal(2500),
        taxRate: toDecimal(18),
        isActive: true,
      },
    });

    prod3 = await prisma.product.create({
      data: {
        businessId: business.id,
        name: 'Annual Software Support & Regulatory SLA',
        description: '24/7 priority SLA support and statutory GST compliance updates',
        unit: 'YR',
        unitPrice: toDecimal(60000),
        taxRate: toDecimal(18),
        isActive: true,
      },
    });
  } else {
    const list = await prisma.product.findMany({ where: { businessId: business.id } });
    prod1 = list[0];
    prod2 = list[1] || list[0];
    prod3 = list[2] || list[0];
  }

  // 4. Initial Invoices
  const invoiceCount = await prisma.invoice.count({ where: { businessId: business.id } });

  if (invoiceCount === 0 && customer1 && prod1) {
    const currentYear = new Date().getFullYear();

    // 1. Issued Intra-State Invoice (Karnataka -> Karnataka: CGST 9% + SGST 9%)
    const calc1 = calculateInvoiceTotals(
      [
        {
          productId: prod1.id,
          descriptionSnapshot: prod1.name,
          quantity: 2,
          unitPrice: prod1.unitPrice,
          discountAmount: 5000,
          taxRate: prod1.taxRate,
        },
        {
          productId: prod2.id,
          descriptionSnapshot: '10 Hours Solution Engineering',
          quantity: 10,
          unitPrice: prod2.unitPrice,
          discountAmount: 0,
          taxRate: prod2.taxRate,
        },
      ],
      false
    );

    const inv1 = await prisma.invoice.create({
      data: {
        businessId: business.id,
        customerId: customer1.id,
        invoiceNumber: `${business.invoicePrefix}-${currentYear}-000001`,
        invoiceDate: new Date(`${currentYear}-01-15T00:00:00.000Z`),
        dueDate: new Date(`${currentYear}-01-30T00:00:00.000Z`),
        status: 'ISSUED',
        placeOfSupply: 'Karnataka',
        isInterState: false,
        subtotal: calc1.subtotal,
        discountTotal: calc1.discountTotal,
        taxableAmount: calc1.taxableAmount,
        cgstTotal: calc1.cgstTotal,
        sgstTotal: calc1.sgstTotal,
        igstTotal: calc1.igstTotal,
        taxTotal: calc1.taxTotal,
        grandTotal: calc1.grandTotal,
        notes: 'Thank you for your business. Payment terms net 15 days.',
        customerNameSnapshot: customer1.name,
        customerPhoneSnapshot: customer1.phone,
        customerEmailSnapshot: customer1.email,
        customerAddressSnapshot: customer1.billingAddress,
        customerGstinSnapshot: customer1.gstin,
        customerStateSnapshot: customer1.state,
        businessNameSnapshot: business.name,
        businessAddressSnapshot: business.address,
        businessPhoneSnapshot: business.phone,
        businessEmailSnapshot: business.email,
        businessGstinSnapshot: business.gstin,
        businessStateSnapshot: business.state,
        items: {
          create: calc1.items.map((it) => ({
            productId: it.productId,
            descriptionSnapshot: it.descriptionSnapshot,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountAmount: it.discountAmount,
            taxRate: it.taxRate,
            taxableAmount: it.taxableAmount,
            cgstRate: it.cgstRate,
            cgstAmount: it.cgstAmount,
            sgstRate: it.sgstRate,
            sgstAmount: it.sgstAmount,
            igstRate: it.igstRate,
            igstAmount: it.igstAmount,
            taxAmount: it.taxAmount,
            lineTotal: it.lineTotal,
          })),
        },
      },
    });

    // Record partial settlement on inv1
    await prisma.payment.create({
      data: {
        invoiceId: inv1.id,
        amount: toDecimal(50000),
        paymentDate: new Date(`${currentYear}-01-18T00:00:00.000Z`),
        method: 'BANK_TRANSFER',
        reference: 'NEFT-HDFC-991283',
        requestKey: `PAY-REQ-${inv1.id}-001`,
      },
    });

    // 2. Draft Inter-State Invoice (Karnataka -> Maharashtra: IGST 18%)
    const calc2 = calculateInvoiceTotals(
      [
        {
          productId: prod3.id,
          descriptionSnapshot: prod3.name,
          quantity: 1,
          unitPrice: prod3.unitPrice,
          discountAmount: 0,
          taxRate: prod3.taxRate,
        },
      ],
      true
    );

    await prisma.invoice.create({
      data: {
        businessId: business.id,
        customerId: customer2.id,
        invoiceNumber: `DRAFT-2026-0001`,
        invoiceDate: new Date(`${currentYear}-02-01T00:00:00.000Z`),
        dueDate: new Date(`${currentYear}-02-15T00:00:00.000Z`),
        status: 'DRAFT',
        placeOfSupply: 'Maharashtra',
        isInterState: true,
        subtotal: calc2.subtotal,
        discountTotal: calc2.discountTotal,
        taxableAmount: calc2.taxableAmount,
        cgstTotal: calc2.cgstTotal,
        sgstTotal: calc2.sgstTotal,
        igstTotal: calc2.igstTotal,
        taxTotal: calc2.taxTotal,
        grandTotal: calc2.grandTotal,
        notes: 'Annual contract draft for review.',
        customerNameSnapshot: customer2.name,
        customerPhoneSnapshot: customer2.phone,
        customerEmailSnapshot: customer2.email,
        customerAddressSnapshot: customer2.billingAddress,
        customerGstinSnapshot: customer2.gstin,
        customerStateSnapshot: customer2.state,
        businessNameSnapshot: business.name,
        businessAddressSnapshot: business.address,
        businessPhoneSnapshot: business.phone,
        businessEmailSnapshot: business.email,
        businessGstinSnapshot: business.gstin,
        businessStateSnapshot: business.state,
        items: {
          create: calc2.items.map((it) => ({
            productId: it.productId,
            descriptionSnapshot: it.descriptionSnapshot,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountAmount: it.discountAmount,
            taxRate: it.taxRate,
            taxableAmount: it.taxableAmount,
            cgstRate: it.cgstRate,
            cgstAmount: it.cgstAmount,
            sgstRate: it.sgstRate,
            sgstAmount: it.sgstAmount,
            igstRate: it.igstRate,
            igstAmount: it.igstAmount,
            taxAmount: it.taxAmount,
            lineTotal: it.lineTotal,
          })),
        },
      },
    });
  }

  console.log('✅ Database seeded successfully with valid and consistent records.');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
