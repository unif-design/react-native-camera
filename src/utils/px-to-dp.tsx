import { Dimensions, PixelRatio } from 'react-native';

const DESIGN_WIDTH = 375;

export function pxToDp(px: number): number {
  const { width } = Dimensions.get('window');
  return PixelRatio.roundToNearestPixel((px * width) / DESIGN_WIDTH);
}
