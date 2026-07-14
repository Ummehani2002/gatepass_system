import { Router } from 'express';
import bcrypt from 'bcryptjs';
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

function mapUser(r) {
  return {
    id: String(r.id),
    username: r.username,
    password: '',
    role: r.role,
    createdBy: r.created_by || '',
    createdAt: formatDate(r.created_at),
    modifiedBy: r.modified_by || null,
    modifiedAt: r.modified_at ? formatDate(r.modified_at) : null,
  };
}

function actor(req) {
  return req.user.name || req.user.username;
}

// GET /api/users
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM users ORDER BY id');
    res.json(rows.map(mapUser));
  } catch (err) { next(err); }
});

// POST /api/users
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const username = (b.username ? String(b.username) : '').trim();
    const password = b.password ? String(b.password) : '';
    const role = b.role === 'garden' ? 'garden' : 'admin';
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        `INSERT INTO users (username, password_hash, display_name, role, created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [username, hash, username, role, actor(req)]
      );
      res.status(201).json(mapUser(rows[0]));
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'A user with that username already exists' });
      throw e;
    }
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/password
router.patch('/:id/password', requireRole('admin'), async (req, res, next) => {
  try {
    const password = req.body?.password ? String(req.body.password) : '';
    if (!password) return res.status(400).json({ error: 'password is required' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `UPDATE users SET password_hash = $1, modified_by = $2, modified_at = now()
       WHERE id = $3 RETURNING *`,
      [hash, actor(req), Number(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(mapUser(rows[0]));
  } catch (err) { next(err); }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { rows: existingRows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ error: 'User not found' });

    if (existing.role === 'admin') {
      const { rows: adminRows } = await pool.query(`SELECT COUNT(*)::int AS c FROM users WHERE role = 'admin'`);
      if ((adminRows[0]?.c || 0) <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last remaining Admin account' });
      }
    }

    if (String(req.user.sub) === String(existing.id) || req.user.username === existing.username) {
      return res.status(400).json({ error: 'Cannot delete the account you are currently signed in with' });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
