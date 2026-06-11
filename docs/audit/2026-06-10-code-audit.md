# @unif/react-native-camera 代码深度审查报告

日期：2026-06-10 · 范围：根 `src/`（源码+测试）+ 工程配置 · 方法：工具硬数据 + 五镜头并行审查 + 主会话逐条读原文核实
分支/基线：`docs/code-audit-spec` @ `f2829d8`（同 main `6157d9b`，v2.20.0）
设计文档：`docs/superpowers/specs/2026-06-10-code-audit-design.md`

---

## 1. 执行摘要

**总体结论**：这是一个工程纪律明显高于社区平均水平的库——公开面收敛到单 hook、核心链路（防重入 / Skia dispose / Promise 生命周期 / 0-setState 变焦）质量扎实且 why 注释制度化、TS 严格度与 CI 供应链卫生一流、源码重复率仅 1.40%。**问题集中在边缘交互路径**（录像启动失败、原生自发停录、预览删除、翻转变焦、非默认水印位）和若干 **API 契约偏差**（iOS 视频 mime、flashMode JSDoc、500 带数据）。共 50 条经核实的独立发现：**P1×5、P2×22、P3×23**，无 P0；修复成本普遍低（多为单文件单点改动）。

| 维度 | 等级 | 一行结论 |
| --- | --- | --- |
| 技术选型 | 良 | 关键选型全部核对成立（fs fork / video 7 / nitro 栈 / reanimated 4）；扣分在 peer 卫生：GH 无上界准入 3.0、webview 零引用仍硬 peer |
| 代码架构 | 良 | 分层与依赖方向基本干净、无循环依赖；一处 components→camera 反向依赖，预览状态机一半散落 Container |
| 代码质量 | 需改进 | 核心拍照链路很强，但 5 条 P1 全在此维度：边缘路径（录像失败态 / 等长切 tab / 翻转变焦 / 水印定位 / 视频 mime）未闭环 |
| 代码重复率 | 优 | 源码 1.40%（行业常用参考线 3~5%）；3 处克隆已逐个裁决，1 处属「不该合」 |
| 最佳实践对齐 | 良 | vision-camera / reanimated / Skia 用法与官方推荐高度重合（多处教科书级）；3 处偏差（quality 降级前提、recTime 可接未接、base64 往返） |
| 代码规范 | 良 | TS 严格度高于社区模板、suppression 全带理由、注释 why 标准落地；缺口在行为测试盲区（403/404）与 CI 细节 |

**Top 发现速览**（P1 全列 + 重点 P2）：

| # | 严重度 | 位置 | 问题 |
| --- | --- | --- | --- |
| 1 | P1 | `Camera.tsx:299` + `useVideoRecorder.ts:36` | 录像启动失败被吞 → 假录制态 → 停止时 settle(503) 关相机连已拍照片一起丢 |
| 2 | P1 | `Carousel.tsx:36` + `PreviewOverlay.tsx:72` | gallery 切类型 tab 等长时不 remount → 显示张与 index 错位 → **删除删错文件** |
| 3 | P1 | `useZoomController.ts:64` + `Container.tsx:228` | 翻转到前摄不重置变焦 → 卡在继承的数字变焦且无任何 UI 可恢复 |
| 4 | P1 | `Container.tsx:243` ↔ `WatermarkStamp.tsx:47` | 取景水印定位双所有权 → wrapper 坍缩 0×0，6 档 position 仅默认档预览正确 |
| 5 | P1 | `Camera.tsx:149` + `util.ts:25` | iOS 录像默认 .mov 容器，mime 却硬编码 `video/mp4`，消费者按 mime 处理会错 |
| 6 | P2 | `Camera.tsx:276` | 原生自发停录（max-duration / 磁盘满）时录好的文件被静默丢弃，recording 卡 true |
| 7 | P2 | `Container.tsx:249` | 烧水印/拍摄中「保存」「切模式」不禁用 → 静默丢在途照片 |
| 8 | P2 | `package.json:124` | gesture-handler peer `>=2.21.0` 无上界，今天新装即 3.0.0（builder API 已弃用，兼容未验证） |
| 9 | P2 | `useCamera.tsx:21` | 二次 open() 覆盖 resolver → 第一个 Promise 永不 settle，消费者 await 挂死 |
| 10 | P2 | `useCaptureFlow.ts:101` | settle(500) 带 photos、settle(503) 带空数组，互相矛盾且违反文档「失败 data 为空」 |

---

## 2. 硬数据快照

全部为本次工具实测输出（存档 `/tmp/audit/`）：

