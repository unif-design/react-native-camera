# Camera State-Machine Reliability Implementation Plan

> **执行要求：** 使用 `subagent-driven-development`，每个 Task 由新的 implementer
> 按 RED → GREEN → REFACTOR 完成，再由独立 reviewer 审查。任何提交都只暂存该 Task
> 的明确文件，禁止 `git add .`，并保留同分支并行会话对 `AGENTS.md`、`CLAUDE.md` 与
> CI 的改动。

**Goal:** 在不改变 `useCamera()`、`open()` / `close()` 参数、`CameraResult`、
`CustomPhotoFile` 与 result code 的前提下，修复相机会话竞态、录像生命周期、图片处理、
临时文件、响应式取景、native 接入、文档与消费侧 Camera Skill 漂移。

**Architecture:** `useCamera` 负责跨 session 的 identity 与 exactly-once settle；
`camera/session` 的纯 reducer、configuration identity、capability、device 与 frame
几何负责单 session 状态；`Camera` 只封装 VisionCamera native output / Recorder；
`useCaptureFlow` 把 reducer command、单次图片 processor 与 file registry 接起来。
所有 native Promise/callback 都携带 operation token，文件只由 per-session registry
清理或转移。

**Tech Stack:** React Native 0.85、React 19、TypeScript 6、VisionCamera 5、
React Native Skia 2.6、RNGH 3、Reanimated 4.5、RN Video 7、RNFS、Jest、
Testing Library、Docusaurus、Turbo、Yarn 4。

**Authoritative design:**
`docs/superpowers/specs/2026-07-30-camera-state-machine-reliability-design.md`

---

## Task 1：运行时配置校验与跨 Session exactly-once

**Files:**

- Create: `src/utils/validateOpenConfig.ts`
- Create: `src/__tests__/utils/validateOpenConfig.test.ts`
- Modify: `src/hooks/useCamera.tsx`
- Modify: `src/__tests__/useCamera.test.tsx`

### Step 1：写 validator 的失败测试

覆盖：

- 非对象 / 空 `cameraMode`
- 未知 mode / type / flashMode / dataRetainedMode
- `quality` 的 NaN、Infinity、负数、>1
- `recTime` / `videoBitRate` 的非 finite 或 `<=0`
- watermark 非对象、content 非 string[]、未知 position
- `photoQualityPrioritization` / `photoHDR` 类型错误
- 有效边界值、空 watermark content
- 输入对象不被修改，返回值是深拷贝的 normalized session snapshot
- 校验后修改原 `cameraMode[]`、mode object、watermark 或 `content[]` 不影响 snapshot

测试只导入内部函数：

```ts
const validated = validateOpenConfig(validConfig);
expect(validated).toEqual({ ok: true, config: validConfig });
expect(validated.ok && validated.config).not.toBe(validConfig);
expect(validateOpenConfig({ cameraMode: [] })).toEqual({
  ok: false,
  result: { code: 500, data: [], message: 'invalid_config' },
});
```

Run:

```sh
yarn test src/__tests__/utils/validateOpenConfig.test.ts --runInBand
```

Expected: FAIL，因为模块不存在。

### Step 2：实现最小纯 validator

`validateOpenConfig(value: unknown)` 使用显式 type guard，不 mutate、不向公共 barrel
导出。成功返回深拷贝的 config（包括 `cameraMode`、每个 mode、watermark 与
`content`）；失败返回稳定 `invalid_config` result。不要引入 schema runtime dependency。

### Step 3：写 SessionCoordinator 行为测试

在 `useCamera.test.tsx` 增加：

- 第二次有效 `open()` 先兑现旧 Promise 为 cancelled，再挂新 session。
- 非法新 config 立即返回 500，但不关闭正在运行的有效 session。
- 旧 Container 的 `onSettle` / Modal close 不会 settle 新 Promise。
- 同一 session 的 save、close、cleanup 任意顺序只 resolve 一次。
- hook unmount 兑现 active Promise，且不在 unmount 后 setState。
- 每个渲染的 Container 接收固定 `sessionId`。

用 deferred Promise 与 resolver spy 明确断言次数，不只断言最终 UI。

### Step 4：重写 `useCamera`

内部记录：

```ts
type SessionRecord = {
  id: number;
  config: OpenConfig;
  status: 'active' | 'settling' | 'settled';
  resolve: (result: CameraResult) => void;
  resources: SessionResources;
};
```

实现 `finish(sessionId, result)`：

- ID 与 status 双门禁。
- 先把 record 标为 settled / 从 ref 摘除，再 resolve。
- `setVisible(false)` / `setRenderedSession(null)` 只针对仍为当前的 ID。
- Container、Modal `onRequestClose` 与 cleanup 都捕获自己的 session ID。
- 新 open 先 settle 旧 session，再安装新 record。
- invalid open 用 `Promise.resolve(invalidResult)`，不替换 active record。

本 Task 先定义 session-bound resources / controller bridge 的最小接口；真实 registry
删除由 Task 3 实现、Task 5 接入。Modal hardware back 不得再直接 settle：bridge 尚未
注册时可按 ready 用户取消处理，注册后交给 `requestUserCancel()`；`api.close()` /
supersede / unmount 使用 `forceTeardown()`。

### Step 5：验证与提交

```sh
yarn test src/__tests__/utils/validateOpenConfig.test.ts src/__tests__/useCamera.test.tsx --runInBand
yarn typecheck
git diff --check
git add src/utils/validateOpenConfig.ts src/__tests__/utils/validateOpenConfig.test.ts src/hooks/useCamera.tsx src/__tests__/useCamera.test.tsx
git commit -m "fix(camera): isolate and validate camera sessions"
```

---

## Task 2：纯 Session reducer、capability、配置 generation、设备与 frame 几何

**Files:**

