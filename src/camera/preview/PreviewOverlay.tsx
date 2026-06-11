import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { useCameraDialog } from '../ui/CameraDialogHost';
import { Carousel } from '../../components/Carousel';
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

  // 删除回收:当前类型被删空 → 切到剩余首个类型(无则关由 Container 处理)
  useEffect(() => {
    if (!types.includes(activeType)) {
      setActiveType(types[0] ?? 'single');
      setIndex(0);
    }
  }, [types, activeType]);

  // confirm 不分 tab(全 files);gallery 按 activeType 过滤
  const data = variant === 'confirm' ? files : filesOfType(files, activeType);
  const current = data[index] ?? data[0];

  // 删除后 index 越界 → 夹紧到末张(避免「第 X/Y」计数错位)
  useEffect(() => {
    if (index >= data.length && data.length > 0) setIndex(data.length - 1);
  }, [index, data.length]);

  // 直接保存:onSave 会 settle 关闭相机 Modal,此处再弹 "已保存" toast 用户根本看不到(随 Modal 同帧卸载),故不弹。
  const handleSave = () => {
    onSave();
  };
  const handleDelete = async () => {
    const ok = await confirm({
      title: '确认删除?',
      message: '图片删除后无法恢复',
    });
    if (ok && current) onDelete(current);
  };

  return (
    <View style={styles.root} testID="preview-overlay">
      <PreviewTopBar
        variant={variant}
        files={files}
        activeType={activeType}
        onSelectType={(t) => {
          setActiveType(t);
          setIndex(0);
        }}
      />
      <View style={styles.pager}>
        <Carousel data={data} index={index} onIndexChange={setIndex} />
      </View>
      <PreviewBottomBar
        variant={variant}
        index={index}
        total={data.length}
        onRetake={onRetake}
        onSave={handleSave}
        onBack={onBack}
        onDelete={handleDelete}
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
