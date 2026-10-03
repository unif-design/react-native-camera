import type { AspectRatio, CameraModeOptions, CameraFacing } from '../../utils';

export type NativeConfiguration = {
  device: {
    id: string;
    position: CameraFacing;
  };
  mode: CameraModeOptions;
  aspectRatio: AspectRatio;
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
    `photoHDR=${optionalValue(mode.mode === 'video' ? undefined : mode.hdr)}`,
  ];

  if (mode.mode === 'video') {
    return [
      ...common,
      `resolution=${configuration.aspectRatio === '4:3' ? '3024x4032' : '2160x3840'}`,
      'audio=true',
      'fileType=mp4',
      `bitrate=${optionalValue(mode.bitRate)}`,
    ].join('|');
  }

  return [
    ...common,
    `resolution=${configuration.aspectRatio === '4:3' ? '1440x1920' : '1080x1920'}`,
    'container=jpeg',
    `quality=${mode.quality ?? 0.9}`,
    `prioritization=${optionalValue(mode.qualityPriority)}`,
  ].join('|');
}
