#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Improved MobileNetV2 Retinal Classification & Domain Generalisation Pipeline
Dataset: APTOS 2019 Blindness Detection (3,662 scans, Aravind Eye Hospital)
External Validation: IDRiD Disease Grading (103 scans, Nanded, Maharashtra)

Enhancements:
1. Robust FOV Crop + Contrast Normalization (Autocontrast) across all images.
2. Label Smoothing (epsilon=0.05) with Balanced Class Weights for Calibration.
3. Progressive Two-Stage Fine-Tuning:
   - Stage 1: Classification head warmup (Base frozen, lr=1e-3, 4 epochs).
   - Stage 2: Refined fine-tuning of top block (block_16 to end, lr=2e-5, 2 epochs).
4. Validation-Calibrated Operating Threshold strictly on 373 validation scans.
5. Dual Evaluation: Internal APTOS held-out (660 scans) & External IDRiD (103 scans).
6. Explainability verification with Grad-CAM targeting MobileNetV2 'out_relu'.
"""

import os
import sys
import io
import json
import time
import hashlib
import numpy as np
import pandas as pd
from PIL import Image, ImageOps

# Enforce local workspace Keras home
os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers
from tensorflow.keras.applications import MobileNetV2
import pyarrow as pa
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    cohen_kappa_score,
    confusion_matrix,
    roc_auc_score,
    brier_score_loss,
)

SEED = 42
NUM_CLASSES = 5
INPUT_SHAPE = (224, 224, 3)

ICDR_MAPPING = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "Proliferative DR",
}

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATASETS_DIR = os.path.join(ROOT_DIR, "datasets")
SPLITS_DIR = os.path.join(DATASETS_DIR, "splits")
METADATA_DIR = os.path.join(DATASETS_DIR, "metadata")
MODELS_DIR = os.path.join(ROOT_DIR, "models")
CHECKPOINTS_DIR = os.path.join(MODELS_DIR, "checkpoints")
REPORTS_DIR = os.path.join(ROOT_DIR, "reports")
GRADCAM_DIR = os.path.join(REPORTS_DIR, "dr_improvement_gradcam")

IDRiD_BASE = os.path.join(ROOT_DIR, "B. Disease Grading", "B. Disease Grading")
IDRiD_TEST_IMG_DIR = os.path.join(IDRiD_BASE, "1. Original Images", "b. Testing Set")
IDRiD_TEST_CSV_PATH = os.path.join(IDRiD_BASE, "2. Groundtruths", "b. IDRiD_Disease Grading_Testing Labels.csv")

DEFAULT_ARROW_PATH = os.path.join(
    os.path.expanduser("~"),
    ".cache",
    "huggingface",
    "datasets",
    "Mananya123___aptos",
    "default",
    "0.0.0",
    "12cfa2b4b207283b11ce7b6ddd4d0982d13daf31",
    "aptos-train.arrow",
)


def set_seed(seed=SEED):
    import random
    random.seed(seed)
    np.random.seed(seed)
    tf.random.set_seed(seed)


def get_fov_bbox(pil_img):
    """Detects bounding box of the circular retinal fundus aperture."""
    arr = np.array(pil_img)
    mask = np.mean(arr, axis=2) > 15
    if np.any(mask):
        ymin, ymax = np.where(mask.any(axis=1))[0][[0, -1]]
        xmin, xmax = np.where(mask.any(axis=0))[0][[0, -1]]
        return int(xmin), int(ymin), int(xmax), int(ymax)
    return 0, 0, pil_img.width, pil_img.height


def preprocess_retinal_image_improved(pil_img: Image.Image, is_training: bool = False, rng: np.random.RandomState = None) -> np.ndarray:
    """
    Improved preprocessing:
    1. Adaptive FOV crop without harsh circular boundary.
    2. Illumination and contrast normalization (ImageOps.autocontrast).
    3. Retinal data augmentation if is_training.
    4. MobileNetV2 scaling to [-1, 1].
    """
    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")

    xmin, ymin, xmax, ymax = get_fov_bbox(pil_img)
    enh = ImageOps.autocontrast(pil_img, cutoff=1)
    cropped = enh.crop((xmin, ymin, xmax, ymax)).resize((224, 224), Image.Resampling.LANCZOS)
    arr = np.array(cropped, dtype=np.float32)

    # Data augmentation for training
    if is_training and rng is not None:
        if rng.random() > 0.5:
            arr = np.fliplr(arr)
        if rng.random() > 0.5:
            arr = np.flipud(arr)
        k = rng.choice([0, 1, 2, 3])
        if k > 0:
            arr = np.rot90(arr, k)
        # Subtle brightness jitter (+- 8%)
        arr = np.clip(arr * (1.0 + rng.uniform(-0.08, 0.08)), 0.0, 255.0)

    # Scale to [-1.0, 1.0] for MobileNetV2
    return (arr / 127.5) - 1.0


def load_split_dataset_improved(split_name: str, arrow_path: str = DEFAULT_ARROW_PATH, is_training: bool = False, max_samples: int = None):
    """Loads genuine images for a given split using split CSV and Arrow table with improved preprocessing."""
    csv_path = os.path.join(SPLITS_DIR, f"{split_name}.csv")
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Split CSV not found: {csv_path}")

    split_meta = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        header = f.readline().strip().split(",")
        id_idx = header.index("image_id") if "image_id" in header else 0
        grade_idx = header.index("icdr_grade") if "icdr_grade" in header else 2
        for line in f:
            parts = line.strip().split(",")
            if len(parts) > max(id_idx, grade_idx):
                split_meta[parts[id_idx]] = int(parts[grade_idx])

    print(f"[*] Loading genuine {split_name} split ({len(split_meta)} records) with improved preprocessing...")
    images = []
    labels = []
    rng = np.random.RandomState(SEED if not is_training else 1337)

    with pa.OSFile(arrow_path, "rb") as f:
        reader = pa.ipc.open_stream(f)
        for batch in reader:
            img_col = batch.column(0)
            bytes_field = img_col.field(0)
            path_field = img_col.field(1)
            paths = path_field.to_pylist()

            for i in range(len(batch)):
                filename = paths[i] or ""
                image_id = os.path.splitext(filename)[0]
                if image_id in split_meta:
                    raw_bytes = bytes_field[i].as_buffer().to_pybytes()
                    grade = split_meta[image_id]
                    try:
                        pil_img = Image.open(io.BytesIO(raw_bytes))
                        arr = preprocess_retinal_image_improved(pil_img, is_training=is_training, rng=rng)
                        images.append(arr)
                        labels.append(grade)
                    except Exception:
                        continue

                    if max_samples and len(images) >= max_samples:
                        break
            if max_samples and len(images) >= max_samples:
                break

    X = np.array(images, dtype=np.float32)
    y = np.array(labels, dtype=np.int32)
    print(f"[+] Loaded {len(X)} images for {split_name} (Shape: {X.shape}, Labels: {len(y)})")
    return X, y


# ---------------------------------------------------------------------------
# Architecture Builder
# ---------------------------------------------------------------------------
def build_improved_mobilenet_v2(input_shape=INPUT_SHAPE, num_classes=NUM_CLASSES):
    """
    Constructs improved MobileNetV2 with:
    - Base pretrained on ImageNet
    - GlobalAveragePooling2D + BatchNorm + Dropout(0.35)
    - Dense(128, ReLU, L2=1e-4) + BatchNorm + Dropout(0.25)
    - Dense(5, Softmax)
    """
    base_model = MobileNetV2(
        weights="imagenet",
        include_top=False,
        input_shape=input_shape,
    )
    base_model.trainable = False

    inputs = keras.Input(shape=input_shape, name="retinal_input")
    x = base_model(inputs, training=False)
    x = layers.GlobalAveragePooling2D(name="gap")(x)
    x = layers.BatchNormalization(name="bn_gap")(x)
    x = layers.Dropout(0.35, name="dropout_1")(x)
    x = layers.Dense(
        128,
        activation="relu",
        kernel_regularizer=regularizers.l2(1e-4),
        name="dense_features",
    )(x)
    x = layers.BatchNormalization(name="bn_features")(x)
    x = layers.Dropout(0.25, name="dropout_2")(x)
    outputs = layers.Dense(num_classes, activation="softmax", name="dr_probabilities")(x)

    model = keras.Model(inputs=inputs, outputs=outputs, name="Mritidhristi_MobileNetV2_DR_Improved")
    return model, base_model


# ---------------------------------------------------------------------------
# Training Pipeline: Progressive Two-Stage Fine-Tuning
# ---------------------------------------------------------------------------
def train_improved_model(arrow_path=DEFAULT_ARROW_PATH):
    set_seed(SEED)
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(GRADCAM_DIR, exist_ok=True)

    print("===================================================================")
    print(" MITRA DRISHTI: PROGRESSIVE FINE-TUNING MOBILENETV2 (APEXFORGE 2K26)")
    print("===================================================================")

    # 1. Load Train and Validation Splits
    X_train, y_train = load_split_dataset_improved("train", arrow_path, is_training=True)
    X_val, y_val = load_split_dataset_improved("val", arrow_path, is_training=False)

    y_train_cat = keras.utils.to_categorical(y_train, num_classes=NUM_CLASSES)
    y_val_cat = keras.utils.to_categorical(y_val, num_classes=NUM_CLASSES)

    # Balanced class weights: soften extremes to prevent majority collapse
    class_weights = {0: 0.65, 1: 1.40, 2: 0.85, 3: 1.80, 4: 1.50}
    loss_fn = keras.losses.CategoricalCrossentropy(label_smoothing=0.05)

    # 2. Build Model
    model, base_model = build_improved_mobilenet_v2()

    # -----------------------------------------------------------------------
    # STAGE 1: Classification Head Warmup (Base Frozen)
    # -----------------------------------------------------------------------
    print("\n[*] STAGE 1: Training classification head for 4 epochs (Base Frozen, lr=1e-3)...")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss=loss_fn,
        metrics=["accuracy"],
    )

    checkpoint_path = os.path.join(CHECKPOINTS_DIR, "best_dr_model_improved.keras")
    cb_stage1 = [
        keras.callbacks.ModelCheckpoint(checkpoint_path, monitor="val_accuracy", save_best_only=True, mode="max", verbose=1),
    ]

    t0 = time.time()
    hist_stage1 = model.fit(
        X_train, y_train_cat,
        validation_data=(X_val, y_val_cat),
        epochs=4,
        batch_size=32,
        class_weight=class_weights,
        callbacks=cb_stage1,
        verbose=1,
    )

    # -----------------------------------------------------------------------
    # STAGE 2: Refined Fine-Tuning of Top Residual Block
    # -----------------------------------------------------------------------
    print("\n[*] STAGE 2: Unfreezing top MobileNetV2 block (block_16 and Conv_1) for gentle adaptation...")
    unfreeze = False
    unfrozen_layers = 0
    for layer in base_model.layers:
        if "block_16_expand" in layer.name:
            unfreeze = True
        if unfreeze and not isinstance(layer, layers.BatchNormalization):
            layer.trainable = True
            unfrozen_layers += 1
        else:
            layer.trainable = False

    print(f"[*] Unfrozen {unfrozen_layers} top convolutional layers. Recompiling with lr=2e-5...")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=2e-5),
        loss=loss_fn,
        metrics=["accuracy"],
    )

    cb_stage2 = [
        keras.callbacks.ModelCheckpoint(checkpoint_path, monitor="val_accuracy", save_best_only=True, mode="max", verbose=1),
    ]

    print("[*] Launching Stage 2 fine-tuning for 2 epochs (Batch size: 32)...")
    hist_stage2 = model.fit(
        X_train, y_train_cat,
        validation_data=(X_val, y_val_cat),
        epochs=2,
        batch_size=32,
        class_weight=class_weights,
        callbacks=cb_stage2,
        verbose=1,
    )
    total_duration = time.time() - t0
    print(f"[+] Total training completed in {total_duration:.1f} seconds ({total_duration/60:.2f} mins).")

    # Load best checkpoint weights
    print(f"[*] Restoring best checkpoint from {checkpoint_path}...")
    model = keras.models.load_model(checkpoint_path)

    # Save final improved model
    final_model_path = os.path.join(MODELS_DIR, "dr_classifier_improved.keras")
    model.save(final_model_path)
    with open(final_model_path, "rb") as f:
        model_sha256 = hashlib.sha256(f.read()).hexdigest()

    # Merge history
    combined_history = {
        "loss": hist_stage1.history["loss"] + hist_stage2.history["loss"],
        "accuracy": hist_stage1.history["accuracy"] + hist_stage2.history["accuracy"],
        "val_loss": hist_stage1.history["val_loss"] + hist_stage2.history["val_loss"],
        "val_accuracy": hist_stage1.history["val_accuracy"] + hist_stage2.history["val_accuracy"],
        "training_duration_seconds": round(total_duration, 2),
    }
    with open(os.path.join(MODELS_DIR, "dr_improved_training_history.json"), "w", encoding="utf-8") as f:
        json.dump(combined_history, f, indent=2)

    # 3. Calibrate Operating Threshold strictly on 373 Validation Scans
    print("\n[*] Calibrating referable DR operating threshold on unaugmented validation split...")
    val_probs = model.predict(X_val, batch_size=32, verbose=0)
    val_ref_probs = np.sum(val_probs[:, 2:], axis=1)
    y_val_ref = (y_val >= 2).astype(int)

    best_thresh = 0.35
    best_youden = -1.0
    threshold_search = []

    for t in np.arange(0.20, 0.52, 0.02):
        t = round(float(t), 2)
        y_pred_t = (val_ref_probs >= t).astype(int)
        cm_t = confusion_matrix(y_val_ref, y_pred_t)
        sens_t = cm_t[1, 1] / max(1, cm_t[1, 0] + cm_t[1, 1])
        spec_t = cm_t[0, 0] / max(1, cm_t[0, 0] + cm_t[0, 1])
        youden = sens_t + spec_t - 1.0
        threshold_search.append({"threshold": t, "sensitivity": round(float(sens_t), 4), "specificity": round(float(spec_t), 4), "youden_index": round(float(youden), 4)})
        # Target high sensitivity (>= 88%) while maximizing Youden Index
        if youden > best_youden and sens_t >= 0.88:
            best_youden = youden
            best_thresh = t

    print(f"[+] Calibrated Optimal Threshold: tau = {best_thresh:.2f}")

    config = {
        "model_name": "Mritidhristi-MobileNetV2-ICDR5-Improved",
        "architecture": "MobileNetV2 Two-Stage Fine-Tuning with Label Smoothing",
        "input_shape": list(INPUT_SHAPE),
        "num_classes": NUM_CLASSES,
        "class_mapping": ICDR_MAPPING,
        "calibrated_referable_threshold": best_thresh,
        "training_samples": len(X_train),
        "validation_samples": len(X_val),
        "sha256": model_sha256,
        "saved_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }
    with open(os.path.join(MODELS_DIR, "dr_improved_model_config.json"), "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    return model, best_thresh, config


# ---------------------------------------------------------------------------
# Calibration Metrics Helper (ECE & Brier Score)
# ---------------------------------------------------------------------------
def compute_ece(probs_bin, y_true_bin, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    bin_details = []
    for i in range(n_bins):
        b_low = bin_boundaries[i]
        b_high = bin_boundaries[i + 1]
        in_bin = (probs_bin >= b_low) & (probs_bin < b_high) if i < n_bins - 1 else (probs_bin >= b_low) & (probs_bin <= b_high)
        count = int(np.sum(in_bin))
        prop = float(np.mean(in_bin))
        if count > 0:
            acc = float(np.mean(y_true_bin[in_bin]))
            conf = float(np.mean(probs_bin[in_bin]))
            diff = abs(conf - acc)
            ece += diff * prop
            bin_details.append({"bin": f"[{b_low:.1f}, {b_high:.1f}]", "count": count, "accuracy": round(acc, 4), "confidence": round(conf, 4), "calibration_gap": round(diff, 4)})
        else:
            bin_details.append({"bin": f"[{b_low:.1f}, {b_high:.1f}]", "count": 0, "accuracy": 0.0, "confidence": 0.0, "calibration_gap": 0.0})
    return round(float(ece), 4), bin_details


# ---------------------------------------------------------------------------
# Comprehensive Dual Evaluation: APTOS Quarantined Test + IDRiD External Cohort
# ---------------------------------------------------------------------------
def evaluate_all_cohorts(model=None, calibrated_thresh=0.35, arrow_path=DEFAULT_ARROW_PATH):
    print("===================================================================")
    print(" MITRA DRISHTI: DUAL EVALUATION (APTOS TEST + IDRiD EXTERNAL)")
    print("===================================================================")

    if model is None:
        model_path = os.path.join(MODELS_DIR, "dr_classifier_improved.keras")
        print(f"[*] Loading improved model from {model_path}...")
        model = keras.models.load_model(model_path, compile=False)

    # 1. EVALUATION ON APTOS HELD-OUT TEST SPLIT (660 scans)
    print("\n--- 1. Evaluating Internal Held-Out APTOS Test Set (660 scans) ---")
    X_aptos_test, y_aptos_test = load_split_dataset_improved("test", arrow_path, is_training=False)
    probs_aptos = model.predict(X_aptos_test, batch_size=32, verbose=0)
    preds_aptos = np.argmax(probs_aptos, axis=1)

    acc_aptos = accuracy_score(y_aptos_test, preds_aptos)
    qwk_aptos = cohen_kappa_score(y_aptos_test, preds_aptos, weights="quadratic")
    prec_m_aptos, rec_m_aptos, f1_m_aptos, _ = precision_recall_fscore_support(y_aptos_test, preds_aptos, average="macro", zero_division=0)
    prec_w_aptos, rec_w_aptos, f1_w_aptos, _ = precision_recall_fscore_support(y_aptos_test, preds_aptos, average="weighted", zero_division=0)
    cm_aptos = confusion_matrix(y_aptos_test, preds_aptos, labels=list(range(NUM_CLASSES)))

    # Per-class metrics
    p_c_aptos, r_c_aptos, f_c_aptos, s_c_aptos = precision_recall_fscore_support(y_aptos_test, preds_aptos, average=None, zero_division=0)

    # Referable DR (Grade >= 2)
    y_aptos_ref = (y_aptos_test >= 2).astype(int)
    probs_aptos_ref = np.sum(probs_aptos[:, 2:], axis=1)

    # Threshold 0.50
    p50_aptos = (probs_aptos_ref >= 0.50).astype(int)
    cm50_aptos = confusion_matrix(y_aptos_ref, p50_aptos)
    sens50_aptos = cm50_aptos[1, 1] / max(1, cm50_aptos[1, 0] + cm50_aptos[1, 1])
    spec50_aptos = cm50_aptos[0, 0] / max(1, cm50_aptos[0, 0] + cm50_aptos[0, 1])

    # Calibrated Threshold (tau*)
    p_calib_aptos = (probs_aptos_ref >= calibrated_thresh).astype(int)
    cm_calib_aptos = confusion_matrix(y_aptos_ref, p_calib_aptos)
    sens_calib_aptos = cm_calib_aptos[1, 1] / max(1, cm_calib_aptos[1, 0] + cm_calib_aptos[1, 1])
    spec_calib_aptos = cm_calib_aptos[0, 0] / max(1, cm_calib_aptos[0, 0] + cm_calib_aptos[0, 1])
    prec_calib_aptos = cm_calib_aptos[1, 1] / max(1, cm_calib_aptos[0, 1] + cm_calib_aptos[1, 1])

    roc_auc_aptos = roc_auc_score(y_aptos_ref, probs_aptos_ref)
    brier_aptos = brier_score_loss(y_aptos_ref, probs_aptos_ref)
    ece_aptos, ece_bins_aptos = compute_ece(probs_aptos_ref, y_aptos_ref)

    # 2. EVALUATION ON IDRiD EXTERNAL COHORT (103 scans)
    print("\n--- 2. Evaluating External IDRiD Cohort (103 scans, Nanded) ---")
    df_idrid = pd.read_csv(IDRiD_TEST_CSV_PATH)
    id_col = [c for c in df_idrid.columns if "Image" in c or "image" in c][0]
    gr_col = [c for c in df_idrid.columns if "Retinopathy" in c or "grade" in c][0]
    idrid_ids = df_idrid[id_col].astype(str).tolist()
    y_idrid = df_idrid[gr_col].astype(int).values

    idrid_batch = []
    for i_id in idrid_ids:
        p = os.path.join(IDRiD_TEST_IMG_DIR, f"{i_id}.jpg")
        with Image.open(p) as pim:
            arr = preprocess_retinal_image_improved(pim, is_training=False)
            idrid_batch.append(arr)
    X_idrid = np.array(idrid_batch, dtype=np.float32)

    probs_idrid = model.predict(X_idrid, batch_size=32, verbose=0)
    preds_idrid = np.argmax(probs_idrid, axis=1)

    acc_idrid = accuracy_score(y_idrid, preds_idrid)
    qwk_idrid = cohen_kappa_score(y_idrid, preds_idrid, weights="quadratic")
    prec_m_idrid, rec_m_idrid, f1_m_idrid, _ = precision_recall_fscore_support(y_idrid, preds_idrid, average="macro", zero_division=0)
    cm_idrid = confusion_matrix(y_idrid, preds_idrid, labels=list(range(NUM_CLASSES)))

    p_c_idrid, r_c_idrid, f_c_idrid, s_c_idrid = precision_recall_fscore_support(y_idrid, preds_idrid, average=None, zero_division=0)

    # Referable DR IDRiD
    y_idrid_ref = (y_idrid >= 2).astype(int)
    probs_idrid_ref = np.sum(probs_idrid[:, 2:], axis=1)

    p50_idrid = (probs_idrid_ref >= 0.50).astype(int)
    cm50_idrid = confusion_matrix(y_idrid_ref, p50_idrid)
    sens50_idrid = cm50_idrid[1, 1] / max(1, cm50_idrid[1, 0] + cm50_idrid[1, 1])
    spec50_idrid = cm50_idrid[0, 0] / max(1, cm50_idrid[0, 0] + cm50_idrid[0, 1])

    p_calib_idrid = (probs_idrid_ref >= calibrated_thresh).astype(int)
    cm_calib_idrid = confusion_matrix(y_idrid_ref, p_calib_idrid)
    sens_calib_idrid = cm_calib_idrid[1, 1] / max(1, cm_calib_idrid[1, 0] + cm_calib_idrid[1, 1])
    spec_calib_idrid = cm_calib_idrid[0, 0] / max(1, cm_calib_idrid[0, 0] + cm_calib_idrid[0, 1])
    prec_calib_idrid = cm_calib_idrid[1, 1] / max(1, cm_calib_idrid[0, 1] + cm_calib_idrid[1, 1])

    roc_auc_idrid = roc_auc_score(y_idrid_ref, probs_idrid_ref)
    brier_idrid = brier_score_loss(y_idrid_ref, probs_idrid_ref)
    ece_idrid, ece_bins_idrid = compute_ece(probs_idrid_ref, y_idrid_ref)

    # Master Evaluation Report
    report = {
        "evaluation_title": "MITRA DRISHTI — MobileNetV2 Improved DR Classification Evaluation",
        "model_evaluated": "models/dr_classifier_improved.keras",
        "calibrated_threshold": calibrated_thresh,
        "aptos_held_out_evaluation": {
            "sample_count": len(X_aptos_test),
            "accuracy": round(float(acc_aptos), 4),
            "quadratic_weighted_kappa": round(float(qwk_aptos), 4),
            "macro_precision": round(float(prec_m_aptos), 4),
            "macro_recall": round(float(rec_m_aptos), 4),
            "macro_f1": round(float(f1_m_aptos), 4),
            "weighted_f1": round(float(f1_w_aptos), 4),
            "per_class": {
                c: {
                    "name": ICDR_MAPPING[c],
                    "precision": round(float(p_c_aptos[c]), 4),
                    "recall": round(float(r_c_aptos[c]), 4),
                    "f1": round(float(f_c_aptos[c]), 4),
                    "support": int(s_c_aptos[c]),
                }
                for c in range(NUM_CLASSES)
            },
            "referable_dr_50": {"sensitivity": round(float(sens50_aptos), 4), "specificity": round(float(spec50_aptos), 4)},
            "referable_dr_calibrated": {"sensitivity": round(float(sens_calib_aptos), 4), "specificity": round(float(spec_calib_aptos), 4), "precision": round(float(prec_calib_aptos), 4)},
            "roc_auc": round(float(roc_auc_aptos), 4),
            "brier_score": round(float(brier_aptos), 4),
            "expected_calibration_error": ece_aptos,
            "confusion_matrix": cm_aptos.tolist(),
        },
        "idrid_external_evaluation": {
            "sample_count": len(X_idrid),
            "accuracy": round(float(acc_idrid), 4),
            "quadratic_weighted_kappa": round(float(qwk_idrid), 4),
            "macro_precision": round(float(prec_m_idrid), 4),
            "macro_recall": round(float(rec_m_idrid), 4),
            "macro_f1": round(float(f1_m_idrid), 4),
            "per_class": {
                c: {
                    "name": ICDR_MAPPING[c],
                    "precision": round(float(p_c_idrid[c]), 4),
                    "recall": round(float(r_c_idrid[c]), 4),
                    "f1": round(float(f_c_idrid[c]), 4),
                    "support": int(s_c_idrid[c]),
                }
                for c in range(NUM_CLASSES)
            },
            "referable_dr_50": {"sensitivity": round(float(sens50_idrid), 4), "specificity": round(float(spec50_idrid), 4)},
            "referable_dr_calibrated": {"sensitivity": round(float(sens_calib_idrid), 4), "specificity": round(float(spec_calib_idrid), 4), "precision": round(float(prec_calib_idrid), 4)},
            "roc_auc": round(float(roc_auc_idrid), 4),
            "brier_score": round(float(brier_idrid), 4),
            "expected_calibration_error": ece_idrid,
            "confusion_matrix": cm_idrid.tolist(),
        },
        "baseline_comparison": {
            "aptos_accuracy": {"baseline": 0.7758, "improved": round(float(acc_aptos), 4)},
            "aptos_qwk": {"baseline": 0.8289, "improved": round(float(qwk_aptos), 4)},
            "idrid_accuracy": {"baseline_p1": 0.2427, "baseline_p2": 0.4466, "improved": round(float(acc_idrid), 4)},
            "idrid_qwk": {"baseline_p1": 0.3437, "baseline_p2": 0.4738, "improved": round(float(qwk_idrid), 4)},
            "idrid_ref_sens": {"baseline_p1": 0.5938, "baseline_p2": 0.5625, "improved": round(float(sens_calib_idrid), 4)},
        },
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }

    # Save JSON Report
    json_path = os.path.join(REPORTS_DIR, "dr_improvement_evaluation.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("\n===================================================================")
    print(" DUAL EVALUATION RESULTS SUMMARY")
    print("===================================================================")
    print(f"APTOS Held-Out: Accuracy = {acc_aptos*100:.2f}% (Baseline: 77.58%) | QWK = {qwk_aptos:.4f} (Baseline: 0.8289) | Ref Sens = {sens_calib_aptos*100:.2f}% | Spec = {spec_calib_aptos*100:.2f}% | ECE = {ece_aptos:.4f}")
    print(f"IDRiD External: Accuracy = {acc_idrid*100:.2f}% (Baseline: 24.27% / 44.66%) | QWK = {qwk_idrid:.4f} (Baseline: 0.3437 / 0.4738) | Ref Sens = {sens_calib_idrid*100:.2f}% | Spec = {spec_calib_idrid*100:.2f}% | ECE = {ece_idrid:.4f}")

    return report, model


# ---------------------------------------------------------------------------
# Grad-CAM Explainability Verification
# ---------------------------------------------------------------------------
def generate_gradcam_artifacts(model=None, max_samples=4):
    """Generates and verifies genuine Grad-CAM overlays on 'out_relu' layer."""
    print("\n[*] Generating Grad-CAM explainability artifacts...")
    os.makedirs(GRADCAM_DIR, exist_ok=True)

    if model is None:
        model_path = os.path.join(MODELS_DIR, "dr_classifier_improved.keras")
        model = keras.models.load_model(model_path, compile=False)

    base_m = [l for l in model.layers if "mobilenetv2" in l.name.lower()][0]
    target_layer = base_m.get_layer("out_relu")
    feature_extractor = keras.Model(inputs=base_m.input, outputs=target_layer.output)

    head_in = keras.Input(shape=target_layer.output.shape[1:])
    x = head_in
    for l in model.layers:
        if l != base_m and not isinstance(l, keras.layers.InputLayer):
            x = l(x)
    head_m = keras.Model(inputs=head_in, outputs=x)

    # Sample images from IDRiD test set
    df_idrid = pd.read_csv(IDRiD_TEST_CSV_PATH)
    id_col = [c for c in df_idrid.columns if "Image" in c or "image" in c][0]
    sample_ids = df_idrid[id_col].astype(str).tolist()[:max_samples]

    for sid in sample_ids:
        img_p = os.path.join(IDRiD_TEST_IMG_DIR, f"{sid}.jpg")
        with Image.open(img_p) as pim:
            tensor = preprocess_retinal_image_improved(pim, is_training=False)
            input_batch = np.expand_dims(tensor, axis=0)

            with tf.GradientTape() as tape:
                conv_out = feature_extractor(input_batch)
                tape.watch(conv_out)
                preds = head_m(conv_out, training=False)
                top_class = int(np.argmax(preds.numpy()[0]))
                loss = preds[:, top_class]

            grads = tape.gradient(loss, conv_out)
            pooled = tf.reduce_mean(grads, axis=(0, 1, 2))
            cam = tf.reduce_sum(tf.multiply(pooled, conv_out[0]), axis=-1)
            cam = tf.maximum(cam, 0)
            cam_max = tf.reduce_max(cam)
            if cam_max > 0:
                cam = cam / cam_max
            cam_np = cam.numpy()

            # Upsample CAM to 224x224
            cam_pil = Image.fromarray((cam_np * 255.0).astype(np.uint8)).resize((224, 224), Image.Resampling.BILINEAR)
            cam_up = np.array(cam_pil, dtype=np.float32) / 255.0

            # Jet colormap blending onto original cropped fundus
            xmin, ymin, xmax, ymax = get_fov_bbox(pim)
            enh = ImageOps.autocontrast(pim, cutoff=1)
            cropped_orig = np.array(enh.crop((xmin, ymin, xmax, ymax)).resize((224, 224), Image.Resampling.LANCZOS), dtype=np.float32)

            heatmap_rgb = np.zeros_like(cropped_orig)
            heatmap_rgb[:, :, 0] = np.clip(1.5 - np.abs(cam_up * 4.0 - 3.0), 0.0, 1.0) * 255.0
            heatmap_rgb[:, :, 1] = np.clip(1.5 - np.abs(cam_up * 4.0 - 2.0), 0.0, 1.0) * 255.0
            heatmap_rgb[:, :, 2] = np.clip(1.5 - np.abs(cam_up * 4.0 - 1.0), 0.0, 1.0) * 255.0

            mask = (cam_up[:, :, np.newaxis] > 0.10).astype(np.float32)
            blended = cropped_orig * (1.0 - 0.5 * mask) + heatmap_rgb * (0.5 * mask)
            blended_uint8 = np.clip(blended, 0, 255).astype(np.uint8)

            # Composite side-by-side: [Original | Grad-CAM Heatmap | Blended Overlay]
            composite = Image.new("RGB", (224 * 3 + 40, 224 + 40), (20, 24, 33))
            composite.paste(Image.fromarray(cropped_orig.astype(np.uint8)), (10, 20))
            composite.paste(Image.fromarray(heatmap_rgb.astype(np.uint8)), (224 + 20, 20))
            composite.paste(Image.fromarray(blended_uint8), (2 * 224 + 30, 20))

            out_path = os.path.join(GRADCAM_DIR, f"{sid}_gradcam_verification.png")
            composite.save(out_path)
            print(f"  [+] Saved Grad-CAM artifact: {out_path}")


if __name__ == "__main__":
    if "--evaluate-only" in sys.argv:
        print("[*] Running evaluation only with saved improved model...")
        report, model = evaluate_all_cohorts(model=None, calibrated_thresh=0.35)
        generate_gradcam_artifacts(model, max_samples=4)
    else:
        trained_model, calib_th, config = train_improved_model()
        report, model = evaluate_all_cohorts(trained_model, calibrated_thresh=calib_th)
        generate_gradcam_artifacts(model, max_samples=4)
    print("\n[✓] MobileNetV2 Improvement Pipeline Executed Successfully!")
