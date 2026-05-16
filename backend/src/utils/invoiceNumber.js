const { pool } = require('../config/database');

function getFinancialYear() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const start = month >= 4 ? year       : year - 1;
  const end   = month >= 4 ? year + 1   : year;
  return `${String(start).slice(-2)}-${String(end).slice(-2)}`;
}

async function nextPINumber(conn) {
  const fy = getFinancialYear();
  await conn.execute(
    `INSERT INTO pi_sequence (financial_year, last_number) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
    [fy]
  );
  const [[row]] = await conn.execute(
    'SELECT last_number FROM pi_sequence WHERE financial_year = ?', [fy]
  );
  return `MEGH-PI-${String(row.last_number).padStart(3, '0')}/${fy}`;
}

async function nextEstimateNumber(conn) {
  const fy = getFinancialYear();
  await conn.execute(
    `INSERT INTO estimate_sequence (financial_year, last_number) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_number = last_number + 1`,
    [fy]
  );
  const [[row]] = await conn.execute(
    'SELECT last_number FROM estimate_sequence WHERE financial_year = ?', [fy]
  );
  return `MEGH-EST-${String(row.last_number).padStart(3, '0')}/${fy}`;
}

function nextOrderNumber() {
  const now = new Date();
  const ts  = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  return `ORD-${ts}-${rand}`;
}

module.exports = { nextPINumber, nextEstimateNumber, nextOrderNumber, getFinancialYear };
