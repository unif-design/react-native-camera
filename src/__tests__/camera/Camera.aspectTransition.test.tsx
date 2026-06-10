import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '@unif/react-native-design';
import { Camera } from '../../camera/Camera';
import { VIEWFINDER } from '../../camera/colors/viewfinder';
import type { CameraMode } from '../../utils';
import type { AspectRatio } from '../../camera/setup';

// 画幅切换丝滑化(取景框高度动画 + 转场遮罩)的结构断言:
// 直接渲染 <Camera>(绕过 Container),验证取景框不再硬跳 aspectRatio、而是由 height 驱动,
// 且 frame 内存在一层黑色转场遮罩。jest 的 reanimated 桩:useAnimatedStyle=fn=>fn()、
// withTiming/withSequence/withDelay 同步返回终值,故能读到动画 style 的静止终态。
//
// frame 宽恒屏宽,目标高 = winW / frameAspect(4:3→3/4、16:9→9/16)。jest 下 useWindowDimensions
// 返回默认窗宽(RN 测试环境),这里只断言「height 是有限数 + 无 aspectRatio」,不绑定具体像素。

const singleMode: CameraMode = { mode: 'single' };

function makeDevice() {
  return {
    id: 'dev-back',
    position: 'back' as const,
    minZoom: 1,
    maxZoom: 8,
    supportsFocusMetering: true,
    hasFlash: true,
    supportsSpeedQualityPrioritization: true,
    zoomLensSwitchFactors: [2],
  };
}

function renderCamera(aspectRatio: AspectRatio = '4:3') {
  return render(
    <ThemeProvider forceScheme="dark">
      <Camera
        device={makeDevice() as never}
        currentMode={singleMode}
        isActive={false}
        aspectRatio={aspectRatio}
      />
    </ThemeProvider>
  );
}

/** 取景框 = 包住 VisionCamera 的最近父 View(Animated.View 在 jest 下渲染成普通 View)。 */
function getFrameStyle(root: ReturnType<typeof render>['UNSAFE_root']) {
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

it('frame 内存在黑色转场遮罩层(盖 session 重配闪烁),首帧 opacity=0 不遮', () => {
  const { UNSAFE_root } = renderCamera('4:3');
  // 遮罩 = backgroundColor 为纯黑、pointerEvents=none 的绝对铺满层。
  const shade = UNSAFE_root.findAll((node) => {
    const s = StyleSheet.flatten(node.props.style);
    return (
      s != null &&
      s.backgroundColor === VIEWFINDER.black &&
      node.props.pointerEvents === 'none'
    );
  });
  expect(shade.length).toBeGreaterThanOrEqual(1);
  // 首帧(初次挂载)不遮:shade 起始 0、firstAspect 短路 → opacity 终态 0。
  const shadeStyle = StyleSheet.flatten(shade[0]?.props.style);
  expect(shadeStyle.opacity).toBe(0);
});
