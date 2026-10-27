export type Language = 'en' | 'ta';

export interface TranslationDictionary {
  appName: string;
  tagline: string;
  workerPortal: string;
  employerPortal: string;
  switchRole: string;
  switchIndustry: string;
  construction: string;
  healthcare: string;
  todayStatus: string;
  checkIn: string;
  checkOut: string;
  checkedIn: string;
  checkedOut: string;
  noActiveShift: string;
  shifts: string;
  payslip: string;
  safety: string;
  feedback: string;
  skills: string;
  fatigueAlerts: string;
  dashboard: string;
  regularHours: string;
  overtimeHours: string;
  hourlyRate: string;
  grossPay: string;
  netPay: string;
  deductions: string;
  status: string;
  pending: string;
  approved: string;
  disputed: string;
  resolved: string;
  reportHazard: string;
  hazardCategory: string;
  severity: string;
  describeHazard: string;
  location: string;
  reporterMode: string;
  submitReport: string;
  anonymousNotice: string;
  emergencyNotice: string;
  readAloud: string;
  listening: string;
  speakNow: string;
  voiceInput: string;
  verifiedBadge: string;
  unverifiedBadge: string;
  addSkill: string;
  skillName: string;
  experienceYears: string;
  saveSkill: string;
  fatigueWarningTitle: string;
  fatigueExplanation: string;
  reviewAlert: string;
  approveShift: string;
  disputeShift: string;
  whyThisAmount: string;
  sdgGoal: string;
}

