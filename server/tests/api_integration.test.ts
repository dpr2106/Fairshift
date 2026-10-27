import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:8080';

describe('FairShift REST API Integration, RBAC & Security Audit Tests', () => {
  let workerToken = '';
  let managerToken = '';
  let healthWorkerToken = '';

  before(async () => {
    // Acquire verified session tokens via POST /api/auth/login
    const wRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-worker-murugan' })
    });
    const wData = await wRes.json();
    workerToken = wData.token;

    const mRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-mgr-arumugam' })
    });
    const mData = await mRes.json();
    managerToken = mData.token;

    const hwRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'usr-worker-priya' })
    });
    const hwData = await hwRes.json();
    healthWorkerToken = hwData.token;
  });

  // Test 1: Health Endpoint for Google Cloud Run
  test('GET /health returns healthy status, service name, and database mode', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'healthy');
    assert.equal(data.service, 'fairshift-platform');
    assert.ok(data.database);
    assert.ok(data.sdgGoal.includes('SDG 8'));
  });

  // Test 2: Forged / Tampered Session Token is Rejected
  test('Rejects forged session tokens or altered payloads with 401 Unauthorized', async () => {
    const forgedToken = workerToken.slice(0, -6) + 'FORGED';
    const res = await fetch(`${BASE_URL}/api/shifts`, {
      headers: { 'Authorization': `Bearer ${forgedToken}` }
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid or expired session token'));
  });

  // Test 3: Unauthenticated Request is Blocked
  test('GET /api/shifts rejects unauthenticated request without token', async () => {
    const res = await fetch(`${BASE_URL}/api/shifts`);
    assert.equal(res.status, 401);
  });

  // Test 4: Role-Based Access Control (RBAC) Enforcement
  test('Workers are strictly forbidden from approving attendance or creating shifts', async () => {
    // Worker attempts manager approval
    const attRes = await fetch(`${BASE_URL}/api/attendance/att-c-01/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({ status: 'approved' })
    });
    assert.equal(attRes.status, 403);
    const attData = await attRes.json();
    assert.ok(attData.error.includes('Access denied'));

    // Worker attempts shift creation
    const shiftRes = await fetch(`${BASE_URL}/api/shifts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({
        title: 'Unauthorized Shift',
        industry: 'construction',
        startTime: '08:00',
        endTime: '17:00'
      })
    });
    assert.equal(shiftRes.status, 403);
  });

  // Test 5: Organization-Level Tenant Isolation
  test('Construction worker cannot check in or access records of Healthcare organization', async () => {
    // Murugan (Construction, org-const-01) tries to check into Hospital shift (shift-h-01, org-health-01)
    const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({
        shiftId: 'shift-h-01',
        verificationMethod: 'qr',
        qrToken: 'QR-KAVERI-SHIFT-H01-ICU-SAN'
      })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes('Cross-organization shift check-in is not permitted'));
  });

  // Test 6: QR Token Validation on Check-In
  test('Check-in rejects invalid QR token', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({
        shiftId: 'shift-c-03',
        verificationMethod: 'qr',
        qrToken: 'FAKE-TAMPERED-QR-TOKEN'
      })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('Invalid or expired QR token'));
  });

  // Test 7: Anonymous Feedback Privacy & Identity Detachment
  test('Workplace feedback strictly detaches identity and stores no workerId', async () => {
    const res = await fetch(`${BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${healthWorkerToken}`
      },
      body: JSON.stringify({
        category: 'equipment_safety',
        sentiment: 'concern',
        comment: 'Security audit test: anonymous feedback privacy check',
        mode: 'anonymous',
        industry: 'healthcare'
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.message.includes('Worker identity detached'));

    // Verify in GET /api/feedback
    const listRes = await fetch(`${BASE_URL}/api/feedback?industry=healthcare`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    // Cross-org check: Arumugam (Construction org) should not see Healthcare feedback
    const listData = await listRes.json();
    assert.equal(listData.items.length, 0); // Correctly isolated by organization!
  });

  // Test 8: Transparent Payslip is Explicitly Labeled as Estimate
  test('Generated payslip has estimate status and itemized calculation notes', async () => {
    const res = await fetch(`${BASE_URL}/api/payslips/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${workerToken}`
      },
      body: JSON.stringify({
        workerId: 'usr-worker-murugan',
        periodStart: '2026-10-01',
        periodEnd: '2026-10-25'
      })
    });
    assert.equal(res.status, 201);
    const slip = await res.json();
    assert.equal(slip.status, 'estimate');
    assert.ok(slip.lineItems.length >= 5);
    const epfItem = slip.lineItems.find((l: any) => l.id === 'li-epf');
    assert.ok(epfItem.detail.includes('estimate'));
  });
});
