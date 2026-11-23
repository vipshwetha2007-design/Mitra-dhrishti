/**
 * MRITIDHRISTI — PREVENT • DETECT • PROTECT
 * Fundus Camera Compatibility Registry & Device Calibration Engine
 * File: src/services/cameraRegistry.ts
 * Problem Statement: SIH26038 — Explainable AI for DR Screening in Rural India
 */

export interface CameraProfile {
  id: string;
  name: string;
  manufacturer: string;
  countryOfOrigin: string;
  category: 'portable_handheld' | 'compact_phc' | 'robotic_hospital' | 'tertiary_reference';
  fovDegrees: number;
  minPupilDiameterMm: number;
  nativeResolution: { width: number; height: number };
  deploymentTier: 'Tier 1: Rural Field / Mobile Van' | 'Tier 2: Primary Health Centre (PHC)' | 'Tier 3: District Hospital';
  calibration: {
    apertureMaskRadiusFraction: number;
    chromaticBalanceScale: { r: number; g: number; b: number };
    minSharpnessLaplacianVar: number;
    maxExposureClipPercent: number;
    minMeanLuminance: number;
    maxMeanLuminance: number;
  };
  supportedFormat: string[];
  fieldTestingStatus: 'Clinically Validated' | 'Bench Tested' | 'Evaluation In-Progress';
}

export const FUNDUS_CAMERA_REGISTRY: CameraProfile[] = [
  {
    id: 'cam-forus-3nethra',
    name: '3nethra Classic',
    manufacturer: 'Forus Health',
    countryOfOrigin: 'India',
    category: 'compact_phc',
    fovDegrees: 45,
    minPupilDiameterMm: 3.5,
    nativeResolution: { width: 2048, height: 1536 },
    deploymentTier: 'Tier 2: Primary Health Centre (PHC)',
    calibration: {
      apertureMaskRadiusFraction: 0.485,
      chromaticBalanceScale: { r: 1.0, g: 1.02, b: 0.98 },
      minSharpnessLaplacianVar: 11.5,
      maxExposureClipPercent: 3.5,
      minMeanLuminance: 16.0,
      maxMeanLuminance: 235.0,
    },
    supportedFormat: ['JPEG', 'PNG', 'DICOM'],
    fieldTestingStatus: 'Clinically Validated',
  },
  {
    id: 'cam-remidio-fop',
    name: 'Fundus on Phone (FOP NM-10)',
    manufacturer: 'Remidio Innovative Solutions',
    countryOfOrigin: 'India',
    category: 'portable_handheld',
    fovDegrees: 45,
    minPupilDiameterMm: 3.3,
    nativeResolution: { width: 1920, height: 1080 },
    deploymentTier: 'Tier 1: Rural Field / Mobile Van',
    calibration: {
      apertureMaskRadiusFraction: 0.470,
      chromaticBalanceScale: { r: 1.04, g: 1.0, b: 0.96 },
      minSharpnessLaplacianVar: 10.0,
      maxExposureClipPercent: 4.0,
      minMeanLuminance: 15.0,
      maxMeanLuminance: 240.0,
    },
    supportedFormat: ['JPEG', 'PNG'],
    fieldTestingStatus: 'Clinically Validated',
  },
  {
    id: 'cam-volk-inview',
    name: 'Volk iNView / VistaView',
    manufacturer: 'Volk Optical',
    countryOfOrigin: 'USA',
    category: 'portable_handheld',
    fovDegrees: 50,
    minPupilDiameterMm: 3.5,
    nativeResolution: { width: 2048, height: 1536 },
    deploymentTier: 'Tier 1: Rural Field / Mobile Van',
    calibration: {
      apertureMaskRadiusFraction: 0.460,
      chromaticBalanceScale: { r: 1.02, g: 0.98, b: 1.0 },
      minSharpnessLaplacianVar: 9.5,
      maxExposureClipPercent: 4.5,
      minMeanLuminance: 14.0,
      maxMeanLuminance: 240.0,
    },
    supportedFormat: ['JPEG', 'PNG'],
    fieldTestingStatus: 'Bench Tested',
  },
  {
    id: 'cam-topcon-nw400',
    name: 'TRC-NW400 Robotic Non-Mydriatic',
    manufacturer: 'Topcon Healthcare',
    countryOfOrigin: 'Japan',
    category: 'robotic_hospital',
    fovDegrees: 45,
    minPupilDiameterMm: 3.3,
    nativeResolution: { width: 2592, height: 1944 },
    deploymentTier: 'Tier 3: District Hospital',
    calibration: {
      apertureMaskRadiusFraction: 0.490,
      chromaticBalanceScale: { r: 1.0, g: 1.0, b: 1.0 },
      minSharpnessLaplacianVar: 13.0,
      maxExposureClipPercent: 2.5,
      minMeanLuminance: 18.0,
      maxMeanLuminance: 230.0,
    },
    supportedFormat: ['JPEG', 'PNG', 'DICOM', 'TIFF'],
    fieldTestingStatus: 'Clinically Validated',
  },
  {
    id: 'cam-zeiss-visucam',
    name: 'Visucam 500 / 524',
    manufacturer: 'Carl Zeiss Meditec',
    countryOfOrigin: 'Germany',
    category: 'tertiary_reference',
    fovDegrees: 45,
    minPupilDiameterMm: 3.0,
    nativeResolution: { width: 2880, height: 2160 },
    deploymentTier: 'Tier 3: District Hospital',
    calibration: {
      apertureMaskRadiusFraction: 0.495,
      chromaticBalanceScale: { r: 1.0, g: 1.0, b: 1.0 },
      minSharpnessLaplacianVar: 14.0,
      maxExposureClipPercent: 2.0,
      minMeanLuminance: 20.0,
      maxMeanLuminance: 225.0,
    },
    supportedFormat: ['JPEG', 'TIFF', 'DICOM'],
    fieldTestingStatus: 'Clinically Validated',
  },
];

export function getCameraProfile(cameraId: string): CameraProfile {
  const found = FUNDUS_CAMERA_REGISTRY.find((c) => c.id === cameraId);
  return found || FUNDUS_CAMERA_REGISTRY[0]; // Default to Forus 3nethra
}
