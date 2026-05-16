import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dealerApi, userApi } from '../services/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Table from '../components/common/Table';
import Modal from '../components/common/Modal';
import Pagination from '../components/common/Pagination';
import ConfirmDialog from '../components/common/ConfirmDialog';
import Spinner from '../components/common/Spinner';
import BulkUploadModal from '../components/common/BulkUploadModal';
import { formatCurrency, getErrorMessage, STATUS_BADGE } from '../utils/helpers';
import { useAuthStore } from '../store/authStore';

const DEALER_MANDATORY = ['dealer_code', 'dealer_name'];

function DealerForm({ dealer, onClose }) {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const { data: usersData } = useQuery({ queryKey: ['users-dropdown'], queryFn: () => userApi.dropdown().then(r => r.data.data) });
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: dealer || {} });

  const mutation = useMutation({
    mutationFn: (d) => dealer ? dealerApi.update(dealer.id, d) : dealerApi.create(d),
    onSuccess: () => { toast.success(dealer ? 'Dealer updated' : 'Dealer created'); qc.invalidateQueries({ queryKey: ['dealers'] }); onClose(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Dealer Code *</label><input className="input" {...register('dealer_code', { required: true })} />{errors.dealer_code && <p className="text-red-500 text-xs mt-1">Required</p>}</div>
        <div><label className="label">Dealer Name *</label><input className="input" {...register('dealer_name', { required: true })} /></div>
        <div><label className="label">Contact Person</label><input className="input" {...register('contact_person')} /></div>
        <div><label className="label">Mobile</label><input className="input" type="tel" {...register('mobile')} /></div>
        <div><label className="label">WhatsApp</label><input className="input" type="tel" {...register('whatsapp')} /></div>
        <div><label className="label">Email</label><input className="input" type="email" {...register('email')} /></div>
        <div className="sm:col-span-2"><label className="label">Address</label><textarea className="input" rows={2} {...register('address')} /></div>
        <div><label className="label">City</label><input className="input" {...register('city')} /></div>
        <div><label className="label">State</label><input className="input" {...register('state')} /></div>
        <div><label className="label">PIN Code</label><input className="input" {...register('pin_code')} /></div>
        <div><label className="label">GSTIN</label><input className="input" {...register('gstin')} /></div>
        <div><label className="label">PAN</label><input className="input" {...register('pan')} /></div>
        <div><label className="label">Credit Limit (₹)</label><input className="input" type="number" step="0.01" {...register('credit_limit')} /></div>
        <div><label className="label">Payment Terms</label><input className="input" {...register('payment_terms')} /></div>
        <div><label className="label">Discount %</label><input className="input" type="number" step="0.01" {...register('discount_percent')} /></div>
        <div><label className="label">Status</label>
          <select className="input" {...register('status')}><option value="active">Active</option><option value="inactive">Inactive</option></select>
        </div>
        {hasPermission('dealers', 'edit') && (
          <div><label className="label">Salesperson</label>
            <select className="input" {...register('salesperson_id')}>
              <option value="">-- Select --</option>
              {(usersData || []).filter(u => u.role_name === 'salesperson').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-200">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : dealer ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

export default function Dealers() {
  const { hasPermission } = useAuthStore();
  const qc   = useQueryClient();
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal]   = useState(null);
  const [delId, setDelId]   = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['dealers', page, search],
    queryFn:  () => dealerApi.list({ page, limit: 20, search }).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dealerApi.remove(id),
    onSuccess:  () => { toast.success('Dealer deactivated'); qc.invalidateQueries({ queryKey: ['dealers'] }); setDelId(null); },
    onError:    (err) => toast.error(getErrorMessage(err)),
  });

  const cols = [
    { key: 'dealer_code', label: 'Code' },
    { key: 'dealer_name', label: 'Dealer Name' },
    { key: 'city',        label: 'City' },
    { key: 'mobile',      label: 'Mobile' },
    { key: 'gstin',       label: 'GSTIN' },
    { key: 'status',      label: 'Status', render: r => <span className={STATUS_BADGE[r.status]}>{r.status}</span> },
    { key: 'salesperson_name', label: 'Salesperson' },
    { key: 'actions',    label: 'Actions', render: r => (
      <div className="flex gap-2">
        <button className="text-brand-600 hover:underline text-sm" onClick={() => setModal({ type: 'edit', dealer: r })}>Edit</button>
        {hasPermission('dealers', 'delete') && <button className="text-red-500 hover:underline text-sm" onClick={() => setDelId(r.id)}>Delete</button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Dealers" subtitle={`${data?.meta?.total || 0} dealers`}
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setBulkOpen(true)}>⬆ Bulk Upload</button>
            <button className="btn-primary"   onClick={() => setModal({ type: 'add' })}>+ Add Dealer</button>
          </div>
        } />

      <div className="mb-4">
        <input className="input max-w-xs" placeholder="Search dealers..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <Table columns={cols} data={data?.data || []} loading={isLoading} />
      <Pagination page={page} limit={20} total={data?.meta?.total || 0} onChange={setPage} />

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === 'edit' ? 'Edit Dealer' : 'Add Dealer'} size="lg">
        <DealerForm dealer={modal?.dealer} onClose={() => setModal(null)} />
      </Modal>

      <ConfirmDialog open={!!delId} onClose={() => setDelId(null)} onConfirm={() => deleteMutation.mutate(delId)}
        title="Deactivate Dealer" message="Are you sure you want to deactivate this dealer?" loading={deleteMutation.isPending} />

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        entityLabel="Dealers"
        templateApiFn={dealerApi.bulkTemplate}
        uploadApiFn={dealerApi.bulkUpload}
        invalidateKeys={['dealers']}
        mandatoryFields={DEALER_MANDATORY}
      />
    </div>
  );
}
