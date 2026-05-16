const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306'),
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'megh_agro',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           '+05:30',
  charset:            'utf8mb4',
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    conn.release();
    process.stdout.write('MySQL connected successfully\n');
  } catch (err) {
    process.stderr.write(`MySQL connection failed: ${err.message}\n`);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
