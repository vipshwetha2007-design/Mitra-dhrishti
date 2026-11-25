# IDRiD Optic Disc & Fovea Centre Localisation Training & Evaluation Report

**Model:** `models/optic_disc_fovea_localizer.keras`  
**Architecture:** Pre-trained MobileNetV2 with CoordConv Spatial Feature Embedding and Dual-Head Regression  
**Cohort:** Official IDRiD Component C Testing Cohort (103 Untouched Retinal Scans)  
**Canvas Size:** 4288 x 2848 pixels  

## 1. Overall Localisation Performance

- **Mean Landmark Error (All Landmarks):** 187.0 pixels
- **Median Landmark Error:** 163.0 pixels
- **Error Standard Deviation:** 114.4 pixels
- **Mean Normalized Error (Relative to ~450px Optic Disc Diameter):** 0.4157 OD diameters
- **Average Inference Latency:** 81.7 ms per scan

## 2. Separate Landmark Performance

| Landmark | Mean Error | Median Error | Std Dev | Min Error | Max Error | Within 100px | Within 200px | Within 0.5 OD Diam (225px) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Optic Disc (OD) Centre** | 227.2 px | 199.9 px | 136.4 px | 19.5 px | 533.8 px | 21.4% | 50.5% | 57.3% |
| **Fovea Centre** | 146.9 px | 143.0 px | 65.7 px | 29.2 px | 327.3 px | 29.1% | 75.7% | 88.3% |

## 3. Optic Disc–Fovea Anatomical Distance

- **Ground-Truth Mean Distance:** 1287.6 px
- **Predicted Mean Distance:** 1141.2 px
- **Mean Distance Error:** 236.3 px
- **Median Distance Error:** 215.1 px

## 4. Visual Verification Artifacts

Visual overlays generated and saved in `reports/optic_disc_fovea_test_overlays/`:
- `IDRiD_001_landmark_overlay.png`: OD Error = 459.7 px, Fovea Error = 166.6 px
- `IDRiD_002_landmark_overlay.png`: OD Error = 94.9 px, Fovea Error = 97.5 px
- `IDRiD_003_landmark_overlay.png`: OD Error = 454.7 px, Fovea Error = 327.3 px
- `IDRiD_007_landmark_overlay.png`: OD Error = 533.7 px, Fovea Error = 144.6 px
- `IDRiD_045_landmark_overlay.png`: OD Error = 381.1 px, Fovea Error = 29.2 px

## 5. Clinical Safety & Scope Limitation

> [!NOTE]
> The predicted optic disc and fovea coordinates and anatomical distance are provided solely for visual orientation, lesion localization, and macular proximity analysis. They do NOT constitute an independent clinical diagnosis of glaucoma, papilledema, macular hole, or macular dystrophy. Clinical validation is strictly not claimed.
