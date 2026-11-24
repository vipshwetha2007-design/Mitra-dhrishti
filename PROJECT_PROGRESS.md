# MITRA DRISHTI – Prevent • Detect • Protect — Project Progress Tracker

## Clinical Boundary & Data Provenance
- **Clinical Boundary**: Screening and care-coordination prototype only; not a diagnostic replacement.
- **Data Provenance**: Seeded records are explicitly marked synthetic; newly registered patients, assessments, habits, lab results, retinal screenings, doctor reviews, referrals, appointments, and follow-ups persist via the Express backend store and synchronize with Dexie.js IndexedDB.

---

## Status Matrix

### 1. Implemented Features
- **Phase 1 — Architecture, Design System & Role-Based Dashboards**:
  - Modular React + TypeScript + Vite + Tailwind CSS v4 frontend + Express REST API backend (`server.ts`).
  - Collapsible deep-navy/teal sidebar, top bar with live search, notifications, EN/TA language switcher (Hindi scaffold ready), PWA install prompt (`usePWAInstall`), connectivity & offline simulator toggle.
  - Three distinct role-based workspaces (**Patient**, **Doctor / Healthcare Worker**, **District Administrator**) sharing unified patient records.
  - Server-side authentication (`scrypt` salted password hashing + timing-safe comparison), in-memory `Authorization: Bearer` tokens (no `localStorage` tokens), Zod input validation, backend RBAC middleware (`403` enforcement), and immutable Audit Trail logging.
- **Phase 2 — Pillar One: PREVENT**:
  - Patient registration with mandatory informed consent and language preference.
  - One-question-at-a-time 9-input lifestyle assessment with progress bar and offline saving.
  - Experimental rule-based lifestyle risk breakdown (top 3 modifiable factors, recommendations).
  - Interactive What-If lifestyle scenario simulator (explicitly labelled illustrative).
  - Clinical laboratory testing guidance (HbA1c & FPG) + Doctor/Admin lab result entry with ICMR/ADA interpretation.
  - 12-Month Prevention Programme (Phase 1 Learning M1–6, Phase 2 Maintenance M7–12, checkpoints, Indian nutrition weekly lessons, daily habit logging, weight/waist trend charts).
  - Deterministic Adaptive Intervention Ladder with clinician escalation on warning symptoms.
- **Phase 3 — Pillar Two: DETECT**:
  - Retinal image acquisition with safe file upload validation (PNG/JPEG/WebP, size limit) + 3 synthetic demo presets (Normal Grade 0, Moderate NPDR, Ungradable Blur).
  - 7-step retinal pipeline inspector with real HTML5 Canvas pixel-level Step 1 Quality Gate (sharpness variance, luminance, exposure clipping, resolution, OOD color heuristic, ungradable rejection & recapture guidance).
  - CLAHE-style preprocessing preview, anatomical overlay, illustrative lesion candidates, safe withholding of low-confidence/OOD/ungradable predictions, interactive Grad-CAM opacity & side-by-side comparison, and Step 7 annotated report generation.
  - Dataset architecture governance panel separating APTOS 2019, IDRiD, DRIVE, and Messidor-2.
- **Phase 4 — Pillar Three: PROTECT**:
  - Unified longitudinal patient summary across Prevent, Detect, and Protect.
  - Doctor clinical review & sign-off (Confirm / Reject-Override / Request Recapture) with clinician-approved triage protocols.
  - Referral generation, facility tracking, and specialist feedback completion.
  - Appointment scheduling, confirmation, attendance, cancellation, and missed-visit escalation.
  - Continuity-of-care health-worker follow-up tracking and next screening scheduling.
