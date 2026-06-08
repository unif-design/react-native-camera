import { computeWatermarkLayout } from '../../../camera/watermark/layout';

it('position → align/anchor', () => {
  expect(computeWatermarkLayout(390, { content: ['a'] }).align).toBe('right'); // 缺省 top-right
  expect(
    computeWatermarkLayout(390, { content: ['a'], position: 'top-left' }).align
  ).toBe('left');
  expect(
    computeWatermarkLayout(390, { content: ['a'], position: 'bottom-center' })
  ).toMatchObject({ align: 'center', anchorY: 'bottom' });
  expect(
    computeWatermarkLayout(390, { content: ['a'], position: 'bottom-right' })
      .anchorY
  ).toBe('bottom');
});

it('字号/padding 随宽缩放', () => {
  const a = computeWatermarkLayout(390, { content: ['a'] });
  const b = computeWatermarkLayout(1080, { content: ['a'] });
  expect(b.fontSize).toBeGreaterThan(a.fontSize);
  expect(a.content).toEqual(['a']);
  expect(a.maxWidth).toBeLessThan(390);
});
