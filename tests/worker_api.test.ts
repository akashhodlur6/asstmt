/**
 * AssetMT Test Suite: Cloudflare Worker API
 * Tests Worker endpoint routing, authentication guards, and response contracts.
 */

import workerHandler from '../worker/index.ts';

export async function runWorkerApiTests(): Promise<{ passed: number; failed: number; tests: string[] }> {
  let passed = 0;
  let failed = 0;
  const tests: string[] = [];

  function assert(name: string, condition: boolean, details?: string) {
    if (condition) {
      passed++;
      tests.push(`[PASS] ${name}`);
    } else {
      failed++;
      tests.push(`[FAIL] ${name} ${details ? `(${details})` : ''}`);
    }
  }

  const dummyEnv = {
    SUPABASE_URL: 'https://test-placeholder.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
  };

  // 1. Health check endpoint (Public)
  const healthReq = new Request('http://localhost:3000/api/health', { method: 'GET' });
  const healthRes = await workerHandler.fetch(healthReq, dummyEnv);
  assert('Worker GET /api/health returns 200', healthRes.status === 200);
  const healthJson = await healthRes.json();
  assert('Health response contains status: "healthy"', healthJson.status === 'healthy');

  // 2. Config status endpoint (Public)
  const configReq = new Request('http://localhost:3000/api/config-status', { method: 'GET' });
  const configRes = await workerHandler.fetch(configReq, dummyEnv);
  assert('Worker GET /api/config-status returns 200', configRes.status === 200);
  const configJson = await configRes.json();
  assert('Config status identifies AssetMT Cloudflare Worker API', configJson.service.includes('AssetMT'));

  // 3. Authenticated endpoint without Authorization header (Must reject with 401)
  const unauthReq = new Request('http://localhost:3000/api/assets', { method: 'GET' });
  const unauthRes = await workerHandler.fetch(unauthReq, dummyEnv);
  assert('Request to /api/assets without Authorization header returns 401', unauthRes.status === 401);
  const unauthJson = await unauthRes.json();
  assert('Response error code is UNAUTHORIZED', unauthJson.error === 'UNAUTHORIZED');

  // 4. Authenticated endpoint with malformed Authorization header (Must reject with 401)
  const malformedReq = new Request('http://localhost:3000/api/workspace', {
    method: 'GET',
    headers: { Authorization: 'Basic invalid-credentials' },
  });
  const malformedRes = await workerHandler.fetch(malformedReq, dummyEnv);
  assert('Malformed Authorization header returns 401', malformedRes.status === 401);

  // 5. Authenticated endpoint with missing Supabase configuration (Must reject with 503 CONFIG_MISSING)
  const emptyEnv = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
  const noConfigReq = new Request('http://localhost:3000/api/workspace', {
    method: 'GET',
    headers: { Authorization: 'Bearer some-test-jwt-token' },
  });
  const noConfigRes = await workerHandler.fetch(noConfigReq, emptyEnv);
  assert('Missing server Supabase configuration returns 503', noConfigRes.status === 503);
  const noConfigJson = await noConfigRes.json();
  assert('Error is CONFIG_MISSING', noConfigJson.error === 'CONFIG_MISSING');

  // 6. Unknown /api endpoint returns 404
  const notFoundReq = new Request('http://localhost:3000/api/nonexistent-route', {
    method: 'GET',
    headers: { Authorization: 'Bearer mock' },
  });
  // Without credentials it rejects with 503 or 401, with valid routing it returns 404
  const notFoundRes = await workerHandler.fetch(notFoundReq, emptyEnv);
  assert('Invalid API route handled safely without unhandled crashes', notFoundRes.status === 503 || notFoundRes.status === 404 || notFoundRes.status === 401);

  return { passed, failed, tests };
}
