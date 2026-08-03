import {
  FontWeight,
  Skia,
  TextAlign,
  type SkParagraph,
  type SkParagraphBuilder,
} from '@shopify/react-native-skia';
import type { WatermarkType } from '../../utils';
import { VIEWFINDER } from '../colors/viewfinder';
import { computeWatermarkLayout, type WmLayout } from './layout';

export type WatermarkParagraph = {
  builder: SkParagraphBuilder;
  paragraph: SkParagraph;
  layout: WmLayout;
  placement: {
    x: number;
    y: number;
    width: number;
  };
  dispose: () => void;
};

function disposeSafely(resource: { dispose: () => void } | null): void {
  try {
    resource?.dispose();
  } catch {
    // Paragraph 与 Builder 都是独立 JSI 资源；任一释放失败不能阻断另一个或冒泡到 React cleanup。
  }
}

export function hasVisibleWatermark(
  watermark: WatermarkType | null | undefined
): watermark is WatermarkType {
  return (
    watermark != null &&
    watermark.content.some((line) => line.trim().length > 0)
  );
}

function resolveTextAlign(align: WmLayout['align']): TextAlign {
  if (align === 'left') return TextAlign.Left;
  if (align === 'center') return TextAlign.Center;
  return TextAlign.Right;
}

export function createWatermarkParagraph(
  width: number,
  height: number,
  watermark: WatermarkType
): WatermarkParagraph {
  const layout = computeWatermarkLayout(width, height, watermark);
  // 不传 TypefaceProvider / fontFamilies，让 Paragraph 统一使用平台系统字体管理器与字形 fallback。
  const builder = Skia.ParagraphBuilder.Make({
    textAlign: resolveTextAlign(layout.align),
  });
  let paragraph: SkParagraph | null = null;

  try {
    const shadow = {
      color: Skia.Color(VIEWFINDER.watermarkShadow),
      blurRadius: Math.max(2, Math.round(layout.fontSize * 0.1)),
      offset: { x: 0, y: 0 },
    };
    const color = Skia.Color('white');
    layout.content.forEach((line, index) => {
      builder
        .pushStyle({
          color,
          fontSize: layout.fontSize,
          heightMultiplier: layout.heightMultiplier,
          fontStyle: {
            weight: index === 0 ? FontWeight.SemiBold : FontWeight.Normal,
          },
          shadows: [shadow],
        })
        .addText(index === layout.content.length - 1 ? line : `${line}\n`)
        .pop();
    });

    paragraph = builder.build();
    paragraph.layout(layout.paragraphWidth);
    const y =
      layout.anchorY === 'top'
        ? layout.padding
        : Math.max(0, height - layout.padding - paragraph.getHeight());
    let disposed = false;

    return {
      builder,
      paragraph,
      layout,
      placement: {
        x: layout.x,
        y,
        width: layout.paragraphWidth,
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        disposeSafely(paragraph);
        disposeSafely(builder);
      },
    };
  } catch (error) {
    disposeSafely(paragraph);
    disposeSafely(builder);
    throw error;
  }
}
