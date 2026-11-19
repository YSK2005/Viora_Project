import { hashPassword } from './src/utils/auth';
import http from 'http';
import assert from 'node:assert/strict';
import { createApp } from './src/app';
import { prisma } from './src/config/prisma';

async function runP0Tests() {
  console.log('🧪 Starting P0 Master Test Suite (Auth, Isolation, Lifecycle, Pagination, RBAC)...\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5004, () => resolve()));
  const BASE = 'http://localhost:5004/api';

  let passed = 0;
  let failed = 0;

  function testAssert(condition: boolean, msg: string) {
    if (!condition) {
      failed++;
      console.error(`❌ FAILED: ${msg}`);
      throw new Error(msg);
    } else {
      passed++;
      console.log(`✅ PASSED: ${msg}`);
    }
  }

  const api = async (
    path: string,
    options: {
      method?: string;
      body?: any;
      token?: string;
    } = {}
  ) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const res = await fetch(`${BASE}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // Non-json response
    }
    return { status: res.status, data: json?.data, error: json?.error, headers: res.headers };
  };

  const RUN_ID = Date.now();

  try {
    // =========================================================================
    // 1. Unauthenticated Requests Must Fail (401)
    // =========================================================================
    console.log('\n--- 1. Testing Unauthenticated Request Rejection ---');
    const unauthCustomers = await api('/customers');
    testAssert(unauthCustomers.status === 401, 'Unauthenticated GET /customers returns 401');
    testAssert(unauthCustomers.error?.code === 'ERR_UNAUTHORIZED', 'Returns ERR_UNAUTHORIZED code');

    const unauthInvoices = await api('/invoices');
    testAssert(unauthInvoices.status === 401, 'Unauthenticated GET /invoices returns 401');

    const unauthDashboard = await api('/dashboard/summary');
    testAssert(unauthDashboard.status === 401, 'Unauthenticated GET /dashboard/summary returns 401');

    // Health remains public
    const health = await api('/health');
    testAssert(health.status === 200, 'Health endpoint GET /health is accessible publicly (200)');

    // =========================================================================
    // 2. User Registration, Passwords & Sessions
    // =========================================================================
    console.log('\n--- 2. Testing Registration, Login & Session Management ---');
    const user1Email = `owner-${RUN_ID}@business-a.com`;
    const regRes1 = await api('/auth/register', {
      method: 'POST',
      body: {
        email: user1Email,
        password: 'SecurePassword@123',
        name: 'Alice Owner',
        businessName: `Alpha Corp ${RUN_ID}`,
      },
    });

    testAssert(regRes1.status === 201, 'Registration returns 201 Created');
    testAssert(Boolean(regRes1.data?.token), 'Session token returned');
    testAssert(regRes1.data?.role === 'OWNER', 'Registering user is assigned OWNER role');
    const token1 = regRes1.data.token;
    const biz1Id = regRes1.data.business.id;

    // Duplicate email registration rejected
    const regDup = await api('/auth/register', {
      method: 'POST',
      body: {
        email: user1Email,
        password: 'Password@123',
        name: 'Alice Clone',
      },
    });
    testAssert(regDup.status === 409, 'Duplicate registration returns 409 Conflict');

    // Invalid login credentials rejected
    const badLogin = await api('/auth/login', {
      method: 'POST',
      body: {
        email: user1Email,
        password: 'WrongPassword',
      },
    });
    testAssert(badLogin.status === 401, 'Invalid password returns 401 Unauthorized');

    // Valid login succeeds
    const loginRes = await api('/auth/login', {
      method: 'POST',
      body: {
        email: user1Email,
        password: 'SecurePassword@123',
      },
    });
    testAssert(loginRes.status === 200, 'Valid login returns 200 OK');
    testAssert(Boolean(loginRes.data?.token), 'Login returns valid session token');

    // GET /auth/me returns active user and business
    const meRes = await api('/auth/me', { token: token1 });
    testAssert(meRes.status === 200, 'GET /auth/me returns 200');
    testAssert(meRes.data?.user?.email === user1Email, 'GET /auth/me matches user email');
    testAssert(meRes.data?.business?.id === biz1Id, 'GET /auth/me matches active business');

    // Logout invalidates session
    const logoutRes = await api('/auth/logout', { method: 'POST', token: loginRes.data.token });
    testAssert(logoutRes.status === 200, 'POST /auth/logout returns 200');
    const afterLogout = await api('/auth/me', { token: loginRes.data.token });
    testAssert(afterLogout.status === 401, 'Accessing with logged out token returns 401');

    // =========================================================================
    // 3. Multi-Tenant Business Isolation
    // =========================================================================
    console.log('\n--- 3. Testing Multi-Tenant Business Isolation ---');
    // Register User 2 with Business B
    const user2Email = `owner-${RUN_ID}@business-b.com`;
    const regRes2 = await api('/auth/register', {
      method: 'POST',
      body: {
        email: user2Email,
        password: 'SecurePassword@123',
        name: 'Bob Owner',
        businessName: `Beta Enterprises ${RUN_ID}`,
      },
    });
    const token2 = regRes2.data.token;
    const biz2Id = regRes2.data.business.id;
    testAssert(biz1Id !== biz2Id, 'Business A and Business B have distinct IDs');

    // User 1 creates Customer and Product in Business A
    const cust1Res = await api('/customers', {
      method: 'POST',
      token: token1,
      body: {
        name: `Customer of Business A ${RUN_ID}`,
        phone: `91${String(RUN_ID).slice(-8)}`,
        email: `custA-${RUN_ID}@example.com`,
        billingAddress: 'Address in Business A',
      },
    });
    testAssert(cust1Res.status === 201, 'Customer created in Business A');
    const cust1Id = cust1Res.data.id;

    const prod1Res = await api('/products', {
      method: 'POST',
      token: token1,
      body: {
        name: `Product of Business A ${RUN_ID}`,
        unitPrice: 1500,
        taxRate: 18,
      },
    });
    testAssert(prod1Res.status === 201, 'Product created in Business A');
    const prod1Id = prod1Res.data.id;

    // User 1 creates Invoice in Business A
    const inv1Res = await api('/invoices', {
      method: 'POST',
      token: token1,
      body: {
        customerId: cust1Id,
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-15',
        items: [
          {
            productId: prod1Id,
            descriptionSnapshot: 'Service Item',
            quantity: 2,
            unitPrice: 1500,
            taxRate: 18,
          },
        ],
      },
    });
    testAssert(inv1Res.status === 201, 'Draft Invoice created in Business A');
    const inv1Id = inv1Res.data.id;

    // Cross-tenant Isolation Check: User 2 (Business B) tries to access Business A's records
    const bTriesCustA = await api(`/customers/${cust1Id}`, { token: token2 });
    testAssert(bTriesCustA.status === 404, 'User 2 cannot read Customer 1 (returns 404)');

    const bTriesProdA = await api(`/products/${prod1Id}`, { token: token2 });
    testAssert(bTriesProdA.status === 404, 'User 2 cannot read Product 1 (returns 404)');

    const bTriesInvA = await api(`/invoices/${inv1Id}`, { token: token2 });
    testAssert(bTriesInvA.status === 404, 'User 2 cannot read Invoice 1 (returns 404)');

    const bTriesEditInvA = await api(`/invoices/${inv1Id}`, {
      method: 'PUT',
      token: token2,
      body: {
        customerId: cust1Id,
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-15',
        items: [{ descriptionSnapshot: 'Hacked', quantity: 1, unitPrice: 10, taxRate: 0 }],
      },
    });
    testAssert(bTriesEditInvA.status === 404, 'User 2 cannot edit Invoice 1 (returns 404)');

    const bTriesDeleteInvA = await api(`/invoices/${inv1Id}`, {
      method: 'DELETE',
      token: token2,
    });
    testAssert(bTriesDeleteInvA.status === 404, 'User 2 cannot delete Invoice 1 (returns 404)');

    const bTriesIssueInvA = await api(`/invoices/${inv1Id}/issue`, {
      method: 'POST',
      token: token2,
    });
    testAssert(bTriesIssueInvA.status === 404, 'User 2 cannot issue Invoice 1 (returns 404)');

    const bTriesPayInvA = await api(`/invoices/${inv1Id}/payments`, {
      method: 'POST',
      token: token2,
      body: {
        amount: 500,
        requestKey: `REQ-KEY-ISOLATION-${RUN_ID}`,
      },
    });
    testAssert(bTriesPayInvA.status === 404, 'User 2 cannot record payment on Invoice 1 (returns 404)');

    // =========================================================================
    // 4. Role-Based Access Control (RBAC)
    // =========================================================================
    console.log('\n--- 4. Testing Role-Based Access Control (OWNER, ACCOUNTANT, VIEWER) ---');
    // Add VIEWER member to Business A
    const viewerEmail = `viewer-${RUN_ID}@business-a.com`;
    await prisma.user.create({ data: { email: viewerEmail, name: 'viewer', passwordHash: hashPassword('ChosenTestPassword!42') } });
    const addViewerRes = await api('/auth/members', {
      method: 'POST',
      token: token1,
      body: {
        email: viewerEmail,
        role: 'VIEWER',
        name: 'Charlie Viewer',
      },
    });
    testAssert(addViewerRes.status === 201, 'Owner added VIEWER member');

    const viewerLogin = await api('/auth/login', {
      method: 'POST',
      body: {
        email: viewerEmail,
        password: 'ChosenTestPassword!42',
      },
    });
    const viewerToken = viewerLogin.data.token;
    testAssert(viewerLogin.data?.role === 'VIEWER', 'Viewer logged in with VIEWER role');

    // VIEWER can read
    const viewerGetCust = await api('/customers', { token: viewerToken });
    testAssert(viewerGetCust.status === 200, 'Viewer can read customers list (200)');

    const viewerGetInv = await api(`/invoices/${inv1Id}`, { token: viewerToken });
    testAssert(viewerGetInv.status === 200, 'Viewer can view invoice details (200)');

    // VIEWER mutation attempts must be rejected (403)
    const viewerCreateCust = await api('/customers', {
      method: 'POST',
      token: viewerToken,
      body: { name: 'Forbidden', phone: '9876543210', billingAddress: 'Test' },
    });
    testAssert(viewerCreateCust.status === 403, 'Viewer cannot create customer (returns 403)');

    const viewerCreateInv = await api('/invoices', {
      method: 'POST',
      token: viewerToken,
      body: { customerId: cust1Id, invoiceDate: '2026-03-01', dueDate: '2026-03-15', items: [] },
    });
    testAssert(viewerCreateInv.status === 403, 'Viewer cannot create invoice (returns 403)');

    // Add ACCOUNTANT member to Business A
    const accountantEmail = `accountant-${RUN_ID}@business-a.com`;
    await prisma.user.create({ data: { email: accountantEmail, name: 'accountant', passwordHash: hashPassword('ChosenTestPassword!42') } });
    const addAccountantRes = await api('/auth/members', {
      method: 'POST',
      token: token1,
      body: {
        email: accountantEmail,
        role: 'ACCOUNTANT',
        name: 'Dave Accountant',
      },
    });
    testAssert(addAccountantRes.status === 201, 'Owner added ACCOUNTANT member');

    const accountantLogin = await api('/auth/login', {
      method: 'POST',
      body: {
        email: accountantEmail,
        password: 'ChosenTestPassword!42',
      },
    });
    const accountantToken = accountantLogin.data.token;
    testAssert(accountantLogin.data?.role === 'ACCOUNTANT', 'Accountant logged in with ACCOUNTANT role');

    // ACCOUNTANT can create draft and issue invoice
    const acctCreateInv = await api('/invoices', {
      method: 'POST',
      token: accountantToken,
      body: {
        customerId: cust1Id,
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-15',
        items: [
          {
            descriptionSnapshot: 'Accountant Item',
            quantity: 1,
            unitPrice: 500,
            taxRate: 18,
          },
        ],
      },
    });
    testAssert(acctCreateInv.status === 201, 'Accountant can create draft invoice (201)');
    const acctInvId = acctCreateInv.data.id;

    // ACCOUNTANT cannot cancel invoice (OWNER only)
    const acctIssueRes = await api(`/invoices/${acctInvId}/issue`, {
      method: 'POST',
      token: accountantToken,
    });
    testAssert(acctIssueRes.status === 200, 'Accountant can issue invoice (200)');

    const acctCancelRes = await api(`/invoices/${acctInvId}/cancel`, {
      method: 'POST',
      token: accountantToken,
    });
    testAssert(acctCancelRes.status === 403, 'Accountant cannot cancel invoice (403, Owner required)');

    // =========================================================================
    // 5. Complete Transactional Invoice Lifecycle Protection
    // =========================================================================
    console.log('\n--- 5. Testing Invoice Lifecycle Status Protection ---');
    // Issued invoice cannot be edited (409)
    const editIssued = await api(`/invoices/${acctInvId}`, {
      method: 'PUT',
      token: token1,
      body: {
        customerId: cust1Id,
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-15',
        items: [{ descriptionSnapshot: 'Modified', quantity: 1, unitPrice: 999, taxRate: 0 }],
      },
    });
    testAssert(editIssued.status === 409, 'Editing issued invoice is rejected with 409 Conflict');

    // Issued invoice cannot be deleted (409)
    const delIssued = await api(`/invoices/${acctInvId}`, {
      method: 'DELETE',
      token: token1,
    });
    testAssert(delIssued.status === 409, 'Deleting issued invoice is rejected with 409 Conflict');

    // Record payment against issued invoice succeeds
    const payRes = await api(`/invoices/${acctInvId}/payments`, {
      method: 'POST',
      token: accountantToken,
      body: {
        amount: 200,
        requestKey: `PAY-P0-${RUN_ID}-1`,
      },
    });
    testAssert(payRes.status === 201, 'Payment recorded on issued invoice (201)');

    // Invoices with payments cannot be cancelled (400)
    const cancelWithPayments = await api(`/invoices/${acctInvId}/cancel`, {
      method: 'POST',
      token: token1,
    });
    testAssert(cancelWithPayments.status === 400, 'Invoice with payments cannot be cancelled (400)');

    // Create a new draft and delete it under transactional lock
    const draftForDel = await api('/invoices', {
      method: 'POST',
      token: token1,
      body: {
        customerId: cust1Id,
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-15',
        items: [{ descriptionSnapshot: 'To Delete', quantity: 1, unitPrice: 100 }],
      },
    });
    testAssert(draftForDel.status === 201, 'Created draft for deletion test');
    const draftDelRes = await api(`/invoices/${draftForDel.data.id}`, {
      method: 'DELETE',
      token: token1,
    });
    testAssert(draftDelRes.status === 200, 'Draft deleted under transactional lock (200)');

    // =========================================================================
    // 6. Server Pagination & Search across 100+ Records
    // =========================================================================
    console.log('\n--- 6. Testing Server Pagination & Complete Search (100+ items) ---');
    // Bulk create 105 products in Business A
    const bulkProducts = [];
    for (let i = 1; i <= 105; i++) {
      bulkProducts.push({
        businessId: biz1Id,
        name: `CatalogItem_${String(i).padStart(3, '0')}_${RUN_ID}`,
        unit: 'PCS',
        unitPrice: 100 + i,
        taxRate: 18,
        isActive: true,
      });
    }
    await prisma.product.createMany({ data: bulkProducts });

    // Page 1 with limit 20
    const page1Res = await api('/products?page=1&limit=20', { token: token1 });
    testAssert(page1Res.status === 200, 'Page 1 products fetched successfully');
    testAssert(page1Res.data.products.length === 20, 'Page 1 has exactly 20 items');
    testAssert(page1Res.data.pagination.totalCount >= 105, 'totalCount accurately reports 105+ records');
    testAssert(page1Res.data.pagination.totalPages >= 6, 'totalPages reflects at least 6 pages');

    // Page 6 with limit 20
    const page6Res = await api('/products?page=6&limit=20', { token: token1 });
    testAssert(page6Res.status === 200, 'Page 6 products fetched successfully');
    testAssert(page6Res.data.products.length >= 5, 'Page 6 has remaining items');

    // Search specifically for CatalogItem_088
    const searchRes = await api(`/products?search=CatalogItem_088_${RUN_ID}`, { token: token1 });
    testAssert(searchRes.status === 200, 'Search query executed successfully');
    testAssert(searchRes.data.products.length === 1, 'Search found exact item across 100+ records');
    testAssert(
      searchRes.data.products[0].name === `CatalogItem_088_${RUN_ID}`,
      'Search result matched target item name'
    );

    console.log('\n======================================================');
    console.log(`🎉 ALL ${passed} P0 MASTER VERIFICATION TESTS PASSED!`);
    console.log('======================================================\n');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

runP0Tests().catch((err) => {
  console.error('P0 Test Suite Error:', err);
  process.exit(1);
});
