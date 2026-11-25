# IDRiD Diabetic Macular Edema (DME) Risk Classification Report

**Model:** MobileNetV2 Transfer Learning with Class Weighting (`models/dme_classifier.keras`)  
**Cohort:** 103 Official Untouched IDRiD Testing Scans (`B. Disease Grading/1. Original Images/b. Testing Set`)  
**Evaluation Scope:** Clinical Risk Stratification Demonstration (Non-Diagnostic)

---

## 1. Quantitative Performance Metrics

- **Overall Accuracy:** 73.79% (76 / 103)
- **Quadratic Weighted Kappa (QWK):** 0.5831 (Moderate-to-Substantial Agreement)
- **Macro Precision:** 82.50%
- **Macro Recall:** 56.99%
- **Macro F1-Score:** 57.28%
- **Weighted F1-Score:** 71.17%

---

## 2. 3-Class Confusion Matrix (Argmax Decision Rule)

| Ground Truth \ Predicted | Grade 0 (Low Risk) | Grade 1 (Moderate) | Grade 2 (High Risk) | Total Scans |
| :--- | :---: | :---: | :---: | :---: |
| **Grade 0 (No Apparent DME Risk Features)** | 34 | 0 | 11 | **45** |
| **Grade 1 (Moderate DME Risk Category)** | 4 | 1 | 5 | **10** |
| **Grade 2 (High DME Risk Category)** | 7 | 0 | 41 | **48** |
| **Total Predicted** | **45** | **1** | **57** | **103** |

---

## 3. Class-Wise Metrics (Argmax Decision Rule)

| Category | Clinical Definition | Support | Precision | Sensitivity (Recall) | Specificity | F1-Score |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **Grade 0** | No apparent hard exudates within macula | 45 | 75.6% | 75.6% | 81.0% | 0.7556 |
| **Grade 1** | Hard exudates present > 1 DD from fovea | 10 | 100.0% | 10.0% | 100.0% | 0.1818 |
| **Grade 2** | Hard exudates present within 1 DD of fovea | 48 | 71.9% | 85.4% (41/48) | 70.9% (39/55) | 0.7810 |

---

## 4. Binary High-Risk DME Triage ($P(\text{Grade 2}) \ge 0.50$) & Reconciliation

When triaging patients into High-Risk (Grade 2) vs Non-High-Risk (Grades 0 & 1) using an explicit probability threshold of $0.50$:

- **Triage Sensitivity:** 83.33% (40 / 48)
- **Triage Specificity:** 74.55% (41 / 55)
- **ROC Area Under Curve (AUC):** 0.8489

### Reconciliation of Argmax vs Binary Threshold Metrics:
1. **Grade 2 Sensitivity (85.42% vs 83.33%):**
   - In 3-class argmax, image `IDRiD_012` has probabilities $[p_0=0.4764, p_1=0.0428, p_2=0.4808]$. Because $p_2$ is the largest component, argmax selects Grade 2 (True Positive $\implies \text{TP}=41$, sensitivity = $41/48 = 85.42\%$).
   - In binary triage with $P(\text{Grade 2}) \ge 0.50$, $0.4808 < 0.50$, so the case is assigned negative (False Negative $\implies \text{TP}=40, \text{FN}=8$, sensitivity = $40/48 = 83.33\%$).
2. **Grade 2 Specificity (70.91% vs 74.55%):**
   - In 3-class argmax, two non-Grade-2 scans (`IDRiD_006`, $p_2=0.4932$ and `IDRiD_054`, $p_2=0.4933$) have $p_2$ as the plurality winner, creating 2 False Positives ($\text{FP}=16, \text{TN}=39$, specificity = $39/55 = 70.91\%$).
   - In binary triage ($p_2 \ge 0.50$), both fall below $0.50$, converting them to True Negatives ($\text{FP}=14, \text{TN}=41$, specificity = $41/55 = 74.55\%$).

---

## 5. Clinical Observations & Limitations

- **Grade 1 Exudate Sparsity:** Grade 1 constitutes only 9.7% of test scans (10 cases) and 9.9% of training scans (41 cases). Distinguishing non-center-involving exudates without explicit micrometric spatial coordinates remains challenging for global fundus classifiers.
- **Academic Scope:** This model is designed strictly for research demonstration and risk stratification triage. It does NOT provide a definitive diagnosis of macular edema or CSME. Slit-lamp biomicroscopy and Optical Coherence Tomography (OCT) are mandatory for definitive clinical assessment.
