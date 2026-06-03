# Camera UI 原型对齐 + 弹性布局重构 + 两个 bug 修复

- **日期**:2026-06-03
- **分支**:`feat/camera-ui-prototype-align`(基于 main,2.8.3)
- **设计来源**:Claude Design handoff bundle `Camera Prototype.html`(React 原型,多轮迭代)
- **触发**:真机 UI 与原型「差距很大」+ 切换摄像头比例错乱 + 0.5x 在不支持超广角设备上仍显示

## 1. 背景与目标

经逐组件对比,真机与原型的差距**主要来自结构,而非视觉零件**:

- footer 零件(ModeSwitcherPill 半透明橙滑块 / Shutter 72·58·红方块 / ThumbnailStack 44+橙徽标 / FlipButton)**视觉已基本对齐原型**。
- 真正的差距是:**底部五件套**(缩略图|返回|快门|保存|翻转)vs 原型三件套;以及**满屏 `position:absolute` + 魔数定位**(`insets.bottom + r(172)` 等),后者是真机变焦芯片偏移、SideRail 位置漂移、以及切换摄像头后取景比例错乱的根源。

本次三个目标:

1. **取景底部对齐原型三件套**,完成/保存出口下沉到预览页(交互结构 A,见 §3)。
2. **弹性布局优先**:能用 flex 就不用 absolute,消除魔数定位(用户硬约束)。
3. **修两个 bug**:0.5x 按设备能力隐藏;切换摄像头后取景比例错乱。

**非目标**(YAGNI):不改 `open()` 的对外契约(入参/返回 `CameraResult` 不变);不改水印烧图;不改 vision-camera 拍照/录制底层;不引入新依赖。

## 2. 布局重构(弹性布局优先)

### 2.1 取景框 `Camera.tsx`(核心,也是比例错乱的修复)

**现状**:
```js
const frameW = screenW;                  // 整窗宽(useWindowDimensions)
const frameH = screenW * frameRatio;     // 手算高度
// root: StyleSheet.absoluteFill + center;  frame: { width:frameW, height:frameH }
// 翻转: Animated.View 包 frame,transform:[perspective(1000), rotateY(0→180→0)]
```

**问题**:手算 `frameH` + `absoluteFill 居中` + 翻转 3D transform 三者耦合,在 device 切换重渲染时高度方向居中失效 → 画面偏下、顶部黑边过大(图1)。

**改为**:用 RN 的 **`aspectRatio` 属性**让布局引擎按比例自适应并居中,不再手算尺寸:
```jsx
// root: { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'#000' }
// frame: { width:'100%', aspectRatio: 3/4 或 9/16, overflow:'hidden' }
//   注:aspectRatio = 宽/高。4:3 竖屏取景 → 宽:高 = 3:4 → aspectRatio = 3/4;16:9 → 9/16。
```
- 删除 `frameW` / `frameH` / `screenW`(`useWindowDimensions` 若仅此用途一并删)。
- frame 宽度撑满容器,高度由 `aspectRatio` 推导,`justifyContent:center` 垂直居中 → **不依赖整窗宽假设,切换后也由布局引擎保证居中**。

**翻转动画**:保留 rotateY 视觉,但确保不破坏 layout:
- `Animated.View` 加 `backfaceVisibility:'hidden'`,避免 180° 时镜像闪现。
- transform 只作用于视觉层,不参与尺寸计算(aspectRatio 已脱离手算)。

**验证**:jest 到不了取景态,**必须真机**前后摄翻转 + 4:3/16:9 切换,确认画面始终居中、比例正确、无黑边异常。

### 2.2 主骨架 `Container.tsx`

**现状**:Camera(absoluteFill)之上叠 4 个 `position:absolute` + 魔数的层:
```
sideRail:  { position:absolute, left:r(12), bottom: insets.bottom + r(172) }
zoomChips: { position:absolute, left:0, right:0, bottom: insets.bottom + r(184), alignItems:center }
bottom:    { position:absolute, left:0,right:0,bottom:0, paddingBottom: insets.bottom + r(20) }
```

