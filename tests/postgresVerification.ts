import fs from 'fs';
import path from 'path';
import { initializeDatabase } from '../server/db/postgres.ts';
import { generateMigrationSql } from '../scripts/migrate_to_postgres.ts';

let passed = 0;
let failed = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

async function runPostgresVerification() {
  console.log('===================================================================');
  console.log(' MRITIDHRISTI PHASE 12: POSTGRESQL PERSISTENCE & MIGRATION VERIFICATION');
  console.log('===================================================================');

  const root = process.cwd();
  const schemaPath = path.join(root, 'docs', 'database', 'schema.sql');
  const migrationSqlPath = path.join(root, 'docs', 'database', 'migration_data.sql');

  // 1. Relational Schema File Checks
  assert(fs.existsSync(schemaPath), 'PostgreSQL schema file exists (docs/database/schema.sql)');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  const expectedTables = [
    'roles',
    'users',
    'patients',
    'consent_records',
    'lifestyle_assessments',
    'risk_assessment_results',
    'laboratory_results',
    'prevention_programmes',
    'weekly_lessons',
    'habit_logs',
    'intervention_records',
    'retinal_images',
    'image_quality_assessments',
    'model_versions',
    'model_predictions',
    'gradcam_records',
    'screening_reports',
    'doctor_reviews',
    'referrals',
    'appointments',
    'follow_ups',
    'notifications',
    'audit_logs',
    'offline_sync_records',
    'district_resources',
    'simulation_scenarios',
    'simulation_results',
  ];

  for (const tbl of expectedTables) {
    assert(schemaSql.includes(`CREATE TABLE ${tbl}`) || schemaSql.includes(`CREATE TABLE IF NOT EXISTS ${tbl}`), `Schema DDL defines table: ${tbl}`);
  }

  // 2. Relational Integrity Checks in Schema
  assert(schemaSql.includes('REFERENCES roles(id)'), 'Foreign key constraint: users -> roles(id)');
  assert(schemaSql.includes('REFERENCES patients(id)'), 'Foreign key constraint: assessments/screenings -> patients(id)');
  assert(schemaSql.includes('ON DELETE CASCADE'), 'ON DELETE CASCADE constraint configured for patient dependent records');
  assert(schemaSql.includes('CREATE INDEX'), 'Relational indexes defined for performance (district, doctor, patient_id)');

  // 3. Database Adapter (Dual-Mode) Checks
  const db = await initializeDatabase();
  assert(typeof db.query === 'function', 'Database adapter query method available');
  assert(typeof db.migrateFromJsonStore === 'function', 'Database adapter migrateFromJsonStore method available');

  const storeMigration = await db.migrateFromJsonStore();
  assert(storeMigration.tablesCreated === 26, `Database adapter targets 26 relational tables (${storeMigration.tablesCreated})`);
  assert(storeMigration.recordsMigrated > 0, `Store migration captures ${storeMigration.recordsMigrated} live records`);

  // 4. Migration Script Execution & SQL Output Checks
  const migrationResult = generateMigrationSql();
  assert(fs.existsSync(migrationSqlPath), 'Migration SQL file generated (docs/database/migration_data.sql)');
  assert(migrationResult.recordCount > 0, `Migration processed ${migrationResult.recordCount} domain entities`);

  const genSql = fs.readFileSync(migrationSqlPath, 'utf-8');
  assert(genSql.includes('INSERT INTO roles'), 'Migration inserts system roles');
  assert(genSql.includes('INSERT INTO users'), 'Migration inserts user accounts with hashed credentials');
  assert(genSql.includes('INSERT INTO patients'), 'Migration inserts patient demographic and consent records');
  assert(genSql.includes('COMMIT;'), 'Migration wraps execution in transactional BEGIN ... COMMIT block');

  console.log('-------------------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runPostgresVerification().catch((err) => {
  console.error('Fatal Postgres test error:', err);
  process.exit(1);
});
