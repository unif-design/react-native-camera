# 连拍「顺滑回看」实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 连拍烧水印时用「刚拍的定格帧 + 居中转圈」盖住黑屏、footer 不再整段替换,消除「闪一下回去 + 模式跳」,内存红线不动。

**Architecture:** 数据从产生地接到显示地:`useCaptureFlow` 烧水印期间产出 `freezeUri`(刚拍原图 uri)→ `Container` 透传给 `Camera` 的新 prop `frozenUri` → `Camera` 在取景框内叠定格 `<Image>`;`Container` 据 `burning` 在取景上叠居中「生成中」覆盖层,footer 恒定渲染(快门禁用)不再整段替换。`isActive=!burning`、`capturingRef`、串行烧 三条内存红线全部保留。

**Tech Stack:** React 19 + RN 0.85、TypeScript、jest(`@react-native/jest-preset`)、`@testing-library/react-native`(`renderHook`/`renderDark`)。

**Spec:** `docs/superpowers/specs/2026-06-11-continuous-capture-smooth-review-design.md`

---

## 前置

当前在 `main`(默认分支)。开始前先开 feature 分支(本仓约定:不在 main 直接堆改;commitlint 强校验 conventional commits):

```bash
git switch -c feat/continuous-smooth-review
```

提交 spec/plan 两个文档(brainstorming 产物,先随首个改动一起进分支):

```bash
git add docs/superpowers/specs/2026-06-11-continuous-capture-smooth-review-design.md docs/superpowers/plans/2026-06-11-continuous-capture-smooth-review.md
git commit -m "docs(camera): 连拍顺滑回看 spec + 实现计划"
```

---

## 文件结构

| 文件 | 责任 | 改动 |
| --- | --- | --- |
| `src/camera/hooks/useCaptureFlow.ts` | 拍摄编排核心 | 新增 `freezeUri` state + `MIN_FREEZE_MS` 最小定格;onShutter 烧水印前后 set/clear |
| `src/camera/Camera.tsx` | 取景显示 | 新增 `frozenUri?` prop,取景框内叠定格 `<Image>` |
| `src/camera/Container.tsx` | 相机内 UI 总装 | 透传 `frozenUri`;footer 去整段替换;新增居中「生成中」覆盖层 |
| `src/__tests__/camera/hooks/useCaptureFlow.test.ts` | hook 测试 | 加 `freezeUri` 行为 |
| `src/__tests__/camera/Camera.frozen.test.tsx` | Camera 测试 | 新建:`frozenUri` 渲染定格层 |
| `src/__tests__/camera/Container.burning.test.tsx` | Container 测试 | 新建:烧水印态 footer 不替换 + 覆盖层 + 透传 |

---

## Task 1: useCaptureFlow —— freezeUri 定格态 + 最小定格时长

**Files:**
- Modify: `src/camera/hooks/useCaptureFlow.ts`
- Test: `src/__tests__/camera/hooks/useCaptureFlow.test.ts`

- [ ] **Step 1: 写失败测试**

在 `src/__tests__/camera/hooks/useCaptureFlow.test.ts` 末尾(最后一个 `describe` 之后)追加:

```ts
describe('定格回看 freezeUri', () => {
  it('烧水印期间 freezeUri = 刚拍 uri;烧完后清回 null', async () => {
    // crop 挂起 → 停在 burning 态断言 freezeUri;再 resolve 走完(含最小定格时长)断言清空。
    let resolveCrop!: (f: CustomPhotoFile) => void;
    cropToRatioMock.mockImplementationOnce(
      () =>
        new Promise<CustomPhotoFile>((res) => {
          resolveCrop = res;
        })
    );
    const captured = photo('p1'); // uri = file:///tmp/p1.jpg
    const capture = jest.fn().mockResolvedValue(captured);
    const { result } = setup(capture, { aspectRatio: '16:9' });

    let shutter!: Promise<void>;
    await act(async () => {
      shutter = result.current.onShutter();
      await Promise.resolve(); // 让 capture 跑完、进入裁切(cropToRatio 此刻挂起)
    });
    expect(result.current.burning).toBe(true);
    expect(result.current.freezeUri).toBe(captured.uri);

    await act(async () => {
      resolveCrop(captured);
      await shutter; // 含 MIN_FREEZE_MS 最小定格(真实约 200ms)
    });
    expect(result.current.burning).toBe(false);
    expect(result.current.freezeUri).toBeNull();
  });

  it('无裁切无水印 → 不进定格(freezeUri 始终 null)', async () => {
    const capture = jest.fn().mockResolvedValue(photo('p1'));
    const { result } = setup(capture, { aspectRatio: '4:3' }); // 4:3 不裁、默认无水印
    await act(async () => {
      await result.current.onShutter();
    });
    expect(result.current.freezeUri).toBeNull();
    expect(result.current.photos).toHaveLength(1);
  });
});
```

