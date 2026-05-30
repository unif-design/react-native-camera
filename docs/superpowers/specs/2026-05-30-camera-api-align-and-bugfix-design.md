# @unif/react-native-camera 2.5.0 — API 对齐原版 + 两个 Bug 修复 设计

- 日期：2026-05-30
- 阶段：Phase 1（先修 bug + API 对齐；UI 全量重写为 Phase 2，后续单独 brainstorming）
- 涉及仓库：
  - `react-native-camera`（库，当前 2.4.0 → 本次 **2.5.0**）
  - `unif/portal`（消费者，装 `^2.4.0` → 随库升级）
- 参考来源：
  - 原版 v1.2.5 本地副本：`~/Downloads/react-native-camera-main/`（功能逻辑分析见本会话调研）
  - 当前 2.0.0 设计：`docs/superpowers/specs/2026-05-26-camera-upgrade-design.md`
  - vision-camera 5.x API 权威：`docs/superpowers/research/2026-05-26-vision-camera-5x-deep-dive.md`
  - 设计稿消化（Phase 2 用）：`docs/superpowers/research/2026-05-29-design-spec-digest.md`

---

## 1. 背景与目标

### 1.1 核心原则

这是一次**重构升级**，不是重做。库从 vision-camera 4.x（v1.2.5）重写到 5.x（2.x）时，**公开 API 的调用参数与返回结果应与原版 v1.2.5 保持一致**，除非 vision-camera 5.x 本身强制要求改动。这样消费者（portal / 任何调用方）可以作为 drop-in 替换，调用姿势不变。

2.0.0 重写时对 API 做了两类改动：
- **5.x 强制的**（正确，保留）：去掉 `photoResolution` / `videoResolution`（5.x 取消了 Format API，分辨率由 `usePhotoOutput` 的 `targetResolution` 内部处理）。
- **非必要的（要回退）**：把原版的 `quality: number` 拆成了 `photoQuality`（速度优先级）+ `jpegQuality`（JPEG 压缩）。原版只有一个 `quality` number，速度优先级在 4.x 是写死 `speed` 的。这个拆分没有 5.x 的强制理由，回退成 `quality`。

### 1.2 三件事（本 spec 范围）

| # | 内容 | 仓库 |
|---|---|---|
| **A** | 库 API 对齐原版（入参回退 `quality`、保留原版字段、返回结果取原版+2.x 并集） | camera 库 |
| **B** | Bug 1：传单拍+连拍只显示拍照 → portal 透传 cameraMode 数组、不拍扁 | portal |
| **C** | Bug 2：取景裁了、照片没裁（杯子问题）→ 取景框按 4:3/16:9 留边 WYSIWYG | camera 库 |

### 1.3 非目标（明确不在本 spec）

- **UI 全量重写**（按设计稿）→ Phase 2，后续单独 brainstorming。本次只动 bug 涉及的取景布局，不改视觉风格。
- **水印**：保持去掉，后续详细讨论。
- **方向 / 镜像**：用 vision-camera 5.x 默认行为，不做特殊烧像素处理（用户未观察到该问题，YAGNI）。
- **视频模式行为**：不新增 / 不重做，沿用现状。

---

## 2. Part A — 库 API 对齐原版（camera 库）

### 2.1 入参类型（`src/utils/interface.ts`）

**目标形状**（= 原版 v1.2.5 的 `CameraModeType` / `CameraProps`，去掉 `photoResolution` / `videoResolution` / `watermark`，`quality` 用回原版名）：

```ts
export type CameraType = 'back' | 'front';

export type CameraModeName = 'single' | 'continuous' | 'video';

export type FlashMode = 'auto' | 'on' | 'off';

export type DataRetainedMode = 'clear' | 'retain';

export type CameraMode = {
  /** 初始前/后摄,缺省 back。H5 传入,接线为初始 device position */
  type?: CameraType;
  /** 初始闪光(原版字段,保留作 API 兼容)。闪光由相机内 UI 控制,不从 config 接线 */
  flashMode?: FlashMode;
  /** 拍摄模式 */
  mode: CameraModeName;
  /** JPEG 压缩 0~1,缺省 0.9。内部速度优先级写死 'speed'(对齐原版 4.x photoQualityBalance) */
  quality?: number;
  /** 录制时长上限(秒),video 模式。原版字段,保留;未用到则 no-op */
  recTime?: number;
};

export type OpenConfig = {
  cameraMode: CameraMode[];
  dataRetainedMode: DataRetainedMode;
};
```

