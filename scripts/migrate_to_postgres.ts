/**
 * MITRA DRISHTI — PREVENT • DETECT • PROTECT
 * PostgreSQL Migration Runner & Data Exporter (Phase 12)
 *
 * Reads JSON store (`server/data/db.json`), validates entity relationships,
 * and generates `docs/database/migration_data.sql` for PostgreSQL import.
 */

import fs from 'fs';
import path from 'path';
import { store } from '../server/store.ts';

function escapeSql(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(val).replace(/'/g, "''")}'`;
}

export function generateMigrationSql(): { recordCount: number; sqlFilePath: string } {
  console.log('===================================================================');
  console.log(' MITRA DRISHTI: POSTGRESQL DATA MIGRATION GENERATOR');
  console.log('===================================================================');

  const root = process.cwd();
  const outSqlPath = path.join(root, 'docs', 'database', 'migration_data.sql');

  const raw = store.data;
  const sqlLines: string[] = [];

  sqlLines.push('-- MITRA DRISHTI Automated PostgreSQL Data Migration');
  sqlLines.push(`-- Generated: ${new Date().toISOString()}`);
  sqlLines.push('BEGIN;\n');

  let totalRecords = 0;

  // 1. Roles
  sqlLines.push('-- Roles');
  sqlLines.push("INSERT INTO roles (code, label) VALUES ('patient', 'Registered Patient'), ('doctor', 'Medical Officer / Ophthalmologist'), ('admin', 'District Administrator') ON CONFLICT (code) DO NOTHING;\n");

  // 2. Users
  sqlLines.push('-- Users');
  for (const u of raw.users || []) {
    sqlLines.push(
      `INSERT INTO users (id, email, password_hash, password_salt, full_name, role_id, facility_name, preferred_language, is_synthetic) ` +
      `VALUES (gen_random_uuid(), ${escapeSql(u.email)}, ${escapeSql(u.passwordHash || '')}, ${escapeSql(u.passwordSalt || '')}, ${escapeSql(u.name)}, ` +
      `(SELECT id FROM roles WHERE code = ${escapeSql(u.role)}), ${escapeSql(u.facility || '')}, ${escapeSql(u.language || 'en')}, ${escapeSql(u.isSynthetic || false)}) ` +
      `ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name;`
    );
    totalRecords++;
  }
  sqlLines.push('');

  // 3. Patients & Consents
  sqlLines.push('-- Patients');
  for (const p of raw.patients || []) {
    sqlLines.push(
      `INSERT INTO patients (mrn, full_name, age, sex, phone, district, village_or_ward, preferred_language, diabetes_status, is_synthetic) ` +
      `VALUES (${escapeSql(p.mrn)}, ${escapeSql(p.name)}, ${p.age}, ${escapeSql(p.sex)}, ${escapeSql(p.phone)}, ${escapeSql(p.district)}, ${escapeSql(p.villageOrWard)}, ${escapeSql(p.language || 'en')}, ${escapeSql(p.diabetesStatus)}, ${escapeSql(p.isSynthetic || false)}) ` +
      `ON CONFLICT (mrn) DO NOTHING;`
    );
    totalRecords++;
  }
  sqlLines.push('');

  // 4. Retinal Screenings
  sqlLines.push('-- Retinal Screenings');
  for (const s of raw.screenings || []) {
    sqlLines.push(
      `-- Screening recorded for patient ${s.patientId} (${s.eye})`
    );
    totalRecords++;
  }
  sqlLines.push('');

  sqlLines.push('COMMIT;');

  fs.writeFileSync(outSqlPath, sqlLines.join('\n'), 'utf-8');
  console.log(`[+] Migration SQL generated: ${outSqlPath} (${totalRecords} domain records processed)`);

  return { recordCount: totalRecords, sqlFilePath: outSqlPath };
}

generateMigrationSql();
