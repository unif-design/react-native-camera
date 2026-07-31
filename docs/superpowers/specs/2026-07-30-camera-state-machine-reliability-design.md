# 相机会话状态机与可靠性修复设计

- 日期:2026-07-30
- 状态:已与用户逐节确认并通过独立终审,进入实施
- 基线:`main` / `v3.0.0` / `27f92da`
- 核心约束:`useCamera()`、`api.open(config)`、`api.close()`、`CameraResult` 与
  `CustomPhotoFile` 的公开形状保持不变

## 背景

`v3.0.0` 已完成 VisionCamera 5、RNGH 3、Reanimated 4.5、Worklets 0.11 与
 Carousel 5 的版本升级,并修复 Carousel 删除 / 滑动使用 stale index 的竞态。上述已解决
 项不在本设计中重做。

升级后的代码仍存在一组相互关联的问题:

1. 二次 `open()` 时,旧 Container 的卸载回调可能兑现或关闭新会话。
2. 拍照、图片处理、录像启动 / 停止期间,返回、翻转、切画幅等入口没有统一守卫。
3. Recorder 预热失败会破坏已经开始的录像,且缓存 Recorder 可能跨配置复用。
4. 手动停止、自动结束和 error callback 使用不同路径,会丢状态或缺失 duration。
5. 取景框和裁切算法只按竖屏设计,横屏 / iPad 分屏会溢出或裁错。
6. 水印预览与烧录的宽度、行距和文字引擎不一致。
7. 裁切与水印分两次解码、两次 JPEG 编码,并写死 quality 92。
8. 原始、裁切和水印临时文件没有明确所有权与回收规则。
9. Focus 动画、VideoPlayer 状态、设备翻转、accessibility 存在独立一致性问题。
10. example、网站、mock 文档、llms 链接、Turbo inputs 与消费侧 Camera Skill 已漂移。

这些问题共享同一根因:会话生命周期、拍摄事务与资源所有权分散在多个 hook、ref 和
 callback 中。因此采用已确认的“方式 2”:在不改变公开 API 的前提下,建立内部统一状态机。

## 目标

- 每个 `open()` 都是隔离、exactly-once settle 的 session。
- 所有 UI 与程序入口遵循同一套状态迁移和 capability。
- Recorder 每次录像新建,所有完成 / 失败 / 取消路径统一收口。
- 照片裁切与水印形成单次、原子、可回收的处理事务。
- 横屏、竖屏、iPad 分屏下,取景、水印预览与最终成片几何一致。
- 修正文档、example、测试、llms、Turbo 与 `skills/camera` 的消费侧说明。
- 自动化验证覆盖纯逻辑与 native 边界;真机能力明确保留人工验收项。

## 非目标

- 不增加或删除公开 API、类型字段、result code。
- 不为视频新增拍后裁切或水印。
- 不启用 VisionCamera persistent recorder。
- 不修改 npm 版本、不发布 npm、不创建 tag。
- 不重新处理 v3 已修复的 Carousel stable-index 问题。
- 本设计不主动重写 `AGENTS.md`、`CLAUDE.md` 或通用文档模板;这些由另一会话负责。
  最终合并门禁仍须确认并行会话的成品已准确描述本次行为。
- 本设计不直接修改共享 CI 模板或本仓由模板同步生成的 CI 副本;并行会话会在同一
  分支完成该项,最终 PR 一并验证。

## 官方依据

- VisionCamera Recorder 是单次使用对象;每次录像创建新实例。
- `startRecording()` 在录像成功启动后 resolve。
- `stopRecording()` 只请求停止;文件必须以 `onRecordingFinished` 为最终完成信号。
- `maxDuration` / `maxFileSize` 也通过同一完成 callback 返回 reason。
- `cancelRecording()` 删除当前文件并清理录制状态。
- `recordedDuration` 在 Recorder 不再 recording 后会返回 0,因此停止前必须缓存。
- Photo 对象保存到临时文件后必须 `dispose()`;现有 `captureToTempFile()` 已遵守。
- VisionCamera 通过 preview transform 与照片 / 视频 metadata 表达方向。React Native
  Skia 的 `MakeImageFromEncoded` 进入 Skia `DeferredFromEncodedData` /
  `SkCodecImageGenerator`,后者会按 encoded origin 交换尺寸并调用
  `SkPixmapUtils::Orient`;内部图片处理不应再手工套 EXIF 矩阵,否则会双重旋转。
- RN Community CLI 项目必须在 Babel 中加入 `react-native-worklets/plugin`。
- Android Modal 内容需要自己的 `GestureHandlerRootView`。
- React Native Video v7 推荐用 `useEvent()` 监听真实播放状态。
- Skia encoded image、offscreen surface 与 Paragraph 能满足单次裁切 + 水印流水线。

参考链接见文末。

## 公共契约冻结与已批准行为调整

以下签名和字段保持不变:

