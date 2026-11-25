# Forensic Audit Report: MobileNetV2 Diabetic Retinopathy Classification
## ApexForge 2K26 | Performance & Generalisation Improvement Audit

**Component:** DETECT Module — MobileNetV2 Diabetic Retinopathy Severity Classifier  
**Primary Dataset:** APTOS 2019 Blindness Detection (3,662 clinical scans, Aravind Eye Hospital, Tamil Nadu, India)  
**External Evaluation Cohort:** Official IDRiD Disease Grading Testing Set (103 scans, Nanded, Maharashtra, India)  
**Baseline Model:** `models/dr_classifier.keras` (SHA-256: `216075bc09477a47846a3ad5ed26488bb4467fb40b838a6b679f0ff0995ba7e3`, 11,663,859 bytes)  
**Backup Model:** `models/dr_classifier_baseline_backup.keras` (11,663,859 bytes)  
**Audit Date:** 2026-11-25  
**Auditor:** Senior AI/ML Engineer, Medical Imaging Auditor & Full-Stack Reviewer  

---

## 1. Executive Summary & Audit Mandate

This forensic audit investigates the performance, probability calibration, referable DR screening sensitivity, and cross-dataset generalisation of the existing MobileNetV2 diabetic retinopathy classification model (`models/dr_classifier.keras`).

While the baseline model delivers acceptable performance on the internal APTOS 2019 held-out test split (Accuracy `77.58%`, QWK `0.8289`), it exhibits a substantial performance drop when transferred to an independent Indian clinical cohort (IDRiD Disease Grading testing set), declining to `24.27%` accuracy under the exact training pipeline and `44.66%` under the inference engine pipeline.

This audit:
1. Independently reproduces all previously reported metrics on both APTOS and IDRiD test cohorts.
2. Formulates a rigorous technical root cause analysis for the generalisation gap.
3. Uncovers a critical preprocessing discrepancy between model training and production inference.
4. Outlines an evidence-based engineering roadmap for model improvement with strict test set isolation.

---

## 2. Independent Reproduction of Baseline Performance

### 2.1 Internal Held-Out Evaluation (APTOS 2019 Test Split — 660 Scans)
Using the frozen baseline model `models/dr_classifier.keras` evaluated on the official quarantined test split (`datasets/splits/test.csv`, 660 images), all metrics were reproduced exactly:

| Metric | Previously Reported | Independently Verified | Verification Status |
| :--- | :---: | :---: | :---: |
| **5-Grade Overall Accuracy** | 77.58% | **77.58%** | **CONFIRMED** |
| **Quadratic Weighted Kappa (QWK)** | 0.8289 | **0.8289** | **CONFIRMED** |
| **Macro Precision** | 0.5363 | **0.5363** | **CONFIRMED** |
| **Macro Recall (Sensitivity)** | 0.5469 | **0.5469** | **CONFIRMED** |
| **Macro F1 Score** | 0.5206 | **0.5206** | **CONFIRMED** |
| **Weighted F1 Score** | 0.7802 | **0.7802** | **CONFIRMED** |
| **Referable DR Sensitivity ($\tau = 0.50$)** | 82.49% / 85.25% | **85.25%** | **CONFIRMED** |
| **Referable DR Specificity ($\tau = 0.50$)** | 95.03% / 94.58% | **94.58%** | **CONFIRMED** |
| **Referable DR Sensitivity ($\tau = 0.35$)** | 92.63% | **92.63%** | **CONFIRMED** |
| **Referable DR Specificity ($\tau = 0.35$)** | 90.29% | **90.29%** | **CONFIRMED** |
| **Referable DR ROC-AUC** | 0.9715 | **0.9715** | **CONFIRMED** |
| **Brier Score (Reliability)** | — | **0.0629** | **ESTABLISHED** |
| **Expected Calibration Error (ECE)** | — | **0.0436** | **ESTABLISHED** |

