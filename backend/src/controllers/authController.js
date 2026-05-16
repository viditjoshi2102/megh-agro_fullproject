const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const { pool } = require('../config/database');
const { logAudit } = require('../middleware/audit');

async function fetchUserPermissions(roleId) {
  const [rows] = await pool.execute(
    `SELECT p.module, p.action FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id
     WHERE rp.role_id = ?`,
    [roleId]
  );
  return rows.map(r => `${r.module}:${r.action}`);
}

function signAccess(user) {
  return jwt.sign(
    { id: user.id, role_id: user.role_id, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required' });
    }

    const [[user]] = await pool.execute(
      `SELECT u.id, u.role_id, u.name, u.username, u.email, u.mobile, u.password_hash, u.is_active,
              r.name AS role_name, r.label AS role_label
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.username = ?`,
      [username.toLowerCase().trim()]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const accessToken  = signAccess(user);
    const refreshToken = signRefresh(user);

    const refreshHash = await bcrypt.hash(refreshToken, 10);
    const expiresAt   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.execute(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [user.id, refreshHash, expiresAt]
    );

    await logAudit({ userId: user.id, userName: user.name, action: 'LOGIN', entity: 'users', entityId: user.id, ipAddress: req.ip });

    const permissions = await fetchUserPermissions(user.role_id);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: { id: user.id, name: user.name, username: user.username, role_id: user.role_id, role_name: user.role_name, role_label: user.role_label },
        permissions,
      },
    });
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Refresh token required' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    const [rows] = await pool.execute(
      'SELECT id, token_hash FROM refresh_tokens WHERE user_id = ? AND expires_at > NOW()',
      [payload.id]
    );

    let matched = null;
    for (const row of rows) {
      if (await bcrypt.compare(refreshToken, row.token_hash)) { matched = row; break; }
    }
    if (!matched) return res.status(401).json({ success: false, message: 'Refresh token revoked or expired' });

    const [[user]] = await pool.execute('SELECT id, role_id, name, is_active FROM users WHERE id = ?', [payload.id]);
    if (!user || !user.is_active) return res.status(401).json({ success: false, message: 'User inactive' });

    await pool.execute('DELETE FROM refresh_tokens WHERE id = ?', [matched.id]);

    const newAccess  = signAccess(user);
    const newRefresh = signRefresh(user);
    const newHash    = await bcrypt.hash(newRefresh, 10);
    const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.execute('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [user.id, newHash, expiresAt]);

    res.json({ success: true, data: { accessToken: newAccess, refreshToken: newRefresh } });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    await pool.execute('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'LOGOUT', entity: 'users', entityId: req.user.id, ipAddress: req.ip });
    res.json({ success: true, message: 'Logged out' });
  } catch (err) { next(err); }
}

async function me(req, res, next) {
  try {
    const [[user]] = await pool.execute(
      `SELECT u.id, u.role_id, u.name, u.username, u.email, u.mobile, r.name AS role_name, r.label AS role_label
       FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
      [req.user.id]
    );
    const permissions = await fetchUserPermissions(user.role_id);
    res.json({ success: true, data: { ...user, permissions } });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

    const [[user]] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { next(err); }
}

module.exports = { login, refresh, logout, me, changePassword };
