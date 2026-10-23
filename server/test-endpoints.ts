import { createApp } from './src/app';
import { prisma } from './src/config/prisma';
import http from 'http';

async function runTests() {
  console.log('🧪 Starting Phase 2 Live Backend Verification Test Suite...\n');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5001, () => resolve()));
  const BASE = 'http://localhost:5001/api';

  try {
    // Test 1: GET /api/health
    const healthRes = await fetch(`${BASE}/health`);
    const healthJson = await healthRes.json();
    console.log('✅ 1. GET /api/health:', healthJson.data.status, `(Database: ${healthJson.data.database.status})`);
    if (healthJson.data.database.status !== 'connected') {
      throw new Error('Database is not reported as connected in health check');
    }

    // Test 2: GET /api/business & PUT /api/business
    const bizRes = await fetch(`${BASE}/business`);
    const bizJson = await bizRes.json();
    console.log('✅ 2. GET /api/business:', bizJson.data.name);

    const updateBizRes = await fetch(`${BASE}/business`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Viora Tech Solutions Pvt Ltd',
        address: '102 Innovation Hub, Tech City, Bengaluru, Karnataka - 560100',
        phone: '+91 98765 43210',
        email: 'billing@vioratech.com',
      }),
    });
    const updateBizJson = await updateBizRes.json();
    console.log('✅ 3. PUT /api/business:', updateBizJson.data.name);

    // Test 3: Customers CRUD
    const createCustRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Client Corp',
        phone: '+91 91234 56789',
        email: 'test@clientcorp.in',
        billingAddress: 'Tower B, Tech Park, Hyderabad - 500081',
        gstin: '36AABCT1234D1Z9',
      }),
    });
    const createCustJson = await createCustRes.json();
    const testCustomerId = createCustJson.data.id;
    console.log('✅ 4. POST /api/customers created:', createCustJson.data.name, `(ID: ${testCustomerId})`);

    const getCustRes = await fetch(`${BASE}/customers?search=Test`);
    const getCustJson = await getCustRes.json();
    console.log('✅ 5. GET /api/customers with search:', getCustJson.data.customers.length, 'found');

    // Test 4: Products CRUD
    const createProdRes = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom Cloud API Integration',
        description: 'Bespoke backend REST API engineering',
        unit: 'HRS',
        unitPrice: 3500,
        taxRate: 18,
      }),
    });
    const createProdJson = await createProdRes.json();
    const testProductId = createProdJson.data.id;
    console.log('✅ 6. POST /api/products created:', createProdJson.data.name, `(Price: ₹${createProdJson.data.unitPrice})`);

    // Test 5: Invoices (Draft Creation & Server-side Calculation)
    const createInvRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        invoiceDate: '2025-10-23',
        dueDate: '2025-11-07',
        notes: 'Integration milestone 1 invoice',
        items: [
          {
            productId: testProductId,
            descriptionSnapshot: 'Custom Cloud API Integration - Sprint 1',
            quantity: 10,
            unitPrice: 3500, // 35,000 base
            discountAmount: 5000, // 30,000 taxable
            taxRate: 18, // 5,400 tax -> 35,400 grandTotal
          },
        ],
      }),
    });
    const createInvJson = await createInvRes.json();
    const testInvoiceId = createInvJson.data.id;
    console.log('✅ 7. POST /api/invoices draft created:', createInvJson.data.invoiceNumber);
    console.log(`   Totals calculated by server: Subtotal=₹${createInvJson.data.subtotal}, Tax=₹${createInvJson.data.taxTotal}, GrandTotal=₹${createInvJson.data.grandTotal}`);
    if (createInvJson.data.grandTotal !== 35400) {
      throw new Error(`Server calculation mismatch: expected 35400, got ${createInvJson.data.grandTotal}`);
    }

    // Test 6: PUT /api/invoices/:id (Edit Draft)
    const updateInvRes = await fetch(`${BASE}/invoices/${testInvoiceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        invoiceDate: '2025-10-23',
        dueDate: '2025-11-07',
        notes: 'Updated milestone 1 scope with 12 hours',
        items: [
          {
            productId: testProductId,
            descriptionSnapshot: 'Custom Cloud API Integration - Sprint 1 (Adjusted)',
            quantity: 12,
            unitPrice: 3500, // 42,000 base
            discountAmount: 2000, // 40,000 taxable
            taxRate: 18, // 7,200 tax -> 47,200 grandTotal
          },
        ],
      }),
    });
    const updateInvJson = await updateInvRes.json();
    console.log('✅ 8. PUT /api/invoices/:id (Draft edit): GrandTotal updated to ₹' + updateInvJson.data.grandTotal);
    if (Number(updateInvJson.data.grandTotal) !== 47200) {
      throw new Error(`Expected updated grandTotal 47200, got ${updateInvJson.data.grandTotal}`);
    }

    // Test 7: POST /api/invoices/:id/issue (Transition to ISSUED)
    const issueRes = await fetch(`${BASE}/invoices/${testInvoiceId}/issue`, {
      method: 'POST',
    });
    const issueJson = await issueRes.json();
    console.log('✅ 9. POST /api/invoices/:id/issue:', issueJson.data.invoiceNumber, `(Status: ${issueJson.data.status})`);

    // Test 8: Assert that editing an ISSUED invoice is REJECTED
    const editIssuedRes = await fetch(`${BASE}/invoices/${testInvoiceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: testCustomerId,
        invoiceDate: '2025-10-23',
        dueDate: '2025-11-07',
        items: [
          {
            descriptionSnapshot: 'Attempted modification after issuance',
            quantity: 1,
            unitPrice: 100,
          },
        ],
      }),
    });
    console.log('✅ 10. Attempted edit on ISSUED invoice correctly rejected with HTTP', editIssuedRes.status);
    if (editIssuedRes.status !== 400) {
      throw new Error('Issued invoice edit was not rejected!');
    }

    // Test 9: Payment Recording (POST /api/invoices/:id/payments)
    const payKey = `TEST-KEY-${Date.now()}`;
    const payRes = await fetch(`${BASE}/invoices/${testInvoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 20000,
        method: 'UPI',
        reference: 'UPI/2025/TEST1234',
        requestKey: payKey,
      }),
    });
    const payJson = await payRes.json();
    console.log('✅ 11. POST /api/invoices/:id/payments recorded: ₹' + payJson.data.payment.amount);
    console.log(`    Derived payment status: ${payJson.data.invoiceSummary.paymentStatus}, Balance remaining: ₹${payJson.data.invoiceSummary.balanceRemaining}`);
    if (payJson.data.invoiceSummary.paymentStatus !== 'PARTIALLY_PAID') {
      throw new Error('Expected PARTIALLY_PAID status');
    }

    // Test 10: Assert Duplicate Request Key Rejected
    const dupPayRes = await fetch(`${BASE}/invoices/${testInvoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 5000,
        method: 'UPI',
        requestKey: payKey, // DUPLICATE KEY
      }),
    });
    console.log('✅ 12. Duplicate payment requestKey correctly rejected with HTTP', dupPayRes.status);
    if (dupPayRes.status !== 409) {
      throw new Error('Duplicate payment request was not rejected with 409!');
    }

    // Test 11: Assert Overpayment Rejected
    const overPayRes = await fetch(`${BASE}/invoices/${testInvoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 9999999, // Exceeds balance
        method: 'BANK_TRANSFER',
        requestKey: `TEST-OVERPAY-${Date.now()}`,
      }),
    });
    console.log('✅ 13. Overpayment correctly rejected with HTTP', overPayRes.status);
    if (overPayRes.status !== 400) {
      throw new Error('Overpayment was not rejected with 400!');
    }

    // Test 12: GET /api/payments
    const allPayRes = await fetch(`${BASE}/payments`);
    const allPayJson = await allPayRes.json();
    console.log('✅ 14. GET /api/payments:', allPayJson.data.payments.length, 'payments retrieved');

    // Test 13: GET /api/dashboard/summary
    const dashRes = await fetch(`${BASE}/dashboard/summary`);
    const dashJson = await dashRes.json();
    console.log('✅ 15. GET /api/dashboard/summary live DB metrics:');
    console.log(`    Total Sales: ₹${dashJson.data.metrics.totalSales.amount}`);
    console.log(`    Total Invoices: ${dashJson.data.metrics.totalInvoices.count}`);
    console.log(`    Amount Collected: ₹${dashJson.data.metrics.amountCollected.amount}`);
    console.log(`    Outstanding Balance: ₹${dashJson.data.metrics.outstandingBalance.amount}`);

    // Test 14: GET /api/reports/sales
    const reportRes = await fetch(`${BASE}/reports/sales?groupBy=day`);
    const reportJson = await reportRes.json();
    console.log('✅ 16. GET /api/reports/sales:');
    console.log(`    Timeline periods: ${reportJson.data.salesTimeline.length} sales dates, ${reportJson.data.collectionsTimeline.length} collection dates`);
    console.log(`    Total Sales: ₹${reportJson.data.summary.totalSales}, Net Outstanding: ₹${reportJson.data.summary.netOutstanding}`);

    console.log('\n🎉 ALL PHASE 2 BACKEND ENDPOINTS & VALIDATION RULES VERIFIED SUCCESSFULLY!\n');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
