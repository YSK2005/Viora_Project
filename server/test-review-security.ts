import assert from 'node:assert/strict';
import { createApp } from './src/app';
import { prisma } from './src/config/prisma';
import { hashPassword } from './src/utils/auth';

async function main() {
  const db = new URL(process.env.DATABASE_URL || '');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.match(db.pathname, /review|test/i, 'Use a dedicated test database');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api`;
  const stamp = `${Date.now()}`;
  let assertions = 0;
  const check = (actual: unknown, expected: unknown, message: string) => {
    assert.deepEqual(actual, expected, message); assertions++; console.log('PASS:', message);
  };
  const request = async (path: string, method = 'GET', body?: unknown, headers: Record<string,string> = {}) => {
    const res = await fetch(base + path, {method, headers: {'Content-Type':'application/json', ...headers},
      ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    return { status: res.status, body: await res.json(), cookie: res.headers.get('set-cookie') };
  };
  try {
    const legacy = await prisma.business.create({data: {name:'Unowned legacy review', address:'Test', phone:'1234567890', email:`legacy-${stamp}@test.invalid`}});
    const email = `review-${stamp}@test.invalid`;
    const password = 'ReviewPassword!54321';
    const web = {'X-Viora-Client':'web', Origin:'http://localhost:5173'};
    const registered = await request('/auth/register', 'POST', {name:'Review Owner', email, password}, web);
    check(registered.status, 201, 'Browser signup succeeds');
    check(registered.body.data.token, undefined, 'Browser responses do not expose session token');
    check(registered.cookie?.includes('HttpOnly'), true, 'Session cookie is HttpOnly');
    check(registered.cookie?.includes('SameSite=Lax'), true, 'Session cookie uses SameSite');
    const cookie = registered.cookie!.split(';')[0];
    const browser = {...web, Cookie:cookie};
    const businessId = registered.body.data.business.id;
    const userId = registered.body.data.user.id;
    check(businessId !== legacy.id, true, 'Signup cannot claim legacy business');
    check(await prisma.businessMembership.count({where:{businessId:legacy.id}}), 0, 'Legacy business remains unclaimed');
    check((await request('/auth/me','GET', undefined, browser)).status, 200, 'Cookie session survives client reload');
    check((await request('/auth/logout','POST',undefined,{Cookie:cookie})).status, 403, 'Cookie write without CSRF header rejected');
    check((await request('/auth/me','GET',undefined,{Cookie:cookie})).status, 200, 'Rejected logout leaves session valid');
    const missingEmail = `unknown-${stamp}@test.invalid`;
    check((await request('/auth/members','POST',{email:missingEmail,role:'VIEWER'},browser)).status, 409, 'Unknown member requires independent registration');
    check(await prisma.user.count({where:{email:missingEmail}}), 0, 'Member add cannot create shared-password account');
    const member = await request('/auth/register','POST',{name:'Registered Member', email:missingEmail,password},web);
    check(member.status, 201, 'New member registers own credentials');
    check((await request('/auth/members','POST',{email:missingEmail,role:'VIEWER'},browser)).status, 201, 'Owner can add registered account');
    const memberHeaders = {...web,Cookie:member.cookie!.split(';')[0]};
    check((await request('/auth/switch-business','POST',{businessId},memberHeaders)).status,200,'Member explicitly switches to invited business');
    check((await request('/customers','POST',{name:'Forbidden'},memberHeaders)).status,403,'Viewer cannot mutate owner business');
    check((await request('/auth/login','POST',{email:missingEmail,password:'Viora@12345'},web)).status,401,'Old shared password cannot sign in newly added member');

    await prisma.businessMembership.deleteMany({where:{userId}});
    check((await request('/auth/me','GET',undefined,browser)).status,403,'Revoked session cannot recreate owner membership');
    check((await request('/auth/login','POST',{email,password},web)).status,403,'Orphan login cannot recreate owner membership');
    check(await prisma.businessMembership.count({where:{userId}}),0,'Denied requests create no membership');
    await prisma.businessMembership.create({data:{businessId,userId,role:'OWNER'}});
    check((await request('/customers','GET',undefined,{...browser,'X-Business-Id':legacy.id})).status,403,'Cross-business selection rejected');

    const customer = await prisma.customer.create({data:{businessId,name:'Page Test',phone:'9876543210',billingAddress:'Test'}});
    const foreignCustomer = await prisma.customer.create({data:{businessId:legacy.id,name:'Foreign',phone:'9876543210',billingAddress:'Test'}});
    const samples = [
      {name:'paid', total:100, amount:100, reversed:false, status:'PAID'},
      {name:'partial', total:100, amount:35, reversed:false, status:'PARTIALLY_PAID'},
      {name:'unpaid', total:100, amount:0, reversed:false, status:'UNPAID'},
      {name:'reversed', total:100, amount:100, reversed:true, status:'UNPAID'},
      {name:'zero', total:0, amount:0, reversed:false, status:'UNPAID'},
      {name:'overpaid', total:100, amount:110, reversed:false, status:'PAID'},
    ];
    for (const [index,sample] of samples.entries()) {
      const invoice = await prisma.invoice.create({data:{businessId,customerId:customer.id,
        invoiceNumber:`REVIEW-${sample.name}`,invoiceDate:new Date(`2026-10-${10+index}T00:00:00Z`),dueDate:new Date('2026-11-30'),
        subtotal:sample.total,grandTotal:sample.total,status:'ISSUED'}});
      if (sample.amount) await prisma.payment.create({data:{invoiceId:invoice.id,amount:sample.amount,isReversed:sample.reversed,requestKey:`review-${stamp}-${index}`}});
    }
    await prisma.invoice.create({data:{businessId:legacy.id,customerId:foreignCustomer.id,invoiceNumber:'REVIEW-foreign',invoiceDate:new Date(),dueDate:new Date(),subtotal:100,grandTotal:100}});
    for (const status of ['ALL','PAID','PARTIALLY_PAID','UNPAID']) {
      const expected = samples.filter(s => status === 'ALL' || s.status === status).reverse();
      const ids: string[] = [];
      for (let page=1; page<=Math.ceil(expected.length/2)+1; page++) {
        const result = await request(`/invoices?paymentStatus=${status}&page=${page}&limit=2`,'GET',undefined,browser);
        check(result.status,200,`${status} page ${page} responds`);
        check(result.body.data.pagination.totalCount,expected.length,`${status} count respects payment filter and tenant`);
        ids.push(...result.body.data.invoices.map((i:any)=>i.invoiceNumber));
      }
      check(ids,expected.map(s=>`REVIEW-${s.name}`),`${status} pages have no duplicates or missing invoices`);
    }
    check((await request('/invoices?search=%27%20OR%201%3D1--','GET',undefined,browser)).body.data.pagination.totalCount,0,'Search treats SQL payload as literal text');
    check((await request('/invoices?search=partial','GET',undefined,browser)).body.data.pagination.totalCount,1,'Search works before paging');
    check((await request('/invoices?limit=501','GET',undefined,browser)).status,400,'Page size bounded');
    check((await request('/auth/logout','POST',undefined,browser)).status,200,'Protected browser logout succeeds');
    check((await request('/auth/me','GET',undefined,browser)).status,401,'Logged-out session cannot be reused');
    check((await request('/auth/me','GET',undefined,{Cookie:'viora_session=%ZZ'})).status,401,'Malformed cookie is unauthorized, not server error');
    console.log(`All ${assertions} review regression assertions passed.`);
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
    await prisma.$disconnect();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
