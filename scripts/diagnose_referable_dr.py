#!/usr/bin/env python3
"""
MITRA DRISHTI — Diagnostic & Decision Threshold Analysis for Referable DR
Evaluates the existing MobileNetV2 model on the VALIDATION split (val.csv, 373 scans)
to analyze referable DR sensitivity vs specificity, identify optimal clinical screening threshold,
and evaluate generalizability on the untouched held-out test split (test.csv, 660 scans).
"""

import os
import sys

# Add repo root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Force Keras Home to workspace BEFORE any imports of tensorflow or keras
os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"

import json
import numpy as np
from tensorflow import keras
from sklearn.metrics import confusion_matrix, roc_curve, auc, roc_auc_score, cohen_kappa_score

from scripts.train_cnn import load_split_dataset, DEFAULT_ARROW_PATH, NUM_CLASSES, ICDR_MAPPING

def analyze_split(model, split_name):
    print(f"\n=======================================================")
    print(f" ANALYZING SPLIT: {split_name.upper()}")
    print(f"=======================================================")
    X, y = load_split_dataset(split_name, DEFAULT_ARROW_PATH, is_training=False)
    probs = model.predict(X, batch_size=32, verbose=0)
    
    # 1. Standard Argmax 5-class predictions
    y_pred_argmax = np.argmax(probs, axis=1)
    
    # Referable ground truth: Grade >= 2
    y_ref_true = (y >= 2).astype(int)
    
    # Argmax referable: Grade >= 2
    y_ref_argmax = (y_pred_argmax >= 2).astype(int)
    cm_argmax = confusion_matrix(y_ref_true, y_ref_argmax)
    sens_argmax = cm_argmax[1, 1] / max(1, cm_argmax[1, 0] + cm_argmax[1, 1])
    spec_argmax = cm_argmax[0, 0] / max(1, cm_argmax[0, 0] + cm_argmax[0, 1])
    
    print(f"\n[1] Default Argmax Triage (y_pred >= 2):")
    print(f"    - Sensitivity: {sens_argmax * 100:.2f}% ({cm_argmax[1,1]}/{cm_argmax[1,0]+cm_argmax[1,1]})")
    print(f"    - Specificity: {spec_argmax * 100:.2f}% ({cm_argmax[0,0]}/{cm_argmax[0,0]+cm_argmax[0,1]})")
    print(f"    - Confusion Matrix [ [TN={cm_argmax[0,0]}, FP={cm_argmax[0,1]}], [FN={cm_argmax[1,0]}, TP={cm_argmax[1,1]}] ]")
    
    # 2. Probability of Referable DR: sum of classes 2, 3, 4
    # P(Referable) = p2 + p3 + p4 = 1 - (p0 + p1)
    p_referable = np.sum(probs[:, 2:], axis=1)
    
    # ROC analysis for referable DR
    fpr, tpr, thresholds = roc_curve(y_ref_true, p_referable)
    roc_auc = auc(fpr, tpr)
    print(f"\n[2] Binary Referable DR ROC-AUC: {roc_auc:.4f}")
    
    # Threshold sweep table
    print(f"\n[3] Threshold Sweep for P(Referable DR) >= tau:")
    print(f"    {'Threshold (tau)':<16} | {'Sensitivity':<14} | {'Specificity':<14} | {'TP':<6} | {'FP':<6} | {'FN':<6} | {'TN':<6}")
    print("    " + "-" * 85)
    
    best_tau = None
    best_score = -1
    
    candidate_taus = [0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]
    sweep_results = []
    for tau in candidate_taus:
        y_pred_tau = (p_referable >= tau).astype(int)
        cm_tau = confusion_matrix(y_ref_true, y_pred_tau)
        sens = cm_tau[1, 1] / max(1, cm_tau[1, 0] + cm_tau[1, 1])
        spec = cm_tau[0, 0] / max(1, cm_tau[0, 0] + cm_tau[0, 1])
        print(f"    {tau:<16.2f} | {sens*100:<13.2f}% | {spec*100:<13.2f}% | {cm_tau[1,1]:<6} | {cm_tau[0,1]:<6} | {cm_tau[1,0]:<6} | {cm_tau[0,0]:<6}")
        sweep_results.append({
            "tau": tau,
            "sensitivity": sens,
            "specificity": spec,
            "tp": int(cm_tau[1,1]), "fp": int(cm_tau[0,1]),
            "fn": int(cm_tau[1,0]), "tn": int(cm_tau[0,0])
        })
        
        # Clinical criteria: Sensitivity >= 90% and Specificity >= 85%
        if sens >= 0.90 and spec >= 0.85:
            # Objective: balanced harmonic mean (F-score) or sensitivity priority
            score = 2 * (sens * spec) / (sens + spec)
            if score > best_score:
                best_score = score
                best_tau = tau
                
    return probs, y, p_referable, sweep_results, best_tau

def main():
    model_path = os.path.join("models", "dr_classifier.keras")
    print(f"[*] Loading model from {model_path}...")
    model = keras.models.load_model(model_path)
    
    # Step 1: Tune / Select threshold STRICTLY on the VALIDATION split
    val_probs, val_y, val_pref, val_sweep, val_best_tau = analyze_split(model, "val")
    print(f"\n[*] VALIDATION SELECTION RESULT:")
    print(f"    Optimal Threshold meeting SIH target (Sens >= 90%, Spec >= 85%) on Validation Set: tau = {val_best_tau}")
    
    # Step 2: Evaluate the validation-selected threshold on the UNTOUCHED HELD-OUT TEST split
    test_probs, test_y, test_pref, test_sweep, _ = analyze_split(model, "test")
    
    if val_best_tau is not None:
        y_ref_test_true = (test_y >= 2).astype(int)
        y_ref_test_pred = (test_pref >= val_best_tau).astype(int)
        cm_test = confusion_matrix(y_ref_test_true, y_ref_test_pred)
        sens_test = cm_test[1, 1] / max(1, cm_test[1, 0] + cm_test[1, 1])
        spec_test = cm_test[0, 0] / max(1, cm_test[0, 0] + cm_test[0, 1])
        print(f"\n=======================================================")
        print(f" GENERALIZATION TO UNTOUCHED HELD-OUT TEST SET (tau = {val_best_tau}):")
        print(f"=======================================================")
        print(f"    - Test Sensitivity: {sens_test * 100:.2f}% (Target: > 90%)")
        print(f"    - Test Specificity: {spec_test * 100:.2f}% (Target: > 85%)")
        print(f"    - Test TP: {cm_test[1, 1]} / {cm_test[1, 0] + cm_test[1, 1]}")
        print(f"    - Test TN: {cm_test[0, 0]} / {cm_test[0, 0] + cm_test[0, 1]}")
        print(f"    - Test FP: {cm_test[0, 1]} (False Alarms)")
        print(f"    - Test FN: {cm_test[1, 0]} (Missed Referrals)")
        print(f"=======================================================")

if __name__ == "__main__":
    main()
