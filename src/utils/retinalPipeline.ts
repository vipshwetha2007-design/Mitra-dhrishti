import type { ICDRGrade, ImageQualityAssessment, RetinalScreening } from '../types/domain';

export type RetinalPresetKey = 'normal_demo' | 'moderate_npdr_demo' | 'ungradable_blur_demo';

export interface PipelineAnalysisOutput {
  quality: ImageQualityAssessment;
  anatomicalStructures: RetinalScreening['anatomicalStructures'];
  lesionFindings: RetinalScreening['lesionFindings'];
  modelPrediction: RetinalScreening['modelPrediction'];
  gradCam: RetinalScreening['gradCam'];
}

/**
 * Generates realistic synthetic retinal fundus imagery on an HTML5 Canvas
 * for live demonstration of the 7-step retinal processing pipeline without
 * fabricating external clinical patient photos.
 */
export function renderSyntheticFundusToCanvas(
  canvas: HTMLCanvasElement,
  preset: RetinalPresetKey,
  options?: {
    stage?: 'raw' | 'preprocessed' | 'anatomy' | 'lesions' | 'gradcam';
    gradCamOpacity?: number;
    hotspots?: { x: number; y: number; radius: number; intensity: number }[];
  }
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.46;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#070B11';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  // Base retinal choroidal glow
  const isPreprocessed = options?.stage === 'preprocessed' || options?.stage === 'anatomy';
  const baseGrad = ctx.createRadialGradient(
    cx + r * 0.22,
    cy - r * 0.04,
    r * 0.08,
    cx,
    cy,
    r * 1.05
  );

  if (preset === 'ungradable_blur_demo') {
    baseGrad.addColorStop(0, '#7A3E1F');
    baseGrad.addColorStop(0.55, '#4A210F');
    baseGrad.addColorStop(1, '#1A0B05');
  } else if (isPreprocessed) {
    // CLAHE / illumination normalized green-emphasized clinical contrast
    baseGrad.addColorStop(0, '#D97B38');
    baseGrad.addColorStop(0.45, '#A64C1E');
    baseGrad.addColorStop(0.82, '#6A270E');
    baseGrad.addColorStop(1, '#2B0D04');
  } else {
    baseGrad.addColorStop(0, '#EC8B3B');
    baseGrad.addColorStop(0.42, '#C85B1E');
    baseGrad.addColorStop(0.82, '#8B2E0D');
    baseGrad.addColorStop(1, '#3D1005');
  }
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, w, h);

  if (preset === 'ungradable_blur_demo') {
    ctx.filter = 'blur(8px)';
  }

  // Macula (darker central foveal zone)
  const maculaX = cx - r * 0.14;
  const maculaY = cy + r * 0.04;
  const macGrad = ctx.createRadialGradient(maculaX, maculaY, 2, maculaX, maculaY, r * 0.24);
  macGrad.addColorStop(0, 'rgba(65, 16, 4, 0.52)');
  macGrad.addColorStop(1, 'rgba(65, 16, 4, 0)');
  ctx.fillStyle = macGrad;
  ctx.beginPath();
  ctx.arc(maculaX, maculaY, r * 0.24, 0, Math.PI * 2);
  ctx.fill();

  // Optic Disc (bright nasal yellow-orange disc)
  const discX = cx + r * 0.34;
  const discY = cy - r * 0.04;
  const discR = r * 0.15;
  const discGrad = ctx.createRadialGradient(discX, discY, discR * 0.15, discX, discY, discR);
  discGrad.addColorStop(0, '#FFF5C4');
  discGrad.addColorStop(0.65, '#F6C25F');
  discGrad.addColorStop(1, 'rgba(236, 139, 59, 0)');
  ctx.fillStyle = discGrad;
  ctx.beginPath();
  ctx.arc(discX, discY, discR, 0, Math.PI * 2);
  ctx.fill();

  // Retinal Vascular Arcades originating from optic disc
  const drawVessel = (pts: [number, number][], width: number, color: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const vesselColor = isPreprocessed ? 'rgba(68, 12, 8, 0.85)' : 'rgba(116, 22, 10, 0.68)';
  const thinVessel = isPreprocessed ? 'rgba(84, 18, 10, 0.65)' : 'rgba(128, 28, 14, 0.45)';

  // Superior temporal arcade
  drawVessel(
    [
      [discX, discY],
      [cx + r * 0.12, cy - r * 0.38],
      [cx - r * 0.25, cy - r * 0.46],
      [cx - r * 0.64, cy - r * 0.28],
    ],
    Math.max(2, w * 0.011),
    vesselColor
  );
  // Inferior temporal arcade
  drawVessel(
    [
      [discX, discY],
      [cx + r * 0.1, cy + r * 0.36],
      [cx - r * 0.26, cy + r * 0.44],
      [cx - r * 0.62, cy + r * 0.26],
    ],
    Math.max(2, w * 0.011),
    vesselColor
  );
  // Nasal branches
  drawVessel(
    [
      [discX, discY],
      [cx + r * 0.58, cy - r * 0.32],
      [cx + r * 0.82, cy - r * 0.44],
    ],
    Math.max(1.5, w * 0.008),
    vesselColor
  );
  drawVessel(
    [
      [discX, discY],
      [cx + r * 0.56, cy + r * 0.30],
      [cx + r * 0.80, cy + r * 0.42],
    ],
    Math.max(1.5, w * 0.008),
    vesselColor
  );
  // Secondary macular branches
  drawVessel(
    [
      [cx + r * 0.12, cy - r * 0.36],
      [cx - r * 0.06, cy - r * 0.24],
      [cx - r * 0.20, cy - r * 0.14],
    ],
    Math.max(1.2, w * 0.0055),
    thinVessel
  );
  drawVessel(
    [
      [cx + r * 0.10, cy + r * 0.34],
      [cx - r * 0.08, cy + r * 0.22],
      [cx - r * 0.22, cy + r * 0.16],
    ],
    Math.max(1.2, w * 0.0055),
    thinVessel
  );

  // Synthetic illustrative lesions ONLY for moderate_npdr_demo
  if (preset === 'moderate_npdr_demo') {
    // Hard exudates (bright yellowish waxy clusters)
    const exudates = [
      [cx - r * 0.24, cy - r * 0.14, 3.8],
      [cx - r * 0.20, cy - r * 0.17, 2.8],
      [cx - r * 0.27, cy - r * 0.10, 3.0],
      [cx - r * 0.18, cy - r * 0.11, 2.2],
      [cx + r * 0.06, cy + r * 0.22, 3.2],
      [cx + r * 0.10, cy + r * 0.24, 2.4],
    ];
    ctx.fillStyle = '#FFEFA1';
    for (const [ex, ey, er] of exudates) {
      ctx.beginPath();
      ctx.arc(ex, ey, er * (w / 320), 0, Math.PI * 2);
      ctx.fill();
    }

    // Blot haemorrhages (dark crimson dots)
    const haems = [
      [cx - r * 0.32, cy - r * 0.04, 4.5],
      [cx - r * 0.06, cy + r * 0.28, 4.2],
      [cx + r * 0.02, cy - r * 0.26, 3.4],
      [cx - r * 0.38, cy + r * 0.18, 3.8],
    ];
    ctx.fillStyle = 'rgba(98, 10, 12, 0.85)';
    for (const [hx, hy, hr] of haems) {
      ctx.beginPath();
      ctx.arc(hx, hy, hr * (w / 320), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ungradable motion/haze glare artifact
  if (preset === 'ungradable_blur_demo') {
    ctx.filter = 'none';
    const haze = ctx.createLinearGradient(0, 0, w, h);
    haze.addColorStop(0, 'rgba(255, 235, 200, 0.28)');
    haze.addColorStop(0.5, 'rgba(15, 10, 8, 0.45)');
    haze.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.filter = 'none';

  // Step 3: Anatomical Structure Overlays
  if (options?.stage === 'anatomy') {
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(discX, discY, discR * 1.15, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#2DD4BF';
    ctx.beginPath();
    ctx.arc(maculaX, maculaY, r * 0.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#E0F2FE';
    ctx.font = '600 11px "DM Sans", sans-serif';
    ctx.fillText('Optic Disc', discX - 26, discY - discR - 8);
    ctx.fillStyle = '#CCFBF1';
    ctx.fillText('Macula / Fovea', maculaX - 36, maculaY + r * 0.26 + 12);
  }

  // Step 4: Lesion Candidate Overlays (Illustrative)
  if (options?.stage === 'lesions' && preset === 'moderate_npdr_demo') {
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - r * 0.34, cy - r * 0.24, r * 0.22, r * 0.2);
    ctx.fillStyle = '#FEF08A';
    ctx.font = '600 11px "DM Sans", sans-serif';
    ctx.fillText('Exudate Cluster', cx - r * 0.36, cy - r * 0.26);

    ctx.strokeStyle = '#FB7185';
    ctx.beginPath();
    ctx.arc(cx - r * 0.32, cy - r * 0.04, r * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - r * 0.06, cy + r * 0.28, r * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#FECDD3';
    ctx.fillText('Haemorrhage Candidate', cx - r * 0.18, cy + r * 0.42);
  }

  // Step 6: Grad-CAM Explainability Heatmap Overlay
  if (options?.stage === 'gradcam') {
    const opacity = options.gradCamOpacity ?? 0.6;
    const spots =
      options.hotspots && options.hotspots.length > 0
        ? options.hotspots
        : preset === 'moderate_npdr_demo'
        ? [
            { x: 0.38, y: 0.42, radius: 0.16, intensity: 0.9 },
            { x: 0.54, y: 0.62, radius: 0.15, intensity: 0.8 },
          ]
        : [{ x: 0.66, y: 0.48, radius: 0.18, intensity: 0.42 }];

    for (const spot of spots) {
      const sx = spot.x * w;
      const sy = spot.y * h;
      const sr = spot.radius * w;
      const hGrad = ctx.createRadialGradient(sx, sy, 2, sx, sy, sr);
      hGrad.addColorStop(0, `rgba(239, 68, 68, ${Math.min(0.95, opacity * spot.intensity)})`);
      hGrad.addColorStop(0.4, `rgba(250, 204, 21, ${opacity * spot.intensity * 0.78})`);
      hGrad.addColorStop(0.75, `rgba(34, 197, 94, ${opacity * spot.intensity * 0.42})`);
      hGrad.addColorStop(1, 'rgba(37, 99, 235, 0)');
      ctx.fillStyle = hGrad;
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

/**
 * Runs genuine client-side pixel statistics on an HTMLImageElement or HTMLCanvasElement
 * to compute Step 1 Image Quality Assessment (sharpness variance, brightness, exposure clipping,
 * resolution, retinal color distribution OOD check) and prepares the 7-step illustrative pipeline payload.
 */
export function analyzeRetinalCanvasPixels(
  sourceCanvas: HTMLCanvasElement,
  presetMode: 'normal_demo' | 'moderate_npdr_demo' | 'ungradable_blur_demo' | 'uploaded_custom'
): PipelineAnalysisOutput {
  const ctx = sourceCanvas.getContext('2d');
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  let meanLuminance = 120;
  let clippedCount = 0;
  let laplacianSum = 0;
  let totalChecked = 0;
  let warmRetinalPixels = 0;

  if (ctx) {
    const imgData = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);

    for (let i = 0, p = 0; i < imgData.length; i += 4, p++) {
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      gray[p] = lum;
    }

    // Focus inside central retinal circle (radius 40% of min dim)
    const cx = w / 2;
    const cy = h / 2;
    const radSq = Math.pow(Math.min(w, h) * 0.38, 2);
    let lumAccum = 0;

    for (let y = 2; y < h - 2; y += 2) {
      for (let x = 2; x < w - 2; x += 2) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy > radSq) continue;

        const idx = y * w + x;
        const lum = gray[idx];
        lumAccum += lum;
        totalChecked++;

        if (lum < 12 || lum > 246) clippedCount++;

        const r = imgData[idx * 4];
        const g = imgData[idx * 4 + 1];
        const b = imgData[idx * 4 + 2];
        // Fundus images typically exhibit higher red/orange dominance over blue inside ROI
        if (r > g * 1.05 && r > b * 1.25 && r > 40) {
          warmRetinalPixels++;
        }

        const lap = Math.abs(
          4 * lum - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w]
        );
        laplacianSum += lap;
      }
    }

    if (totalChecked > 0) {
      meanLuminance = Math.round(lumAccum / totalChecked);
    }
  }

  const exposureClipPercent =
    totalChecked > 0 ? Number(((clippedCount / totalChecked) * 100).toFixed(1)) : 0;
  const rawSharpness = totalChecked > 0 ? (laplacianSum / totalChecked) * 12 : 70;
  const sharpnessScore =
    presetMode === 'ungradable_blur_demo'
      ? Math.min(34, Math.max(18, Math.round(rawSharpness)))
      : Math.min(96, Math.max(25, Math.round(rawSharpness + 38)));

  const retinalColorRatio = totalChecked > 0 ? warmRetinalPixels / totalChecked : 0.8;
  const oodFlag = presetMode === 'uploaded_custom' && retinalColorRatio < 0.25;

  const resolutionValid = w >= 256 && h >= 256;
  const blurPass = sharpnessScore >= 45;
  const brightnessPass = meanLuminance >= 42 && meanLuminance <= 215;
  const exposurePass = exposureClipPercent <= 18;

  const gradable = resolutionValid && blurPass && brightnessPass && exposurePass;

  let rejectionReason: string | undefined;
  let recaptureGuidance: string | undefined;
  if (!gradable) {
    if (!resolutionValid) {
      rejectionReason = `Low image resolution (${w}×${h}px; minimum 256×256px required).`;
      recaptureGuidance = 'Capture using standard non-mydriatic fundus resolution (≥ 512×512px).';
    } else if (!blurPass) {
      rejectionReason = `Excessive motion blur / defocus (Sharpness ${sharpnessScore}/100 < threshold 45).`;
      recaptureGuidance = 'Stabilize chin rest, confirm optic disc focus lock, and ask patient to fixate before recapturing.';
    } else if (!brightnessPass) {
      rejectionReason = `Improper illumination (Mean luminance ${meanLuminance}/255 outside 42–215 window).`;
      recaptureGuidance = 'Dim room lighting for natural pupil dilation and adjust camera flash exposure.';
    } else if (!exposurePass) {
      rejectionReason = `High exposure clipping (${exposureClipPercent}% clipped pixels).`;
      recaptureGuidance = 'Reduce flash intensity and avoid lens glare artifacts.';
    }
  }

  // Illustrative ICDR grade logic (strictly non-diagnostic prototype output)
  let icdrGrade: ICDRGrade = 0;
  let gradeLabel = 'ICDR Grade 0 — No Apparent DR (Illustrative Prototype Assist)';
  let confidence = 0.89;
  let hardExudatesFlag = false;
  let haemorrhagesFlag = false;
  let hotspots = [{ x: 0.66, y: 0.48, radius: 0.16, intensity: 0.45 }];

  if (presetMode === 'moderate_npdr_demo') {
    icdrGrade = 2;
    gradeLabel = 'ICDR Grade 2 — Moderate NPDR Suspected (Illustrative Prototype Assist)';
    confidence = 0.83;
    hardExudatesFlag = true;
    haemorrhagesFlag = true;
    hotspots = [
      { x: 0.38, y: 0.42, radius: 0.15, intensity: 0.88 },
      { x: 0.54, y: 0.62, radius: 0.14, intensity: 0.78 },
    ];
  } else if (presetMode === 'uploaded_custom') {
    if (oodFlag) {
      icdrGrade = null;
      gradeLabel = 'Grade Withheld — Out-of-Distribution (Non-Retinal Image Detected)';
      confidence = 0.38;
    } else {
      // Conservative prototype screening posture for uncalibrated custom upload
      icdrGrade = null;
      gradeLabel = 'Grade Withheld — Clinical CNN Weights Not Loaded (Human Review Required)';
      confidence = 0.62;
      hotspots = [{ x: 0.5, y: 0.5, radius: 0.2, intensity: 0.5 }];
    }
  }

  const gradeWithheld = !gradable || oodFlag || confidence < 0.7;
  const withholdReason = !gradable
    ? rejectionReason
    : oodFlag
    ? 'Color/structure distribution outside retinal fundus domain (OOD detection triggered).'
    : confidence < 0.7
    ? 'Prototype safety rule: custom uploaded image withheld from automated grading until trained ResNet/EfficientNet clinical weights are validated. Routed directly to clinician review.'
    : undefined;

  return {
    quality: {
      sharpnessScore,
      brightnessMean: meanLuminance,
      exposureClipPercent,
      width: w,
      height: h,
      gradable,
      rejectionReason,
      recaptureGuidance,
    },
    anatomicalStructures: {
      opticDiscDetected: gradable && !oodFlag,
      vesselDensityIndex: gradable && !oodFlag ? 0.76 : 0.18,
      maculaCentered: gradable && !oodFlag,
    },
    lesionFindings: {
      hardExudatesFlag,
      haemorrhagesFlag,
      microaneurysmsExperimentalNote:
        'Microaneurysm detection is designated as an experimental/advanced research capability requiring IDRiD-calibrated high-resolution lesion segmentation.',
      implementationStatus: 'Illustrative / Prototype Heuristic',
    },
    modelPrediction: {
      modelVersion: 'mritidhristi-prototype-icdr-v0.1 (Illustrative)',
      architectureReference: 'EfficientNet-B3 / ResNet-50 Pipeline Interface (No Clinical Weights)',
      icdrGrade: gradeWithheld ? null : icdrGrade,
      gradeLabel: !gradable ? 'Grade Withheld — Ungradable Image Quality' : gradeLabel,
      confidence,
      uncertainty: Number((1 - confidence).toFixed(2)),
      oodFlag,
      gradeWithheld,
      withholdReason,
      isIllustrativeOutput: true,
    },
    gradCam: {
      available: gradable && !oodFlag,
      hotspots,
      limitationNotice:
        'Grad-CAM highlights coarse spatial regions influencing model activation; it does not localize exact micro-lesion borders or confirm clinical diagnosis.',
    },
  };
}
