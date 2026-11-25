#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Component 4: Optic Disc & Fovea Centre Deep-Learning Localisation Model
Architecture: Pre-trained MobileNetV2 with CoordConv Spatial Embedding and Dual-Head Regression
Dataset Provenance: Indian Diabetic Retinopathy Image Dataset (IDRiD) Component C: Localization
"""

import os
import sys
import time
import json
import hashlib
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw, ImageFont
from sklearn.model_selection import train_test_split

os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

SEED = 42
TARGET_SIZE = (224, 224)
ORIG_W = 4288.0
ORIG_H = 2848.0
SCALE_TENSOR = tf.constant([ORIG_W, ORIG_H], dtype=tf.float32)

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(ROOT_DIR, "models")
CHECKPOINTS_DIR = os.path.join(MODELS_DIR, "checkpoints")
REPORTS_DIR = os.path.join(ROOT_DIR, "reports")
OVERLAYS_DIR = os.path.join(REPORTS_DIR, "optic_disc_fovea_test_overlays")

LOC_BASE = os.path.join(ROOT_DIR, "C. Localization", "C. Localization")
TRAIN_IMG_DIR = os.path.join(LOC_BASE, "1. Original Images", "a. Training Set")
TEST_IMG_DIR = os.path.join(LOC_BASE, "1. Original Images", "b. Testing Set")

OD_TRAIN_CSV = os.path.join(LOC_BASE, "2. Groundtruths", "1. Optic Disc Center Location", "a. IDRiD_OD_Center_Training Set_Markups.csv")
OD_TEST_CSV = os.path.join(LOC_BASE, "2. Groundtruths", "1. Optic Disc Center Location", "b. IDRiD_OD_Center_Testing Set_Markups.csv")

FOV_TRAIN_CSV = os.path.join(LOC_BASE, "2. Groundtruths", "2. Fovea Center Location", "IDRiD_Fovea_Center_Training Set_Markups.csv")
FOV_TEST_CSV = os.path.join(LOC_BASE, "2. Groundtruths", "2. Fovea Center Location", "IDRiD_Fovea_Center_Testing Set_Markups.csv")


def set_seed(seed=SEED):
    import random
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def add_coord_channels(x):
    """
    Appends normalized 2D coordinate meshgrids [-1, 1] to feature maps (CoordConv).
    Allows translational convolutional kernels to reason about absolute spatial canvas locations.
    """
    shape = tf.shape(x)
    b, h, w = shape[0], shape[1], shape[2]
    x_range = tf.linspace(-1.0, 1.0, w)
    y_range = tf.linspace(-1.0, 1.0, h)
    xx, yy = tf.meshgrid(x_range, y_range)
    xx = tf.tile(tf.expand_dims(tf.expand_dims(xx, 0), -1), [b, 1, 1, 1])
    yy = tf.tile(tf.expand_dims(tf.expand_dims(yy, 0), -1), [b, 1, 1, 1])
    return tf.concat([x, xx, yy], axis=-1)


def pixel_euclidean_loss(y_true, y_pred):
    """Euclidean distance loss computed directly in original full-resolution image pixel space."""
    diff = (y_true - y_pred) * SCALE_TENSOR
    return tf.reduce_mean(tf.sqrt(tf.reduce_sum(tf.square(diff), axis=-1) + 1e-7))


def build_localizer_model(input_shape=(TARGET_SIZE[0], TARGET_SIZE[1], 3)):
    """
    Constructs a dual-head keypoint localisation network.
    Uses pre-trained MobileNetV2 with CoordConv spatial feature enrichment and separate
    dedicated prediction heads for Optic Disc and Fovea.
    """
    inputs = layers.Input(shape=input_shape, name="retinal_input")
    base_model = keras.applications.MobileNetV2(
        input_tensor=inputs,
        include_top=False,
        weights="imagenet"
    )
    
    # Freeze bottom feature layers to retain edge and texture features; fine-tune top 40 layers
    for layer in base_model.layers[:-40]:
        layer.trainable = False
    for layer in base_model.layers[-40:]:
        layer.trainable = True

    feat = base_model.output # (B, 7, 7, 1280)
    feat_coords = layers.Lambda(add_coord_channels, name="coord_conv_concat")(feat) # (B, 7, 7, 1282)

    conv_spatial = layers.Conv2D(64, (3, 3), padding="same", activation="relu", name="spatial_conv")(feat_coords)
    flat_spatial = layers.Flatten(name="spatial_flatten")(conv_spatial)

    shared = layers.Dense(256, activation="relu", name="shared_dense")(flat_spatial)
    shared = layers.BatchNormalization(name="shared_bn")(shared)
    shared = layers.Dropout(0.2, name="shared_dropout")(shared)

    # Optic Disc Center Head
    od_h = layers.Dense(128, activation="relu", name="od_dense")(shared)
    od_h = layers.Dropout(0.2, name="od_dropout")(od_h)
    out_od = layers.Dense(2, activation="sigmoid", name="optic_disc_center")(od_h)

    # Fovea Center Head
    fov_h = layers.Dense(128, activation="relu", name="fov_dense")(shared)
    fov_h = layers.Dropout(0.2, name="fov_dropout")(fov_h)
    out_fov = layers.Dense(2, activation="sigmoid", name="fovea_center")(fov_h)

    model = keras.Model(inputs=inputs, outputs=[out_od, out_fov], name="Mritidhristi_IDRiD_Landmark_Localizer")
    return model


def load_dataset(csv_od, csv_fov, img_dir):
    """Loads images and ground-truth coordinates normalized to [0, 1]."""
    df_od = pd.read_csv(csv_od).dropna(subset=['Image No'])
    df_od = df_od[df_od['Image No'].astype(str).str.startswith('IDRiD')].sort_values('Image No').reset_index(drop=True)

    df_fov = pd.read_csv(csv_fov).dropna(subset=['Image No'])
    df_fov = df_fov[df_fov['Image No'].astype(str).str.startswith('IDRiD')].sort_values('Image No').reset_index(drop=True)

    images = []
    od_coords = []
    fov_coords = []
    ids = []

    print(f"[*] Loading dataset from {img_dir} ({len(df_od)} images)...")
    t0 = time.time()
    for _, row in df_od.iterrows():
        name = str(row['Image No']).strip()
        img_p = os.path.join(img_dir, f"{name}.jpg")
        if not os.path.exists(img_p):
            raise FileNotFoundError(f"Image not found: {img_p}")

        with Image.open(img_p) as img:
            resized = img.resize(TARGET_SIZE, Image.Resampling.BILINEAR)
            arr = np.array(resized.convert("RGB"), dtype=np.float32)
            # MobileNetV2 normalization: [-1, 1]
            norm_img = (arr / 127.5) - 1.0
            images.append(norm_img)

        od_x = float(row['X- Coordinate']) / ORIG_W
        od_y = float(row['Y - Coordinate']) / ORIG_H
        od_coords.append([od_x, od_y])

        fov_row = df_fov[df_fov['Image No'] == name].iloc[0]
        fov_x = float(fov_row['X- Coordinate']) / ORIG_W
        fov_y = float(fov_row['Y - Coordinate']) / ORIG_H
        fov_coords.append([fov_x, fov_y])
        ids.append(name)

    print(f"[+] Loaded {len(images)} scans in {time.time() - t0:.1f}s")
    return np.array(images, dtype=np.float32), np.array(od_coords, dtype=np.float32), np.array(fov_coords, dtype=np.float32), ids


def augment_training_set(images, od_coords, fov_coords):
    """
    Applies synchronized geometric augmentations (horizontal & vertical flips)
    with strict analytical coordinate transformations.
    """
    aug_X = []
    aug_od = []
    aug_fov = []

    for img, od, fov in zip(images, od_coords, fov_coords):
        # 1. Original
        aug_X.append(img)
        aug_od.append(od)
        aug_fov.append(fov)

        # 2. Horizontal Flip: x' = 1 - x, y' = y
        h_img = np.fliplr(img)
        h_od = [1.0 - od[0], od[1]]
        h_fov = [1.0 - fov[0], fov[1]]
        aug_X.append(h_img)
        aug_od.append(h_od)
        aug_fov.append(h_fov)

        # 3. Vertical Flip: x' = x, y' = 1 - y
        v_img = np.flipud(img)
        v_od = [od[0], 1.0 - od[1]]
        v_fov = [fov[0], 1.0 - fov[1]]
        aug_X.append(v_img)
        aug_od.append(v_od)
        aug_fov.append(v_fov)

        # 4. Horizontal + Vertical Flip
        hv_img = np.flipud(h_img)
        hv_od = [1.0 - od[0], 1.0 - od[1]]
        hv_fov = [1.0 - fov[0], 1.0 - fov[1]]
        aug_X.append(hv_img)
        aug_od.append(hv_od)
        aug_fov.append(hv_fov)

    return np.array(aug_X, dtype=np.float32), np.array(aug_od, dtype=np.float32), np.array(aug_fov, dtype=np.float32)


def train_localizer(epochs=15, batch_size=16, lr=5e-4):
    set_seed(SEED)
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(OVERLAYS_DIR, exist_ok=True)

    print("===================================================================")
    print(" MITRA DRISHTI: OPTIC DISC & FOVEA LOCALISATION MODEL TRAINING")
    print("===================================================================")

    # 1. Load official 413 training scans
    X_all, Y_od_all, Y_fov_all, train_ids = load_dataset(OD_TRAIN_CSV, FOV_TRAIN_CSV, TRAIN_IMG_DIR)

    # 2. Fixed seed 80/20 train/validation split
    idx_tr, idx_val = train_test_split(np.arange(len(X_all)), test_size=0.20, random_state=SEED)
    X_tr_raw = X_all[idx_tr]
    Y_od_tr_raw = Y_od_all[idx_tr]
    Y_fov_tr_raw = Y_fov_all[idx_tr]

    X_val = X_all[idx_val]
    Y_od_val = Y_od_all[idx_val]
    Y_fov_val = Y_fov_all[idx_val]
    val_ids = [train_ids[i] for i in idx_val]

    print(f"[*] Raw Training set: {len(X_tr_raw)} scans | Validation set: {len(X_val)} scans (unaugmented)")

    # 3. Synchronized Data Augmentation on Training Set ONLY
    X_train, Y_od_train, Y_fov_train = augment_training_set(X_tr_raw, Y_od_tr_raw, Y_fov_tr_raw)
    print(f"[*] Augmented Training set: {len(X_train)} samples (4x via synchronized flips)")

    # 4. Build Model
    model = build_localizer_model(input_shape=(TARGET_SIZE[0], TARGET_SIZE[1], 3))
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=lr),
        loss={"optic_disc_center": pixel_euclidean_loss, "fovea_center": pixel_euclidean_loss},
        metrics={"optic_disc_center": pixel_euclidean_loss, "fovea_center": pixel_euclidean_loss}
    )
    model.summary()

    checkpoint_path = os.path.join(CHECKPOINTS_DIR, "best_optic_disc_fovea_localizer.keras")
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            filepath=checkpoint_path,
            monitor="val_loss",
            save_best_only=True,
            mode="min",
            verbose=1
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-5,
            verbose=1
        ),
        keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=5,
            restore_best_weights=True,
            verbose=1
        )
    ]

    # 5. Train Model
    t_start = time.time()
    print(f"[*] Starting model training for {epochs} epochs (Batch size: {batch_size})...")
    history = model.fit(
        X_train,
        {"optic_disc_center": Y_od_train, "fovea_center": Y_fov_train},
        validation_data=(X_val, {"optic_disc_center": Y_od_val, "fovea_center": Y_fov_val}),
        batch_size=batch_size,
        epochs=epochs,
        callbacks=callbacks,
        verbose=1
    )
    duration = time.time() - t_start
    print(f"[+] Localizer training completed in {duration:.1f}s ({duration/60:.2f} mins).")

    # 6. Save Final Model Artifacts
    final_model_path = os.path.join(MODELS_DIR, "optic_disc_fovea_localizer.keras")
    model.save(final_model_path)

    with open(final_model_path, "rb") as f:
        model_sha256 = hashlib.sha256(f.read()).hexdigest()

    history_dict = {k: [float(v) for v in vals] for k, vals in history.history.items()}
    history_dict["training_duration_seconds"] = round(duration, 2)
    history_dict["epochs_completed"] = len(history.history["loss"])
    with open(os.path.join(MODELS_DIR, "optic_disc_fovea_training_history.json"), "w", encoding="utf-8") as f:
        json.dump(history_dict, f, indent=2)

    config = {
        "model_name": "Mritidhristi-IDRiD-Landmark-Localizer",
        "architecture": "MobileNetV2 with CoordConv Spatial Embedding and Dual-Head Regression",
        "input_shape": list(TARGET_SIZE) + [3],
        "original_canvas_size": [int(ORIG_W), int(ORIG_H)],
        "output_heads": ["optic_disc_center", "fovea_center"],
        "target_landmarks": {
            "optic_disc_center": "Center of optic disc anatomical structure",
            "fovea_center": "Center of the fovea centralis / macula avascular zone"
        },
        "training_samples_raw": len(X_tr_raw),
        "training_samples_augmented": len(X_train),
        "validation_samples": len(X_val),
        "batch_size": batch_size,
        "initial_lr": lr,
        "loss_function": "Pixel Euclidean Distance Loss (Scaled by Canvas Dimensions)",
        "sha256": model_sha256,
        "saved_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }
    with open(os.path.join(MODELS_DIR, "optic_disc_fovea_model_config.json"), "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"[+] Saved model to {final_model_path} (SHA-256: {model_sha256[:16]}...)")
    return model, config, history_dict, (X_val, Y_od_val, Y_fov_val, val_ids)


def evaluate_test_cohort(model=None):
    """
    Evaluates the trained model on the official 103 IDRiD localisation testing scans.
    Computes Euclidean pixel errors, percentage within pixel thresholds, OD-Fovea distance errors,
    and generates visual overlays.
    """
    print("===================================================================")
    print(" MITRA DRISHTI: EVALUATING UNTOUCHED 103 LOCALISATION TEST SCANS")
    print("===================================================================")

    if model is None:
        model_p = os.path.join(MODELS_DIR, "optic_disc_fovea_localizer.keras")
        print(f"[*] Loading model from {model_p}...")
        model = keras.models.load_model(
            model_p,
            custom_objects={"add_coord_channels": add_coord_channels, "pixel_euclidean_loss": pixel_euclidean_loss}
        )

    # Load 103 Test Scans
    X_test, Y_od_test, Y_fov_test, test_ids = load_dataset(OD_TEST_CSV, FOV_TEST_CSV, TEST_IMG_DIR)
    print(f"[*] Running inference on {len(X_test)} official test scans...")

    t0 = time.time()
    preds = model.predict(X_test, batch_size=16, verbose=1)
    inf_time_per_scan = (time.time() - t0) / len(X_test)
    print(f"[+] Average inference time per test scan: {inf_time_per_scan*1000:.1f} ms")

    pred_od_norm = preds[0]
    pred_fov_norm = preds[1]

    # Convert to original pixel space
    pred_od_px = pred_od_norm * np.array([ORIG_W, ORIG_H])
    pred_fov_px = pred_fov_norm * np.array([ORIG_W, ORIG_H])

    gt_od_px = Y_od_test * np.array([ORIG_W, ORIG_H])
    gt_fov_px = Y_fov_test * np.array([ORIG_W, ORIG_H])

    # Euclidean distance errors
    od_errors = np.sqrt(np.sum((pred_od_px - gt_od_px)**2, axis=1))
    fov_errors = np.sqrt(np.sum((pred_fov_px - gt_fov_px)**2, axis=1))
    all_errors = np.concatenate([od_errors, fov_errors])

    # Inter-landmark distances (OD to Fovea Distance)
    gt_dist = np.sqrt(np.sum((gt_od_px - gt_fov_px)**2, axis=1))
    pred_dist = np.sqrt(np.sum((pred_od_px - pred_fov_px)**2, axis=1))
    dist_errors = np.abs(pred_dist - gt_dist)

    # Threshold percentages (<50px, <100px, <150px, <200px, <250px)
    def calc_thresholds(errs):
        return {
            "within_50px_pct": round(float(np.mean(errs < 50.0) * 100), 2),
            "within_100px_pct": round(float(np.mean(errs < 100.0) * 100), 2),
            "within_150px_pct": round(float(np.mean(errs < 150.0) * 100), 2),
            "within_200px_pct": round(float(np.mean(errs < 200.0) * 100), 2),
            "within_250px_pct": round(float(np.mean(errs < 250.0) * 100), 2),
            "within_half_od_diameter_225px_pct": round(float(np.mean(errs < 225.0) * 100), 2),
        }

    # Normalized error (relative to optic disc diameter ~450px)
    OD_DIAMETER_PX = 450.0

    eval_results = {
        "evaluation_cohort": "IDRiD Official Localization Testing Set (103 scans)",
        "test_sample_count": len(X_test),
        "canvas_dimensions": {"width": int(ORIG_W), "height": int(ORIG_H)},
        "overall_performance": {
            "mean_landmark_error_px": round(float(np.mean(all_errors)), 2),
            "median_landmark_error_px": round(float(np.median(all_errors)), 2),
            "std_landmark_error_px": round(float(np.std(all_errors)), 2),
            "min_error_px": round(float(np.min(all_errors)), 2),
            "max_error_px": round(float(np.max(all_errors)), 2),
            "mean_normalized_error_od_diameters": round(float(np.mean(all_errors) / OD_DIAMETER_PX), 4),
            "average_inference_latency_ms": round(inf_time_per_scan * 1000.0, 2),
        },
        "optic_disc_localization": {
            "mean_error_px": round(float(np.mean(od_errors)), 2),
            "median_error_px": round(float(np.median(od_errors)), 2),
            "std_error_px": round(float(np.std(od_errors)), 2),
            "min_error_px": round(float(np.min(od_errors)), 2),
            "max_error_px": round(float(np.max(od_errors)), 2),
            "threshold_accuracies": calc_thresholds(od_errors),
        },
        "fovea_localization": {
            "mean_error_px": round(float(np.mean(fov_errors)), 2),
            "median_error_px": round(float(np.median(fov_errors)), 2),
            "std_error_px": round(float(np.std(fov_errors)), 2),
            "min_error_px": round(float(np.min(fov_errors)), 2),
            "max_error_px": round(float(np.max(fov_errors)), 2),
            "threshold_accuracies": calc_thresholds(fov_errors),
        },
        "optic_disc_fovea_distance": {
            "ground_truth_mean_distance_px": round(float(np.mean(gt_dist)), 2),
            "ground_truth_median_distance_px": round(float(np.median(gt_dist)), 2),
            "predicted_mean_distance_px": round(float(np.mean(pred_dist)), 2),
            "predicted_median_distance_px": round(float(np.median(pred_dist)), 2),
            "mean_distance_error_px": round(float(np.mean(dist_errors)), 2),
            "median_distance_error_px": round(float(np.median(dist_errors)), 2),
        },
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }

    # Save JSON report
    json_path = os.path.join(REPORTS_DIR, "optic_disc_fovea_evaluation.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(eval_results, f, indent=2)
    print(f"[+] Saved evaluation metrics to {json_path}")

    # Generate Visual Overlays for Test Images
    print(f"[*] Generating visual overlay artifacts in {OVERLAYS_DIR}...")
    # Find best, median, and worst cases
    sorted_od_indices = np.argsort(od_errors)
    sorted_fov_indices = np.argsort(fov_errors)
    representative_indices = [
        int(sorted_od_indices[0]), # Best OD
        int(sorted_fov_indices[0]), # Best Fovea
        int(len(X_test) // 2), # Median
        int(sorted_od_indices[-1]), # Worst OD
        int(sorted_fov_indices[-1]), # Worst Fovea
        0, 1, 2 # First three test scans
    ]
    representative_indices = sorted(list(set(representative_indices)))

    for idx in representative_indices:
        t_id = test_ids[idx]
        img_p = os.path.join(TEST_IMG_DIR, f"{t_id}.jpg")
        with Image.open(img_p) as full_img:
            # Create a display copy resized to 1024 width for clean artifact rendering
            disp_w = 1072
            disp_h = 712
            disp_img = full_img.resize((disp_w, disp_h), Image.Resampling.BILINEAR).convert("RGB")
            draw = ImageDraw.Draw(disp_img)

            # Coordinates in display scale
            scale_x = disp_w / ORIG_W
            scale_y = disp_h / ORIG_H

            g_od = (gt_od_px[idx, 0] * scale_x, gt_od_px[idx, 1] * scale_y)
            p_od = (pred_od_px[idx, 0] * scale_x, pred_od_px[idx, 1] * scale_y)
            g_fov = (gt_fov_px[idx, 0] * scale_x, gt_fov_px[idx, 1] * scale_y)
            p_fov = (pred_fov_px[idx, 0] * scale_x, pred_fov_px[idx, 1] * scale_y)

            r = 10
            # Ground truth OD (Green circle)
            draw.ellipse([g_od[0]-r, g_od[1]-r, g_od[0]+r, g_od[1]+r], outline=(0, 255, 0), width=3)
            # Predicted OD (Yellow square)
            draw.rectangle([p_od[0]-r, p_od[1]-r, p_od[0]+r, p_od[1]+r], outline=(255, 255, 0), width=3)
            # Error line for OD
            draw.line([g_od, p_od], fill=(255, 200, 0), width=2)

            # Ground truth Fovea (Cyan circle)
            draw.ellipse([g_fov[0]-r, g_fov[1]-r, g_fov[0]+r, g_fov[1]+r], outline=(0, 255, 255), width=3)
            # Predicted Fovea (Magenta square)
            draw.rectangle([p_fov[0]-r, p_fov[1]-r, p_fov[0]+r, p_fov[1]+r], outline=(255, 0, 255), width=3)
            # Error line for Fovea
            draw.line([g_fov, p_fov], fill=(255, 100, 255), width=2)

            # Inter-landmark line (dashed or subtle line between predicted OD and Fovea)
            draw.line([p_od, p_fov], fill=(100, 200, 255), width=2)

            # Legend Banner at the top
            banner_h = 40
            draw.rectangle([0, 0, disp_w, banner_h], fill=(20, 24, 33))
            caption = (
                f"{t_id} | OD Err: {od_errors[idx]:.1f}px (Green O=GT, Yellow []=Pred) | "
                f"Fov Err: {fov_errors[idx]:.1f}px (Cyan O=GT, Magenta []=Pred) | "
                f"OD-Fov Dist: {pred_dist[idx]:.0f}px (GT: {gt_dist[idx]:.0f}px)"
            )
            draw.text((10, 12), caption, fill=(255, 255, 255))

            out_overlay_path = os.path.join(OVERLAYS_DIR, f"{t_id}_landmark_overlay.png")
            disp_img.save(out_overlay_path)

    print(f"[+] Saved {len(representative_indices)} visual overlays to {OVERLAYS_DIR}")

    # Generate Markdown Report
    md_path = os.path.join(REPORTS_DIR, "optic_disc_fovea_training_report.md")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("# IDRiD Optic Disc & Fovea Centre Localisation Training & Evaluation Report\n\n")
        f.write("**Model:** `models/optic_disc_fovea_localizer.keras`  \n")
        f.write("**Architecture:** Pre-trained MobileNetV2 with CoordConv Spatial Feature Embedding and Dual-Head Regression  \n")
        f.write("**Cohort:** Official IDRiD Component C Testing Cohort (103 Untouched Retinal Scans)  \n")
        f.write("**Canvas Size:** 4288 x 2848 pixels  \n\n")

        f.write("## 1. Overall Localisation Performance\n\n")
        f.write(f"- **Mean Landmark Error (All Landmarks):** {eval_results['overall_performance']['mean_landmark_error_px']:.1f} pixels\n")
        f.write(f"- **Median Landmark Error:** {eval_results['overall_performance']['median_landmark_error_px']:.1f} pixels\n")
        f.write(f"- **Error Standard Deviation:** {eval_results['overall_performance']['std_landmark_error_px']:.1f} pixels\n")
        f.write(f"- **Mean Normalized Error (Relative to ~450px Optic Disc Diameter):** {eval_results['overall_performance']['mean_normalized_error_od_diameters']:.4f} OD diameters\n")
        f.write(f"- **Average Inference Latency:** {eval_results['overall_performance']['average_inference_latency_ms']:.1f} ms per scan\n\n")

        f.write("## 2. Separate Landmark Performance\n\n")
        f.write("| Landmark | Mean Error | Median Error | Std Dev | Min Error | Max Error | Within 100px | Within 200px | Within 0.5 OD Diam (225px) |\n")
        f.write("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n")
        
        od_t = eval_results['optic_disc_localization']['threshold_accuracies']
        f.write(
            f"| **Optic Disc (OD) Centre** | {eval_results['optic_disc_localization']['mean_error_px']:.1f} px | "
            f"{eval_results['optic_disc_localization']['median_error_px']:.1f} px | "
            f"{eval_results['optic_disc_localization']['std_error_px']:.1f} px | "
            f"{eval_results['optic_disc_localization']['min_error_px']:.1f} px | "
            f"{eval_results['optic_disc_localization']['max_error_px']:.1f} px | "
            f"{od_t['within_100px_pct']:.1f}% | {od_t['within_200px_pct']:.1f}% | {od_t['within_half_od_diameter_225px_pct']:.1f}% |\n"
        )
        
        fov_t = eval_results['fovea_localization']['threshold_accuracies']
        f.write(
            f"| **Fovea Centre** | {eval_results['fovea_localization']['mean_error_px']:.1f} px | "
            f"{eval_results['fovea_localization']['median_error_px']:.1f} px | "
            f"{eval_results['fovea_localization']['std_error_px']:.1f} px | "
            f"{eval_results['fovea_localization']['min_error_px']:.1f} px | "
            f"{eval_results['fovea_localization']['max_error_px']:.1f} px | "
            f"{fov_t['within_100px_pct']:.1f}% | {fov_t['within_200px_pct']:.1f}% | {fov_t['within_half_od_diameter_225px_pct']:.1f}% |\n\n"
        )

        f.write("## 3. Optic Disc–Fovea Anatomical Distance\n\n")
        f.write(f"- **Ground-Truth Mean Distance:** {eval_results['optic_disc_fovea_distance']['ground_truth_mean_distance_px']:.1f} px\n")
        f.write(f"- **Predicted Mean Distance:** {eval_results['optic_disc_fovea_distance']['predicted_mean_distance_px']:.1f} px\n")
        f.write(f"- **Mean Distance Error:** {eval_results['optic_disc_fovea_distance']['mean_distance_error_px']:.1f} px\n")
        f.write(f"- **Median Distance Error:** {eval_results['optic_disc_fovea_distance']['median_distance_error_px']:.1f} px\n\n")

        f.write("## 4. Visual Verification Artifacts\n\n")
        f.write("Visual overlays generated and saved in `reports/optic_disc_fovea_test_overlays/`:\n")
        for idx in representative_indices[:5]:
            t_id = test_ids[idx]
            f.write(f"- `{t_id}_landmark_overlay.png`: OD Error = {od_errors[idx]:.1f} px, Fovea Error = {fov_errors[idx]:.1f} px\n")

        f.write("\n## 5. Clinical Safety & Scope Limitation\n\n")
        f.write("> [!NOTE]\n")
        f.write("> The predicted optic disc and fovea coordinates and anatomical distance are provided solely for visual orientation, lesion localization, and macular proximity analysis. They do NOT constitute an independent clinical diagnosis of glaucoma, papilledema, macular hole, or macular dystrophy. Clinical validation is strictly not claimed.\n")

    print(f"[+] Saved report to {md_path}")
    return eval_results


def main():
    print("[*] Starting Optic Disc & Fovea Localizer Pipeline...")
    model, config, history, val_data = train_localizer(epochs=15, batch_size=16, lr=5e-4)
    evaluate_test_cohort(model=model)
    print("\n[+] Optic Disc & Fovea Localisation Training and Evaluation Complete!")


if __name__ == "__main__":
    main()
