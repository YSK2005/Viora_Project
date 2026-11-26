import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { createApp } from '../src/app';
import { prisma } from '../src/config/prisma';

describe('Industrial 3-Panel Lifecycle, 12-Digit Access Codes & Security Enforcement', () => {
  let server: http.Server;
  let baseUrl: string;

  const stamp = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const buyerEmail = `buyer-${stamp}@industrial.test`;
  const buyerPass = 'BuyerSecret123!';
  const otherEmail = `intruder-${stamp}@industrial.test`;
  const staffEmail = `cashier-${stamp}@industrial.test`;
  const staffPass = 'CashierSecret123!';

  let buyerToken = '';
  let superAdminCode = '';
  let superAdminToken = '';
  let adminAccessCodeId = '';
  let adminAccessCode = '';
  let adminToken = '';
  let createdProductId = '';
  let createdCustomerId = '';

  beforeAll(async () => {
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const port = (server.address() as any).port;
    baseUrl = `http://127.0.0.1:${port}/api`;
  });

  afterAll(async () => {
    // Cleanup created test users and business cleanly
    try {
      const u = await prisma.user.findUnique({ where: { email: buyerEmail } });
      if (u) {
        const biz = await prisma.business.findFirst({ where: { ownerUserId: u.id } });
        if (biz) {
          await prisma.auditLog.deleteMany({ where: { businessId: biz.id } });
          await prisma.invoiceItem.deleteMany({ where: { invoice: { businessId: biz.id } } });
          await prisma.invoice.deleteMany({ where: { businessId: biz.id } });
          await prisma.product.deleteMany({ where: { businessId: biz.id } });
          await prisma.customer.deleteMany({ where: { businessId: biz.id } });
          await prisma.adminAccessCode.deleteMany({ where: { businessId: biz.id } });
          await prisma.businessMembership.deleteMany({ where: { businessId: biz.id } });
        }
        await prisma.subscription.deleteMany({ where: { userId: u.id } });
        if (biz) {
          await prisma.business.delete({ where: { id: biz.id } }).catch(() => {});
        }
        await prisma.user.deleteMany({ where: { email: { in: [buyerEmail, otherEmail, staffEmail] } } });
      }
    } catch {
      // Ignore cleanup errors
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('1. Blocks public self-registration on Super Admin (5175) & Admin (5173) portals', async () => {
    const superReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'SUPER_ADMIN' },
      body: JSON.stringify({ email: otherEmail, password: buyerPass, name: 'Attacker' }),
    });
    expect(superReg.status).toBe(403);

    const adminReg = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'ADMIN' },
      body: JSON.stringify({ email: otherEmail, password: buyerPass, name: 'Attacker' }),
    });
    expect(adminReg.status).toBe(403);
  });

  it('2. Customer registers on Customer Portal (5174) & registers secondary test user', async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'CUSTOMER' },
      body: JSON.stringify({ email: buyerEmail, password: buyerPass, name: 'Vipul Industrial Buyer' }),
    });
    expect(regRes.status).toBe(201);
    const regJson = (await regRes.json()) as any;
    expect(regJson.data.role).toBe('CUSTOMER');
    buyerToken = regJson.data.token;
    expect(buyerToken).toBeDefined();

    // Register second user email to verify code+email mismatch rejection
    const otherRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'CUSTOMER' },
      body: JSON.stringify({ email: otherEmail, password: buyerPass, name: 'Other Customer' }),
    });
    expect(otherRes.status).toBe(201);
  });

  it('3. Customer buys INR subscription -> receives unique 12-digit Super Admin Access Code', async () => {
    const plansRes = await fetch(`${baseUrl}/v1/subscriptions/plans`);
    expect(plansRes.status).toBe(200);
    const plansData = (await plansRes.json()) as any;
    expect(plansData.data.plans.some((p: any) => p.slug === 'test-5' || p.id === 'plan_test_5')).toBe(false);
    const starterPlan = plansData.data.plans.find((p: any) => p.slug === 'starter');
    expect(starterPlan).toBeDefined();

    const orderRes = await fetch(`${baseUrl}/v1/subscriptions/create-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'CUSTOMER',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({ planId: starterPlan.id, billingCycle: 'MONTHLY' }),
    });
    expect(orderRes.status).toBe(201);
    const orderData = (await orderRes.json()) as any;

    const verifyRes = await fetch(`${baseUrl}/v1/subscriptions/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'CUSTOMER',
        Authorization: `Bearer ${buyerToken}`,
      },
      body: JSON.stringify({
        orderId: orderData.data.orderId,
        paymentId: `pay_ind_${stamp}`,
        signature: 'rzp_client_verified',
        planId: starterPlan.id,
        billingCycle: 'MONTHLY',
      }),
    });
    expect(verifyRes.status).toBe(200);
    const verifyData = (await verifyRes.json()) as any;
    expect(verifyData.data.subscription.status).toBe('ACTIVE');
    superAdminCode = verifyData.data.receipt.superAdminAccessCode;
    expect(superAdminCode).toMatch(/^\d{12}$/);
    expect(verifyData.data.business.allowAdminBilling).toBe(false);
  });

  it('4. Super Admin Portal rejects wrong email + valid 12-digit code, allows EXACT purchasing email + code', async () => {
    // Mismatched email with valid 12-digit code -> 403 Forbidden
    const mismatchRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'SUPER_ADMIN' },
      body: JSON.stringify({
        email: otherEmail,
        password: buyerPass,
        accessCode: superAdminCode,
        portal: 'SUPER_ADMIN',
      }),
    });
    expect(mismatchRes.status).toBe(403);

    // Invalid code -> 401/400
    const badCodeRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'SUPER_ADMIN' },
      body: JSON.stringify({
        email: buyerEmail,
        password: buyerPass,
        accessCode: '000000000000',
        portal: 'SUPER_ADMIN',
      }),
    });
    expect(badCodeRes.status).toBe(401);

    // Exact same email + exact 12-digit code -> 200 OK
    const okRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'SUPER_ADMIN' },
      body: JSON.stringify({
        email: buyerEmail,
        password: buyerPass,
        accessCode: superAdminCode,
        portal: 'SUPER_ADMIN',
      }),
    });
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as any;
    superAdminToken = okJson.data.token;
    expect(okJson.data.role).toBe('SUPER_ADMIN');
    expect(okJson.data.business.allowAdminBilling).toBe(false);
  });

  it('5. Super Admin adds products & generates 12-digit Admin Access Code (payment endpoints blocked in Super Admin)', async () => {
    // Payment checkout is strictly blocked outside Customer Portal
    const blockedSubRes = await fetch(`${baseUrl}/v1/subscriptions/my-subscription`, {
      headers: { 'X-Viora-Portal': 'SUPER_ADMIN', Authorization: `Bearer ${superAdminToken}` },
    });
    expect(blockedSubRes.status).toBe(403);

    // Super Admin adds catalog product
    const prodRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'SUPER_ADMIN',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Industrial ERP License Module',
        unit: 'PCS',
        unitPrice: 2500,
        taxRate: 18,
      }),
    });
    expect(prodRes.status).toBe(201);
    const prodJson = (await prodRes.json()) as any;
    createdProductId = prodJson.data.id;

    // Create a client to bill later
    const custRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'SUPER_ADMIN',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Apex Manufacturing Ltd',
        phone: '9876501234',
        email: 'billing@apex.test',
        billingAddress: 'Electronic City, Bengaluru',
        state: 'Karnataka',
      }),
    });
    expect(custRes.status).toBe(201);
    createdCustomerId = ((await custRes.json()) as any).data.id;

    // Super Admin generates 12-digit Admin Access Code for cashier
    const codeRes = await fetch(`${baseUrl}/v1/superadmin/admin-codes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'SUPER_ADMIN',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        label: 'POS Counter 1',
        assignedEmail: staffEmail,
        name: 'Cashier Operator',
        password: staffPass,
        role: 'OWNER',
        canGenerateBills: true,
        enableBusinessBilling: false,
      }),
    });
    expect(codeRes.status).toBe(201);
    const codeJson = (await codeRes.json()) as any;
    adminAccessCodeId = codeJson.data.adminCode.id;
    adminAccessCode = codeJson.data.adminCode.code;
    expect(adminAccessCode).toMatch(/^\d{12}$/);
  });

  it('6. Admin logs in with Admin Code; blocked from product mutation and blocked from billing until Super Admin authorizes', async () => {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Viora-Portal': 'ADMIN' },
      body: JSON.stringify({
        email: staffEmail,
        password: staffPass,
        accessCode: adminAccessCode,
        portal: 'ADMIN',
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginJson = (await loginRes.json()) as any;
    adminToken = loginJson.data.token;
    expect(loginJson.data.billingAuthorized).toBe(false);

    // Admin CANNOT modify product catalog -> 403
    const addProdRes = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'ADMIN',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'Unauthorized Product', unit: 'PCS', unitPrice: 100, taxRate: 18 }),
    });
    expect(addProdRes.status).toBe(403);

    // Admin CANNOT generate bills before Super Admin authorizes billing -> 403
    const today = new Date().toISOString().split('T')[0];
    const blockedInvRes = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'ADMIN',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customerId: createdCustomerId,
        invoiceDate: today,
        dueDate: today,
        items: [
          {
            productId: createdProductId,
            descriptionSnapshot: 'Industrial ERP License Module',
            unit: 'PCS',
            quantity: 1,
            unitPrice: 2500,
            taxRate: 18,
          },
        ],
      }),
    });
    expect(blockedInvRes.status).toBe(403);

    // Super Admin turns ON "Allow Admin Billing"
    const authRes = await fetch(`${baseUrl}/v1/superadmin/billing-authorization`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'SUPER_ADMIN',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ allowAdminBilling: true }),
    });
    expect(authRes.status).toBe(200);

    // Admin tries billing non-catalog item -> rejected 400
    const uncatalogRes = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'ADMIN',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customerId: createdCustomerId,
        invoiceDate: today,
        dueDate: today,
        items: [
          {
            descriptionSnapshot: 'Unlisted Item',
            unit: 'PCS',
            quantity: 1,
            unitPrice: 100,
            taxRate: 18,
          },
        ],
      }),
    });
    expect(uncatalogRes.status).toBe(400);

    // Admin creates bill WITH Super Admin catalog product -> SUCCEEDS 201!
    const okInvRes = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'ADMIN',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        customerId: createdCustomerId,
        invoiceDate: today,
        dueDate: today,
        items: [
          {
            productId: createdProductId,
            descriptionSnapshot: 'Industrial ERP License Module',
            unit: 'PCS',
            quantity: 2,
            unitPrice: 2500,
            taxRate: 18,
          },
        ],
      }),
    });
    expect(okInvRes.status).toBe(201);
  });

  it('7. Revoking Admin Access Code in Super Admin immediately terminates Admin session', async () => {
    const revokeRes = await fetch(`${baseUrl}/v1/superadmin/admin-codes/${adminAccessCodeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Viora-Portal': 'SUPER_ADMIN',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    expect(revokeRes.status).toBe(200);

    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'X-Viora-Portal': 'ADMIN', Authorization: `Bearer ${adminToken}` },
    });
    expect(meRes.status).toBe(401);
  });
});
