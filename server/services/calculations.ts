import { AttendanceRecord, Payslip, PayslipLineItem, User, FatigueAlert } from '../types.js';

export interface ShiftHoursResult {
  durationHours: number;
  regularHours: number;
  overtimeHours: number;
  isOvernight: boolean;
}

/**
 * Calculates shift duration, handling overnight shifts (crossing midnight),
 * regular hours up to daily threshold (standard 8.0h), and overtime hours.
 */
export function calculateShiftHours(
  checkInIso: string,
  checkOutIso: string,
  dailyThreshold: number = 8.0
): ShiftHoursResult {
  const inDate = new Date(checkInIso);
  const outDate = new Date(checkOutIso);

  const diffMs = outDate.getTime() - inDate.getTime();
  if (diffMs <= 0) {
    throw new Error('Check-out timestamp must be strictly after check-in timestamp');
  }

  // Convert to hours with 2 decimal precision
  const durationHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;

  // Determine if it spans overnight (calendar day changes or check-out is next day)
  const isOvernight = inDate.getUTCDate() !== outDate.getUTCDate() || durationHours > 16;

  let regularHours = Math.min(durationHours, dailyThreshold);
  let overtimeHours = durationHours > dailyThreshold ? Math.round((durationHours - dailyThreshold) * 100) / 100 : 0;

  // Standardize decimals
  regularHours = Math.round(regularHours * 100) / 100;

  return {
    durationHours,
    regularHours,
    overtimeHours,
    isOvernight
  };
}

/**
 * Calculates a mathematically transparent payslip breakdown
 * for a worker given attendance records and wage configuration.
 */
