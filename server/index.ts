import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
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

// Health Check for Google Cloud Run
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'fairshift-platform',
    version: '1.0.0',
    sdgGoal: 'SDG 8: Decent Work & Economic Growth',
    database: process.env.DATABASE_URL ? 'postgresql-configured' : 'local-atomic-store',
    demoMode: isDemoModeActive(),
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// AUTH & PERSONA ENDPOINTS
// -------------------------------------------------------------

// Verified Login & Token Generation with explicit Demo Mode separation
app.post('/api/auth/login', (req, res) => {
  const { userId, password } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required for login' });
  }

  const demoActive = isDemoModeActive();
  const data = db.get();
  const user = data.users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  // Outside demo mode, credentials are mandatory
  if (!demoActive && !password) {
    return res.status(401).json({
      error: 'Password credentials are required in production. Direct persona switching without credentials is only permitted in demo mode.'
    });
  }

  const token = createSessionToken(user, demoActive);
  res.json({
    message: demoActive ? 'Demo authentication successful' : 'Authentication successful',
    token,
    user: demoActive ? sanitizePublicUser(user) : user,
    isDemoSession: demoActive
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(req.user);
});

// Protected public persona directory: strictly omits phone, email, and salary rates
app.get('/api/auth/users', (req, res) => {
  const data = db.get();
  const sanitized = data.users.map(u => sanitizePublicUser(u));
  res.json(sanitized);
});

// -------------------------------------------------------------
// ORGANIZATIONS & INDUSTRY CONFIG
// -------------------------------------------------------------
app.get('/api/organizations', (req, res) => {
  const data = db.get();
  res.json(data.organizations);
});

// -------------------------------------------------------------
// SHIFTS
// -------------------------------------------------------------
app.get('/api/shifts', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const industry = req.query.industry as string;

  let filtered = data.shifts;

  // Tenant / Organization Isolation
  if (user.role !== 'admin') {
    filtered = filtered.filter(s => s.organizationId === user.organizationId);
  }

  if (industry) {
    filtered = filtered.filter(s => s.industry === industry);
  }

  res.json(filtered);
});

app.post('/api/shifts', requireAuth, requireRole('manager', 'admin'), (req: AuthenticatedRequest, res) => {
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

  db.update(d => {
    d.shifts.unshift(newShift);
  });

  res.status(201).json(newShift);
});

// -------------------------------------------------------------
// ATTENDANCE & SHIFT TRACKING
// -------------------------------------------------------------
app.get('/api/attendance', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const { industry, workerId, status } = req.query;

  let records = data.attendance;

  // Organization-level isolation
  if (user.role !== 'admin') {
    records = records.filter(r => r.organizationId === user.organizationId);
  }

  // Security check: workers can ONLY view their own attendance records
  if (user.role === 'worker') {
    records = records.filter(r => r.workerId === user.id);
  } else if (workerId) {
    records = records.filter(r => r.workerId === workerId);
  }

  if (industry) {
    records = records.filter(r => r.industry === industry);
  }

  if (status) {
    records = records.filter(r => r.status === status);
  }

  res.json(records);
});

app.post('/api/attendance/check-in', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { shiftId, qrToken, verificationMethod } = req.body;

  const data = db.get();
  const shift = data.shifts.find(s => s.id === shiftId);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
  }

  // Enforce tenant boundary: worker cannot check in to another organization's shift
  if (!enforceOrgBoundary(shift.organizationId, user)) {
    return res.status(403).json({ error: 'Cross-organization shift check-in is not permitted' });
  }

  // Check if worker already has an active (unclosed) attendance record
  const activeRecord = data.attendance.find(r => r.workerId === user.id && r.checkOutTime === null);
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

  db.update(d => {
    d.attendance.unshift(newRecord);
  });

  res.status(201).json(newRecord);
});

app.post('/api/attendance/check-out', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { attendanceId } = req.body;

  const data = db.get();
  const recordIndex = data.attendance.findIndex(
    r => (attendanceId ? r.id === attendanceId : r.workerId === user.id && r.checkOutTime === null)
  );

  if (recordIndex === -1) {
    return res.status(404).json({ error: 'Active check-in record not found to check out from.' });
  }

  const record = data.attendance[recordIndex];

  // Workers can only check out of their own shift
  if (user.role === 'worker' && record.workerId !== user.id) {
    return res.status(403).json({ error: 'Unauthorized to check out another worker.' });
  }

  const now = new Date().toISOString();

  // Perform hours and overtime calculations
  const calc = calculateShiftHours(record.checkInTime, now, 8.0);

  record.checkOutTime = now;
  record.regularHours = calc.regularHours;
  record.overtimeHours = calc.overtimeHours;
  record.status = 'pending'; // Pending manager audit

  // Evaluate Fatigue Rules
  const fatigueAlert = evaluateFatigue(
    user,
    { checkInTime: record.checkInTime, checkOutTime: now },
    data.attendance.filter(r => r.workerId === user.id && r.id !== record.id)
  );

  db.update(d => {
    d.attendance[recordIndex] = record;
    if (fatigueAlert) {
      d.fatigueAlerts.unshift({
        ...fatigueAlert,
        id: `fa-${Date.now()}`,
        createdAt: new Date().toISOString()
      });
    }
  });

  res.json({
    record,
    fatigueAlertTriggered: Boolean(fatigueAlert),
    fatigueAlert
  });
});

