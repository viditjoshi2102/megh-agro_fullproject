const XLSX        = require('xlsx');
const { pool }    = require('../config/database');
const { logAudit } = require('../middleware/audit');

// ─── Shared helpers ───────────────────────────────────────────────────────────

function parseSheet(buffer) {
  const wb    = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws    = wb.Sheets[wb.SheetNames[0]];
  const rows  = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  return rows;
}

function buildWorkbook(headers, sampleRow, instructions) {
  const wb = XLSX.utils.book_new();

  // ── Data sheet ──────────────────────────────────────────────────────────────
  const dataWs = XLSX.utils.aoa_to_sheet([headers, sampleRow]);

  // Column widths
  dataWs['!cols'] = headers.map(() => ({ wch: 20 }));

  // Style header row (bold + light-blue fill) – limited xlsx support, best-effort
  headers.forEach((_, i) => {
    const cellAddr = XLSX.utils.encode_cell({ r: 0, c: i });
    if (dataWs[cellAddr]) {
      dataWs[cellAddr].s = {
        font:    { bold: true },
        fill:    { fgColor: { rgb: 'BDD7EE' } },
        alignment: { horizontal: 'center' },
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, dataWs, 'Data');

  // ── Instructions sheet ──────────────────────────────────────────────────────
  const instrRows = [
    ['Field', 'Required', 'Allowed Values / Format', 'Notes'],
    ...instructions,
  ];
  const instrWs = XLSX.utils.aoa_to_sheet(instrRows);
  instrWs['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 40 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, instrWs, 'Instructions');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function strVal(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }
function numVal(v) {
  const n = parseFloat(String(v).replace(/,/g, '').trim());
  return isNaN(n) ? null : n;
}

// ─── PRODUCTS ─────────────────────────────────────────────────────────────────

const PRODUCT_HEADERS = [
  'product_code*', 'product_name*', 'hsn_code*', 'gst_percent*',
  'dealer_price*', 'mrp', 'unit', 'moq', 'stock_status', 'category_name', 'specification',
];
const PRODUCT_SAMPLE = [
  'PUMP-001', 'Power Sprayer 16L', '84248200', '18',
  '2500', '3000', 'Nos', '1', 'in_stock', 'Sprayers', 'High-pressure 16-litre knapsack sprayer',
];
const PRODUCT_INSTRUCTIONS = [
  ['product_code*', 'YES', 'Text, unique', 'Product SKU / part number'],
  ['product_name*', 'YES', 'Text', 'Full product name'],
  ['hsn_code*',     'YES', '6–8 digit number', 'HSN code for GST purposes'],
  ['gst_percent*',  'YES', '0 / 5 / 12 / 18 / 28', 'Applicable GST %'],
  ['dealer_price*', 'YES', 'Number ≥ 0', 'Price charged to dealer'],
  ['mrp',           'NO',  'Number ≥ 0', 'Maximum retail price (optional)'],
  ['unit',          'NO',  'Nos / Kg / Ltr / Set / Pcs', 'Default: Nos'],
  ['moq',           'NO',  'Integer ≥ 1', 'Minimum order quantity. Default: 1'],
  ['stock_status',  'NO',  'in_stock / limited / out_of_stock', 'Default: in_stock'],
  ['category_name', 'NO',  'Text', 'If category does not exist it will be created'],
  ['specification', 'NO',  'Text', 'Technical specification'],
];

async function productTemplate(req, res) {
  const buf = buildWorkbook(PRODUCT_HEADERS, PRODUCT_SAMPLE, PRODUCT_INSTRUCTIONS);
  res.setHeader('Content-Disposition', 'attachment; filename="products_upload_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

function validateProduct(raw, rowNum) {
  const errs = [];
  const code = strVal(raw['product_code*'] ?? raw['product_code']);
  const name = strVal(raw['product_name*'] ?? raw['product_name']);
  const hsn  = strVal(raw['hsn_code*']     ?? raw['hsn_code']);
  const gst  = strVal(raw['gst_percent*']  ?? raw['gst_percent']);
  const dp   = strVal(raw['dealer_price*'] ?? raw['dealer_price']);

  if (!code) errs.push('product_code is required');
  if (!name) errs.push('product_name is required');
  if (!hsn)  errs.push('hsn_code is required');
  if (!gst)  errs.push('gst_percent is required');
  else if (![0,5,12,18,28].includes(Number(gst))) errs.push('gst_percent must be one of: 0, 5, 12, 18, 28');
  if (!dp)   errs.push('dealer_price is required');
  else if (numVal(dp) === null || numVal(dp) < 0) errs.push('dealer_price must be a non-negative number');

  const mrp       = strVal(raw['mrp']);
  const moq       = strVal(raw['moq']);
  const stockSt   = strVal(raw['stock_status']);

  if (mrp  && numVal(mrp)  === null) errs.push('mrp must be a number');
  if (moq  && (isNaN(parseInt(moq)) || parseInt(moq) < 1)) errs.push('moq must be an integer ≥ 1');
  if (stockSt && !['in_stock','limited','out_of_stock'].includes(stockSt))
    errs.push('stock_status must be in_stock, limited, or out_of_stock');

  return {
    valid: errs.length === 0,
    errors: errs,
    data: {
      product_code: code,
      product_name: name,
      hsn_code:     hsn,
      gst_percent:  Number(gst),
      dealer_price: numVal(dp) ?? 0,
      mrp:          mrp ? (numVal(mrp) ?? 0) : 0,
      unit:         strVal(raw['unit'])  || 'Nos',
      moq:          moq ? (parseInt(moq) || 1) : 1,
      stock_status: stockSt || 'in_stock',
      category_name: strVal(raw['category_name']),
      specification: strVal(raw['specification']),
    },
  };
}

async function productUpload(req, res, next) {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const rows  = parseSheet(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'The file has no data rows' });
    if (rows.length > 1000) return res.status(400).json({ success: false, message: 'Maximum 1000 rows per upload' });

    // Cache existing product codes for duplicate detection
    const [existingRows] = await conn.execute('SELECT product_code FROM products WHERE is_active = 1');
    const existingCodes  = new Set(existingRows.map(r => r.product_code.toLowerCase()));

    // Category name → id map
    const [catRows] = await conn.execute('SELECT id, name FROM product_categories WHERE is_active = 1');
    const catMap    = Object.fromEntries(catRows.map(c => [c.name.toLowerCase(), c.id]));

    const errorRows = [];
    const toInsert  = [];

    rows.forEach((raw, idx) => {
      const rowNum = idx + 2; // Excel row (1-indexed, +1 for header)
      const result = validateProduct(raw, rowNum);
      if (!result.valid) {
        errorRows.push({ row: rowNum, data: raw, errors: result.errors });
        return;
      }
      if (existingCodes.has(result.data.product_code.toLowerCase())) {
        errorRows.push({ row: rowNum, data: raw, errors: [`Product code "${result.data.product_code}" already exists`] });
        return;
      }
      existingCodes.add(result.data.product_code.toLowerCase()); // prevent intra-batch dupes
      toInsert.push(result.data);
    });

    let inserted = 0;
    for (const p of toInsert) {
      // Resolve / create category
      let catId = null;
      if (p.category_name) {
        const key = p.category_name.toLowerCase();
        if (catMap[key]) {
          catId = catMap[key];
        } else {
          const [r] = await conn.execute('INSERT INTO product_categories (name) VALUES (?)', [p.category_name]);
          catId = r.insertId;
          catMap[key] = catId;
        }
      }
      await conn.execute(
        `INSERT INTO products (category_id, product_code, product_name, specification, unit, hsn_code, gst_percent, mrp, dealer_price, moq, stock_status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [catId, p.product_code, p.product_name, p.specification, p.unit, p.hsn_code, p.gst_percent, p.mrp, p.dealer_price, p.moq, p.stock_status]
      );
      inserted++;
    }

    await conn.commit();
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'BULK_UPLOAD_PRODUCTS', entity: 'products', entityId: null, newValues: { inserted, errors: errorRows.length }, ipAddress: req.ip });

    res.json({
      success: true,
      data: {
        total:    rows.length,
        inserted,
        skipped:  errorRows.length,
        errors:   errorRows,
      },
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

// ─── DEALERS ──────────────────────────────────────────────────────────────────

const DEALER_HEADERS = [
  'dealer_code*', 'dealer_name*', 'contact_person', 'mobile', 'whatsapp',
  'email', 'address', 'city', 'state', 'pin_code', 'gstin', 'pan',
  'credit_limit', 'payment_terms', 'discount_percent', 'status',
];
const DEALER_SAMPLE = [
  'DL001', 'ABC Agro Traders', 'Ramesh Patil', '9876543210', '9876543210',
  'ramesh@abc.com', '123 Market Road', 'Nashik', 'Maharashtra', '422001',
  '27ABCDE1234F1Z5', 'ABCDE1234F',
  '50000', 'Net 30', '5', 'active',
];
const DEALER_INSTRUCTIONS = [
  ['dealer_code*',      'YES', 'Text, unique',             'Short dealer identifier'],
  ['dealer_name*',      'YES', 'Text',                     'Full business / party name'],
  ['contact_person',    'NO',  'Text',                     'Primary contact name'],
  ['mobile',            'NO',  '10-digit Indian number',   'Primary mobile number'],
  ['whatsapp',          'NO',  '10-digit Indian number',   'WhatsApp number'],
  ['email',             'NO',  'Valid email',              'Business email'],
  ['address',           'NO',  'Text',                     'Full street address'],
  ['city',              'NO',  'Text',                     'City'],
  ['state',             'NO',  'Text',                     'State'],
  ['pin_code',          'NO',  '6-digit PIN',              'Postal PIN code'],
  ['gstin',             'NO',  '15-char GSTIN',            'GST Identification Number'],
  ['pan',               'NO',  '10-char PAN',              'PAN card number'],
  ['credit_limit',      'NO',  'Number ≥ 0',              'Credit limit in INR'],
  ['payment_terms',     'NO',  'Text e.g. Net 30',         'Payment terms'],
  ['discount_percent',  'NO',  '0–100',                   'Standard discount %'],
  ['status',            'NO',  'active / inactive',        'Default: active'],
];

function validateDealer(raw, rowNum) {
  const errs = [];
  const code = strVal(raw['dealer_code*'] ?? raw['dealer_code']);
  const name = strVal(raw['dealer_name*'] ?? raw['dealer_name']);

  if (!code) errs.push('dealer_code is required');
  if (!name) errs.push('dealer_name is required');

  const mobile   = strVal(raw['mobile']);
  const whatsapp = strVal(raw['whatsapp']);
  const email    = strVal(raw['email']);
  const gstin    = strVal(raw['gstin']);
  const pan      = strVal(raw['pan']);
  const pinCode  = strVal(raw['pin_code']);
  const status   = strVal(raw['status']);
  const cl       = strVal(raw['credit_limit']);
  const disc     = strVal(raw['discount_percent']);

  if (mobile    && !/^[6-9]\d{9}$/.test(mobile))     errs.push('mobile must be a valid 10-digit Indian number');
  if (whatsapp  && !/^[6-9]\d{9}$/.test(whatsapp))   errs.push('whatsapp must be a valid 10-digit Indian number');
  if (email     && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.push('email format is invalid');
  if (gstin     && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase()))
    errs.push('gstin format is invalid (expected 15-char: 27ABCDE1234F1Z5)');
  if (pan       && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan.toUpperCase()))
    errs.push('pan format is invalid (expected 10-char: ABCDE1234F)');
  if (pinCode   && !/^\d{6}$/.test(pinCode))          errs.push('pin_code must be a 6-digit number');
  if (status    && !['active','inactive'].includes(status)) errs.push('status must be active or inactive');
  if (cl        && numVal(cl) === null)                errs.push('credit_limit must be a number');
  if (disc      && (numVal(disc) === null || numVal(disc) < 0 || numVal(disc) > 100))
    errs.push('discount_percent must be between 0 and 100');

  return {
    valid: errs.length === 0,
    errors: errs,
    data: {
      dealer_code:      code,
      dealer_name:      name,
      contact_person:   strVal(raw['contact_person']),
      mobile:           mobile,
      whatsapp:         whatsapp,
      email:            email,
      address:          strVal(raw['address']),
      city:             strVal(raw['city']),
      state:            strVal(raw['state']),
      pin_code:         pinCode,
      gstin:            gstin ? gstin.toUpperCase() : '',
      pan:              pan   ? pan.toUpperCase()   : '',
      credit_limit:     cl   ? (numVal(cl) ?? 0) : 0,
      payment_terms:    strVal(raw['payment_terms']),
      discount_percent: disc ? (numVal(disc) ?? 0) : 0,
      status:           status || 'active',
    },
  };
}

async function dealerTemplate(req, res) {
  const buf = buildWorkbook(DEALER_HEADERS, DEALER_SAMPLE, DEALER_INSTRUCTIONS);
  res.setHeader('Content-Disposition', 'attachment; filename="dealers_upload_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

async function dealerUpload(req, res, next) {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const rows = parseSheet(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'The file has no data rows' });
    if (rows.length > 1000) return res.status(400).json({ success: false, message: 'Maximum 1000 rows per upload' });

    const [existingRows] = await conn.execute('SELECT dealer_code FROM dealers WHERE is_active = 1');
    const existingCodes  = new Set(existingRows.map(r => r.dealer_code.toLowerCase()));

    const errorRows = [];
    const toInsert  = [];

    rows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const result = validateDealer(raw, rowNum);
      if (!result.valid) { errorRows.push({ row: rowNum, data: raw, errors: result.errors }); return; }
      if (existingCodes.has(result.data.dealer_code.toLowerCase())) {
        errorRows.push({ row: rowNum, data: raw, errors: [`Dealer code "${result.data.dealer_code}" already exists`] });
        return;
      }
      existingCodes.add(result.data.dealer_code.toLowerCase());
      toInsert.push(result.data);
    });

    let inserted = 0;
    for (const d of toInsert) {
      await conn.execute(
        `INSERT INTO dealers (salesperson_id, dealer_code, dealer_name, contact_person, mobile, whatsapp, email,
          address, city, state, pin_code, gstin, pan, credit_limit, payment_terms, discount_percent, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [req.user.id, d.dealer_code, d.dealer_name, d.contact_person, d.mobile, d.whatsapp, d.email,
         d.address, d.city, d.state, d.pin_code, d.gstin, d.pan,
         d.credit_limit, d.payment_terms, d.discount_percent, d.status]
      );
      inserted++;
    }

    await conn.commit();
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'BULK_UPLOAD_DEALERS', entity: 'dealers', entityId: null, newValues: { inserted, errors: errorRows.length }, ipAddress: req.ip });

    res.json({ success: true, data: { total: rows.length, inserted, skipped: errorRows.length, errors: errorRows } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

// ─── HSN-GST ──────────────────────────────────────────────────────────────────

const HSN_HEADERS = ['hsn_code*', 'gst_rate*', 'category', 'notes'];
const HSN_SAMPLE  = ['84248200', '18', 'Sprayers & Pumps', 'Knapsack and power sprayers'];
const HSN_INSTRUCTIONS = [
  ['hsn_code*', 'YES', '4–8 digit text',             'HSN code (must be unique)'],
  ['gst_rate*', 'YES', '0 / 5 / 12 / 18 / 28',       'Applicable GST %'],
  ['category',  'NO',  'Text',                         'Product category description'],
  ['notes',     'NO',  'Text',                         'Additional notes'],
];

function validateHSN(raw, rowNum) {
  const errs = [];
  const code = strVal(raw['hsn_code*'] ?? raw['hsn_code']);
  const rate = strVal(raw['gst_rate*'] ?? raw['gst_rate']);

  if (!code) errs.push('hsn_code is required');
  else if (!/^\d{4,8}$/.test(code)) errs.push('hsn_code must be 4–8 digits');
  if (!rate) errs.push('gst_rate is required');
  else if (![0,5,12,18,28].includes(Number(rate))) errs.push('gst_rate must be one of: 0, 5, 12, 18, 28');

  return {
    valid: errs.length === 0,
    errors: errs,
    data: {
      hsn_code: code,
      gst_rate: Number(rate),
      category: strVal(raw['category']),
      notes:    strVal(raw['notes']),
    },
  };
}

async function hsnTemplate(req, res) {
  const buf = buildWorkbook(HSN_HEADERS, HSN_SAMPLE, HSN_INSTRUCTIONS);
  res.setHeader('Content-Disposition', 'attachment; filename="hsn_gst_upload_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
}

async function hsnUpload(req, res, next) {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const rows = parseSheet(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ success: false, message: 'The file has no data rows' });
    if (rows.length > 500) return res.status(400).json({ success: false, message: 'Maximum 500 rows per upload' });

    const [existingRows] = await conn.execute('SELECT hsn_code FROM hsn_gst_reference WHERE is_active = 1');
    const existingCodes  = new Set(existingRows.map(r => r.hsn_code));

    const errorRows = [];
    const toInsert  = [];

    rows.forEach((raw, idx) => {
      const rowNum = idx + 2;
      const result = validateHSN(raw, rowNum);
      if (!result.valid) { errorRows.push({ row: rowNum, data: raw, errors: result.errors }); return; }
      if (existingCodes.has(result.data.hsn_code)) {
        errorRows.push({ row: rowNum, data: raw, errors: [`HSN code "${result.data.hsn_code}" already exists`] });
        return;
      }
      existingCodes.add(result.data.hsn_code);
      toInsert.push(result.data);
    });

    let inserted = 0;
    for (const h of toInsert) {
      await conn.execute(
        'INSERT INTO hsn_gst_reference (hsn_code, gst_rate, category, notes) VALUES (?,?,?,?)',
        [h.hsn_code, h.gst_rate, h.category, h.notes]
      );
      inserted++;
    }

    await conn.commit();
    await logAudit({ userId: req.user.id, userName: req.user.name, action: 'BULK_UPLOAD_HSN', entity: 'hsn_gst_reference', entityId: null, newValues: { inserted, errors: errorRows.length }, ipAddress: req.ip });

    res.json({ success: true, data: { total: rows.length, inserted, skipped: errorRows.length, errors: errorRows } });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally { conn.release(); }
}

module.exports = {
  productTemplate, productUpload,
  dealerTemplate,  dealerUpload,
  hsnTemplate,     hsnUpload,
};