- **LOC**：源码 3680 行 / 测试 2607 行（测试:源码 ≈ 0.71）；50 个源文件 + 41 个测试文件
- **测试**：39 套件 / 160 用例**全部通过**（27.5s）；覆盖率 Stmts **78.06%** / Branch **71.75%** / Funcs **70.64%** / Lines **79.23%**（注：9 个 barrel `index.tsx` 计 0% 拉低整体；剔除后核心模块多在 90%+，最低的业务文件为 `Carousel.tsx` 71% / `VideoPlayer.tsx` 78% / `px-to-dp.tsx` 33%）
- **重复率（jscpd）**：纯源码 **1.40%**（3 处克隆 / 51 重复行）；含测试 **2.20%**（10 处克隆 / 137 行）——测试侧重复是源码侧约 3 倍
- **typecheck**：0 错误（strict 全家桶 + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` 下）
- **eslint**：0 error / 3 warning（均为 `useCaptureFlow.test.ts` 的 `no-void`）

---

## 3. 分维度详查

> 发现项按严重度排序。格式：**[严重度] 位置 — 标题**，问题 / 依据 / 修复建议各一行。严重度：P0 缺陷应尽快修 · P1 明确问题建议修 · P2 改进机会 · P3 风格可选。

### 3.1 技术选型

**[P2] `package.json:124` — gesture-handler peer 无上界，已被 3.0 击穿**
问题：peer `"react-native-gesture-handler": ">=2.21.0"`，npm latest 已是 **3.0.0**（本次 `npm view` 实测）；本库 `Camera.tsx:210/237` 使用的 builder API（`Gesture.Pinch()` / `Gesture.Simultaneous()` / `GestureDetector`）在 3.0 已**弃用**（改 hook API），新消费者按 peer 范围裸装即落入未经本库验证的 major。
依据：官方升级指南 https://docs.swmansion.com/react-native-gesture-handler/docs/guides/upgrading-to-3 （核实注："2.x 代码经 Legacy 兼容层可继续运行"——审查初判「v3 移除 builder API 即崩」经复核**不成立**，已据此从 P1 降级）。
修复建议：peer 收紧为 `">=2.21.0 <3"`，GH3 迁移（hook API）另立任务验证后再放开。

**[P2] `package.json:134` — `react-native-webview: "*"` 零引用仍是硬 peer**
问题：`src/` 无任何 import（grep 实证），消费者被迫安装无关原生模块；CLAUDE.md 自己也标注「历史保留」。
修复建议：删除，或挪入 `peerDependenciesMeta` 标 optional（属 breaking-ish 改动，下个 minor/major 处理）。

**[P3] `package.json:117-135` — peer 范围风格混杂 + 缺 `sideEffects`**
问题：核心运行时 peer `react-native-nitro-modules` / `nitro-image` 用 `*`（0.x 任意 minor 均可能 breaking），与 `>=2` / `^5.0.0` 混用；另缺 `"sideEffects": false`（纯 ESM 库，利下游 tree-shaking）。
修复建议：nitro 系收紧到已验证范围（如 `>=0.35.0 <1`）；补 sideEffects 声明。

**[P3] `package.json:119` + CLAUDE.md — `@sbaiahmed1/react-native-blur` 实为 design 的传递依赖**
问题：`src/` 零引用，实际是 `@unif/react-native-design` 的 peer（npm 实证）；本仓防御性重复声明可接受，但 CLAUDE.md 把它列入「运行时实际依赖的包」措辞失准。
修复建议：CLAUDE.md 注明「经 design 传递」。

**核对通过（未发现问题）**：`@dr.pogodin/react-native-fs` fork 选型理由仍成立（原版停更于 2022-05 的 2.20.0，npm time 实证）；`react-native-video 7.0.0-beta.9` 是接 Nitro 栈的唯一可行解（`useVideoPlayer`/`VideoView` 为 v7 专属，stable 6.x 不支持），devDep 钉 beta.9 + peer `>=7.0.0-beta.0` 可平滑接 GA；nitro-modules/nitro-image 为 vision-camera 5.0.11 硬 peer 透传合理；Skia `^2.6.4` = latest；reanimated `^4.0.0` + carousel `5.0.0-beta.5`（唯一兼容 reanimated 4 的版本线）选型正确；vision-camera `^5.0.0` = latest 5.0.11 活跃维护。

### 3.2 代码架构

**[P2] `src/components/Carousel/SlideItem.tsx:3` — components/ 反向依赖 camera/，子树双向耦合**
问题：`import { VIEWFINDER } from '../../camera/colors/viewfinder'`，与 camera→components（Container→Loading、PreviewOverlay→Carousel）构成双向依赖；且 components/ 唯一消费者就是 camera/，「通用组件层」名不副实。
修复建议：把 Carousel/VideoPlayer/Loading 折进 camera/，或将 VIEWFINDER 上提为共享常量层；可用 eslint `no-restricted-imports` 固化边界。

**[P2] `src/camera/hooks/useCaptureFlow.ts:31-37` — 裸 setter 外泄，预览状态机分居两处**
问题：hook 返回 3 个 `React.Dispatch`（setPhotos/setPreviewing/setPreviewVariant），导致删除回收（`Container.tsx:179-183`）、重拍清空（173-176）、打开 gallery 的不变量（329-334）写在 Container 回调里，与 hook 内「单拍+clear 自动进 confirm 预览」（124-131）同属一台状态机却分居两处。
修复建议：hook 暴露具名迁移（`openGallery/retake/deletePhoto/closePreview`），收回裸 setter。

**[P3] `useCaptureFlow.ts:22-24` — modeIndex 状态与迁移逻辑双向握手**
问题：状态在 Container（`useState`）、迁移在 hook（`onSelectMode`）；注释理由「渲染 ModeSwitcherPill 需要」不成立——Container 从不自调 `setModeIndex`，hook 返回 modeIndex 即可。
修复建议：modeIndex 整体下沉进 useCaptureFlow。

**[P3] `Container.tsx:281-291` — ZoomChips onSelect 内联 display→vzf 反算 + clamp，越权且重复**
问题：换算与 clamp 属 useZoomController 领域（hook 已持有 device）；且手写 `Math.min(Math.max(...))` 而 `zoomMath.ts:8` 已有 worklet 标注、JS 侧同样可调的 `clamp`（useZoomController.ts:66 同样手写）。
修复建议：controller 暴露 `selectDisplayStop(displayZ)`；两处手写 clamp 改用 `zoomMath.clamp`。

**[P3] `src/camera/setup/SideRail.tsx:17` — 领域类型 `AspectRatio` 定义在叶子 UI 组件**
问题：`useCaptureFlow.ts:9` 与 `Camera.tsx:36` 为取类型反向依赖 setup/ 子树，与 FlashMode「单一来源在 utils/interface.ts」先例不一致。
修复建议：上提到 `utils/interface.ts`，setup 仅 re-export。

**[P3] `src/camera/footer/zoomMath.ts` — 纯变焦数学放在 footer/（UI 子树）**
问题：唯一消费者是子树外的 `Camera.tsx:32`，footer barrel 也不导出它，位置归属错位。
修复建议：挪到 `camera/hooks/` 旁（与 useZoomController 同域）。

**核对通过（未发现问题）**：无循环依赖（utils 纯叶子、依赖单向）；OpenConfig 传递链仅两层无深 drilling，唯一 context（CameraDialogHost）用于真正横切的弹层、克制且必要；`src/index.tsx` 公开面收敛、mock.ts 与 `package.json#exports` 三元组契约一致；footer/preview/setup/watermark 相互零横向 import。