> 注:第一个测试因 `MIN_FREEZE_MS` 用真实 timer 会真实等待约 200ms —— 简单稳健(避免 fake-timer 与 `act`/microtask 的脆弱交互);单测慢 200ms 可忽略。最小时长的精确数值属体验常量,留真机调,不单测断言。

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/__tests__/camera/hooks/useCaptureFlow.test.ts -t "freezeUri"`
Expected: FAIL —— `result.current.freezeUri` 为 `undefined`(hook 尚未返回该字段),`toBe(captured.uri)` / `toBeNull` 不满足。

- [ ] **Step 3: 实现**

在 `src/camera/hooks/useCaptureFlow.ts` 改 4 处:

(a) 文件顶部 import 之后、`type ConfirmFn` 之前,加常量:

```ts
// 定格最小可见时长:极快烧录(<200ms)时定格一闪而过会闪烁,补足这点时长再撤定格。
// 体验常量,真机可调。
const MIN_FREEZE_MS = 200;
```

(b) `export type CaptureFlow` 里,在 `burning: boolean;` 下一行加:

```ts
  /** 烧水印期间 = 刚拍原图 uri(供 Camera 取景框盖定格帧防黑屏),否则 null。 */
  freezeUri: string | null;
```

(c) 在 `const [burning, setBurning] = useState(false);` 下一行加 state:

```ts
  // 顺滑回看:烧水印时 isActive=false 取景真停(内存安全),用刚拍原图盖住取景框防黑屏。
  const [freezeUri, setFreezeUri] = useState<string | null>(null);
```

(d) 找到 `onShutter` 里这段:

```ts
      let saved = f;
      if (needCrop || wm != null) {
        setBurning(true);
        try {
          if (needCrop) saved = await cropToRatio(saved, '16:9');
          if (wm != null) saved = await burnWatermark(saved, wm);
        } finally {
          setBurning(false);
        }
      }
```

替换为:

```ts
      let saved = f;
      if (needCrop || wm != null) {
        // 先把"刚拍的原图"定格盖上(取景随 burning 停,被定格图盖住 → 不黑屏);
        // 撤定格在 finally,且补足 MIN_FREEZE_MS 防极快烧录闪烁。
        setFreezeUri(f.uri);
        const startedAt = Date.now(); // 组件运行时,Date.now 可用(仅 workflow 脚本里禁用)
        setBurning(true);
        try {
          if (needCrop) saved = await cropToRatio(saved, '16:9');
          if (wm != null) saved = await burnWatermark(saved, wm);
        } finally {
          setBurning(false); // 取景先恢复(背后实时画面已在跑,仍被定格图盖着)
          const elapsed = Date.now() - startedAt;
          if (elapsed < MIN_FREEZE_MS) {
            await new Promise<void>((r) =>
              setTimeout(r, MIN_FREEZE_MS - elapsed)
            );
          }
          setFreezeUri(null); // 撤定格 → 无缝切回实时画面
        }
      }
```

(e) 函数底部 `return { ... }` 里,在 `burning,` 下一行加 `freezeUri,`。

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/__tests__/camera/hooks/useCaptureFlow.test.ts`
Expected: PASS(含既有用例;`freezeUri` 两个新用例绿)。

- [ ] **Step 5: typecheck + commit**

```bash
yarn typecheck
git add src/camera/hooks/useCaptureFlow.ts src/__tests__/camera/hooks/useCaptureFlow.test.ts
git commit -m "feat(camera): useCaptureFlow 新增 freezeUri 定格态(连拍顺滑回看)"
```

---

## Task 2: Camera —— frozenUri 定格层

**Files:**
- Modify: `src/camera/Camera.tsx`
- Test: `src/__tests__/camera/Camera.frozen.test.tsx`(新建)

- [ ] **Step 1: 写失败测试**

新建 `src/__tests__/camera/Camera.frozen.test.tsx`:

