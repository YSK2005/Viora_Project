import { useEffect, useState } from "react";
import { apiFetch, fetchCustomers } from "../../services/api";
import { Customer, PaginationMeta } from "../../types";
import { PaginationToolbar } from "../common/PaginationToolbar";
interface Statement {
  customer: Customer;
  generatedAt: string;
  totals: Record<
    "billed" | "credited" | "paid" | "balanceDue" | "customerCredit",
    string
  >;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: string;
    creditedTotal: string;
    totalPaid: string;
    balanceRemaining: string;
  }>;
  pagination: PaginationMeta;
}
const money = (value: unknown) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
export function StatementsView() {
  const [search, setSearch] = useState(""),
    [customers, setCustomers] = useState<Customer[]>([]),
    [customerPage, setCustomerPage] = useState(1),
    [customerPages, setCustomerPages] = useState(1),
    [customerId, setCustomerId] = useState("");
  const [page, setPage] = useState(1),
    [statement, setStatement] = useState<Statement | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      fetchCustomers({ search, page: customerPage, limit: 20 })
        .then((result) => {
          if (active) {
            setCustomers(result.customers);
            setCustomerPages(result.pagination?.totalPages || 1);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, customerPage]);
  useEffect(() => {
    setStatement(null);
    if (!customerId) return;
    let active = true;
    setLoading(true);
    setError("");
    apiFetch("/customers/" + customerId + "/statement?page=" + page)
      .then(async (r) => {
        if (!r.ok) throw Error("Could not load statement");
        return r.json();
      })
      .then((j) => {
        if (active) setStatement(j.data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [customerId, page, revision]);
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Customer statement</h1>
      <div className="bg-white p-4 rounded-xl space-y-3 no-print">
        <label className="block">
          Find customer
          <input
            className="form-input w-full"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCustomerPage(1);
            }}
          />
        </label>
        <label className="block">
          Customer
          <select
            aria-label="Customer"
            className="form-input w-full"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-4">
          <button
            disabled={customerPage === 1}
            onClick={() => setCustomerPage((p) => p - 1)}
          >
            Previous customers
          </button>
          <span>
            Page {customerPage} of {customerPages}
          </span>
          <button
            disabled={customerPage >= customerPages}
            onClick={() => setCustomerPage((p) => p + 1)}
          >
            Next customers
          </button>
        </div>
      </div>
      {!customerId && (
        <p>Select a customer to view invoices, receipts, and credits.</p>
      )}
      {loading && <p role="status">Loading statement…</p>}
      {error && (
        <p role="alert">
          {error}{" "}
          <button onClick={() => setRevision((r) => r + 1)}>Retry</button>
        </p>
      )}
      {statement && (
        <>
          <div className="flex justify-between">
            <div>
              <h2 className="font-bold">{statement.customer.name}</h2>
              <p>
                Current statement ·{" "}
                {new Date(statement.generatedAt).toLocaleString("en-IN")}
              </p>
            </div>
            <button onClick={() => window.print()} className="btn-secondary">
              Print current page
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(statement.totals).map(([label, value]) => (
              <div key={label} className="bg-white border rounded-lg p-4">
                <p className="capitalize text-sm">
                  {label.replace(/([A-Z])/g, " $1")}
                </p>
                <strong>{money(value)}</strong>
              </div>
            ))}
          </div>
          <p className="text-sm">
            Totals include all issued invoices. Customer credit is owed to the
            customer; no refund has been recorded by issuing a credit note.
          </p>
          {!statement.invoices.length ? (
            <p>No issued invoices for this customer.</p>
          ) : (
            <div className="space-y-3">
              {statement.invoices.map((i) => (
                <article
                  key={i.id}
                  className="bg-white border rounded-lg p-4 flex flex-wrap gap-4 justify-between"
                >
                  <strong>{i.invoiceNumber}</strong>
                  <span>{i.invoiceDate.slice(0, 10)}</span>
                  <span>Billed {money(i.grandTotal)}</span>
                  <span>Credits {money(i.creditedTotal)}</span>
                  <span>Paid {money(i.totalPaid)}</span>
                  <strong>Due {money(i.balanceRemaining)}</strong>
                </article>
              ))}
            </div>
          )}
          <p>
            Invoice page {page} of {statement.pagination.totalPages}
          </p>
          <PaginationToolbar
            currentPage={page}
            totalPages={statement.pagination.totalPages}
            totalCount={statement.pagination.totalCount}
            pageSize={20}
            onPageChange={setPage}
            itemLabel="invoices"
          />
        </>
      )}
    </section>
  );
}
