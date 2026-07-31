import type {
  AspectRatio,
  CameraMode,
  CameraType,
  OpenConfig,
} from '../../utils';

export type NativeConfiguration = {
  device: {
    id: string;
    position: CameraType;
  };
  mode: CameraMode;
  aspectRatio: AspectRatio;
  photoQualityPrioritization?: OpenConfig['photoQualityPrioritization'];
  photoHDR?: boolean;
  videoBitRate?: number;
};

function optionalValue(value: string | number | boolean | undefined): string {
  return value === undefined ? 'unset' : String(value);
}

export function nativeConfigurationKey(
  configuration: NativeConfiguration
): string {
  const { device, mode } = configuration;
  const common = [
    `device=${encodeURIComponent(device.id)}`,
    `position=${device.position}`,
    `output=${mode.mode === 'video' ? 'video' : 'photo'}`,
    `photoHDR=${optionalValue(configuration.photoHDR)}`,
  ];

  if (mode.mode === 'video') {
    return [
      ...common,
      `resolution=${configuration.aspectRatio === '4:3' ? '3024x4032' : '2160x3840'}`,
      'audio=true',
      'fileType=mp4',
      `bitrate=${optionalValue(configuration.videoBitRate)}`,
    ].join('|');
  }

  return [
    ...common,
    'resolution=3024x4032',
    'container=jpeg',
    `quality=${mode.quality ?? 0.9}`,
    `prioritization=${optionalValue(configuration.photoQualityPrioritization)}`,
  ].join('|');
}
