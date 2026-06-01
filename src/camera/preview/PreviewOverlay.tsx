import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { confirm, toast, useThemedStyles } from '@unif/react-native-design';
import type { ColorTokens } from '@unif/react-native-design';
import type { CustomPhotoFile, CameraModeName } from '../../utils';
import { Carousel } from '../../components/Carousel';
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
  const styles = useThemedStyles(makeStyles);
  const types = useMemo(() => distinctTypes(files), [files]);
  const [activeType, setActiveType] = useState<CameraModeName>(
    types[0] ?? 'single'
  );
  const [index, setIndex] = useState(0);

  // confirm 不分 tab(全 files);gallery 按 activeType 过滤
  const data = variant === 'confirm' ? files : filesOfType(files, activeType);
  const current = data[index] ?? data[0];

  const handleSave = () => {
    toast.success('已保存');
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
        <Carousel data={data} onIndexChange={setIndex} />
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

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      ...StyleSheet.absoluteFill,
      backgroundColor: c.background,
      zIndex: 50,
    },
    pager: { flex: 1 },
  });
