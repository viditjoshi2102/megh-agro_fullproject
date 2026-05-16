const path   = require('path');
const fs     = require('fs');
const { pool }               = require('../config/database');
const { logAudit }           = require('../middleware/audit');
const { ROLES }              = require('../middleware/auth');
const { nextPINumber, getFinancialYear } = require('../utils/invoiceNumber');
const { generatePI }         = require('../services/pdfService');
const { amountInWords }      = require('../utils/amountInWords');

async function generate(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[order]] = await conn.execute(
      `SELECT o.*, d.dealer_name, d.dealer_code, d.gstin AS dealer_gstin, d.pan AS dealer_pan,
              d.address AS dealer_address, d.city AS dealer_city, d.state AS dealer_state,
              d.pin_code AS dealer_pin, d.contact_person, d.mobile AS dealer_contact
       FROM orders o JOIN dealers d ON o.dealer_id = d.id WHERE o.id = ?`,
      [req.params.orderId]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Check no existing PI
    const [[existingPI]] = await conn.execute('SELECT id, invoice_no FROM proforma_invoices WHERE order_id = ?', [order.id]);
    if (existingPI) {
      return res.status(409).json({ success: false, message: `PI already exists: ${existingPI.invoice_no}` });
    }

    const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    if (!items.length) return res.status(400).json({ success: false, message: 'Order has no items' });

    const invoiceNo = await nextPINumber(conn);
    const invoiceDate = new Date().toISOString().split('T')[0];
    const fy          = getFinancialYear();

    // Determine GST rates (use first item's rate — homogeneous assumption for single GST slab)
    const gstRate  = parseFloat(items[0].gst_percent);
    const cgstRate = gstRate / 2;
    const sgstRate = gstRate / 2;

    const piData = {
      order_id:       order.id,
      invoice_no:     invoiceNo,
      invoice_date:   invoiceDate,
      financial_year: fy,
      subtotal:       order.subtotal,
      cgst_rate:      cgstRate,
      cgst_amount:    order.cgst_amount,
      sgst_rate:      sgstRate,
      sgst_amount:    order.sgst_amount,
      total_tax:      order.total_tax,
      round_off:      order.round_off,
      grand_total:    order.grand_total,
      amount_in_words: amountInWords(order.grand_total),
    };

    const { filePath, fileName } = await generatePI(order, piData, items);
    const relPath = `storage/pdfs/${fileName}`;

    const [result] = await conn.execute(
      `INSERT INTO proforma_invoices (order_id, invoice_no, invoice_date, financial_year,
        subtotal, cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_tax, round_off, grand_total, amount_in_words, pdf_path, generated_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [piData.order_id, piData.invoice_no, piData.invoice_date, piData.financial_year,
       piData.subtotal, piData.cgst_rate, piData.cgst_amount, piData.sgst_rate, piData.sgst_amount,
       piData.total_tax, piData.round_off, piData.grand_total, piData.amount_in_words, relPath, req.user.id]
    );

    await conn.execute("UPDATE orders SET status = 'invoiced' WHERE id = ?", [order.id]);
    await conn.commit();

    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'GENERATE_PI', entity: 'proforma_invoices', entityId: result.insertId, newValues: { invoice_no: invoiceNo }, ipAddress: req.ip });

    res.status(201).json({
      success: true,
      message: 'Proforma Invoice generated',
      data: { id: result.insertId, invoice_no: invoiceNo, pdf_path: relPath },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

async function download(req, res, next) {
  try {
    const [[pi]] = await pool.execute('SELECT * FROM proforma_invoices WHERE id = ?', [req.params.id]);
    if (!pi) return res.status(404).json({ success: false, message: 'PI not found' });

    // Prevent path traversal — pdf_path must stay within storage/pdfs/
    const safePdfPath = pi.pdf_path.replace(/\\/g, '/');
    if (!safePdfPath.startsWith('storage/pdfs/')) {
      return res.status(400).json({ success: false, message: 'Invalid file path' });
    }
    const absPath = path.resolve(path.join(__dirname, '../../', safePdfPath));
    const pdfDir  = path.resolve(path.join(__dirname, '../../storage/pdfs'));
    if (!absPath.startsWith(pdfDir)) {
      return res.status(400).json({ success: false, message: 'Invalid file path' });
    }
    if (!fs.existsSync(absPath)) return res.status(404).json({ success: false, message: 'PDF file not found' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pi.invoice_no.replace(/\//g, '-')}.pdf"`);
    const stream = fs.createReadStream(absPath);
    stream.on('error', (e) => next(e));
    stream.pipe(res);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { from_date, to_date, salesperson_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (req.user.role_id === ROLES.SALESPERSON) { where += ' AND o.salesperson_id = ?'; params.push(req.user.id); }
    else if (salesperson_id)                    { where += ' AND o.salesperson_id = ?'; params.push(salesperson_id); }
    if (from_date) { where += ' AND pi.invoice_date >= ?'; params.push(from_date); }
    if (to_date)   { where += ' AND pi.invoice_date <= ?'; params.push(to_date); }
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM proforma_invoices pi JOIN orders o ON pi.order_id = o.id ${where}`, params
    );
    const [rows] = await pool.execute(
      `SELECT pi.id, pi.invoice_no, pi.invoice_date, pi.grand_total, pi.pdf_path,
              d.dealer_name, u.name AS salesperson_name, o.order_no
       FROM proforma_invoices pi JOIN orders o ON pi.order_id = o.id
       JOIN dealers d ON o.dealer_id = d.id JOIN users u ON o.salesperson_id = u.id
       ${where} ORDER BY pi.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
}

module.exports = { generate, download, list };
