import { useEffect, useState } from "react";
import { apiFetch, fetchInvoices } from "../../services/api";
import { Invoice, PaginationMeta } from "../../types";
import { PaginationToolbar } from "../common/PaginationToolbar";
import { useDialog } from "../../hooks/useDialog";
type Line = {
  id: string;
  descriptionSnapshot: string;
  quantity: string;
  remainingQuantity: number;
  lineTotal: string;
};
type Note = {
  id: string;
  number: string;
  reason: string;
  total: string;
  issuedAt: string;
  invoice: { invoiceNumber: string };
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    total: string;
  }>;
};
const money = (value: unknown) =>
  Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
  });
export function CreditsView({
  onChanged,
  canIssue = true,
}: {
  onChanged: () => void;
  canIssue?: boolean;
}) {
  const [notes, setNotes] = useState<Note[]>([]),
    [page, setPage] = useState(1),
    [pagination, setPagination] = useState<PaginationMeta>({
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 1,
    });
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0);
  const [search, setSearch] = useState(""),
    [invoices, setInvoices] = useState<Invoice[]>([]),
    [invoicePage, setInvoicePage] = useState(1),
    [invoicePages, setInvoicePages] = useState(1);
  const [invoiceId, setInvoiceId] = useState(""),
    [lines, setLines] = useState<Line[]>([]),
    [quantities, setQuantities] = useState<Record<string, string>>({}),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [key, setKey] = useState("");
  const dialog = useDialog(
    open,
    () => {
      if (!busy) setOpen(false);
    },
    "Issue credit note",
  );
  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch("/credit-notes?page=" + page)
      .then(async (r) => {
        if (!r.ok) throw Error("Could not load credit notes");
        return r.json();
      })
      .then((j) => {
        if (active) {
          setNotes(j.data.notes);
          setPagination(j.data.pagination);
          setError("");
        }
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
  }, [page, revision]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = setTimeout(() => {
      fetchInvoices({
        status: "ISSUED",
        search,
        page: invoicePage,
        limit: 20,
      }).then((result) => {
        if (!active) return;
        if (!result.isBackendConnected) {
          setError("Could not load invoices");
          return;
        }
        setInvoices(result.invoices);
        setInvoicePages(result.pagination?.totalPages || 1);
      });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [open, search, invoicePage]);
  useEffect(() => {
    setLines([]);
    setQuantities({});
    if (!invoiceId) return;
    let active = true;
    apiFetch("/credit-notes/eligible/" + invoiceId)
      .then(async (r) => {
        if (!r.ok) throw Error("Could not load invoice lines");
        return r.json();
      })
      .then((j) => {
        if (active) setLines(j.data.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [invoiceId]);
  const begin = () => {
    setInvoiceId("");
    setReason("");
    setError("");
    setSearch("");
    setInvoicePage(1);
    setKey(crypto.randomUUID());
    setOpen(true);
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const items = lines
        .map((line) => ({
          invoiceItemId: line.id,
          quantity: Number(quantities[line.id] || 0),
        }))
        .filter((i) => i.quantity > 0);
      if (!items.length)
        throw Error("Enter a quantity for at least one invoice line.");
      const response = await apiFetch("/credit-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, reason, requestKey: key, items }),
      });
      const json = await response.json();
      if (!response.ok)
        throw Error(json.error?.message || "Could not issue credit note");
      setOpen(false);
      setRevision((n) => n + 1);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Credit failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <h1 className="text-2xl font-bold">Credit notes</h1>
        {canIssue && (
          <button className="btn-primary" onClick={begin}>
            Issue credit note
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600">
        Credits preserve the original invoice and reduce its balance. Credit on
        a paid invoice creates a customer credit; it does not record a cash
        refund.
      </p>
      {error && !open && (
        <p role="alert">
          {error}{" "}
          <button
            className="underline"
            onClick={() => setRevision((n) => n + 1)}
          >
            Retry
          </button>
        </p>
      )}
      {loading && <p role="status">Loading credit notes…</p>}
      {!loading && !notes.length && !error && (
        <p className="p-8 bg-white rounded-xl">
          No credit notes yet. Issue a credit against an existing invoice when
          goods or services are returned.
        </p>
      )}
      <div className="grid gap-4">
        {notes.map((note) => (
          <article
            key={note.id}
            className="bg-white p-5 rounded-xl border border-slate-200"
          >
            <div className="flex justify-between gap-4">
              <h2 className="font-bold">
                {note.number} · {note.invoice.invoiceNumber}
              </h2>
              <strong>{money(note.total)}</strong>
            </div>
            <p className="text-sm my-2">{note.reason}</p>
            <time>{new Date(note.issuedAt).toLocaleDateString("en-IN")}</time>
            <details className="mt-3">
              <summary>Credited lines</summary>
              <ul>
                {note.items.map((item) => (
                  <li key={item.id}>
                    {item.description} × {Number(item.quantity)} —{" "}
                    {money(item.total)}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
      <PaginationToolbar
        currentPage={page}
        totalPages={pagination.totalPages}
        totalCount={pagination.totalCount}
        pageSize={20}
        onPageChange={setPage}
        itemLabel="credit notes"
      />
      {open && (
        <div
          {...dialog}
          className="fixed inset-0 z-[60] bg-slate-900/60 p-4 overflow-y-auto flex items-start justify-center"
        >
          <form
            onSubmit={submit}
            className="bg-white rounded-2xl p-6 w-full max-w-2xl my-8 space-y-4"
          >
            <div className="flex justify-between">
              <h2 className="text-xl font-bold">Issue credit note</h2>
              <button
                type="button"
                disabled={busy}
                onClick={() => setOpen(false)}
                aria-label="Close credit note"
              >
                Close
              </button>
            </div>
            {error && (
              <p role="alert" className="text-red-700">
                {error}
              </p>
            )}
            <label className="block">
              Find original invoice
              <input
                className="form-input w-full"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setInvoicePage(1);
                }}
                placeholder="Invoice number or customer"
              />
            </label>
            <label className="block">
              Original invoice
              <select
                aria-label="Original invoice"
                className="form-input w-full"
                required
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              >
                <option value="">Select invoice</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.invoiceNumber} — {i.customerName}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                disabled={invoicePage === 1}
                onClick={() => setInvoicePage((p) => p - 1)}
              >
                Previous invoices
              </button>
              <span>
                Page {invoicePage} of {invoicePages}
              </span>
              <button
                type="button"
                disabled={invoicePage >= invoicePages}
                onClick={() => setInvoicePage((p) => p + 1)}
              >
                Next invoices
              </button>
            </div>
            {lines.length > 0 && (
              <button
                type="button"
                className="underline"
                onClick={() =>
                  setQuantities(
                    Object.fromEntries(
                      lines.map((l) => [
                        l.id,
                        String(Math.max(0, l.remainingQuantity).toFixed(3)),
                      ]),
                    ),
                  )
                }
              >
                Credit all remaining quantities
              </button>
            )}
            {lines.map((line) => (
              <label key={line.id} className="block border rounded-lg p-3">
                {line.descriptionSnapshot}
                <span className="block text-sm">
                  Available: {Number(line.remainingQuantity.toFixed(3))} of{" "}
                  {Number(line.quantity)}
                </span>
                <input
                  className="form-input"
                  aria-label={"Credit quantity for " + line.descriptionSnapshot}
                  type="number"
                  min="0"
                  max={Number(line.remainingQuantity.toFixed(3))}
                  step="0.001"
                  value={quantities[line.id] || ""}
                  disabled={line.remainingQuantity <= 0 || busy}
                  onChange={(e) =>
                    setQuantities((q) => ({ ...q, [line.id]: e.target.value }))
                  }
                />
              </label>
            ))}
            <label className="block">
              Reason
              <textarea
                className="form-input w-full"
                required
                minLength={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p className="text-sm">
              Tax and discounts are prorated from the original invoice. Issued
              credits cannot be edited.
            </p>
            <button className="btn-primary" disabled={busy || !lines.length}>
              {busy ? "Issuing…" : "Issue credit note"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
