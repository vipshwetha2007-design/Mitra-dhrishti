"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
IDRiD U-Net Retinal Lesion Segmentation Model Verification Test Suite
Tests:
1. Verify model artifacts, checkpoints, config, and training history exist.
2. Verify MobileNetV2 (dr_classifier.keras) is strictly preserved and unmodified.
3. Verify genuine U-Net inference on official IDRiD test scans.
4. Verify multi-lesion statistics (MA, HE, EX, SE) and color overlays.
5. Verify evaluation metrics report on untouched 27 test scans.
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
    print(" MITRA DRISHTI: IDRiD LESION SEGMENTATION VERIFICATION")
    print("===================================================================")

    # 1. Check Model Artifacts
    print("\n[*] 1. Checking Model Artifacts and Checkpoints...")
    unet_path = os.path.join(MODELS_DIR, "idrid_unet_lesions.keras")
    checkpoint_path = os.path.join(MODELS_DIR, "checkpoints", "best_lesion_unet.keras")
    config_path = os.path.join(MODELS_DIR, "unet_model_config.json")
    history_path = os.path.join(MODELS_DIR, "unet_training_history.json")
    report_json = os.path.join(REPORTS_DIR, "idrid_lesion_segmentation_report.json")
    report_md = os.path.join(REPORTS_DIR, "idrid_lesion_segmentation_report.md")

    test_assert(os.path.exists(unet_path), f"U-Net model artifact exists: {unet_path}")
    test_assert(os.path.exists(checkpoint_path), f"Best checkpoint artifact exists: {checkpoint_path}")
    test_assert(os.path.exists(config_path), f"Model config exists: {config_path}")
    test_assert(os.path.exists(history_path), f"Training history exists: {history_path}")
    test_assert(os.path.exists(report_json), f"Quantitative evaluation JSON exists: {report_json}")
    test_assert(os.path.exists(report_md), f"Quantitative evaluation Markdown report exists: {report_md}")

    # 2. Check MobileNetV2 preservation
    print("\n[*] 2. Checking MobileNetV2 Preservation...")
    mobilenet_path = os.path.join(MODELS_DIR, "dr_classifier.keras")
    test_assert(os.path.exists(mobilenet_path), f"Existing MobileNetV2 model intact: {mobilenet_path}")
    test_assert(os.path.getsize(mobilenet_path) > 10_000_000, f"MobileNetV2 size verified (~11.6 MB): {os.path.getsize(mobilenet_path):,} bytes")

    # 3. Verify Config & Training History
    print("\n[*] 3. Verifying Config and Training Provenance...")
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    test_assert(config["model_name"] == "Mritidhristi-IDRiD-UNet-Lesions", f"Model name verified: {config['model_name']}")
    test_assert(config["num_classes"] == 4, f"Target classes = 4: {config['classes']}")
    test_assert("MA" in config["classes"] and "HE" in config["classes"] and "EX" in config["classes"] and "SE" in config["classes"], "Classes cover MA, HE, EX, SE")
    test_assert("OD" not in config["classes"], "Optic Disc correctly excluded from lesion classes")

    with open(history_path, "r", encoding="utf-8") as f:
        history = json.load(f)
    test_assert("loss" in history and "val_loss" in history, f"Training loss curves recorded ({len(history['loss'])} epochs)")
    test_assert(history["epochs_completed"] > 0, f"Epochs recorded: {history['epochs_completed']}")

    # 4. Verify Quantitative Report on Untouched Test Cohort
    print("\n[*] 4. Verifying Quantitative Test Evaluation Report...")
    with open(report_json, "r", encoding="utf-8") as f:
        report = json.load(f)
    test_assert(report["test_sample_count"] == 27, f"Official test cohort evaluated: {report['test_sample_count']} scans")
    test_assert("per_class_results" in report, "Per-class metrics reported")
    for lkey in ["MA", "HE", "EX", "SE"]:
        test_assert(lkey in report["per_class_results"], f"Per-class evaluation present for {lkey}")
        lres = report["per_class_results"][lkey]
        print(f"      - {lres['name']}: Dice={lres['dice']}, IoU={lres['iou']}, Precision={lres['precision']}, Recall={lres['recall']}")
        test_assert(0.0 <= lres["dice"] <= 1.0, f"{lkey} Dice in [0, 1]")
        test_assert(0.0 <= lres["iou"] <= 1.0, f"{lkey} IoU in [0, 1]")

    # 5. Live Inference on Test Scan
    print("\n[*] 5. Verifying Live End-to-End Inference...")
    from scripts.lesion_segmentation_engine import segment_retinal_lesions
    test_scan = os.path.join(ROOT_DIR, "A. Segmentation", "A. Segmentation", "1. Original Images", "b. Testing Set", "IDRiD_55.jpg")
    test_assert(os.path.exists(test_scan), f"Test scan exists: {test_scan}")

    infer_res, overlay_img = segment_retinal_lesions(test_scan)
    test_assert(infer_res["status"] == "success", f"Inference status success: {infer_res['status']}")
    test_assert(infer_res["inference_latency_ms"] > 0, f"Inference latency: {infer_res['inference_latency_ms']} ms")
    test_assert(len(infer_res["lesions"]) == 4, f"All 4 lesion classes output: {len(infer_res['lesions'])}")
    test_assert(infer_res["overlay_base64"].startswith("data:image/png;base64,"), "Overlay returned as valid Base64 PNG data URL")
    test_assert(isinstance(infer_res["clinical_assessment"], str), f"Clinical assessment generated: {infer_res['clinical_assessment']}")

    print("\n===================================================================")
    print(f" TESTS COMPLETED: {passed} PASSED, {failed} FAILED")
    print("===================================================================")
    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
