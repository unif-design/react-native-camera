import { carouselRemountKey } from '../../../components/Carousel/Carousel';
import type { CustomPhotoFile } from '../../../utils';

const f = (id: string): CustomPhotoFile => ({
  id,
  cameraType: 'back',
  cameraMode: 'single',
  path: `/tmp/${id}.jpg`,
  uri: `file:///tmp/${id}.jpg`,
  width: 1,
  height: 1,
  mime: 'image/jpeg',
  mode: 'single',
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
