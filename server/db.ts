import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'fairshift_db.json');

export interface DatabaseSchema {
  organizations: Organization[];
  users: User[];
  shifts: Shift[];
  attendance: AttendanceRecord[];
  payslips: Payslip[];
  safetyReports: SafetyReport[];
  feedback: WorkplaceFeedback[];
  fatigueAlerts: FatigueAlert[];
  skills: SkillPassportItem[];
}

function getSeedData(): DatabaseSchema {
  const organizations: Organization[] = [
    {
      id: 'org-const-01',
      name: 'Apex Metro Infrastructure (Phase 2)',
      industry: 'construction',
      code: 'APEX-CON',
      config: {
        maxConsecutiveHoursWarning: 10,
        minRestHoursWarning: 11,
        overtimeDailyThreshold: 8,
        hazardCategories: [
          'Scaffold & Fall Hazard',
          'Electrical & Wiring',
          'Heavy Machinery / Crane',
          'Dust & Respirable Silica',
          'Missing PPE / Safety Gear',
          'Structural Integrity'
        ],
        roles: ['Mason / Rigger', 'Site Electrician', 'Steel Fixer', 'Heavy Equipment Operator', 'Safety Marshall'],
        currencySymbol: '₹'
      }
    },
    {
      id: 'org-health-01',
      name: 'Kaveri Multi-Speciality Hospital',
      industry: 'healthcare',
      code: 'KAVERI-MED',
      config: {
        maxConsecutiveHoursWarning: 10,
        minRestHoursWarning: 11,
        overtimeDailyThreshold: 8,
        hazardCategories: [
          'Biohazard & Sharps Exposure',
          'Chemical Disinfectant Spill',
          'Pathogen & Airborne Infection',
          'Slips, Trips & Wet Surfaces',
          'Broken Medical Gas / Oxygen Lines',
          'Physical Fatigue / Violent Patient Incident'
        ],
        roles: ['Sanitation Specialist', 'Auxiliary Nurse Tech', 'Facilities Mechanic', 'Biomedical Waste Handler', 'Ward Support'],
        currencySymbol: '₹'
      }
    }
  ];

  const users: User[] = [
    // Construction Workers
    {
      id: 'usr-worker-murugan',
      name: 'Murugan K.',
      email: 'murugan.k@fairshift.worker',
      phone: '+91 98401 23456',
      role: 'worker',
      organizationId: 'org-const-01',
      industry: 'construction',
      designation: 'Mason / High-Elevation Rigger',
      hourlyRate: 110, // ₹110/hr (~₹880/8h shift)
      overtimeRateMultiplier: 1.5
    },
    {
      id: 'usr-worker-rajesh',
      name: 'Rajesh V.',
      email: 'rajesh.v@fairshift.worker',
      phone: '+91 98402 34567',
      role: 'worker',
      organizationId: 'org-const-01',
      industry: 'construction',
      designation: 'Site Electrician',
      hourlyRate: 125,
      overtimeRateMultiplier: 1.5
    },
    // Healthcare Workers
    {
      id: 'usr-worker-priya',
      name: 'Priya Selvam',
      email: 'priya.s@fairshift.worker',
      phone: '+91 98403 45678',
      role: 'worker',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      designation: 'Sanitation Specialist & Biohazard Handler',
      hourlyRate: 115,
      overtimeRateMultiplier: 1.5
    },
    {
      id: 'usr-worker-deepa',
      name: 'Deepa Sundaram',
      email: 'deepa.s@fairshift.worker',
      phone: '+91 98404 56789',
      role: 'worker',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      designation: 'Ward Auxiliary Nurse Tech',
      hourlyRate: 130,
      overtimeRateMultiplier: 1.5
    },
    // Managers
    {
      id: 'usr-mgr-arumugam',
      name: 'Arumugam Ramanathan',
      email: 'arumugam@apexinfra.in',
      phone: '+91 98400 11111',
      role: 'manager',
      organizationId: 'org-const-01',
      industry: 'construction',
      designation: 'Lead Project Engineer & Site Safety Officer',
      hourlyRate: 250,
      overtimeRateMultiplier: 1.0
    },
    {
      id: 'usr-mgr-malathi',
      name: 'Dr. Malathi Chandran',
      email: 'malathi.c@kaverihospital.in',
      phone: '+91 98400 22222',
      role: 'manager',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      designation: 'Chief of Facilities & Healthcare Operations',
      hourlyRate: 280,
      overtimeRateMultiplier: 1.0
    },
    // Super Admin / Auditor
    {
      id: 'usr-admin-compliance',
      name: 'FairShift System Administrator',
      email: 'admin@fairshift.org',
      phone: '+91 98400 00000',
      role: 'admin',
      organizationId: 'org-const-01',
      industry: 'construction',
      designation: 'Workplace Fairness & Decent Work Auditor',
      hourlyRate: 300,
      overtimeRateMultiplier: 1.0
    }
  ];

  const shifts: Shift[] = [
    // Construction Shifts
    {
      id: 'shift-c-01',
      organizationId: 'org-const-01',
      industry: 'construction',
      title: 'Day Shift: Pier Capping & Rebar Binding',
      startTime: '08:00',
      endTime: '17:00',
      durationHours: 8,
      isOvernight: false,
      requiredRole: 'Mason / Rigger',
      siteLocation: 'Pier 14-22, Mount-Poonamallee Road Flyover',
      qrCodeToken: 'QR-APEX-SHIFT-C01-SECURE-2026'
    },
    {
      id: 'shift-c-02',
      organizationId: 'org-const-01',
      industry: 'construction',
      title: 'Overnight Shift: Concrete Pour & Gantry Launch',
      startTime: '20:00',
      endTime: '05:00',
      durationHours: 9,
      isOvernight: true,
      requiredRole: 'Mason / Rigger',
      siteLocation: 'Metro Section KM 18.4, St. Thomas Mount',
      qrCodeToken: 'QR-APEX-SHIFT-C02-OVERNIGHT-SECURE'
    },
    {
      id: 'shift-c-03',
      organizationId: 'org-const-01',
      industry: 'construction',
      title: 'Morning Shift: Substation High-Tension Cabling',
      startTime: '07:30',
      endTime: '16:00',
      durationHours: 8,
      isOvernight: false,
      requiredRole: 'Site Electrician',
      siteLocation: 'Traction Substation 03, Porur Junction',
      qrCodeToken: 'QR-APEX-SHIFT-C03-ELEC-2026'
    },

    // Healthcare Shifts
    {
      id: 'shift-h-01',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      title: 'Morning Shift: ICU & Sterile OT Deep Sanitation',
      startTime: '06:00',
      endTime: '14:30',
      durationHours: 8,
      isOvernight: false,
      requiredRole: 'Sanitation Specialist',
      siteLocation: 'Block B, 3rd Floor Critical Care Unit',
      qrCodeToken: 'QR-KAVERI-SHIFT-H01-ICU-SAN'
    },
    {
      id: 'shift-h-02',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      title: 'Overnight Shift: Emergency Ward & Bio-Waste Run',
      startTime: '21:30',
      endTime: '06:30',
      durationHours: 9,
      isOvernight: true,
      requiredRole: 'Sanitation Specialist',
      siteLocation: 'Ground Floor Emergency Trauma Care & Red Bags Transit',
      qrCodeToken: 'QR-KAVERI-SHIFT-H02-NIGHT-ER'
    },
    {
      id: 'shift-h-03',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      title: 'Day Shift: Inpatient Ward Auxiliary Nursing Care',
      startTime: '08:00',
      endTime: '17:00',
      durationHours: 8,
      isOvernight: false,
      requiredRole: 'Auxiliary Nurse Tech',
      siteLocation: 'Tower 1, Floors 4-6 General & Semi-Private Wards',
      qrCodeToken: 'QR-KAVERI-SHIFT-H03-WARD-AUX'
    }
  ];

  const attendance: AttendanceRecord[] = [
    {
      id: 'att-c-01',
      workerId: 'usr-worker-murugan',
      workerName: 'Murugan K.',
      organizationId: 'org-const-01',
      industry: 'construction',
      shiftId: 'shift-c-01',
      shiftTitle: 'Day Shift: Pier Capping & Rebar Binding',
      date: '2026-10-25',
      checkInTime: '2026-10-25T07:55:00.000Z',
      checkOutTime: '2026-10-25T18:00:00.000Z',
      regularHours: 8,
      overtimeHours: 2,
      status: 'approved',
      verificationMethod: 'qr',
      reviewNotes: 'Verified via Gate 2 QR Scanner. 2 hours structural emergency overtime pre-cleared by Arumugam.'
    },
    {
      id: 'att-c-02',
      workerId: 'usr-worker-murugan',
      workerName: 'Murugan K.',
      organizationId: 'org-const-01',
      industry: 'construction',
      shiftId: 'shift-c-02',
      shiftTitle: 'Overnight Shift: Concrete Pour & Gantry Launch',
      date: '2026-10-26',
      checkInTime: '2026-10-26T19:50:00.000Z',
      checkOutTime: '2026-10-27T06:00:00.000Z',
      regularHours: 8,
      overtimeHours: 2.1,
      status: 'pending',
      verificationMethod: 'qr',
      reviewNotes: 'Overnight pour extended due to ready-mix transit delay. Pending supervisor confirmation.'
    },
    {
      id: 'att-h-01',
      workerId: 'usr-worker-priya',
      workerName: 'Priya Selvam',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      shiftId: 'shift-h-01',
      shiftTitle: 'Morning Shift: ICU & Sterile OT Deep Sanitation',
      date: '2026-10-25',
      checkInTime: '2026-10-25T05:50:00.000Z',
      checkOutTime: '2026-10-25T14:30:00.000Z',
      regularHours: 8,
      overtimeHours: 0.5,
      status: 'approved',
      verificationMethod: 'qr',
      reviewNotes: 'Signed off by OT Sister-in-Charge.'
    },
    {
      id: 'att-h-02',
      workerId: 'usr-worker-priya',
      workerName: 'Priya Selvam',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      shiftId: 'shift-h-02',
      shiftTitle: 'Overnight Shift: Emergency Ward & Bio-Waste Run',
      date: '2026-10-26',
      checkInTime: '2026-10-26T21:25:00.000Z',
      checkOutTime: '2026-10-27T07:30:00.000Z',
      regularHours: 8,
      overtimeHours: 2,
      status: 'pending',
      verificationMethod: 'qr',
      reviewNotes: 'Spill decontamination overtime logged in ER.'
    }
  ];

  const payslips: Payslip[] = [
    {
      id: 'pay-c-01',
      workerId: 'usr-worker-murugan',
      workerName: 'Murugan K.',
      organizationId: 'org-const-01',
      industry: 'construction',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-24',
      regularHours: 160,
      overtimeHours: 22.5,
      regularRate: 110,
      overtimeRate: 165, // 1.5x regular rate
      grossPay: 21312.5,
      totalDeductions: 2557.5,
      netPay: 18755,
      currency: '₹',
      status: 'approved',
      generatedAt: '2026-10-25T10:00:00.000Z',
      lineItems: [
        {
          id: 'li-1',
          label: 'Base Pay (Standard Hours)',
          type: 'earning',
          amount: 17600,
          formula: '160.0 hrs × ₹110.00/hr',
          detail: 'Calculated across 20 verified regular working shifts.'
        },
        {
          id: 'li-2',
          label: 'Overtime Earnings (1.5x Premium)',
          type: 'earning',
          amount: 3712.5,
          formula: '22.5 hrs × ₹165.00/hr',
          detail: 'Statutory 1.5x overtime multiplier for hours exceeding 8 hours/day.'
        },
        {
          id: 'li-3',
          label: 'Employee Provident Fund (EPF 12%)',
          type: 'deduction',
          amount: 2112,
          formula: '12% of basic wage component',
          detail: 'Remitted directly to EPFO Universal Account Number.'
        },
        {
          id: 'li-4',
          label: 'ESIC Medical & Disability Cover (0.75%)',
          type: 'deduction',
          amount: 159.84,
          formula: '0.75% of gross earnings',
          detail: 'Full health insurance and work injury insurance coverage for worker & family.'
        },
        {
          id: 'li-5',
          label: 'Construction Welfare Cess Fund',
          type: 'deduction',
          amount: 285.66,
          formula: 'Statutory welfare board fee',
          detail: 'State Building & Other Construction Workers (BOCW) welfare fund.'
        }
      ]
    },
    {
      id: 'pay-h-01',
      workerId: 'usr-worker-priya',
      workerName: 'Priya Selvam',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-24',
      regularHours: 168,
      overtimeHours: 14,
      regularRate: 115,
      overtimeRate: 172.5,
      grossPay: 21735,
      totalDeductions: 2490,
      netPay: 19245,
      currency: '₹',
      status: 'approved',
      generatedAt: '2026-10-25T11:00:00.000Z',
      lineItems: [
        {
          id: 'li-h1',
          label: 'Base Pay (Standard Healthcare Shifts)',
          type: 'earning',
          amount: 19320,
          formula: '168.0 hrs × ₹115.00/hr',
          detail: '21 completed shifts in ICU, OT & inpatient sanitation.'
        },
        {
          id: 'li-h2',
          label: 'Overtime Earnings (1.5x Multiplier)',
          type: 'earning',
          amount: 2415,
          formula: '14.0 hrs × ₹172.50/hr',
          detail: 'Shift extensions covering emergency trauma cleaning.'
        },
        {
          id: 'li-h3',
          label: 'Employee Provident Fund (EPF 12%)',
          type: 'deduction',
          amount: 2318.4,
          formula: '12% of basic eligible salary',
          detail: 'EPFO retirement corpus contribution.'
        },
        {
          id: 'li-h4',
          label: 'ESIC Healthcare Coverage (0.75%)',
          type: 'deduction',
          amount: 163,
          formula: '0.75% of gross',
          detail: 'Full cashless hospital access for self and dependents.'
        },
        {
          id: 'li-h5',
          label: 'Hospital Uniform & PPE Laundering Allowance',
          type: 'earning',
          amount: 500,
          formula: 'Fixed sanitary allowance',
          detail: 'Monthly allowance for sterile gear maintenance.'
        }
      ]
    }
  ];

  const safetyReports: SafetyReport[] = [
    // Construction Safety Reports
    {
      id: 'rep-c-001',
      referenceCode: 'SAF-CON-2026-081',
      organizationId: 'org-const-01',
      industry: 'construction',
      category: 'Scaffold & Fall Hazard',
      severity: 'high',
      description: 'Loose toe-boards and unpinned coupling pins on Level 4 scaffolding near Pier 14B. Vibration from heavy dump trucks causes the planks to shift slightly.',
      location: 'Flyover Pier 14B, East Service Lane',
      reporterMode: 'confidential',
      workerId: 'usr-worker-murugan',
      reporterDisplayName: 'Murugan K. (Confidential to Safety Team)',
      hasPhoto: true,
      photoDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23fee2e2"/><text x="150" y="100" fill="%23dc2626" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Loose Scaffolding Clamp Photo</text><text x="150" y="125" fill="%23666" font-family="sans-serif" font-size="11" text-anchor="middle">Pier 14B - Level 4 Inspection</text></svg>',
      status: 'under_review',
      assignedPerson: 'Arumugam Ramanathan',
      resolutionNotes: 'Inspected 26-Oct at 16:30. Scaffolding contractor instructed to replace clamps with certified double couplers before next pour.',
      createdAt: '2026-10-26T09:15:00.000Z',
      updatedAt: '2026-10-26T16:45:00.000Z'
    },
    {
      id: 'rep-c-002',
      referenceCode: 'SAF-CON-2026-082',
      organizationId: 'org-const-01',
      industry: 'construction',
      category: 'Electrical & Wiring',
      severity: 'critical',
      description: 'Temporary 415V generator power line has damaged rubber insulation and is submerged in standing rainwater right next to the pedestrian worker corridor.',
      location: 'Batching Plant Approach Corridor, Gate 3',
      reporterMode: 'anonymous',
      reporterDisplayName: 'Anonymous Worker',
      hasPhoto: false,
      status: 'action_required',
      assignedPerson: 'Arumugam Ramanathan',
      resolutionNotes: 'Power isolated at main distribution breaker. Electrical crew rewiring with overhead cable hangers.',
      createdAt: '2026-10-26T14:20:00.000Z',
      updatedAt: '2026-10-26T15:00:00.000Z'
    },
    {
      id: 'rep-c-003',
      referenceCode: 'SAF-CON-2026-079',
      organizationId: 'org-const-01',
      industry: 'construction',
      category: 'Missing PPE / Safety Gear',
      severity: 'medium',
      description: 'Batch of newly issued safety goggles fog up immediately during concrete cutting, causing workers to remove them while handling grinders.',
      location: 'Fabrication Yard A',
      reporterMode: 'named',
      workerId: 'usr-worker-rajesh',
      reporterDisplayName: 'Rajesh V.',
      hasPhoto: false,
      status: 'resolved',
      assignedPerson: 'Arumugam Ramanathan',
      resolutionNotes: 'Anti-fog vented polycarbonate eye protectors procured and exchanged for all 35 cutting crew workers on 24-Oct.',
      createdAt: '2026-10-23T11:00:00.000Z',
      updatedAt: '2026-10-24T17:00:00.000Z'
    },

    // Healthcare Safety Reports
    {
      id: 'rep-h-001',
      referenceCode: 'SAF-MED-2026-104',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      category: 'Biohazard & Sharps Exposure',
      severity: 'critical',
      description: 'Puncture-resistant yellow sharps container in Ward 3 Trauma Room is overflowing. Exposed 18G cannula needles sticking out past the safety aperture.',
      location: 'Ward 3 Trauma Stabilization Room',
      reporterMode: 'confidential',
      workerId: 'usr-worker-priya',
      reporterDisplayName: 'Priya Selvam (Confidential)',
      hasPhoto: true,
      photoDataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"><rect width="300" height="200" fill="%23fef3c7"/><text x="150" y="100" fill="%23d97706" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">Sharps Bin Full Photo</text><text x="150" y="125" fill="%23666" font-family="sans-serif" font-size="11" text-anchor="middle">Ward 3 - Incident Evidence</text></svg>',
      status: 'action_required',
      assignedPerson: 'Dr. Malathi Chandran',
      resolutionNotes: 'Immediate replacement dispatched. Infection Control Sister briefed nursing staff against overfilling.',
      createdAt: '2026-10-26T18:30:00.000Z',
      updatedAt: '2026-10-26T19:00:00.000Z'
    },
    {
      id: 'rep-h-002',
      referenceCode: 'SAF-MED-2026-101',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      category: 'Slips, Trips & Wet Surfaces',
      severity: 'medium',
      description: 'Water condensation leaking from central HVAC duct onto the main transit ramp between Emergency and Radiology. High slip danger for gurney pushers.',
      location: 'Transit Corridor B (Emergency to X-Ray Ramp)',
      reporterMode: 'anonymous',
      reporterDisplayName: 'Anonymous Worker',
      hasPhoto: false,
      status: 'resolved',
      assignedPerson: 'Dr. Malathi Chandran',
      resolutionNotes: 'HVAC drain pan cleaned and insulated. Non-slip anti-skid rubber mats laid down permanently.',
      createdAt: '2026-10-22T08:00:00.000Z',
      updatedAt: '2026-10-23T14:30:00.000Z'
    }
  ];

  const feedback: WorkplaceFeedback[] = [
    {
      id: 'fb-c-001',
      organizationId: 'org-const-01',
      industry: 'construction',
      category: 'working_conditions',
      mode: 'anonymous',
      sentiment: 'concern',
      comment: 'The shaded rest pavilion near Pier 16 has no drinking water canister refills after 1:00 PM. During 37°C afternoon heat, workers have to walk 400m to the main gate for water.',
      createdAt: '2026-10-26T12:00:00.000Z'
    },
    {
      id: 'fb-c-002',
      organizationId: 'org-const-01',
      industry: 'construction',
      category: 'compensation',
      mode: 'anonymous',
      sentiment: 'positive',
      comment: 'FairShift transparent payslip display has stopped the wage discrepancies we used to face with sub-contractor muster registers. Overtime hours are counted accurately.',
      createdAt: '2026-10-25T17:30:00.000Z'
    },
    {
      id: 'fb-h-001',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      category: 'equipment_safety',
      mode: 'anonymous',
      sentiment: 'concern',
      comment: 'The heavy nitrile puncture-resistant gloves in the bio-waste room run out of size L and M by midweek. Thin surgical gloves are not safe for carrying autoclave bags.',
      createdAt: '2026-10-26T15:10:00.000Z'
    },
    {
      id: 'fb-h-002',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      category: 'management',
      mode: 'anonymous',
      sentiment: 'neutral',
      comment: 'Rotating night shift staff should be given at least 24 hours recovery before returning to morning ICU rounds. Fatigue is causing needle-stick close calls.',
      createdAt: '2026-10-24T06:40:00.000Z'
    }
  ];

  const fatigueAlerts: FatigueAlert[] = [
    {
      id: 'fa-c-001',
      workerId: 'usr-worker-murugan',
      workerName: 'Murugan K.',
      organizationId: 'org-const-01',
      industry: 'construction',
      triggerType: 'insufficient_rest',
      metricValue: '6.5 hours rest between shifts',
      explanation: 'Worker concluded an overnight pour shift at 06:00 on Oct 27, while scheduled for pier capping at 12:30. Configured safety policy mandates minimum 11 hours rest.',
      severity: 'high',
      status: 'active',
      createdAt: '2026-10-27T06:05:00.000Z'
    },
    {
      id: 'fa-c-002',
      workerId: 'usr-worker-rajesh',
      workerName: 'Rajesh V.',
      organizationId: 'org-const-01',
      industry: 'construction',
      triggerType: 'excessive_hours',
      metricValue: '13.5 hours worked in single calendar day',
      explanation: 'High voltage troubleshooting required double overtime shift. Exceeds max 10h safety threshold.',
      severity: 'moderate',
      status: 'reviewed',
      reviewedBy: 'Arumugam Ramanathan',
      reviewNotes: 'Mandatory compensatory rest day granted on Oct 26. Worker relieved of shift duty.',
      createdAt: '2026-10-25T20:00:00.000Z'
    },
    {
      id: 'fa-h-001',
      workerId: 'usr-worker-priya',
      workerName: 'Priya Selvam',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      triggerType: 'back_to_back',
      metricValue: '3 consecutive night shifts (>27 hours total night work)',
      explanation: 'Third consecutive 9-hour emergency trauma shift logged without rotational day-off interval.',
      severity: 'high',
      status: 'active',
      createdAt: '2026-10-27T07:35:00.000Z'
    }
  ];

  const skills: SkillPassportItem[] = [
    // Murugan
    {
      id: 'sk-c-01',
      workerId: 'usr-worker-murugan',
      skillTitle: 'Certified High-Rise Scaffold Rigging & Dismantling (Level 2)',
      category: 'Safety & Structural',
      yearsExperience: 6,
      isVerified: true,
      verifierName: 'L&T Construction Skills Training Institute (CSTI)',
      verifierDesignation: 'Certified Master Assessor #CSTI-MAS-8812',
      verifiedAt: '2024-03-15',
      certificateRef: 'CSTI-RIG-2024-9982'
    },
    {
      id: 'sk-c-02',
      workerId: 'usr-worker-murugan',
      skillTitle: 'Heavy Rebar Bending & Beam Formwork Assembly',
      category: 'Carpentry & Masonry',
      yearsExperience: 8,
      isVerified: true,
      verifierName: 'Apex Metro Infrastructure',
      verifierDesignation: 'Lead Quality Inspector Arumugam R.',
      verifiedAt: '2025-01-10',
      certificateRef: 'APEX-SKILL-2025-041'
    },
    {
      id: 'sk-c-03',
      workerId: 'usr-worker-murugan',
      skillTitle: 'Confined Space Rescue & Gas Detector Operation',
      category: 'Emergency Safety',
      yearsExperience: 3,
      isVerified: false, // Worker self-reported, not yet verified
      verifiedAt: undefined,
      certificateRef: 'Self-Reported Experience (Tunnelling Sector)'
    },

    // Priya
    {
      id: 'sk-h-01',
      workerId: 'usr-worker-priya',
      skillTitle: 'NABH Bio-Medical Waste Segregation & Sharps Handling',
      category: 'Infection Control & Biohazard',
      yearsExperience: 5,
      isVerified: true,
      verifierName: 'Kaveri Hospital Infection Control Committee',
      verifierDesignation: 'Lead Microbiologist Dr. V. Nandhini',
      verifiedAt: '2024-08-20',
      certificateRef: 'NABH-BMW-CERT-2024-332'
    },
    {
      id: 'sk-h-02',
      workerId: 'usr-worker-priya',
      skillTitle: 'Sterile Operation Theatre Terminal Cleaning Protocols',
      category: 'Surgical Hygiene',
      yearsExperience: 4,
      isVerified: true,
      verifierName: 'Kaveri Hospital Surgical Directorate',
      verifierDesignation: 'Dr. Malathi Chandran (Facilities Director)',
      verifiedAt: '2025-02-14',
      certificateRef: 'KAV-OT-HYG-2025-119'
    },
    {
      id: 'sk-h-03',
      workerId: 'usr-worker-priya',
      skillTitle: 'Basic Life Support (BLS) & CPR Responder',
      category: 'Emergency Medicine',
      yearsExperience: 2,
      isVerified: true,
      verifierName: 'Indian Resuscitation Council Federation (IRCF)',
      verifierDesignation: 'Certified BLS Instructor #TN-8192',
      verifiedAt: '2025-06-11',
      certificateRef: 'IRCF-BLS-2025-7801'
    }
  ];

  return {
    organizations,
    users,
    shifts,
    attendance,
    payslips,
    safetyReports,
    feedback,
    fatigueAlerts,
    skills
  };
}

class DatabaseStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.init();
  }

  private init(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('Could not read existing database, falling back to seed data:', err);
    }

    const seed = getSeedData();
    this.saveData(seed);
    return seed;
  }

  private saveData(data: DatabaseSchema): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist database file:', err);
    }
  }

  public get(): DatabaseSchema {
    return this.data;
  }

  public update(updater: (data: DatabaseSchema) => void): DatabaseSchema {
    updater(this.data);
    this.saveData(this.data);
    return this.data;
  }

  public resetToSeed(): DatabaseSchema {
    this.data = getSeedData();
    this.saveData(this.data);
    return this.data;
  }
}

export const db = new DatabaseStore();
