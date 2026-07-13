import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/db.js';

const USERS = [
  { username: 'admin',  password: 'admin123',  display_name: 'Admin User',      role: 'admin'  },
  { username: 'garden', password: 'garden123', display_name: 'Garden Incharge', role: 'garden' },
];

async function main() {
  await withTransaction(async c => {
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await c.query(
        `INSERT INTO users (username, password_hash, display_name, role)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (username) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               display_name  = EXCLUDED.display_name,
               role          = EXCLUDED.role`,
        [u.username, hash, u.display_name, u.role]
      );
    }
    console.log(`✓ Seeded ${USERS.length} users (admin/admin123, garden/garden123)`);

    const gp1 = await c.query(
      `INSERT INTO gate_passes (no, do_no, do_date, customer_name, customer_code, created_by)
       VALUES ('06608','DO-2026-118','23-06-2026','RYM - Project','PSE 20241022','Admin User')
       ON CONFLICT (no) DO NOTHING RETURNING id`
    );
    if (gp1.rows[0]) {
      await c.query(
        `INSERT INTO gate_pass_lines (gp_id, sl_no, plant_code, plant_desc, pot_size, height, qty, posted_qty, remaining_qty)
         VALUES ($1, 1, 'N-1', 'Ruellia ciliosa', '0.4', '30-40', 12, 0, 0)`,
        [gp1.rows[0].id]
      );
    }

    const gp2 = await c.query(
      `INSERT INTO gate_passes (no, do_no, do_date, customer_name, customer_code, created_by)
       VALUES ('06607','DO-2026-110','15-06-2026','Opal Garden','PSE 20240915','Admin User')
       ON CONFLICT (no) DO NOTHING RETURNING id`
    );
    if (gp2.rows[0]) {
      await c.query(
        `INSERT INTO gate_pass_lines (gp_id, sl_no, plant_code, plant_desc, pot_size, height, qty, posted_qty, remaining_qty) VALUES
          ($1, 1, 'BG-12', 'Bougainvillea G. Pink', '11', '30-40', 8, 0, 0),
          ($1, 2, 'DR-04', 'Duranta Golden',        '5',  '25-30', 4, 0, 0)`,
        [gp2.rows[0].id]
      );

      const dn = await c.query(
        `INSERT INTO delivery_notes
          (no, gp_id, gp_no, customer_project, customer_code, location, dn_date, vh_number, project, prepared_by, status)
         VALUES ('34099',$1,'06607','Opal Garden','PSE 20240915','Nizwa - 03','16-06-2026','OM 4-21877','Opal Garden','Garden Incharge','completed')
         ON CONFLICT (no) DO NOTHING RETURNING id`,
        [gp2.rows[0].id]
      );
      if (dn.rows[0]) {
        await c.query(`UPDATE gate_passes SET delivery_note_id = $1 WHERE id = $2`, [dn.rows[0].id, gp2.rows[0].id]);
        const l1 = await c.query(`INSERT INTO delivery_note_lines (dn_id, sl_no, plant_name, plant_code, spec, qty, delivery_qty) VALUES ($1,1,'Bougainvillea G. Pink','BG-12','11L · H30-40',8,8) RETURNING id`, [dn.rows[0].id]);
        const l2 = await c.query(`INSERT INTO delivery_note_lines (dn_id, sl_no, plant_name, plant_code, spec, qty, delivery_qty) VALUES ($1,2,'Duranta Golden','DR-04','5L · H25-30',4,4) RETURNING id`, [dn.rows[0].id]);
        for (const code of ['AC-880142','AC-880143','AC-880144','AC-880145','AC-880146','AC-880147','AC-880148','AC-880149'])
          await c.query(`INSERT INTO serials (dn_line_id, code, scanned_by) VALUES ($1,$2,'Garden Incharge')`, [l1.rows[0].id, code]);
        for (const code of ['AC-900311','AC-900312','AC-900313','AC-900314'])
          await c.query(`INSERT INTO serials (dn_line_id, code, scanned_by) VALUES ($1,$2,'Garden Incharge')`, [l2.rows[0].id, code]);
        console.log('✓ Seeded 2 gate passes + 1 completed delivery note (34099) with 12 barcodes');
      }
    }
  });
  await pool.end();
}

main().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
