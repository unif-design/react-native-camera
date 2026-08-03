import type { AspectRatio } from '../../utils';

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export class CropGeometryError extends Error {
  readonly code = 'invalid_crop_geometry' as const;

  constructor(message: string) {
    super(message);
    this.name = 'CropGeometryError';
  }
}

export function computeCropRect(
  decodedWidth: number,
  decodedHeight: number,
  aspect: AspectRatio
): CropRect {
  if (
    !Number.isFinite(decodedWidth) ||
    !Number.isFinite(decodedHeight) ||
    decodedWidth <= 0 ||
    decodedHeight <= 0
  ) {
    throw new CropGeometryError(
      `Invalid decoded image size: ${decodedWidth} × ${decodedHeight}`
    );
  }
  if (aspect !== '4:3' && aspect !== '16:9') {
    throw new CropGeometryError(`Invalid target aspect: ${String(aspect)}`);
  }

  const landscapeRatio = aspect === '16:9' ? 16 / 9 : 4 / 3;
  const targetWidthOverHeight =
    decodedWidth >= decodedHeight ? landscapeRatio : 1 / landscapeRatio;
  const sourceWidthOverHeight = decodedWidth / decodedHeight;

  if (Math.abs(sourceWidthOverHeight - targetWidthOverHeight) < 1e-9) {
    return { x: 0, y: 0, width: decodedWidth, height: decodedHeight };
  }

  if (sourceWidthOverHeight > targetWidthOverHeight) {
    const width = Math.round(decodedHeight * targetWidthOverHeight);
    return {
      x: (decodedWidth - width) / 2,
      y: 0,
      width,
      height: decodedHeight,
    };
  }

  const height = Math.round(decodedWidth / targetWidthOverHeight);
  return {
    x: 0,
    y: (decodedHeight - height) / 2,
    width: decodedWidth,
    height,
  };
}
