import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import StatCard from '../components/common/StatCard';
import PageHeader from '../components/common/PageHeader';
import Spinner from '../components/common/Spinner';
import { formatCurrency, formatDate, STATUS_BADGE } from '../utils/helpers';

function OwnerDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-owner'], queryFn: () => dashboardApi.owner().then(r => r.data.data) });
  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  const d = data || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders"    value={d.orderStats?.total_orders || 0} icon="📋" color="navy" />
        <StatCard label="Pending Orders"  value={d.orderStats?.pending || 0}       icon="⏳" color="yellow" />
        <StatCard label="Invoiced"        value={d.orderStats?.invoiced || 0}       icon="🧾" color="green" />
        <StatCard label="Total Revenue"   value={`₹${formatCurrency(d.orderStats?.total_revenue)}`} icon="💰" color="purple" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Top Salespersons</h3>
          <div className="space-y-2">
            {(d.salespersonStats || []).map(s => (
              <div key={s.id} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-sm font-medium">{s.name}</span>
                <div className="text-right">
                  <span className="text-sm text-gray-700 font-semibold">₹{formatCurrency(s.revenue)}</span>
                  <span className="text-xs text-gray-400 block">{s.order_count} orders</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Recent Orders</h3>
          <div className="space-y-2">
            {(d.recentOrders || []).map((o, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium">{o.order_no}</p>
                  <p className="text-xs text-gray-400">{o.dealer_name} · {o.salesperson_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">₹{formatCurrency(o.grand_total)}</p>
                  <span className={STATUS_BADGE[o.status]}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(d.lowStock || []).length > 0 && (
        <div className="card border-l-4 border-l-yellow-400">
          <h3 className="font-semibold text-gray-800 mb-3">⚠️ Low / Out of Stock Products</h3>
          <div className="flex flex-wrap gap-2">
            {d.lowStock.map(p => (
              <span key={p.id} className="px-2 py-1 text-xs bg-yellow-50 text-yellow-800 rounded-full border border-yellow-200">
                {p.product_code} – {p.stock_status.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-admin'], queryFn: () => dashboardApi.admin().then(r => r.data.data) });
  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  const d = data || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders"    value={d.orderStats?.total || 0}    icon="📋" color="navy" />
        <StatCard label="Pending"         value={d.orderStats?.pending || 0}  icon="⏳" color="yellow" />
        <StatCard label="Proforma Invs."  value={d.piCount?.total || 0}       icon="🧾" color="green" />
        <StatCard label="Estimates"       value={d.estCount?.total || 0}      icon="📄" color="purple" />
      </div>
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b">
              <th className="pb-2 pr-4">Order No</th><th className="pb-2 pr-4">Dealer</th>
              <th className="pb-2 pr-4">Salesperson</th><th className="pb-2 pr-4">Date</th>
              <th className="pb-2 pr-4">Amount</th><th className="pb-2">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(d.recentOrders || []).map((o, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-brand-600">{o.order_no}</td>
                  <td className="py-2 pr-4">{o.dealer_name}</td>
                  <td className="py-2 pr-4">{o.salesperson_name}</td>
                  <td className="py-2 pr-4">{formatDate(o.order_date)}</td>
                  <td className="py-2 pr-4 font-semibold">₹{formatCurrency(o.grand_total)}</td>
                  <td className="py-2"><span className={STATUS_BADGE[o.status]}>{o.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SalespersonDashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-sp'], queryFn: () => dashboardApi.salesperson().then(r => r.data.data) });
  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>;
  const d = data || {};
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="My Orders"    value={d.myOrders?.total || 0}   icon="📋" color="navy" />
        <StatCard label="Pending"      value={d.myOrders?.pending || 0} icon="⏳" color="yellow" />
        <StatCard label="Invoiced"     value={d.myOrders?.invoiced || 0}icon="🧾" color="green" />
        <StatCard label="My Revenue"   value={`₹${formatCurrency(d.myOrders?.revenue)}`} icon="💰" color="purple" />
      </div>
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">My Recent Orders</h3>
        <div className="space-y-3">
          {(d.recent || []).map((o, i) => (
            <div key={i} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
              <div>
                <p className="text-sm font-medium">{o.order_no}</p>
                <p className="text-xs text-gray-400">{o.dealer_name} · {formatDate(o.order_date)}</p>
                {o.invoice_no && <p className="text-xs text-green-600 mt-0.5">PI: {o.invoice_no}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">₹{formatCurrency(o.grand_total)}</p>
                <span className={`${STATUS_BADGE[o.status]} mt-0.5`}>{o.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, hasPermission } = useAuthStore();
  const isOwner = hasPermission('roles', 'view');
  const isAdmin = !isOwner && hasPermission('users', 'create');
  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Welcome back, ${user?.name}`} />
      {isOwner && <OwnerDashboard />}
      {isAdmin && <AdminDashboard />}
      {!isOwner && !isAdmin && <SalespersonDashboard />}
    </div>
  );
}
