import http from 'http';
import { createApp } from './src/app';
import { prisma } from './src/config/prisma';
import { calculateLineItem, calculateInvoiceTotals } from './src/utils/money';
import { validateAndNormalizeIndianPhone, validateAndNormalizeGSTIN } from './src/utils/validators';
import { generateInvoicePdfStream, InvoicePdfData } from './src/services/pdf.service';

async function runStabilizationTests() {
  console.log('🧪 Starting Bug-Fix & Software Stabilization Verification Suite (B1 - B23)...\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5003, () => resolve()));
  const BASE = 'http://localhost:5003/api';

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(msg);
    } else {
      passed++;
      console.log(`✅ PASSED: ${msg}`);
    }
  }

  try {
    // -------------------------------------------------------------------------
    // B3: Quantity Precision (Independent of Currency Rounding)
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B3: Quantity Precision ---');
    const b3Calc = calculateLineItem({
      descriptionSnapshot: 'Fractional Qty Test',
      quantity: 0.125,
      unitPrice: 100,
      taxRate: 18,
    });
    // Gross: 0.125 * 100 = 12.50. Tax: 12.50 * 18% = 2.25. Total: 14.75
    assert(
      b3Calc.quantity.toString() === '0.125',
      `Quantity 0.125 preserved without 2-decimal truncation (got ${b3Calc.quantity.toString()})`
    );
    assert(
      b3Calc.taxableAmount.toString() === '12.5',
      `Taxable amount is exactly ₹12.50 (got ₹${b3Calc.taxableAmount.toString()})`
    );
    assert(
      b3Calc.taxAmount.toString() === '2.25',
      `Tax amount is exactly ₹2.25 (got ₹${b3Calc.taxAmount.toString()})`
    );
    assert(
      b3Calc.lineTotal.toString() === '14.75',
      `Total amount is ₹14.75 as required by review (got ₹${b3Calc.lineTotal.toString()})`
    );

    // Test 0.005 and 2.75
    const b3Small = calculateLineItem({ descriptionSnapshot: 'Small', quantity: 0.005, unitPrice: 1000, taxRate: 18 });
    assert(b3Small.quantity.toString() === '0.005', 'Quantity 0.005 preserved');
    assert(b3Small.lineTotal.toString() === '5.9', '0.005 * 1000 = 5.00 + 0.90 = ₹5.90');

    // -------------------------------------------------------------------------
    // B6: Indian 10-Digit Mobile Number Normalization & Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B6: Phone Number Validation ---');
    assert(validateAndNormalizeIndianPhone('9876543210') === '9876543210', '10-digit raw number normalizes cleanly');
    assert(validateAndNormalizeIndianPhone('+91 98765 43210') === '9876543210', '+91 format normalizes to 10 digits');
    assert(validateAndNormalizeIndianPhone('09876543210') === '9876543210', 'Leading 0 format normalizes to 10 digits');
    assert(validateAndNormalizeIndianPhone('+91-98765-43210') === '9876543210', 'Hyphenated +91 format normalizes to 10 digits');
    
    let phoneErrorCaught = false;
    try {
      validateAndNormalizeIndianPhone('19876543210'); // 11 digits not starting with 0
    } catch {
      phoneErrorCaught = true;
    }
    assert(phoneErrorCaught, '11-digit invalid number rejected with error (no silent truncation)');

    let letterErrorCaught = false;
    try {
      validateAndNormalizeIndianPhone('98765abcd0');
    } catch {
      letterErrorCaught = true;
    }
    assert(letterErrorCaught, 'Phone containing letters rejected with validation error');

    // -------------------------------------------------------------------------
    // B9: GSTIN Format Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B9: GSTIN Validation ---');
    assert(validateAndNormalizeGSTIN('29ABCDE1234F1Z5') === '29ABCDE1234F1Z5', 'Valid 15-character GSTIN accepted');
    assert(validateAndNormalizeGSTIN('29abcde1234f1z5') === '29ABCDE1234F1Z5', 'Lowercase GSTIN normalized to uppercase');
    assert(validateAndNormalizeGSTIN('') === null, 'Blank GSTIN returns null');
    assert(validateAndNormalizeGSTIN(null) === null, 'Null GSTIN returns null');

    let badGstinCaught = false;
    try {
      validateAndNormalizeGSTIN('BAD');
    } catch {
      badGstinCaught = true;
    }
    assert(badGstinCaught, "Invalid GSTIN 'BAD' strictly rejected");

    let shortGstinCaught = false;
    try {
      validateAndNormalizeGSTIN('29ABCDE1234F1Z'); // 14 chars
    } catch {
      shortGstinCaught = true;
    }
    assert(shortGstinCaught, '14-character GSTIN strictly rejected');

    // -------------------------------------------------------------------------
    // B17: Sub-Paisa Payment Rejection
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B17: Payment Currency Precision ---');
    // Ensure company phone & email are configured for invoice issuance
    await fetch(`${BASE}/business`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Viora Tech Solutions Pvt Ltd',
        address: '102 Innovation Hub, Bengaluru, Karnataka - 560100',
        phone: '9876543210',
        email: 'billing@vioratech.com',
        gstin: '29ABCDE1234F1Z5',
        state: 'Karnataka',
      }),
    });

    // Create a unique test customer
    const custRes = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Test Stabilization Client ${Date.now()}`,
        phone: '9876512340',
        email: `client-${Date.now()}@test.in`,
        billingAddress: '100 MG Road, Bengaluru, Karnataka - 560001',
        gstin: '29AABCT1334F1Z8',
        state: 'Karnataka',
      }),
    });
    const customer = (await custRes.json()).data;

    // Create test invoice
    const invRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer.id,
        invoiceDate: '2026-11-09',
        dueDate: '2026-11-24',
        placeOfSupply: 'Karnataka',
        isInterState: false,
        items: [
          {
            descriptionSnapshot: 'Consulting Service',
            unit: 'HRS',
            quantity: 2,
            unitPrice: 500,
            taxRate: 18,
          },
        ],
      }),
    });
    const draftInv = (await invRes.json()).data;

    // Issue invoice
    const issueRes = await fetch(`${BASE}/invoices/${draftInv.id}/issue`, { method: 'POST' });
    const issuedInv = (await issueRes.json()).data;

    // Attempt sub-paisa payment (0.005)
    const subPaisaRes = await fetch(`${BASE}/invoices/${issuedInv.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 0.005,
        requestKey: `REQ-SUBPAISA-${Date.now()}`,
      }),
    });
    assert(subPaisaRes.status === 400, `Sub-paisa payment 0.005 rejected with HTTP 400 (got ${subPaisaRes.status})`);

    // Valid 2-decimal payment succeeds
    const validPayRes = await fetch(`${BASE}/invoices/${issuedInv.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 100.50,
        requestKey: `REQ-VALIDPAY-${Date.now()}`,
      }),
    });
    assert(validPayRes.status === 201, `Valid 2-decimal payment of ₹100.50 recorded successfully (HTTP 201)`);

    // -------------------------------------------------------------------------
    // B1: Concurrent Issuing of Same Draft (Race Condition Prevention)
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B1: Concurrent Invoice Issuance ---');
    // Create draft to race
    const raceDraftRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer.id,
        invoiceDate: '2026-11-09',
        dueDate: '2026-11-24',
        items: [{ descriptionSnapshot: 'Race Item', quantity: 1, unitPrice: 200, taxRate: 18 }],
      }),
    });
    const raceDraft = (await raceDraftRes.json()).data;

    // Fire 5 simultaneous issue requests for the EXACT same draft
    const racePromises = Array.from({ length: 5 }, () =>
      fetch(`${BASE}/invoices/${raceDraft.id}/issue`, { method: 'POST' })
    );
    const raceResponses = await Promise.all(racePromises);
    const raceStatuses = raceResponses.map((r) => r.status);

    const successCount = raceStatuses.filter((s) => s === 200).length;
    const conflictCount = raceStatuses.filter((s) => s === 409 || s === 400).length;

    assert(successCount === 1, `Exactly one concurrent issue request succeeded (got ${successCount})`);
    assert(
      conflictCount === 4,
      `All 4 competing issue requests failed safely with 409 Conflict/400 (got ${conflictCount})`
    );

    // -------------------------------------------------------------------------
    // B2: Draft Number Collision Immunity (50 Concurrent Draft Creations)
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B2: 50 Parallel Draft Creations ---');
    const parallelDraftPromises = Array.from({ length: 50 }, () =>
      fetch(`${BASE}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer.id,
          invoiceDate: '2026-11-09',
          dueDate: '2026-11-24',
          items: [{ descriptionSnapshot: 'Parallel Draft Item', quantity: 1, unitPrice: 100, taxRate: 0 }],
        }),
      })
    );
    const parallelDraftResponses = await Promise.all(parallelDraftPromises);
    const allDraftsOk = parallelDraftResponses.every((r) => r.status === 201);
    const draftPayloads = await Promise.all(parallelDraftResponses.map((r) => r.json()));
    const draftNumbers = draftPayloads.map((p) => p.data.invoiceNumber);
    const uniqueDraftNumbers = new Set(draftNumbers);

    assert(allDraftsOk, 'All 50 parallel draft creation requests succeeded with HTTP 201');
    assert(uniqueDraftNumbers.size === 50, `All 50 draft numbers are 100% unique (no timestamp collisions)`);

    // -------------------------------------------------------------------------
    // B20: Zero-Total Invoice Issue Prevention
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B20: Zero-Total Invoice Issue ---');
    const zeroDraftRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer.id,
        invoiceDate: '2026-11-09',
        dueDate: '2026-11-24',
        items: [{ descriptionSnapshot: 'Free Trial', quantity: 1, unitPrice: 0, taxRate: 0 }],
      }),
    });
    const zeroDraft = (await zeroDraftRes.json()).data;
    const zeroIssueRes = await fetch(`${BASE}/invoices/${zeroDraft.id}/issue`, { method: 'POST' });
    assert(
      zeroIssueRes.status === 400,
      `Zero-total invoice issue blocked with HTTP 400 ERR_ZERO_TOTAL_INVOICE (got ${zeroIssueRes.status})`
    );

    // -------------------------------------------------------------------------
    // B11: Draft Deletion and Invoice Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B11: Draft Deletion & Cancellation ---');
    // Delete draft
    const deleteDraftRes = await fetch(`${BASE}/invoices/${zeroDraft.id}`, { method: 'DELETE' });
    assert(deleteDraftRes.status === 200, 'Draft invoice deleted successfully with HTTP 200');

    // Attempt to delete issued invoice -> must fail with 409
    const deleteIssuedRes = await fetch(`${BASE}/invoices/${issuedInv.id}`, { method: 'DELETE' });
    assert(deleteIssuedRes.status === 409, 'Attempt to delete issued invoice rejected with HTTP 409');

    // Create an unpaid issued invoice to test cancellation
    const cancelDraftRes = await fetch(`${BASE}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: customer.id,
        invoiceDate: '2026-11-09',
        dueDate: '2026-11-24',
        items: [{ descriptionSnapshot: 'Service To Cancel', quantity: 1, unitPrice: 500, taxRate: 18 }],
      }),
    });
    const toCancelDraft = (await cancelDraftRes.json()).data;
    const issueToCancelRes = await fetch(`${BASE}/invoices/${toCancelDraft.id}/issue`, { method: 'POST' });
    const toCancelIssued = (await issueToCancelRes.json()).data;

    const cancelRes = await fetch(`${BASE}/invoices/${toCancelIssued.id}/cancel`, { method: 'POST' });
    const cancelledInv = (await cancelRes.json()).data;
    assert(cancelRes.status === 200, `Issued unpaid invoice successfully cancelled (HTTP 200)`);
    assert(cancelledInv.status === 'CANCELLED', `Invoice status transitioned to CANCELLED`);

    // -------------------------------------------------------------------------
    // B8: Issued Invoice Detail API Returns Frozen Snapshots
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B8: Snapshot Freezing ---');
    // Change customer name in master table
    await fetch(`${BASE}/customers/${customer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'MODIFIED CUSTOMER NAME INC.',
      }),
    });

    const issuedDetailRes = await fetch(`${BASE}/invoices/${issuedInv.id}`);
    const issuedDetail = (await issuedDetailRes.json()).data;
    assert(
      issuedDetail.customer.name === customer.name,
      `Issued invoice detail retains frozen customer name '${customer.name}' instead of live modified name`
    );

    // -------------------------------------------------------------------------
    // B7: PDF Pagination & Page Count
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B7: PDF Generation Pagination ---');
    const testPdfData: InvoicePdfData = {
      invoiceNumber: 'INV-2026-TEST01',
      invoiceDate: '2026-11-09',
      dueDate: '2026-11-24',
      status: 'ISSUED',
      isInterState: false,
      subtotal: 1000,
      discountTotal: 0,
      taxableAmount: 1000,
      cgstTotal: 90,
      sgstTotal: 90,
      igstTotal: 0,
      taxTotal: 180,
      grandTotal: 1180,
      business: {
        name: 'Viora Tech Solutions',
        address: '102 Innovation Hub, Bengaluru',
        phone: '9876543210',
        email: 'billing@vioratech.com',
      },
      customer: {
        name: 'Test Customer',
        address: '123 Test Street, Bengaluru',
      },
      items: [
        {
          description: 'Single Line Item',
          quantity: 1,
          unitPrice: 1000,
          discountAmount: 0,
          taxableAmount: 1000,
          taxRate: 18,
          taxAmount: 180,
          lineTotal: 1180,
        },
      ],
    };

    const pdfDoc = generateInvoicePdfStream(testPdfData) as any;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      pdfDoc.on('data', (c: Buffer) => chunks.push(c));
      pdfDoc.on('end', () => resolve());
      pdfDoc.on('error', reject);
    });

    const pageCount = pdfDoc.bufferedPageRange().count;
    assert(pageCount === 1, `1-line item invoice produces exactly 1 page (no blank pages generated, got ${pageCount})`);

    // -------------------------------------------------------------------------
    // B5 & B22: Timezone Handling and Receivables Reporting
    // -------------------------------------------------------------------------
    console.log('\n--- Testing B5 & B22: Reports & Timezone ---');
    const reportRes = await fetch(`${BASE}/reports/sales?groupBy=day`);
    const reportData = (await reportRes.json()).data;
    assert(
      reportData.filters.timezone === 'Asia/Kolkata (IST)',
      'Report canonical business timezone explicitly configured as Asia/Kolkata (IST)'
    );
    assert(
      typeof reportData.summary.periodNetSalesLessCollections === 'number',
      'Report cleanly separates period activity from cumulative receivables'
    );
    assert(
      typeof reportData.summary.totalOutstandingReceivables === 'number',
      'Report provides explicit totalOutstandingReceivables'
    );

    console.log(`\n======================================================`);
    console.log(`🎉 ALL STABILIZATION TESTS PASSED! (${passed}/${passed + failed})`);
    console.log(`======================================================\n`);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runStabilizationTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