- Create: `src/camera/session/types.ts`
- Create: `src/camera/session/reducer.ts`
- Create: `src/camera/session/configuration.ts`
- Create: `src/camera/session/deviceSelection.ts`
- Create: `src/camera/session/frameRect.ts`
- Create: `src/__tests__/camera/session/reducer.test.ts`
- Create: `src/__tests__/camera/session/configuration.test.ts`
- Create: `src/__tests__/camera/session/deviceSelection.test.ts`
- Create: `src/__tests__/camera/session/frameRect.test.ts`

### Step 1：先写 phase / capability 失败测试

状态至少包含：

```ts
type CameraSessionPhase =
  | 'configuring'
  | 'ready'
  | 'capturingPhoto'
  | 'processingPhoto'
  | 'startingVideo'
  | 'recording'
  | 'stoppingVideo'
  | 'previewing'
  | 'settling'
  | 'closed';
```

测试每个 phase 的 capture、flip / mode / aspect、save / gallery、zoom / focus、
userCancel，以及：

- 非法 action 返回相同 state identity。
- operation ID 不匹配的 success/failure 不更新 state。
- `VIDEO_FINISHED` 可从 starting / recording / stopping 收口。
- preview、files、mode、aspect、实际 activePosition、flash、sound 在 reducer 内。
- `SETTLING` 后不接受业务 action。

### Step 2：写 configuration identity / generation 失败测试

`nativeConfigurationKey()` 必须受以下值影响：

- 实际 device ID / position
- photo ↔ video output
- 当前 mode quality
- video 模式 aspect
- video bitrate
- photo HDR / quality prioritization

photo 模式只改 aspect 不改变 key；`single ↔ continuous` 且 quality / output 参数相同
也不改变 key。只有动作前后 key 不同才 dispatch `BEGIN_CONFIGURATION` 并递增
generation；`CONFIGURED` 只有 generation 等于当前值才恢复 ready。测试必须同时覆盖：

- UI-only photo aspect / same-output mode change 保持 ready，不等待 callback。
- device、photo ↔ video、不同 photo quality、video aspect / bitrate、constraints
  进入 configuring。
- 快速两次真实重配只有最新 generation callback 生效。

### Step 3：写 device fallback 失败测试

纯函数签名：

```ts
selectCameraDevice(
  requested: CameraType,
  back: CameraDevice | undefined,
  front: CameraDevice | undefined
): { device: CameraDevice; activePosition: CameraType; canFlip: boolean } | null
```

覆盖首选、另一侧 fallback、两侧缺失、fallback 后 activePosition 等于
`selectedDevice.position`、只有目标侧存在才允许 flip。

### Step 4：写响应式 frame 失败测试

`fitCameraFrame(viewport, aspect)` 在 portrait / landscape / iPad split 下始终：

- frame 不越出 viewport。
- 4:3 横向为 `4/3`、竖向为 `3/4`。
- 16:9 横向为 `16/9`、竖向为 `9/16`。
- 同尺寸输入结果 deterministic，0 / 非 finite 尺寸安全返回零 rect。

### Step 5：实现纯模块

Reducer 不执行 Promise、RNFS、Skia 或 native API。native 配置 identity 使用稳定字段
拼接，不要 JSON stringify 整个 device/config，也不要把纯 UI mode 名 / photo aspect
误放进 key。capability 是唯一 selector：

```ts
const caps = selectCapabilities(state);
if (!caps.capture) return state;
```

### Step 6：验证与提交

```sh
yarn test src/__tests__/camera/session --runInBand
yarn typecheck
yarn lint
git diff --check
git add src/camera/session src/__tests__/camera/session
git commit -m "feat(camera): add deterministic session state machine"
```

---

## Task 3：每 Session 文件所有权与单次原子图片 processor

**Files:**

- Create: `src/camera/session/fileRegistry.ts`
- Create: `src/camera/image/cropGeometry.ts`
- Create: `src/camera/image/processPhoto.ts`
- Create: `src/camera/watermark/paragraph.ts`
- Create: `src/__tests__/camera/session/fileRegistry.test.ts`
- Create: `src/__tests__/camera/image/cropGeometry.test.ts`
- Create: `src/__tests__/camera/image/processPhoto.test.ts`
- Create: `src/__tests__/camera/watermark/paragraph.test.ts`
- Modify: `src/camera/watermark/layout.ts`
- Modify: `src/camera/watermark/WatermarkStamp.tsx`
- Modify: `src/camera/watermark/index.tsx`
- Modify: `src/__tests__/camera/watermark/layout.test.ts`
- Modify: `src/__tests__/camera/watermark/WatermarkStamp.test.tsx`
- Modify: `jest.setup.ts`
- Delete after replacement: `src/camera/watermark/cropToRatio.ts`
- Delete after replacement: `src/camera/watermark/burnWatermark.ts`
- Delete/replace tests:
  `src/__tests__/camera/watermark/cropToRatio.test.ts`,
  `src/__tests__/camera/watermark/burnWatermark.test.ts`

### Step 1：写 registry RED tests

注入 `unlink(path)`，覆盖：

- `register()` 后 path 为 owned。
- delete / cleanup 在 await 前同步标记 deleted，重复调用只 unlink 一次。
- `replace(raw, final)` 先 register final，再摘除 / 删除 raw。
- `transfer(paths)` 后 cleanup 不删除消费者文件，但会 drain 未被 result 引用的其他
  owned raw / intermediate / abandoned final。
- 不在 registry 的 path 永远不能 unlink。
- 一个 unlink reject 不阻断其他 path，且 cleanup Promise resolve。
- late operation 注册后可单独 cleanup。
- Recorder finish path 在 token 判断前先登记到产生它的 session registry；stale callback
  删除旧 session 自己的 path。

### Step 2：写通用 crop RED tests

