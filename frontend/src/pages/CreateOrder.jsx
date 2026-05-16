import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { dealerApi, productApi, orderApi } from '../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, getErrorMessage } from '../utils/helpers';
import Spinner from '../components/common/Spinner';
import PageHeader from '../components/common/PageHeader';

const MAX_ITEMS = 7;

function calcTotals(items) {
  let subtotal = 0, cgst = 0, sgst = 0;
  for (const item of items) {
    if (!item.product_id || !item.quantity || !item.final_rate) continue;
    const amt  = parseFloat((item.final_rate * item.quantity).toFixed(2));
    const tax  = parseFloat((amt * item.gst_percent / 100).toFixed(2));
    subtotal += amt;
    cgst     += tax / 2;
    sgst     += tax / 2;
  }
  subtotal = parseFloat(subtotal.toFixed(2));
  cgst     = parseFloat(cgst.toFixed(2));
  sgst     = parseFloat(sgst.toFixed(2));
  const totalTax   = parseFloat((cgst + sgst).toFixed(2));
  const rawTotal   = subtotal + totalTax;
  const grandTotal = Math.round(rawTotal);
  const roundOff   = parseFloat((grandTotal - rawTotal).toFixed(2));
  return { subtotal, cgst, sgst, totalTax, roundOff, grandTotal };
}

function emptyItem() {
  return { product_id: '', product_code: '', product_name: '', hsn_code: '', gst_percent: 0, dealer_price: 0, final_rate: '', quantity: 1, amount: 0 };
}