**移除的类型导出**：`PhotoQuality`（`'speed'|'balanced'|'quality'`，不再暴露；速度优先级内部固定 `speed`）。

**与当前 2.x 的 diff**：
- 删 `CameraMode.photoQuality`、`CameraMode.jpegQuality`。
- 加 `CameraMode.type` / `flashMode` / `quality` / `recTime`（= 原版字段）。
- `OpenConfig` 不变（仍 `cameraMode[] + dataRetainedMode`，本来就和原版一致）。

### 2.2 返回类型（`CustomPhotoFile`）

**并集**：原版 `{id, path, cameraType, cameraMode}` + 2.x `{path, uri, width, height, mime, mode, duration?}`。字段不冲突，全部返回。

```ts
export type CustomPhotoFile = {
  // —— 原版字段(恢复) ——
  /** 唯一 id,时间戳 + 序号(避免同毫秒撞 id) */
  id: string;
  /** 拍摄时的前/后摄 */
  cameraType: CameraType;
  /** 模式(原版字段名,与 mode 同值) */
  cameraMode: CameraModeName;
  // —— 2.x 字段(保留) ——
  path: string;
  uri: string;
  width: number;
  height: number;
  mime: 'image/jpeg' | 'video/mp4';
  /** 模式(2.x 字段名,与 cameraMode 同值) */
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

**`code` 保持 2.x（不回退原版的恒 200）**：原版 `code` 恒为 200（无错误信号）。2.x 的 `0/200/403/404/500/503` 是超集且更有用，**portal 的 handler 已依赖这套码**（`handlers.ts` PEC_CAMERA 注释列了 200/0/403/404/500/503）。回退到恒 200 会破坏 portal 错误处理，故 **code 保持 2.x**。`message` 同理保持 2.x（informational，portal 透传）。

> 说明：本 spec 说"返回结果对齐原版"指 **`data[i]` 的字段并集**；`code`/`message` 因 portal 依赖 + 严格更优，保持 2.x。

### 2.3 字段接线决策

| 字段 | 接线 | 说明 |
|---|---|---|
| `quality` | **接线** | `usePhotoOutput({ quality: mode.quality ?? 0.9, qualityPrioritization: 'speed' })`。当前 `Camera.tsx:62-67` 用 `currentMode.photoQuality / jpegQuality` → 改为 `currentMode.quality`，`qualityPrioritization` 写死 `'speed'`。 |
| `type`（初始前后摄） | **接线** | H5 会传。`Container` 当前 `useCameraDevice('back', …)` 写死 → 改为 `cameraMode[0]?.type ?? 'back'` 作初始 position。运行时前后摄翻转是独立功能，不在本 spec（沿用现状）。 |
| `flashMode`（初始闪光） | **不接线** | 闪光由相机内 UI（SetUp 闪光按钮）控制，不是 config 输入。字段保留仅为 API 兼容原版（原版也定义了但未消费）。**不从 config 设初始闪光。** |
| `recTime`（录制时长） | **接受 / no-op** | 字段补上（API 兼容）。当前未用到，先 no-op；若后续视频需要再接 `createRecorder({ maxDuration })`。 |
| `id` | **生成** | `${Date.now()}-${counter}`（模块内单调计数器），避免原版同毫秒撞 id 的问题。 |
| `cameraType` | **填充** | 拍摄瞬间的 device position。 |
| `cameraMode` | **填充** | = `mode`（同值，原版字段名）。 |

### 2.4 涉及文件（库）

| 文件 | 改动 |
|---|---|
| `src/utils/interface.ts` | 重定义 `CameraMode`（原版字段 + quality）、`CustomPhotoFile`（并集）；删 `PhotoQuality` |
| `src/utils/util.ts` | `buildPhotoFile` 增加 `id` / `cameraType` / `cameraMode` 填充；签名加 `cameraType` 入参 |
| `src/camera/Camera.tsx` | `usePhotoOutput` 用 `currentMode.quality` + 写死 `qualityPrioritization:'speed'`；capture 时把 `cameraType` 传入 `buildPhotoFile` |
| `src/camera/capturePhotoHelper.ts` | 透传 device position / 返回字段对齐（如需） |
| `src/camera/Container.tsx` | 初始 `type` 从 `cameraMode[0]?.type` 取；`flashMode` 不接线（内部 UI 控制）；`recTime` no-op |
| `src/camera/setup/SetUp.tsx` | 若 `FlashMode` / `AspectRatio` 类型有移动则跟随（flash 类型对齐 `interface.ts`）；闪光仍由此 UI 控制 |
| `src/__tests__/*` | 契约测试更新到新形状（见 §5） |
| `package.json` | version `2.4.0` → `2.5.0` |
| `README.md` | API 文档更新（quality / 返回字段并集） |

### 2.5 版本

→ **2.5.0**（minor bump）。去掉 `photoQuality`/`jpegQuality`、改回 `quality` 严格说是 API 变更，但这是**修正 2.0 重写时的 quality 拆分失误**，且本库为**内部使用**（消费者只有 portal，同步升级），不走严格 SemVer major。返回字段为新增（非破坏）。portal 随之升级（见 Part B）。

---

## 3. Part B — Bug 1：多模式（portal `compat/camera.ts`）

### 3.1 根因（已确证）

`portal/src/utils/compat/camera.ts:18-26` 的 `toCameraConfig` 把多模式**拍扁成单元素**：`RetailCameraParams.mode` 是单值，无论 H5 想要什么，`cameraMode` 永远只有 1 个元素 → 库只渲染 1 个 tab → 只显示"拍照"。

库侧渲染正确（`Footer.tsx` `Segmented` 给 N 个 mode 渲染 N 个 tab，门槛 `length > 0`）。**Bug 1 纯 portal 兼容层问题。**

### 3.2 改法：像原版一样透传数组

portal 不拍扁，把 H5 传来的 cameraMode 数组**透传**给库（对齐原版 retail-pecportal `cameraMode.map(...)` 的做法）。`RetailCameraParams` 跟随库 2.5.0 的字段（`quality` 而非 photoQuality/jpegQuality）。

```ts
export type RetailCameraParams = {
  /** 多模式:底部出可切 tab。优先于单 mode。元素 = 库 CameraMode 的 retail 子集 */
  cameraMode?: Array<{
    mode: 'single' | 'continuous';   // unif 通用拍照(video 暂不经 portal 暴露)
    type?: 'back' | 'front';         // H5 传初始前后摄
    quality?: number;
    // flashMode 不在此:闪光由相机内 UI 控制,非 config 输入
  }>;
  /** 单模式(向后兼容旧 H5) */
  mode?: 'single' | 'continuous';
  quality?: number;
  /** 切模式是否保留照片,默认 clear(H5 可控,见 brainstorm 决策 C) */
  dataRetainedMode?: 'clear' | 'retain';
};