`computeCropRect(sourceWidth, sourceHeight, targetAspect)` 覆盖 portrait / landscape
4:3、16:9、已匹配、宽图裁宽、窄图裁高、无效尺寸抛出可诊断 error。

target aspect 使用 Skia decode 后的最终像素方向，公式固定为：

```ts
const R = aspect === '16:9' ? 16 / 9 : 4 / 3;
const targetWidthOverHeight =
  decodedWidth >= decodedHeight ? R : 1 / R;
```

### Step 3：写 processor RED tests

注入或 mock RNFS / Skia，覆盖：

- 无裁切、无有效 watermark 时返回 raw 且 0 次 decode / encode。
- crop + watermark 同时请求时恰好一次 decode、surface、snapshot、JPEG encode、write。
- JPEG quality 为 `round(clamp(mode.quality ?? 0.9) * 100)`。
- 输出 path 含 sessionId + captureId，width / height 来自最终 surface。
- decode / surface / encode / write 任一步失败都 reject typed internal error，不返回 raw。
- 失败产物与 raw 由 registry 清理；成功时 final owned、raw deleted。
- video 不调用 processor。
- Data、image、paint、builder、paragraph、snapshot、surface 按逆序 dispose。
- Skia decode 提供的 width / height 直接进入 crop；不调用手工 EXIF rotate / mirror。
  用 orientation 6 与 mirrored metadata case 断言没有二次变换。
- operation 使用快门时快照的 aspect / quality / watermark / camera position；processor
  await 期间 viewport 旋转或当前 mode 改变不会改本张结果。

Jest 不能证明 native Skia 的真实 encoded-origin 行为；保留设计稿中的 EXIF fixture
真机 smoke 项，不添加猜测性的 transform。

### Step 4：统一 watermark layout 与 Paragraph

把 layout 扩为：

```ts
computeWatermarkLayout(
  width: number,
  height: number,
  watermark: WatermarkType
): {
  fontSize: number;
  lineHeight: number;
  padding: number;
  paragraphWidth: number;
  align: 'left' | 'center' | 'right';
  anchorY: 'top' | 'bottom';
  // ...
}
```

短边作为比例基准，最大段宽为画面宽度 70%。`paragraph.ts` 是 preview 与 burn
共用的 builder / placement helper；首行 SemiBold，其余 Normal，统一
heightMultiplier、shadow 与系统字体 fallback。

`WatermarkStamp` 改为透明 Skia `Canvas` + `Paragraph`，显式接收 frame rect，不再读
window width 或使用 RN `<Text>`。effect cleanup dispose paragraph。

### Step 5：实现单次 processor

处理顺序：

```text
read/decode → crop source rect → one offscreen draw → optional paragraph
→ snapshot → one JPEG encode → unique write → registry.replace(raw, final)
```

写入成功前不能删除 raw；catch 中清理已登记的本次产物并 rethrow；对“显式请求
16:9 / 水印”失败绝不提交 raw。

### Step 6：验证与提交

```sh
yarn test src/__tests__/camera/session/fileRegistry.test.ts src/__tests__/camera/image src/__tests__/camera/watermark --runInBand
yarn typecheck
yarn lint
git diff --check
git add src/camera/session/fileRegistry.ts src/camera/image src/camera/watermark src/__tests__/camera/session/fileRegistry.test.ts src/__tests__/camera/image src/__tests__/camera/watermark jest.setup.ts
git commit -m "fix(camera): make photo processing atomic"
```

---

## Task 4：Recorder 单次生命周期与乱序 callback 收口

**Files:**

- Create: `src/camera/recording/recorderController.ts`
- Create: `src/__tests__/camera/recording/recorderController.test.ts`
- Modify: `src/camera/Camera.tsx`
- Modify: `src/camera/hooks/useVideoRecorder.ts`
- Modify: `src/__tests__/camera/hooks/useVideoRecorder.test.ts`
- Modify: `src/__tests__/camera/Camera.frozen.test.tsx`
- Modify as needed: `src/__tests__/__helpers__/visionCameraMock.ts`

### Step 1：写 native recorder controller RED tests

注入 `createRecorder`、monotonic clock 与 callbacks，覆盖：

- 每次 start 创建新的 Recorder；删除 prepared / prewarm。
- 已授权直接 start；未授权请求并以 boolean 结果作 gate。
- permission false 时不 create / start。
- create / start failure cancel/dispose，finalize error 恰好一次。
- finish/error callback 可以早于 `startRecording()` Promise continuation。
- finish callback 可以早于 `stopRecording()` Promise resolve。
- error callback 早于 start resolve / reject 后，晚到 continuation 不二次报错或回 recording。
- finish / error 已 finalize 后，start / stop Promise 再 reject 只幂等收尾。
- cancel 与 finish callback 竞争时仅一个终态。
- stop 先 snapshot `recordedDuration`，再请求 stop，最终文件只来自 finish callback。
- stop throw 时尝试 cancel，清 stale continuation。
- max-duration / max-file-size / manual stop 用同一 finalizer。
- cancel 不交付 file，且晚到 callback no-op。
- dispose 恰好一次。
- settings 每次从当前 recTime / output identity 计算，不复用旧 recorder。
- Recorder dispose、video path commit / cleanup、UI transition 分别恰好一次。

### Step 2：定义内部 CameraHandle

保持消费者 API 不变，只调整内部 ref：

```ts
type VideoCallbacks = {
  onFinished: (
    file: CustomPhotoFile,
    reason: RecordingFinishedReason,
    duration: number
  ) => void;
  onError: (error: Error) => void;
};

type CameraHandle = {
  capture: () => Promise<CustomPhotoFile | null>;
  startVideo: (callbacks: VideoCallbacks) => Promise<'started' | 'denied'>;
  stopVideo: () => Promise<void>;
  cancelVideo: () => Promise<void>;
  getRecordedDuration: () => number;
};
```

