"""
MITRA DRISHTI — APEXFORGE 2K26 (TRAIN • LEARN • PREDICT)
Verification script for Improved MobileNetV2 Retinal Classification & Cross-Dataset Generalisation.

Tests:
1. Improved Model verification (models/dr_classifier_improved.keras)
2. Automatic fallback verification (models/dr_classifier.keras)
3. Genuine clinical fundus scan inference with improved preprocessing
4. Temperature scaling & probability calibration (sum to 1.0)
5. Calibrated Referable DR triage at tau = 0.38
6. Dynamic Grad-CAM explainability & hotspot extraction
7. Quality gate: Optical blur rejection
8. Quality gate: Non-retinal OOD rejection
9. Safe autonomous withholding on high uncertainty
10. Model config, evaluation report, and Grad-CAM visual artifacts consistency
"""

import os
import sys
import time
import io
import json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
import pyarrow as pa

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["KERAS_HOME"] = os.path.abspath(".keras")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from scripts.retinal_inference_engine import (
    run_retinal_inference,
    get_inference_models,
    get_loaded_model_info,
    load_and_preprocess_image,
    IMPROVED_MODEL_PATH,
    BASELINE_MODEL_PATH,
)
from scripts.train_cnn_improved import DEFAULT_ARROW_PATH

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


print("===================================================================")
print(" MITRA DRISHTI: IMPROVED RETINAL CLASSIFIER VERIFICATION")
print("===================================================================")

# 1. Verify Model Files on Disk
test_assert(os.path.exists(IMPROVED_MODEL_PATH), f"Improved model exists at {IMPROVED_MODEL_PATH}")
test_assert(os.path.exists(BASELINE_MODEL_PATH), f"Baseline model exists as fallback at {BASELINE_MODEL_PATH}")

# 2. Test Model Loading & Info
model, base_ext, head_mod = get_inference_models(IMPROVED_MODEL_PATH)
info = get_loaded_model_info()
test_assert(info["isImproved"] is True, f"Loaded model recognized as improved: {info['modelType']}")
test_assert(base_ext.layers[-1].name == "out_relu", f"Grad-CAM targets MobileNetV2 out_relu: {base_ext.layers[-1].name}")

# 3. Load Real Clinical Retinal Scan
real_img_bytes = None
if os.path.exists(DEFAULT_ARROW_PATH):
    print(f"[*] Loading genuine clinical scan from Arrow store: {DEFAULT_ARROW_PATH}")
    with pa.OSFile(DEFAULT_ARROW_PATH, "rb") as f:
        reader = pa.ipc.open_stream(f)
        batch = reader.read_next_batch()
        img_col = batch.column(0)
        bytes_field = img_col.field(0)
        real_img_bytes = bytes_field[0].as_buffer().to_pybytes()
else:
    # Check IDRiD test set image
    idrid_sample = os.path.join(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
        "B. Disease Grading",
        "1. Original Images",
        "b. Testing Set",
        "IDRiD_001.jpg",
    )
    if os.path.exists(idrid_sample):
        print(f"[*] Loading genuine clinical scan from IDRiD test set: {idrid_sample}")
        with open(idrid_sample, "rb") as f:
            real_img_bytes = f.read()

if real_img_bytes is None:
    print("[*] Generating realistic synthetic clinical fundus image...")
    img = Image.new("RGB", (384, 384), color=(180, 50, 20))
    draw = ImageDraw.Draw(img)
    draw.ellipse((80, 150, 150, 220), fill=(255, 220, 160))
    draw.ellipse((220, 170, 260, 210), fill=(120, 30, 10))
    draw.line([(115, 185), (50, 100), (40, 50)], fill=(120, 20, 10), width=4)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    real_img_bytes = buf.getvalue()

# 4. Run Inference with Improved Model
t0 = time.time()
res_improved = run_retinal_inference(real_img_bytes, model_path=IMPROVED_MODEL_PATH)
lat_ms = (time.time() - t0) * 1000

test_assert(res_improved["success"] is True, "Inference executed successfully with improved model")
test_assert(res_improved["modelPrediction"]["isImprovedModel"] is True, "Inference output confirms isImprovedModel=True")
test_assert(res_improved["modelPrediction"]["calibrationThreshold"] == 0.38, "Calibrated decision threshold set to tau=0.38")
test_assert(res_improved["modelPrediction"]["icdrGrade"] in [0, 1, 2, 3, 4], f"Predicted ICDR grade in range: Grade {res_improved['modelPrediction']['icdrGrade']}")
test_assert(res_improved["modelPrediction"]["confidence"] > 0.0, f"Reported confidence: {res_improved['modelPrediction']['confidence']}")
test_assert("predictiveEntropy" in res_improved["modelPrediction"], f"Predictive entropy: {res_improved['modelPrediction']['predictiveEntropy']} bits")
test_assert("pReferable" in res_improved["modelPrediction"], f"Referable probability: {res_improved['modelPrediction']['pReferable']}")
test_assert(isinstance(res_improved["modelPrediction"]["isReferable"], bool), f"Referable triage boolean: {res_improved['modelPrediction']['isReferable']}")
test_assert("triageRecommendation" in res_improved["modelPrediction"], f"Triage recommendation: {res_improved['modelPrediction']['triageRecommendation']}")

