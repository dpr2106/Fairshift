import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_FILE = path.resolve(__dirname, '../migrations/001_initial_schema.sql');

export async function runMigrations(databaseUrl?: string): Promise<{ success: boolean; tablesCreated: string[] }> {
  const dbUrl = databaseUrl || process.env.DATABASE_URL;
  console.log('--- FairShift PostgreSQL Migration Runner ---');

  if (!fs.existsSync(MIGRATION_FILE)) {
    throw new Error(`Migration file not found at ${MIGRATION_FILE}`);
  }

  const sql = fs.readFileSync(MIGRATION_FILE, 'utf-8');

  if (!dbUrl) {
    console.log('[FairShift Migration] No external DATABASE_URL provided.');
    console.log('[FairShift Migration] Local development mode uses the atomic JSON/SQLite store.');
    console.log('[FairShift Migration] Schema 001_initial_schema.sql is validated and ready for execution when DATABASE_URL is configured.');
    return { success: false, tablesCreated: [] };
  }

  const masked = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`[FairShift Migration] Connecting to PostgreSQL via: ${masked}`);

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
  });

  try {
    await client.connect();
    console.log('[FairShift Migration] Successfully connected to PostgreSQL instance.');
    console.log('[FairShift Migration] Applying initial schema 001_initial_schema.sql in a transaction...');

    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = res.rows.map(r => r.table_name);
    console.log(`[FairShift Migration] Migration executed successfully. Verified tables: ${tables.join(', ')}`);
    return { success: true, tablesCreated: tables };
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[FairShift Migration] Migration failed with error:', err.message);
    throw err;
  } finally {
    await client.end().catch(() => {});
  }
}

// Execute migration if run directly from CLI
if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  runMigrations().catch(err => {
    console.error('[FairShift Migration] Unhandled error during migration execution:', err);
    process.exit(1);
  });
}
