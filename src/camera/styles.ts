import { StyleSheet } from 'react-native';
import { VIEWFINDER } from './colors/viewfinder';

export const cameraStyles = StyleSheet.create({
  // 全屏黑底,把取景框居中 → 框外区域是黑边(letterbox)。
  root: {
    flex: 1,
    backgroundColor: VIEWFINDER.black,
  },
  // 完整 rect 由 frameStyle 动画驱动；overflow:hidden 裁掉 cover 的溢出画面。
  frame: { position: 'absolute', overflow: 'hidden' },
});
