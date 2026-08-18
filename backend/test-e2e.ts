const BASE_URL = 'http://localhost:13000/api';
let cookieHeader = '';
let createdSystemId = '';
let locationId = '';
let areaId = '';

async function runE2E() {
  try {
    console.log('--- STARTING E2E VERIFICATION FOR "HỆ THỐNG" ---');

    console.log('\n[0] Logging in...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password' })
    });
    const rawSetCookie = loginRes.headers.get('set-cookie') || '';
    cookieHeader = rawSetCookie.split(';')[0];
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error('Login failed: ' + JSON.stringify(loginData));
    console.log('✅ Logged in successfully!');

    const headers = { 
      'Cookie': cookieHeader,
      'Content-Type': 'application/json'
    };

    console.log('\n[0.5] Fetching required location and area...');
    const locRes = await fetch(`${BASE_URL}/locations`, { headers });
    const locData = await locRes.json();
    locationId = locData[0]?.id;
    
    const areaRes = await fetch(`${BASE_URL}/areas`, { headers });
    const areaData = await areaRes.json();
    areaId = areaData[0]?.id;
    
    if (!locationId || !areaId) throw new Error('Location or Area not found in DB');
    console.log(`✅ Fetched Location: ${locationId}, Area: ${areaId}`);

    console.log('\n[1] Creating a new System (Hệ thống)...');
    const createRes = await fetch(`${BASE_URL}/devices`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'Hệ thống Server Quản lý Nội bộ',
        store_id: 'SYS-001',
        location_id: locationId,
        area_id: areaId,
        type: 'system',
        systemCategory: 'phần mềm',
        status: 'active'
      })
    });

    const createData = await createRes.json();
    if (createRes.ok) {
      console.log('✅ System created successfully!');
      createdSystemId = createData.id;
    } else {
      console.log('❌ Failed to create system:', createRes.status, createData);
    }

    console.log('\n[2] Fetching list of systems (type=system)...');
    const listRes = await fetch(`${BASE_URL}/devices?type=system`, { headers });
    const listData = await listRes.json();
    
    if (listRes.ok) {
      const systems = listData.items || [];
      const found = systems.some((s: any) => s.store_id === 'SYS-001');
      if (found) {
        console.log(`✅ Fetch successful! Found ${systems.length} systems. Our new system is in the list.`);
      } else {
        console.log(`✅ Fetch successful (${systems.length} systems) but the newly created one wasn't found.`);
        console.log('Fetching specific device to debug...');
        const devRes = await fetch(`${BASE_URL}/devices/${createdSystemId}`, { headers });
        const devData = await devRes.json();
        console.log('Created Device Type:', devData.type, 'SystemCategory:', devData.systemCategory);
      }
    } else {
      console.log('❌ Failed to fetch list:', listRes.status, listData);
    }

    console.log('\n--- E2E VERIFICATION FINISHED ---');
  } catch (error: any) {
    console.error('❌ E2E Script encountered an error:', error.message);
  }
}

runE2E();
