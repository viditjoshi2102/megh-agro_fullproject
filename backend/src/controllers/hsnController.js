'use strict';
const { pool }     = require('../config/database');
const { logAudit } = require('../middleware/audit');

async function list(req, res, next) {
  try {
    const { search } = req.query;
    const params = [];
    let where = 'WHERE is_active = 1';
    if (search) { where += ' AND (hsn_code LIKE ? OR category LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    const [rows] = await pool.execute(`SELECT * FROM hsn_gst_reference ${where} ORDER BY hsn_code`, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { category, hsn_code, gst_rate, notes } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO hsn_gst_reference (category, hsn_code, gst_rate, notes) VALUES (?,?,?,?)',
      [category, hsn_code, gst_rate, notes]
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'CREATE_HSN', entity: 'hsn_gst_reference', entityId: result.insertId, newValues: { hsn_code, gst_rate }, ipAddress: req.ip });
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'HSN code already exists' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { category, hsn_code, gst_rate, notes } = req.body;
    const [[old]] = await pool.execute('SELECT * FROM hsn_gst_reference WHERE id = ?', [req.params.id]);
    if (!old) return res.status(404).json({ success: false, message: 'HSN not found' });
    await pool.execute(
      'UPDATE hsn_gst_reference SET category=?, hsn_code=?, gst_rate=?, notes=? WHERE id=?',
      [category, hsn_code, gst_rate, notes, req.params.id]
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'UPDATE_HSN', entity: 'hsn_gst_reference', entityId: parseInt(req.params.id), oldValues: old, newValues: { hsn_code, gst_rate }, ipAddress: req.ip });
    res.json({ success: true, message: 'HSN updated' });
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await pool.execute('UPDATE hsn_gst_reference SET is_active = 0 WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'DELETE_HSN', entity: 'hsn_gst_reference', entityId: parseInt(req.params.id), ipAddress: req.ip });
    res.json({ success: true, message: 'HSN deactivated' });
  } catch (err) { next(err); }
}

async function getByCode(req, res, next) {
  try {
    const [[row]] = await pool.execute('SELECT * FROM hsn_gst_reference WHERE hsn_code = ? AND is_active = 1', [req.params.code]);
    if (!row) return res.status(404).json({ success: false, message: 'HSN code not found' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
}

module.exports = { list, create, update, remove, getByCode };