若最终实现选择等价命名，必须保留这些语义：stop Promise 不返回 file；callback 是
唯一 file finalization；cancel 可由 session coordinator 强制调用。

### Step 3：实现 controller 与 `Camera`

- `requestMic()` 的返回值必须检查。
- recorder 先安装 callback/token，再 await start。
- finalizer 允许 starting / recording / stopping，完成后立即使 start/stop continuation
  token 失效。
- 每个 Recorder 持有独立 `pending | finalized | cancelled` 原子状态，不能只根据 React
  phase 判断晚到 continuation。
- duration 使用 native 最大观测值、stop 前 snapshot、monotonic fallback；
  max-duration reason 至少保留配置上限。
- finish path 交给上层时先在产生它的 session registry 登记，再判断 operation token；
  stale callback 随后 cleanup，不得先判断 token 而漏掉文件。
- unmount cancel active recorder；不留 resolver。

### Step 4：改 `useVideoRecorder`

该 hook 不再以 `stopVideo()` 返回 file 为事实来源。它发起 start/stop/cancel，
轮询 `getRecordedDuration()` 并把 native callback 转为 reducer event。所有回调接收
当前 `{sessionId, operationId}`，过期事件只交给 file registry cleanup。

### Step 5：验证与提交

```sh
yarn test src/__tests__/camera/recording src/__tests__/camera/hooks/useVideoRecorder.test.ts src/__tests__/camera/Camera.frozen.test.tsx --runInBand
yarn typecheck
yarn lint
git diff --check
git add src/camera/recording src/__tests__/camera/recording src/camera/Camera.tsx src/camera/hooks/useVideoRecorder.ts src/__tests__/camera/hooks/useVideoRecorder.test.ts src/__tests__/camera/Camera.frozen.test.tsx src/__tests__/__helpers__/visionCameraMock.ts
git commit -m "fix(camera): finalize each recording exactly once"
```

---

## Task 5：把 reducer、operation token、registry 与拍摄流接入 Container

**Files:**

- Create: `src/camera/hooks/useCameraSessionController.ts`
- Create: `src/__tests__/camera/hooks/useCameraSessionController.test.ts`
- Modify: `src/camera/hooks/useCaptureFlow.ts`
- Modify: `src/__tests__/camera/hooks/useCaptureFlow.test.ts`
- Modify: `src/camera/Container.tsx`
- Modify: `src/camera/Camera.tsx`
- Modify: `src/hooks/useCamera.tsx`
- Modify: `src/__tests__/camera/Container.test.tsx`
- Modify: `src/__tests__/camera/Container.burning.test.tsx`
- Modify: `src/__tests__/camera/Container.resultCodes.test.tsx`
- Modify: `src/__tests__/camera/Container.onError.test.tsx`
- Modify: `src/__tests__/useCamera.test.tsx`

### Step 1：写 controller / integration RED tests

覆盖完整事务：

- onConfigured 前 phase=configuring，shutter / flip / mode / save disabled。
- 只有最新 configuration generation 可恢复 ready。
- 同帧双快门只有一个 capture operation。
- capture → processing → commit；处理失败回 ready、保留旧 files、显示错误。
- close / supersede / unmount 使 operation token 过期；晚到 raw/final 只清理不入 state。
- save 先 transfer result paths，再 settle 200。
- save transfer result paths 后会 drain 未返回的其他 owned intermediate。
- delete、retake、clear mode switch、cancel 清理对应 owned files。
- 瞬态 photo/video processing 时 UI back 被忽略；强制 `api.close()` 仍 cancel。
- recording 中用户 cancel 走确认 + recorder cancel。
- Modal hardware back 走 session-bound `requestUserCancel()`；旧 Container bridge 不能
  控制新 session。
- runtime camera `onError` 只提示，不 settle。
- 录像 callback 的 manual/auto/error 都经过相同 dispatch 路径。

### Step 2：实现 `useCameraSessionController`

该 hook 组合 reducer 与 native command refs，但 reducer 保持纯。每次异步操作：

```ts
const token = beginOperation(sessionId);
const raw = await camera.capture();
if (!isCurrent(token)) {
  await registry.delete(raw.path);
  return;
}
```

每个 await 后重复检查。controller 暴露 state、capabilities 与具名 commands；
Container 不再拼 `capturing && !recording` 等零散规则。

快门 command 在第一个 await 前快照 aspect / normalized quality / watermark /
actual camera position；旋转 viewport 或切换 reducer 当前值不能改变 in-flight 图片。

### Step 3：收敛 / 替换 `useCaptureFlow`

允许保留兼容文件名，但它必须成为 controller 的薄拍摄 command 层，不再自己维护一套
photos / preview / recording / capturing phase。移除 `capturingRef` 之外的重复 truth；
同步防重入可以保留在 command ref，phase 仍由 reducer 投影。

图片路径使用 Task 3 `processPhoto`。显式处理失败：

```ts
dispatch({ type: 'OPERATION_FAILED', operationId });
onError('照片处理失败,请重试');
```

不得 `setPhotos([...raw])`。

### Step 4：让 `useCamera` 持有 per-session registry

每个 SessionRecord 创建独立 registry 并作为 prop 传给 Container：

- 200：同步 mark transferred，resolve/close 后不删除。
- 200：同时同步 drain 未出现在 result 的 owned paths，随后异步删除。
- 非 200：同步 drain owned paths，resolve/close，再异步 best-effort unlink。
- supersede / unmount 同路径。
- Container cleanup 只能向自己 session 的 registry 注册 / 清理，不能 settle 新 session。
- record 同时持有绑定 sessionId 的 controller bridge；Modal `onRequestClose` 调
  `requestUserCancel()`，而 close / supersede / unmount 调 `forceTeardown()`。
