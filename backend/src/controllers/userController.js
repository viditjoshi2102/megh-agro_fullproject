const bcrypt   = require('bcrypt');
const { pool } = require('../config/database');
const { logAudit } = require('../middleware/audit');

async function list(req, res, next) {
  try {
    const { role_id, is_active } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (role_id)    { where += ' AND u.role_id = ?';    params.push(role_id); }
    if (is_active !== undefined) { where += ' AND u.is_active = ?'; params.push(is_active === 'true' ? 1 : 0); }
    const [rows] = await pool.execute(
      `SELECT u.id, u.role_id, u.name, u.username, u.email, u.mobile, u.is_active, u.created_at, r.name AS role_name, r.label AS role_label
       FROM users u JOIN roles r ON u.role_id = r.id ${where} ORDER BY u.name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const [[user]] = await pool.execute(
      'SELECT u.id, u.role_id, u.name, u.username, u.email, u.mobile, u.is_active, r.name AS role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { role_id, name, username, email, mobile, password } = req.body;
    if (!password || password.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (role_id, name, username, email, mobile, password_hash) VALUES (?,?,?,?,?,?)',
      [role_id, name, username.toLowerCase().trim(), email, mobile, hash]
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'CREATE_USER', entity: 'users', entityId: result.insertId, newValues: { name, username, role_id }, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'User created', data: { id: result.insertId } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Username or email already exists' });
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { role_id, name, email, mobile, is_active } = req.body;
    await pool.execute(
      'UPDATE users SET role_id=?, name=?, email=?, mobile=?, is_active=? WHERE id=?',
      [role_id, name, email, mobile, is_active, req.params.id]
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'UPDATE_USER', entity: 'users', entityId: parseInt(req.params.id), ipAddress: req.ip });
    res.json({ success: true, message: 'User updated' });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'RESET_PASSWORD', entity: 'users', entityId: parseInt(req.params.id), ipAddress: req.ip });
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) { next(err); }
}

async function dropdown(req, res, next) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, r.name AS role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.is_active = 1 ORDER BY u.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

module.exports = { list, getOne, create, update, resetPassword, dropdown };