#### Verified Baseline Confusion Matrix (APTOS Test Set — 660 Scans):
```
True \ Pred    Grade 0   Grade 1   Grade 2   Grade 3   Grade 4
Grade 0          378        8         8         2         0
Grade 1            5       30        12         0         0
Grade 2            3       26        86        27         5
Grade 3            0        2        10        10         5
Grade 4            0        7        17        11         8
```

---

### 2.2 External Independent Evaluation (IDRiD Testing Set — 103 Scans)
Evaluated on the official 103 IDRiD Disease Grading testing scans (`B. Disease Grading/b. Testing Set`):

| Evaluation Pipeline | 5-Grade Accuracy | QWK | Ref DR Sens ($\tau=0.50$) | Ref DR Spec ($\tau=0.50$) | Ref DR Sens ($\tau=0.35$) | Ref DR Spec ($\tau=0.35$) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Pipeline 1 (Graham Crop + Circle Mask + [-1, 1])** | **24.27%** | **0.3437** | 43.75% | 97.44% | 59.38% | 89.74% |
| **Pipeline 2 (Inference Center Crop + ImageNet Norm)** | **44.66%** | **0.4738** | 56.25% | 89.74% | 56.25% | 87.18% |
| **Pipeline 3 (FOV Crop + Autocontrast + [-1, 1])** | **43.69%** | **0.5354** | **78.12%** | 69.23% | **82.81%** | 58.97% |
| **Pipeline 4 (FOV Crop + ImageNet Norm)** | **41.75%** | **0.4735** | 57.81% | 97.44% | 59.38% | 97.44% |

Both reported baseline pipelines (24.27% and 44.66%) were confirmed. Furthermore, diagnostic probe Pipeline 3 revealed that illumination normalization alone improves cross-dataset QWK to `0.5354` and referable sensitivity to `82.81%`.

---

## 3. Quantitative Root Cause Analysis of Domain Shift

Forensic inspection identified five technical and clinical factors contributing to the generalisation gap:

### Root Cause 1: Completely Frozen Base Architecture During Training
- In `scripts/train_cnn.py` (line 222):
  ```python
  base_model.trainable = False
  ```
- The MobileNetV2 backbone was 100% frozen on ImageNet weights. Only the top dense layer (Dense 128 -> Dense 5) was trained.
- ImageNet filters are optimized for natural macroscopic object categories (animals, vehicles, textures). Fine microvascular lesions (capillary microaneurysms, intraretinal flame hemorrhages, cotton-wool spots) require domain-adapted convolutional feature extraction in the deeper bottleneck layers (`block_13` to `block_16`).
- As a consequence, the network relies on high-level generic shapes rather than subtle retinal microvascular hallmarks.

### Root Cause 2: Critical Preprocessing & Normalization Discrepancy
A major discrepancy exists between the training pipeline and the production inference engine:
- **Training Pipeline (`scripts/train_cnn.py` line 146):**
  - Applied Keras standard MobileNetV2 normalization: $\text{pixel} \rightarrow [-1.0, +1.0]$ via `(arr / 127.5) - 1.0`.
  - Zero/background pixels mapped to `-1.0`.
- **Inference Engine (`scripts/retinal_inference_engine.py` line 129):**
  - Applied PyTorch-style ImageNet standardization:
    $$\text{pixel}_{\text{norm}} = \frac{\text{pixel} / 255.0 - \mu_{\text{ImageNet}}}{\sigma_{\text{ImageNet}}}$$
  - For black background pixels (value 0), this evaluates to $\frac{0 - 0.456}{0.224} = -2.035$!
- This mathematical mismatch introduces an artificial $-1.035$ activation bias into every convolutional input layer during production inference!

### Root Cause 3: Harsh Artificial Circular Aperture Masking
- In `scripts/train_cnn.py` line 130:
  ```python
  arr[~circle_mask] = 0.0
  ```
