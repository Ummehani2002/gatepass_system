import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(d)) return d;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}

function actor(req) {
  return req.user.name || req.user.username;
}

function mapCustomer(r) {
  return {
    id: String(r.id),
    customerName: r.customer_name,
    party: r.party,
    projects: r.projects || [],
    createdBy: r.created_by || '',
    createdAt: formatDate(r.created_at),
    modifiedBy: r.modified_by || null,
    modifiedAt: r.modified_at ? formatDate(r.modified_at) : null,
  };
}

function mapPlant(r) {
  return {
    id: String(r.id),
    category: r.category,
    plantName: r.plant_name,
    createdBy: r.created_by || '',
    createdAt: formatDate(r.created_at),
    modifiedBy: r.modified_by || null,
    modifiedAt: r.modified_at ? formatDate(r.modified_at) : null,
  };
}

function mapLocation(r) {
  return {
    id: String(r.id),
    name: r.name,
    createdBy: r.created_by || '',
    createdAt: formatDate(r.created_at),
    modifiedBy: r.modified_by || null,
    modifiedAt: r.modified_at ? formatDate(r.modified_at) : null,
  };
}

// ── Customers ────────────────────────────────────────────────────────────────

router.get('/customers', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM customers ORDER BY id DESC');
    res.json(rows.map(mapCustomer));
  } catch (err) { next(err); }
});

router.post('/customers', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.customerName || !String(b.customerName).trim()) {
      return res.status(400).json({ error: 'customerName is required' });
    }
    const party = b.party === 'INT' ? 'INT' : 'EXT';
    const projects = Array.isArray(b.projects) ? b.projects.map(String) : [];
    const { rows } = await pool.query(
      `INSERT INTO customers (customer_name, party, projects, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.customerName.trim(), party, projects, actor(req)]
    );
    res.status(201).json(mapCustomer(rows[0]));
  } catch (err) { next(err); }
});

router.put('/customers/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.customerName || !String(b.customerName).trim()) {
      return res.status(400).json({ error: 'customerName is required' });
    }
    const party = b.party === 'INT' ? 'INT' : 'EXT';
    const projects = Array.isArray(b.projects) ? b.projects.map(String) : [];
    const { rows } = await pool.query(
      `UPDATE customers SET
         customer_name = $1, party = $2, projects = $3,
         modified_by = $4, modified_at = now()
       WHERE id = $5 RETURNING *`,
      [b.customerName.trim(), party, projects, actor(req), Number(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });
    res.json(mapCustomer(rows[0]));
  } catch (err) { next(err); }
});

// ── Plants ───────────────────────────────────────────────────────────────────

router.get('/plants', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM plants ORDER BY id DESC');
    res.json(rows.map(mapPlant));
  } catch (err) { next(err); }
});

router.post('/plants', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.category?.trim() || !b.plantName?.trim()) {
      return res.status(400).json({ error: 'category and plantName are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO plants (category, plant_name, created_by)
       VALUES ($1,$2,$3) RETURNING *`,
      [b.category.trim(), b.plantName.trim(), actor(req)]
    );
    res.status(201).json(mapPlant(rows[0]));
  } catch (err) { next(err); }
});

router.post('/plants/bulk', requireRole('admin'), async (req, res, next) => {
  try {
    const rowsIn = Array.isArray(req.body) ? req.body : (req.body?.rows || []);
    const cleaned = rowsIn.filter(r => r?.category?.trim() && r?.plantName?.trim());
    if (!cleaned.length) return res.status(400).json({ error: 'No valid plant rows' });

    const created = [];
    const createdBy = actor(req);
    for (const r of cleaned) {
      const { rows } = await pool.query(
        `INSERT INTO plants (category, plant_name, created_by)
         VALUES ($1,$2,$3) RETURNING *`,
        [r.category.trim(), r.plantName.trim(), createdBy]
      );
      created.push(mapPlant(rows[0]));
    }
    res.status(201).json(created);
  } catch (err) { next(err); }
});

// ── Locations ────────────────────────────────────────────────────────────────

router.get('/locations', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM locations ORDER BY id DESC');
    res.json(rows.map(mapLocation));
  } catch (err) { next(err); }
});

router.post('/locations', requireRole('admin'), async (req, res, next) => {
  try {
    const name = (req.body?.name ? String(req.body.name) : '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO locations (name, created_by) VALUES ($1,$2) RETURNING *`,
        [name, actor(req)]
      );
      res.status(201).json(mapLocation(rows[0]));
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Location already exists' });
      throw e;
    }
  } catch (err) { next(err); }
});

// ── Number settings ──────────────────────────────────────────────────────────

router.get('/number-settings', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT value FROM app_settings WHERE key = 'number_settings'`
    );
    const v = rows[0]?.value || { gpPrefix: 'GP-', gpNext: 100001, dnPrefix: 'DO-', dnNext: 100001 };
    res.json({
      gpPrefix: v.gpPrefix || 'GP-',
      gpNext: Number(v.gpNext) || 100001,
      dnPrefix: v.dnPrefix || 'DO-',
      dnNext: Number(v.dnNext) || 100001,
    });
  } catch (err) { next(err); }
});

router.put('/number-settings', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const updated = {
      gpPrefix: String(b.gpPrefix || 'GP-').trim(),
      gpNext: Math.max(1, Math.floor(Number(b.gpNext)) || 1),
      dnPrefix: String(b.dnPrefix || 'DO-').trim(),
      dnNext: Math.max(1, Math.floor(Number(b.dnNext)) || 1),
    };
    await pool.query(
      `INSERT INTO app_settings (key, value) VALUES ('number_settings', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [JSON.stringify(updated)]
    );
    res.json(updated);
  } catch (err) { next(err); }
});

export default router;
