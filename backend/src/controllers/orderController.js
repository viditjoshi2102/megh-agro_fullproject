const { pool }           = require('../config/database');
const { logAudit }       = require('../middleware/audit');
const { ROLES }          = require('../middleware/auth');
const { nextOrderNumber } = require('../utils/invoiceNumber');

function calcOrder(items) {
  let subtotal = 0;
  for (const item of items) {
    item.amount = parseFloat((item.final_rate * item.quantity).toFixed(2));
    subtotal += item.amount;
  }
  subtotal = parseFloat(subtotal.toFixed(2));

  // All items must share the same GST rate for CGST/SGST split
  // If mixed rates, we sum each product's tax independently
  let cgst = 0, sgst = 0;
  for (const item of items) {
    const tax    = parseFloat((item.amount * item.gst_percent / 100).toFixed(2));
    cgst += tax / 2;
    sgst += tax / 2;
  }
  cgst = parseFloat(cgst.toFixed(2));
  sgst = parseFloat(sgst.toFixed(2));
  const totalTax   = parseFloat((cgst + sgst).toFixed(2));
  const rawTotal   = subtotal + totalTax;
  const grandTotal = Math.round(rawTotal);
  const roundOff   = parseFloat((grandTotal - rawTotal).toFixed(2));
  return { subtotal, cgst_amount: cgst, sgst_amount: sgst, total_tax: totalTax, round_off: roundOff, grand_total: grandTotal };
}

async function list(req, res, next) {
  try {
    const { status, salesperson_id, dealer_id, from_date, to_date, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (req.user.role_id === ROLES.SALESPERSON) { where += ' AND o.salesperson_id = ?'; params.push(req.user.id); }
    else if (salesperson_id) { where += ' AND o.salesperson_id = ?'; params.push(salesperson_id); }
    if (status)    { where += ' AND o.status = ?'; params.push(status); }
    if (dealer_id) { where += ' AND o.dealer_id = ?'; params.push(dealer_id); }
    if (from_date) { where += ' AND o.order_date >= ?'; params.push(from_date); }
    if (to_date)   { where += ' AND o.order_date <= ?'; params.push(to_date); }

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM orders o ${where}`, params
    );
    const [rows] = await pool.execute(
      `SELECT o.id, o.order_no, o.status, o.order_date, o.grand_total, o.subtotal, o.cgst_amount, o.sgst_amount,
              o.transporter_name, o.notes,
              u.name AS salesperson_name, d.dealer_name, d.dealer_code, d.city AS dealer_city,
              pi.invoice_no, pi.id AS pi_id, est.estimate_no, est.id AS estimate_id
       FROM orders o
       JOIN users u ON o.salesperson_id = u.id
       JOIN dealers d ON o.dealer_id = d.id
       LEFT JOIN proforma_invoices pi ON pi.order_id = o.id
       LEFT JOIN estimates est ON est.order_id = o.id
       ${where} ORDER BY o.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const [[order]] = await pool.execute(
      `SELECT o.*, u.name AS salesperson_name,
              d.dealer_name, d.dealer_code, d.gstin AS dealer_gstin, d.pan AS dealer_pan,
              d.address AS dealer_address, d.city AS dealer_city, d.state AS dealer_state,
              d.pin_code AS dealer_pin, d.contact_person, d.mobile AS dealer_contact,
              pi.invoice_no, pi.id AS pi_id, pi.pdf_path AS pi_pdf,
              est.estimate_no, est.id AS estimate_id, est.pdf_path AS est_pdf
       FROM orders o
       JOIN users u ON o.salesperson_id = u.id
       JOIN dealers d ON o.dealer_id = d.id
       LEFT JOIN proforma_invoices pi ON pi.order_id = o.id
       LEFT JOIN estimates est ON est.order_id = o.id
       WHERE o.id = ?`,
      [req.params.id]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    if (req.user.role_id === ROLES.SALESPERSON && order.salesperson_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const [items] = await pool.execute(
      'SELECT * FROM order_items WHERE order_id = ?', [req.params.id]
    );
    res.json({ success: true, data: { ...order, items } });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { dealer_id, items, transporter_name, transporter_contact, notes, order_date } = req.body;

    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'Order must have at least one item' });
    if (items.length > 7) return res.status(400).json({ success: false, message: 'Maximum 7 products per order' });

    const totals  = calcOrder(items);
    const orderNo = nextOrderNumber();
    const date    = order_date || new Date().toISOString().split('T')[0];

    const [result] = await conn.execute(
      `INSERT INTO orders (order_no, salesperson_id, dealer_id, transporter_name, transporter_contact,
        subtotal, cgst_amount, sgst_amount, total_tax, round_off, grand_total, notes, order_date)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [orderNo, req.user.id, dealer_id, transporter_name, transporter_contact,
       totals.subtotal, totals.cgst_amount, totals.sgst_amount, totals.total_tax,
       totals.round_off, totals.grand_total, notes, date]
    );
    const orderId = result.insertId;

    for (const item of items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, product_code, product_name, hsn_code, gst_percent, quantity, dealer_price, final_rate, amount, is_rate_overridden)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [orderId, item.product_id, item.product_code, item.product_name, item.hsn_code,
         item.gst_percent, item.quantity, item.dealer_price, item.final_rate, item.amount,
         item.final_rate !== item.dealer_price]
      );
    }

    await conn.commit();
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'CREATE_ORDER', entity: 'orders', entityId: orderId, newValues: { orderNo, dealer_id }, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'Order created', data: { id: orderId, order_no: orderNo, ...totals } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

async function update(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[order]] = await conn.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.status !== 'pending') {
      return res.status(409).json({ success: false, message: 'Only pending orders can be edited' });
    }
    if (req.user.role_id === ROLES.SALESPERSON && order.salesperson_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { dealer_id, items, transporter_name, transporter_contact, notes, order_date } = req.body;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'Order must have at least one item' });

    const totals = calcOrder(items);

    await conn.execute(
      `UPDATE orders SET dealer_id=?, transporter_name=?, transporter_contact=?, notes=?, order_date=?,
       subtotal=?, cgst_amount=?, sgst_amount=?, total_tax=?, round_off=?, grand_total=? WHERE id=?`,
      [dealer_id, transporter_name || null, transporter_contact || null, notes || null, order_date,
       totals.subtotal, totals.cgst_amount, totals.sgst_amount, totals.total_tax, totals.round_off, totals.grand_total,
       req.params.id]
    );

    await conn.execute('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);

    for (const item of items) {
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, product_code, product_name, hsn_code, gst_percent, quantity, dealer_price, final_rate, amount, is_rate_overridden)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [req.params.id, item.product_id, item.product_code, item.product_name, item.hsn_code,
         item.gst_percent, item.quantity, item.dealer_price, item.final_rate, item.amount,
         item.final_rate !== item.dealer_price]
      );
    }

    await conn.commit();
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'UPDATE_ORDER', entity: 'orders', entityId: parseInt(req.params.id), newValues: { dealer_id, item_count: items.length }, ipAddress: req.ip });
    res.json({ success: true, message: 'Order updated', data: { id: parseInt(req.params.id), ...totals } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    const allowed = ['pending','invoiced','dispatched','cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const [[old]] = await pool.execute('SELECT status FROM orders WHERE id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ success: false, message: 'Order not found' });
    await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'UPDATE_ORDER_STATUS', entity: 'orders', entityId: parseInt(req.params.id), oldValues: old, newValues: { status }, ipAddress: req.ip });
    res.json({ success: true, message: 'Status updated' });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, updateStatus };