export function toCameraConfig(params: RetailCameraParams): OpenConfig {
  const q = params.quality ?? 0.9;
  // cameraMode 数组优先(去重保序);否则退回单 mode
  const list =
    params.cameraMode && params.cameraMode.length > 0
      ? dedupeByMode(params.cameraMode)
      : [{ mode: params.mode === 'continuous' ? 'continuous' : 'single', quality: q }];
  return {
    cameraMode: list.map((m) => ({
      mode: m.mode,
      type: m.type,
      quality: m.quality ?? q,
    })),
    dataRetainedMode: params.dataRetainedMode ?? 'clear',
  };
}
```

`dedupeByMode`：按 `mode` 去重保序，防 H5 误传重复 mode 导致重复 tab。

### 3.3 要点

- **向后兼容**：旧 H5 传 `{mode:'single'}` 照常工作（`cameraMode` 缺省 → 退回单 mode）。
- **新 H5**：传 `{cameraMode:[{mode:'single'},{mode:'continuous'}]}` → 出 2 个 tab、可切换。
- **顺序**：数组顺序 = tab 顺序，默认选中第 0 个。
- **dataRetainedMode**：H5 可传，默认 `clear`（brainstorm 决策 C）。
- **H5 契约变更**：H5 端要改成发 `cameraMode` 数组（与原 retail H5 契约一致）。**由调用方协调 H5。**
- `toCameraPhotoPaths` 不变：仍 `result.data.map(f => f.path)`（H5 拿路径数组，行为一致）。

### 3.4 涉及文件（portal）

| 文件 | 改动 |
|---|---|
| `src/utils/compat/camera.ts` | `RetailCameraParams` 加 `cameraMode` 数组 + `dataRetainedMode`；`toCameraConfig` 透传不拍扁 + `quality` |
| `src/utils/compat/index.ts` | 导出无变化（已导出 RetailCameraParams） |
| portal 测试（若有） | toCameraConfig 多模式 / 单模式 / 去重 用例 |

---

## 4. Part C — Bug 2：取景裁剪（camera 库 `Camera.tsx`）

### 4.1 根因（已确证）

取景 `<VisionCamera style={StyleSheet.absoluteFill}>` 全屏铺满（`Camera.tsx:212-215`）。手机屏幕窄长（≈19.5:9），相机画面 4:3，为铺满屏幕 cover 把**左右裁掉** → 侧边的杯子在预览看不见。拍照存的是传感器完整 4:3 → 杯子回来。**预览裁了、照片没裁。**

### 4.2 改法：取景框按比例留边（WYSIWYG）

把全屏相机改成**按输出比例的居中取景框**（letterbox 留黑边）。框比例 = 输出照片比例（`targetResolution` 已是 4:3=1080×1440 / 16:9=1080×1920），cover 不再裁 → 预览 = 拍照。

```tsx
const { width: screenW } = useWindowDimensions();
const ratio = (aspectRatio ?? '4:3') === '4:3' ? 4 / 3 : 16 / 9; // 竖屏 高/宽
const boxW = screenW;
const boxH = screenW * ratio;  // 4:3→W×1.33  16:9→W×1.78

