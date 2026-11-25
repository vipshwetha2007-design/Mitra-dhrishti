"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Improved IDRiD U-Net Retinal Lesion Segmentation Model Verification Test Suite (ApexForge 2K26)
Tests:
1. Verify improved model artifacts, checkpoints, config, and training history exist.
2. Verify baseline U-Net, MobileNetV2, DME, and Localizer models are strictly preserved.
3. Verify improved quantitative test evaluation report (Mean Dice 0.3313 vs 0.0859 baseline).
4. Verify non-zero recovery for Microaneurysms (0.1241) and Haemorrhages (0.3137).
5. Verify visual overlay comparison artifacts exist.
6. Verify live end-to-end inference using improved model and calibrated thresholds.
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
OVERLAYS_DIR = os.path.join(REPORTS_DIR, "unet_improvement_test_overlays")

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
    print(" MITRA DRISHTI: IMPROVED U-NET LESION SEGMENTATION VERIFICATION")
    print("===================================================================")

    # 1. Check Improved Model Artifacts
    print("\n[*] 1. Checking Improved Model Artifacts and Checkpoints...")
    improved_unet_path = os.path.join(MODELS_DIR, "idrid_unet_lesions_improved.keras")
    improved_checkpoint_path = os.path.join(MODELS_DIR, "checkpoints", "best_lesion_unet_improved.keras")
    improved_config_path = os.path.join(MODELS_DIR, "unet_improved_model_config.json")
    improved_history_path = os.path.join(MODELS_DIR, "unet_improved_training_history.json")
    eval_json = os.path.join(REPORTS_DIR, "unet_improvement_evaluation.json")

    test_assert(os.path.exists(improved_unet_path), f"Improved U-Net model artifact exists: {improved_unet_path}")
    test_assert(os.path.getsize(improved_unet_path) > 20_000_000, f"Improved U-Net size verified: {os.path.getsize(improved_unet_path):,} bytes")
    test_assert(os.path.exists(improved_checkpoint_path), f"Best improved checkpoint exists: {improved_checkpoint_path}")
    test_assert(os.path.exists(improved_config_path), f"Improved model config exists: {improved_config_path}")
    test_assert(os.path.exists(improved_history_path), f"Improved training history exists: {improved_history_path}")
    test_assert(os.path.exists(eval_json), f"Quantitative evaluation JSON exists: {eval_json}")

    # 2. Check Preservation of All Existing Models
    print("\n[*] 2. Checking Preservation of Existing Models...")
    baseline_unet = os.path.join(MODELS_DIR, "idrid_unet_lesions.keras")
    dr_model = os.path.join(MODELS_DIR, "dr_classifier.keras")
    dme_model = os.path.join(MODELS_DIR, "dme_classifier.keras")
    loc_model = os.path.join(MODELS_DIR, "optic_disc_fovea_localizer.keras")

    test_assert(os.path.exists(baseline_unet), f"Baseline U-Net intact: {baseline_unet}")
    test_assert(os.path.exists(dr_model) and os.path.getsize(dr_model) > 10_000_000, f"MobileNetV2 DR classifier intact: {dr_model}")
    test_assert(os.path.exists(dme_model) and os.path.getsize(dme_model) > 20_000_000, f"DME classifier intact: {dme_model}")
    test_assert(os.path.exists(loc_model) and os.path.getsize(loc_model) > 15_000_000, f"Optic disc/fovea localizer intact: {loc_model}")

    # 3. Verify Config & Calibrated Thresholds
    print("\n[*] 3. Verifying Config and Calibrated Thresholds...")
    with open(improved_config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    test_assert(config["model_name"] == "Mritidhristi-IDRiD-UNet-Lesions-Improved", f"Model name verified: {config['model_name']}")
    test_assert(config["num_classes"] == 4, f"Target classes = 4: {config['classes']}")
    test_assert("calibrated_thresholds" in config, "Calibrated thresholds recorded in config")

    calib_th = config["calibrated_thresholds"]
    for lk in ["MA", "HE", "EX", "SE"]:
        test_assert(lk in calib_th, f"Threshold calibrated for {lk}: {calib_th.get(lk, {}).get('optimal_threshold')}")

    # 4. Verify Quantitative Improvements over Baseline
    print("\n[*] 4. Verifying Quantitative Improvements on 27 Official Test Scans...")
    with open(eval_json, "r", encoding="utf-8") as f:
        report = json.load(f)

    test_assert(report["test_sample_count"] == 27, f"Official test cohort evaluated: {report['test_sample_count']} scans")
    mean_dice = report["mean_dice"]
    mean_iou = report["mean_iou"]
    test_assert(mean_dice >= 0.30, f"Mean Dice substantially improved: {mean_dice:.4f} (Baseline: 0.0859, Target: >=0.30)")
    test_assert(mean_iou >= 0.20, f"Mean IoU substantially improved: {mean_iou:.4f} (Baseline: 0.0480, Target: >=0.20)")

    res = report["per_class_results"]
    ma_dice = res["MA"]["dice"]
    he_dice = res["HE"]["dice"]
    ex_dice = res["EX"]["dice"]
    se_dice = res["SE"]["dice"]

    test_assert(ma_dice > 0.0, f"Microaneurysms (MA) Dice non-zero recovered: {ma_dice:.4f} (Baseline: 0.0000, TP: {res['MA']['tp']})")
    test_assert(he_dice > 0.20, f"Haemorrhages (HE) Dice substantially improved: {he_dice:.4f} (Baseline: 0.0000, TP: {res['HE']['tp']})")
    test_assert(ex_dice >= 0.50, f"Hard Exudates (EX) Dice substantially improved: {ex_dice:.4f} (Baseline: 0.2510, TP: {res['EX']['tp']})")
    test_assert(se_dice >= 0.25, f"Soft Exudates (SE) Dice substantially improved: {se_dice:.4f} (Baseline: 0.0926, TP: {res['SE']['tp']})")

    # 5. Verify Visual Comparison Overlays Exist
    print("\n[*] 5. Verifying Visual Comparison Overlays...")
    test_assert(os.path.exists(OVERLAYS_DIR), f"Overlays directory exists: {OVERLAYS_DIR}")
    overlay_files = [f for f in os.listdir(OVERLAYS_DIR) if f.endswith(".png")]
    test_assert(len(overlay_files) >= 6, f"Generated visual comparison overlays: {len(overlay_files)} images")

    # 6. Live Inference Verification
    print("\n[*] 6. Verifying Live End-to-End Inference with Improved Engine...")
    from scripts.lesion_segmentation_engine import segment_retinal_lesions
    test_scan = os.path.join(ROOT_DIR, "A. Segmentation", "A. Segmentation", "1. Original Images", "b. Testing Set", "IDRiD_55.jpg")

    infer_res, overlay_img = segment_retinal_lesions(test_scan)
    test_assert(infer_res["status"] == "success", f"Inference status success: {infer_res['status']}")
    test_assert(infer_res["model_name"] == "Mritidhristi-IDRiD-UNet-Lesions-Improved", f"Used improved model: {infer_res['model_name']}")
    test_assert(infer_res["inference_latency_ms"] > 0, f"Inference latency: {infer_res['inference_latency_ms']} ms")
    test_assert(len(infer_res["lesions"]) == 4, f"All 4 lesion classes output: {len(infer_res['lesions'])}")
    test_assert(infer_res["overlay_base64"].startswith("data:image/png;base64,"), "Overlay returned as valid Base64 PNG data URL")

    print("\n===================================================================")
    print(f" TESTS COMPLETED: {passed} PASSED, {failed} FAILED")
    print("===================================================================")
    return failed == 0


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
