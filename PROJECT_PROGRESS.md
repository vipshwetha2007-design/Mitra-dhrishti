# Mritidhristi – Prevent • Detect • Protect — Project Progress Tracker

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
- **Phase 6 — Offline-First PWA & IndexedDB**:
  - `vite-plugin-pwa` Service Worker + Web App Manifest + valid 192px/512px/maskable/Apple Touch PNG icons.
  - Dexie.js IndexedDB (`MritidhristiOfflineDB`) caching minimized permitted summaries and queueing offline Prevent mutations with unique `idempotencyKey`s.
  - Server `/api/sync/batch` endpoint with validation, duplicate submission prevention, conflict logging, and live Offline Test Mode workflow.
- **Phase 7 — District Resource Planning (Simulink Interface)**:
  - All 6 district capacity scenarios with hourly queue/wait charts and cross-scenario comparisons.
  - Admin-only MATLAB Simulink CSV import parser + downloadable CSV template.

### 2. Simulated / Experimental Features (Explicitly Labelled)
- **Experimental Lifestyle Risk Score**: Rule-based educational screening score (not a clinically validated diagnostic predictor).
- **Experimental Contextual-Bandit Arm**: Restricted strictly to pre-approved educational framing; never alters clinical escalation.
- **Illustrative Retinal AI Outputs**: Canvas-based heuristics and synthetic fundus demo captures; no fabricated clinical CNN weights or clinical AUC claims. Microaneurysm detection explicitly marked experimental.
- **Illustrative District Simulink Mode**: Analytical queueing model until actual MATLAB Simulink CSV outputs are imported.

### 3. Pending / Ready for Next Phases
- **Phase 5 — Hosted PostgreSQL (Cloud SQL) Migration**: Complete 26-table PostgreSQL DDL is authored in `docs/database/schema.sql`. Ready to provision Cloud SQL (PostgreSQL) + Drizzle migrations upon user approval.
- **Python FastAPI + PyTorch/OpenCV Microservice**: External GPU inference container for real APTOS/IDRiD/DRIVE/Messidor-2 training & Grad-CAM extraction once clinical datasets are supplied.
- **Phase 8 — Automated Unit & Integration Test Suite**: Expand Vitest/Playwright tests across RBAC, offline sync deduplication, and clinical workflows.
