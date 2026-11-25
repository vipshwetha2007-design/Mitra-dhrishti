#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Component 4: Optic Disc & Fovea Centre Localisation Inference Engine
Model: MobileNetV2 with CoordConv Spatial Feature Embedding (models/optic_disc_fovea_localizer.keras)
Dataset Provenance: Indian Diabetic Retinopathy Image Dataset (IDRiD) Component C: Localization
"""

import os
import sys
import io
import time
import json
import base64
import argparse
import numpy as np
from PIL import Image

os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
from tensorflow import keras

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL_PATH = os.path.join(ROOT_DIR, "models", "optic_disc_fovea_localizer.keras")
TARGET_SIZE = (224, 224)
ORIG_W = 4288.0
ORIG_H = 2848.0
SCALE_TENSOR = tf.constant([ORIG_W, ORIG_H], dtype=tf.float32)

_LOADED_LOCALIZER_MODEL = None


def add_coord_channels(x):
    shape = tf.shape(x)
    b, h, w = shape[0], shape[1], shape[2]
    x_range = tf.linspace(-1.0, 1.0, w)
    y_range = tf.linspace(-1.0, 1.0, h)
    xx, yy = tf.meshgrid(x_range, y_range)
    xx = tf.tile(tf.expand_dims(tf.expand_dims(xx, 0), -1), [b, 1, 1, 1])
    yy = tf.tile(tf.expand_dims(tf.expand_dims(yy, 0), -1), [b, 1, 1, 1])
    return tf.concat([x, xx, yy], axis=-1)


def pixel_euclidean_loss(y_true, y_pred):
    diff = (y_true - y_pred) * SCALE_TENSOR
    return tf.reduce_mean(tf.sqrt(tf.reduce_sum(tf.square(diff), axis=-1) + 1e-7))


def get_localizer_model():
    global _LOADED_LOCALIZER_MODEL
    if _LOADED_LOCALIZER_MODEL is None:
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Trained landmark localizer model not found at {MODEL_PATH}")
        _LOADED_LOCALIZER_MODEL = keras.models.load_model(
            MODEL_PATH,
            custom_objects={"add_coord_channels": add_coord_channels, "pixel_euclidean_loss": pixel_euclidean_loss}
        )
    return _LOADED_LOCALIZER_MODEL


def preprocess_image_input(image_input):
    """Parses PIL Image, filepath, or base64 data URL and scales to [-1, 1]."""
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

    orig_width, orig_height = pil_img.size
    resized = pil_img.resize(TARGET_SIZE, Image.Resampling.BILINEAR)
    arr = np.array(resized, dtype=np.float32)
    norm = (arr / 127.5) - 1.0
    tensor = np.expand_dims(norm, axis=0)
    return pil_img, tensor, orig_width, orig_height


def predict_landmarks(image_input):
    """
    Performs genuine deep-learning inference to locate the Optic Disc and Fovea centers.
    Returns pixel coordinates scaled to the input image dimensions as well as normalized coordinates.
    """
    t_start = time.time()
    pil_img, tensor, orig_w, orig_h = preprocess_image_input(image_input)

    model = get_localizer_model()
    t_inf_start = time.time()
    preds = model.predict(tensor, verbose=0)
    inference_ms = (time.time() - t_inf_start) * 1000.0

    # Predictions are normalized [0, 1]
    od_norm = preds[0][0] # [x, y]
    fov_norm = preds[1][0] # [x, y]

    od_norm_x, od_norm_y = float(od_norm[0]), float(od_norm[1])
    fov_norm_x, fov_norm_y = float(fov_norm[0]), float(fov_norm[1])

    # Scale to original input image dimensions
    od_px_x = round(od_norm_x * orig_w, 1)
    od_px_y = round(od_norm_y * orig_h, 1)

    fov_px_x = round(fov_norm_x * orig_w, 1)
    fov_px_y = round(fov_norm_y * orig_h, 1)

    # Calculate anatomical Euclidean distance between landmarks
    distance_px = round(float(np.sqrt((od_px_x - fov_px_x)**2 + (od_px_y - fov_px_y)**2)), 1)
    distance_norm = round(float(np.sqrt((od_norm_x - fov_norm_x)**2 + (od_norm_y - fov_norm_y)**2)), 4)

    # Anatomical plausibility check:
    # On 45-50 degree fundus photographs, the OD-to-fovea distance typically occupies ~28-35% of horizontal canvas (~0.25 - 0.40 normalized)
    is_anatomically_plausible = bool(0.20 <= distance_norm <= 0.45)
    relative_eye_side = "Right Eye (OD)" if od_px_x > fov_px_x else "Left Eye (OS)"

    total_latency_ms = (time.time() - t_start) * 1000.0

    result = {
        "status": "success",
        "model_name": "Mritidhristi-IDRiD-Landmark-Localizer",
        "model_architecture": "MobileNetV2 with CoordConv Spatial Embedding and Dual-Head Regression",
        "dataset_provenance": "Indian Diabetic Retinopathy Image Dataset (IDRiD) Component C",
        "input_dimensions": {
            "width": orig_w,
            "height": orig_h
        },
        "landmarks": {
            "optic_disc": {
                "name": "Optic Disc (OD) Centre",
                "pixel_coordinates": {
                    "x": od_px_x,
                    "y": od_px_y
                },
                "normalized_coordinates": {
                    "x": round(od_norm_x, 4),
                    "y": round(od_norm_y, 4)
                },
                "anatomical_description": "Physiological blind spot and nerve fiber exit point on nasal retina"
            },
            "fovea": {
                "name": "Fovea Centralis Centre",
                "pixel_coordinates": {
                    "x": fov_px_x,
                    "y": fov_px_y
                },
                "normalized_coordinates": {
                    "x": round(fov_norm_x, 4),
                    "y": round(fov_norm_y, 4)
                },
                "anatomical_description": "Central visual axis and high-acuity photoreceptor center within macula"
            }
        },
        "inter_landmark_metrics": {
            "euclidean_distance_px": distance_px,
            "normalized_distance": distance_norm,
            "anatomical_plausibility": is_anatomically_plausible,
            "inferred_eye_laterality": relative_eye_side
        },
        "inference_latency_ms": round(inference_ms, 2),
        "total_latency_ms": round(total_latency_ms, 2),
        "clinical_disclaimer": (
            "Model prediction for computer vision landmark orientation and retinal spatial registration only. "
            "Slit-lamp biomicroscopy and optical coherence tomography (OCT) are mandatory for clinical diagnosis. "
            "Do not use these coordinates alone to diagnose glaucoma, papilledema, or maculopathy."
        )
    }
    return result


def main():
    parser = argparse.ArgumentParser(description="MITRA DRISHTI Optic Disc & Fovea Localisation Inference Engine")
    parser.add_argument("--image", type=str, help="Path to input retinal fundus image")
    parser.add_argument("--stdin", action="store_true", help="Read image data URL from stdin")
    parser.add_argument("--output", type=str, help="Optional output JSON filepath")

    args = parser.parse_args()

    try:
        if args.stdin:
            img_input = sys.stdin.read().strip()
            if not img_input:
                raise ValueError("Empty image input received via stdin.")
        elif args.image:
            img_input = args.image
        else:
            parser.print_help()
            sys.exit(1)

        result = predict_landmarks(img_input)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
            print(f"[+] Output written to {args.output}")
        else:
            print(json.dumps(result, indent=2))

    except Exception as e:
        err_res = {
            "status": "error",
            "error_type": type(e).__name__,
            "error_message": str(e),
            "model_name": "Mritidhristi-IDRiD-Landmark-Localizer"
        }
        print(json.dumps(err_res, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
