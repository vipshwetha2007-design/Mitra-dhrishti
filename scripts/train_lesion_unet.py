#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
IDRiD Retinal Lesion Segmentation Model Training Pipeline
Model: Improved Residual U-Net for 4 DR Lesions (MA, HE, EX, SE)
Dataset: IDRiD (Indian Diabetic Retinopathy Image Dataset - Nanded, Maharashtra)

Contains:
1. Baseline U-Net pipeline (preserved for reproducibility & regression tests)
2. Improved Residual U-Net pipeline with:
   - Area-preserving BOX downsampling for binary ground truth masks
   - Illumination & contrast normalization
   - Asymmetric Focal Tversky Loss + Pixel-wise Focal Loss
   - Validation-calibrated per-class operating thresholds
   - Multi-scale Residual U-Net with skip connections
"""

import os
import sys
import glob
import json
import time
import hashlib
import numpy as np
from PIL import Image, ImageOps

# Enforce local workspace Keras home
os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

SEED = 42
TARGET_SIZE = (256, 256)
NUM_CLASSES = 4
LESION_NAMES = ["Microaneurysms (MA)", "Haemorrhages (HE)", "Hard Exudates (EX)", "Soft Exudates (SE)"]
LESION_KEYS = ["MA", "HE", "EX", "SE"]

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODELS_DIR = os.path.join(ROOT_DIR, "models")
CHECKPOINTS_DIR = os.path.join(MODELS_DIR, "checkpoints")
REPORTS_DIR = os.path.join(ROOT_DIR, "reports")
OVERLAYS_DIR = os.path.join(REPORTS_DIR, "unet_improvement_test_overlays")

BASE_SEG_DIR = os.path.join(ROOT_DIR, "A. Segmentation", "A. Segmentation")
TRAIN_IMG_DIR = os.path.join(BASE_SEG_DIR, "1. Original Images", "a. Training Set")
TRAIN_GT_DIR = os.path.join(BASE_SEG_DIR, "2. All Segmentation Groundtruths", "a. Training Set")
TEST_IMG_DIR = os.path.join(BASE_SEG_DIR, "1. Original Images", "b. Testing Set")
TEST_GT_DIR = os.path.join(BASE_SEG_DIR, "2. All Segmentation Groundtruths", "b. Testing Set")

LESION_CONFIG = [
    ("MA", "1. Microaneurysms", "_MA.tif"),
    ("HE", "2. Haemorrhages", "_HE.tif"),
    ("EX", "3. Hard Exudates", "_EX.tif"),
    ("SE", "4. Soft Exudates", "_SE.tif"),
]


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
        return xmin, ymin, xmax, ymax
    return 0, 0, pil_img.width, pil_img.height


# ---------------------------------------------------------------------------
# Baseline Preprocessing (Preserved)
# ---------------------------------------------------------------------------
def load_sample(img_path, gt_dir, target_size=TARGET_SIZE):
    """Loads a single retinal image and its 4 lesion groundtruth masks (Baseline)."""
    img_id = os.path.splitext(os.path.basename(img_path))[0]
    with Image.open(img_path) as pil_img:
        xmin, ymin, xmax, ymax = get_fov_bbox(pil_img)
        cropped_img = pil_img.crop((xmin, ymin, xmax, ymax)).resize(target_size, Image.Resampling.LANCZOS)
        img_arr = np.array(cropped_img.convert("RGB"), dtype=np.float32) / 255.0

    lesion_masks = []
    for lkey, lfolder, lsuffix in LESION_CONFIG:
        mpath = os.path.join(gt_dir, lfolder, f"{img_id}{lsuffix}")
        if os.path.exists(mpath):
            with Image.open(mpath) as mimg:
                mimg_l = mimg.convert("L")
                cm = mimg_l.crop((xmin, ymin, xmax, ymax)).resize(target_size, Image.Resampling.NEAREST)
                marr = (np.array(cm) > 0).astype(np.float32)
        else:
            marr = np.zeros(target_size, dtype=np.float32)
        lesion_masks.append(marr)

    mask_arr = np.stack(lesion_masks, axis=-1)  # (256, 256, 4)
    return img_arr, mask_arr


def load_dataset(img_dir, gt_dir):
    """Loads all scans and corresponding 4-channel masks in a directory (Baseline)."""
    img_paths = sorted(glob.glob(os.path.join(img_dir, "*.jpg")))
    images = []
    masks = []
    ids = []
    print(f"[*] Loading {len(img_paths)} scans from {img_dir}...")
    for p in img_paths:
        img_id = os.path.splitext(os.path.basename(p))[0]
        img_arr, mask_arr = load_sample(p, gt_dir)
        images.append(img_arr)
        masks.append(mask_arr)
        ids.append(img_id)
    return np.array(images, dtype=np.float32), np.array(masks, dtype=np.float32), ids


def augment_batch(images, masks, rng):
    """Applies synchronized geometric data augmentation to images and masks."""
    aug_images = []
    aug_masks = []
    for img, msk in zip(images, masks):
        cur_img = img.copy()
        cur_msk = msk.copy()
        if rng.random() > 0.5:
            cur_img = np.fliplr(cur_img)
            cur_msk = np.fliplr(cur_msk)
        if rng.random() > 0.5:
            cur_img = np.flipud(cur_img)
            cur_msk = np.flipud(cur_msk)
        k = rng.choice([0, 1, 2, 3])
        if k > 0:
            cur_img = np.rot90(cur_img, k)
            cur_msk = np.rot90(cur_msk, k)
        aug_images.append(cur_img)
        aug_masks.append(cur_msk)
    return np.array(aug_images, dtype=np.float32), np.array(aug_masks, dtype=np.float32)


# ---------------------------------------------------------------------------
# Baseline Loss & Architecture (Preserved)
# ---------------------------------------------------------------------------
def soft_dice_loss(y_true, y_pred, epsilon=1e-6):
    """Computes soft Dice loss averaged across all lesion channels."""
    y_true_f = tf.reshape(y_true, [-1, NUM_CLASSES])
    y_pred_f = tf.reshape(y_pred, [-1, NUM_CLASSES])
    intersection = tf.reduce_sum(y_true_f * y_pred_f, axis=0)
    denominator = tf.reduce_sum(y_true_f + y_pred_f, axis=0)
    dice_per_class = (2.0 * intersection + epsilon) / (denominator + epsilon)
    return 1.0 - tf.reduce_mean(dice_per_class)


def combined_dice_bce_loss(y_true, y_pred):
    """Weighted combination of Dice loss and binary cross entropy."""
    bce = keras.losses.binary_crossentropy(y_true, y_pred)
    dice = soft_dice_loss(y_true, y_pred)
    return dice + 0.5 * tf.reduce_mean(bce)


def mean_dice_coef(y_true, y_pred, epsilon=1e-6):
    """Evaluation metric: Mean Dice Similarity Coefficient."""
    y_pred_bin = tf.cast(y_pred > 0.5, tf.float32)
    y_true_f = tf.reshape(y_true, [-1, NUM_CLASSES])
    y_pred_f = tf.reshape(y_pred_bin, [-1, NUM_CLASSES])
    intersection = tf.reduce_sum(y_true_f * y_pred_f, axis=0)
    denominator = tf.reduce_sum(y_true_f + y_pred_f, axis=0)
    dice = (2.0 * intersection + epsilon) / (denominator + epsilon)
    return tf.reduce_mean(dice)


def build_lightweight_unet(input_shape=(256, 256, 3), num_classes=NUM_CLASSES):
    """Constructs baseline lightweight convolutional U-Net."""
    inputs = layers.Input(shape=input_shape, name="retinal_input")

    c1 = layers.Conv2D(16, 3, activation="relu", padding="same", name="enc1_conv1")(inputs)
    c1 = layers.BatchNormalization(name="enc1_bn")(c1)
    c1 = layers.Conv2D(16, 3, activation="relu", padding="same", name="enc1_conv2")(c1)
    p1 = layers.MaxPooling2D((2, 2), name="enc1_pool")(c1)

    c2 = layers.Conv2D(32, 3, activation="relu", padding="same", name="enc2_conv1")(p1)
    c2 = layers.BatchNormalization(name="enc2_bn")(c2)
    c2 = layers.Conv2D(32, 3, activation="relu", padding="same", name="enc2_conv2")(c2)
    p2 = layers.MaxPooling2D((2, 2), name="enc2_pool")(c2)

    c3 = layers.Conv2D(64, 3, activation="relu", padding="same", name="enc3_conv1")(p2)
    c3 = layers.BatchNormalization(name="enc3_bn")(c3)
    c3 = layers.Conv2D(64, 3, activation="relu", padding="same", name="enc3_conv2")(c3)
    p3 = layers.MaxPooling2D((2, 2), name="enc3_pool")(c3)

    b = layers.Conv2D(128, 3, activation="relu", padding="same", name="bottleneck_conv1")(p3)
    b = layers.Dropout(0.2, name="bottleneck_drop")(b)
    b = layers.Conv2D(128, 3, activation="relu", padding="same", name="bottleneck_conv2")(b)

    u3 = layers.Conv2DTranspose(64, (2, 2), strides=(2, 2), padding="same", name="dec3_up")(b)
    u3 = layers.concatenate([u3, c3], name="dec3_concat")
    u3 = layers.Conv2D(64, 3, activation="relu", padding="same", name="dec3_conv1")(u3)
    u3 = layers.Conv2D(64, 3, activation="relu", padding="same", name="dec3_conv2")(u3)

    u2 = layers.Conv2DTranspose(32, (2, 2), strides=(2, 2), padding="same", name="dec2_up")(u3)
    u2 = layers.concatenate([u2, c2], name="dec2_concat")
    u2 = layers.Conv2D(32, 3, activation="relu", padding="same", name="dec2_conv1")(u2)
    u2 = layers.Conv2D(32, 3, activation="relu", padding="same", name="dec2_conv2")(u2)

    u1 = layers.Conv2DTranspose(16, (2, 2), strides=(2, 2), padding="same", name="dec1_up")(u2)
    u1 = layers.concatenate([u1, c1], name="dec1_concat")
    u1 = layers.Conv2D(16, 3, activation="relu", padding="same", name="dec1_conv1")(u1)
    u1 = layers.Conv2D(16, 3, activation="relu", padding="same", name="dec1_conv2")(u1)

    outputs = layers.Conv2D(num_classes, 1, activation="sigmoid", name="lesion_masks")(u1)
    return keras.Model(inputs=inputs, outputs=outputs, name="Mritidhristi_IDRiD_UNet")


# ---------------------------------------------------------------------------
# IMPROVED PREPROCESSING: Area-Preserving Box Downsampling & Contrast Normalize
# ---------------------------------------------------------------------------
def load_sample_improved(img_path, gt_dir, target_size=TARGET_SIZE):
    """
    Loads retinal fundus image and its 4 lesion groundtruth masks with:
    1. Illumination/contrast equalization (ImageOps.autocontrast) on green/RGB.
    2. Area-preserving Box downsampling for binary ground truth masks,
       preventing decimation of punctate microaneurysms and micro-hemorrhages.
    """
    img_id = os.path.splitext(os.path.basename(img_path))[0]
    with Image.open(img_path) as pil_img:
        xmin, ymin, xmax, ymax = get_fov_bbox(pil_img)
        # Apply gentle autocontrast to balance illumination across dark peripheral retina
        pil_img_enhanced = ImageOps.autocontrast(pil_img, cutoff=1)
        cropped_img = pil_img_enhanced.crop((xmin, ymin, xmax, ymax)).resize(target_size, Image.Resampling.LANCZOS)
        img_arr = np.array(cropped_img.convert("RGB"), dtype=np.float32) / 255.0

    lesion_masks = []
    for lkey, lfolder, lsuffix in LESION_CONFIG:
        mpath = os.path.join(gt_dir, lfolder, f"{img_id}{lsuffix}")
        if os.path.exists(mpath):
            with Image.open(mpath) as mimg:
                # Convert to grayscale 2D array regardless of original TIFF mode (P, L, RGB, RGBA)
                mimg_l = mimg.convert("L")
                raw = (np.array(mimg_l) > 0).astype(np.uint8) * 255
                ml = Image.fromarray(raw)
                # Crop and resize using area-averaging BOX filter to preserve sparse punctate lesions
                cm = ml.crop((xmin, ymin, xmax, ymax)).resize(target_size, Image.Resampling.BOX)
                marr = (np.array(cm) > 0).astype(np.float32)
        else:
            marr = np.zeros(target_size, dtype=np.float32)
        lesion_masks.append(marr)

    mask_arr = np.stack(lesion_masks, axis=-1)  # (256, 256, 4)
    return img_arr, mask_arr


def load_dataset_improved(img_dir, gt_dir):
    """Loads all scans and corresponding 4-channel masks with improved preprocessing."""
    img_paths = sorted(glob.glob(os.path.join(img_dir, "*.jpg")))
    images = []
    masks = []
    ids = []
    print(f"[*] [Improved Loader] Loading {len(img_paths)} scans from {img_dir}...")
    for p in img_paths:
        img_id = os.path.splitext(os.path.basename(p))[0]
        img_arr, mask_arr = load_sample_improved(p, gt_dir)
        images.append(img_arr)
        masks.append(mask_arr)
        ids.append(img_id)
    return np.array(images, dtype=np.float32), np.array(masks, dtype=np.float32), ids


def augment_batch_improved(images, masks, rng):
    """Applies synchronized geometric & photometric augmentation."""
    aug_images = []
    aug_masks = []
    for img, msk in zip(images, masks):
        cur_img = img.copy()
        cur_msk = msk.copy()
        # Random horizontal flip
        if rng.random() > 0.5:
            cur_img = np.fliplr(cur_img)
            cur_msk = np.fliplr(cur_msk)
        # Random vertical flip
        if rng.random() > 0.5:
            cur_img = np.flipud(cur_img)
            cur_msk = np.flipud(cur_msk)
        # Random 90-degree rotation
        k = rng.choice([0, 1, 2, 3])
        if k > 0:
            cur_img = np.rot90(cur_img, k)
            cur_msk = np.rot90(cur_msk, k)
        # Small photometric brightness jitter (+- 8%)
        brightness_factor = 1.0 + rng.uniform(-0.08, 0.08)
        cur_img = np.clip(cur_img * brightness_factor, 0.0, 1.0)
        aug_images.append(cur_img)
        aug_masks.append(cur_msk)
    return np.array(aug_images, dtype=np.float32), np.array(aug_masks, dtype=np.float32)


# ---------------------------------------------------------------------------
# IMPROVED LOSS FUNCTIONS: Asymmetric Focal Tversky + Pixel Focal Loss
# ---------------------------------------------------------------------------
def focal_tversky_loss(y_true, y_pred, alpha=0.75, beta=0.25, gamma=1.0, eps=1e-6):
    """
    Asymmetric Focal Tversky Loss:
    - alpha=0.75 penalizes False Negatives (FN) 3x more heavily than False Positives (FP),
      critical for recovering sparse microaneurysms and faint hemorrhages.
    - Class weights prioritize MA (2.0) and HE (1.5) over EX (1.0) and SE (1.2).
    """
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
    weighted_loss = tf.reduce_mean(tversky_loss * class_weights)
    return weighted_loss


def binary_focal_loss(y_true, y_pred, gamma=2.0, alpha=0.75, eps=1e-7):
    """Pixel-wise Focal Loss suppressing easy negative background gradients."""
    y_pred_c = tf.clip_by_value(y_pred, eps, 1.0 - eps)
    p_t = y_true * y_pred_c + (1.0 - y_true) * (1.0 - y_pred_c)
    alpha_t = y_true * alpha + (1.0 - y_true) * (1.0 - alpha)
    focal_weight = alpha_t * tf.pow(1.0 - p_t, gamma)
    loss = -focal_weight * tf.math.log(p_t)
    return tf.reduce_mean(loss)


def improved_combined_loss(y_true, y_pred):
    """
    Combined Loss:
    - 1.0 * Focal Tversky Loss (asymmetric penalty on false negatives)
    - 0.5 * Binary Focal Loss (suppressing background gradient domination)
    """
    ftl = focal_tversky_loss(y_true, y_pred, alpha=0.75, beta=0.25)
    bfl = binary_focal_loss(y_true, y_pred, gamma=2.0, alpha=0.75)
    return ftl + 0.5 * bfl


# ---------------------------------------------------------------------------
# IMPROVED ARCHITECTURE: Residual Convolutional U-Net with Skip Connections
# ---------------------------------------------------------------------------
def build_improved_unet(input_shape=(256, 256, 3), num_classes=NUM_CLASSES):
    """
    Constructs an enhanced Residual U-Net:
    - Residual conv blocks (skip addition) to stabilize gradient flow.
    - Expanded channel capacity (32 -> 64 -> 128 -> 256).
    - Bottleneck dropout (0.25) to prevent overfitting on 44 training images.
    - Transpose convolutions for smooth spatial decoding.
    """
    inputs = layers.Input(shape=input_shape, name="retinal_input")

    def res_block(x, filters, name_prefix):
        shortcut = layers.Conv2D(filters, 1, padding="same", name=f"{name_prefix}_sc")(x)
        c = layers.Conv2D(filters, 3, padding="same", name=f"{name_prefix}_c1")(x)
        c = layers.BatchNormalization(name=f"{name_prefix}_bn1")(c)
        c = layers.Activation("relu", name=f"{name_prefix}_act1")(c)
        c = layers.Conv2D(filters, 3, padding="same", name=f"{name_prefix}_c2")(c)
        c = layers.BatchNormalization(name=f"{name_prefix}_bn2")(c)
        add = layers.add([shortcut, c], name=f"{name_prefix}_add")
        return layers.Activation("relu", name=f"{name_prefix}_out")(add)

    # Encoder Level 1 (256 -> 128)
    e1 = res_block(inputs, 32, "enc1")
    p1 = layers.MaxPooling2D((2, 2), name="enc1_pool")(e1)

    # Encoder Level 2 (128 -> 64)
    e2 = res_block(p1, 64, "enc2")
    p2 = layers.MaxPooling2D((2, 2), name="enc2_pool")(e2)

    # Encoder Level 3 (64 -> 32)
    e3 = res_block(p2, 128, "enc3")
    p3 = layers.MaxPooling2D((2, 2), name="enc3_pool")(e3)

    # Bottleneck Level 4 (32 -> 32)
    b = res_block(p3, 256, "bottleneck")
    b = layers.Dropout(0.25, name="bottleneck_drop")(b)

    # Decoder Level 3 (32 -> 64)
    u3 = layers.Conv2DTranspose(128, (2, 2), strides=(2, 2), padding="same", name="dec3_up")(b)
    u3 = layers.concatenate([u3, e3], name="dec3_concat")
    d3 = res_block(u3, 128, "dec3")

    # Decoder Level 2 (64 -> 128)
    u2 = layers.Conv2DTranspose(64, (2, 2), strides=(2, 2), padding="same", name="dec2_up")(d3)
    u2 = layers.concatenate([u2, e2], name="dec2_concat")
    d2 = res_block(u2, 64, "dec2")

    # Decoder Level 1 (128 -> 256)
    u1 = layers.Conv2DTranspose(32, (2, 2), strides=(2, 2), padding="same", name="dec1_up")(d2)
    u1 = layers.concatenate([u1, e1], name="dec1_concat")
    d1 = res_block(u1, 32, "dec1")

    # Lesion prediction head
    h = layers.Conv2D(16, 3, padding="same", activation="relu", name="head_conv")(d1)
    outputs = layers.Conv2D(num_classes, 1, activation="sigmoid", name="lesion_masks")(h)

    model = keras.Model(inputs=inputs, outputs=outputs, name="Mritidhristi_IDRiD_UNet_Improved")
    return model


# ---------------------------------------------------------------------------
# Training Pipelines
# ---------------------------------------------------------------------------
def train_unet(epochs=20, batch_size=4, lr=1e-3):
    """Trains baseline U-Net (preserved)."""
    set_seed(SEED)
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)

    X_all, Y_all, all_ids = load_dataset(TRAIN_IMG_DIR, TRAIN_GT_DIR)
    rng = np.random.RandomState(SEED)
    indices = np.arange(len(X_all))
    rng.shuffle(indices)
    val_indices = indices[:10]
    train_indices = indices[10:]

    X_train, Y_train = X_all[train_indices], Y_all[train_indices]
    X_val, Y_val = X_all[val_indices], Y_all[val_indices]

    aug_X, aug_Y = augment_batch(X_train, Y_train, rng)
    X_train_full = np.concatenate([X_train, aug_X], axis=0)
    Y_train_full = np.concatenate([Y_train, aug_Y], axis=0)

    model = build_lightweight_unet(input_shape=(256, 256, 3), num_classes=NUM_CLASSES)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=lr),
        loss=combined_dice_bce_loss,
        metrics=[mean_dice_coef],
    )

    checkpoint_path = os.path.join(CHECKPOINTS_DIR, "best_lesion_unet.keras")
    callbacks = [
        keras.callbacks.ModelCheckpoint(checkpoint_path, monitor="val_loss", save_best_only=True, verbose=1),
        keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=4, min_lr=1e-5, verbose=1),
    ]

    history = model.fit(
        X_train_full, Y_train_full,
        validation_data=(X_val, Y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )

    final_model_path = os.path.join(MODELS_DIR, "idrid_unet_lesions.keras")
    model.save(final_model_path)
    return model, {}, history.history


def train_improved_unet(epochs=25, batch_size=4, lr=1e-3):
    """
    Trains Improved Residual U-Net with:
    1. Area-preserving Box downsampling ground truths.
    2. Asymmetric Focal Tversky + Focal Loss.
    3. Reproducible 44/10 split on official 54 training images.
    4. Validation-based threshold calibration.
    """
    set_seed(SEED)
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(CHECKPOINTS_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    os.makedirs(OVERLAYS_DIR, exist_ok=True)

    print("===================================================================")
    print(" MITRA DRISHTI: TRAINING IMPROVED RESIDUAL U-NET (APEXFORGE 2K26)")
    print("===================================================================")

    # 1. Load 54 training images with improved area-preserving loader
    X_all, Y_all, all_ids = load_dataset_improved(TRAIN_IMG_DIR, TRAIN_GT_DIR)
    print(f"[+] Loaded {len(X_all)} training scans (Shape: {X_all.shape}, Masks: {Y_all.shape})")

    # 2. Reproducible 44 train / 10 val split (Seed 42)
    rng = np.random.RandomState(SEED)
    indices = np.arange(len(X_all))
    rng.shuffle(indices)
    val_indices = indices[:10]
    train_indices = indices[10:]

    X_train, Y_train = X_all[train_indices], Y_all[train_indices]
    X_val, Y_val = X_all[val_indices], Y_all[val_indices]
    print(f"[*] Training split: {len(X_train)} scans | Validation split: {len(X_val)} scans (unaugmented)")

    # 3. Apply synchronized augmentation only to training split
    aug_X, aug_Y = augment_batch_improved(X_train, Y_train, rng)
    X_train_full = np.concatenate([X_train, aug_X], axis=0)
    Y_train_full = np.concatenate([Y_train, aug_Y], axis=0)
    print(f"[*] Augmented training dataset: {len(X_train_full)} scans (2x augmentation)")

    # 4. Build improved Residual U-Net architecture
    model = build_improved_unet(input_shape=(256, 256, 3), num_classes=NUM_CLASSES)
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=lr),
        loss=improved_combined_loss,
        metrics=[mean_dice_coef],
    )
    model.summary(print_fn=lambda x: None)  # Verify build

    # 5. Training Callbacks
    checkpoint_path = os.path.join(CHECKPOINTS_DIR, "best_lesion_unet_improved.keras")
    callbacks = [
        keras.callbacks.ModelCheckpoint(
            checkpoint_path,
            monitor="val_loss",
            save_best_only=True,
            verbose=1,
        ),
        keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-5,
            verbose=1,
        ),
    ]

    print(f"[*] Starting training for {epochs} epochs (batch size: {batch_size}, initial lr: {lr})...")
    t0 = time.time()
    history = model.fit(
        X_train_full,
        Y_train_full,
        validation_data=(X_val, Y_val),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=callbacks,
        verbose=1,
    )
    duration = time.time() - t0
    print(f"[+] Improved U-Net training completed in {duration:.1f} seconds ({duration/60:.2f} mins).")

    # Load best checkpoint weights
    if os.path.exists(checkpoint_path):
        print(f"[*] Restoring best checkpoint weights from {checkpoint_path}...")
        model = keras.models.load_model(
            checkpoint_path,
            custom_objects={
                "improved_combined_loss": improved_combined_loss,
                "focal_tversky_loss": focal_tversky_loss,
                "binary_focal_loss": binary_focal_loss,
                "mean_dice_coef": mean_dice_coef,
            },
        )

    # 6. Save Final Model Artifacts
    final_model_path = os.path.join(MODELS_DIR, "idrid_unet_lesions_improved.keras")
    model.save(final_model_path)

    with open(final_model_path, "rb") as f:
        model_sha256 = hashlib.sha256(f.read()).hexdigest()

    history_dict = {k: [float(v) for v in vals] for k, vals in history.history.items()}
    history_dict["training_duration_seconds"] = round(duration, 2)
    history_dict["epochs_completed"] = len(history.history["loss"])
    with open(os.path.join(MODELS_DIR, "unet_improved_training_history.json"), "w", encoding="utf-8") as f:
        json.dump(history_dict, f, indent=2)

    # 7. Calibrate Operating Thresholds on held-out 10 Validation Scans
    print("\n[*] Calibrating per-class operating thresholds on held-out validation scans...")
    calibrated_thresholds = calibrate_validation_thresholds(model, X_val, Y_val)

    config = {
        "model_name": "Mritidhristi-IDRiD-UNet-Lesions-Improved",
        "architecture": "Enhanced Residual Convolutional U-Net with Skip Connections",
        "input_shape": list(TARGET_SIZE) + [3],
        "num_classes": NUM_CLASSES,
        "classes": LESION_KEYS,
        "class_descriptions": LESION_NAMES,
        "training_samples": len(X_train_full),
        "validation_samples": len(X_val),
        "batch_size": batch_size,
        "initial_lr": lr,
        "loss_function": "Combined Asymmetric Focal Tversky Loss (alpha=0.75, beta=0.25) + 0.5 * Binary Focal Loss",
        "calibrated_thresholds": calibrated_thresholds,
        "sha256": model_sha256,
        "saved_at": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }
    with open(os.path.join(MODELS_DIR, "unet_improved_model_config.json"), "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)

    print(f"[+] Improved U-Net model and config saved to {final_model_path} (SHA-256: {model_sha256[:16]}...)")
    return model, config, history_dict, calibrated_thresholds


def calibrate_validation_thresholds(model, X_val, Y_val):
    """
    Calibrates per-class optimal binarization thresholds on held-out validation split.
    Sweeps thresholds in [0.05, 0.50] and selects the threshold maximizing Dice score.
    """
    val_preds = model.predict(X_val, batch_size=2, verbose=0)
    best_thresholds = {}

    for c_idx, lkey in enumerate(LESION_KEYS):
        y_true_c = Y_val[..., c_idx]
        pred_c = val_preds[..., c_idx]

        best_dice = -1.0
        best_t = 0.25

        for t in np.arange(0.05, 0.55, 0.05):
            t = round(float(t), 2)
            y_pred_bin = (pred_c > t).astype(np.float32)
            tp = np.sum((y_true_c == 1.0) & (y_pred_bin == 1.0))
            fp = np.sum((y_true_c == 0.0) & (y_pred_bin == 1.0))
            fn = np.sum((y_true_c == 1.0) & (y_pred_bin == 0.0))
            dice = (2.0 * tp + 1e-6) / (2.0 * tp + fp + fn + 1e-6)
            if dice > best_dice:
                best_dice = dice
                best_t = t

        best_thresholds[lkey] = {
            "optimal_threshold": best_t,
            "validation_dice": round(float(best_dice), 4),
        }
        print(f"  [Calibrated] {lkey}: Optimal Threshold = {best_t:.2f} (Validation Dice: {best_dice:.4f})")

    return best_thresholds


# ---------------------------------------------------------------------------
# Test Evaluation (Untouched 27 Testing Scans)
# ---------------------------------------------------------------------------
def evaluate_test_set(model=None):
    """Evaluates baseline model on official 27 test scans (preserved)."""
    if model is None:
        model_path = os.path.join(MODELS_DIR, "idrid_unet_lesions.keras")
        model = keras.models.load_model(
            model_path,
            custom_objects={
                "combined_dice_bce_loss": combined_dice_bce_loss,
                "mean_dice_coef": mean_dice_coef,
                "soft_dice_loss": soft_dice_loss,
            },
        )

    X_test, Y_test, test_ids = load_dataset(TEST_IMG_DIR, TEST_GT_DIR)
    preds = model.predict(X_test, batch_size=4, verbose=0)
    threshold = 0.35

    results_per_class = {}
    for c_idx, (lkey, lname) in enumerate(zip(LESION_KEYS, LESION_NAMES)):
        y_t = Y_test[:, :, :, c_idx]
        y_p = (preds[:, :, :, c_idx] > threshold).astype(np.float32)
        tp = np.sum((y_t == 1.0) & (y_p == 1.0))
        fp = np.sum((y_t == 0.0) & (y_p == 1.0))
        fn = np.sum((y_t == 1.0) & (y_p == 0.0))

        dice = (2.0 * tp + 1e-6) / (2.0 * tp + fp + fn + 1e-6)
        iou = (tp + 1e-6) / (tp + fp + fn + 1e-6)
        precision = (tp + 1e-6) / (tp + fp + 1e-6)
        recall = (tp + 1e-6) / (tp + fn + 1e-6)

        results_per_class[lkey] = {
            "name": lname,
            "dice": round(float(dice), 4),
            "iou": round(float(iou), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "total_true_pixels": int(tp + fn),
            "total_pred_pixels": int(tp + fp),
        }

    mean_dice = np.mean([v["dice"] for v in results_per_class.values()])
    mean_iou = np.mean([v["iou"] for v in results_per_class.values()])

    report = {
        "evaluation_cohort": "IDRiD Official Testing Set (A. Segmentation/b. Testing Set)",
        "test_sample_count": len(X_test),
        "operating_threshold": threshold,
        "mean_dice": round(float(mean_dice), 4),
        "mean_iou": round(float(mean_iou), 4),
        "per_class_results": results_per_class,
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }
    return report


def evaluate_improved_test_set(model=None, calibrated_thresholds=None):
    """
    Evaluates Improved Residual U-Net on the untouched 27 IDRiD test scans.
    Uses calibrated validation thresholds and computes complete per-lesion metrics.
    """
    print("===================================================================")
    print(" MITRA DRISHTI: EVALUATING IMPROVED U-NET ON 27 OFFICIAL TEST SCANS")
    print("===================================================================")

    if model is None:
        model_path = os.path.join(MODELS_DIR, "idrid_unet_lesions_improved.keras")
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        print(f"[*] Loading trained improved U-Net from {model_path}...")
        model = keras.models.load_model(
            model_path,
            custom_objects={
                "improved_combined_loss": improved_combined_loss,
                "focal_tversky_loss": focal_tversky_loss,
                "binary_focal_loss": binary_focal_loss,
                "mean_dice_coef": mean_dice_coef,
            },
        )

    if calibrated_thresholds is None:
        config_path = os.path.join(MODELS_DIR, "unet_improved_model_config.json")
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                calibrated_thresholds = cfg.get("calibrated_thresholds", {})
        if not calibrated_thresholds:
            calibrated_thresholds = {k: {"optimal_threshold": 0.25} for k in LESION_KEYS}

    # Load 27 official test images with improved area-preserving loader
    X_test, Y_test, test_ids = load_dataset_improved(TEST_IMG_DIR, TEST_GT_DIR)
    print(f"[*] Running Improved U-Net inference on {len(X_test)} test scans...")

    t0 = time.time()
    preds = model.predict(X_test, batch_size=2, verbose=1)
    inference_time = (time.time() - t0) / len(X_test)
    print(f"[+] Average inference time per test scan: {inference_time*1000:.1f} ms")

    results_per_class = {}
    for c_idx, (lkey, lname) in enumerate(zip(LESION_KEYS, LESION_NAMES)):
        th_info = calibrated_thresholds.get(lkey, {})
        threshold = th_info.get("optimal_threshold", 0.25)

        y_t = Y_test[:, :, :, c_idx]
        y_p = (preds[:, :, :, c_idx] > threshold).astype(np.float32)

        tp = np.sum((y_t == 1.0) & (y_p == 1.0))
        fp = np.sum((y_t == 0.0) & (y_p == 1.0))
        fn = np.sum((y_t == 1.0) & (y_p == 0.0))
        tn = np.sum((y_t == 0.0) & (y_p == 0.0))

        dice = (2.0 * tp + 1e-6) / (2.0 * tp + fp + fn + 1e-6)
        iou = (tp + 1e-6) / (tp + fp + fn + 1e-6)
        precision = (tp + 1e-6) / (tp + fp + 1e-6)
        recall = (tp + 1e-6) / (tp + fn + 1e-6)

        results_per_class[lkey] = {
            "name": lname,
            "calibrated_threshold": threshold,
            "dice": round(float(dice), 4),
            "iou": round(float(iou), 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "tp": int(tp),
            "fp": int(fp),
            "fn": int(fn),
            "total_true_pixels": int(tp + fn),
            "total_pred_pixels": int(tp + fp),
        }

    mean_dice = np.mean([v["dice"] for v in results_per_class.values()])
    mean_iou = np.mean([v["iou"] for v in results_per_class.values()])

    # Load baseline report for comparison
    baseline_report_path = os.path.join(REPORTS_DIR, "idrid_lesion_segmentation_report.json")
    baseline_metrics = {}
    if os.path.exists(baseline_report_path):
        with open(baseline_report_path, "r", encoding="utf-8") as f:
            baseline_data = json.load(f)
            baseline_metrics = baseline_data.get("per_class_results", {})

    report = {
        "evaluation_cohort": "IDRiD Official Testing Set (A. Segmentation/b. Testing Set)",
        "model_evaluated": "models/idrid_unet_lesions_improved.keras",
        "test_sample_count": len(X_test),
        "mean_dice": round(float(mean_dice), 4),
        "mean_iou": round(float(mean_iou), 4),
        "per_class_results": results_per_class,
        "baseline_comparison": {
            "baseline_mean_dice": 0.0859,
            "baseline_mean_iou": 0.0480,
            "improvement_mean_dice_pct": round(float((mean_dice - 0.0859) / 0.0859 * 100), 2) if mean_dice > 0 else 0.0,
        },
        "evaluation_timestamp": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    }

    # Save JSON report
    json_path = os.path.join(REPORTS_DIR, "unet_improvement_evaluation.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n===================================================================")
    print(f" IMPROVED U-NET TEST RESULTS SUMMARY")
    print(f"===================================================================")
    print(f"  Mean Dice Score: {mean_dice:.4f} (Baseline: 0.0859)")
    print(f"  Mean IoU Score:  {mean_iou:.4f} (Baseline: 0.0480)")
    for lk, res in results_per_class.items():
        base_dice = baseline_metrics.get(lk, {}).get("dice", 0.0)
        print(f"  - {res['name']}: Dice = {res['dice']:.4f} (Baseline: {base_dice:.4f}) | IoU = {res['iou']:.4f} | Recall = {res['recall']:.4f} | Precision = {res['precision']:.4f}")

    return report, X_test, Y_test, preds, test_ids


def generate_visual_test_overlays(X_test, Y_test, preds, test_ids, calibrated_thresholds, max_scans=6):
    """
    Generates visual overlay comparison figures for test scans and saves to reports/unet_improvement_test_overlays/.
    """
    os.makedirs(OVERLAYS_DIR, exist_ok=True)
    colors = {
        "MA": (255, 0, 255),   # Magenta
        "HE": (255, 40, 40),   # Red
        "EX": (255, 230, 0),   # Yellow
        "SE": (0, 230, 255),   # Cyan
    }

    print(f"[*] Generating visual overlay comparisons for {min(max_scans, len(X_test))} test scans...")
    for i in range(min(max_scans, len(X_test))):
        img_id = test_ids[i]
        orig_img_arr = (X_test[i] * 255.0).astype(np.uint8)
        orig_pil = Image.fromarray(orig_img_arr)

        # Build Ground Truth Overlay
        gt_overlay = orig_img_arr.copy()
        for c_idx, lkey in enumerate(LESION_KEYS):
            gt_mask = Y_test[i, :, :, c_idx] == 1.0
            if np.any(gt_mask):
                color = colors[lkey]
                for ch in range(3):
                    gt_overlay[gt_mask, ch] = (0.4 * gt_overlay[gt_mask, ch] + 0.6 * color[ch]).astype(np.uint8)

        # Build Predicted Overlay
        pred_overlay = orig_img_arr.copy()
        for c_idx, lkey in enumerate(LESION_KEYS):
            th = calibrated_thresholds.get(lkey, {}).get("optimal_threshold", 0.25)
            pred_mask = preds[i, :, :, c_idx] > th
            if np.any(pred_mask):
                color = colors[lkey]
                for ch in range(3):
                    pred_overlay[pred_mask, ch] = (0.4 * pred_overlay[pred_mask, ch] + 0.6 * color[ch]).astype(np.uint8)

        # Combine into side-by-side composite: [Original | Ground Truth | Prediction]
        w, h = TARGET_SIZE
        composite = Image.new("RGB", (w * 3 + 40, h + 50), (20, 24, 33))
        composite.paste(orig_pil, (10, 35))
        composite.paste(Image.fromarray(gt_overlay), (w + 20, 35))
        composite.paste(Image.fromarray(pred_overlay), (2 * w + 30, 35))

        out_path = os.path.join(OVERLAYS_DIR, f"{img_id}_segmentation_comparison.png")
        composite.save(out_path)
        print(f"  [+] Saved overlay: {out_path}")


if __name__ == "__main__":
    if "--evaluate-only" in sys.argv:
        print("[*] Running test evaluation only with saved baseline model...")
        eval_report = evaluate_test_set(model=None)
    elif "--evaluate-improved" in sys.argv:
        print("[*] Running test evaluation with improved model...")
        config_path = os.path.join(MODELS_DIR, "unet_improved_model_config.json")
        calib_th = {}
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                calib_th = json.load(f).get("calibrated_thresholds", {})
        eval_report, X_t, Y_t, p_t, t_ids = evaluate_improved_test_set()
        generate_visual_test_overlays(X_t, Y_t, p_t, t_ids, calib_th, max_scans=6)
    else:
        # Train improved model
        trained_model, config, history, calib_th = train_improved_unet(epochs=25, batch_size=4, lr=1e-3)
        eval_report, X_t, Y_t, p_t, t_ids = evaluate_improved_test_set(trained_model, calib_th)
        generate_visual_test_overlays(X_t, Y_t, p_t, t_ids, calib_th, max_scans=6)
    print("\n[✓] IDRiD Lesion Segmentation Pipeline Executed Successfully!")
