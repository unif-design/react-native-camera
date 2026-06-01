# 相机 UI Phase 2a — 取景态重写 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development(全程 opus + max effort)逐任务执行。步骤用 `- [ ]` 复选框跟踪。

**Goal:** 按设计稿重写相机「取景态」(S1–S7),保持 `open()` 契约不变、零破坏性 API 变更。

**Architecture:** `Container.tsx` 编排骨架不动;用一组**固定深色**新组件替换现 `SetUp`+`Footer`:SideRail(左下) / ZoomChips / ModeSwitcherPill(橙滑块) / Shutter(多态) / ActionRow([缩略图][返回][快门][保存][翻转]) / RecordingTimer / CaptureFlash / FocusIndicator(重做)。新增运行时前后摄翻转。

**Tech Stack:** TypeScript / React Native 0.85 / vision-camera 5.x / react-native-svg / Animated / jest 29 / `@unif/react-native-design`(取景态**不**用其主题 token,改用固定深色常量)。

**Spec:** `docs/superpowers/specs/2026-05-31-camera-ui-phase2a-viewfinder-design.md`。像素值见 `docs/superpowers/research/2026-05-29-design-spec-digest.md`(下称 **digest**)。

**前置:** 分支 `feat/camera-ui-phase2a` 已建,spec 已提交。库 2.6.1。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/camera/colors/dark.ts` | 取景态固定深色常量(白/黑/橙) | 新建 |
| `src/camera/colors/dark.test.ts` | 常量值契约 | 新建 |
| `src/camera/icons/VolumeIcon.tsx` | 声音 on/off 内联 SVG(design 缺 volume) | 新建 |
| `src/camera/footer/RecordingTimer.tsx` | 红点闪烁 + MM:SS(含 `formatDuration`) | 新建 |
| `src/camera/footer/ZoomChips.tsx` | 底部居中 .5/1/2x 玻璃芯片 | 新建 |
| `src/camera/footer/Shutter.tsx` | 多态快门(白圆/红圆/红圆角方块 + 按下缩放) | 新建 |
| `src/camera/footer/ThumbnailStack.tsx` | 缩略图 + 橙角标 + bump | 新建 |
| `src/camera/footer/FlipButton.tsx` | 前后摄翻转按钮 | 新建 |
| `src/camera/footer/ModeSwitcherPill.tsx` | 圆角胶囊 + 橙滑块 | 新建 |
| `src/camera/footer/ActionRow.tsx` | 底部一行容器 | 新建 |
| `src/camera/setup/SideRail.tsx` | 左下竖排:宽高比/闪光/声音/网格 + 闪光下拉 | 由 `SetUp.tsx` 改写(删 SetUp) |
| `src/camera/CaptureFlash.tsx` | 全屏白闪 overlay | 新建 |
| `src/camera/FocusIndicator.tsx` | 四角括号 + 中心点 + 曝光小太阳 + 多段动画 | 重做 |
| `src/camera/Camera.tsx` | 加翻转切 device + 翻转动画 + 网格叠加 | 改 |
| `src/camera/Container.tsx` | 接新取景态层、翻转 state、保存/返回、自动预览规则 | 改 |
| `src/camera/footer/Footer.tsx` | 拆解后删除 | 删 |
| `jest.setup.ts` | 加 react-native-svg mock | 改 |

> 像素(尺寸/圆角/透明度/曲线/时长)一律查 digest 第 3 节;`r()`/`rf()` 缩放;安全区用 `useSafeAreaInsets()`,不照搬魔数。design 组件在测试中是 passthrough(渲染 null),故组件测试用「`not.toThrow()` + 顶层 `testID`」降级断言(沿用现 `footer.test.tsx` 模式)。

---

## Task 1: 固定深色常量 `colors/dark.ts`

**Files:**
- Create: `src/camera/colors/dark.ts`
- Test: `src/camera/colors/dark.test.ts`

- [ ] **Step 1: 写失败测试**
```ts
// src/camera/colors/dark.test.ts
import { DARK } from './dark';

it('exposes brand orange and core dark tokens', () => {
  expect(DARK.orange).toBe('#EB6E00');
  expect(DARK.white).toBe('#fff');
  expect(DARK.recRed).toBe('#ff3b30');
  expect(DARK.orange16).toBe('rgba(235,110,0,0.16)');
});
```

- [ ] **Step 2: 跑测试确认失败**
Run: `yarn jest src/camera/colors/dark.test.ts`
Expected: FAIL(找不到模块 `./dark`)

- [ ] **Step 3: 实现**
```ts
// src/camera/colors/dark.ts
// 取景态固定深色常量。取景器是相机画面,永远深色,不跟随 light/dark 主题;
// 只有预览/弹窗/Toast(2b)走 useColors()。品牌橙两主题都不变。
export const DARK = {
  white: '#fff',
  white95: 'rgba(255,255,255,0.95)',
  white65: 'rgba(255,255,255,0.65)',
  white40: 'rgba(255,255,255,0.4)',
  white25: 'rgba(255,255,255,0.25)',
  white12: 'rgba(255,255,255,0.12)',
  white08: 'rgba(255,255,255,0.08)',
  black: '#000',
  black42: 'rgba(0,0,0,0.42)',
  black45: 'rgba(0,0,0,0.45)',
  orange: '#EB6E00',
  orange16: 'rgba(235,110,0,0.16)',
  orange18: 'rgba(235,110,0,0.18)',
  orange95: 'rgba(235,110,0,0.95)',
  recRed: '#ff3b30',
} as const;
```

- [ ] **Step 4: 跑测试确认通过**
Run: `yarn jest src/camera/colors/dark.test.ts` → PASS

- [ ] **Step 5: 提交**
```bash
git add src/camera/colors/dark.ts src/camera/colors/dark.test.ts
git commit -m "feat(2a): add fixed-dark color constants for viewfinder"
```

---

## Task 2: jest 加 react-native-svg mock + 声音图标 `VolumeIcon`

**Files:**
- Modify: `jest.setup.ts`(尾部追加)
- Create: `src/camera/icons/VolumeIcon.tsx`
- Test: `src/camera/icons/VolumeIcon.test.tsx`

- [ ] **Step 1: jest.setup.ts 追加 svg mock**(放文件末尾)
```ts
// react-native-svg:jest 渲染成占位,组件挂载测试用
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  const p = (props: any) => require('react').createElement(View, props);
  return { __esModule: true, default: p, Svg: p, Path: p, Circle: p, Line: p, G: p, Rect: p };
});
```

- [ ] **Step 2: 写失败测试**
```tsx
// src/camera/icons/VolumeIcon.test.tsx
import { render } from '@testing-library/react-native';
import { VolumeIcon } from './VolumeIcon';

