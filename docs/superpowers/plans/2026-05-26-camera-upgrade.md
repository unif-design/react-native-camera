# @unif/react-native-camera v2.0.0 升级实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前空脚手架（`create-react-native-library` library 模板）改造为基于 `react-native-vision-camera@5.x` 的相机库 v2.0.0，提供 `useCamera()` hook + 模态相机界面，支持单拍/连拍/视频/捏合变焦/点击对焦/jpegQuality 控制。

**Architecture:** 顶层 `useCamera()` 返回 `[api, holder]`；`api.open(config)` 触发 Modal 渲染并返回 Promise；内部按 vision-camera 5.x 最佳实践（`useCameraPermission` + `useCameraDevice` + `useCameraFormat` + `usePhotoOutput` + `<Camera outputs={[photoOutput]} />` + `photoOutput.capturePhoto()`）；用 Reanimated SharedValue 驱动 zoom，Gesture.Pinch 捏合，Gesture.Tap + `camera.focusTo()` 点击对焦。

**Tech Stack:** React Native 0.85 / React 19.2 / TypeScript 6 / Yarn 4.11 / `react-native-builder-bob` 0.41 / `react-native-vision-camera` 5.x / `react-native-nitro-modules` / `react-native-reanimated` 4.x / `react-native-gesture-handler` 2.21+ / `react-native-reanimated-carousel` 4.x / `react-native-safe-area-context` 5.x / Jest 30 / ESLint 9。

**Spec：** `docs/superpowers/specs/2026-05-26-camera-upgrade-design.md`

---

## 文件结构总览

按 spec 第 3 节的目录结构，本次需要新建/修改 30+ 个文件。下面列出关键文件及职责：

| 路径 | 职责 | 创建/修改 |
|---|---|---|
| `package.json` | 添加 peer deps + 版本号 2.0.0 + keywords | 修改 |
| `example/package.json` | 添加 vision-camera 等 dependencies | 修改 |
| `example/ios/.../Info.plist` | 相机/麦克风/相册权限 | 修改 |
| `example/android/app/src/main/AndroidManifest.xml` | 同上 | 修改 |
| `example/src/App.tsx` | 3 按钮（单拍/连拍/视频）+ 返回数据展示 | 重写 |
| `src/index.tsx` | 顶层导出：`useCamera` + 全部类型 | 重写 |
| `src/multiply.tsx` | 脚手架占位 | **删除** |
| `src/__tests__/index.test.tsx` | 主要 jest 测试 | 重写 |
| `src/utils/interface.ts` | 全部 TypeScript public types | 新建 |
| `src/utils/index.ts` | 工具桶导出 | 新建 |
| `src/utils/util.ts` | 杂项工具（文件 URI 拼接等） | 新建 |
| `src/utils/px-to-dp.tsx` | 设计稿适配 | 新建 |
| `src/utils/depsAreSame.ts` | 浅比较 hook 依赖 | 新建 |
| `src/utils/render-item.tsx` | 轮播渲染项 | 新建 |
| `src/hooks/index.ts` | hooks 桶导出 | 新建 |
| `src/hooks/useCamera.tsx` | 主 hook：open/close + Modal 编排 + Promise | 新建 |
| `src/hooks/useConfirm.tsx` | 关闭确认对话框 | 新建 |
| `src/hooks/useCreation.ts` | 仅声明一次的 ref（保留原能力） | 新建 |
| `src/camera/index.tsx` | 桶导出 | 新建 |
| `src/camera/ModalView.tsx` | Modal 包装 | 新建 |
| `src/camera/Container.tsx` | 权限/设备/格式/输出 编排 | 新建 |
| `src/camera/Camera.tsx` | ReanimatedCamera + GestureDetector | 新建 |
| `src/camera/FocusIndicator.tsx` | 点击对焦圈动画 | 新建 |
| `src/camera/NoCamera.tsx` | 设备不可用 | 新建 |
| `src/camera/NoPermission.tsx` | 权限被拒 | 新建 |
| `src/camera/Error.tsx` | 通用错误页 | 新建 |
| `src/camera/footer/Footer.tsx` | 快门 / 模式选择 / 缩略图 | 新建 |
| `src/camera/footer/index.tsx` | 桶导出 | 新建 |
| `src/camera/setup/SetUp.tsx` | 闪光 / 宽高比 / 镜头切换 | 新建 |
| `src/camera/setup/index.tsx` | 桶导出 | 新建 |
| `src/camera/preview/PreViewContainer.tsx` | 预览包装 | 新建 |
| `src/camera/preview/SinglePre.tsx` | 单照片预览 | 新建 |
| `src/camera/preview/PreView.tsx` | 多照片轮播预览 | 新建 |
| `src/camera/preview/PreviewFooter.tsx` | 预览底部操作 | 新建 |
| `src/camera/preview/index.tsx` | 桶导出 | 新建 |
| `src/components/index.tsx` | 通用组件桶导出 | 新建 |
| `src/components/Back.tsx Delete.tsx Rotate.tsx Save.tsx Loading.tsx PreviewThumbnail.tsx` | 通用 UI | 新建 |
| `src/components/Modal/Confirm.tsx + index.tsx` | 通用 Confirm Modal | 新建 |
| `src/components/Carousel/Carousel.tsx SlideItem.tsx index.tsx` | 预览轮播 | 新建 |
| `README.md` | 用法文档（替换脚手架默认） | 重写 |

---

## Phase A：清理脚手架 + 公共基础

### Task 1：清理脚手架占位 + jest 占位测试占位

**Files:**
- Delete: `src/multiply.tsx`
- Modify: `src/index.tsx`
- Modify: `src/__tests__/index.test.tsx`
- Modify: `example/src/App.tsx`

- [ ] **Step 1: 删除示例文件**

```bash
rm /Users/liulijun/tongyi/unif/react-native-camera/src/multiply.tsx
```

- [ ] **Step 2: 重写 src/index.tsx 为最小占位**

```ts
// src/index.tsx
export const VERSION = '2.0.0';
```

- [ ] **Step 3: 重写 src/__tests__/index.test.tsx**

```ts
import { VERSION } from '../index';

it('exposes version constant', () => {
  expect(VERSION).toBe('2.0.0');
});
```

