# 相机 UI Phase 2a — 取景态重写 设计

> **Phase 2a**(共 3 阶段分解之第 1 阶段)。按 Claude Design 原型(Camera Prototype.html)全量重写相机界面的「取景态」(S1–S7)。
> 像素级 UI 规格见 [2026-05-29-design-spec-digest.md](../research/2026-05-29-design-spec-digest.md)，本 spec 不重复像素值，只定**架构、组件契约、决策、API、测试、范围边界**。

**目标(一句话):** 把相机「取景/拍摄」界面按设计稿重写为单手可达的现代相机 UI，保持 `open()` 调用契约不变，作为可独立验收的里程碑。

**库现状:** 2.6.1，公共 API 已对齐原版 v1.2.5，Bug1(portal 多模式透传)/Bug2(取景 letterbox)已修。取景器 letterbox(4:3/16:9)已就位。

---

## 1. 分解与范围

Phase 2 拆为 3 个独立子项目(各自 spec → plan → 实现 → 验收):

| 阶段 | 内容 | 状态 |
|---|---|---|
| **2a 取景态(本 spec)** | S1–S7:取景器 + 左下侧栏 + 变焦芯片 + 模式胶囊 + 多态快门 + 返回/保存 + 缩略图 + 翻转 + 聚焦/白屏闪/录制计时动画 + 固定深色基座 | 设计中 |
| 2b 预览态 | S8–S12:全屏上滑预览 / 确认页 / 回看页 / 类型 tab / 左右滑翻页 / 二次确认弹窗 / Toast | 待 brainstorm |
| 2c 水印(显示 + 烧图) | 取景右上叠加显示 + 拍后 `react-native-view-shot` 烧进成片 + `WatermarkType` 入参(对齐原版) | 待 brainstorm(**方案重新讨论**) |

**2a 不含:** 预览/确认/回看界面重写(2b 不动 `preview/*`)、**水印(显示+烧图整体归 2c,方案待重新讨论)**。

---

## 2. 锁定的决策

1. **结束/取消 → 快门两侧 `返回` / `保存` 按钮**(用户定)。`返回`(快门左)=取消→`settle(cancelled, code 0)`,同时即"关闭"(不另设左上角 ×)。`保存`(快门右)=结束→`settle(200, photos)` 直接返回已拍照片(单拍返回那张/连拍返回全部),**取景态自洽、不依赖 2b 预览**。
2. **水印**:**整体移出 2a**(取景显示 + 烧进成片都归 2c),方案由用户要求**重新讨论**;2a 不做水印、不加相关 API。
3. **模式切换器**:自定义 `ModeSwitcherPill`(圆角胶囊 + 橙滑块 240ms),**弃用** design 的 `Segmented`(方角不匹配)。顺序固定 连拍/单拍/视频;单模式只显示居中文字 label。
4. **连拍**:连点累积(每点一张 append),非长按;缩略图橙角标计数;"结束"= 点保存返回全部。
5. **声音图标**:design system 缺 volume,本库用 `react-native-svg` 内联自绘 on/off 两个;标记为可上游候选。声音开关控制 `enableShutterSound`。
6. **取景态固定深色**:白/黑/橙常量(新建 `colors/dark.ts`),**不走 `useColors()`**。取景器恒深色是相机特例,只有预览/弹窗/Toast(2b)跟随主题。品牌橙 `#EB6E00` 写死。
7. **运行时前后摄翻转**:2a 新增(设计 S7),当前库仅设初始 position;翻转 = device position state + rotateY 3D 动画。
8. **缩略图**:点击进**现有** `PreViewContainer` 复看(2b 再重做),`preview/*` 本阶段不动。

---

## 3. 架构 / 状态机 / 数据流

`Container.tsx` 仍是编排中枢,**状态机骨架不动**(权限 pending/denied/granted、设备、photos、recording、modeIndex、flash、aspect、zoom、previewing 入口)。2a 只重写"取景态"渲染层并增强能力。

**取景态渲染层**(替换现 `SetUp` + `Footer`)= 新容器组合:
`SideRail`(左下) · `ZoomChips`(底部居中) · `ModeSwitcherPill` · `Shutter` · `ActionRow` · `FocusIndicator` · `CaptureFlash` · `RecordingTimer`。全部固定深色。

