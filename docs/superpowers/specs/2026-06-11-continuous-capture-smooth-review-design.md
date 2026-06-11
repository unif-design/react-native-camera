# 连拍「顺滑回看」设计 —— 烧水印期间去掉黑屏闪回与模式跳

- 日期:2026-06-11
- 状态:待评审(brainstorming 产出,未实现)
- 影响文件(预估):`src/camera/hooks/useCaptureFlow.ts`、`src/camera/Camera.tsx`、`src/camera/Container.tsx`、对应 `src/__tests__/`

## 背景与问题

连拍 + 水印场景下,每拍一张都会出现「屏幕闪一下就回去 + 模式药丸从连拍跳到单拍再滑回」的割裂感。

诊断结论(已定位):

1. **黑屏闪回** —— `Container.tsx` 的 `isActive = appActive && !burning`:烧水印期间 `isActive=false`,VisionCamera session 暂停,取景预览变黑/卡;烧完恢复。
2. **footer 整段跳变** —— footer 用 `{burning ? <生成中> : <模式药丸 + 快门行>}` 整段替换;烧水印进/出各一次内容大跳变。
3. **模式药丸滑块跳档** —— 上述整段替换会卸载并重挂 `ModeSwitcherPill`,其滑块位置存在组件内部 `Animated.Value(0)`,重挂重置回 0(首档)再动画滑回当前档 → 视觉上「连拍→单拍→连拍」。**此项已在本次会话单独修复**(组件层:重挂直接 `setValue` 落位,仅真正切档才动画),本设计从结构上再消除其触发源(footer 不再整段替换),形成双保险。

`isActive=!burning`(停取景)不是 bug,而是 OOM 防线:一张 UHD 全幅 ≈ 12MP,烧水印瞬间解码为全分辨率 RGBA(原图 ≈ 50MB + 离屏 surface + 快照 + base64 读/写),峰值上百 MB;停取景是为了**不让该峰值叠加在摄像头预览管线之上**,防低端机内存压力杀进程。它与快门 `capturingRef` 防并发是同一条 OOM 防线的两半。

该防线对**单拍**无副作用(拍完本就离开取景进确认预览);**连拍**才暴露问题——每张都停一次取景,把「连」拍切成「拍一张卡一下」。

## 目标 / 非目标

**目标**
- 连拍时取景画面连贯、footer 不跳,消除黑屏闪回与模式跳。
- 保持「拍后即烧」:预览与最终数据始终是带水印的成品(不延后到保存)。
- 完整保留现有内存安全红线(绝对安全,不为体验牺牲低端机稳定性)。

**非目标**
- 不做「按住狂拍 / 多张同时烧」(会令多张全幅烧水印并发 → OOM,正是现在所防)。本设计的连拍节奏 ≈ 系统相机拍照:拍一张→回看(生成中)→烧完→拍下一张,每张间隔约等于单张烧录耗时。
- 不改烧水印算法 / 时机 / 分辨率。
- 不改单拍、视频流程的既有行为。

## 关键决策(已与用户确认)

1. **拍后即烧,不延后** —— 预览即成品,比「预览先看原图」对相机库更稳妥。
2. **连拍节奏 = 顺滑回看** —— 不追求狂拍,换取「取景不黑不跳 + 内存绝对安全」。
3. **内存红线全保留** —— `isActive=!burning`、`capturingRef`、串行逐张烧 全部不动。
4. **「生成中」提示** —— 定格画面上**居中 spinner + 文案**(「水印生成中…」),非阻塞,不占整个 footer。
5. **最小定格时长 200ms** —— 防极快烧录(<100ms)时定格一闪而过的闪烁。

## 方案

核心:不改烧水印的时机与内存策略,只把「烧水印期间给用户看的东西」从「黑屏 + footer 整段跳」换成「定格在刚拍的画面 + footer 不动 + 居中转圈」。

