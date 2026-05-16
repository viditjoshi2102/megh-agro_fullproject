const { pool }     = require('../config/database');
const { logAudit } = require('../middleware/audit');

// ─── List all roles with user count ──────────────────────────────────────────
async function list(req, res, next) {
  try {
    const [rows] = await pool.execute(`
      SELECT r.id, r.name, r.label, r.is_system, r.created_at,
             COUNT(DISTINCT u.id)  AS user_count,
             COUNT(DISTINCT rp.permission_id) AS permission_count
      FROM roles r
      LEFT JOIN users u  ON u.role_id = r.id AND u.is_active = 1
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      GROUP BY r.id
      ORDER BY r.id
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// ─── Get single role with its permissions ────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const [[role]] = await pool.execute(
      'SELECT id, name, label, is_system, created_at FROM roles WHERE id = ?',
      [req.params.id]
    );
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    const [perms] = await pool.execute(`
      SELECT p.id, p.module, p.action, p.label
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = ?
      ORDER BY p.module, p.action
    `, [req.params.id]);

    res.json({ success: true, data: { ...role, permissions: perms } });
  } catch (err) { next(err); }
}

// ─── List all available permissions (for the matrix UI) ──────────────────────
async function allPermissions(req, res, next) {
  try {
    const [rows] = await pool.execute(
      'SELECT id, module, action, label FROM permissions ORDER BY module, action'
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

// ─── Create role ─────────────────────────────────────────────────────────────
async function create(req, res, next) {
  try {
    const { name, label } = req.body;
    if (!name || !label) return res.status(400).json({ success: false, message: 'name and label are required' });
    const safeName = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const [result] = await pool.execute(
      'INSERT INTO roles (name, label, is_system) VALUES (?, ?, FALSE)',
      [safeName, label]
    );
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'CREATE_ROLE', entity: 'roles', entityId: result.insertId, newValues: { name: safeName, label }, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'Role created', data: { id: result.insertId, name: safeName, label } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'Role name already exists' });
    next(err);
  }
}

// ─── Update role label (name is immutable for system roles) ──────────────────
async function update(req, res, next) {
  try {
    const { label, name } = req.body;
    const [[role]] = await pool.execute('SELECT id, is_system FROM roles WHERE id = ?', [req.params.id]);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    if (role.is_system) {
      // System roles: only label can change
      await pool.execute('UPDATE roles SET label = ? WHERE id = ?', [label, req.params.id]);
    } else {
      const safeName = name ? name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : undefined;
      await pool.execute(
        'UPDATE roles SET label = ?' + (safeName ? ', name = ?' : '') + ' WHERE id = ?',
        safeName ? [label, safeName, req.params.id] : [label, req.params.id]
      );
    }
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'UPDATE_ROLE', entity: 'roles', entityId: parseInt(req.params.id), ipAddress: req.ip });
    res.json({ success: true, message: 'Role updated' });
  } catch (err) { next(err); }
}

// ─── Delete role (non-system only, no active users) ──────────────────────────
async function remove(req, res, next) {
  try {
    const [[role]] = await pool.execute('SELECT id, is_system FROM roles WHERE id = ?', [req.params.id]);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    if (role.is_system) return res.status(403).json({ success: false, message: 'Cannot delete a system role' });

    const [[{ cnt }]] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM users WHERE role_id = ? AND is_active = 1', [req.params.id]
    );
    if (cnt > 0) return res.status(409).json({ success: false, message: `Cannot delete: ${cnt} active user(s) assigned to this role` });

    await pool.execute('DELETE FROM roles WHERE id = ?', [req.params.id]);
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'DELETE_ROLE', entity: 'roles', entityId: parseInt(req.params.id), ipAddress: req.ip });
    res.json({ success: true, message: 'Role deleted' });
  } catch (err) { next(err); }
}

// ─── Set permissions for a role (full replace) ───────────────────────────────
async function setPermissions(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { permission_ids } = req.body; // array of permission IDs
    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ success: false, message: 'permission_ids must be an array' });
    }

    const [[role]] = await conn.execute('SELECT id, name, is_system FROM roles WHERE id = ?', [req.params.id]);
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });

    // Super admin always retains all permissions — prevent lockout
    if (role.name === 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super Admin permissions cannot be modified' });
    }

    await conn.execute('DELETE FROM role_permissions WHERE role_id = ?', [req.params.id]);

    if (permission_ids.length > 0) {
      const placeholders = permission_ids.map(() => '(?, ?)').join(', ');
      const values = permission_ids.flatMap(pid => [parseInt(req.params.id), pid]);
      await conn.execute(`INSERT INTO role_permissions (role_id, permission_id) VALUES ${placeholders}`, values);
    }

    await conn.commit();
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'SET_ROLE_PERMISSIONS', entity: 'roles', entityId: parseInt(req.params.id), newValues: { permission_ids }, ipAddress: req.ip });
    res.json({ success: true, message: 'Permissions updated', data: { count: permission_ids.length } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

module.exports = { list, getOne, allPermissions, create, update, remove, setPermissions };
