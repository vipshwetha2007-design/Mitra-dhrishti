# MITRA DRISHTI — DME Model Metric & Clinical Safety Forensic Audit
## APEXFORGE 2K26 | TRAIN • LEARN • PREDICT
**Target Model:** `models/dme_classifier.keras` (SHA-256: `91682fcce0ec...`, 21,320,240 bytes)  
**Dataset:** Indian Diabetic Retinopathy Image Dataset (IDRiD) Disease Grading Cohort  
**Evaluation Set:** 103 Official Untouched Test Scans (`B. Disease Grading/1. Original Images/b. Testing Set`)  
**Audit Date:** November 25, 2026

---

### Executive Audit Summary

A forensic review of the Diabetic Macular Edema (DME) classification model, test metrics, code implementations, inference engine, and backend endpoints was conducted. 

Key Findings:
1. **Metric Verification:** All performance metrics on the 103 official test scans were recalculated directly from the model checkpoint predictions and verified: **Overall Accuracy: 73.79% (76/103)**, **Quadratic Weighted Kappa (QWK): 0.5831**, **Macro Precision: 82.50%**, **Macro Recall: 56.99%**, **Macro F1: 57.28%**, **Weighted F1: 71.17%**, and **CSME ROC AUC: 0.8489**.
2. **Reconciliation of Discrepancies:**
   - **Grade 2 Sensitivity (83.33% vs 85.42%):** The 85.42% figure (41/48) derives from **3-class argmax** selection. The 83.33% figure (40/48) derives from an explicit **binary decision threshold** ($P(\text{Grade 2}) \ge 0.50$). Scan `IDRiD_012` has $p_2 = 0.4808$, which wins plurality under argmax ($p_0=0.4764, p_1=0.0428$) but fails the $\ge 0.50$ binary threshold.
   - **Grade 2 Specificity (74.55% vs 70.91%):** Under 3-class argmax, 16 non-Grade-2 scans are predicted as Grade 2 ($\text{FP}=16, \text{TN}=39$, Specificity = $70.91\%$). Under binary threshold $P \ge 0.50$, two borderline scans (`IDRiD_006`, $p_2=0.4932$ and `IDRiD_054`, $p_2=0.4933$) fall below $0.50$, reducing $\text{FP}$ to $14$ and increasing $\text{TN}$ to $41$ (Specificity = $74.55\%$).
3. **Class Weights Investigation:** The reported class weights ($w_0=0.8582, w_1=1.8333, w_2=0.7756$) reflect balancing computed **post-augmentation** on 726 samples, where minority Class 1 had already been quadruple-sampled from 33 to 132 images. On raw unaugmented training data, the theoretical weight for Class 1 would have been $3.3333$.
4. **Clinical Safety & Governance Corrections:** In `scripts/dme_inference_engine.py` and `models/dme_model_config.json`, all unsupported automated clinical claims—such as definitive CSME diagnosis, immediate visual threat, and automatic recommendations for anti-VEGF injections or laser photocoagulation—have been **completely excised**. All categories have been corrected to describe IDRiD criterion-based hard-exudate proximity to the fovea, and all triage paths now mandate comprehensive ophthalmological assessment and Optical Coherence Tomography (OCT) confirmation.
5. **Confidence & Calibration:** The $0.9999$ confidence observed on test scans stems from uncalibrated softmax overconfidence common to deep CNNs trained on small medical cohorts. The model exhibits an **Expected Calibration Error (ECE) of 12.46%** with 28.2% of test predictions exceeding 99% confidence. Post-hoc calibration (such as temperature scaling) has not been implemented.
6. **Integrity & Regressions:** Existing MobileNetV2 DR weights (`models/dr_classifier.keras`, 11,663,859 bytes) and U-Net lesion weights (`models/idrid_unet_lesions.keras`, 5,934,764 bytes) remain 100% intact with all test suites passing.

---

### 1. Direct Recalculation of Test Metrics

