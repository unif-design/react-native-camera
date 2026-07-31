import type {
  CameraMode,
  CameraModeName,
  CameraResult,
  CameraType,
  DataRetainedMode,
  FlashMode,
  OpenConfig,
  WatermarkType,
} from './interface';

type ValidationResult =
  | { ok: true; config: OpenConfig }
  | { ok: false; result: CameraResult };

const CAMERA_MODES: readonly CameraModeName[] = [
  'single',
  'continuous',
  'video',
];
const CAMERA_TYPES: readonly CameraType[] = ['back', 'front'];
const FLASH_MODES: readonly FlashMode[] = ['auto', 'on', 'off'];
const DATA_RETAINED_MODES: readonly DataRetainedMode[] = ['clear', 'retain'];
const WATERMARK_POSITIONS: readonly NonNullable<WatermarkType['position']>[] = [
  'top-left',
  'top-center',
  'top-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];
const PHOTO_QUALITY_PRIORITIZATIONS: readonly NonNullable<
  OpenConfig['photoQualityPrioritization']
>[] = ['speed', 'balanced', 'quality'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[]
): value is T {
  return typeof value === 'string' && options.includes(value as T);
}

function isOptionalOneOf<T extends string>(
  value: unknown,
  options: readonly T[]
): value is T | undefined {
  return value === undefined || isOneOf(value, options);
}

function isFiniteInRange(
  value: unknown,
  min: number,
  max: number
): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function isOptionalPositiveFinite(value: unknown): value is number | undefined {
  return (
    value === undefined ||
    (typeof value === 'number' && Number.isFinite(value) && value > 0)
  );
}

function normalizeCameraMode(value: unknown): CameraMode | null {
  if (
    !isRecord(value) ||
    !isOneOf(value.mode, CAMERA_MODES) ||
    !isOptionalOneOf(value.type, CAMERA_TYPES) ||
    !isOptionalOneOf(value.flashMode, FLASH_MODES) ||
    (value.quality !== undefined && !isFiniteInRange(value.quality, 0, 1)) ||
    !isOptionalPositiveFinite(value.recTime)
  ) {
    return null;
  }

  return {
    mode: value.mode,
    ...(value.type !== undefined ? { type: value.type } : {}),
    ...(value.flashMode !== undefined ? { flashMode: value.flashMode } : {}),
    ...(value.quality !== undefined ? { quality: value.quality } : {}),
    ...(value.recTime !== undefined ? { recTime: value.recTime } : {}),
  };
}

function normalizeWatermark(value: unknown): WatermarkType | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.content) ||
    !value.content.every((line) => typeof line === 'string') ||
    !isOptionalOneOf(value.position, WATERMARK_POSITIONS)
  ) {
    return null;
  }

  return {
    content: [...value.content],
    ...(value.position !== undefined ? { position: value.position } : {}),
  };
}

function invalidConfig(): ValidationResult {
  return {
    ok: false,
    result: { code: 500, data: [], message: 'invalid_config' },
  };
}

export function validateOpenConfig(value: unknown): ValidationResult {
  if (
    !isRecord(value) ||
    !Array.isArray(value.cameraMode) ||
    value.cameraMode.length === 0 ||
    !isOneOf(value.dataRetainedMode, DATA_RETAINED_MODES) ||
    !isOptionalOneOf(
      value.photoQualityPrioritization,
      PHOTO_QUALITY_PRIORITIZATIONS
    ) ||
    (value.photoHDR !== undefined && typeof value.photoHDR !== 'boolean') ||
    !isOptionalPositiveFinite(value.videoBitRate)
  ) {
    return invalidConfig();
  }

  const cameraMode = value.cameraMode.map(normalizeCameraMode);
  if (cameraMode.some((mode) => mode === null)) {
    return invalidConfig();
  }

  const watermark =
    value.watermark === undefined
      ? undefined
      : normalizeWatermark(value.watermark);
  if (watermark === null) {
    return invalidConfig();
  }

  return {
    ok: true,
    config: {
      cameraMode: cameraMode as CameraMode[],
      dataRetainedMode: value.dataRetainedMode,
      ...(watermark !== undefined ? { watermark } : {}),
      ...(value.photoQualityPrioritization !== undefined
        ? { photoQualityPrioritization: value.photoQualityPrioritization }
        : {}),
      ...(value.photoHDR !== undefined ? { photoHDR: value.photoHDR } : {}),
      ...(value.videoBitRate !== undefined
        ? { videoBitRate: value.videoBitRate }
        : {}),
    },
  };
}