```ts
function useCamera(): [CameraApi, React.ReactElement];

type CameraApi = {
  open(config: OpenConfig): Promise<CameraResult>;
  close(): void;
};

type CameraResult = {
  code: 0 | 200 | 403 | 404 | 500 | 503;
  data: CustomPhotoFile[];
  message: string;
};
```

`CustomPhotoFile` 的 `id`、`cameraType`、`cameraMode`、`path`、`uri`、`width`、
`height`、`mime`、`mode`、`isRemake`、`duration` 均不变。

行为约定:

- `200`:唯一成功码,最终文件所有权转交消费者。
- `0`:取消、关闭、session 被下一次 `open()` 替换。
- `403`:相机权限被拒。
- `404`:front 与 back 都没有可用设备。
- `500`:`OpenConfig` 运行时校验失败。
- `503`:为兼容保留,不删除;普通拍照 / 录像运行时错误仍留在相机内提示并允许重试。

这里冻结的是公开签名、字段、result code 和打开 / 返回参数。用户已明确批准一项行为
修正:当显式请求 16:9 裁切或水印时,处理失败不再静默返回不符合请求的 raw 照片,而是
留在当前 session 提示重试。它是本次唯一主动调整的兼容行为,必须同步网站、llms、
`skills/camera` 以及并行会话维护的仓库说明。

## 总体架构

内部拆成三个协作层:

```text
useCamera / SessionCoordinator
          │ sessionId + exactly-once settle
          ▼
CameraSessionController
          │ reducer + commands + capabilities + operation token
          ▼
Native adapters
          ├─ VisionCamera photo output
          ├─ VisionCamera Recorder
          ├─ Skia image pipeline
          └─ RNFS file ownership
```

SessionCoordinator 只管理跨 session 生命周期。CameraSessionController 管理一个 session
内部的交互和拍摄事务。Native adapters 不直接决定 UI 状态,只返回事件。

## SessionCoordinator

### Session 记录

每次有效 `open()` 创建:

```ts
type SessionRecord = {
  id: number;
  config: ValidatedOpenConfig;
  status: 'active' | 'settling' | 'settled';
  resolve: (result: CameraResult) => void;
  resources: SessionResources;
};

type SessionResources = {
  files: FileRegistry;
  controller: SessionControllerBridge | null;
};
```

React holder、Modal close callback、Container、native callback 全部绑定创建时的
`sessionId`,不读取“当前 resolver”作为身份。`SessionResources` 在 Container 卸载后
仍由 record / 旧 callback 闭包持有,所以 stale callback 能清理旧 session 自己的资源,
不会误用新 session registry。

### `open()` 顺序

1. 对新 config 做纯函数校验,并深拷贝为 session-owned normalized snapshot
   (`cameraMode[]`、mode 对象、watermark 与 `content[]` 均不共享消费者引用)。
2. 校验失败时直接 resolve 现有 `500 / invalid_config`,不影响当前有效 session。
3. 分配单调递增的 session ID。
4. 若已有 active session,先以现有 `cancelledResult()` exactly-once settle 旧 Promise。
5. 安装新 session 并渲染新 Container。
6. 旧 Container 的卸载与晚到 callback 只能清理旧资源;`finish(oldId, ...)` 因 ID
   不匹配而 no-op。

### `finish(sessionId, result)`

`finish()` 同时检查 ID 和 status:

- 只有 active 且 ID 匹配的 session 可以进入 `settling`。
- resolver 只取出和调用一次,状态与 UI 关闭不等待文件 I/O。
- `200` 先把 `result.data` 中的最终文件标为 transferred,同步 drain 其余 owned paths,
  再关闭 holder;未返回的 raw / intermediate / abandoned final 仍异步清理。
- 其他结果先从 session 状态中摘除 owned paths 并关闭 holder,再异步 best-effort 清理;
  清理失败只记录告警,不能阻塞 settle 或重新打开。
- 重复保存、Modal close、旧 callback、Strict Mode cleanup 均不能二次 resolve。

`api.close()` 对当前 session 执行强制取消。Hook 卸载也会取消 active Recorder、清理
owned files 并兑现未完成 Promise,但不在卸载后 setState。

### 取消命令桥

Container mount 后用 session ID 注册 `SessionControllerBridge`:

```ts
type SessionControllerBridge = {
  requestUserCancel(): void;
  forceTeardown(): void;
};
```

- Modal `onRequestClose`（Android hardware back）只调用当前 session 的
  `requestUserCancel()`:瞬态 photo / video phase 忽略,recording 先确认再 cancel,
  ready / previewing 走普通用户取消。
- `api.close()`、第二次 open supersede 与 hook unmount 调用 `forceTeardown()`,
  不询问、不受 UI capability 限制;bridge 尚未注册时仍可直接 settle，并由
  SessionResources 清理。
- bridge 注册、替换与卸载都校验 session ID；旧 Container 不能覆盖或清空新 bridge。

