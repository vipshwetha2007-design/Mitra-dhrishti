# Forensic Audit Report: Baseline U-Net Retinal Lesion Segmentation

**Project:** MITRA DRISHTI (ApexForge 2K26 — Train • Learn • Predict)  
**Component:** DETECT Module — Retinal Lesion Multi-Class Segmentation  
**Dataset:** Official Indian Diabetic Retinopathy Image Dataset (IDRiD) Component A  
**Baseline Model:** `models/idrid_unet_lesions.keras` (SHA-256: `7d04f21cf4f0685c...`, 5,934,764 bytes)  
**Audit Date:** 2026-11-25  
**Auditor:** Senior AI/ML Engineer & Medical Imaging Auditor  

---

## 1. Executive Summary & Audit Mandate

The primary mission of this audit is to conduct a forensic investigation into the baseline multi-lesion U-Net model (`models/idrid_unet_lesions.keras`) developed for the MITRA DRISHTI DETECT module. On the official IDRiD test set comprising 27 uncompressed retinal scans (`A. Segmentation/b. Testing Set`), the baseline model produced the following performance metrics:

- **Mean Dice Similarity:** `0.0859`
- **Mean Intersection-over-Union (IoU):** `0.0480`
- **Hard Exudates (EX):** Dice `0.2510`, IoU `0.1435`
- **Soft Exudates (SE):** Dice `0.0926`, IoU `0.0486`
- **Haemorrhages (HE):** Dice `0.0000`, IoU `0.0000` (Catastrophic Failure)
- **Microaneurysms (MA):** Dice `0.0000`, IoU `0.0000` (Catastrophic Failure)

The purpose of this audit is to trace every technical factor leading to the total failure on Microaneurysms and Haemorrhages, verify the dataset ground-truth integrity without fabricating results, and formulate an engineering strategy to significantly improve segmentation performance.

---

## 2. Dataset Forensic Inspection & Ground-Truth Verification

The IDRiD Segmentation dataset (`A. Segmentation/A. Segmentation/`) was inspected recursively. All paths, files, and annotations were verified directly from disk.

### 2.1 File Counts and Directory Layout
- **Original Training Images:** `1. Original Images/a. Training Set/` — Exactly 54 fundus photographs (`IDRiD_01.jpg` to `IDRiD_54.jpg`, $4288 \times 2848$, 24-bit RGB JPEG).
- **Original Testing Images:** `1. Original Images/b. Testing Set/` — Exactly 27 fundus photographs (`IDRiD_55.jpg` to `IDRiD_81.jpg`, $4288 \times 2848$, 24-bit RGB JPEG).
- **Ground-Truth Masks:** Located in `2. All Segmentation Groundtruths/{a. Training Set, b. Testing Set}/`:
  - `1. Microaneurysms/`: Training = 54 masks (`IDRiD_01_MA.tif` to `IDRiD_54_MA.tif`), Testing = 27 masks (`IDRiD_55_MA.tif` to `IDRiD_81_MA.tif`).
  - `2. Haemorrhages/`: Training = 53 masks (all except `IDRiD_10_HE.tif`), Testing = 27 masks (`IDRiD_55_HE.tif` to `IDRiD_81_HE.tif`).
  - `3. Hard Exudates/`: Training = 54 masks (`IDRiD_01_EX.tif` to `IDRiD_54_EX.tif`), Testing = 27 masks (`IDRiD_55_EX.tif` to `IDRiD_81_EX.tif`).
  - `4. Soft Exudates/`: Training = 26 masks (`IDRiD_01_SE.tif` ... `IDRiD_47_SE.tif`), Testing = 14 masks (`IDRiD_55_SE.tif` ... `IDRiD_81_SE.tif`).
  - `5. Optic Disc/`: Verified as an anatomical landmark, strictly excluded from lesion segmentation.

### 2.2 Truth Verification on Missing Masks
For Soft Exudates (SE) and Haemorrhages (`IDRiD_10_HE.tif`), official IDRiD protocol only provides masks for scans exhibiting the pathology. The absence of a mask file represents a true negative (zero lesion presence). Treating these as empty (all-zero) masks is clinically and mathematically correct.

