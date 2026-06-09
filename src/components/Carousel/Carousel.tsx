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
          // key 绑数据长度:删除一张后 data 缩短 → RNCarousel 整体 remount,重置其内部
          // 虚拟化滚动 offset(否则旧 offset 指向被回收的槽位 → 停留页渲染空白黑图,即 #3)。
          // remount 后用 defaultIndex 落回父级 clamp 过的当前下标(停在正确的剩余照片)。
          key={data.length}
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
