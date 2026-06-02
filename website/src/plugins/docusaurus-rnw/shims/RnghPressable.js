/**
 * Shim：让 docusaurus（web）下用 react-native-web 的 Pressable 替换
 * react-native-gesture-handler 包内的 Pressable。
 *
 * 原因：RNGH 的 Pressable 实现依赖 GestureDetector + Gesture objects + reanimated worklets，
 * 在 react-native-web 环境里 onPress 完全不触发（playwright 实测：原生 click /
 * pointerdown / mousedown 全部无效，内部 box bg 不变 → useState 没执行）。
 *
 * 解法：webpack NormalModuleReplacementPlugin 拦截 RNGH 包内的相对 import
 * `./components/Pressable`（context 含 RNGH 路径），重定向到本 shim。仅 web bundle 走，
 * RN native 端仍走 RNGH 原版（保留 native 性能）。
 */
'use strict';

const { Pressable } = require('react-native');

module.exports = Pressable;
module.exports.default = Pressable;
