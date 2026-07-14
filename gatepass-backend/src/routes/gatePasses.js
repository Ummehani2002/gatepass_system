import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

function formatDate(d) {
  if (!d) return null;
  if (typeof d === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(d)) return d;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(dt.getDate())}-${pad(dt.getMonth() + 1)}-${dt.getFullYear()}`;
}

async function loadGatePass(client, gpId) {
  const gp = (await client.query('SELECT * FROM gate_passes WHERE id = $1', [gpId])).rows[0];
  if (!gp) return null;
  const lines = (await client.query(
    'SELECT * FROM gate_pass_lines WHERE gp_id = $1 ORDER BY sl_no',
    [gpId]
  )).rows;
  const dnNo = gp.delivery_note_id
    ? (await client.query('SELECT no FROM delivery_notes WHERE id = $1', [gp.delivery_note_id])).rows[0]?.no
    : null;
  return {
    no: gp.no,
    doNo: gp.do_no || '',
    doDate: gp.do_date || '',
    lpoNo: gp.lpo_no || '',
    lpoDate: gp.lpo_date || '',
    prRef: gp.pr_ref || '',
    soRef: gp.so_ref || '',
    customerName: gp.customer_name,
    customerCode: gp.customer_code || '',
    project: gp.project || '',
    party: gp.party || '',
    assignedTo: gp.assigned_to || [],
    createdBy: gp.created_by || '',
    createdAt: formatDate(gp.created_at) || '',
    modifiedBy: gp.modified_by || null,
    modifiedAt: gp.modified_at ? formatDate(gp.modified_at) : null,
    dnNo: dnNo || null,
    lines: lines.map(l => ({
      slNo: l.sl_no,
      plantCode: l.plant_code || '',
      plantDesc: l.plant_desc || '',
      potSize: l.pot_size || '',
      height: l.height || '',
      girth: l.girth || '',
      spread: l.spread || '',
      unit: l.unit || 'Nos',
      qty: String(l.qty ?? 0),
      postedQty: String(l.posted_qty ?? 0),
      remainingQty: String(l.remaining_qty ?? 0),
      location: l.location || '',
    })),
  };
}

async function nextGpNo(client) {
  const { rows } = await client.query(
    `SELECT value FROM app_settings WHERE key = 'number_settings' FOR UPDATE`
  );
  const settings = rows[0]?.value || { gpPrefix: 'GP-', gpNext: 100001 };
  const prefix = settings.gpPrefix || 'GP-';
  const next = Number(settings.gpNext) || 100001;
  const no = `${prefix}${String(next).padStart(6, '0')}`;
  await client.query(
    `UPDATE app_settings SET value = $1 WHERE key = 'number_settings'`,
    [JSON.stringify({ ...settings, gpNext: next + 1 })]
  );
  return no;
}

function actor(req) {
  return req.user.name || req.user.username;
}

// GET /api/gate-passes
router.get('/', async (req, res, next) => {
  try {
    const ids = (await pool.query('SELECT id FROM gate_passes ORDER BY id DESC')).rows.map(r => r.id);
    const out = [];
    for (const id of ids) out.push(await loadGatePass(pool, id));
    res.json(out);
  } catch (err) { next(err); }
});

// GET /api/gate-passes/:no
router.get('/:no', async (req, res, next) => {
  try {
    const row = (await pool.query('SELECT id FROM gate_passes WHERE no = $1', [req.params.no])).rows[0];
    if (!row) return res.status(404).json({ error: 'Gate pass not found' });
    res.json(await loadGatePass(pool, row.id));
  } catch (err) { next(err); }
});

// POST /api/gate-passes
router.post('/', requireRole('admin', 'garden'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.customerName || !String(b.customerName).trim()) {
      return res.status(400).json({ error: 'customerName is required' });
    }
    const lines = (b.lines || []).filter(
      l => (l.plantDesc && String(l.plantDesc).trim()) || (l.plantCode && String(l.plantCode).trim())
    );
    if (!lines.length) return res.status(400).json({ error: 'At least one plant line is required' });

    const gp = await withTransaction(async c => {
      const no = await nextGpNo(c);
      const assignedTo = Array.isArray(b.assignedTo) ? b.assignedTo.map(String) : [];
      const ins = await c.query(
        `INSERT INTO gate_passes
           (no, do_no, do_date, lpo_no, lpo_date, pr_ref, so_ref,
            customer_name, customer_code, project, party, assigned_to, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          no,
          b.doNo || null, b.doDate || null,
          b.lpoNo || null, b.lpoDate || null,
          b.prRef || null, b.soRef || null,
          b.customerName, b.customerCode || null,
          b.project || null, b.party || null,
          assignedTo,
          actor(req),
        ]
      );
      const gpId = ins.rows[0].id;
      let sl = 1;
      for (const l of lines) {
        await c.query(
          `INSERT INTO gate_pass_lines
             (gp_id, sl_no, plant_code, plant_desc, pot_size, height, girth, spread, unit,
              qty, posted_qty, remaining_qty, location)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            gpId, sl++,
            l.plantCode || null, l.plantDesc || null,
            l.potSize || null, l.height || null, l.girth || null, l.spread || null,
            l.unit || 'Nos',
            Number(l.qty) || 0, Number(l.postedQty) || 0, Number(l.remainingQty) || 0,
            l.location || null,
          ]
        );
      }
      return loadGatePass(c, gpId);
    });
    res.status(201).json(gp);
  } catch (err) { next(err); }
});

// PUT /api/gate-passes/:no
router.put('/:no', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.customerName || !String(b.customerName).trim()) {
      return res.status(400).json({ error: 'customerName is required' });
    }
    const lines = (b.lines || []).filter(
      l => (l.plantDesc && String(l.plantDesc).trim()) || (l.plantCode && String(l.plantCode).trim())
    );
    if (!lines.length) return res.status(400).json({ error: 'At least one plant line is required' });

    const gp = await withTransaction(async c => {
      const existing = (await c.query('SELECT * FROM gate_passes WHERE no = $1', [req.params.no])).rows[0];
      if (!existing) throw Object.assign(new Error('Gate pass not found'), { status: 404 });
      if (existing.delivery_note_id) {
        throw Object.assign(new Error('Cannot edit — this gate pass already has a delivery note'), { status: 409 });
      }

      const assignedTo = Array.isArray(b.assignedTo) ? b.assignedTo.map(String) : [];
      await c.query(
        `UPDATE gate_passes SET
           do_no = $1, do_date = $2, lpo_no = $3, lpo_date = $4, pr_ref = $5, so_ref = $6,
           customer_name = $7, customer_code = $8, project = $9, party = $10, assigned_to = $11,
           modified_by = $12, modified_at = now()
         WHERE id = $13`,
        [
          b.doNo || null, b.doDate || null,
          b.lpoNo || null, b.lpoDate || null,
          b.prRef || null, b.soRef || null,
          b.customerName, b.customerCode || null,
          b.project || null, b.party || null,
          assignedTo, actor(req), existing.id,
        ]
      );
      await c.query('DELETE FROM gate_pass_lines WHERE gp_id = $1', [existing.id]);
      let sl = 1;
      for (const l of lines) {
        await c.query(
          `INSERT INTO gate_pass_lines
             (gp_id, sl_no, plant_code, plant_desc, pot_size, height, girth, spread, unit,
              qty, posted_qty, remaining_qty, location)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            existing.id, sl++,
            l.plantCode || null, l.plantDesc || null,
            l.potSize || null, l.height || null, l.girth || null, l.spread || null,
            l.unit || 'Nos',
            Number(l.qty) || 0, Number(l.postedQty) || 0, Number(l.remainingQty) || 0,
            l.location || null,
          ]
        );
      }
      return loadGatePass(c, existing.id);
    });
    res.json(gp);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PATCH /api/gate-passes/:no/refs
router.patch('/:no/refs', requireRole('admin', 'garden'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const gp = await withTransaction(async c => {
      const existing = (await c.query('SELECT id FROM gate_passes WHERE no = $1', [req.params.no])).rows[0];
      if (!existing) throw Object.assign(new Error('Gate pass not found'), { status: 404 });
      await c.query(
        `UPDATE gate_passes SET so_ref = $1, pr_ref = $2, lpo_no = $3, modified_by = $4, modified_at = now()
         WHERE id = $5`,
        [b.soRef ?? '', b.prRef ?? '', b.lpoNo ?? '', actor(req), existing.id]
      );
      return loadGatePass(c, existing.id);
    });
    res.json(gp);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
export { loadGatePass };
