import { useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import RNCarousel from 'react-native-reanimated-carousel';
import type { CustomPhotoFile } from '../../utils';
import { SlideItem } from './SlideItem';

/**
 * Carousel remount key:数据集「换了一批」就 remount,重置 RNCarousel 的虚拟化滚动 offset。
 * 纳入首/尾项 id 而非只绑 length —— gallery 切类型 tab 时新旧组可能等长(如 2 张单拍 ↔ 2 段视频),
 * 只用 length 不会 remount → 旧 offset 停在被切走的组、index 已归 0 → 屏上显示张与 current 错位
 * → 删除删错文件(P1#2 根因)。首/尾 id 覆盖「等长换组」「换尾」,length 覆盖增删。
 */
export function carouselRemountKey(data: CustomPhotoFile[]): string {
  const first = data[0]?.id ?? '';
  const last = data[data.length - 1]?.id ?? '';
  return `${data.length}-${first}-${last}`;
}

type Props = {
  data: CustomPhotoFile[];
  /** 受控当前下标(删除后由父级 clamp);用作 defaultIndex,删除 remount 后落回正确张。 */
  index?: number;
  onIndexChange?: (i: number) => void;
};

export function Carousel({ data, index = 0, onIndexChange }: Props) {
  const { width } = useWindowDimensions();
  // 高度按实际容器(预览页 pager,夹在 top/bottom bar 之间)onLayout 实测,
  // 不再用整屏 useWindowDimensions().height —— 后者比 pager 高,RNCarousel 撑出
  // pager 后 contain 图相对「整屏」居中、相对可见 pager 偏下(顶部一大块黑),即 #2 不居中根因。
  // 量到前用 0(RNCarousel 高 0 不渲染,首帧 onLayout 后即出图),避免用错误的整屏高跳一下。
  const [trackHeight, setTrackHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setTrackHeight(e.nativeEvent.layout.height);

  return (
    <View style={styles.root} onLayout={onLayout}>
      {trackHeight > 0 && (
        <RNCarousel
          // key = 数据集身份签名(length + 首/尾 id):数据「换了一批」就 remount,重置 RNCarousel
          // 内部虚拟化滚动 offset。不能只绑 length —— 切类型 tab 时新旧组可能等长 → 不 remount →
          // 旧 offset 停在被切走的组、显示张与 index 错位 → 删除删错文件(见 carouselRemountKey)。
          // remount 后用 defaultIndex 落回父级 clamp 过的当前下标(停在正确的剩余照片)。
          key={carouselRemountKey(data)}
          data={data}
          defaultIndex={Math.min(index, Math.max(data.length - 1, 0))}
          width={width}
          height={trackHeight}
          loop={false}
          onSnapToItem={onIndexChange}
          renderItem={({ item }) => <SlideItem file={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