it('renders without crashing (on/off)', () => {
  expect(() => render(<VolumeIcon on size={20} color="#fff" />)).not.toThrow();
  expect(() => render(<VolumeIcon on={false} size={20} color="#fff" />)).not.toThrow();
});
```

- [ ] **Step 3: 跑确认失败**
Run: `yarn jest src/camera/icons/VolumeIcon.test.tsx` → FAIL(模块缺失)

- [ ] **Step 4: 实现**(用 react-native-svg 画喇叭 + on 时声波 / off 时斜杠)
```tsx
// src/camera/icons/VolumeIcon.tsx
import Svg, { Path, Line } from 'react-native-svg';

type Props = { on: boolean; size: number; color: string };

export function VolumeIcon({ on, size, color }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 喇叭主体 */}
      <Path
        d="M4 9v6h4l5 4V5L8 9H4z"
        fill={color}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {on ? (
        // 声波两道
        <Path
          d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        // 关:斜杠
        <Line x1={16} y1={8} x2={21} y2={16} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      )}
    </Svg>
  );
}
```

- [ ] **Step 5: 跑确认通过 + 提交**
```bash
yarn jest src/camera/icons/VolumeIcon.test.tsx
git add jest.setup.ts src/camera/icons/VolumeIcon.tsx src/camera/icons/VolumeIcon.test.tsx
git commit -m "feat(2a): inline VolumeIcon SVG + jest svg mock"
```

---

## Task 3: `RecordingTimer`(含纯函数 `formatDuration`)

**Files:**
- Create: `src/camera/footer/RecordingTimer.tsx`
- Test: `src/camera/footer/RecordingTimer.test.tsx`

- [ ] **Step 1: 写失败测试**(纯函数 + 渲染)
```tsx
// src/camera/footer/RecordingTimer.test.tsx
import { render } from '@testing-library/react-native';
import { RecordingTimer, formatDuration } from './RecordingTimer';

it('formatDuration → MM:SS', () => {
  expect(formatDuration(0)).toBe('00:00');
  expect(formatDuration(65)).toBe('01:05');
  expect(formatDuration(3661)).toBe('61:01');
  expect(formatDuration(-5)).toBe('00:00');
});

