export type Industry = 'construction' | 'healthcare';

export type UserRole = 'worker' | 'manager' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  organizationId: string;
  industry: Industry;
  designation: string;
  hourlyRate: number;
  overtimeRateMultiplier: number;
}

export interface Organization {
  id: string;
  name: string;
  industry: Industry;
  code: string;
  config: {
    maxConsecutiveHoursWarning: number;
    minRestHoursWarning: number;
    overtimeDailyThreshold: number;
    hazardCategories: string[];
    roles: string[];
    currencySymbol: string;
  };
}

export interface Shift {
  id: string;
  organizationId: string;
  industry: Industry;
  title: string;
  startTime: string; // ISO string or HH:mm
  endTime: string;
  durationHours: number;
  isOvernight: boolean;
  requiredRole: string;
  siteLocation: string;
  qrCodeToken: string;
}

export type AttendanceStatus = 'pending' | 'approved' | 'disputed';

export interface AttendanceRecord {
  id: string;
  workerId: string;
  workerName: string;
  organizationId: string;
  industry: Industry;
  shiftId: string;
  shiftTitle: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO string
  checkOutTime: string | null;
  regularHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  verificationMethod: 'qr' | 'manual' | 'geo';
  disputeNotes?: string;
  reviewNotes?: string;
}

export interface PayslipLineItem {
  id: string;
  label: string;
  type: 'earning' | 'deduction';
  amount: number;
  formula: string;
  detail: string;
}

export interface Payslip {
  id: string;
  workerId: string;
  workerName: string;
  organizationId: string;
  industry: Industry;
  periodStart: string;
  periodEnd: string;
  regularHours: number;
  overtimeHours: number;
  regularRate: number;
  overtimeRate: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  currency: string;
  status: 'estimate' | 'approved' | 'disbursed';
  lineItems: PayslipLineItem[];
  generatedAt: string;
}

export type HazardSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReportStatus = 'submitted' | 'under_review' | 'action_required' | 'resolved';
export type ReporterMode = 'named' | 'confidential' | 'anonymous';

export interface SafetyReport {
  id: string;
  referenceCode: string;
  organizationId: string;
  industry: Industry;
  category: string;
  severity: HazardSeverity;
  description: string;
  location: string;
  reporterMode: ReporterMode;
  workerId?: string; // Stored securely, never exposed in API if anonymous
  reporterDisplayName?: string; // "Anonymous Worker" if anonymous
  hasPhoto: boolean;
  photoDataUrl?: string;
  status: ReportStatus;
  assignedPerson?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkplaceFeedback {
  id: string;
  organizationId: string;
  industry: Industry;
  category: 'working_conditions' | 'management' | 'compensation' | 'equipment_safety';
  mode: 'anonymous' | 'confidential';
  sentiment: 'positive' | 'neutral' | 'concern';
  comment: string;
  createdAt: string;
}

export interface FatigueAlert {
  id: string;
  workerId: string;
  workerName: string;
  organizationId: string;
  industry: Industry;
  triggerType: 'excessive_hours' | 'insufficient_rest' | 'back_to_back';
  metricValue: string;
  explanation: string;
  severity: 'moderate' | 'high';
  status: 'active' | 'reviewed';
  reviewedBy?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface SkillPassportItem {
  id: string;
  workerId: string;
  skillTitle: string;
  category: string;
  yearsExperience: number;
  isVerified: boolean;
  verifierName?: string;
  verifierDesignation?: string;
  verifiedAt?: string;
  certificateRef?: string;
}
