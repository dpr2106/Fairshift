import 'dotenv/config';
import { PostgresStore } from '../postgresStore.js';

async function verify() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is required for verification');
  }

  console.log('--- Verifying Real Neon PostgreSQL Persistence ---');
  const store = new PostgresStore(dbUrl);

  // 1. Read Users
  const users = await store.getUsers();
  console.log(`[Read] Successfully queried users from Neon. Count: ${users.length}`);
  if (users.length === 0) throw new Error('No users found in Neon database');

  // 2. Read Shifts
  const shifts = await store.getShifts();
  console.log(`[Read] Successfully queried shifts from Neon. Count: ${shifts.length}`);
  if (shifts.length === 0) throw new Error('No shifts found in Neon database');

  // 3. Perform a Real Write (Create Attendance Record)
  const testId = `att-test-${Date.now()}`;
  console.log(`[Write] Creating test attendance record in Neon: ${testId}`);
  const created = await store.createAttendance({
    id: testId,
    workerId: users[0].id,
    workerName: users[0].name,
    organizationId: users[0].organizationId,
    industry: users[0].industry,
    shiftId: shifts[0].id,
    shiftTitle: shifts[0].title,
    date: '2026-10-27',
    checkInTime: new Date().toISOString(),
    checkOutTime: null,
    regularHours: 8,
    overtimeHours: 0,
    status: 'pending',
    verificationMethod: 'qr',
    reviewNotes: 'Automated persistence verification record'
  });
  console.log('[Write] Attendance record inserted successfully into Neon.');

  // 4. Perform an Independent Read from Neon to confirm persistence
  console.log('[Read] Performing independent query to verify persistence...');
  const allAtt = await store.getAttendance();
  const found = allAtt.find(a => a.id === testId);
  if (!found) {
    throw new Error(`CRITICAL: Record ${testId} was not found on subsequent read!`);
  }
  console.log(`[Verified] Record ${testId} verified on Neon PostgreSQL!`);

  // 5. Clean up ONLY this specific test record
  console.log(`[Cleanup] Deleting test record ${testId}...`);
  await store.getPool().query('DELETE FROM attendance WHERE id = $1', [testId]);
  const verifyDelete = (await store.getAttendance()).find(a => a.id === testId);
  if (verifyDelete) {
    throw new Error('Cleanup failed');
  }
  console.log('[Cleanup] Test record cleanly removed. Database integrity preserved.');

  console.log('--- ALL REAL POSTGRESQL CRUD TESTS PASSED ON NEON ---');
  await store.getPool().end();
}

verify().catch(err => {
  console.error('PostgreSQL verification failed:', err);
  process.exit(1);
});
