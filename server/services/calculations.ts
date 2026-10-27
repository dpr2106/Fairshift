import { AttendanceRecord, Payslip, PayslipLineItem, User, FatigueAlert, PayrollConfig } from '../types.js';

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
 * for a worker given attendance records and configurable organization wage parameters.
 * Note: Calculations are generated as estimates and labeled as illustrative breakdowns.
 */
export function calculatePayslipBreakdown(
  worker: User,
  records: AttendanceRecord[],
  periodStart: string,
  periodEnd: string,
  currency: string = '₹',
  customConfig?: Partial<PayrollConfig>
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

  // Configurable rates (defaulting to standard configurable organizational presets)
  const multiplier = customConfig?.overtimeMultiplier ?? worker.overtimeRateMultiplier ?? 1.5;
  const epfRate = customConfig?.epfRate ?? 0.12; // 12% basic
  const esicRate = customConfig?.esicRate ?? 0.0075; // 0.75% gross
  const welfareRate = customConfig?.welfareCessRate ?? (worker.industry === 'construction' ? 0.01 : 0.0);
  const welfareFlatFee = customConfig?.welfareFlatFee ?? (worker.industry === 'healthcare' ? 100 : 0);

  const regularRate = worker.hourlyRate;
  const overtimeRate = Math.round(worker.hourlyRate * multiplier * 100) / 100;

  const baseEarnings = Math.round(totalRegularHours * regularRate * 100) / 100;
  const overtimeEarnings = Math.round(totalOvertimeHours * overtimeRate * 100) / 100;
  const grossPay = Math.round((baseEarnings + overtimeEarnings) * 100) / 100;

  // Configurable Deductions Breakdown:
  const epfDeduction = Math.round(baseEarnings * epfRate * 100) / 100;
  const esicDeduction = Math.round(grossPay * esicRate * 100) / 100;
  const welfareDeduction = Math.round((grossPay * welfareRate + welfareFlatFee) * 100) / 100;

  const totalDeductions = Math.round((epfDeduction + esicDeduction + welfareDeduction) * 100) / 100;
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
      label: `Overtime Pay (${multiplier}x configured rate)`,
      type: 'earning',
      amount: overtimeEarnings,
      formula: `${totalOvertimeHours.toFixed(1)} hrs × ${currency}${overtimeRate.toFixed(2)}/hr`,
      detail: `Configured multiplier applied to hours worked beyond daily standard threshold.`
    },
    {
      id: 'li-epf',
      label: `Provident Fund (EPF - Configured ${(epfRate * 100).toFixed(0)}% estimate)`,
      type: 'deduction',
      amount: epfDeduction,
      formula: `${(epfRate * 100).toFixed(0)}% × ${currency}${baseEarnings.toFixed(2)} (Basic)`,
      detail: 'Organizational retirement corpus deduction estimate. Final remittance subject to payroll audit.'
    },
    {
      id: 'li-esic',
      label: `Healthcare Cover (ESIC - Configured ${(esicRate * 100).toFixed(2)}% estimate)`,
      type: 'deduction',
      amount: esicDeduction,
      formula: `${(esicRate * 100).toFixed(2)}% × ${currency}${grossPay.toFixed(2)} (Gross)`,
      detail: 'Organizational health insurance contribution estimate.'
    },
    {
      id: 'li-welfare',
      label: worker.industry === 'construction'
        ? `Worker Welfare Fund (Configured ${(welfareRate * 100).toFixed(0)}% estimate)`
        : 'Hospital Welfare & Mutual Fund (Configured estimate)',
      type: 'deduction',
      amount: welfareDeduction,
      formula: worker.industry === 'construction'
        ? `${(welfareRate * 100).toFixed(1)}% × ${currency}${grossPay.toFixed(2)}`
        : `Flat fee ${currency}${welfareFlatFee}`,
      detail: 'Configured organizational welfare contribution. Does not constitute statutory certification.'
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
    status: 'estimate', // Clearly labeled as estimate until manager audits & signs off
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
      explanation: `Shift duration exceeded the ${maxDailyHours}-hour safe threshold. Flagged for manager review to ensure worker well-being.`,
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
        explanation: `Rest gap of only ${restIntervalHours.toFixed(1)} hours is less than the recommended ${minRestHours}-hour recovery window. Human manager review required.`,
        severity: restIntervalHours < 8 ? 'high' : 'moderate',
        status: 'active'
      };
    }
  }

  return null;
}
