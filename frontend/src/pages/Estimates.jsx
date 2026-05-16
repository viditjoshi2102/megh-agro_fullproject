import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { estimateApi } from '../services/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/common/PageHeader';
import Table from '../components/common/Table';
import Pagination from '../components/common/Pagination';
import { formatCurrency, formatDate, downloadBlob } from '../utils/helpers';

export default function Estimates() {
  const [page, setPage]           = useState(1);
  const [downloading, setDl]      = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['estimates', page],
    queryFn:  () => estimateApi.list({ page, limit: 20 }).then(r => r.data),
  });

  async function handleDownload(est) {
    setDl(est.id);
    try {
      const res = await estimateApi.download(est.id);
      downloadBlob(res.data, `${est.estimate_no.replace(/\//g,'-')}.pdf`);
    } catch { toast.error('Download failed'); }
    finally { setDl(null); }
  }

  const cols = [
    { key: 'estimate_no',      label: 'Estimate No.',  render: r => <span className="font-semibold text-blue-700">{r.estimate_no}</span> },
    { key: 'estimate_date',    label: 'Date',          render: r => formatDate(r.estimate_date) },
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
      <PageHeader title="Estimates" subtitle={`${data?.meta?.total || 0} estimates`} />
      <Table columns={cols} data={data?.data || []} loading={isLoading} />
      <Pagination page={page} limit={20} total={data?.meta?.total || 0} onChange={setPage} />
    </div>
  );
}