## CameraSessionController 状态机

### 状态

```text
configuring
    │ onConfigured
    ▼
ready
    ├─ capture photo ─→ capturingPhoto ─→ processingPhoto ─→ ready / previewing
    ├─ start video ───→ startingVideo ───→ recording
    │                                         │ stop / auto-finish
    │                                         ▼
    │                                    stoppingVideo ─→ ready
    └─ open gallery ────────────────────────────────→ previewing ─→ ready

任意有效状态 ─→ settling ─→ closed
```

Reducer context 同时保存:

- `files`
- `modeIndex`
- `aspectRatio`
- `activePosition`（实际选中的 device position,不是仅保存用户请求值）
- `flash`
- `sound`
- preview variant / index
- 当前 operation ID
- `configurationGeneration`
- Recorder 的 UI 投影(duration、reason)

Zoom SharedValue 继续留在 UI runtime,避免 pinch 每帧触发 reducer。Focus 动画对象也可单独
保存,但创建 focus command 前必须通过当前 capability。

### Capability selector

所有控件只读统一 selector,不再自行拼接多个 boolean:

| phase | capture | flip / mode / aspect | save / gallery | zoom / focus | 用户取消 |
| --- | --- | --- | --- | --- | --- |
| `configuring` | 否 | 否 | 否 | 否 | 是 |
| `ready` | 是 | 是 | 按 files | 是 | 是 |
| `capturingPhoto` | 否 | 否 | 否 | 否 | 否 |
| `processingPhoto` | 否 | 否 | 否 | 否 | 否 |
| `startingVideo` | 否 | 否 | 否 | 否 | 否 |
| `recording` | 是,含义为停止 | 否 | 否 | 是 | 确认后取消录像 |
| `stoppingVideo` | 否 | 否 | 否 | 否 | 否 |
| `previewing` | 否 | 否 | 是 | 否 | 是 |
| `settling / closed` | 否 | 否 | 否 | 否 | 否 |

Android hardware back 视为用户取消:在照片 / 视频瞬态处理中忽略并保持 busy;录像中先确认后
`cancelRecording()`。`api.close()` 与第二次 `open()` 是强制取消,不受 UI capability
限制。

`nativeConfigurationKey` 只由真实 native session identity 组成:实际 device ID /
position、挂载 output kind、当前 output 的 resolution / quality / bitrate 等语义参数、
constraints。动作前后 key 不同时才递增 `configurationGeneration` 并进入
`configuring`;只有携带最新 generation 的 `onConfigured(generation)` 才能回到
`ready`,旧 Camera 晚到 callback 必须忽略。

photo 模式的 aspect 只改变 frame + 拍后裁切,不进入 key。`single ↔ continuous` 在
photo output 参数相同（例如 quality 相同）时也不进入 key,同步保持 `ready`;如果 quality
不同则 output identity 改变并等待 configure。这样 UI-only 变化不会等待一个永远不来的
native callback,而 device、photo ↔ video、video aspect / bitrate、HDR / quality
constraints 等真实重配仍有 generation 门禁。

### Operation token

每项异步事务分配 `{sessionId, operationId}`。每个 await 和 native callback 返回后都验证
token:

- token 当前:允许 dispatch 下一事件。
- token 过期:不得更新 UI或 files,只清理这次操作生成的资源。

这同时覆盖二次 open、close、组件卸载、设备重配与晚到 Recorder callback。

## Recorder 设计

### 单次生命周期

```text
request microphone
      ↓ granted
createRecorder(settings)
      ↓
startRecording(callbacks)
      ↓ resolved
recording
      ↓ stop / max-duration / error / cancel
finalize exactly once
      ↓
dispose
```

- 每次 start 都创建新 Recorder;删除 `preparedRecorderRef` 和 post-start prewarm。
- settings 从当前 video mode、aspect ratio 和 bitrate 现算,不会跨配置复用。
- persistent recorder 保持关闭,设备切换时不保留 Recorder。
- 通常在 `startRecording()` resolve 后 dispatch `RECORDING_STARTED`;但 native finish /
  error callback 允许在该 Promise continuation 之前到达。统一 finalizer 可从
  `startingVideo`、`recording`、`stoppingVideo` 任一阶段收口,并使 start continuation
  token 失效,禁止 callback 已结束后又回写 `recording`。
- create / start 失败时 dispose 当前 Recorder,回到 `ready`,显示非阻塞错误。

每个 Recorder 自己持有 `pending | finalized | cancelled`，而不是只依赖 React phase。
finish / error、start resolve / reject、stop resolve / reject 与 cancel 任意竞争时，
第一个合法终态原子占有 finalizer；后续 continuation 只做幂等资源收尾。Recorder
dispose、文件 commit / cleanup 与 UI transition 各自恰好一次。

### 停止与完成