### 3.3 代码质量

**[P1] `Camera.tsx:299-302` ↔ `useVideoRecorder.ts:36-39` — 录像启动失败 → 假录制态 → 503 关相机丢已拍**
问题：`startVideo` 把 `createRecorder/startRecording` 异常整体吞掉（仅 warn、不上抛）；`startRecording` 在 `await startVideo()` 后**无条件** `setRecording(true)` → UI 进入假录制（红点计时）；用户按停止 → `stopVideo` 因 `activeRecorderRef` 为空返回 null → `settle({code:503, data:[]})` 整个相机关闭，**已拍照片一并丢失**。
依据：三处源码逐行核实（吞 catch / 无条件置位 / null→503 链路）。
修复建议：startVideo 失败上抛或返回 boolean；失败不置 recording，走顶部错误条；503 settle 前考虑保留已拍（见下 500/503 数据契约项）。

**[P1] `Carousel.tsx:36` ↔ `PreviewOverlay.tsx:72-75` — 等长切 tab 不 remount，删除删错文件**
问题：`key={data.length}` 只绑长度；gallery 切类型 tab 时若新旧 data 等长（如 2 张单拍 ↔ 2 段视频），RNCarousel 不 remount、内部滚动 offset 保留，而父级已 `setIndex(0)` → 屏上显示第 N 张、`current = data[index]` 取第 0 张 → **删除会删掉不是用户看着的那张**。
修复建议：key 纳入 activeType/variant（或数据身份），不只长度；并补该场景行为测试（见 3.6 测试缺口）。

**[P1] `useZoomController.ts:64-72` + `Container.tsx:228,272` — 翻转前摄不重置变焦，卡死无 UI 恢复**
问题：设备切换 effect 只做 min/max clamp 不重置；后摄 pinch 到 vzf 6（用户 3x）翻转前摄后，6 在前摄 vzf 范围内 clamp 不生效 → 前摄显示 6x 数字变焦；而前摄 `enableZoom=false` 且不渲染档位药丸 → **无任何手段恢复**，只能翻回后摄。
修复建议：position/device 切换时把 zoom/zoomShared 重置为中性 1（或按 display 1x 换算）。

**[P1] `Container.tsx:243-247,348-354` ↔ `WatermarkStamp.tsx:16-22,47` — 取景水印定位双所有权，6 档仅默认档正确**
问题：Container 用 `styles.watermark`（absolute `right:r(6), top:r(12)`，无尺寸）包裹 WatermarkStamp，而 Stamp 自身又按 `watermark.position` 六选一 absolute 定位——wrapper 唯一子节点是 absolute → Yoga 下坍缩 0×0 锚在屏幕右上：`bottom-*` 档锚到 0 高盒上方（状态栏附近）、`*-center` 档在 0 宽容器内坍缩，**6 个文档化 position 仅默认 `top-right` 预览近似正确**。烧录输出走 `computeWatermarkLayout` 像素空间不受影响，但预览所见非所得。
修复建议：定位单一所有权——wrapper 改 `StyleSheet.absoluteFill`（保留 pointerEvents="none"）由 Stamp 全权定位；补 bottom/center 档快照测试。