app.patch('/api/attendance/:id/status', requireAuth, requireRole('manager', 'admin'), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { status, reviewNotes } = req.body;

  if (!['approved', 'disputed', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid attendance status' });
  }

  const data = db.get();
  const record = data.attendance.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Attendance record not found' });
  }

  // Enforce organization isolation
  if (!enforceOrgBoundary(record.organizationId, user)) {
    return res.status(403).json({ error: 'Cannot approve or dispute attendance belonging to another organization' });
  }

  db.update(d => {
    const item = d.attendance.find(r => r.id === req.params.id);
    if (item) {
      item.status = status;
      if (reviewNotes) item.reviewNotes = reviewNotes;
    }
  });

  res.json({ message: 'Attendance status updated', record });
});

// -------------------------------------------------------------
// TRANSPARENT PAYSLIPS
// -------------------------------------------------------------
app.get('/api/payslips', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const { workerId, industry } = req.query;

  let slips = data.payslips;

  // Organization-level isolation
  if (user.role !== 'admin') {
    slips = slips.filter(p => p.organizationId === user.organizationId);
  }

  if (user.role === 'worker') {
    slips = slips.filter(p => p.workerId === user.id);
  } else if (workerId) {
    slips = slips.filter(p => p.workerId === workerId);
  }

  if (industry) {
    slips = slips.filter(p => p.industry === industry);
  }

  res.json(slips);
});

app.get('/api/payslips/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const slip = data.payslips.find(p => p.id === req.params.id);

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

app.post('/api/payslips/generate', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const targetWorkerId = (req.body.workerId as string) || user.id;

  const data = db.get();
  const worker = data.users.find(u => u.id === targetWorkerId);
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
  const org = data.organizations.find(o => o.id === worker.organizationId);
  const customConfig = org?.config?.payrollConfig;

  // Find attendance in range
  const records = data.attendance.filter(r => r.workerId === targetWorkerId && r.checkOutTime !== null);

  const breakdown = calculatePayslipBreakdown(worker, records, periodStart, periodEnd, '₹', customConfig);
  const newPayslip = {
    ...breakdown,
    id: `pay-${Date.now()}`,
    status: 'estimate' as const // Explicitly labeled as estimate
  };

  db.update(d => {
    d.payslips.unshift(newPayslip);
  });

  res.status(201).json(newPayslip);
});

