import type { AspectRatio } from '../../utils';

export type CameraViewport = {
  width: number;
  height: number;
};

export type CameraFrameRect = CameraViewport & {
  x: number;
  y: number;
};

const ZERO_RECT: CameraFrameRect = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
};

export function fitCameraFrame(
  viewport: CameraViewport,
  aspectRatio: AspectRatio
): CameraFrameRect {
  const { width: viewportWidth, height: viewportHeight } = viewport;
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return ZERO_RECT;
  }

  const landscapeRatio = aspectRatio === '4:3' ? 4 / 3 : 16 / 9;
  const targetRatio =
    viewportWidth >= viewportHeight ? landscapeRatio : 1 / landscapeRatio;
  const viewportRatio = viewportWidth / viewportHeight;
  const width =
    viewportRatio > targetRatio ? viewportHeight * targetRatio : viewportWidth;
  const height =
    viewportRatio > targetRatio ? viewportHeight : viewportWidth / targetRatio;

  return {
    x: (viewportWidth - width) / 2,
    y: (viewportHeight - height) / 2,
    width,
    height,
  };
}
