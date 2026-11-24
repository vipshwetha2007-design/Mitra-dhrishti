# Retinal Datasets, Clinical Sources & Licensing Directory
**Project:** MITRA DRISHTI — PREVENT • DETECT • PROTECT  
**System Module:** DETECT — AI Retinal Screening  
**Clinical Standards:** ICDR 5-Class Diabetic Retinopathy Scale  

---

## 1. Primary Curated Dataset: APTOS 2019 Blindness Detection

- **Clinical Cohort:** Patients evaluated at Aravind Eye Hospital clinics across Tamil Nadu, India.
- **Role in MITRA DRISHTI:** Primary training and validation benchmark for 5-class ICDR Diabetic Retinopathy grading.
- **Imaging Modality:** Color fundus photography (predominantly Topcon, Zeiss, and non-mydriatic cameras).
- **Clinical Relevance:** Directly matches MITRA DRISHTI's deployment demographics in Tamil Nadu and Indian rural/primary health centers.
- **Labels:** 5-class ICDR severity grades (0: No DR, 1: Mild, 2: Moderate, 3: Severe, 4: Proliferative DR) verified by clinical retina specialists.
- **Curated Dataset Size:** 3,662 genuine clinical retinal fundus examinations.
- **License / Usage Constraints:** Kaggle Competition Rules — Non-commercial academic research and clinical development.
- **Citation:**
  > Asia Pacific Tele-Ophthalmology Society (APTOS). "APTOS 2019 Blindness Detection." Kaggle, 2019. https://www.kaggle.com/c/aptos2019-blindness-detection

---

## 2. Multi-Cohort Benchmark Specifications

| Dataset | Sample Size | Primary Role | Access & License Requirements | Integration Status |
| :--- | :---: | :--- | :--- | :--- |
| **APTOS 2019** | 3,662 | Primary 5-class DR Grading (Indian Cohort) | Kaggle Competition Agreement / Research | **Curated, Split & Ready (Phase 5)** |
| **EyePACS** | 35,126 | Large-scale pretraining & feature extraction | Kaggle API / EyePACS DUA (~82 GB) | Harness & Ingestion Script Ready |
| **DDR** | 13,673 | High-grade DR lesion & grading verification | Academic License / Tsinghua University | Specification Defined |
| **IDRiD** | 516 | Indian fundus lesion segmentation (EX, HE, SE, MA) | Creative Commons Attribution (CC BY 4.0) | Mask Harmonization Configured |
| **DRIVE** | 40 | Retinal vessel segmentation & anatomy (Step 3) | Free Research Use (Univ. Medical Center Utrecht) | Landmark Calibration Harness |
| **Messidor-2** | 1,748 | External held-out validation cohort | ADCIS / Univ. of Iowa Research Agreement | External Evaluation Ready |

---

## 3. Operational Prerequisites for External Ingestion

To ingest the full raw EyePACS or DDR datasets into `datasets/raw/`:
1. **EyePACS Acquisition:**
   ```bash
   kaggle competitions download -c diabetic-retinopathy-detection -p datasets/raw/eyepacs/
   ```
   *Prerequisite:* User must have a Kaggle account and save API token to `~/.kaggle/kaggle.json`.
2. **IDRiD Acquisition:**
   - Download from IEEE Dataport (DOI: 10.21227/H29W98) under CC BY 4.0.
   - Place extracted images into `datasets/raw/idrid/`.
3. **Execution with Dataset Manager:**
   ```bash
   python scripts/dataset_manager.py --action audit_all
   ```

---

## 4. Ethical Compliance & Data Privacy

- All genuine retinal datasets integrated into MITRA DRISHTI are fully de-identified and anonymized according to HIPAA Safe Harbor guidelines and clinical research ethics boards.
- No protected health information (PHI), patient names, biometric faces, or geographic identifiers are contained within image data or metadata.
- Preprocessing applies strict circular cropping to eliminate peripheral metadata, patient ID watermarks, or camera imprint labels.

---
*Documented for MITRA DRISHTI Clinical AI Standards (Phase 5).*
