import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

async function loadGatePass(client, gpId) {
  const gp = (await client.query('SELECT * FROM gate_passes WHERE id = $1', [gpId])).rows[0];
  if (!gp) return null;
  const lines = (await client.query('SELECT * FROM gate_pass_lines WHERE gp_id = $1 ORDER BY sl_no', [gpId])).rows;
  const dnNo = gp.delivery_note_id
    ? (await client.query('SELECT no FROM delivery_notes WHERE id = $1', [gp.delivery_note_id])).rows[0]?.no
    : null;
  return {
    no: gp.no, doNo: gp.do_no, doDate: gp.do_date,
    lpoNo: gp.lpo_no, lpoDate: gp.lpo_date,
    customerName: gp.customer_name, customerCode: gp.customer_code,
    createdBy: gp.created_by, createdAt: gp.created_at,
    dnNo: dnNo || null,
    lines: lines.map(l => ({
      slNo: l.sl_no, plantCode: l.plant_code, plantDesc: l.plant_desc,
      potSize: l.pot_size, height: l.height, girth: l.girth,
      spread: l.spread, unit: l.unit, qty: l.qty,
      postedQty: l.posted_qty, remainingQty: l.remaining_qty,
    })),
  };
}

async function nextGpNo(client) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX((no)::int), 6607) AS max FROM gate_passes WHERE no ~ '^[0-9]+$'`
  );
  return String(rows[0].max + 1).padStart(5, '0');
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

// POST /api/gate-passes  (admin only)
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.customerName || !String(b.customerName).trim()) {
      return res.status(400).json({ error: 'customerName is required' });
    }
    const lines = (b.lines || []).filter(
      l => (l.plantDesc && l.plantDesc.trim()) || (l.plantCode && l.plantCode.trim())
    );
    if (!lines.length) return res.status(400).json({ error: 'At least one plant line is required' });

    const gp = await withTransaction(async c => {
      const no = await nextGpNo(c);
      const ins = await c.query(
        `INSERT INTO gate_passes (no, do_no, do_date, lpo_no, lpo_date, customer_name, customer_code, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [no, b.doNo || null, b.doDate || null, b.lpoNo || null, b.lpoDate || null,
         b.customerName, b.customerCode || null, req.user.name || req.user.username]
      );
      const gpId = ins.rows[0].id;
      let sl = 1;
      for (const l of lines) {
        await c.query(
          `INSERT INTO gate_pass_lines
             (gp_id, sl_no, plant_code, plant_desc, pot_size, height, girth, spread, unit, qty, posted_qty, remaining_qty)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [gpId, sl++, l.plantCode || null, l.plantDesc || null, l.potSize || null,
           l.height || null, l.girth || null, l.spread || null, l.unit || 'Nos', Number(l.qty) || 0,
           Number(l.postedQty) || 0, Number(l.remainingQty) || 0]
        );
      }
      return loadGatePass(c, gpId);
    });
    res.status(201).json(gp);
  } catch (err) { next(err); }
});

export default router;
export { loadGatePass };