```tsx
import { Camera } from '../../camera/Camera';
import type { CameraMode } from '../../utils';
import { renderDark } from '../__helpers__/renderDark';
import { makeDeviceStub } from '../__helpers__/visionCameraMock';

// 定格帧:烧水印期间 Container 透传 frozenUri,Camera 在取景框内盖刚拍原图防黑屏。
// 直接渲染 <Camera>(绕过 Container),isActive=false 对齐烧水印时停取景。
const singleMode: CameraMode = { mode: 'single' };

function renderCamera(frozenUri?: string) {
  return renderDark(
    <Camera
      device={makeDeviceStub() as never}
      currentMode={singleMode}
      isActive={false}
      frozenUri={frozenUri}
    />
  );
}

it('frozenUri 非空 → 取景框内渲染定格 Image(cover)', () => {
  const { getByTestId } = renderCamera('file:///tmp/p1.jpg');
  const img = getByTestId('frozen-frame');
  expect(img.props.source).toEqual({ uri: 'file:///tmp/p1.jpg' });
  expect(img.props.resizeMode).toBe('cover');
});

it('frozenUri 为空 → 不渲染定格 Image', () => {
  const { queryByTestId } = renderCamera(undefined);
  expect(queryByTestId('frozen-frame')).toBeNull();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/__tests__/camera/Camera.frozen.test.tsx`
Expected: FAIL —— `Camera` 无 `frozenUri` prop,`getByTestId('frozen-frame')` 找不到节点抛错。

- [ ] **Step 3: 实现**

在 `src/camera/Camera.tsx` 改 4 处:

(a) 顶部 RN import 加 `Image`:

```ts
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
```

(b) `type Props` 里,在 `aspectRatio?: AspectRatio;` 下一行加:

```ts
  // 烧水印「顺滑回看」:非空时在取景框内盖一张刚拍原图(定格帧),撤掉(转 undefined/null)瞬间
  // 与实时画面同框同位、无缝。放进取景框内 → 自动继承 frameStyle 尺寸/cover/裁切。
  frozenUri?: string | null;
```

(c) 函数参数解构(`forwardRef` 的第一个入参对象)里,在 `aspectRatio,` 下一行加 `frozenUri,`。

(d) 找到 JSX 里 `<FocusIndicator ... />` 的条件块:

```tsx
          {focusPoint && (
            <FocusIndicator
              key={`${focusPoint.x}-${focusPoint.y}`}
              point={focusPoint}
              onAnimationEnd={() => setFocusPoint(null)}
            />
          )}
```

在其**后面**(同在 `<Animated.View style={[styles.frame, frameStyle]}>` 内、闭合 `</Animated.View>` 之前)追加定格层(放最后 = 盖在取景与对焦环之上):

```tsx
          {frozenUri != null && (
            <Image
              source={{ uri: frozenUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              testID="frozen-frame"
            />
          )}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/__tests__/camera/Camera.frozen.test.tsx`
Expected: PASS(两个用例绿)。

- [ ] **Step 5: typecheck + commit**

```bash
yarn typecheck
git add src/camera/Camera.tsx src/__tests__/camera/Camera.frozen.test.tsx
git commit -m "feat(camera): Camera 支持 frozenUri 定格层(取景框内盖刚拍原图)"
```

---

## Task 3: Container —— footer 去整段替换 + 「生成中」覆盖层 + 透传定格帧

**Files:**
- Modify: `src/camera/Container.tsx`
- Test: `src/__tests__/camera/Container.burning.test.tsx`(新建)

- [ ] **Step 1: 写失败测试**

新建 `src/__tests__/camera/Container.burning.test.tsx`:

