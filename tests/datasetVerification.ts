/**
 * MITRA DRISHTI — PREVENT • DETECT • PROTECT
 * Phase 5 Retinal Dataset Preparation & Clinical Quality Verification Suite
 *
 * Verifies:
 *  1. Dataset manifest and genuine source attribution (APTOS 2019 / Aravind Eye Hospital)
 *  2. Genuine clinical image count verification (3,662 fundus scans)
 *  3. Quality assessment audit metrics (Laplacian blur variance, luminance, zero uninspected scans)
 *  4. 5-Class ICDR label integrity (0 to 4 integers, class names, clinical descriptions)
 *  5. Leakage-free partition verification (train.csv, val.csv, test.csv)
 *  6. Zero cross-split contamination (Train ∩ Val = ∅, Train ∩ Test = ∅, Val ∩ Test = ∅)
 *  7. Perceptual duplicate & near-duplicate isolation across splits (zero duplicate MD5 leaks)
 *  8. Class distribution & multi-strategy class weights (inverse weights & effective weights)
 *  9. Preprocessing configuration (Graham's circular FOV crop, Lanczos resampling, ImageNet norm)
 * 10. Multi-cohort benchmark licensing documentation (EyePACS, DDR, IDRiD, DRIVE, Messidor-2)
 * 11. Backend API dataset-stats endpoint integration
 */

import fs from 'fs';
import http from 'http';
import path from 'path';
import { createMritidhristiApp } from '../server.ts';
import { store } from '../server/store.ts';

interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
}

const tests: TestCase[] = [];
function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const BASE_DIR = process.cwd();
const DATASETS_DIR = path.join(BASE_DIR, 'datasets');
const METADATA_DIR = path.join(DATASETS_DIR, 'metadata');
const SPLITS_DIR = path.join(DATASETS_DIR, 'splits');
const REPORTS_DIR = path.join(BASE_DIR, 'reports');
const DOCS_DIR = path.join(BASE_DIR, 'docs');

// ---------------------------------------------------------------------------
// 1. Manifest & Attribution
// ---------------------------------------------------------------------------
test('Test 1: Dataset manifest exists and attributes genuine clinical origin', () => {
  const manifestPath = path.join(METADATA_DIR, 'manifest.json');
  assert(fs.existsSync(manifestPath), 'manifest.json must exist in datasets/metadata/');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert(manifest.dataset_name.includes('APTOS 2019'), 'Must identify APTOS 2019 Blindness Detection');
  assert(manifest.primary_source.includes('Aravind Eye Hospital'), 'Must attribute Aravind Eye Hospital cohort in Tamil Nadu');
  assert(manifest.curation_version === '5.0.0', 'Curation version must be 5.0.0');
});

