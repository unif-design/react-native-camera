import { StyleSheet } from 'react-native';
import type { ColorTokens } from '@unif/react-native-design';
import { r } from '@unif/react-native-design';
import { VIEWFINDER } from '../colors/viewfinder';

// SideRail(画幅/闪光/声音)与 SideActions(返回/保存)是同款玻璃药丸竖栏:
// rail 容器 + 圆形 btn 两条样式逐字相同,提取到此共享,避免两处 drift。
// 各自的差异样式(SideRail 的 btnActive/aspectTxt、SideActions 的 save/saveDisabled)留在原文件。
export const makeRailStyles = (c: ColorTokens) =>
  StyleSheet.create({
    rail: {
      gap: r(8),
      padding: r(6),
      paddingVertical: r(10),
      borderRadius: r(26),
      // 药丸浮在明亮取景上:半透明黑底物理常量(design glass token 是半透白,不适用)。
      backgroundColor: VIEWFINDER.glassPill,
      borderWidth: 1,
      borderColor: c.glassSeparator,
    },
    btn: {
      width: r(40),
      height: r(40),
      borderRadius: r(999),
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
