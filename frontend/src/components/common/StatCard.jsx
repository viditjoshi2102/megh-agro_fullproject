export default function StatCard({ label, value, icon, color = 'navy', sub }) {
  const colors = {
    navy:   'bg-brand-50  text-brand-700',
    red:    'bg-accent-50 text-accent-600',
    green:  'bg-green-50  text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="card flex items-start gap-4">
      {icon && (
        <div className={`rounded-xl p-3 text-xl flex-shrink-0 ${colors[color]}`}>{icon}</div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
