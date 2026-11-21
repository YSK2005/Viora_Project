import { useEffect, useState } from "react";
import { Product } from "../../types";
import { fetchProducts } from "../../services/api";
export function ProductSearchSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (product?: Product) => void;
}) {
  const [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [products, setProducts] = useState<Product[]>([]),
    [selected, setSelected] = useState<Product>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        fetchProducts({ search: query, page, limit: 20, isActive: "true" })
          .then((r) => {
            if (active) {
              setProducts(r.products);
              setPages(r.pagination?.totalPages || 1);
              setError("");
            }
          })
          .catch(() => {
            if (active) setError("Catalog unavailable");
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, page]);
  return (
    <div className="space-y-1">
      <input
        aria-label="Search catalog"
        className="w-full border rounded p-1"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Search catalog"
      />
      <select
        aria-label="Catalog item"
        className="w-full border rounded p-1"
        value={value}
        onChange={(e) => {
          const p = products.find((p) => p.id === e.target.value);
          setSelected(p);
          onChange(p);
        }}
      >
        <option value="">Custom item</option>
        {value && !products.some((p) => p.id === value) && (
          <option value={value}>{selected?.name || "Selected product"}</option>
        )}
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="flex justify-between gap-1">
        <button
          type="button"
          aria-label="Previous catalog page"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          ←
        </button>
        <span>
          {page}/{pages}
        </span>
        <button
          type="button"
          aria-label="Next catalog page"
          disabled={page >= pages}
          onClick={() => setPage((p) => p + 1)}
        >
          →
        </button>
      </div>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