**[P1] `Camera.tsx:149-158` + `util.ts:25` — iOS 录像 .mov 容器 vs mime 硬编码 `video/mp4`**
问题：`useVideoOutput` 未传 `fileType`，iOS 默认产出 QuickTime (.mov)；`buildPhotoFile` 把视频 mime 硬编码 `'video/mp4'`（类型 `CustomPhotoFile.mime` 甚至不允许其它值）→ 消费者按 mime 上传/转码会错。
依据：钉版 d.ts `VideoOutputOptions.fileType?: RecorderFileType`（`CameraVideoOutput.nitro.d.ts:99`，注释明示 iOS 默认 'mov'）+ 官方指南 https://visioncamera.margelo.com/docs/guides/recording-videos 。
修复建议：`useVideoOutput` 加 `fileType: 'mp4'`（Android 本就 mp4、忽略该项），或按实际扩展名回填 mime。

**[P2] `useCamera.tsx:21-26` — 二次 open() 覆盖 resolver，首个 Promise 永不 settle**
问题：`open` 无「已打开」守卫，`resolverRef.current = resolve` 直接覆盖 → 第一个调用方 await 挂死；且 Container 不随 config 变化 remount，旧会话 photos/mode 状态串进新会话。
修复建议：二次 open 先把旧 resolver settle（code 0）或直接复用返回同一 Promise；`<Container key={...}>` 绑定会话身份。

**[P2] `Camera.tsx:276-296` — 原生自发停录时文件被静默丢弃、recording 卡 true**
问题：finish 回调只在 `stopVideo` 在飞时才有 resolver；录制被原生侧自行结束（d.ts 实证存在 `'max-duration-reached'` / `'max-file-size-reached'` 等 reason）时 `finishResolverRef` 为 null → 已落盘的文件**直接丢弃**，JS 侧 recording 仍 true（计时继续），用户再按停止 → active 为 null → settle(503)。
修复建议：finish 回调无 resolver 时也回报（新增 onSpontaneousFinish 通知 useVideoRecorder 落 photos 并复位状态）。

**[P2] `Container.tsx:249-267,301` — 烧录/拍摄中保存与切模式不禁用**
问题：SideActions/ModeSwitcherPill 只被 `!recording` 门：烧水印中点「保存」→ `settle(200, photos)` 不含在途那张（**静默丢拍**）；capture 在飞时切模式 → outputs 重挂可致失败路径。快门自身有 `shutterDisabled={capturing}`，但旁路控件没有。
修复建议：capturing/burning 期间禁用保存/切模式（或保存前 await 在途快门）。

**[P2] `FocusIndicator.tsx:56-57` — 动画回调忽略 `finished`，连续对焦点击新点被清**
问题：`anim.start(() => onAnimationEnd())`；动画未完时再次点击 → key 变化旧实例 unmount → cleanup `anim.stop()` 以 `{finished:false}` 同步触发回调 → `setFocusPoint(null)` 把刚设置的新对焦点清掉，新指示环闪现即消失。
修复建议：`anim.start(({finished}) => { if (finished) onAnimationEnd(); })`。

**[P2] `useCaptureFlow.ts:101` vs `:95` — 失败码数据契约自相矛盾**
问题：`settle({code:500, data:photos})` 携带已拍，而 503 分支传 `[]`；CLAUDE.md 与文档明确「取消/失败时 data 为空」。两个失败分支行为不一致，文档与实现也不一致。
修复建议：二选一对齐——改 `data: []`，或文档声明「500/503 携带已拍数据」（后者对消费者更友好，但需同步 docs/llms）。

**[P2] `mock.ts:28-34` — 官方 mock 的 api 身份不稳定**
问题：mock 版 `useCamera()` 每次渲染新建对象与 `jest.fn` → 消费者 `useEffect(...,[api])` 每渲染都触发；文档示例的 `mockResolvedValueOnce` 在组件重渲后失效（fn 已是新实例）。真实实现是 `useMemo` 稳定的。
修复建议：模块级单例或 `useRef` 固定 api，行为对齐真实实现。

