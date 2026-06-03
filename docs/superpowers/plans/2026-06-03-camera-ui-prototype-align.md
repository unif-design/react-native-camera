# Camera UI 原型对齐 + 弹性布局重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把取景 UI 对齐 Claude Design 原型(底部三件套 + 完成出口下沉预览页),用弹性布局重构消除 absolute 魔数,并修两个 bug(0.5x 按设备隐藏、切换摄像头比例错乱)。

**Architecture:** 取景框 `Camera.tsx` 从 `absoluteFill + 手算 frameH` 改为 `flex + aspectRatio`(布局引擎保证比例与居中,顺带修比例错乱);`Container.tsx` 从满屏 absolute 魔数改为 flex column 三段(顶部栏/取景区/底部控制),overlay 锚定取景区;ActionRow 改三件套,完成/取消出口移到 TopBar(X)与预览页(confirm 保存 / gallery 完成)。

**Tech Stack:** React Native 0.85,react-native-vision-camera 5.x,react-native-safe-area-context,@unif/react-native-design,jest + @testing-library/react-native。

**测试现实:** jest mock 下 `useCameraDevice → undefined`,取景态(device-ready)与翻转/aspectRatio **不可达**——可 TDD 的纯组件(Task 1–6)严格走测试;取景布局/翻转(Task 7–8)给实现 + **真机回归**(spec §8),并保证改动不破坏 mock 下的 NoCamera 路径。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/camera/footer/ZoomChips.tsx` | 变焦档位,按设备能力过滤 | 改 |
| `src/camera/footer/ActionRow.tsx` | 取景底部一行(三件套) | 改 |
| `src/camera/TopBar.tsx` | 取景顶部栏(取消 X) | **新增** |
| `src/camera/preview/PreviewBottomBar.tsx` | 预览底部按钮组 | 改(gallery 加完成) |
| `src/camera/preview/PreviewOverlay.tsx` | 预览主容器 | 改(透传 onComplete) |
| `src/camera/setup/SideRail.tsx` | 取景左下竖排控件 | 改(高光边+尾巴) |
| `src/camera/Camera.tsx` | 取景框 | 改(flex+aspectRatio+backface+翻转) |
| `src/camera/Container.tsx` | 主骨架 + 接线 | 改(flex column + 出口 + bug) |

---

## Task 1: ZoomChips 按设备能力过滤档位

**Files:**
- Modify: `src/camera/footer/ZoomChips.tsx`
- Test: `src/camera/footer/ZoomChips.test.tsx`

- [ ] **Step 1: 追加失败测试**

在 `ZoomChips.test.tsx` 末尾追加:

```tsx
import { render } from '@testing-library/react-native';
import { ZoomChips } from './ZoomChips';

test('minZoom=1（无超广角）不渲染 0.5 档,仍有 1/2', () => {
  const { queryByTestId } = render(
    <ZoomChips zoom={1} onSelect={() => {}} minZoom={1} maxZoom={8} />
  );
  expect(queryByTestId('zoom-chip-0.5')).toBeNull();
  expect(queryByTestId('zoom-chip-1')).toBeTruthy();
  expect(queryByTestId('zoom-chip-2')).toBeTruthy();
});

test('minZoom=0.5（有超广角）渲染 0.5 档', () => {
  const { queryByTestId } = render(
    <ZoomChips zoom={1} onSelect={() => {}} minZoom={0.5} maxZoom={8} />
  );
  expect(queryByTestId('zoom-chip-0.5')).toBeTruthy();
});