- bridge 的 register / unregister 都比较 sessionId，旧 cleanup 不得清空新 bridge。

### Step 5：接线 Container / Camera

- `ActionRow`、SideRail、SideActions、Zoom、Focus 只消费 capability。
- Camera 的 `onConfigured` 捕获 render generation。
- `nativeConfigurationKey` 改变前进入 configuring；photo aspect、相同 quality 的
  single ↔ continuous 保持 ready / 零重配。
- 当前 mode 缺失不再作为正常 500 路径（open validator 已拦截）。
- `CustomPhotoFile.cameraType` 始终使用 selected device 的实际 position。

### Step 6：验证与提交

```sh
yarn test src/__tests__/camera/hooks/useCameraSessionController.test.ts src/__tests__/camera/hooks/useCaptureFlow.test.ts src/__tests__/camera/Container.test.tsx src/__tests__/camera/Container.burning.test.tsx src/__tests__/camera/Container.resultCodes.test.tsx src/__tests__/camera/Container.onError.test.tsx src/__tests__/useCamera.test.tsx --runInBand
yarn typecheck
yarn lint
git diff --check
git add src/camera/hooks/useCameraSessionController.ts src/__tests__/camera/hooks/useCameraSessionController.test.ts src/camera/hooks/useCaptureFlow.ts src/__tests__/camera/hooks/useCaptureFlow.test.ts src/camera/Container.tsx src/camera/Camera.tsx src/hooks/useCamera.tsx src/__tests__/camera/Container.test.tsx src/__tests__/camera/Container.burning.test.tsx src/__tests__/camera/Container.resultCodes.test.tsx src/__tests__/camera/Container.onError.test.tsx src/__tests__/useCamera.test.tsx
git commit -m "fix(camera): serialize capture session commands"
```

---

## Task 6：响应式 frame、设备 fallback 与 Watermark preview 集成

**Files:**

- Modify: `src/camera/Container.tsx`
- Modify: `src/camera/Camera.tsx`
- Modify: `src/camera/watermark/WatermarkStamp.tsx`
- Modify: `src/__tests__/camera/Camera.aspectTransition.test.tsx`
- Modify: `src/__tests__/camera/Container.test.tsx`
- Create: `src/__tests__/camera/Container.deviceFallback.test.tsx`
- Modify: `src/__tests__/camera/watermark/WatermarkStamp.test.tsx`

### Step 1：写布局 / fallback integration RED tests

- Container 固定调用 back 与 front 两个 device hook。
- requested back 缺失时使用 front，enableZoom / chip / cameraType 均按 front。
- fallback 后 flip disabled；两侧缺失才显示 404。
- root `onLayout` 的 portrait / landscape / split viewport 传出正确 frame rect。
- Camera 与 WatermarkStamp 接收同一个 rect。
- frame 动画同时含 width / height，不依赖 `useWindowDimensions()`。
- video aspect 重配等待新 onConfigured；photo aspect 不重配。
- single ↔ continuous 且 photo output 参数相同时不重配；quality 不同时才重配。

### Step 2：实现响应式 root layout

Container 保存真实 viewport，调用 `fitCameraFrame()`。初次还没有有效 layout 时保持
configuring / loading，不把零尺寸传给 native Camera。Camera 的 Animated frame：

```ts
const frameW = useSharedValue(frame.width);
const frameH = useSharedValue(frame.height);
useEffect(() => {
  frameW.value = withTiming(frame.width, { duration: 250 });
  frameH.value = withTiming(frame.height, { duration: 250 });
}, [frame.width, frame.height]);
```

worklet 内只读预算好的数字，不能调用 design `r()` / `rf()`。

### Step 3：设备双 lookup 与归一

固定调用：

```ts
const back = useCameraDevice('back', filter);
const front = useCameraDevice('front', filter);
const selection = selectCameraDevice(requestedPosition, back, front);
```

把 selection.activePosition 送入 reducer；所有前摄定焦 / 超广角 / flash / metadata
判断读取实际 selection，不读 requestedPosition。

### Step 4：验证与提交

```sh
yarn test src/__tests__/camera/Camera.aspectTransition.test.tsx src/__tests__/camera/Container.test.tsx src/__tests__/camera/Container.deviceFallback.test.tsx src/__tests__/camera/watermark/WatermarkStamp.test.tsx --runInBand
yarn typecheck
yarn lint
git diff --check
git add src/camera/Container.tsx src/camera/Camera.tsx src/camera/watermark/WatermarkStamp.tsx src/__tests__/camera/Camera.aspectTransition.test.tsx src/__tests__/camera/Container.test.tsx src/__tests__/camera/Container.deviceFallback.test.tsx src/__tests__/camera/watermark/WatermarkStamp.test.tsx
git commit -m "fix(camera): fit viewfinder to the modal viewport"
```

---

## Task 7：VideoPlayer、Focus 与 accessibility 一致性

**Files:**

- Modify: `src/components/VideoPlayer.tsx`
- Modify: `src/__tests__/components/VideoPlayer.test.tsx`
- Modify: `src/camera/Camera.tsx`
- Modify: `src/camera/FocusIndicator.tsx`
- Modify: `src/__tests__/camera/FocusIndicator.test.tsx`
- Modify: `src/camera/footer/Shutter.tsx`
- Modify: `src/camera/footer/ModeSwitcherPill.tsx`
- Modify: `src/camera/footer/ZoomChips.tsx`
- Modify: `src/camera/setup/SideRail.tsx`
- Modify: `src/camera/setup/SideActions.tsx`
- Modify: `src/camera/preview/PreviewBottomBar.tsx`
- Modify: `src/camera/ui/CameraDialogHost.tsx`
- Modify matching tests under `src/__tests__/camera/**`
- Modify: `jest.setup.ts`

### Step 1：写 RN Video event RED tests