**[P3]**（逐条已核实）：
- `Camera.tsx:268-273` — startVideo「已在录」早退分支把已取出/新建的 recorder 既不 dispose 也不放回 ref（泄漏一个原生 encoder/file handle；分支可达性低）；`stopVideo` catch 不清 `finishResolverRef`（stale resolver）。
- `burnWatermark.ts:35-36` / `cropToRatio.ts:55` — `Skia.Font`/`Skia.Paint` 不在 finally dispose 清单（与「Skia 对象逆序 dispose」红线不完全一致，对象小、GC 兜底）。
- `ZoomChips.tsx:114` — render 期间读 `zoomShared.value`（reanimated 4 dev 警告；已有注释说明为 jest/首帧兜底）。
- `PreviewOverlay.tsx:54-57` — `handleSave` 先 `toast('已保存')` 再立即 settle 关 Modal → toast 基本不可见（死代码级 UX）。

**核对通过（未发现问题）**：useCamera resolver 双调/漏调（除二次 open 外）——`settledRef` 一次性守卫 + unmount 兜底闭环；onShutter 各分支 catch 完备无 unhandled rejection；data/image/surface/snapshot 的 finally 逆序 dispose 两文件完备（含早退路径）；定时器/监听清理完备；capturingRef 对快门连点路径成立；worklet 红线全库排查无违例（尺寸全部 worklet 外预算）；热路径零多余重渲染（变焦链 0 setState）。

### 3.4 代码重复率

工具基线：纯源码 **1.40%**（3 克隆），含测试 **2.20%**（10 克隆）。3 处源码克隆逐个裁决如下，测试侧重复是主要增量。

**[P2] `cropToRatio.ts` ↔ `burnWatermark.ts` — Skia 管线骨架整段复制，安全红线靠复制维持**
问题：读 base64→解码→guard→离屏→snapshot→encode(92)→写临时文件→catch 返原图→finally 逆序 dispose 的完整骨架两份（jscpd 12 行 token 级 + 结构 30+ 行）；红线已现漂移——burn 漏 dispose Font+Paint、crop 漏 Paint（见 3.3 P3）。
修复建议：提取 `runSkiaPhotoPipeline(file, outPrefix, process)` 把红线收敛一处，顺带为「16:9+水印单 pass 合成」留接缝（联动 3.5 管线效率项）。

**[P2] `SideActions.tsx:49-60` ↔ `SideRail.tsx:89-98` — makeStyles 逐字相同（连注释）**
问题：rail 玻璃药丸 + r(40) 圆按钮两份字面量（jscpd 26 行），有意视觉同款但靠复制维持，改一处必漏另一处。
修复建议：同目录提 `railStyles.ts` 共享 rail/btn，差异各自保留。

**[P2] 测试 mock 样板重复**
问题：`Container.onError.test.tsx` ↔ `Container.test.tsx` 约 25 行 vision-camera override 块逐字复制（本次比对实证）；`Camera.quality` / `Camera.aspectTransition` 另有近似 device 桩（共 4 处）；`CustomPhotoFile` 测试工厂在 **5** 个测试文件重复（grep 实证；计变体约 7）。`__helpers__/visionCameraMock.ts` 头注释承诺「新增字段只改一处」，但 overrides 已开始漂移。
修复建议：visionCameraMock.ts 增 `grantedPermissionOverrides()` 与 `makeDeviceStub(overrides)`；`__helpers__` 增 `makePhotoFile(overrides)`（jest 已排除 `__helpers__/`，零成本）。

**[P2] `viewfinder.test.tsx` — 与组件级测试近 1:1 冗余**
问题：4 个用例与 `ActionRow.test` / `ModeSwitcherPill.test` 断言基本重合（jscpd 命中），且根级位置不镜像任何源文件，违反「`__tests__` 镜像源码结构」约定。
修复建议：独有断言并入对应组件测试后删除该文件。

**[P2] 死 barrel：`camera/index.tsx`（17 符号仅 Container/ModalView 被消费）/ `components/index.tsx`（零消费者）/ `footer/index.tsx`（仅被死出口引用）**
问题：本次 dump + grep 实证；与 CLAUDE.md「内部不导出」心智相悖，误导读者以为存在更宽的内部契约；`setup/index.tsx` 只出 SideRail 而 Container 对 SideActions 走深路径直引，两种 import 风格并存。
修复建议：camera barrel 裁剪到实际消费的 2 个符号（或 useCamera 改直引后整删）；删 components/footer barrel；setup barrel 补齐或弃用，统一 import 形态。

**[P3]**（语义重复，逐条已核实）：`PreviewTopBar.tsx:13` LABEL ↔ `Container.tsx:206-210` modeItems 同一份中文文案映射两处；`ZoomChips.tsx` 判档式 `display >= ACTIVE_THRESHOLD ? 1 : 0.5` 四处重复（可提 `zoomMath.activeStop()`）；`CameraDialogHost.tsx` showError 自动消失 timeout 体与 `dismissError`(99-106) 重复同一收起逻辑；`{code:0, data:[], message:'cancelled'}` 字面量 5 处（可提 `CANCELLED_RESULT`）；`SlideItem.tsx:29` `'#000'` 字面量（同文件已 import `VIEWFINDER`，其 black 即 '#000'）；`Camera.tsx:172` `pinchActive` 只写不读（onFinalize 整个回调只为写它）；测试 `renderDark` 样板（`<ThemeProvider forceScheme="dark">` 包裹）在 20 个测试文件各写一份（grep 实证），可提 RTL wrapper helper。

