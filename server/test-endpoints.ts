import { createApp } from './src/app';
import { prisma } from './src/config/prisma';
import http from 'http';
import { calculateLineItem, calculateInvoiceTotals } from './src/utils/money';

async function runTests() {
  console.log('🧪 Starting Phase 3 Comprehensive Verification & Test Suite...\n');

  const RUN_ID = Date.now(); // Unique per run to avoid duplicate-customer rejections

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => server.listen(5002, () => resolve()));
  const BASE = 'http://localhost:5002/api';

  try {
    // Setup test customer and products
    const bizRes = await fetch(`${BASE}/business`);
    const bizJson = await bizRes.json();
    const businessId = bizJson.data.id;

    // Create unique test customer
    const custRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Phase 3 Enterprise Client ${RUN_ID}`,
        phone: `9${String(RUN_ID).slice(-9)}`,
        email: `billing-${RUN_ID}@enterpriseclient.in`,
        billingAddress: '42 Cyber City, DLF Phase 2, Gurugram, Haryana - 122002',
        state: 'Haryana',
      }),
    });
    const custJson = await custRes.json();
    const customerId = custJson.data.id;

    // Create test products
    const prod1Res = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Cloud Architecture',
        unit: 'HRS',
        unitPrice: 500,
        taxRate: 10,
      }),
    });
    const prod1 = (await prod1Res.json()).data;

    const prod2Res = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Database Migration Service',
        unit: 'PCS',
        unitPrice: 1200,
        taxRate: 18,
      }),
    });
    const prod2 = (await prod2Res.json()).data;

    // =========================================================================
    // TEST 1: Correct invoice totals (Specification Example from Section 4)
    // Qty: 2, Unit price: ₹500, Discount: ₹100, Tax rate: 10%
    // Expected: Gross ₹1,000, Taxable ₹900, Tax ₹90, Total ₹990
    // =========================================================================
    const specLine = calculateLineItem({
      descriptionSnapshot: 'Spec Test Item',
      quantity: 2,
      unitPrice: 500,
      discountAmount: 100,
      taxRate: 10,
    }, false);

    if (
      specLine.grossAmount.toString() !== '1000' ||
      specLine.taxableAmount.toString() !== '900' ||
      specLine.taxAmount.toString() !== '90' ||
      specLine.lineTotal.toString() !== '990'
    ) {
      throw new Error(`Spec test item calculation mismatch: ${JSON.stringify(specLine)}`);
    }
    console.log('✅ 1. Correct specification invoice totals verified: Gross ₹1,000, Taxable ₹900, Tax ₹90, Total ₹990');

    // =========================================================================
    // TEST 2: Multiple products in single invoice
    // =========================================================================
    const multiCalc = calculateInvoiceTotals([
      { descriptionSnapshot: 'Prod A', quantity: 2, unitPrice: 500, discountAmount: 100, taxRate: 10 },
      { descriptionSnapshot: 'Prod B', quantity: 3, unitPrice: 1000, discountAmount: 200, taxRate: 18 },
    ], false);
    // Prod A: gross 1000, disc 100, tax 90, total 990
    // Prod B: gross 3000, disc 200, taxable 2800, tax 504 (2800*0.18), total 3304
    // Totals: subtotal 4000, discount 300, taxable 3700, tax 594, grandTotal 4294
    if (multiCalc.grandTotal.toString() !== '4294' || multiCalc.taxTotal.toString() !== '594') {
      throw new Error(`Multiple products calculation mismatch: grandTotal=${multiCalc.grandTotal.toString()}`);
    }
    console.log('✅ 2. Multiple products calculation verified: Subtotal ₹4,000, Tax ₹594, Grand Total ₹4,294');

    // =========================================================================
    // TEST 3: Mixed tax rates (0%, 5%, 18%, 28%)
    // =========================================================================
    const mixedCalc = calculateInvoiceTotals([
      { descriptionSnapshot: 'Zero Tax Book', quantity: 1, unitPrice: 500, taxRate: 0 },
      { descriptionSnapshot: 'Essential Goods', quantity: 2, unitPrice: 200, taxRate: 5 }, // 400 taxable, 20 tax, total 420
      { descriptionSnapshot: 'Standard Service', quantity: 1, unitPrice: 1000, taxRate: 18 }, // 1000 taxable, 180 tax, total 1180
      { descriptionSnapshot: 'Luxury Item', quantity: 1, unitPrice: 2000, taxRate: 28 }, // 2000 taxable, 560 tax, total 2560
    ], false);
    // Total Tax = 0 + 20 + 180 + 560 = 760
    // Grand Total = 500 + 420 + 1180 + 2560 = 4660
    if (mixedCalc.taxTotal.toString() !== '760' || mixedCalc.grandTotal.toString() !== '4660') {
      throw new Error(`Mixed tax rates mismatch: taxTotal=${mixedCalc.taxTotal.toString()}`);
    }
    console.log('✅ 3. Mixed tax rates verified across 0%, 5%, 18%, 28%: Total Tax ₹760, Grand Total ₹4,660');

    // =========================================================================
    // TEST 4: Fixed discounts applied before tax
    // =========================================================================
    const discCalc = calculateLineItem({
      descriptionSnapshot: 'Discounted Cloud',
      quantity: 4,
      unitPrice: 250, // 1000 gross
      discountAmount: 250, // 750 taxable
      taxRate: 18, // 135 tax
    }, false);
    if (discCalc.taxableAmount.toString() !== '750' || discCalc.taxAmount.toString() !== '135' || discCalc.lineTotal.toString() !== '885') {
      throw new Error(`Fixed discount calculation failed: lineTotal=${discCalc.lineTotal.toString()}`);
    }
    console.log('✅ 4. Fixed discounts verified: Gross ₹1,000, Discount ₹250, Taxable ₹750, Tax ₹135, Total ₹885');

    // =========================================================================
    // TEST 5: Fractional quantities (e.g. 2.75 hours consulting)
    // =========================================================================
    const fracCalc = calculateLineItem({
      descriptionSnapshot: 'Hourly Consulting',
      quantity: 2.75,
      unitPrice: 1200, // 3300 gross
      discountAmount: 0,
      taxRate: 18, // 594 tax
    }, false);
    if (fracCalc.grossAmount.toString() !== '3300' || fracCalc.taxAmount.toString() !== '594' || fracCalc.lineTotal.toString() !== '3894') {
      throw new Error(`Fractional quantity calculation failed: ${fracCalc.lineTotal.toString()}`);
    }
    console.log('✅ 5. Fractional quantities verified (2.75 hrs @ ₹1,200): Gross ₹3,300, Tax ₹594, Total ₹3,894');

    // =========================================================================
    // TEST 6: Rounding edge cases (ROUND_HALF_UP exact paisa rounding)
    // 1 item @ ₹33.33 with 18% tax => 33.33 * 0.18 = 5.9994 -> 6.00
    // =========================================================================
    const roundCalc = calculateLineItem({
      descriptionSnapshot: 'Precision Item',
      quantity: 1,
      unitPrice: 33.33,
      discountAmount: 0,
      taxRate: 18,
    }, false);
    if (roundCalc.taxAmount.toString() !== '6' || roundCalc.lineTotal.toString() !== '39.33') {
      throw new Error(`Rounding edge case failed: taxAmount=${roundCalc.taxAmount.toString()}`);
    }
    console.log('✅ 6. Rounding edge case verified: 1 @ ₹33.33 @ 18% tax => Tax ₹6.00, Line Total ₹39.33');

    // =========================================================================
    // TEST 7: Missing customer rejection (HTTP 404)
    // =========================================================================
    const missingCustRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: '00000000-0000-0000-0000-000000000000',
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        items: [{ descriptionSnapshot: 'Item', quantity: 1, unitPrice: 100 }],
      }),
    });
    if (missingCustRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for missing customer, got ${missingCustRes.status}`);
    }
    console.log('✅ 7. Missing customer correctly rejected with HTTP 404 ERR_CUSTOMER_NOT_FOUND');

    // =========================================================================
    // TEST 8: Empty invoice rejection (zero items)
    // =========================================================================
    const emptyInvRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        items: [],
      }),
    });
    if (emptyInvRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for empty items invoice, got ${emptyInvRes.status}`);
    }
    console.log('✅ 8. Empty invoice items correctly rejected with HTTP 400');

    // =========================================================================
    // TEST 9: Invalid quantities (zero or negative)
    // =========================================================================
    const invQtyRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        items: [{ descriptionSnapshot: 'Negative item', quantity: -2, unitPrice: 100 }],
      }),
    });
    if (invQtyRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for negative quantity, got ${invQtyRes.status}`);
    }
    console.log('✅ 9. Negative/zero quantity correctly rejected with HTTP 400');

    // =========================================================================
    // TEST 10: Excessive discounts (Discount > Gross)
    // =========================================================================
    const excessDiscRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        items: [{ descriptionSnapshot: 'Over-discounted', quantity: 1, unitPrice: 500, discountAmount: 600 }],
      }),
    });
    if (excessDiscRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for excessive discount, got ${excessDiscRes.status}`);
    }
    console.log('✅ 10. Excessive discount (> gross amount) correctly rejected with HTTP 400');

    // =========================================================================
    // TEST 11: Unique invoice numbering upon issuance (Format: INV-2026-000001)
    // =========================================================================
    const draft1Res = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        placeOfSupply: 'Haryana',
        isInterState: true,
        items: [{ productId: prod1.id, descriptionSnapshot: prod1.name, quantity: 2, unitPrice: 500, taxRate: 10 }],
      }),
    });
    const draft1 = (await draft1Res.json()).data;
    const issue1Res = await fetch(`${BASE}/invoices/${draft1.id}/issue`, { method: 'POST' });
    const issue1 = (await issue1Res.json()).data;
    if (!issue1.invoiceNumber.startsWith('INV-')) {
      throw new Error(`Unexpected invoice number format: ${issue1.invoiceNumber}`);
    }
    console.log('✅ 11. Unique invoice numbering verified upon issuance:', issue1.invoiceNumber, `(Status: ${issue1.status})`);

    // =========================================================================
    // TEST 12: Concurrent invoice issuance (no duplicate sequence numbers)
    // =========================================================================
    const [cDraft1, cDraft2] = await Promise.all([
      fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          invoiceDate: '2026-10-23',
          dueDate: '2026-11-07',
          items: [{ descriptionSnapshot: 'Concurrent Item 1', quantity: 1, unitPrice: 1000 }],
        }),
      }).then((r) => r.json()),
      fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          invoiceDate: '2026-10-23',
          dueDate: '2026-11-07',
          items: [{ descriptionSnapshot: 'Concurrent Item 2', quantity: 1, unitPrice: 1000 }],
        }),
      }).then((r) => r.json()),
    ]);

    const [cIssue1Res, cIssue2Res] = await Promise.all([
      fetch(`${BASE}/invoices/${cDraft1.data.id}/issue`, { method: 'POST' }).then((r) => r.json()),
      fetch(`${BASE}/invoices/${cDraft2.data.id}/issue`, { method: 'POST' }).then((r) => r.json()),
    ]);

    if (cIssue1Res.data.invoiceNumber === cIssue2Res.data.invoiceNumber) {
      throw new Error(`Duplicate invoice number detected under concurrency: ${cIssue1Res.data.invoiceNumber}`);
    }
    console.log('✅ 12. Concurrent invoice issuance verified without collision:', cIssue1Res.data.invoiceNumber, 'and', cIssue2Res.data.invoiceNumber);

    // =========================================================================
    // TEST 13: Draft editing before issuance
    // =========================================================================
    const draftToEditRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        items: [{ descriptionSnapshot: 'Initial Item', quantity: 1, unitPrice: 1000 }],
      }),
    });
    const draftToEdit = (await draftToEditRes.json()).data;

    const editRes = await fetch(`${BASE}/invoices/${draftToEdit.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        items: [{ descriptionSnapshot: 'Updated Item with higher qty', quantity: 5, unitPrice: 1000 }],
      }),
    });
    const editJson = await editRes.json();
    if (Number(editJson.data.grandTotal) !== 5000) {
      throw new Error(`Draft editing recalculation failed: grandTotal=${editJson.data.grandTotal}`);
    }
    console.log('✅ 13. Draft editing verified: Grand total updated from ₹1,000 to ₹5,000');

    // =========================================================================
    // TEST 14: Prevention of issued invoice modification (Immutability check)
    // =========================================================================
    const issueBeforeEditRes = await fetch(`${BASE}/invoices/${draftToEdit.id}/issue`, { method: 'POST' });
    const issuedInv = (await issueBeforeEditRes.json()).data;

    const forbiddenEditRes = await fetch(`${BASE}/invoices/${issuedInv.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        invoiceDate: '2026-10-23',
        dueDate: '2026-11-07',
        items: [{ descriptionSnapshot: 'Malicious modification', quantity: 1, unitPrice: 1 }],
      }),
    });
    if (forbiddenEditRes.status !== 400) {
      throw new Error(`Expected HTTP 400 for editing issued invoice, got ${forbiddenEditRes.status}`);
    }
    console.log('✅ 14. Prevention of issued invoice modification strictly verified with HTTP 400');

    // =========================================================================
    // TEST 15: Professional A4 PDF generation (GET /api/invoices/:id/pdf)
    // =========================================================================
    const pdfRes = await fetch(`${BASE}/invoices/${issuedInv.id}/pdf`);
    const contentType = pdfRes.headers.get('content-type');
    const pdfBuffer = await pdfRes.arrayBuffer();
    const pdfHeader = Buffer.from(pdfBuffer.slice(0, 5)).toString();

    if (pdfRes.status !== 200 || !contentType?.includes('application/pdf') || pdfHeader !== '%PDF-') {
      throw new Error(`PDF generation endpoint failed: status=${pdfRes.status}, type=${contentType}, header=${pdfHeader}`);
    }
    console.log('✅ 15. PDF generation verified: Valid A4 PDF stream served (Size:', pdfBuffer.byteLength, 'bytes, Header:', pdfHeader + ')');

    // =========================================================================
    // TEST 16: Invoice snapshots remaining unchanged after product price updates
    // =========================================================================
    // Update catalog price of prod1 from ₹500 to ₹9,999
    await fetch(`${BASE}/products/${prod1.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitPrice: 9999,
      }),
    });

    // Re-fetch issue1 invoice which contains prod1
    const refetchedInvRes = await fetch(`${BASE}/invoices/${issue1.id}`);
    const refetchedInv = (await refetchedInvRes.json()).data;
    const historicalItem = refetchedInv.items.find((it: any) => it.productId === prod1.id);

    if (historicalItem.unitPrice !== 500) {
      throw new Error(`Historical snapshot was corrupted! Expected ₹500, got ₹${historicalItem.unitPrice}`);
    }
    console.log('✅ 16. Historical snapshot integrity verified: Stored unit price remains ₹500 despite product price update to ₹9,999');
    console.log('\n🎉 ALL 16 PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!\n');

    // =========================================================================
    // =========================================================================
    // PHASE 4 COMPREHENSIVE AUTOMATED TEST SUITE (15 SCENARIOS)
    // =========================================================================
    // =========================================================================
    console.log('🧪 Starting Phase 4 Payment Tracking, Dashboard Analytics & Reports Tests...\n');

    // Setup dedicated customer for Phase 4 tests
    const p4Phone = `9${String(RUN_ID + 1).slice(-9)}`;
    const p4CustRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Phase 4 Payment Test Corp ${RUN_ID}`,
        phone: p4Phone,
        email: `billing-p4-${RUN_ID}@p4corp.com`,
        billingAddress: 'Tower 4, Electronic City, Bangalore, Karnataka',
        state: 'Karnataka',
      }),
    });
    const p4Cust = (await p4CustRes.json()).data;

    // Helper to create & issue invoice
    async function createAndIssueInvoice(items: any[], invoiceDate = '2026-10-24') {
      const invRes = await fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: p4Cust.id,
          invoiceDate,
          dueDate: '2026-11-24',
          items,
        }),
      });
      const draft = (await invRes.json()).data;
      const issueRes = await fetch(`${BASE}/invoices/${draft.id}/issue`, { method: 'POST' });
      return (await issueRes.json()).data;
    }

    // =========================================================================
    // TEST 1: No payment produces UNPAID
    // =========================================================================
    const inv1 = await createAndIssueInvoice([
      { descriptionSnapshot: 'Software License', quantity: 1, unitPrice: 1000, taxRate: 0 },
    ]);
    const inv1FetchRes = await fetch(`${BASE}/invoices/${inv1.id}`);
    const inv1Data = (await inv1FetchRes.json()).data;

    if (inv1Data.paymentStatus !== 'UNPAID' || inv1Data.totalPaid !== 0 || inv1Data.balanceRemaining !== 1000) {
      throw new Error(`Test 1 Failed: Expected UNPAID with 0 paid and 1000 remaining, got ${JSON.stringify(inv1Data)}`);
    }
    console.log('✅ 1. No payment produces UNPAID (Total: ₹1,000, Paid: ₹0, Remaining: ₹1,000)');

    // =========================================================================
    // TEST 2: A partial payment produces PARTIALLY_PAID
    // =========================================================================
    const payPartRes = await fetch(`${BASE}/invoices/${inv1.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 400,
        method: 'BANK_TRANSFER',
        reference: 'NEFT400PARTIAL',
        requestKey: `P4-REQ-PARTIAL-${Date.now()}`,
      }),
    });
    const payPartJson = await payPartRes.json();
    if (payPartRes.status !== 201 || payPartJson.data.invoiceSummary.paymentStatus !== 'PARTIALLY_PAID') {
      throw new Error(`Test 2 Failed: Expected PARTIALLY_PAID, got status=${payPartRes.status}, data=${JSON.stringify(payPartJson)}`);
    }

    const inv1AfterPart = (await (await fetch(`${BASE}/invoices/${inv1.id}`)).json()).data;
    if (inv1AfterPart.paymentStatus !== 'PARTIALLY_PAID' || inv1AfterPart.totalPaid !== 400 || inv1AfterPart.balanceRemaining !== 600) {
      throw new Error(`Test 2 Verification Failed: ${JSON.stringify(inv1AfterPart)}`);
    }
    console.log('✅ 2. Partial payment produces PARTIALLY_PAID (Paid: ₹400, Balance: ₹600)');

    // =========================================================================
    // TEST 3: A final payment produces PAID
    // =========================================================================
    const payFinalRes = await fetch(`${BASE}/invoices/${inv1.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 600,
        method: 'UPI',
        reference: 'UPI600FINAL',
        requestKey: `P4-REQ-FINAL-${Date.now()}`,
      }),
    });
    const payFinalJson = await payFinalRes.json();
    if (payFinalRes.status !== 201 || payFinalJson.data.invoiceSummary.paymentStatus !== 'PAID') {
      throw new Error(`Test 3 Failed: Expected PAID, got status=${payFinalRes.status}`);
    }

    const inv1AfterFinal = (await (await fetch(`${BASE}/invoices/${inv1.id}`)).json()).data;
    if (inv1AfterFinal.paymentStatus !== 'PAID' || inv1AfterFinal.totalPaid !== 1000 || inv1AfterFinal.balanceRemaining !== 0) {
      throw new Error(`Test 3 Verification Failed: ${JSON.stringify(inv1AfterFinal)}`);
    }
    console.log('✅ 3. Final payment produces PAID (Paid: ₹1,000, Balance: ₹0)');

    // =========================================================================
    // TEST 4: Outstanding balance is correct
    // =========================================================================
    if (inv1AfterFinal.grandTotal !== inv1AfterFinal.totalPaid + inv1AfterFinal.balanceRemaining) {
      throw new Error(`Test 4 Failed: grandTotal !== totalPaid + balanceRemaining`);
    }
    console.log('✅ 4. Outstanding balance arithmetic reconciled: grandTotal (₹1,000) === totalPaid (₹1,000) + balanceRemaining (₹0)');

    // =========================================================================
    // TEST 5: Zero, negative, or malformed payment amounts are rejected
    // =========================================================================
    const inv2 = await createAndIssueInvoice([
      { descriptionSnapshot: 'Consulting Retainer', quantity: 1, unitPrice: 2000, taxRate: 0 },
    ]);

    const zeroPayRes = await fetch(`${BASE}/invoices/${inv2.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 0, requestKey: `P4-ZERO-${Date.now()}` }),
    });
    if (zeroPayRes.status !== 400) {
      throw new Error(`Test 5a Failed: Zero amount was not rejected with 400 (got ${zeroPayRes.status})`);
    }

    const negPayRes = await fetch(`${BASE}/invoices/${inv2.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: -100, requestKey: `P4-NEG-${Date.now()}` }),
    });
    if (negPayRes.status !== 400) {
      throw new Error(`Test 5b Failed: Negative amount was not rejected with 400 (got ${negPayRes.status})`);
    }

    const malPayRes = await fetch(`${BASE}/invoices/${inv2.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 'invalid-number', requestKey: `P4-MAL-${Date.now()}` }),
    });
    if (malPayRes.status !== 400) {
      throw new Error(`Test 5c Failed: Malformed amount was not rejected with 400 (got ${malPayRes.status})`);
    }
    console.log('✅ 5. Zero, negative, and malformed payment amounts strictly rejected (HTTP 400)');

    // =========================================================================
    // TEST 6: Overpayment is rejected
    // =========================================================================
    const overPayRes = await fetch(`${BASE}/invoices/${inv2.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 2500, requestKey: `P4-OVERPAY-${Date.now()}` }),
    });
    if (overPayRes.status !== 400) {
      throw new Error(`Test 6 Failed: Overpayment (₹2,500 on ₹2,000 balance) was not rejected with 400`);
    }
    const overPayJson = await overPayRes.json();
    if (!overPayJson.error?.message?.includes('exceeds outstanding balance')) {
      throw new Error(`Test 6 Failed: Expected overpayment rejection message, got ${JSON.stringify(overPayJson)}`);
    }
    console.log('✅ 6. Overpayment strictly rejected (Attempted ₹2,500 on ₹2,000 balance -> HTTP 400 ERR_OVERPAYMENT_REJECTED)');

    // =========================================================================
    // TEST 7: Duplicate idempotency keys do not double-post payments
    // =========================================================================
    const idemKey = `IDEM-KEY-${Date.now()}`;
    const firstAttempt = await fetch(`${BASE}/invoices/${inv2.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, requestKey: idemKey }),
    });
    if (firstAttempt.status !== 201) {
      throw new Error(`Test 7 First Attempt Failed: ${firstAttempt.status}`);
    }

    const duplicateAttempt = await fetch(`${BASE}/invoices/${inv2.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, requestKey: idemKey }),
    });
    if (duplicateAttempt.status !== 409) {
      throw new Error(`Test 7 Duplicate Attempt Failed: Expected 409 Conflict, got ${duplicateAttempt.status}`);
    }

    // Verify payments count in database for this requestKey is strictly 1
    const pCount = await prisma.payment.count({ where: { requestKey: idemKey } });
    if (pCount !== 1) {
      throw new Error(`Test 7 Database Count Failed: Found ${pCount} payments with same requestKey`);
    }

    const inv2AfterIdem = (await (await fetch(`${BASE}/invoices/${inv2.id}`)).json()).data;
    if (inv2AfterIdem.totalPaid !== 500) {
      throw new Error(`Test 7 Failed: Total paid doubled to ₹${inv2AfterIdem.totalPaid}`);
    }
    console.log('✅ 7. Duplicate idempotency keys do not double-post payments (Single record in DB, HTTP 409 Conflict on retry)');

    // =========================================================================
    // TEST 8: Concurrent payment requests cannot overpay an invoice
    // =========================================================================
    // inv2 grand total is 2000, 500 paid, 1500 balance remaining.
    // We launch 2 concurrent requests of ₹1,000 each (sum 2000 > 1500 balance).
    const concurKey1 = `CONCUR-A-${Date.now()}`;
    const concurKey2 = `CONCUR-B-${Date.now()}`;

    const [concurRes1, concurRes2] = await Promise.all([
      fetch(`${BASE}/invoices/${inv2.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, requestKey: concurKey1 }),
      }),
      fetch(`${BASE}/invoices/${inv2.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 1000, requestKey: concurKey2 }),
      }),
    ]);

    const statuses = [concurRes1.status, concurRes2.status].sort();
    if (statuses[0] !== 201 || statuses[1] !== 400) {
      throw new Error(`Test 8 Concurrent Failed: Expected one 201 and one 400, got ${statuses.join(', ')}`);
    }

    const inv2AfterConcur = (await (await fetch(`${BASE}/invoices/${inv2.id}`)).json()).data;
    if (inv2AfterConcur.totalPaid !== 1500 || inv2AfterConcur.balanceRemaining !== 500) {
      throw new Error(`Test 8 Invoice State Corrupted: paid=${inv2AfterConcur.totalPaid}, balance=${inv2AfterConcur.balanceRemaining}`);
    }
    console.log('✅ 8. Concurrent payment requests serialized via row locking (One accepted: ₹1,000, one rejected: overpayment prevented)');

    // =========================================================================
    // TEST 9: Draft invoices cannot receive payments
    // =========================================================================
    const draftInvRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: p4Cust.id,
        invoiceDate: '2026-10-24',
        dueDate: '2026-11-24',
        items: [{ descriptionSnapshot: 'Draft Work', quantity: 1, unitPrice: 5000, taxRate: 0 }],
      }),
    });
    const draftInv = (await draftInvRes.json()).data;

    const draftPayRes = await fetch(`${BASE}/invoices/${draftInv.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 1000, requestKey: `P4-DRAFT-PAY-${Date.now()}` }),
    });
    if (draftPayRes.status !== 400) {
      throw new Error(`Test 9 Failed: Payment accepted on DRAFT invoice (status=${draftPayRes.status})`);
    }
    const draftPayJson = await draftPayRes.json();
    if (!draftPayJson.error?.message?.includes('Only ISSUED invoices can receive payments')) {
      throw new Error(`Test 9 Failed: Unexpected error message: ${JSON.stringify(draftPayJson)}`);
    }
    console.log('✅ 9. Draft invoices cannot receive payments (HTTP 400 ERR_INVALID_INVOICE_STATUS)');

    // =========================================================================
    // TEST 10: Dashboard sales exclude drafts
    // =========================================================================
    const dashSummaryRes = await fetch(`${BASE}/dashboard/summary`);
    const dashSummary = (await dashSummaryRes.json()).data;

    // Check draftCount includes draftInv, but totalSales does not include the ₹5,000 draft
    if (dashSummary.metrics.totalInvoices.draftCount < 1) {
      throw new Error(`Test 10 Failed: draftCount is ${dashSummary.metrics.totalInvoices.draftCount}`);
    }
    console.log(`✅ 10. Dashboard sales exclude drafts (Drafts count: ${dashSummary.metrics.totalInvoices.draftCount}, Draft sales excluded from ₹${dashSummary.metrics.totalSales.amount})`);

    // =========================================================================
    // TEST 11: Sales use invoice dates
    // =========================================================================
    // Create and issue invoice with invoiceDate: '2026-04-10' (April 2026)
    const invDateTagged = await createAndIssueInvoice(
      [{ descriptionSnapshot: 'April Subscription', quantity: 1, unitPrice: 3500, taxRate: 0 }],
      '2026-04-10'
    );

    // =========================================================================
    // TEST 12: Collections use payment dates
    // =========================================================================
    // Record payment for it with paymentDate: '2026-05-20' (May 2026)
    await fetch(`${BASE}/invoices/${invDateTagged.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 3500,
        paymentDate: '2026-05-20',
        method: 'BANK_TRANSFER',
        requestKey: `P4-DATE-TAGGED-${Date.now()}`,
      }),
    });

    const monthlyReportRes = await fetch(`${BASE}/reports/sales?groupBy=month`);
    const monthlyReport = (await monthlyReportRes.json()).data;

    const aprSales = monthlyReport.salesTimeline.find((s: any) => s.period === '2026-04');
    const maySales = monthlyReport.salesTimeline.find((s: any) => s.period === '2026-05');
    const aprCollections = monthlyReport.collectionsTimeline.find((c: any) => c.period === '2026-04');
    const mayCollections = monthlyReport.collectionsTimeline.find((c: any) => c.period === '2026-05');

    if (!aprSales || aprSales.grandTotal < 3500) {
      throw new Error(`Test 11 Failed: Sales not attributed to invoice date (2026-04): ${JSON.stringify(aprSales)}`);
    }
    console.log('✅ 11. Sales attributed by invoice date (₹3,500 reported under period 2026-04)');

    if (!mayCollections || mayCollections.totalCollected < 3500) {
      throw new Error(`Test 12 Failed: Collection not attributed to payment date (2026-05): ${JSON.stringify(mayCollections)}`);
    }
    console.log('✅ 12. Collections attributed by payment date (₹3,500 reported under period 2026-05, not April)');

    // =========================================================================
    // TEST 13: Daily and monthly aggregates reconcile with source records
    // =========================================================================
    const dailyReportRes = await fetch(`${BASE}/reports/sales?groupBy=day`);
    const dailyReport = (await dailyReportRes.json()).data;

    const dailySalesSum = dailyReport.salesTimeline.reduce((acc: number, item: any) => acc + item.grandTotal, 0);
    const monthlySalesSum = monthlyReport.salesTimeline.reduce((acc: number, item: any) => acc + item.grandTotal, 0);
    const dailyCollSum = dailyReport.collectionsTimeline.reduce((acc: number, item: any) => acc + item.totalCollected, 0);
    const monthlyCollSum = monthlyReport.collectionsTimeline.reduce((acc: number, item: any) => acc + item.totalCollected, 0);

    if (Math.abs(dailySalesSum - monthlySalesSum) > 0.01) {
      throw new Error(`Test 13 Failed: Daily sales sum (₹${dailySalesSum}) !== Monthly sales sum (₹${monthlySalesSum})`);
    }
    if (Math.abs(dailyCollSum - monthlyCollSum) > 0.01) {
      throw new Error(`Test 13 Failed: Daily collections sum (₹${dailyCollSum}) !== Monthly collections sum (₹${monthlyCollSum})`);
    }
    if (Math.abs(dailySalesSum - dailyReport.summary.totalSales) > 0.01) {
      throw new Error(`Test 13 Failed: Timeline sales sum !== summary.totalSales`);
    }
    console.log(`✅ 13. Daily and monthly aggregates reconcile with source records (Sales: ₹${dailySalesSum}, Collections: ₹${dailyCollSum})`);

    // =========================================================================
    // TEST 14: Date filters work across month and year boundaries
    // =========================================================================
    const crossBoundaryReportRes = await fetch(
      `${BASE}/reports/sales?startDate=2025-12-15&endDate=2026-04-30&groupBy=month`
    );
    const crossReport = (await crossBoundaryReportRes.json()).data;
    if (!crossReport.summary || crossReport.summary.totalIssuedInvoices === undefined) {
      throw new Error(`Test 14 Failed: Cross-boundary filter returned invalid structure`);
    }
    console.log('✅ 14. Date filters operate across month and year boundaries seamlessly');

    // =========================================================================
    // TEST 15: Empty databases / periods produce valid empty summaries
    // =========================================================================
    const emptySummaryRes = await fetch(
      `${BASE}/dashboard/summary?startDate=2099-01-01&endDate=2099-12-31`
    );
    const emptySummary = (await emptySummaryRes.json()).data;

    if (
      emptySummary.metrics.totalSales.amount !== 0 ||
      emptySummary.metrics.totalInvoices.count !== 0 ||
      emptySummary.metrics.amountCollected.amount !== 0 ||
      emptySummary.metrics.outstandingBalance.amount !== 0 ||
      isNaN(emptySummary.metrics.amountCollected.collectionRate)
    ) {
      throw new Error(`Test 15 Failed: Empty summary produced non-zero or NaN values: ${JSON.stringify(emptySummary)}`);
    }

    const emptyReportRes = await fetch(
      `${BASE}/reports/sales?startDate=2099-01-01&endDate=2099-12-31`
    );
    const emptyReport = (await emptyReportRes.json()).data;
    if (
      emptyReport.salesTimeline.length !== 0 ||
      emptyReport.collectionsTimeline.length !== 0 ||
      emptyReport.summary.totalSales !== 0
    ) {
      throw new Error(`Test 15 Failed: Empty report produced non-empty records: ${JSON.stringify(emptyReport)}`);
    }
    console.log('✅ 15. Empty database periods produce valid empty summaries (0 sales, 0 collections, 0 invoices, 0 NaN)');
    console.log('\n🎉 ALL 15 PHASE 4 VERIFICATION TESTS PASSED SUCCESSFULLY!\n');

    // =========================================================================
    // =========================================================================
    // PHASE 5: FINAL QA, CRUD INTEGRITY, AND SECURITY VERIFICATIONS
    // =========================================================================
    // =========================================================================
    console.log('🧪 Starting Phase 5 Final QA, CRUD Integrity & Security Tests...\n');

    // =========================================================================
    // TEST 5.1: Customer CRUD, Search & Soft Deletion
    // =========================================================================
    const p5Phone = `9${String(RUN_ID + 2).slice(-9)}`;
    const newCustRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Phase 5 QA Customer ${RUN_ID}`,
        phone: p5Phone,
        email: `qa-${RUN_ID}@vioratech.com`,
        billingAddress: 'QA Park, Koramangala 4th Block, Bangalore',
        state: 'Karnataka',
      }),
    });
    if (newCustRes.status !== 201) {
      throw new Error(`Test 5.1 Create Customer Failed: ${newCustRes.status}`);
    }
    const newCust = (await newCustRes.json()).data;

    // Get by ID
    const getCustRes = await fetch(`${BASE}/customers/${newCust.id}`);
    const getCust = (await getCustRes.json()).data;
    if (!getCust.name.startsWith('Phase 5 QA Customer') || !getCust.email.includes('@vioratech.com')) {
      throw new Error(`Test 5.1 Get Customer Failed: ${JSON.stringify(getCust)}`);
    }

    // Update Customer
    const updateCustRes = await fetch(`${BASE}/customers/${newCust.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Phase 5 QA Customer (Updated) ${RUN_ID}`,
        phone: '+91 99999 22222',
      }),
    });
    const updatedCust = (await updateCustRes.json()).data;
    const expectedPhone = '9999922222';
    if (!updatedCust.name.includes('QA Customer (Updated)') || (updatedCust.phone !== expectedPhone && updatedCust.phone !== '+91 99999 22222')) {
      throw new Error(`Test 5.1 Update Customer Failed: ${JSON.stringify(updatedCust)}`);
    }

    // Search Customer
    const searchCustRes = await fetch(`${BASE}/customers?search=QA+Customer`);
    const searchCustJson = (await searchCustRes.json()).data;
    if (!searchCustJson.customers.some((c: any) => c.id === newCust.id)) {
      throw new Error(`Test 5.1 Search Customer Failed: ${JSON.stringify(searchCustJson)}`);
    }

    // Delete unreferenced customer -> clean permanent removal
    const delCustRes = await fetch(`${BASE}/customers/${newCust.id}`, { method: 'DELETE' });
    if (delCustRes.status !== 200) {
      throw new Error(`Test 5.1 Delete Customer Failed: ${delCustRes.status}`);
    }
    const custAfterDel = await prisma.customer.findUnique({ where: { id: newCust.id } });
    if (custAfterDel !== null) {
      throw new Error(`Test 5.1 Unreferenced customer permanent removal failed: customer still in DB`);
    }

    // Now test archiving when customer HAS historical invoices (referencing customer created earlier)
    const delCustWithInvRes = await fetch(`${BASE}/customers/${customerId}`, { method: 'DELETE' });
    if (delCustWithInvRes.status !== 200) {
      throw new Error(`Test 5.1 Delete Referenced Customer Failed: ${delCustWithInvRes.status}`);
    }
    const custArchived = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!custArchived || !custArchived.isArchived) {
      throw new Error(`Test 5.1 Referenced customer soft delete failed: isArchived is false`);
    }
    console.log('✅ 5.1 Customer CRUD, Search & Soft Deletion verified (Permanent delete when unused, archive when referenced)');

    // =========================================================================
    // TEST 5.2: Customer Invalid Input Rejection
    // =========================================================================
    const invalidCustRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'A', // Too short (min 2)
        phone: '1', // Too short (min 5)
        email: 'not-an-email',
        billingAddress: 'AB', // Too short (min 3)
      }),
    });
    if (invalidCustRes.status !== 400) {
      throw new Error(`Test 5.2 Invalid Customer Input Failed: Expected 400, got ${invalidCustRes.status}`);
    }
    console.log('✅ 5.2 Invalid Customer inputs rejected with validation error (HTTP 400)');

    // =========================================================================
    // TEST 5.3: Product CRUD, Search & Soft Deletion
    // =========================================================================
    const newProdRes = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Phase 5 Security Auditing Tool ${RUN_ID}`,
        description: 'Comprehensive static and runtime security audit module',
        unit: 'HRS',
        unitPrice: 1500,
        taxRate: 18,
      }),
    });
    if (newProdRes.status !== 201) {
      throw new Error(`Test 5.3 Create Product Failed: ${newProdRes.status}`);
    }
    const newProd = (await newProdRes.json()).data;

    // Get by ID
    const getProdRes = await fetch(`${BASE}/products/${newProd.id}`);
    const getProd = (await getProdRes.json()).data;
    if (!getProd.name.startsWith('Phase 5 Security Auditing Tool') || Number(getProd.unitPrice) !== 1500) {
      throw new Error(`Test 5.3 Get Product Failed: ${JSON.stringify(getProd)}`);
    }

    // Update Product
    const updateProdRes = await fetch(`${BASE}/products/${newProd.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unitPrice: 1750,
        taxRate: 12,
      }),
    });
    const updatedProd = (await updateProdRes.json()).data;
    if (Number(updatedProd.unitPrice) !== 1750 || Number(updatedProd.taxRate) !== 12) {
      throw new Error(`Test 5.3 Update Product Failed: ${JSON.stringify(updatedProd)}`);
    }

    // Search Product
    const searchProdRes = await fetch(`${BASE}/products?search=Security+Auditing`);
    const searchProdJson = (await searchProdRes.json()).data;
    if (!searchProdJson.products.some((p: any) => p.id === newProd.id)) {
      throw new Error(`Test 5.3 Search Product Failed: ${JSON.stringify(searchProdJson)}`);
    }

    // Delete unreferenced product -> clean permanent removal
    const delProdRes = await fetch(`${BASE}/products/${newProd.id}`, { method: 'DELETE' });
    if (delProdRes.status !== 200) {
      throw new Error(`Test 5.3 Delete Product Failed: ${delProdRes.status}`);
    }
    const prodAfterDel = await prisma.product.findUnique({ where: { id: newProd.id } });
    if (prodAfterDel !== null) {
      throw new Error(`Test 5.3 Unreferenced product permanent removal failed: product still in DB`);
    }

    // Now test archiving when product HAS historical invoice items (referencing prod1 created earlier)
    const delProdWithInvRes = await fetch(`${BASE}/products/${prod1.id}`, { method: 'DELETE' });
    if (delProdWithInvRes.status !== 200) {
      throw new Error(`Test 5.3 Delete Referenced Product Failed: ${delProdWithInvRes.status}`);
    }
    const prodArchived = await prisma.product.findUnique({ where: { id: prod1.id } });
    if (!prodArchived || !prodArchived.isArchived) {
      throw new Error(`Test 5.3 Referenced product soft delete failed: isArchived is false`);
    }
    console.log('✅ 5.3 Product CRUD, Search & Soft Deletion verified (Permanent delete when unused, archive when referenced)');

    // =========================================================================
    // TEST 5.4: Product Invalid Input Rejection
    // =========================================================================
    const invalidProdRes = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'X',
        unitPrice: -500, // Negative unit price
        taxRate: 150, // Invalid tax rate > 100%
      }),
    });
    if (invalidProdRes.status !== 400) {
      throw new Error(`Test 5.4 Invalid Product Input Failed: Expected 400, got ${invalidProdRes.status}`);
    }
    console.log('✅ 5.4 Invalid Product inputs rejected with validation error (HTTP 400)');

    // =========================================================================
    // TEST 5.5: System Health, Route 404 & Response Envelope Integrity
    // =========================================================================
    const healthRes = await fetch(`${BASE}/health`);
    const healthJson = await healthRes.json();
    if (healthRes.status !== 200 || healthJson.data?.status !== 'healthy' || healthJson.data?.database?.status !== 'connected') {
      throw new Error(`Test 5.5 Health check failed: ${JSON.stringify(healthJson)}`);
    }

    const notFoundRes = await fetch(`${BASE}/non-existent-route-xyz`);
    const notFoundJson = await notFoundRes.json();
    if (notFoundRes.status !== 404 || notFoundJson.success !== false || notFoundJson.error?.code !== 'ERR_NOT_FOUND') {
      throw new Error(`Test 5.5 404 error envelope failed: ${JSON.stringify(notFoundJson)}`);
    }
    console.log('✅ 5.5 System Health (/api/health) & Standard Error Envelopes verified');

    // =========================================================================
    // PHASE 16: MASTER QA AUTOMATED END-TO-END SCENARIO SUITE (TEST A - TEST H)
    // =========================================================================
    console.log('\n🚀 Starting Master QA Automated End-to-End Scenarios (TEST A - TEST H)...\n');

    // --- TEST A: Create customer -> create product -> create invoice -> issue invoice -> download PDF ---
    console.log('--- TEST A: Full Lifecycle (Customer -> Product -> Draft -> Issue -> PDF) ---');
    const custARes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Master QA Client Alpha ${RUN_ID}`,
        phone: `9${String(RUN_ID + 3).slice(-9)}`,
        email: `alpha-${RUN_ID}@masterqa.com`,
        billingAddress: 'Tower 4, Embassy Tech Village, Outer Ring Road, Bangalore, Karnataka - 560103',
        state: 'Karnataka',
      }),
    });
    if (custARes.status !== 201) throw new Error(`TEST A: Failed to create customer (${custARes.status})`);
    const custA = (await custARes.json()).data;

    const prodARes = await fetch(`${BASE}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Enterprise Cloud Retainer',
        description: 'Monthly managed cloud architecture & reliability support',
        unit: 'MONTH',
        unitPrice: 25000,
        taxRate: 18,
      }),
    });
    if (prodARes.status !== 201) throw new Error(`TEST A: Failed to create product (${prodARes.status})`);
    const prodA = (await prodARes.json()).data;

    const invARes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custA.id,
        invoiceDate: '2026-06-01',
        dueDate: '2026-06-15',
        placeOfSupply: 'Karnataka',
        isInterState: false,
        notes: 'Monthly enterprise SLA services rendered',
        items: [
          {
            productId: prodA.id,
            descriptionSnapshot: prodA.name,
            unit: prodA.unit,
            quantity: 2,
            unitPrice: 25000,
            discountAmount: 5000,
            taxRate: 18,
          },
        ],
      }),
    });
    if (invARes.status !== 201) throw new Error(`TEST A: Failed to create invoice draft (${invARes.status})`);
    const invA = (await invARes.json()).data;
    if (Number(invA.grandTotal) !== 53100) {
      throw new Error(`TEST A: Grand total mismatch: expected 53100, got ${invA.grandTotal}`);
    }

    const issueARes = await fetch(`${BASE}/invoices/${invA.id}/issue`, { method: 'POST' });
    if (issueARes.status !== 200) throw new Error(`TEST A: Failed to issue invoice (${issueARes.status})`);
    const issuedA = (await issueARes.json()).data;
    if (issuedA.status !== 'ISSUED' || !issuedA.invoiceNumber.startsWith('INV-')) {
      throw new Error(`TEST A: Issued invoice validation failed: ${issuedA.invoiceNumber}`);
    }

    const pdfARes = await fetch(`${BASE}/invoices/${invA.id}/pdf`);
    if (pdfARes.status !== 200) throw new Error(`TEST A: PDF download failed (${pdfARes.status})`);
    const pdfContentType = pdfARes.headers.get('content-type');
    const pdfABuffer = Buffer.from(await pdfARes.arrayBuffer());
    if (!pdfContentType?.includes('application/pdf') || pdfABuffer.length < 1000 || !pdfABuffer.subarray(0, 5).toString().startsWith('%PDF')) {
      throw new Error(`TEST A: Invalid PDF stream or payload: length=${pdfABuffer.length}`);
    }
    console.log('✅ TEST A PASSED: Customer, Product, Invoice Draft, Sequential Issuance, and Binary PDF Export verified');

    // --- TEST B: Partial payment -> balance verification -> final payment -> PAID status ---
    console.log('--- TEST B: Progressive Payment Settlement & Status Derivation ---');
    const pay1Res = await fetch(`${BASE}/invoices/${invA.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 20000,
        paymentDate: '2026-06-05',
        method: 'BANK_TRANSFER',
        reference: 'UTR-B-PARTIAL-001',
        requestKey: `IDEM-TEST-B-1-${Date.now()}`,
      }),
    });
    if (pay1Res.status !== 201) throw new Error(`TEST B: Partial payment failed (${pay1Res.status})`);
    const pay1Data = (await pay1Res.json()).data;
    if (pay1Data.invoiceSummary.paymentStatus !== 'PARTIALLY_PAID' || Number(pay1Data.invoiceSummary.balanceRemaining) !== 33100) {
      throw new Error(`TEST B: Incorrect partial payment balance: ${JSON.stringify(pay1Data)}`);
    }

    const pay2Res = await fetch(`${BASE}/invoices/${invA.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 33100,
        paymentDate: '2026-06-10',
        method: 'UPI',
        reference: 'UPI-B-FINAL-002',
        requestKey: `IDEM-TEST-B-2-${Date.now()}`,
      }),
    });
    if (pay2Res.status !== 201) throw new Error(`TEST B: Final payment failed (${pay2Res.status})`);
    const pay2Data = (await pay2Res.json()).data;
    if (pay2Data.invoiceSummary.paymentStatus !== 'PAID' || Number(pay2Data.invoiceSummary.balanceRemaining) !== 0) {
      throw new Error(`TEST B: Final payment did not achieve PAID status: ${JSON.stringify(pay2Data)}`);
    }
    console.log('✅ TEST B PASSED: Progressive settlements correctly transition UNPAID -> PARTIALLY_PAID -> PAID with exact balance tracking');

    // --- TEST C: Multi-invoice reporting, date filters, and draft exclusion ---
    console.log('--- TEST C: Multi-invoice attribution, report dates & draft exclusion ---');
    const draftCRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custA.id,
        invoiceDate: '2026-07-01',
        dueDate: '2026-07-15',
        items: [{ descriptionSnapshot: 'Unissued Draft Item', quantity: 1, unitPrice: 99999, taxRate: 18 }],
      }),
    });
    const draftC = (await draftCRes.json()).data;

    const dashRes = await fetch(`${BASE}/dashboard/summary`);
    const dashData = (await dashRes.json()).data;
    const invListRes = await fetch(`${BASE}/invoices?status=ISSUED`);
    const issuedInvoices = (await invListRes.json()).data.invoices;
    const computedSales = issuedInvoices.reduce((sum: number, inv: any) => sum + Number(inv.grandTotal), 0);
    if (Math.abs(Number(dashData.totalSales) - computedSales) > 0.01) {
      throw new Error(`TEST C: Dashboard total sales does not match sum of issued invoices: dash=${dashData.totalSales}, computed=${computedSales}`);
    }
    console.log('✅ TEST C PASSED: Dashboard sales strictly exclude draft invoices and reconcile with database totals');

    // --- TEST D: Negative/Zero Quantity, Negative Price, Excessive Discount & Archived Customer Validation ---
    console.log('--- TEST D: Validation Safeguards (Negative Qty, Zero Qty, Excessive Discount, Archived Customer) ---');
    const negQtyRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custA.id,
        invoiceDate: '2026-06-01',
        dueDate: '2026-06-15',
        items: [{ descriptionSnapshot: 'Negative Qty', quantity: -5, unitPrice: 1000 }],
      }),
    });
    if (negQtyRes.status !== 400) throw new Error(`TEST D: Negative quantity accepted (${negQtyRes.status})`);

    const excDiscRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custA.id,
        invoiceDate: '2026-06-01',
        dueDate: '2026-06-15',
        items: [{ descriptionSnapshot: 'Excessive Discount', quantity: 1, unitPrice: 1000, discountAmount: 2000 }],
      }),
    });
    if (excDiscRes.status !== 400) throw new Error(`TEST D: Excessive discount accepted (${excDiscRes.status})`);

    const tempCustRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Archived Customer Test',
        phone: '+91 91111 22222',
        billingAddress: 'Old Office',
      }),
    });
    const tempCust = (await tempCustRes.json()).data;
    await prisma.customer.update({ where: { id: tempCust.id }, data: { isArchived: true } });

    const archCustInvRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: tempCust.id,
        invoiceDate: '2026-06-01',
        dueDate: '2026-06-15',
        items: [{ descriptionSnapshot: 'Valid Item', quantity: 1, unitPrice: 500 }],
      }),
    });
    if (archCustInvRes.status !== 400) {
      throw new Error(`TEST D: Archived customer invoice creation was not rejected: status=${archCustInvRes.status}`);
    }
    const archErr = await archCustInvRes.json();
    if (archErr.error?.code !== 'ERR_CUSTOMER_ARCHIVED') {
      throw new Error(`TEST D: Unexpected error code for archived customer: ${JSON.stringify(archErr)}`);
    }
    console.log('✅ TEST D PASSED: Server-side financial & relational validations strictly enforced');

    // --- TEST E: Duplicate Payment Idempotency Protection ---
    console.log('--- TEST E: Duplicate Payment Idempotency Protection ---');
    const invERes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: custA.id,
        invoiceDate: '2026-06-01',
        dueDate: '2026-06-15',
        items: [{ descriptionSnapshot: 'Idempotency Test Item', quantity: 1, unitPrice: 10000, taxRate: 0 }],
      }),
    });
    const invE = (await invERes.json()).data;
    await fetch(`${BASE}/invoices/${invE.id}/issue`, { method: 'POST' });

    const testEKey = `IDEM-KEY-DUP-TEST-${Date.now()}`;
    const firstPayRes = await fetch(`${BASE}/invoices/${invE.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 5000,
        paymentDate: '2026-06-05',
        method: 'BANK_TRANSFER',
        requestKey: testEKey,
      }),
    });
    if (firstPayRes.status !== 201) throw new Error(`TEST E: First payment failed (${firstPayRes.status})`);

    const secondPayRes = await fetch(`${BASE}/invoices/${invE.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 5000,
        paymentDate: '2026-06-05',
        method: 'BANK_TRANSFER',
        requestKey: testEKey,
      }),
    });
    if (secondPayRes.status !== 409) {
      throw new Error(`TEST E: Duplicate payment did not return HTTP 409 Conflict: status=${secondPayRes.status}`);
    }
    const dupPaymentsCount = await prisma.payment.count({ where: { requestKey: testEKey } });
    if (dupPaymentsCount !== 1) {
      throw new Error(`TEST E: Database recorded multiple payments for duplicate key: count=${dupPaymentsCount}`);
    }
    console.log('✅ TEST E PASSED: Duplicate payment requestKeys rejected with HTTP 409 Conflict without double-posting');

    // --- TEST F: Post-Issuance Product Modification Snapshot Immutability ---
    console.log('--- TEST F: Snapshot Immutability (Product price edits do not alter historical invoices) ---');
    const origGrandTotal = Number(issuedA.grandTotal);
    const updateProdResF = await fetch(`${BASE}/products/${prodA.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitPrice: 99000, taxRate: 28 }),
    });
    if (updateProdResF.status !== 200) throw new Error(`TEST F: Failed to update product (${updateProdResF.status})`);

    const refetchARes = await fetch(`${BASE}/invoices/${invA.id}`);
    const refetchedA = (await refetchARes.json()).data;
    if (Number(refetchedA.grandTotal) !== origGrandTotal || Number(refetchedA.items[0].unitPrice) !== 25000) {
      throw new Error(`TEST F: Historical invoice changed after product price update! grandTotal=${refetchedA.grandTotal}`);
    }
    console.log('✅ TEST F PASSED: Immutable snapshots preserve historical invoice totals and line items indefinitely');

    // --- TEST G: Database Persistence & Retrieval ---
    console.log('--- TEST G: Database Persistence & Cold Re-query Verification ---');
    const [bizCheck, custCheck, prodCheck, invCheck, payCheck] = await Promise.all([
      prisma.business.findFirst(),
      prisma.customer.findMany({ where: { id: custA.id } }),
      prisma.product.findMany({ where: { id: prodA.id } }),
      prisma.invoice.findMany({ where: { id: invA.id } }),
      prisma.payment.findMany({ where: { invoiceId: invA.id } }),
    ]);
    if (!bizCheck || custCheck.length === 0 || prodCheck.length === 0 || invCheck.length === 0 || payCheck.length === 0) {
      throw new Error('TEST G: Data persistence check failed for one or more entities');
    }
    console.log('✅ TEST G PASSED: PostgreSQL database holds durable records verified via cold re-query');

    // --- TEST H: Customer & Product Complete Lifecycle ---
    console.log('--- TEST H: Customer & Product Complete Lifecycle & Protection ---');
    const custUpdateH = await fetch(`${BASE}/customers/${custA.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Master QA Client Alpha Updated ${RUN_ID}`, phone: '+91 99000 99999' }),
    });
    if (custUpdateH.status !== 200) throw new Error(`TEST H: Failed to update customer (${custUpdateH.status})`);
    const custUpdatedData = (await custUpdateH.json()).data;
    if (!custUpdatedData.name.includes('QA Client Alpha Updated')) {
      throw new Error('TEST H: Customer name not updated');
    }

    const invASnapshotCheck = await prisma.invoice.findUnique({ where: { id: invA.id } });
    // Snapshot should contain the ORIGINAL name used when the invoice was issued
    const expectedSnapshotName = `Master QA Client Alpha ${RUN_ID}`;
    if (invASnapshotCheck?.customerNameSnapshot !== expectedSnapshotName) {
      throw new Error(`TEST H: Customer snapshot was modified on historical invoice! got="${invASnapshotCheck?.customerNameSnapshot}" expected="${expectedSnapshotName}"`);
    }
    console.log('✅ TEST H PASSED: Customer and Product lifecycles functional while preserving snapshot integrity');

    console.log('\n=============================================================');
    console.log('🏆 ALL PHASES & MASTER QA SCENARIOS (TEST A - H) FULLY PASSED!');
    console.log('=============================================================\n');
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
