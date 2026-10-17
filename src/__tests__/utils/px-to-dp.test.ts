import { Dimensions, PixelRatio } from 'react-native';
import { pxToDp } from '../../utils/px-to-dp';

it('scales design pixels to the current window and native pixel grid', () => {
  const dimensions = jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width: 750, height: 1000, scale: 2, fontScale: 1 });
  const pixels = jest
    .spyOn(PixelRatio, 'roundToNearestPixel')
    .mockReturnValue(41.5);
  try {
    expect(pxToDp(20.7)).toBe(41.5);
    expect(dimensions).toHaveBeenCalledWith('window');
    expect(pixels).toHaveBeenCalledWith(41.4);
  } finally {
    dimensions.mockRestore();
    pixels.mockRestore();
  }
});
