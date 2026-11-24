"""
Verification script for Phase 7 (Grad-CAM) and Phase 8 (Reliability & Uncertainty).
Tests:
1. Genuine fundus scan inference (checks ICDR prediction, Grad-CAM heatmap, hotspots, MC-Dropout variance, entropy).
2. Optical blur rejection (Laplacian focus check).
3. Out-of-Distribution rejection (Chromatic ratio check).
"""

import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
os.environ["KERAS_HOME"] = os.path.abspath(".keras")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import json
import numpy as np
import pyarrow as pa
from PIL import Image, ImageDraw, ImageFilter
import io

from scripts.train_cnn import DEFAULT_ARROW_PATH
from scripts.retinal_inference_engine import run_retinal_inference

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
print(" MITRA DRISHTI PHASE 7 & 8: RETINAL INFERENCE & GRAD-CAM VERIFICATION")
print("===================================================================")

# 1. Load a real clinical fundus scan
if os.path.exists(DEFAULT_ARROW_PATH):
    print(f"[*] Loading genuine clinical scan from Arrow store: {DEFAULT_ARROW_PATH}")
    with pa.OSFile(DEFAULT_ARROW_PATH, "rb") as f:
        reader = pa.ipc.open_stream(f)
        batch = reader.read_next_batch()
        img_col = batch.column(0)
        bytes_field = img_col.field(0)
        real_img_bytes = bytes_field[0].as_buffer().to_pybytes()
        real_label = 0
else:
    print("[*] Creating realistic synthetic clinical fundus image...")
    # Generate realistic fundus pattern with red background, optic disc, and vessels
    img = Image.new("RGB", (384, 384), color=(180, 50, 20))
    draw = ImageDraw.Draw(img)
    # Optic disc
    draw.ellipse((80, 150, 150, 220), fill=(255, 220, 160))
    # Macula
    draw.ellipse((220, 170, 260, 210), fill=(120, 30, 10))
    # Retinal vessels
    draw.line([(115, 185), (50, 100), (40, 50)], fill=(120, 20, 10), width=4)
    draw.line([(115, 185), (200, 120), (320, 90)], fill=(120, 20, 10), width=4)
    draw.line([(115, 185), (190, 250), (330, 280)], fill=(120, 20, 10), width=4)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    real_img_bytes = buf.getvalue()
    real_label = 0

print(f"[*] Running inference on retinal scan...")
res_real = run_retinal_inference(real_img_bytes)

test_assert(res_real["success"] is True, "Inference executed successfully on fundus scan")
test_assert(res_real["quality"]["gradable"] is True, f"Image quality assessment passed (Sharpness: {res_real['quality']['sharpnessScore']})")
test_assert(res_real["modelPrediction"]["icdrGrade"] in [0, 1, 2, 3, 4], f"Predicted ICDR grade in [0..4]: Grade {res_real['modelPrediction']['icdrGrade']}")
test_assert(res_real["modelPrediction"]["confidence"] > 0.0, f"Calibrated confidence reported: {res_real['modelPrediction']['confidence']}")
test_assert("predictiveEntropy" in res_real["modelPrediction"], f"Predictive entropy computed: {res_real['modelPrediction']['predictiveEntropy']} bits")
test_assert("monteCarloVariance" in res_real["modelPrediction"], f"MC-Dropout epistemic variance computed: {res_real['modelPrediction']['monteCarloVariance']}")
test_assert("pReferable" in res_real["modelPrediction"], f"Calibrated referable probability reported: {res_real['modelPrediction']['pReferable']}")
test_assert(isinstance(res_real["modelPrediction"]["isReferable"], bool), f"Referable triage classification active: isReferable={res_real['modelPrediction']['isReferable']}")
test_assert("triageRecommendation" in res_real["modelPrediction"], f"Actionable triage recommendation: {res_real['modelPrediction']['triageRecommendation']}")

# Verify Temperature Scaling: probabilities sum to 1.0
cal_probs = res_real["modelPrediction"]["calibratedProbabilities"]
test_assert(abs(sum(cal_probs) - 1.0) < 0.01, f"Calibrated probabilities sum to 1.0: {sum(cal_probs):.4f}")

# Verify Grad-CAM target layer
from scripts.retinal_inference_engine import get_inference_models
_, base_ext, head_mod = get_inference_models()
test_assert(base_ext.layers[-1].name == "out_relu", f"Grad-CAM targets MobileNetV2 'out_relu' layer: {base_ext.layers[-1].name}")

test_assert(res_real["gradCam"]["available"] is True, "Grad-CAM heatmap available")
test_assert(res_real["gradCam"]["heatmapDataUrl"].startswith("data:image/png;base64,"), "Grad-CAM overlay synthesized as valid base64 PNG")
test_assert(len(res_real["gradCam"]["hotspots"]) > 0, f"Grad-CAM hotspots identified ({len(res_real['gradCam']['hotspots'])} hotspots)")
if res_real["gradCam"]["hotspots"]:
    h0 = res_real["gradCam"]["hotspots"][0]
    test_assert(0.0 <= h0["x"] <= 1.0 and 0.0 <= h0["y"] <= 1.0, f"Hotspot coordinates normalized: x={h0['x']}, y={h0['y']}")

# 2. Test Optical Blur Rejection
print("[*] Testing with severely blurred fundus image (Cataract / Motion simulation)...")
pil_blur = Image.open(io.BytesIO(real_img_bytes)).filter(ImageFilter.GaussianBlur(radius=16))
buf = io.BytesIO()
pil_blur.save(buf, format="JPEG")
res_blur = run_retinal_inference(buf.getvalue())

test_assert(res_blur["quality"]["gradable"] is False, "Severe optical blur correctly flagged as ungradable")
test_assert("Blur" in str(res_blur["quality"]["rejectionReason"]), f"Rejection reason captures blur: {res_blur['quality']['rejectionReason']}")
test_assert(res_blur["modelPrediction"]["gradeWithheld"] is True, "Autonomous grade correctly withheld for ungradable scan")

# 3. Test Out-of-Distribution (OOD) Non-Retinal Rejection
print("[*] Testing with Out-of-Distribution synthetic non-retinal image (blue sky / landscape profile)...")
ood_np = np.zeros((224, 224, 3), dtype=np.uint8)
ood_np[:, :, 2] = 230  # High blue
ood_np[:, :, 0] = 50   # Low red
buf_ood = io.BytesIO()
Image.fromarray(ood_np).save(buf_ood, format="PNG")
res_ood = run_retinal_inference(buf_ood.getvalue())

test_assert(res_ood["quality"]["gradable"] is False, "Non-retinal chromatic distribution correctly flagged as ungradable")
test_assert(res_ood["modelPrediction"]["oodFlag"] is True, "OOD flag is True for non-retinal image")
test_assert(res_ood["modelPrediction"]["gradeWithheld"] is True, "Autonomous grade withheld for OOD scan")

print("-------------------------------------------------------------------")
print(f"Results: {passed} passed, {failed} failed.")
if failed > 0:
    exit(1)