Mock `useEvent`，驱动 `onPlaybackStateChange` / buffering / end / error：

- Press 后只调用 play / pause，不乐观翻 state。
- accessibility state 由 native event 更新。
- 外部 pause、播放结束、错误会同步 UI。
- uri 改变仍由 `useVideoPlayer` 生命周期处理。

### Step 2：写 Focus request identity RED tests

- 同一点连续 tap 产生两个递增 requestId，FocusIndicator remount。
- 旧 request 的 animation end 不清除新 request。
- `onAnimationEnd` callback identity 稳定，不因 render 重启动画。

### Step 3：写 accessibility RED tests

- shutter：拍照 / 开始录像 / 停止录像动态 label，role=button，
  `accessibilityState.disabled/busy` 来自 capability。
- Mode / Zoom：selected。
- flash / aspect / sound / flip / back / save / preview / delete / retake：
  role、中文 label、disabled。
- VideoPlayer：playing / busy。
- 顶部错误条：live region / alert。

### Step 4：实现

RN Video 使用官方 v7：

```ts
useEvent(player, 'onPlaybackStateChange', ({ state }) => {
  setPlaybackState(state);
});
```

以本地安装版本的事件类型为准，不猜字段。Focus state 为
`{ point, requestId }`；结束回调比较 ID。accessibilityState 与 capability 使用同一个
变量，不能复制判断逻辑。

### Step 5：验证与提交

```sh
yarn test src/__tests__/components/VideoPlayer.test.tsx src/__tests__/camera/FocusIndicator.test.tsx src/__tests__/camera/footer src/__tests__/camera/setup src/__tests__/camera/preview src/__tests__/camera/ui --runInBand
yarn typecheck
yarn lint
git diff --check
git add src/components/VideoPlayer.tsx src/__tests__/components/VideoPlayer.test.tsx src/camera/Camera.tsx src/camera/FocusIndicator.tsx src/__tests__/camera/FocusIndicator.test.tsx src/camera/footer src/camera/setup src/camera/preview/PreviewBottomBar.tsx src/camera/ui/CameraDialogHost.tsx src/__tests__/camera/footer src/__tests__/camera/setup src/__tests__/camera/preview src/__tests__/camera/ui jest.setup.ts
git commit -m "fix(camera): sync native UI state and accessibility"
```

---

## Task 8：RNGH / Worklets / example native 接入

**Files:**

- Modify: `src/camera/ModalView.tsx`
- Modify: `src/__tests__/camera/ModalView.test.tsx`
- Modify: `example/babel.config.js`
- Modify: `example/src/App.tsx`
- Modify: `example/package.json`
- Modify: `example/ios/ReactNativeCameraExample/Info.plist`
- Modify: `example/android/app/src/main/AndroidManifest.xml`
- Modify: `yarn.lock`
- Create: `src/__tests__/exampleConfig.test.ts`
- Modify if generated by install: `example/ios/Podfile.lock`

### Step 1：写静态 / 组件 RED tests

- Modal 内存在 `GestureHandlerRootView` 且 `style.flex === 1`。
- Modal `supportedOrientations` 明确为 portrait / landscape-left / landscape-right，
  不含 portrait-upside-down。
- example iPhone `UISupportedInterfaceOrientations` 允许左右横屏。
- example Babel plugins 包含 `react-native-worklets/plugin`。
- example App 根是 GestureHandlerRootView。
- example dependencies 显式包含
  `"@unif/react-native-camera": "workspace:*"`。
- example dependencies 包含与根 peer range 可满足的：
  `@shopify/react-native-skia`、`@dr.pogodin/react-native-fs`、
  `react-native-video`。
- example manifests 只把 Camera 视为拍照 / 录像必需、Microphone 视为录像必需；
  不为库本身保留无条件相册权限。

### Step 2：实现官方接入

- `GestureHandlerRootView` 放在 Modal 自己的 React Native root 内，包住 SafeArea /
  Theme / dialog subtree。
- Modal 显式开放三种 orientation；iOS 宿主 allowlist 同步开放左右横屏。Android 不新增
  orientation lock。
- example root 同样包裹。
- Worklets Babel plugin 按本地官方文档要求放到 plugins。
- 只用 `yarn` 更新 workspace lock。
- example 显式依赖 workspace camera，避免 Metro alias 掩盖 dependency metadata 漂移。
- 移除本库不需要的 Info.plist / Manifest 相册权限；如果 example 另有真实保存到相册
  功能才可保留并在代码 / 文档说明。
- 若依赖变化要求 Pods，运行 `bundle exec pod install`；失败时保留真实日志，不手工编辑
  Podfile.lock 伪造成功。

### Step 3：验证与提交

```sh
yarn test src/__tests__/camera/ModalView.test.tsx src/__tests__/exampleConfig.test.ts --runInBand
yarn typecheck
yarn lint
yarn install --immutable
git diff --check
git add src/camera/ModalView.tsx src/__tests__/camera/ModalView.test.tsx example/babel.config.js example/src/App.tsx example/package.json example/ios/ReactNativeCameraExample/Info.plist example/android/app/src/main/AndroidManifest.xml yarn.lock src/__tests__/exampleConfig.test.ts
git commit -m "fix(example): install camera native runtime peers"
```

仅当 `example/ios/Podfile.lock` 由真实成功的 pod install 更新时，显式加入该文件。

---

## Task 9：README、website、mock、llms 与 Turbo 门禁

**Files:**

- Modify: `README.md`
- Modify: `src/mock.ts`
- Modify: `src/utils/interface.ts`
- Modify: `website/src/pages/index.tsx`
- Modify relevant files under `website/docs/`
- Modify: `website/scripts/build-llms.js`
- Modify: `website/scripts/build-llms.test.js`
- Modify: `website/package.json`
- Modify: `turbo.json`
- Create: `scripts/check-turbo-inputs.js`
- Modify: `package.json`
- Modify generated: `website/static/llms.txt`
- Modify generated: `website/static/llms-full.txt`
- Modify generated pages under `website/static/md/`

