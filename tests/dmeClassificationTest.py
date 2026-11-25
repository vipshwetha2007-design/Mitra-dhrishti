"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
IDRiD DME Risk Classification Model Test Suite
"""

import os
import sys
import json
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["KERAS_HOME"] = os.path.abspath(".keras")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(ROOT_DIR, "models")
REPORTS_DIR = os.path.join(ROOT_DIR, "reports")

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
    print(" MITRA DRISHTI: DME RISK CLASSIFIER VERIFICATION")
    print("===================================================================")

    # 1. Model Artifacts
    print("\n[*] 1. Checking DME Model Artifacts and Checkpoints...")
    dme_path = os.path.join(MODELS_DIR, "dme_classifier.keras")
    checkpoint_path = os.path.join(MODELS_DIR, "checkpoints", "best_dme_model.keras")
    config_path = os.path.join(MODELS_DIR, "dme_model_config.json")
    history_path = os.path.join(MODELS_DIR, "dme_training_history.json")
    report_json = os.path.join(REPORTS_DIR, "idrid_dme_classification_report.json")
    report_md = os.path.join(REPORTS_DIR, "idrid_dme_classification_report.md")

    test_assert(os.path.exists(dme_path), f"DME model artifact exists: {dme_path}")
    test_assert(os.path.exists(checkpoint_path), f"Best DME checkpoint exists: {checkpoint_path}")
    test_assert(os.path.exists(config_path), f"DME config exists: {config_path}")
    test_assert(os.path.exists(history_path), f"DME training history exists: {history_path}")
    test_assert(os.path.exists(report_json), f"DME quantitative report JSON exists: {report_json}")
    test_assert(os.path.exists(report_md), f"DME quantitative report MD exists: {report_md}")

    # 2. Existing Model Preservation
    print("\n[*] 2. Checking Existing Model Preservation...")
    dr_model = os.path.join(MODELS_DIR, "dr_classifier.keras")
    unet_model = os.path.join(MODELS_DIR, "idrid_unet_lesions.keras")
    test_assert(os.path.exists(dr_model), "MobileNetV2 DR classifier preserved")
    test_assert(os.path.getsize(dr_model) == 11663859, f"MobileNetV2 checksum intact ({os.path.getsize(dr_model)} bytes)")
    test_assert(os.path.exists(unet_model), "U-Net lesion segmentation model preserved")

    # 3. Model Configuration & Provenance
    print("\n[*] 3. Verifying Model Config and Metadata...")
    with open(config_path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    test_assert(cfg["model_name"] == "Mritidhristi-IDRiD-DME-Classifier", f"Model name verified: {cfg['model_name']}")
    test_assert(cfg["num_classes"] == 3, f"3 DME Risk classes configured: {cfg['classes']}")
    test_assert("class_weights" in cfg, "Class imbalance weights recorded")
    test_assert(cfg["training_samples_raw"] == 330, f"Raw training samples: {cfg['training_samples_raw']}")
    test_assert(cfg["validation_samples"] == 83, f"Validation samples: {cfg['validation_samples']}")

    # 4. Evaluation Report Metrics
    print("\n[*] 4. Verifying Independent 103 Test Cohort Evaluation...")
    with open(report_json, "r", encoding="utf-8") as f:
        rep = json.load(f)
    test_assert(rep["test_sample_count"] == 103, f"Official test cohort evaluated: {rep['test_sample_count']} scans")
    test_assert(0.0 <= rep["overall_metrics"]["accuracy"] <= 1.0, f"Accuracy in bounds: {rep['overall_metrics']['accuracy']}")
    test_assert(-1.0 <= rep["overall_metrics"]["quadratic_weighted_kappa"] <= 1.0, f"QWK in bounds: {rep['overall_metrics']['quadratic_weighted_kappa']}")
    test_assert(0.0 <= rep["csme_high_risk_triage"]["sensitivity"] <= 1.0, f"CSME Sensitivity: {rep['csme_high_risk_triage']['sensitivity']}")
    test_assert(0.0 <= rep["csme_high_risk_triage"]["specificity"] <= 1.0, f"CSME Specificity: {rep['csme_high_risk_triage']['specificity']}")

    # 5. Live Inference on Test Scan
    print("\n[*] 5. Verifying Live DME Inference on Test Scan...")
    from scripts.dme_inference_engine import predict_dme_risk
    test_img = os.path.join(ROOT_DIR, "B. Disease Grading", "B. Disease Grading", "1. Original Images", "b. Testing Set", "IDRiD_001.jpg")
    test_assert(os.path.exists(test_img), f"Test scan exists: {test_img}")

    infer_res = predict_dme_risk(test_img)
    test_assert(infer_res["status"] == "success", f"Inference status: {infer_res['status']}")
    test_assert(infer_res["predicted_grade"] in [0, 1, 2], f"Predicted grade in [0..2]: Grade {infer_res['predicted_grade']}")
    test_assert(isinstance(infer_res["category_name"], str), f"Category name: {infer_res['category_name']}")
    probs = list(infer_res["class_probabilities"].values())
    test_assert(abs(sum(probs) - 1.0) < 0.01, f"Probabilities sum to 1.0: {sum(probs):.4f}")
    test_assert(infer_res["inference_latency_ms"] > 0, f"Inference latency: {infer_res['inference_latency_ms']} ms")
    test_assert("OCT" in infer_res["clinical_disclaimer"], "Mandatory clinical disclaimer present")

    print("\n===================================================================")
    print(f" DME TESTS COMPLETED: {passed} PASSED, {failed} FAILED")
    print("===================================================================")
    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
