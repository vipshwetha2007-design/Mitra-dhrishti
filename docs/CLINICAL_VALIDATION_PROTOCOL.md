# MRITIDHRISTI — Clinical & Ethical Validation Protocol
**Project:** MRITIDHRISTI — PREVENT • DETECT • PROTECT  
**Problem Statement:** SIH26038 – Explainable AI for Diabetic Retinopathy Screening in Rural India  
**Standard:** STARD-AI / TRIPOD-AI Guidelines for Healthcare AI Clinical Validation  
**Ethical Framework:** ICMR National Ethical Guidelines for Biomedical and Health Research (2017) & DPDP Act 2023  

---

## 1. Protocol Overview & Objectives

### 1.1 Study Title
*Prospective Multicenter Diagnostic Accuracy and Clinical Triage Evaluation of an Explainable Artificial Intelligence Platform (MRITIDHRISTI) for Diabetic Retinopathy Screening in Rural Primary Healthcare Settings of Tamil Nadu.*

### 1.2 Primary Clinical Objectives
1. **Screening Sensitivity Evaluation:** Validate that the autonomous referable DR screening triage gate achieves $\ge 90.0\%$ sensitivity against senior retinal specialist adjudications.
2. **False-Positive Minimization:** Validate that the autonomous referable DR screening triage gate achieves $\ge 85.0\%$ specificity, minimizing unnecessary tertiary hospital transport for rural citizens.
3. **Optical Blur & Media Opacity Detection:** Quantify the rejection rate of ungradable fundus scans (cataract media opacity, improper focus, corneal reflection flare) and verify that autonomous grading is safely withheld.
4. **Explainability Clinical Utility:** Measure ophthalmologist evaluation concordance with Grad-CAM activation hotspots and segmented microvascular lesions within a rapid clinical review workflow.

---

## 2. Study Design & Participating Sites

### 2.1 Multicenter Prospective Cohort Design
The validation trial will be conducted across four distinct healthcare administrative tiers in Tamil Nadu:

| Site Identifier | Location / District | Facility Type | Target Enrollment | Hardware Deployed |
| :--- | :--- | :--- | :---: | :--- |
| **Site A (PHC-1)** | Keeladi / Madurai District | Primary Health Centre | 800 | Forus 3nethra Classic |
| **Site B (PHC-2)** | Andipatti / Theni District | Primary Health Centre | 750 | Forus 3nethra Classic |
| **Site C (Mobile)**| Melur Rural Health Block | Mobile Screening Van | 1,200 | Remidio Fundus on Phone (FOP NM-10) |
| **Site D (District)**| District Headquarters Hospital | Secondary Ophthalmology Centre | 1,250 | Topcon TRC-NW400 Robotic |
| **Total Cohort** | — | — | **4,000 Rural Beneficiaries** | Multi-vendor Compatibility |

---

## 3. Reference Standards & Expert Adjudication

### 3.1 Ground-Truth Reference Standard
- Standard of comparison: **Dilated 7-field stereo 50° fundus photography** (ETDRS protocol) or wide-field fundus examination performed at district base hospitals.
- Graded according to the **International Clinical Diabetic Retinopathy (ICDR)** 5-class severity scale:
  - Grade 0: No Apparent Retinopathy
  - Grade 1: Mild Non-Proliferative Diabetic Retinopathy (Microaneurysms only)
  - Grade 2: Moderate NPDR (More than just microaneurysms, but less than severe NPDR)
  - Grade 3: Severe NPDR (Any of: >20 intraretinal haemorrhages in 4 quadrants, venous beading in 2+ quadrants, prominent IRMA in 1+ quadrant)
  - Grade 4: Proliferative Diabetic Retinopathy (Neovascularisation, vitreous/preretinal haemorrhage)
- **Referable DR Definition:** ICDR Grade $\ge 2$ (Moderate NPDR, Severe NPDR, or PDR) or Diabetic Macular Edema (DME).

### 3.2 Double-Blind Specialist Adjudication
- Two independent, board-certified senior retina specialists (blinded to patient clinical metadata and AI predictions) grade every examination.
- Inter-grader disagreements are arbitrated by a third senior retinal professor whose decision is final.

---

## 4. Statistical Analysis Plan

### 4.1 Sample Size Calculation
Based on an estimated rural diabetes prevalence of $14.5\%$ and a referable DR prevalence of $18.2\%$ among diabetic patients, an alpha of $0.05$, power of $90\%$, and expected sensitivity of $92\%$:
- Minimum referable cases required: $N = 385$ patients with referable DR.
- Total screened cohort target of $4,000$ individuals ensures $> 700$ true positive referable cases across the prospective sites.

### 4.2 Statistical Metrics & Confidence Intervals
- **Sensitivity & Specificity:** Calculated using exact two-sided Clopper-Pearson 95% binomial confidence intervals.
- **Inter-Rater Agreement:** Evaluated using Quadratic Weighted Kappa (QWK) with $95\%$ bootstrap confidence intervals.
- **Receiver Operating Characteristic (ROC):** Empirical area under the curve (ROC-AUC) evaluated using DeLong’s non-parametric test.
- **Subgroup Sensitivity Analyses:** Stratified by camera model (Forus vs Remidio vs Topcon), age group, pupil dilation status (mydriatic vs non-mydriatic), and patient diabetes duration.

---

## 5. Ethical Governance, Consent & Data Protection

### 5.1 Ethical Approvals
- Approval will be obtained from the Institutional Ethics Committee (IEC) of participating tertiary eye institutes and District Health Missions in compliance with ICMR 2017 Guidelines.
- Clinical Trial Registry of India (CTRI) prospective registration.

### 5.2 Informed Consent Architecture
1. **Bilingual Consent Slips:** Printed and audio-assisted consent in Tamil and Hindi.
2. **Four Granular Consent Purposes:**
   - Purpose 1: Non-mydriatic fundus screening.
   - Purpose 2: De-identified telemetry for AI algorithm quality monitoring.
   - Purpose 3: Encrypted local caching on ASHA/VHN offline devices.
   - Purpose 4: Tele-ophthalmology referral transmission to District Hospital.
3. **Consent Revocation:** Beneficiaries retain the right to withdraw data storage consent at any point, triggering an immediate purge of local cached data.

### 5.3 Privacy & ABDM Compliance
- Strict de-identification adhering to HIPAA Safe Harbor and the Digital Personal Data Protection (DPDP) Act 2023.
- All stored scans use non-reversible cryptographic hashes as primary keys; direct personal identifiers (Aadhaar, phone, name) are encrypted at rest with AES-GCM-256 and separated from retinal image matrices.
- Interoperability via HL7 FHIR R4 JSON resources compatible with the Ayushman Bharat Digital Mission (ABDM) Health Information Exchange (HIE-CM).
