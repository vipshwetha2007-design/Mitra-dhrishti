<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# MITRA DRISHTI
### PREVENT • DETECT • PROTECT

*Your trusted companion for diabetes prevention and vision protection.*
</div>

**Smart India Hackathon (SIH 2024)**  
**Problem Statement:** SIH26038 — Explainable AI for Diabetic Retinopathy Screening in Rural India  
**Organisation:** MathWorks  

---

## Overview

**MITRA DRISHTI** is an integrated, offline-first, explainable AI healthcare screening and continuity-of-care platform designed for rural and resource-constrained primary healthcare centers in India. It unites three clinical pillars:

1. **PREVENT**: Community-level Type 2 diabetes risk assessment, Indian lifestyle scoring, ICMR/ADA diagnostic guidance (HbA1c/FPG), 12-month evidence-based prevention curriculum, and daily habit tracking.
2. **DETECT**: Autonomous 5-class ICDR Diabetic Retinopathy screening using genuine deep learning (MobileNetV2 transfer learning on Aravind Eye Hospital clinical fundus scans), 7-step quality gate, non-mydriatic camera calibration, and physician-explainable Grad-CAM saliency heatmaps with lesion segmentation overlays.
3. **PROTECT**: Rural frontline worker field mode (ASHA/VHN offline encryption via WebCrypto AES-GCM), automated HL7 FHIR R4 interoperability, multi-language voice guidance (Tamil, Hindi, English), tele-ophthalmology triage escalation, and MathWorks Simulink/SimEvents district capacity resource planning.

## Clinical Boundary & Disclaimer

> [!IMPORTANT]
> **MITRA DRISHTI is a non-diagnostic screening prototype and care-coordination support system.** It does not replace a qualified physician or ophthalmologist. All clinical decisions, grading confirmations, and treatment escalations remain with authorized healthcare professionals.

## Quick Start (Run Locally)

**Prerequisites:** Node.js (v18+ recommended), Python 3.10+ (for ML inference/training suites)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   Create or update `.env.local` if using external services.

3. **Start local development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` (or `http://localhost:5173`) in your browser.

4. **Run Verification & Test Suites:**
   ```bash
   npm test
   ```

---

## Key Modules & Verification Suites

- `npm run test:security`: Automated security, RBAC authorization, and input validation test suite.
- `npm run test:prevent`: 9-question lifestyle risk engine, adaptive ladder, and ICMR lab threshold suite.
- `npm run test:dataset`: Leakage-free split validation on 3,662 clinical fundus scans from Aravind Eye Hospital.
- `npm run test:cnn`: Keras MobileNetV2 architecture, held-out test evaluation, and threshold calibration.
- `npm run test:retinal`: Multi-factor image quality gate, CLAHE preprocessing, and Grad-CAM saliency.
- `npm run test:offline`: WebCrypto AES-GCM encryption, IndexedDB syncing, and conflict resolution.
- `npm run test:simulink`: MathWorks Simulink discrete-event queueing model across 6 district scenarios.
- `npm run test:postgres`: PostgreSQL schema, audit trail, and zero-loss JSON migration suite.
- `npm run test:sih`: Master SIH26038 end-to-end alignment and verification suite (39/39 passing).
