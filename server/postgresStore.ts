import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import {
  Organization,
  User,
  Shift,
  AttendanceRecord,
  Payslip,
  SafetyReport,
  WorkplaceFeedback,
  FatigueAlert,
  SkillPassportItem
} from './types.js';

if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

export class PostgresStore {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  public getPool(): Pool {
    return this.pool;
  }

  // 1. Organizations
  async getOrganizations(): Promise<Organization[]> {
    const res = await this.pool.query('SELECT id, name, industry, code, config FROM organizations ORDER BY name');
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      industry: r.industry,
      code: r.code,
      config: typeof r.config === 'string' ? JSON.parse(r.config) : r.config
    }));
  }

  // 2. Users
  async getUsers(): Promise<User[]> {
    const res = await this.pool.query(`
      SELECT id, name, email, phone, role, organization_id, industry, designation, hourly_rate, overtime_rate_multiplier
      FROM users ORDER BY name
    `);
    return res.rows.map(r => ({
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      role: r.role,
      organizationId: r.organization_id,
      industry: r.industry,
      designation: r.designation,
      hourlyRate: parseFloat(r.hourly_rate),
      overtimeRateMultiplier: parseFloat(r.overtime_rate_multiplier)
    }));
  }

  async getUserById(id: string): Promise<User | null> {
    const res = await this.pool.query(`
      SELECT id, name, email, phone, role, organization_id, industry, designation, hourly_rate, overtime_rate_multiplier
      FROM users WHERE id = $1
    `, [id]);
    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      phone: r.phone,
      role: r.role,
      organizationId: r.organization_id,
      industry: r.industry,
      designation: r.designation,
      hourlyRate: parseFloat(r.hourly_rate),
      overtimeRateMultiplier: parseFloat(r.overtime_rate_multiplier)
    };
  }

  // 3. Shifts
  async getShifts(): Promise<Shift[]> {
    const res = await this.pool.query(`
      SELECT id, organization_id, industry, title, start_time, end_time, duration_hours, is_overnight, required_role, site_location, qr_code_token
      FROM shifts ORDER BY id DESC
    `);
    return res.rows.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      industry: r.industry,
      title: r.title,
      startTime: r.start_time,
      endTime: r.end_time,
      durationHours: parseFloat(r.duration_hours),
      isOvernight: Boolean(r.is_overnight),
      requiredRole: r.required_role,
      siteLocation: r.site_location,
      qrCodeToken: r.qr_code_token
    }));
  }

  async createShift(s: Shift): Promise<Shift> {
    await this.pool.query(`
      INSERT INTO shifts (id, organization_id, industry, title, start_time, end_time, duration_hours, is_overnight, required_role, site_location, qr_code_token)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [s.id, s.organizationId, s.industry, s.title, s.startTime, s.endTime, s.durationHours, s.isOvernight, s.requiredRole, s.siteLocation, s.qrCodeToken]);
    return s;
  }

  // 4. Attendance
  async getAttendance(): Promise<AttendanceRecord[]> {
    const res = await this.pool.query(`
      SELECT id, worker_id, worker_name, organization_id, industry, shift_id, shift_title, date, check_in_time, check_out_time, regular_hours, overtime_hours, status, verification_method, review_notes
      FROM attendance ORDER BY check_in_time DESC
    `);
    return res.rows.map(r => ({
      id: r.id,
      workerId: r.worker_id,
      workerName: r.worker_name,
      organizationId: r.organization_id,
      industry: r.industry,
      shiftId: r.shift_id,
      shiftTitle: r.shift_title,
      date: typeof r.date === 'string' ? r.date.split('T')[0] : (r.date?.toISOString ? r.date.toISOString().split('T')[0] : String(r.date)),
      checkInTime: r.check_in_time?.toISOString ? r.check_in_time.toISOString() : String(r.check_in_time),
      checkOutTime: r.check_out_time ? (r.check_out_time.toISOString ? r.check_out_time.toISOString() : String(r.check_out_time)) : undefined,
      regularHours: parseFloat(r.regular_hours || 0),
      overtimeHours: parseFloat(r.overtime_hours || 0),
      status: r.status,
      verificationMethod: r.verification_method,
      reviewNotes: r.review_notes || undefined
    }));
  }

  async createAttendance(a: AttendanceRecord): Promise<AttendanceRecord> {
    await this.pool.query(`
      INSERT INTO attendance (id, worker_id, worker_name, organization_id, industry, shift_id, shift_title, date, check_in_time, check_out_time, regular_hours, overtime_hours, status, verification_method, review_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [a.id, a.workerId, a.workerName, a.organizationId, a.industry, a.shiftId, a.shiftTitle, a.date, a.checkInTime, a.checkOutTime || null, a.regularHours, a.overtimeHours, a.status, a.verificationMethod, a.reviewNotes || null]);
    return a;
  }

  async updateAttendance(id: string, updates: Partial<AttendanceRecord>): Promise<AttendanceRecord | null> {
    const current = (await this.getAttendance()).find(a => a.id === id);
    if (!current) return null;
    const merged = { ...current, ...updates };
    await this.pool.query(`
      UPDATE attendance
      SET check_out_time = $1, regular_hours = $2, overtime_hours = $3, status = $4, review_notes = $5
      WHERE id = $6
    `, [merged.checkOutTime || null, merged.regularHours, merged.overtimeHours, merged.status, merged.reviewNotes || null, id]);
    return merged;
  }

  // 5. Payslips
  async getPayslips(): Promise<Payslip[]> {
    const res = await this.pool.query(`
      SELECT id, worker_id, worker_name, organization_id, industry, period_start, period_end, regular_hours, overtime_hours, regular_rate, overtime_rate, gross_pay, total_deductions, net_pay, currency, status, line_items, generated_at
      FROM payslips ORDER BY period_end DESC
    `);
    return res.rows.map(r => ({
      id: r.id,
      workerId: r.worker_id,
      workerName: r.worker_name,
      organizationId: r.organization_id,
      industry: r.industry,
      periodStart: typeof r.period_start === 'string' ? r.period_start.split('T')[0] : (r.period_start?.toISOString ? r.period_start.toISOString().split('T')[0] : String(r.period_start)),
      periodEnd: typeof r.period_end === 'string' ? r.period_end.split('T')[0] : (r.period_end?.toISOString ? r.period_end.toISOString().split('T')[0] : String(r.period_end)),
      regularHours: parseFloat(r.regular_hours || 0),
      overtimeHours: parseFloat(r.overtime_hours || 0),
      regularRate: parseFloat(r.regular_rate),
      overtimeRate: parseFloat(r.overtime_rate),
      grossPay: parseFloat(r.gross_pay),
      totalDeductions: parseFloat(r.total_deductions || 0),
      netPay: parseFloat(r.net_pay),
      currency: r.currency,
      status: r.status,
      lineItems: typeof r.line_items === 'string' ? JSON.parse(r.line_items) : r.line_items,
      generatedAt: r.generated_at?.toISOString ? r.generated_at.toISOString() : String(r.generated_at)
    }));
  }

  async createPayslip(p: Payslip): Promise<Payslip> {
    await this.pool.query(`
      INSERT INTO payslips (id, worker_id, worker_name, organization_id, industry, period_start, period_end, regular_hours, overtime_hours, regular_rate, overtime_rate, gross_pay, total_deductions, net_pay, currency, status, line_items)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    `, [p.id, p.workerId, p.workerName, p.organizationId, p.industry, p.periodStart, p.periodEnd, p.regularHours, p.overtimeHours, p.regularRate, p.overtimeRate, p.grossPay, p.totalDeductions, p.netPay, p.currency, p.status, JSON.stringify(p.lineItems)]);
    return p;
  }

  // 6. Safety Reports
  async getSafetyReports(): Promise<SafetyReport[]> {
    const res = await this.pool.query(`
      SELECT id, reference_code, organization_id, industry, category, severity, description, location, reporter_mode, worker_id, reporter_display_name, has_photo, photo_data_url, status, assigned_person, resolution_notes, created_at, updated_at
      FROM safety_reports ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      id: r.id,
      referenceCode: r.reference_code,
      organizationId: r.organization_id,
      industry: r.industry,
      category: r.category,
      severity: r.severity,
      description: r.description,
      location: r.location,
      reporterMode: r.reporter_mode,
      workerId: r.worker_id || undefined,
      reporterDisplayName: r.reporter_display_name || undefined,
      hasPhoto: Boolean(r.has_photo),
      photoDataUrl: r.photo_data_url || undefined,
      status: r.status,
      assignedPerson: r.assigned_person || undefined,
      resolutionNotes: r.resolution_notes || undefined,
      createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : String(r.created_at),
      updatedAt: r.updated_at?.toISOString ? r.updated_at.toISOString() : (r.created_at?.toISOString ? r.created_at.toISOString() : String(r.updated_at || r.created_at))
    }));
  }

  async createSafetyReport(s: SafetyReport): Promise<SafetyReport> {
    await this.pool.query(`
      INSERT INTO safety_reports (id, reference_code, organization_id, industry, category, severity, description, location, reporter_mode, worker_id, reporter_display_name, has_photo, photo_data_url, status, assigned_person, resolution_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    `, [s.id, s.referenceCode, s.organizationId, s.industry, s.category, s.severity, s.description, s.location, s.reporterMode, s.workerId || null, s.reporterDisplayName || null, s.hasPhoto, s.photoDataUrl || null, s.status, s.assignedPerson || null, s.resolutionNotes || null]);
    return s;
  }

  async updateSafetyReportStatus(id: string, status: string, assignedPerson?: string, resolutionNotes?: string): Promise<SafetyReport | null> {
    await this.pool.query(`
      UPDATE safety_reports
      SET status = $1, assigned_person = COALESCE($2, assigned_person), resolution_notes = COALESCE($3, resolution_notes), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [status, assignedPerson || null, resolutionNotes || null, id]);
    const reports = await this.getSafetyReports();
    return reports.find(r => r.id === id) || null;
  }

  // 7. Workplace Feedback (Strict identity decoupling)
  async getFeedback(): Promise<WorkplaceFeedback[]> {
    const res = await this.pool.query(`
      SELECT id, organization_id, industry, category, mode, sentiment, comment, created_at
      FROM workplace_feedback ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      id: r.id,
      organizationId: r.organization_id,
      industry: r.industry,
      category: r.category,
      mode: r.mode,
      sentiment: r.sentiment,
      comment: r.comment,
      createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : String(r.created_at)
    }));
  }

  async createFeedback(f: WorkplaceFeedback): Promise<WorkplaceFeedback> {
    await this.pool.query(`
      INSERT INTO workplace_feedback (id, organization_id, industry, category, mode, sentiment, comment)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [f.id, f.organizationId, f.industry, f.category, f.mode, f.sentiment, f.comment]);
    return f;
  }

  // 8. Fatigue Alerts
  async getFatigueAlerts(): Promise<FatigueAlert[]> {
    const res = await this.pool.query(`
      SELECT id, worker_id, worker_name, organization_id, industry, trigger_type, metric_value, explanation, severity, status, reviewed_by, review_notes, created_at
      FROM fatigue_alerts ORDER BY created_at DESC
    `);
    return res.rows.map(r => ({
      id: r.id,
      workerId: r.worker_id,
      workerName: r.worker_name,
      organizationId: r.organization_id,
      industry: r.industry,
      triggerType: r.trigger_type,
      metricValue: r.metric_value,
      explanation: r.explanation,
      severity: r.severity,
      status: r.status,
      reviewedBy: r.reviewed_by || undefined,
      reviewNotes: r.review_notes || undefined,
      createdAt: r.created_at?.toISOString ? r.created_at.toISOString() : String(r.created_at)
    }));
  }

  async createFatigueAlert(fa: FatigueAlert): Promise<FatigueAlert> {
    await this.pool.query(`
      INSERT INTO fatigue_alerts (id, worker_id, worker_name, organization_id, industry, trigger_type, metric_value, explanation, severity, status, reviewed_by, review_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [fa.id, fa.workerId, fa.workerName, fa.organizationId, fa.industry, fa.triggerType, fa.metricValue, fa.explanation, fa.severity, fa.status, fa.reviewedBy || null, fa.reviewNotes || null]);
    return fa;
  }

  async resolveFatigueAlert(id: string, reviewedBy: string, reviewNotes?: string): Promise<FatigueAlert | null> {
    await this.pool.query(`
      UPDATE fatigue_alerts
      SET status = 'reviewed', reviewed_by = $1, review_notes = $2
      WHERE id = $3
    `, [reviewedBy, reviewNotes || 'Fatigue risk reviewed and compensatory rest acknowledged.', id]);
    const alerts = await this.getFatigueAlerts();
    return alerts.find(a => a.id === id) || null;
  }

  // 9. Skills
  async getSkills(): Promise<SkillPassportItem[]> {
    const res = await this.pool.query(`
      SELECT id, worker_id, skill_title, category, years_experience, is_verified, verifier_name, verifier_designation, verified_at, certificate_ref
      FROM skills ORDER BY id DESC
    `);
    return res.rows.map(r => ({
      id: r.id,
      workerId: r.worker_id,
      skillTitle: r.skill_title,
      category: r.category,
      yearsExperience: r.years_experience,
      isVerified: Boolean(r.is_verified),
      verifierName: r.verifier_name || undefined,
      verifierDesignation: r.verifier_designation || undefined,
      verifiedAt: r.verified_at ? (typeof r.verified_at === 'string' ? r.verified_at.split('T')[0] : r.verified_at.toISOString().split('T')[0]) : undefined,
      certificateRef: r.certificate_ref || undefined
    }));
  }

  async createSkill(sk: SkillPassportItem): Promise<SkillPassportItem> {
    await this.pool.query(`
      INSERT INTO skills (id, worker_id, skill_title, category, years_experience, is_verified, verifier_name, verifier_designation, verified_at, certificate_ref)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [sk.id, sk.workerId, sk.skillTitle, sk.category, sk.yearsExperience, sk.isVerified, sk.verifierName || null, sk.verifierDesignation || null, sk.verifiedAt || null, sk.certificateRef || null]);
    return sk;
  }

  async verifySkill(id: string, verifierName: string, verifierDesignation: string, certificateRef?: string): Promise<SkillPassportItem | null> {
    const verifiedAt = new Date().toISOString().split('T')[0];
    await this.pool.query(`
      UPDATE skills
      SET is_verified = TRUE, verifier_name = $1, verifier_designation = $2, verified_at = $3, certificate_ref = COALESCE($4, certificate_ref)
      WHERE id = $5
    `, [verifierName, verifierDesignation, verifiedAt, certificateRef || null, id]);
    const skills = await this.getSkills();
    return skills.find(s => s.id === id) || null;
  }
}
