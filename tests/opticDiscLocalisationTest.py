"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Optic Disc & Fovea Localisation Model Test Suite
"""

import os
import sys
import json
import base64
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["KERAS_HOME"] = os.path.abspath(".keras")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(ROOT_DIR, "models")
REPORTS_DIR = os.path.join(ROOT_DIR, "reports")
LOC_BASE = os.path.join(ROOT_DIR, "C. Localization", "C. Localization")

passed = 0
failed = 0


def test_assert(condition, desc):
    global passed, failed
    if condition:
        print(f"  [PASS] {desc}")
        passed += 1
    else:
        print(f"  [FAIL] {desc}")
        failed += 1


def run_tests():
    global passed, failed
    print("===================================================================")
    print(" MITRA DRISHTI: OPTIC DISC & FOVEA LOCALISER VERIFICATION")
    print("===================================================================")

    # 1. Dataset & Groundtruth Integrity
    print("\n[*] 1. Checking Dataset and Annotation Integrity...")
    train_dir = os.path.join(LOC_BASE, "1. Original Images", "a. Training Set")
    test_dir = os.path.join(LOC_BASE, "1. Original Images", "b. Testing Set")
    od_train_csv = os.path.join(LOC_BASE, "2. Groundtruths", "1. Optic Disc Center Location", "a. IDRiD_OD_Center_Training Set_Markups.csv")
    fov_train_csv = os.path.join(LOC_BASE, "2. Groundtruths", "2. Fovea Center Location", "IDRiD_Fovea_Center_Training Set_Markups.csv")
    od_test_csv = os.path.join(LOC_BASE, "2. Groundtruths", "1. Optic Disc Center Location", "b. IDRiD_OD_Center_Testing Set_Markups.csv")
    fov_test_csv = os.path.join(LOC_BASE, "2. Groundtruths", "2. Fovea Center Location", "IDRiD_Fovea_Center_Testing Set_Markups.csv")

    test_assert(os.path.exists(train_dir), f"Training images exist: {train_dir}")
    test_assert(len([f for f in os.listdir(train_dir) if f.endswith('.jpg')]) == 413, "Official 413 training scans verified")
    test_assert(os.path.exists(test_dir), f"Testing images exist: {test_dir}")
    test_assert(len([f for f in os.listdir(test_dir) if f.endswith('.jpg')]) == 103, "Official 103 testing scans verified")
    test_assert(os.path.exists(od_train_csv), "OD Training CSV exists")
    test_assert(os.path.exists(fov_train_csv), "Fovea Training CSV exists")
    test_assert(os.path.exists(od_test_csv), "OD Testing CSV exists")
    test_assert(os.path.exists(fov_test_csv), "Fovea Testing CSV exists")

    # 2. Existing Model Preservation (DR, Lesion U-Net, DME)
    print("\n[*] 2. Checking Existing Model Preservation...")
    dr_model = os.path.join(MODELS_DIR, "dr_classifier.keras")
    unet_model = os.path.join(MODELS_DIR, "idrid_unet_lesions.keras")
    dme_model = os.path.join(MODELS_DIR, "dme_classifier.keras")

    test_assert(os.path.exists(dr_model), "MobileNetV2 DR classifier preserved")
    test_assert(os.path.getsize(dr_model) == 11663859, f"MobileNetV2 DR checksum intact ({os.path.getsize(dr_model)} bytes)")
    test_assert(os.path.exists(unet_model), "U-Net lesion model preserved")
    test_assert(os.path.exists(dme_model), "DME risk classifier preserved")

    # 3. Model Artifacts & Checkpoint Validation
    print("\n[*] 3. Checking Localiser Model Artifacts...")
    localizer_model = os.path.join(MODELS_DIR, "optic_disc_fovea_localizer.keras")
    checkpoint_model = os.path.join(MODELS_DIR, "checkpoints", "best_optic_disc_fovea_localizer.keras")
    config_path = os.path.join(MODELS_DIR, "optic_disc_fovea_model_config.json")
    history_path = os.path.join(MODELS_DIR, "optic_disc_fovea_training_history.json")
    report_json = os.path.join(REPORTS_DIR, "optic_disc_fovea_evaluation.json")
    report_md = os.path.join(REPORTS_DIR, "optic_disc_fovea_training_report.md")

    test_assert(os.path.exists(localizer_model), f"Localiser model artifact exists: {localizer_model}")
    test_assert(os.path.exists(checkpoint_model), f"Best checkpoint exists: {checkpoint_model}")
    test_assert(os.path.exists(config_path), f"Model config exists: {config_path}")
    test_assert(os.path.exists(history_path), f"Training history exists: {history_path}")
    test_assert(os.path.exists(report_json), f"Evaluation JSON exists: {report_json}")
    test_assert(os.path.exists(report_md), f"Evaluation MD report exists: {report_md}")

    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    test_assert(cfg["model_name"] == "Mritidhristi-IDRiD-Landmark-Localizer", f"Model name verified: {cfg['model_name']}")
    test_assert("optic_disc_center" in cfg["output_heads"] and "fovea_center" in cfg["output_heads"], "Dual-head architecture configured")
    test_assert(cfg["training_samples_raw"] == 330, f"Raw training samples: {cfg['training_samples_raw']}")
    test_assert(cfg["validation_samples"] == 83, f"Validation samples: {cfg['validation_samples']}")

    # 4. Evaluation Metrics on Official 103 Test Scans
    print("\n[*] 4. Checking Test Cohort Evaluation Metrics...")
    with open(report_json, "r", encoding="utf-8") as f:
        rep = json.load(f)

    test_assert(rep["test_sample_count"] == 103, f"Test sample count verified: {rep['test_sample_count']}")
    mean_err = rep["overall_performance"]["mean_landmark_error_px"]
    median_err = rep["overall_performance"]["median_landmark_error_px"]
    test_assert(0.0 < mean_err < 500.0, f"Mean landmark error in plausible bounds: {mean_err:.1f} px")
    test_assert(0.0 < median_err < 400.0, f"Median landmark error in plausible bounds: {median_err:.1f} px")

    od_err = rep["optic_disc_localization"]["median_error_px"]
    fov_err = rep["fovea_localization"]["median_error_px"]
    test_assert(0.0 < od_err < 300.0, f"Optic disc median error: {od_err:.1f} px")
    test_assert(0.0 < fov_err < 400.0, f"Fovea median error: {fov_err:.1f} px")

    # 5. Live Inference on Test Fundus Scan
    print("\n[*] 5. Verifying Live Inference Engine...")
    from scripts.optic_disc_fovea_inference import predict_landmarks
    sample_test_img = os.path.join(test_dir, "IDRiD_001.jpg")
    test_assert(os.path.exists(sample_test_img), f"Test scan exists: {sample_test_img}")

    res = predict_landmarks(sample_test_img)
    test_assert(res["status"] == "success", f"Inference status: {res['status']}")
    test_assert("optic_disc" in res["landmarks"] and "fovea" in res["landmarks"], "Both landmarks returned")

    od_px = res["landmarks"]["optic_disc"]["pixel_coordinates"]
    fov_px = res["landmarks"]["fovea"]["pixel_coordinates"]
    test_assert(0.0 < od_px["x"] < 4288.0 and 0.0 < od_px["y"] < 2848.0, f"OD coordinates in canvas bounds: ({od_px['x']}, {od_px['y']})")
    test_assert(0.0 < fov_px["x"] < 4288.0 and 0.0 < fov_px["y"] < 2848.0, f"Fovea coordinates in canvas bounds: ({fov_px['x']}, {fov_px['y']})")

    dist = res["inter_landmark_metrics"]["euclidean_distance_px"]
    test_assert(500.0 < dist < 2500.0, f"Anatomical OD-Fovea distance plausible: {dist:.1f} px")
    test_assert("OCT" in res["clinical_disclaimer"] or "optical coherence tomography" in res["clinical_disclaimer"].lower(), "Mandatory clinical disclaimer present")

    # 6. Invalid Input Handling
    print("\n[*] 6. Verifying Error Handling on Invalid Input...")
    try:
        predict_landmarks("non_existent_file_xyz123.jpg")
        test_assert(False, "Should raise FileNotFoundError on missing file")
    except FileNotFoundError:
        test_assert(True, "Correctly caught FileNotFoundError on missing file")

    print("\n===================================================================")
    print(f" OPTIC DISC & FOVEA LOCALISATION TESTS: {passed} PASSED, {failed} FAILED")
    print("===================================================================")
    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