### Step 1：先写文档 / llms / Turbo RED checks

扩充 `build-llms.test.js`：

```js
assert.strictEqual(
  b.formatIndexLine({ title: 'X', mdPath: 'md/x.md', description: null }),
  '- [X](md/x.md)'
);
assert(!generatedIndex.includes('](/md/'));
assert(generatedIndex.includes('(llms-full.txt)'));
```

新增 `scripts/check-turbo-inputs.js`：

- 调用或读取 `yarn turbo run build:android --dry=json` 与 iOS dry JSON。
- 断言 input hash 列表含 `src/camera/hooks/useCaptureFlow.ts`（或当前等价嵌套源码）。
- 断言含 `example/babel.config.js`。
- 不含 Pods / build / Gradle cache。

网站 build 前用 TypeScript / MDX build 暴露 homepage 的不存在 API；testing 示例通过
可编译 snippet 或明确静态断言保护 `renderHook` 与完整 file shape。

### Step 2：修正文档事实

全仓搜索并修正：

```sh
rg -n "burst|maxDuration|useCamera\\([^)]|返回原图|绝不阻断|/md/|quality.*降级|NSPhotoLibrary|READ_MEDIA" README.md website src/mock.ts src/utils/interface.ts
```

文档必须写清：

- `useCamera()` 无参并渲染 holder。
- `continuous`、`recTime`、`watermark: {content, position}`。
- 只有 code 200 成功。
- runtime invalid config 返回 500，但不替换 active session。
- front/back 自动 fallback。
- 显式 16:9 / 水印处理失败留在 session 重试，不交付错误 raw。
- 返回文件是临时文件；200 后所有权转消费者，长期使用应复制。
- Worklets plugin、Modal Gesture root、native peers、pod install。
- 相机只需 CAMERA / microphone（录像）权限；不把本库未做的系统相册写入权限描述成
  无条件必需。
- `speed` 才受 speed capability 降级，quality / balanced 直传。

Jest 示例：

```ts
const { result } = renderHook(() => useCamera());
const [api] = result.current;
api.open.mockResolvedValueOnce({
  code: 200,
  data: [{
    id: '1',
    cameraType: 'back',
    cameraMode: 'single',
    path: '/tmp/photo.jpg',
    uri: 'file:///tmp/photo.jpg',
    width: 1080,
    height: 1920,
    mime: 'image/jpeg',
    mode: 'single',
    isRemake: false,
  }],
  message: 'ok',
});
```

### Step 3：修 llms 与 website check

llms index 使用相对 `md/...`；正文入口使用 `llms-full.txt`。在
`website/package.json` 增加单一 check script：

```json
"check": "yarn typecheck && node scripts/build-llms.test.js && yarn build"
```

运行 `build:llms` 并提交生成物。

### Step 4：修 Turbo inputs

使用 `$TURBO_DEFAULT$` 与 `$TURBO_ROOT$` 语义纳入根嵌套 source、package / lock /
tsconfig / native config，平台输出和 cache 继续排除。把检查 script 暴露成根 script，
不依赖易变的 dry-run task 顺序。

### Step 5：验证与提交

```sh
node website/scripts/build-llms.test.js
yarn workspace @unif/react-native-camera-website build:llms
yarn workspace @unif/react-native-camera-website typecheck
yarn workspace @unif/react-native-camera-website build
yarn turbo run build:android --dry=json
yarn turbo run build:ios --dry=json
node scripts/check-turbo-inputs.js
yarn typecheck
yarn lint
git diff --check
git add README.md src/mock.ts src/utils/interface.ts website turbo.json scripts/check-turbo-inputs.js package.json
git commit -m "docs(camera): synchronize runtime integration guidance"
```

创建提交前用 `git status --short` 核对并行会话文件；不要暂存其未提交改动。

---

## Task 10：同步消费侧 `/Users/liulijun/tongyi/design/skills/skills/camera`

**Repository:** `/Users/liulijun/tongyi/design/skills`

**Files:**

- Modify: `skills/camera/SKILL.md`
- Modify: `skills/camera/assets/PhotoScreen.tsx`
- Modify: `skills/camera/references/native-setup.md`
- Modify: `skills/camera/references/peerdeps.md`
- Modify: `skills/camera/references/troubleshooting.md`
- Modify: `skills/camera/scripts/doctor.sh`
- Modify: `skills/camera/scripts/doctor.test.sh`
- Modify any repository index / marketplace metadata required by that repository

### Step 1：遵守 Skills 仓规则并建分支

```sh
cd /Users/liulijun/tongyi/design/skills
git status --short --branch
```

完整读取该仓 `AGENTS.md` 和 camera `SKILL.md`。若在 main，创建
`fix/camera-state-machine-reliability`；不覆盖既有改动。该目录在当前 writable root
之外，使用正常权限升级，不得声称不可验证的写入已经完成。

### Step 2：按 writing-skills 做 RED baseline

用同一个消费者场景测试修改前后：

> “在 RN 0.85 新架构 App 中接入 `@unif/react-native-camera`，需要 16:9 水印、
> 录像、Jest mock，并说明取消/处理失败/临时文件行为；列出 Babel、Gesture、native
> peers 与权限配置。”

记录当前 Skill 漏掉或答错：

- Worklets plugin / Android Modal Gesture root。
- iPhone 宿主横屏 allowlist。
- processing failure 不应交付 raw。
- 临时文件 transfer / 长期复制。
- runtime validation / fallback。
- 当前 peer ranges 与 permission 最小集。

先给 `doctor.test.sh` 添加缺 plugin / peer / permission fixture，运行并确认 RED。

