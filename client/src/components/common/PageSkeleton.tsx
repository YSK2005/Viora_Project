export function PageSkeleton() {
  return (
    <div role="status" aria-label="Loading page" className="space-y-4">
      <span className="sr-only">Loading page</span>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 rounded-xl bg-slate-200 animate-pulse"
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