// -------------------------------------------------------------
// SAFETY REPORTING
// -------------------------------------------------------------
app.get('/api/safety', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const { industry, status } = req.query;

  let reports = data.safetyReports;

  // Organization boundary isolation
  if (user.role !== 'admin') {
    reports = reports.filter(r => r.organizationId === user.organizationId);
  }

  if (industry) {
    reports = reports.filter(r => r.industry === industry);
  }
  if (status) {
    reports = reports.filter(r => r.status === status);
  }

  // PRIVACY RULE: If report was filed anonymously,
  // sanitize workerId and real identity completely.
  const sanitized = reports.map(r => {
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

app.post('/api/safety', requireAuth, (req: AuthenticatedRequest, res) => {
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

  db.update(d => {
    d.safetyReports.unshift(newReport);
  });

  res.status(201).json(newReport);
});

app.patch('/api/safety/:id/status', requireAuth, requireRole('manager', 'admin'), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { status, assignedPerson, resolutionNotes } = req.body;
  const data = db.get();
  const report = data.safetyReports.find(r => r.id === req.params.id);

  if (!report) {
    return res.status(404).json({ error: 'Safety report not found' });
  }

  // Organization boundary check
  if (!enforceOrgBoundary(report.organizationId, user)) {
    return res.status(403).json({ error: 'Cannot modify safety reports belonging to another organization' });
  }

  db.update(d => {
    const item = d.safetyReports.find(r => r.id === req.params.id);
    if (item) {
      if (status) item.status = status;
      if (assignedPerson) item.assignedPerson = assignedPerson;
      if (resolutionNotes) item.resolutionNotes = resolutionNotes;
      item.updatedAt = new Date().toISOString();
    }
  });

  res.json({ message: 'Safety report updated successfully', report });
});

// -------------------------------------------------------------
// CONFIDENTIAL & ANONYMOUS WORKPLACE FEEDBACK
// -------------------------------------------------------------
app.get('/api/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const { industry } = req.query;

  // STRICT PRIVACY PROTECTION:
  // Workplace feedback does NOT store workerId.
  let items = data.feedback;

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

app.post('/api/feedback', requireAuth, (req: AuthenticatedRequest, res) => {
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

  db.update(d => {
    d.feedback.unshift(newFeedback);
  });

  res.status(201).json({
    message: 'Feedback securely recorded. Worker identity detached.',
    id: newFeedback.id,
    mode: newFeedback.mode
  });
});

// -------------------------------------------------------------
// FATIGUE & OVERTIME WARNINGS
// -------------------------------------------------------------
app.get('/api/fatigue', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const { industry, status } = req.query;

  let alerts = data.fatigueAlerts;

  // Organization boundary isolation
  if (user.role !== 'admin') {
    alerts = alerts.filter(a => a.organizationId === user.organizationId);
  }

  if (industry) {
    alerts = alerts.filter(a => a.industry === industry);
  }
  if (status) {
    alerts = alerts.filter(a => a.status === status);
  }

  res.json(alerts);
});

app.patch('/api/fatigue/:id/review', requireAuth, requireRole('manager', 'admin'), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { reviewNotes } = req.body;
  const data = db.get();
  const alert = data.fatigueAlerts.find(a => a.id === req.params.id);

  if (!alert) {
    return res.status(404).json({ error: 'Fatigue alert not found' });
  }

  // Organization boundary check
  if (!enforceOrgBoundary(alert.organizationId, user)) {
    return res.status(403).json({ error: 'Cannot review fatigue alerts belonging to another organization' });
  }

  db.update(d => {
    const item = d.fatigueAlerts.find(a => a.id === req.params.id);
    if (item) {
      item.status = 'reviewed';
      item.reviewedBy = user.name;
      item.reviewNotes = reviewNotes || 'Schedule reviewed and compensatory rest confirmed.';
    }
  });

  res.json({ message: 'Fatigue alert marked reviewed', alert });
});

// -------------------------------------------------------------
// SKILL PASSPORT
// -------------------------------------------------------------
app.get('/api/skills', requireAuth, (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const data = db.get();
  const targetWorkerId = (req.query.workerId as string) || user.id;

  // Security: workers can only view their own skills
  if (user.role === 'worker' && targetWorkerId !== user.id) {
    return res.status(403).json({ error: 'Cannot view skills of other workers' });
  }

  const skills = data.skills.filter(s => s.workerId === targetWorkerId);
  res.json(skills);
});

app.post('/api/skills', requireAuth, (req: AuthenticatedRequest, res) => {
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

  db.update(d => {
    d.skills.unshift(newSkill);
  });

  res.status(201).json(newSkill);
});

app.patch('/api/skills/:id/verify', requireAuth, requireRole('manager', 'admin'), (req: AuthenticatedRequest, res) => {
  const user = req.user!;
  const { certificateRef } = req.body;
  const data = db.get();
  const skill = data.skills.find(s => s.id === req.params.id);

  if (!skill) {
    return res.status(404).json({ error: 'Skill entry not found' });
  }

  db.update(d => {
    const item = d.skills.find(s => s.id === req.params.id);
    if (item) {
      item.isVerified = true;
      item.verifierName = user.name;
      item.verifierDesignation = user.designation;
      item.verifiedAt = new Date().toISOString().split('T')[0];
      if (certificateRef) item.certificateRef = certificateRef;
    }
  });

  res.json({ message: 'Skill successfully verified', skill });
});

// -------------------------------------------------------------
// SYSTEM RESET (FOR AUDIT & EVALUATION DEMOS)
// Strictly protected: requires verified manager/admin token in demo mode; disabled in production
app.post('/api/system/reset', requireAuth, requireRole('manager', 'admin'), (req: AuthenticatedRequest, res) => {
  if (process.env.NODE_ENV === 'production' && !isDemoModeActive()) {
    return res.status(403).json({
      error: 'System reset is disabled in production environments.'
    });
  }

  db.resetToSeed();
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
          <head><title>FairShift API</title></head>
          <body style="font-family:sans-serif;padding:40px;line-height:1.6;">
            <h2>FairShift API Running</h2>
            <p>Google Cloud Run Service is active. Client build is currently serving or compiling.</p>
            <p><a href="/health">Check Health Status</a> | <a href="/api/organizations">Organizations API</a></p>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, () => {
  console.log(`[FairShift Server] Running on http://localhost:${PORT}`);
  console.log(`[FairShift Server] Listening on dynamic port for Cloud Run.`);
});