**改为 flex column 三段**:
```
<View flex:1 column>
  <TopBar/>                          // 新增:顶部栏(取消 X + 状态留白),flex 自然高度
  <View flex:1 取景区>                // Camera 填充 + overlay 锚定在此容器内
     <Camera/>                        // 绝对填充取景区(absoluteFill 仍合理:它就是要铺满取景区)
     <WatermarkStamp/>  右上          // overlay:alignSelf/绝对锚定取景区内,非全屏魔数
     <SideRail/>        左下
     <ZoomChips/>       底部居中
     // 聚焦框 / 快门白闪 已在 Camera 内
  </View>
  <BottomControls/>                  // 模式pill + [缩略图|快门|翻转],flex 自然高度
</View>
```
- overlay(水印/SideRail/ZoomChips)仍需叠在画面上,**但锚定在「取景区」这个 flex 容器内**,用 `position:absolute` 贴边 + flex 对齐(`alignItems`/`justifyContent`/`alignSelf`),**去掉 `insets.bottom + r(172)` 这类全屏魔数**。这是「能 flex 就 flex,overlay 才用最小必要 absolute」的落地。
- 安全区 `insets` 只在 TopBar(顶部)和 BottomControls(底部)用 padding,不再散落在每个 overlay 的 bottom 魔数里。

## 3. 交互流程(出口结构 A)

取景底部去掉「返回/保存」,改三件套;完成/取消出口重新组织:

| 数据模式 | 拍摄 | 完成出口 | 取消出口 |
|---|---|---|---|
| **单拍·非保留**(`dataRetainedMode='clear'`) | 拍完自动进 **confirm 预览** | confirm 底部 **保存**(`settle 200, data=[这张]`) | confirm 底部 **重拍**(回取景);取景顶部 **X**(`settle 0 cancelled`) |
| **连拍 / 保留 / 视频** | 累积,缩略图显示最新+计数 | 点缩略图进 **gallery 预览** → 底部 **完成**(`settle 200, data=全部`) | gallery 底部 **返回**(回取景继续拍);取景顶部 **X** |

**取景顶部 X(取消)**:点击时若 `photos.length > 0` → 弹二次确认「放弃已拍 N 张?」→ 确认才 `settle({code:0, cancelled})`;未拍则直接取消。

**gallery 底部按钮**:`返回 | 删除 | 完成`(完成为 primary 橙)。「完成」是本次新增——原型 gallery 只有返回/删除,缺真实库需要的「提交全部」出口。

**模式切换**:非保留模式切换拍摄类型且已拍>0 → 弹「切换将清空已拍照片?」确认(沿用现有 `onSelectMode` 逻辑)。

## 4. 两个 bug

### 4.1 0.5x 按设备能力隐藏

**现状**:`ZoomChips` 写死 `STOPS = [0.5, 1, 2]`,不看设备。

**改**:`ZoomChips` 接收 `minZoom`(从 `device.minZoom` 传入),`0.5` 档**仅当 `minZoom <= 0.5` 才渲染**(无超广角设备 `minZoom===1`,不显示 0.5)。其余档位(1/2)保留,但 `2` 也应 `<= maxZoom` 才显示(顺带健壮性)。文案 `0.5` → `.5`(对齐原型去前导 0)。

### 4.2 切换摄像头比例错乱

**主修**:§2.1 的 `aspectRatio` 重构(消除手算尺寸 + absoluteFill 居中失效)。

**附加加固**(对齐原型 app.jsx 的 flip 逻辑):
- `onFlip` 加 `flipping` 防重入标志,动画期间忽略重复点击。
- 切 position **延迟到动画中点**(原型 180ms),而非立即切,避免画面与动画不同步。
- `backfaceVisibility:'hidden'`(见 §2.1)。
- 切换后若当前 `zoom` 超出新设备 `[minZoom,maxZoom]`,clamp 回合法范围(防前后摄变焦范围不同导致越界)。

