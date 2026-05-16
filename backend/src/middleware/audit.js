const { pool } = require('../config/database');

async function logAudit({ userId, userName, action, entity, entityId, oldValues, newValues, ipAddress }) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId   || null,
        userName || null,
        action,
        entity,
        entityId || null,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress || null,
      ]
    );
  } catch (err) {
    process.stderr.write(`Audit log failed: ${err.message}\n`);
  }
}

function auditMiddleware(action, entity) {
  return (req, res, next) => {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        logAudit({
          userId:    req.user?.id,
          userName:  req.user?.name,
          action,
          entity,
          entityId:  req.params?.id ? parseInt(req.params.id) : res.locals.entityId,
          ipAddress: req.ip,
        });
      }
    });
    next();
  };
}

module.exports = { logAudit, auditMiddleware };