export function calculatePayslipBreakdown(
  worker: User,
  records: AttendanceRecord[],
  periodStart: string,
  periodEnd: string,
  currency: string = '₹'
): Omit<Payslip, 'id'> {
  // Aggregate hours
  let totalRegularHours = 0;
  let totalOvertimeHours = 0;

  for (const rec of records) {
    totalRegularHours += rec.regularHours;
    totalOvertimeHours += rec.overtimeHours;
  }

  totalRegularHours = Math.round(totalRegularHours * 100) / 100;
  totalOvertimeHours = Math.round(totalOvertimeHours * 100) / 100;

  const regularRate = worker.hourlyRate;
  const overtimeRate = Math.round(worker.hourlyRate * worker.overtimeRateMultiplier * 100) / 100;

  const baseEarnings = Math.round(totalRegularHours * regularRate * 100) / 100;
  const overtimeEarnings = Math.round(totalOvertimeHours * overtimeRate * 100) / 100;
  const grossPay = Math.round((baseEarnings + overtimeEarnings) * 100) / 100;

  // Transparent Statutory / Standard Deductions:
  // 1. EPF (Employee Provident Fund) = 12% of basic earnings
  const epfDeduction = Math.round(baseEarnings * 0.12 * 100) / 100;
  // 2. ESIC (Employees' State Insurance Corporation) = 0.75% of gross earnings
  const esicDeduction = Math.round(grossPay * 0.0075 * 100) / 100;
  // 3. Worker Welfare Cess = 1% for construction, nominal ₹100 for healthcare
  const welfareCess = worker.industry === 'construction'
    ? Math.round(grossPay * 0.01 * 100) / 100
    : 100;

  const totalDeductions = Math.round((epfDeduction + esicDeduction + welfareCess) * 100) / 100;
  const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

  const lineItems: PayslipLineItem[] = [
    {
      id: 'li-base',
      label: 'Base Pay (Standard Hours)',
      type: 'earning',
      amount: baseEarnings,
      formula: `${totalRegularHours.toFixed(1)} hrs × ${currency}${regularRate.toFixed(2)}/hr`,
      detail: `Accumulated across ${records.length} shifts logged between ${periodStart} and ${periodEnd}.`
    },
    {
      id: 'li-ot',
      label: `Overtime Pay (${worker.overtimeRateMultiplier}x statutory multiplier)`,
      type: 'earning',
      amount: overtimeEarnings,
      formula: `${totalOvertimeHours.toFixed(1)} hrs × ${currency}${overtimeRate.toFixed(2)}/hr`,
      detail: `Premium rate applied to all hours worked beyond the daily threshold.`
    },
    {
      id: 'li-epf',
      label: 'Employee Provident Fund (EPF 12%)',
      type: 'deduction',
      amount: epfDeduction,
      formula: `12% × ${currency}${baseEarnings.toFixed(2)} (Basic)`,
      detail: 'Mandatory social security retirement savings deposited to EPFO.'
    },
    {
      id: 'li-esic',
      label: 'ESIC Health & Disability Insurance (0.75%)',
      type: 'deduction',
      amount: esicDeduction,
      formula: `0.75% × ${currency}${grossPay.toFixed(2)} (Gross)`,
      detail: 'State-backed full cashless health and workplace injury coverage.'
    },
    {
      id: 'li-welfare',
      label: worker.industry === 'construction' ? 'BOCW Construction Welfare Fund (1%)' : 'Hospital Welfare & Mutual Fund',
      type: 'deduction',
      amount: welfareCess,
      formula: worker.industry === 'construction' ? `1.0% × ${currency}${grossPay.toFixed(2)}` : 'Standard welfare fee',
      detail: 'Statutory board contribution for worker safety and social assistance.'
    }
  ];

  return {
    workerId: worker.id,
    workerName: worker.name,
    organizationId: worker.organizationId,
    industry: worker.industry,
    periodStart,
    periodEnd,
    regularHours: totalRegularHours,
    overtimeHours: totalOvertimeHours,
    regularRate,
    overtimeRate,
    grossPay,
    totalDeductions,
    netPay,
    currency,
    status: 'approved',
    lineItems,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Checks for fatigue warning conditions based on newly logged shift
 * and previous attendance history.
 */
export function evaluateFatigue(
  worker: User,
  currentRecord: { checkInTime: string; checkOutTime: string },
  pastRecords: AttendanceRecord[],
  maxDailyHours: number = 10,
  minRestHours: number = 11
): Omit<FatigueAlert, 'id' | 'createdAt'> | null {
  const currentIn = new Date(currentRecord.checkInTime).getTime();
  const currentOut = new Date(currentRecord.checkOutTime).getTime();
  const currentDuration = (currentOut - currentIn) / (1000 * 60 * 60);

  // Rule 1: Single shift excessive hours
  if (currentDuration > maxDailyHours) {
    return {
      workerId: worker.id,
      workerName: worker.name,
      organizationId: worker.organizationId,
      industry: worker.industry,
      triggerType: 'excessive_hours',
      metricValue: `${currentDuration.toFixed(1)} consecutive hours logged`,
      explanation: `Shift duration exceeded the ${maxDailyHours}-hour safe threshold. Extended work poses acute fatigue and reflex degradation risk.`,
      severity: currentDuration >= 13 ? 'high' : 'moderate',
      status: 'active'
    };
  }

  // Rule 2: Insufficient rest interval from prior shift
  const sortedPast = [...pastRecords].sort((a, b) => {
    const timeA = a.checkOutTime ? new Date(a.checkOutTime).getTime() : 0;
    const timeB = b.checkOutTime ? new Date(b.checkOutTime).getTime() : 0;
    return timeB - timeA;
  });

  const lastCompleted = sortedPast.find(r => r.checkOutTime);
  if (lastCompleted && lastCompleted.checkOutTime) {
    const lastOut = new Date(lastCompleted.checkOutTime).getTime();
    const restIntervalHours = (currentIn - lastOut) / (1000 * 60 * 60);

    if (restIntervalHours > 0 && restIntervalHours < minRestHours) {
      return {
        workerId: worker.id,
        workerName: worker.name,
        organizationId: worker.organizationId,
        industry: worker.industry,
        triggerType: 'insufficient_rest',
        metricValue: `${restIntervalHours.toFixed(1)} hours rest between shifts`,
        explanation: `Rest gap of only ${restIntervalHours.toFixed(1)} hours is less than the mandatory ${minRestHours}-hour recovery window. Human review required before next shift assignment.`,
        severity: restIntervalHours < 8 ? 'high' : 'moderate',
        status: 'active'
      };
    }
  }

  return null;
}
