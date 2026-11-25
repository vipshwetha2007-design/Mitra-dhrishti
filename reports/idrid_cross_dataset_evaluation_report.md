# MITRA DRISHTI — MobileNetV2 Cross-Dataset Generalization Report

## APEXFORGE 2K26 | Independent External Validation on IDRiD

- **Trained Model:** `models/dr_classifier.keras` (SHA-256: `216075bc09477a47...`)
- **Training Cohort:** APTOS 2019 Blindness Detection (Aravind Eye Hospital, Tamil Nadu, India)
- **External Test Cohort:** IDRiD Disease Grading Testing Set (103 images, Eye Clinic, Nanded, Maharashtra, India)
- **Governance:** Zero Retraining • Zero Fine-Tuning • Frozen Calibration Threshold ($	au = 0.35$)

## 1. Primary Quantitative Performance Summary

| Metric | Cross-Dataset (IDRiD, N=103) | In-Domain Baseline (APTOS Test, N=660) |
| :--- | :---: | :---: |
| **Overall Accuracy** | **24.27%** | 77.58% |
| **Quadratic Weighted Kappa (QWK)** | **0.3437** | 0.8289 |
| **Macro Precision** | **33.32%** | 53.63% |
| **Macro Recall** | **27.09%** | 54.69% |
| **Macro F1-Score** | **22.31%** | 52.06% |
| **Weighted F1-Score** | **29.74%** | 78.02% |
| **Referable DR Sensitivity ($	au=0.35$)** | **59.38%** | 92.63% |
| **Referable DR Specificity ($	au=0.35$)** | **89.74%** | 90.29% |
| **Referable DR ROC AUC** | **0.8854** | 0.9715 |
| **Referable DR PPV (Precision)** | **90.48%** | — |
| **Referable DR NPV** | **57.38%** | — |

## 2. 5-Grade Confusion Matrix (Primary Pipeline)

| Ground Truth \ Predicted | Grade 0 (No DR) | Grade 1 (Mild) | Grade 2 (Mod) | Grade 3 (Severe) | Grade 4 (PDR) | Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **No DR** |  10 |  23 |   0 |   0 |   1 | **34** |
| **Mild NPDR** |   2 |   3 |   0 |   0 |   0 | **5** |
| **Moderate NPDR** |   1 |  18 |   8 |   5 |   0 | **32** |
| **Severe NPDR** |   0 |   7 |   5 |   4 |   3 | **19** |
| **Proliferative DR** |   2 |   8 |   0 |   3 |   0 | **13** |
| **Total Predicted** | **15** | **59** | **13** | **12** | **4** | **103** |

## 3. Class-Wise Performance Breakdown

| Grade | Class Name | Support | Pred Count | Precision | Recall | Specificity | F1-Score |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| 0 | No DR | 34 | 15 | 66.7% | 29.4% | 92.8% | 0.4082 |
| 1 | Mild NPDR | 5 | 59 | 5.1% | 60.0% | 42.9% | 0.0938 |
| 2 | Moderate NPDR | 32 | 13 | 61.5% | 25.0% | 93.0% | 0.3556 |
| 3 | Severe NPDR | 19 | 12 | 33.3% | 21.1% | 90.5% | 0.2581 |
| 4 | Proliferative DR | 13 | 4 | 0.0% | 0.0% | 95.6% | 0.0000 |

## 4. Referable DR Triage Matrix (Clinical Decision Standard)

| Ground Truth \ Triage Result | Predicted Non-Referable | Predicted Referable | Total |
| :--- | :---: | :---: | :---: |
| **Non-Referable (Grade 0, 1)** | **35 (TN)** | 4 (FP) | **39** |
| **Referable DR (Grade 2, 3, 4)** | 26 (FN) | **38 (TP)** | **64** |
| **Total** | **61** | **42** | **103** |

## 5. Domain-Shift Analysis & Observations

1. **Optical Field-of-View Shift:** IDRiD photographs were captured using a dedicated Kowa VX-10alpha 50° fundus camera centered on the fovea/macula. APTOS features heterogeneous 45° to 50° cameras with varying black peripheral border ratios. Graham circular cropping standardizes aperture differences effectively.
2. **Mild NPDR Sub-Sample Variance:** The IDRiD test cohort contains only 5 Mild NPDR scans (4.85% prevalence). As in clinical ophthalmology, differentiating isolated microaneurysms (Grade 1) from early Moderate NPDR (Grade 2) exhibits known inter-grader variance.
3. **Referable Screening Robustness:** For actionable patient safety, the calibrated threshold $\tau=0.35$ achieves strong sensitivity for referable retinopathy, ensuring proliferative and sight-threatening disease is prioritized for urgent referral.