### 2.3 Image Properties & Resolution Disparity
- High-resolution acquisition: $4288 \times 2848$ pixels (~12.2 Megapixels).
- Full-resolution annotation format: 1-bit palette TIFF (`mode=P`, unique palette values `[0, 1]`, mapped to red `[255, 0, 0]`).

---

## 3. Quantitative Root Cause Analysis

Through dedicated diagnostic probes (`scratch/check_lesion_stats.py` and `scratch/diagnose_baseline_metrics.py`), four fundamental failure modes were uncovered in the baseline pipeline:

### Root Cause 1: Catastrophic Mask Decimation via Nearest-Neighbor Resampling
In `scripts/train_lesion_unet.py` (line 84), masks were preprocessed as:
```python
cm = mimg_l.crop((xmin, ymin, xmax, ymax)).resize(target_size, Image.Resampling.NEAREST)
```
- Retinal images were downsampled from cropped FOV (~$2848 \times 2848$) to $256 \times 256$, a linear decimation factor of $>11.1\times$ and an area reduction of $>123\times$.
- **Microaneurysms (MA)** are punctate microvascular dilatations with typical clinical diameters of 15–50 $\mu$m (2 to 6 pixels in full-resolution 12-Megapixel scans).
- Nearest-neighbor point sampling evaluates only 1 single coordinate per $11 \times 11$ pixel block. The mathematical probability of hitting a 2-pixel lesion under uniform sampling is $< 3.5\%$.
- **Empirical Measurement:**
  - Full-resolution MA pixel count across training cohort: **704,963 positive pixels** (mean 13,055 pixels/image).
  - Downsampled with `NEAREST`: Only **4,754 positive pixels** remained across all 54 training images (mean 88 pixels/image).
  - **Over 99.33% of all Microaneurysm annotations were wiped out before training even began!**
  - The remaining 88 pixels per scan existed as isolated single-pixel islands devoid of spatial or contextual structure, crippling the convolutional filters.

### Root Cause 2: Extreme Class Imbalance & Binary Cross-Entropy Suppression
- In a $256 \times 256$ canvas ($65,536$ total pixels), an average of 88 positive MA pixels represents a positive class frequency of **0.134%** (background = **99.866%**).
- The baseline objective was configured as:
  $$\mathcal{L} = \mathcal{L}_{\text{Dice}} + 0.5 \cdot \text{BCE}$$
- Because unweighted BCE sums penalties across 65,448 negative pixels, predicting even small non-zero probabilities (e.g., $p=0.08$) on background produces massive cumulative gradients.
- Consequently, gradient descent heavily penalized positive activations, driving MA and HE predictions toward zero across the entire field.
- **Empirical Prediction Magnitudes on 27 Test Scans:**
  - MA: Mean prediction = $0.00543$, Maximum prediction = $0.42957$
  - HE: Mean prediction = $0.01219$, Maximum prediction = $0.78267$
  - EX: Mean prediction = $0.00231$, Maximum prediction = $0.99999$
  - SE: Mean prediction = $0.00336$, Maximum prediction = $0.99999$

### Root Cause 3: Arbitrary Uncalibrated Operating Threshold ($\tau = 0.35$)
- The evaluation function hardcoded a binarization threshold of $\tau = 0.35$ without validating on held-out validation data.
- Because MA probabilities peaked at $0.429$, thresholding at $0.35$ resulted in **only 1 single pixel predicted per entire scan** (and across all 27 test scans, exactly 27 total pixels were predicted out of 2,147 true pixels, with 0 overlapping hits).
- For Haemorrhages (HE), the baseline model predicted 5,072 pixels at $\tau=0.35$. However, diagnostic probe revealed **TP = 0, FP = 5072**. The model had learned to misclassify retinal vessel arcades and optic disc margins as hemorrhages, completely missing true retinal hemorrhages.

### Root Cause 4: Threshold Sensitivity Breakdown
Direct evaluation of the saved model `models/idrid_unet_lesions.keras` across thresholds demonstrates the collapse:

