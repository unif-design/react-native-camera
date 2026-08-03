import { FontWeight, TextAlign } from '@shopify/react-native-skia';
import {
  createWatermarkParagraph,
  hasVisibleWatermark,
} from '../../../camera/watermark/paragraph';
import { VIEWFINDER } from '../../../camera/colors/viewfinder';

describe('watermark Paragraph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('空数组或仅空白 content 不创建有效水印', () => {
    expect(hasVisibleWatermark(undefined)).toBe(false);
    expect(hasVisibleWatermark({ content: [] })).toBe(false);
    expect(hasVisibleWatermark({ content: [' ', '\n'] })).toBe(false);
    expect(hasVisibleWatermark({ content: ['', '正文'] })).toBe(true);
  });

  it('preview 与 burn 共用首行 SemiBold、正文 Normal、行高、阴影和系统 fallback', () => {
    const skia = require('@shopify/react-native-skia');
    const prepared = createWatermarkParagraph(1200, 800, {
      content: ['标题', '正文'],
      position: 'top-right',
    });
    const builder = skia.Skia.ParagraphBuilder.Make.mock.results[0].value;
    const titleStyle = builder.pushStyle.mock.calls[0][0];
    const bodyStyle = builder.pushStyle.mock.calls[1][0];

    expect(skia.Skia.ParagraphBuilder.Make).toHaveBeenCalledWith({
      textAlign: TextAlign.Right,
    });
    expect(titleStyle).toMatchObject({
      fontStyle: { weight: FontWeight.SemiBold },
      fontSize: prepared.layout.fontSize,
      heightMultiplier: prepared.layout.heightMultiplier,
      shadows: [
        {
          color: skia.Skia.Color(VIEWFINDER.watermarkShadow),
          offset: { x: 0, y: 0 },
        },
      ],
    });
    expect(titleStyle).not.toHaveProperty('fontFamilies');
    expect(bodyStyle).toMatchObject({
      fontStyle: { weight: FontWeight.Normal },
      heightMultiplier: titleStyle.heightMultiplier,
      shadows: titleStyle.shadows,
    });
    expect(builder.addText.mock.calls.map(([text]: [string]) => text)).toEqual([
      '标题\n',
      '正文',
    ]);
  });

  it('使用共享 paragraphWidth 排版，并按 bottom anchor 放置', () => {
    const prepared = createWatermarkParagraph(1000, 800, {
      content: ['a'],
      position: 'bottom-center',
    });

    expect(prepared.paragraph.layout).toHaveBeenCalledWith(
      prepared.layout.paragraphWidth
    );
    expect(prepared.placement).toEqual({
      x: prepared.layout.x,
      y: 800 - prepared.layout.padding - 120,
      width: prepared.layout.paragraphWidth,
    });
  });

  it('dispose 按 paragraph → builder 且 exactly once', () => {
    const prepared = createWatermarkParagraph(1000, 800, {
      content: ['a'],
    });
    const order: string[] = [];
    prepared.paragraph.dispose = jest.fn(() => order.push('paragraph'));
    prepared.builder.dispose = jest.fn(() => order.push('builder'));

    prepared.dispose();
    prepared.dispose();

    expect(order).toEqual(['paragraph', 'builder']);
  });
});
