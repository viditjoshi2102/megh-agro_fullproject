import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderApi, invoiceApi, estimateApi } from '../services/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Spinner from '../components/common/Spinner';
import { formatCurrency, formatDate, STATUS_BADGE, getErrorMessage, downloadBlob } from '../utils/helpers';
import { useAuthStore } from '../store/authStore';

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, hasPermission } = useAuthStore();

  const { data: orderData, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn:  () => orderApi.get(id).then(r => r.data.data),
  });

  const piMutation = useMutation({
    mutationFn: () => orderApi.generatePI(id),
    onSuccess:  (res) => { toast.success(`PI: ${res.data.data.invoice_no}`); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError:    (err) => toast.error(getErrorMessage(err)),
  });

  const estMutation = useMutation({
    mutationFn: () => orderApi.generateEstimate(id),
    onSuccess:  (res) => { toast.success(`Estimate: ${res.data.data.estimate_no}`); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError:    (err) => toast.error(getErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: (status) => orderApi.updateStatus(id, { status }),
    onSuccess:  () => { toast.success('Status updated'); qc.invalidateQueries({ queryKey: ['order', id] }); },
    onError:    (err) => toast.error(getErrorMessage(err)),
  });

  async function downloadPI() {
    try {
      const res = await invoiceApi.download(orderData.pi_id);
      downloadBlob(res.data, `${orderData.invoice_no}.pdf`);
    } catch { toast.error('Download failed'); }
  }

  async function downloadEst() {
    try {
      const res = await estimateApi.download(orderData.estimate_id);
      downloadBlob(res.data, `${orderData.estimate_no}.pdf`);
    } catch { toast.error('Download failed'); }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>;
  if (!orderData) return <div className="text-center py-20 text-gray-400">Order not found</div>;

  const o = orderData;

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title={`Order ${o.order_no}`} subtitle={formatDate(o.order_date)}
        action={
          <div className="flex gap-2">
            <Link to="/orders" className="btn-secondary py-1.5 px-3 text-sm">← Back</Link>
            {o.status === 'pending' && hasPermission('orders', 'create') && (
              <Link to={`/orders/${o.id}/edit`} className="btn-primary py-1.5 px-3 text-sm">Edit Order</Link>
            )}
          </div>
        } />

      {/* Status + Actions */}
      <div className="card mb-4 flex flex-wrap items-center gap-3">
        <span className={`${STATUS_BADGE[o.status]} text-sm px-3 py-1`}>{o.status}</span>
        {hasPermission('orders', 'edit') && (
          <select className="input w-auto text-sm" value={o.status} onChange={e => statusMutation.mutate(e.target.value)}>
            {['pending','invoiced','dispatched','cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {!o.pi_id && <button className="btn-primary py-1.5 px-3 text-sm" disabled={piMutation.isPending} onClick={() => piMutation.mutate()}>
            {piMutation.isPending ? <Spinner size="sm" /> : '🧾 Generate PI'}
          </button>}
          {o.pi_id && <button className="btn-secondary py-1.5 px-3 text-sm" onClick={downloadPI}>⬇️ Download PI</button>}
          <button className="btn-secondary py-1.5 px-3 text-sm" disabled={estMutation.isPending} onClick={() => estMutation.mutate()}>
            {estMutation.isPending ? <Spinner size="sm" /> : '📄 New Estimate'}
          </button>
          {o.estimate_id && <button className="btn-secondary py-1.5 px-3 text-sm" onClick={downloadEst}>⬇️ Download Est</button>}
        </div>
      </div>

      {/* PI Info */}
      {o.invoice_no && (
        <div className="card mb-4 bg-green-50 border-green-200">
          <p className="text-sm font-semibold text-green-700">Proforma Invoice: {o.invoice_no}</p>
        </div>
      )}

      {/* Dealer */}
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">Dealer / Buyer</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Name</span><p className="font-medium">{o.dealer_name}</p></div>
          <div><span className="text-gray-500">Code</span><p>{o.dealer_code}</p></div>
          <div><span className="text-gray-500">City / State</span><p>{o.dealer_city}, {o.dealer_state}</p></div>
          <div><span className="text-gray-500">GSTIN</span><p>{o.dealer_gstin || '—'}</p></div>
          <div><span className="text-gray-500">Contact</span><p>{o.contact_person}</p></div>
          <div><span className="text-gray-500">Mobile</span><p>{o.dealer_contact}</p></div>
        </div>
      </div>

      {/* Salesperson + Transporter */}
      <div className="card mb-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><span className="text-gray-500">Salesperson</span><p className="font-medium">{o.salesperson_name}</p></div>
          {o.transporter_name && <div><span className="text-gray-500">Transporter</span><p>{o.transporter_name} · {o.transporter_contact}</p></div>}
          {o.notes && <div className="col-span-2"><span className="text-gray-500">Notes</span><p>{o.notes}</p></div>}
        </div>
      </div>

      {/* Products */}
      <div className="card mb-4">
        <h3 className="font-semibold text-gray-800 mb-3">Products</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b text-xs uppercase">
              <th className="pb-2 pr-3">#</th><th className="pb-2 pr-3">Product</th><th className="pb-2 pr-3">HSN</th>
              <th className="pb-2 pr-3">GST%</th><th className="pb-2 pr-3">Qty</th>
              <th className="pb-2 pr-3">Rate</th><th className="pb-2">Amount</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(o.items || []).map((item, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3 text-gray-400">{i+1}</td>
                  <td className="py-2 pr-3">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-xs text-gray-400">{item.product_code}</p>
                    {item.is_rate_overridden && <span className="text-xs text-orange-500">Rate overridden</span>}
                  </td>
                  <td className="py-2 pr-3">{item.hsn_code}</td>
                  <td className="py-2 pr-3">{item.gst_percent}%</td>
                  <td className="py-2 pr-3">{item.quantity}</td>
                  <td className="py-2 pr-3">₹{formatCurrency(item.final_rate)}</td>
                  <td className="py-2 font-semibold">₹{formatCurrency(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Totals */}
      <div className="card bg-gray-50">
        <div className="space-y-1.5 text-sm max-w-xs ml-auto">
          <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span>₹{formatCurrency(o.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">CGST</span><span>₹{formatCurrency(o.cgst_amount)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">SGST</span><span>₹{formatCurrency(o.sgst_amount)}</span></div>
          <div className="flex justify-between"><span className="text-gray-600">Round Off</span><span>₹{formatCurrency(o.round_off)}</span></div>
          <div className="flex justify-between text-base font-bold pt-2 border-t"><span>Grand Total</span><span className="text-brand-700">₹{formatCurrency(o.grand_total)}</span></div>
        </div>
      </div>
    </div>
  );
}
