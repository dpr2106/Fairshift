import React, { useState, useEffect } from 'react';
import {
  User,
  Industry,
  Shift,
  AttendanceRecord,
  SafetyReport,
  FatigueAlert,
  WorkplaceFeedback,
  SkillPassportItem
} from '../../server/types.js';
import { Language, translations } from '../translations.js';
import { api } from '../api.js';
import {
  Users,
  Clock,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileText,
  PlusCircle,
  MessageSquare,
  Award,
  Filter,
  Eye,
  Activity,
  ShieldAlert
} from 'lucide-react';

interface EmployerPortalProps {
  currentUser: User;
  currentIndustry: Industry;
  currentLanguage: Language;
}

export const EmployerPortal: React.FC<EmployerPortalProps> = ({
  currentUser,
  currentIndustry,
  currentLanguage
}) => {
  const t = translations[currentLanguage];

  // Active Tab
  const [activeTab, setActiveTab] = useState<'attendance' | 'safety' | 'fatigue' | 'feedback' | 'skills' | 'create_shift'>('attendance');

  // State
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [safetyReports, setSafetyReports] = useState<SafetyReport[]>([]);
  const [fatigueAlerts, setFatigueAlerts] = useState<FatigueAlert[]>([]);
  const [feedbackData, setFeedbackData] = useState<{ metrics: any; items: WorkplaceFeedback[] }>({
    metrics: { total: 0, concerns: 0, positive: 0, neutral: 0 },
    items: []
  });
  const [skills, setSkills] = useState<SkillPassportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Modals
  const [inspectReport, setInspectReport] = useState<SafetyReport | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');
  const [statusUpdateTarget, setStatusUpdateTarget] = useState<string>('under_review');
  const [assignedPersonInput, setAssignedPersonInput] = useState('');

  const [inspectFatigue, setInspectFatigue] = useState<FatigueAlert | null>(null);
  const [fatigueReviewNote, setFatigueReviewNote] = useState('');

  // New Shift Form
  const [newShiftTitle, setNewShiftTitle] = useState('');
  const [newShiftStart, setNewShiftStart] = useState('08:00');
  const [newShiftEnd, setNewShiftEnd] = useState('17:00');
  const [newShiftRole, setNewShiftRole] = useState('');
  const [newShiftLocation, setNewShiftLocation] = useState('');
  const [newShiftIsOvernight, setNewShiftIsOvernight] = useState(false);

  const loadEmployerData = async () => {
    try {
      setLoading(true);
      const [att, safety, fatigue, fb, allSkills] = await Promise.all([
        api.getAttendance(currentIndustry),
        api.getSafetyReports(currentIndustry),
        api.getFatigueAlerts(currentIndustry),
        api.getFeedback(currentIndustry),
        api.getSkills()
      ]);

      setAttendance(att);
      setSafetyReports(safety);
      setFatigueAlerts(fatigue);
      setFeedbackData(fb);
      setSkills(allSkills);
    } catch (err: any) {
      console.error(err);
      setNotification({ message: err.message || 'Error loading employer records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployerData();
  }, [currentIndustry]);

  // Attendance Actions
  const handleUpdateAttendanceStatus = async (id: string, status: 'approved' | 'disputed') => {
    try {
      setLoading(true);
      const note = status === 'approved' ? `Approved by ${currentUser.name}` : `Disputed by ${currentUser.name}`;
      await api.updateAttendanceStatus(id, status, note);
      setNotification({ message: `Attendance record marked as ${status}.`, type: 'success' });
      await loadEmployerData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error updating attendance', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Safety Update Action
  const handleSaveSafetyStatus = async () => {
    if (!inspectReport) return;
    try {
      setLoading(true);
      await api.updateSafetyStatus(
        inspectReport.id,
        statusUpdateTarget,
        assignedPersonInput || currentUser.name,
        resolutionNoteInput
      );
      setInspectReport(null);
      setNotification({ message: `Safety ticket ${inspectReport.referenceCode} updated.`, type: 'success' });
      await loadEmployerData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error updating safety ticket', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Fatigue Review Action
  const handleConfirmFatigueReview = async () => {
    if (!inspectFatigue) return;
    try {
      setLoading(true);
      await api.reviewFatigueAlert(
        inspectFatigue.id,
        fatigueReviewNote || 'Compensatory rest scheduled and verified by supervisor.'
      );
      setInspectFatigue(null);
      setNotification({ message: `Fatigue advisory marked as reviewed.`, type: 'success' });
      await loadEmployerData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error reviewing alert', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Verify Skill Action
  const handleVerifySkill = async (id: string) => {
    try {
      setLoading(true);
      await api.verifySkill(id, `AUDIT-VERIFIED-${currentIndustry.toUpperCase()}-${new Date().getFullYear()}`);
      setNotification({ message: `Worker skill verified and stamped with official badge.`, type: 'success' });
      await loadEmployerData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error verifying skill', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Create Shift Action
  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftTitle) return;

    try {
      setLoading(true);
      await api.createShift({
        title: newShiftTitle,
        industry: currentIndustry,
        startTime: newShiftStart,
        endTime: newShiftEnd,
        durationHours: 8,
        isOvernight: newShiftIsOvernight,
        requiredRole: newShiftRole || (currentIndustry === 'construction' ? 'Mason / Rigger' : 'Sanitation Specialist'),
        siteLocation: newShiftLocation || (currentIndustry === 'construction' ? 'Metro Corridor Gate 1' : 'Main Hospital Block')
      });

      setNotification({ message: `New shift "${newShiftTitle}" created with secure QR token.`, type: 'success' });
      setNewShiftTitle('');
      setActiveTab('attendance');
      await loadEmployerData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error creating shift', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Derived KPIs
  const pendingAttendanceCount = attendance.filter((a) => a.status === 'pending').length;
  const openSafetyCount = safetyReports.filter((s) => s.status !== 'resolved').length;
  const criticalSafetyCount = safetyReports.filter((s) => s.severity === 'critical' && s.status !== 'resolved').length;
  const activeFatigueCount = fatigueAlerts.filter((f) => f.status === 'active').length;

  return (
    <div className="employer-layout">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`alert-box ${
            notification.type === 'error'
              ? 'alert-danger'
              : notification.type === 'warning'
              ? 'alert-warning'
              : 'alert-info'
          }`}
          role="alert"
        >
          {notification.type === 'error' ? (
            <AlertTriangle size={20} />
          ) : (
            <CheckCircle2 size={20} />
          )}
          <div style={{ flex: 1 }}>{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Cockpit KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="fair-card" style={{ padding: 16, background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Pending Approvals
            </span>
            <Clock size={20} color="#0d9488" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
            {pendingAttendanceCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Attendance records awaiting sign-off</div>
        </div>

        <div className="fair-card" style={{ padding: 16, background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Active Hazards
            </span>
            <AlertTriangle size={20} color={criticalSafetyCount > 0 ? '#dc2626' : '#d97706'} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: criticalSafetyCount > 0 ? '#dc2626' : '#0f172a', marginTop: 4 }}>
            {openSafetyCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: criticalSafetyCount > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
            {criticalSafetyCount > 0 ? `${criticalSafetyCount} CRITICAL severity items` : 'No critical safety breaches'}
          </div>
        </div>

        <div className="fair-card" style={{ padding: 16, background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Fatigue Advisories
            </span>
            <Activity size={20} color="#ea580c" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: activeFatigueCount > 0 ? '#ea580c' : '#0f172a', marginTop: 4 }}>
            {activeFatigueCount}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Rest gap & excessive hours flags</div>
        </div>

        <div className="fair-card" style={{ padding: 16, background: '#ffffff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Worker Voice
            </span>
            <MessageSquare size={20} color="#0284c7" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
            {feedbackData.metrics.total}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>
            100% Identity-Detached Feedback
          </div>
        </div>
      </div>

      {/* Cockpit Nav Tabs */}
      <nav className="portal-nav-bar" aria-label="Operations Cockpit Tabs">
        <button
          className={`nav-tab-item ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <Clock size={18} />
          <span>Attendance & Overtime Queue ({pendingAttendanceCount})</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => setActiveTab('safety')}
        >
          <AlertTriangle size={18} />
          <span>Safety Hazard Command ({openSafetyCount})</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'fatigue' ? 'active' : ''}`}
          onClick={() => setActiveTab('fatigue')}
        >
          <Activity size={18} />
          <span>Fatigue & Rest Overtime ({activeFatigueCount})</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          <MessageSquare size={18} />
          <span>Aggregated Feedback Trends</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          <Award size={18} />
          <span>Skill Passport Verification</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'create_shift' ? 'active' : ''}`}
          onClick={() => setActiveTab('create_shift')}
        >
          <PlusCircle size={18} />
          <span>Schedule Shift</span>
        </button>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: ATTENDANCE & OVERTIME QUEUE */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'attendance' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <Clock size={22} color="#0d9488" />
              <div>
                <h3 className="card-title">Attendance & Statutory Overtime Audit</h3>
                <p className="card-desc">
                  Inspect recorded timestamps, overtime calculations, and sign-off on payroll entries.
                </p>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Shift Name</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Regular Hrs</th>
                  <th>Overtime Hrs</th>
                  <th>Verification</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ fontWeight: 700 }}>{rec.workerName}</td>
                    <td>{rec.shiftTitle}</td>
                    <td>{new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      {rec.checkOutTime
                        ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Active Shift'}
                    </td>
                    <td>{rec.regularHours}h</td>
                    <td style={{ color: rec.overtimeHours > 0 ? '#d97706' : 'inherit', fontWeight: 700 }}>
                      {rec.overtimeHours > 0 ? `+${rec.overtimeHours}h OT` : '0h'}
                    </td>
                    <td>
                      <span style={{ fontSize: '0.78rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>
                        QR Token Validated
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          rec.status === 'approved'
                            ? 'badge-approved'
                            : rec.status === 'disputed'
                            ? 'badge-disputed'
                            : 'badge-pending'
                        }`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td>
                      {rec.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn-primary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', minHeight: '32px' }}
                            onClick={() => handleUpdateAttendanceStatus(rec.id, 'approved')}
                            title="Approve for Payroll"
                          >
                            <CheckCircle2 size={14} />
                            <span>Approve</span>
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', minHeight: '32px', color: '#dc2626' }}
                            onClick={() => handleUpdateAttendanceStatus(rec.id, 'disputed')}
                            title="Flag Discrepancy"
                          >
                            <XCircle size={14} />
                            <span>Dispute</span>
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {rec.reviewNotes || 'Sign-off complete'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: SAFETY HAZARD COMMAND CENTER */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'safety' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <AlertTriangle size={22} color="#dc2626" />
              <div>
                <h3 className="card-title">Workplace Hazard Triage & Incident Resolution</h3>
                <p className="card-desc">
                  Lifecycle state machine: Submitted → Under Review → Action Required → Resolved
                </p>
              </div>
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ref #</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Location</th>
                  <th>Reporter Mode</th>
                  <th>Status</th>
                  <th>Assigned Officer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {safetyReports.map((report) => (
                  <tr key={report.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{report.referenceCode}</td>
                    <td>{report.category}</td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          background:
                            report.severity === 'critical'
                              ? '#fee2e2'
                              : report.severity === 'high'
                              ? '#ffedd5'
                              : '#fef9c3',
                          color:
                            report.severity === 'critical'
                              ? '#991b1b'
                              : report.severity === 'high'
                              ? '#9a3412'
                              : '#854d0e'
                        }}
                      >
                        {report.severity}
                      </span>
                    </td>
                    <td>{report.location}</td>
                    <td>
                      {report.reporterMode === 'anonymous' ? (
                        <span style={{ color: '#0284c7', fontWeight: 600 }}>🛡️ Anonymous</span>
                      ) : (
                        <span>{report.reporterDisplayName}</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          report.status === 'resolved'
                            ? 'badge-resolved'
                            : report.status === 'action_required'
                            ? 'badge-disputed'
                            : 'badge-pending'
                        }`}
                      >
                        {report.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>{report.assignedPerson || 'Unassigned'}</td>
                    <td>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: '34px' }}
                        onClick={() => {
                          setInspectReport(report);
                          setStatusUpdateTarget(report.status);
                          setAssignedPersonInput(report.assignedPerson || currentUser.name);
                          setResolutionNoteInput(report.resolutionNotes || '');
                        }}
                      >
                        <Eye size={14} />
                        <span>Inspect & Update</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: FATIGUE & REST OVERTIME ADVISORIES */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'fatigue' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <Activity size={22} color="#ea580c" />
              <div>
                <h3 className="card-title">Fatigue & Insufficient Rest Monitoring</h3>
                <p className="card-desc">
                  Proactive safety guardrails flagging consecutive hours (&gt;10h) and rest gaps (&lt;11h).
                </p>
              </div>
            </div>
          </div>

          <div className="alert-box alert-warning">
            <ShieldAlert size={20} />
            <div>
              <strong>Non-Punitive Safety Policy:</strong> These alerts are preventative indicators to protect worker
              health and prevent heavy equipment accidents. Workers are never penalized for safety flags.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {fatigueAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  border: '1px solid #fed7aa',
                  borderRadius: 12,
                  padding: 16,
                  background: alert.status === 'active' ? '#fff7ed' : '#f8fafc',
                  borderColor: alert.status === 'active' ? '#fb923c' : '#e2e8f0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{alert.workerName}</span>
                      <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}>
                        {alert.severity} RISK
                      </span>
                      <span className={`badge ${alert.status === 'reviewed' ? 'badge-approved' : 'badge-pending'}`}>
                        {alert.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#c2410c', fontWeight: 700, marginTop: 4 }}>
                      ⚠️ {alert.metricValue}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 4 }}>
                      {alert.explanation}
                    </div>
                  </div>
                  {alert.status === 'active' ? (
                    <button
                      className="btn-primary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem', minHeight: '34px' }}
                      onClick={() => {
                        setInspectFatigue(alert);
                        setFatigueReviewNote('Granted mandatory compensatory rest day. Relief crew assigned.');
                      }}
                    >
                      <span>Review & Grant Rest</span>
                    </button>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#166534', textAlign: 'right' }}>
                      ✓ Reviewed by {alert.reviewedBy}
                      <div style={{ color: '#64748b', fontStyle: 'italic' }}>"{alert.reviewNotes}"</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: AGGREGATED FEEDBACK TRENDS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'feedback' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <MessageSquare size={22} color="#0284c7" />
              <div>
                <h3 className="card-title">Aggregated Workplace Sentiment & Climate</h3>
                <p className="card-desc">
                  Guaranteed identity detachment. Feedback is aggregated to identify systemic operational bottlenecks.
                </p>
              </div>
            </div>
          </div>

          {/* Sentiment Summary Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
              background: '#f8fafc',
              padding: 16,
              borderRadius: 12
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>TOTAL ENTRIES</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{feedbackData.metrics.total}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700 }}>WORKPLACE CONCERNS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626' }}>
                {feedbackData.metrics.concerns}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>POSITIVE FEEDBACK</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>
                {feedbackData.metrics.positive}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#0284c7', fontWeight: 700 }}>GENERAL SUGGESTIONS</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>
                {feedbackData.metrics.neutral}
              </div>
            </div>
          </div>

          {/* Anonymous Comment Log */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Anonymized Worker Submissions:</h4>
            {feedbackData.items.map((fb) => (
              <div
                key={fb.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: 14,
                  background: '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    className="badge"
                    style={{
                      background:
                        fb.sentiment === 'concern' ? '#fee2e2' : fb.sentiment === 'positive' ? '#dcfce7' : '#f1f5f9',
                      color:
                        fb.sentiment === 'concern' ? '#991b1b' : fb.sentiment === 'positive' ? '#166534' : '#475569'
                    }}
                  >
                    {fb.sentiment} • {fb.category.replace('_', ' ')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    {new Date(fb.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p style={{ marginTop: 8, fontSize: '0.88rem', color: '#334155', lineHeight: 1.5 }}>"{fb.comment}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 5: SKILL PASSPORT VERIFICATION */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'skills' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <Award size={22} color="#0d9488" />
              <div>
                <h3 className="card-title">Worker Skill Passport & Qualification Verification</h3>
                <p className="card-desc">
                  Officially certify worker competencies under accredited construction & healthcare standards.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {skills.map((skill) => (
              <div
                key={skill.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#ffffff'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{skill.skillTitle}</div>
                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                    Category: {skill.category} • {skill.yearsExperience} Years Experience
                  </div>
                  {skill.isVerified ? (
                    <div style={{ fontSize: '0.78rem', color: '#166534', marginTop: 6, fontWeight: 600 }}>
                      ✓ Verified by {skill.verifierName} ({skill.verifierDesignation}) • Ref: {skill.certificateRef}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.78rem', color: '#d97706', marginTop: 6 }}>
                      ⏳ Worker self-reported. Awaiting authorized assessor verification.
                    </div>
                  )}
                </div>

                {!skill.isVerified && (
                  <button
                    className="btn-primary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                    onClick={() => handleVerifySkill(skill.id)}
                  >
                    <CheckCircle2 size={16} />
                    <span>Audit & Verify</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 6: CREATE SHIFT */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'create_shift' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <PlusCircle size={22} color="#0d9488" />
              <div>
                <h3 className="card-title">Schedule New Operational Shift</h3>
                <p className="card-desc">
                  Generates cryptographic site QR code token for verifiable worker attendance.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleCreateShift} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Shift Title *</label>
              <input
                className="form-input"
                type="text"
                value={newShiftTitle}
                onChange={(e) => setNewShiftTitle(e.target.value)}
                placeholder="e.g. Afternoon Gantry Launch & Concrete Inspection"
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Start Time *</label>
                <input
                  className="form-input"
                  type="time"
                  value={newShiftStart}
                  onChange={(e) => setNewShiftStart(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">End Time *</label>
                <input
                  className="form-input"
                  type="time"
                  value={newShiftEnd}
                  onChange={(e) => setNewShiftEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Site / Facility Location</label>
              <input
                className="form-input"
                type="text"
                value={newShiftLocation}
                onChange={(e) => setNewShiftLocation(e.target.value)}
                placeholder="e.g. Pier 18B Elevated Flyover or ICU Block 3"
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={newShiftIsOvernight}
                  onChange={(e) => setNewShiftIsOvernight(e.target.checked)}
                />
                <span>🌙 This is an overnight shift spanning past midnight (automatic calendar-day math)</span>
              </label>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              Create Shift & Issue QR Token
            </button>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: INSPECT & UPDATE SAFETY TICKET */}
      {/* ------------------------------------------------------------------ */}
      {inspectReport && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                Safety Incident Ticket: {inspectReport.referenceCode}
              </h3>
              <button className="modal-close-btn" onClick={() => setInspectReport(null)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <span
                  className="badge"
                  style={{
                    background:
                      inspectReport.severity === 'critical' ? '#fee2e2' : '#ffedd5',
                    color: inspectReport.severity === 'critical' ? '#991b1b' : '#9a3412'
                  }}
                >
                  {inspectReport.severity} SEVERITY
                </span>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 6 }}>{inspectReport.category}</h4>
                <div style={{ fontSize: '0.85rem', color: '#64748b' }}>📍 {inspectReport.location}</div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>INCIDENT DESCRIPTION:</div>
                <div style={{ fontSize: '0.9rem', color: '#1e293b', marginTop: 4 }}>"{inspectReport.description}"</div>
              </div>

              {inspectReport.photoDataUrl && (
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginBottom: 4 }}>
                    ATTACHED EVIDENCE PHOTO:
                  </div>
                  <img
                    src={inspectReport.photoDataUrl}
                    alt="Safety Incident Proof"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Lifecycle Status *</label>
                <select
                  className="form-select"
                  value={statusUpdateTarget}
                  onChange={(e) => setStatusUpdateTarget(e.target.value)}
                >
                  <option value="submitted">Submitted</option>
                  <option value="under_review">Under Review</option>
                  <option value="action_required">Action Required</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assigned Safety Officer</label>
                <input
                  className="form-input"
                  type="text"
                  value={assignedPersonInput}
                  onChange={(e) => setAssignedPersonInput(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Investigation & Resolution Notes</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={resolutionNoteInput}
                  onChange={(e) => setResolutionNoteInput(e.target.value)}
                  placeholder="Record corrective actions taken, contractor instructions, or engineering fixes..."
                />
              </div>

              <button className="btn-primary" onClick={handleSaveSafetyStatus} disabled={loading} style={{ width: '100%' }}>
                Save Audit & Update Ticket
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: REVIEW FATIGUE ADVISORY */}
      {/* ------------------------------------------------------------------ */}
      {inspectFatigue && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Fatigue Alert Review: {inspectFatigue.workerName}</h3>
              <button className="modal-close-btn" onClick={() => setInspectFatigue(null)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="alert-box alert-warning">
                <Activity size={20} />
                <div>
                  <strong>{inspectFatigue.metricValue}</strong>
                  <p style={{ marginTop: 4 }}>{inspectFatigue.explanation}</p>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Supervisor Mitigation Notes *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={fatigueReviewNote}
                  onChange={(e) => setFatigueReviewNote(e.target.value)}
                  required
                />
              </div>

              <button className="btn-primary" onClick={handleConfirmFatigueReview} disabled={loading} style={{ width: '100%' }}>
                Confirm Rest Assignment & Sign Off
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