```tsx
import type { ReactElement } from 'react';
import { Container } from '../../camera/Container';
import { CameraDialogProvider } from '../../camera/ui/CameraDialogHost';
import { renderDark } from '../__helpers__/renderDark';
import { useCaptureFlow } from '../../camera/hooks/useCaptureFlow';
import type { CaptureFlow } from '../../camera/hooks/useCaptureFlow';

// device-ready 需:已授权 + 有设备(覆盖全局 vision-camera mock)。
jest.mock('react-native-vision-camera', () => {
  const vc = require('../__helpers__/visionCameraMock');
  return vc.makeVisionCameraMock({
    ...vc.grantedPermissionOverrides(),
    useCameraDevice: (position: 'back' | 'front') =>
      vc.makeDeviceStub({ position }),
  });
});

// 触发真实 burning 需经快门→capture→挂起烧录(集成成本高且脆弱);改为 mock useCaptureFlow
// 注入受控 burning/freezeUri,精确验证 Container 渲染接线(footer 不替换 + 覆盖层 + 透传)。
jest.mock('../../camera/hooks/useCaptureFlow', () => ({
  useCaptureFlow: jest.fn(),
}));
const useCaptureFlowMock = jest.mocked(useCaptureFlow);

function makeFlow(overrides: Partial<CaptureFlow> = {}): CaptureFlow {
  return {
    photos: [],
    previewing: false,
    previewVariant: 'gallery',
    openGallery: jest.fn(),
    retake: jest.fn(),
    deletePhoto: jest.fn(),
    closePreview: jest.fn(),
    flashNonce: 0,
    burning: false,
    capturing: false,
    recording: false,
    recSeconds: 0,
    onShutter: jest.fn(),
    onVideoAutoFinished: jest.fn(),
    handleSave: jest.fn(),
    handleCancel: jest.fn(),
    onSelectMode: jest.fn(),
    freezeUri: null,
    ...overrides,
  };
}

function renderContainer(flow: CaptureFlow) {
  useCaptureFlowMock.mockReturnValue(flow);
  // 多模式 config → 渲染可切换药丸(有 mode-switcher-wrap),便于断言「footer 没被替换」。
  const ui: ReactElement = (
    <CameraDialogProvider>
      <Container
        config={{
          dataRetainedMode: 'retain',
          cameraMode: [{ mode: 'single', type: 'back' }, { mode: 'continuous' }],
        }}
        onSettle={() => {}}
      />
    </CameraDialogProvider>
  );
  return renderDark(ui);
}

it('烧水印中:footer 仍渲染模式药丸(不被整段替换)+ 居中「生成中」覆盖层 + 定格帧透传进取景', () => {
  const { getByTestId } = renderContainer(
    makeFlow({ burning: true, freezeUri: 'file:///tmp/p1.jpg' })
  );
  expect(getByTestId('mode-switcher-wrap')).toBeTruthy(); // footer 没被替换
  expect(getByTestId('burning')).toBeTruthy(); // 居中覆盖层
  expect(getByTestId('frozen-frame')).toBeTruthy(); // 透传进 Camera 取景框
});

it('未烧水印:无覆盖层、无定格帧,footer 正常', () => {
  const { getByTestId, queryByTestId } = renderContainer(
    makeFlow({ burning: false, freezeUri: null })
  );
  expect(getByTestId('mode-switcher-wrap')).toBeTruthy();
  expect(queryByTestId('burning')).toBeNull();
  expect(queryByTestId('frozen-frame')).toBeNull();
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `yarn test src/__tests__/camera/Container.burning.test.tsx`
Expected: FAIL —— 当前 footer 是 `burning ? <testID="burning" 整段块> : <药丸>`,`burning:true` 下 `mode-switcher-wrap` 不渲染(被整段替换)→ 第一个用例 `getByTestId('mode-switcher-wrap')` 抛错;`frozen-frame` 也因 Container 尚未透传而缺失。

- [ ] **Step 3: 实现**

在 `src/camera/Container.tsx` 改 4 处:

(a) 从 `useCaptureFlow({...})` 解构里,在 `burning,` 下一行加 `freezeUri,`。

(b) `<Camera ... />` 的 props 里,在 `isActive={appActive && !burning}` 下一行加:

```tsx
        // 烧水印期间盖刚拍原图防黑屏(isActive=false 取景已停,被它盖住);见顺滑回看 spec。
        frozenUri={freezeUri}
```

(c) 找到 footer 这段(`<View style={[styles.bottom, ...]} onLayout={...}>` 内):

```tsx
        {burning ? (
          <View style={styles.burningFooter} testID="burning">
            <Loading />
            <Text style={styles.burningText}>正在生成水印图片…</Text>
          </View>
        ) : (
          <>
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
              shutterDisabled={capturing}
              latestUri={photos.at(-1)?.uri}
              count={photos.length}
              onShutter={onShutter}
              onFlip={onFlip}
              onOpenPreview={openGallery}
            />
          </>
        )}
```

替换为(去掉 `burning ?` 整段分支,footer 恒定渲染;快门由 `shutterDisabled={capturing}` 在烧水印期间禁用):

```tsx
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
          shutterDisabled={capturing}
          latestUri={photos.at(-1)?.uri}
          count={photos.length}
          onShutter={onShutter}
          onFlip={onFlip}
          onOpenPreview={openGallery}
        />
