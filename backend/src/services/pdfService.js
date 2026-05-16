'use strict';
const PDFDocument       = require('pdfkit');
const path              = require('path');
const fs                = require('fs');
const { amountInWords } = require('../utils/amountInWords');

// ─── Paths & constants ────────────────────────────────────────────────────────
const PDF_DIR   = path.join(__dirname, '../../', process.env.PDF_STORAGE_PATH || 'storage/pdfs');
const LOGO_PATH = path.join(__dirname, '../../../frontend/public/megh-logo.jpg');

const NAVY    = '#163082';   // brand primary
const NAVYLT  = '#e8eef8';   // navy tint – section header bg
const BORD    = '#9bafc7';   // border / rule colour
const ALTROW  = '#f0f4fb';   // alternate table row bg
const TXT     = '#1a2035';   // primary text
const TXTSUB  = '#4a5568';   // secondary text
const TXTMID  = '#6b7280';   // label text

const ML = 30;   // left & right page margin

// ─── Company data ─────────────────────────────────────────────────────────────
const CO = {
  name:       process.env.COMPANY_NAME    || 'MEGH AGRO EQUIPMENT',
  year:       '(2024-2025)',
  address:    process.env.COMPANY_ADDRESS || 'PLOT NO. 28, C-18, MIDC FLATTED BUILDINGS',
  city:       process.env.COMPANY_CITY    || 'SATOPUR, NASHIK - 422007',
  gstin:      process.env.COMPANY_GSTIN   || '27ALAPG9605L1ZY',
  contact:    process.env.COMPANY_CONTACT || '0253-2365359 / 09422250263',
  email:      process.env.COMPANY_EMAIL   || 'megh71@rediffmail.com',
  pan:        process.env.COMPANY_PAN     || 'ALAPG9605L',
  bankName:   process.env.BANK_NAME      || 'IDBI BANK',
  bankAc:     process.env.BANK_AC        || '103102000011477',
  bankBranch: process.env.BANK_BRANCH    || 'Gangapur Road, Nashik',
  bankIfsc:   process.env.BANK_IFSC      || 'IBKL0000103',
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }

function fd(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
}

function fc(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cw(doc) { return doc.page.width - ML * 2; }  // content width

// ─── Section: Title banner ────────────────────────────────────────────────────
function sBanner(doc, title, subtitle, y) {
  const w = cw(doc);
  doc.rect(ML, y, w, 36).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#ffffff')
     .text(title, ML, y + 6, { width: w, align: 'center' });
  doc.font('Helvetica').fontSize(8).fillColor('#b8caea')
     .text(subtitle, ML, y + 24, { width: w, align: 'center' });
  return y + 36;
}

// ─── Section: Company (left) + Meta (right) ───────────────────────────────────
function sCompanyMeta(doc, metaRows, y) {
  const w    = cw(doc);
  const coW  = Math.floor(w * 0.58);
  const metW = w - coW;
  const H    = 112;

  // box
  doc.rect(ML, y, w, H).stroke(BORD);
  doc.moveTo(ML + coW, y).lineTo(ML + coW, y + H).stroke(BORD);

  // — Company left panel —
  const hasLogo  = fs.existsSync(LOGO_PATH);
  const logoSz   = 42;
  const txtX     = hasLogo ? ML + logoSz + 10 : ML + 7;
  const txtW     = coW - (hasLogo ? logoSz + 16 : 12);

  if (hasLogo) {
    try { doc.image(LOGO_PATH, ML + 5, y + 7, { width: logoSz, height: logoSz }); }
    catch (_) {}
  }

  let cy = y + 7;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
     .text(CO.name, txtX, cy, { width: txtW }); cy += 15;
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTMID)
     .text(CO.year, txtX, cy, { width: txtW }); cy += 11;
  doc.font('Helvetica').fontSize(8).fillColor(TXTSUB)
     .text(CO.address, txtX, cy, { width: txtW }); cy += 11;
  doc.text(CO.city, txtX, cy, { width: txtW }); cy += 11;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(TXT)
     .text(`GSTIN/UIN: `, txtX, cy, { continued: true })
     .font('Helvetica').text(CO.gstin); cy += 11;
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTSUB)
     .text(`State: Maharashtra (27)  |  PAN: ${CO.pan}`, txtX, cy, { width: txtW }); cy += 10;
  doc.text(`Tel: ${CO.contact}`, txtX, cy, { width: txtW }); cy += 10;
  doc.text(`Email: ${CO.email}`, txtX, cy, { width: txtW });

  // — Meta right panel (key : value rows) —
  const rowH = H / metaRows.length;
  metaRows.forEach((row, i) => {
    const ry = y + i * rowH;
    if (i > 0) doc.moveTo(ML + coW, ry).lineTo(ML + w, ry).stroke(BORD);
    const lx = ML + coW + 7;
    const lw = metW - 12;
    doc.font('Helvetica').fontSize(7.5).fillColor(TXTMID)
       .text(row.label, lx, ry + 5, { width: lw * 0.44 });
    doc.font('Helvetica-Bold').fontSize(8).fillColor(TXT)
       .text(row.value || '—', lx + lw * 0.44, ry + 5, { width: lw * 0.55 });
  });

  return y + H;
}

