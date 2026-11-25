#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Diabetic Macular Edema (DME) Risk Inference Engine
Model: MobileNetV2 Transfer Learning (models/dme_classifier.keras)
Dataset Provenance: Indian Diabetic Retinopathy Image Dataset (IDRiD)

Categories:
0: No DME Risk (No apparent hard exudates within macula)
1: Moderate DME Risk (Hard exudates present, > 1 disc diameter from fovea)
2: High DME Risk / CSME (Hard exudates present within 1 disc diameter of fovea)
"""

import argparse
import base64
import io
import json
import os
import sys
import time
import numpy as np
from PIL import Image

# Force workspace-local Keras home and suppress TF logs
os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
from tensorflow import keras

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH = os.path.join(ROOT_DIR, "models", "dme_classifier.keras")

DME_CLASSES = {
    0: {
        "name": "No Apparent DME Risk Features",
        "severity": "Low Risk",
        "description": "No apparent hard exudates observed in macular region per fundus image.",
        "triage": "Routine diabetic eye screening per clinical guidelines",
        "urgency": "Routine",
    },
    1: {
        "name": "Moderate DME Risk Category",
        "severity": "Moderate Risk (Non-Center Involving Features)",
        "description": "Hard exudates observed within macular boundary, located > 1 disc diameter from foveal center per IDRiD criteria.",
        "triage": "Comprehensive ophthalmological evaluation and baseline macular OCT assessment",
        "urgency": "Prompt",
    },
    2: {
        "name": "High DME Risk Category (Hard Exudates within 1 Disc Diameter of Foveal Center)",
        "severity": "High Risk Category (Center-Adjacent Exudates)",
        "description": "Hard exudates observed within 1 disc diameter of the foveal center according to IDRiD grading criteria. Requires comprehensive clinical examination to assess macular status.",
        "triage": "Prompt ophthalmologist assessment and Optical Coherence Tomography (OCT) confirmation",
        "urgency": "Urgent Referral for Comprehensive Examination",
    },
}

TARGET_SIZE = (224, 224)
_LOADED_DME_MODEL = None


def get_dme_model():
    global _LOADED_DME_MODEL
    if _LOADED_DME_MODEL is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Trained DME model not found at {MODEL_PATH}")
        _LOADED_DME_MODEL = keras.models.load_model(MODEL_PATH)
    return _LOADED_DME_MODEL


def preprocess_image_input(image_input):
    if isinstance(image_input, Image.Image):
        pil_img = image_input.convert("RGB")
    elif isinstance(image_input, str):
        if image_input.startswith("data:image") or (len(image_input) > 500 and not os.path.exists(image_input)):
            raw_b64 = image_input.split(",", 1)[-1] if "," in image_input else image_input
            img_data = base64.b64decode(raw_b64)
            pil_img = Image.open(io.BytesIO(img_data)).convert("RGB")
        else:
            if not os.path.exists(image_input):
                raise FileNotFoundError(f"Input image file not found: {image_input}")
            pil_img = Image.open(image_input).convert("RGB")
    else:
        raise ValueError("Unsupported image input format.")

    w, h = pil_img.size
    side = min(w, h)
    start_x = (w - side) // 2
    start_y = (h - side) // 2
    cropped = pil_img.crop((start_x, start_y, start_x + side, start_y + side))
    resized = cropped.resize(TARGET_SIZE, Image.Resampling.BILINEAR)
    arr = np.array(resized, dtype=np.float32)
    norm = (arr / 127.5) - 1.0
    return pil_img, np.expand_dims(norm, axis=0)


def predict_dme_risk(image_input):
    """
    Performs genuine deep learning inference on a retinal image to classify DME risk.
    """
    t_start = time.time()
    pil_img, tensor = preprocess_image_input(image_input)

    model = get_dme_model()
    t_inf_start = time.time()
    probs = model.predict(tensor, verbose=0)[0]
    inference_ms = (time.time() - t_inf_start) * 1000.0

    pred_idx = int(np.argmax(probs))
    conf = float(probs[pred_idx])

    meta = DME_CLASSES[pred_idx]
    is_csme = bool(pred_idx == 2 or probs[2] >= 0.45)

    total_latency_ms = (time.time() - t_start) * 1000.0

    result = {
        "status": "success",
        "model_name": "Mritidhristi-IDRiD-DME-Classifier",
        "model_architecture": "MobileNetV2 Transfer Learning with GlobalAveragePooling and Dense Head",
        "dataset_provenance": "Indian Diabetic Retinopathy Image Dataset (IDRiD)",
        "predicted_grade": pred_idx,
        "category_name": meta["name"],
        "severity_level": meta["severity"],
        "confidence": round(conf, 4),
        "class_probabilities": {
            "grade_0_no_dme": round(float(probs[0]), 4),
            "grade_1_moderate_dme": round(float(probs[1]), 4),
            "grade_2_high_risk_csme": round(float(probs[2]), 4),
        },
        "is_csme_high_risk": is_csme,
        "clinical_findings": meta["description"],
        "triage_recommendation": meta["triage"],
        "urgency": meta["urgency"],
        "inference_latency_ms": round(inference_ms, 2),
        "total_latency_ms": round(total_latency_ms, 2),
        "clinical_disclaimer": (
            "Model prediction for clinical risk stratification only. Slit-lamp biomicroscopy "
            "and Optical Coherence Tomography (OCT) are mandatory for definitive DME diagnosis."
        ),
    }
    return result


def main():
    parser = argparse.ArgumentParser(description="MITRA DRISHTI IDRiD DME Risk Inference Engine")
    parser.add_argument("--image", type=str, help="Path to input fundus image")
    parser.add_argument("--stdin", action="store_true", help="Read image from standard input")
    parser.add_argument("--output", type=str, help="Optional path to write JSON output")
    args = parser.parse_args()

    try:
        if args.stdin:
            image_input = sys.stdin.read().strip()
        elif args.image:
            image_input = args.image
        else:
            parser.error("Either --image or --stdin must be provided.")

        result = predict_dme_risk(image_input)
        json_out = json.dumps(result, indent=2)

        if args.output:
            os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(json_out)
            print(f"[+] Output written to {args.output}")

        print(json_out)

    except Exception as e:
        err = {"status": "error", "error": str(e)}
        print(json.dumps(err, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
