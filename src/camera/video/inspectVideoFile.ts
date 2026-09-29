import NativePhotoProcessor from '../../NativePhotoProcessor';
import type { VideoFileMetadata } from './types';

function positiveDimension(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export async function inspectVideoFile(
  inputPath: string
): Promise<VideoFileMetadata> {
  const parsed: unknown = JSON.parse(
    await NativePhotoProcessor.inspectVideoFile(inputPath)
  );
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid native video metadata');
  }
  const value = parsed as Record<string, unknown>;
  if (!positiveDimension(value.width) || !positiveDimension(value.height)) {
    throw new Error('Invalid native video dimensions');
  }
  const metadata: VideoFileMetadata = {
    width: value.width,
    height: value.height,
  };
  if (value.durationMs !== undefined) {
    if (
      typeof value.durationMs !== 'number' ||
      !Number.isFinite(value.durationMs) ||
      value.durationMs < 0
    ) {
      throw new Error('Invalid native video duration');
    }
    metadata.durationMs = value.durationMs;
  }
  return metadata;
}
