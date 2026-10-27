import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';
import { calculateShiftHours, calculatePayslipBreakdown, evaluateFatigue } from './services/calculations.js';
import { AttendanceRecord, SafetyReport, WorkplaceFeedback, SkillPassportItem, FatigueAlert } from './types.js';

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
    timestamp: new Date().toISOString()
  });
});

// Helper to extract authenticated user (using X-User-Id header or fallback)
function getCurrentUser(req: express.Request) {
  const data = db.get();
  const userId = (req.headers['x-user-id'] as string) || 'usr-worker-murugan';
  const user = data.users.find(u => u.id === userId);
  return user || data.users[0];
}

// -------------------------------------------------------------
// AUTH & PERSONA ENDPOINTS
// -------------------------------------------------------------
app.get('/api/auth/me', (req, res) => {
  const user = getCurrentUser(req);
  res.json(user);
});

app.get('/api/auth/users', (req, res) => {
  const data = db.get();
  res.json(data.users);
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
app.get('/api/shifts', (req, res) => {
  const data = db.get();
  const industry = req.query.industry as string;
  const filtered = industry ? data.shifts.filter(s => s.industry === industry) : data.shifts;
  res.json(filtered);
});

app.post('/api/shifts', (req, res) => {
  const user = getCurrentUser(req);
  if (user.role === 'worker') {
    return res.status(403).json({ error: 'Only managers and administrators can create shifts' });
  }

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
app.get('/api/attendance', (req, res) => {
  const data = db.get();
  const user = getCurrentUser(req);
  const { industry, workerId, status } = req.query;

  let records = data.attendance;

  // Security check: workers can only view their own attendance
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

app.post('/api/attendance/check-in', (req, res) => {
  const user = getCurrentUser(req);
  const { shiftId, qrToken, verificationMethod } = req.body;

  const data = db.get();
  const shift = data.shifts.find(s => s.id === shiftId);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found' });
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

app.post('/api/attendance/check-out', (req, res) => {
  const user = getCurrentUser(req);
  const { attendanceId } = req.body;

  const data = db.get();
  const recordIndex = data.attendance.findIndex(
    r => (attendanceId ? r.id === attendanceId : r.workerId === user.id && r.checkOutTime === null)
  );

  if (recordIndex === -1) {
    return res.status(404).json({ error: 'Active check-in record not found to check out from.' });
  }

  const record = data.attendance[recordIndex];
  const now = new Date().toISOString();

  // Perform hours and overtime calculations
  const calc = calculateShiftHours(record.checkInTime, now, 8.0);

  record.checkOutTime = now;
  record.regularHours = calc.regularHours;
  record.overtimeHours = calc.overtimeHours;
  record.status = 'pending'; // Pending manager sign-off

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

app.patch('/api/attendance/:id/status', (req, res) => {
  const user = getCurrentUser(req);
  if (user.role === 'worker') {
    return res.status(403).json({ error: 'Workers cannot approve or dispute official attendance records' });
  }

  const { status, reviewNotes } = req.body;
  if (!['approved', 'disputed', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid attendance status' });
  }

  const data = db.get();
  const record = data.attendance.find(r => r.id === req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Attendance record not found' });
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
app.get('/api/payslips', (req, res) => {
  const data = db.get();
  const user = getCurrentUser(req);
  const { workerId, industry } = req.query;

  let slips = data.payslips;
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

app.get('/api/payslips/:id', (req, res) => {
  const data = db.get();
  const user = getCurrentUser(req);
  const slip = data.payslips.find(p => p.id === req.params.id);

  if (!slip) {
    return res.status(404).json({ error: 'Payslip not found' });
  }

  // Security check: worker can only inspect their own payslip
  if (user.role === 'worker' && slip.workerId !== user.id) {
    return res.status(403).json({ error: 'Unauthorized to view this confidential payroll record' });
  }

  res.json(slip);
});

app.post('/api/payslips/generate', (req, res) => {
  const user = getCurrentUser(req);
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

  const periodStart = req.body.periodStart || '2026-10-01';
  const periodEnd = req.body.periodEnd || '2026-10-27';

  // Find attendance in range
  const records = data.attendance.filter(r => r.workerId === targetWorkerId && r.checkOutTime !== null);

  const breakdown = calculatePayslipBreakdown(worker, records, periodStart, periodEnd, '₹');
  const newPayslip = {
    ...breakdown,
    id: `pay-${Date.now()}`
  };

  db.update(d => {
    d.payslips.unshift(newPayslip);
  });

  res.status(201).json(newPayslip);
});

// -------------------------------------------------------------
// SAFETY REPORTING
// -------------------------------------------------------------
app.get('/api/safety', (req, res) => {
  const data = db.get();
  const user = getCurrentUser(req);
  const { industry, status } = req.query;

  let reports = data.safetyReports;
  if (industry) {
    reports = reports.filter(r => r.industry === industry);
  }
  if (status) {
    reports = reports.filter(r => r.status === status);
  }

  // PRIVACY RULE: If employer views report that was filed anonymously,
  // ensure workerId and real identity are sanitized
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

app.post('/api/safety', (req, res) => {
  const user = getCurrentUser(req);
  const { category, severity, description, location, reporterMode, photoDataUrl, industry } = req.body;

  if (!category || !severity || !description) {
    return res.status(400).json({ error: 'Category, severity, and description are required' });
  }

  const mode = reporterMode || 'confidential';
  const refCode = `SAF-${(industry || user.industry).substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  const newReport: SafetyReport = {
    id: `rep-${Date.now()}`,
    referenceCode: refCode,
    organizationId: user.organizationId,
    industry: industry || user.industry,
    category,
    severity,
    description,
    location: location || 'On Site Work Area',
    reporterMode: mode,
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

app.patch('/api/safety/:id/status', (req, res) => {
  const user = getCurrentUser(req);
  if (user.role === 'worker') {
    return res.status(403).json({ error: 'Only safety supervisors and managers can update incident status' });
  }

  const { status, assignedPerson, resolutionNotes } = req.body;
  const data = db.get();
  const report = data.safetyReports.find(r => r.id === req.params.id);

  if (!report) {
    return res.status(404).json({ error: 'Safety report not found' });
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
app.get('/api/feedback', (req, res) => {
  const data = db.get();
  const { industry } = req.query;

  // STRICT PRIVACY PROTECTION:
  // Workplace feedback does NOT store workerId. It only presents
  // category, sentiment, timestamp, and text.
  let items = data.feedback;
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

app.post('/api/feedback', (req, res) => {
  const user = getCurrentUser(req);
  const { category, sentiment, comment, mode, industry } = req.body;

  if (!category || !comment) {
    return res.status(400).json({ error: 'Category and comment are required' });
  }

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
app.get('/api/fatigue', (req, res) => {
  const data = db.get();
  const { industry, status } = req.query;

  let alerts = data.fatigueAlerts;
  if (industry) {
    alerts = alerts.filter(a => a.industry === industry);
  }
  if (status) {
    alerts = alerts.filter(a => a.status === status);
  }

  res.json(alerts);
});

app.patch('/api/fatigue/:id/review', (req, res) => {
  const user = getCurrentUser(req);
  if (user.role === 'worker') {
    return res.status(403).json({ error: 'Only managers can review fatigue flags' });
  }

  const { reviewNotes } = req.body;
  const data = db.get();
  const alert = data.fatigueAlerts.find(a => a.id === req.params.id);

  if (!alert) {
    return res.status(404).json({ error: 'Fatigue alert not found' });
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
app.get('/api/skills', (req, res) => {
  const data = db.get();
  const user = getCurrentUser(req);
  const targetWorkerId = (req.query.workerId as string) || user.id;

  const skills = data.skills.filter(s => s.workerId === targetWorkerId);
  res.json(skills);
});

app.post('/api/skills', (req, res) => {
  const user = getCurrentUser(req);
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

app.patch('/api/skills/:id/verify', (req, res) => {
  const user = getCurrentUser(req);
  if (user.role === 'worker') {
    return res.status(403).json({ error: 'Only employers and authorized assessors can verify skill credentials' });
  }

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
// -------------------------------------------------------------
app.post('/api/system/reset', (req, res) => {
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
  console.log(`[FairShift Server] Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[FairShift Server] Listening on dynamic port for Cloud Run.`);
});
