import type {
  CameraInputValidation,
  CameraModeOptions,
  CameraWatermark,
} from './types';
import {
  CAMERA_FACINGS,
  CAMERA_FLASHES,
  CAMERA_MODES,
  MAX_VIDEO_BIT_RATE,
  CAMERA_QUALITY_PRIORITIES,
  CAMERA_WATERMARK_POSITIONS,
} from './constants';
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function choice<T extends string>(
  value: unknown,
  choices: readonly T[]
): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
function mode(value: unknown): CameraModeOptions | null {
  if (!record(value) || !choice(value.mode, CAMERA_MODES)) return null;
  if (value.mode === 'video') {
    if (
      value.quality !== undefined ||
      value.qualityPriority !== undefined ||
      value.hdr !== undefined ||
      (value.maxDurationSeconds !== undefined &&
        !positive(value.maxDurationSeconds)) ||
      (value.bitRate !== undefined &&
        (!positive(value.bitRate) ||
          !Number.isInteger(value.bitRate) ||
          value.bitRate > MAX_VIDEO_BIT_RATE))
    )
      return null;
    return {
      mode: 'video',
      ...(value.maxDurationSeconds === undefined
        ? {}
        : { maxDurationSeconds: value.maxDurationSeconds }),
      ...(value.bitRate === undefined ? {} : { bitRate: value.bitRate }),
    };
  }
  if (
    value.maxDurationSeconds !== undefined ||
    value.bitRate !== undefined ||
    (value.quality !== undefined &&
      (typeof value.quality !== 'number' ||
        !Number.isFinite(value.quality) ||
        value.quality < 0 ||
        value.quality > 1)) ||
    (value.qualityPriority !== undefined &&
      !choice(value.qualityPriority, CAMERA_QUALITY_PRIORITIES)) ||
    (value.hdr !== undefined && typeof value.hdr !== 'boolean')
  )
    return null;
  return {
    mode: value.mode,
    ...(value.quality === undefined ? {} : { quality: value.quality }),
    ...(value.qualityPriority === undefined
      ? {}
      : { qualityPriority: value.qualityPriority }),
    ...(value.hdr === undefined ? {} : { hdr: value.hdr }),
  };
}
function invalid(): CameraInputValidation {
  return {
    ok: false,
    result: {
      status: 'failed',
      error: { reason: 'invalid_input', message: 'Invalid camera input' },
    },
  };
}
export function validateOpenConfig(value: unknown): CameraInputValidation {
  try {
    if (
      !record(value) ||
      !Array.isArray(value.modes) ||
      !value.modes.length ||
      (value.retention !== 'clear' && value.retention !== 'retain') ||
      (value.initialFacing !== undefined &&
        !choice(value.initialFacing, CAMERA_FACINGS)) ||
      (value.initialFlash !== undefined &&
        !choice(value.initialFlash, CAMERA_FLASHES))
    )
      return invalid();
    const modes: CameraModeOptions[] = [];
    for (const input of value.modes) {
      const parsed = mode(input);
      if (!parsed || modes.some((item) => item.mode === parsed.mode))
        return invalid();
      modes.push(Object.freeze(parsed));
    }
    let watermark: CameraWatermark | undefined;
    if (value.watermark !== undefined) {
      const source = value.watermark;
      if (
        !record(source) ||
        !Array.isArray(source.lines) ||
        (source.position !== undefined &&
          !choice(source.position, CAMERA_WATERMARK_POSITIONS))
      )
        return invalid();
      const lines: string[] = [];
      for (const line of source.lines) {
        if (typeof line !== 'string') return invalid();
        lines.push(line);
      }
      watermark = Object.freeze({
        lines: Object.freeze(lines),
        ...(source.position === undefined ? {} : { position: source.position }),
      });
    }
    return {
      ok: true,
      config: Object.freeze({
        modes: Object.freeze(modes),
        retention: value.retention,
        ...(value.initialFacing === undefined
          ? {}
          : { initialFacing: value.initialFacing }),
        ...(value.initialFlash === undefined
          ? {}
          : { initialFlash: value.initialFlash }),
        ...(watermark === undefined ? {} : { watermark }),
      }),
    };
  } catch {
    return invalid();
  }
}
