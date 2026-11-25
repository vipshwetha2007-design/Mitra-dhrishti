# MITRA DRISHTI — Ophthalmologist Evaluation & Expert Agreement Protocol

**Project:** MITRA DRISHTI — PREVENT • DETECT • PROTECT  
**Module:** DETECT & PROTECT Clinical Governance  
**Problem Statement:** SIH26038 — Explainable AI for Diabetic Retinopathy Screening in Rural India  
**Applicable Standards:** STARD-AI, TRIPOD-AI, ICMR National Ethical Guidelines (2017), DPDP Act 2023  
**Protocol Status:** Prepared & Structured • **AWAITING ETHICS APPROVAL & SPECIALIST VALIDATION**  

---

## 1. Objective and Clinical Governance Principle

This protocol establishes the standardized clinical adjudication methodology, multi-reader case report forms (CRF), and inter-observer agreement metrics required to validate MITRA DRISHTI prior to any real-world clinical deployment.

> [!CRITICAL]
> **Clinical Governance Statement:**
> - In compliance with ICMR biomedical research guidelines and CDSCO Software as a Medical Device (SaMD) requirements, **no prospective human subject testing is claimed or conducted without prior Institutional Ethics Committee (IEC) clearance and Clinical Trials Registry - India (CTRI) registration**.
> - The AI model performance documented in `reports/model_evaluation_report.md` represents **retrospective engineering verification** on quarantined clinical datasets, **not** certified clinical diagnostic performance.

---

## 2. Multi-Reader Adjudication Methodology

### 2.1 Reader Panel Composition
A multi-center panel of three independent, board-certified retina specialists:
1. **Reader 1 (Senior Ophthalmologist / Retina Specialist):** Blinded primary assessment.
2. **Reader 2 (Independent Senior Vitreoretinal Surgeon):** Blinded secondary assessment.
3. **Adjudicator 3 (Professor of Ophthalmology / Lead Retina Specialist):** Arbitration of discordant cases.

### 2.2 Blinded Review Workflow
```
[ De-Identified Retinal Scan ]
            |
   +--------+--------+
   |                 |
[ Reader 1 (Blinded) ]  [ Reader 2 (Blinded) ]
   |                 |
   +--------+--------+
            |
   Do Reader 1 & 2 agree on ICDR Grade and Referable Status?
            |
     +------+------+
     |             |
   [ YES ]       [ NO ]
     |             |
[ Consensus ]  [ Adjudicator 3 Arbitrates ]
Gold Standard      |
               [ Final Clinical Ground Truth ]
```

---

## 3. Standardized Ophthalmologist Case Report Form (CRF)

Each clinical review is documented using the following standardized CRF schema:

### Section 1: Image Quality Assessment
- **Patient Identifier (De-Identified Hash):** `____________________`
- **Field-of-View (FOV) Adequacy:** `[ ] 45°/50° Adequate   [ ] Truncated / Inadequate`
- **Focus & Sharpness:** `[ ] Clear / Gradable   [ ] Borderline   [ ] Severe Optical Blur / Ungradable`
- **Media Opacity (Cataract/Vitreous):** `[ ] None   [ ] Mild   [ ] Significant (Precludes Grading)`
- **Illumination & Exposure:** `[ ] Well-Exposed   [ ] Overexposed   [ ] Underexposed`
- **Overall Quality Disposition:** `[ ] Gradable Scan   [ ] Recapture Required (Ungradable)`

### Section 2: ICDR Clinical Retinopathy Grading
*Graded according to the International Clinical Diabetic Retinopathy Disease Severity Scale:*
- `[ ] Grade 0: No Apparent Retinopathy`
- `[ ] Grade 1: Mild Non-Proliferative DR (Microaneurysms only)`
- `[ ] Grade 2: Moderate Non-Proliferative DR (Microaneurysms, blot haemorrhages, hard exudates)`
- `[ ] Grade 3: Severe Non-Proliferative DR (Any of: >20 intraretinal haemorrhages in 4 quadrants, venous beading in 2+ quadrants, prominent IRMA in 1+ quadrant)`
- `[ ] Grade 4: Proliferative DR (Neovascularisation of disc/elsewhere, vitreous/preretinal haemorrhage)`
- **Diabetic Macular Edema (DME):** `[ ] Absent   [ ] Present (Non-center involving)   [ ] Center-involving DME`
- **Binary Triage Decision:** `[ ] Non-Referable (Routine Annual Follow-Up)   [ ] Referable DR (Specialist Referral)`

