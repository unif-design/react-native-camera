# Camera 2.5.0 — API 对齐原版 + 两个 Bug 修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `@unif/react-native-camera` 的公开 API 对齐原版 v1.2.5(入参回退 `quality`、保留原版字段、返回结果取原版+2.x 并集),并修两个 bug——Bug 1(portal 多模式只显示拍照)、Bug 2(取景裁剪 ≠ 拍照,杯子问题)。

**Architecture:** 两仓库两 PR。库先行(camera repo,2.5.0):改 `interface.ts` 类型 → `util.ts` 的 `buildPhotoFile` → `Camera.tsx`(quality 接线 + cameraType + 取景 letterbox)→ `Container.tsx`(初始 type)→ example/version/README。portal 跟进:`compat/camera.ts` 透传 cameraMode 数组。

**Tech Stack:** TypeScript / React Native 0.85 / vision-camera 5.x / jest 29 / @unif/react-native-design。

**Spec:** `docs/superpowers/specs/2026-05-30-camera-api-align-and-bugfix-design.md`

---

## 文件结构

### Phase A — 库(camera repo,产出 2.5.0)

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/utils/interface.ts` | 公开类型:CameraMode(原版字段)、CustomPhotoFile(并集) | 改 |
| `src/utils/util.ts` | `buildPhotoFile` 增加 id/cameraType/cameraMode | 改 |
| `src/camera/Camera.tsx` | quality 接线 + cameraType 透传 + 取景 letterbox(Bug 2) | 改 |
| `src/camera/Container.tsx` | 初始 device position 从 `cameraMode[0].type` | 改 |
| `src/__tests__/types.test.tsx` | 契约测试对齐新类型 | 改 |
| `src/__tests__/util.test.ts` | buildPhotoFile 新字段测试 | 改 |
| `src/__tests__/footer.test.tsx` | Footer 多模式渲染(锁 Bug 1 库侧正确) | 新建 |
| `example/src/App.tsx` | open 调用用 `quality`(去 photoQuality/jpegQuality) | 改 |
| `package.json` | version 2.4.0 → 2.5.0 | 改 |
| `README.md` | API 文档(quality / 返回并集) | 改 |

### Phase B — portal(portal repo)

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/utils/compat/camera.ts` | `RetailCameraParams` 多模式 + `toCameraConfig` 透传 | 改 |
| `src/utils/compat/camera.test.ts` | toCameraConfig 单/多模式/去重测试 | 新建(若 portal 有 jest) |

---

## Phase A — 库

### Task A1: 公开类型对齐原版(interface.ts)

**Files:**
- Modify: `src/utils/interface.ts`
- Modify: `src/__tests__/types.test.tsx`

- [ ] **Step 1: 更新类型测试到新形状(先失败)**

替换 `src/__tests__/types.test.tsx` 全文:

```tsx
import type {
  CameraMode,
  CameraResult,
  OpenConfig,
  CustomPhotoFile,
} from '../utils';

it('CameraMode accepts original fields (type/flashMode/quality/recTime)', () => {
  const m: CameraMode = {
    type: 'back',
    flashMode: 'auto',
    mode: 'single',
    quality: 0.9,
    recTime: 15,
  };
  expect(m.mode).toBe('single');
  expect(m.quality).toBe(0.9);
});

it('CameraMode only requires mode', () => {
  const m: CameraMode = { mode: 'continuous' };
  expect(m.mode).toBe('continuous');
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

it('CustomPhotoFile carries original + 2.x fields (union)', () => {
  const f: CustomPhotoFile = {
    id: '1700000000000-0',
    cameraType: 'back',
    cameraMode: 'single',
    path: '/tmp/x.jpg',
    uri: 'file:///tmp/x.jpg',
    width: 100,
    height: 100,
    mime: 'image/jpeg',
    mode: 'single',
  };
  expect(f.mime).toBe('image/jpeg');
  expect(f.cameraMode).toBe(f.mode);
});
```

- [ ] **Step 2: 跑 typecheck 确认失败**

Run: `yarn typecheck`
Expected: FAIL —— 旧 `CameraMode` 没有 `type/flashMode/quality/recTime`,旧 `CustomPhotoFile` 没有 `id/cameraType/cameraMode`。

