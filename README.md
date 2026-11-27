# MITRA DRISHTI
### PREVENT • DETECT • PROTECT

**Prevent Vision Loss Before It Begins.**

MITRA DRISHTI is an AI-powered diabetic retinopathy screening and patient-care platform designed to improve access to early eye screening, explainable AI analysis, doctor-led referrals, and patient follow-up, particularly in underserved and rural communities.

## About the Project

Diabetic Retinopathy (DR) is a diabetes-related eye complication that damages the blood vessels in the retina. It can develop without noticeable symptoms during its early stages. Timely screening and appropriate medical follow-up can help reduce the risk of preventable vision loss.

MITRA DRISHTI connects three important stages of eye healthcare:

- **PREVENT** – Lifestyle risk awareness and preventive guidance.
- **DETECT** – AI-assisted retinal image analysis and DR screening.
- **PROTECT** – Doctor review, referral coordination, and patient follow-up.

## Core Modules

### 1. PREVENT – Early Awareness

Encourages users to understand lifestyle-related diabetes risk factors and adopt healthier habits.

**Features:**
- Lifestyle-based risk assessment.
- Personalised preventive recommendations.
- Indian diet and physical activity guidance.
- Sleep and lifestyle tracking.
- Risk-factor visualisation.
- Progress monitoring and follow-up checkpoints.

*PREVENT provides risk awareness and is not a medical diagnosis.*

### 2. DETECT – Explainable AI Screening

Uses deep learning and image-processing techniques to analyse retinal fundus images.

**Screening Pipeline:**

1. Retinal image upload.
2. Image quality assessment.
3. Image preprocessing and enhancement.
4. Optic disc and fovea localisation.
5. Retinal lesion segmentation.
6. Five-class diabetic retinopathy grading.
7. Grad-CAM visualisation.
8. Monte Carlo Dropout uncertainty estimation.
9. Referable DR risk assessment.
10. Screening report generation.

**AI Models and Techniques**

| Component | Technology |
|---|---|
| DR classification | Improved MobileNetV2 CNN |
| Lesion segmentation | Enhanced Residual U-Net |
| Anatomical localisation | CoordConv + MobileNetV2 |
| Explainability | Grad-CAM |
| Uncertainty estimation | Monte Carlo Dropout |
| Image enhancement | OpenCV and CLAHE |

**Five DR Severity Grades:**
- Grade 0 – No DR
- Grade 1 – Mild NPDR
- Grade 2 – Moderate NPDR
- Grade 3 – Severe NPDR
- Grade 4 – Proliferative DR (PDR)

**Lesion Categories:**
- Microaneurysms (MA)
- Haemorrhages (HE)
- Hard Exudates (EX)
- Soft Exudates (SE)

The AI-generated results support screening and clinical review. They do not replace an ophthalmologist's diagnosis.

### 3. PROTECT – From Screening to Care

Screening is meaningful only when it leads to appropriate medical care.

**Features:**
- Doctor review of screening results.
- Retinal image and AI report access.
- Referral coordination.
- Appointment and referral tracking.
- ASHA/VHN field-worker coordination.
- Patient follow-up records.
- Missed-appointment identification.
- Offline-first data capture and synchronisation.

Clinical decisions remain with qualified healthcare professionals.

## System Architecture

MITRA DRISHTI follows an integrated architecture connecting the user interface, backend services, AI inference pipeline, data management, and patient-care workflows.

### Architecture Diagram
<img width="1288" height="859" alt="image" src="https://github.com/user-attachments/assets/268675eb-77fd-4b36-adc5-3a13787a1a4c" />

## Technology Stack

**Frontend**
- React 19
- TypeScript
- Vite
- Progressive Web App (PWA)
- HTML5 and CSS3

**Backend**
- Node.js
- Express.js
- REST APIs

**Artificial Intelligence**
- Python
- TensorFlow
- Keras
- OpenCV

**Data and Offline Support**
- Dexie.js
- IndexedDB
- Offline-first data capture and synchronisation
- Runtime JSON storage

**Security**
- Scrypt password hashing
- Timing-safe password comparison
- Role-based access control

## Datasets

The project uses publicly available retinal datasets for model development and evaluation.

- **APTOS 2019:** Diabetic retinopathy classification.
- **IDRiD:** DR grading, retinal lesion segmentation, and anatomical localisation.

Model performance on these datasets does not establish clinical validation. Further evaluation using diverse populations, imaging devices, and ophthalmologist-reviewed data is required.

## Getting Started

### Prerequisites

- Node.js
- npm
- Python
- Git

### Clone the Repository

```bash
git clone https://github.com/vipshwetha2007-design/Mitra-dhrishti.git
cd Mitra-dhrishti
```

### Install Dependencies

```bash
npm install
```

### Configure Environment

Set up the required environment variables using the project's existing configuration or environment example file.

Do not commit API keys, passwords, or other secrets.

### Run the Application

Use the startup commands defined in the repository's package scripts and backend configuration.

For a project configured with the TypeScript server entry point:

```bash
npx tsx server.ts
```

Open the application at:

```text
http://localhost:3000
```

The actual startup commands and port depend on the project configuration.

## Project Vision

MITRA DRISHTI aims to make early diabetic eye screening more accessible by connecting preventive awareness, explainable AI, healthcare professionals, and community health workers.

The goal is not simply to identify a possible retinal condition, but to help connect people with appropriate medical attention and follow-up.

## Medical Disclaimer

MITRA DRISHTI is an AI-assisted screening and healthcare coordination project intended for research and demonstration purposes. Its outputs are not a substitute for professional medical diagnosis, treatment, or advice.

All clinical decisions must be made by qualified healthcare professionals. The AI models and segmentation outputs require further clinical validation before real-world medical deployment.

---

**MITRA DRISHTI – PREVENT • DETECT • PROTECT**

*Screening should not end with a result. It should lead to care.*
