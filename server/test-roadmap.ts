import assert from "node:assert/strict";
import { createApp } from "./src/app";
import { prisma } from "./src/config/prisma";
async function main() {
  assert.equal(process.env.NODE_ENV, "test");
  assert.match(
    new URL(process.env.DATABASE_URL || "").pathname,
    /test|review/i,
  );
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base =
    "http://127.0.0.1:" + (server.address() as { port: number }).port + "/api";
  let token = "";
  let checks = 0;
  const check = (actual: unknown, expected: unknown, label: string) => {
    assert.deepEqual(actual, expected, label);
    checks++;
    console.log("PASS:", label);
  };
  const api = async (
    p: string,
    method = "GET",
    body?: unknown,
    auth = token,
  ) => {
    const r = await fetch(base + p, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: "Bearer " + auth } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: r.status, json: await r.json() };
  };
  try {
    const reg = await api("/auth/register", "POST", {
      name: "Roadmap Tester",
      email: "roadmap-" + Date.now() + "@example.test",
      password: "RoadmapPassword!123",
    });
    check(reg.status, 201, "Register test owner");
    token = reg.json.data.token;
    const businessId = reg.json.data.business.id;
    const c = await api("/customers", "POST", {
      name: "Credit Customer",
      phone: "9876543210",
      billingAddress: "Test address",
    });
    check(c.status, 201, "Create customer");
    const customerId = c.json.data.id;
    const draft = await api("/invoices", "POST", {
      customerId,
      invoiceDate: "2026-11-01",
      dueDate: "2026-11-30",
      items: [
        {
          descriptionSnapshot: "Original line",
          quantity: 3,
          unitPrice: 33.33,
          taxRate: 18,
        },
      ],
    });
    check(draft.status, 201, "Create original invoice");
    const id = draft.json.data.id;
    check(
      (await api("/invoices/" + id + "/issue", "POST")).status,
      200,
      "Issue original invoice",
    );
    const original = (await api("/invoices/" + id)).json.data;
    const lineId = original.items[0].id,
      total = Number(original.grandTotal);
    const credit = (quantity: number, key = crypto.randomUUID()) =>
      api("/credit-notes", "POST", {
        invoiceId: id,
        reason: "Returned original goods",
        requestKey: key,
        items: [{ invoiceItemId: lineId, quantity }],
      });
    check(
      (
        await api("/invoices/" + id + "/payments", "POST", {
          amount: total,
          requestKey: crypto.randomUUID(),
          method: "CASH",
        })
      ).status,
      201,
      "Record original full payment",
    );
    const key = crypto.randomUUID(),
      first = await credit(1, key);
    check(first.status, 201, "Issue first partial credit");
    check(
      (await credit(1, key)).status,
      409,
      "Duplicate request cannot issue twice",
    );
    check((await credit(3)).status, 409, "Over-credit rejected");
    const info = (await api("/invoices/" + id)).json.data;
    check(Number(info.grandTotal), total, "Original invoice total immutable");
    check(
      Number(info.creditedTotal),
      Number(first.json.data.total),
      "Credited balance updated",
    );
    check(
      Number(info.refundDue),
      Number(first.json.data.total),
      "Paid invoice exposes customer credit",
    );
    const statement = (await api("/customers/" + customerId + "/statement"))
      .json.data;
    check(
      Number(statement.totals.customerCredit),
      Number(first.json.data.total),
      "Statement exposes customer credit",
    );
    check(
      await prisma.auditLog.count({
        where: { businessId, action: "CREDIT_NOTE_ISSUE" },
      }),
      1,
      "Credit issuance creates audit log",
    );
    const attempts = await Promise.all([credit(2), credit(2)]);
    check(
      attempts.filter((r) => r.status === 201).length,
      1,
      "Concurrent requests cannot over-credit",
    );
    const after = (await api("/invoices/" + id)).json.data;
    check(
      Number(after.creditedTotal),
      total,
      "Partial credits reconcile exactly to original total",
    );
    check(
      (await api("/invoices/" + id + "/cancel", "POST")).status,
      409,
      "Credited invoice cannot be cancelled",
    );
    check(
      (
        await api("/invoices/" + id + "/payments", "POST", {
          amount: 1,
          requestKey: crypto.randomUUID(),
        })
      ).status,
      400,
      "Credit-adjusted overpayment rejected",
    );
    const outsider = await api("/auth/register", "POST", {
      name: "Other Business",
      email: "outside-" + Date.now() + "@example.test",
      password: "RoadmapPassword!123",
    });
    check(
      (
        await api(
          "/credit-notes/eligible/" + id,
          "GET",
          undefined,
          outsider.json.data.token,
        )
      ).status,
      404,
      "Cross-tenant credit lines hidden",
    );
    check(
      (
        await api(
          "/customers/" + customerId + "/statement",
          "GET",
          undefined,
          outsider.json.data.token,
        )
      ).status,
      404,
      "Cross-tenant statement hidden",
    );
    const draft2 = await api("/invoices", "POST", {
      customerId,
      invoiceDate: "2026-11-02",
      dueDate: "2026-11-30",
      items: [
        {
          descriptionSnapshot: "Another original line",
          quantity: 2,
          unitPrice: 100,
          taxRate: 18,
        },
      ],
    });
    const id2 = draft2.json.data.id;
    check(
      (await api("/invoices/bulk-delete", "POST", { ids: [id2, id] })).status,
      409,
      "Mixed issued/draft bulk deletion rejected atomically",
    );
    check(
      (await api("/invoices/" + id2)).status,
      200,
      "Rejected bulk operation preserves draft",
    );
    await api("/invoices/" + id2 + "/issue", "POST");
    const line2 = (await api("/invoices/" + id2)).json.data.items[0].id;
    let failAudit = true;
    prisma.$use(async (params, next) => {
      if (
        failAudit &&
        params.model === "AuditLog" &&
        params.action === "create" &&
        params.args?.data?.action === "CREDIT_NOTE_ISSUE"
      )
        throw Error("Simulated audit storage failure");
      return next(params);
    });
    const failed = await api("/credit-notes", "POST", {
      invoiceId: id2,
      reason: "Rollback verification",
      requestKey: crypto.randomUUID(),
      items: [{ invoiceItemId: line2, quantity: 1 }],
    });
    failAudit = false;
    check(failed.status, 500, "Audit failure rejects financial mutation");
    check(
      Number((await api("/invoices/" + id2)).json.data.creditedTotal),
      0,
      "Audit failure rolls back credited balance",
    );
    check(
      await prisma.creditNote.count({ where: { invoiceId: id2 } }),
      0,
      "Audit failure leaves no credit note",
    );
    const half = await api("/credit-notes", "POST", {
      invoiceId: id2,
      reason: "Partial return",
      requestKey: crypto.randomUUID(),
      items: [{ invoiceItemId: line2, quantity: 1 }],
    });
    check(half.status, 201, "Credit recovery after failure");
    const balance = (await api("/invoices/" + id2)).json.data.balanceRemaining;
    check(Number(balance), 118, "Unpaid invoice balance reduced by credit");
    const report = (await api("/reports/sales")).json.data.summary;
    check(
      Number(report.totalCredits),
      total + 118,
      "Reports include issued credit totals",
    );
    const health = await fetch(base + "/health");
    check(
      health.headers.get("x-content-type-options"),
      "nosniff",
      "Helmet security header enabled",
    );
    check(
      (await api("/credit-notes?limit=101")).status,
      400,
      "Credit page bound enforced",
    );
    console.log("All " + checks + " roadmap integration assertions passed.");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