- [ ] **Step 3: 重写 interface.ts**

替换 `src/utils/interface.ts` 全文:

```ts
export type CameraType = 'back' | 'front';

export type FlashMode = 'auto' | 'on' | 'off';

export type DataRetainedMode = 'clear' | 'retain';

export type CameraModeName = 'single' | 'continuous' | 'video';

export type Point = { x: number; y: number };

export type CameraMode = {
  /** 初始前/后摄,缺省 back。H5 传入,接线为初始 device position。 */
  type?: CameraType;
  /** 初始闪光(原版字段,保留作 API 兼容)。闪光由相机内 UI 控制,不从 config 接线。 */
  flashMode?: FlashMode;
  /** 拍摄模式。 */
  mode: CameraModeName;
  /** JPEG 压缩 0~1,缺省 0.9。内部速度优先级写死 'speed'(对齐原版 4.x photoQualityBalance)。 */
  quality?: number;
  /** 录制时长上限(秒),video 模式。原版字段,保留;未用到则 no-op。 */
  recTime?: number;
};

export type OpenConfig = {
  cameraMode: CameraMode[];
  dataRetainedMode: DataRetainedMode;
};

export type CustomPhotoFile = {
  // —— 原版字段 ——
  /** 唯一 id,时间戳 + 序号(避免同毫秒撞 id)。 */
  id: string;
  /** 拍摄时的前/后摄。 */
  cameraType: CameraType;
  /** 模式(原版字段名,与 mode 同值)。 */
  cameraMode: CameraModeName;
  // —— 2.x 字段 ——
  path: string;
  uri: string;
  width: number;
  height: number;
  mime: 'image/jpeg' | 'video/mp4';
  /** 模式(2.x 字段名,与 cameraMode 同值)。 */
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

> 注:删除了 `PhotoQuality` 类型导出。

- [ ] **Step 4: 跑 typecheck**

Run: `yarn typecheck`
Expected: 仍 FAIL,但报错应只来自 `src/utils/util.ts`(buildPhotoFile 返回缺 id/cameraType/cameraMode)与 `src/camera/Camera.tsx`(用了 photoQuality/jpegQuality/PhotoQuality)。**确认 interface.ts 与 types.test.tsx 自身不再报错**;util.ts / Camera.tsx 的报错在 A2/A3 修。

- [ ] **Step 5: 不提交**(等 A2/A3 整体绿,见 A3 末尾统一提交)

---

### Task A2: buildPhotoFile 增加 id/cameraType/cameraMode(util.ts)

**Files:**
- Modify: `src/utils/util.ts`
- Modify: `src/__tests__/util.test.ts`

- [ ] **Step 1: 更新 util 测试(先失败)**

替换 `src/__tests__/util.test.ts` 里 `describe('buildPhotoFile', ...)` 整块为:

```ts
describe('buildPhotoFile', () => {
  it('builds image file by default with id/cameraType/cameraMode', () => {
    const f = buildPhotoFile(
      { path: '/tmp/a.jpg', width: 100, height: 200 },
      'single',
      'back'
    );
    expect(f.mime).toBe('image/jpeg');
    expect(f.uri).toBe('file:///tmp/a.jpg');
    expect(f.duration).toBeUndefined();
    expect(f.cameraType).toBe('back');
    expect(f.cameraMode).toBe('single');
    expect(f.mode).toBe('single');
    expect(typeof f.id).toBe('string');
  });
  it('builds video file when isVideo=true', () => {
    const f = buildPhotoFile(
      { path: '/tmp/a.mp4', width: 1920, height: 1080, duration: 5.2 },
      'video',
      'front',
      true
    );
    expect(f.mime).toBe('video/mp4');
    expect(f.duration).toBe(5.2);
    expect(f.cameraType).toBe('front');
  });
  it('generates unique ids across calls', () => {
    const a = buildPhotoFile(
      { path: '/a.jpg', width: 1, height: 1 },
      'single',
      'back'
    );
    const b = buildPhotoFile(
      { path: '/b.jpg', width: 1, height: 1 },
      'single',
      'back'
    );
    expect(a.id).not.toBe(b.id);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/__tests__/util.test.ts`
Expected: FAIL —— `buildPhotoFile` 还不接受第 3 个 `cameraType` 参数,返回也没有 `id/cameraType/cameraMode`。

- [ ] **Step 3: 重写 buildPhotoFile**

替换 `src/utils/util.ts` 全文:

```ts
import type { CustomPhotoFile, CameraModeName, CameraType } from './interface';

export function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

// 单调递增计数器,保证同毫秒多张照片 id 不撞(原版用纯时间戳有撞 id 风险)。
let photoIdCounter = 0;

export function buildPhotoFile(
  raw: { path: string; width: number; height: number; duration?: number },
  mode: CameraModeName,
  cameraType: CameraType,
  isVideo: boolean = false
): CustomPhotoFile {
  return {
    id: `${Date.now()}-${photoIdCounter++}`,
    cameraType,
    cameraMode: mode,
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

- [ ] **Step 4: 跑 util 测试**

Run: `yarn test src/__tests__/util.test.ts`
Expected: PASS。

- [ ] **Step 5: 不提交**(等 A3 把 Camera.tsx 调用补上 cameraType 后整体绿)

---

### Task A3: Camera.tsx quality 接线 + cameraType 透传

**Files:**
- Modify: `src/camera/Camera.tsx`

- [ ] **Step 1: 改类型 import(删 PhotoQuality)**

`src/camera/Camera.tsx` 把:
```ts
import type {
  CameraMode,
  CustomPhotoFile,
  PhotoQuality,
  Point,
} from '../utils';
```
改为:
```ts
import type { CameraMode, CustomPhotoFile, Point } from '../utils';
```

- [ ] **Step 2: 改 usePhotoOutput(quality 接线)**

把:
```ts
  const photoOutput = usePhotoOutput({
    qualityPrioritization: (currentMode.photoQuality ??
      'speed') as PhotoQuality,
    quality: currentMode.jpegQuality ?? 0.9,
    targetResolution,
  });
```
改为:
```ts
  const photoOutput = usePhotoOutput({
    // 速度优先级对齐原版 4.x photoQualityBalance='speed'(写死);quality 用回原版字段
    qualityPrioritization: 'speed',
    quality: currentMode.quality ?? 0.9,
    targetResolution,
  });
```

- [ ] **Step 3: 计算 cameraType + 透传给 buildPhotoFile**

在组件体内 `const cameraRef = useRef<CameraRef>(null);` 之后加一行:
```ts
  const cameraType = device.position === 'front' ? 'front' : 'back';
```

把 capture 里:
```ts
          return buildPhotoFile(
            { path: raw.path, width: raw.width, height: raw.height },
            currentMode.mode
          );
```
改为:
```ts
          return buildPhotoFile(
            { path: raw.path, width: raw.width, height: raw.height },
            currentMode.mode,
            cameraType
          );
```

把 video 里:
```ts
              const file = buildPhotoFile(
                { path: filePath, width: 0, height: 0 },
                'video',
                true
              );
```
改为:
```ts
              const file = buildPhotoFile(
                { path: filePath, width: 0, height: 0 },
                'video',
                cameraType,
                true
              );
```

- [ ] **Step 4: useImperativeHandle 依赖加 cameraType**

把依赖数组:
```ts
    [photoOutput, videoOutput, currentMode.mode, hasMic, requestMic, flash]
```
改为:
```ts
    [photoOutput, videoOutput, currentMode.mode, hasMic, requestMic, flash, cameraType]
```

- [ ] **Step 5: typecheck + 全量测试**

Run: `yarn typecheck && yarn test`
Expected: PASS —— interface/util/Camera 三处对齐,全部测试绿。

- [ ] **Step 6: Commit**

```bash
git add src/utils/interface.ts src/utils/util.ts src/camera/Camera.tsx \
        src/__tests__/types.test.tsx src/__tests__/util.test.ts
git commit -m "feat: align CameraMode/CustomPhotoFile with original API and revert quality"
```

---

### Task A4: Container.tsx 初始 device position 从 type

**Files:**
- Modify: `src/camera/Container.tsx`

- [ ] **Step 1: 初始 position 用 cameraMode[0].type**

`src/camera/Container.tsx` 把:
```ts
  // 5.x：physicalDevices 字符串不带 -camera；单 'wide-angle' 规避 iOS #3773
  const device = useCameraDevice('back', {
    physicalDevices: ['wide-angle'],
  });
```
改为:
```ts
  // 初始前/后摄由 config 首个 mode 的 type 决定(H5 传入),缺省 back。
  // 运行时前后摄翻转是独立功能,不在本次范围。
  // 5.x：physicalDevices 字符串不带 -camera；单 'wide-angle' 规避 iOS #3773
  const initialPosition = config.cameraMode[0]?.type ?? 'back';
  const device = useCameraDevice(initialPosition, {
    physicalDevices: ['wide-angle'],
  });
```

> `recTime` / `flashMode` 不接线:recTime 未用到(no-op,字段已在类型里);flashMode 由 SetUp 内 UI 控制(`flash` state,初始 `'off'`,不从 config 取)。

- [ ] **Step 2: typecheck + 测试**

Run: `yarn typecheck && yarn test`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/camera/Container.tsx
git commit -m "feat: wire initial camera position from cameraMode[0].type"
```

---

### Task A5: Bug 2 — 取景框按 4:3/16:9 留边(Camera.tsx)

**Files:**
- Modify: `src/camera/Camera.tsx`

- [ ] **Step 1: 引入 useWindowDimensions**

`Camera.tsx` 顶部:
```ts
import { StyleSheet, View } from 'react-native';
```
改为:
```ts
import { StyleSheet, useWindowDimensions, View } from 'react-native';
```

- [ ] **Step 2: 计算取景框尺寸**

在组件体内(`const cameraType = ...` 那一行附近)加:
```ts
  const { width: screenW } = useWindowDimensions();
  // 取景框比例 = 输出照片比例(targetResolution):4:3→竖屏 高/宽=4/3, 16:9→16/9。
  // 框比例 = 画面比例后,cover 不再裁两侧 → 预览 = 拍照(WYSIWYG)。
  const frameRatio = (aspectRatio ?? '4:3') === '4:3' ? 4 / 3 : 16 / 9;
  const frameW = screenW;
  const frameH = screenW * frameRatio;
```

- [ ] **Step 3: 改 return 布局(全屏 → 居中取景框)**

把 return 整块:
```tsx
  return (
    <GestureDetector gesture={composed}>
      <View style={StyleSheet.absoluteFill}>
        <VisionCamera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isActive}
          outputs={outputs as CameraProps['outputs']}
          constraints={[{ photoHDR: false }]}
          zoom={zoom}
          torchMode={
            currentMode.mode === 'video' && flash === 'on' ? 'on' : 'off'
          }
          onSubjectAreaChanged={() => cameraRef.current?.resetFocus()}
          nativeID="vision-camera"
        />
        {focusPoint && (
          <FocusIndicator
            key={`${focusPoint.x}-${focusPoint.y}`}
            point={focusPoint}
            onAnimationEnd={() => setFocusPoint(null)}
          />
        )}
      </View>
    </GestureDetector>
  );
```
改为:
```tsx
  return (
    <View style={styles.root}>
      <GestureDetector gesture={composed}>
        <View style={[styles.frame, { width: frameW, height: frameH }]}>
          <VisionCamera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            device={device}
            isActive={isActive}
            outputs={outputs as CameraProps['outputs']}
            constraints={[{ photoHDR: false }]}
            zoom={zoom}
            torchMode={
              currentMode.mode === 'video' && flash === 'on' ? 'on' : 'off'
            }
            onSubjectAreaChanged={() => cameraRef.current?.resetFocus()}
            nativeID="vision-camera"
          />
          {focusPoint && (
            <FocusIndicator
              key={`${focusPoint.x}-${focusPoint.y}`}
              point={focusPoint}
              onAnimationEnd={() => setFocusPoint(null)}
            />
          )}
        </View>
      </GestureDetector>
    </View>
  );
```

- [ ] **Step 4: 文件末尾加 styles**

`Camera.tsx` 末尾(`export const Camera = forwardRef(...)` 闭合之后)加:
```ts
const styles = StyleSheet.create({
  // 全屏黑底,把取景框居中 → 框外区域是黑边(letterbox)。
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // overflow:hidden 裁掉 cover 溢出部分,框内只显示输出比例的画面。
  frame: { overflow: 'hidden' },
});
```

- [ ] **Step 5: typecheck + 测试**

Run: `yarn typecheck && yarn test`
Expected: PASS(`resizeMode="cover"` 是 vision-camera 合法 prop;jest mock 的 Camera 是 passthrough,布局变化不影响 17 测试)。

- [ ] **Step 6: Commit**

```bash
git add src/camera/Camera.tsx
git commit -m "fix: letterbox viewfinder to output aspect for WYSIWYG capture"
```

---

### Task A6: Footer 多模式渲染测试(锁 Bug 1 库侧正确)

**Files:**
- Create: `src/__tests__/footer.test.tsx`

- [ ] **Step 1: 写 Footer 多模式测试**

新建 `src/__tests__/footer.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Footer } from '../camera/footer';
import type { CameraMode } from '../utils';

const noop = () => {};

it('renders without crashing for multi-mode and shows the segmented control', () => {
  const modes: CameraMode[] = [{ mode: 'single' }, { mode: 'continuous' }];
  const { getByTestId } = render(
    <Footer
      modes={modes}
      currentIndex={0}
      recording={false}
      onShutter={noop}
      onSelectMode={noop}
      onCancel={noop}
    />
  );
  // Footer 在 modeItems.length > 0 时渲染 Segmented 容器(testID=mode-segmented)。
  expect(getByTestId('mode-segmented')).toBeTruthy();
  expect(getByTestId('shutter-btn')).toBeTruthy();
});

it('still renders the segmented control for single mode', () => {
  const modes: CameraMode[] = [{ mode: 'single' }];
  const { getByTestId } = render(
    <Footer
      modes={modes}
      currentIndex={0}
      recording={false}
      onShutter={noop}
      onSelectMode={noop}
      onCancel={noop}
    />
  );
  expect(getByTestId('mode-segmented')).toBeTruthy();
});
```

> 注:`jest.setup.ts` 把 `@unif/react-native-design` 整体 mock 成 passthrough,`Segmented` 不一定透传每个 item 的 `testID`,故断言用 Footer 自己挂的容器 testID `mode-segmented`(`Footer.tsx:52`)+ `shutter-btn`(`Footer.tsx:67`),验证多模式不崩 + 切换器渲染。库侧"传几个 mode 渲染几个 tab"的逻辑由 `Footer.tsx:39-54` 的 `modes.map` 保证(无 length>1 门控)。

- [ ] **Step 2: 跑测试**

Run: `yarn test src/__tests__/footer.test.tsx`
Expected: PASS。

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/footer.test.tsx
git commit -m "test: lock Footer multi-mode rendering"
```

---

### Task A7: example app + version + README

**Files:**
- Modify: `example/src/App.tsx`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: example 去掉 photoQuality/jpegQuality,用 quality**

`example/src/App.tsx` 把单拍按钮:
```tsx
          onPress={() =>
            open([{ mode: 'single', photoQuality: 'speed', jpegQuality: 0.9 }])
          }
```
改为:
```tsx
          onPress={() => open([{ mode: 'single', quality: 0.9 }])}
```

把连拍按钮:
```tsx
          onPress={() =>
            open([
              { mode: 'continuous', photoQuality: 'speed', jpegQuality: 0.9 },
            ])
          }
```
改为:
```tsx
          onPress={() => open([{ mode: 'continuous', quality: 0.9 }])}
```

(视频按钮 `open([{ mode: 'video' }])` 不变。)

- [ ] **Step 2: package.json 版本**

`package.json` 把 `"version": "2.4.0"` 改为 `"version": "2.5.0"`。

- [ ] **Step 3: README API 段更新**

`README.md` 的 `## API` → `CameraMode` 表:删 `photoQuality` / `jpegQuality` 行,加:
- `type` `'back' | 'front'` — 初始前/后摄(默认 back)
- `flashMode` `'auto' | 'on' | 'off'` — 初始闪光(保留作兼容;闪光实际由相机内 UI 控制)
- `quality` `number` — JPEG 压缩 0~1,默认 0.9
- `recTime` `number` — 录制时长上限(秒,video)

`CameraResult` / `CustomPhotoFile` 段补返回字段:`id`(唯一 id)、`cameraType`(前/后摄)、`cameraMode`(= mode),并保留 `path/uri/width/height/mime/mode`。

> README 为文档,无逐字脚本;按上述要点改表,保持与 `src/utils/interface.ts` 一致即可。

- [ ] **Step 4: typecheck + 测试 + 构建**

Run: `yarn typecheck && yarn test && yarn prepare`
Expected: typecheck 0 错;测试全绿;`yarn prepare` 产出 `lib/` 无错。

- [ ] **Step 5: Commit**

```bash
git add example/src/App.tsx package.json README.md
git commit -m "chore: bump 2.5.0, update example and README for quality API"
```

---

## Phase B — portal

> 前提:库 2.5.0 已发布到 npm(或本地 link),portal 能解析到新 `OpenConfig`/`CameraMode` 类型(含 `quality`/`type`,去 photoQuality/jpegQuality)。

### Task B1: toCameraConfig 透传多模式(portal)

**Files:**
- Modify: `/Users/liulijun/tongyi/unif/portal/src/utils/compat/camera.ts`
- Create: `/Users/liulijun/tongyi/unif/portal/src/utils/compat/camera.test.ts`(若 portal 有 jest;无则跳过测试步,仅 typecheck)

工作目录:`/Users/liulijun/tongyi/unif/portal`

- [ ] **Step 1: 升级库依赖**

Run: `cd /Users/liulijun/tongyi/unif/portal && yarn add @unif/react-native-camera@^2.5.0`
Expected: 装上 2.5.0。

- [ ] **Step 2: 写 toCameraConfig 测试(先失败,若 portal 有 jest)**

新建 `src/utils/compat/camera.test.ts`:

```ts
import { toCameraConfig } from './camera';

it('passes multi-mode array through (no flatten)', () => {
  const cfg = toCameraConfig({
    cameraMode: [{ mode: 'single' }, { mode: 'continuous' }],
  });
  expect(cfg.cameraMode).toHaveLength(2);
  expect(cfg.cameraMode[0].mode).toBe('single');
  expect(cfg.cameraMode[1].mode).toBe('continuous');
});

it('falls back to single mode for legacy callers', () => {
  const cfg = toCameraConfig({ mode: 'continuous' });
  expect(cfg.cameraMode).toHaveLength(1);
  expect(cfg.cameraMode[0].mode).toBe('continuous');
});

it('dedupes repeated modes', () => {
  const cfg = toCameraConfig({
    cameraMode: [{ mode: 'single' }, { mode: 'single' }],
  });
  expect(cfg.cameraMode).toHaveLength(1);
});

it('honors dataRetainedMode, defaults clear', () => {
  expect(toCameraConfig({ mode: 'single' }).dataRetainedMode).toBe('clear');
  expect(
    toCameraConfig({ mode: 'single', dataRetainedMode: 'retain' })
      .dataRetainedMode
  ).toBe('retain');
});

it('maps quality (default 0.9)', () => {
  expect(toCameraConfig({ mode: 'single' }).cameraMode[0].quality).toBe(0.9);
  expect(
    toCameraConfig({ mode: 'single', quality: 0.6 }).cameraMode[0].quality
  ).toBe(0.6);
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd /Users/liulijun/tongyi/unif/portal && yarn jest src/utils/compat/camera.test.ts`(命令按 portal package.json scripts 调整)
Expected: FAIL —— 旧 `toCameraConfig` 拍扁成单元素,无 `cameraMode` 数组入参。

- [ ] **Step 4: 重写 camera.ts**

替换 `src/utils/compat/camera.ts` 全文:

```ts
import type { OpenConfig, CameraResult } from '@unif/react-native-camera';

/** retail H5 PEC_CAMERA 入参(通用拍照子集)。
 *
 *  对齐原版 retail 契约:cameraMode 为数组,支持单拍/连拍多模式可切换。
 *  retail 其它字段(firm 厂商 AI / panorama 全景 / videoResolution / photoResolution /
 *  recTime / flashMode 等)unif 通用相机不支持或由相机内 UI 控制,一律忽略。 */
export type RetailCameraParams = {
  /** 多模式:底部出可切 tab(如 [{mode:'single'},{mode:'continuous'}])。优先于单 mode。 */
  cameraMode?: Array<{
    mode: 'single' | 'continuous';
    /** H5 传初始前后摄。 */
    type?: 'back' | 'front';
    quality?: number;
    // flashMode 不在此:闪光由相机内 UI 控制,非 config 输入。
  }>;
  /** 单模式(向后兼容旧 H5)。 */
  mode?: 'single' | 'continuous';
  quality?: number;
  /** 切模式是否保留照片,默认 clear。 */
  dataRetainedMode?: 'clear' | 'retain';
};

/** 按 mode 去重保序,防 H5 误传重复 mode 导致重复 tab。 */
function dedupeByMode<T extends { mode: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((m) => {
    if (seen.has(m.mode)) return false;
    seen.add(m.mode);
    return true;
  });
}

/** retail H5 入参 → camera OpenConfig。速度优先级在库内部写死 'speed';quality 透传。 */
export function toCameraConfig(params: RetailCameraParams): OpenConfig {
  const q = params.quality ?? 0.9;
  const list =
    params.cameraMode && params.cameraMode.length > 0
      ? dedupeByMode(params.cameraMode)
      : [{ mode: params.mode === 'continuous' ? 'continuous' : 'single' }];
  return {
    cameraMode: list.map((m) => ({
      mode: m.mode,
      type: 'type' in m ? m.type : undefined,
      quality: 'quality' in m && m.quality != null ? m.quality : q,
    })),
    dataRetainedMode: params.dataRetainedMode ?? 'clear',
  };
}

/** camera CameraResult → retail H5 返值(拍照文件路径数组,retail 用 item.path)。 */
export function toCameraPhotoPaths(result: CameraResult): string[] {
  return result.data.map((f) => f.path);
}
```

- [ ] **Step 5: 跑测试 + typecheck**

Run: `cd /Users/liulijun/tongyi/unif/portal && yarn jest src/utils/compat/camera.test.ts && yarn tsc --noEmit`(命令按 portal scripts 调整)
Expected: PASS —— 多模式透传、单模式兼容、去重、dataRetainedMode、quality 全过;typecheck 0 错。

- [ ] **Step 6: Commit(portal repo)**

```bash
cd /Users/liulijun/tongyi/unif/portal
git add src/utils/compat/camera.ts src/utils/compat/camera.test.ts package.json yarn.lock
git commit -m "fix: pass cameraMode array through for multi-mode camera (camera 2.5.0)"
```

> H5 端改发 `cameraMode` 数组(与原 retail H5 契约一致)由调用方协调,不在本仓库改动。

---

## 验证清单(实施后)

- [ ] 库 `yarn typecheck && yarn lint && yarn test` 全绿;`yarn prepare` 产出 lib。
- [ ] 库 `npm pack --dry-run` 含 lib + src + README;version 2.5.0。
- [ ] 真机 Bug 1:H5 传 `cameraMode:[{mode:'single'},{mode:'continuous'}]` → 底部出"拍照/连拍"两 tab,可切。
- [ ] 真机 Bug 2:取景里能看到侧边杯子(取景框留黑边)→ 拍出来杯子在;4:3 与 16:9 都验证。
- [ ] 返回 `data[i]` 同时含 `id/cameraType/cameraMode` 与 `path/uri/width/height/mime/mode`;portal H5 拿到 path 数组照常。
- [ ] portal `toCameraConfig` 多模式透传;旧单 mode 兼容。

---

## Self-Review 结论(plan 作者自查)

- **Spec 覆盖**:Part A(类型 A1 / buildPhotoFile A2 / quality+cameraType A3 / 初始 type A4 / example+version+README A7);Part C 取景 letterbox(A5);Bug 1 库侧锁定(A6 Footer 测试)+ portal 透传(B1);返回并集(A1/A2)。全覆盖。
- **占位符**:无 TBD/TODO;README 段(A7-S3)给明确要点(文档性质,可接受);Footer 测试(A6)用容器 testID 规避 design mock 限制。
- **类型一致**:`buildPhotoFile(raw, mode, cameraType, isVideo?)` 在 A2 定义,A3 两处调用一致;`CameraMode`/`CustomPhotoFile` 字段 A1 定义、后续引用一致;`toCameraConfig` 输出 `OpenConfig` 与库 A1 类型一致;`cameraType = device.position === 'front' ? 'front' : 'back'`(A3)与 `CameraType` 联合一致。