it('renders timer pill', () => {
  const { getByTestId } = render(<RecordingTimer seconds={5} />);
  expect(getByTestId('recording-timer')).toBeTruthy();
});
```

- [ ] **Step 2: 跑确认失败** → `yarn jest src/camera/footer/RecordingTimer.test.tsx`

- [ ] **Step 3: 实现**(红点 `recBlink` 用 Animated 循环;像素见 digest §S4)
```tsx
// src/camera/footer/RecordingTimer.tsx
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function RecordingTimer({ seconds }: { seconds: number }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);
  return (
    <View style={styles.pill} testID="recording-timer">
      <Animated.View style={[styles.dot, { opacity: blink }]} />
      <Text style={styles.text}>{formatDuration(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: r(8),
    paddingVertical: r(6), paddingHorizontal: r(14), borderRadius: r(999),
    backgroundColor: 'rgba(255,59,48,0.18)',
  },
  dot: { width: r(8), height: r(8), borderRadius: r(4), backgroundColor: DARK.recRed },
  text: { color: DARK.white, fontSize: r(13), fontVariant: ['tabular-nums'] },
});
```

- [ ] **Step 4: 跑确认通过 + 提交**
```bash
yarn jest src/camera/footer/RecordingTimer.test.tsx
git add src/camera/footer/RecordingTimer.tsx src/camera/footer/RecordingTimer.test.tsx
git commit -m "feat(2a): RecordingTimer with MM:SS + blink dot"
```

---

## Task 4: `Shutter`(多态快门)

**Files:**
- Create: `src/camera/footer/Shutter.tsx`
- Test: `src/camera/footer/Shutter.test.tsx`

快门态:`mode` 决定内圈 —— `single`/`continuous`=白实心圆;`video` 且未录=红实心圆;`recording`=红圆角方块。按下 `onPressIn/Out` 缩放(纯视觉)。像素见 digest §快门。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/footer/Shutter.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Shutter } from './Shutter';

it('fires onPress and renders for each mode', () => {
  const onPress = jest.fn();
  const { getByTestId, rerender } = render(
    <Shutter mode="single" recording={false} onPress={onPress} />
  );
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(() => rerender(<Shutter mode="video" recording={false} onPress={onPress} />)).not.toThrow();
  expect(() => rerender(<Shutter mode="video" recording={true} onPress={onPress} />)).not.toThrow();
});

it('disabled blocks press', () => {
  const onPress = jest.fn();
  const { getByTestId } = render(<Shutter mode="single" recording={false} disabled onPress={onPress} />);
  fireEvent.press(getByTestId('shutter-btn'));
  expect(onPress).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/footer/Shutter.tsx
import { useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

type Props = {
  mode: 'single' | 'continuous' | 'video';
  recording: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function Shutter({ mode, recording, disabled, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.timing(scale, { toValue: v, duration: 100, useNativeDriver: true }).start();
  const isVideo = mode === 'video';
  const inner = recording
    ? styles.innerRecording
    : isVideo
      ? styles.innerVideo
      : styles.innerPhoto;
  return (
    <Pressable
      testID="shutter-btn"
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => to(0.94)}
      onPressOut={() => to(1)}
    >
      <Animated.View style={[styles.ring, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.innerBase, inner]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: r(72), height: r(72), borderRadius: r(36),
    borderWidth: r(3), borderColor: DARK.white95,
    alignItems: 'center', justifyContent: 'center',
  },
  innerBase: { },
  innerPhoto: { width: r(58), height: r(58), borderRadius: r(29), backgroundColor: DARK.white },
  innerVideo: { width: r(58), height: r(58), borderRadius: r(29), backgroundColor: DARK.recRed },
  innerRecording: { width: r(24), height: r(24), borderRadius: r(4), backgroundColor: DARK.recRed },
});
```

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/footer/Shutter.test.tsx
git add src/camera/footer/Shutter.tsx src/camera/footer/Shutter.test.tsx
git commit -m "feat(2a): multi-state Shutter component"
```

---

## Task 5: `ThumbnailStack`(缩略图 + 橙角标)

**Files:**
- Create: `src/camera/footer/ThumbnailStack.tsx`
- Test: `src/camera/footer/ThumbnailStack.test.tsx`

`count>1` 显示橙角标;无图显示空框;新图 bump(scale 1.08→1)。像素见 digest §缩略图。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/footer/ThumbnailStack.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ThumbnailStack } from './ThumbnailStack';

it('empty state, no badge, tappable', () => {
  const onPress = jest.fn();
  const { getByTestId, queryByTestId } = render(
    <ThumbnailStack latestUri={undefined} count={0} onPress={onPress} />
  );
  fireEvent.press(getByTestId('thumbnail-stack'));
  expect(onPress).toHaveBeenCalled();
  expect(queryByTestId('thumb-badge')).toBeNull();
});

it('shows badge when count > 1', () => {
  const { getByTestId } = render(
    <ThumbnailStack latestUri="file:///a.jpg" count={3} onPress={() => {}} />
  );
  expect(getByTestId('thumb-badge')).toBeTruthy();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/footer/ThumbnailStack.tsx
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

type Props = { latestUri?: string; count: number; onPress: () => void };

export function ThumbnailStack({ latestUri, count, onPress }: Props) {
  return (
    <TouchableOpacity testID="thumbnail-stack" onPress={onPress} style={styles.wrap}>
      {latestUri ? (
        <Image source={{ uri: latestUri }} style={styles.img} />
      ) : (
        <View style={styles.empty} />
      )}
      {count > 1 && (
        <View style={styles.badge} testID="thumb-badge">
          <Text style={styles.badgeText}>{count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { width: r(44), height: r(44) },
  img: { width: r(44), height: r(44), borderRadius: r(6), borderWidth: 2, borderColor: DARK.white },
  empty: { width: r(44), height: r(44), borderRadius: r(8), borderWidth: 1.5, borderColor: DARK.white40, backgroundColor: DARK.white08 },
  badge: {
    position: 'absolute', top: r(-6), right: r(-6), minWidth: r(20), height: r(20),
    borderRadius: r(999), backgroundColor: DARK.orange, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: r(4),
  },
  badgeText: { color: DARK.white, fontSize: r(11), fontWeight: '700' },
});
```
> bump 动画(新图 scale 1.08→1)留实现者用 `useEffect`+`Animated` 接 `count` 变化补;测试只验角标/空框/点击。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/footer/ThumbnailStack.test.tsx
git add src/camera/footer/ThumbnailStack.tsx src/camera/footer/ThumbnailStack.test.tsx
git commit -m "feat(2a): ThumbnailStack with orange count badge"
```

---

## Task 6: `FlipButton` + `ZoomChips`

**Files:**
- Create: `src/camera/footer/FlipButton.tsx`, `src/camera/footer/ZoomChips.tsx`
- Test: `src/camera/footer/FlipButton.test.tsx`, `src/camera/footer/ZoomChips.test.tsx`

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/footer/FlipButton.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { FlipButton } from './FlipButton';
it('fires onFlip', () => {
  const onFlip = jest.fn();
  const { getByTestId } = render(<FlipButton onFlip={onFlip} />);
  fireEvent.press(getByTestId('flip-btn'));
  expect(onFlip).toHaveBeenCalled();
});
```
```tsx
// src/camera/footer/ZoomChips.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ZoomChips } from './ZoomChips';
it('renders 3 chips and selects', () => {
  const onSelect = jest.fn();
  const { getByTestId } = render(<ZoomChips zoom={1} onSelect={onSelect} />);
  fireEvent.press(getByTestId('zoom-chip-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/footer/FlipButton.tsx
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Icon, r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';
export function FlipButton({ onFlip }: { onFlip: () => void }) {
  return (
    <TouchableOpacity testID="flip-btn" onPress={onFlip} style={styles.btn}>
      <Icon name="lens-flip" size={r(20)} color={DARK.white} />
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  btn: { width: r(44), height: r(44), borderRadius: r(22), backgroundColor: DARK.white12, alignItems: 'center', justifyContent: 'center' },
});
```
```tsx
// src/camera/footer/ZoomChips.tsx
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';
const STOPS = [0.5, 1, 2] as const;
export function ZoomChips({ zoom, onSelect }: { zoom: number; onSelect: (z: number) => void }) {
  return (
    <View style={styles.row}>
      {STOPS.map((z) => {
        const active = Math.abs(zoom - z) < 0.05;
        return (
          <TouchableOpacity key={z} testID={`zoom-chip-${z}`} onPress={() => onSelect(z)}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.txt, active && styles.txtActive]}>{active ? `${z}x` : `${z}`}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: r(8), padding: r(4), borderRadius: r(999), backgroundColor: DARK.black45 },
  chip: { width: r(32), height: r(32), borderRadius: r(16), alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: DARK.white95 },
  txt: { color: DARK.white, fontSize: r(12), fontWeight: '500' },
  txtActive: { color: DARK.orange, fontSize: r(11), fontWeight: '700' },
});
```

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/footer/FlipButton.test.tsx src/camera/footer/ZoomChips.test.tsx
git add src/camera/footer/FlipButton.tsx src/camera/footer/ZoomChips.tsx src/camera/footer/FlipButton.test.tsx src/camera/footer/ZoomChips.test.tsx
git commit -m "feat(2a): FlipButton + ZoomChips"
```

---

## Task 7: `ModeSwitcherPill`(橙滑块)

**Files:**
- Create: `src/camera/footer/ModeSwitcherPill.tsx`
- Test: `src/camera/footer/ModeSwitcherPill.test.tsx`

等宽假设:容器宽度 `onLayout` 测得 → 每项宽 = 容器宽/项数;橙滑块 absolute,`translateX = index*itemW`,`Animated.timing 240ms`。单项时只显示居中文字 label。顺序固定 连拍/单拍/视频。像素见 digest §模式切换器。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/footer/ModeSwitcherPill.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ModeSwitcherPill } from './ModeSwitcherPill';

const items = [{ key: 'continuous', label: '连拍' }, { key: 'single', label: '单拍' }, { key: 'video', label: '视频' }];

it('selects by tap', () => {
  const onSelect = jest.fn();
  const { getByTestId } = render(<ModeSwitcherPill items={items} currentIndex={1} onSelect={onSelect} />);
  fireEvent.press(getByTestId('mode-pill-2'));
  expect(onSelect).toHaveBeenCalledWith(2);
});

it('single item shows label only (no pill)', () => {
  const { queryByTestId, getByText } = render(
    <ModeSwitcherPill items={[{ key: 'single', label: '单拍' }]} currentIndex={0} onSelect={() => {}} />
  );
  expect(queryByTestId('mode-pill-0')).toBeNull();
  expect(getByText('单拍')).toBeTruthy();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/footer/ModeSwitcherPill.tsx
import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { r } from '@unif/react-native-design';
import { DARK } from '../colors/dark';

export type ModeItem = { key: string; label: string };

export function ModeSwitcherPill({
  items, currentIndex, onSelect,
}: { items: ModeItem[]; currentIndex: number; onSelect: (i: number) => void }) {
  const [w, setW] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;
  const itemW = items.length ? w / items.length : 0;

  useEffect(() => {
    Animated.timing(slide, { toValue: currentIndex * itemW, duration: 240, useNativeDriver: true }).start();
  }, [currentIndex, itemW, slide]);

  if (items.length === 1) {
    return <Text style={styles.singleLabel}>{items[0]!.label}</Text>;
  }
  return (
    <View style={styles.wrap} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {itemW > 0 && (
        <Animated.View style={[styles.slider, { width: itemW, transform: [{ translateX: slide }] }]} />
      )}
      {items.map((it, i) => {
        const sel = i === currentIndex;
        return (
          <TouchableOpacity key={it.key} testID={`mode-pill-${i}`} style={styles.item} onPress={() => onSelect(i)}>
            <Text style={[styles.txt, sel && styles.txtSel]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignSelf: 'center', position: 'relative' },
  slider: { position: 'absolute', top: r(4), bottom: r(4), left: 0, borderRadius: r(999), backgroundColor: DARK.orange16 },
  item: { paddingVertical: r(8), paddingHorizontal: r(22), alignItems: 'center' },
  txt: { color: DARK.white65, fontSize: r(15), fontWeight: '500', letterSpacing: 1 },
  txtSel: { color: DARK.orange, fontWeight: '600' },
  singleLabel: { color: DARK.white65, fontSize: r(14), letterSpacing: 2, alignSelf: 'center' },
});
```
> 注:测试在 mock 下 `onLayout` 不触发(w=0),滑块不渲染、不影响点击与单项断言。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/footer/ModeSwitcherPill.test.tsx
git add src/camera/footer/ModeSwitcherPill.tsx src/camera/footer/ModeSwitcherPill.test.tsx
git commit -m "feat(2a): ModeSwitcherPill with orange sliding indicator"
```

---

## Task 8: `ActionRow`(底部一行)

**Files:**
- Create: `src/camera/footer/ActionRow.tsx`
- Test: `src/camera/footer/ActionRow.test.tsx`

组合:`[ThumbnailStack] 返回 [Shutter] 保存 [FlipButton]`。返回/保存用 design `Button`(返回 ghost / 保存 primary)。录制态:返回/保存/缩略图/翻转隐藏(只留快门)。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/footer/ActionRow.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ActionRow } from './ActionRow';

const base = {
  mode: 'single' as const, recording: false, latestUri: undefined, count: 0,
  onShutter: jest.fn(), onBack: jest.fn(), onSave: jest.fn(), onFlip: jest.fn(), onOpenPreview: jest.fn(),
};

it('wires shutter/back/save/flip', () => {
  const p = { ...base, onShutter: jest.fn(), onBack: jest.fn(), onSave: jest.fn(), onFlip: jest.fn() };
  const { getByTestId } = render(<ActionRow {...p} />);
  fireEvent.press(getByTestId('shutter-btn')); expect(p.onShutter).toHaveBeenCalled();
  fireEvent.press(getByTestId('back-btn')); expect(p.onBack).toHaveBeenCalled();
  fireEvent.press(getByTestId('save-btn')); expect(p.onSave).toHaveBeenCalled();
  fireEvent.press(getByTestId('flip-btn')); expect(p.onFlip).toHaveBeenCalled();
});

it('recording hides back/save/flip/thumb', () => {
  const { queryByTestId, getByTestId } = render(<ActionRow {...base} recording />);
  expect(getByTestId('shutter-btn')).toBeTruthy();
  expect(queryByTestId('back-btn')).toBeNull();
  expect(queryByTestId('save-btn')).toBeNull();
  expect(queryByTestId('flip-btn')).toBeNull();
  expect(queryByTestId('thumbnail-stack')).toBeNull();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/footer/ActionRow.tsx
import { StyleSheet, View } from 'react-native';
import { Button, r } from '@unif/react-native-design';
import { Shutter } from './Shutter';
import { ThumbnailStack } from './ThumbnailStack';
import { FlipButton } from './FlipButton';

type Props = {
  mode: 'single' | 'continuous' | 'video';
  recording: boolean;
  latestUri?: string;
  count: number;
  onShutter: () => void;
  onBack: () => void;
  onSave: () => void;
  onFlip: () => void;
  onOpenPreview: () => void;
};

export function ActionRow({ mode, recording, latestUri, count, onShutter, onBack, onSave, onFlip, onOpenPreview }: Props) {
  return (
    <View style={styles.row}>
      {!recording ? <ThumbnailStack latestUri={latestUri} count={count} onPress={onOpenPreview} /> : <View style={styles.slot} />}
      {!recording ? <Button variant="ghost" label="返回" onPress={onBack} testID="back-btn" /> : <View style={styles.slot} />}
      <Shutter mode={mode} recording={recording} onPress={onShutter} />
      {!recording ? <Button variant="primary" label="保存" onPress={onSave} testID="save-btn" /> : <View style={styles.slot} />}
      {!recording ? <FlipButton onFlip={onFlip} /> : <View style={styles.slot} />}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: r(20) },
  slot: { width: r(44) },
});
```

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/footer/ActionRow.test.tsx
git add src/camera/footer/ActionRow.tsx src/camera/footer/ActionRow.test.tsx
git commit -m "feat(2a): ActionRow (thumbnail/back/shutter/save/flip)"
```

---

## Task 9: `SideRail`(改写 SetUp)

**Files:**
- Create: `src/camera/setup/SideRail.tsx`
- Modify: `src/camera/setup/index.tsx`(导出 `SideRail`、保留 `AspectRatio`/`FlashMode` 类型)
- Delete: `src/camera/setup/SetUp.tsx`(及其测试若有)
- Test: `src/camera/setup/SideRail.test.tsx`

左下竖排玻璃药丸:**宽高比 / 闪光 / 声音 / 网格** 4 个圆形 icon button(用 design `Icon`;声音用 `VolumeIcon`)。闪光点击展开向右下拉(自定义弹层,3 项 自动/开/关)。`recording` 时整体隐藏。像素见 digest §侧边栏 + 闪光下拉。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/setup/SideRail.test.tsx
import { render, fireEvent } from '@testing-library/react-native';
import { SideRail } from './SideRail';

const base = {
  flash: 'off' as const, aspectRatio: '4:3' as const, sound: true, grid: false,
  onChangeFlash: jest.fn(), onChangeAspectRatio: jest.fn(), onToggleSound: jest.fn(), onToggleGrid: jest.fn(),
};

it('toggles aspect / sound / grid', () => {
  const p = { ...base, onChangeAspectRatio: jest.fn(), onToggleSound: jest.fn(), onToggleGrid: jest.fn() };
  const { getByTestId } = render(<SideRail {...p} />);
  fireEvent.press(getByTestId('aspect-btn')); expect(p.onChangeAspectRatio).toHaveBeenCalledWith('16:9');
  fireEvent.press(getByTestId('sound-btn')); expect(p.onToggleSound).toHaveBeenCalled();
  fireEvent.press(getByTestId('grid-btn')); expect(p.onToggleGrid).toHaveBeenCalled();
});

it('flash dropdown selects a mode', () => {
  const p = { ...base, onChangeFlash: jest.fn() };
  const { getByTestId } = render(<SideRail {...p} />);
  fireEvent.press(getByTestId('flash-btn'));          // 展开
  fireEvent.press(getByTestId('flash-opt-on'));        // 选"开"
  expect(p.onChangeFlash).toHaveBeenCalledWith('on');
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**(结构如下;像素查 digest;`FlashMode`/`AspectRatio` 从 `./SetUp` 移到此文件或 `./types`)
```tsx
// src/camera/setup/SideRail.tsx
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, r, type IconName } from '@unif/react-native-design';
import { DARK } from '../colors/dark';
import { VolumeIcon } from '../icons/VolumeIcon';

