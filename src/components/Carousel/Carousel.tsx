import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Carousel as RNCarousel } from 'react-native-reanimated-carousel';
import type { CustomPhotoFile } from '../../utils';
import { SlideItem } from './SlideItem';

/**
 * Carousel remount key:数据集「换了一批」就 remount,重置 RNCarousel 的虚拟化滚动 offset。
 * 纳入完整 id 序列,避免等长且首尾相同的中间项替换复用旧实例。
 * itemSize 传入时也纳入 key:viewport 变化若直接让 RNRC 更新 itemSize,会取消进行中的
 * Reanimated spring 且不触发 onSnapToItem;remount 可回到父级最后 settled index。
 */
export function carouselRemountKey(
  data: CustomPhotoFile[],
  itemSize?: number
): string {
  return JSON.stringify([itemSize ?? null, data.map((item) => item.id)]);
}

type Props = {
  data: CustomPhotoFile[];
  /** 已落位的当前下标(删除后由父级 clamp);用作 defaultIndex,删除 remount 后落回正确张。 */
  index?: number;
  /** 手势真正开始移动时触发;父级据此冻结会依赖 settled index 的操作。 */
  onScrollStart?: () => void;
  /** viewport 宽度变化导致内部 Carousel remount 时触发。 */
  onViewportChange?: () => void;
  /** Carousel 完成落位后触发。 */
  onIndexChange?: (i: number) => void;
};

export function Carousel({
  data,
  index = 0,
  onScrollStart,
  onViewportChange,
  onIndexChange,
}: Props) {
  const { width } = useWindowDimensions();
  // 高度按实际容器(预览页 pager,夹在 top/bottom bar 之间)onLayout 实测,
  // 不再用整屏 useWindowDimensions().height —— 后者比 pager 高,RNCarousel 撑出
  // pager 后 contain 图相对「整屏」居中、相对可见 pager 偏下(顶部一大块黑),即 #2 不居中根因。
  // 量到前用 0(RNCarousel 高 0 不渲染,首帧 onLayout 后即出图),避免用错误的整屏高跳一下。
  const [trackHeight, setTrackHeight] = useState(0);
  const onLayout = (e: LayoutChangeEvent) =>
    setTrackHeight(e.nativeEvent.layout.height);
  const instanceKey = carouselRemountKey(data, width);
  const activeInstanceKeyRef = useRef(instanceKey);
  const previousWidthRef = useRef(width);

  useLayoutEffect(() => {
    activeInstanceKeyRef.current = instanceKey;
  }, [instanceKey]);

  useEffect(() => {
    if (previousWidthRef.current === width) return;
    previousWidthRef.current = width;
    onViewportChange?.();
  }, [onViewportChange, width]);

  const handleIndexChange = (nextIndex: number) => {
    // RNRC 从 UI thread 排队到 RN thread 的旧实例 callback 可能晚于 remount 到达。
    if (activeInstanceKeyRef.current !== instanceKey) return;
    onIndexChange?.(nextIndex);
  };

  return (
    <View
      style={styles.root}
      onLayout={onLayout}
      testID="camera-preview-carousel-track"
    >
      {trackHeight > 0 && (
        <RNCarousel
          // key = 数据完整身份 + viewport width:数据或 itemSize 变化就 remount,
          // 回到父级最后 settled index,同时隔离旧实例延迟到达的 callback。
          key={instanceKey}
          data={data}
          defaultIndex={Math.max(
            0,
            Math.min(index, Math.max(data.length - 1, 0))
          )}
          itemSize={width}
          keyExtractor={(item) => item.id}
          // 尺寸走 style(不再用已废弃的 width/height prop):新版 react-native-reanimated-carousel
          // deprecate 了 width/height 顶层 prop,改从 style 读,否则每帧打 deprecation 警告。
          style={{ width, height: trackHeight }}
          loop={false}
          onScrollStart={onScrollStart}
          onSnapToItem={handleIndexChange}
          renderItem={({ item }) => <SlideItem file={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
