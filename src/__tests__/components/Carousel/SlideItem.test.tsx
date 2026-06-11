import { Image } from 'react-native';
import { render } from '@testing-library/react-native';
import { SlideItem } from '../../../components/Carousel/SlideItem';
import type { CustomPhotoFile } from '../../../utils';
import { makePhotoFile } from '../../__helpers__/factories';

const img: CustomPhotoFile = makePhotoFile({
  id: '1',
  path: '/a.jpg',
  uri: 'file:///a.jpg',
});
const vid: CustomPhotoFile = makePhotoFile({
  id: '1',
  mode: 'video',
  path: '/v.mp4',
  uri: 'file:///v.mp4',
});

it('renders image vs video branch', () => {
  expect(() => render(<SlideItem file={img} />)).not.toThrow();
  const { getByTestId } = render(<SlideItem file={vid} />);
  expect(getByTestId('video-player')).toBeTruthy();
});

it('照片用 resizeMode="contain"(与取景一致:完整画面、按比例留边、不裁切)', () => {
  const { UNSAFE_getByType } = render(<SlideItem file={img} />);
  expect(UNSAFE_getByType(Image).props.resizeMode).toBe('contain');
});

it('图片包在固定灰色画布容器内(外层恒定,变化的只是画布内图片比例)', () => {
  const { getByTestId } = render(<SlideItem file={img} />);
  const canvas = getByTestId('slide-canvas');
  expect(canvas.props.style).toMatchObject({ backgroundColor: '#1C1C1E' });
});
