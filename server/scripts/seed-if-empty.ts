import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import { getSeedData } from '../db.js';

if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

export async function seedIfEmpty() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;

  const pool = new Pool({ connectionString: dbUrl });
  const client = await pool.connect();

  try {
    const orgCheck = await client.query('SELECT count(*) FROM organizations');
    const orgCount = parseInt(orgCheck.rows[0].count, 10);

    if (orgCount > 0) {
      console.log(`[FairShift Seed] Neon database already contains ${orgCount} organization(s). Preserving existing data.`);
      return;
    }

    console.log('[FairShift Seed] Neon database is empty. Inserting initial seed demonstration data...');
    const seed = getSeedData();

    await client.query('BEGIN');

    // 1. Organizations
    for (const org of seed.organizations) {
      await client.query(
        `INSERT INTO organizations (id, name, industry, code, config) VALUES ($1, $2, $3, $4, $5)`,
        [org.id, org.name, org.industry, org.code, JSON.stringify(org.config)]
      );
    }

    // 2. Users
    for (const u of seed.users) {
      await client.query(
        `INSERT INTO users (id, name, email, phone, role, organization_id, industry, designation, hourly_rate, overtime_rate_multiplier)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [u.id, u.name, u.email, u.phone, u.role, u.organizationId, u.industry, u.designation, u.hourlyRate, u.overtimeRateMultiplier]
      );
    }

    // 3. Shifts
    for (const s of seed.shifts) {
      await client.query(
        `INSERT INTO shifts (id, organization_id, industry, title, start_time, end_time, duration_hours, is_overnight, required_role, site_location, qr_code_token)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [s.id, s.organizationId, s.industry, s.title, s.startTime, s.endTime, s.durationHours, s.isOvernight, s.requiredRole, s.siteLocation, s.qrCodeToken]
      );
    }

    // 4. Attendance
    for (const a of seed.attendance) {
      await client.query(
        `INSERT INTO attendance (id, worker_id, worker_name, organization_id, industry, shift_id, shift_title, date, check_in_time, check_out_time, regular_hours, overtime_hours, status, verification_method, review_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [a.id, a.workerId, a.workerName, a.organizationId, a.industry, a.shiftId, a.shiftTitle, a.date, a.checkInTime, a.checkOutTime, a.regularHours, a.overtimeHours, a.status, a.verificationMethod, a.reviewNotes || null]
      );
    }

    // 5. Payslips
    for (const p of seed.payslips) {
      await client.query(
        `INSERT INTO payslips (id, worker_id, worker_name, organization_id, industry, period_start, period_end, regular_hours, overtime_hours, regular_rate, overtime_rate, gross_pay, total_deductions, net_pay, currency, status, line_items)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [p.id, p.workerId, p.workerName, p.organizationId, p.industry, p.periodStart, p.periodEnd, p.regularHours, p.overtimeHours, p.regularRate, p.overtimeRate, p.grossPay, p.totalDeductions, p.netPay, p.currency, p.status, JSON.stringify(p.lineItems)]
      );
    }

    // 6. Safety Reports
    for (const sr of seed.safetyReports) {
      await client.query(
        `INSERT INTO safety_reports (id, reference_code, organization_id, industry, category, severity, description, location, reporter_mode, worker_id, reporter_display_name, has_photo, photo_data_url, status, assigned_person, resolution_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [sr.id, sr.referenceCode, sr.organizationId, sr.industry, sr.category, sr.severity, sr.description, sr.location, sr.reporterMode, sr.workerId || null, sr.reporterDisplayName || null, sr.hasPhoto, sr.photoDataUrl || null, sr.status, sr.assignedPerson || null, sr.resolutionNotes || null]
      );
    }

    // 7. Feedback
    for (const f of seed.feedback) {
      await client.query(
        `INSERT INTO workplace_feedback (id, organization_id, industry, category, mode, sentiment, comment)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [f.id, f.organizationId, f.industry, f.category, f.mode, f.sentiment, f.comment]
      );
    }

    // 8. Fatigue Alerts
    for (const fa of seed.fatigueAlerts) {
      await client.query(
        `INSERT INTO fatigue_alerts (id, worker_id, worker_name, organization_id, industry, trigger_type, metric_value, explanation, severity, status, reviewed_by, review_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [fa.id, fa.workerId, fa.workerName, fa.organizationId, fa.industry, fa.triggerType, fa.metricValue, fa.explanation, fa.severity, fa.status, fa.reviewedBy || null, fa.reviewNotes || null]
      );
    }

    // 9. Skills
    for (const sk of seed.skills) {
      await client.query(
        `INSERT INTO skills (id, worker_id, skill_title, category, years_experience, is_verified, verifier_name, verifier_designation, verified_at, certificate_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [sk.id, sk.workerId, sk.skillTitle, sk.category, sk.yearsExperience, sk.isVerified, sk.verifierName || null, sk.verifierDesignation || null, sk.verifiedAt || null, sk.certificateRef || null]
      );
    }

    await client.query('COMMIT');
    console.log('[FairShift Seed] Initial demonstration seed data successfully inserted into Neon PostgreSQL.');
  } catch (err: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[FairShift Seed] Failed to seed Neon database:', err.message);
  } finally {
    client.release();
    await pool.end().catch(() => {});
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-if-empty.ts')) {
  seedIfEmpty().catch(console.error);
}