- 手动停止先缓存一次 `recordedDuration`,再调用 `stopRecording()`。
- `stopRecording()` resolve 只代表停止请求已提交,仍等待 `onRecordingFinished`。
- 手动停止、`max-duration-reached`、`max-file-size-reached` 共用一个 finalizer。
- `onRecordingFinished` 早于 `stopRecording()` Promise resolve 也合法;晚到的 stop
  continuation 只能完成自身清理,不得覆盖 finalizer 已提交的状态。
- error callback 也进入同一 finalizer,但不生成 file;回到 `ready` 并保留此前 files。
- 停止请求本身抛错时,尝试 `cancelRecording()` 防止 orphan recording,然后统一报错。
- session 取消 / supersede / unmount 调用 `cancelRecording()`,未完成视频不加入结果。

### Duration

Recorder 处于 recording 时定期缓存 native `recordedDuration`,并保留 monotonic start time:

- UI `recSeconds` 从缓存 duration 派生。
- 手动停止使用“停止前 native 值”和 monotonic fallback 中可信值。
- 自动 max-duration 结束至少保留已配置的上限语义。
- callback 后不再读取会归零的 `recordedDuration`。

### 麦克风权限

video start 前读取 / 请求麦克风权限。拒绝时不创建 Recorder、不进入假录制态,停在 `ready`
并提示“麦克风权限未开启”。

## 响应式取景与方向

### Frame rect

以 Modal 根节点 `onLayout` 的真实 viewport 为单一尺寸源,而不是只读 window width。

设目标长宽比 `R` 为 `4 / 3` 或 `16 / 9`:

- viewport 横向时目标 `width / height = R`。
- viewport 纵向时目标 `width / height = 1 / R`。
- 在 viewport 内做 contain fit,得到 `{width, height}`。

Camera frame、定格图、水印 Canvas 共用同一 frame rect。切画幅时同时动画 width 和
height:竖屏通常保持宽度,横屏通常保持高度。iPad 分屏和旋转后由 root layout 自动重算。

为了让横屏布局在 iPhone Modal 上真实可达，`Modal` 显式声明
`supportedOrientations={['portrait', 'landscape-left', 'landscape-right']}`；本次不启用
`portrait-upside-down`。这不会绕过宿主的 iOS orientation allowlist，因此 example 的
`UISupportedInterfaceOrientations` 同步加入左右横屏，README、website 与 Camera Skill
明确消费者若要横屏也必须在宿主 Info.plist 开放。Android 不新增 orientation lock，
继续跟随宿主 Activity。

VisionCamera 保持默认 device orientation source。处理层以 Skia decode 后的 width /
height 为事实来源,不再额外套 EXIF 旋转矩阵,避免双重旋转。实现时加入带 EXIF orientation
6 与 mirrored orientation 的 fixture 验证 decode 后尺寸 / 像素朝向;若 Jest 环境无法
加载 native Skia,则保留纯几何测试并将该 fixture 纳入真机 smoke test,不能用未经验证的
手工 transform 代替。

### 设备选择

固定调用两个 hook 获取 front 和 back:

- 首选 `cameraMode[0].type ?? 'back'`。
- 首选缺失而另一侧存在时自动 fallback。
- fallback 后立即以 `selectedDevice.position` 规范化 reducer 的 `activePosition`;后续
  flip 的来源必须是这个实际值,不能继续沿用缺失的 requested position。
- 两侧都不存在才进入 `404`。
- flip capability 只有在目标侧存在时为 true。
- 切换后进入 `configuring`,等待新 Camera 的 `onConfigured` 才回到 `ready`。
- `CustomPhotoFile.cameraType` 使用实际拍摄 device position。

## 单次图片处理事务

### Pipeline

现有 `cropToRatio()` 与 `burnWatermark()` 合并为一个内部 processor:

```text
Skia.Data.fromURI(raw.uri)
        ↓
MakeImageFromEncoded
        ↓
计算 source rect + final size
        ↓
一个 offscreen surface:
  drawImageRect → paint watermark paragraph
        ↓
makeImageSnapshot
        ↓
JPEG encode(currentMode.quality)
        ↓
write unique temporary path
```

- 不需要裁切且没有有效水印 content 时直接使用原 JPEG,不重编码。
- 需要任一处理时只解码、绘制、编码一次。
- JPEG quality 为 `round(clamp(currentMode.quality ?? 0.9, 0, 1) * 100)`;
  VisionCamera photo output 继续接收同一 normalized quality。
- 输出 path 以 session ID + capture ID 唯一化。
- 成功后更新实际 `width` / `height`,其他公开字段不变。
- video 文件不进入此 pipeline。

### 通用居中裁切

以 decode 后 `sourceWidth / sourceHeight` 和当前方向目标比计算:

- operation 在快门触发时快照 aspect / quality / watermark / actual camera position,
  processor 不读取 await 之后的 viewport 或 reducer 当前值。
