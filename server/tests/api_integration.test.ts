import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:8080';

describe('FairShift REST API Integration & Privacy Tests', () => {
  // Test 1: Health Endpoint for Google Cloud Run
  test('GET /health returns healthy status and metadata', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.equal(data.service, 'fairshift-platform');
    assert.ok(data.sdgGoal.includes('SDG 8'));
  });

  // Test 2: Industry Isolation and Multi-Sector Endpoints
  test('GET /api/shifts filters by industry (Construction vs Healthcare)', async () => {
    const constRes = await fetch(`${BASE_URL}/api/shifts?industry=construction`);
    assert.equal(constRes.status, 200);
    const constShifts = await constRes.json();
    assert.ok(constShifts.length > 0);
    assert.ok(constShifts.every((s: any) => s.industry === 'construction'));

    const healthRes = await fetch(`${BASE_URL}/api/shifts?industry=healthcare`);
    assert.equal(healthRes.status, 200);
    const healthShifts = await healthRes.json();
    assert.ok(healthShifts.length > 0);
    assert.ok(healthShifts.every((s: any) => s.industry === 'healthcare'));
  });

  // Test 3: QR Token Validation on Check-In
  test('POST /api/attendance/check-in rejects invalid QR token', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-worker-rajesh'
      },
      body: JSON.stringify({
        shiftId: 'shift-c-03',
        verificationMethod: 'qr',
        qrToken: 'INVALID-FAKE-QR-TOKEN'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid or expired QR token'));
  });

  // Test 4: Privacy Protection on Anonymous Safety Hazard
  test('Anonymous safety report hides worker identity from API responses', async () => {
    // Submit anonymous safety report
    const submitRes = await fetch(`${BASE_URL}/api/safety`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-worker-murugan'
      },
      body: JSON.stringify({
        category: 'Scaffold & Fall Hazard',
        severity: 'high',
        description: 'Integration test: missing guardrail on ramp',
        location: 'Pier 12',
        reporterMode: 'anonymous',
        industry: 'construction'
      })
    });

    assert.equal(submitRes.status, 201);
    const report = await submitRes.json();
    assert.equal(report.reporterMode, 'anonymous');
    assert.equal(report.workerId, undefined);

    // Verify GET /api/safety sanitizes worker identity
    const listRes = await fetch(`${BASE_URL}/api/safety?industry=construction`, {
      headers: { 'x-user-id': 'usr-mgr-arumugam' } // Employer viewing
    });
    const list = await listRes.json();
    const target = list.find((r: any) => r.id === report.id);
    assert.ok(target);
    assert.equal(target.workerId, undefined);
    assert.equal(target.reporterDisplayName, 'Anonymous Worker (Identity Protected)');
  });

  // Test 5: Strict Anonymity on Workplace Feedback
  test('Workplace feedback is 100% identity detached with zero worker ID stored', async () => {
    const submitRes = await fetch(`${BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-worker-priya'
      },
      body: JSON.stringify({
        category: 'equipment_safety',
        sentiment: 'concern',
        comment: 'Integration test: Need puncture-resistant gloves',
        mode: 'anonymous',
        industry: 'healthcare'
      })
    });

    assert.equal(submitRes.status, 201);
    const resData = await submitRes.json();
    assert.ok(resData.message.includes('Worker identity detached'));

    // Verify feedback list
    const getRes = await fetch(`${BASE_URL}/api/feedback?industry=healthcare`);
    const fbData = await getRes.json();
    const submittedItem = fbData.items.find((i: any) => i.id === resData.id);
    assert.ok(submittedItem);
    assert.equal((submittedItem as any).workerId, undefined);
    assert.equal((submittedItem as any).userId, undefined);
  });

  // Test 6: Role-Based Access Control (RBAC)
  test('Workers are blocked from approving attendance or updating safety status', async () => {
    const attRes = await fetch(`${BASE_URL}/api/attendance/att-c-01/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-worker-murugan' // Worker persona
      },
      body: JSON.stringify({ status: 'approved' })
    });
    assert.equal(attRes.status, 403);

    const safetyRes = await fetch(`${BASE_URL}/api/safety/rep-c-001/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'usr-worker-murugan' // Worker persona
      },
      body: JSON.stringify({ status: 'resolved' })
    });
    assert.equal(safetyRes.status, 403);
  });
});
