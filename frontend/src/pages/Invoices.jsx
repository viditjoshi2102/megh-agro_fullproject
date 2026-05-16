import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { invoiceApi } from '../services/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Table from '../components/common/Table';
import Pagination from '../components/common/Pagination';
import { formatCurrency, formatDate, downloadBlob } from '../utils/helpers';

export default function Invoices() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [downloading, setDownloading] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, from, to],
    queryFn:  () => invoiceApi.list({ page, limit: 20, from_date: from, to_date: to }).then(r => r.data),
  });

  async function handleDownload(pi) {
    setDownloading(pi.id);
    try {
      const res = await invoiceApi.download(pi.id);
      downloadBlob(res.data, `${pi.invoice_no.replace(/\//g,'-')}.pdf`);
    } catch { toast.error('Download failed'); }
    finally { setDownloading(null); }
  }

  const cols = [
    { key: 'invoice_no',       label: 'Invoice No.',   render: r => <span className="font-semibold text-green-700">{r.invoice_no}</span> },
    { key: 'invoice_date',     label: 'Date',          render: r => formatDate(r.invoice_date) },
    { key: 'dealer_name',      label: 'Dealer' },
    { key: 'salesperson_name', label: 'Salesperson' },
    { key: 'order_no',         label: 'Order No' },
    { key: 'grand_total',      label: 'Amount',        render: r => `₹${formatCurrency(r.grand_total)}` },
    { key: 'download',         label: 'PDF',           render: r => (
      <button className="text-sm text-brand-600 hover:underline" disabled={downloading === r.id} onClick={() => handleDownload(r)}>
        {downloading === r.id ? '...' : '⬇️ Download'}
      </button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Proforma Invoices" subtitle={`${data?.meta?.total || 0} invoices`} />
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="input w-auto" type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} />
        <input className="input w-auto" type="date" value={to}   onChange={e => { setTo(e.target.value);   setPage(1); }} />
      </div>
      <Table columns={cols} data={data?.data || []} loading={isLoading} />
      <Pagination page={page} limit={20} total={data?.meta?.total || 0} onChange={setPage} />
    </div>
  );
}