The 103 official test images were loaded from `B. Disease Grading/B. Disease Grading/1. Original Images/b. Testing Set` and evaluated against ground truths from `2. Groundtruths/b. IDRiD_Disease Grading_Testing Labels.csv` using `models/dme_classifier.keras`:

- **Test Cohort Support:** Grade 0 = 45, Grade 1 = 10, Grade 2 = 48 (Total = 103).
- **Overall Accuracy:** $76 / 103 = \mathbf{73.79\%}$
- **Quadratic Weighted Kappa (QWK):** $\mathbf{0.5831}$
- **Macro Precision:** $\mathbf{82.50\%}$
- **Macro Recall:** $\mathbf{56.99\%}$
- **Macro F1-Score:** $\mathbf{57.28\%}$
- **Weighted F1-Score:** $\mathbf{71.17\%}$
- **Multi-class Brier Score:** $\mathbf{0.4278}$
- **Expected Calibration Error (ECE, 10 bins):** $\mathbf{12.46\%}$

#### Recalculated 3-Class Argmax Confusion Matrix

| Ground Truth \ Predicted | Grade 0 (No Risk) | Grade 1 (Moderate Risk) | Grade 2 (High Risk) | Total Support |
| :--- | :---: | :---: | :---: | :---: |
| **Grade 0 (No Apparent Exudates)** | **34** | 0 | 11 | **45** |
| **Grade 1 (Exudates > 1 DD from Fovea)** | 4 | **1** | 5 | **10** |
| **Grade 2 (Exudates within 1 DD of Fovea)** | 7 | 0 | **41** | **48** |
| **Total Predicted** | **45** | **1** | **57** | **103** |

#### Recalculated Class-Wise Argmax Performance

| Class | Clinical Ground Truth | Support | Pred Count | TP | FP | FN | TN | Precision | Sensitivity | Specificity | F1-Score |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **0** | No apparent hard exudates | 45 | 45 | 34 | 11 | 11 | 47 | 75.56% | 75.56% | 81.03% | 0.7556 |
| **1** | Exudates > 1 DD from fovea | 10 | 1 | 1 | 0 | 9 | 93 | 100.00% | 10.00% | 100.00% | 0.1818 |
| **2** | Exudates within 1 DD of fovea | 48 | 57 | 41 | 16 | 7 | 39 | 71.93% | **85.42%** | **70.91%** | 0.7810 |

---

### 2. Reconciliation of Grade 2 Sensitivity Discrepancy (83.33% vs 85.42%)

The discrepancy arises from two distinct mathematical decision rules:

1. **3-Class Argmax Rule ($\hat{y} = \arg\max_{c} P(y=c)$):**
   - True Positives ($\text{TP}$): 41
   - False Negatives ($\text{FN}$): 7
   - Total Support: 48
   - **Argmax Sensitivity:** $41 / 48 = \mathbf{85.42\%}$

2. **Binary High-Risk Decision Rule ($P(\text{Grade 2}) \ge 0.50$):**
   - True Positives ($\text{TP}$): 40
   - False Negatives ($\text{FN}$): 8
   - Total Support: 48
   - **Binary Threshold Sensitivity:** $40 / 48 = \mathbf{83.33\%}$

#### The Specific Discrepancy Scan:
- **Scan Identifier:** `IDRiD_012` (Index 11 in test cohort).
- **Official Ground Truth:** Grade 2 (High DME Risk).
- **Softmax Output:** $p_0 = 0.4764, \quad p_1 = 0.0428, \quad p_2 = 0.4808$.
- **Argmax Result:** Because $0.4808 > 0.4764 > 0.0428$, argmax selects Grade 2, counting as a **True Positive** ($\text{TP}=41$).
- **Threshold 0.50 Result:** Because $p_2 = 0.4808 < 0.50$, the binary triage classifier assigns negative ($0$), counting as a **False Negative** ($\text{TP}=40, \text{FN}=8$).

---

### 3. Reconciliation of Grade 2 Specificity Discrepancy (74.55% vs 70.91%)

The non-Grade-2 cohort comprises $45 + 10 = 55$ scans.