// ─── Section: Single full-width info row ──────────────────────────────────────
function sInfoRow(doc, label, value, y) {
  const w = cw(doc);
  doc.rect(ML, y, w, 16).stroke(BORD);
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTMID)
     .text(`${label}:  `, ML + 6, y + 4, { continued: true });
  doc.font('Helvetica').fillColor(TXT).text(value || '');
  return y + 16;
}

// ─── Section: Buyer details ───────────────────────────────────────────────────
function sBuyer(doc, buyer, showGst, y) {
  const w = cw(doc);

  // estimate height
  let lines = 4;
  if (showGst && buyer.gstin)   lines++;
  if (showGst && buyer.pan)     lines++;
  if (buyer.contactPerson)      lines++;
  if (buyer.contact)            lines++;
  const H = Math.max(78, 22 + lines * 12 + 8);

  // header strip
  doc.rect(ML, y, w, 18).fill(NAVYLT);
  doc.rect(ML, y, w, H).stroke(BORD);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
     .text('BILL TO / BUYER', ML + 8, y + 5);

  let cy = y + 24;
  const bx = ML + 8;
  const bw = w - 16;

  doc.font('Helvetica-Bold').fontSize(10).fillColor(TXT)
     .text(buyer.name || '', bx, cy, { width: bw }); cy += 14;

  const addr = [buyer.address, [buyer.city, buyer.state].filter(Boolean).join(', ') + (buyer.pin ? ` - ${buyer.pin}` : ''), 'India']
    .filter(Boolean).join('\n');
  doc.font('Helvetica').fontSize(8).fillColor(TXTSUB)
     .text(addr, bx, cy, { width: bw }); cy += (addr.split('\n').length) * 11;

  if (showGst && buyer.gstin) {
    doc.font('Helvetica').fontSize(8).fillColor(TXTSUB)
       .text(`GSTIN/UIN: ${buyer.gstin}`, bx, cy, { width: bw }); cy += 11;
  }
  if (showGst && buyer.pan) {
    doc.font('Helvetica').fontSize(8).fillColor(TXTSUB)
       .text(`PAN: ${buyer.pan}`, bx, cy, { width: bw }); cy += 11;
  }
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTMID)
     .text('State: Maharashtra  |  Code: 27  |  Place of Supply: Maharashtra', bx, cy, { width: bw }); cy += 10;
  if (buyer.contactPerson) {
    doc.font('Helvetica').fontSize(8).fillColor(TXTSUB)
       .text(`Contact: ${buyer.contactPerson}`, bx, cy, { width: bw }); cy += 11;
  }
  if (buyer.contact) {
    doc.font('Helvetica').fontSize(8).fillColor(TXTSUB)
       .text(`Mobile: ${buyer.contact}`, bx, cy, { width: bw });
  }

  return y + H;
}

// ─── Section: Products table (dynamic rows) ───────────────────────────────────
// Column definitions – 'auto' width fills remaining space
const TCOLS = [
  { label: 'Sl.',             w: 24,   align: 'center' },
  { label: 'Code',            w: 60,   align: 'left'   },
  { label: 'Description',     w: 0,    align: 'left'   },  // auto
  { label: 'HSN/SAC',         w: 52,   align: 'center' },
  { label: 'Qty',             w: 30,   align: 'center' },
  { label: 'Unit',            w: 28,   align: 'center' },
  { label: 'Rate (Rs.)',       w: 65,   align: 'right'  },
  { label: 'Amount (Rs.)',    w: 68,   align: 'right'  },
];

