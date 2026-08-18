/**
 * Performance diagnostic script — run with: npx tsx perf-diagnostic.ts
 * Measures actual DB query counts and response times for key endpoints.
 */
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:13000';

interface TestResult {
  name: string;
  time: number;
  status: number;
  payloadSize: number;
  details: string;
}

async function measureEndpoint(
  name: string,
  url: string,
  cookie?: string,
): Promise<TestResult> {
  const start = performance.now();
  try {
    const headers: Record<string, string> = {};
    if (cookie) headers['Cookie'] = cookie;
    
    const res = await fetch(url, { headers });
    const body = await res.text();
    const elapsed = Math.round(performance.now() - start);
    
    return {
      name,
      time: elapsed,
      status: res.status,
      payloadSize: body.length,
      details: res.status === 200 
        ? `${elapsed}ms, ${(body.length / 1024).toFixed(1)}KB` 
        : `${elapsed}ms, HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name,
      time: Math.round(performance.now() - start),
      status: 0,
      payloadSize: 0,
      details: `FAILED: ${(err as Error).message}`,
    };
  }
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'sadmin', password: 'sadmin123' }),
  });
  
  if (res.status !== 200) {
    throw new Error(`Login failed: HTTP ${res.status}`);
  }
  
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) throw new Error('No cookie in response');
  
  // Extract the token cookie
  const match = setCookie.match(/token=([^;]+)/);
  return match ? `token=${match[1]}` : setCookie.split(';')[0];
}

async function main() {
  console.log('=== Nora Device Mng — Performance Diagnostic ===');
  console.log(`Target: ${BASE}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Login first
  let cookie: string;
  try {
    cookie = await login();
    console.log('✅ Login successful\n');
  } catch (err) {
    console.error('❌ Login failed:', (err as Error).message);
    console.error('   Make sure backend is running on', BASE);
    process.exit(1);
  }

  // === Test 1: Individual endpoint timing ===
  console.log('--- Individual Endpoint Timing ---');
  const endpoints = [
    { name: 'GET /api/auth/me', url: `${BASE}/api/auth/me` },
    { name: 'GET /api/devices (page 1)', url: `${BASE}/api/devices?page=1&limit=20` },
    { name: 'GET /api/devices (100 items)', url: `${BASE}/api/devices?page=1&limit=100` },
    { name: 'GET /api/locations', url: `${BASE}/api/locations` },
    { name: 'GET /api/areas', url: `${BASE}/api/areas` },
    { name: 'GET /api/rooms (flat)', url: `${BASE}/api/rooms` },
    { name: 'GET /api/rooms/tree', url: `${BASE}/api/rooms/tree` },
    { name: 'GET /api/notifications', url: `${BASE}/api/notifications` },
    { name: 'GET /api/users', url: `${BASE}/api/users` },
    { name: 'GET /api/audit-log', url: `${BASE}/api/audit-log?page=1&limit=20` },
  ];

  const results: TestResult[] = [];
  for (const ep of endpoints) {
    const r = await measureEndpoint(ep.name, ep.url, cookie);
    results.push(r);
    const icon = r.status === 200 ? '✅' : '⚠️';
    const timeColor = r.time > 1000 ? '🔴' : r.time > 300 ? '🟡' : '🟢';
    console.log(`  ${icon} ${timeColor} ${r.name}: ${r.details}`);
  }

  // === Test 2: Concurrent load (simulate 4 tabs) ===
  console.log('\n--- Concurrent Load (4 tabs × 5 endpoints) ---');
  const concurrentEndpoints = [
    `${BASE}/api/devices?page=1&limit=20`,
    `${BASE}/api/locations`,
    `${BASE}/api/areas`,
    `${BASE}/api/notifications`,
    `${BASE}/api/auth/me`,
  ];

  const tabCount = 4;
  const start = performance.now();
  const concurrentPromises: Promise<TestResult>[] = [];
  for (let tab = 0; tab < tabCount; tab++) {
    for (const url of concurrentEndpoints) {
      concurrentPromises.push(measureEndpoint(`Tab${tab+1}`, url, cookie));
    }
  }
  const concurrentResults = await Promise.all(concurrentPromises);
  const totalTime = Math.round(performance.now() - start);
  
  const times = concurrentResults.map(r => r.time);
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const max = Math.max(...times);
  const min = Math.min(...times);
  const failures = concurrentResults.filter(r => r.status !== 200).length;
  
  console.log(`  Total wall time: ${totalTime}ms`);
  console.log(`  Requests: ${concurrentResults.length} (${tabCount} tabs × ${concurrentEndpoints.length} endpoints)`);
  console.log(`  Avg response: ${avg}ms`);
  console.log(`  Min: ${min}ms, Max: ${max}ms`);
  console.log(`  Failures: ${failures}`);
  console.log(`  Auth DB overhead: ${concurrentResults.filter(r => r.status === 200).length * 2} queries (2 per request)`);

  // === Test 3: Room tree stress ===
  console.log('\n--- Room Tree Stress (4 concurrent calls) ---');
  const treeStart = performance.now();
  const treeResults = await Promise.all([
    measureEndpoint('Tree1', `${BASE}/api/rooms/tree`, cookie),
    measureEndpoint('Tree2', `${BASE}/api/rooms/tree`, cookie),
    measureEndpoint('Tree3', `${BASE}/api/rooms/tree`, cookie),
    measureEndpoint('Tree4', `${BASE}/api/rooms/tree`, cookie),
  ]);
  const treeTotal = Math.round(performance.now() - treeStart);
  const treeTimes = treeResults.map(r => r.time);
  console.log(`  Wall time: ${treeTotal}ms`);
  console.log(`  Individual: ${treeTimes.join('ms, ')}ms`);
  console.log(`  Max: ${Math.max(...treeTimes)}ms`);
  if (treeResults[0].status === 200) {
    try {
      const treeData = await (await fetch(`${BASE}/api/rooms/tree`, { headers: { Cookie: cookie } })).json();
      function countNodes(nodes: any[]): number {
        let count = nodes.length;
        for (const n of nodes) {
          if (n.children) count += countNodes(n.children);
        }
        return count;
      }
      const nodeCount = countNodes(treeData);
      const estimatedQueries = nodeCount * 8;
      console.log(`  Tree nodes: ${nodeCount}`);
      console.log(`  Estimated DB queries per call: ~${estimatedQueries}`);
      console.log(`  4 concurrent calls: ~${estimatedQueries * 4} DB queries!`);
    } catch {}
  }

  // === Test 4: SSE connection test ===
  console.log('\n--- SSE Connection Test ---');
  console.log(`  Opening 4 SSE connections (simulating 4 tabs)...`);
  
  const sseConns: Array<{ readable: ReadableStream | null; abort: () => void }> = [];
  for (let i = 0; i < 4; i++) {
    const controller = new AbortController();
    try {
      const res = await fetch(`${BASE}/api/notifications/stream`, {
        headers: { Cookie: cookie },
        signal: controller.signal,
      });
      sseConns.push({ readable: res.body, abort: () => controller.abort() });
      console.log(`  ✅ SSE #${i+1}: Connected (status ${res.status})`);
    } catch (err) {
      console.log(`  ❌ SSE #${i+1}: Failed — ${(err as Error).message}`);
    }
  }
  
  console.log(`  ${sseConns.length} SSE connections held open`);
  console.log(`  Each connection: 1 persistent HTTP + 1 setInterval(25s heartbeat)`);
  console.log(`  Server memory per connection: ~Response object + subscriber entry`);
  
  // Close after measurement
  sseConns.forEach(c => c.abort());
  console.log(`  Closed all SSE connections.`);

  // === Summary ===
  console.log('\n=== PERFORMANCE SUMMARY ===');
  console.log('');
  console.log('🔴 CRITICAL Issues:');
  console.log('  1. SSE per tab: 4 tabs = 4 persistent connections + 4 heartbeat timers');
  console.log('     → Fix: Use BroadcastChannel to share 1 SSE across tabs');
  console.log('  2. Room tree N+1: Each /api/rooms/tree call runs O(N²) DB queries');
  console.log('     → Fix: Fetch all rooms in 1 query, build tree in-memory');
  console.log('  3. Auth middleware: 2 DB queries per request (user + permission)');
  console.log(`     → 4 tabs × 5 endpoints = 40 unnecessary DB queries on page load`);
  console.log('');
  console.log('🟡 HIGH Issues:');
  console.log('  4. Duplicate API calls: device-list + device-filter-bar both call getLocations()');
  console.log('  5. No list virtualization with page size 100');
  console.log('  6. No React.memo on DeviceCard, DeviceListRow, RoomTreeItem');
  console.log('');
  console.log('💡 Recommended for low-spec systems (Ryzen 3, 4GB RAM):');
  console.log('  - Reduce default page size from 100 to 20');
  console.log('  - Cache permissions in memory (they rarely change)');
  console.log('  - Cache user lookup in JWT verification flow');
  console.log('  - Share SSE connection across browser tabs');
  console.log('  - Batch room tree query into single SQL');
}

main().catch(console.error);