1. **Under 3-Class Argmax Rule:**
   - False Positives ($\text{FP}$): 16 ($11$ from Grade 0, $5$ from Grade 1).
   - True Negatives ($\text{TN}$): 39 ($34$ from Grade 0, $5$ from Grade 1: 4 predicted Grade 0, 1 predicted Grade 1).
   - **Argmax Specificity:** $39 / 55 = \mathbf{70.91\%}$

2. **Under Binary High-Risk Rule ($P(\text{Grade 2}) \ge 0.50$):**
   - True Positives ($\text{TP}$): 40
   - False Positives ($\text{FP}$): 14
   - True Negatives ($\text{TN}$): 41
   - False Negatives ($\text{FN}$): 8
   - **Binary Threshold Specificity:** $41 / 55 = \mathbf{74.55\%}$

#### The Two Borderline Scans Moving from FP to TN:
- **Scan 1: `IDRiD_006` (Index 5)**
  - Ground Truth: Grade 1 (Moderate DME Risk).
  - Softmax Output: $p_0 = 0.4861, \quad p_1 = 0.0207, \quad p_2 = 0.4932$.
  - Argmax: $p_2$ is plurality winner $\implies$ Predicted Grade 2 (**False Positive**).
  - Threshold 0.50: $p_2 = 0.4932 < 0.50 \implies$ Predicted Negative (**True Negative**).
- **Scan 2: `IDRiD_054` (Index 53)**
  - Ground Truth: Grade 0 (No DME Risk).
  - Softmax Output: $p_0 = 0.3873, \quad p_1 = 0.1194, \quad p_2 = 0.4933$.
  - Argmax: $p_2$ is plurality winner $\implies$ Predicted Grade 2 (**False Positive**).
  - Threshold 0.50: $p_2 = 0.4933 < 0.50 \implies$ Predicted Negative (**True Negative**).

**Audit Conclusion:** Both metric pairs are mathematically valid under their respective operational definitions. The report has been updated to explicitly label and delineate argmax metrics from binary threshold metrics.

---

### 4. Investigation of Training vs Reported Class Weights

The class weights reported in `models/dme_model_config.json` are:
$$w_0 = 0.8582, \quad w_1 = 1.8333, \quad w_2 = 0.7756$$

#### Forensic Breakdown of Weight Calculation:
1. **Full 413 Training Images (Unsplit):**
   - Counts: Grade 0 = 177 (42.86%), Grade 1 = 41 (9.93%), Grade 2 = 195 (47.22%).
   - Theoretical standard weights: $w_0 = 0.7778, \quad w_1 = 3.3577, \quad w_2 = 0.7060$.
2. **80% Split (330 Raw Training Scans):**
   - Counts: Grade 0 = 141 (42.73%), Grade 1 = 33 (10.00%), Grade 2 = 156 (47.27%).
   - Theoretical standard weights: $w_0 = 0.7801, \quad w_1 = 3.3333, \quad w_2 = 0.7051$.
3. **Augmented Training Set (726 Scans):**
   - In `scripts/train_dme_classifier.py`, line 199 called `augment_samples(X_train_raw, Y_train_raw, rng)` *before* computing class weights.
   - Grade 0: $141 \times 2 = 282$ samples.
   - Grade 1 (minority): $33 \times 4 = 132$ samples (quadruple augmentation).
   - Grade 2: $156 \times 2 = 312$ samples.
   - Total augmented training samples: $282 + 132 + 312 = 726$.
   - Computed weights on 726 samples:
     $$w_0 = \frac{726}{3 \times 282} = 0.858156 \approx \mathbf{0.8582}$$
     $$w_1 = \frac{726}{3 \times 132} = 1.83333 \approx \mathbf{1.8333}$$
     $$w_2 = \frac{726}{3 \times 312} = 0.775641 \approx \mathbf{0.7756}$$

**Resolution:** The lower Class 1 weight ($1.8333$ vs $3.3333$) occurred because Class 1 was oversampled by $4\times$ during geometric augmentation. The net effective balancing factor for Class 1 relative to Class 0 was:
$$\frac{4 \times 1.8333}{2 \times 0.8582} \approx 4.27\times$$
This hybrid strategy (oversampling + remaining inverse weighting) prevented loss gradient instability from overly large weights.

