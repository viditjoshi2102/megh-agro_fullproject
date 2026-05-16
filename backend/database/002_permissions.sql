-- Migration 002: Role permissions system
-- Run once against an existing megh_agro database

USE megh_agro;

-- ─── PERMISSIONS MASTER ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  module  VARCHAR(50)  NOT NULL,
  action  VARCHAR(50)  NOT NULL,
  label   VARCHAR(120) NOT NULL,
  UNIQUE KEY uq_perm (module, action)
);

-- ─── ROLE ↔ PERMISSION JUNCTION ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TINYINT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id)       REFERENCES roles(id)       ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- ─── Allow dynamic roles (remove UNIQUE constraint on name if needed) ─────────
ALTER TABLE roles
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE roles SET is_system = TRUE WHERE id IN (1, 2, 3);

-- ─── SEED PERMISSIONS ────────────────────────────────────────────────────────
INSERT IGNORE INTO permissions (module, action, label) VALUES
  -- Dashboard
  ('dashboard', 'view',     'Dashboard – View'),
  -- Orders
  ('orders',    'view',     'Orders – View'),
  ('orders',    'create',   'Orders – Create'),
  ('orders',    'edit',     'Orders – Edit Status'),
  -- Invoices
  ('invoices',  'view',     'Invoices – View'),
  ('invoices',  'generate', 'Invoices – Generate PI'),
  ('invoices',  'download', 'Invoices – Download PDF'),
  -- Estimates
  ('estimates', 'view',     'Estimates – View'),
  ('estimates', 'generate', 'Estimates – Generate'),
  ('estimates', 'download', 'Estimates – Download PDF'),
  -- Dealers
  ('dealers',   'view',     'Dealers – View'),
  ('dealers',   'create',   'Dealers – Create'),
  ('dealers',   'edit',     'Dealers – Edit'),
  ('dealers',   'delete',   'Dealers – Delete'),
  -- Products
  ('products',  'view',     'Products – View'),
  ('products',  'create',   'Products – Create'),
  ('products',  'edit',     'Products – Edit'),
  ('products',  'delete',   'Products – Delete'),
  -- Users
  ('users',     'view',     'Users – View'),
  ('users',     'create',   'Users – Create'),
  ('users',     'edit',     'Users – Edit / Reset Password'),
  -- HSN-GST
  ('hsn',       'view',     'HSN-GST – View'),
  ('hsn',       'create',   'HSN-GST – Create'),
  ('hsn',       'edit',     'HSN-GST – Edit'),
  ('hsn',       'delete',   'HSN-GST – Delete'),
  -- Roles
  ('roles',     'view',     'Roles – View'),
  ('roles',     'create',   'Roles – Create'),
  ('roles',     'edit',     'Roles – Edit Permissions'),
  ('roles',     'delete',   'Roles – Delete');

-- ─── SEED DEFAULT ROLE PERMISSIONS ───────────────────────────────────────────

-- Super Admin (id=1) → ALL permissions
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions;

-- Sales Admin (id=2) → most except users/roles management
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 2, id FROM permissions
  WHERE (module, action) IN (
    ('dashboard','view'),
    ('orders','view'),('orders','create'),('orders','edit'),
    ('invoices','view'),('invoices','generate'),('invoices','download'),
    ('estimates','view'),('estimates','generate'),('estimates','download'),
    ('dealers','view'),('dealers','create'),('dealers','edit'),
    ('products','view'),('products','create'),('products','edit'),
    ('users','view'),
    ('hsn','view')
  );

-- Salesperson (id=3) → field-only access
INSERT IGNORE INTO role_permissions (role_id, permission_id)
  SELECT 3, id FROM permissions
  WHERE (module, action) IN (
    ('dashboard','view'),
    ('orders','view'),('orders','create'),
    ('invoices','generate'),('invoices','download'),
    ('estimates','view'),('estimates','generate'),('estimates','download'),
    ('dealers','view'),
    ('products','view')
  );