**数据流(2a 自洽):**
- **拍后是否自动进预览 = 看数据模式 + 类型**(对齐设计稿):**仅「非保留(clear) + 单拍」**拍完自动进**现有** `PreViewContainer`(确认页 重拍/保存);**其余**(保留任意 / 连拍 / 视频)**静默累积**,靠**保存**结束、缩略图复看。其确认页/回看页的**视觉重写**是 2b,2a 沿用现有 `PreViewContainer`。
  - 即 `onShutter` 后:`single && dataRetainedMode==='clear'` → `setPreviewing(true)`;否则累积(现 `Container` 是 `mode!=='continuous'` 就进预览,需改为按「非保留+单拍」判断,视频也改为累积)。
- 快门 → `Camera.capture()` / `startVideo()`+`stopVideo()` → `buildPhotoFile` → 累积 `photos`。
- **保存** → `settle(200, photos)`(直接结束)。
- **返回** → `settle(cancelled)`。
- **缩略图** → `setPreviewing(true)` 进现有 `PreViewContainer`(复看;2b 重做)。
- 切模式 + `dataRetainedMode==='clear'` → 清空 `photos`(现有逻辑)。
- **翻转** → 切 `position` state('back'⇄'front')→ `useCameraDevice` 换 device + rotateY 动画。

**新增能力(当前库没有):** 运行时翻转(S7) · ZoomChips(.5/1/2x) · 聚焦/白屏闪/录制计时动画。

**录制态(S4):** `recording===true` 时隐藏 侧栏/变焦/缩略图/翻转/模式切换器,模式区改为 `RecordingTimer` 胶囊;`Shutter` 内圈变红圆角方块。

---

## 4. 底部布局(取景态)

```
 ┌──────────────────────────────────────┐
 │              连拍   单拍   视频          │  ← ModeSwitcherPill(橙滑块)
 │                                        │
 │  [缩略▦]  返回    ( ◉快门◉ )    保存  ⟲  │  ← ActionRow
 └──────────────────────────────────────┘
    角标计数  取消      拍/录      结束  翻转
```

`ActionRow` 一行从左到右:`ThumbnailStack`(44,橙角标) · `返回`(文字按钮) · `Shutter`(72) · `保存`(文字按钮) · `FlipButton`(44)。缩略图/翻转在最外侧角落(设计稿原位),返回/保存贴快门两侧。安全区底部用 `useSafeAreaInsets()`(不硬编码 34)。

---

## 5. 组件分解(单一职责 · 固定深色 · 可独立测)

| 组件 | 职责 | 关键 props / 状态 | 现状 |
|---|---|---|---|
| `colors/dark.ts` | 取景态固定深色常量 | `WHITE/BLACK/ORANGE(#EB6E00)/…` 及透明度档 | 新建 |
| `SideRail` | 左下竖排玻璃药丸:宽高比/闪光/声音/网格 + 闪光向右下拉 | `aspect,flash,sound,grid` 值 + onChange;`recording` 隐藏 | 由 `SetUp` 改写 |
| `ZoomChips` | 底部居中 .5/1/2x 玻璃芯片 | `zoom` + onSelect;`recording` 隐藏 | 新建 |
| `ModeSwitcherPill` | 圆角胶囊 + 橙滑块动画 | `modes,currentIndex,onSelect`;单模式→文字 label;`recording` 隐藏 | 替换 `Segmented` |
| `Shutter` | 多态:白圆/红圆/红圆角方块 + 按下缩放 | `mode,recording,disabled,onPress` | 由 `Footer` 内联改写 |
| `ActionRow` | 底部一行布局容器 | 组合 缩略图/返回/快门/保存/翻转 | 替换 `Footer` actions |
| `ThumbnailStack` | 缩略图 + 橙角标 + bump | `latest,count,onPress` | 由 `PreviewThumbnail` 改写 |
| `FlipButton` | 前后摄切换按钮 | `onFlip` | 新建 |
| 翻转动画 | rotateY 180° 360ms(S7) | 包裹取景器,翻转时触发 | 新建(在 `Camera`) |
| `FocusIndicator` | 四角括号 + 中心点 + 曝光小太阳 + 多段动画 | `point` | **重做** |
| `CaptureFlash` | 全屏白 overlay 220ms(S5) | `trigger` | 新建 |
| `RecordingTimer` | 红点闪烁 + MM:SS(S4) | `seconds` | 新建 |