function buildCols(doc) {
  const fixed = TCOLS.reduce((s, c) => s + c.w, 0);
  const auto  = cw(doc) - fixed;
  return TCOLS.map(c => ({ ...c, w: c.w || auto }));
}

function drawRow(doc, cols, cells, y, rowH, bg) {
  const w = cw(doc);
  if (bg) doc.rect(ML, y, w, rowH).fill(bg);
  doc.rect(ML, y, w, rowH).stroke(BORD);

  let x = ML;
  const isHeader = bg === NAVY;
  cols.forEach((col, i) => {
    if (i > 0) doc.moveTo(x, y).lineTo(x, y + rowH).stroke(BORD);
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
       .fontSize(isHeader ? 8 : 8)
       .fillColor(isHeader ? '#ffffff' : TXT)
       .text(
         String(cells[i] ?? ''),
         x + (col.align === 'right' ? 2 : 3),
         y + (rowH - 9) / 2,
         { width: col.w - 5, align: col.align, lineBreak: false }
       );
    x += col.w;
  });
  return y + rowH;
}

function sTable(doc, items, y) {
  const cols  = buildCols(doc);
  const headH = 22;
  const rowH  = 20;

  y = drawRow(doc, cols, cols.map(c => c.label), y, headH, NAVY);

  items.forEach((item, idx) => {
    y = drawRow(doc, cols, [
      idx + 1,
      item.product_code || '',
      item.product_name || '',
      item.hsn_code     || '',
      item.quantity,
      item.unit || 'Nos',
      fc(item.final_rate),
      fc(item.amount),
    ], y, rowH, idx % 2 === 1 ? ALTROW : null);
  });

  // final bottom border emphasis
  doc.moveTo(ML, y).lineTo(ML + cw(doc), y).lineWidth(0.8).stroke(NAVY).lineWidth(1);
  return y;
}

// ─── Section: Totals ──────────────────────────────────────────────────────────
function sTotals(doc, data, isPI, y) {
  const w    = cw(doc);
  const lblW = w * 0.73;
  const valW = w - lblW;
  const rowH = 17;
  y += 2;

  const rows = isPI
    ? [
        { label: 'Sub Total',                                       val: 'Rs. ' + fc(data.subtotal) },
        { label: `CGST  @  ${data.cgst_rate ?? (data.gst_rate/2)}%`, val: 'Rs. ' + fc(data.cgst_amount) },
        { label: `SGST  @  ${data.sgst_rate ?? (data.gst_rate/2)}%`, val: 'Rs. ' + fc(data.sgst_amount) },
        { label: 'Round Off',                                       val: fc(data.round_off) },
      ]
    : [
        { label: 'Sub Total', val: 'Rs. ' + fc(data.subtotal) },
        { label: 'Round Off', val: fc(data.round_off) },
      ];

  rows.forEach(row => {
    doc.rect(ML, y, w, rowH).stroke(BORD);
    doc.font('Helvetica').fontSize(8).fillColor(TXTSUB)
       .text(row.label, ML + lblW * 0.05, y + 4, { width: lblW * 0.9, align: 'right' });
    doc.font('Helvetica').fontSize(8).fillColor(TXT)
       .text(row.val, ML + lblW + 3, y + 4, { width: valW - 6, align: 'right' });
    y += rowH;
  });

  // Grand total
  const gtH = 23;
  doc.rect(ML, y, w, gtH).fill(NAVY).stroke(BORD);
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff')
     .text('GRAND TOTAL', ML + lblW * 0.05, y + 7, { width: lblW * 0.9, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
     .text('Rs. ' + fc(data.grand_total), ML + lblW + 3, y + 7, { width: valW - 6, align: 'right' });
  y += gtH + 8;

  // Amount in words
  doc.rect(ML, y, w, 22).fill(NAVYLT).stroke(BORD);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY)
     .text('Amount in Words: ', ML + 6, y + 7, { continued: true });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXT)
     .text(amountInWords(data.grand_total), { width: w - 12 });
  y += 22 + 6;

  doc.font('Helvetica').fontSize(7).fillColor(TXTMID).text('E. & O.E', ML, y);
  return y + 12;
}

