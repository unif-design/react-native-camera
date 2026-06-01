import type { WatermarkType } from '../../utils';

export type WmAlign = 'left' | 'center' | 'right';
export type WmLayout = {
  content: string[];
  align: WmAlign;
  anchorY: 'top' | 'bottom';
  fontSize: number;
  lineGap: number;
  pad: number;
  maxWidth: number;
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

// 相对目标宽度的比例(起点值,真机微调到与 digest §水印 一致)
export function computeWatermarkLayout(
  targetWidth: number,
  wm: WatermarkType
): WmLayout {
  const { align, anchorY } = POS[wm.position ?? 'top-right'];
  const fontSize = Math.round(targetWidth * 0.033);
  return {
    content: wm.content,
    align,
    anchorY,
    fontSize,
    lineGap: Math.round(fontSize * 0.45),
    pad: Math.round(targetWidth * 0.04),
    maxWidth: Math.round(targetWidth * 0.7),
  };
}
