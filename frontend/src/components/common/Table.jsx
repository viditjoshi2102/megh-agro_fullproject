import Spinner from './Spinner';

export default function Table({ columns, data, loading, emptyMessage = 'No records found' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {loading ? (
            <tr><td colSpan={columns.length} className="py-12 text-center"><div className="flex justify-center"><Spinner /></div></td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-12 text-center text-gray-400">{emptyMessage}</td></tr>
          ) : (
            data.map((row, i) => (
              <tr key={row.id || i} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.tdClass || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