---

### 5. Verification of Dataset Splits and Test-Set Isolation

1. **Dataset Directory Separation:**
   - Training images: `B. Disease Grading/B. Disease Grading/1. Original Images/a. Training Set` (413 scans).
   - Test images: `B. Disease Grading/B. Disease Grading/1. Original Images/b. Testing Set` (103 scans).
2. **Partition Verification:**
   - `train_dme_classifier.py` loaded only `a. Training Set` and split it using `train_test_split(..., test_size=0.20, random_state=42, stratify=Y_all)`.
   - Result: 330 training scans, 83 validation scans.
   - Data augmentation was applied solely to `X_train_raw` (330 scans). The validation set (83 scans) remained raw and unaugmented.
3. **Official Test Set Isolation:**
   - The 103 test scans were not accessed during training, early stopping, or checkpoint selection.
   - Evaluation was conducted strictly on the saved model checkpoint `models/dme_classifier.keras` after training completion.

---

### 6. Clinical Safety & Terminology Corrections

The previous implementation contained several unsupported claims and aggressive clinical terms that have now been corrected:

| Location | Prior Problematic Text | Corrected Evidence-Based Text | Rationale |
| :--- | :--- | :--- | :--- |
| `scripts/dme_inference_engine.py` (Grade 2 Name) | `High DME Risk (Clinically Significant Macular Edema)` | `High DME Risk Category (Hard Exudates within 1 Disc Diameter of Foveal Center)` | 2D fundus photography cannot diagnose CSME, which requires slit-lamp biomicroscopy or OCT for retinal thickening. |
| `scripts/dme_inference_engine.py` (Grade 2 Findings) | `...presenting immediate threat to central visual acuity.` | `Hard exudates observed within 1 disc diameter of the foveal center according to IDRiD grading criteria. Requires comprehensive clinical examination to assess macular status.` | Avoids speculative claims of "immediate threat" in an automated screening tool. |
| `scripts/dme_inference_engine.py` (Grade 2 Triage) | `Urgent Macular OCT Examination & Anti-VEGF / Laser Photocoagulation Consultation (< 2 Weeks)` | `Prompt ophthalmologist assessment and Optical Coherence Tomography (OCT) confirmation` | AI screening tools must never prescribe or automate invasive treatments like anti-VEGF or laser photocoagulation. |
| `models/dme_model_config.json` | `High DME Risk (CSME)` | `High DME Risk Category (Hard Exudates within 1 Disc Diameter of Foveal Center)` | Aligns model metadata with dataset criteria. |

#### Clinical Disclaimer Presence
Every inference output path across CLI and REST endpoints includes the mandatory clinical disclaimer:
> *"Model prediction for clinical risk stratification only. Slit-lamp biomicroscopy and Optical Coherence Tomography (OCT) are mandatory for definitive DME diagnosis."*

---

### 7. Confidence & Probability Calibration Investigation

When evaluated on sample test scan `IDRiD_001.jpg`, the model produced a confidence of **0.9999** for Grade 2.

#### Empirical Confidence Distribution Across 103 Test Scans:
- Minimum confidence: $0.3883$
- 25th percentile: $0.7718$
- Median confidence: $0.9054$
- 75th percentile: $0.9923$
- Maximum confidence: $1.0000$
- Predictions with confidence $> 0.90$: **51.46% (53 / 103)**
- Predictions with confidence $> 0.99$: **28.16% (29 / 103)**
- Predictions with confidence $> 0.999$: **5.83% (6 / 103)**