export type FlashMode = 'off' | 'on' | 'auto';
export type AspectRatio = '4:3' | '16:9';

type Props = {
  flash: FlashMode; aspectRatio: AspectRatio; sound: boolean; grid: boolean;
  onChangeFlash: (m: FlashMode) => void;
  onChangeAspectRatio: (r: AspectRatio) => void;
  onToggleSound: () => void;
  onToggleGrid: () => void;
};

const flashIcon: Record<FlashMode, IconName> = { off: 'flash-off', on: 'flash-on', auto: 'flash-auto' };
const FLASH_OPTS: { key: FlashMode; label: string }[] = [
  { key: 'auto', label: '自动' }, { key: 'on', label: '打开' }, { key: 'off', label: '关闭' },
];

export function SideRail({ flash, aspectRatio, sound, grid, onChangeFlash, onChangeAspectRatio, onToggleSound, onToggleGrid }: Props) {
  const [flashOpen, setFlashOpen] = useState(false);
  return (
    <View style={styles.rail}>
      <TouchableOpacity testID="aspect-btn" style={styles.btn}
        onPress={() => onChangeAspectRatio(aspectRatio === '4:3' ? '16:9' : '4:3')}>
        <Icon name={aspectRatio === '4:3' ? 'aspect-4-3' : 'aspect-16-9'} size={r(20)} color={DARK.white95} />
      </TouchableOpacity>

      <View>
        <TouchableOpacity testID="flash-btn" style={[styles.btn, flash !== 'off' && styles.btnActive]}
          onPress={() => setFlashOpen((v) => !v)}>
          <Icon name={flashIcon[flash]} size={r(20)} color={flash !== 'off' ? DARK.white : DARK.white95} />
        </TouchableOpacity>
        {flashOpen && (
          <View style={styles.dropdown}>
            {FLASH_OPTS.map((o) => (
              <TouchableOpacity key={o.key} testID={`flash-opt-${o.key}`} style={styles.opt}
                onPress={() => { onChangeFlash(o.key); setFlashOpen(false); }}>
                <Icon name={flashIcon[o.key]} size={r(18)} color={flash === o.key ? DARK.orange : DARK.white} />
                <Text style={[styles.optTxt, flash === o.key && styles.optTxtSel]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity testID="sound-btn" style={[styles.btn, sound && styles.btnActive]} onPress={onToggleSound}>
        <VolumeIcon on={sound} size={r(20)} color={sound ? DARK.white : DARK.white95} />
      </TouchableOpacity>

      <TouchableOpacity testID="grid-btn" style={[styles.btn, grid && styles.btnActive]} onPress={onToggleGrid}>
        <Icon name="grid" size={r(18)} color={grid ? DARK.white : DARK.white95} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { gap: r(8), padding: r(6), paddingVertical: r(10), borderRadius: r(26), backgroundColor: DARK.black42 },
  btn: { width: r(40), height: r(40), borderRadius: r(999), alignItems: 'center', justifyContent: 'center' },
  btnActive: { backgroundColor: DARK.orange95 },
  dropdown: { position: 'absolute', left: r(52), top: 0, minWidth: r(130), padding: r(6), borderRadius: r(12), backgroundColor: 'rgba(28,28,30,0.94)' },
  opt: { flexDirection: 'row', alignItems: 'center', gap: r(8), padding: r(10), borderRadius: r(8) },
  optTxt: { color: DARK.white, fontSize: r(14) },
  optTxtSel: { color: DARK.orange },
});
```
> `setup/index.tsx` 改为 `export { SideRail } from './SideRail'; export type { FlashMode, AspectRatio } from './SideRail';`。删 `SetUp.tsx`。`Container`/`Camera` 里 `import { type AspectRatio, type FlashMode } from './setup'` 不变。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/setup/SideRail.test.tsx
git rm src/camera/setup/SetUp.tsx
git add src/camera/setup/SideRail.tsx src/camera/setup/SideRail.test.tsx src/camera/setup/index.tsx
git commit -m "feat(2a): rewrite SetUp into vertical SideRail with flash dropdown"
```

---

## Task 10: `CaptureFlash` + `FocusIndicator` 重做

**Files:**
- Create: `src/camera/CaptureFlash.tsx`, test
- Modify: `src/camera/FocusIndicator.tsx`(重做), test

CaptureFlash:全屏白 `Animated.View`,`trigger` 变化时 opacity 0→0.85→0(60ms 进 / 180ms 出)。FocusIndicator:四角括号 + 中心点 + 曝光小太阳(react-native-svg),多段 scale/opacity 动画,1.3s 后 `onAnimationEnd`。SVG 内容/曲线见 digest §S5/S6。

- [ ] **Step 1: 写失败测试**
```tsx
// src/camera/CaptureFlash.test.tsx
import { render } from '@testing-library/react-native';
import { CaptureFlash } from './CaptureFlash';
it('renders overlay', () => {
  const { getByTestId } = render(<CaptureFlash trigger={1} />);
  expect(getByTestId('capture-flash')).toBeTruthy();
});
```
```tsx
// src/camera/FocusIndicator.test.tsx（替换原断言保持 testID）
import { render } from '@testing-library/react-native';
import { FocusIndicator } from './FocusIndicator';
it('renders focus brackets and calls onAnimationEnd path safely', () => {
  expect(() =>
    render(<FocusIndicator point={{ x: 100, y: 200 }} onAnimationEnd={() => {}} />)
  ).not.toThrow();
});
```

- [ ] **Step 2: 跑确认失败**

- [ ] **Step 3: 实现**
```tsx
// src/camera/CaptureFlash.tsx
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { DARK } from './colors/dark';
export function CaptureFlash({ trigger }: { trigger: number }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (trigger === 0) return;
    Animated.sequence([
      Animated.timing(o, { toValue: 0.85, duration: 60, useNativeDriver: true }),
      Animated.timing(o, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [trigger, o]);
  return <Animated.View testID="capture-flash" pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DARK.white, opacity: o }]} />;
}
```
```tsx
// src/camera/FocusIndicator.tsx（重做:四角括号 + 中心点 + 曝光小太阳）
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { r } from '@unif/react-native-design';
import { DARK } from './colors/dark';
import type { Point } from '../utils';

const W = r(110), H = r(88);
const AView = Animated.createAnimatedComponent(Svg);

export function FocusIndicator({ point, onAnimationEnd }: { point: Point; onAnimationEnd: () => void }) {
  const scale = useRef(new Animated.Value(1.35)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 0.94, useNativeDriver: true }),
      ]),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
      Animated.delay(800),
      Animated.timing(opacity, { toValue: 0.72, duration: 180, useNativeDriver: true }),
    ]).start(() => onAnimationEnd());
  }, [scale, opacity, onAnimationEnd]);
  return (
    <Animated.View pointerEvents="none" testID="focus-indicator"
      style={[styles.box, { left: point.x - W / 2, top: point.y - H / 2, opacity, transform: [{ scale }] }]}>
      <AView width={W} height={H} viewBox="0 0 110 88">
        {/* 四角括号(64x64 居中) */}
        <Path d="M23 31v-8h8 M79 23h8v8 M87 57v8h-8 M31 65h-8v-8" stroke={DARK.orange} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Circle cx={55} cy={44} r={2.4} fill={DARK.orange} />
        {/* 曝光小太阳(右侧) */}
        <Circle cx={97} cy={44} r={4.5} stroke={DARK.orange} strokeWidth={1.6} fill="rgba(235,110,0,0.2)" />
        <Line x1={97} y1={20} x2={97} y2={34} stroke={DARK.orange} strokeWidth={1.6} opacity={0.45} />
        <Line x1={97} y1={54} x2={97} y2={68} stroke={DARK.orange} strokeWidth={1.6} opacity={0.45} />
      </AView>
    </Animated.View>
  );
}
const styles = StyleSheet.create({ box: { position: 'absolute', width: W, height: H } });
```
> 射线 8 道等细节实现者按 digest §S6 补全;测试只验不崩 + testID。

- [ ] **Step 4: 跑通过 + 提交**
```bash
yarn jest src/camera/CaptureFlash.test.tsx src/camera/FocusIndicator.test.tsx
git add src/camera/CaptureFlash.tsx src/camera/FocusIndicator.tsx src/camera/CaptureFlash.test.tsx src/camera/FocusIndicator.test.tsx
git commit -m "feat(2a): CaptureFlash overlay + rework FocusIndicator (brackets+sun)"
```

---

## Task 11: `Camera.tsx` — 运行时翻转 + 网格 + 闪屏触发 + 聚焦重做接线

**Files:**
- Modify: `src/camera/Camera.tsx`

加:`position`/`onFlip` 由 `Container` 控(device 切换在 Container);翻转 rotateY 动画包裹取景器;`grid` 布尔 → 3×3 九宫格叠加(SVG 或 View 线);拍照成功后递增 `captureFlash` 触发 `CaptureFlash`(或由 Container 持有 trigger 传入)。`sound` → `capturePhoto` 的 `enableShutterSound`。`FocusIndicator` 用重做版。

> 设计取舍:翻转的 device 切换在 `Container`(它持 `useCameraDevice`);`Camera` 只做 rotateY 视觉动画 + 接收新 `device`。`CaptureFlash` 由 `Container` 持 `trigger` 渲染在最上层更简单 —— **本任务把 CaptureFlash 放 Container**(见 Task 12),`Camera` 仅:① `enableShutterSound: sound`(新 prop)② `grid` 叠加 ③ 翻转动画。

- [ ] **Step 1: 改 `capturePhotoToFile` 调用 + 新 props**
`Camera` Props 加 `sound?: boolean`(默认 true)、`grid?: boolean`、`flipNonce?: number`(变化即播翻转动画)。`capture()` 内 settings 改 `enableShutterSound: sound ?? true`。

- [ ] **Step 2: 网格叠加**
取景框内加条件渲染 `grid && <GridOverlay/>`(2 竖 2 横线,`DARK.white25`,strokeWidth 0.5;用 react-native-svg 或 4 个细 `View`)。

- [ ] **Step 3: 翻转动画**
`flipNonce` 变化 → `rotateY` 0→180→(换 device 后)继续,`Animated.timing 360ms`;包住 `<VisionCamera>` 的容器。简化版:`flipNonce` 变化播一次 `rotateY: ['0deg','180deg']` 再瞬置回。

- [ ] **Step 4: 跑现有 Camera 相关测试不崩**
Run: `yarn jest src/__tests__` → 现有用例仍 PASS(若有 Camera 渲染测试,确认 not.toThrow)。

- [ ] **Step 5: 提交**
```bash
git add src/camera/Camera.tsx
git commit -m "feat(2a): wire shutter sound, grid overlay, flip animation in Camera"
```

---

## Task 12: `Container.tsx` — 接新取景态层 + 翻转 state + 保存/返回 + 自动预览规则

**Files:**
- Modify: `src/camera/Container.tsx`
- Delete: `src/camera/footer/Footer.tsx`(+ `footer/index.tsx` 改为导出新组件;`footer.test.tsx` 改写)

核心改动:
1. **翻转 state**:`const [position, setPosition] = useState(initialPosition)`;`device = useCameraDevice(position, …)`;`onFlip = () => setPosition(p => p==='back'?'front':'back')` + 递增 `flipNonce`。
2. **声音/网格 state**:`const [sound, setSound] = useState(true)`、`const [grid, setGrid] = useState(false)`。
3. **闪屏 trigger**:`const [flashNonce, setFlashNonce] = useState(0)`;拍照成功后 `setFlashNonce(n=>n+1)`;渲染 `<CaptureFlash trigger={flashNonce} />`。
4. **初始闪光**:`useState<FlashMode>(config.cameraMode[0]?.flashMode ?? 'off')`。
5. **自动预览规则**:`onShutter` 拍照分支改为——累积后 `if (currentMode.mode==='single' && config.dataRetainedMode==='clear') setPreviewing(true)`;**视频** stop 后改为**累积不进预览**(`setPhotos(prev=>[...prev,f])`,不 `setPreviewing`)。
6. **取景态渲染层**:`!previewing && device && currentMode` 时渲染 `SideRail`(左下定位)+ `ZoomChips`(底部居中)+ 底部面板(`ModeSwitcherPill` + `ActionRow`)+(录制时)`RecordingTimer`;全部固定深色定位(digest §层次/定位)。
7. **ActionRow 接线**:`onShutter`、`onBack=()=>settle(cancelled)`、`onSave=()=>settle(200,photos)`、`onFlip`、`onOpenPreview=()=>setPreviewing(true)`;`latestUri=photos.at(-1)?.uri`、`count=photos.length`。
8. **录制计时**:`recording` 时用 `recorder.recordedDuration` 或自计秒数喂 `RecordingTimer`(简化:`useEffect` setInterval 自增 `recSeconds`,stop 时清零)。

- [ ] **Step 1: 改写 `Container` 渲染 + onShutter**(完整替换 `return (<View ...device-ready>…)` 块与 `onShutter` 视频/单拍分支,按上 1–8)。`onSelectMode` 的 clear 清空逻辑保留。

- [ ] **Step 2: 删 Footer,改 footer/index.tsx**
`footer/index.tsx` → `export { ActionRow } from './ActionRow'; export { ModeSwitcherPill } from './ModeSwitcherPill'; export { Shutter } from './Shutter'; export { ZoomChips } from './ZoomChips'; export { RecordingTimer } from './RecordingTimer';`(按需)。

- [ ] **Step 3: 改写 `src/__tests__/footer.test.tsx`**(原锁 Footer 多模式;改为锁 `ModeSwitcherPill` 多模式渲染 + `ActionRow` 录制隐藏,沿用降级断言)。

- [ ] **Step 4: 状态机测试**(新增/更新 `src/__tests__/container.test.tsx` 若不存在则建)
```tsx
// 验证(用 design+vision mock,device 仍 undefined → 走 NoCamera 兜底,
// 故状态机断言聚焦可纯测的分支):此处至少断言模块可导入 + Container 渲染 permission-pending 不崩。
// 真机交互(保存→200/返回→cancelled)用现有 useCamera/契约测试覆盖;
// 复杂分支(device-ready)因 mock device=undefined 无法渲染,标注为手测。
```
> 说明:`jest.setup` 的 `useCameraDevice` 返回 `undefined`,取景态分支在单测里不可达;故 Container 的取景态交互(保存/返回/翻转/自动预览)以**手测 + 类型检查**为主,单测覆盖到 NoCamera/权限分支即可,并在 PR 说明里列出手测清单。

- [ ] **Step 5: 全量校验**
Run: `yarn typecheck && yarn test && yarn lint` → 0 错、全绿。

- [ ] **Step 6: 提交**
```bash
git rm src/camera/footer/Footer.tsx
git add src/camera/Container.tsx src/camera/footer/index.tsx src/__tests__/footer.test.tsx src/__tests__/container.test.tsx
git commit -m "feat(2a): wire new viewfinder chrome, flip, save/back, auto-preview rule"
```

---

## Task 13: 集成校验 + example + 收尾

**Files:**
- Modify: `example/src/App.tsx`(若需展示新交互;否则仅验证编译)
- Verify: 全仓库

- [ ] **Step 1: 构建**
Run: `yarn typecheck && yarn test && yarn lint && yarn prepare`
Expected: typecheck 0 错;test 全绿;lint 0 error;`yarn prepare` 产 `lib/` 无错。

- [ ] **Step 2: 自查清单**
确认:取景态全部用 `DARK` 常量(无 `useColors()`);无 `photoQuality` 等残留;`preview/*` 未改;`open()` 公共类型零改动(`git diff main -- src/utils/interface.ts` 为空)。

- [ ] **Step 3: 手测清单写入 PR**(真机)
单拍/连拍/视频切换;返回=取消、保存=结束;非保留+单拍拍完进预览、保留+单拍累积;翻转前后摄;变焦 .5/1/2x + 捏合;闪光下拉;声音/网格;聚焦四角括号;录制红点+计时;缩略图角标。

- [ ] **Step 4: 提交**
```bash
git add -A
git commit -m "chore(2a): integration verification + example wiring"
```

---

## 备注 / 风险

- **单测覆盖局限**:`jest.setup` 的 `useCameraDevice` 返回 `undefined`,取景态(device-ready)分支单测不可达 → 组件级用 `not.toThrow`+`testID` 测,Container 取景态交互以手测为主。若要单测取景态,需在测试内 `jest.mock` 局部覆盖 `useCameraDevice` 返一个假 device —— 可在 Task 12 Step 4 视情况加。
- **react-native-svg in jest**:已在 Task 2 加 mock。
- **像素/安全区**:一律 digest + `r()`/`rf()` + `useSafeAreaInsets()`,不照搬魔数(spec §10)。
- **水印不在本计划**(2c);**预览 `preview/*` 不动**(2b)。
- **`open()` 契约零改动**:本阶段不碰 `src/utils/interface.ts`。
