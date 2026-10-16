import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { InlineConfirmScope } from '@unif/react-native-design';
import type { CapturedFile, CameraCaptureMode } from '../../utils';
import { Carousel, carouselRemountKey } from '../../components/Carousel';
import { VIEWFINDER } from '../colors/viewfinder';
import { distinctTypes, filesOfType } from './groupTypes';
import { PreviewTopBar } from './PreviewTopBar';
import { PreviewBottomBar } from './PreviewBottomBar';

type Props = {
  files: CapturedFile[];
  variant: 'confirm' | 'gallery';
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: (f: CapturedFile) => void;
};

export function PreviewOverlay({
  files,
  variant,
  onRetake,
  onSave,
  onBack,
  onDelete,
}: Props) {
  const types = useMemo(() => distinctTypes(files), [files]);
  const [activeType, setActiveType] = useState<CameraCaptureMode>(
    types[0] ?? 'single'
  );
  const [index, setIndex] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CapturedFile>();
  const deleteTargetRef = useRef<CapturedFile | undefined>(undefined);
  const updateDeleteTarget = useCallback((target?: CapturedFile) => {
    deleteTargetRef.current = target;
    setDeleteTarget(target);
  }, []);
  const [carouselMoving, setCarouselMoving] = useState(false);
  const carouselMovingRef = useRef(false);
  const updateCarouselMoving = useCallback(
    (moving: boolean) => {
      if (moving) updateDeleteTarget();
      carouselMovingRef.current = moving;
      setCarouselMoving(moving);
    },
    [updateDeleteTarget]
  );
  const handleCarouselViewportChange = useCallback(() => {
    updateCarouselMoving(false);
  }, [updateCarouselMoving]);

  // 删除回收:当前类型被删空 → 切到剩余首个类型(无则关由 Container 处理)
  useEffect(() => {
    if (!types.includes(activeType)) {
      setActiveType(types[0] ?? 'single');
      setIndex(0);
    }
  }, [types, activeType]);

  // confirm 不分 tab(全 files);gallery 按 activeType 过滤
  const data = variant === 'confirm' ? files : filesOfType(files, activeType);
  const safeIndex = Math.max(0, Math.min(index, Math.max(data.length - 1, 0)));
  const current = data[safeIndex];
  const latestSettledCurrentRef = useRef<CapturedFile | undefined>(current);
  const dataKey = carouselRemountKey(data);

  // render 当帧先统一使用 safeIndex,再把 state 追平:删除末张后 Carousel / current / 计数
  // 不会出现「画面末张、删除目标首张、第 3/2 张」的短暂分裂。
  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex);
  }, [index, safeIndex]);

  useEffect(() => {
    latestSettledCurrentRef.current = current;
    if (deleteTargetRef.current && deleteTargetRef.current !== current)
      updateDeleteTarget();
  }, [current, updateDeleteTarget]);

  useEffect(
    () => () => {
      deleteTargetRef.current = undefined;
    },
    []
  );

  // key 变化会 remount RNCarousel,旧实例可能来不及发 onSnapToItem;此时必须主动解除 moving。
  useEffect(() => {
    updateCarouselMoving(false);
  }, [dataKey, updateCarouselMoving]);

  const handleCarouselSettled = (nextIndex: number) => {
    const nextSafeIndex = Math.max(
      0,
      Math.min(nextIndex, Math.max(data.length - 1, 0))
    );
    if (deleteTargetRef.current?.id !== data[nextSafeIndex]?.id)
      updateDeleteTarget();
    latestSettledCurrentRef.current = data[nextSafeIndex];
    setIndex(nextSafeIndex);
    updateCarouselMoving(false);
  };

  // 直接保存:onSave 会 settle 关闭相机 Modal,此处再弹 "已保存" toast 用户根本看不到(随 Modal 同帧卸载),故不弹。
  const handleSave = () => {
    onSave();
  };
  const requestDelete = () => {
    if (carouselMovingRef.current || !current) return;
    updateDeleteTarget(current);
  };
  const handleDelete = () => {
    const requested = deleteTargetRef.current;
    updateDeleteTarget();
    const latestSettledCurrent = latestSettledCurrentRef.current;
    // 第二次点击仍复核 settled id 与原文件归属，切图或退场后的旧回调不交付删除。
    if (
      requested &&
      !carouselMovingRef.current &&
      latestSettledCurrent?.id === requested.id &&
      current?.id === requested.id &&
      files.includes(requested)
    ) {
      onDelete(requested);
    }
  };

  return (
    <InlineConfirmScope style={styles.root} testID="preview-overlay">
      <PreviewTopBar
        variant={variant}
        files={files}
        activeType={activeType}
        tabsDisabled={carouselMoving}
        onSelectType={(t) => {
          if (t === activeType || carouselMovingRef.current) return;
          updateDeleteTarget();
          setActiveType(t);
          setIndex(0);
        }}
      />
      <View style={styles.pager}>
        <Carousel
          data={data}
          index={safeIndex}
          onScrollStart={() => updateCarouselMoving(true)}
          onViewportChange={handleCarouselViewportChange}
          onIndexChange={handleCarouselSettled}
        />
      </View>
      <PreviewBottomBar
        variant={variant}
        index={safeIndex}
        total={data.length}
        onRetake={onRetake}
        onSave={handleSave}
        onBack={() => {
          updateDeleteTarget();
          onBack();
        }}
        onDelete={handleDelete}
        deleteDisabled={carouselMoving || !current}
        deleteConfirmation={{
          label: '确认删除',
          confirmationKey: `${variant}:${activeType}:${current?.id ?? ''}`,
          confirming: !!deleteTarget,
          onRequest: requestDelete,
          onCancel: () => updateDeleteTarget(),
        }}
      />
    </InlineConfirmScope>
  );
}

// 预览整屏走相机黑底(取景器同款纯黑物理常量),不跟随 light/dark 主题 —— 与图片区
// (SlideItem 黑底)统一成一个颜色,避免浅色模式下底部 bar 透出白色。
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: VIEWFINDER.black,
    zIndex: 50,
  },
  pager: { flex: 1 },
});