- 令 `R` 为用户选择的横向比例（4:3 → `4/3`,16:9 → `16/9`）,
  `targetWH = decodedWidth >= decodedHeight ? R : 1 / R`。
- source 比目标更宽:保持高度,居中裁宽。
- source 比目标更窄:保持宽度,居中裁高。
- 比例已匹配:source rect 使用整图。

同一公式覆盖横 / 竖的 4:3 与 16:9,不再硬编码 portrait `9 / 16`。

### 原子失败

如果请求了 16:9 或水印而 processor 失败:

- 不把未裁切 / 未加水印的原图静默加入 files。
- 清理本次未提交产物。
- 保留 session 与此前 files。
- dispatch 回 `ready` 并显示“照片处理失败,请重试”。

## 水印 WYSIWYG

`computeWatermarkLayout(width, height, watermark)` 返回完整几何:

- `fontSize`
- `lineHeight` / `lineGap`
- `padding`
- `paragraphWidth`
- `x` / `y`
- `textAlign`
- top / bottom anchor
- shadow 与首行字重

尺寸以画面短边为缩放基准,paragraph 最大宽度统一为画面宽度的 70%。preview 与 burn
都使用 Skia Paragraph:

- 相同系统字体 fallback。
- 相同换行与 height multiplier。
- 相同六种 position。
- 相同 title semibold、正文 normal 和阴影。

preview 在 frame rect 上绘制透明 Skia Canvas;burn 在最终像素 surface 上按等比例参数
绘制。ParagraphBuilder、Paragraph、Paint、snapshot、surface、image、data 均在
finally / effect cleanup 中按依赖逆序 dispose。

## 文件所有权

每个 session 持有独立 registry:

```ts
type OwnedFileState = 'owned' | 'transferred' | 'deleted';
```

### 注册与转移

- VisionCamera 保存 raw temp 后立即登记为 owned。
- Recorder finish callback 返回 path 后，在检查 operation token / commit UI 前立即登记到
  产生它的旧 session registry；stale callback 随后从该 registry 删除。
- processor 成功写完 final 后先登记 final,撤掉 raw freeze 引用,再 best-effort 删除 raw。
- processor 失败时清理失败产物与 raw。
- `code: 200` settle 前把结果中的 final paths 标为 transferred，并 drain 未出现在
  `result.data` 的其他 owned path。
- transferred 文件不再由库删除;消费者如需长期保存应复制到持久目录。

### 清理触发点

- 删除单张。
- 重拍。
- `dataRetainedMode: 'clear'` 下确认切模式。
- 用户取消。
- `api.close()`。
- 第二次 `open()` 替换 session。
- Hook / Container 卸载。
- 过期 operation 晚到并生成文件。

只删除 registry 内由本库创建的 path。`RNFS.unlink(path)` 按项 catch,不先
`exists()` 制造 TOCTOU 竞态。清理失败只告警,不改 CameraResult。

## 运行时配置校验

在 `open()` 边界用纯函数校验,不修改输入对象，并返回深拷贝的 normalized snapshot:

- `cameraMode`:非空数组。
- `mode`:`single | continuous | video`。
- 可选 `type`:`back | front`。
- 可选 `flashMode`:`auto | on | off`。
- 可选 `quality`:finite 且 `0 <= value <= 1`。
- 可选 `recTime`:finite 且 `> 0`。
- `dataRetainedMode`:`clear | retain`。
- 可选 watermark:对象;`content` 是 string 数组;position 是六个已公开值之一。空数组
  合法并视为无水印处理,避免新增不必要限制。
- 可选 `photoQualityPrioritization`:三个已公开值。
- 可选 `photoHDR`:boolean。
- 可选 `videoBitRate`:finite 且 `> 0`。

失败统一返回 `{code: 500, data: [], message: 'invalid_config'}`。开发日志可带具体字段,
但稳定 message 不暴露内部校验文本。消费者在 `open()` 返回后修改原 config、
`cameraMode[]` 或 `watermark.content[]`，不得改变已经打开的 session。

## 其他 UI 一致性

### VideoPlayer

- 使用 RN Video v7 `useEvent(player, 'onPlaybackStateChange', ...)`。
- `isPlaying`、`isBuffering` 以原生 event 为真值,移除乐观 toggle state。
- 播放结束、外部 pause、错误和 App 生命周期变化后,按钮状态自动同步。
- `useVideoPlayer()` 继续负责 uri 变化与 unmount cleanup。

### Focus

focus state 改为 `{point, requestId}`。每次 tap 都递增 requestId并作为动画实例 identity:

- 连续点击同一点也会重启动画。
- `onAnimationEnd` 使用稳定 callback。
- 只有结束 ID 等于当前 requestId 时才清除,旧动画不能清掉新 focus。

### Accessibility

