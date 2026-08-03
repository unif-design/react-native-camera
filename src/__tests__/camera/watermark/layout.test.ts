import { computeWatermarkLayout } from '../../../camera/watermark/layout';

describe('computeWatermarkLayout', () => {
  it('六种位置映射到一致的水平对齐与垂直锚点', () => {
    expect(computeWatermarkLayout(1200, 800, { content: ['a'] })).toMatchObject(
      {
        align: 'right',
        anchorY: 'top',
      }
    );
    expect(
      computeWatermarkLayout(1200, 800, {
        content: ['a'],
        position: 'top-left',
      })
    ).toMatchObject({ align: 'left', anchorY: 'top' });
    expect(
      computeWatermarkLayout(1200, 800, {
        content: ['a'],
        position: 'bottom-center',
      })
    ).toMatchObject({ align: 'center', anchorY: 'bottom' });
    expect(
      computeWatermarkLayout(1200, 800, {
        content: ['a'],
        position: 'bottom-right',
      })
    ).toMatchObject({ align: 'right', anchorY: 'bottom' });
  });

  it('字号、行高与 padding 只按画面短边缩放', () => {
    const landscape = computeWatermarkLayout(1200, 800, { content: ['a'] });
    const portrait = computeWatermarkLayout(800, 1200, { content: ['a'] });

    expect(portrait.fontSize).toBe(landscape.fontSize);
    expect(portrait.lineHeight).toBe(landscape.lineHeight);
    expect(portrait.padding).toBe(landscape.padding);
    expect(portrait.lineHeight).toBeGreaterThan(portrait.fontSize);
    expect(portrait.heightMultiplier).toBe(
      portrait.lineHeight / portrait.fontSize
    );
  });

  it('paragraph 宽度最多为画面宽度 70%，并按 align 放置', () => {
    const left = computeWatermarkLayout(1000, 800, {
      content: ['a'],
      position: 'top-left',
    });
    const center = computeWatermarkLayout(1000, 800, {
      content: ['a'],
      position: 'top-center',
    });
    const right = computeWatermarkLayout(1000, 800, {
      content: ['a'],
      position: 'top-right',
    });

    expect(left.paragraphWidth).toBe(700);
    expect(left.x).toBe(left.padding);
    expect(center.x).toBe(150);
    expect(right.x).toBe(1000 - right.padding - right.paragraphWidth);
  });
});
