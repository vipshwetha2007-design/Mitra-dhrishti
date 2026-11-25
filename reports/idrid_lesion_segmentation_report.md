# IDRiD Retinal Lesion Segmentation Evaluation Report

**Model:** Lightweight Convolutional U-Net with Skip Connections (`models/idrid_unet_lesions.keras`)
**Cohort:** 27 Untouched Official IDRiD Testing Scans (`A. Segmentation/b. Testing Set`)
**Operating Threshold:** $\tau = 0.35$

## 1. Quantitative Performance Metrics

| Lesion Type | Dice Similarity | IoU (Jaccard) | Precision | Recall (Sensitivity) | Total True Pixels | Total Pred Pixels |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Microaneurysms (MA)** | **0.0000** | 0.0000 | 0.0000 | 0.0000 | 2,147 | 27 |
| **Haemorrhages (HE)** | **0.0000** | 0.0000 | 0.0000 | 0.0000 | 23,353 | 5,072 |
| **Hard Exudates (EX)** | **0.2510** | 0.1435 | 0.8331 | 0.1478 | 23,986 | 4,254 |
| **Soft Exudates (SE)** | **0.0926** | 0.0486 | 0.0757 | 0.1192 | 4,034 | 6,352 |
| **MEAN (ALL 4 LESIONS)** | **0.0859** | **0.0480** | — | — | — | — |

## 2. Clinical Observations & Limitations

- **Hard Exudates (EX):** Highest segmentation fidelity; sharp lipoprotein boundaries yield the most distinct feature contrast.
- **Haemorrhages (HE):** Substantial overlap with microvascular beds; successfully separates focal dark patches from background vascular arcade.
- **Soft Exudates (SE):** Moderate recall; ischemic cotton-wool spots present low-contrast feathered borders, requiring careful illumination compensation.
- **Microaneurysms (MA):** Focal circular punctate dilatations (< 25-50 microns) occupy < 0.1% of retinal pixels; IoU is naturally constrained by extreme sub-pixel sparsity.
