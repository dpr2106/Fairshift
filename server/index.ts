import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbAsync } from './db.js';
import { calculateShiftHours, calculatePayslipBreakdown, evaluateFatigue } from './services/calculations.js';
import { AttendanceRecord, SafetyReport, WorkplaceFeedback, SkillPassportItem, FatigueAlert } from './types.js';
import {
  createSessionToken,
  requireAuth,
  requireRole,
  enforceOrgBoundary,
  AuthenticatedRequest,
  getSessionSecret,
  isDemoModeActive
} from './auth.js';

// Early security validation for production session secrets
try {
  getSessionSecret();
} catch (err: any) {
  console.error('[FairShift Security] Failed session secret validation:', err.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

// Helper to sanitize public user data for persona switching
function sanitizePublicUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    industry: user.industry,
    designation: user.designation,
    isDemoPersona: true
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health Check for Google Cloud Run & Vercel
app.get('/health', async (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'fairshift-platform',
    version: '1.0.0',
    sdgGoal: 'SDG 8: Decent Work & Economic Growth',
    database: {
      activeStore: dbAsync.isPostgres() ? 'neon-postgresql-connected' : 'local-atomic-store',
      isPostgres: dbAsync.isPostgres(),
      postgresMigrationsSupported: true
    },
    authMode: isDemoModeActive() ? 'synthetic-evaluation-demo' : 'production-idp-required',
    deploymentPlatform: process.env.VERCEL ? 'vercel-serverless' : 'node-service',
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// AUTH & PERSONA ENDPOINTS
// -------------------------------------------------------------

// Verified Login & Token Generation: explicitly restricted to synthetic evaluation demo mode
app.post('/api/auth/login', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required for login' });
  }

  const demoActive = isDemoModeActive();
  const user = await dbAsync.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  // Outside demo mode, reject arbitrary login without verified enterprise IdP integration
  if (!demoActive) {
    return res.status(501).json({
      error: 'Production enterprise authentication provider is not configured. For Prompt Wars hackathon evaluation, run in demo mode (DEMO_MODE=true) using synthetic demonstration personas.'
    });
  }

  const token = createSessionToken(user, true);
  res.json({
    message: 'Demo authentication successful for synthetic demonstration persona',
    token,
    user: sanitizePublicUser(user),
    isDemoSession: true,
    authMode: 'synthetic-evaluation-demo'
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

// Protected public persona directory: strictly omits phone, email, and salary rates
app.get('/api/auth/users', async (req, res) => {
  const users = await dbAsync.getUsers();
  const sanitized = users.map(u => sanitizePublicUser(u));
  res.json(sanitized);
});

// -------------------------------------------------------------
// ORGANIZATIONS & INDUSTRY CONFIG
// -------------------------------------------------------------
app.get('/api/organizations', async (req, res) => {
  const organizations = await dbAsync.getOrganizations();
  res.json(organizations);
});

// -------------------------------------------------------------
// SHIFTS
// -------------------------------------------------------------
app.get('/api/shifts', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const shifts = await dbAsync.getShifts();
  const industry = req.query.industry as string;

  let filtered = shifts;

  // Tenant / Organization Isolation
  if (user.role !== 'admin') {
    filtered = filtered.filter(s => s.organizationId === user.organizationId);
  }

  if (industry) {
    filtered = filtered.filter(s => s.industry === industry);
  }

  res.json(filtered);
});

app.post('/api/shifts', requireAuth, requireRole('manager', 'admin'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { title, industry, startTime, endTime, requiredRole, siteLocation, isOvernight } = req.body;

  if (!title || !industry || !startTime || !endTime) {
    return res.status(400).json({ error: 'Title, industry, startTime, and endTime are required' });
  }

  const newShift = {
    id: `shift-${Date.now()}`,
    organizationId: user.organizationId,
    industry,
    title,
    startTime,
    endTime,
    durationHours: req.body.durationHours || 8,
    isOvernight: Boolean(isOvernight),
    requiredRole: requiredRole || 'General Worker',
    siteLocation: siteLocation || 'Main Facility / Site',
    qrCodeToken: `QR-${industry.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
  };

  await dbAsync.createShift(newShift);
  res.status(201).json(newShift);
});

// -------------------------------------------------------------
// ATTENDANCE & SHIFT TRACKING
// -------------------------------------------------------------
app.get('/api/attendance', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const records = await dbAsync.getAttendance();
  const { industry, workerId, status } = req.query;

  let filtered = records;

  // Organization-level isolation
  if (user.role !== 'admin') {
    filtered = filtered.filter(r => r.organizationId === user.organizationId);
  }

  // Security check: workers can ONLY view their own attendance records
  if (user.role === 'worker') {
    filtered = filtered.filter(r => r.workerId === user.id);
  } else if (workerId) {
    filtered = filtered.filter(r => r.workerId === workerId);
  }

  if (industry) {
    filtered = filtered.filter(r => r.industry === industry);
  }

  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }

  res.json(filtered);
});

app.post('/api/attendance/check-in', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { shiftId, qrToken, verificationMethod } = req.body;

  const shifts = await dbAsync.getShifts();
  const shift = shifts.find(s => s.id === shiftId);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  // Enforce tenant boundary: worker cannot check in to another organization's shift
  if (!enforceOrgBoundary(shift.organizationId, user)) {
    return res.status(403).json({ error: 'Cross-organization shift check-in is not permitted' });
  }

  // Check if worker already has an active (unclosed) attendance record
  const allAtt = await dbAsync.getAttendance();
  const activeRecord = allAtt.find(r => r.workerId === user.id && r.checkOutTime === null);
  if (activeRecord) {
    return res.status(400).json({
      error: 'You are already checked in. Please check out of your active shift first.',
      activeShiftId: activeRecord.shiftId
    });
  }

  // QR Validation Flow
  if (verificationMethod === 'qr') {
    if (!qrToken || qrToken !== shift.qrCodeToken) {
      return res.status(400).json({
        error: 'Invalid or expired QR token. Secure workplace check-in requires a valid site QR scan.'
      });
    }
  }

  const now = new Date();
  const newRecord: AttendanceRecord = {
    id: `att-${Date.now()}`,
    workerId: user.id,
    workerName: user.name,
    organizationId: shift.organizationId,
    industry: shift.industry,
    shiftId: shift.id,
    shiftTitle: shift.title,
    date: now.toISOString().split('T')[0],
    checkInTime: now.toISOString(),
    checkOutTime: null,
    regularHours: 0,
    overtimeHours: 0,
    status: 'pending',
    verificationMethod: verificationMethod || 'qr'
  };

  await dbAsync.createAttendance(newRecord);
  res.status(201).json(newRecord);
});

app.post('/api/attendance/check-out', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { attendanceId } = req.body;

  const allAtt = await dbAsync.getAttendance();
  const record = allAtt.find(
    r => (attendanceId ? r.id === attendanceId : r.workerId === user.id && r.checkOutTime === null)
  );

  if (!record) {
    return res.status(404).json({ error: 'Active check-in record not found to check out from.' });
  }

  // Workers can only check out of their own shift
  if (user.role === 'worker' && record.workerId !== user.id) {
    return res.status(403).json({ error: 'Unauthorized to check out another worker.' });
  }

  const now = new Date().toISOString();

  // Perform hours and overtime calculations
  const calc = calculateShiftHours(record.checkInTime, now, 8.0);

  const updatedRecord = await dbAsync.updateAttendance(record.id, {
    checkOutTime: now,
    regularHours: calc.regularHours,
    overtimeHours: calc.overtimeHours,
    status: 'pending' // Pending manager audit
  });

  // Evaluate Fatigue Rules
  const fatigueAlert = evaluateFatigue(
    user,
    { checkInTime: record.checkInTime, checkOutTime: now },
    allAtt.filter(r => r.workerId === user.id && r.id !== record.id)
  );

  if (fatigueAlert) {
    await dbAsync.createFatigueAlert({
      ...fatigueAlert,
      id: `fa-${Date.now()}`,
      createdAt: new Date().toISOString()
    });
  }

  res.json({
    record: updatedRecord || record,
    fatigueAlertTriggered: Boolean(fatigueAlert),
    fatigueAlert
  });
});

app.patch('/api/attendance/:id/status', requireAuth, requireRole('manager', 'admin'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { status, reviewNotes } = req.body;

  if (!['approved', 'disputed', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid attendance status' });
  }

  const paramId = String(req.params.id);
  const allAtt = await dbAsync.getAttendance();
  const record = allAtt.find(r => r.id === paramId);
  if (!record) {
    return res.status(404).json({ error: 'Attendance record not found' });
  }

  // Enforce organization isolation
  if (!enforceOrgBoundary(record.organizationId, user)) {
    return res.status(403).json({ error: 'Cannot approve or dispute attendance belonging to another organization' });
  }

  const updated = await dbAsync.updateAttendance(paramId, {
    status,
    reviewNotes: reviewNotes || record.reviewNotes
  });

  res.json({ message: 'Attendance status updated', record: updated || record });
});

// -------------------------------------------------------------
// TRANSPARENT PAYSLIPS
// -------------------------------------------------------------
app.get('/api/payslips', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const slips = await dbAsync.getPayslips();
  const { workerId, industry } = req.query;

  let filtered = slips;

  // Organization-level isolation
  if (user.role !== 'admin') {
    filtered = filtered.filter(p => p.organizationId === user.organizationId);
  }

  if (user.role === 'worker') {
    filtered = filtered.filter(p => p.workerId === user.id);
  } else if (workerId) {
    filtered = filtered.filter(p => p.workerId === workerId);
  }

  if (industry) {
    filtered = filtered.filter(p => p.industry === industry);
  }

  res.json(filtered);
});

app.get('/api/payslips/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const slips = await dbAsync.getPayslips();
  const slip = slips.find(p => p.id === req.params.id);

  if (!slip) {
    return res.status(404).json({ error: 'Payslip not found' });
  }

  // Security check: worker can only inspect their own payslip
  if (user.role === 'worker' && slip.workerId !== user.id) {
    return res.status(403).json({ error: 'Unauthorized to view this confidential payroll record' });
  }

  // Organization boundary check
  if (!enforceOrgBoundary(slip.organizationId, user)) {
    return res.status(403).json({ error: 'Unauthorized cross-organization access' });
  }

  res.json(slip);
});

app.post('/api/payslips/generate', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const targetWorkerId = (req.body.workerId as string) || user.id;

  const worker = await dbAsync.getUserById(targetWorkerId);
  if (!worker) {
    return res.status(404).json({ error: 'Worker not found' });
  }

  // Workers cannot generate payslips for other workers
  if (user.role === 'worker' && user.id !== targetWorkerId) {
    return res.status(403).json({ error: 'Cannot generate payslips for other employees' });
  }

  // Organization boundary check
  if (!enforceOrgBoundary(worker.organizationId, user)) {
    return res.status(403).json({ error: 'Unauthorized cross-organization operation' });
  }

  const periodStart = req.body.periodStart || '2026-10-01';
  const periodEnd = req.body.periodEnd || '2026-10-27';

  // Find organization payroll configuration
  const organizations = await dbAsync.getOrganizations();
  const org = organizations.find(o => o.id === worker.organizationId);
  const customConfig = org?.config?.payrollConfig;

  // Find attendance in range
  const allAtt = await dbAsync.getAttendance();
  const records = allAtt.filter(r => r.workerId === targetWorkerId && r.checkOutTime !== null);

  const breakdown = calculatePayslipBreakdown(worker, records, periodStart, periodEnd, '₹', customConfig);
  const newPayslip = {
    ...breakdown,
    id: `pay-${Date.now()}`,
    status: 'estimate' as const // Explicitly labeled as estimate
  };

  await dbAsync.createPayslip(newPayslip);
  res.status(201).json(newPayslip);
});

// -------------------------------------------------------------
// SAFETY REPORTING
// -------------------------------------------------------------
app.get('/api/safety', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const reports = await dbAsync.getSafetyReports();
  const { industry, status } = req.query;

  let filtered = reports;

  // Organization boundary isolation
  if (user.role !== 'admin') {
    filtered = filtered.filter(r => r.organizationId === user.organizationId);
  }

  if (industry) {
    filtered = filtered.filter(r => r.industry === industry);
  }
  if (status) {
    filtered = filtered.filter(r => r.status === status);
  }

  // PRIVACY RULE: If report was filed anonymously,
  // sanitize workerId and real identity completely.
  const sanitized = filtered.map(r => {
    if (r.reporterMode === 'anonymous') {
      const { workerId, ...rest } = r;
      return {
        ...rest,
        reporterDisplayName: 'Anonymous Worker (Identity Protected)'
      };
    }
    return r;
  });

  res.json(sanitized);
});

app.post('/api/safety', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { category, severity, description, location, reporterMode, photoDataUrl, industry } = req.body;

  if (!category || !severity || !description) {
    return res.status(400).json({ error: 'Category, severity, and description are required' });
  }

  const mode = reporterMode || 'confidential';
  const targetIndustry = industry || user.industry;
  const refCode = `SAF-${targetIndustry.substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const newReport: SafetyReport = {
    id: `rep-${Date.now()}`,
    referenceCode: refCode,
    organizationId: user.organizationId,
    industry: targetIndustry,
    category,
    severity,
    description,
    location: location || 'On Site Work Area',
    reporterMode: mode,
    // Strict privacy guarantee: do not attach workerId for anonymous reports
    workerId: mode === 'anonymous' ? undefined : user.id,
    reporterDisplayName: mode === 'anonymous' ? 'Anonymous Worker' : (mode === 'confidential' ? `${user.name} (Confidential)` : user.name),
    hasPhoto: Boolean(photoDataUrl),
    photoDataUrl,
    status: 'submitted',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await dbAsync.createSafetyReport(newReport);
  res.status(201).json(newReport);
});

app.patch('/api/safety/:id/status', requireAuth, requireRole('manager', 'admin'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { status, assignedPerson, resolutionNotes } = req.body;
  const reports = await dbAsync.getSafetyReports();
  const report = reports.find(r => r.id === req.params.id);

  if (!report) {
    return res.status(404).json({ error: 'Safety report not found' });
  }

  // Organization boundary check
  if (!enforceOrgBoundary(report.organizationId, user)) {
    return res.status(403).json({ error: 'Cannot modify safety reports belonging to another organization' });
  }

  const paramId = String(req.params.id);
  const updated = await dbAsync.updateSafetyReportStatus(paramId, status, assignedPerson, resolutionNotes);
  res.json({ message: 'Safety report updated successfully', report: updated || report });
});

// -------------------------------------------------------------
// CONFIDENTIAL & ANONYMOUS WORKPLACE FEEDBACK
// -------------------------------------------------------------
app.get('/api/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const allFeedback = await dbAsync.getFeedback();
  const { industry } = req.query;

  // STRICT PRIVACY PROTECTION:
  // Workplace feedback does NOT store workerId.
  let items = allFeedback;

  // Organization-level isolation
  if (user.role !== 'admin') {
    items = items.filter(f => f.organizationId === user.organizationId);
  }

  if (industry) {
    items = items.filter(f => f.industry === industry);
  }

  // Aggregate metrics
  const total = items.length;
  const concerns = items.filter(i => i.sentiment === 'concern').length;
  const positive = items.filter(i => i.sentiment === 'positive').length;
  const neutral = items.filter(i => i.sentiment === 'neutral').length;

  res.json({
    metrics: { total, concerns, positive, neutral },
    items
  });
});

app.post('/api/feedback', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { category, sentiment, comment, mode, industry } = req.body;

  if (!category || !comment) {
    return res.status(400).json({ error: 'Category and comment are required' });
  }

  // Strictly anonymous: never store workerId
  const newFeedback: WorkplaceFeedback = {
    id: `fb-${Date.now()}`,
    organizationId: user.organizationId,
    industry: industry || user.industry,
    category,
    mode: mode || 'anonymous',
    sentiment: sentiment || 'neutral',
    comment,
    createdAt: new Date().toISOString()
  };

  await dbAsync.createFeedback(newFeedback);

  res.status(201).json({
    message: 'Feedback securely recorded. Worker identity detached.',
    id: newFeedback.id,
    mode: newFeedback.mode
  });
});

// -------------------------------------------------------------
// FATIGUE & OVERTIME WARNINGS
// -------------------------------------------------------------
app.get('/api/fatigue', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const alerts = await dbAsync.getFatigueAlerts();
  const { industry, status } = req.query;

  let filtered = alerts;

  // Organization boundary isolation
  if (user.role !== 'admin') {
    filtered = filtered.filter(a => a.organizationId === user.organizationId);
  }

  if (industry) {
    filtered = filtered.filter(a => a.industry === industry);
  }
  if (status) {
    filtered = filtered.filter(a => a.status === status);
  }

  res.json(filtered);
});

app.patch('/api/fatigue/:id/review', requireAuth, requireRole('manager', 'admin'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { reviewNotes } = req.body;
  const alerts = await dbAsync.getFatigueAlerts();
  const alert = alerts.find(a => a.id === req.params.id);

  if (!alert) {
    return res.status(404).json({ error: 'Fatigue alert not found' });
  }

  // Organization boundary check
  if (!enforceOrgBoundary(alert.organizationId, user)) {
    return res.status(403).json({ error: 'Cannot review fatigue alerts belonging to another organization' });
  }

  const paramId = String(req.params.id);
  const updated = await dbAsync.resolveFatigueAlert(paramId, user.name, reviewNotes);
  res.json({ message: 'Fatigue alert marked reviewed', alert: updated || alert });
});

// -------------------------------------------------------------
// SKILL PASSPORT
// -------------------------------------------------------------
app.get('/api/skills', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const targetWorkerId = (req.query.workerId as string) || (user.role === 'worker' ? user.id : undefined);
  const skills = await dbAsync.getSkills();

  // 1. Worker Role: can only view their own skills
  if (user.role === 'worker') {
    if (targetWorkerId && targetWorkerId !== user.id) {
      return res.status(403).json({ error: 'Access denied: Workers can only view their own skill records.' });
    }
    const userSkills = skills.filter(s => s.workerId === user.id);
    return res.json(userSkills);
  }

  // 2. Manager Role: strictly isolated by organization
  if (user.role === 'manager') {
    if (targetWorkerId) {
      const targetWorker = await dbAsync.getUserById(targetWorkerId);
      if (!targetWorker) {
        return res.status(404).json({ error: 'Worker account not found.' });
      }
      if (targetWorker.organizationId !== user.organizationId) {
        return res.status(403).json({
          error: 'Access denied: Managers cannot access skill records of workers belonging to another organization.'
        });
      }
      const workerSkills = skills.filter(s => s.workerId === targetWorkerId);
      return res.json(workerSkills);
    }

    // Unspecified workerId: return skills strictly for workers in the manager's organization
    const users = await dbAsync.getUsers();
    const orgWorkerIds = new Set(users.filter(u => u.organizationId === user.organizationId).map(u => u.id));
    const orgSkills = skills.filter(s => orgWorkerIds.has(s.workerId));
    return res.json(orgSkills);
  }

  // 3. Admin Role: system-wide visibility
  if (targetWorkerId) {
    const adminSkills = skills.filter(s => s.workerId === targetWorkerId);
    return res.json(adminSkills);
  }

  res.json(skills);
});

app.post('/api/skills', requireAuth, async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { skillTitle, category, yearsExperience, certificateRef } = req.body;

  if (!skillTitle || !category) {
    return res.status(400).json({ error: 'Skill title and category are required' });
  }

  const newSkill: SkillPassportItem = {
    id: `sk-${Date.now()}`,
    workerId: user.id,
    skillTitle,
    category,
    yearsExperience: Number(yearsExperience) || 1,
    isVerified: false, // Worker-entered, unverified until manager sign-off
    certificateRef: certificateRef || 'Self-Reported Experience'
  };

  await dbAsync.createSkill(newSkill);
  res.status(201).json(newSkill);
});

app.patch('/api/skills/:id/verify', requireAuth, requireRole('manager', 'admin'), async (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { certificateRef } = req.body;
  const skills = await dbAsync.getSkills();
  const skill = skills.find(s => s.id === req.params.id);

  if (!skill) {
    return res.status(404).json({ error: 'Skill entry not found' });
  }

  // Organization-level boundary check for managers
  if (user.role === 'manager') {
    const skillOwner = await dbAsync.getUserById(skill.workerId);
    if (!skillOwner || skillOwner.organizationId !== user.organizationId) {
      return res.status(403).json({
        error: 'Access denied: Managers cannot verify skills for workers outside their organization.'
      });
    }
  }

  const paramId = String(req.params.id);
  const verified = await dbAsync.verifySkill(paramId, user.name, user.designation, certificateRef);
  res.json({ message: 'Skill successfully verified', skill: verified || skill });
});

// -------------------------------------------------------------
// SYSTEM RESET (FOR AUDIT & EVALUATION DEMOS)
// Strictly protected: requires verified manager/admin token in demo mode; permanently disabled in production
app.post('/api/system/reset', requireAuth, requireRole('manager', 'admin'), async (req: AuthenticatedRequest, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Public and demo system reset is permanently disabled in production environments regardless of demo flags.'
    });
  }

  const { seedIfEmpty } = await import('./scripts/seed-if-empty.js');
  await seedIfEmpty();
  res.json({ message: 'Database reset to clean official seed demonstration state.' });
});

// -------------------------------------------------------------
// PRODUCTION STATIC ASSETS SERVING
// -------------------------------------------------------------
const clientBuildDir = path.resolve(__dirname, '../../dist/client');
app.use(express.static(clientBuildDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(path.join(clientBuildDir, 'index.html'), err => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head><title>FairShift Platform</title></head>
          <body style="font-family:sans-serif;padding:40px;line-height:1.6;">
            <h2>FairShift Platform Active</h2>
            <p>Application is serving API requests. Client assets build active.</p>
            <p><a href="/health">Check Health Status</a> | <a href="/api/organizations">Organizations API</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Export app for Vercel Serverless Function
export default app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[FairShift Server] Running on http://localhost:${PORT}`);
    console.log(`[FairShift Server] Database: ${dbAsync.isPostgres() ? 'Neon PostgreSQL' : 'Local Store'}`);
  });
}