- Shutter label 随 phase 为“拍照 / 开始录像 / 停止录像”。
- Mode 与 Zoom 暴露 selected。
- SideRail、SideActions、VideoPlayer 补 role、label、disabled / busy。
- 错误提示使用 live region。
- capability 与 accessibilityState 共用同一来源,不另写一套禁用逻辑。

## Native 与 example 接入

- `example/babel.config.js` 加 `react-native-worklets/plugin`。
- Camera Modal 内层加 `GestureHandlerRootView style={{flex: 1}}`,覆盖 Android Modal
  独立 root。
- Camera Modal 显式支持 portrait / landscape-left / landscape-right；example iPhone
  `UISupportedInterfaceOrientations` 同步允许左右横屏。
- example App 根同样按官方推荐包裹 GestureHandlerRootView。
- example package 补齐:
  - `@unif/react-native-camera: workspace:*`
  - `@shopify/react-native-skia`
  - `@dr.pogodin/react-native-fs`
  - `react-native-video`
- 更新 yarn lock;原生依赖安装说明提示重新运行 Pods。
- 权限最小集按实际能力写清:Camera 为拍照 / 录像必需，Microphone 仅录像必需；本库只
  返回临时文件，不自行写系统相册，因此相册权限只在消费者另行保存到相册时按其流程配置，
  不再列为本库无条件要求。example manifests 与 doctor 使用同一规则。

## 文档与 llms

同步 README、website docs、首页和 `src/mock.ts` 注释:

- `useCamera()` 无参并渲染 holder。
- 连拍使用 `continuous`,不使用不存在的 `burst`。
- watermark 使用 `{content, position}`。
- 录像时长字段为 `recTime`,不使用不存在的 `maxDuration`。
- Jest 示例使用 `renderHook()`,不在普通 test body 直接调用 Hook。
- 成功 mock file 补齐 `isRemake` 等必填字段。
- 写清临时文件转移和长期保存责任。
- 写清 runtime validation、device fallback、processing failure、Babel plugin 与
  Gesture root。
- 写清横屏需要 Modal 支持之外，宿主 Info.plist 也允许对应 orientation。
- 写清 Camera / Microphone / 可选相册权限的最小边界。

`website/scripts/build-llms.js` 生成的索引链接改为相对 `md/...`,全文链接改为相对
`llms-full.txt`,避免忽略 Docusaurus `/react-native-camera/` baseUrl。测试先断言当前
`/md/...` 行为失败,再修生成逻辑。

## Turbo 与 CI 边界

### Turbo

当前 `turbo --dry=json` 只 hash example 自身顶层 `src/App.tsx`,没有包含根
`src/camera/**`。改为:

- `$TURBO_DEFAULT$`:example package 自身所有正常输入。
- `$TURBO_ROOT$/src/**`:库完整嵌套源码。
- `$TURBO_ROOT$/package.json`、`yarn.lock`、tsconfig、Babel / RN config、podspec。
- `$TURBO_ROOT$/android/**` / `ios/**` 仅在相应平台任务纳入。
- 明确排除 build、Pods、Gradle cache 等输出。

修改后以 dry JSON 断言至少包含一个嵌套 `src/camera/**` 文件和 example Babel config。

### Website check

仓内提供 / 执行统一 website check:

```text
website typecheck
→ build-llms.test.js
→ Docusaurus production build
```

权威 CI 模板是:

`/Users/liulijun/tongyi/design/.github/templates/workflows/ci.yml`

用户已明确通用模板由另一会话处理,且该会话会在同一任务分支提交。本设计的实现部分:

- 不直接修改该模板。
- 不修改本仓 `.github/workflows/ci.yml` 副本造成 drift。
- 最终创建 PR 前核对并行提交已加入 `website/**` filter 和 website PR check,且模板与
  本仓副本没有 drift。
- 若并行提交届时尚未出现,只声明本地 website check 已运行,不得声称 CI 门禁已修复或
  代替该会话静默重写模板。

## 消费侧 Camera Skill

唯一对应目录已定位为:

`/Users/liulijun/tongyi/design/skills/skills/camera/`

当前为 `0.2.2`,本次受公共行为、依赖、原生配置、错误语义、示例和测试方式影响,需:

- `SKILL.md`:更新接入、生命周期、临时文件与 result 语义;升至 `0.3.0`。
- `assets/PhotoScreen.tsx`:保持调用面不变,补长期保存提示。
- `references/native-setup.md`:加入 Worklets / Gesture 配置;纠正无条件相册权限要求。
- `references/peerdeps.md`:对齐当前 package peer ranges。
- `references/troubleshooting.md`:加入 plugin、非法配置、处理失败、文件生命周期与录像排查。
- `scripts/doctor.sh`:检查依赖 / 版本、Worklets plugin、权限与 Pods。
- `scripts/doctor.test.sh`:先增加失败 fixture,再修改 doctor。

