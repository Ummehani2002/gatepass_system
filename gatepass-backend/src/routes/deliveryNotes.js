import { Router } from 'express';
import { pool, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

async function loadDeliveryNote(client, dnId) {
  const dn = (await client.query('SELECT * FROM delivery_notes WHERE id = $1', [dnId])).rows[0];
  if (!dn) return null;
  const lines = (await client.query('SELECT * FROM delivery_note_lines WHERE dn_id = $1 ORDER BY sl_no', [dnId])).rows;
  const out = [];
  for (const l of lines) {
    const serials = (await client.query('SELECT code FROM serials WHERE dn_line_id = $1 ORDER BY id', [l.id])).rows.map(r => r.code);
    out.push({ slNo: l.sl_no, plantName: l.plant_name, plantCode: l.plant_code, spec: l.spec, qty: l.qty, deliveryQty: l.delivery_qty, remarks: l.remarks || '', serials });
  }
  return {
    no: dn.no, gpNo: dn.gp_no, customerProject: dn.customer_project, customerCode: dn.customer_code,
    location: dn.location, date: dn.dn_date, vhNumber: dn.vh_number, project: dn.project,
    preparedBy: dn.prepared_by, status: dn.status, createdAt: dn.created_at, lines: out,
  };
}

async function nextDnNo(client) {
  const { rows } = await client.query(
    `SELECT COALESCE(MAX((no)::int), 34098) AS max FROM delivery_notes WHERE no ~ '^[0-9]+$'`
  );
  return String(rows[0].max + 1);
}

function specOf(l) {
  const a = [];
  if (l.pot_size) a.push(l.pot_size + 'L');
  if (l.height)   a.push('H' + l.height);
  if (l.girth)    a.push('G' + l.girth);
  return a.join(' · ');
}

// GET /api/delivery-notes
router.get('/', async (req, res, next) => {
  try {
    const ids = (await pool.query('SELECT id FROM delivery_notes ORDER BY id DESC')).rows.map(r => r.id);
    const out = [];
    for (const id of ids) out.push(await loadDeliveryNote(pool, id));
    res.json(out);
  } catch (err) { next(err); }
});

// GET /api/delivery-notes/:no
router.get('/:no', async (req, res, next) => {
  try {
    const row = (await pool.query('SELECT id FROM delivery_notes WHERE no = $1', [req.params.no])).rows[0];
    if (!row) return res.status(404).json({ error: 'Delivery note not found' });
    res.json(await loadDeliveryNote(pool, row.id));
  } catch (err) { next(err); }
});

// POST /api/delivery-notes  (garden only)
router.post('/', requireRole('garden'), async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.gpNo) return res.status(400).json({ error: 'gpNo is required' });
    if (!b.location?.trim()) return res.status(400).json({ error: 'location is required' });
    if (!b.vhNumber?.trim()) return res.status(400).json({ error: 'vhNumber is required' });

    const dn = await withTransaction(async c => {
      const gp = (await c.query('SELECT * FROM gate_passes WHERE no = $1', [b.gpNo])).rows[0];
      if (!gp) throw Object.assign(new Error('Gate pass not found'), { status: 404 });
      if (gp.delivery_note_id) throw Object.assign(new Error('This gate pass already has a delivery note'), { status: 409 });

      const gpLines = (await c.query('SELECT * FROM gate_pass_lines WHERE gp_id = $1 ORDER BY sl_no', [gp.id])).rows;
      const no = await nextDnNo(c);
      const ins = await c.query(
        `INSERT INTO delivery_notes (no, gp_id, gp_no, customer_project, customer_code, location, dn_date, vh_number, project, prepared_by, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'scanning') RETURNING id`,
        [no, gp.id, gp.no, b.customerProject || gp.customer_name, gp.customer_code,
         b.location, b.date || null, b.vhNumber, b.project || gp.customer_name,
         req.user.name || req.user.username]
      );
      const dnId = ins.rows[0].id;

      const overrides = {};
      for (const ln of b.lines || []) overrides[ln.slNo] = ln;

      let sl = 1;
      for (const l of gpLines) {
        const ov = overrides[l.sl_no] || {};
        const deliveryQty = ov.deliveryQty != null ? Number(ov.deliveryQty) : Number(l.qty) || 0;
        await c.query(
          `INSERT INTO delivery_note_lines (dn_id, sl_no, plant_name, plant_code, spec, qty, delivery_qty, remarks)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [dnId, sl++, l.plant_desc || l.plant_code, l.plant_code, specOf(l),
           Number(l.qty) || 0, deliveryQty, ov.remarks || null]
        );
      }
      await c.query('UPDATE gate_passes SET delivery_note_id = $1 WHERE id = $2', [dnId, gp.id]);
      return loadDeliveryNote(c, dnId);
    });
    res.status(201).json(dn);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/delivery-notes/:no/lines/:slNo/serials  (garden)
router.post('/:no/lines/:slNo/serials', requireRole('garden'), async (req, res, next) => {
  try {
    const code = (req.body?.code ? String(req.body.code) : '').trim();
    if (!code) return res.status(400).json({ error: 'code is required' });

    const result = await withTransaction(async c => {
      const dn = (await c.query('SELECT * FROM delivery_notes WHERE no = $1', [req.params.no])).rows[0];
      if (!dn) throw Object.assign(new Error('Delivery note not found'), { status: 404 });
      if (dn.status === 'completed') throw Object.assign(new Error('Delivery note is already completed'), { status: 409 });
      const line = (await c.query('SELECT * FROM delivery_note_lines WHERE dn_id = $1 AND sl_no = $2', [dn.id, Number(req.params.slNo)])).rows[0];
      if (!line) throw Object.assign(new Error('Delivery note line not found'), { status: 404 });
      const count = Number((await c.query('SELECT COUNT(*)::int AS n FROM serials WHERE dn_line_id = $1', [line.id])).rows[0].n);
      if (count >= line.delivery_qty) throw Object.assign(new Error('This line is already fully scanned'), { status: 409 });
      try {
        await c.query('INSERT INTO serials (dn_line_id, code, scanned_by) VALUES ($1,$2,$3)', [line.id, code, req.user.name || req.user.username]);
      } catch (e) {
        if (e.code === '23505') throw Object.assign(new Error('Duplicate barcode: ' + code), { status: 409 });
        throw e;
      }
      return loadDeliveryNote(c, dn.id);
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/delivery-notes/:no/lines/:slNo/serials/:code  (garden)
router.delete('/:no/lines/:slNo/serials/:code', requireRole('garden'), async (req, res, next) => {
  try {
    const result = await withTransaction(async c => {
      const dn = (await c.query('SELECT * FROM delivery_notes WHERE no = $1', [req.params.no])).rows[0];
      if (!dn) throw Object.assign(new Error('Delivery note not found'), { status: 404 });
      if (dn.status === 'completed') throw Object.assign(new Error('Delivery note is already completed'), { status: 409 });
      const line = (await c.query('SELECT * FROM delivery_note_lines WHERE dn_id = $1 AND sl_no = $2', [dn.id, Number(req.params.slNo)])).rows[0];
      if (!line) throw Object.assign(new Error('Delivery note line not found'), { status: 404 });
      await c.query('DELETE FROM serials WHERE dn_line_id = $1 AND code = $2', [line.id, req.params.code]);
      return loadDeliveryNote(c, dn.id);
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/delivery-notes/:no/complete  (garden)
router.post('/:no/complete', requireRole('garden'), async (req, res, next) => {
  try {
    const result = await withTransaction(async c => {
      const dn = (await c.query('SELECT * FROM delivery_notes WHERE no = $1', [req.params.no])).rows[0];
      if (!dn) throw Object.assign(new Error('Delivery note not found'), { status: 404 });
      const short = (await c.query(
        `SELECT dnl.sl_no FROM delivery_note_lines dnl
           LEFT JOIN serials s ON s.dn_line_id = dnl.id
          WHERE dnl.dn_id = $1
          GROUP BY dnl.id, dnl.delivery_qty
         HAVING COUNT(s.id) < dnl.delivery_qty`,
        [dn.id]
      )).rows;
      if (short.length) throw Object.assign(new Error('Cannot complete — some lines are not fully scanned'), { status: 409 });
      await c.query(`UPDATE delivery_notes SET status = 'completed' WHERE id = $1`, [dn.id]);
      return loadDeliveryNote(c, dn.id);
    });
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

export default router;
