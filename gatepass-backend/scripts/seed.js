import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../src/db.js';

const USERS = [
  { username: 'admin',  password: 'admin123',  display_name: 'Admin User',      role: 'admin'  },
  { username: 'garden', password: 'garden123', display_name: 'Garden Incharge', role: 'garden' },
];

const DEFAULT_LOCATIONS = ['MARNUR', 'MFNUR', 'KJNUR', 'RAK 1', 'RAK 2', 'NZ 1', 'NZ 2', 'NZ 3'];

async function main() {
  await withTransaction(async c => {
    for (const u of USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await c.query(
        `INSERT INTO users (username, password_hash, display_name, role, created_by)
         VALUES ($1,$2,$3,$4,'System')
         ON CONFLICT (username) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               display_name  = EXCLUDED.display_name,
               role          = EXCLUDED.role`,
        [u.username, hash, u.display_name, u.role]
      );
    }
    console.log(`✓ Seeded ${USERS.length} users (admin/admin123, garden/garden123)`);

    for (const name of DEFAULT_LOCATIONS) {
      await c.query(
        `INSERT INTO locations (name, created_by)
         VALUES ($1,'Admin User')
         ON CONFLICT (name) DO NOTHING`,
        [name]
      );
    }
    console.log(`✓ Seeded ${DEFAULT_LOCATIONS.length} default locations`);

    await c.query(
      `INSERT INTO app_settings (key, value)
       VALUES ('number_settings', '{"gpPrefix":"GP-","gpNext":100001,"dnPrefix":"DO-","dnNext":100001}'::jsonb)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    );

    // GP-100001 — open (no DN)
    const gp1 = await c.query(
      `INSERT INTO gate_passes
         (no, do_no, do_date, lpo_no, lpo_date, pr_ref, so_ref,
          customer_name, customer_code, project, party, assigned_to, created_by)
       VALUES
         ('GP-100001','DO-2026-118','23-06-2026',null,null,null,null,
          'RYM - Project','PSE 20241022','','',ARRAY['garden'],'Admin User')
       ON CONFLICT (no) DO NOTHING RETURNING id`
    );
    if (gp1.rows[0]) {
      await c.query(
        `INSERT INTO gate_pass_lines
           (gp_id, sl_no, plant_code, plant_desc, pot_size, height, girth, qty, posted_qty, remaining_qty, location)
         VALUES ($1, 1, 'N-1', 'Ruellia ciliosa', '0.4', '30-40', '', 12, 0, 0, '')`,
        [gp1.rows[0].id]
      );
    }

    // GP-100002 — with completed DN DO-100001 + serials
    const gp2 = await c.query(
      `INSERT INTO gate_passes
         (no, do_no, do_date, lpo_no, lpo_date, pr_ref, so_ref,
          customer_name, customer_code, project, party, assigned_to, created_by)
       VALUES
         ('GP-100002','DO-2026-110','15-06-2026',null,null,null,null,
          'Opal Garden','PSE 20240915','','',ARRAY['garden'],'Admin User')
       ON CONFLICT (no) DO NOTHING RETURNING id`
    );
    if (gp2.rows[0]) {
      await c.query(
        `INSERT INTO gate_pass_lines
           (gp_id, sl_no, plant_code, plant_desc, pot_size, height, girth, qty, posted_qty, remaining_qty, location)
         VALUES
           ($1, 1, 'BG-12', 'Bougainvillea G. Pink', '11', '30-40', '', 8, 0, 0, ''),
           ($1, 2, 'DR-04', 'Duranta Golden',        '5',  '25-30', '', 4, 0, 0, '')`,
        [gp2.rows[0].id]
      );

      const dn = await c.query(
        `INSERT INTO delivery_notes
           (no, gp_id, gp_no, customer_project, customer_code, location, dn_date, vh_number, project, prepared_by, status)
         VALUES
           ('DO-100001',$1,'GP-100002','Opal Garden','PSE 20240915','NZ 3','16-06-2026','OM 4-21877','Opal Garden','Garden Incharge','completed')
         ON CONFLICT (no) DO NOTHING RETURNING id`,
        [gp2.rows[0].id]
      );
      if (dn.rows[0]) {
        await c.query(
          `UPDATE gate_passes SET delivery_note_id = $1 WHERE id = $2`,
          [dn.rows[0].id, gp2.rows[0].id]
        );
        const l1 = await c.query(
          `INSERT INTO delivery_note_lines
             (dn_id, sl_no, plant_name, plant_code, spec, qty, delivery_qty, posted_qty, remaining_qty, remarks, location, has_split, is_pending, do_ref)
           VALUES ($1,1,'Bougainvillea G. Pink','BG-12','11, H30-40',8,8,'8','0','','NZ 3',false,false,'')
           RETURNING id`,
          [dn.rows[0].id]
        );
        const l2 = await c.query(
          `INSERT INTO delivery_note_lines
             (dn_id, sl_no, plant_name, plant_code, spec, qty, delivery_qty, posted_qty, remaining_qty, remarks, location, has_split, is_pending, do_ref)
           VALUES ($1,2,'Duranta Golden','DR-04','5, H25-30',4,4,'4','0','','NZ 3',false,false,'')
           RETURNING id`,
          [dn.rows[0].id]
        );
        for (const code of ['AC-880142','AC-880143','AC-880144','AC-880145','AC-880146','AC-880147','AC-880148','AC-880149']) {
          await c.query(
            `INSERT INTO serials (dn_line_id, code, scanned_by) VALUES ($1,$2,'Garden Incharge')
             ON CONFLICT (dn_line_id, code) DO NOTHING`,
            [l1.rows[0].id, code]
          );
        }
        for (const code of ['AC-900311','AC-900312','AC-900313','AC-900314']) {
          await c.query(
            `INSERT INTO serials (dn_line_id, code, scanned_by) VALUES ($1,$2,'Garden Incharge')
             ON CONFLICT (dn_line_id, code) DO NOTHING`,
            [l2.rows[0].id, code]
          );
        }
        console.log('✓ Seeded GP-100001 (open) + GP-100002 with completed DO-100001 and 12 barcodes');
      }
    }

    // Next numbers after seeded docs
    await c.query(
      `UPDATE app_settings SET value = $1 WHERE key = 'number_settings'`,
      [JSON.stringify({ gpPrefix: 'GP-', gpNext: 100003, dnPrefix: 'DO-', dnNext: 100002 })]
    );
    console.log('✓ Number settings bumped to GP-100003 / DO-100002');
  });
  await pool.end();
}

main().catch(err => { console.error('Seed failed:', err.message); process.exit(1); });
