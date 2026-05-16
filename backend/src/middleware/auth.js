const jwt  = require('jsonwebtoken');
const { pool } = require('../config/database');

async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [[user]] = await pool.execute(
      'SELECT id, role_id, name, username, is_active FROM users WHERE id = ?',
      [payload.id]
    );
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'User not found or inactive' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function authorize(...roleIds) {
  return (req, res, next) => {
    if (!roleIds.includes(req.user.role_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    next();
  };
}

function checkPermission(module, action) {
  return async (req, res, next) => {
    try {
      // Super admin always has full access
      if (req.user.role_id === 1) return next();
      const [[row]] = await pool.execute(
        `SELECT 1 FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role_id = ? AND p.module = ? AND p.action = ?`,
        [req.user.role_id, module, action]
      );
      if (!row) return res.status(403).json({ success: false, message: 'Permission denied' });
      next();
    } catch (err) { next(err); }
  };
}

// role_id constants
const ROLES = { SUPER_ADMIN: 1, SALES_ADMIN: 2, SALESPERSON: 3 };

module.exports = { authenticate, authorize, checkPermission, ROLES };
