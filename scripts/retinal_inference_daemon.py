#!/usr/bin/env python3
"""
MITRA DRISHTI — PREVENT • DETECT • PROTECT
Persistent Retinal Deep-Learning Inference Daemon
Component: DETECT Resident AI Worker (Eliminates Cold-Start 60s Timeouts)

Architectural Role:
Maintains resident in-memory instances of:
1. MobileNetV2 DR Severity Classifier (dr_classifier_improved.keras)
2. MobileNetV2 CoordConv Landmark Localizer (optic_disc_fovea_localizer.keras)
3. Enhanced Residual U-Net Multi-Lesion Segmenter (idrid_unet_lesions_improved.keras)

Communication Protocol:
Line-delimited JSON IPC over stdin/stdout with Express backend (server.ts):
- On startup: Preloads & warms models, then writes:
    {"status": "ready", "pid": <pid>, "activeModel": "dr_classifier_improved.keras"}\n
- Per request: Reads:
    {"id": "<uuid>", "imageDataUrl": "<data_url>"}\n
- Responds with:
    {"id": "<uuid>", "success": true, ...}\n (Average warm latency: 2.5 - 4.5 seconds)
"""

import os
import sys
import json
import time

# Ensure workspace-local configuration and module paths
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, SCRIPTS_DIR)

os.environ["KERAS_HOME"] = os.path.abspath(os.path.join(ROOT_DIR, ".keras"))
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

import numpy as np
from PIL import Image
import tensorflow as tf
import keras

from scripts.retinal_inference_engine import (
    get_inference_models,
    run_retinal_inference,
    _LOADED_MODEL,
    _ACTIVE_MODEL_PATH,
)
from scripts.optic_disc_fovea_inference import get_localizer_model
from scripts.lesion_segmentation_engine import get_unet_model


def main():
    t_start = time.time()
    sys.stderr.write("[*] Initializing MITRA DRISHTI persistent retinal inference daemon...\n")
    sys.stderr.flush()

    try:
        # Preload all deep-learning models into resident RAM
        t0 = time.time()
        get_inference_models()
        sys.stderr.write(f"    [+] MobileNetV2 DR Classifier pre-loaded ({time.time() - t0:.2f}s)\n")
        sys.stderr.flush()

        t0 = time.time()
        get_localizer_model()
        sys.stderr.write(f"    [+] CoordConv Landmark Localizer pre-loaded ({time.time() - t0:.2f}s)\n")
        sys.stderr.flush()

        t0 = time.time()
        get_unet_model()
        sys.stderr.write(f"    [+] Residual U-Net Lesion Segmenter pre-loaded ({time.time() - t0:.2f}s)\n")
        sys.stderr.flush()

        # Warm up graph execution with dummy fundus crop
        dummy_fundus = Image.new("RGB", (512, 512), color=(130, 45, 18))
        run_retinal_inference(dummy_fundus)
        sys.stderr.write(f"[+] All models warmed up in {time.time() - t_start:.2f}s. Ready for requests.\n")
        sys.stderr.flush()

    except Exception as exc:
        err_msg = {"status": "error", "error": f"Model preloading failed: {str(exc)}"}
        sys.stdout.write(json.dumps(err_msg) + "\n")
        sys.stdout.flush()
        sys.exit(1)

    # Emit ready signal to Express backend
    ready_msg = {
        "status": "ready",
        "pid": os.getpid(),
        "activeModel": os.path.basename(_ACTIVE_MODEL_PATH) if _ACTIVE_MODEL_PATH else "dr_classifier_improved.keras",
        "warmupDurationMs": round((time.time() - t_start) * 1000, 1),
    }
    sys.stdout.write(json.dumps(ready_msg) + "\n")
    sys.stdout.flush()

    # Process requests from stdin
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        req_id = None
        try:
            req_data = json.loads(line)
            req_id = req_data.get("id")

            # Check for shutdown command
            if req_data.get("command") == "shutdown":
                sys.stderr.write("[*] Inference daemon received shutdown command.\n")
                sys.stdout.write(json.dumps({"id": req_id, "status": "shutdown_ack"}) + "\n")
                sys.stdout.flush()
                break

            image_input = (
                req_data.get("imageDataUrl")
                or req_data.get("imagePath")
                or req_data.get("image")
            )

            if not image_input:
                err_resp = {"id": req_id, "success": False, "error": "Missing imageDataUrl or imagePath"}
                sys.stdout.write(json.dumps(err_resp) + "\n")
                sys.stdout.flush()
                continue

            t_req = time.time()
            result = run_retinal_inference(image_input)
            result["id"] = req_id
            result["residentDaemonLatencyMs"] = round((time.time() - t_req) * 1000, 1)

            sys.stdout.write(json.dumps(result) + "\n")
            sys.stdout.flush()

        except Exception as exc:
            err_resp = {
                "id": req_id,
                "success": False,
                "error": f"Inference daemon failed to process request: {str(exc)}"
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

    sys.stderr.write("[*] Retinal inference daemon exited cleanly.\n")


if __name__ == "__main__":
    main()
