import { fitCameraFrame } from '../../../camera/session/frameRect';
import type { AspectRatio } from '../../../utils';

function expectContained(
  viewport: { width: number; height: number },
  aspectRatio: AspectRatio,
  expectedRatio: number
) {
  const frame = fitCameraFrame(viewport, aspectRatio);
  expect(frame.x).toBeGreaterThanOrEqual(0);
  expect(frame.y).toBeGreaterThanOrEqual(0);
  expect(frame.x + frame.width).toBeLessThanOrEqual(viewport.width);
  expect(frame.y + frame.height).toBeLessThanOrEqual(viewport.height);
  expect(frame.width / frame.height).toBeCloseTo(expectedRatio, 10);
}

describe('fitCameraFrame', () => {
  it.each([
    [{ width: 390, height: 844 }, '4:3', 3 / 4],
    [{ width: 390, height: 844 }, '16:9', 9 / 16],
    [{ width: 844, height: 390 }, '4:3', 4 / 3],
    [{ width: 844, height: 390 }, '16:9', 16 / 9],
    [{ width: 507, height: 768 }, '4:3', 3 / 4],
    [{ width: 507, height: 768 }, '16:9', 9 / 16],
  ] as const)(
    'contains %s viewport at %s',
    (viewport, aspectRatio, expectedRatio) => {
      expectContained(viewport, aspectRatio, expectedRatio);
    }
  );

  it('centers the contained frame deterministically', () => {
    const viewport = { width: 844, height: 390 };
    const frame = fitCameraFrame(viewport, '16:9');
    expect(frame).toEqual(fitCameraFrame(viewport, '16:9'));
    expect(frame.width).toBeCloseTo(390 * (16 / 9), 10);
    expect(frame.height).toBe(390);
    expect(frame.x).toBeCloseTo((844 - 390 * (16 / 9)) / 2, 10);
    expect(frame.y).toBe(0);
  });

  it.each([
    { width: 0, height: 844 },
    { width: 390, height: 0 },
    { width: Number.NaN, height: 844 },
    { width: 390, height: Number.POSITIVE_INFINITY },
    { width: -1, height: 844 },
  ])('returns a zero rect for unsafe viewport %p', (viewport) => {
    expect(fitCameraFrame(viewport, '4:3')).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});