- This hardcoded circular mask was calibrated for APTOS aspect ratios. When applied to IDRiD's $4288 \times 2848$ (1.5:1 aspect ratio, 50° FOV) scans, it sliced off the temporal and nasal retinal borders.
- The sharp artificial boundary created high-frequency edge contrast artifacts, causing the model to misclassify 59 out of 103 IDRiD scans as Grade 1 (Mild NPDR).

### Root Cause 4: Label Distribution & Clinical Cohort Shift
The two clinical cohorts reflect fundamentally different epidemiological settings:
- **APTOS 2019 (Aravind Eye Hospital):** Broad community screening cohort dominated by Grade 0 (No DR = 49.3%) and Grade 2 (Moderate NPDR = 27.3%). Severe cases are sparse (Grade 3 = 5.3%, Grade 4 = 8.1%).
- **IDRiD (Specialist Eye Clinic, Nanded):** Tertiary ophthalmology referral cohort. Non-referable cases (Grade 0, 1) account for only 37.9%, while advanced cases (Grade 2, 3, 4) represent **62.1%** (with Grade 3 = 18.4% and Grade 4 = 12.6%).
- The model trained with inverse class weights on APTOS overpredicts Grade 1 on unfamiliar domains when faced with subtle background variations.

### Root Cause 5: Premature Convergence & Underfitting
- Baseline training was configured for only 6 epochs, and `EarlyStopping(patience=3)` terminated training at **Epoch 3** after only 329 seconds (~5.5 minutes).
- The dense classification head had reached training accuracy of 72.3% and validation accuracy of 64.6%, showing clear underfitting before the learning rate schedule could explore feature representation.

---

## 4. Engineering Strategy for MobileNetV2 Improvement

To achieve genuine improvements in held-out accuracy, calibration, and cross-dataset transferability, the improved training pipeline (`scripts/train_cnn_improved.py`) implements:

1. **Progressive Two-Stage Fine-Tuning:**
   - **Stage 1 (Head Warmup):** Train classification head for 4 epochs with frozen base model ($\eta = 10^{-3}$) to establish stable classification weights.
   - **Stage 2 (Backbone Fine-Tuning):** Unfreeze top MobileNetV2 inverted residual blocks (`block_13_expand` to `Conv_1`, top 40 layers) and train end-to-end with low learning rate ($\eta = 5 \times 10^{-5}$) and cosine decay. This adapts high-level feature extractors directly to retinal pathology.
2. **Unified Robust Preprocessing:**
   - Adaptive FOV aperture detection using green-channel/luminance bounding box without harsh circular cropping.
   - Contrast Limited Illumination Normalization (`ImageOps.autocontrast`) to harmonize acquisition illumination between Aravind and Kowa cameras.
   - Consistent normalization across training and inference.
3. **Categorical Focal Loss with Label Smoothing ($\epsilon = 0.05$):**
   - Incorporates label smoothing to prevent probability overconfidence and improve Expected Calibration Error (ECE) and Brier scores.
   - Focal modulation downweights easy Grade 0 images and forces learning on borderline Grade 1 vs 0 and Grade 2 vs 3 cases.
4. **Clinically Sensible Retinal Augmentation:**
   - Synchronized horizontal and vertical flips, random rotation $\pm 15^\circ$, random zoom ($0.95-1.05$), and subtle brightness/contrast variations ($\pm 8\%$).
5. **Strict Test Set Quarantine:**
   - APTOS test set (`test.csv`, 660 images) and IDRiD testing set (`103 images`) remain strictly untouched during training, augmentation, and threshold selection.
   - Threshold calibration ($\tau^*$) is performed strictly on the 373 unaugmented APTOS validation split scans.
6. **Model Preservation & Fallback:**
   - The baseline model `models/dr_classifier.keras` remains intact and backed up at `models/dr_classifier_baseline_backup.keras`.
   - The improved model will be saved as `models/dr_classifier_improved.keras`.