### Step 3：同步 Skill 内容与版本

- 将 skill version 从 0.2.2 提升到 0.3.0，并同步仓库要求的 metadata。
- 保持公共调用面不变。
- asset 展示 holder、code===200、完整 file、长期复制责任。
- native setup 写 Babel、Gesture、Pods、iPhone 横屏 allowlist和最小权限。
- peers 以 camera `package.json#peerDependencies` 为准，并保留 RNGH3 /
  Carousel5 的既有窄例外，不用 force / legacy-peer-deps。
- troubleshooting 写非法 config、处理失败可重试、录像 callback / mic、临时文件。
- doctor 检查 dependency、version、plugin、横屏 allowlist、权限与 Pods；fixture 不依赖
  开发机全局状态。

### Step 4：同场景 GREEN 与仓库校验

```sh
python3 scripts/quick_validate.py skills/camera
python3 scripts/validate_repository.py
python3 scripts/validate_portal_consistency.py
bash skills/camera/scripts/doctor.test.sh
```

再跑 Step 2 同一消费者场景，确认答案不再依赖仓库内部实现猜测。

### Step 5：提交、PR、CI、合并与清理 Skills 分支

```sh
git diff --check
git add skills/camera
git commit -m "feat(camera): update reliability integration skill"
git push -u origin fix/camera-state-machine-reliability
```

使用 `gh pr create`，等待 Skills 仓 CI 通过后合并。随后：

```sh
git switch main
git pull --ff-only
git branch -d fix/camera-state-machine-reliability
```

只有确认远端分支仍存在且 PR 已合并后才删除远端任务分支。

---

## Task 11：全量回归、最终 subagent 审查、主仓 PR/CI/合并

**Files:** 不预设生产改动；只修 reviewer 或验证真实发现的问题。不得用“放宽测试”绕过。

### Step 1：确认并行会话成果

```sh
git status --short --branch
git log --oneline --decorate --max-count=20
git diff origin/main...HEAD -- AGENTS.md CLAUDE.md .github
```

核对：

- `CLAUDE.md` 只保留指向 `AGENTS.md` 的一行引用。
- `AGENTS.md` 保留仓库特有规则、精确 `../skills/skills/camera/`，且不再声称图片处理
  失败返回 raw。
- CI template / repo workflow 的 website filter / check 已按并行会话落地且无 drift。
- 没有覆盖或遗漏并行会话提交。

若并行会话仍有未提交工作，先等待它完成；不要替它 `git add` 未归属文件。

### Step 2：运行完整自动化验证

```sh
yarn install --immutable
yarn test --maxWorkers=2
yarn typecheck
yarn lint
yarn prepare
node website/scripts/build-llms.test.js
yarn workspace @unif/react-native-camera-website typecheck
yarn workspace @unif/react-native-camera-website build
yarn turbo run build:android --dry=json
yarn turbo run build:ios --dry=json
node scripts/check-turbo-inputs.js
git diff --check
```

环境允许时：

```sh
yarn example build:android
yarn example build:ios
```

native build 不能替代真机相机 / GPU 验收；未执行项必须单列。

### Step 3：最终独立 code review

生成 `origin/main...HEAD` review package，至少让两个独立 reviewer 分别检查：

1. session / recorder / file ownership 的竞态、late callback 与 exactly-once。
2. Skia / UI / native config / docs / Skill / Turbo / CI 的一致性与泄漏。

所有 Critical / Important 必须先写回归测试再修；Minor 逐项判断并记录。

### Step 4：主仓提交整理与 PR

确认所有任务使用 conventional commits、没有手改版本/tag/release。推送：

```sh
git push -u origin fix/camera-state-machine-reliability
gh pr create --fill
gh pr checks --watch
```

PR 描述必须包含：

- public API / params / result shape 未变。
- 用户批准的 processing failure 行为修正。
- website / llms / exact Camera Skill path 同步。
- 测试命令与真机未覆盖项。
- RNGH3 / Carousel5 只沿用既有窄例外。

### Step 5：CI 全绿后合并、回 main 验证与清理

按仓库既有 merge 策略通过 `gh pr merge` 合并，不直接 push main。然后：

```sh
git switch main
git pull --ff-only
git log --oneline --decorate --max-count=8
```

确认 main 含 PR merge / squash commit、关键测试仍通过，再删除本地任务分支；PR 未自动
删除远端分支时，确认 merge 后删除精确 remote branch。自动 release workflow 由 merge
触发，不手工改版本、tag 或 `npm publish`。

---

## 最终完成定义

- 所有公开 TypeScript API、open / close 参数、result code 与 file shape 不变。
- active session 不被旧 cleanup / invalid new open / late callback 误 settle。
- capture / processing / recording / configuring 的 capability 只有一个 truth。
- 每次录像一个 Recorder，所有 Promise/callback 顺序恰好一次完成。
- 16:9 + watermark 一次 decode/encode，失败不交付错误 raw。
- 所有临时文件在 delete/retake/cancel/supersede/unmount/late callback 路径回收；
  code 200 前显式 transfer。
- 横竖屏 / split frame 几何正确；Skia preview 与成片共享 Paragraph layout。
- Worklets、Gesture Modal root、example peers、Video event、Focus、a11y 全部有测试。
- iPhone Modal 与 example 宿主横屏 allowlist 一致；Camera / 录像 Microphone / 可选相册
  权限边界在 manifests、docs 与 doctor 中一致。
- README、website、llms、Turbo、AGENTS/CLAUDE/CI 并行成果和
  `/Users/liulijun/tongyi/design/skills/skills/camera/` 已核对。
- 主仓与 Skills 仓 PR CI 通过并合并；两仓回到最新 main；旧任务分支已清理。
- 未完成的真机项目如实列出，不能以 Jest / build 冒充真机验证。
