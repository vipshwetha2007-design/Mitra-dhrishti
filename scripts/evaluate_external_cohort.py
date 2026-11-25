#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Phase 4: Independent External AI Validation Engine (IDRiD / Messidor-2 / Multi-Cohort)
File: scripts/evaluate_external_cohort.py

This script prepares, validates, and executes independent external validation of the trained
MITRA DRISHTI MobileNetV2 model (models/dr_classifier.keras) on external multi-center cohorts:
1. IDRiD (Indian Diabetic Retinopathy Image Dataset - 516 scans, Aravind/Nanded cohort)
2. Messidor-2 (1,748 clinical examinations, France/Univ. of Iowa cohort)
3. Custom external test cohorts formatted as (image_path, icdr_grade)

Strict Clinical AI Governance:
- Zero Retraining / Zero Fine-Tuning (Model weights remain strictly frozen).
- Zero Data Leakage (No overlap with APTOS 2019 training/validation splits).
- Independent Reporting: 5-class ICDR staging evaluated separately from referable DR triage.
"""

import os
import sys
import json
import argparse
import numpy as np
import pandas as pd
from PIL import Image

# Force Keras Home to workspace
os.environ["KERAS_HOME"] = os.path.abspath(".keras")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(ROOT_DIR, "models")
REPORTS_DIR = os.path.join(ROOT_DIR, "reports")

# External Dataset Metadata Specifications
EXTERNAL_COHORTS_SPEC = {
    "idrid": {
        "name": "IDRiD (Indian Diabetic Retinopathy Image Dataset)",
        "source": "Eye Clinic, Nanded, Maharashtra, India (IEEE Dataport DOI: 10.21227/H29W98)",
        "license": "Creative Commons Attribution 4.0 International (CC BY 4.0)",
        "total_images": 516,
        "default_dir": os.path.join(ROOT_DIR, "datasets", "raw", "idrid"),
        "default_csv": os.path.join(ROOT_DIR, "datasets", "raw", "idrid", "IDRiD_Disease_Grading_Evaluation.csv"),
        "access_requirement": "Download from IEEE Dataport registration portal (Open Access under CC BY 4.0)",
        "modality": "Kowa VX-10alpha digital fundus camera (50° FOV)"
    },
    "messidor2": {
        "name": "Messidor-2 Retinal Dataset",
        "source": "Messidor Consortium / University of Iowa / ADCIS",
        "license": "Messidor-2 Research Agreement (Academic / Non-commercial)",
        "total_images": 1748,
        "default_dir": os.path.join(ROOT_DIR, "datasets", "raw", "messidor2"),
        "default_csv": os.path.join(ROOT_DIR, "datasets", "raw", "messidor2", "messidor_data.csv"),
        "access_requirement": "ADCIS / University of Iowa Data Use Agreement registration",
        "modality": "Topcon TRC NW6 non-mydriatic camera (45° FOV)"
    }
}

def check_external_dataset_availability(cohort_key="idrid"):
    spec = EXTERNAL_COHORTS_SPEC.get(cohort_key)
    if not spec:
        return False, f"Unknown cohort key: {cohort_key}"
    
    dir_exists = os.path.isdir(spec["default_dir"])
    csv_exists = os.path.isfile(spec["default_csv"])
    
    status = {
        "cohort": spec["name"],
        "license": spec["license"],
        "access_requirement": spec["access_requirement"],
        "modality": spec["modality"],
        "target_count": spec["total_images"],
        "directory_found": dir_exists,
        "labels_csv_found": csv_exists,
        "is_available": dir_exists and csv_exists
    }
    return status["is_available"], status

def crop_and_preprocess_fundus(pil_img, target_size=(224, 224)):
    """Applies Graham circular aperture crop and ImageNet scaling."""
    img = pil_img.convert("RGB")
    arr = np.array(img)
    
    # Simple bounding box crop for non-zero pixels
    gray = np.mean(arr, axis=2)
    mask = gray > 15
    if np.any(mask):
        y_indices, x_indices = np.where(mask)
        ymin, ymax = y_indices.min(), y_indices.max()
        xmin, xmax = x_indices.min(), x_indices.max()
        arr = arr[ymin:ymax+1, xmin:xmax+1]
        img = Image.fromarray(arr)
        
    img_resized = img.resize(target_size, Image.Resampling.LANCZOS)
    arr_out = np.array(img_resized, dtype=np.float32) / 255.0
    
    # ImageNet normalization
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    return (arr_out - mean) / std

def run_external_evaluation(image_paths, ground_truth_labels, cohort_name="External Validation Cohort"):
    import tensorflow as tf
    import keras
    from sklearn.metrics import accuracy_score, cohen_kappa_score, f1_score, roc_auc_score, confusion_matrix
    
    model_path = os.path.join(MODELS_DIR, "dr_classifier.keras")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}")
        
    print(f"[*] Loading frozen model from: {model_path}")
    model = keras.models.load_model(model_path)
    
    print(f"[*] Preprocessing {len(image_paths)} external fundus images...")
    processed_imgs = []
    valid_labels = []
    
    for p, label in zip(image_paths, ground_truth_labels):
        if os.path.isfile(p):
            try:
                with Image.open(p) as img:
                    processed_imgs.append(crop_and_preprocess_fundus(img))
                    valid_labels.append(int(label))
            except Exception as e:
                print(f"[!] Warning: Failed to process image {p}: {e}")
                
    if len(processed_imgs) == 0:
        raise ValueError("Zero valid images could be processed from provided paths.")
        
    X = np.stack(processed_imgs, axis=0)
    y_true = np.array(valid_labels)
    
    print(f"[*] Running model inference on {len(X)} external scans...")
    probs = model.predict(X, batch_size=32, verbose=1)
    y_pred_5grade = np.argmax(probs, axis=1)
    
    # 5-Grade Metrics
    acc = float(accuracy_score(y_true, y_pred_5grade))
    qwk = float(cohen_kappa_score(y_true, y_pred_5grade, weights="quadratic"))
    macro_f1 = float(f1_score(y_true, y_pred_5grade, average="macro", zero_division=0))
    cm = confusion_matrix(y_true, y_pred_5grade, labels=[0, 1, 2, 3, 4]).tolist()
    
    # Referable DR Metrics (Calibrated threshold tau=0.35 on cumulative P(Grade >= 2))
    p_referable = np.sum(probs[:, 2:], axis=1)
    y_true_referable = (y_true >= 2).astype(int)
    y_pred_referable = (p_referable >= 0.35).astype(int)
    
    tp = int(np.sum((y_pred_referable == 1) & (y_true_referable == 1)))
    fp = int(np.sum((y_pred_referable == 1) & (y_true_referable == 0)))
    tn = int(np.sum((y_pred_referable == 0) & (y_true_referable == 0)))
    fn = int(np.sum((y_pred_referable == 0) & (y_true_referable == 1)))
    
    ref_sens = float(tp / (tp + fn)) if (tp + fn) > 0 else 0.0
    ref_spec = float(tn / (tn + fp)) if (tn + fp) > 0 else 0.0
    
    try:
        ref_auc = float(roc_auc_score(y_true_referable, p_referable))
    except Exception:
        ref_auc = 0.5
        
    results = {
        "cohort_name": cohort_name,
        "sample_count": len(X),
        "evaluation_standard": "ICDR 5-Class Scale & Calibrated Referable DR (tau=0.35)",
        "five_grade_metrics": {
            "accuracy": round(acc, 4),
            "quadratic_weighted_kappa": round(qwk, 4),
            "macro_f1": round(macro_f1, 4),
            "confusion_matrix": cm
        },
        "referable_dr_metrics": {
            "operating_threshold": 0.35,
            "sensitivity": round(ref_sens, 4),
            "specificity": round(ref_spec, 4),
            "roc_auc": round(ref_auc, 4),
            "true_positives": tp,
            "false_positives": fp,
            "true_negatives": tn,
            "false_negatives": fn
        }
    }
    return results

def main():
    parser = argparse.ArgumentParser(description="MITRA DRISHTI Independent External AI Validation Engine")
    parser.add_argument("--cohort", choices=["idrid", "messidor2", "all"], default="idrid", help="External cohort to inspect/evaluate")
    parser.add_argument("--inspect-only", action="store_true", help="Inspect availability and licensing without evaluating")
    args = parser.parse_args()
    
    print("===================================================================")
    print(" MITRA DRISHTI PHASE 4: INDEPENDENT EXTERNAL AI VALIDATION AUDIT")
    print("===================================================================")
    
    cohorts_to_check = ["idrid", "messidor2"] if args.cohort == "all" else [args.cohort]
    
    for c_key in cohorts_to_check:
        spec = EXTERNAL_COHORTS_SPEC[c_key]
        is_avail, status = check_external_dataset_availability(c_key)
        
        print(f"\n[*] Cohort: {spec['name']}")
        print(f"    Source: {spec['source']}")
        print(f"    Modality: {spec['modality']}")
        print(f"    License: {spec['license']}")
        print(f"    Access Requirement: {spec['access_requirement']}")
        print(f"    Expected Scan Count: {spec['total_images']}")
        print(f"    Directory Exists: {status['directory_found']} ({spec['default_dir']})")
        print(f"    Labels CSV Exists: {status['labels_csv_found']} ({spec['default_csv']})")
        
        if not is_avail:
            print(f"    Status: BLOCKED BY MISSING EXTERNAL DEPENDENCY")
            print(f"    Resolution: Beneficiary / institution must complete portal registration and place files into `{spec['default_dir']}`.")
        else:
            print(f"    Status: READY FOR EVALUATION")
            if not args.inspect_only:
                print(f"    [*] Loading dataset labels from: {spec['default_csv']}")
                df = pd.read_csv(spec['default_csv'])
                img_col = df.columns[0]
                label_col = df.columns[1]
                paths = [os.path.join(spec['default_dir'], str(fname)) for fname in df[img_col]]
                labels = df[label_col].tolist()
                
                res = run_external_evaluation(paths, labels, cohort_name=spec['name'])
                out_json = os.path.join(REPORTS_DIR, f"{c_key}_evaluation_report.json")
                with open(out_json, "w") as f:
                    json.dump(res, f, indent=2)
                print(f"[+] Evaluation completed. Report saved to: {out_json}")

if __name__ == "__main__":
    main()