- [ ] **Step 4: 重写 example/src/App.tsx 为最小占位**

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { VERSION } from '@unif/react-native-camera';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>v{VERSION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
```

- [ ] **Step 5: 跑 jest 验证测试通过**

Run: `yarn test`
Expected: 1 passed, 0 failed

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove scaffold placeholder and add version export"
```

---

### Task 2：安装核心 peer dependencies + 配置 example app

**Files:**
- Modify: `package.json`
- Modify: `example/package.json`

- [ ] **Step 1: 在 package.json 添加 peer dependencies + 移除 multiply 相关 keyword 调整**

替换 `package.json` 的 `peerDependencies` 段：

```json
"peerDependencies": {
  "react": ">=19.0.0",
  "react-native": ">=0.85.0",
  "react-native-vision-camera": "^5.0.0",
  "react-native-nitro-modules": "^0.x",
  "react-native-reanimated": ">=4.0.0",
  "react-native-reanimated-carousel": ">=4.0.0",
  "react-native-gesture-handler": ">=2.21.0",
  "react-native-safe-area-context": ">=5.0.0",
  "react-native-webview": "*"
}
```

同时把 `keywords` 改为：

```json
"keywords": ["react-native", "ios", "android", "camera", "vision-camera", "photo", "video"]
```

把 version 从 `0.1.0` 改为 `2.0.0`（先确定语义版本，后续 commit message 全部 `feat:`/`fix:`）。

> 注：执行前先用 `npm view react-native-nitro-modules version` 确认 nitro 当前实际版本号，把 `^0.x` 替换为具体的 `^0.X.Y`（如 `^0.31.2`）。

- [ ] **Step 2: 在 example/package.json 添加 dependencies**

替换 `example/package.json` 的 `dependencies` 段：

```json
"dependencies": {
  "react": "19.2.3",
  "react-native": "0.85.0",
  "react-native-vision-camera": "^5.0.0",
  "react-native-nitro-modules": "^0.x",
  "react-native-reanimated": "^4.0.0",
  "react-native-reanimated-carousel": "^4.0.0",
  "react-native-gesture-handler": "^2.21.0",
  "react-native-safe-area-context": "^5.0.0"
}
```

（同样把 `^0.x` 替换为 `npm view` 拿到的实际版本号。）

- [ ] **Step 3: 安装依赖**

Run: `yarn install`
Expected: 无 error，lockfile 更新

- [ ] **Step 4: iOS Pod 安装**

Run: `cd example/ios && bundle install && bundle exec pod install && cd ../..`
Expected: 所有 Pods 安装成功（vision-camera 会触发原生集成）

如果 `bundle install` 提示 Ruby 版本不对，先 `rbenv install` 或 `chruby` 切到 `.ruby-version` 指定版本。

- [ ] **Step 5: 跑 example iOS 验证空壳起得来**

Run: `yarn example ios`
Expected: 模拟器打开 example app，显示 "v2.0.0"

- [ ] **Step 6: Commit**

```bash
git add package.json example/package.json yarn.lock example/ios/Podfile.lock
git commit -m "feat: add core peer dependencies for vision-camera 5.x"
```

---

### Task 3：定义全部 TypeScript public types

**Files:**
- Create: `src/utils/interface.ts`
- Create: `src/utils/index.ts`
- Create: `src/__tests__/types.test.tsx`

- [ ] **Step 1: 创建类型定义**

`src/utils/interface.ts`:

```ts
export type CameraType = 'back' | 'front';

export type PhotoQuality = 'speed' | 'balanced' | 'quality';

export type DataRetainedMode = 'clear' | 'retain';

export type CameraModeName = 'single' | 'continuous' | 'video';

export type Point = { x: number; y: number };

export type CameraMode = {
  mode: CameraModeName;
  photoQuality?: PhotoQuality;
  jpegQuality?: number;
};

export type OpenConfig = {
  cameraMode: CameraMode[];
  dataRetainedMode: DataRetainedMode;
};

export type CustomPhotoFile = {
  path: string;
  uri: string;
  width: number;
  height: number;
  mime: 'image/jpeg' | 'video/mp4';
  mode: CameraModeName;
  duration?: number;
};

export type CameraResultCode = 0 | 200 | 403 | 404 | 500 | 503;

export type CameraResult = {
  code: CameraResultCode;
  data: CustomPhotoFile[];
  message: string;
};

export type CameraApi = {
  open: (config: OpenConfig) => Promise<CameraResult>;
  close: () => void;
};
```

- [ ] **Step 2: 创建桶导出**

`src/utils/index.ts`:

```ts
export * from './interface';
```

- [ ] **Step 3: 写类型测试（编译期）**

`src/__tests__/types.test.tsx`:

```ts
import type {
  CameraMode,
  CameraResult,
  OpenConfig,
  CustomPhotoFile,
} from '../utils';

it('CameraMode accepts photoQuality and jpegQuality', () => {
  const m: CameraMode = { mode: 'single', photoQuality: 'speed', jpegQuality: 0.9 };
  expect(m.mode).toBe('single');
});

it('CameraResult has known shape', () => {
  const r: CameraResult = { code: 200, data: [], message: 'ok' };
  expect(r.code).toBe(200);
});

it('OpenConfig requires cameraMode and dataRetainedMode', () => {
  const c: OpenConfig = {
    cameraMode: [{ mode: 'single' }],
    dataRetainedMode: 'clear',
  };
  expect(c.cameraMode).toHaveLength(1);
});

it('CustomPhotoFile mime is restricted', () => {
  const f: CustomPhotoFile = {
    path: '/tmp/x.jpg',
    uri: 'file:///tmp/x.jpg',
    width: 100,
    height: 100,
    mime: 'image/jpeg',
    mode: 'single',
  };
  expect(f.mime).toBe('image/jpeg');
});
```

- [ ] **Step 4: 跑 typecheck + 测试**

Run: `yarn typecheck && yarn test`
Expected: 0 errors，5 passed（4 个新 + 1 个原有 version 测试）

- [ ] **Step 5: Commit**

```bash
git add src/utils src/__tests__/types.test.tsx
git commit -m "feat: define public TypeScript types"
```

---

### Task 4：通用工具函数（util / depsAreSame / px-to-dp）

**Files:**
- Create: `src/utils/util.ts`
- Create: `src/utils/depsAreSame.ts`
- Create: `src/utils/px-to-dp.tsx`
- Create: `src/__tests__/util.test.ts`

- [ ] **Step 1: 写 util.ts**

`src/utils/util.ts`:

```ts
import type { CustomPhotoFile, CameraModeName } from './interface';

export function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

export function buildPhotoFile(
  raw: { path: string; width: number; height: number; duration?: number },
  mode: CameraModeName,
  isVideo: boolean = false,
): CustomPhotoFile {
  return {
    path: raw.path,
    uri: toFileUri(raw.path),
    width: raw.width,
    height: raw.height,
    mime: isVideo ? 'video/mp4' : 'image/jpeg',
    mode,
    ...(raw.duration != null ? { duration: raw.duration } : {}),
  };
}
```

- [ ] **Step 2: 写 depsAreSame.ts**

`src/utils/depsAreSame.ts`:

```ts
export function depsAreSame(a: ReadonlyArray<unknown>, b: ReadonlyArray<unknown>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}
```

- [ ] **Step 3: 写 px-to-dp.tsx**

`src/utils/px-to-dp.tsx`:

```ts
import { Dimensions, PixelRatio } from 'react-native';

const DESIGN_WIDTH = 375;

export function pxToDp(px: number): number {
  const { width } = Dimensions.get('window');
  return PixelRatio.roundToNearestPixel((px * width) / DESIGN_WIDTH);
}
```

- [ ] **Step 4: 更新 src/utils/index.ts 导出**

`src/utils/index.ts`:

```ts
export * from './interface';
export * from './util';
export * from './depsAreSame';
export * from './px-to-dp';
```

- [ ] **Step 5: 写单元测试**

`src/__tests__/util.test.ts`:

```ts
import { toFileUri, buildPhotoFile, depsAreSame } from '../utils';

describe('toFileUri', () => {
  it('prefixes path with file:// when missing', () => {
    expect(toFileUri('/tmp/x.jpg')).toBe('file:///tmp/x.jpg');
  });
  it('does not double-prefix', () => {
    expect(toFileUri('file:///tmp/x.jpg')).toBe('file:///tmp/x.jpg');
  });
});

describe('buildPhotoFile', () => {
  it('builds image file by default', () => {
    const f = buildPhotoFile({ path: '/tmp/a.jpg', width: 100, height: 200 }, 'single');
    expect(f.mime).toBe('image/jpeg');
    expect(f.uri).toBe('file:///tmp/a.jpg');
    expect(f.duration).toBeUndefined();
  });
  it('builds video file when isVideo=true', () => {
    const f = buildPhotoFile(
      { path: '/tmp/a.mp4', width: 1920, height: 1080, duration: 5.2 },
      'video',
      true,
    );
    expect(f.mime).toBe('video/mp4');
    expect(f.duration).toBe(5.2);
  });
});

describe('depsAreSame', () => {
  it('returns true for empty arrays', () => {
    expect(depsAreSame([], [])).toBe(true);
  });
  it('returns false for different lengths', () => {
    expect(depsAreSame([1], [1, 2])).toBe(false);
  });
  it('uses Object.is comparison', () => {
    expect(depsAreSame([NaN], [NaN])).toBe(true);
    expect(depsAreSame([0], [-0])).toBe(false);
  });
});
```

- [ ] **Step 6: 跑测试**

Run: `yarn test`
Expected: 12 passed（1 version + 4 types + 7 util）

- [ ] **Step 7: Commit**

```bash
git add src/utils src/__tests__/util.test.ts
git commit -m "feat: add core utility functions"
```

---

## Phase B：核心 hook + 模态相机骨架

### Task 5：useCreation hook + useConfirm hook

**Files:**
- Create: `src/hooks/useCreation.ts`
- Create: `src/hooks/useConfirm.tsx`
- Create: `src/hooks/index.ts`
- Create: `src/__tests__/useCreation.test.tsx`

- [ ] **Step 1: 写 useCreation**

`src/hooks/useCreation.ts`:

```ts
import { useRef } from 'react';
import { depsAreSame } from '../utils';

export function useCreation<T>(factory: () => T, deps: ReadonlyArray<unknown>): T {
  const current = useRef<{ deps: ReadonlyArray<unknown>; obj: T; initialized: boolean }>({
    deps,
    obj: undefined as unknown as T,
    initialized: false,
  });
  if (!current.current.initialized || !depsAreSame(deps, current.current.deps)) {
    current.current.deps = deps;
    current.current.obj = factory();
    current.current.initialized = true;
  }
  return current.current.obj;
}
```

- [ ] **Step 2: 写 useConfirm**

`src/hooks/useConfirm.tsx`:

```ts
import { Alert } from 'react-native';

export function useConfirm() {
  return (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      Alert.alert(title, message, [
        { text: '取消', onPress: () => resolve(false), style: 'cancel' },
        { text: '确认', onPress: () => resolve(true) },
      ]);
    });
}
```

- [ ] **Step 3: 写桶导出**

`src/hooks/index.ts`:

```ts
export { useCreation } from './useCreation';
export { useConfirm } from './useConfirm';
// useCamera 将在 Task 6 后加入
```

- [ ] **Step 4: 写 useCreation 测试**

`src/__tests__/useCreation.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react-native';
import { useCreation } from '../hooks';

it('returns the same value across renders when deps unchanged', () => {
  let counter = 0;
  const { result, rerender } = renderHook(({ d }: { d: number }) =>
    useCreation(() => ++counter, [d])
  , { initialProps: { d: 1 } });

  const first = result.current;
  rerender({ d: 1 });
  expect(result.current).toBe(first);
  expect(counter).toBe(1);
});

it('recreates value when deps change', () => {
  let counter = 0;
  const { result, rerender } = renderHook(({ d }: { d: number }) =>
    useCreation(() => ++counter, [d])
  , { initialProps: { d: 1 } });

  expect(result.current).toBe(1);
  rerender({ d: 2 });
  expect(result.current).toBe(2);
  expect(counter).toBe(2);
});
```

- [ ] **Step 5: 安装测试库（如未装）**

Run: `yarn add -D @testing-library/react-native`
Expected: 安装成功

- [ ] **Step 6: 跑测试**

Run: `yarn test`
Expected: 14 passed（含 2 个新增）

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useCreation.ts src/hooks/useConfirm.tsx src/hooks/index.ts src/__tests__/useCreation.test.tsx package.json yarn.lock
git commit -m "feat: add useCreation and useConfirm hooks"
```

---

### Task 6：useCamera 主 hook（仅 Promise + Modal 开关）

**Files:**
- Create: `src/hooks/useCamera.tsx`
- Modify: `src/hooks/index.ts`
- Modify: `src/index.tsx`
- Create: `src/__tests__/useCamera.test.tsx`

此 task 只实现 hook 骨架（open 触发 Modal 显示、close 触发 Modal 关闭、resolve 默认 cancelled），尚不接入真实 vision-camera。

- [ ] **Step 1: 写 useCamera**

`src/hooks/useCamera.tsx`:

```tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';

export function useCamera(): [CameraApi, React.ReactElement] {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<OpenConfig | null>(null);
  const resolverRef = useRef<((r: CameraResult) => void) | null>(null);

  const settle = useCallback((r: CameraResult) => {
    if (resolverRef.current) {
      resolverRef.current(r);
      resolverRef.current = null;
    }
    setVisible(false);
    setConfig(null);
  }, []);

  const api = useMemo<CameraApi>(() => ({
    open: (cfg: OpenConfig) =>
      new Promise<CameraResult>((resolve) => {
        resolverRef.current = resolve;
        setConfig(cfg);
        setVisible(true);
      }),
    close: () => settle({ code: 0, data: [], message: 'cancelled' }),
  }), [settle]);

  const holder = (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={() => settle({ code: 0, data: [], message: 'cancelled' })}
      testID="camera-modal"
    >
      <View testID="camera-host" style={{ flex: 1 }}>
        {/* 后续 Task 接入 Container */}
      </View>
    </Modal>
  );

  // 在 config 上消除 unused 警告（后续 Task 用）
  void config;

  return [api, holder];
}
```

- [ ] **Step 2: 更新 src/hooks/index.ts**

```ts
export { useCreation } from './useCreation';
export { useConfirm } from './useConfirm';
export { useCamera } from './useCamera';
```

- [ ] **Step 3: 更新 src/index.tsx 顶层导出**

```ts
export { useCamera } from './hooks';
export * from './utils';

export const VERSION = '2.0.0';
```

- [ ] **Step 4: 写 useCamera 测试**

`src/__tests__/useCamera.test.tsx`:

```tsx
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { useCamera } from '../hooks';
import type { CameraResult } from '../utils';

function Harness({ onResult }: { onResult: (r: CameraResult) => void }) {
  const [api, holder] = useCamera();
  React.useEffect(() => {
    api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' })
      .then(onResult);
    // close right away to test cancel path
    queueMicrotask(() => api.close());
  }, [api, onResult]);
  return <>{holder}</>;
}

it('resolves with code 0 when close() is called', async () => {
  const onResult = jest.fn();
  await act(async () => {
    render(<Harness onResult={onResult} />);
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(onResult).toHaveBeenCalledWith(
    expect.objectContaining({ code: 0, data: [], message: 'cancelled' }),
  );
});
```

- [ ] **Step 5: 跑测试 + 类型检查**

Run: `yarn typecheck && yarn test`
Expected: 15 passed

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useCamera.tsx src/hooks/index.ts src/index.tsx src/__tests__/useCamera.test.tsx
git commit -m "feat: implement useCamera hook skeleton with Promise/Modal"
```

---

### Task 7：ModalView + Container + NoPermission + NoCamera + Error 骨架

**Files:**
- Create: `src/camera/ModalView.tsx`
- Create: `src/camera/Container.tsx`
- Create: `src/camera/NoPermission.tsx`
- Create: `src/camera/NoCamera.tsx`
- Create: `src/camera/Error.tsx`
- Create: `src/camera/index.tsx`
- Modify: `src/hooks/useCamera.tsx`（接入 Container）

- [ ] **Step 1: 写 ModalView**

`src/camera/ModalView.tsx`:

```tsx
import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function ModalView({ visible, onClose, children }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
      testID="camera-modal"
    >
      <SafeAreaProvider>
        <View style={styles.root}>{children}</View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
```

- [ ] **Step 2: 写 NoPermission**

`src/camera/NoPermission.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { onCancel: () => void; onOpenSettings?: () => void };

export function NoPermission({ onCancel, onOpenSettings }: Props) {
  return (
    <View style={styles.root} testID="no-permission">
      <Text style={styles.title}>相机权限被拒</Text>
      <Text style={styles.message}>请前往系统设置开启权限</Text>
      <View style={styles.row}>
        <TouchableOpacity onPress={onCancel} style={styles.btn}>
          <Text style={styles.btnText}>取消</Text>
        </TouchableOpacity>
        {onOpenSettings && (
          <TouchableOpacity onPress={onOpenSettings} style={styles.btn}>
            <Text style={styles.btnText}>去设置</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: 'white', fontSize: 18, marginBottom: 8 },
  message: { color: '#bbb', fontSize: 14, marginBottom: 24 },
  row: { flexDirection: 'row', gap: 16 },
  btn: { paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: 'white', borderRadius: 6 },
  btnText: { color: 'white' },
});
```

- [ ] **Step 3: 写 NoCamera**

`src/camera/NoCamera.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = { onCancel: () => void };

export function NoCamera({ onCancel }: Props) {
  return (
    <View style={styles.root} testID="no-camera">
      <Text style={styles.title}>未检测到可用相机</Text>
      <TouchableOpacity onPress={onCancel} style={styles.btn}>
        <Text style={styles.btnText}>关闭</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: 'white', fontSize: 16, marginBottom: 24 },
  btn: { paddingHorizontal: 24, paddingVertical: 10, borderWidth: 1, borderColor: 'white', borderRadius: 6 },
  btnText: { color: 'white' },
});
```

- [ ] **Step 4: 写 Error**

`src/camera/Error.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export function ErrorView({ message }: { message: string }) {
  return (
    <View style={styles.root} testID="error-view">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { color: 'white', fontSize: 14 },
});
```

- [ ] **Step 5: 写 Container 骨架**

`src/camera/Container.tsx`:

```tsx
import React from 'react';
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
      <NoPermission onCancel={() => onSettle({ code: 0, data: [], message: 'cancelled' })} />
    </View>
  );
}

void NoCamera; // 暂时压制 unused

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
```

- [ ] **Step 6: 写桶导出**

`src/camera/index.tsx`:

```ts
export { ModalView } from './ModalView';
export { Container } from './Container';
export { NoPermission } from './NoPermission';
export { NoCamera } from './NoCamera';
export { ErrorView } from './Error';
```

- [ ] **Step 7: 修改 useCamera 接入 ModalView + Container**

`src/hooks/useCamera.tsx`（重写 holder 部分）：

```tsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { CameraApi, CameraResult, OpenConfig } from '../utils';
import { Container, ModalView } from '../camera';

export function useCamera(): [CameraApi, React.ReactElement] {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<OpenConfig | null>(null);
  const resolverRef = useRef<((r: CameraResult) => void) | null>(null);

  const settle = useCallback((r: CameraResult) => {
    if (resolverRef.current) {
      resolverRef.current(r);
      resolverRef.current = null;
    }
    setVisible(false);
    setConfig(null);
  }, []);

  const api = useMemo<CameraApi>(() => ({
    open: (cfg: OpenConfig) =>
      new Promise<CameraResult>((resolve) => {
        resolverRef.current = resolve;
        setConfig(cfg);
        setVisible(true);
      }),
    close: () => settle({ code: 0, data: [], message: 'cancelled' }),
  }), [settle]);

  const holder = (
    <ModalView visible={visible} onClose={() => settle({ code: 0, data: [], message: 'cancelled' })}>
      {config && <Container config={config} onSettle={settle} />}
    </ModalView>
  );

  return [api, holder];
}
```

- [ ] **Step 8: 跑测试 + typecheck**

Run: `yarn typecheck && yarn test`
Expected: 15 passed（原有测试不应破坏）

- [ ] **Step 9: Commit**

```bash
git add src/camera src/hooks/useCamera.tsx
git commit -m "feat: scaffold modal camera shell with permission/device placeholders"
```

---

## Phase C：vision-camera 核心接入

### Task 8：接入 useCameraPermission + 真实 NoPermission 流

**Files:**
- Modify: `src/camera/Container.tsx`

- [ ] **Step 1: 重写 Container 集成权限 hook**

`src/camera/Container.tsx`:

```tsx
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import type { CameraResult, OpenConfig } from '../utils';
import { NoPermission } from './NoPermission';
import { Loading } from '../components/Loading';

type Props = {
  config: OpenConfig;
  onSettle: (r: CameraResult) => void;
};

type PermissionState = 'pending' | 'granted' | 'denied';

export function Container({ config, onSettle }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [state, setState] = useState<PermissionState>(hasPermission ? 'granted' : 'pending');

  useEffect(() => {
    if (hasPermission) {
      setState('granted');
      return;
    }
    let cancelled = false;
    requestPermission().then((ok) => {
      if (cancelled) return;
      setState(ok ? 'granted' : 'denied');
    });
    return () => { cancelled = true; };
  }, [hasPermission, requestPermission]);

  void config;

  if (state === 'denied') {
    return (
      <NoPermission
        onCancel={() => onSettle({ code: 403, data: [], message: 'permission_denied' })}
        onOpenSettings={() => Linking.openSettings()}
      />
    );
  }

  if (state === 'pending') {
    return (
      <View style={styles.root} testID="permission-pending">
        <Loading />
      </View>
    );
  }

  // granted - 下个 task 接入 device
  return <View style={styles.root} testID="permission-granted" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 2: 创建 Loading 组件**

`src/components/Loading.tsx`:

```tsx
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function Loading() {
  return (
    <View style={styles.root} testID="loading">
      <ActivityIndicator color="white" size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { justifyContent: 'center', alignItems: 'center' },
});
```

`src/components/index.tsx`:

```ts
export { Loading } from './Loading';
```

- [ ] **Step 3: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 4: Example app 真机验证**

Run: `yarn example ios`（在 example/src/App.tsx 临时改为调用 useCamera）

临时验证用 example/src/App.tsx：

```tsx
import { Text, View, TouchableOpacity } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

export default function App() {
  const [api, holder] = useCamera();
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <TouchableOpacity
        onPress={async () => {
          const r = await api.open({ cameraMode: [{ mode: 'single' }], dataRetainedMode: 'clear' });
          console.log('result', r);
        }}
      >
        <Text>Open Camera</Text>
      </TouchableOpacity>
      {holder}
    </View>
  );
}
```

Expected：第一次打开 → 系统弹权限请求 → 拒绝 → 显示"相机权限被拒" → 点取消 → 回到 App，console.log 显示 `{code:403,...}`

(此处的 example/src/App.tsx 是临时验证用，不 commit；Task 21 才重写为正式版本)

- [ ] **Step 5: Commit（不含临时的 App.tsx）**

```bash
git restore example/src/App.tsx
git add src/camera/Container.tsx src/components/Loading.tsx src/components/index.tsx
git commit -m "feat: integrate useCameraPermission flow"
```

---

### Task 9：接入 useCameraDevice + 物理镜头编排 + NoCamera 路径

**Files:**
- Modify: `src/camera/Container.tsx`

- [ ] **Step 1: 更新 Container 接入 device hook**

替换 `granted` 分支返回值，新增 device 判断：

```tsx
import { useCameraDevice } from 'react-native-vision-camera';
// ... 顶部

// 在 state === 'granted' 之后：
const device = useCameraDevice('back', {
  physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
});

if (device == null) {
  return (
    <NoCamera onCancel={() => onSettle({ code: 404, data: [], message: 'no_device' })} />
  );
}

// 下一 task 接入 Camera 组件
return <View style={styles.root} testID="device-ready" />;
```

完整 Container.tsx 替换后的版本：

```tsx
import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import type { CameraResult, OpenConfig } from '../utils';
import { NoCamera } from './NoCamera';
import { NoPermission } from './NoPermission';
import { Loading } from '../components/Loading';

type Props = { config: OpenConfig; onSettle: (r: CameraResult) => void };
type PermissionState = 'pending' | 'granted' | 'denied';

export function Container({ config, onSettle }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const [state, setState] = useState<PermissionState>(hasPermission ? 'granted' : 'pending');

  useEffect(() => {
    if (hasPermission) { setState('granted'); return; }
    let cancelled = false;
    requestPermission().then((ok) => { if (!cancelled) setState(ok ? 'granted' : 'denied'); });
    return () => { cancelled = true; };
  }, [hasPermission, requestPermission]);

  const device = useCameraDevice('back', {
    physicalDevices: ['ultra-wide-angle-camera', 'wide-angle-camera'],
  });

  void config;

  if (state === 'denied') {
    return (
      <NoPermission
        onCancel={() => onSettle({ code: 403, data: [], message: 'permission_denied' })}
        onOpenSettings={() => Linking.openSettings()}
      />
    );
  }

  if (state === 'pending') {
    return <View style={styles.root} testID="permission-pending"><Loading /></View>;
  }

  if (device == null) {
    return <NoCamera onCancel={() => onSettle({ code: 404, data: [], message: 'no_device' })} />;
  }

  return <View style={styles.root} testID="device-ready" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
});
```

- [ ] **Step 2: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 3: Example 真机验证（同 Task 8 临时 App.tsx）**

Run: `yarn example ios`
Expected：同意权限 → 看到黑色背景（device 就绪占位）；模拟器无相机硬件会显示 NoCamera

- [ ] **Step 4: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/Container.tsx
git commit -m "feat: integrate useCameraDevice with physical lens preference"
```

---

### Task 10：基础 Camera 组件（vision-camera 输出 + 单拍）

**Files:**
- Create: `src/camera/Camera.tsx`
- Modify: `src/camera/Container.tsx`
- Modify: `src/camera/index.tsx`

- [ ] **Step 1: 写 Camera 组件**

`src/camera/Camera.tsx`:

```tsx
import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  Camera as VisionCamera,
  useCameraFormat,
  usePhotoOutput,
  type CameraDevice,
  type CameraProps,
} from 'react-native-vision-camera';
import type { CameraMode, CustomPhotoFile, PhotoQuality } from '../utils';
import { buildPhotoFile } from '../utils';

export type CameraHandle = {
  capture: () => Promise<CustomPhotoFile | null>;
};

type Props = {
  device: CameraDevice;
  currentMode: CameraMode;
  isActive?: boolean;
};

export const Camera = forwardRef<CameraHandle, Props>(function Camera(
  { device, currentMode, isActive = true },
  ref,
) {
  const cameraRef = useRef<VisionCamera>(null);

  const format = useCameraFormat(device, [
    { photoAspectRatio: 4 / 3 },
    { photoHdr: false },
  ]);

  const photoOutput = usePhotoOutput({
    qualityPrioritization: (currentMode.photoQuality ?? 'speed') as PhotoQuality,
    quality: currentMode.jpegQuality ?? 0.9,
  });

  useImperativeHandle(ref, () => ({
    capture: async () => {
      try {
        const photo = await photoOutput.capturePhoto({
          flash: 'off',
          enableShutterSound: true,
        });
        return buildPhotoFile(
          { path: photo.path, width: photo.width, height: photo.height },
          currentMode.mode,
        );
      } catch {
        return null;
      }
    },
  }), [photoOutput, currentMode.mode]);

  return (
    <VisionCamera
      ref={cameraRef}
      style={StyleSheet.absoluteFill}
      device={device}
      format={format ?? undefined}
      isActive={isActive}
      outputs={[photoOutput] as CameraProps['outputs']}
      testID="vision-camera"
    />
  );
});
```

- [ ] **Step 2: 在 Container 接入 Camera + 临时快门**

`src/camera/Container.tsx`（替换 device 就绪分支）：

```tsx
import { Camera, type CameraHandle } from './Camera';
import { useRef, useState } from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
// ...

// 在 device 检查通过后：
const cameraRef = useRef<CameraHandle>(null);
const [photos, setPhotos] = useState<CustomPhotoFile[]>([]);
const currentMode = config.cameraMode[0]; // 多模式选择在 Task 14 实现

return (
  <View style={styles.root}>
    <Camera ref={cameraRef} device={device} currentMode={currentMode} />
    <View style={styles.bottomBar}>
      <TouchableOpacity
        testID="cancel-btn"
        onPress={() => onSettle({ code: 0, data: [], message: 'cancelled' })}
      >
        <Text style={styles.text}>取消</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="shutter-btn"
        onPress={async () => {
          const f = await cameraRef.current?.capture();
          if (f) {
            const next = [...photos, f];
            setPhotos(next);
            onSettle({ code: 200, data: next, message: 'ok' });
          } else {
            onSettle({ code: 500, data: photos, message: 'capture_failed' });
          }
        }}
        style={styles.shutter}
      />
      <TouchableOpacity
        testID="done-btn"
        onPress={() => onSettle({ code: 200, data: photos, message: 'ok' })}
      >
        <Text style={styles.text}>完成</Text>
      </TouchableOpacity>
    </View>
  </View>
);
```

新增样式：

```ts
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  bottomBar: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  shutter: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'white', borderWidth: 4, borderColor: '#ddd',
  },
  text: { color: 'white', fontSize: 16 },
});
```

注意：把先前 device 就绪分支返回的 `<View style={styles.root} testID="device-ready" />` 替换为上述完整 JSX。同时把 `import type { CustomPhotoFile } from '../utils'` 加入。

- [ ] **Step 3: 更新 camera 桶导出**

`src/camera/index.tsx`:

```ts
export { ModalView } from './ModalView';
export { Container } from './Container';
export { NoPermission } from './NoPermission';
export { NoCamera } from './NoCamera';
export { ErrorView } from './Error';
export { Camera, type CameraHandle } from './Camera';
```

- [ ] **Step 4: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 5: Example 真机验证（iOS）**

Run: `yarn example ios`（用 Task 8 的临时 App.tsx）
Expected：进入相机 → 看到取景画面 → 点圆形快门 → 控制台 log `{code:200,data:[{path:'/var/.../*.jpg',width,height,mime:'image/jpeg',mode:'single'}],message:'ok'}`

如果 iOS Pod 配置缺失（vision-camera 5.x 要 Nitro），先 `cd example/ios && bundle exec pod install`。

- [ ] **Step 6: Example 真机验证（Android）**

Run: `yarn example android`
Expected：同上

- [ ] **Step 7: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/Camera.tsx src/camera/Container.tsx src/camera/index.tsx
git commit -m "feat: implement single-shot photo capture via vision-camera"
```

---

## Phase D：预览

### Task 11：单照片预览 SinglePre + PreviewFooter

**Files:**
- Create: `src/camera/preview/SinglePre.tsx`
- Create: `src/camera/preview/PreviewFooter.tsx`
- Create: `src/camera/preview/PreViewContainer.tsx`
- Create: `src/camera/preview/index.tsx`
- Modify: `src/camera/Container.tsx`

- [ ] **Step 1: 写 PreviewFooter**

`src/camera/preview/PreviewFooter.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  onRetake: () => void;
  onConfirm: () => void;
};