### Section 3: AI Explainability (Grad-CAM) Clinical Concordance
*Evaluated on a 5-point Likert Scale by comparing AI Grad-CAM activation heatmaps against true pathological findings:*
- `[ ] 1 - Strongly Disagree (Heatmap highlights artifacts, normal tissue, or misleading areas)`
- `[ ] 2 - Disagree (Heatmap misses primary microvascular lesions)`
- `[ ] 3 - Neutral / Partially Concordant (Highlights general quadrant but imprecise lesion localization)`
- `[ ] 4 - Agree (Concordant with observed microaneurysms, haemorrhages, or exudates)`
- `[ ] 5 - Strongly Agree (Heatmap precisely localizes vision-threatening lesions guiding clinical review)`

### Section 4: Recommended Action & Referral Urgency
- `[ ] Routine Annual Community Screening (12 Months)`
- `[ ] Semi-Annual Primary Eye Care Review (6 Months)`
- `[ ] Priority Ophthalmology Referral (within 2 to 4 weeks)`
- `[ ] Urgent / Emergency Tertiary Vitreoretinal Escalation (< 48 hours)`

---

## 4. Expert Agreement & Statistical Metrics

### 4.1 Inter-Observer Agreement Between Human Specialists
- **Fleiss' Generalized Kappa ($\kappa$):** Measures multi-reader concordance across 5 ordinal ICDR grades for all three readers:
  $$\kappa = \frac{\bar{P} - \bar{P}_e}{1 - \bar{P}_e}$$
  *Target Standard:* $\kappa \ge 0.75$ (indicates substantial inter-expert agreement).
- **Consensus Ground Truth:** Defined as exact concordance between Reader 1 and Reader 2, or the binding verdict of Adjudicator 3.

### 4.2 AI vs. Expert Consensus Concordance
- **Sensitivity & Specificity for Referable DR:** Evaluated against Consensus Expert Ground Truth with exact Clopper-Pearson 95% binomial confidence intervals.
- **Quadratic Weighted Kappa ($QWK$):** Evaluates agreement across all 5 ICDR severity levels penalizing extreme category disagreements (e.g., Grade 0 misclassified as Grade 4).
- **Grad-CAM Clinical Utility Index:** Proportion of examinations where retina specialists assign a Likert score of 4 or 5 for explainability concordance (target: $> 85.0\%$).

---

## 5. Institutional Ethics & Regulatory Clearance Checklist

| Regulatory Requirement | Governance Authority | Standard / Reference | Current Project Status |
|---|---|---|:---:|
| **Biomedical Ethics Approval** | Institutional Ethics Committee (IEC) | ICMR National Ethical Guidelines for Biomedical Research (2017) | **AWAITING ETHICS APPROVAL** |
| **Clinical Trial Registration** | ICMR / CTRI | Clinical Trials Registry - India (CTRI) | **AWAITING CTRI REGISTRATION** |
| **Data Protection Compliance** | Ministry of Electronics & IT (MeitY) | Digital Personal Data Protection (DPDP) Act 2023 | **COMPLIANT ARCHITECTURE** |
| **Health Data Interoperability** | National Health Authority (NHA) | Ayushman Bharat Digital Mission (ABDM) / FHIR R4 | **VERIFIED IMPLEMENTATION** |
| **Software Medical Device (SaMD)** | Central Drugs Standard Control Org | CDSCO Medical Device Rules 2017 (Class B SaMD) | **AWAITING FORMAL CLEARANCE** |
| **Specialist Blinded Review** | Accredited Eye Hospitals (e.g. Aravind) | STARD-AI / TRIPOD-AI Guidelines | **AWAITING SPECIALIST VALIDATION** |

---

*Authored for MITRA DRISHTI Clinical AI Governance & Trial Preparation.*  
*Status: Ready for submission to Institutional Ethics Committees.*
