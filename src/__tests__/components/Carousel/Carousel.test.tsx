import { fireEvent, render } from '@testing-library/react-native';
import {
  Carousel,
  carouselRemountKey,
} from '../../../components/Carousel/Carousel';
import { makePhotoFile } from '../../__helpers__/factories';

const rnCarouselRenderSpy = (
  jest.requireMock('react-native-reanimated-carousel') as {
    __carouselRenderSpy: jest.Mock;
  }
).__carouselRenderSpy;

const f = (id: string) =>
  makePhotoFile({
    id,
    path: `/tmp/${id}.jpg`,
    uri: `file:///tmp/${id}.jpg`,
  });

describe('carouselRemountKey', () => {
  it('等长但不同内容(切类型 tab)→ key 不同 → 触发 remount 重置 offset', () => {
    // 2 张单拍 ↔ 2 段视频:length 都是 2,只用 length 不会 remount → 旧虚拟化 offset 停在被切走的
    // 组、index 已归 0 → 屏上显示张与 current 错位 → 删除删错文件(P1#2 根因)。
    expect(carouselRemountKey([f('a'), f('b')])).not.toBe(
      carouselRemountKey([f('c'), f('d')])
    );
  });

  it('换尾(等长,删尾再补一张)→ key 不同', () => {
    expect(carouselRemountKey([f('a'), f('b')])).not.toBe(
      carouselRemountKey([f('a'), f('c')])
    );
  });

  it('首尾相同但中间项替换 → key 不同,避免旧实例 callback generation 碰撞', () => {
    expect(carouselRemountKey([f('a'), f('b'), f('c')])).not.toBe(
      carouselRemountKey([f('a'), f('x'), f('c')])
    );
  });

  it('删除一张(长度变)→ key 不同 → remount', () => {
    expect(carouselRemountKey([f('a'), f('b')])).not.toBe(
      carouselRemountKey([f('a')])
    );
  });

  it('同一组数据 → key 稳定(不无谓 remount)', () => {
    expect(carouselRemountKey([f('a'), f('b')])).toBe(
      carouselRemountKey([f('a'), f('b')])
    );
  });

  it('空数组不崩,返回字符串', () => {
    expect(typeof carouselRemountKey([])).toBe('string');
  });
});

describe('Carousel stable v5 props', () => {
  beforeEach(() => {
    rnCarouselRenderSpy.mockClear();
  });

  it('layout 后使用 named Carousel 所需的 itemSize/keyExtractor/defaultIndex 与 settled callbacks', () => {
    const data = [f('a'), f('b')];
    const onScrollStart = jest.fn();
    const onIndexChange = jest.fn();
    const { getByTestId } = render(
      <Carousel
        data={data}
        index={1}
        onScrollStart={onScrollStart}
        onIndexChange={onIndexChange}
      />
    );

    // Carousel 先等真实 pager 高度,收到 layout 后才 mount stable v5 组件。
    expect(rnCarouselRenderSpy).not.toHaveBeenCalled();
    fireEvent(getByTestId('camera-preview-carousel-track'), 'layout', {
      nativeEvent: {
        layout: { x: 0, y: 0, width: 390, height: 480 },
      },
    });

    const calls = rnCarouselRenderSpy.mock.calls;
    const props = calls[calls.length - 1]?.[0];
    expect(props).toMatchObject({
      data,
      defaultIndex: 1,
      loop: false,
      onScrollStart,
    });
    expect(props.onSnapToItem).toEqual(expect.any(Function));
    expect(props.itemSize).toEqual(expect.any(Number));
    expect(props.itemSize).toBeGreaterThan(0);
    expect(props.style).toEqual({
      width: props.itemSize,
      height: 480,
    });
    expect(props.keyExtractor(data[0], 0)).toBe('a');

    fireEvent.press(getByTestId('rnrc-scroll-start'));
    expect(onScrollStart).toHaveBeenCalledTimes(1);
    fireEvent.press(getByTestId('rnrc-snap-0'));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });
});