根据 `writing-skills`,正文修改前先对当前 Skill 运行一个 retrieval / application
场景,记录其遗漏;修改后用同一场景复测。该目录在当前 workspace 之外,写入时需获取权限。
若不可写,必须报告“已检查但未同步”。

完成后在 Skills 仓运行:

```sh
python3 scripts/quick_validate.py skills/camera
python3 scripts/validate_repository.py
python3 scripts/validate_portal_consistency.py
bash skills/camera/scripts/doctor.test.sh
```

## TDD 与测试矩阵

生产修改遵循 RED → GREEN → REFACTOR。每个 bug 先有能按预期失败的最小测试。

### Session / reducer

- 第二次 open 取消旧 Promise。
- 旧 Container cleanup 不 settle 新 Promise。
- save / close / cleanup exactly once。
- 非法新 config 不打断旧 session。
- unmount 不留下未兑现 Promise。
- 每个 phase 的有效 / 无效 action 与 capability。
- 旧 operation token 不更新新 state。
- 只有 `nativeConfigurationKey` 变化才递增 generation。
- photo aspect 与相同 photo output 参数的 single ↔ continuous 不等待 onConfigured。
- quality、position、photo ↔ video、video aspect / bitrate、HDR constraints 等真实
  identity 变化递增 configuration generation。
- 快速连续切模式 / 录像画幅时只有最新 generation 的 `onConfigured` 恢复 `ready`;
  photo 画幅切换保持零重配。
- device fallback 会把 activePosition 归一到实际 device,flip 从实际位置推导。
- open 后 mutate 原 config / nested arrays 不改变 session snapshot。
- hardware back 走 user-cancel bridge；close / supersede / unmount 走 force teardown。

### Recorder

- 每次 start 创建不同 Recorder。
- start 成功后不创建预热 Recorder。
- mic denied 不 create / start。
- start failure dispose 并回 ready。
- stop 等待 finish callback。
- finish callback 可先于 start Promise continuation,不会回写假 `recording`。
- finish callback 可先于 stop Promise resolve,finalize 仍恰好一次。
- error callback 可先于 start resolve / reject；finalize 后的 start / stop reject 不会二次
  transition。
- cancel 与 finish callback 竞争时只有一个终态。
- Recorder dispose、video path commit / cleanup、UI transition 各自恰好一次。
- max duration 与手动 stop 走同一 finalizer。
- error callback 复位 UI并保留已有 files。
- cancel 不生成 file。
- duration 在 callback 后不归零。
- settings 变化不会复用旧 Recorder。

### Image / file

- portrait / landscape 的 4:3、16:9 source rect。
- EXIF orientation 6 / mirrored fixture 不发生二次旋转。
- 拍照后、processor 完成前旋转 viewport 仍使用快门时 aspect snapshot。
- 已匹配比例不裁切。
- crop + watermark 只 encode 一次。
- encode quality 对齐 current mode。
- preview / burn 使用同一 layout 几何与 line gap。
- processor failure 不提交 raw。
- Builder 与所有 Skia 对象 dispose。
- raw replacement、delete、retake、clear、cancel、save transfer、late callback cleanup。

### UI / integration

- 首选 device fallback 与 flip disabled。
- onConfigured 前 shutter disabled。
- VideoPlayer 由 native event 同步。
- 同一点两次 focus 产生两个 request。
- 动态 accessibility label / state。
- Modal 内存在 GestureHandlerRootView。
- Modal supportedOrientations 与 example iPhone 横屏 allowlist 有静态断言。
- example Babel plugin、workspace camera dependency 与 peers 有静态配置断言。

### 文档 / tooling

- homepage 示例通过 TypeScript / build。
- mock 文档示例使用 renderHook 且 file shape 完整。
- llms index 不产生 domain-root `/md/...`。
- Turbo dry-run hash 包含根嵌套源码。
- Camera doctor 新 fixture 先 RED 后 GREEN。
- README / website / example manifests / doctor 对 Camera、录像 Microphone、可选相册权限
  使用同一最小规则。

## 验证命令

实现完成后至少执行:

```sh
yarn test --maxWorkers=2
yarn typecheck
yarn lint
yarn prepare
node website/scripts/build-llms.test.js
yarn workspace @unif/react-native-camera-website typecheck
yarn workspace @unif/react-native-camera-website build
yarn turbo run build:android --dry=json
yarn turbo run build:ios --dry=json
```

环境允许时再执行 example Android / iOS native build。不能执行或失败时记录真实原因,不将
静态测试表述为真机验证。

## 真机验收

- 竖屏 / 横屏 / iPad 分屏的 4:3、16:9 取景和成片。
- front / back fallback 与翻转。
- 无水印、六种水印位置、中英文 / emoji、多行长文本。
- 单拍、连拍、手动停止录像、`recTime` 自动停止。
- 麦克风拒绝、录像 error、拍照处理失败后的可重试。
- 拍照处理中返回、录像中取消、快速二次 open。
- 删除、重拍、取消后临时目录不持续增长。
- 前后台切换、视频播放结束、重复同点对焦。