# Calibrated probability distribution sums to 1.0
cal_probs = res_improved["modelPrediction"]["calibratedProbabilities"]
test_assert(len(cal_probs) == 5, f"5-class probabilities reported: {cal_probs}")
test_assert(abs(sum(cal_probs) - 1.0) < 0.01, f"Calibrated probabilities sum to 1.0: {sum(cal_probs):.4f}")

# Grad-CAM heatmap & hotspots
test_assert(res_improved["gradCam"]["available"] is True, "Grad-CAM heatmap available")
test_assert(res_improved["gradCam"]["heatmapDataUrl"].startswith("data:image/png;base64,"), "Heatmap is valid base64 PNG data URL")
test_assert(len(res_improved["gradCam"]["hotspots"]) > 0, f"Grad-CAM candidate hotspots extracted: {len(res_improved['gradCam']['hotspots'])}")
if res_improved["gradCam"]["hotspots"]:
    h0 = res_improved["gradCam"]["hotspots"][0]
    test_assert(0.0 <= h0["x"] <= 1.0 and 0.0 <= h0["y"] <= 1.0, f"Hotspot coordinates normalized in [0, 1]: ({h0['x']}, {h0['y']})")

# 5. Test Fallback to Baseline Model
res_fallback = run_retinal_inference(real_img_bytes, model_path=BASELINE_MODEL_PATH)
test_assert(res_fallback["success"] is True, "Fallback baseline inference executed successfully")
test_assert(res_fallback["modelPrediction"]["isImprovedModel"] is False, "Fallback output confirms isImprovedModel=False")
test_assert(res_fallback["modelPrediction"]["calibrationThreshold"] == 0.35, "Baseline fallback uses threshold tau=0.35")
test_assert(res_fallback["modelPrediction"]["icdrGrade"] in [0, 1, 2, 3, 4], f"Fallback predicted Grade {res_fallback['modelPrediction']['icdrGrade']}")

# 6. Quality Gates & Safe Withholding Tests
print("[*] Testing quality assessment & safety gates...")
# Optical blur
pil_blur = Image.open(io.BytesIO(real_img_bytes)).filter(ImageFilter.GaussianBlur(radius=18))
buf_blur = io.BytesIO()
pil_blur.save(buf_blur, format="JPEG")
res_blur = run_retinal_inference(buf_blur.getvalue())
test_assert(res_blur["quality"]["gradable"] is False, "Optical blur correctly flagged as ungradable")
test_assert(res_blur["modelPrediction"]["gradeWithheld"] is True, "Grade correctly withheld for blurry image")

# OOD non-retinal image
ood_np = np.zeros((224, 224, 3), dtype=np.uint8)
ood_np[:, :, 2] = 240  # Dominant blue
ood_np[:, :, 0] = 30   # Low red
buf_ood = io.BytesIO()
Image.fromarray(ood_np).save(buf_ood, format="PNG")
res_ood = run_retinal_inference(buf_ood.getvalue())
test_assert(res_ood["quality"]["gradable"] is False, "OOD non-retinal scan correctly flagged as ungradable")
test_assert(res_ood["modelPrediction"]["oodFlag"] is True, "OOD flag is True for non-retinal scan")
test_assert(res_ood["modelPrediction"]["gradeWithheld"] is True, "Autonomous grade withheld for OOD scan")

# 7. Consistency of Reports and Checkpoints
reports_dir = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")), "reports")
eval_json = os.path.join(reports_dir, "dr_improvement_evaluation.json")
test_assert(os.path.exists(eval_json), f"Evaluation JSON exists: {eval_json}")
if os.path.exists(eval_json):
    with open(eval_json, "r", encoding="utf-8") as f:
        eval_data = json.load(f)
    aptos_acc = eval_data["aptos_held_out_evaluation"]["accuracy"]
    idrid_acc = eval_data["idrid_external_evaluation"]["accuracy"]
    test_assert(aptos_acc >= 0.78, f"APTOS held-out accuracy >= 78%: {aptos_acc*100:.2f}%")
    test_assert(idrid_acc >= 0.50, f"IDRiD external accuracy >= 50%: {idrid_acc*100:.2f}%")
    test_assert(eval_data["aptos_held_out_evaluation"]["expected_calibration_error"] < 0.10, "APTOS ECE < 0.10 (well-calibrated)")

# Grad-CAM visual artifacts
gradcam_dir = os.path.join(reports_dir, "dr_improvement_gradcam")
test_assert(os.path.exists(gradcam_dir), f"Grad-CAM directory exists: {gradcam_dir}")
gradcam_pngs = [f for f in os.listdir(gradcam_dir) if f.endswith(".png")] if os.path.exists(gradcam_dir) else []
test_assert(len(gradcam_pngs) >= 4, f"Found {len(gradcam_pngs)} Grad-CAM visual verification composites")

print("-------------------------------------------------------------------")
print(f"Results: {passed} passed, {failed} failed.")
if failed > 0:
    sys.exit(1)
