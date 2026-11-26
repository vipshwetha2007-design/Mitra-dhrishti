#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
IDRiD Multi-Lesion Retinal Segmentation Engine
Model: Enhanced Residual U-Net (models/idrid_unet_lesions_improved.keras)
Fallback: Baseline U-Net (models/idrid_unet_lesions.keras)
Dataset Provenance: Indian Diabetic Retinopathy Image Dataset (IDRiD)

Target DR Lesions:
1. Microaneurysms (MA) - Index 0 - Color: Magenta (#FF00FF)
2. Haemorrhages (HE)   - Index 1 - Color: Crimson Red (#FF2828)
3. Hard Exudates (EX)  - Index 2 - Color: Amber Yellow (#FFE600)
4. Soft Exudates (SE)  - Index 3 - Color: Cyan (#00E6FF)

Note: Optic Disc (OD) is an anatomical landmark, explicitly excluded from DR lesions.
"""

import argparse
import base64
import io
import json
import os
import sys
import time

# Ensure workspace-local Keras home and suppress TF logs
os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
from PIL import Image, ImageOps

import tensorflow as tf
from tensorflow import keras

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
IMPROVED_MODEL_PATH = os.path.join(ROOT_DIR, "models", "idrid_unet_lesions_improved.keras")
BASELINE_MODEL_PATH = os.path.join(ROOT_DIR, "models", "idrid_unet_lesions.keras")
IMPROVED_CONFIG_PATH = os.path.join(ROOT_DIR, "models", "unet_improved_model_config.json")
BASELINE_CONFIG_PATH = os.path.join(ROOT_DIR, "models", "unet_model_config.json")

LESION_SPECS = [
    {
        "index": 0,
        "key": "MA",
        "name": "Microaneurysms",
        "clinical_name": "Microaneurysms (MA)",
        "description": "Focal punctate dilatations of retinal capillary walls; earliest hallmark of NPDR.",
        "color_rgb": (255, 0, 255),
        "color_hex": "#FF00FF",
    },
    {
        "index": 1,
        "key": "HE",
        "name": "Haemorrhages",
        "clinical_name": "Haemorrhages (HE)",
        "description": "Deep intraretinal dot/blot or superficial flame haemorrhages from compromised capillaries.",
        "color_rgb": (255, 40, 40),
        "color_hex": "#FF2828",
    },
    {
        "index": 2,
        "key": "EX",
        "name": "Hard Exudates",
        "clinical_name": "Hard Exudates (EX)",
        "description": "Lipid/lipoprotein transudates extravasated from incompetent vascular walls; DME indicator.",
        "color_rgb": (255, 230, 0),
        "color_hex": "#FFE600",
    },
    {
        "index": 3,
        "key": "SE",
        "name": "Soft Exudates",
        "clinical_name": "Soft Exudates / Cotton Wool Spots (SE)",
        "description": "Axoplasmic stasis in nerve fiber layer secondary to precapillary arteriolar ischemia.",
        "color_rgb": (0, 230, 255),
        "color_hex": "#00E6FF",
    },
]

TARGET_SIZE = (256, 256)
DEFAULT_THRESHOLD = 0.35

_LOADED_UNET = None
_LOADED_CONFIG = None


# Custom metrics & losses required for loading baseline & improved models
def soft_dice_loss(y_true, y_pred, epsilon=1e-6):
    y_true_f = tf.reshape(y_true, [-1, 4])
    y_pred_f = tf.reshape(y_pred, [-1, 4])
    intersection = tf.reduce_sum(y_true_f * y_pred_f, axis=0)
    denominator = tf.reduce_sum(y_true_f + y_pred_f, axis=0)
    dice_per_class = (2.0 * intersection + epsilon) / (denominator + epsilon)
    return 1.0 - tf.reduce_mean(dice_per_class)


def combined_dice_bce_loss(y_true, y_pred):
    bce = keras.losses.binary_crossentropy(y_true, y_pred)
    dice = soft_dice_loss(y_true, y_pred)
    return dice + 0.5 * tf.reduce_mean(bce)


def mean_dice_coef(y_true, y_pred, epsilon=1e-6):
    y_pred_bin = tf.cast(y_pred > 0.5, tf.float32)
    y_true_f = tf.reshape(y_true, [-1, 4])
    y_pred_f = tf.reshape(y_pred_bin, [-1, 4])
    intersection = tf.reduce_sum(y_true_f * y_pred_f, axis=0)
    denominator = tf.reduce_sum(y_true_f + y_pred_f, axis=0)
    dice = (2.0 * intersection + epsilon) / (denominator + epsilon)
    return tf.reduce_mean(dice)


def focal_tversky_loss(y_true, y_pred, alpha=0.75, beta=0.25, gamma=1.0, eps=1e-6):
    y_true_f = tf.cast(y_true, tf.float32)
    y_pred_f = tf.cast(y_pred, tf.float32)
    tp = tf.reduce_sum(y_true_f * y_pred_f, axis=[1, 2])
    fn = tf.reduce_sum(y_true_f * (1.0 - y_pred_f), axis=[1, 2])
    fp = tf.reduce_sum((1.0 - y_true_f) * y_pred_f, axis=[1, 2])
    ti = (tp + eps) / (tp + alpha * fn + beta * fp + eps)
    tversky_loss = 1.0 - ti
    if gamma != 1.0:
        tversky_loss = tf.pow(tversky_loss, 1.0 / gamma)
    class_weights = tf.constant([2.0, 1.5, 1.0, 1.2], dtype=tf.float32)
    return tf.reduce_mean(tversky_loss * class_weights)


def binary_focal_loss(y_true, y_pred, gamma=2.0, alpha=0.75, eps=1e-7):
    y_pred_c = tf.clip_by_value(y_pred, eps, 1.0 - eps)
    p_t = y_true * y_pred_c + (1.0 - y_true) * (1.0 - y_pred_c)
    alpha_t = y_true * alpha + (1.0 - y_true) * (1.0 - alpha)
    focal_weight = alpha_t * tf.pow(1.0 - p_t, gamma)
    loss = -focal_weight * tf.math.log(p_t)
    return tf.reduce_mean(loss)


def improved_combined_loss(y_true, y_pred):
    return focal_tversky_loss(y_true, y_pred) + 0.5 * binary_focal_loss(y_true, y_pred)


def get_unet_model():
    global _LOADED_UNET, _LOADED_CONFIG
    if _LOADED_UNET is None:
        custom_objs = {
            "combined_dice_bce_loss": combined_dice_bce_loss,
            "mean_dice_coef": mean_dice_coef,
            "soft_dice_loss": soft_dice_loss,
            "focal_tversky_loss": focal_tversky_loss,
            "binary_focal_loss": binary_focal_loss,
            "improved_combined_loss": improved_combined_loss,
        }

        # Prefer improved model if available
        if os.path.exists(IMPROVED_MODEL_PATH):
            model_to_load = IMPROVED_MODEL_PATH
            cfg_path = IMPROVED_CONFIG_PATH
        elif os.path.exists(BASELINE_MODEL_PATH):
            model_to_load = BASELINE_MODEL_PATH
            cfg_path = BASELINE_CONFIG_PATH
        else:
            raise FileNotFoundError(f"Neither improved nor baseline U-Net found at {IMPROVED_MODEL_PATH} or {BASELINE_MODEL_PATH}")

        _LOADED_UNET = keras.models.load_model(model_to_load, custom_objects=custom_objs)

        if os.path.exists(cfg_path):
            with open(cfg_path, "r", encoding="utf-8") as f:
                _LOADED_CONFIG = json.load(f)
        else:
            _LOADED_CONFIG = {}

    return _LOADED_UNET, _LOADED_CONFIG


def get_fov_bbox(pil_img):
    """Detects circular fundus aperture boundary box."""
    arr = np.array(pil_img)
    mask = np.mean(arr, axis=2) > 15
    if np.any(mask):
        ymin, ymax = np.where(mask.any(axis=1))[0][[0, -1]]
        xmin, xmax = np.where(mask.any(axis=0))[0][[0, -1]]
        return int(xmin), int(ymin), int(xmax), int(ymax)
    return 0, 0, pil_img.width, pil_img.height


def segment_retinal_lesions(image_input, threshold=DEFAULT_THRESHOLD, alpha=0.45):
    """
    Performs genuine U-Net inference on a retinal fundus image and generates
    per-lesion statistics, binary masks, and transparent colored overlays.

    Args:
        image_input: File path (str), PIL.Image, or Base64 string.
        threshold: Classification probability threshold (float, default 0.35).
        alpha: Transparency alpha for colored lesion overlay (0.0 to 1.0).

    Returns:
        tuple: (result_dict, overlay_pil_image)
    """
    t_start = time.time()

    # 1. Load Image
    if isinstance(image_input, Image.Image):
        pil_img = image_input.convert("RGB")
    elif isinstance(image_input, np.ndarray):
        pil_img = Image.fromarray(image_input.astype(np.uint8)).convert("RGB")
    elif isinstance(image_input, str):
        if image_input.startswith("data:image") or len(image_input) > 500 and not os.path.exists(image_input):
            raw_b64 = image_input.split(",", 1)[-1] if "," in image_input else image_input
            img_data = base64.b64decode(raw_b64)
            pil_img = Image.open(io.BytesIO(img_data)).convert("RGB")
        elif os.path.exists(image_input):
            pil_img = Image.open(image_input).convert("RGB")
        else:
            raise ValueError(f"Invalid image input format or file not found: {image_input[:100]}")
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

    orig_width, orig_height = pil_img.size

    # 2. FOV Detection & Normalization
    xmin, ymin, xmax, ymax = get_fov_bbox(pil_img)
    enhanced_pil = ImageOps.autocontrast(pil_img, cutoff=1)
    cropped_img = enhanced_pil.crop((xmin, ymin, xmax, ymax)).resize(TARGET_SIZE, Image.Resampling.LANCZOS)
    img_array = np.array(cropped_img, dtype=np.float32) / 255.0
    input_batch = np.expand_dims(img_array, axis=0)

    # 3. Model Inference
    model, config = get_unet_model()
    calibrated_th = config.get("calibrated_thresholds", {})

    t_infer_start = time.time()
    preds = model.predict(input_batch, verbose=0)
    inference_ms = (time.time() - t_infer_start) * 1000.0

    pred_masks = preds[0]  # Shape: (256, 256, 4)

    # 4. Generate Lesion Statistics & Visual Overlays
    lesion_stats = []
    overlay_rgb = np.array(cropped_img, dtype=np.float32)
    total_lesion_pixels = 0
    total_retinal_pixels = TARGET_SIZE[0] * TARGET_SIZE[1]
    any_lesion_mask = np.zeros(TARGET_SIZE, dtype=bool)

    operating_thresholds_used = {}

    for spec in LESION_SPECS:
        idx = spec["index"]
        key = spec["key"]

        # Use calibrated threshold if user didn't specify a custom non-default threshold
        if threshold is None or threshold == DEFAULT_THRESHOLD:
            op_th = calibrated_th.get(key, {}).get("optimal_threshold", DEFAULT_THRESHOLD)
        else:
            op_th = threshold
        operating_thresholds_used[key] = op_th

        prob_map = pred_masks[:, :, idx]
        bin_mask = prob_map > op_th
        pixel_count = int(np.sum(bin_mask))
        area_pct = round((pixel_count / total_retinal_pixels) * 100.0, 3)
        detected = pixel_count > 10  # Min cluster threshold

        mean_conf = float(np.mean(prob_map[bin_mask])) if pixel_count > 0 else float(np.max(prob_map))
        max_conf = float(np.max(prob_map))

        lesion_stats.append({
            "key": key,
            "name": spec["name"],
            "clinical_name": spec["clinical_name"],
            "description": spec["description"],
            "color_hex": spec["color_hex"],
            "operating_threshold": round(float(op_th), 2),
            "detected": detected,
            "pixel_count": pixel_count,
            "retinal_surface_pct": area_pct,
            "mean_confidence": round(mean_conf, 4),
            "peak_probability": round(max_conf, 4),
        })

        if detected:
            total_lesion_pixels += pixel_count
            any_lesion_mask = any_lesion_mask | bin_mask

            c_r, c_g, c_b = spec["color_rgb"]
            color_layer = np.zeros_like(overlay_rgb)
            color_layer[:, :, 0] = c_r
            color_layer[:, :, 1] = c_g
            color_layer[:, :, 2] = c_b

            mask_3d = np.repeat(bin_mask[:, :, np.newaxis], 3, axis=-1)
            overlay_rgb = np.where(
                mask_3d,
                (1.0 - alpha) * overlay_rgb + alpha * color_layer,
                overlay_rgb
            )

    # Convert blended overlay back to uint8 image
    overlay_uint8 = np.clip(overlay_rgb, 0, 255).astype(np.uint8)
    overlay_pil = Image.fromarray(overlay_uint8)

    # Encode to Base64 PNG
    buf = io.BytesIO()
    overlay_pil.save(buf, format="PNG")
    overlay_b64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

    total_time_ms = (time.time() - t_start) * 1000.0

    # Risk level estimation based on segmented lesions
    has_ma = lesion_stats[0]["detected"]
    has_he = lesion_stats[1]["detected"]
    has_ex = lesion_stats[2]["detected"]
    has_se = lesion_stats[3]["detected"]

    active_lesions = sum([has_ma, has_he, has_ex, has_se])

    if has_ex and (has_he or has_ma):
        dr_lesion_stage = "High Risk / Referable DR (Multiple Microvascular Lesion Classes)"
    elif has_he or has_se:
        dr_lesion_stage = "Moderate Risk NPDR (Haemorrhages or Soft Exudates Identified)"
    elif has_ma:
        dr_lesion_stage = "Mild NPDR / Capillary Dilatations (Microaneurysms Only)"
    elif active_lesions > 0:
        dr_lesion_stage = "Indeterminate Microvascular Lesion Activity"
    else:
        dr_lesion_stage = "No Detectable Microvascular Lesions in Current FOV"

    result = {
        "status": "success",
        "model_name": config.get("model_name", "Mritidhristi-IDRiD-UNet-Lesions-Improved"),
        "model_architecture": config.get("architecture", "Enhanced Residual Convolutional U-Net with Skip Connections"),
        "provenance": "Indian Diabetic Retinopathy Image Dataset (IDRiD)",
        "operating_thresholds": operating_thresholds_used,
        "input_original_dimensions": [orig_width, orig_height],
        "fov_crop_bbox": [xmin, ymin, xmax, ymax],
        "processed_dimensions": list(TARGET_SIZE),
        "inference_latency_ms": round(inference_ms, 2),
        "total_latency_ms": round(total_time_ms, 2),
        "total_lesion_pixel_count": total_lesion_pixels,
        "overall_lesion_coverage_pct": round((total_lesion_pixels / total_retinal_pixels) * 100.0, 3),
        "clinical_assessment": dr_lesion_stage,
        "lesions": lesion_stats,
        "overlay_base64": overlay_b64,
    }

    return result, overlay_pil


def main():
    parser = argparse.ArgumentParser(description="MITRA DRISHTI IDRiD Lesion Segmentation Engine")
    parser.add_argument("--image", type=str, help="Path to retinal fundus image or base64 text file")
    parser.add_argument("--stdin", action="store_true", help="Read image path, data URL, or base64 directly from stdin")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help="Binary threshold (default: 0.35)")
    parser.add_argument("--alpha", type=float, default=0.45, help="Overlay blend opacity (default: 0.45)")
    parser.add_argument("--save-overlay", type=str, default=None, help="Output path to save overlay PNG image")
    parser.add_argument("--json-out", type=str, default=None, help="Output path to save JSON results")
    args = parser.parse_args()

    try:
        if args.stdin:
            image_input = sys.stdin.read().strip()
        elif args.image:
            if os.path.exists(args.image) and (args.image.endswith(".txt") or args.image.endswith(".b64")):
                with open(args.image, "r", encoding="utf-8") as f:
                    image_input = f.read().strip()
            else:
                image_input = args.image
        else:
            parser.error("Either --image or --stdin must be provided.")

        result, overlay_pil = segment_retinal_lesions(image_input, threshold=args.threshold, alpha=args.alpha)

        if args.save_overlay:
            os.makedirs(os.path.dirname(os.path.abspath(args.save_overlay)), exist_ok=True)
            overlay_pil.save(args.save_overlay)

        if args.json_out:
            os.makedirs(os.path.dirname(os.path.abspath(args.json_out)), exist_ok=True)
            with open(args.json_out, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)

        # Print structured JSON output
        print(json.dumps(result, indent=2))

    except Exception as e:
        err_res = {"status": "error", "error": str(e)}
        print(json.dumps(err_res, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