#### Calibration Assessment:
- **Multi-class Brier Score:** $0.4278$
- **Expected Calibration Error (ECE - 10 bins):** **12.46%**
- **Root Cause:** As established by Guo et al. (2017), modern deep neural networks with softmax activation functions and cross-entropy loss are prone to extreme overconfidence on small biomedical datasets. The high confidence on `IDRiD_001.jpg` reflects peak activation of MobileNetV2's final dense layer, not an empirically calibrated posterior probability.
- **Audit Recommendation:** Raw softmax scores should be treated as heuristic ranking scores rather than true clinical probabilities. Post-hoc calibration methods (e.g., Platt Scaling, Temperature Scaling) have not yet been fitted to the validation set and are documented as an open limitation.

---

### 8. API & End-to-End Inference Verification

1. **Backend Route:** `POST /api/detect/predict-dme` in `server.ts` (lines 1330–1397).
   - Protected by `requireAuth` (JWT bearer token).
   - Validated via Zod `detectPredictSchema` (`imageDataUrl` string).
   - Payload safety checked via `validateSafeImageDataUrl` (regex for `data:image/(png|jpeg|webp);base64,...`).
   - Spawns Python process `scripts/dme_inference_engine.py --stdin`.
2. **End-to-End Pipeline Execution:**
   - Tested using `scratch/test_dme_stdin.py` piping base64 fundus image `IDRiD_001.jpg` via stdin:
   - **Exit code:** `0`
   - **Parsing:** Valid JSON parsed with no stderr warnings.
   - **Output verification:**
     ```json
     {
       "status": "success",
       "predicted_grade": 2,
       "category_name": "High DME Risk Category (Hard Exudates within 1 Disc Diameter of Foveal Center)",
       "severity_level": "High Risk Category (Center-Adjacent Exudates)",
       "confidence": 0.9999,
       "is_csme_high_risk": true,
       "triage_recommendation": "Prompt ophthalmologist assessment and Optical Coherence Tomography (OCT) confirmation",
       "clinical_disclaimer": "Model prediction for clinical risk stratification only. Slit-lamp biomicroscopy and Optical Coherence Tomography (OCT) are mandatory for definitive DME diagnosis."
     }
     ```
   - **Latency:** Total latency $6.37\text{ s}$ (inference engine warm-up included).

---

### 9. System Integrity and Regression Verification

All existing models and test suites were audited for preservation:
- `models/dr_classifier.keras`: Size = 11,663,859 bytes (untouched, SHA-256 intact).
- `models/idrid_unet_lesions.keras`: Size = 5,934,764 bytes (untouched).
- Test Suites:
  - `python tests/dmeClassificationTest.py`: **26 / 26 PASS**
  - `npm run test:retinal`: **21 / 21 PASS**
  - `npm run test:lesion`: **34 / 34 PASS**

---

### 10. Audit Conclusion & Suitability Assessment

| Criterion | Evaluation | Justification |
| :--- | :---: | :--- |
| **Suitable for Research Demonstration** | **YES** | The model demonstrates legitimate machine learning with $73.79\%$ overall accuracy, $0.5831$ QWK, $84.89\%$ CSME ROC AUC, clean dataset provenance, and reproducible test isolation on the IDRiD benchmark. |
| **Suitable for Standalone Clinical Diagnosis** | **NO** | Fundus-based AI cannot substitute for cross-sectional OCT imaging or direct slit-lamp biomicroscopy. The model is strictly a pre-diagnostic risk-stratification aid. |
| **Clinical Validation Claimed** | **NO** | No claim of clinical validation or medical device certification is made. |

#### Unresolved Limitations to Disclose in Academic Publications / Demos:
1. **Grade 1 Recall Limitation:** Only $1 / 10$ ($10.0\%$) of Grade 1 test scans was correctly classified. Hard exudates $> 1\text{ DD}$ from the fovea without center involvement are rare in the dataset ($9.7\%$ of test scans) and difficult to resolve without explicit millimeter coordinate calibration.
2. **Softmax Overconfidence:** An ECE of $12.46\%$ highlights that raw confidence scores ($0.9999$) are uncalibrated and should not be used as clinical certainty estimates.
3. **2D Modality Limitation:** Diabetic Macular Edema is defined pathologically by retinal thickening and intraretinal fluid accumulation, which cannot be definitively measured on 2D reflectance photography alone.