export default function CreateOrder() {
  const navigate = useNavigate();
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealer, setDealer]   = useState(null);
  const [items, setItems]     = useState([emptyItem()]);
  const [transporter, setTransporter]  = useState({ name: '', contact: '' });
  const [notes, setNotes]     = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [productSearch, setProductSearch] = useState('');

  const { data: dealers } = useQuery({
    queryKey: ['dealers-dd', dealerSearch],
    queryFn: () => dealerApi.dropdown({ search: dealerSearch }).then(r => r.data.data),
    enabled: dealerSearch.length > 0,
  });

  const { data: products } = useQuery({
    queryKey: ['products-dd', productSearch],
    queryFn: () => productApi.dropdown({ search: productSearch }).then(r => r.data.data),
    enabled: productSearch.length >= 2,
  });

  const totals = calcTotals(items);

  const mutation = useMutation({
    mutationFn: (payload) => orderApi.create(payload),
    onSuccess: (res) => {
      toast.success(`Order ${res.data.data.order_no} created!`);
      navigate(`/orders/${res.data.data.id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function handleDealerSelect(d) {
    setDealer(d);
    setDealerSearch('');
  }

  function handleProductSelect(idx, prod) {
    setItems(prev => prev.map((item, i) => i === idx
      ? { ...item, product_id: prod.id, product_code: prod.product_code, product_name: prod.product_name, hsn_code: prod.hsn_code, gst_percent: parseFloat(prod.gst_percent), dealer_price: parseFloat(prod.dealer_price), final_rate: parseFloat(prod.dealer_price), amount: parseFloat(prod.dealer_price) * item.quantity }
      : item
    ));
    setProductSearch('');
  }

  function updateItem(idx, field, value) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === 'quantity' || field === 'final_rate') {
        updated.amount = parseFloat(((parseFloat(updated.final_rate) || 0) * (parseInt(updated.quantity) || 0)).toFixed(2));
      }
      return updated;
    }));
  }

  function removeItem(idx) {
    if (items.length === 1) { setItems([emptyItem()]); return; }
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!dealer) { toast.error('Please select a dealer'); return; }
    const filledItems = items.filter(it => it.product_id && it.quantity > 0 && it.final_rate > 0);
    if (!filledItems.length) { toast.error('Add at least one product'); return; }
    mutation.mutate({
      dealer_id: dealer.id,
      items: filledItems.map(it => ({
        product_id: it.product_id, product_code: it.product_code, product_name: it.product_name,
        hsn_code: it.hsn_code, gst_percent: it.gst_percent, quantity: parseInt(it.quantity),
        dealer_price: parseFloat(it.dealer_price), final_rate: parseFloat(it.final_rate), amount: it.amount,
      })),
      transporter_name:    transporter.name,
      transporter_contact: transporter.contact,
      notes,
      order_date: orderDate,
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Create Order" subtitle="Fill in dealer, products, and submit" />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Dealer Section */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Dealer *</h3>
          {dealer ? (
            <div className="flex items-start justify-between bg-brand-50 rounded-xl p-3 border border-brand-200">
              <div>
                <p className="font-semibold text-gray-900">{dealer.dealer_name} <span className="text-xs text-gray-500">({dealer.dealer_code})</span></p>
                <p className="text-sm text-gray-600">{dealer.city}, {dealer.state}</p>
                {dealer.gstin && <p className="text-xs text-gray-500 mt-0.5">GSTIN: {dealer.gstin}</p>}
              </div>
              <button type="button" onClick={() => setDealer(null)} className="text-red-500 text-sm hover:underline">Change</button>
            </div>
          ) : (
            <div className="relative">
              <input className="input" placeholder="Search dealer name or code..."
                value={dealerSearch} onChange={e => setDealerSearch(e.target.value)} />
              {dealers && dealerSearch && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-60 overflow-y-auto">
                  {dealers.length === 0
                    ? <p className="p-3 text-sm text-gray-400">No dealers found</p>
                    : dealers.map(d => (
                      <button type="button" key={d.id} onClick={() => handleDealerSelect(d)}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm transition-colors">
                        <span className="font-medium">{d.dealer_name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{d.dealer_code} · {d.city}</span>
                      </button>
                    ))
                  }
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order Details */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Order Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Order Date</label>
              <input className="input" type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>
            <div><label className="label">Notes</label>
              <input className="input" placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Transporter */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-3">Transporter (Optional)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Transporter Name</label>
              <input className="input" value={transporter.name} onChange={e => setTransporter(t => ({ ...t, name: e.target.value }))} />
            </div>
            <div><label className="label">Contact</label>
              <input className="input" type="tel" value={transporter.contact} onChange={e => setTransporter(t => ({ ...t, contact: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Products */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Products ({items.filter(i => i.product_id).length}/{MAX_ITEMS})</h3>
            {items.length < MAX_ITEMS && (
              <button type="button" className="btn-secondary py-1.5 px-3 text-sm" onClick={() => setItems(p => [...p, emptyItem()])}>+ Add Row</button>
            )}
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-3 bg-gray-50">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase">Item {idx + 1}</span>
                  <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
                </div>

                {/* Product Search */}
                {!item.product_id ? (
                  <div className="relative">
                    <input className="input bg-white" placeholder="Search product name or code (min 2 chars)..."
                      value={idx === items.findIndex(i => !i.product_id && productSearch) ? productSearch : ''}
                      onChange={e => setProductSearch(e.target.value)}
                      onFocus={() => setProductSearch('')} />
                    {products && productSearch.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-52 overflow-y-auto">
                        {products.length === 0
                          ? <p className="p-3 text-sm text-gray-400">No products found</p>
                          : products.map(p => (
                            <button type="button" key={p.id} onClick={() => handleProductSelect(idx, p)}
                              className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm transition-colors">
                              <span className="font-medium">{p.product_name}</span>
                              <span className="text-xs text-gray-400 ml-2">{p.product_code} · GST {p.gst_percent}%</span>
                              <span className="float-right text-xs font-semibold text-brand-600">₹{formatCurrency(p.dealer_price)}</span>
                            </button>
                          ))
                        }
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.product_name}</p>
                        <p className="text-xs text-gray-500">{item.product_code} · HSN {item.hsn_code} · GST {item.gst_percent}%</p>
                      </div>
                      <button type="button" onClick={() => updateItem(idx, 'product_id', '')} className="text-xs text-brand-600 hover:underline">Change</button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label text-xs">Qty</label>
                        <input className="input bg-white" type="number" min="1"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Rate (₹) <span className="text-gray-400 font-normal">Dealer: {formatCurrency(item.dealer_price)}</span></label>
                        <input className={`input bg-white ${parseFloat(item.final_rate) !== item.dealer_price ? 'border-orange-400 focus:border-orange-400' : ''}`}
                          type="number" step="0.01" value={item.final_rate}
                          onChange={e => updateItem(idx, 'final_rate', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Amount</label>
                        <div className="input bg-gray-100 text-right font-semibold">₹{formatCurrency(item.amount)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Totals Summary */}
        <div className="card bg-brand-50 border-brand-200">
          <h3 className="font-semibold text-gray-800 mb-3">Order Summary</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-600">Subtotal</span><span className="font-medium">₹{formatCurrency(totals.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">CGST</span><span>₹{formatCurrency(totals.cgst)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">SGST</span><span>₹{formatCurrency(totals.sgst)}</span></div>
            <div className="flex justify-between"><span className="text-gray-600">Total Tax</span><span>₹{formatCurrency(totals.totalTax)}</span></div>
            {totals.roundOff !== 0 && <div className="flex justify-between"><span className="text-gray-600">Round Off</span><span>₹{formatCurrency(totals.roundOff)}</span></div>}
            <div className="flex justify-between pt-2 border-t border-brand-200 text-base font-bold"><span>Grand Total</span><span className="text-accent-600">₹{formatCurrency(totals.grandTotal)}</span></div>
          </div>
        </div>

        <div className="flex gap-3 pb-6">
          <button type="button" className="btn-secondary flex-1" onClick={() => navigate('/orders')}>Cancel</button>
          <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2" disabled={mutation.isPending}>
            {mutation.isPending && <Spinner size="sm" />}
            {mutation.isPending ? 'Submitting...' : 'Submit Order'}
          </button>
        </div>
      </form>
    </div>
  );
}
