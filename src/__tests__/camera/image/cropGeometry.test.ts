import {
  computeCropRect,
  CropGeometryError,
} from '../../../camera/image/cropGeometry';

describe('computeCropRect', () => {
  it.each([
    {
      label: 'landscape 4:3 已匹配',
      source: [4000, 3000] as const,
      aspect: '4:3' as const,
      expected: { x: 0, y: 0, width: 4000, height: 3000 },
    },
    {
      label: 'portrait 4:3 已匹配',
      source: [3000, 4000] as const,
      aspect: '4:3' as const,
      expected: { x: 0, y: 0, width: 3000, height: 4000 },
    },
    {
      label: 'landscape 16:9 居中裁高',
      source: [4000, 3000] as const,
      aspect: '16:9' as const,
      expected: { x: 0, y: 375, width: 4000, height: 2250 },
    },
    {
      label: 'portrait 16:9 居中裁宽',
      source: [3000, 4000] as const,
      aspect: '16:9' as const,
      expected: { x: 375, y: 0, width: 2250, height: 4000 },
    },
    {
      label: '比 4:3 更宽时裁宽',
      source: [2400, 1200] as const,
      aspect: '4:3' as const,
      expected: { x: 400, y: 0, width: 1600, height: 1200 },
    },
    {
      label: '比 4:3 更窄时裁高',
      source: [1600, 1600] as const,
      aspect: '4:3' as const,
      expected: { x: 0, y: 200, width: 1600, height: 1200 },
    },
  ])('$label', ({ source, aspect, expected }) => {
    expect(computeCropRect(source[0], source[1], aspect)).toEqual(expected);
  });

  it.each([
    [0, 100],
    [-1, 100],
    [100, Number.NaN],
    [Number.POSITIVE_INFINITY, 100],
  ])('无效 decoded 尺寸 %p × %p 抛可诊断错误', (width, height) => {
    expect(() => computeCropRect(width, height, '16:9')).toThrow(
      CropGeometryError
    );
    expect(() => computeCropRect(width, height, '16:9')).toThrow(
      'Invalid decoded image size'
    );
  });

  it('无效 target aspect 抛可诊断错误', () => {
    let thrown: unknown;
    try {
      computeCropRect(4000, 3000, '1:1' as '4:3');
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      name: 'CropGeometryError',
      code: 'invalid_crop_geometry',
    });
  });
});
