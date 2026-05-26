import { StyleSheet, View } from 'react-native';
import type { CameraResult, OpenConfig } from '../utils';
import { NoCamera } from './NoCamera';
import { NoPermission } from './NoPermission';

type Props = {
  config: OpenConfig;
  onSettle: (r: CameraResult) => void;
};

export function Container({ config, onSettle }: Props) {
  // 后续 Task 替换：useCameraPermission / useCameraDevice / ...
  // 当前仅渲染一个占位
  void config;
  return (
    <View style={styles.root} testID="camera-container">
      {/* Phase B 仅占位，真实内容来自 Phase C */}
      <NoPermission
        onCancel={() => onSettle({ code: 0, data: [], message: 'cancelled' })}
      />
    </View>
  );
}

void NoCamera; // 暂时压制 unused

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