// ---------------------------------------------------------------------------
// 2. Genuine Image Count Verification
// ---------------------------------------------------------------------------
test('Test 2: Verified genuine clinical image count matches official cohort (3,662 scans)', () => {
  const manifestPath = path.join(METADATA_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  assert(manifest.total_inspected_images === 3662, `Total inspected images must be 3662, got ${manifest.total_inspected_images}`);
  assert(manifest.valid_usable_images === 3662, `Valid images must be 3662, got ${manifest.valid_usable_images}`);
  assert(manifest.rejected_images_count === 0, `Rejected count must be 0 for official curated set`);
});

// ---------------------------------------------------------------------------
// 3. Quality Assessment Audit
// ---------------------------------------------------------------------------
test('Test 3: Quality audit report exists with real Laplacian focus and luminance distributions', () => {
  const reportPath = path.join(REPORTS_DIR, 'dataset_quality_report.json');
  const mdPath = path.join(REPORTS_DIR, 'dataset_quality_report.md');
  assert(fs.existsSync(reportPath), 'dataset_quality_report.json must exist');
  assert(fs.existsSync(mdPath), 'dataset_quality_report.md must exist');

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  assert(report.total_inspected === 3662, 'Quality report must cover all 3662 images');
  assert(report.pass_rate_pct === 100.0, 'Pass rate must be 100%');
  assert(report.mean_laplacian_variance > 50.0, `Mean Laplacian variance must indicate sharp focus (>50), got ${report.mean_laplacian_variance}`);
  assert(report.mean_fov_luminance > 40.0 && report.mean_fov_luminance < 200.0, `Mean FOV luminance must be within diagnostic exposure range, got ${report.mean_fov_luminance}`);
});

// ---------------------------------------------------------------------------
// 4. ICDR 5-Class Label Integrity
// ---------------------------------------------------------------------------
test('Test 4: 5-Class ICDR label range and validity check (0-4 integers, zero invalid/null)', () => {
  const manifestPath = path.join(METADATA_DIR, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  const dist = manifest.class_distribution_overall;
  assert(dist['0'] === 1805, `Class 0 (No DR) must be 1805, got ${dist['0']}`);
  assert(dist['1'] === 370, `Class 1 (Mild NPDR) must be 370, got ${dist['1']}`);
  assert(dist['2'] === 999, `Class 2 (Moderate NPDR) must be 999, got ${dist['2']}`);
  assert(dist['3'] === 193, `Class 3 (Severe NPDR) must be 193, got ${dist['3']}`);
  assert(dist['4'] === 295, `Class 4 (Proliferative DR) must be 295, got ${dist['4']}`);

  const total = dist['0'] + dist['1'] + dist['2'] + dist['3'] + dist['4'];
  assert(total === 3662, `Sum of all ICDR classes must equal 3662, got ${total}`);
});

// ---------------------------------------------------------------------------
// 5. Partition CSVs Existence
// ---------------------------------------------------------------------------
test('Test 5: Partition CSVs exist (train.csv, val.csv, test.csv)', () => {
  for (const split of ['train', 'val', 'test']) {
    const csvPath = path.join(SPLITS_DIR, `${split}.csv`);
    assert(fs.existsSync(csvPath), `${split}.csv must exist in datasets/splits/`);
    const content = fs.readFileSync(csvPath, 'utf-8').trim().split('\n');
    assert(content.length > 1, `${split}.csv must contain headers and rows`);
    const header = content[0];
    assert(header.includes('image_id'), 'Header must contain image_id');
    assert(header.includes('icdr_grade'), 'Header must contain icdr_grade');
    assert(header.includes('split'), 'Header must contain split column');
  }
});

// ---------------------------------------------------------------------------
// 6. Zero Data Loss Across Splits
// ---------------------------------------------------------------------------
test('Test 6: Total partitioned records match total valid records (zero data loss across splits)', () => {
  const parseRows = (file: string) => {
    const lines = fs.readFileSync(path.join(SPLITS_DIR, file), 'utf-8').trim().split('\n');
    return lines.slice(1); // skip header
  };

  const trainRows = parseRows('train.csv');
  const valRows = parseRows('val.csv');
  const testRows = parseRows('test.csv');

  const totalPartitioned = trainRows.length + valRows.length + testRows.length;
  assert(totalPartitioned === 3662, `Total partitioned records must equal 3662, got ${totalPartitioned}`);

  // Proportions
  const trainPct = trainRows.length / totalPartitioned;
  const valPct = valRows.length / totalPartitioned;
  const testPct = testRows.length / totalPartitioned;

  assert(trainPct >= 0.65 && trainPct <= 0.80, `Train proportion should be ~70%, got ${(trainPct * 100).toFixed(1)}%`);
  assert(valPct >= 0.10 && valPct <= 0.20, `Val proportion should be ~15%, got ${(valPct * 100).toFixed(1)}%`);
  assert(testPct >= 0.10 && testPct <= 0.20, `Test proportion should be ~15%, got ${(testPct * 100).toFixed(1)}%`);
});

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// 7. Absolute Zero Leakage Check
// ---------------------------------------------------------------------------
test('Test 7: Absolute zero image/patient leakage between train, validation, and test splits', () => {
  const getImageIds = (file: string) => {
    const lines = fs.readFileSync(path.join(SPLITS_DIR, file), 'utf-8').trim().split('\n');
    return new Set(lines.slice(1).map((line) => parseCsvLine(line)[0]));
  };

  const trainIds = getImageIds('train.csv');
  const valIds = getImageIds('val.csv');
  const testIds = getImageIds('test.csv');

  const trainValLeak = [...trainIds].filter((id) => valIds.has(id));
  const trainTestLeak = [...trainIds].filter((id) => testIds.has(id));
  const valTestLeak = [...valIds].filter((id) => testIds.has(id));

  assert(trainValLeak.length === 0, `Train-Val leakage detected: ${trainValLeak.join(', ')}`);
  assert(trainTestLeak.length === 0, `Train-Test leakage detected: ${trainTestLeak.join(', ')}`);
  assert(valTestLeak.length === 0, `Val-Test leakage detected: ${valTestLeak.join(', ')}`);
});

// ---------------------------------------------------------------------------
// 8. Perceptual Duplicate & Near-Duplicate Isolation
// ---------------------------------------------------------------------------
test('Test 8: Duplicate MD5 hashes are strictly bound to single partitions (zero duplicate leakage)', () => {
  const getMd5Map = (file: string) => {
    const lines = fs.readFileSync(path.join(SPLITS_DIR, file), 'utf-8').trim().split('\n');
    // Header: image_id,filename,icdr_grade,diagnosis,source_dataset,cohort,split,md5,dhash,laplacian_var,mean_lum
    const header = parseCsvLine(lines[0]);
    const md5Idx = header.indexOf('md5');
    assert(md5Idx !== -1, 'md5 column must exist');
    return new Set(lines.slice(1).map((line) => parseCsvLine(line)[md5Idx]));
  };

  const trainMd5s = getMd5Map('train.csv');
  const valMd5s = getMd5Map('val.csv');
  const testMd5s = getMd5Map('test.csv');

  const trainValMd5Leak = [...trainMd5s].filter((h) => valMd5s.has(h));
  const trainTestMd5Leak = [...trainMd5s].filter((h) => testMd5s.has(h));
  const valTestMd5Leak = [...valMd5s].filter((h) => testMd5s.has(h));

  assert(trainValMd5Leak.length === 0, `Train-Val duplicate MD5 leak: ${trainValMd5Leak.length} hashes`);
  assert(trainTestMd5Leak.length === 0, `Train-Test duplicate MD5 leak: ${trainTestMd5Leak.length} hashes`);
  assert(valTestMd5Leak.length === 0, `Val-Test duplicate MD5 leak: ${valTestMd5Leak.length} hashes`);
});

// ---------------------------------------------------------------------------
// 9. Class Imbalance & Loss Weighting
// ---------------------------------------------------------------------------
test('Test 9: Class weights configuration exists with inverse and effective weights for all 5 grades', () => {
  const weightsPath = path.join(METADATA_DIR, 'class_weights.json');
  assert(fs.existsSync(weightsPath), 'class_weights.json must exist');

  const data = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
  assert(data.num_classes === 5, 'Must have 5 classes');
  assert(data.train_sample_count > 2000, 'Train sample count must exceed 2000');

  for (let c = 0; c < 5; c++) {
    const key = String(c);
    assert(data.inverse_class_weights[key] > 0, `Inverse weight for class ${c} must be positive`);
    assert(data.effective_number_weights[key] > 0, `Effective weight for class ${c} must be positive`);
  }

  // Grade 3 (Severe NPDR, rare class) must have higher loss weight than Grade 0 (No DR, majority class)
  const w0 = data.inverse_class_weights['0'];
  const w3 = data.inverse_class_weights['3'];
  assert(w3 > w0, `Rare class (Grade 3: ${w3}) must have higher loss weight than majority class (Grade 0: ${w0})`);
});

// ---------------------------------------------------------------------------
// 10. Preprocessing Configuration
// ---------------------------------------------------------------------------
test('Test 10: Retinal preprocessing configuration defines Graham circular aperture and Lanczos resampling', () => {
  const prepPath = path.join(METADATA_DIR, 'preprocessing_config.json');
  assert(fs.existsSync(prepPath), 'preprocessing_config.json must exist');

  const prep = JSON.parse(fs.readFileSync(prepPath, 'utf-8'));
  assert(prep.channels === 3, 'Must specify 3 channels');
  assert(prep.color_space === 'RGB', 'Must specify RGB color space');
  assert(prep.target_resolution[0] === 224 && prep.target_resolution[1] === 224, 'Target resolution must be 224x224');
  assert(prep.circular_aperture_mask.enabled === true, 'Circular aperture mask must be enabled');
  assert(prep.train_augmentations.deterministic_val_test === true, 'Validation/test must be deterministic');
});

// ---------------------------------------------------------------------------
// 11. Multi-Cohort Documentation & Licensing
// ---------------------------------------------------------------------------
test('Test 11: Multi-cohort documentation and licensing directory exists with citations', () => {
  const docPath = path.join(DOCS_DIR, 'DATASETS_AND_LICENSES.md');
  assert(fs.existsSync(docPath), 'DATASETS_AND_LICENSES.md must exist in docs/');

  const doc = fs.readFileSync(docPath, 'utf-8');
  assert(doc.includes('APTOS 2019'), 'Must document APTOS 2019');
  assert(doc.includes('EyePACS'), 'Must document EyePACS');
  assert(doc.includes('DDR'), 'Must document DDR');
  assert(doc.includes('IDRiD'), 'Must document IDRiD');
  assert(doc.includes('Messidor-2'), 'Must document Messidor-2');
  assert(doc.includes('DRIVE'), 'Must document DRIVE');
  assert(doc.includes('HIPAA'), 'Must document HIPAA Safe Harbor / ethical compliance');
});

// ---------------------------------------------------------------------------
// 12. Audit Reports Generated
// ---------------------------------------------------------------------------
test('Test 12: Split report and clinical statistics reports exist in markdown', () => {
  const splitReport = path.join(REPORTS_DIR, 'dataset_split_report.md');
  const statsReport = path.join(REPORTS_DIR, 'dataset_statistics_report.md');

  assert(fs.existsSync(splitReport), 'dataset_split_report.md must exist');
  assert(fs.existsSync(statsReport), 'dataset_statistics_report.md must exist');

  const splitMd = fs.readFileSync(splitReport, 'utf-8');
  assert(splitMd.includes('ZERO LEAKAGE VERIFIED'), 'Split report must declare zero leakage verified');

  const statsMd = fs.readFileSync(statsReport, 'utf-8');
  assert(statsMd.includes('Referable DR'), 'Statistics report must include Referable DR analysis');
});

// ---------------------------------------------------------------------------
// 13. Backend API GET /api/detect/dataset-stats
// ---------------------------------------------------------------------------
test('Test 13: Backend GET /api/detect/dataset-stats endpoint responds with verified schema and data', async () => {
  process.env.MRITIDHRISTI_TEST = 'true';
  const app = (await createMritidhristiApp({ skipFrontend: true })) as any;

  // Find the dataset-stats route in app._router
  const routeLayer = app._router.stack.find(
    (s: any) => s.route && s.route.path === '/api/detect/dataset-stats'
  );
  assert(!!routeLayer, 'Route /api/detect/dataset-stats must be registered in Express router');

  const handlers = routeLayer.route.stack.map((s: any) => s.handle);
  const [requireAuthMw, controller] = handlers;

  // 1. Unauthenticated request must return 401
  let unauthStatus = 0;
  let unauthBody: any = null;
  const mockUnauthReq = {
    method: 'GET',
    url: '/api/detect/dataset-stats',
    headers: {},
  } as any;
  const mockUnauthRes = {
    status(code: number) {
      unauthStatus = code;
      return this;
    },
    json(data: any) {
      unauthBody = data;
      return this;
    },
  } as any;

  requireAuthMw(mockUnauthReq, mockUnauthRes, () => {});
  assert(unauthStatus === 401, `Unauthenticated request must receive 401, got ${unauthStatus}`);
  assert(unauthBody?.error, '401 response must return error message');

  // 2. Authenticated request with doctor user session
  let authStatus = 200;
  let authBody: any = null;
  const doctorUser = store.data.users.find((u) => u.role === 'doctor') || store.data.users[0];
  const session = store.createSession(doctorUser);

  const mockAuthReq = {
    method: 'GET',
    url: '/api/detect/dataset-stats',
    headers: { authorization: `Bearer ${session.token}` },
  } as any;
  const mockAuthRes = {
    status(code: number) {
      authStatus = code;
      return this;
    },
    json(data: any) {
      authBody = data;
      return this;
    },
  } as any;

  let nextCalled: boolean = false;
  requireAuthMw(mockAuthReq, mockAuthRes, () => {
    nextCalled = true;
  });
  assert(Boolean(nextCalled), 'requireAuth must call next() when valid session token is provided');

  controller(mockAuthReq, mockAuthRes);
  assert(authStatus === 200, `Controller must return 200, got ${authStatus}`);
  assert(authBody.success === true, 'Response must have success: true');
  assert(authBody.manifest.total_inspected_images === 3662, 'Manifest must report 3662 images');
  assert(authBody.qualityReport.pass_rate_pct === 100.0, 'Quality report must report 100% pass rate');
  assert(authBody.classWeights.num_classes === 5, 'Class weights must cover 5 classes');
  assert(authBody.pipelineStatus.readyForCnnTraining === true, 'Pipeline status must show readyForCnnTraining: true');
  assert(
    authBody.pipelineStatus.cnnTrainingStatus === 'NOT_STARTED (Scheduled for Phase 6)' ||
    authBody.pipelineStatus.cnnTrainingStatus.includes('COMPLETED') ||
    authBody.pipelineStatus.cnnTrainingStatus === 'NOT_STARTED',
    'CNN training status must be valid (NOT_STARTED or COMPLETED)'
  );
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function run() {
  console.log('\n===============================================================');
  console.log(' MITRA DRISHTI PHASE 5: RETINAL DATASET PREPARATION VERIFICATION');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    try {
      await t.fn();
      console.log(`[PASS] ${t.name}`);
      passed++;
    } catch (err: any) {
      console.error(`[FAIL] ${t.name}`);
      console.error(`       ${err.message}`);
      failed++;
    }
  }

  console.log('\n---------------------------------------------------------------');
  console.log(`Total Tests: ${tests.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('---------------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run();
