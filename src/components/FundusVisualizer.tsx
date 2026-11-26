import React, { useEffect, useRef } from 'react';
import type { RetinalLandmarks, UnetSegmentationResult } from '../types/domain';
import {
  renderSyntheticFundusToCanvas,
  type RetinalPresetKey,
} from '../utils/retinalPipeline';

interface FundusVisualizerProps {
  preset: 'normal_demo' | 'moderate_npdr_demo' | 'ungradable_blur_demo' | 'uploaded_custom';
  imageDataUrl?: string;
  stage?: 'raw' | 'preprocessed' | 'anatomy' | 'lesions' | 'gradcam';
  gradCamOpacity?: number;
  hotspots?: { x: number; y: number; radius: number; intensity: number }[];
  landmarks?: RetinalLandmarks;
  unetSegmentation?: UnetSegmentationResult;
  size?: number;
  className?: string;
  label?: string;
}

export const FundusVisualizer: React.FC<FundusVisualizerProps> = ({
  preset,
  imageDataUrl,
  stage = 'raw',
  gradCamOpacity = 0.62,
  hotspots,
  landmarks,
  unetSegmentation,
  size = 320,
  className = '',
  label,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (preset === 'uploaded_custom' && imageDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#070B11';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.save();
        if (stage === 'preprocessed') {
          ctx.filter = 'contrast(1.25) saturate(1.12) brightness(1.04)';
        }
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = (canvas.width - dw) / 2;
        const dy = (canvas.height - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        ctx.filter = 'none';

        // Stage 3: Anatomy (Optic Disc and Fovea Landmark Overlay)
        if (stage === 'anatomy' && landmarks?.available && landmarks.opticDisc && landmarks.fovea) {
          const ox = dx + landmarks.opticDisc.normalizedX * dw;
          const oy = dy + landmarks.opticDisc.normalizedY * dh;
          const fx = dx + landmarks.fovea.normalizedX * dw;
          const fy = dy + landmarks.fovea.normalizedY * dh;

          // Connecting line
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(ox, oy);
          ctx.lineTo(fx, fy);
          ctx.stroke();
          ctx.setLineDash([]);

          // Optic Disc Marker (Cyan ring + crosshair)
          ctx.strokeStyle = '#06B6D4';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(ox, oy, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(ox - 24, oy);
          ctx.lineTo(ox + 24, oy);
          ctx.moveTo(ox, oy - 24);
          ctx.lineTo(ox, oy + 24);
          ctx.stroke();

          // Optic Disc Badge
          ctx.fillStyle = 'rgba(8, 145, 178, 0.9)';
          ctx.fillRect(ox + 6, oy - 30, 84, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`OD: ${Math.round(landmarks.opticDisc.x)},${Math.round(landmarks.opticDisc.y)}`, ox + 9, oy - 17);

          // Fovea Marker (Amber ring + crosshair)
          ctx.strokeStyle = '#F59E0B';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(fx, fy, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(fx - 18, fy);
          ctx.lineTo(fx + 18, fy);
          ctx.moveTo(fx, fy - 18);
          ctx.lineTo(fx, fy + 18);
          ctx.stroke();

          // Fovea Badge
          ctx.fillStyle = 'rgba(217, 119, 6, 0.9)';
          ctx.fillRect(fx + 6, fy - 28, 88, 18);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`Fov: ${Math.round(landmarks.fovea.x)},${Math.round(landmarks.fovea.y)}`, fx + 9, fy - 15);

          // Information Badge
          ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
          ctx.fillRect(8, 8, 204, 38);
          ctx.strokeStyle = '#38BDF8';
          ctx.lineWidth = 1;
          ctx.strokeRect(8, 8, 204, 38);
          ctx.fillStyle = '#38BDF8';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText(`Inter-Landmark: ${landmarks.distancePx || Math.round(Math.hypot(landmarks.opticDisc.x - landmarks.fovea.x, landmarks.opticDisc.y - landmarks.fovea.y))} px`, 14, 22);
          ctx.fillStyle = '#94A3B8';
          ctx.font = '9px sans-serif';
          ctx.fillText(`Laterality: ${landmarks.inferredEyeSide || 'OD'} · Plausible: ${landmarks.isAnatomicallyPlausible ? 'Yes' : 'Review'}`, 14, 36);
        }

        // Stage 4: Actual U-Net Lesion Segmentation Overlay
        if (stage === 'lesions' && unetSegmentation?.available && unetSegmentation.overlayDataUrl) {
          const unetImg = new Image();
          unetImg.onload = () => {
            ctx.save();
            ctx.globalAlpha = 0.90;
            ctx.drawImage(unetImg, dx, dy, dw, dh);

            // Color legend badge
            ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
            ctx.fillRect(8, 8, 208, 48);
            ctx.strokeStyle = '#64748B';
            ctx.lineWidth = 1;
            ctx.strokeRect(8, 8, 208, 48);
            ctx.font = 'bold 9px sans-serif';

            ctx.fillStyle = '#FF00FF';
            ctx.fillText('■ MA (0.25)', 14, 22);
            ctx.fillStyle = '#FF2828';
            ctx.fillText('■ HE (0.10)', 82, 22);
            ctx.fillStyle = '#FFE600';
            ctx.fillText('■ EX (0.05)', 146, 22);

            ctx.fillStyle = '#00E6FF';
            ctx.fillText('■ SE (0.50)', 14, 40);
            ctx.fillStyle = '#CBD5E1';
            ctx.font = '8px monospace';
            ctx.fillText(`U-Net: ${unetSegmentation.totalLesionPixels ?? 0} px`, 82, 40);

            ctx.restore();
          };
          unetImg.src = unetSegmentation.overlayDataUrl;
        }

        // Stage 6: Grad-CAM Explainability Hotspots
        if (stage === 'gradcam' && hotspots && hotspots.length > 0) {
          for (const spot of hotspots) {
            const sx = spot.x * canvas.width;
            const sy = spot.y * canvas.height;
            const sr = spot.radius * canvas.width;
            const grad = ctx.createRadialGradient(sx, sy, 2, sx, sy, sr);
            grad.addColorStop(0, `rgba(239,68,68,${gradCamOpacity * spot.intensity})`);
            grad.addColorStop(0.45, `rgba(250,204,21,${gradCamOpacity * spot.intensity * 0.7})`);
            grad.addColorStop(1, 'rgba(37,99,235,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sx, sy, sr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      };
      img.src = imageDataUrl;
      return;
    }

    const demoPreset: RetinalPresetKey =
      preset === 'uploaded_custom' ? 'normal_demo' : preset;
    renderSyntheticFundusToCanvas(canvas, demoPreset, {
      stage,
      gradCamOpacity,
      hotspots,
    });
  }, [preset, imageDataUrl, stage, gradCamOpacity, hotspots, landmarks, unetSegmentation]);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-[#070B11] ${className}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="block h-full w-full object-contain"
        aria-label={label || 'Retinal fundus visualization'}
      />
      {label && (
        <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg bg-slate-950/75 px-2.5 py-1 text-[11px] font-medium text-slate-100 backdrop-blur-xs">
          <span className="truncate">{label}</span>
        </div>
      )}
    </div>
  );
};
