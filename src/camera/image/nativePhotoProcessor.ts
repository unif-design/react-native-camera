import type { CameraOrientation } from 'react-native-vision-camera';
import NativePhotoProcessor from '../../NativePhotoProcessor';
import type { AspectRatio, WatermarkType } from '../../utils';

export type PhotoFileMetadata = {
  width: number;
  height: number;
  orientation: CameraOrientation;
};

export type PhotoFileProcessingRequest = {
  inputPath: string;
  outputPath: string;
  aspectRatio: AspectRatio;
  targetWidth: number;
  targetHeight: number;
  quality: number;
  watermark?: WatermarkType;
};

export type PhotoProcessingDiagnostics = {
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  sampled: boolean;
  durationMs: number;
};

export type PhotoFileProcessingResult = {
  width: number;
  height: number;
  diagnostics: PhotoProcessingDiagnostics;
};

type NativePhotoProcessingStage =
  | 'read'
  | 'decode'
  | 'surface'
  | 'crop'
  | 'watermark'
  | 'encode'
  | 'write';

function parseObject(raw: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(raw);
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid native photo processor response');
  }
  return parsed as Record<string, unknown>;
}

function positiveDimension(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Invalid native photo dimensions');
  }
  return Math.round(value);
}

function finiteDuration(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function cameraOrientation(value: unknown): CameraOrientation {
  switch (value) {
    case 'up':
    case 'right':
    case 'down':
    case 'left':
      return value;
    default:
      throw new Error('Invalid native photo orientation');
  }
}

export async function inspectPhotoFile(
  inputPath: string
): Promise<PhotoFileMetadata> {
  const parsed = parseObject(
    await NativePhotoProcessor.inspectPhotoFile(inputPath)
  );
  return {
    width: positiveDimension(parsed.width),
    height: positiveDimension(parsed.height),
    orientation: cameraOrientation(parsed.orientation),
  };
}

export async function processPhotoFile(
  request: PhotoFileProcessingRequest
): Promise<PhotoFileProcessingResult> {
  const parsed = parseObject(
    await NativePhotoProcessor.processPhoto(
      request.inputPath,
      request.outputPath,
      request.aspectRatio,
      request.targetWidth,
      request.targetHeight,
      request.quality,
      JSON.stringify(request.watermark ?? null)
    )
  );
  const diagnosticsRaw =
    parsed.diagnostics != null && typeof parsed.diagnostics === 'object'
      ? (parsed.diagnostics as Record<string, unknown>)
      : parsed;
  const result: PhotoFileProcessingResult = {
    width: positiveDimension(parsed.width),
    height: positiveDimension(parsed.height),
    diagnostics: {
      inputWidth: positiveDimension(diagnosticsRaw.inputWidth),
      inputHeight: positiveDimension(diagnosticsRaw.inputHeight),
      outputWidth: positiveDimension(diagnosticsRaw.outputWidth),
      outputHeight: positiveDimension(diagnosticsRaw.outputHeight),
      sampled: diagnosticsRaw.sampled === true,
      durationMs: finiteDuration(diagnosticsRaw.durationMs),
    },
  };
  return result;
}

export function nativePhotoProcessingStage(
  error: unknown
): NativePhotoProcessingStage | null {
  if (error == null || typeof error !== 'object') return null;
  const code = String((error as { code?: unknown }).code ?? '');
  const stages: Record<string, NativePhotoProcessingStage> = {
    E_PHOTO_READ: 'read',
    E_PHOTO_DECODE: 'decode',
    E_PHOTO_ALLOCATE: 'surface',
    E_PHOTO_CROP: 'crop',
    E_PHOTO_WATERMARK: 'watermark',
    E_PHOTO_ENCODE: 'encode',
    E_PHOTO_WRITE: 'write',
  };
  return stages[code] ?? null;
}