// ─── Section: Tax summary (PI only) ──────────────────────────────────────────
function sTaxSummary(doc, data, y) {
  const w = cw(doc);
  y += 4;

  // label
  doc.rect(ML, y, w, 16).fill(NAVYLT).stroke(BORD);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
     .text('TAX SUMMARY', ML + 6, y + 4);
  y += 16;

  const tc = [
    { label: 'Taxable Value',  w: w * 0.22  },
    { label: 'CGST Rate',      w: w * 0.14  },
    { label: 'CGST Amount',    w: w * 0.18  },
    { label: 'SGST Rate',      w: w * 0.14  },
    { label: 'SGST Amount',    w: w * 0.18  },
    { label: 'Total Tax',      w: w * 0.14  },
  ];
  const rowH = 18;

  // header
  doc.rect(ML, y, w, rowH).fill(NAVYLT).stroke(BORD);
  let x = ML;
  tc.forEach((c, i) => {
    if (i > 0) doc.moveTo(x, y).lineTo(x, y + rowH).stroke(BORD);
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(NAVY)
       .text(c.label, x + 3, y + 5, { width: c.w - 6, align: 'center' });
    x += c.w;
  });
  y += rowH;

  // data row
  const gst  = data.gst_rate || 0;
  const vals = [
    fc(data.subtotal),
    `${gst/2}%`,
    fc(data.cgst_amount),
    `${gst/2}%`,
    fc(data.sgst_amount),
    fc(data.total_tax),
  ];
  doc.rect(ML, y, w, rowH).stroke(BORD);
  x = ML;
  vals.forEach((v, i) => {
    if (i > 0) doc.moveTo(x, y).lineTo(x, y + rowH).stroke(BORD);
    doc.font('Helvetica').fontSize(8).fillColor(TXT)
       .text(v, x + 3, y + 5, { width: tc[i].w - 6, align: 'center' });
    x += tc[i].w;
  });
  y += rowH;

  // caption row
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTSUB)
     .text(`Tax Amount in Words: ${amountInWords(data.total_tax)}`, ML, y + 5, { width: w * 0.65 });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTSUB)
     .text(`Company's PAN: ${CO.pan}`, ML + w * 0.65, y + 5, { width: w * 0.35, align: 'right' });
  return y + 18;
}

// ─── Section: Footer ─────────────────────────────────────────────────────────
function sFooter(doc, isPI, y) {
  const w      = cw(doc);
  const leftW  = w * 0.52;
  const rightW = w - leftW;
  const H      = 88;
  y += 6;

  doc.rect(ML,          y, leftW,  H).stroke(BORD);
  doc.rect(ML + leftW,  y, rightW, H).stroke(BORD);

  // Left – declaration + customer sign
  const decl = isPI
    ? 'I/We hereby certify that my/our Registration Certificate under the Goods and Services Tax Act, 2017 is in force on the date on which the sale of Goods specified in this Proforma Invoice is made by me/us and that the transaction of supply covered under this Tax Invoice is in accordance with the applicable GST laws.'
    : 'I/We hereby certify that the goods specified in this Estimate are as described and the prices quoted are current prevailing market prices.';

  doc.font('Helvetica').fontSize(6.8).fillColor(TXTSUB)
     .text(decl, ML + 5, y + 7, { width: leftW - 10 });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTSUB)
     .text("Customer's Seal & Signature", ML + 5, y + H - 16, { width: leftW - 10 });

  // Right – company sign + bank
  const rx = ML + leftW + 8;
  const rw = rightW - 14;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
     .text(`for  ${CO.name}`, rx, y + 7, { width: rw });
  doc.moveTo(ML + leftW + 5, y + 18).lineTo(ML + w - 5, y + 18).stroke(BORD);

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(TXTSUB)
     .text('Bank Details:', rx, y + 22, { width: rw });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTSUB)
     .text(`Bank:    ${CO.bankName}`,  rx, y + 32, { width: rw })
     .text(`A/c No:  ${CO.bankAc}`,   rx, y + 42, { width: rw })
     .text(`Branch:  ${CO.bankBranch}`, rx, y + 52, { width: rw })
     .text(`IFSC:    ${CO.bankIfsc}`,  rx, y + 62, { width: rw });
  doc.font('Helvetica').fontSize(7.5).fillColor(TXTSUB)
     .text('Authorised Signatory', rx, y + H - 16, { width: rw });

  y += H + 8;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
     .text('SUBJECT TO NASHIK JURISDICTION', ML, y, { width: w, align: 'center' });
  y += 13;
  doc.font('Helvetica').fontSize(7).fillColor(TXTMID)
     .text(
       isPI ? 'This is a Computer Generated Proforma Invoice' : 'This is a Computer Generated Estimate',
       ML, y, { width: w, align: 'center' }
     );
  return y + 12;
}