**裁决「不该合」**：`NoCamera.tsx:23` ↔ `NoPermission.tsx:35`（jscpd 16 行）——仅结构同型，按钮数量/variant/文案均不同，参数化抽象成本高于重复本身，**维持现状**。反向 YAGNI 检查：capturePhotoHelper / useVideoRecorder / usePermissionFlow / useAppActive 均单调用方但封装了带 why 的安全/状态不变量，判为合理间接层。

### 3.5 最佳实践对齐（官方文档 / llms 核对）

**[P2] `Camera.tsx:123-130` — `'quality'` 按 speed 专属 flag 降级，前提与 SDK 语义不符**
问题：`'quality'` 在 `supportsSpeedQualityPrioritization === false` 的设备被静默降为 `'balanced'`；d.ts 中该 flag 名称与注释（`CameraPhotoOutput.nitro.d.ts:55-58`「otherwise an error will be thrown」上下文）**只关 'speed'**，无任何「'quality' 会 throw」依据——消费者显式要 quality 被无声劣化。代码注释自认「稳妥起见」，属有意保守，但前提可疑。
修复建议：guard 只套 `'speed'`，`'quality'` 直传；同步修订 CLAUDE.md/llms 的「speed/quality 自动降级」表述。

**[P2] `interface.ts:20-24` — `recTime` 标 no-op，但 SDK 已原生支持，一行可接**
问题：JSDoc 称「录像不会到点自动停」；实际 vision-camera 5.x `RecorderSettings.maxDuration` + finish reason `'max-duration-reached'` 已存在（d.ts `CameraVideoOutput.nitro.d.ts:157` / `Recorder.nitro.d.ts:14-15`，本次 grep 实证），`createRecorder({ maxDuration: recTime })` 即接通。
修复建议：接线 recTime → maxDuration（配合 3.3 的自发停录修复一起做，否则到点自动停的文件会走「被丢弃」路径）；同步 docs/llms。

**[P2] `burnWatermark.ts:23` / `cropToRatio.ts:28` + `useCaptureFlow.ts:117-118` — 图片管线三处效率债**
问题：① 读图走 `RNFS.readFile(base64)` → `Skia.Data.fromBase64`，数 MB JPEG 在 JS 堆多扛一份 base64 字符串；Skia 提供 `Skia.Data.fromURI(uri)` 原生直读（d.ts `DataFactory.d.ts:7` 实证）；② 16:9+水印路径串行两轮完整 decode→encode（q92 两次有损再编码、双倍内存峰值）；③ 中间产物 `crop_*.jpg` 不清理。
修复建议：读侧换 `fromURI`；裁切+画字合并单 surface pass 一次编码；管线成功后删中间文件（与 3.4 的管线提取联动，一次重构吃三项）。

**核对通过（未发现问题，关键项带出处）**：
- vision-camera 5.x 全链路 API 形态与官方一致：`usePhotoOutput` 按需加键、`capturePhoto→saveToTemporaryFileAsync→dispose` 序列（https://visioncamera.margelo.com/docs/guides/taking-photos 红线照做）、`zoom={SharedValue}` 直驱（zooming 指南「recommended approach」，https://visioncamera.margelo.com/docs/guides/zooming ）、刻意不开与受控 zoom 互斥的 `enableNativeZoomGesture`（d.ts @throws 实证）、`startRecording` 四参签名、`isActive` 前后台 gate（lifecycle 指南）、`physicalDevices` 命名（devices 指南）、`onSubjectAreaChanged→resetFocus`（d.ts 推荐用法）——未发现弃用 API。
- reanimated 4.x：`createAnimatedComponent(TextInput)` + `useAnimatedProps` 写 `text` 是官方范式；worklet 内禁 Remote Function 的红线已制度化（注释 + CLAUDE.md + 测试）。
- Skia：`MakeOffscreen → makeImageSnapshot → encodeToBase64 → finally 逆序 dispose` 与 headless 文档同模式（https://shopify.github.io/react-native-skia/docs/getting-started/headless/ ）。
- **本库 llms-full.txt 与实现一致性**：OpenConfig 全字段、result codes 六码表、水印行为、画幅默认 16:9 + 拍后裁切逐项比对一致（https://unif-design.github.io/react-native-camera/llms-full.txt ）。⚠️ 若修复本报告的 mime/recTime/500 数据契约项，**必须同步 website/docs 并重新 build:llms**，否则产生新漂移。

### 3.6 代码规范

**[P2] `interface.ts:14` — 公开 API `flashMode` JSDoc 与实现相反**
问题：JSDoc 写「闪光由相机内 UI 控制，不从 config 接线」，实际 `Container.tsx:136-139` 接线为初始闪光（CLAUDE.md 也明示「接线为初始闪光」）——IDE 悬浮提示直接误导消费者。
修复建议：改 JSDoc 为「接线为初始闪光（首项生效）」。

