const { pool } = require('../config/database');
const { ROLES } = require('../middleware/auth');

async function ownerDashboard(req, res, next) {
  try {
    const [[orderStats]] = await pool.execute(
      `SELECT
         COUNT(*) AS total_orders,
         SUM(CASE WHEN status='pending'    THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='invoiced'   THEN 1 ELSE 0 END) AS invoiced,
         SUM(CASE WHEN status='dispatched' THEN 1 ELSE 0 END) AS dispatched,
         SUM(grand_total) AS total_revenue
       FROM orders`
    );

    const [salespersonStats] = await pool.execute(
      `SELECT u.id, u.name, COUNT(o.id) AS order_count, SUM(o.grand_total) AS revenue
       FROM users u LEFT JOIN orders o ON o.salesperson_id = u.id
       WHERE u.role_id = ? GROUP BY u.id ORDER BY revenue DESC LIMIT 10`,
      [ROLES.SALESPERSON]
    );

    const [dealerStats] = await pool.execute(
      `SELECT d.dealer_name, d.dealer_code, COUNT(o.id) AS order_count, SUM(o.grand_total) AS revenue
       FROM dealers d LEFT JOIN orders o ON o.dealer_id = d.id
       GROUP BY d.id ORDER BY revenue DESC LIMIT 10`
    );

    const [[piStats]] = await pool.execute(
      `SELECT COUNT(*) AS total_pis, SUM(grand_total) AS pi_revenue FROM proforma_invoices`
    );

    const [lowStock] = await pool.execute(
      "SELECT id, product_code, product_name, stock_status FROM products WHERE stock_status != 'in_stock' AND is_active = 1"
    );

    const [recentOrders] = await pool.execute(
      `SELECT o.order_no, o.status, o.order_date, o.grand_total, u.name AS salesperson_name, d.dealer_name
       FROM orders o JOIN users u ON o.salesperson_id = u.id JOIN dealers d ON o.dealer_id = d.id
       ORDER BY o.created_at DESC LIMIT 10`
    );

    res.json({
      success: true,
      data: { orderStats, salespersonStats, dealerStats, piStats, lowStock, recentOrders },
    });
  } catch (err) { next(err); }
}

async function adminDashboard(req, res, next) {
  try {
    const [[orderStats]] = await pool.execute(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status='invoiced' THEN 1 ELSE 0 END) AS invoiced,
              SUM(CASE WHEN status='dispatched' THEN 1 ELSE 0 END) AS dispatched FROM orders`
    );
    const [[piCount]]  = await pool.execute('SELECT COUNT(*) AS total FROM proforma_invoices');
    const [[estCount]] = await pool.execute('SELECT COUNT(*) AS total FROM estimates');
    const [recentOrders] = await pool.execute(
      `SELECT o.order_no, o.status, o.order_date, o.grand_total, u.name AS salesperson_name, d.dealer_name,
              pi.invoice_no
       FROM orders o JOIN users u ON o.salesperson_id = u.id JOIN dealers d ON o.dealer_id = d.id
       LEFT JOIN proforma_invoices pi ON pi.order_id = o.id
       ORDER BY o.created_at DESC LIMIT 20`
    );
    res.json({ success: true, data: { orderStats, piCount, estCount, recentOrders } });
  } catch (err) { next(err); }
}

async function salespersonDashboard(req, res, next) {
  try {
    const uid = req.user.id;
    const [[myOrders]] = await pool.execute(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
              SUM(CASE WHEN status='invoiced' THEN 1 ELSE 0 END) AS invoiced, SUM(grand_total) AS revenue
       FROM orders WHERE salesperson_id = ?`, [uid]
    );
    const [recent] = await pool.execute(
      `SELECT o.order_no, o.status, o.order_date, o.grand_total, d.dealer_name, pi.invoice_no
       FROM orders o JOIN dealers d ON o.dealer_id = d.id LEFT JOIN proforma_invoices pi ON pi.order_id = o.id
       WHERE o.salesperson_id = ? ORDER BY o.created_at DESC LIMIT 10`, [uid]
    );
    res.json({ success: true, data: { myOrders, recent } });
  } catch (err) { next(err); }
}

async function auditLogs(req, res, next) {
  try {
    const { entity, user_id, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';
    if (entity)    { where += ' AND entity = ?';    params.push(entity); }
    if (user_id)   { where += ' AND user_id = ?';   params.push(user_id); }
    if (from_date) { where += ' AND created_at >= ?'; params.push(from_date); }
    if (to_date)   { where += ' AND created_at <= ?'; params.push(to_date + ' 23:59:59'); }
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM audit_logs ${where}`, params);
    const [rows] = await pool.execute(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );
    res.json({ success: true, data: rows, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
}

module.exports = { ownerDashboard, adminDashboard, salespersonDashboard, auditLogs };
