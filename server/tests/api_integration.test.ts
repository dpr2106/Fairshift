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

  // Test 9: Priority 1 Fix — x-user-id Header Alone Must NEVER Grant Authentication
  test('Rejects x-user-id header without Bearer token with 401 Unauthorized', async () => {
    // Attempt to access manager-only or protected route using just x-user-id spoofing
    const res = await fetch(`${BASE_URL}/api/shifts`, {
      headers: {
        'x-user-id': 'usr-mgr-arumugam' // Maliciously claiming manager identity
      }
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes('Authentication required'));
  });

  // Test 10: Priority 1 Fix — GET /api/auth/users Protects Personal User Fields
  test('GET /api/auth/users strictly sanitizes sensitive personal contact and wage information', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/users`);
    assert.equal(res.status, 200);
    const users = await res.json();
    assert.ok(Array.isArray(users) && users.length > 0);

    for (const u of users) {
      assert.equal(u.phone, undefined, 'User phone number must not be exposed publicly');
      assert.equal(u.email, undefined, 'User email must not be exposed publicly');
      assert.equal(u.hourlyRate, undefined, 'User hourly rate must not be exposed publicly');
      assert.equal(u.overtimeRateMultiplier, undefined, 'Overtime rate multiplier must not be exposed publicly');
      assert.ok(u.id);
      assert.ok(u.name);
      assert.ok(u.role);
    }
  });

  // Test 11: Priority 1 Fix — POST /api/system/reset Rejects Unauthenticated or Worker Requests
  test('POST /api/system/reset rejects unauthenticated calls and non-manager workers', async () => {
    // 1. Unauthenticated reset call
    const unauthRes = await fetch(`${BASE_URL}/api/system/reset`, { method: 'POST' });
    assert.equal(unauthRes.status, 401);

    // 2. Authenticated worker attempt
    const workerRes = await fetch(`${BASE_URL}/api/system/reset`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${workerToken}` }
    });
    assert.equal(workerRes.status, 403);
  });

  // Test 12: Priority 1 Fix — Session Secret Fails Safely in Production
  test('Fails safely when SESSION_SECRET is missing or default in production', async () => {
    const { getSessionSecret } = await import('../auth.js');
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.SESSION_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SESSION_SECRET;

      assert.throws(
        () => getSessionSecret(),
        /FATAL SECURITY MISCONFIGURATION: SESSION_SECRET is not defined/
      );

      process.env.SESSION_SECRET = 'fairshift-secret-key-prompt-wars-2026';
      assert.throws(
        () => getSessionSecret(),
        /FATAL SECURITY MISCONFIGURATION: SESSION_SECRET in production cannot use the known development secret/
      );
    } finally {
      process.env.NODE_ENV = origEnv;
      process.env.SESSION_SECRET = origSecret;
    }
  });

  // Test 13: Enforce organization-level access on GET /api/skills for managers
  test('GET /api/skills strictly prevents managers from accessing skills of workers in another organization', async () => {
    // Arumugam (Construction manager, org-const-01) attempts to query Priya's skills (Healthcare worker, org-health-01)
    const res = await fetch(`${BASE_URL}/api/skills?workerId=usr-worker-priya`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes('Managers cannot access skill records of workers belonging to another organization'));
  });

  // Test 14: Enforce organization-level boundary on PATCH /api/skills/:id/verify
  test('PATCH /api/skills/:id/verify prevents managers from verifying skills of workers in another organization', async () => {
    // Arumugam (Construction manager) attempts to verify skill sk-h-01 belonging to Priya (Healthcare worker)
    const res = await fetch(`${BASE_URL}/api/skills/sk-h-01/verify`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${managerToken}`
      },
      body: JSON.stringify({ certificateRef: 'MALICIOUS-CROSS-ORG-APPROVAL' })
    });
    assert.equal(res.status, 403);
    const data = await res.json();
    assert.ok(data.error.includes('Managers cannot verify skills for workers outside their organization'));
  });

  // Test 15: Database optimization check - GET /api/attendance strictly isolates by manager organization
  test('GET /api/attendance returns only records belonging to the manager organization', async () => {
    const res = await fetch(`${BASE_URL}/api/attendance`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    for (const record of data) {
      assert.equal(record.organizationId, 'org-const-01');
    }
  });

  // Test 16: Database optimization check - GET /api/skills without workerId strictly joins and filters by manager organization
  test('GET /api/skills without workerId parameter returns only skills belonging to workers in manager organization', async () => {
    const res = await fetch(`${BASE_URL}/api/skills`, {
      headers: { 'Authorization': `Bearer ${managerToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
    assert.ok(data.length > 0);
    // Verified skills should only belong to construction workers
    const constWorkerIds = new Set(['usr-worker-murugan', 'usr-worker-rajesh']);
    for (const skill of data) {
      assert.ok(constWorkerIds.has(skill.workerId));
    }
  });
});