// ─── Proforma Invoice ─────────────────────────────────────────────────────────
async function generatePI(order, pi, items) {
  ensureDir(PDF_DIR);
  const fileName = `PI_${pi.invoice_no.replace(/\//g, '-')}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Proforma Invoice – ${pi.invoice_no}`, Author: CO.name } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    let y = 28;

    // 1. Banner
    y = sBanner(doc, 'PROFORMA INVOICE', 'ORIGINAL FOR RECIPIENT', y);

    // 2. Company + meta
    y = sCompanyMeta(doc, [
      { label: 'Invoice No.',         value: pi.invoice_no },
      { label: 'Dated',               value: fd(pi.invoice_date) },
      { label: 'Delivery Note',       value: '' },
      { label: "Buyer's Order No.",   value: '' },
      { label: 'Dispatched through',  value: order.transporter_name    || '' },
      { label: 'Transporter Contact', value: order.transporter_contact || '' },
    ], y);

    // 3. Info rows
    y = sInfoRow(doc, 'Destination',      order.dealer_city  || '', y);
    y = sInfoRow(doc, 'Terms of Delivery', order.payment_terms || '', y);

    // 4. Buyer
    y = sBuyer(doc, {
      name:          order.dealer_name,
      address:       order.dealer_address,
      city:          order.dealer_city,
      state:         order.dealer_state,
      pin:           order.dealer_pin,
      gstin:         order.dealer_gstin,
      pan:           order.dealer_pan,
      contactPerson: order.contact_person,
      contact:       order.dealer_contact,
    }, true, y);

    // 5. Products table (dynamic rows)
    y = sTable(doc, items, y);

    // 6. Totals
    const gstRate = items[0]?.gst_percent || 0;
    y = sTotals(doc, { ...pi, gst_rate: gstRate }, true, y);

    // 7. Tax summary
    y = sTaxSummary(doc, { ...pi, gst_rate: gstRate }, y);

    // 8. Footer
    sFooter(doc, true, y);

    doc.end();
    stream.on('finish', () => resolve({ filePath, fileName }));
    stream.on('error', reject);
  });
}

// ─── Estimate ────────────────────────────────────────────────────────────────
async function generateEstimate(order, est, items) {
  ensureDir(PDF_DIR);
  const fileName = `EST_${est.estimate_no.replace(/\//g, '-')}_${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 0, info: { Title: `Estimate – ${est.estimate_no}`, Author: CO.name } });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    let y = 28;

    // 1. Banner
    y = sBanner(doc, 'ESTIMATE', 'ORIGINAL FOR RECIPIENT', y);

    // 2. Company + meta
    y = sCompanyMeta(doc, [
      { label: 'Estimate No.',        value: est.estimate_no },
      { label: 'Dated',               value: fd(est.estimate_date) },
      { label: 'Delivery Note',       value: '' },
      { label: "Buyer's Order No.",   value: '' },
      { label: 'Dispatched through',  value: order.transporter_name    || '' },
      { label: 'Transporter Contact', value: order.transporter_contact || '' },
    ], y);

    // 3. Info rows
    y = sInfoRow(doc, 'Destination',       order.dealer_city   || '', y);
    y = sInfoRow(doc, 'Terms of Delivery',  order.payment_terms || '', y);

    // 4. Buyer (no GST/PAN for estimate)
    y = sBuyer(doc, {
      name:          order.dealer_name,
      address:       order.dealer_address,
      city:          order.dealer_city,
      state:         order.dealer_state,
      pin:           order.dealer_pin,
      contactPerson: order.contact_person,
      contact:       order.dealer_contact,
    }, false, y);

    // 5. Products table (dynamic rows)
    y = sTable(doc, items, y);

    // 6. Totals (no GST lines for estimate)
    y = sTotals(doc, est, false, y);

    // 7. Footer
    sFooter(doc, false, y);

    doc.end();
    stream.on('finish', () => resolve({ filePath, fileName }));
    stream.on('error', reject);
  });
}

module.exports = { generatePI, generateEstimate };
