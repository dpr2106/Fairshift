import React, { useState, useEffect } from 'react';
import { User, Industry, Shift, AttendanceRecord, Payslip, SkillPassportItem } from '../../server/types.js';
import { Language, translations } from '../translations.js';
import { api } from '../api.js';
import {
  Clock,
  QrCode,
  Calendar,
  AlertTriangle,
  FileText,
  Volume2,
  Mic,
  MessageSquare,
  Award,
  CheckCircle2,
  AlertCircle,
  Camera,
  Info,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface WorkerPortalProps {
  currentUser: User;
  currentIndustry: Industry;
  currentLanguage: Language;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  currentUser,
  currentIndustry,
  currentLanguage
}) => {
  const t = translations[currentLanguage];

  // Active Tab
  const [activeTab, setActiveTab] = useState<'attendance' | 'payslip' | 'safety' | 'feedback' | 'skills'>('attendance');

  // Attendance State
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [activeAttendance, setActiveAttendance] = useState<AttendanceRecord | null>(null);
  const [selectedShiftForCheckIn, setSelectedShiftForCheckIn] = useState<string>('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrInputToken, setQrInputToken] = useState('');
  const [qrValidationError, setQrValidationError] = useState('');

  // Payslip State
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedPayslip, setSelectedPayslip] = useState<Payslip | null>(null);
  const [whyPayModalOpen, setWhyPayModalOpen] = useState(false);

  // Safety State
  const [safetyCategory, setSafetyCategory] = useState('');
  const [safetySeverity, setSafetySeverity] = useState<'low' | 'medium' | 'high' | 'critical'>('high');
  const [safetyDescription, setSafetyDescription] = useState('');
  const [safetyLocation, setSafetyLocation] = useState('');
  const [safetyMode, setSafetyMode] = useState<'named' | 'confidential' | 'anonymous'>('confidential');
  const [safetyPhotoPreview, setSafetyPhotoPreview] = useState<string>('');
  const [submittedSafetyRef, setSubmittedSafetyRef] = useState<string | null>(null);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  // Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState<'working_conditions' | 'management' | 'compensation' | 'equipment_safety'>('working_conditions');
  const [feedbackSentiment, setFeedbackSentiment] = useState<'positive' | 'neutral' | 'concern'>('concern');
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  // Skills State
  const [skills, setSkills] = useState<SkillPassportItem[]>([]);
  const [newSkillTitle, setNewSkillTitle] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('');
  const [newSkillYears, setNewSkillYears] = useState(2);
  const [skillModalOpen, setSkillModalOpen] = useState(false);

  const [workerReports, setWorkerReports] = useState<any[]>([]);
  const [workerFatigue, setWorkerFatigue] = useState<any[]>([]);

  // Status & Notification
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Load Initial Data
  const loadWorkerData = async () => {
    try {
      setLoading(true);
      const [availShifts, attRecords, workerPayslips, workerSkills, allReports, allFatigue] = await Promise.all([
        api.getShifts(currentIndustry),
        api.getAttendance(currentIndustry, currentUser.id),
        api.getPayslips(currentIndustry, currentUser.id),
        api.getSkills(currentUser.id),
        api.getSafetyReports(currentIndustry),
        api.getFatigueAlerts(currentIndustry)
      ]);

      setShifts(availShifts);
      setAttendance(attRecords);
      setPayslips(workerPayslips);
      if (workerPayslips.length > 0) setSelectedPayslip(workerPayslips[0]);
      setSkills(workerSkills);
      setWorkerReports(allReports.filter((r: any) => r.workerId === currentUser.id || (r.reporterDisplayName && r.reporterDisplayName.includes(currentUser.name))));
      setWorkerFatigue(allFatigue.filter((f: any) => f.workerId === currentUser.id && f.status === 'active'));

      // Check if user currently has an active shift
      const active = attRecords.find((r) => r.workerId === currentUser.id && r.checkOutTime === null);
      setActiveAttendance(active || null);

      if (availShifts.length > 0 && !selectedShiftForCheckIn) {
        setSelectedShiftForCheckIn(availShifts[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setNotification({ message: err.message || 'Error loading records', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkerData();
  }, [currentUser.id, currentIndustry]);

  // QR Check-in Handler
  const handleOpenCheckIn = (shiftId: string) => {
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) return;
    setSelectedShiftForCheckIn(shiftId);
    setQrInputToken(shift.qrCodeToken); // Pre-fill with the verified physical QR token for instant ease-of-use
    setQrValidationError('');
    setQrModalOpen(true);
  };

  const handleConfirmQrCheckIn = async () => {
    try {
      setLoading(true);
      setQrValidationError('');
      const targetShift = shifts.find((s) => s.id === selectedShiftForCheckIn);

      if (!targetShift) {
        setQrValidationError('Please select a shift first');
        return;
      }

      await api.checkIn(targetShift.id, 'qr', qrInputToken);
      setQrModalOpen(false);
      setNotification({
        message: `Successfully checked in to "${targetShift.title}". Working hours tracking is active.`,
        type: 'success'
      });
      await loadWorkerData();
    } catch (err: any) {
      setQrValidationError(err.message || 'QR validation failed');
    } finally {
      setLoading(false);
    }
  };

  // Check-out Handler
  const handleCheckOut = async () => {
    try {
      setLoading(true);
      const res = await api.checkOut(activeAttendance?.id);
      setNotification({
        message: `Shift checked out successfully! Total regular hours: ${res.record.regularHours}h, Overtime: ${res.record.overtimeHours}h. Status: Pending supervisor review.`,
        type: 'success'
      });

      if (res.fatigueAlertTriggered && res.fatigueAlert) {
        setNotification({
          message: `⚠️ Rest Advisory: ${res.fatigueAlert.explanation}`,
          type: 'warning'
        });
      }

      await loadWorkerData();
    } catch (err: any) {
      setNotification({ message: err.message || 'Error checking out', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Web Speech API Voice-to-Text for Safety Hazards
  const handleToggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your description.');
      return;
    }

    if (isListeningVoice) {
      setIsListeningVoice(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = currentLanguage === 'ta' ? 'ta-IN' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListeningVoice(true);

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSafetyDescription((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListeningVoice(false);
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Voice recognition initialization error:', err);
      setIsListeningVoice(false);
    }
  };

  // Read Payslip Aloud (Text-to-Speech)
  const handleReadPayslipAloud = () => {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis is not available on this device.');
      return;
    }

    if (!selectedPayslip) return;

    window.speechSynthesis.cancel(); // Stop any existing speech

    let speechText = '';
    if (currentLanguage === 'ta') {
      speechText = `வணக்கம் ${currentUser.name}. உங்கள் சம்பள விவரம். வழக்கமான வேலை நேரம் ${selectedPayslip.regularHours} மணி நேரங்கள். கூடுதல் வேலை நேரம் ${selectedPayslip.overtimeHours} மணி நேரங்கள். மொத்த வருமானம் ${selectedPayslip.grossPay} ரூபாய். பிடித்தங்கள் போக நிகர சம்பளம் ${selectedPayslip.netPay} ரூபாய். இந்த தொகை உங்கள் வங்கி கணக்கில் செலுத்தப்படும்.`;
    } else {
      speechText = `Hello ${currentUser.name}. Here is your transparent payslip breakdown. You worked ${selectedPayslip.regularHours} standard hours and ${selectedPayslip.overtimeHours} overtime hours. Your gross earnings are ${selectedPayslip.currency}${selectedPayslip.grossPay}. Total statutory deductions are ${selectedPayslip.currency}${selectedPayslip.totalDeductions}. Your net take-home pay is ${selectedPayslip.currency}${selectedPayslip.netPay}.`;
    }

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = currentLanguage === 'ta' ? 'ta-IN' : 'en-US';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  // Submit Safety Report
  const handleSubmitSafetyReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safetyCategory || !safetyDescription) {
      setNotification({ message: 'Please select a hazard category and provide a description.', type: 'error' });
      return;
    }

    try {
      setLoading(true);
      const res = await api.submitSafetyReport({
        category: safetyCategory,
        severity: safetySeverity,
        description: safetyDescription,
        location: safetyLocation || (currentIndustry === 'construction' ? 'Pier 14 Site Area' : 'Ward 3 Corridor'),
        reporterMode: safetyMode,
        photoDataUrl: safetyPhotoPreview || undefined,
        industry: currentIndustry
      });

      setSubmittedSafetyRef(res.referenceCode);
      setSafetyDescription('');
      setSafetyPhotoPreview('');
      setNotification({
        message: `Safety report submitted successfully! Reference: ${res.referenceCode}`,
        type: 'success'
      });
    } catch (err: any) {
      setNotification({ message: err.message || 'Failed to submit report', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Submit Feedback
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;

    try {
      setLoading(true);
      await api.submitFeedback({
        category: feedbackCategory,
        sentiment: feedbackSentiment,
        comment: feedbackText,
        mode: 'anonymous',
        industry: currentIndustry
      });

      setFeedbackSuccess(true);
      setFeedbackText('');
      setTimeout(() => setFeedbackSuccess(false), 5000);
      setNotification({
        message: 'Your anonymous feedback has been recorded safely. Worker identity is not attached.',
        type: 'success'
      });
    } catch (err: any) {
      setNotification({ message: err.message || 'Error submitting feedback', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Add Skill
  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillTitle) return;

    try {
      setLoading(true);
      const created = await api.addSkill({
        skillTitle: newSkillTitle,
        category: newSkillCategory || 'General Operations',
        yearsExperience: Number(newSkillYears) || 1
      });

      setSkills((prev) => [created, ...prev]);
      setSkillModalOpen(false);
      setNewSkillTitle('');
      setNotification({
        message: 'Skill successfully added to your portable passport! Marked as self-reported until employer verification.',
        type: 'success'
      });
    } catch (err: any) {
      setNotification({ message: err.message || 'Error adding skill', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="worker-layout">
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
            <AlertCircle size={20} />
          ) : notification.type === 'warning' ? (
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

      {/* Worker Profile Card */}
      <div className="fair-card" style={{ padding: '16px 20px', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>
              {currentIndustry === 'construction' ? '🏗️ Construction Division' : '🏥 Healthcare Services'}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: '#0d9488', fontWeight: 600 }}>
              {currentUser.designation}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge badge-approved">
              ₹{currentUser.hourlyRate}/hr Base
            </span>
            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 4 }}>
              1.5x OT Multiplier
            </div>
          </div>
        </div>
      </div>

      {/* Worker Portal Navigation Tabs (Large Touch Targets) */}
      <nav className="portal-nav-bar" aria-label="Worker Sections">
        <button
          className={`nav-tab-item ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <Clock size={18} />
          <span>{t.shifts}</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'payslip' ? 'active' : ''}`}
          onClick={() => setActiveTab('payslip')}
        >
          <FileText size={18} />
          <span>{t.payslip}</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => setActiveTab('safety')}
        >
          <AlertTriangle size={18} />
          <span>{t.safety}</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setActiveTab('feedback')}
        >
          <MessageSquare size={18} />
          <span>{t.feedback}</span>
        </button>
        <button
          className={`nav-tab-item ${activeTab === 'skills' ? 'active' : ''}`}
          onClick={() => setActiveTab('skills')}
        >
          <Award size={18} />
          <span>{t.skills}</span>
        </button>
      </nav>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: SHIFTS & ATTENDANCE */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'attendance' && (
        <>
          {/* Active Rest & Fatigue Advisory Banner */}
          {workerFatigue.length > 0 && (
            <div className="alert-box alert-warning" role="region" aria-label="Rest and Fatigue Advisory">
              <AlertTriangle size={22} color="#d97706" />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#92400e' }}>
                  {t.fatigueWarningTitle}: {workerFatigue[0].metricValue}
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: 4, color: '#78350f' }}>
                  {workerFatigue[0].explanation}
                </div>
                <div style={{ fontSize: '0.78rem', marginTop: 6, fontWeight: 700, color: '#92400e' }}>
                  ℹ️ {t.fatigueExplanation}
                </div>
              </div>
            </div>
          )}

          {/* Active Shift Hero Card */}
          {activeAttendance ? (
            <div className="active-shift-hero">
              <div className="hero-status-pill">
                <span className="live-pulse-dot" />
                <span>{t.checkedIn}</span>
              </div>
              <h2 className="hero-shift-title">{activeAttendance.shiftTitle}</h2>
              <div className="hero-meta-row">
                <span>📍 {activeAttendance.industry === 'construction' ? 'Metro Pier Site 14' : 'Hospital Ward 3'}</span>
                <span>⏱️ Check-In: {new Date(activeAttendance.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>🔐 Verified by Site QR</span>
              </div>

              <div className="hero-metric-box">
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    Shift In Progress
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#e2e8f0', marginTop: 2 }}>
                    Overtime automatically calculated past 8.0 hrs
                  </div>
                </div>
                <div className="hero-big-timer">LIVE</div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button
                  className="btn-danger"
                  style={{ width: '100%' }}
                  onClick={handleCheckOut}
                  disabled={loading}
                >
                  <Clock size={20} />
                  <span>{t.checkOut}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="fair-card">
              <div className="fair-card-header">
                <div className="card-title-group">
                  <Clock size={22} color="#0d9488" />
                  <div>
                    <h2 className="card-title">{t.todayStatus}</h2>
                    <p className="card-desc">{t.noActiveShift}</p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <label className="form-label">Available Scheduled Shifts Today:</label>
                {shifts.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: 14,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f8fafc'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{s.title}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                        🕒 {s.startTime} - {s.endTime} ({s.durationHours}h) • 📍 {s.siteLocation}
                        {s.isOvernight && (
                          <span
                            style={{
                              marginLeft: 6,
                              background: '#ede9fe',
                              color: '#6d28d9',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '0.7rem',
                              fontWeight: 700
                            }}
                          >
                            🌙 Overnight
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      style={{ padding: '8px 14px', fontSize: '0.88rem' }}
                      onClick={() => handleOpenCheckIn(s.id)}
                    >
                      <QrCode size={16} />
                      <span>{t.checkIn}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendance History */}
          <div className="fair-card">
            <h3 className="card-title" style={{ fontSize: '1.05rem' }}>
              Attendance & Overtime Log
            </h3>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Regular</th>
                    <th>Overtime</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((rec) => (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: 600 }}>{rec.date}</td>
                      <td>{rec.shiftTitle}</td>
                      <td>{rec.regularHours}h</td>
                      <td style={{ color: rec.overtimeHours > 0 ? '#d97706' : 'inherit', fontWeight: 600 }}>
                        {rec.overtimeHours > 0 ? `+${rec.overtimeHours}h OT` : '0h'}
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
                          {rec.status === 'approved' ? t.approved : rec.status === 'disputed' ? t.disputed : t.pending}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: TRANSPARENT PAYSLIP */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'payslip' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <FileText size={22} color="#0d9488" />
              <div>
                <h2 className="card-title">{t.payslip}</h2>
                <p className="card-desc">Accurate decimal math with line-by-line transparency</p>
              </div>
            </div>
            <button className="btn-outline-primary" onClick={handleReadPayslipAloud} title="Read payslip in audio">
              <Volume2 size={18} />
              <span>{t.readAloud}</span>
            </button>
          </div>

          {selectedPayslip ? (
            <>
              {/* Summary Box */}
              <div className="payslip-summary-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: '#0f766e', fontWeight: 700 }}>
                    Period: {selectedPayslip.periodStart} to {selectedPayslip.periodEnd}
                  </span>
                  <span className="badge badge-approved">
                    {selectedPayslip.status === 'approved' ? 'Audit Approved' : 'Real-time Estimate'}
                  </span>
                </div>

                <div className="payslip-metric-grid">
                  <div className="metric-tile">
                    <div className="metric-tile-label">{t.regularHours}</div>
                    <div className="metric-tile-val">{selectedPayslip.regularHours} hrs</div>
                  </div>
                  <div className="metric-tile">
                    <div className="metric-tile-label">{t.overtimeHours}</div>
                    <div className="metric-tile-val" style={{ color: '#d97706' }}>
                      {selectedPayslip.overtimeHours} hrs
                    </div>
                  </div>
                  <div className="metric-tile">
                    <div className="metric-tile-label">{t.grossPay}</div>
                    <div className="metric-tile-val">
                      {selectedPayslip.currency}
                      {selectedPayslip.grossPay.toLocaleString()}
                    </div>
                  </div>
                  <div className="metric-tile" style={{ background: '#f0fdf4', borderColor: '#86efac' }}>
                    <div className="metric-tile-label" style={{ color: '#166534' }}>
                      {t.netPay}
                    </div>
                    <div className="metric-tile-val" style={{ color: '#15803d' }}>
                      {selectedPayslip.currency}
                      {selectedPayslip.netPay.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Explanatory Line Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                  Itemized Mathematical Breakdown:
                </h4>
                {selectedPayslip.lineItems.map((item) => (
                  <div key={item.id} className="payslip-line-item">
                    <div style={{ paddingRight: 12 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.label}</div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: 'monospace', marginTop: 2 }}>
                        {item.formula}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 2 }}>{item.detail}</div>
                    </div>
                    <div
                      className={`line-item-amount ${
                        item.type === 'earning' ? 'line-item-earning' : 'line-item-deduction'
                      }`}
                    >
                      {item.type === 'earning' ? '+' : '-'}
                      {selectedPayslip.currency}
                      {item.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Button: Why is my pay this amount? */}
              <button
                className="btn-secondary"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => setWhyPayModalOpen(true)}
              >
                <Info size={18} color="#0d9488" />
                <span>{t.whyThisAmount}</span>
              </button>
            </>
          ) : (
            <p>No payslip generated yet for this period.</p>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: SAFETY REPORTING */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'safety' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <AlertTriangle size={22} color="#dc2626" />
              <div>
                <h2 className="card-title">{t.reportHazard}</h2>
                <p className="card-desc">Protect yourself and co-workers without fear of retaliation</p>
              </div>
            </div>
          </div>

          {/* Emergency Warning Strip */}
          <div className="alert-box alert-danger">
            <AlertCircle size={20} />
            <div>{t.emergencyNotice}</div>
          </div>

          <form onSubmit={handleSubmitSafetyReport} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Category Selector (Industry Specific) */}
            <div className="form-group">
              <label className="form-label">{t.hazardCategory} *</label>
              <select
                className="form-select"
                value={safetyCategory}
                onChange={(e) => setSafetyCategory(e.target.value)}
                required
              >
                <option value="">Select hazard category...</option>
                {currentIndustry === 'construction' ? (
                  <>
                    <option value="Scaffold & Fall Hazard">Scaffolding / Working at Height / Fall Hazard</option>
                    <option value="Electrical & Wiring">Exposed Wiring / Unshielded Generator Cable</option>
                    <option value="Heavy Machinery / Crane">Crane Blind Spots / Reverse Alarm Malfunction</option>
                    <option value="Dust & Respirable Silica">Excessive Dust / Inadequate Water Sprinklers</option>
                    <option value="Missing PPE / Safety Gear">Damaged Helmets, Harnesses, or Eye Shields</option>
                  </>
                ) : (
                  <>
                    <option value="Biohazard & Sharps Exposure">Overflowing Sharps Bin / Protruding Needles</option>
                    <option value="Chemical Disinfectant Spill">Spilled Glutaraldehyde / Corrosive Cleaner</option>
                    <option value="Pathogen & Airborne Infection">Compromised Negative Pressure / Isolation Door</option>
                    <option value="Slips, Trips & Wet Surfaces">Wet Corridor Floor Without Caution Signs</option>
                    <option value="Physical Fatigue / Violent Incident">Emergency Ward Aggression / Ergonomic Strain</option>
                  </>
                )}
              </select>
            </div>

            {/* Severity Picker */}
            <div className="form-group">
              <label className="form-label">{t.severity} *</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(['low', 'medium', 'high', 'critical'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSafetySeverity(lvl)}
                    style={{
                      padding: '10px 4px',
                      borderRadius: 8,
                      border: safetySeverity === lvl ? '2px solid #0f172a' : '1px solid #cbd5e1',
                      background:
                        lvl === 'critical'
                          ? '#fee2e2'
                          : lvl === 'high'
                          ? '#ffedd5'
                          : lvl === 'medium'
                          ? '#fef9c3'
                          : '#ecfdf5',
                      fontWeight: safetySeverity === lvl ? 800 : 600,
                      color:
                        lvl === 'critical'
                          ? '#991b1b'
                          : lvl === 'high'
                          ? '#9a3412'
                          : lvl === 'medium'
                          ? '#854d0e'
                          : '#065f46',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      textTransform: 'uppercase'
                    }}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Voice Input + Description */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">{t.describeHazard} *</label>
                <button
                  type="button"
                  className={`btn-secondary ${isListeningVoice ? 'mic-btn-active' : ''}`}
                  onClick={handleToggleVoiceInput}
                  style={{ padding: '4px 10px', fontSize: '0.8rem', minHeight: '36px' }}
                >
                  <Mic size={14} />
                  <span>{isListeningVoice ? t.listening : t.voiceInput}</span>
                </button>
              </div>
              <textarea
                className="form-textarea"
                rows={3}
                value={safetyDescription}
                onChange={(e) => setSafetyDescription(e.target.value)}
                placeholder="What did you see? Where is the danger located?"
                required
              />
            </div>

            {/* Site Location */}
            <div className="form-group">
              <label className="form-label">{t.location}</label>
              <input
                className="form-input"
                type="text"
                value={safetyLocation}
                onChange={(e) => setSafetyLocation(e.target.value)}
                placeholder="e.g. Pier 14B, Level 4 or Ward 3 Corridor Ramp"
              />
            </div>

            {/* Photo Attachment (Safe Simulation) */}
            <div className="form-group">
              <label className="form-label">Attach Photo Evidence (Optional):</label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const mockSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23fee2e2"/><text x="150" y="100" fill="%23b91c1c" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">Hazard Photo Verified</text><text x="150" y="125" fill="%23666" font-family="sans-serif" font-size="11" text-anchor="middle">${safetyCategory || 'Safety Inspection'}</text></svg>`;
                    setSafetyPhotoPreview(mockSvg);
                  }}
                  style={{ minHeight: '40px' }}
                >
                  <Camera size={16} />
                  <span>Attach Site Photo</span>
                </button>
                {safetyPhotoPreview && (
                  <span style={{ fontSize: '0.82rem', color: '#16a34a', fontWeight: 600 }}>
                    ✓ Photo attached (Safe SVG)
                  </span>
                )}
              </div>
            </div>

            {/* Reporter Mode Picker */}
            <div className="form-group">
              <label className="form-label">{t.reporterMode}</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                  <input
                    type="radio"
                    name="reporterMode"
                    value="confidential"
                    checked={safetyMode === 'confidential'}
                    onChange={() => setSafetyMode('confidential')}
                  />
                  <span>Confidential (Known only to Safety Officer)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                  <input
                    type="radio"
                    name="reporterMode"
                    value="anonymous"
                    checked={safetyMode === 'anonymous'}
                    onChange={() => setSafetyMode('anonymous')}
                  />
                  <span>Strictly Anonymous (Identity detached)</span>
                </label>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              <ShieldCheck size={20} />
              <span>{t.submitReport}</span>
            </button>
          </form>

          {submittedSafetyRef && (
            <div className="alert-box alert-info" style={{ marginTop: 12 }}>
              <CheckCircle2 size={20} />
              <div>
                <strong>Report Reference Number: {submittedSafetyRef}</strong>
                <p style={{ marginTop: 4 }}>
                  Your incident ticket is in the queue. You can check back anytime to see supervisor inspection notes.
                </p>
              </div>
            </div>
          )}

          {/* Real-time Status Tracker of Worker's Reports */}
          {workerReports.length > 0 && (
            <div style={{ marginTop: 16, borderTop: '1px solid #e2e8f0', paddingTop: 16 }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
                📋 {t.myReports} ({workerReports.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {workerReports.map((r: any) => (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 10,
                      padding: 12,
                      background: '#f8fafc'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.82rem', color: '#0f766e' }}>
                          {r.referenceCode}
                        </span>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', marginTop: 2 }}>
                          {r.category}
                        </div>
                      </div>
                      <span
                        className={`badge ${
                          r.status === 'resolved'
                            ? 'badge-resolved'
                            : r.status === 'action_required'
                            ? 'badge-disputed'
                            : 'badge-pending'
                        }`}
                      >
                        {r.status === 'resolved'
                          ? t.resolved
                          : r.status === 'action_required'
                          ? t.actionRequired
                          : r.status === 'under_review'
                          ? t.underReview
                          : t.submitted}
                      </span>
                    </div>

                    {/* Visual 4-Step Lifecycle */}
                    <div className="lifecycle-stepper" style={{ marginTop: 8 }}>
                      <div className={`lifecycle-step ${['submitted', 'under_review', 'action_required', 'resolved'].includes(r.status) ? 'completed' : ''}`}>
                        1. {t.submitted}
                      </div>
                      <div className={`lifecycle-step ${['under_review', 'action_required', 'resolved'].includes(r.status) ? 'completed' : ''}`}>
                        2. {t.underReview}
                      </div>
                      <div className={`lifecycle-step ${['action_required', 'resolved'].includes(r.status) ? (r.status === 'action_required' ? 'active' : 'completed') : ''}`}>
                        3. {t.actionRequired}
                      </div>
                      <div className={`lifecycle-step ${r.status === 'resolved' ? 'completed' : ''}`}>
                        4. {t.resolved}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#475569', marginTop: 6 }}>
                      📍 {r.location}
                    </div>

                    {r.assignedPerson && (
                      <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: 4, fontWeight: 600 }}>
                        👮 {t.assignedOfficer}: {r.assignedPerson}
                      </div>
                    )}

                    {r.resolutionNotes && (
                      <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: 6, padding: 8, marginTop: 6, fontSize: '0.78rem', color: '#166534' }}>
                        <strong>{t.resolutionNotes}:</strong> "{r.resolutionNotes}"
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: CONFIDENTIAL WORKPLACE FEEDBACK */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'feedback' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <MessageSquare size={22} color="#0284c7" />
              <div>
                <h2 className="card-title">{t.feedback}</h2>
                <p className="card-desc">Share honest feedback on management, safety, or site conditions</p>
              </div>
            </div>
          </div>

          <div className="alert-box alert-info">
            <Info size={20} />
            <div>
              <strong>Privacy Guarantee:</strong> {t.anonymousNotice}
            </div>
          </div>

          <form onSubmit={handleSubmitFeedback} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Topic / Category:</label>
              <select
                className="form-select"
                value={feedbackCategory}
                onChange={(e: any) => setFeedbackCategory(e.target.value)}
              >
                <option value="working_conditions">Working Conditions & Rest Areas</option>
                <option value="equipment_safety">Equipment, Tools & Gear Availability</option>
                <option value="compensation">Wages, Overtime Transparency & Muster Rolls</option>
                <option value="management">Supervisor Behavior & Fair Treatment</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Sentiment:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {[
                  { id: 'concern', label: '⚠️ Concern / Issue', color: '#fef3c7', text: '#92400e' },
                  { id: 'neutral', label: 'ℹ️ Suggestion', color: '#f1f5f9', text: '#475569' },
                  { id: 'positive', label: '✅ Good Practice', color: '#dcfce7', text: '#166534' }
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFeedbackSentiment(s.id as any)}
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: feedbackSentiment === s.id ? '2px solid #0f172a' : '1px solid #cbd5e1',
                      background: s.color,
                      color: s.text,
                      fontWeight: feedbackSentiment === s.id ? 800 : 600,
                      cursor: 'pointer',
                      fontSize: '0.82rem'
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Your Feedback / Concern:</label>
              <textarea
                className="form-textarea"
                rows={4}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Write your honest comments here. Your name and phone number will NEVER be recorded."
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
              <ShieldCheck size={20} />
              <span>Submit Protected Feedback</span>
            </button>
          </form>

          {feedbackSuccess && (
            <div className="alert-box alert-info" style={{ marginTop: 12 }}>
              <CheckCircle2 size={20} />
              <div>Feedback recorded anonymously. It has been routed to the aggregated executive summary.</div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 5: SKILL PASSPORT */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'skills' && (
        <div className="fair-card">
          <div className="fair-card-header">
            <div className="card-title-group">
              <Award size={22} color="#0d9488" />
              <div>
                <h2 className="card-title">{t.skills}</h2>
                <p className="card-desc">Your portable record of certifications, experience, and training</p>
              </div>
            </div>
            <button className="btn-primary" style={{ padding: '8px 14px' }} onClick={() => setSkillModalOpen(true)}>
              + {t.addSkill}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {skills.map((skill) => (
              <div
                key={skill.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  background: skill.isVerified ? '#f0fdf4' : '#fafafa',
                  borderColor: skill.isVerified ? '#bbf7d0' : '#e2e8f0'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{skill.skillTitle}</div>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: 2 }}>
                      {skill.category} • {skill.yearsExperience} Years Practical Experience
                    </div>
                  </div>
                  <span className={`badge ${skill.isVerified ? 'badge-approved' : 'badge-pending'}`}>
                    {skill.isVerified ? `✓ ${t.verifiedBadge}` : t.unverifiedBadge}
                  </span>
                </div>

                {skill.isVerified ? (
                  <div
                    style={{
                      marginTop: 10,
                      padding: 10,
                      background: 'rgba(255,255,255,0.8)',
                      borderRadius: 8,
                      fontSize: '0.78rem',
                      color: '#166534',
                      border: '1px solid #bbf7d0'
                    }}
                  >
                    <div>
                      <strong>Verified By:</strong> {skill.verifierName} ({skill.verifierDesignation})
                    </div>
                    <div>
                      <strong>Audit Ref:</strong> {skill.certificateRef} • <strong>Date:</strong> {skill.verifiedAt}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: '0.75rem', color: '#94a3b8' }}>
                    Worker-entered record. Pending audit sign-off by site assessor or training superintendent.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: QR SCANNER & VERIFICATION */}
      {/* ------------------------------------------------------------------ */}
      {qrModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Site QR Code Verification</h3>
              <button className="modal-close-btn" onClick={() => setQrModalOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  width: 140,
                  height: 140,
                  margin: '0 auto',
                  background: '#f1f5f9',
                  border: '2px dashed #0d9488',
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <QrCode size={80} color="#0d9488" />
              </div>
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: 12 }}>
                Point camera at physical Gate Scanner or confirm the verified token below:
              </p>
            </div>

            {qrValidationError && <div className="alert-box alert-danger">{qrValidationError}</div>}

            <div className="form-group">
              <label className="form-label">Verified Workplace Token:</label>
              <input
                className="form-input"
                type="text"
                value={qrInputToken}
                onChange={(e) => setQrInputToken(e.target.value)}
              />
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%' }}
              onClick={handleConfirmQrCheckIn}
              disabled={loading}
            >
              <CheckCircle2 size={18} />
              <span>Validate & Record Attendance</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: WHY IS MY PAY THIS AMOUNT? */}
      {/* ------------------------------------------------------------------ */}
      {whyPayModalOpen && selectedPayslip && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Transparent Calculation Explainer</h3>
              <button className="modal-close-btn" onClick={() => setWhyPayModalOpen(false)}>
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem', color: '#334155' }}>
              <p>
                Under <strong>FairShift</strong>, every rupee is mathematically derived from your confirmed shift
                timestamps:
              </p>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <strong>1. Base Wage Calculation:</strong>
                <div>
                  {selectedPayslip.regularHours} regular hours × {selectedPayslip.currency}
                  {selectedPayslip.regularRate.toFixed(2)}/hr ={' '}
                  <strong>
                    {selectedPayslip.currency}
                    {(selectedPayslip.regularHours * selectedPayslip.regularRate).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <strong>2. Overtime Multiplier (Statutory 1.5x):</strong>
                <div>
                  {selectedPayslip.overtimeHours} overtime hours × {selectedPayslip.currency}
                  {selectedPayslip.overtimeRate.toFixed(2)}/hr (1.5x regular rate) ={' '}
                  <strong>
                    {selectedPayslip.currency}
                    {(selectedPayslip.overtimeHours * selectedPayslip.overtimeRate).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <strong>3. Deductions:</strong>
                <div>
                  EPF (12% retirement fund) + ESIC (0.75% health cover) + State Welfare Board fee ={' '}
                  <strong>
                    -{selectedPayslip.currency}
                    {selectedPayslip.totalDeductions.toFixed(2)}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  background: '#ecfdf5',
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #86efac',
                  color: '#15803d'
                }}
              >
                <strong>Final Take-Home:</strong> {selectedPayslip.currency}
                {selectedPayslip.netPay.toFixed(2)}
              </div>
            </div>

            <button className="btn-secondary" onClick={() => setWhyPayModalOpen(false)}>
              Close Explainer
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: ADD SKILL */}
      {/* ------------------------------------------------------------------ */}
      {skillModalOpen && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Add Skill to Digital Passport</h3>
              <button className="modal-close-btn" onClick={() => setSkillModalOpen(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSkill} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">{t.skillName} *</label>
                <input
                  className="form-input"
                  type="text"
                  value={newSkillTitle}
                  onChange={(e) => setNewSkillTitle(e.target.value)}
                  placeholder="e.g. Scaffolding Rigger L2 or Biohazard Containment"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Domain / Category:</label>
                <input
                  className="form-input"
                  type="text"
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value)}
                  placeholder="e.g. Structural Safety, Infection Control, High Voltage"
                />
              </div>

              <div className="form-group">
                <label className="form-label">{t.experienceYears}:</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  max={40}
                  value={newSkillYears}
                  onChange={(e) => setNewSkillYears(Number(e.target.value))}
                />
              </div>

              <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
                {t.saveSkill}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
