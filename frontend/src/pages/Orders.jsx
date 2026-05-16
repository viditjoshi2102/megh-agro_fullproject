import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi } from '../services/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Table from '../components/common/Table';
import Pagination from '../components/common/Pagination';
import { formatCurrency, formatDate, STATUS_BADGE, getErrorMessage } from '../utils/helpers';

const STATUSES = ['', 'pending', 'invoiced', 'dispatched', 'cancelled'];

export default function Orders() {
  const qc       = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage]     = useState(1);
  const [status, setStatus] = useState('');
  const [from, setFrom]     = useState('');
  const [to, setTo]         = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', page, status, from, to],
    queryFn: () => orderApi.list({ page, limit: 20, status, from_date: from, to_date: to }).then(r => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => orderApi.updateStatus(id, { status }),
    onSuccess: () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const piMutation = useMutation({
    mutationFn: (id) => orderApi.generatePI(id),
    onSuccess: (res) => { toast.success(`PI generated: ${res.data.data.invoice_no}`); qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const estMutation = useMutation({
    mutationFn: (id) => orderApi.generateEstimate(id),
    onSuccess: (res) => { toast.success(`Estimate generated: ${res.data.data.estimate_no}`); qc.invalidateQueries({ queryKey: ['orders'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cols = [
    { key: 'order_no',        label: 'Order No',   render: r => <Link to={`/orders/${r.id}`} className="text-brand-600 hover:underline font-medium">{r.order_no}</Link> },
    { key: 'dealer_name',     label: 'Dealer',     render: r => <div><p className="font-medium">{r.dealer_name}</p><p className="text-xs text-gray-400">{r.dealer_city}</p></div> },
    { key: 'salesperson_name',label: 'Salesperson' },
    { key: 'order_date',      label: 'Date',       render: r => formatDate(r.order_date) },
    { key: 'grand_total',     label: 'Amount',     render: r => <span className="font-semibold">₹{formatCurrency(r.grand_total)}</span> },
    { key: 'status',          label: 'Status',     render: r => <span className={STATUS_BADGE[r.status]}>{r.status}</span> },
    { key: 'invoice_no',      label: 'PI / Est',   render: r => (
      <div className="text-xs space-y-0.5">
        {r.invoice_no  ? <p className="text-green-600 font-medium">{r.invoice_no}</p>  : null}
        {r.estimate_no ? <p className="text-blue-600 font-medium">{r.estimate_no}</p>  : null}
      </div>
    )},
    { key: 'actions', label: 'Actions', render: r => (
      <div className="flex flex-wrap gap-1.5">
        <button className="text-xs text-brand-700 border border-brand-200 px-2 py-1 rounded hover:bg-brand-50"
          onClick={() => navigate(`/orders/${r.id}`)}>View</button>
        {!r.invoice_no && (
          <button className="text-xs text-accent-600 border border-accent-200 px-2 py-1 rounded hover:bg-accent-50"
            disabled={piMutation.isPending} onClick={() => piMutation.mutate(r.id)}>Gen PI</button>
        )}
        <button className="text-xs text-brand-600 border border-brand-200 px-2 py-1 rounded hover:bg-brand-50"
          disabled={estMutation.isPending} onClick={() => estMutation.mutate(r.id)}>Estimate</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Orders" subtitle={`${data?.meta?.total || 0} total orders`}
        action={<Link to="/orders/new" className="btn-primary">+ New Order</Link>} />

      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input w-auto" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          {STATUSES.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
        </select>
        <input className="input w-auto" type="date" placeholder="From" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
        <input className="input w-auto" type="date" placeholder="To"   value={to}   onChange={e => { setTo(e.target.value);   setPage(1); }} />
      </div>

      <Table columns={cols} data={data?.data || []} loading={isLoading} />
      <Pagination page={page} limit={20} total={data?.meta?.total || 0} onChange={setPage} />
    </div>
  );
}