**[P2] `.gitignore` — 缺 `coverage/`**
问题：`yarn test --coverage` 产物未被忽略（本次实测 `?? coverage/`），一次 `git add .` 即会提交测试产物。
修复建议：`.gitignore` 增加 `coverage/`。

**[P2] `.github/workflows/ci.yml:65-79` — changes filter 缺 `example/**`**
问题：filters 只有 shared/js(`src/**`)/android/ios——仅改 example 的 PR 跳过全部 lint/test/build，而根 `yarn lint` glob 实际覆盖 example/，坏改动落 main 后由后续无关 PR 的红灯买单。
修复建议：`example/**` 并入 `code`（或独立 filter 触发构建）。

**[P2] 行为测试盲区（`__tests__` 镜像树对照实证）**
问题：① 结果码核心契约 403（denied→NoPermission→settle）与 404（device==null→NoCamera）路径**零行为测试**（grep 仅类型字面量命中）；② `capturePhotoHelper.ts` 零测试引用（grep=0，dispose 红线无守护）；③ `Carousel.tsx` 注释自述修过 #2/#3 回归，但 RNCarousel 被桩成 View 后**无人断言 key/defaultIndex** ——本报告 P1#2 正是这里缺测试放过的；④ ModalView/NoCamera/NoPermission/Loading 无直接测试。
修复建议：优先补 403/404 路径与 Carousel remount 行为测试（修 P1#2 时按 TDD 先写失败测试）。

**[P3]**（逐条已核实）：
- `tsconfig.build.json:3` — exclude 整组覆盖父配置且缺 `src/__tests__`/`jest.setup.ts` → `lib/typescript/src/__tests__/` 与 `lib/typescript/jest.setup.d.ts` 实际生成（ls 实证），后者不被 `files` 负向匹配、会随包发布（无害但脏）；补 exclude 让产物对称。
- `src/utils/px-to-dp.tsx` — utils 唯一 kebab-case 命名 + 无 JSX 用 `.tsx`（另有 9 个 index.tsx 同样无 JSX）；`pxToDp`/`depsAreSame` 仓内零使用、与 design `r()` 功能重叠（CLAUDE.md 声明有意公开 → 仅建议文档标 legacy、下个 major 评估）。
- `Container.tsx:35,40,373` — 「本批再减半 r(4)→r(2)」批次相对注释 ×3 + 「见 IMG_1193」仓外引用：随时间失效、读者无法查证，偏离「注释记录 why」标准。
- `ci.yml:130` — `--coverage` 收集但无 coverageThreshold、不上传报告，纯耗时无 gate。
- `WatermarkStamp.tsx:47` `zIndex: 7` 与 `Container.tsx:44` `Z.overlay = 7` 重复定义层级常量。
- `package.json:46` lint glob `**/*.{js,ts,tsx}` 漏 `.mjs`/`.jsx`（eslint.config.mjs 自身不被 lint），与 lefthook 的 glob 不一致。
- 测试侧 `as any` 桩 SharedValue（ZoomChips.test ×3、jest.setup ×8）——可选收紧为 `as unknown as SharedValue<number>`。

**核对通过（未发现问题）**：TS 严格度（strict 全家桶 + noUncheckedIndexedAccess + verbatimModuleSyntax + noUnused\*，生产码零 any）；全仓仅 1 处非空断言（有 guard）、1 处 `@ts-expect-error`（带理由且正是测试意图）、1 处 eslint-disable（有注释）；import 顺序与命名模式全仓一致；commitlint/lefthook/release 链路闭环；builder-bob exports 三元组与产物一致。

---

## 4. 做对的地方（经核实）

审查不只挑刺——以下设计经逐项核实**正确且不该动**，是本库的护城河：

