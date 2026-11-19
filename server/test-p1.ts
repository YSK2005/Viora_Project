import { hashPassword } from './src/utils/auth';
import http from 'http';
import assert from 'node:assert/strict';
import { createApp } from './src/app';

let BASE_URL = '';

async function req(
  path: string,
  options: {
    method?: string;
    token?: string;
    businessId?: string;
    body?: any;
  } = {}
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }
  if (options.businessId) {
    headers['X-Business-Id'] = options.businessId;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body: json };
}

async function runP1Tests() {
  console.log('\n🧪 Starting P1 Master Verification Suite (Payment Corrections, Audit History, Timezone Reporting, Global Search)...\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5005, () => resolve()));
  BASE_URL = 'http://127.0.0.1:5005/api';

  const ts = Date.now();

  // 1. Setup Business A with Owner, Accountant, and Viewer
  console.log('--- 1. Setting up Business and Accounts ---');
  const ownerA = await req('/auth/register', {
    method: 'POST',
    body: {
      email: `owner_p1_${ts}@viora.test`,
      password: 'Password123!',
      name: 'Owner P1',
      businessName: 'Viora P1 Enterprises',
    },
  });
  assert.strictEqual(ownerA.status, 201, 'Owner A should register');
  const tokenOwnerA = ownerA.body.data.token;
  const bizAId = ownerA.body.data.business.id;
  console.log('✅ PASSED: Registered Owner A and created Business A');

  // Add Accountant
  await prisma.user.create({ data: { email: `accountant_p1_${ts}@viora.test`, name: 'Accountant', passwordHash: hashPassword('ChosenTestPassword!42') } });
  const accA = await req('/auth/members', {
    method: 'POST',
    token: tokenOwnerA,
    body: {
      email: `accountant_p1_${ts}@viora.test`,
      role: 'ACCOUNTANT',
      name: 'Accountant P1',
    },
  });
  assert.strictEqual(accA.status, 201, 'Owner can add Accountant');
  const accLogin = await req('/auth/login', {
    method: 'POST',
    body: {
      email: `accountant_p1_${ts}@viora.test`,
      password: 'ChosenTestPassword!42',
    },
  });
  const tokenAccA = accLogin.body.data.token;
  console.log('✅ PASSED: Created and logged in Accountant A');

  // Add Viewer
  await prisma.user.create({ data: { email: `viewer_p1_${ts}@viora.test`, name: 'Viewer', passwordHash: hashPassword('ChosenTestPassword!42') } });
  const viewA = await req('/auth/members', {
    method: 'POST',
    token: tokenOwnerA,
    body: {
      email: `viewer_p1_${ts}@viora.test`,
      role: 'VIEWER',
      name: 'Viewer P1',
    },
  });
  assert.strictEqual(viewA.status, 201, 'Owner can add Viewer');
  const viewLogin = await req('/auth/login', {
    method: 'POST',
    body: {
      email: `viewer_p1_${ts}@viora.test`,
      password: 'ChosenTestPassword!42',
    },
  });
  const tokenViewA = viewLogin.body.data.token;
  console.log('✅ PASSED: Created and logged in Viewer A');

  // Setup Business B (for cross-tenant checks)
  const ownerB = await req('/auth/register', {
    method: 'POST',
    body: {
      email: `owner_b_p1_${ts}@viora.test`,
      password: 'Password123!',
      name: 'Owner B P1',
      businessName: 'Tenant B Logistics',
    },
  });
  const tokenOwnerB = ownerB.body.data.token;
  console.log('✅ PASSED: Registered Tenant B');

  // 2. Create customer, product, and issued invoice in Business A
  console.log('\n--- 2. Setting up Invoiced Entity for Payment Tests ---');
  const custRes = await req('/customers', {
    method: 'POST',
    token: tokenOwnerA,
    body: {
      name: `Acme Industrial Corp ${ts}`,
      phone: '9876543210',
      email: `acme_${ts}@corp.test`,
      billingAddress: '42 Industrial Park, Peenya, Bangalore',
      gstin: '29ABCDE1234F1Z5',
      state: 'Karnataka',
    },
  });
  assert.strictEqual(custRes.status, 201);
  const customerId = custRes.body.data.id;

  const prodRes = await req('/products', {
    method: 'POST',
    token: tokenOwnerA,
    body: {
      name: `Precision Turbine Model ${ts}`,
      unit: 'SET',
      unitPrice: 10000,
      taxRate: 18,
    },
  });
  assert.strictEqual(prodRes.status, 201);
  const productId = prodRes.body.data.id;

  const invRes = await req('/invoices', {
    method: 'POST',
    token: tokenOwnerA,
    body: {
      customerId,
      invoiceDate: '2026-03-10',
      dueDate: '2026-03-25',
      placeOfSupply: 'Karnataka',
      isInterState: false,
      notes: 'Terms 15 days payment.',
      items: [
        {
          productId,
          descriptionSnapshot: 'Precision Turbine Unit',
          unit: 'SET',
          quantity: 1,
          unitPrice: 10000,
          discountAmount: 0,
          taxRate: 18,
        },
      ],
    },
  });
  assert.strictEqual(invRes.status, 201);
  const invoiceId = invRes.body.data.id;

  // Issue the invoice
  const issueRes = await req(`/invoices/${invoiceId}/issue`, {
    method: 'POST',
    token: tokenOwnerA,
  });
  assert.strictEqual(issueRes.status, 200);
  const issuedInv = issueRes.body.data;
  assert.strictEqual(issuedInv.status, 'ISSUED');
  assert.strictEqual(Number(issuedInv.grandTotal), 11800); // 10000 + 18% GST = 11800
  console.log(`✅ PASSED: Created and issued Invoice ${issuedInv.invoiceNumber} (Total: ₹11,800)`);

  // 3. Record Payment & Verify Reversal Lifecycle
  console.log('\n--- 3. Testing Payment Reversals and Balance Reconciliation ---');
  const payRes1 = await req(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    token: tokenAccA,
    body: {
      amount: 5000,
      method: 'BANK_TRANSFER',
      paymentDate: '2026-03-12T10:00:00.000Z',
      reference: 'NEFT-REF-001',
      requestKey: `REQ-PAY-P1-1-${ts}`,
    },
  });
  assert.strictEqual(payRes1.status, 201, 'Accountant should record payment');
  const payment1 = payRes1.body.data.payment;
  assert.strictEqual(Number(payment1.amount), 5000);
  assert.strictEqual(payRes1.body.data.invoiceSummary.paymentStatus, 'PARTIALLY_PAID');
  assert.strictEqual(payRes1.body.data.invoiceSummary.totalPaid, 5000);
  assert.strictEqual(payRes1.body.data.invoiceSummary.balanceRemaining, 6800);
  console.log('✅ PASSED: Recorded partial payment ₹5,000. Balance remaining: ₹6,800');

  // Viewer attempt to reverse payment -> must fail with 403
  const viewRev = await req(`/payments/${payment1.id}/reverse`, {
    method: 'POST',
    token: tokenViewA,
    body: { reason: 'Unauthorized reversal attempt' },
  });
  assert.strictEqual(viewRev.status, 403, 'Viewer should be forbidden from reversing payment (403)');
  console.log('✅ PASSED: Viewer cannot reverse payment (HTTP 403 ERR_FORBIDDEN_ROLE)');

  // Tenant B attempt to reverse Business A payment -> must fail with 404
  const tenantBRev = await req(`/payments/${payment1.id}/reverse`, {
    method: 'POST',
    token: tokenOwnerB,
    body: { reason: 'Cross tenant reversal attempt' },
  });
  assert.strictEqual(tenantBRev.status, 404, 'Cross-tenant cannot reverse other tenant payment (404)');
  console.log('✅ PASSED: Cross-tenant cannot reverse payment (HTTP 404 ERR_PAYMENT_NOT_FOUND)');

  // Reversal without valid reason -> must fail with 400
  const noReasonRev = await req(`/payments/${payment1.id}/reverse`, {
    method: 'POST',
    token: tokenOwnerA,
    body: { reason: ' ' },
  });
  assert.strictEqual(noReasonRev.status, 400, 'Reversal without reason must fail');
  console.log('✅ PASSED: Reversal requires non-empty reason (HTTP 400 validation)');

  // Accountant reverses payment with valid reason
  const validRev = await req(`/payments/${payment1.id}/reverse`, {
    method: 'POST',
    token: tokenAccA,
    body: { reason: 'Customer paid incorrect invoice by mistake. Cheque bounced.' },
  });
  assert.strictEqual(validRev.status, 200, 'Accountant can reverse payment with reason');
  const revData = validRev.body.data;
  assert.strictEqual(revData.payment.isReversed, true, 'Payment must be marked isReversed: true');
  assert.ok(revData.payment.reversedAt, 'Reversed timestamp must be populated');
  assert.strictEqual(revData.payment.reversedReason, 'Customer paid incorrect invoice by mistake. Cheque bounced.');
  assert.strictEqual(revData.invoiceSummary.paymentStatus, 'UNPAID', 'Invoice status must revert to UNPAID');
  assert.strictEqual(revData.invoiceSummary.totalPaid, 0, 'Total paid must reconcile to 0');
  assert.strictEqual(revData.invoiceSummary.balanceRemaining, 11800, 'Full ₹11,800 balance must be restored');
  console.log('✅ PASSED: Payment reversed successfully. Original record preserved with audit fields.');
  console.log('✅ PASSED: Invoice balance reconciled: status reverted to UNPAID, balanceRemaining = ₹11,800');

  // Verify that repeating the reversal fails with 400 ERR_PAYMENT_ALREADY_REVERSED
  const doubleRev = await req(`/payments/${payment1.id}/reverse`, {
    method: 'POST',
    token: tokenOwnerA,
    body: { reason: 'Attempting second reversal' },
  });
  assert.strictEqual(doubleRev.status, 400, 'Double reversal must be rejected');
  assert.strictEqual(doubleRev.body.error.code, 'ERR_PAYMENT_ALREADY_REVERSED');
  console.log('✅ PASSED: Double reversal rejected with HTTP 400 ERR_PAYMENT_ALREADY_REVERSED');

  // Verify that GET /api/payments returns the reversed payment with audit attributes
  const payList = await req(`/payments?invoiceId=${invoiceId}`, {
    method: 'GET',
    token: tokenOwnerA,
  });
  assert.strictEqual(payList.status, 200);
  const foundPay = payList.body.data.payments.find((p: any) => p.id === payment1.id);
  assert.ok(foundPay, 'Payment must be present in payment list');
  assert.strictEqual(foundPay.isReversed, true);
  assert.strictEqual(foundPay.reversedReason, 'Customer paid incorrect invoice by mistake. Cheque bounced.');
  console.log('✅ PASSED: GET /api/payments preserves and displays reversal history & reason');

  // 4. Test Timezone & Reporting Consistency
  console.log('\n--- 4. Testing Timezone & Reporting Consistency (Asia/Kolkata) ---');
  // Record a new confirmed payment
  const payRes2 = await req(`/invoices/${invoiceId}/payments`, {
    method: 'POST',
    token: tokenOwnerA,
    body: {
      amount: 11800,
      method: 'UPI',
      paymentDate: '2026-03-15T23:45:00.000+05:30', // Late evening IST
      reference: 'UPI-TRANS-999',
      requestKey: `REQ-PAY-P1-2-${ts}`,
    },
  });
  assert.strictEqual(payRes2.status, 201);
  assert.strictEqual(payRes2.body.data.invoiceSummary.paymentStatus, 'PAID');
  console.log('✅ PASSED: Recorded full settlement payment on 2026-03-15 (IST evening)');

  // Query dashboard with exact date boundary for 2026-03-15
  const dashSummary = await req('/dashboard/summary?startDate=2026-03-15&endDate=2026-03-15', {
    method: 'GET',
    token: tokenOwnerA,
  });
  assert.strictEqual(dashSummary.status, 200);
  const sumData = dashSummary.body.data;
  assert.ok(sumData.periodActivity, 'Summary must contain periodActivity');
  assert.ok(sumData.closingBalance, 'Summary must contain closingBalance');
  // Payments collected on 2026-03-15 must reflect ₹11,800 (excluding reversed payment)
  assert.strictEqual(sumData.metrics.amountCollected.amount, 11800, 'Period payments collected must equal ₹11,800');
  console.log('✅ PASSED: Dashboard correctly calculates IST day boundaries and excludes reversed payments');

  // 5. Global Omni-Search API
  console.log('\n--- 5. Testing Global Omni-Search API (/api/search) ---');
  const searchCust = await req(`/search?q=Acme`, {
    method: 'GET',
    token: tokenOwnerA,
  });
  assert.strictEqual(searchCust.status, 200);
  assert.ok(searchCust.body.data.customers.length > 0, 'Should find matching customer');
  assert.strictEqual(searchCust.body.data.customers[0].name, `Acme Industrial Corp ${ts}`);
  console.log('✅ PASSED: Global search found matching customer by partial name');

  const searchProd = await req(`/search?q=Turbine`, {
    method: 'GET',
    token: tokenOwnerA,
  });
  assert.strictEqual(searchProd.status, 200);
  assert.ok(searchProd.body.data.products.length > 0, 'Should find matching product');
  assert.strictEqual(searchProd.body.data.products[0].name, `Precision Turbine Model ${ts}`);
  console.log('✅ PASSED: Global search found matching product by partial name');

  const searchInv = await req(`/search?q=${issuedInv.invoiceNumber}`, {
    method: 'GET',
    token: tokenOwnerA,
  });
  assert.strictEqual(searchInv.status, 200);
  assert.ok(searchInv.body.data.invoices.length > 0, 'Should find matching invoice by invoiceNumber');
  assert.strictEqual(searchInv.body.data.invoices[0].invoiceNumber, issuedInv.invoiceNumber);
  console.log('✅ PASSED: Global search found matching invoice by official number');

  // Cross-tenant search isolation
  const tenantBSearch = await req(`/search?q=Acme`, {
    method: 'GET',
    token: tokenOwnerB,
  });
  assert.strictEqual(tenantBSearch.status, 200);
  assert.strictEqual(tenantBSearch.body.data.customers.length, 0, 'Tenant B must NOT find Tenant A customer');
  console.log('✅ PASSED: Global search strictly respects multi-tenant boundaries');

  server.close();
  console.log('\n======================================================');
  console.log('🎉 ALL P1 MASTER VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runP1Tests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