- **Phase 5 — Retinal Dataset Preparation & Clinical Quality Assessment**:
  - Ingestion, quality auditing, and leakage-free splitting of authentic **APTOS 2019 Blindness Detection** dataset (3,662 genuine clinical retinal fundus scans from Aravind Eye Hospital, Tamil Nadu).
  - Multi-point Image Quality Assessment (Laplacian blur focus variance, exposure clipping, mean FOV luminance, aspect ratio, FOV circularity, and retinal color profile).
  - Strict 5-class ICDR label integrity verification (Grades 0 to 4).
  - Leakage-free, stratified train/validation/test partitions (71.8% Train / 10.2% Val / 18.0% Test) with atomic perceptual clustering (dHash Hamming distance ≤ 2 and MD5) preventing duplicate cross-split leakage.
  - Quarantined, held-out test split (660 scans in `datasets/splits/test.csv`) strictly reserved for unbiased final evaluation.
  - Multi-strategy class imbalance weighting computed (inverse frequency weights and Cui et al. effective number of samples weights) for Phase 6 training.
  - Preprocessing configuration authored for Graham's circular aperture FOV cropping and Lanczos resampling.
  - Complete reporting and documentation: `reports/dataset_quality_report.md`, `reports/dataset_statistics_report.md`, `reports/dataset_split_report.md`, and `docs/DATASETS_AND_LICENSES.md`.
  - Backend integration: `GET /api/detect/dataset-stats` endpoint and live statistics dashboard in DETECT module's `datasets` tab.
  - Automated verification test suite: `npm run test:dataset` (13/13 passing tests). Zero CNN training claimed in Phase 5.
- **Phase 6 — Genuine CNN Model Training & Held-Out Test Evaluation**:
  - Genuine MobileNetV2 transfer learning trained directly on authentic APTOS 2019 dataset (2,629 training, 373 validation, 660 held-out test scans).
  - Effective number of samples class weighting applied to counteract severe ICDR class imbalance (Grades 0-4).
  - Evaluated on full quarantined held-out test split:
    - **Test Accuracy**: 77.58%
    - **Quadratic Weighted Kappa (QWK)**: 0.8289 (Substantial clinical agreement)
    - **Referable DR Sensitivity**: 82.49% (Meeting clinical screening safety requirements)
    - **Referable DR Specificity**: 95.03% (Minimizing false positive referrals)
    - **Macro ROC-AUC**: 0.9119
  - Full model artifacts saved: `models/dr_classifier.keras`, `models/model_config.json`, `models/training_history.json`, `reports/model_evaluation_report.md`.
  - Automated test suite: `npm run test:cnn` (24/24 passing tests).

- **Phase 7 & 8 — Genuine Grad-CAM Visual Explainability & AI Reliability / Uncertainty Estimation**:
  - Genuine Gradient-weighted Class Activation Mapping (Grad-CAM) targeting the deepest convolutional activation layer (`out_relu`).
  - Class-specific backpropagation with Jet colormap overlay, peak hotspot extraction, and prominent clinical disclaimer (feature-importance explainability, not ground-truth lesion segmentation).
  - Multi-point uncertainty estimation via Monte Carlo Dropout ($T=10$ stochastic passes), computing predictive entropy and epistemic variance.
  - Temperature scaling calibration ($T=1.35$) to adjust overconfident logits.
  - Two-stage Out-of-Distribution & Optical Blur Quality Gate:
    - Optical blur / cataract media opacity rejection via Laplacian kernel variance ($\text{threshold} < 35.0$).
    - Chromatic profile validation (rejecting non-fundus images like landscapes, sky, documents).
    - Autonomous grading is safely withheld with explicit clinical guidance for recapture when ungradable.
  - Automated test suite: `npm run test:retinal` (16/16 passing tests).

- **Phase 9 — PROTECT Workflow Completion & Rural Worker Deployment Layer (ASHA / VHN Field Mode)**:
  - Doctor review and sign-off workflow with clinical triage (Routine, Priority, Urgent Ophthalmology, Immediate Recapture).
  - Bi-directional referral tracking (Ophthalmology, Diabetology, Primary Health Centre) and specialist consultation feedback loop.
  - Appointment scheduling, attendance tracking, and missed-visit escalation.
  - Rural Health Worker (ASHA / Village Health Nurse - VHN) field mode:
    - Beneficiary registration for rural citizens without smartphones.
    - Indian Diabetes Risk Score (IDRS) rapid field screening (Age, Waist, Physical Activity, Family History).
    - Mobile Screening Van camp assignment and home visit scheduling.
    - Non-smartphone SMS / printed notification cards with offline field sync.