test('maxZoom<2 不渲染 2 档', () => {
  const { queryByTestId } = render(
    <ZoomChips zoom={1} onSelect={() => {}} minZoom={0.5} maxZoom={1.5} />
  );
  expect(queryByTestId('zoom-chip-2')).toBeNull();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn jest src/camera/footer/ZoomChips -t "minZoom"`
Expected: FAIL（现有 ZoomChips 无 `minZoom`/`maxZoom` prop,0.5 档恒显示）

- [ ] **Step 3: 改 ZoomChips 接受 minZoom/maxZoom 并过滤**

整体替换 `ZoomChips.tsx` 的组件与常量部分（StyleSheet 保持不变）:

```tsx
const ALL_STOPS = [0.5, 1, 2] as const;

export function ZoomChips({
  zoom,
  onSelect,
  minZoom = 1,
  maxZoom = Infinity,
}: {
  zoom: number;
  onSelect: (z: number) => void;
  minZoom?: number;
  maxZoom?: number;
}) {
  // 仅渲染设备支持的档位:0.5 需 minZoom≤0.5（超广角），2 需 maxZoom≥2。
  const stops = ALL_STOPS.filter(
    (z) => z >= minZoom - 1e-3 && z <= maxZoom + 1e-3
  );
  return (
    <View style={styles.row}>
      {stops.map((z) => {
        const active = Math.abs(zoom - z) < 0.05;
        const base = z === 0.5 ? '.5' : `${z}`;
        return (
          <TouchableOpacity
            key={z}
            testID={`zoom-chip-${z}`}
            onPress={() => onSelect(z)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.txt, active && styles.txtActive]}>
              {active ? `${base}x` : base}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn jest src/camera/footer/ZoomChips`
Expected: PASS（全部 ZoomChips 测试）

- [ ] **Step 5: Commit**

```bash
git add src/camera/footer/ZoomChips.tsx src/camera/footer/ZoomChips.test.tsx
git commit -m "fix(camera): ZoomChips 按设备 minZoom/maxZoom 过滤档位,0.5x 不支持时隐藏"
```

---

## Task 2: ActionRow 改三件套（去返回/保存）

**Files:**
- Modify: `src/camera/footer/ActionRow.tsx`
- Test: `src/camera/footer/ActionRow.test.tsx`

- [ ] **Step 1: 重写测试为三件套**

整体替换 `ActionRow.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ActionRow } from './ActionRow';

const base = {
  mode: 'single' as const,
  recording: false,
  count: 0,
  onShutter: jest.fn(),
  onFlip: jest.fn(),
  onOpenPreview: jest.fn(),
};

test('取景底部只有 缩略图|快门|翻转,无返回/保存', () => {
  const { getByTestId, queryByTestId } = render(<ActionRow {...base} />);
  expect(getByTestId('thumbnail-stack')).toBeTruthy();
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(getByTestId('flip-btn')).toBeTruthy();
  expect(queryByTestId('back-btn')).toBeNull();
  expect(queryByTestId('save-btn')).toBeNull();
});

test('点快门触发 onShutter', () => {
  const onShutter = jest.fn();
  const { getByTestId } = render(<ActionRow {...base} onShutter={onShutter} />);
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onShutter).toHaveBeenCalled();
});

test('录制中隐藏缩略图与翻转,仅留快门', () => {
  const { getByTestId, queryByTestId } = render(
    <ActionRow {...base} mode="video" recording={true} />
  );
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(queryByTestId('thumbnail-stack')).toBeNull();
  expect(queryByTestId('flip-btn')).toBeNull();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn jest src/camera/footer/ActionRow`
Expected: FAIL（现有 ActionRow 仍渲染 back-btn/save-btn,且 props 含 onBack/onSave）

- [ ] **Step 3: 重写 ActionRow 为三件套**

整体替换 `ActionRow.tsx`:

```tsx
import { StyleSheet, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { Shutter } from './Shutter';
import { ThumbnailStack } from './ThumbnailStack';
import { FlipButton } from './FlipButton';

type Props = {
  mode: 'single' | 'continuous' | 'video';
  recording: boolean;
  latestUri?: string;
  count: number;
  onShutter: () => void;
  onFlip: () => void;
  onOpenPreview: () => void;
};

export function ActionRow({
  mode,
  recording,
  latestUri,
  count,
  onShutter,
  onFlip,
  onOpenPreview,
}: Props) {
  return (
    <View style={styles.row}>
      {!recording ? (
        <ThumbnailStack
          latestUri={latestUri}
          count={count}
          onPress={onOpenPreview}
        />
      ) : (
        <View style={styles.slot} />
      )}
      <Shutter mode={mode} recording={recording} onPress={onShutter} />
      {!recording ? (
        <FlipButton onFlip={onFlip} />
      ) : (
        <View style={styles.slot} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: r(28),
  },
  slot: { width: r(44) },
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn jest src/camera/footer/ActionRow`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/camera/footer/ActionRow.tsx src/camera/footer/ActionRow.test.tsx
git commit -m "feat(camera): ActionRow 改三件套(缩略图|快门|翻转),返回/保存出口移出取景"
```

---

## Task 3: 新增 TopBar（取景顶部取消 X）

**Files:**
- Create: `src/camera/TopBar.tsx`
- Test: `src/camera/TopBar.test.tsx`

- [ ] **Step 1: 写失败测试**

创建 `src/camera/TopBar.test.tsx`:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { TopBar } from './TopBar';

test('渲染取消按钮', () => {
  const { getByTestId } = render(<TopBar onCancel={() => {}} />);
  expect(getByTestId('cancel-btn')).toBeTruthy();
});

test('点 X 触发 onCancel', () => {
  const onCancel = jest.fn();
  const { getByTestId } = render(<TopBar onCancel={onCancel} />);
  fireEvent.press(getByTestId('cancel-btn'));
  expect(onCancel).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn jest src/camera/TopBar`
Expected: FAIL with "Cannot find module './TopBar'"

- [ ] **Step 3: 创建 TopBar**

创建 `src/camera/TopBar.tsx`:

```tsx
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Icon, r } from '@unif/react-native-design';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DARK } from './colors/dark';

// 取景顶部栏:左上角取消(X)。flex 布局,顶部留安全区。
export function TopBar({ onCancel }: { onCancel: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + r(8) }]}>
      <TouchableOpacity
        testID="cancel-btn"
        style={styles.btn}
        onPress={onCancel}
      >
        <Icon name="close" size={r(22)} color={DARK.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: r(12),
    paddingBottom: r(8),
  },
  btn: {
    width: r(40),
    height: r(40),
    borderRadius: r(20),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK.black42,
  },
});
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn jest src/camera/TopBar`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/camera/TopBar.tsx src/camera/TopBar.test.tsx
git commit -m "feat(camera): 新增取景顶部 TopBar(取消 X 出口)"
```

---

## Task 4: PreviewBottomBar gallery 加「完成」按钮

**Files:**
- Modify: `src/camera/preview/PreviewBottomBar.tsx`
- Test: `src/camera/preview/PreviewBottomBar.test.tsx`

- [ ] **Step 1: 追加失败测试**

在 `PreviewBottomBar.test.tsx` 追加:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PreviewBottomBar } from './PreviewBottomBar';

test('gallery 含返回/删除/完成三按钮,完成可点', () => {
  const onComplete = jest.fn();
  const { getByTestId } = render(
    <PreviewBottomBar
      variant="gallery"
      index={0}
      total={2}
      onRetake={() => {}}
      onSave={() => {}}
      onBack={() => {}}
      onDelete={() => {}}
      onComplete={onComplete}
    />
  );
  expect(getByTestId('back-btn')).toBeTruthy();
  expect(getByTestId('delete-btn')).toBeTruthy();
  fireEvent.press(getByTestId('complete-btn'));
  expect(onComplete).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn jest src/camera/preview/PreviewBottomBar -t "完成"`
Expected: FAIL（无 `complete-btn`,且 props 无 `onComplete`）

- [ ] **Step 3: 加 onComplete prop 与完成按钮**

在 `PreviewBottomBar.tsx` 的 `Props` 加一行 `onComplete: () => void;`,在解构参数加 `onComplete,`,并把 gallery 分支(`back-btn`/`delete-btn`)替换为:

```tsx
          <>
            <Button
              variant="ghost"
              label="返回"
              onPress={onBack}
              testID="back-btn"
            />
            <Button
              variant="danger"
              label="删除"
              onPress={onDelete}
              testID="delete-btn"
            />
            <Button
              variant="primary"
              label="完成"
              onPress={onComplete}
              testID="complete-btn"
            />
          </>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn jest src/camera/preview/PreviewBottomBar`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/camera/preview/PreviewBottomBar.tsx src/camera/preview/PreviewBottomBar.test.tsx
git commit -m "feat(camera): 预览 gallery 底部加「完成」按钮(提交全部照片出口)"
```

---

## Task 5: PreviewOverlay 透传 onComplete

**Files:**
- Modify: `src/camera/preview/PreviewOverlay.tsx`
- Test: `src/camera/preview/PreviewOverlay.test.tsx`

- [ ] **Step 1: 读现状**

Run: `cat src/camera/preview/PreviewOverlay.tsx`
确认它把 `onBack/onDelete` 等转给 `PreviewBottomBar` 的位置(gallery variant)。

- [ ] **Step 2: 追加失败测试**

在 `PreviewOverlay.test.tsx` 追加（gallery 态,多张照片渲染分页 + 完成按钮）:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { PreviewOverlay } from './PreviewOverlay';

const files = [
  { id: '1', path: '/a.jpg', uri: 'file:///a.jpg', mime: 'image/jpeg', cameraMode: 'continuous', width: 1, height: 1 },
  { id: '2', path: '/b.jpg', uri: 'file:///b.jpg', mime: 'image/jpeg', cameraMode: 'continuous', width: 1, height: 1 },
] as any;

test('gallery 完成按钮触发 onComplete', () => {
  const onComplete = jest.fn();
  const { getByTestId } = render(
    <PreviewOverlay
      files={files}
      variant="gallery"
      onRetake={() => {}}
      onSave={() => {}}
      onBack={() => {}}
      onDelete={() => {}}
      onComplete={onComplete}
    />
  );
  fireEvent.press(getByTestId('complete-btn'));
  expect(onComplete).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `yarn jest src/camera/preview/PreviewOverlay -t "完成"`
Expected: FAIL（PreviewOverlay 无 `onComplete` prop,未透传）

- [ ] **Step 4: 加 onComplete prop 并透传**

在 `PreviewOverlay.tsx` 的 `Props` 类型加 `onComplete: () => void;`,在解构加 `onComplete,`,并在渲染 `PreviewBottomBar` 处补传 `onComplete={onComplete}`(与现有 `onBack`/`onDelete` 并列)。

- [ ] **Step 5: 跑测试确认通过**

Run: `yarn jest src/camera/preview/PreviewOverlay`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/camera/preview/PreviewOverlay.tsx src/camera/preview/PreviewOverlay.test.tsx
git commit -m "feat(camera): PreviewOverlay 透传 onComplete 到 gallery 完成按钮"
```

---

## Task 6: SideRail 高光边 + 闪光弹层尾巴三角

**Files:**
- Modify: `src/camera/setup/SideRail.tsx`
- Test: `src/camera/setup/SideRail.test.tsx`

- [ ] **Step 1: 追加结构测试（尾巴存在性）**

在 `SideRail.test.tsx` 追加:

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { SideRail } from './SideRail';

const base = {
  flash: 'off' as const,
  aspectRatio: '4:3' as const,
  sound: false,
  grid: false,
  onChangeFlash: jest.fn(),
  onChangeAspectRatio: jest.fn(),
  onToggleSound: jest.fn(),
  onToggleGrid: jest.fn(),
};

test('展开闪光菜单后渲染尾巴三角', () => {
  const { getByTestId, queryByTestId } = render(<SideRail {...base} />);
  expect(queryByTestId('flash-tail')).toBeNull();
  fireEvent.press(getByTestId('flash-btn'));
  expect(getByTestId('flash-tail')).toBeTruthy();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn jest src/camera/setup/SideRail -t "尾巴"`
Expected: FAIL（无 `flash-tail`）

- [ ] **Step 3: 加高光边与尾巴三角**

在 `SideRail.tsx` 的 `styles.rail` 加两行:

```tsx
  rail: {
    gap: r(8),
    padding: r(6),
    paddingVertical: r(10),
    borderRadius: r(26),
    backgroundColor: DARK.black42,
    borderWidth: 1,
    borderColor: DARK.white08,
  },
```

在 `styles.dropdown` 内的 `FLASH_OPTS.map(...)` 之后(闭合 `</View>` 之前)加尾巴元素:

```tsx
            <View style={styles.tail} testID="flash-tail" />
```

并在 `StyleSheet.create` 加 `tail` 样式（指向左侧按钮:rail 在左,弹层向右展开,尾巴在弹层左缘）:

```tsx
  tail: {
    position: 'absolute',
    left: r(-5),
    top: '50%',
    width: r(10),
    height: r(10),
    marginTop: r(-5),
    backgroundColor: 'rgba(28,28,30,0.94)',
    transform: [{ rotate: '45deg' }],
  },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn jest src/camera/setup/SideRail`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/camera/setup/SideRail.tsx src/camera/setup/SideRail.test.tsx
git commit -m "feat(camera): SideRail 加 inset 高光边 + 闪光弹层尾巴三角(对齐原型)"
```

---

## Task 7: Camera 取景框 flex + aspectRatio（修比例错乱 + 翻转加固）

**Files:**
- Modify: `src/camera/Camera.tsx`

> jest mock 下 vision-camera 的 `Camera` 是 passthrough、`useCameraDevice→undefined`,取景渲染与翻转/比例**不可单测**。本任务给实现 + 保证全套测试不回归 + 真机验证。

- [ ] **Step 1: 取景框改 aspectRatio,删手算尺寸**

在 `Camera.tsx`:

删除这三行(及仅服务于它们的 `useWindowDimensions` 引入,若无他用):

```tsx
  const { width: screenW } = useWindowDimensions();
  const frameW = screenW;
  const frameH = screenW * frameRatio;
```

把 `frameRatio` 改成 RN 的 `aspectRatio`(宽/高):

```tsx
  // aspectRatio = 宽/高。4:3 竖屏取景 高>宽 → 3/4;16:9 → 9/16。
  const frameAspect = (aspectRatio ?? '4:3') === '4:3' ? 3 / 4 : 9 / 16;
```

把 frame 的 `<View style={[styles.frame, { width: frameW, height: frameH }]}>` 改为:

```tsx
          <View style={[styles.frame, { aspectRatio: frameAspect }]}>
```

并在 `styles.frame` 加 `width: '100%'`:

```tsx
  frame: { width: '100%', overflow: 'hidden' },
```

- [ ] **Step 2: Camera root 由 absoluteFill 改 flex,翻转加 backfaceVisibility**

把 `styles.root` 从 `...StyleSheet.absoluteFill` 改为 `flex: 1`(它现在作为取景区的 flex 子元素填充):

```tsx
  root: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
```

在翻转用的 `Animated.View` 的 style 对象里加 `backfaceVisibility: 'hidden'`(与 transform 并列),避免 rotateY 到 180° 时镜像闪现:

```tsx
          style={{
            backfaceVisibility: 'hidden',
            transform: [
              { perspective: 1000 },
              {
                rotateY: flipAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '180deg'],
                }),
              },
            ],
          }}
```

- [ ] **Step 3: 跑全套测试确保无回归**

Run: `yarn jest && yarn typecheck`
Expected: PASS（mock 下走 NoCamera 路径,Camera 组件不被渲染;typecheck 0 error）

- [ ] **Step 4: Commit**

```bash
git add src/camera/Camera.tsx
git commit -m "fix(camera): 取景框改 flex+aspectRatio(修切换后比例错乱),翻转加 backfaceVisibility"
```

- [ ] **Step 5: 真机验证（记录结果,勿跳过）**

在真机/模拟器运行 example,验证:①后摄取景画面垂直居中、4:3 比例正确、无异常黑边;②前后摄翻转后画面仍居中、无残留/无镜像;③4:3↔16:9 切换比例正确。

---

## Task 8: Container flex column 重构 + 出口接线 + 翻转/变焦加固

**Files:**
- Modify: `src/camera/Container.tsx`

> 取景态 jest 不可达。本任务给实现 + 全套测试不回归 + 真机验证。

- [ ] **Step 1: 接线 ZoomChips minZoom/maxZoom**

把 `<ZoomChips ... />` 调用补两个 prop(`device` 在此分支已非空):

```tsx
          <ZoomChips
            zoom={zoom}
            minZoom={device.minZoom}
            maxZoom={device.maxZoom}
            onSelect={(z) => {
              const clamped = Math.min(
                Math.max(z, device.minZoom),
                device.maxZoom
              );
              setZoom(clamped);
              zoomShared.value = clamped;
            }}
          />
```

- [ ] **Step 2: 翻转防重入 + 延迟切 position + 切换后 clamp 变焦**

把 `onFlip` 改为防重入 + 动画中点切 position(对齐原型 180ms):

```tsx
  const flippingRef = useRef(false);
  const onFlip = () => {
    if (flippingRef.current) return;
    flippingRef.current = true;
    setFlipNonce((n) => n + 1);
    setTimeout(() => {
      setPosition((p) => (p === 'back' ? 'front' : 'back'));
    }, 180);
    setTimeout(() => {
      flippingRef.current = false;
    }, 380);
  };
```

新增 effect:device 变化(含前后摄切换)后把 zoom clamp 回新设备范围,避免越界:

```tsx
  useEffect(() => {
    if (device == null) return;
    const z = Math.min(Math.max(zoom, device.minZoom), device.maxZoom);
    if (z !== zoom) {
      setZoom(z);
      zoomShared.value = z;
    }
  }, [device]);
```

- [ ] **Step 3: 取消(X)与完成出口 handler**

新增 `handleCancel`(已拍>0 二次确认,复用 PreviewOverlay 同款 design `confirm`;`handleSave` 已存在 = `settle 200 photos`,作为 confirm 保存与 gallery 完成的统一出口):

```tsx
  const handleCancel = async () => {
    if (photos.length > 0) {
      const ok = await confirm({
        title: '放弃拍摄',
        message: `放弃已拍 ${photos.length} 张?`,
      });
      if (!ok) return;
    }
    settle({ code: 0, data: [], message: 'cancelled' });
  };
```

> `confirm` 从 `@unif/react-native-design` 引入(`import { ..., confirm } from '@unif/react-native-design'`)。其参数形态以 PreviewOverlay 现有删除确认的调用为准——Step 0 先 `grep confirm src/camera/preview/PreviewOverlay.tsx` 对齐入参字段,保持一致。

- [ ] **Step 4: 非保留模式切换拍摄类型加二次确认**

把现有 `onSelectMode` 改为已拍>0 时确认再清空:

```tsx
  const onSelectMode = async (i: number) => {
    if (i === modeIndex) return;
    if (config.dataRetainedMode === 'clear' && photos.length > 0) {
      const ok = await confirm({
        title: '切换拍摄模式',
        message: '切换将清空已拍摄的照片,是否继续?',
      });
      if (!ok) return;
      setPhotos([]);
    }
    setModeIndex(i);
  };
```

- [ ] **Step 5: 主骨架改 flex column,去 absolute 魔数,接 TopBar,ActionRow 去返回/保存,PreviewOverlay 接 onComplete**

把 device-ready 的 `return (...)` 重构为 flex column 三段。关键结构(保留现有 Camera/SideRail/ZoomChips/WatermarkStamp/CaptureFlash 子组件,仅改容器与定位):

```tsx
  return (
    <View style={styles.root} testID="device-ready">
      <TopBar onCancel={handleCancel} />

      {/* 取景区:flex 撑满,overlay 锚定其内 */}
      <View style={styles.viewport}>
        <Camera
          ref={cameraRef}
          device={device}
          currentMode={currentMode}
          flash={flash}
          aspectRatio={aspectRatio}
          zoomShared={zoomShared}
          sound={sound}
          grid={grid}
          flipNonce={flipNonce}
        />

        {!recording && config.watermark && (
          <View style={styles.watermark} pointerEvents="none">
            <WatermarkStamp watermark={config.watermark} />
          </View>
        )}

        {!recording && (
          <View style={styles.sideRail}>
            <SideRail
              flash={flash}
              aspectRatio={aspectRatio}
              sound={sound}
              grid={grid}
              onChangeFlash={setFlash}
              onChangeAspectRatio={setAspectRatio}
              onToggleSound={() => setSound((v) => !v)}
              onToggleGrid={() => setGrid((v) => !v)}
            />
          </View>
        )}

        {!recording && (
          <View style={styles.zoomChips}>
            <ZoomChips
              zoom={zoom}
              minZoom={device.minZoom}
              maxZoom={device.maxZoom}
              onSelect={(z) => {
                const clamped = Math.min(
                  Math.max(z, device.minZoom),
                  device.maxZoom
                );
                setZoom(clamped);
                zoomShared.value = clamped;
              }}
            />
          </View>
        )}

        <CaptureFlash trigger={flashNonce} />
      </View>

      {/* 底部控制区:模式 pill + 三件套 */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + r(20) }]}>
        {recording ? (
          <View style={styles.center}>
            <RecordingTimer seconds={recSeconds} />
          </View>
        ) : (
          <View style={styles.center}>
            <ModeSwitcherPill
              items={modeItems}
              currentIndex={modeIndex}
              onSelect={onSelectMode}
            />
          </View>
        )}
        <ActionRow
          mode={currentMode.mode}
          recording={recording}
          latestUri={photos.at(-1)?.uri}
          count={photos.length}
          onShutter={onShutter}
          onFlip={onFlip}
          onOpenPreview={() => {
            if (photos.length > 0) {
              setPreviewVariant('gallery');
              setPreviewing(true);
            }
          }}
        />
      </View>
    </View>
  );
```

把 `<PreviewOverlay .../>`(在 `if (previewing)` 分支)补 `onComplete={handleSave}`:

```tsx
      <PreviewOverlay
        files={photos}
        variant={previewVariant}
        onRetake={() => {
          setPhotos([]);
          setPreviewing(false);
        }}
        onSave={handleSave}
        onComplete={handleSave}
        onBack={() => setPreviewing(false)}
        onDelete={(f) => {
          const next = photos.filter((x) => x !== f);
          setPhotos(next);
          if (next.length === 0) setPreviewing(false);
        }}
      />
```

把 `burning` 分支(若存在于底部)按需保留——它仍在 `styles.bottom` 内显示烧水印 loading,逻辑不变。

替换 `styles` 中布局相关项为 flex 版(删除带 `insets.bottom + r(172)`/`r(184)` 的绝对魔数;`viewport` 用 flex 撑满,overlay 在其内贴边):

```tsx
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK.black },
  viewport: { flex: 1, position: 'relative', justifyContent: 'center' },
  watermark: { position: 'absolute', right: r(6), top: r(12), maxWidth: r(230), zIndex: 7 },
  sideRail: { position: 'absolute', left: r(12), bottom: r(24), zIndex: 9 },
  zoomChips: { position: 'absolute', left: 0, right: 0, bottom: r(16), alignItems: 'center', zIndex: 7 },
  bottom: { paddingTop: r(14), gap: r(16) },
  center: { alignItems: 'center' },
  // burningFooter / burningText 若原本存在则保留原样
});
```

> 说明:overlay(watermark/sideRail/zoomChips)仍 absolute——它们必须叠在画面上,但**锚定在 `viewport`(取景区 flex 容器)内、用小常量贴边**,不再用 `insets.bottom + 大魔数` 的全屏偏移。这是 spec §2.2 的「能 flex 就 flex,overlay 才用最小必要 absolute」。

- [ ] **Step 6: 引入 TopBar 与 confirm,移除 ActionRow 旧 props**

确认 `Container.tsx` 顶部 import:加 `import { TopBar } from './TopBar';`、把 `confirm` 加入 `@unif/react-native-design` 的解构 import。ActionRow 已无 `onBack`/`onSave`(Task 2 改),此处不再传。

- [ ] **Step 7: 跑全套测试 + 类型检查确保无回归**

Run: `yarn jest && yarn typecheck && yarn lint`
Expected: PASS（mock 下 Container 走 permission-pending / NoCamera 路径;contract/useCamera 测试不依赖取景态;0 type error;0 lint）

- [ ] **Step 8: Commit**

```bash
git add src/camera/Container.tsx
git commit -m "feat(camera): Container 改 flex column,接 TopBar/完成出口,翻转防重入+切换 clamp 变焦"
```

- [ ] **Step 9: 真机验证（记录结果）**

验证 spec §8 全清单:翻转居中/比例、无超广角不显 0.5x、单拍非保留 confirm 保存/重拍、连拍 gallery 完成/返回/删除、取景 X 取消(已拍二次确认)、非保留切模式清空确认、视频录制态。

---

## Task 9: 全套校验 + 收尾

**Files:** 无新增

- [ ] **Step 1: 全套绿**

Run: `yarn typecheck && yarn test && yarn lint && yarn prepare`
Expected: 全部 PASS（typecheck 0 / 全部测试通过 / lint 0 / bob build 成功）

- [ ] **Step 2: 自检 spec 覆盖**

对照 spec §7 改动清单逐项确认已实现(Camera/Container/TopBar/ActionRow/ZoomChips/SideRail/PreviewBottomBar/PreviewOverlay)。

- [ ] **Step 3: 真机回归清单复核**

确认 Task 7 Step 5、Task 8 Step 9 的真机项都已实测并记录;如有未过项回到对应 Task 修复。

- [ ] **Step 4: 推分支 + PR**

```bash
git push -u origin feat/camera-ui-prototype-align
gh pr create --base main --title "feat(camera): UI 对齐设计原型 + 弹性布局重构 + 修两个 bug" --body "见 docs/superpowers/specs/2026-06-03-camera-ui-prototype-align.md"
```

---

## Self-Review

- **Spec 覆盖**:§2.1 取景框→T7;§2.2 主骨架→T8;§3 出口结构→T2/T3/T4/T5/T8;§4.1 0.5x→T1;§4.2 切换→T7+T8;§5 SideRail→T6;§6 图标→无需新增(已核对);§8 测试→各 Task 测试步 + T7/T8 真机。无遗漏。
- **占位扫描**:无 TBD;每个代码步给出完整代码;真机步骤明确列验证项。
- **类型一致**:`onComplete: () => void` 在 PreviewBottomBar(T4)/PreviewOverlay(T5)/Container 透传(T8)一致;`minZoom`/`maxZoom` 在 ZoomChips(T1)定义、Container(T8)传入一致;`handleCancel`/`handleSave` 名称一致。
- **风险**:取景态无法 jest 覆盖——已在 T7/T8 用真机步骤兜底;`confirm` 入参形态以 PreviewOverlay 现有用法为准(T8 Step 0 grep 对齐)。
