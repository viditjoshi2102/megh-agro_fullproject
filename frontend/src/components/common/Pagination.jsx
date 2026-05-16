export default function Pagination({ page, limit, total, onChange }) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4">
      <p className="text-sm text-gray-500">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="btn-secondary py-1 px-3 text-sm disabled:opacity-40">Prev</button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
          return (
            <button key={p} onClick={() => onChange(p)} className={`py-1 px-3 rounded-lg text-sm font-medium ${p === page ? 'bg-brand-700 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{p}</button>
          );
        })}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="btn-secondary py-1 px-3 text-sm disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