### 改动 1 —— 取景区:黑屏 → 定格帧

烧水印期间 `isActive=false` 取景照旧真停(内存安全不变),但用**刚拍的那张照片**盖在取景框上:

- 定格图渲染进 `Camera` 的取景框内(`<Animated.View style={frameStyle}>` 内、VisionCamera 之上),用 `<Image resizeMode="cover">` 铺满 `StyleSheet.absoluteFill`。放在取景框内 → 尺寸 / cover / 画幅动画**自动与实时取景贴合**,撤掉定格瞬间无缝切回实时画面。
- 定格图源 = `capture()` 返回的**原图 uri**(未裁切、未烧水印,capture 完立即可用,最快)。

### 改动 2 —— footer:不再整段替换

去掉 `Container.tsx` footer 里的 `{burning ? <生成中 footer> : …}` 整段切换:

- 模式药丸 / 快门行(`ModeSwitcherPill` / `ActionRow`)**恒定渲染**。
- 烧水印期间快门禁用 —— 现有 `shutterDisabled={capturing}` 已涵盖(`capturing` 在 `onShutter` 全程为真,含烧水印阶段)。
- 录像计时器分支(`recording ? <RecordingTimer> : <ModeSwitcherPill>`)保持不变。
- 结果:`ModeSwitcherPill` 不再卸载/重挂 → 滑块跳档从结构上消失。

### 改动 3 —— 「生成中」提示:居中 spinner + 文案

`testID="burning"` 的整段 footer 替换移除;改为定格帧上叠一层居中 `<Loading/> + 「水印生成中…」`(沿用现有文案语义)。非阻塞,不影响 footer 控件。

### 数据流 / 时序(`onShutter`)

```
capturingRef = true; setCapturing(true)
const f = await capture()            // 原图 uri 可用
if (!f) { onError('拍摄失败,请重试'); return }
setFlashNonce(n+1)                   // 白闪(保留)
const isJpeg = f.mime === 'image/jpeg'
const needCrop = isJpeg && aspectRatio === '16:9'
const wm = isJpeg ? config.watermark : undefined
let saved = f
if (needCrop || wm != null) {
  const t0 = Date.now()
  setFreezeUri(f.uri)                // 定格盖上(取景变黑前已被盖)
  setBurning(true)                   // isActive→false,取景停
  try {
    if (needCrop) saved = await cropToRatio(saved, '16:9')
    if (wm != null) saved = await burnWatermark(saved, wm)
  } finally {
    setBurning(false)                // 取景恢复(背后已活,仍被定格图盖着)
    const elapsed = Date.now() - t0
    if (elapsed < MIN_FREEZE_MS) await sleep(MIN_FREEZE_MS - elapsed)  // 200ms 最小定格
    setFreezeUri(null)               // 撤定格 → 无缝切回实时
  }
}
setPhotos(prev => [...prev, saved])
// 单拍 + clear 仍照旧进确认预览
```

> 说明:`setBurning(false)` 先恢复取景(背后实时画面已在跑),再等满最小时长才撤定格图,撤掉瞬间即实时画面,过渡无缝。`Date.now()` 在 RN 运行时可用(注:仅 workflow 脚本里禁用,此处是组件代码)。

### 内部接线(公开 API 不变)

> 公开面(`useCamera` / `OpenConfig` / `CameraResult`)零变更。以下都是库内部组件间连线:定格数据**产生于** `useCaptureFlow.onShutter`(capture 返回值)、**消费于** `Camera` 取景框,中间隔着 Container,沿途必须接出 —— 本质是「A 组件算出的东西送到 B 组件去画」,不是新增能力。

