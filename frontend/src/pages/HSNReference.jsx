import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hsnApi } from '../services/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Table from '../components/common/Table';
import Modal from '../components/common/Modal';
import BulkUploadModal from '../components/common/BulkUploadModal';
import { getErrorMessage } from '../utils/helpers';

const HSN_MANDATORY = ['hsn_code', 'gst_rate'];

function HSNForm({ hsn, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm({ defaultValues: hsn || {} });
  const mutation = useMutation({
    mutationFn: (d) => hsn ? hsnApi.update(hsn.id, d) : hsnApi.create(d),
    onSuccess: () => { toast.success(hsn ? 'Updated' : 'Created'); qc.invalidateQueries({ queryKey: ['hsn'] }); onClose(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div><label className="label">HSN Code *</label><input className="input" {...register('hsn_code', { required: true })} /></div>
      <div><label className="label">Category</label><input className="input" {...register('category')} /></div>
      <div><label className="label">GST Rate % *</label>
        <select className="input" {...register('gst_rate', { required: true })}>
          {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
        </select>
      </div>
      <div><label className="label">Notes</label><textarea className="input" rows={2} {...register('notes')} /></div>
      <div className="flex gap-3 justify-end"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : hsn ? 'Update' : 'Create'}</button></div>
    </form>
  );
}

export default function HSNReference() {
  const qc = useQueryClient();
  const [search, setSearch]  = useState('');
  const [modal, setModal]    = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['hsn', search],
    queryFn:  () => hsnApi.list({ search }).then(r => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => hsnApi.remove(id),
    onSuccess: () => { toast.success('Deactivated'); qc.invalidateQueries({ queryKey: ['hsn'] }); },
  });

  const cols = [
    { key: 'hsn_code',  label: 'HSN Code' },
    { key: 'category',  label: 'Category' },
    { key: 'gst_rate',  label: 'GST %',   render: r => `${r.gst_rate}%` },
    { key: 'cgst_rate', label: 'CGST %',  render: r => `${r.cgst_rate}%` },
    { key: 'sgst_rate', label: 'SGST %',  render: r => `${r.sgst_rate}%` },
    { key: 'notes',     label: 'Notes' },
    { key: 'actions',   label: 'Actions', render: r => (
      <div className="flex gap-2">
        <button className="text-brand-600 hover:underline text-sm" onClick={() => setModal({ hsn: r })}>Edit</button>
        <button className="text-red-500 hover:underline text-sm" onClick={() => deleteMutation.mutate(r.id)}>Delete</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="HSN-GST Reference" subtitle="Manage HSN codes and GST rates"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setBulkOpen(true)}>⬆ Bulk Upload</button>
            <button className="btn-primary"   onClick={() => setModal({ hsn: null })}>+ Add HSN</button>
          </div>
        } />
      <div className="mb-4">
        <input className="input max-w-xs" placeholder="Search HSN code or category..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <Table columns={cols} data={data || []} loading={isLoading} />
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal?.hsn ? 'Edit HSN' : 'Add HSN Code'} size="sm">
        <HSNForm hsn={modal?.hsn} onClose={() => setModal(null)} />
      </Modal>

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        entityLabel="HSN-GST Codes"
        templateApiFn={hsnApi.bulkTemplate}
        uploadApiFn={hsnApi.bulkUpload}
        invalidateKeys={['hsn']}
        mandatoryFields={HSN_MANDATORY}
      />
    </div>
  );
}