export function PreviewFooter({ onRetake, onConfirm }: Props) {
  return (
    <View style={styles.root}>
      <TouchableOpacity onPress={onRetake} testID="retake-btn"><Text style={styles.text}>重拍</Text></TouchableOpacity>
      <TouchableOpacity onPress={onConfirm} testID="confirm-btn"><Text style={styles.text}>使用照片</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', bottom: 40, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
  },
  text: { color: 'white', fontSize: 16 },
});
```

- [ ] **Step 2: 写 SinglePre**

`src/camera/preview/SinglePre.tsx`:

```tsx
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';

type Props = { file: CustomPhotoFile };

export function SinglePre({ file }: Props) {
  return (
    <View style={styles.root} testID="single-pre">
      <Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
```

- [ ] **Step 3: 写 PreViewContainer 包装**

`src/camera/preview/PreViewContainer.tsx`:

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { SinglePre } from './SinglePre';
import { PreviewFooter } from './PreviewFooter';

type Props = {
  files: CustomPhotoFile[];
  onRetake: () => void;
  onConfirm: () => void;
};

export function PreViewContainer({ files, onRetake, onConfirm }: Props) {
  return (
    <View style={styles.root}>
      {files.length === 1
        ? <SinglePre file={files[0]} />
        : null /* 多图轮播在 Task 12 实现 */}
      <PreviewFooter onRetake={onRetake} onConfirm={onConfirm} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
```

- [ ] **Step 4: 写桶导出**

`src/camera/preview/index.tsx`:

```ts
export { SinglePre } from './SinglePre';
export { PreviewFooter } from './PreviewFooter';
export { PreViewContainer } from './PreViewContainer';
```

- [ ] **Step 5: 修改 Container 拍照后进入预览**

替换 Container 拍照后逻辑：把"拍完即 settle"改为"拍完进入预览态"。

新增 state：

```tsx
const [photos, setPhotos] = useState<CustomPhotoFile[]>([]);
const [previewing, setPreviewing] = useState(false);
```

shutter onPress：

```tsx
const f = await cameraRef.current?.capture();
if (f) {
  setPhotos((prev) => [...prev, f]);
  setPreviewing(true);
} else {
  onSettle({ code: 500, data: photos, message: 'capture_failed' });
}
```

渲染分支：

```tsx
if (previewing) {
  return (
    <PreViewContainer
      files={photos}
      onRetake={() => { setPhotos([]); setPreviewing(false); }}
      onConfirm={() => onSettle({ code: 200, data: photos, message: 'ok' })}
    />
  );
}
return (
  /* 之前的取景 + bottomBar JSX */
);
```

- [ ] **Step 6: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 7: Example 真机验证**

Run: `yarn example ios`
Expected：拍照 → 进入预览页 → 点"重拍"回相机 → 再拍 → 点"使用照片" → console.log `{code:200,data:[...]}`

- [ ] **Step 8: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/preview src/camera/Container.tsx
git commit -m "feat: implement single photo preview with retake/confirm"
```

---

### Task 12：多照片预览（连拍）+ Carousel 组件

**Files:**
- Create: `src/components/Carousel/Carousel.tsx`
- Create: `src/components/Carousel/SlideItem.tsx`
- Create: `src/components/Carousel/index.tsx`
- Create: `src/components/PreviewThumbnail.tsx`
- Create: `src/camera/preview/PreView.tsx`
- Modify: `src/camera/preview/PreViewContainer.tsx`
- Modify: `src/utils/render-item.tsx`
- Modify: `src/components/index.tsx`

- [ ] **Step 1: 写 SlideItem**

`src/components/Carousel/SlideItem.tsx`:

```tsx
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';

export function SlideItem({ file }: { file: CustomPhotoFile }) {
  return (
    <View style={styles.root}>
      <Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
});
```

- [ ] **Step 2: 写 Carousel（用 reanimated-carousel）**

`src/components/Carousel/Carousel.tsx`:

```tsx
import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import RNCarousel from 'react-native-reanimated-carousel';
import type { CustomPhotoFile } from '../../utils';
import { SlideItem } from './SlideItem';

type Props = {
  data: CustomPhotoFile[];
  onIndexChange?: (i: number) => void;
};

export function Carousel({ data, onIndexChange }: Props) {
  const { width, height } = Dimensions.get('window');
  return (
    <View style={styles.root}>
      <RNCarousel
        data={data}
        width={width}
        height={height}
        loop={false}
        onSnapToItem={onIndexChange}
        renderItem={({ item }) => <SlideItem file={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
```

- [ ] **Step 3: 写 PreviewThumbnail**

`src/components/PreviewThumbnail.tsx`:

```tsx
import React from 'react';
import { Image, StyleSheet, TouchableOpacity, View } from 'react-native';
import type { CustomPhotoFile } from '../utils';

type Props = {
  files: CustomPhotoFile[];
  currentIndex: number;
  onTap: (i: number) => void;
};

export function PreviewThumbnail({ files, currentIndex, onTap }: Props) {
  return (
    <View style={styles.row}>
      {files.map((f, i) => (
        <TouchableOpacity key={`${f.path}-${i}`} onPress={() => onTap(i)}>
          <Image
            source={{ uri: f.uri }}
            style={[styles.thumb, i === currentIndex && styles.thumbActive]}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, padding: 8 },
  thumb: { width: 48, height: 48, borderRadius: 4 },
  thumbActive: { borderWidth: 2, borderColor: '#3af' },
});
```

- [ ] **Step 4: 写 PreView**

`src/camera/preview/PreView.tsx`:

```tsx
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CustomPhotoFile } from '../../utils';
import { Carousel } from '../../components/Carousel';
import { PreviewThumbnail } from '../../components/PreviewThumbnail';

type Props = { files: CustomPhotoFile[] };

export function PreView({ files }: Props) {
  const [index, setIndex] = useState(0);
  return (
    <View style={styles.root} testID="multi-pre">
      <Carousel data={files} onIndexChange={setIndex} />
      <View style={styles.thumbWrap}>
        <PreviewThumbnail files={files} currentIndex={index} onTap={setIndex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'black' },
  thumbWrap: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center' },
});
```

- [ ] **Step 5: 更新 PreViewContainer 处理多图**

替换 `files.length === 1 ? <SinglePre/> : null` 为：

```tsx
{files.length === 1 ? <SinglePre file={files[0]} /> : <PreView files={files} />}
```

- [ ] **Step 6: 更新 components 桶导出**

`src/components/index.tsx`:

```ts
export { Loading } from './Loading';
export { PreviewThumbnail } from './PreviewThumbnail';
export * from './Carousel';
```

`src/components/Carousel/index.tsx`:

```ts
export { Carousel } from './Carousel';
export { SlideItem } from './SlideItem';
```

- [ ] **Step 7: 修改 Container 支持"连拍"逻辑**

在 Container 内增加：

```tsx
const isContinuous = config.cameraMode[0].mode === 'continuous';
```

shutter onPress：

```tsx
const f = await cameraRef.current?.capture();
if (!f) { onSettle({ code: 500, data: photos, message: 'capture_failed' }); return; }
const next = [...photos, f];
setPhotos(next);
if (!isContinuous) {
  // single 模式拍完即进入预览
  setPreviewing(true);
}
// 连拍模式下：留在取景画面，shutter 可继续按
```

新增 "完成连拍"按钮（仅 continuous 模式显示）：

```tsx
{isContinuous && photos.length > 0 && (
  <TouchableOpacity testID="finish-burst" onPress={() => setPreviewing(true)}>
    <Text style={styles.text}>完成 ({photos.length})</Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 8: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 9: Example 真机验证**

Run: `yarn example ios`（临时 App 传 `cameraMode:[{mode:'continuous'}]`）
Expected：连按快门 3 次 → 看到 "完成 (3)" → 点完成 → 进入多图预览（轮播 + 缩略图） → 点"使用照片" → settle

- [ ] **Step 10: Commit**

```bash
git restore example/src/App.tsx
git add src/components src/camera/preview src/camera/Container.tsx
git commit -m "feat: implement burst (continuous) capture with multi-photo preview"
```

---

## Phase E：模式扩展

### Task 13：视频录制（video mode）

**Files:**
- Modify: `src/camera/Camera.tsx`
- Modify: `src/camera/Container.tsx`

- [ ] **Step 1: 扩展 Camera 组件支持 video 输出**

`src/camera/Camera.tsx` 修改：

```tsx
import {
  Camera as VisionCamera,
  useCameraFormat,
  useMicrophonePermission,
  usePhotoOutput,
  useVideoOutput,
  type CameraDevice,
  type CameraProps,
} from 'react-native-vision-camera';
// ...

export type CameraHandle = {
  capture: () => Promise<CustomPhotoFile | null>;
  startVideo: () => Promise<void>;
  stopVideo: () => Promise<CustomPhotoFile | null>;
};

// 在 Camera forwardRef 内：
const videoOutput = useVideoOutput();
const { hasPermission: hasMic, requestPermission: requestMic } = useMicrophonePermission();

useImperativeHandle(ref, () => ({
  capture: async () => {
    try {
      const photo = await photoOutput.capturePhoto({ flash: 'off', enableShutterSound: true });
      return buildPhotoFile(
        { path: photo.path, width: photo.width, height: photo.height },
        currentMode.mode,
      );
    } catch { return null; }
  },
  startVideo: async () => {
    if (!hasMic) await requestMic();
    try {
      await videoOutput.startRecording({ flash: 'off' });
    } catch (e) {
      console.warn('startRecording failed', e);
    }
  },
  stopVideo: async () => {
    try {
      const v = await videoOutput.stopRecording();
      return buildPhotoFile(
        { path: v.path, width: v.width ?? 0, height: v.height ?? 0, duration: v.duration },
        'video',
        true,
      );
    } catch { return null; }
  },
}), [photoOutput, videoOutput, currentMode.mode, hasMic, requestMic]);

// outputs 根据当前 mode 决定包含哪些
const outputs = currentMode.mode === 'video' ? [videoOutput] : [photoOutput];

return (
  <VisionCamera
    ref={cameraRef}
    style={StyleSheet.absoluteFill}
    device={device}
    format={format ?? undefined}
    isActive={isActive}
    outputs={outputs as CameraProps['outputs']}
    testID="vision-camera"
  />
);
```

> 注：实际 `useVideoOutput` API 命名可能在 5.0.x 略有差异（如 `startRecording`/`stopRecording`），执行时按 `node_modules/react-native-vision-camera/lib/typescript` 实际类型微调。

- [ ] **Step 2: 在 Container 支持 video 按钮**

在 Container 加：

```tsx
const isVideo = config.cameraMode[0].mode === 'video';
const [recording, setRecording] = useState(false);
```

shutter onPress：

```tsx
if (isVideo) {
  if (!recording) {
    await cameraRef.current?.startVideo();
    setRecording(true);
  } else {
    const f = await cameraRef.current?.stopVideo();
    setRecording(false);
    if (f) {
      setPhotos([f]);
      setPreviewing(true);
    } else {
      onSettle({ code: 503, data: [], message: 'video_failed' });
    }
  }
  return;
}
// 现有 photo 分支
```

录制态视觉提示：

```tsx
<View style={[styles.shutter, recording && styles.shutterRecording]} />
// styles.shutterRecording: { backgroundColor: 'red' }
```

- [ ] **Step 3: 单图预览扩展支持 video（用 react-native 内置 Video 不可用，先简化）**

简化处理：video 模式下，预览页显示首帧静态信息 + 文件路径，由消费方播放。

修改 `SinglePre.tsx`：

```tsx
import { Text } from 'react-native';
// ...
export function SinglePre({ file }: Props) {
  return (
    <View style={styles.root} testID="single-pre">
      {file.mime === 'video/mp4' ? (
        <View style={styles.videoStub}>
          <Text style={styles.videoText}>视频 · {file.duration?.toFixed(1)}s</Text>
          <Text style={styles.videoPath}>{file.path}</Text>
        </View>
      ) : (
        <Image source={{ uri: file.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      )}
    </View>
  );
}
// styles 新增：
// videoStub: { flex: 1, justifyContent: 'center', alignItems: 'center' },
// videoText: { color: 'white', fontSize: 22, marginBottom: 8 },
// videoPath: { color: '#888', fontSize: 12 },
```

- [ ] **Step 4: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 5: Example 真机验证**

Run: `yarn example ios`（临时 App `cameraMode:[{mode:'video'}]`）
Expected：点快门开始录制（变红） → 再点停止 → 预览页显示"视频 · X.Xs" → 完成 → settle 返回 `data:[{mime:'video/mp4',duration,...}]`

- [ ] **Step 6: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/Camera.tsx src/camera/Container.tsx src/camera/preview/SinglePre.tsx
git commit -m "feat: implement video recording mode"
```

---

### Task 14：多模式选择 UI + Footer 组件

**Files:**
- Create: `src/camera/footer/Footer.tsx`
- Create: `src/camera/footer/index.tsx`
- Modify: `src/camera/Container.tsx`
- Modify: `src/camera/index.tsx`

- [ ] **Step 1: 写 Footer**

`src/camera/footer/Footer.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  modes, currentIndex, recording, onShutter, onSelectMode, onCancel,
  onFinishBurst, burstCount,
}: Props) {
  return (
    <View style={styles.root}>
      <View style={styles.modesRow}>
        {modes.map((m, i) => (
          <TouchableOpacity
            key={m.mode + i}
            disabled={recording}
            onPress={() => onSelectMode(i)}
            testID={`mode-${m.mode}`}
          >
            <Text style={[styles.modeText, i === currentIndex && styles.modeActive]}>
              {labelMap[m.mode]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onCancel} testID="cancel-btn" disabled={recording}>
          <Text style={styles.text}>取消</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onShutter}
          testID="shutter-btn"
          style={[styles.shutter, recording && styles.shutterRecording]}
        />
        {onFinishBurst && burstCount && burstCount > 0 ? (
          <TouchableOpacity onPress={onFinishBurst} testID="finish-burst-btn">
            <Text style={styles.text}>完成 ({burstCount})</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center' },
  modesRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  modeText: { color: '#bbb', fontSize: 14, paddingHorizontal: 8, paddingVertical: 4 },
  modeActive: { color: 'white', fontWeight: '600' },
  actions: { flexDirection: 'row', width: '100%', justifyContent: 'space-around', alignItems: 'center' },
  shutter: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'white', borderWidth: 4, borderColor: '#ddd' },
  shutterRecording: { backgroundColor: 'red' },
  text: { color: 'white', fontSize: 14 },
  placeholder: { width: 60 },
});
```

- [ ] **Step 2: 桶导出**

`src/camera/footer/index.tsx`:

```ts
export { Footer } from './Footer';
```

更新 `src/camera/index.tsx`：

```ts
export { Footer } from './footer';
// ... 其余
```

- [ ] **Step 3: 在 Container 用 Footer 替换内嵌按钮，并接入"切换模式"逻辑**

Container 内：

```tsx
const [modeIndex, setModeIndex] = useState(0);
const currentMode = config.cameraMode[modeIndex];
```

把现有内嵌的 `<View style={styles.bottomBar}>` 替换为：

```tsx
<Footer
  modes={config.cameraMode}
  currentIndex={modeIndex}
  recording={recording}
  onShutter={onShutter}
  onSelectMode={(i) => {
    // 切换模式时，按 dataRetainedMode 决定是否清空照片栈
    if (config.dataRetainedMode === 'clear') setPhotos([]);
    setModeIndex(i);
  }}
  onCancel={() => onSettle({ code: 0, data: [], message: 'cancelled' })}
  onFinishBurst={currentMode.mode === 'continuous' ? () => setPreviewing(true) : undefined}
  burstCount={currentMode.mode === 'continuous' ? photos.length : undefined}
/>
```

其中 `onShutter` 提取为函数：

```tsx
const onShutter = async () => {
  if (currentMode.mode === 'video') {
    if (!recording) {
      await cameraRef.current?.startVideo();
      setRecording(true);
    } else {
      const f = await cameraRef.current?.stopVideo();
      setRecording(false);
      if (f) { setPhotos([f]); setPreviewing(true); }
      else onSettle({ code: 503, data: [], message: 'video_failed' });
    }
    return;
  }
  const f = await cameraRef.current?.capture();
  if (!f) { onSettle({ code: 500, data: photos, message: 'capture_failed' }); return; }
  const next = [...photos, f];
  setPhotos(next);
  if (currentMode.mode !== 'continuous') setPreviewing(true);
};
```

Camera 组件的 currentMode prop 改为 `currentMode={currentMode}`（已是变量，无变化）。

- [ ] **Step 4: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 5: Example 真机验证**

临时 App 传 `cameraMode:[{mode:'single'},{mode:'continuous'},{mode:'video'}]`
Expected：底部出现 3 个模式 tab；切换 tab；按对应模式行为拍/连/录

- [ ] **Step 6: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/footer src/camera/Container.tsx src/camera/index.tsx
git commit -m "feat: implement multi-mode footer with mode switching"
```

---

## Phase F：交互能力

### Task 15：捏合变焦（Zoom）+ ReanimatedCamera

**Files:**
- Modify: `src/camera/Camera.tsx`

- [ ] **Step 1: 在 Camera 内接入 Reanimated + Gesture.Pinch**

`src/camera/Camera.tsx` 顶部新增：

```tsx
import Reanimated, {
  useAnimatedProps,
  useSharedValue,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

Reanimated.addWhitelistedNativeProps({ zoom: true });
const ReanimatedCamera = Reanimated.createAnimatedComponent(VisionCamera);
```

替换组件实现：

```tsx
export const Camera = forwardRef<CameraHandle, Props>(function Camera(
  { device, currentMode, isActive = true },
  ref,
) {
  const cameraRef = useRef<VisionCamera>(null);

  const format = useCameraFormat(device, [
    { photoAspectRatio: 4 / 3 },
    { photoHdr: false },
  ]);

  const photoOutput = usePhotoOutput({
    qualityPrioritization: (currentMode.photoQuality ?? 'speed') as PhotoQuality,
    quality: currentMode.jpegQuality ?? 0.9,
  });
  const videoOutput = useVideoOutput();
  const { hasPermission: hasMic, requestPermission: requestMic } = useMicrophonePermission();

  const zoom = useSharedValue(device.neutralZoom);
  const zoomOffset = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onBegin(() => { zoomOffset.value = zoom.value; })
    .onUpdate((e) => {
      const z = zoomOffset.value * e.scale;
      zoom.value = interpolate(
        z, [1, 10],
        [device.minZoom, device.maxZoom],
        Extrapolation.CLAMP,
      );
    });

  const animatedProps = useAnimatedProps(() => ({ zoom: zoom.value }), [zoom]);

  useImperativeHandle(ref, () => ({
    capture: async () => {
      try {
        const photo = await photoOutput.capturePhoto({ flash: 'off', enableShutterSound: true });
        return buildPhotoFile(
          { path: photo.path, width: photo.width, height: photo.height },
          currentMode.mode,
        );
      } catch { return null; }
    },
    startVideo: async () => {
      if (!hasMic) await requestMic();
      try { await videoOutput.startRecording({ flash: 'off' }); }
      catch (e) { console.warn('startRecording failed', e); }
    },
    stopVideo: async () => {
      try {
        const v = await videoOutput.stopRecording();
        return buildPhotoFile(
          { path: v.path, width: v.width ?? 0, height: v.height ?? 0, duration: v.duration },
          'video', true,
        );
      } catch { return null; }
    },
  }), [photoOutput, videoOutput, currentMode.mode, hasMic, requestMic]);

  const outputs = currentMode.mode === 'video' ? [videoOutput] : [photoOutput];

  return (
    <GestureDetector gesture={pinchGesture}>
      <ReanimatedCamera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format ?? undefined}
        isActive={isActive}
        outputs={outputs as CameraProps['outputs']}
        animatedProps={animatedProps}
        testID="vision-camera"
      />
    </GestureDetector>
  );
});
```

- [ ] **Step 2: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 3: Example 真机验证**

Run: `yarn example ios`（用临时 App）
Expected：手势捏合放大/缩小取景画面，达到边界时停止

- [ ] **Step 4: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/Camera.tsx
git commit -m "feat: add pinch-to-zoom with reanimated"
```

---

### Task 16：点击对焦（Tap-to-focus）+ FocusIndicator

**Files:**
- Create: `src/camera/FocusIndicator.tsx`
- Modify: `src/camera/Camera.tsx`
- Modify: `src/camera/index.tsx`

- [ ] **Step 1: 写 FocusIndicator**

`src/camera/FocusIndicator.tsx`:

```tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import type { Point } from '../utils';

type Props = { point: Point; onAnimationEnd: () => void };

const SIZE = 80;

export function FocusIndicator({ point, onAnimationEnd }: Props) {
  const scale = useRef(new Animated.Value(1.6)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(600),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]),
    ]).start(() => onAnimationEnd());
  }, [scale, opacity, onAnimationEnd]);

  return (
    <Animated.View
      style={[
        styles.box,
        { left: point.x - SIZE / 2, top: point.y - SIZE / 2, transform: [{ scale }], opacity },
      ]}
      pointerEvents="none"
      testID="focus-indicator"
    />
  );
}

const styles = StyleSheet.create({
  box: {
    position: 'absolute',
    width: SIZE, height: SIZE,
    borderWidth: 1.5, borderColor: 'yellow', borderRadius: 6,
  },
});
```

- [ ] **Step 2: 在 Camera 接入 Tap 手势**

在 `src/camera/Camera.tsx` 内：

```tsx
import { useCallback, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';
import type { Point } from '../utils';
import { FocusIndicator } from './FocusIndicator';
```

在组件里：

```tsx
const [focusPoint, setFocusPoint] = useState<Point | null>(null);

const handleFocus = useCallback(async (x: number, y: number) => {
  if (!device.supportsFocus) return;
  setFocusPoint({ x, y });
  try { await cameraRef.current?.focus({ x, y }); } catch {}
}, [device.supportsFocus]);

const tapGesture = Gesture.Tap()
  .onEnd(({ x, y }) => { runOnJS(handleFocus)(x, y); });

const composed = Gesture.Simultaneous(pinchGesture, tapGesture);
```

> 注：vision-camera 5.x 的对焦方法为 `camera.focus(point)`，根据 5.0.0 文档；如版本提供 `focusTo({x, y})` 自动坐标转换，优先使用 `focusTo`。运行时按实际可用 API 选用。

把 `GestureDetector gesture={pinchGesture}` 改为 `gesture={composed}`，并在 JSX 末尾插入：

```tsx
{focusPoint && <FocusIndicator point={focusPoint} onAnimationEnd={() => setFocusPoint(null)} />}
```

但因为 GestureDetector 只能有一个子元素，需要在外层包 View：

```tsx
return (
  <GestureDetector gesture={composed}>
    <Reanimated.View style={StyleSheet.absoluteFill}>
      <ReanimatedCamera
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        device={device}
        format={format ?? undefined}
        isActive={isActive}
        outputs={outputs as CameraProps['outputs']}
        animatedProps={animatedProps}
        testID="vision-camera"
      />
      {focusPoint && <FocusIndicator point={focusPoint} onAnimationEnd={() => setFocusPoint(null)} />}
    </Reanimated.View>
  </GestureDetector>
);
```

- [ ] **Step 3: 更新 camera 桶导出**

`src/camera/index.tsx` 添加：

```ts
export { FocusIndicator } from './FocusIndicator';
```

- [ ] **Step 4: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 5: Example 真机验证**

Run: `yarn example ios`
Expected：点击取景画面任意点 → 黄色对焦框出现 → 800ms 后消失 → 相机重新对焦

- [ ] **Step 6: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/FocusIndicator.tsx src/camera/Camera.tsx src/camera/index.tsx
git commit -m "feat: add tap-to-focus with animated indicator"
```

---

## Phase G：设置面板

### Task 17：闪光灯 / 宽高比 / 镜头切换（SetUp 面板）

**Files:**
- Create: `src/camera/setup/SetUp.tsx`
- Create: `src/camera/setup/index.tsx`
- Modify: `src/camera/Camera.tsx`（接收 flash/aspectRatio/lensZoomRequest props）
- Modify: `src/camera/Container.tsx`（接入 SetUp 面板）

- [ ] **Step 1: 写 SetUp**

`src/camera/setup/SetUp.tsx`:

```tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type FlashMode = 'off' | 'on' | 'auto';
export type AspectRatio = '4:3' | '16:9';

type Props = {
  flash: FlashMode;
  aspectRatio: AspectRatio;
  onChangeFlash: (m: FlashMode) => void;
  onChangeAspectRatio: (r: AspectRatio) => void;
  onToggleLens: () => void;
  lensLabel: string; // "1x" / "0.5x"
};

const flashLabel: Record<FlashMode, string> = { off: '闪关', on: '闪开', auto: '自动' };
const flashOrder: FlashMode[] = ['off', 'auto', 'on'];

export function SetUp({ flash, aspectRatio, onChangeFlash, onChangeAspectRatio, onToggleLens, lensLabel }: Props) {
  const nextFlash = () => {
    const i = flashOrder.indexOf(flash);
    onChangeFlash(flashOrder[(i + 1) % flashOrder.length]);
  };
  return (
    <View style={styles.root}>
      <TouchableOpacity onPress={nextFlash} testID="flash-btn">
        <Text style={styles.text}>{flashLabel[flash]}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChangeAspectRatio(aspectRatio === '4:3' ? '16:9' : '4:3')}
        testID="aspect-btn"
      >
        <Text style={styles.text}>{aspectRatio}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onToggleLens} testID="lens-btn">
        <Text style={styles.text}>{lensLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', top: 60, left: 16, right: 16,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  text: { color: 'white', fontSize: 14, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14 },
});
```

`src/camera/setup/index.tsx`:

```ts
export { SetUp, type FlashMode, type AspectRatio } from './SetUp';
```

- [ ] **Step 2: 扩展 Camera 接收 flash / aspectRatio / zoom 控制**

修改 `src/camera/Camera.tsx`：

```tsx
type Props = {
  device: CameraDevice;
  currentMode: CameraMode;
  isActive?: boolean;
  flash?: FlashMode;
  aspectRatio?: AspectRatio;
  zoomShared?: Reanimated.SharedValue<number>;
};
```

`useCameraFormat` 改为：

```tsx
const aspect = (aspectRatio ?? '4:3') === '4:3' ? 4 / 3 : 16 / 9;
const format = useCameraFormat(device, [
  { photoAspectRatio: aspect },
  { photoHdr: false },
]);
```

`capture` 内 `flash`：

```tsx
const photo = await photoOutput.capturePhoto({
  flash: flash ?? 'off',
  enableShutterSound: true,
});
```

`startVideo` 内 `flash` 同理（torch 用作视频补光，simplify 为传 flash 给 startRecording）：

```tsx
await videoOutput.startRecording({ flash: flash ?? 'off' });
```

`zoom` SharedValue 改为：

```tsx
const internalZoom = useSharedValue(device.neutralZoom);
const zoom = zoomShared ?? internalZoom;
```

（让外部可控）

- [ ] **Step 3: 在 Container 接入 SetUp + zoom shared**

`src/camera/Container.tsx` 顶部：

```tsx
import { useSharedValue } from 'react-native-reanimated';
import { SetUp, type AspectRatio, type FlashMode } from './setup';
```

Container 内：

```tsx
const [flash, setFlash] = useState<FlashMode>('off');
const [aspectRatio, setAspectRatio] = useState<AspectRatio>('4:3');
const zoomShared = useSharedValue(device.neutralZoom);

const onToggleLens = () => {
  zoomShared.value = zoomShared.value === device.neutralZoom ? device.minZoom : device.neutralZoom;
};
const lensLabel = `${(zoomShared.value === device.minZoom ? device.minZoom : device.neutralZoom).toFixed(1)}x`;
```

> 注：`zoomShared.value` 直接读会触发警告（应该在 worklet 内），可以用 `useDerivedValue` + state 镜像。为简化，这里用 state 维护一个 label：

```tsx
const [lensLabel, setLensLabel] = useState(`${device.neutralZoom.toFixed(1)}x`);
const onToggleLens = () => {
  if (lensLabel.startsWith(device.minZoom.toFixed(1))) {
    zoomShared.value = device.neutralZoom;
    setLensLabel(`${device.neutralZoom.toFixed(1)}x`);
  } else {
    zoomShared.value = device.minZoom;
    setLensLabel(`${device.minZoom.toFixed(1)}x`);
  }
};
```

在 JSX 中渲染 SetUp（只在取景态，不在预览态）：

```tsx
{!previewing && (
  <SetUp
    flash={flash}
    aspectRatio={aspectRatio}
    onChangeFlash={setFlash}
    onChangeAspectRatio={setAspectRatio}
    onToggleLens={onToggleLens}
    lensLabel={lensLabel}
  />
)}
```

Camera 渲染加上 props：

```tsx
<Camera
  ref={cameraRef}
  device={device}
  currentMode={currentMode}
  flash={flash}
  aspectRatio={aspectRatio}
  zoomShared={zoomShared}
/>
```

- [ ] **Step 4: 跑 typecheck**

Run: `yarn typecheck`
Expected: 0 errors

- [ ] **Step 5: Example 真机验证**

Run: `yarn example ios`
Expected：顶部 3 个按钮可切；点闪光循环 关→自动→开；点 4:3 / 16:9 切换；点镜头切换 0.5x↔1x（设备支持时实际生效）

- [ ] **Step 6: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/setup src/camera/Camera.tsx src/camera/Container.tsx
git commit -m "feat: add setup panel with flash/aspect-ratio/lens-toggle"
```

---

## Phase H：边界与发布

### Task 18：dataRetainedMode 处理 + 取消路径统一

**Files:**
- Modify: `src/camera/Container.tsx`

- [ ] **Step 1: 强化 dataRetainedMode 在模式切换时的行为**

Container 内 `onSelectMode`：

```tsx
onSelectMode={(i) => {
  if (config.dataRetainedMode === 'clear' && i !== modeIndex) {
    setPhotos([]);
  }
  setModeIndex(i);
}}
```

- [ ] **Step 2: 增加 Container 卸载时 settle 兜底**

useEffect 卸载兜底（在 Container 顶部）：

```tsx
import { useEffect as useEffect2 } from 'react';

const settledRef = useRef(false);
const settle = useCallback((r: CameraResult) => {
  if (settledRef.current) return;
  settledRef.current = true;
  onSettle(r);
}, [onSettle]);

useEffect2(() => () => {
  if (!settledRef.current) {
    onSettle({ code: 0, data: [], message: 'cancelled' });
    settledRef.current = true;
  }
}, [onSettle]);
```

把所有 `onSettle(...)` 替换为内部 `settle(...)`。

> 注：实际重命名时，要确保只把 Container 内部使用的 `onSettle` 调用换成 `settle`，prop 名仍是 `onSettle`。

- [ ] **Step 3: 跑 typecheck + jest**

Run: `yarn typecheck && yarn test`
Expected: 全部 PASS

- [ ] **Step 4: Example 真机验证 dataRetainedMode**

临时 App `cameraMode:[{mode:'single'},{mode:'continuous'}],dataRetainedMode:'retain'`：
Expected：在 single 拍 1 张 → 切到 continuous → 之前的照片还在 photos 中；改为 `'clear'` → 切换时清空

- [ ] **Step 5: Commit**

```bash
git restore example/src/App.tsx
git add src/camera/Container.tsx
git commit -m "feat: honor dataRetainedMode and guarantee settle on unmount"
```

---

### Task 19：example app 重写 + iOS/Android 权限配置

**Files:**
- Modify: `example/src/App.tsx`
- Modify: `example/ios/ReactNativeCameraExample/Info.plist`
- Modify: `example/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: 重写 example/src/App.tsx**

```tsx
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import { useCamera, type CameraResult } from '@unif/react-native-camera';

export default function App() {
  const [api, holder] = useCamera();
  const [lastResult, setLastResult] = useState<CameraResult | null>(null);

  const open = async (cameraMode: Parameters<typeof api.open>[0]['cameraMode']) => {
    const r = await api.open({ cameraMode, dataRetainedMode: 'clear' });
    setLastResult(r);
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.results} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.h}>上一次结果：</Text>
        <Text style={styles.code}>{lastResult ? JSON.stringify(lastResult, null, 2) : '无'}</Text>
      </ScrollView>
      <View style={styles.btnRow}>
        <TouchableOpacity style={styles.btn} onPress={() => open([{ mode: 'single', photoQuality: 'speed', jpegQuality: 0.9 }])}>
          <Text style={styles.btnText}>单拍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => open([{ mode: 'continuous', photoQuality: 'speed', jpegQuality: 0.9 }])}>
          <Text style={styles.btnText}>连拍</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={() => open([{ mode: 'video' }])}>
          <Text style={styles.btnText}>视频</Text>
        </TouchableOpacity>
      </View>
      {holder}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#222' },
  results: { flex: 1 },
  h: { color: 'white', fontSize: 14, marginBottom: 8 },
  code: { color: '#9c9', fontFamily: 'Menlo', fontSize: 11 },
  btnRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16, backgroundColor: '#111' },
  btn: { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: '#3a3', borderRadius: 6 },
  btnText: { color: 'white', fontWeight: '600' },
});
```

- [ ] **Step 2: 修改 iOS Info.plist 添加权限**

`example/ios/ReactNativeCameraExample/Info.plist` 在 `<dict>` 内添加（找现有 NSAppTransportSecurity 附近合理位置插入）：

```xml
<key>NSCameraUsageDescription</key>
<string>App 需要访问相机以拍摄照片或视频</string>
<key>NSMicrophoneUsageDescription</key>
<string>App 需要访问麦克风以录制视频</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>App 需要权限以保存照片到相册</string>
```

- [ ] **Step 3: 修改 AndroidManifest.xml 添加权限**

`example/android/app/src/main/AndroidManifest.xml` 在 `<manifest>` 标签内、`<application>` 外添加：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-feature android:name="android.hardware.camera" android:required="true" />
```

- [ ] **Step 4: 真机验证 3 个模式**

Run: `yarn example ios`
按 spec 第 8.2 节"验证流程"表逐项验证：
- 单拍：弹权限 → 拍 → 预览 → 完成 → JSON 显示 code=200, data=[...]
- 连拍：拍 3 张 → "完成 (3)" → 多图预览 → 完成
- 视频：拍 5s → 预览显示 "视频 · 5.0s" → 完成 → data=[{mime:'video/mp4',duration:5.0,...}]
- 捏合 / 镜头切换 / 闪光切换 / 宽高比切换 / 点击对焦：均按 spec 8.2 节预期

- [ ] **Step 5: 真机验证 Android**

Run: `yarn example android`
同上

- [ ] **Step 6: Commit**

```bash
git add example/src/App.tsx example/ios/ReactNativeCameraExample/Info.plist example/android/app/src/main/AndroidManifest.xml
git commit -m "feat: rewrite example app with 3-mode camera demo and platform permissions"
```

---

### Task 20：错误处理统一 + jest 整理

**Files:**
- Modify: `src/camera/Container.tsx`
- Modify: `src/camera/Camera.tsx`
- Create: `src/__tests__/contract.test.tsx`

- [ ] **Step 1: 在 Camera 内的所有 vision-camera 调用包 try/catch（如有遗漏）**

确认 Camera.tsx 中 `capture`/`startVideo`/`stopVideo`/`handleFocus` 全部有 try/catch（前面 task 已加，本步骤复查并补齐）。

补齐 `handleFocus` 内日志：

```tsx
} catch (e) { console.warn('focus failed', e); }
```

- [ ] **Step 2: 在 Container 中确保所有非 200 路径都走 settle**

复查 Container 内所有 `settle({...})` 调用是否覆盖以下分支：
- 权限拒绝 → 403
- 设备不可用 → 404
- 拍照失败 → 500
- 视频失败 → 503
- 用户取消 → 0
- 完成 → 200

补齐缺失分支（如果有）。

- [ ] **Step 3: 写契约测试**

`src/__tests__/contract.test.tsx`:

```ts
import type { CameraResult, CameraResultCode } from '../utils';

it('CameraResult.code is a known set', () => {
  const codes: CameraResultCode[] = [0, 200, 403, 404, 500, 503];
  codes.forEach((c) => {
    const r: CameraResult = { code: c, data: [], message: '' };
    expect(typeof r.code).toBe('number');
  });
});

// 反向验证：未声明的 code 应当不被允许
// @ts-expect-error 999 is not a valid CameraResultCode
const bad: CameraResult = { code: 999, data: [], message: '' };
void bad;
```

- [ ] **Step 4: 跑 typecheck + jest**

Run: `yarn typecheck && yarn test`
Expected: 全部 PASS（包含 contract 测试）

- [ ] **Step 5: Commit**

```bash
git add src/camera src/__tests__/contract.test.tsx
git commit -m "feat: unify error code paths and add contract tests"
```

---

### Task 21：README + 顶层文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 重写 README.md**

````markdown
# @unif/react-native-camera

基于 [react-native-vision-camera](https://github.com/mrousavy/react-native-vision-camera) 5.x 构建的 React Native 相机库，提供模态化相机界面，支持单拍 / 连拍 / 视频录制 / 捏合变焦 / 镜头切换 / 点击对焦。

## 安装

```sh
yarn add @unif/react-native-camera \
         react-native-vision-camera \
         react-native-nitro-modules \
         react-native-reanimated \
         react-native-reanimated-carousel \
         react-native-gesture-handler \
         react-native-safe-area-context
```

iOS 还需 `pod install`。

### 权限配置

iOS `Info.plist`：

```xml
<key>NSCameraUsageDescription</key><string>...</string>
<key>NSMicrophoneUsageDescription</key><string>...</string>
<key>NSPhotoLibraryAddUsageDescription</key><string>...</string>
```

Android `AndroidManifest.xml`：

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

## 用法

```tsx
import { useCamera } from '@unif/react-native-camera';

const App = () => {
  const [api, holder] = useCamera();
  return (
    <View>
      <Text onPress={async () => {
        const res = await api.open({
          cameraMode: [
            { mode: 'single', photoQuality: 'speed', jpegQuality: 0.9 },
            { mode: 'continuous' },
          ],
          dataRetainedMode: 'clear',
        });
        // res.code: 200=ok, 0=cancelled, 403=no_permission, 404=no_device, 500=capture_failed, 503=video_failed
      }}>打开相机</Text>
      {holder}
    </View>
  );
};
```

## API

### `useCamera()` → `[api, holder]`

返回 `[CameraApi, React.ReactElement]`，把 `holder` 渲染进 React 树，调用 `api.open(config)` 打开相机。

### `CameraApi`

- `open(config: OpenConfig): Promise<CameraResult>`
- `close(): void`

### `OpenConfig`

| 字段 | 类型 | 说明 |
|---|---|---|
| `cameraMode` | `CameraMode[]` | 至少一项；多项时底部出现模式 tab |
| `dataRetainedMode` | `'clear' \| 'retain'` | 模式切换时是否保留已拍照片 |

### `CameraMode`

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `mode` | `'single' \| 'continuous' \| 'video'` | — | 模式 |
| `photoQuality` | `'speed' \| 'balanced' \| 'quality'` | `'speed'` | 相机管线模式，影响拍摄延迟 |
| `jpegQuality` | `number (0~1)` | `0.9` | JPEG 压缩率 |

### `CameraResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `code` | `0 \| 200 \| 403 \| 404 \| 500 \| 503` | 状态码 |
| `data` | `CustomPhotoFile[]` | 拍摄的文件列表 |
| `message` | `string` | 描述信息 |

## 从 v1.x 升级

`v2.0.0` 的破坏性变更：

- 移除 `cameraMode[i].photoResolution` / `videoResolution` → 改用 `photoQuality` 控制速度 / `jpegQuality` 控制文件大小
- 移除 `watermark` 配置项（将在 v2.1.x 重新加入）
- 从顶层 `@unif/react-native-camera` 直接导入类型（不再走 `/lib/typescript/src/utils` deep path）

## 许可

MIT
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for v2.0.0 API"
```

---

### Task 22：build 验证 + 最终自检 + 发布前清单

**Files:**（无新建/修改）

- [ ] **Step 1: 构建库**

Run: `yarn prepare`
Expected: 输出 `lib/module/` + `lib/typescript/`，无 error

- [ ] **Step 2: 验证导出**

Run:

```bash
node -e "const m = require('./lib/module/index.js'); console.log(Object.keys(m));"
```

Expected: 含 `useCamera`、`VERSION` 等

- [ ] **Step 3: 类型导出验证**

Run:

```bash
node -e "console.log(require('./lib/typescript/src/index.d.ts'))"  # 应该报错（非 JS）
# 改为：
ls lib/typescript/src/index.d.ts && cat lib/typescript/src/utils/interface.d.ts | head -30
```

Expected: 文件存在，含 `CameraMode`、`CameraResult`、`OpenConfig` 等类型导出

- [ ] **Step 4: 跑全部 jest + lint + typecheck**

Run: `yarn lint && yarn typecheck && yarn test`
Expected: 0 error / 0 warning（warning 可接受不致命的依赖告警）

- [ ] **Step 5: 检查 package.json files 字段是否包含必要文件**

```bash
npm pack --dry-run 2>&1 | head -40
```

Expected: 列表含 `src/`、`lib/`、`README.md`、`LICENSE`、`package.json`，不含 `__tests__`/`example`

- [ ] **Step 6: 检查 git status 干净**

Run: `git status`
Expected: `nothing to commit, working tree clean`

- [ ] **Step 7: 推送（如需要）**

> 不在 plan 内自动执行；用户决定何时 push 与发布。

- [ ] **Step 8: 标记完成**

无需 commit（无文件改动），如果某个步骤暴露问题则回到对应 Task 修复。

---

## Self-Review 检查表（agent 实施前 / 中 / 后）

完成全部 22 个 task 后，agent 应回到此 checklist 做闭环：

- [ ] spec 第 4.2 节所有 public types 都从 `@unif/react-native-camera` 顶层导出
- [ ] spec 第 4.3 节"v1.x → v2.0.0 差异表"每一项都已实现
- [ ] spec 第 5 节数据流 11 步都能在 example app 中走通
- [ ] spec 第 7 节 6 个错误码全部在 Container 中有显式 settle 调用
- [ ] spec 第 8.2 节真机验证 7 个场景全部跑过
- [ ] spec 第 4.4 节消费方 PR diff 准备好，能拷贝粘贴到 retail-pecportal 即生效
- [ ] README 示例代码可拷贝可运行
- [ ] `yarn prepare` 构建产物完整
- [ ] 无 TS error / lint error / jest fail
- [ ] 未提交 `.yarn/cache`、`node_modules`、`example/ios/Pods` 等大目录

---

## 已知风险与回退方案

| 风险 | 表现 | 回退 |
|---|---|---|
| vision-camera 5.x `useVideoOutput` API 名/签名与 5.0.0 文档不一致 | typecheck 报错 | 查 `node_modules/react-native-vision-camera/lib/typescript`，按真实类型调整 |
| `Reanimated.addWhitelistedNativeProps` 在 reanimated 4 改名 | 运行时 zoom 不生效 | 查 reanimated 4 文档（可能改为 `addWhitelistedUIProps` 或 plugin 配置） |
| iOS Pod 安装失败（Nitro 集成报错） | `pod install` failed | 检查 RN 0.85 + Nitro 兼容性；必要时切换到 react-native-vision-camera@4.7.x 降级（保留分支） |
| Android 老机型 CameraX 启动慢 | example app 启动黑屏 1-2 秒 | 接受（vision-camera 5.x 已是 CameraX 加速版） |
| Yarn 4 + corepack 在 CI 上行为不一致 | `yarn install` 报错 | README 注明 `corepack enable` |
