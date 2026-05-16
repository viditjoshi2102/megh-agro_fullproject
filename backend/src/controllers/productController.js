const { pool }     = require('../config/database');
const { logAudit } = require('../middleware/audit');

async function list(req, res, next) {
  try {
    const { search, category_id, stock_status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE p.is_active = 1';
    if (search)       { where += ' AND (p.product_name LIKE ? OR p.product_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category_id)  { where += ' AND p.category_id = ?';   params.push(category_id); }
    if (stock_status) { where += ' AND p.stock_status = ?'; params.push(stock_status); }
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM products p ${where}`, params);
    const [rows] = await pool.execute(
      `SELECT p.*, c.name AS category_name FROM products p LEFT JOIN product_categories c ON p.category_id = c.id ${where} ORDER BY p.product_name LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const [[p]] = await pool.execute(
      'SELECT p.*, c.name AS category_name FROM products p LEFT JOIN product_categories c ON p.category_id = c.id WHERE p.id = ? AND p.is_active = 1',
      [req.params.id]
    );
    if (!p) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: p });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const p = req.body;
    const [result] = await pool.execute(
      `INSERT INTO products (category_id, product_code, product_name, specification, unit, hsn_code, gst_percent, mrp, dealer_price, moq, stock_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [p.category_id || null, p.product_code, p.product_name, p.specification, p.unit || 'Nos', p.hsn_code, p.gst_percent, p.mrp || 0, p.dealer_price || 0, p.moq || 1, p.stock_status || 'in_stock']
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'CREATE_PRODUCT', entity: 'products', entityId: result.insertId, newValues: p, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'Product created', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Product code already exists' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const p = req.body;
    const [[old]] = await pool.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ success: false, message: 'Product not found' });
    await pool.execute(
      `UPDATE products SET category_id=?, product_code=?, product_name=?, specification=?, unit=?, hsn_code=?, gst_percent=?, mrp=?, dealer_price=?, moq=?, stock_status=? WHERE id=?`,
      [p.category_id ?? old.category_id, p.product_code, p.product_name, p.specification, p.unit, p.hsn_code, p.gst_percent, p.mrp, p.dealer_price, p.moq, p.stock_status, req.params.id]
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'UPDATE_PRODUCT', entity: 'products', entityId: parseInt(req.params.id), oldValues: old, newValues: p, ipAddress: req.ip });
    res.json({ success: true, message: 'Product updated' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await pool.execute('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'DELETE_PRODUCT', entity: 'products', entityId: parseInt(req.params.id), ipAddress: req.ip });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) { next(err); }
}

async function listCategories(req, res, next) {
  try {
    const [rows] = await pool.execute('SELECT * FROM product_categories WHERE is_active = 1 ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function createCategory(req, res, next) {
  try {
    const [result] = await pool.execute('INSERT INTO product_categories (name) VALUES (?)', [req.body.name]);
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) { next(err); }
}

async function dropdown(req, res, next) {
  try {
    const { search, category_id } = req.query;
    const params = [];
    let where = 'WHERE p.is_active = 1 AND p.stock_status != "out_of_stock"';
    if (search)      { where += ' AND (p.product_name LIKE ? OR p.product_code LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    if (category_id) { where += ' AND p.category_id = ?'; params.push(category_id); }
    const [rows] = await pool.execute(
      `SELECT p.id, p.product_code, p.product_name, p.hsn_code, p.gst_percent, p.dealer_price, p.mrp, p.unit, p.moq, p.stock_status, c.name AS category_name
       FROM products p LEFT JOIN product_categories c ON p.category_id = c.id ${where} ORDER BY p.product_name LIMIT 200`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, remove, listCategories, createCategory, dropdown };
