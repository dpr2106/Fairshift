import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculateShiftHours, calculatePayslipBreakdown, evaluateFatigue } from '../services/calculations.js';
import { User, AttendanceRecord } from '../types.js';

describe('FairShift Core Logic & Arithmetic Verification', () => {
  // Test 1: Standard Shift Duration and Hours
  test('Shift duration calculates correct regular hours for standard 8h day shift', () => {
    const checkIn = '2026-10-25T08:00:00.000Z';
    const checkOut = '2026-10-25T16:00:00.000Z';
    const result = calculateShiftHours(checkIn, checkOut, 8.0);

    assert.equal(result.durationHours, 8.0);
    assert.equal(result.regularHours, 8.0);
    assert.equal(result.overtimeHours, 0);
    assert.equal(result.isOvernight, false);
  });

  // Test 2: Overnight Shift Crossing Midnight
  test('Overnight shift correctly computes across midnight boundary with overtime', () => {
    // 20:00 (Day 1) to 06:00 (Day 2) = 10 hours total
    const checkIn = '2026-10-26T20:00:00.000Z';
    const checkOut = '2026-10-27T06:00:00.000Z';
    const result = calculateShiftHours(checkIn, checkOut, 8.0);

    assert.equal(result.durationHours, 10.0);
    assert.equal(result.regularHours, 8.0);
    assert.equal(result.overtimeHours, 2.0);
    assert.equal(result.isOvernight, true);
  });

  // Test 3: Invalid Attendance Timestamps
  test('Rejects invalid checkout time that is before checkin time', () => {
    const checkIn = '2026-10-25T10:00:00.000Z';
    const checkOut = '2026-10-25T09:00:00.000Z';

    assert.throws(
      () => calculateShiftHours(checkIn, checkOut),
      /Check-out timestamp must be strictly after/
    );
  });

  // Test 4: Transparent Payslip Arithmetic and Breakdown
  test('Transparent payslip calculates base pay, statutory 1.5x overtime, EPF and ESIC correctly', () => {
    const mockWorker: User = {
      id: 'usr-worker-murugan',
      name: 'Murugan K.',
      email: 'murugan.k@fairshift.worker',
      phone: '+91 98401 23456',
      role: 'worker',
      organizationId: 'org-const-01',
      industry: 'construction',
      designation: 'Mason',
      hourlyRate: 100, // ₹100/hr
      overtimeRateMultiplier: 1.5 // ₹150/hr overtime
    };

    const mockRecords: AttendanceRecord[] = [
      {
        id: 'att-1',
        workerId: 'usr-worker-murugan',
        workerName: 'Murugan K.',
        organizationId: 'org-const-01',
        industry: 'construction',
        shiftId: 'shift-1',
        shiftTitle: 'Pier Capping',
        date: '2026-10-25',
        checkInTime: '2026-10-25T08:00:00.000Z',
        checkOutTime: '2026-10-25T18:00:00.000Z',
        regularHours: 8,
        overtimeHours: 2,
        status: 'approved',
        verificationMethod: 'qr'
      },
      {
        id: 'att-2',
        workerId: 'usr-worker-murugan',
        workerName: 'Murugan K.',
        organizationId: 'org-const-01',
        industry: 'construction',
        shiftId: 'shift-2',
        shiftTitle: 'Rebar Binding',
        date: '2026-10-26',
        checkInTime: '2026-10-26T08:00:00.000Z',
        checkOutTime: '2026-10-26T19:00:00.000Z',
        regularHours: 8,
        overtimeHours: 3,
        status: 'approved',
        verificationMethod: 'qr'
      }
    ];

    const payslip = calculatePayslipBreakdown(mockWorker, mockRecords, '2026-10-25', '2026-10-26', '₹');

    // Total regular hours = 8 + 8 = 16h
    // Total overtime hours = 2 + 3 = 5h
    assert.equal(payslip.regularHours, 16);
    assert.equal(payslip.overtimeHours, 5);

    // Regular earnings = 16 * 100 = ₹1600
    // Overtime earnings = 5 * 150 = ₹750
    // Gross = 1600 + 750 = ₹2350
    assert.equal(payslip.grossPay, 2350);

    // EPF = 12% of basic (1600) = ₹192
    // ESIC = 0.75% of gross (2350) = ₹17.63
    // BOCW Welfare = 1% of gross (2350) = ₹23.50
    // Total deductions = 192 + 17.63 + 23.50 = ₹233.13
    assert.equal(payslip.totalDeductions, 233.13);

    // Net pay = 2350 - 233.13 = ₹2116.87
    assert.equal(payslip.netPay, 2116.87);

    // Verify explanation line items exist
    assert.ok(payslip.lineItems.length >= 5);
    const baseItem = payslip.lineItems.find(l => l.id === 'li-base');
    assert.ok(baseItem?.formula.includes('16.0 hrs × ₹100.00/hr'));
  });

  // Test 5: Fatigue & Overtime Warnings Trigger
  test('Fatigue alert triggers when shift duration exceeds 10 hours', () => {
    const mockWorker: User = {
      id: 'usr-worker-rajesh',
      name: 'Rajesh V.',
      email: 'rajesh.v@fairshift.worker',
      phone: '+91 98402 34567',
      role: 'worker',
      organizationId: 'org-const-01',
      industry: 'construction',
      designation: 'Electrician',
      hourlyRate: 120,
      overtimeRateMultiplier: 1.5
    };

    // 12 hours continuous shift
    const currentRecord = {
      checkInTime: '2026-10-26T07:00:00.000Z',
      checkOutTime: '2026-10-26T19:00:00.000Z'
    };

    const alert = evaluateFatigue(mockWorker, currentRecord, [], 10, 11);
    assert.ok(alert !== null);
    assert.equal(alert?.triggerType, 'excessive_hours');
    assert.ok(alert?.explanation.includes('exceeded the 10-hour safe threshold'));
  });

  // Test 6: Insufficient Rest Gap Warning
  test('Fatigue alert triggers when rest between shifts is less than mandatory 11 hours', () => {
    const mockWorker: User = {
      id: 'usr-worker-priya',
      name: 'Priya Selvam',
      email: 'priya.s@fairshift.worker',
      phone: '+91 98403 45678',
      role: 'worker',
      organizationId: 'org-health-01',
      industry: 'healthcare',
      designation: 'Sanitation Specialist',
      hourlyRate: 115,
      overtimeRateMultiplier: 1.5
    };

    // Worker finished overnight shift at 06:00
    const pastRecords: AttendanceRecord[] = [
      {
        id: 'att-prior',
        workerId: mockWorker.id,
        workerName: mockWorker.name,
        organizationId: mockWorker.organizationId,
        industry: mockWorker.industry,
        shiftId: 'shift-h-02',
        shiftTitle: 'Night ER Shift',
        date: '2026-10-26',
        checkInTime: '2026-10-25T21:00:00.000Z',
        checkOutTime: '2026-10-26T06:00:00.000Z',
        regularHours: 8,
        overtimeHours: 1,
        status: 'approved',
        verificationMethod: 'qr'
      }
    ];

    // Worker tries to check in same day at 13:00 (only 7 hours of rest)
    const newRecord = {
      checkInTime: '2026-10-26T13:00:00.000Z',
      checkOutTime: '2026-10-26T21:00:00.000Z'
    };

    const alert = evaluateFatigue(mockWorker, newRecord, pastRecords, 10, 11);
    assert.ok(alert !== null);
    assert.equal(alert?.triggerType, 'insufficient_rest');
    assert.ok(alert?.metricValue.includes('7.0 hours rest between shifts'));
  });
});
