import { Image } from 'react-native';
import { render } from '@testing-library/react-native';
import { SlideItem } from '../../../components/Carousel/SlideItem';
import type { CustomPhotoFile } from '../../../utils';

const base = { id: '1', cameraType: 'back' as const, width: 1, height: 1 };
const img: CustomPhotoFile = {
  ...base,
  cameraMode: 'single',
  mode: 'single',
  mime: 'image/jpeg',
  path: '/a.jpg',
  uri: 'file:///a.jpg',
};
const vid: CustomPhotoFile = {
  ...base,
  cameraMode: 'video',
  mode: 'video',
  mime: 'video/mp4',
  path: '/v.mp4',
  uri: 'file:///v.mp4',
};

it('renders image vs video branch', () => {
  expect(() => render(<SlideItem file={img} />)).not.toThrow();
  const { getByTestId } = render(<SlideItem file={vid} />);
  expect(getByTestId('video-player')).toBeTruthy();
});

it('照片用 resizeMode="cover"(= 取景所见:满宽铺满、裁掉上下超出)', () => {
  const { UNSAFE_getByType } = render(<SlideItem file={img} />);
  expect(UNSAFE_getByType(Image).props.resizeMode).toBe('cover');
});