export const translations: Record<Language, TranslationDictionary> = {
  en: {
    appName: 'FairShift',
    tagline: 'Decent Work, Safety & Transparency Platform',
    workerPortal: 'Worker Portal',
    employerPortal: 'Employer & Operations Cockpit',
    switchRole: 'Switch Persona',
    switchIndustry: 'Switch Industry',
    construction: 'Construction Site (Apex Metro)',
    healthcare: 'Healthcare Facility (Kaveri Hospital)',
    todayStatus: "Today's Work Status",
    checkIn: 'Check In to Shift',
    checkOut: 'Check Out Shift',
    checkedIn: 'Active Shift in Progress',
    checkedOut: 'Completed Shift',
    noActiveShift: 'No active shift logged. Scan site QR or tap check-in.',
    shifts: 'Shifts & Attendance',
    payslip: 'Transparent Payslip',
    safety: 'Safety Reporting',
    feedback: 'Confidential Voice',
    skills: 'Skill Passport',
    fatigueAlerts: 'Fatigue Warnings',
    dashboard: 'Operations Dashboard',
    regularHours: 'Regular Hours',
    overtimeHours: 'Overtime Hours',
    hourlyRate: 'Hourly Rate',
    grossPay: 'Gross Earnings',
    netPay: 'Net Payable',
    deductions: 'Statutory Deductions',
    status: 'Status',
    pending: 'Pending Review',
    approved: 'Approved',
    disputed: 'Disputed',
    resolved: 'Resolved',
    reportHazard: 'Report Safety Hazard',
    hazardCategory: 'Hazard Category',
    severity: 'Risk Severity',
    describeHazard: 'Describe the workplace hazard...',
    location: 'Exact Site Location / Room',
    reporterMode: 'Confidentiality Mode',
    submitReport: 'Submit Safety Report',
    anonymousNotice: 'Your identity is strictly detached. Managers cannot trace this back to you.',
    emergencyNotice: 'For active fires or immediate life hazards, contact site emergency (112) immediately!',
    readAloud: 'Read Payslip Aloud',
    listening: 'Listening...',
    speakNow: 'Speak clearly into microphone',
    voiceInput: 'Voice Input',
    verifiedBadge: 'Verified Credential',
    unverifiedBadge: 'Self-Reported (Unverified)',
    addSkill: 'Add New Skill / Qualification',
    skillName: 'Skill Title',
    experienceYears: 'Years of Experience',
    saveSkill: 'Save to Passport',
    fatigueWarningTitle: 'Rest & Fatigue Advisory',
    fatigueExplanation: 'Flagged for human manager review to protect worker well-being.',
    reviewAlert: 'Review & Confirm Rest',
    approveShift: 'Approve Attendance',
    disputeShift: 'Flag Discrepancy',
    whyThisAmount: 'Why is my pay this amount?',
    sdgGoal: 'UN SDG 8 — Decent Work & Economic Growth'
  },
  ta: {
    appName: 'ஃபேர்ஷிப்ட் (FairShift)',
    tagline: 'நியாயமான பணி, பாதுகாப்பு மற்றும் வெளிப்படைத்தன்மை தளம்',
    workerPortal: 'தொழிலாளர் பக்கம் (Worker Portal)',
    employerPortal: 'நிர்வாக மற்றும் செயல்பாட்டு மேடை',
    switchRole: 'பயனரை மாற்றுக',
    switchIndustry: 'துறையை மாற்றுக',
    construction: 'கட்டுமான தளம் (Apex Metro)',
    healthcare: 'மருத்துவமனை (Kaveri Hospital)',
    todayStatus: 'இன்றைய பணி நிலை',
    checkIn: 'பணியைத் தொடங்குக (Check In)',
    checkOut: 'பணியை முடிக்கவும் (Check Out)',
    checkedIn: 'பணியில் உள்ளீர்கள்',
    checkedOut: 'பணி நிறைவடைந்தது',
    noActiveShift: 'தற்போது செயலில் உள்ள பணி ஏதுமில்லை. QR குறியீட்டை ஸ்கேன் செய்யவும்.',
    shifts: 'பணி நேரம் & வருகை',
    payslip: 'தெளிவான சம்பள சீட்டு',
    safety: 'பாதுகாப்பு குறைபாடு பதிவு',
    feedback: 'ரகசிய கருத்துப் பெட்டி',
    skills: 'திறன் பாஸ்போர்ட்',
    fatigueAlerts: 'அதிக வேலை & சோர்வு எச்சரிக்கைகள்',
    dashboard: 'செயல்பாட்டு டாஷ்போர்டு',
    regularHours: 'வழக்கமான வேலை நேரம்',
    overtimeHours: 'கூடுதல் வேலை நேரம் (OT)',
    hourlyRate: 'மணி நேர ஊதியம்',
    grossPay: 'மொத்த வருமானம்',
    netPay: 'நிகர சம்பள தொகை',
    deductions: 'சட்டரீதியான பிடித்தங்கள்',
    status: 'நிலை',
    pending: 'சரிபார்ப்பில் உள்ளது',
    approved: 'ஒப்புதல் அளிக்கப்பட்டது',
    disputed: 'முரண்பாடு உள்ளது',
    resolved: 'தீர்க்கப்பட்டது',
    reportHazard: 'பாதுகாப்பு குறைபாட்டைப் புகாரளிக்கவும்',
    hazardCategory: 'குறைபாட்டின் பிரிவு',
    severity: 'ஆபத்தின் தீவிரம்',
    describeHazard: 'ஆபத்தை பற்றி விவரிக்கவும்...',
    location: 'தளத்தின் இடம் / அறை எண்',
    reporterMode: 'ரகசியத்தன்மை முறை',
    submitReport: 'புகாரை சமர்ப்பிக்கவும்',
    anonymousNotice: 'உங்கள் அடையாளம் முழுமையாக மறைக்கப்படும். நிர்வாகம் உங்களை அடையாளம் காண முடியாது.',
    emergencyNotice: 'உடனடி ஆபத்து அல்லது அவசர நிலைக்கு உடனே 112 அல்லது பாதுகாப்பு அதிகாரியை அழைக்கவும்!',
    readAloud: 'சம்பள விவரத்தை குரலில் கேட்கவும்',
    listening: 'கேட்கிறது...',
    speakNow: 'மைக்ரோஃபோனில் பேசவும்',
    voiceInput: 'குரல் உள்ளீடு',
    verifiedBadge: 'சான்றளிக்கப்பட்ட திறன்',
    unverifiedBadge: 'சரிபார்க்கப்படாத பதிவு',
    addSkill: 'புதிய திறனைச் சேர்க்கவும்',
    skillName: 'திறன் பெயர்',
    experienceYears: 'அனுபவ ஆண்டுகள்',
    saveSkill: 'பாஸ்போர்ட்டில் சேமிக்கவும்',
    fatigueWarningTitle: 'சோர்வு மற்றும் ஓய்வு ஆலோசனை',
    fatigueExplanation: 'தொழிலாளியின் நலனைப் பாதுகாக்க மனித மேற்பார்வைக்கு அனுப்பப்பட்டுள்ளது.',
    reviewAlert: 'சரிபார்த்து உறுதிப்படுத்துக',
    approveShift: 'வருகையை உறுதிசெய்',
    disputeShift: 'முரண்பாட்டை பதிவுசெய்',
    whyThisAmount: 'எனது சம்பளம் எவ்வாறு கணக்கிடப்பட்டது?',
    sdgGoal: 'ஐ.நா. இலக்கு 8 — கண்ணியமான வேலை மற்றும் பொருளாதார வளர்ச்சி'
  }
};