> 像素值(尺寸/圆角/透明度/动画曲线/时长)一律引用 digest 第 3 节,实现时按 `r()`/`rf()` 缩放,安全区用 insets。

---

## 6. API 影响(2a)

- **`返回`/`保存`**:复用现有 `settle(cancelled)` / `settle(200, photos)`,**`open()` 契约完全不变**。
- **初始闪光**:从 `config.cameraMode[0].flashMode` 接初值(现 `flash` 默认 'off' 未接线;顺手接上,符合 API 兼容)。
- **宽高比 / 声音 / 网格 / 变焦 / 翻转**:内部 UI 状态,不进 API。
- **水印**:**2a 不动 API**;re-add `watermark` 到 `OpenConfig` 随水印方案在 **2c** 决定。

> 即:2a 无任何破坏性 API 变更,公共类型零改动。

---

## 7. S1–S7 状态映射(本阶段覆盖)

| 状态 | 落地 |
|---|---|
| S1 取景(单拍) | 默认态,全组件组合(不含水印,水印归 2c) |
| S2 取景(连拍) | 快门视觉同 S1,靠缩略图橙角标区分 |
| S3 取景(视频待录) | `Shutter` 内圈红实心圆 |
| S4 录制中 | 隐藏控件 + `RecordingTimer` + `Shutter` 红圆角方块 |
| S5 拍照白屏闪 | `CaptureFlash` |
| S6 点击聚焦 | `FocusIndicator`(重做) |
| S7 翻转 | device position 切换 + rotateY 动画 |

S8–S12(预览/弹窗/Toast)属 2b,不在本阶段。

---

## 8. 测试策略

jest + `@react-native/jest-preset`;`jest.setup.ts` mock design system(passthrough)+ vision-camera。

- **组件渲染**:各新组件在 mock 下 `not.toThrow()` + 关键 `testID`(沿用现有降级断言模式,因 design mock 渲染为 passthrough/null)。
- **状态机**(`Container`):保存→`settle(200,photos)`、返回→cancelled、切模式 clear→清空、连拍累积计数、视频 start/stop、翻转切 position、**「非保留+单拍」拍完进预览** / **「保留+单拍」累积不进**。
- **纯逻辑单测(真实跑)**:`RecordingTimer` 的 MM:SS 格式化、zoom→scale 映射、角标计数。
- **动画类**(白屏闪/聚焦/翻转/快门):只断言挂载不崩 + 触发回调不报错(mock 下动画不可视断言)。

---

## 9. 范围边界

**做(2a):** 取景态全部视觉与交互(S1–S7)、固定深色基座、运行时翻转、ZoomChips、返回/保存结束逻辑、初始闪光接线、声音内联图标。

**不做:** 预览/确认/回看的**视觉重写**(S8–S12,2b;2a 沿用现有 `PreViewContainer`,「非保留+单拍」拍完仍自动进它)、二次确认弹窗/Toast(2b)、**水印(显示+烧图,2c,方案重新讨论)**、长按连拍、视频播放控件。

---

## 10. 待实现时确认的细节(open items)

1. **水印整体归 2c**:届时单独 brainstorm 方案(取景显示 vs 烧进成片、`WatermarkType` 字段、`react-native-view-shot` 时序、内容来源等),2a 不预设。
2. design system 是否真缺 volume 图标 → 实现时复核 `IconName`;确缺则内联 SVG。
3. 设计稿魔数(`top:50/200`、`bottom:172/184` 等)→ 一律换算为比例 + 安全区 insets,不照搬。
4. 数字变焦:用 vision-camera `zoom` prop,**不照搬**原型 `scale` hack。
5. 翻转动画与 vision-camera device 切换的时序(避免黑帧)→ 实现时调。
