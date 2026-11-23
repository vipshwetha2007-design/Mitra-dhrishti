import fs from 'fs';
import path from 'path';
import http from 'http';
import { createMritidhristiApp } from '../server.ts';
import { store } from '../server/store.ts';

let passed = 0;
let failed = 0;

function assert(cond: boolean, desc: string) {
  if (cond) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

async function runSimulinkTests() {
  console.log('===================================================================');
  console.log(' MRITIDHRISTI PHASE 11: MATLAB/SIMULINK RESOURCE PLANNING MODELS');
  console.log('===================================================================');

  const root = process.cwd();
  const matlabModelPath = path.join(root, 'simulink', 'mritidhristi_district_capacity_model.m');
  const pythonEnginePath = path.join(root, 'simulink', 'run_simulation.py');
  const csvPath = path.join(root, 'simulink', 'district_scenario_outputs.csv');
  const jsonPath = path.join(root, 'simulink', 'district_scenario_outputs.json');

  // 1. Check MATLAB/Simulink artifacts
  assert(fs.existsSync(matlabModelPath), 'MATLAB capacity model file exists (simulink/mritidhristi_district_capacity_model.m)');
  const matlabContent = fs.readFileSync(matlabModelPath, 'utf-8');
  assert(matlabContent.includes('function results = mritidhristi_district_capacity_model()'), 'Contains valid MATLAB entrypoint function');
  assert(matlabContent.includes('erlang_c_queue'), 'Implements Erlang-C discrete-event queueing formulas');

  const builderPath = path.join(root, 'simulink', 'build_mritidhristi_simulink_model.m');
  assert(fs.existsSync(builderPath), 'Programmatic Simulink model builder exists (simulink/build_mritidhristi_simulink_model.m)');

  // 2. Check Python simulator engine
  assert(fs.existsSync(pythonEnginePath), 'Python discrete-event queueing engine exists (simulink/run_simulation.py)');
  assert(fs.existsSync(csvPath), 'Generated scenario CSV exists (simulink/district_scenario_outputs.csv)');
  assert(fs.existsSync(jsonPath), 'Generated scenario JSON exists (simulink/district_scenario_outputs.json)');

  // 3. Inspect JSON scenario outputs
  const scenarios = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  assert(scenarios.length === 6, `All 6 district scenarios modeled (${scenarios.length})`);

  const normal = scenarios.find((s: any) => s.scenarioKey === 'normal');
  const surge = scenarios.find((s: any) => s.scenarioKey === 'high_demand' || s.scenarioKey === 'rural_surge');
  const shortage = scenarios.find((s: any) => s.scenarioKey === 'ophthalmologist_shortage');
  const transport = scenarios.find((s: any) => s.scenarioKey === 'limited_connectivity' || s.scenarioKey === 'transport_delay');
  const cameraShortage = scenarios.find((s: any) => s.scenarioKey === 'camera_shortage');
  const referralSurge = scenarios.find((s: any) => s.scenarioKey === 'increased_referral_demand');

  assert(normal && normal.dailyPatientArrivals === 135, 'Baseline scenario: 135 daily arrivals');
  assert(surge && surge.dailyPatientArrivals >= 240, `High demand scenario: ${surge?.dailyPatientArrivals} daily arrivals`);
  assert(surge.bottleneck.includes('Capture Desk Saturation') || surge.avgWaitTimeMinutes > normal.avgWaitTimeMinutes, 'Surge correctly detects capacity saturation or increased wait');
  assert(shortage && shortage.bottleneck.includes('Specialist Ophthalmologist Review Backlog'), 'Shortage scenario detects ophthalmologist backlog');
  assert(transport && transport.bottleneck.includes('Rural Transit & Referral Dropout Failure'), 'Connectivity/transit delay detects dropout bottleneck');
  assert(Boolean(cameraShortage), 'Camera shortage scenario modeled');
  assert(Boolean(referralSurge), 'Increased referral demand scenario modeled');

  // 4. Test API Import of Simulink CSV into District Analytics
  process.env.MRITIDHRISTI_TEST = 'true';
  const app = await createMritidhristiApp({ skipFrontend: true });
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const adminLogin = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    const { token: adminToken } = await adminLogin.json();

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const importRes = await fetch(`${baseUrl}/api/admin/simulink/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ csvText: csvContent }),
    });
    const importData = await importRes.json();

    assert(importRes.status === 200, 'POST /api/admin/simulink/import returns HTTP 200');
    assert(importData.importedCount >= 4, `Admin successfully imported ${importData.importedCount} Simulink scenarios into platform store`);
    assert(Array.isArray(importData.simulations), 'Simulations array returned in response');

  } finally {
    server.close();
  }

  console.log('-------------------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSimulinkTests().catch((err) => {
  console.error('Fatal Simulink test error:', err);
  process.exit(1);
});
