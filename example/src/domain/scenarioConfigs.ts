import type {
  CameraCaptureMode,
  CameraFacing,
  CameraFlash,
  CameraInput,
} from '@unif/react-native-camera';

export type BasicConfigInput = {
  mode: CameraCaptureMode;
  type: CameraFacing;
  flashMode: CameraFlash;
  quality: number;
  maxDurationSeconds: number;
};

type WatermarkPosition = NonNullable<
  NonNullable<CameraInput['watermark']>['position']
>;

export type WatermarkConfigInput = {
  title: string;
  location: string;
  note: string;
  position?: WatermarkPosition;
};

export type WatermarkConfigResult =
  | {
      ok: true;
      config: CameraInput;
    }
  | {
      ok: false;
      fieldError: {
        field: 'title';
        message: string;
      };
    };

export type QualityConfigInput =
  | {
      kind: 'photo';
      quality: number;
      prioritization: 'sdk-default' | 'speed' | 'balanced' | 'quality';
      hdr: 'sdk-default' | 'on' | 'off';
    }
  | {
      kind: 'video';
      maxDurationSeconds: number;
      videoBitRate: number | null;
    };

export function buildBasicConfig(input: BasicConfigInput): CameraInput {
  return {
    modes:
      input.mode === 'video'
        ? [
            {
              mode: 'video',
              maxDurationSeconds: input.maxDurationSeconds,
            },
          ]
        : [
            {
              mode: input.mode,
              quality: input.quality,
            },
          ],
    initialFacing: input.type,
    initialFlash: input.flashMode,
    retention: 'clear',
  };
}

export function buildMultiModeConfig(
  retainedMode: CameraInput['retention']
): CameraInput {
  return {
    modes: [
      { mode: 'single', quality: 0.9 },
      { mode: 'continuous', quality: 0.9 },
      { mode: 'video', maxDurationSeconds: 15 },
    ],
    initialFacing: 'back',
    initialFlash: 'auto',
    retention: retainedMode,
  };
}

export function buildWatermarkConfig(
  input: WatermarkConfigInput,
  now: Date
): WatermarkConfigResult {
  const title = input.title.trim();
  if (title.length === 0) {
    return {
      ok: false,
      fieldError: {
        field: 'title',
        message: '请输入记录标题',
      },
    };
  }

  const location = input.location.trim();
  const note = input.note.trim();

  return {
    ok: true,
    config: {
      modes: [{ mode: 'single', quality: 0.9 }],
      retention: 'clear',
      watermark: {
        lines: [
          title,
          `拍摄时间：${now.toISOString()}`,
          ...(location.length > 0 ? [`地点：${location}`] : []),
          ...(note.length > 0 ? [`备注：${note}`] : []),
        ],
        position: input.position ?? 'top-right',
      },
    },
  };
}

export function buildQualityConfig(input: QualityConfigInput): CameraInput {
  if (input.kind === 'video') {
    return {
      modes: [
        {
          mode: 'video',
          maxDurationSeconds: input.maxDurationSeconds,
          ...(input.videoBitRate === null
            ? {}
            : { bitRate: input.videoBitRate }),
        },
      ],
      retention: 'clear',
    };
  }

  return {
    modes: [
      {
        mode: 'single',
        quality: input.quality,
        ...(input.prioritization === 'sdk-default'
          ? {}
          : { qualityPriority: input.prioritization }),
        ...(input.hdr === 'sdk-default' ? {} : { hdr: input.hdr === 'on' }),
      },
    ],
    retention: 'clear',
  };
}
