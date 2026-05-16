const path   = require('path');
const fs     = require('fs');
const { pool }                = require('../config/database');
const { logAudit }            = require('../middleware/audit');
const { ROLES }               = require('../middleware/auth');
const { nextEstimateNumber }  = require('../utils/invoiceNumber');
const { generateEstimate }    = require('../services/pdfService');
const { amountInWords }       = require('../utils/amountInWords');

async function generate(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[order]] = await conn.execute(
      `SELECT o.*, d.dealer_name, d.address AS dealer_address, d.city AS dealer_city,
              d.state AS dealer_state, d.pin_code AS dealer_pin,
              d.contact_person, d.mobile AS dealer_contact
       FROM orders o JOIN dealers d ON o.dealer_id = d.id WHERE o.id = ?`,
      [req.params.orderId]
    );
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const [items] = await conn.execute('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    if (!items.length) return res.status(400).json({ success: false, message: 'Order has no items' });

    const estimateNo   = await nextEstimateNumber(conn);
    const estimateDate = new Date().toISOString().split('T')[0];

    const rawTotal   = order.subtotal;
    const grandTotal = Math.round(rawTotal);
    const roundOff   = parseFloat((grandTotal - rawTotal).toFixed(2));

    const estData = {
      order_id:       order.id,
      estimate_no:    estimateNo,
      estimate_date:  estimateDate,
      subtotal:       order.subtotal,
      round_off:      roundOff,
      grand_total:    grandTotal,
      amount_in_words: amountInWords(grandTotal),
    };

    const { filePath, fileName } = await generateEstimate(order, estData, items);
    const relPath = `storage/pdfs/${fileName}`;

    const [result] = await conn.execute(
      `INSERT INTO estimates (order_id, estimate_no, estimate_date, subtotal, round_off, grand_total, amount_in_words, pdf_path, generated_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [estData.order_id, estData.estimate_no, estData.estimate_date, estData.subtotal,
       estData.round_off, estData.grand_total, estData.amount_in_words, relPath, req.user.id]
    );

    await conn.commit();
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'GENERATE_ESTIMATE', entity: 'estimates', entityId: result.insertId, newValues: { estimate_no: estimateNo }, ipAddress: req.ip });

    res.status(201).json({
      success: true,
      message: 'Estimate generated',
      data: { id: result.insertId, estimate_no: estimateNo, pdf_path: relPath },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

async function download(req, res, next) {
  try {
    const [[est]] = await pool.execute('SELECT * FROM estimates WHERE id = ?', [req.params.id]);
    if (!est) return res.status(404).json({ success: false, message: 'Estimate not found' });

    // Prevent path traversal — pdf_path must stay within storage/pdfs/
    const safePdfPath = est.pdf_path.replace(/\\/g, '/');
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
    res.setHeader('Content-Disposition', `attachment; filename="${est.estimate_no.replace(/\//g, '-')}.pdf"`);
    const stream = fs.createReadStream(absPath);
    stream.on('error', (e) => next(e));
    stream.pipe(res);
  } catch (err) { next(err); }
}

async function list(req, res, next) {
  try {
    const { salesperson_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (req.user.role_id === ROLES.SALESPERSON) { where += ' AND o.salesperson_id = ?'; params.push(req.user.id); }
    else if (salesperson_id)                    { where += ' AND o.salesperson_id = ?'; params.push(salesperson_id); }
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM estimates e JOIN orders o ON e.order_id = o.id ${where}`, params
    );
    const [rows] = await pool.execute(
      `SELECT e.id, e.estimate_no, e.estimate_date, e.grand_total, e.pdf_path,
              d.dealer_name, u.name AS salesperson_name, o.order_no
       FROM estimates e JOIN orders o ON e.order_id = o.id
       JOIN dealers d ON o.dealer_id = d.id JOIN users u ON o.salesperson_id = u.id
       ${where} ORDER BY e.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
}

module.exports = { generate, download, list };
