import React, { useEffect, useRef } from 'react';
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
        ctx.drawImage(img, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
        ctx.filter = 'none';

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
  }, [preset, imageDataUrl, stage, gradCamOpacity, hotspots]);

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