**验证**:真机前后摄反复翻转、快速连点、切换后变焦,确认无错位/无残留/无越界。

## 5. 视觉细节对齐

- **SideRail**:容器加 `inset 1px rgba(255,255,255,0.08)` 高光边(原型 `boxShadow: inset 0 0 0 1px ...`,RN 用 `borderWidth:1 + borderColor` 近似);闪光弹层加指向按钮的尾巴三角(45° 旋转小方块)。
- 其余 footer 零件(pill/shutter/thumb/flip)已对齐,保持不动。

## 6. 图标

核对 `@unif/react-native-design`(113 图标):设计**实际渲染**用到的图标库里全有。仅 `video`、`timer` 缺,但**原型并未渲染它们**(录制=红点+计时文字、视频快门=红圆/方块),**本次不需要、不阻塞**。`check-circle` 用现成 `success`(圆圈勾)替代。

新增用到的图标(均已存在):`close`(取消X)、`check`(完成/保存)、`refresh`(重拍)、`chevron-left`(返回)、`trash`(删除)。→ **暂不需要 design 补图标**。

## 7. 组件改动清单

| 组件/文件 | 改动 |
|---|---|
| `Camera.tsx` | 取景框 absolute+手算 → flex+`aspectRatio`;翻转加 backfaceVisibility;切换 clamp zoom |
| `Container.tsx` | absolute 魔数 → flex column 三段;onFlip 防重入+延迟切;X 取消+二次确认;传 `minZoom` 给 ZoomChips |
| **新增** `TopBar`(取景顶部) | 左 X(取消);flex 布局,`insets.top` padding |
| `footer/ActionRow.tsx` | 五件套 → 三件套(缩略图\|快门\|翻转),删 onBack/onSave 渲染 |
| `footer/ZoomChips.tsx` | 接 `minZoom`,按能力过滤档位;`0.5`→`.5` |
| `setup/SideRail.tsx` | 加 inset 高光边 + 闪光弹层尾巴三角 |
| `preview/PreviewBottomBar.tsx` | gallery 底部加「完成」按钮(primary);现状 返回\|删除 → 返回\|删除\|完成 |
| `preview/PreviewOverlay.tsx` | 透传 onComplete(完成=settle 全部);确认 confirm/gallery 两态与 §3 一致 |
| `Container.tsx`(保存逻辑) | handleSave 拆分:confirm 保存=这张/这批;gallery 完成=全部 |

## 8. 测试策略

- **jest**(改组件的单测):ZoomChips 按 minZoom 渲染档位;ActionRow 三件套快照;PreviewBottomBar gallery 含完成按钮;TopBar X 触发 onCancel;SideRail 视觉。jest mock 下取景态(device-ready)不可达,**布局/翻转/比例不能靠 jest 验证**。
- **真机回归**(必须,人工):①前后摄翻转画面居中/比例正确/无残留;②4:3↔16:9 切换;③无超广角设备不显示 0.5x;④单拍非保留 confirm 保存/重拍;⑤连拍 gallery 完成/返回/删除;⑥取景 X 取消(含已拍二次确认);⑦视频录制态。
- 全套 `yarn typecheck && yarn test && yarn lint && yarn prepare` 绿。

## 9. 风险

- **比例错乱根因未 100% 静态锁定**:用 flex+aspectRatio 结构性消除 + 真机验证兜底。若真机仍错位,再按瞬态/动画方向深挖(systematic-debugging)。
- **gallery「完成」是对原型的扩展**:原型无此出口,属真实契约需要,已在 §3 标注。
- 取景态无法 jest 覆盖,依赖真机回归——务必执行 §8 清单。
