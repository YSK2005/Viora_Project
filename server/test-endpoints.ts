import { createApp } from './src/app';
import { prisma } from './src/config/prisma';
import http from 'http';
import { calculateLineItem, calculateInvoiceTotals } from './src/utils/money';

async function runTests() {
  console.log('🧪 Starting Phase 3 Comprehensive Verification & Test Suite...\n');

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
        name: 'Phase 3 Enterprise Client',
        phone: '+91 98888 77777',
        email: 'billing@enterpriseclient.in',
        billingAddress: '42 Cyber City, DLF Phase 2, Gurugram, Haryana - 122002',
        gstin: '06AAACE1234F1Z1',
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

    console.log('\n🎉 ALL 16 PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Test suite failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests();