- `useCaptureFlow` 返回新增 `freezeUri: string | null`(烧水印期间 = 刚拍原图 uri,否则 null)。与它已返回的 `burning` / `photos` / `previewing` 同类的**内部 UI state**;数据在 hook 内产生,Container 要用只能由它暴露(不把 onShutter 逻辑外移,保持「逻辑抽进 hook」的既有约定)。
- `Camera` 新增可选 prop `frozenUri?: string`,非空时在取景框 `<Animated.View style={frameStyle}>` 内、VisionCamera 之上叠定格 `<Image resizeMode="cover">`。**放进取景框内**(而非 Container 层复刻尺寸公式)是为自动继承尺寸 / cover / 画幅动画 / 裁切,撤定格无缝 —— 已确认采用此方案。
- `Container` 把 `captureFlow.freezeUri` 透传给 `<Camera frozenUri={…} />`,并据 `burning` 在定格层上渲染「生成中」提示(居中 spinner + 文案)。

另需一个常量(**非接口**):`MIN_FREEZE_MS = 200`(就近放 `useCaptureFlow`)—— 定格最小可见时长,防极快烧录(<100ms)闪烁。

## 内存安全论证(「绝对安全」依据)

- `isActive = appActive && !burning` 不动 → 烧水印时取景真停,全幅烧录峰值不叠加预览管线。
- `capturingRef` 防并发不动 → 任意时刻至多一张在烧。
- 串行逐张烧、峰值恒定不动。
- 定格仅「显示一张已落盘的 JPEG」:一次 JPEG 解码(显示分辨率,RN `<Image>` 自带降采样),开销远小于取景管线,且与「取景已停」错峰,不构成新峰值。

## 失败 / 边界

- **烧水印失败返回原图**:`burnWatermark`/`cropToRatio` 红线是「任何异常返原图绝不阻断」,`saved=f`;定格显示的就是 f,撤掉后取景恢复、`photos` 照常追加 → 无异常路径。`freezeUri` 在 `finally` 清空,失败也不会卡住定格。
- **烧极快(<100ms)**:由 `MIN_FREEZE_MS=200` 兜底,定格至少可见 200ms,无闪烁。
- **前摄(position==='front')**:定格用照片文件,可能与前摄镜像预览方向相反 → 定格瞬间有「水平翻转」感。**列为真机验证项**;若复现,对前摄定格 Image 加 `transform:[{scaleX:-1}]` 水平镜像对齐预览。
- **无水印且非 16:9**:不进 burning 分支,无定格、无停取景,连拍本就流畅(不受影响)。
- **App 切后台**:`isActive` 含 `appActive`,切后台仍停取景;定格逻辑只在 `onShutter` 内,互不干扰。

## 测试计划(jest,无真机)

- `useCaptureFlow`:
  - 烧水印期间 `freezeUri === 刚拍 uri`,完成后回 `null`。
  - 烧失败路径(mock burn 抛错/返原图)`freezeUri` 仍被清空、`photos` 仍追加原图。
  - `MIN_FREEZE_MS` 生效:用 fake timers 断言极快烧录下定格至少持续到最小时长才清。
- `Camera`:传 `frozenUri` 时取景框内渲染定格 `<Image>`(按 testID 断言);不传时不渲染。
- `Container`:烧水印期间 footer 仍渲染 `ModeSwitcherPill`(断言不再出现整段替换的 `testID="burning"`)、快门禁用;「生成中」提示出现在定格层。
- 保留既有 `ModeSwitcherPill` 测试(组件层落位/动画行为)。

## 真机验证项(jest 测不到)

- 连拍多张:取景全程不黑不跳,定格→实时切换无缝。
- 前摄定格是否镜像错位(见上)。
- `MIN_FREEZE_MS` 取值观感(200ms 是否合适,真机可微调)。
- 低端机内存:连拍多张稳定不闪退(确认红线未被削弱)。

## 风险 / 未决

- 文档同步:若改动触及对外行为描述,需同步 `website/docs/` 并重生成 llms.txt(本设计不改公开 API/类型,预计无需)。
- `MIN_FREEZE_MS` 为体验常量,真机可调;先定 200ms。
