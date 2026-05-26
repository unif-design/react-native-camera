import { StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Segmented,
  r,
  useThemedStyles,
  type ColorTokens,
} from '@unif/react-native-design';
import type { CameraMode } from '../../utils';

type Props = {
  modes: CameraMode[];
  currentIndex: number;
  recording: boolean;
  onShutter: () => void;
  onSelectMode: (i: number) => void;
  onCancel: () => void;
  onFinishBurst?: () => void;
  burstCount?: number;
};

const labelMap: Record<CameraMode['mode'], string> = {
  single: '拍照',
  continuous: '连拍',
  video: '视频',
};

export function Footer({
  modes,
  currentIndex,
  recording,
  onShutter,
  onSelectMode,
  onCancel,
  onFinishBurst,
  burstCount,
}: Props) {
  const styles = useThemedStyles(makeStyles);
  const modeItems = modes.map((m, i) => ({
    id: String(i),
    label: labelMap[m.mode],
    testID: `mode-${m.mode}`,
  }));
  return (
    <View style={styles.root}>
      {!recording && modeItems.length > 0 && (
        <View style={styles.modesRow}>
          <Segmented
            items={modeItems}
            value={String(currentIndex)}
            onChange={(v) => onSelectMode(Number(v))}
            testID="mode-segmented"
          />
        </View>
      )}
      <View style={styles.actions}>
        <Button
          variant="ghost"
          label="取消"
          onPress={onCancel}
          testID="cancel-btn"
          disabled={recording}
        />
        {/* shutter 按钮:相机 UX 惯例的圆形快门,无 design 对应组件,保留自定义实现 */}
        <TouchableOpacity
          onPress={onShutter}
          testID="shutter-btn"
          style={[styles.shutter, recording && styles.shutterRecording]}
        />
        {onFinishBurst && burstCount && burstCount > 0 ? (
          <Button
            variant="primary"
            label={`完成 (${burstCount})`}
            onPress={onFinishBurst}
            testID="finish-burst-btn"
          />
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
}

const makeStyles = (c: ColorTokens) =>
  StyleSheet.create({
    root: {
      position: 'absolute',
      bottom: r(30),
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    modesRow: { marginBottom: r(16) },
    actions: {
      flexDirection: 'row',
      width: '100%',
      justifyContent: 'space-around',
      alignItems: 'center',
    },
    // shutter 圆形快门:相机 UX 惯例,沿用白底高对比度.
    // 录制态切换为 c.error 红底标识"录制中".
    shutter: {
      width: r(64),
      height: r(64),
      borderRadius: r(32),
      backgroundColor: c.surface,
      borderWidth: r(4),
      borderColor: c.outline,
    },
    shutterRecording: { backgroundColor: c.error },
    placeholder: { width: r(60) },
  });
