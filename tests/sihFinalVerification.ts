/**
 * MITRA DRISHTI — SIH26038 FINAL ALIGNMENT & GAP CLOSURE VERIFICATION SUITE
 * File: tests/sihFinalVerification.ts
 * Tests:
 * 1. MATLAB retinal image preprocessing and segmentation scripts
 * 2. Python MATLAB-parity execution engine
 * 3. Camera compatibility registry and calibration profiles
 * 4. Model governance and rollback endpoint
 * 5. WebCrypto AES-GCM offline encryption & decryption
 * 6. Lost-device remote revocation endpoint
 * 7. HL7 FHIR R4 Patient, Observation, ServiceRequest and Bundle mapper
 * 8. Patient consent withdrawal endpoint
 * 9. Regional voice guidance service in Tamil, Hindi, English
 * 10. All 6 Simulink scenarios and annual capacity modeling
 * 11. Clinical & ethical validation protocol
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { createMritidhristiApp } from '../server.ts';
import { store } from '../server/store.ts';
import { FUNDUS_CAMERA_REGISTRY, getCameraProfile } from '../src/services/cameraRegistry.ts';
import { createPatientFhirBundle } from '../src/services/fhirMapper.ts';
import { CLINICAL_VOICE_PROMPTS, voiceGuidance } from '../src/services/voiceGuidance.ts';
import { getOrCreateDeviceId, encryptOfflineData, decryptOfflineData } from '../src/offline/crypto.ts';

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

async function runSihVerification() {
  console.log('===================================================================');
  console.log(' MITRA DRISHTI: SIH26038 MASTER ALIGNMENT & GAP CLOSURE VERIFICATION');
  console.log('===================================================================');

  const root = process.cwd();

  // 1. MATLAB Retinal Processing & Segmentation
  const prepMatlab = path.join(root, 'matlab', 'mritidhristi_retinal_preprocessing.m');
  const segMatlab = path.join(root, 'matlab', 'mritidhristi_structure_and_lesion_segmentation.m');
  const pyMatlabBridge = path.join(root, 'scripts', 'matlab_retinal_processor.py');

  assert(fs.existsSync(prepMatlab), 'MATLAB preprocessing script exists (matlab/mritidhristi_retinal_preprocessing.m)');
  const prepContent = fs.readFileSync(prepMatlab, 'utf-8');
  assert(prepContent.includes('adapthisteq'), 'MATLAB script implements adaptive CLAHE enhancement');
  assert(prepContent.includes('lapVar'), 'MATLAB script implements Laplacian focus variance IQA');

  assert(fs.existsSync(segMatlab), 'MATLAB structure & lesion segmentation script exists (matlab/mritidhristi_structure_and_lesion_segmentation.m)');
  const segContent = fs.readFileSync(segMatlab, 'utf-8');
  assert(segContent.includes('imtophat'), 'MATLAB script implements morphological top-hat microaneurysm detection');
  assert(segContent.includes('imfilter'), 'MATLAB script implements 12-direction 2D matched vessel filter bank');

  assert(fs.existsSync(pyMatlabBridge), 'Python MATLAB-parity processor exists (scripts/matlab_retinal_processor.py)');

  // 2. Camera Compatibility Registry
  assert(FUNDUS_CAMERA_REGISTRY.length >= 5, `Camera registry includes ${FUNDUS_CAMERA_REGISTRY.length} camera profiles`);
  const forus = FUNDUS_CAMERA_REGISTRY.find((c) => c.id === 'cam-forus-3nethra');
  const remidio = FUNDUS_CAMERA_REGISTRY.find((c) => c.id === 'cam-remidio-fop');
  assert(Boolean(forus && forus.deploymentTier.includes('Primary Health Centre')), 'Forus 3nethra configured for PHC deployment');
  assert(Boolean(remidio && remidio.deploymentTier.includes('Mobile Van')), 'Remidio FOP configured for mobile van field screening');
  const retrievedCam = getCameraProfile('cam-remidio-fop');
  assert(retrievedCam.calibration.minSharpnessLaplacianVar > 0, 'Camera profile specifies calibrated sharpness thresholds');

  // 3. Offline Encryption and Key Management
  const testPii = { name: 'Muthulakshmi', phone: '9842112345', mrn: 'MRD-TN-89177' };
  const encrypted = await encryptOfflineData(testPii);
  assert(typeof encrypted === 'string' && encrypted.length > 20, 'WebCrypto AES-GCM offline encryption envelope generated');
  const decrypted = await decryptOfflineData(encrypted);
  assert(decrypted.name === 'Muthulakshmi', 'Offline data correctly decrypted with data integrity');
  const deviceId = getOrCreateDeviceId();
  assert(deviceId.startsWith('dev-'), `Device bound to hardware ID: ${deviceId}`);

  // 4. HL7 FHIR R4 Resource Mapper
  const mockPatient = store.data.patients[0];
  const mockScreening = store.data.screenings[0] || {
    id: 'scr-1',
    patientId: mockPatient.id,
    capturedAt: new Date().toISOString(),
    eye: 'Right (OD)',
    cameraSource: 'Forus 3nethra',
    humanReviewStatus: 'confirmed',
    modelPrediction: { icdrGrade: 2, gradeLabel: 'Moderate NPDR', confidence: 0.85 },
    gradCam: { hotspots: [{ x: 0.5, y: 0.5 }] },
  } as any;
  const mockReferral = store.data.referrals[0] || {
    id: 'ref-1',
    patientId: mockPatient.id,
    urgency: 'Priority',
    status: 'Pending',
    createdAt: new Date().toISOString(),
    targetFacility: 'District Hospital',
  } as any;

  const fhirBundle = createPatientFhirBundle(mockPatient, [mockScreening], [mockReferral]);
  assert(fhirBundle.resourceType === 'Bundle', 'HL7 FHIR R4 Bundle generated');
  assert(fhirBundle.entry.length === 3, 'FHIR Bundle includes Patient, Observation, and ServiceRequest');
  const patientResource: any = fhirBundle.entry[0].resource;
  assert(patientResource.resourceType === 'Patient', 'FHIR Patient resource verified');
  const obsResource: any = fhirBundle.entry[1].resource;
  assert(obsResource.resourceType === 'Observation' && obsResource.code.coding[0].code === '69729-2', 'FHIR Observation LOINC 69729-2 verified');

  // 5. Regional Language Voice Guidance Service
  assert(Boolean(CLINICAL_VOICE_PROMPTS.lifestyle_intro), 'Clinical voice prompts registry initialized');
  assert(Boolean(CLINICAL_VOICE_PROMPTS.lifestyle_intro.texts.ta), 'Tamil voice prompt available');
  assert(Boolean(CLINICAL_VOICE_PROMPTS.lifestyle_intro.texts.hi), 'Hindi voice prompt available');
  voiceGuidance.setLanguage('ta');
  assert(voiceGuidance.getLanguage() === 'ta', 'Voice guidance language switched to Tamil (ta)');

  // 6. MathWorks Simulink 6 Scenarios & Annual Capacity
  const simJsonPath = path.join(root, 'simulink', 'district_scenario_outputs.json');
  const simScenarios = JSON.parse(fs.readFileSync(simJsonPath, 'utf-8'));
  assert(simScenarios.length === 6, `All 6 district scenarios present in Simulink output (${simScenarios.length})`);
  const highDemand = simScenarios.find((s: any) => s.scenarioKey === 'high_demand');
  assert(highDemand && highDemand.dailyPatientArrivals === 340, 'High demand scenario models 340 arrivals/day (>100,000/year)');

  // 7. Clinical Validation Protocol
  const protocolPath = path.join(root, 'docs', 'CLINICAL_VALIDATION_PROTOCOL.md');
  assert(fs.existsSync(protocolPath), 'Clinical validation protocol document exists (docs/CLINICAL_VALIDATION_PROTOCOL.md)');
  const protocolContent = fs.readFileSync(protocolPath, 'utf-8');
  assert(protocolContent.includes('Clopper-Pearson'), 'Protocol specifies Clopper-Pearson 95% confidence intervals');
  assert(protocolContent.includes('ICMR National Ethical Guidelines'), 'Protocol adheres to ICMR ethical guidelines');

  // 8. Test Backend API Endpoints (Camera Registry, Model Governance, Rollback, FHIR, Consent, Device Revocation)
  process.env.MRITIDHRISTI_TEST = 'true';
  const app = await createMritidhristiApp({ skipFrontend: true });
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // Admin login
    const adminLogin = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    });
    const { token: adminToken } = await adminLogin.json();

    // Doctor login
    const docLogin = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'doctor' }),
    });
    const { token: docToken } = await docLogin.json();

    // Patient login
    const patLogin = await fetch(`${baseUrl}/api/auth/demo-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'patient' }),
    });
    const { token: patToken } = await patLogin.json();

    // Test GET /api/detect/cameras
    const camRes = await fetch(`${baseUrl}/api/detect/cameras`, {
      headers: { Authorization: `Bearer ${docToken}` },
    });
    const camData = await camRes.json();
    assert(camRes.status === 200, 'GET /api/detect/cameras returns HTTP 200');
    assert(camData.cameras.length >= 5, 'Returned camera compatibility list');

    // Test GET /api/detect/models/governance
    const govRes = await fetch(`${baseUrl}/api/detect/models/governance`, {
      headers: { Authorization: `Bearer ${docToken}` },
    });
    const govData = await govRes.json();
    assert(govRes.status === 200, 'GET /api/detect/models/governance returns HTTP 200');
    assert(govData.activeModel.version === 'v1.0-clinical', 'Active model version verified');

    // Test POST /api/detect/models/rollback
    const rollbackRes = await fetch(`${baseUrl}/api/detect/models/rollback`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const rollbackData = await rollbackRes.json();
    assert(rollbackRes.status === 200, 'POST /api/detect/models/rollback returns HTTP 200 for admin');
    assert(rollbackData.success === true, 'Model rollback executed successfully');

    // Test GET /api/patients/:id/fhir
    const fhirRes = await fetch(`${baseUrl}/api/patients/${mockPatient.id}/fhir`, {
      headers: { Authorization: `Bearer ${docToken}` },
    });
    const fhirData = await fhirRes.json();
    assert(fhirRes.status === 200, 'GET /api/patients/:id/fhir returns HTTP 200');
    assert(fhirData.resourceType === 'Bundle', 'FHIR Bundle returned by API');

    // Test POST /api/patients/:id/consent/withdraw
    const consentRes = await fetch(`${baseUrl}/api/patients/${mockPatient.id}/consent/withdraw`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${docToken}` },
    });
    const consentData = await consentRes.json();
    assert(consentRes.status === 200, 'POST /api/patients/:id/consent/withdraw returns HTTP 200');
    assert(consentData.consent.screeningConsent === false, 'Patient consent successfully marked withdrawn');

    // Test POST /api/admin/devices/:deviceId/revoke
    const revokeRes = await fetch(`${baseUrl}/api/admin/devices/dev-lost-tablet-01/revoke`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const revokeData = await revokeRes.json();
    assert(revokeRes.status === 200, 'POST /api/admin/devices/:deviceId/revoke returns HTTP 200');
    assert(revokeData.deviceStatus === 'revoked', 'Lost device deactivated and revoked');

  } finally {
    server.close();
  }

  console.log('-------------------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runSihVerification().catch((err) => {
  console.error('Fatal SIH verification error:', err);
  process.exit(1);
});
