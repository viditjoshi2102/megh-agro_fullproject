const { pool }     = require('../config/database');
const { logAudit } = require('../middleware/audit');

async function list(req, res, next) {
  try {
    const { search, status, salesperson_id, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE d.is_active = 1';

    if (search)        { where += ' AND (d.dealer_name LIKE ? OR d.dealer_code LIKE ? OR d.mobile LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (status)        { where += ' AND d.status = ?'; params.push(status); }
    if (salesperson_id){ where += ' AND d.salesperson_id = ?'; params.push(salesperson_id); }

    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM dealers d ${where}`, params);
    const [rows] = await pool.execute(
      `SELECT d.*, u.name AS salesperson_name
       FROM dealers d LEFT JOIN users u ON d.salesperson_id = u.id
       ${where} ORDER BY d.dealer_name LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const [[dealer]] = await pool.execute(
      'SELECT d.*, u.name AS salesperson_name FROM dealers d LEFT JOIN users u ON d.salesperson_id = u.id WHERE d.id = ? AND d.is_active = 1',
      [req.params.id]
    );
    if (!dealer) return res.status(404).json({ success: false, message: 'Dealer not found' });
    res.json({ success: true, data: dealer });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const d = req.body;
    const [result] = await pool.execute(
      `INSERT INTO dealers (salesperson_id, dealer_code, dealer_name, contact_person, mobile, whatsapp, email,
        address, city, state, pin_code, gstin, pan, credit_limit, payment_terms, discount_percent, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.salesperson_id || req.user.id, d.dealer_code, d.dealer_name, d.contact_person, d.mobile, d.whatsapp,
       d.email, d.address, d.city, d.state, d.pin_code, d.gstin, d.pan,
       d.credit_limit || 0, d.payment_terms, d.discount_percent || 0, d.status || 'active']
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'CREATE_DEALER', entity: 'dealers', entityId: result.insertId, newValues: d, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'Dealer created', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Dealer code already exists' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const d = req.body;
    const [[old]] = await pool.execute('SELECT * FROM dealers WHERE id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ success: false, message: 'Dealer not found' });
    await pool.execute(
      `UPDATE dealers SET salesperson_id=?, dealer_code=?, dealer_name=?, contact_person=?, mobile=?, whatsapp=?,
       email=?, address=?, city=?, state=?, pin_code=?, gstin=?, pan=?, credit_limit=?, payment_terms=?,
       discount_percent=?, status=? WHERE id=?`,
      [d.salesperson_id || old.salesperson_id, d.dealer_code, d.dealer_name, d.contact_person, d.mobile,
       d.whatsapp, d.email, d.address, d.city, d.state, d.pin_code, d.gstin, d.pan,
       d.credit_limit ?? old.credit_limit, d.payment_terms, d.discount_percent ?? old.discount_percent,
       d.status || old.status, req.params.id]
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'UPDATE_DEALER', entity: 'dealers', entityId: parseInt(req.params.id), oldValues: old, newValues: d, ipAddress: req.ip });
    res.json({ success: true, message: 'Dealer updated' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await pool.execute('UPDATE dealers SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'DELETE_DEALER', entity: 'dealers', entityId: parseInt(req.params.id), ipAddress: req.ip });
    res.json({ success: true, message: 'Dealer deactivated' });
  } catch (err) { next(err); }
}

async function dropdown(req, res, next) {
  try {
    const { search } = req.query;
    const params = [];
    let where = 'WHERE is_active = 1 AND status = "active"';
    if (search) { where += ' AND (dealer_name LIKE ? OR dealer_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    const [rows] = await pool.execute(`SELECT id, dealer_code, dealer_name, city, gstin, pan, state, pin_code, mobile, whatsapp, email, address, contact_person FROM dealers ${where} ORDER BY dealer_name LIMIT 100`, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove, dropdown };