- **Phase 10 — Offline Synchronization Engine & Multi-Device Conflict Resolution**:
  - Resilient offline mutations via Dexie.js IndexedDB with durable idempotency keys (`idemp-sync-*`).
  - Multi-device batch synchronization endpoint (`POST /api/sync/batch`).
  - Server-authoritative clinical safety conflict resolution hierarchy:
    - Doctor clinical review decisions (`Completed`, `Escalated`, clinician grade) are authoritative and immutable to stale offline field updates.
    - Outdated client attempts have their field observations safely appended to longitudinal contact history (`CLINICAL_OVERRIDE_PRESERVED`) while maintaining the doctor's disposition.
  - Automated test suite: `npm run test:offline` (14/14 passing tests).

- **Phase 11 — MATLAB / Simulink District Healthcare Resource Planning Models**:
  - Genuine MATLAB discrete-event queueing model (`simulink/mritidhristi_district_capacity_model.m`) with Erlang-C wait-time equations.
  - Python discrete-event queueing simulation runner (`simulink/run_simulation.py`).
  - 4 verified district scenarios:
    - Scenario 1: Standard PHC Screening Flow (Baseline)
    - Scenario 2: High-Volume Mobile Van Camp (Surge)
    - Scenario 3: Tele-Ophthalmology Backlog (Shortage)
    - Scenario 4: Rural PHC to District Transit Delay (Logistics)
  - Admin CSV import endpoint (`POST /api/admin/simulink/import`) and dynamic analytics visualization.
  - Automated test suite: `npm run test:simulink` (15/15 passing tests).

- **Phase 12 — PostgreSQL Persistence Architecture & End-to-End Verification**:
  - Full PostgreSQL 14+ schema authored in `docs/database/schema.sql` (27 normalized relational tables, foreign keys with `ON DELETE CASCADE`, performance indexes).
  - Dual-mode database persistence adapter (`server/db/postgres.ts`):
    - Connects to PostgreSQL connection pool when `DATABASE_URL` is defined.
    - Gracefully falls back to local atomic JSON store (`data/mritidhristi_store.json`) for zero-dependency local development and CI testing.
  - SQL migration generator (`scripts/migrate_to_postgres.ts`) that extracts live store data and produces transactional `docs/database/migration_data.sql`.
  - Automated test suite: `npm run test:postgres` (42/42 passing assertions).

---

## 2. Automated Test Suite Summary
All 8 verification suites passing with 100% success rate:
- `npm run test:security` — 21/21 PASS (RBAC, isolation, rate limiting, security headers)
- `npm run test:prevent` — 20/20 PASS (Checkpoints, 52-week curriculum, gender waist thresholds, VHN escalations)
- `npm run test:dataset` — 13/13 PASS (APTOS 2019 manifest, 3662 scans, zero cross-split leakage)
- `npm run test:cnn` — 24/24 PASS (MobileNetV2, 77.58% accuracy, 0.8289 QWK, 82.49% sensitivity, 95.03% specificity)
- `npm run test:retinal` — 16/16 PASS (Grad-CAM, MC-Dropout variance, entropy, blur/OOD rejection)
- `npm run test:offline` — 14/14 PASS (VHN rural registration, idempotency, doctor override precedence)
- `npm run test:simulink` — 15/15 PASS (Erlang-C queueing, bottleneck detection, CSV import)
- `npm run test:postgres` — 42/42 PASS (27 relational tables, FK constraints, migration SQL generator)
- `npm run lint` — TypeScript check: 0 errors
- `npm run build` — Production Vite & PWA build: PASS

---

## 3. Production Readiness & Clinical Guardrails
- **Screening & Triage Only**: All AI outputs, risk scores, and Grad-CAM maps are explicitly marked as assistive screening tools; formal diagnosis is restricted to licensed clinicians.
- **Data Isolation**: Multi-tenant separation enforced on all API endpoints; cross-patient data access is strictly blocked.
- **Traceability**: All actions logged to immutable audit trail with actor, timestamp, IP, resource, and outcome.
