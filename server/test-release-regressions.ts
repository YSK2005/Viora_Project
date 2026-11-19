import assert from 'node:assert/strict';
import { createApp } from './src/app';
import { prisma } from './src/config/prisma';

async function main() {
  if (process.env.NODE_ENV !== 'test' || !process.env.DATABASE_URL?.includes(':55433/')) {
    throw new Error('Run only against the isolated audit database on port 55433 with NODE_ENV=test');
  }
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  const api = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
      method, headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try {
    const customer = (await api('/customers', 'POST', { name: 'Release regression', email: `release-${Date.now()}@example.invalid`, billingAddress: 'Isolated test address' })).body.data;
    const draft = { customerId: customer.id, invoiceDate: '2026-01-15', dueDate: '2026-02-15', items: [{ descriptionSnapshot: 'Regression', quantity: 1, unitPrice: 100, taxRate: 0 }] };
    for (let i = 0; i < 10; i++) {
      const invoice = (await api('/invoices', 'POST', draft)).body.data;
      const [issued] = await Promise.all([
        api(`/invoices/${invoice.id}/issue`, 'POST', {}),
        api(`/invoices/${invoice.id}`, 'PUT', { ...draft, items: [{ ...draft.items[0], unitPrice: 200 }] }),
      ]);
      assert.equal(issued.status, 200);
      const final = (await api(`/invoices/${invoice.id}`)).body.data;
      assert.equal(Number(final.grandTotal), Number(issued.body.data.grandTotal), 'An issued invoice changed after issuance');
    }
    const invoice = (await api('/invoices', 'POST', draft)).body.data;
    await api(`/invoices/${invoice.id}/issue`, 'POST', {});
    const before = (await api('/reports/sales?endDate=2026-01-31')).body.data.summary.totalOutstandingReceivables;
    assert.equal((await api(`/invoices/${invoice.id}/payments`, 'POST', { amount: 100, paymentDate: '2026-02-15', requestKey: `release-${Date.now()}` })).status, 201);
    const after = (await api('/reports/sales?endDate=2026-01-31')).body.data.summary.totalOutstandingReceivables;
    assert.equal(after, before, 'Future payment changed historical receivables');
    assert.equal((await api('/products', 'POST', { name: '  ', unit: ' ', unitPrice: 1 })).status, 400);
    console.log('PASS: 10 issuance/edit races, historical cutoff, and whitespace validation');
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