## 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 状态机迁移面大 | 先写纯 reducer / command tests,按 session、photo、video 分阶段接线 |
| native callback 次序差异 | exactly-once finalizer + operation token,所有 callback 测重复与晚到 |
| 全分辨率 Skia 内存峰值 | 单操作串行、一次 decode / encode、逆序 dispose、及时 unlink intermediate |
| preview 与 burn 字体细微差异 | 两侧统一 Skia Paragraph 和共享 normalized layout |
| 横屏控件遮挡 | frame 只负责画面 fit,控件继续按 safe area 浮层;列入横屏真机验收 |
| iPhone Modal 无法旋转 | Modal supportedOrientations + 宿主 Info.plist allowlist + 静态测试 |
| 清理误删消费者文件 | 仅 registry path 可删;200 前显式 transfer |
| Skill 仓不可写 | 请求明确权限;不可写则如实报告未同步 |
| 并行会话同时修改仓库规则 / CI | 不覆盖其工作;最终 PR 前按 diff 与验证结果确认已落地且语义一致 |

## 问题闭环矩阵

| 问题 | 设计闭环 |
| --- | --- |
| 二次 open resolver 竞态 | Session ID + exactly-once finish |
| 控件零散守卫 | reducer + capability selector |
| Recorder 预热破坏 active | 删除 prewarm,每次新建 |
| Recorder 跨设置复用 | settings per start |
| error / auto-finish 分叉 | 单一 finalizer |
| 自动结束 duration 缺失 | recording 期间缓存 |
| 横屏布局 / 裁切 | root frame rect + 通用 crop |
| 水印 preview / burn 不一致 | shared Skia Paragraph layout |
| JPEG quality 写死 | current mode quality + 单次 encode |
| temp files 泄漏 | per-session ownership registry |
| Focus 重启动画 | requestId + stable callback |
| runtime config 不完整 | open boundary validator |
| flip 到不存在设备 | 双 device lookup + capability |
| UI-only 变化等待不到配置 callback | nativeConfigurationKey 变化才进入 configuring |
| hardware back 绕过录像取消 | session-bound user-cancel / force-teardown bridge |
| homepage 非法 API | 文档示例改为真实 contract |
| testing 文档非法 Hook / file | renderHook + 完整 shape |
| llms 忽略 baseUrl | 相对链接 + regression test |
| example 缺 native peers / plugin / root | package + Babel + Gesture root |
| VideoPlayer 乐观状态 | RN Video v7 native event |
| accessibility 缺失 | 动态 role / label / state |
| Skia Builder 泄漏 | 全对象逆序 dispose |
| Turbo / website CI 漏检 | 本仓 Turbo / website check;共享 CI handoff |
| 麦克风拒绝仍启动 | 权限结果作为 start gate |

## 成功标准

- 公共 TypeScript contract 与返回字段零变化。
- 所有自动化测试、类型、lint、build 和 Skill 校验真实通过。
- 二次 open、Recorder、图片事务与文件回收具备明确回归测试。
- example 可解析所有 peers,Worklets 与 Gesture root 配置完整。
- iPhone Modal / example 宿主允许左右横屏，权限文档区分必需与消费者可选相册能力。
- 网站示例与 mock 可执行,llms 链接在 baseUrl 下有效。
- `skills/camera` 同步并通过自身 doctor;若权限不允许则明确未完成。
- 真机未执行的项目单列,不作成功断言。
- 并行会话负责的 AGENTS / CLAUDE 与共享 CI 模板改动已在最终 PR 中核对,且没有被本次
  实现覆盖。

## 官方参考

- [VisionCamera Recorder](https://visioncamera.margelo.com/docs/recorder)
- [VisionCamera Video Output](https://visioncamera.margelo.com/docs/video-output)
- [VisionCamera Orientation](https://visioncamera.margelo.com/docs/orientation)
- [VisionCamera Photo Output](https://visioncamera.margelo.com/docs/photo-output)
- [VisionCamera v5.0.11 Simple Camera example](https://github.com/mrousavy/react-native-vision-camera/tree/v5.0.11/apps/simple-camera)
- [React Native Worklets installation](https://docs.swmansion.com/react-native-worklets/docs/fundamentals/getting-started/)
- [React Native Gesture Handler installation](https://docs.swmansion.com/react-native-gesture-handler/docs/fundamentals/installation/)
- [React Native Video v7 events](https://docs.thewidlarzgroup.com/react-native-video/docs/v7/player/events/)
- [Skia Images](https://shopify.github.io/react-native-skia/docs/images/)
- [Skia Paragraph](https://shopify.github.io/react-native-skia/docs/text/paragraph/)
- [Skia `SkCodecImageGenerator` encoded-origin implementation](https://github.com/google/skia/blob/main/src/codec/SkCodecImageGenerator.cpp)
