import { useEffect, useState, useId } from "react";
import { Customer } from "../../types";
import { fetchCustomers, apiFetch } from "../../services/api";
export function CustomerSearchSelect({
  value,
  onChange,
  disabled = false,
  required = false,
}: {
  value: string;
  onChange: (id: string, customer?: Customer) => void;
  disabled?: boolean;
  required?: boolean;
}) {
  const id = useId(),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [customers, setCustomers] = useState<Customer[]>([]),
    [selected, setSelected] = useState<Customer | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        fetchCustomers({ search: query, page, limit: 20 })
          .then((r) => {
            if (active) {
              setCustomers(r.customers);
              setPages(r.pagination?.totalPages || 1);
              setError("");
            }
          })
          .catch(() => {
            if (active) setError("Customers unavailable");
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, page]);
  useEffect(() => {
    let active = true;
    if (!value) {
      setSelected(null);
      return;
    }
    apiFetch("/customers/" + value)
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((j) => {
        if (active) setSelected(j.data);
      })
      .catch(() => {
        if (active) setError("Selected customer unavailable");
      });
    return () => {
      active = false;
    };
  }, [value]);
  return (
    <div className="space-y-2">
      <label className="block text-xs" htmlFor={id + "search"}>
        Find customer
      </label>
      <input
        id={id + "search"}
        className="form-input w-full"
        disabled={disabled}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />
      <label className="block text-xs" htmlFor={id}>
        Customer
      </label>
      <select
        id={id}
        className="form-input w-full"
        value={value}
        disabled={disabled}
        required={required}
        onChange={(e) => {
          const c = customers.find((c) => c.id === e.target.value);
          setSelected(c || null);
          onChange(e.target.value, c);
        }}
      >
        <option value="">Select customer</option>
        {value && !customers.some((c) => c.id === value) && (
          <option value={value}>{selected?.name || "Selected customer"}</option>
        )}
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <div className="flex justify-between text-xs">
        <button
          type="button"
          disabled={disabled || page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous customers
        </button>
        <span>
          Page {page} of {pages}
        </span>
        <button
          type="button"
          disabled={disabled || page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next customers
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