1. **`useCaptureFlow.ts:74-86` capturingRef 同步防重入** + `shutterDisabled` 双保险：精准解决 state 异步挡不住同帧连点的 UHD capture/Skia 并发 OOM（2.17.1 真实事故），且 `useCaptureFlow.test.ts:69` 直接回归测「疯狂连点 → capture 只调一次」——事故→防御→测试的完整闭环。
2. **`Container.tsx:56-77` settledRef 一次性 settle + unmount 兜底**：resolver 不可能双调、组件销毁不漏调，Promise 生命周期干净（本次质量镜头专项排查通过）。
3. **`Camera.tsx:305-322` stopVideo 等 `onRecordingFinished` 回调**而非轻信 `stopRecording()` 的 resolve——官方明示后者「stop 被请求时就 resolve」，这是高频接入坑，处理正确。
4. **0-setState 变焦链路**（`Camera.tsx:204-237` pinch 直写 SharedValue + `ZoomChips` animatedProps 写 TextInput.text）：与 vision-camera zooming 指南推荐路径完全重合，worklet 内只用预算好的数字常量，2.15.1 fatal 教训制度化执行。
5. **`capturePhotoHelper.ts:24-40`**：把官方「capture→saveToTemp→dispose」易错序列收进 20 行适配器，SDK 形态变化影响面压到单文件。
6. **`burnWatermark.ts:60-68` 失败返原图绝不阻断保存 + finally 逆序 dispose**，`cropToRatio` 整套复刻——同类能力失败语义子树内一致（本次发现的 Font/Paint 漏 dispose 恰说明该提取共享管线，见 3.4）。
7. **`usePermissionFlow.ts:21-35`**：`cancelled` 守卫防卸载后 setState + `.catch` 兜 vision-camera #3834，注释锚 issue 号。
8. **`Camera.tsx:346-365` recorder 卸载清理**区分 active（cancelRecording 异步删临时文件）/ prepared（dispose 同步释放），并写明 cleanup 吞 throw 的原因。
9. **CI 供应链卫生一流**：全部 action SHA-pin、workflow 级最小权限、actionlint+shellcheck 自检、release 防自触发三道防线逐条注明 why。
10. **`tsconfig.json` 严格度高于社区模板**（customConditions + noUncheckedIndexedAccess + verbatimModuleSyntax），且生产码真正做到零 any、零未说明 suppression。
11. **公开面收敛到极致**（`src/index.tsx` = 1 hook + utils）：消费者永远碰不到 vision-camera `<Camera>`，封装边界判断正确。
12. **`CameraDialogHost.tsx` 弹层自洽**：confirm/toast/showError 集中单文件、Modal 子树内渲染，「改 dialog 只动这一个文件」承诺与实现一致；errorSlideY 在 worklet 外预算。
13. **注释 why 标准真实落地**（抽查 15+ 文件）：非显而易见决策处处有据可查，无 TODO/FIXME 残留——本报告大量结论能快速核实，正是这些注释的功劳。
14. **选型判断力**：fs 选 fork 弃停更原版、video 7 beta 是接 Nitro 的唯一可行解、carousel beta 线是 reanimated 4 唯一兼容线——三个「不得不」都判断对了。

---

## 5. 附录

### 方法论

按已批准设计文档执行：① 工具硬数据（typecheck/lint/coverage/jscpd×2/LOC+import 清单）；② 五个并行只读 subagent 镜头（架构 / 质量 / 重复与简化 / 技术选型与最佳实践(联网) / 规范与工程），各自带完整 prompt 通读源码；③ 主会话逐条读原文核实（文件+行号+真伪+严重度裁决）、跨镜头去重、组装本报告。五镜头原始输出与核实台账存档于 `/tmp/audit/`（lens-{arch,quality,dup,bestpractice,convention}.md + verified.md）。

### 核实统计

- 五镜头原始发现 **58** 条（含跨镜头重叠）→ 合并去重 **50** 条独立项
- **确认 49 / 结论修正 1 / 直接驳回 0**；另有 1 处工具克隆裁决「不该合」（不计问题项）
- 修正案例：GH3「移除 builder API → 新装即崩」经 WebFetch 官方升级指南复核为「弃用 + Legacy 兼容」，P1→P2 并改写结论——所有 P1/P2 均经主会话读原文或工具实证，未发现 agent 虚构行号
- 跨镜头严重度裁决 5 起（水印定位 P1、recorder 早退 P3、flashMode JSDoc P2、死 barrel P2、photo 工厂数量 7→5）
- 严重度分布：**P0×0 / P1×5 / P2×22 / P3×23**

### 局限声明

- **纯静态审查**：未做真机验证。以下结论基于代码与官方文档推理、需真机坐实：水印 bottom/center 档实际错位形态（Yoga 规则推理，置信高）、RNCarousel offset 保留行为、原生自发停录的回调时序、EXIF 横拍图经 Skia 重编码的方向表现、连拍内存峰值、GH3 实际兼容性。
- vision-camera zooming 指南「always start at zoom 1」在 vzf/用户倍数两个空间的指向官方文档自身存在歧义（d.ts 两处示例互相矛盾），对「默认停在 0.5x 超广角」这一刻意产品决策**不下对齐结论**。
- 版本对照为审查时点（2026-06-10）快照；`@unif/react-native-design` 内部实现未读源码（按其发布的 peerDependencies 推断）。
- `example/` 与 `website/` 按既定范围未审（仅 CI 对它们的 gating 在 3.6 涉及）。

### 修复优先级建议（供排期参考，非本报告范围）

1. **一行级速修**（半天内）：flashMode JSDoc、.gitignore coverage、GH peer 上界、FocusIndicator finished、500 数据契约二选一
2. **P1 行为修复**（各半天~1 天，建议 TDD 先补失败测试）：假录制 503、Carousel key、翻转重置 zoom、水印 wrapper、video fileType/mime
3. **结构性重构**（择期）：Skia 管线提取（顺带 fromURI/单 pass/临时文件清理/Font dispose 四合一）、useCaptureFlow 收回裸 setter、测试 helper 收敛、死 barrel 清理
