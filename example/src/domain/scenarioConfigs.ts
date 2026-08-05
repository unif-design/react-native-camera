import type {
  CameraModeName,
  CameraType,
  DataRetainedMode,
  FlashMode,
  OpenConfig,
} from '@unif/react-native-camera';

export type BasicConfigInput = {
  mode: CameraModeName;
  type: CameraType;
  flashMode: FlashMode;
  quality: number;
  recTime: number;
};

type WatermarkPosition = NonNullable<
  NonNullable<OpenConfig['watermark']>['position']
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
      config: OpenConfig;
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
      recTime: number;
      videoBitRate: number | null;
    };

export function buildBasicConfig(input: BasicConfigInput): OpenConfig {
  return {
    cameraMode:
      input.mode === 'video'
        ? [
            {
              mode: 'video',
              type: input.type,
              flashMode: input.flashMode,
              recTime: input.recTime,
            },
          ]
        : [
            {
              mode: input.mode,
              type: input.type,
              flashMode: input.flashMode,
              quality: input.quality,
            },
          ],
    dataRetainedMode: 'clear',
  };
}

export function buildMultiModeConfig(
  retainedMode: DataRetainedMode
): OpenConfig {
  return {
    cameraMode: [
      { mode: 'single', type: 'back', flashMode: 'auto', quality: 0.9 },
      { mode: 'continuous', quality: 0.9 },
      { mode: 'video', recTime: 15 },
    ],
    dataRetainedMode: retainedMode,
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
      cameraMode: [{ mode: 'single', quality: 0.9 }],
      dataRetainedMode: 'clear',
      watermark: {
        content: [
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

export function buildQualityConfig(input: QualityConfigInput): OpenConfig {
  if (input.kind === 'video') {
    return {
      cameraMode: [{ mode: 'video', recTime: input.recTime }],
      dataRetainedMode: 'clear',
      ...(input.videoBitRate === null
        ? {}
        : { videoBitRate: input.videoBitRate }),
    };
  }

  return {
    cameraMode: [{ mode: 'single', quality: input.quality }],
    dataRetainedMode: 'clear',
    ...(input.prioritization === 'sdk-default'
      ? {}
      : { photoQualityPrioritization: input.prioritization }),
    ...(input.hdr === 'sdk-default' ? {} : { photoHDR: input.hdr === 'on' }),
  };
}
