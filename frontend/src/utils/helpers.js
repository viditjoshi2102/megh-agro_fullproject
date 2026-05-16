export function formatCurrency(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function getErrorMessage(err) {
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export const STATUS_BADGE = {
  pending:    'badge-pending',
  invoiced:   'badge-invoiced',   // brand navy (see index.css)
  dispatched: 'badge-dispatched',
  cancelled:  'badge-cancelled',  // accent red (see index.css)
  active:     'badge-active',
  inactive:   'badge-inactive',
};
