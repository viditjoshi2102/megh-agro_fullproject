-- Megh Agro Equipment - Field Sales & PI Management System
-- Database Schema v1.0
-- MySQL 8.0+

CREATE DATABASE IF NOT EXISTS megh_agro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE megh_agro;

-- ─── ROLES ───────────────────────────────────────────────────────────────────
CREATE TABLE roles (
  id        TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(50) NOT NULL UNIQUE,
  label     VARCHAR(100) NOT NULL
);

INSERT INTO roles (name, label) VALUES
  ('super_admin',   'Owner / Super Admin'),
  ('sales_admin',   'Sales Admin'),
  ('salesperson',   'Field Salesperson');

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  role_id       TINYINT UNSIGNED NOT NULL,
  name          VARCHAR(100) NOT NULL,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(150) UNIQUE,
  mobile        VARCHAR(15),
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Default super admin (password: Admin@1234)
INSERT INTO users (role_id, name, username, email, mobile, password_hash) VALUES
  (1, 'Megh Admin', 'admin', 'admin@meghagro.com', '09422250263',
   '$2b$12$L10UNrTIpRHXyI4dFP5J6.KdACGgIaZC5/vsMspjA/Lh7q8iOBu8m');

-- ─── PRODUCT CATEGORIES ──────────────────────────────────────────────────────
CREATE TABLE product_categories (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── HSN-GST REFERENCE ───────────────────────────────────────────────────────
CREATE TABLE hsn_gst_reference (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category     VARCHAR(100),
  hsn_code     VARCHAR(20)  NOT NULL,
  gst_rate     DECIMAL(5,2) NOT NULL,
  cgst_rate    DECIMAL(5,2) GENERATED ALWAYS AS (gst_rate / 2) STORED,
  sgst_rate    DECIMAL(5,2) GENERATED ALWAYS AS (gst_rate / 2) STORED,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hsn (hsn_code)
);

-- ─── PRODUCTS ────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id    INT UNSIGNED,
  product_code   VARCHAR(50) NOT NULL UNIQUE,
  product_name   VARCHAR(200) NOT NULL,
  specification  TEXT,
  unit           VARCHAR(20) NOT NULL DEFAULT 'Nos',
  hsn_code       VARCHAR(20) NOT NULL,
  gst_percent    DECIMAL(5,2) NOT NULL,
  mrp            DECIMAL(12,2) NOT NULL DEFAULT 0,
  dealer_price   DECIMAL(12,2) NOT NULL DEFAULT 0,
  moq            INT UNSIGNED NOT NULL DEFAULT 1,
  stock_status   ENUM('in_stock','out_of_stock','limited') NOT NULL DEFAULT 'in_stock',
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL
);