```

(d) 新增「生成中」覆盖层。找到 `<CaptureFlash trigger={flashNonce} />` 这行,在其**前面**插入:

```tsx
      {/* 烧水印「顺滑回看」:取景已被定格帧盖住(见 Camera frozenUri),这里在其上叠居中
          非阻塞「生成中」提示;footer 不再整段替换(模式药丸恒定,不卸载 → 不跳档)。 */}
      {burning && (
        <View style={styles.burningOverlay} pointerEvents="none" testID="burning">
          <Loading />
          <Text style={styles.burningText}>水印生成中…</Text>
        </View>
      )}

```

(e) `makeStyles` 里把 `burningFooter` 样式替换成 `burningOverlay`(`burningText` 保留不动):

找到:

```ts
    burningFooter: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: r(8),
      paddingVertical: r(16),
    },
    burningText: { color: c.foreground, fontSize: t.sm },
```

替换为:

```ts
    // 「生成中」覆盖层:绝对铺满、居中,盖在取景(被定格帧盖住的画面)之上、footer 之下。
    burningOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      gap: r(8),
      zIndex: Z.overlay,
    },
    burningText: { color: c.foreground, fontSize: t.sm },
```

- [ ] **Step 4: 跑测试确认通过**

Run: `yarn test src/__tests__/camera/Container.burning.test.tsx`
Expected: PASS(两个用例绿)。

- [ ] **Step 5: 顺手更新 useCaptureFlow 注释旧文案(非功能)**

`src/camera/hooks/useCaptureFlow.ts` 里把注释中的 `footer 显示"正在生成水印图片…"` 改为 `取景叠"水印生成中…"覆盖层`,与新 UI 一致(仅注释,不影响逻辑)。

- [ ] **Step 6: typecheck + commit**

```bash
yarn typecheck
git add src/camera/Container.tsx src/camera/hooks/useCaptureFlow.ts src/__tests__/camera/Container.burning.test.tsx
git commit -m "refactor(camera): 烧水印 footer 不再整段替换,改居中覆盖层 + 透传定格帧"
```

---

## Task 4: 全量验证

- [ ] **Step 1: 全量 typecheck / lint / test**

```bash
yarn typecheck
yarn lint
yarn test
```

Expected: 全绿(typecheck 无输出;lint 0 error;test 全部 suite pass,含既有 183 + 本次新增)。若 lint 报 prettier 格式,跑 `yarn lint --fix` 后复查。

- [ ] **Step 2: 若有未提交的 lint --fix 改动,补一次提交**

```bash
git add -A
git commit -m "style(camera): prettier 格式修正"
```

> 真机验证项(jest 测不到,留给真机/手动):连拍多张取景全程不黑不跳、定格→实时无缝;前摄定格是否镜像错位(必要时给前摄定格 Image 加 `transform:[{scaleX:-1}]`);`MIN_FREEZE_MS=200` 观感;低端机连拍稳定不闪退。详见 spec「真机验证项」。

---

## Self-Review(计划自审)

- **Spec 覆盖**:① 取景黑屏→定格帧 = Task 2 `frozenUri` + Task 1 `freezeUri`;② footer 不整段替换 = Task 3(c);③ 生成中居中提示 = Task 3(d)居中覆盖层 + 决策「居中 spinner+文案」;④ `MIN_FREEZE_MS=200` = Task 1(a)(d);⑤ 内存红线(isActive/capturingRef/串行烧)不动 = 三个 Task 均未触碰相关代码;⑥ 失败返原图、极快闪烁、前摄镜像 = Task 1 finally 清 freezeUri、`MIN_FREEZE_MS` 兜底、Task 4 真机项。无遗漏。
- **占位扫描**:无 TBD/TODO;所有 code step 给完整代码与精确命令。
- **类型一致**:`freezeUri: string | null`(hook state/返回)↔ `frozenUri?: string | null`(Camera prop)↔ `frozenUri={freezeUri}`(Container 透传)一致;`MIN_FREEZE_MS` 常量名贯穿一致;testID `frozen-frame` / `burning` / `mode-switcher-wrap` 跨 Task 引用一致(`mode-switcher-wrap` 来自本会话已合入的 ModeSwitcherPill 改动)。
