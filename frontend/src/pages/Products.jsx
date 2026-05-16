import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { productApi } from '../services/api';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Table from '../components/common/Table';
import Modal from '../components/common/Modal';
import Pagination from '../components/common/Pagination';
import BulkUploadModal from '../components/common/BulkUploadModal';
import { formatCurrency, getErrorMessage } from '../utils/helpers';

const PRODUCT_MANDATORY = ['product_code', 'product_name', 'hsn_code', 'gst_percent', 'dealer_price'];

const GST_RATES = [0, 5, 12, 18, 28];
const STOCK_STATUS = ['in_stock', 'limited', 'out_of_stock'];

function ProductForm({ product, categories, onClose }) {
  const qc = useQueryClient();
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: product || { unit: 'Nos', moq: 1, stock_status: 'in_stock' } });
  const mutation = useMutation({
    mutationFn: (d) => product ? productApi.update(product.id, d) : productApi.create(d),
    onSuccess: () => { toast.success(product ? 'Product updated' : 'Product created'); qc.invalidateQueries({ queryKey: ['products'] }); onClose(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  return (
    <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="label">Product Code *</label><input className="input" {...register('product_code', { required: true })} /></div>
        <div><label className="label">Product Name *</label><input className="input" {...register('product_name', { required: true })} /></div>
        <div><label className="label">Category</label>
          <select className="input" {...register('category_id')}>
            <option value="">-- Select --</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><label className="label">Unit</label><input className="input" {...register('unit')} /></div>
        <div><label className="label">HSN Code *</label><input className="input" {...register('hsn_code', { required: true })} /></div>
        <div><label className="label">GST % *</label>
          <select className="input" {...register('gst_percent', { required: true })}>
            {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>
        <div><label className="label">MRP (₹)</label><input className="input" type="number" step="0.01" {...register('mrp')} /></div>
        <div><label className="label">Dealer Price (₹) *</label><input className="input" type="number" step="0.01" {...register('dealer_price', { required: true })} /></div>
        <div><label className="label">MOQ</label><input className="input" type="number" {...register('moq')} /></div>
        <div><label className="label">Stock Status</label>
          <select className="input" {...register('stock_status')}>
            {STOCK_STATUS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2"><label className="label">Specification</label><textarea className="input" rows={2} {...register('specification')} /></div>
      </div>
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-200">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : product ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}

export default function Products() {
  const qc = useQueryClient();
  const [page, setPage]          = useState(1);
  const [search, setSearch]      = useState('');
  const [categoryId, setCatId]   = useState('');
  const [modal, setModal]        = useState(null);
  const [bulkOpen, setBulkOpen]  = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, categoryId],
    queryFn: () => productApi.list({ page, limit: 20, search, category_id: categoryId }).then(r => r.data),
  });
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => productApi.categories().then(r => r.data.data) });

  const cols = [
    { key: 'product_code', label: 'Code' },
    { key: 'product_name', label: 'Product Name' },
    { key: 'category_name', label: 'Category' },
    { key: 'hsn_code', label: 'HSN' },
    { key: 'gst_percent', label: 'GST%', render: r => `${r.gst_percent}%` },
    { key: 'dealer_price', label: 'Dealer Price', render: r => `₹${formatCurrency(r.dealer_price)}` },
    { key: 'stock_status', label: 'Stock', render: r => <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.stock_status === 'in_stock' ? 'bg-green-100 text-green-700' : r.stock_status === 'limited' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>{r.stock_status.replace('_',' ')}</span> },
    { key: 'actions', label: 'Actions', render: r => <button className="text-brand-600 hover:underline text-sm" onClick={() => setModal({ product: r })}>Edit</button> },
  ];

  return (
    <div>
      <PageHeader title="Products" subtitle={`${data?.meta?.total || 0} products`}
        action={
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setBulkOpen(true)}>⬆ Bulk Upload</button>
            <button className="btn-primary"   onClick={() => setModal({ product: null })}>+ Add Product</button>
          </div>
        } />
      <div className="flex gap-3 mb-4 flex-wrap">
        <input className="input max-w-xs" placeholder="Search products..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select className="input max-w-xs" value={categoryId} onChange={e => { setCatId(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {(cats || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <Table columns={cols} data={data?.data || []} loading={isLoading} />
      <Pagination page={page} limit={20} total={data?.meta?.total || 0} onChange={setPage} />
      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal?.product ? 'Edit Product' : 'Add Product'} size="lg">
        <ProductForm product={modal?.product} categories={cats || []} onClose={() => setModal(null)} />
      </Modal>

      <BulkUploadModal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        entityLabel="Products"
        templateApiFn={productApi.bulkTemplate}
        uploadApiFn={productApi.bulkUpload}
        invalidateKeys={['products', 'categories']}
        mandatoryFields={PRODUCT_MANDATORY}
      />
    </div>
  );
}