| Class | Threshold | True Pos (TP) | False Pos (FP) | False Neg (FN) | Dice | Precision | Recall |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **MA** | 0.05 | 1 | 9,673 | 2,146 | 0.0002 | 0.0001 | 0.0005 |
| **MA** | 0.10 | 0 | 1,670 | 2,147 | 0.0000 | 0.0000 | 0.0000 |
| **MA** | 0.35 | 0 | 27 | 2,147 | 0.0000 | 0.0000 | 0.0000 |
| **HE** | 0.05 | 101 | 114,883 | 23,252 | 0.0015 | 0.0009 | 0.0043 |
| **HE** | 0.10 | 30 | 53,650 | 23,323 | 0.0008 | 0.0006 | 0.0013 |
| **HE** | 0.35 | 0 | 5,072 | 23,353 | 0.0000 | 0.0000 | 0.0000 |
| **EX** | 0.05 | 4,855 | 2,247 | 19,131 | **0.3123** | 0.6836 | 0.2024 |
| **EX** | 0.35 | 3,544 | 710 | 20,442 | **0.2510** | 0.8331 | 0.1478 |
| **SE** | 0.05 | 684 | 9,261 | 3,350 | **0.0979** | 0.0688 | 0.1696 |
| **SE** | 0.35 | 481 | 5,871 | 3,553 | **0.0926** | 0.0757 | 0.1192 |

---

## 4. Engineering Strategy for Model Optimisation

To overcome these structural limitations, the improved training pipeline (`scripts/train_lesion_unet.py`) must implement the following evidence-based enhancements:

1. **Area-Preserving Mask Downsampling:**
   - Replace `Image.Resampling.NEAREST` with morphological dilation / area-max pooling (`Image.Resampling.BOX` followed by thresholding or binary dilation).
   - This preserves microaneurysm footprints (~13,117 training pixels vs 4,754), ensuring convolutional filters receive genuine spatial signal for punctate lesions.

2. **Contrast Enhancement & Channel Preprocessing:**
   - Retinal microaneurysms and hemorrhages have the highest absorption contrast in the green spectral band ($540-570$ nm).
   - Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to the green channel and luminance channel to enhance lesion-to-background contrast.

3. **Asymmetric Focal Tversky Loss Function:**
   - Eliminate standard unweighted BCE.
   - Implement Focal Tversky Loss:
     $$TI = \frac{\sum p y + \epsilon}{\sum p y + \alpha \sum (1-p) y + \beta \sum p (1-y) + \epsilon}$$
     $$\mathcal{L}_{FTL} = \sum_{c=1}^4 w_c \cdot (1 - TI_c)^\gamma$$
   - Set $\alpha = 0.75$ and $\beta = 0.25$ to heavily penalize false negatives for sparse lesions (MA and HE).
   - Assign class weights $w = [2.0, 1.5, 1.0, 1.2]$ to prioritize MA and HE recovery.

4. **Multi-Scale Feature U-Net Architecture:**
   - Enhance the lightweight U-Net with residual convolutional blocks, squeeze-and-excitation channel attention, or increased filter capacity (32, 64, 128, 256) while maintaining rapid CPU inference compatibility.

5. **Validation-Calibrated Per-Class Threshold Optimization:**
   - Determine optimal operating thresholds $(\tau_{\text{MA}}, \tau_{\text{HE}}, \tau_{\text{EX}}, \tau_{\text{SE}})$ dynamically on the 10-image validation split to maximize validation Dice score.
   - Apply these calibrated thresholds to the unpolluted 27 test scans during final evaluation.

6. **Safety & Preservation Protocols:**
   - The original baseline model `models/idrid_unet_lesions.keras` will be strictly preserved.
   - The improved model will be trained on the 44 training split scans and saved as `models/idrid_unet_lesions_improved.keras`.
   - Existing classification models (`dr_classifier.keras`, `dme_classifier.keras`, `optic_disc_fovea_localizer.keras`) will remain untouched.
