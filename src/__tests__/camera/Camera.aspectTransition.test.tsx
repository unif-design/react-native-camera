import { StyleSheet } from 'react-native';
import { Camera } from '../../camera/Camera';
import type { CameraMode } from '../../utils';
import type { AspectRatio } from '../../camera/setup';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

// 画幅切换「原生系统相机式」(取景框高度动画 + cover 跟随缩放、**无黑色转场遮罩**)的结构断言:
// 直接渲染 <Camera>(绕过 Container),验证取景框不再硬跳 aspectRatio、而是由 height 驱动伸缩,
// 且 VisionCamera resizeMode='cover'(画面随框缩放 = 原生观感;contain 会露黑边)。
// jest 的 reanimated 桩:useAnimatedStyle=fn=>fn()、withTiming 同步返回终值,故能读到动画 style 的静止终态。
//
// frame 宽恒屏宽,目标高 = winW / frameAspect(4:3→3/4、16:9→9/16)。jest 下 useWindowDimensions
// 返回默认窗宽(RN 测试环境),这里只断言「height 是有限数 + 无 aspectRatio」,不绑定具体像素。

const singleMode: CameraMode = { mode: 'single' };

function renderCamera(aspectRatio: AspectRatio = '4:3') {
  return renderDark(
    <Camera
      device={makeDeviceStub() as never}
      currentMode={singleMode}
      isActive={false}
      aspectRatio={aspectRatio}
    />
  );
}

/** 取景框 = 包住 VisionCamera 的最近父 View(Animated.View 在 jest 下渲染成普通 View)。 */
function getFrameStyle(root: ReturnType<typeof renderDark>['UNSAFE_root']) {
  const vc = root.findByProps({ nativeID: 'vision-camera' });
  const frame = vc.parent;
  return StyleSheet.flatten(frame?.props.style);
}

it('取景框由 height 驱动,不再硬跳 aspectRatio', () => {
  const { UNSAFE_root } = renderCamera('4:3');
  const style = getFrameStyle(UNSAFE_root);
  expect(style.aspectRatio).toBeUndefined();
  expect(typeof style.height).toBe('number');
  expect(Number.isFinite(style.height)).toBe(true);
  // frame 宽恒屏宽、裁切溢出(高度动画时取景在黑底上平滑伸缩)。
  expect(style.width).toBe('100%');
  expect(style.overflow).toBe('hidden');
});

it('16:9 取景框比 4:3 更高(目标高 = winW / frameAspect,方向正确)', () => {
  // 目标高 = winW / frameAspect。frameAspect 4:3=0.75、16:9=0.5625 → 16:9 高更大。
  const h43 = getFrameStyle(renderCamera('4:3').UNSAFE_root).height as number;
  const h169 = getFrameStyle(renderCamera('16:9').UNSAFE_root).height as number;
  expect(h169).toBeGreaterThan(h43);
});

it("VisionCamera resizeMode='cover'(画面随框缩放 = 原生观感,非 contain 露黑边)", () => {
  const { UNSAFE_root } = renderCamera('4:3');
  const vc = UNSAFE_root.findByProps({ nativeID: 'vision-camera' });
  expect(vc.props.resizeMode).toBe('cover');
});

it('已删除黑色转场遮罩:frame 内无纯黑 + pointerEvents=none 的绝对铺满遮罩层', () => {
  const { UNSAFE_root } = renderCamera('16:9');
  const shade = UNSAFE_root.findAll((node) => {
    const s = StyleSheet.flatten(node.props.style);
    return (
      s != null &&
      s.backgroundColor === '#000' &&
      node.props.pointerEvents === 'none'
    );
  });
  expect(shade).toHaveLength(0);
});