-- ─── DEALERS ─────────────────────────────────────────────────────────────────
CREATE TABLE dealers (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  salesperson_id   INT UNSIGNED,
  dealer_code      VARCHAR(30) NOT NULL UNIQUE,
  dealer_name      VARCHAR(200) NOT NULL,
  contact_person   VARCHAR(100),
  mobile           VARCHAR(15),
  whatsapp         VARCHAR(15),
  email            VARCHAR(150),
  address          TEXT,
  city             VARCHAR(100),
  state            VARCHAR(100),
  pin_code         VARCHAR(10),
  gstin            VARCHAR(20),
  pan              VARCHAR(15),
  credit_limit     DECIMAL(14,2) NOT NULL DEFAULT 0,
  payment_terms    VARCHAR(100),
  discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  status           ENUM('active','inactive') NOT NULL DEFAULT 'active',
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (salesperson_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ─── ORDERS ──────────────────────────────────────────────────────────────────
CREATE TABLE orders (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no         VARCHAR(30) NOT NULL UNIQUE,
  salesperson_id   INT UNSIGNED NOT NULL,
  dealer_id        INT UNSIGNED NOT NULL,
  transporter_name VARCHAR(200),
  transporter_contact VARCHAR(20),
  subtotal         DECIMAL(14,2) NOT NULL DEFAULT 0,
  cgst_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  sgst_amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_tax        DECIMAL(12,2) NOT NULL DEFAULT 0,
  round_off        DECIMAL(6,2)  NOT NULL DEFAULT 0,
  grand_total      DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes            TEXT,
  status           ENUM('pending','invoiced','dispatched','cancelled') NOT NULL DEFAULT 'pending',
  is_synced        BOOLEAN NOT NULL DEFAULT TRUE,
  order_date       DATE NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (salesperson_id) REFERENCES users(id),
  FOREIGN KEY (dealer_id)      REFERENCES dealers(id)
);

-- ─── ORDER ITEMS ─────────────────────────────────────────────────────────────
CREATE TABLE order_items (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id       INT UNSIGNED NOT NULL,
  product_id     INT UNSIGNED NOT NULL,
  product_code   VARCHAR(50)  NOT NULL,
  product_name   VARCHAR(200) NOT NULL,
  hsn_code       VARCHAR(20)  NOT NULL,
  gst_percent    DECIMAL(5,2) NOT NULL,
  quantity       INT UNSIGNED NOT NULL,
  dealer_price   DECIMAL(12,2) NOT NULL,
  final_rate     DECIMAL(12,2) NOT NULL,
  amount         DECIMAL(14,2) NOT NULL,
  is_rate_overridden BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- ─── PROFORMA INVOICES ───────────────────────────────────────────────────────
CREATE TABLE proforma_invoices (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id       INT UNSIGNED NOT NULL UNIQUE,
  invoice_no     VARCHAR(30)  NOT NULL UNIQUE,
  invoice_date   DATE         NOT NULL,
  financial_year VARCHAR(10)  NOT NULL,
  subtotal       DECIMAL(14,2) NOT NULL,
  cgst_rate      DECIMAL(5,2) NOT NULL,
  cgst_amount    DECIMAL(12,2) NOT NULL,
  sgst_rate      DECIMAL(5,2) NOT NULL,
  sgst_amount    DECIMAL(12,2) NOT NULL,
  total_tax      DECIMAL(12,2) NOT NULL,
  round_off      DECIMAL(6,2)  NOT NULL DEFAULT 0,
  grand_total    DECIMAL(14,2) NOT NULL,
  amount_in_words VARCHAR(500) NOT NULL,
  pdf_path       VARCHAR(500),
  generated_by   INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)     REFERENCES orders(id),
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- ─── PI SEQUENCE (financial year) ────────────────────────────────────────────
CREATE TABLE pi_sequence (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  financial_year VARCHAR(10) NOT NULL UNIQUE,
  last_number    INT UNSIGNED NOT NULL DEFAULT 0
);

-- ─── ESTIMATES ───────────────────────────────────────────────────────────────
CREATE TABLE estimates (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id       INT UNSIGNED NOT NULL,
  estimate_no    VARCHAR(30)  NOT NULL UNIQUE,
  estimate_date  DATE         NOT NULL,
  subtotal       DECIMAL(14,2) NOT NULL,
  round_off      DECIMAL(6,2)  NOT NULL DEFAULT 0,
  grand_total    DECIMAL(14,2) NOT NULL,
  amount_in_words VARCHAR(500) NOT NULL,
  pdf_path       VARCHAR(500),
  generated_by   INT UNSIGNED NOT NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)     REFERENCES orders(id),
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

-- ─── ESTIMATE SEQUENCE ───────────────────────────────────────────────────────
CREATE TABLE estimate_sequence (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  financial_year VARCHAR(10) NOT NULL UNIQUE,
  last_number    INT UNSIGNED NOT NULL DEFAULT 0
);

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED,
  user_name   VARCHAR(100),
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(50)  NOT NULL,
  entity_id   INT UNSIGNED,
  old_values  JSON,
  new_values  JSON,
  ip_address  VARCHAR(45),
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity    (entity, entity_id),
  INDEX idx_user      (user_id),
  INDEX idx_created   (created_at)
);

-- ─── REFRESH TOKENS ──────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  token_hash  VARCHAR(255) NOT NULL,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── VIEWS ───────────────────────────────────────────────────────────────────
CREATE VIEW v_orders_full AS
SELECT
  o.id, o.order_no, o.status, o.order_date,
  o.subtotal, o.cgst_amount, o.sgst_amount, o.grand_total,
  o.notes, o.transporter_name, o.transporter_contact,
  u.id   AS salesperson_id,   u.name AS salesperson_name,
  d.id   AS dealer_id,        d.dealer_name, d.dealer_code,
  d.city AS dealer_city,      d.state AS dealer_state,
  d.gstin AS dealer_gstin,    d.contact_person, d.mobile AS dealer_mobile,
  pi.invoice_no, pi.id AS pi_id, pi.pdf_path AS pi_pdf,
  est.estimate_no, est.id AS estimate_id
FROM orders o
JOIN users   u ON o.salesperson_id = u.id
JOIN dealers d ON o.dealer_id      = d.id
LEFT JOIN proforma_invoices pi  ON pi.order_id  = o.id
LEFT JOIN estimates         est ON est.order_id = o.id;
