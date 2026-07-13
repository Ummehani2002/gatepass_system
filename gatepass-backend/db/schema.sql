-- ============================================================
-- Acacia LLC — Gate Pass System
-- Postgres schema
-- Run with:  npm run db:setup
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS serials             CASCADE;
DROP TABLE IF EXISTS delivery_note_lines CASCADE;
DROP TABLE IF EXISTS delivery_notes      CASCADE;
DROP TABLE IF EXISTS gate_pass_lines     CASCADE;
DROP TABLE IF EXISTS gate_passes         CASCADE;
DROP TABLE IF EXISTS users               CASCADE;

-- ── Users / roles ──────────────────────────────────────────
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin', 'garden')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Gate passes (created by Admin — Step 1) ────────────────
CREATE TABLE gate_passes (
  id            SERIAL PRIMARY KEY,
  no            TEXT NOT NULL UNIQUE,
  do_no         TEXT,
  do_date       TEXT,
  lpo_no        TEXT,
  lpo_date      TEXT,
  customer_name TEXT NOT NULL,
  customer_code TEXT,
  created_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivery_note_id INTEGER
);

CREATE TABLE gate_pass_lines (
  id          SERIAL PRIMARY KEY,
  gp_id       INTEGER NOT NULL REFERENCES gate_passes(id) ON DELETE CASCADE,
  sl_no       INTEGER NOT NULL,
  plant_code  TEXT,
  plant_desc  TEXT,
  pot_size    TEXT,
  height      TEXT,
  girth       TEXT,
  spread      TEXT,
  unit        TEXT DEFAULT 'Nos',
  qty         INTEGER NOT NULL DEFAULT 0,
  posted_qty    INTEGER NOT NULL DEFAULT 0,
  remaining_qty INTEGER NOT NULL DEFAULT 0
);

-- ── Delivery notes (created by Garden Incharge — Step 2) ───
CREATE TABLE delivery_notes (
  id               SERIAL PRIMARY KEY,
  no               TEXT NOT NULL UNIQUE,
  gp_id            INTEGER REFERENCES gate_passes(id) ON DELETE SET NULL,
  gp_no            TEXT,
  customer_project TEXT,
  customer_code    TEXT,
  location         TEXT NOT NULL,
  dn_date          TEXT,
  vh_number        TEXT NOT NULL,
  project          TEXT,
  prepared_by      TEXT,
  status           TEXT NOT NULL DEFAULT 'scanning'
                   CHECK (status IN ('scanning', 'completed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE delivery_note_lines (
  id           SERIAL PRIMARY KEY,
  dn_id        INTEGER NOT NULL REFERENCES delivery_notes(id) ON DELETE CASCADE,
  sl_no        INTEGER NOT NULL,
  plant_name   TEXT,
  plant_code   TEXT,
  spec         TEXT,
  qty          INTEGER NOT NULL DEFAULT 0,
  delivery_qty INTEGER NOT NULL DEFAULT 0,
  remarks      TEXT
);

-- ── Scanned barcodes (Step 3) ──────────────────────────────
CREATE TABLE serials (
  id          SERIAL PRIMARY KEY,
  dn_line_id  INTEGER NOT NULL REFERENCES delivery_note_lines(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  scanned_by  TEXT,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dn_line_id, code)
);

-- ── Deferred FK: gate_passes → delivery_notes ──────────────
ALTER TABLE gate_passes
  ADD CONSTRAINT fk_gp_delivery_note
  FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE SET NULL;

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX idx_gp_lines_gp  ON gate_pass_lines (gp_id);
CREATE INDEX idx_dn_lines_dn  ON delivery_note_lines (dn_id);
CREATE INDEX idx_serials_line ON serials (dn_line_id);
CREATE INDEX idx_dn_gp        ON delivery_notes (gp_id);
CREATE INDEX idx_gp_dn        ON gate_passes (delivery_note_id);

COMMIT;
