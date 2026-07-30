import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { useCameraDialog } from '../ui/CameraDialogHost';
import { Carousel, carouselRemountKey } from '../../components/Carousel';
import { VIEWFINDER } from '../colors/viewfinder';
import { distinctTypes, filesOfType } from './groupTypes';
import { PreviewTopBar } from './PreviewTopBar';
import { PreviewBottomBar } from './PreviewBottomBar';

type Props = {
  files: CustomPhotoFile[];
  variant: 'confirm' | 'gallery';
  onRetake: () => void;
  onSave: () => void;
  onBack: () => void;
  onDelete: (f: CustomPhotoFile) => void;
};

export function PreviewOverlay({
  files,
  variant,
  onRetake,
  onSave,
  onBack,
  onDelete,
}: Props) {
  // 本地弹窗:删除二次确认走相机 Modal 内部 host(见 ../ui/CameraDialogHost),
  // 不走 design 全局 —— 后者会被相机 Modal 盖住。
  const { confirm } = useCameraDialog();
  const types = useMemo(() => distinctTypes(files), [files]);
  const [activeType, setActiveType] = useState<CameraModeName>(
    types[0] ?? 'single'
  );
  const [index, setIndex] = useState(0);
  const [carouselMoving, setCarouselMoving] = useState(false);
  const carouselMovingRef = useRef(false);
  const updateCarouselMoving = useCallback((moving: boolean) => {
    carouselMovingRef.current = moving;
    setCarouselMoving(moving);
  }, []);
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
  const latestSettledCurrentRef = useRef<CustomPhotoFile | undefined>(current);
  const dataKey = carouselRemountKey(data);

  // render 当帧先统一使用 safeIndex,再把 state 追平:删除末张后 Carousel / current / 计数
  // 不会出现「画面末张、删除目标首张、第 3/2 张」的短暂分裂。
  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex);
  }, [index, safeIndex]);

  useEffect(() => {
    latestSettledCurrentRef.current = current;
  }, [current]);

  // key 变化会 remount RNCarousel,旧实例可能来不及发 onSnapToItem;此时必须主动解除 moving。
  useEffect(() => {
    updateCarouselMoving(false);
  }, [dataKey, updateCarouselMoving]);

  const handleCarouselSettled = (nextIndex: number) => {
    const nextSafeIndex = Math.max(
      0,
      Math.min(nextIndex, Math.max(data.length - 1, 0))
    );
    latestSettledCurrentRef.current = data[nextSafeIndex];
    setIndex(nextSafeIndex);
    updateCarouselMoving(false);
  };

  // 直接保存:onSave 会 settle 关闭相机 Modal,此处再弹 "已保存" toast 用户根本看不到(随 Modal 同帧卸载),故不弹。
  const handleSave = () => {
    onSave();
  };
  const handleDelete = async () => {
    if (carouselMovingRef.current || !current) return;
    const requestedId = current.id;
    const ok = await confirm({
      title: '确认删除?',
      message: '图片删除后无法恢复',
    });
    const latestSettledCurrent = latestSettledCurrentRef.current;
    // confirm 等待期间 Carousel 可能刚好完成落位。只删仍是同一 settled id 的文件;
    // 不一致代表用户屏上已换图,取消本次删除以免删到上一张。
    if (
      ok &&
      !carouselMovingRef.current &&
      latestSettledCurrent?.id === requestedId
    ) {
      onDelete(latestSettledCurrent);
    }
  };

  return (
    <View style={styles.root} testID="preview-overlay">
      <PreviewTopBar
        variant={variant}
        files={files}
        activeType={activeType}
        tabsDisabled={carouselMoving}
        onSelectType={(t) => {
          if (t === activeType || carouselMovingRef.current) return;
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
        onBack={onBack}
        onDelete={handleDelete}
        deleteDisabled={carouselMoving}
      />
    </View>
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
