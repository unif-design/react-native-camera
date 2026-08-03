import type { WatermarkType } from '../../utils';

export type WmAlign = 'left' | 'center' | 'right';
export type WmLayout = {
  content: string[];
  align: WmAlign;
  anchorY: 'top' | 'bottom';
  fontSize: number;
  lineHeight: number;
  lineGap: number;
  heightMultiplier: number;
  padding: number;
  paragraphWidth: number;
  x: number;
};

const POS: Record<
  NonNullable<WatermarkType['position']>,
  { align: WmAlign; anchorY: 'top' | 'bottom' }
> = {
  'top-left': { align: 'left', anchorY: 'top' },
  'top-center': { align: 'center', anchorY: 'top' },
  'top-right': { align: 'right', anchorY: 'top' },
  'bottom-left': { align: 'left', anchorY: 'bottom' },
  'bottom-center': { align: 'center', anchorY: 'bottom' },
  'bottom-right': { align: 'right', anchorY: 'bottom' },
};

export function computeWatermarkLayout(
  width: number,
  height: number,
  watermark: WatermarkType
): WmLayout {
  const { align, anchorY } = POS[watermark.position ?? 'top-right'];
  const shortSide = Math.min(width, height);
  const fontSize = Math.max(1, Math.round(shortSide * 0.033));
  const lineHeight = Math.max(fontSize, Math.round(fontSize * 1.45));
  const padding = Math.max(0, Math.round(shortSide * 0.04));
  const paragraphWidth = Math.max(
    1,
    Math.min(Math.round(width * 0.7), width - 2 * padding)
  );
  const x =
    align === 'left'
      ? padding
      : align === 'center'
        ? (width - paragraphWidth) / 2
        : width - padding - paragraphWidth;

  return {
    content: [...watermark.content],
    align,
    anchorY,
    fontSize,
    lineHeight,
    lineGap: lineHeight - fontSize,
    heightMultiplier: lineHeight / fontSize,
    padding,
    paragraphWidth,
    x,
  };
}
