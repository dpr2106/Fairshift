import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool, neonConfig, neon } from '@neondatabase/serverless';
import ws from 'ws';

// Support WebSockets in Node.js runtime over Port 443
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_FILE = path.resolve(__dirname, '../migrations/001_initial_schema.sql');

export async function runMigrations(databaseUrl?: string): Promise<{ success: boolean; tablesCreated: string[] }> {
  const dbUrl = databaseUrl || process.env.DATABASE_URL;
  console.log('--- FairShift PostgreSQL Migration Runner ---');

  if (!fs.existsSync(MIGRATION_FILE)) {
    throw new Error(`Migration file not found at ${MIGRATION_FILE}`);
  }

  const sqlContent = fs.readFileSync(MIGRATION_FILE, 'utf-8');

  if (!dbUrl) {
    console.log('[FairShift Migration] No external DATABASE_URL provided.');
    console.log('[FairShift Migration] Local development mode uses the atomic JSON/SQLite store.');
    return { success: false, tablesCreated: [] };
  }

  const masked = dbUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`[FairShift Migration] Connecting to Neon PostgreSQL via HTTPS/WSS (Port 443): ${masked}`);

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    console.log('[FairShift Migration] Successfully connected to Neon PostgreSQL.');
    console.log('[FairShift Migration] Applying schema 001_initial_schema.sql...');

    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');

    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = res.rows.map((r: any) => r.table_name);
    console.log(`[FairShift Migration] Migration succeeded! Verified tables in Neon: ${tables.join(', ')}`);
    return { success: true, tablesCreated: tables };
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[FairShift Migration] Migration execution failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

// Execute migration if run directly from CLI
if (process.argv[1] && (process.argv[1].endsWith('migrate.ts') || process.argv[1].endsWith('migrate.js'))) {
  runMigrations().catch(err => {
    console.error('[FairShift Migration] Fatal error:', err);
    process.exit(1);
  });
}