return (
  <View style={styles.root}>                         {/* 全屏黑底,居中 box */}
    <GestureDetector gesture={composed}>
      <View style={[styles.box, { width: boxW, height: boxH }]}>
        <VisionCamera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"                           {/* 框比例=画面比例,cover 不裁 */}
          device={device}
          isActive={isActive}
          outputs={outputs as CameraProps['outputs']}
          constraints={[{ photoHDR: false }]}
          zoom={zoom}
          torchMode={currentMode.mode === 'video' && flash === 'on' ? 'on' : 'off'}
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

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: { overflow: 'hidden' },
});
```

### 4.3 要点

- **取景框比例 = 输出比例** → cover 不裁两侧 → 杯子在取景里看得到 → 预览 = 拍照。
- **宽高比按钮联动**：SetUp 的 4:3/16:9 切换改 `aspectRatio` prop → box 重算（即时切换，无动画；动画留 Phase 2）。
- **手势/对焦坐标**：`GestureDetector` 包在 box 上 → tap 坐标是 box 内相对坐标 → `focusTo` 与 `FocusIndicator` 都在 box 内，一致。
- **Footer / SetUp 浮层**：仍 absolute 在最上层，黑边在其后，不受影响。
- **预览页**：照片本身 = 框里画面，预览（`SinglePre` 已用 `contain`）自然一致，无需改。
- **方向/镜像**：用 5.x 默认，不处理。

### 4.4 涉及文件（库）

| 文件 | 改动 |
|---|---|
| `src/camera/Camera.tsx` | 全屏 → 按比例 box + 黑底居中 + `resizeMode="cover"` + `useWindowDimensions` |

---

## 5. 测试

### 5.1 库单元/契约测试

| 测试 | 验证 |
|---|---|
| `interface` 契约 | `CameraMode` 含 `type/flashMode/mode/quality/recTime`、不含 photoQuality/jpegQuality；`CustomPhotoFile` 含 `id/cameraType/cameraMode` + 2.x 字段（`@ts-expect-error` 反向验证非法字段） |
| `buildPhotoFile` | 返回含 `id`（唯一）/`cameraType`/`cameraMode`(=mode)/`uri`(file://)/`mime`；连续两次 id 不同 |
| Footer 多模式 | 传 2 个 mode → 渲染 2 个 `mode-*` tab；点击触发 `onSelectMode` 切 index |
| Footer 单模式 | 传 1 个 mode → 1 个 tab |
| quality 映射 | mock `usePhotoOutput` 收到 `{ quality, qualityPrioritization:'speed' }` |

### 5.2 portal 单元测试

| 测试 | 验证 |
|---|---|
| `toCameraConfig` 多模式 | `cameraMode:[{single},{continuous}]` → 库 config `cameraMode` 2 元素、顺序一致 |
| `toCameraConfig` 单模式兼容 | 只传 `mode:'single'` → 1 元素 |
| `toCameraConfig` 去重 | 传重复 mode → 去重 |
| `toCameraConfig` dataRetainedMode | 传 retain → 透传；不传 → clear |
| `toCameraPhotoPaths` | `result.data` → `path` 数组 |

### 5.3 真机验证

- **Bug 1**：H5 传 `[single, continuous]` → 底部出"拍照/连拍"两 tab，可切换；切到连拍能连拍。
- **Bug 2**：取景里能看到侧边的杯子（取景框留黑边）→ 拍出来构图一致（杯子在）。4:3 与 16:9 都验证。
- **API 对齐**：返回 `data[i]` 同时含 `id/cameraType/cameraMode` 和 `path/uri/width/height/mime/mode`；portal H5 拿到 path 数组照常。
- **方向/镜像**：顺手看一眼竖拍/前摄是否有明显异常（5.x 默认；若异常单独记录，不在本 spec 修）。

---

## 6. 实施顺序（实施计划另行编写）

两个仓库、两个 PR，库先行（portal 依赖库新 API）：

1. **库 PR（2.5.0）**：Part A（API 对齐）+ Part C（取景 WYSIWYG）+ 测试 + README + version bump。
2. **portal PR**：升级 `@unif/react-native-camera` 到 2.5.0 + Part B（compat 透传多模式 + quality）+ 测试。
3. **H5 协调**：H5 改发 `cameraMode` 数组（调用方负责，非本仓库改动）。

---

## 7. 风险与待确认

| 项 | 说明 |
|---|---|
| API 变更（2.5.0） | 去掉 photoQuality/jpegQuality、改回 quality。库内部使用，消费者仅 portal，同步升级；按"修正 2.0 失误"处理，走 minor。 |
| 字段接线 | `type` 接线（H5 传初始前后摄）；`quality` 接线（JPEG）；`flashMode` **不接线**（闪光由相机内 UI 控制，字段仅作 API 兼容保留）；`recTime` 接受但 no-op（未用到，后续视频需要再接）。 |
| 取景框 vs 传感器原生比例 | box 比例 = 输出 `targetResolution` 比例；若设备传感器原生比例与之差异较大，cover 仍可能有极小裁切。主因（全屏裁两侧）已解决；如真机仍有偏差，再微调。 |
| 方向/镜像 | 用 5.x 默认，未烧像素。若真机出现歪/镜像，属已知风险，单独处理（不在本 spec）。 |
| Footer 双 state | 原版 Footer/Camera 有两套 mode state 隐患；2.x 已是单一 `modeIndex`（Container），无此问题，无需改。 |
