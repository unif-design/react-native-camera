# 相机界面设计稿消化 — UI 规格

> 来源:Claude Design 导出 `/tmp/camera-design/camera/`
> 主设计文件:`project/Camera Prototype.html`(React + Babel CDN 原型,纯 inline-style)
> 完整对话:`chats/chat1.md`
> 消化日期:2026-05-29
> 目标:为 `@unif/react-native-camera` 重写相机界面提供像素级 UI 规格

**重要前提**:这是一个 HTML/JSX 网页原型(用 inline style 写的),不是 RN 代码。下面所有数值都从原型 CSS 直接提取。原型用 `390×844` 的 iPhone 外框(`IOSDevice`)来模拟,所有绝对定位坐标都是相对这个 390×844 视口的 **px**(不是 dp/pt)。落地 RN 时需要按比例转换(原仓库用 `r()`/`rf()` 做缩放)。

---

## 1. 用户意图(来自 chat1.md)

对话是中文的,用户是 Unif(统一/零售拜访)业务方。原型定位:**便利店/商超业务员"拜访记录"拍照**。迭代了 7 轮,意图非常清晰。

### 初始诉求
> "基于 camera 项目设计一版新的原型图,支持点击切换等效果"

助手识别出这是 Unif 零售业务员的相机 SDK,支持 **单拍 / 连拍 / 视频** 三模式、前后摄像头翻转、闪光 自动/开/关、音量、宽高比、水印、单图与多图预览。

### 迭代轨迹(每一轮用户改了什么)

1. **第 1 版**:iOS 外框 + 全套相机 UI。顶部工具栏(宽高比/闪光/音量/网格/水印) + 取景器 + 底部(模式胶囊 + 快门 + 翻转 + 缩略图)。模式切换支持「胶囊」和「滚轮」两种样式(Tweaks 可切)。

2. **"需要深色亮色模式"** → 加了 light/dark 主题。**关键取舍**:主题只影响 "chrome"(页面背景、手机边框、预览页、弹窗、Toast);**取景器本身永远是深色**(因为它是相机画面)。

3. **大改:控件全部下沉到拇指区**(用户说要单手可达)→ 删掉顶部工具栏,5 个常用按钮(宽高比/闪光/声音/网格/水印)下沉到模式切换器上方,做成圆形 chip + 文字标签。闪光下拉改为向上弹出。

4. **"水印不需要,水印是代码控制的,然后竖着排在右侧"**
   - **明确否决**:水印不再是可点击按钮 → 改为纯展示,由代码/参数控制。
   - 剩下 4 个开关(宽高比/闪光/声音/网格)改成**竖排侧边栏**,贴右边缘。

5. **"右上角的菜单移到左下角,和水印互换,聚焦的样式优化"** + 拍照后返回/保存逻辑大改:
   - 侧边栏 → 移到**左下角**(单手右拇指可达);水印 → 移到**右上角**。
   - **聚焦样式重做**:四角括号取景框 + 中心点 + 右侧曝光小太阳,带"放大→回弹→闪烁定格"动画。
   - **拍后逻辑**(核心业务规则):
     - 单拍:拍完进确认页,底部 **重拍 / 保存**,顶部不再有返回/保存。
     - 连拍/视频:点缩略图进回看页,底部 **返回 / 删除**,顶部也无按钮。
     - **保留模式 vs 非保留模式(参数控制,相机上不体现)**:
       - 保留:所有类型静默累积,点左下角缩略图进预览,顶部按类型分页(连拍/单拍/视频),切到哪类看哪类,没有的类型不显示。
       - 非保留:切换拍摄类型会**清空已拍照片**,并弹窗提醒确认。

6. **"变焦芯片太往下了,左侧不需要中文注释,显示 icon 就行"** → 侧栏去掉文字标签只留图标;变焦芯片上移。

7. **"连拍模式预览使用滚动切换图,小预览图不要了,图片下方中心加'第 X 张 · 类型',类型右侧显示总数"** → 预览大图改为**左右滑动翻页(scroll-snap)**,删掉底部缩略图条(filmstrip)。

8. **最终落点**:"上方类型才显示总共几张,下方在连拍显示第 1/3 张,单拍第 1/1 张"
   - **顶部**:类型分页 tab(连拍N / 单拍N / 视频N),tab 右侧显示 `共 N 张`(所有类型总和)。
   - **底部说明**:`第 X/Y 张`(当前类型内的序号/该类型总数)。
   - 底部拍照区做成**半透明渐变**(能透出取景画面),不再是实心黑底。

### 明确的取舍 / 否决
- **水印** = 否决为可交互按钮;改为纯代码/参数控制的展示元素(右上角)。
- **顶部工具栏** = 否决;所有控件下沉到底部 + 左下角(单手可达是硬需求)。
- **取景器主题** = 永远深色,不跟随 light/dark。
- **预览缩略图条(filmstrip)** = 否决;改为左右滑动翻页。
- **顶部返回/保存按钮** = 否决;所有"返回/保存/重拍/删除"都在底部。

### 单拍/连拍/视频 / 预览 / 模式切换 的具体诉求
- **单拍**:非保留模式拍完立即进确认页(重拍/保存);保留模式静默累积。
- **连拍**:静默累积,缩略图角标显示张数,进预览左右滑看。
- **视频**:红色录制按钮,录制时隐藏所有控件,只留闪烁红点 + 计时器。
- **模式切换**:**胶囊滑块(pill)为默认**,滚轮(wheel)为备选(Tweaks 可切,但代码两种都实现了)。横排居中,选中态橙色 + 加粗 + 橙色背景滑块。
- **预览**:顶部类型分页 + 共N张;中间左右滑大图;底部 `第 X/Y 张` + 返回/删除(或重拍/保存)。

---

## 2. 屏幕清单

原型是**单页状态机**(不是多路由),所有"屏幕"是同一个相机视图的不同状态层。覆盖的状态:

| # | 状态 | 用途 |
|---|------|------|
| S1 | **取景(单拍)** | 默认态。取景器 + 左下侧栏 + 右上水印 + 变焦芯片 + 底部(模式胶囊 + 快门 + 翻转 + 缩略图) |
| S2 | **取景(连拍)** | 同 S1,模式选中"连拍",快门视觉不变(白圆),靠缩略图角标计数 |
| S3 | **取景(视频-待录)** | 快门内圈变红色实心圆 |
| S4 | **视频录制中** | **隐藏全部控件**(侧栏/水印/变焦/缩略图/翻转/模式)。快门内圈变红色**圆角方块**;模式区位置显示"红点闪烁 + 计时器 00:00"胶囊 |
| S5 | **拍照闪光瞬间** | 全屏白色 overlay 闪一下(opacity 0.85,60ms 进 / 180ms 出) |
| S6 | **点击聚焦** | 取景器上出现四角括号取景框 + 中心点 + 右侧曝光小太阳,1.3s 动画后消失 |
| S7 | **翻转中** | 取景内容 3D 翻转(rotateY 180°,360ms) |
| S8 | **预览-确认(单拍非保留)** | 全屏上滑覆盖层。顶部居中显示类型label;中间单张大图;底部 **重拍 / 保存** |
| S9 | **预览-回看(gallery,无 tab)** | 单一类型时:顶部 `共 N 张`;中间左右滑;底部 `第 X/Y 张` + 返回/删除 |
| S10 | **预览-回看(gallery,带 tab)** | 保留模式多类型:顶部 `连拍N 单拍N 视频N` tab + `共 N 张`;切 tab 换该类图片;底部 `第 X/Y 张` + 返回/删除 |
| S11 | **二次确认弹窗** | 居中 iOS 风格 alert(删除确认 / 非保留切模式清空确认):取消 / 确认 |
| S12 | **Toast** | 居中胶囊提示("已保存"),1.6s 自动消失 |

> 注:原型还有 Tweaks 面板(设计工具的旁路控制,**不是相机 UI 的一部分**),控制:可用模式集合、切换器样式、数据模式(保留/非保留)、场景、主题、水印、网格。落地 RN 时这些都是**库的入参/props**,不是界面元素。

---

## 3. 逐屏 UI 规格(像素级)

### 全局 / 容器
- 视口:`390 × 844`(iPhone)。状态栏高度由 `IOSStatusBar` 占据(padding `21px 24px 19px`,字号 17 / weight 590,时间 "9:41")。Dynamic Island:`126×37`,top 11,圆角 24。Home indicator:`139×5`,圆角 100,距底 8。
- 相机根容器:`position: relative; width/height 100%; background: black; overflow: hidden; color: white`。
- 页面背景(手机外):dark `#0a0a0a` / light `#f2f1ee`。手机壳圆角 48,`boxShadow: 0 40px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.12)`。
- 字体栈:`-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`。

### 品牌色 / 关键 token
| token | 值 | 用途 |
|-------|-----|------|
| ORANGE | `#EB6E00` | 品牌橙。选中态、强调、主按钮、聚焦框、计数角标 |
| ORANGE_PRESSED | `#D06200` | 橙色按下态(代码定义但少用) |
| ORANGE 16% | `rgba(235,110,0,0.16)` | 模式胶囊滑块背景 |
| ORANGE 18% | `rgba(235,110,0,0.18)` | 闪光下拉选中项背景 |
| ORANGE 95% | `rgba(235,110,0,0.95)` | 侧栏按钮 active 背景 |
| 录制红 | `#ff3b30` | 视频录制点/按钮 |
| 删除红 | `#ff453a`(文字) / `rgba(255,59,48,0.16)`(底) | 预览删除按钮 |
| 白文字 | `#fff` / `rgba(255,255,255,0.95/0.65/0.4)` | 取景器上各级文字 |

---

### S1–S3 取景态

**布局层次(从下到上 z-index):**
- 取景器 Viewfinder(z 默认,inset)
- 水印 z7(右上)、变焦芯片 z7(底部居中)
- BottomPanel z8(底部全宽)
- 侧栏 SideRail z9(左下)
- 聚焦 FocusIndicator z6、拍照闪光 CaptureFlash z30
- 预览 z50、弹窗 z80、Toast z90

#### 取景器 Viewfinder
- 宽高比 16:9 → 全屏:`top:0; bottom:0`。
- 宽高比 4:3 → `top:50; bottom:200`(上下留黑边)。
- `transition: top/bottom 280ms cubic-bezier(0.2,0.8,0.2,1)`。
- 前摄镜像:`scaleX(-1)` + 一层 `rgba(220,200,180,0.08) mixBlendMode:overlay` 暖调。
- **数字变焦**:`scale = 1 + max(0, zoom-0.5)/1.5`(即 .5→1.0, 1→1.33, 2→2.0)。注意:这是原型为了"永远填满画面不露黑边"的 hack,真实相机用相机的 zoom API。
- 网格(可选):3×3 九宫格,`stroke rgba(255,255,255,0.25)`,strokeWidth 0.5。

#### 侧边栏 SideRail(左下角竖排)
- 容器定位:`position:absolute; left:12; bottom:172; zIndex:9`。
- 容器样式:`flexDirection:column; gap:8; padding:10px 6px; borderRadius:26; background:rgba(0,0,0,0.42); boxShadow: inset 0 0 0 1px rgba(255,255,255,0.08)`(玻璃感分组药丸)。
- 按钮:`40×40` 圆形(borderRadius 999)。默认 `background:transparent; color:rgba(255,255,255,0.95)`;active `background:rgba(235,110,0,0.95); color:white`。`transition: background/color 150ms`。
- 4 个按钮顺序:**宽高比 / 闪光 / 声音 / 网格**(纯图标,无文字)。
  - 宽高比:`IconAspect169`(默认)/ `IconAspect43`,size 20。图标内自带 "16:9"/"4:3" 文字。
  - 闪光:`IconFlashAuto/On/Off`,size 20。active = flash≠off。点击展开下拉。
  - 声音:`IconVolumeOn/Off`,size 20。
  - 网格:`IconGrid`,size 18。
- **闪光下拉**(向右展开,`dropdownDir="right"`,因为在左侧):
  - 定位:`top:50%; left:52; translateY(-50%)`(从按钮右侧展开)。
  - 样式:`background:rgba(28,28,30,0.94); backdropFilter:blur(16px); borderRadius:12; padding:6; boxShadow:0 8px 24px rgba(0,0,0,0.4); minWidth:130`。
  - 动画:`popIn 180ms cubic-bezier(0.2,0.8,0.2,1)`。
  - 3 项(自动/打开/关闭):每项 `padding:10px 12px; borderRadius:8; fontSize:14`,左侧 icon(size18)+文字,右侧选中打勾(IconCheck 16)。选中项 `background:rgba(235,110,0,0.18); color:ORANGE`。
  - 尾巴:`10×10` 方块旋转 45°,指向按钮。

#### 水印 Watermark(右上角)
- 定位:`position:absolute; right:6; top:92; zIndex:7; pointerEvents:none; maxWidth:230`,`align="right"` 右对齐。
- 内容(3 行):
  - 第 1 行:`fontSize:13; fontWeight:600; "Unif · 拜访记录"`。
  - 第 2 行:`fontSize:11; opacity:0.92`,IconLocation(11)+ "上海市浦东新区张江路 88 号"。
  - 第 3 行:`opacity:0.85`,"{日期时间} · 张文超 · 客户 #C2041"。
- 样式:`color:white; fontSize:11; textShadow:0 1px 3px rgba(0,0,0,0.7); lineHeight:1.45; padding:0 14px`。
- **录制时隐藏**。由代码/参数控制是否显示(非用户开关)。

#### 变焦芯片 ZoomChips(底部居中)
- 定位:`position:absolute; left:0; right:0; bottom: (16:9 时 184 / 4:3 时 202); justifyContent:center; zIndex:7`。`transition:bottom 280ms`。
- 容器:`flex; gap:8; background:rgba(0,0,0,0.45); borderRadius:999; padding:4; backdropFilter:blur(8px)`。
- 3 个芯片(`.5 / 1 / 2`):`32×32` 圆。选中 `background:rgba(255,255,255,0.95); color:ORANGE; fontSize:11; fontWeight:700`,并在数字后加 "x"(如 "1x")。未选 `transparent; color:white; fontSize:12; fontWeight:500`。`transition:all 180ms`。
- **录制时隐藏**。

#### 底部面板 BottomPanel
- 定位:`position:absolute; left:0; right:0; bottom:0; zIndex:8`。
- 背景:**半透明渐变**(最终版,用户要求能透出取景):
  `linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.18) 30%, rgba(0,0,0,0.32) 70%, rgba(0,0,0,0.4) 100%)`。
- padding:`paddingTop:14; paddingBottom:34`(底部 34 给 home indicator 留位)。
- 结构(自上而下):
  1. **模式切换器**(modes.length>1 时;=1 时只显示居中文字标签)。
  2. **快门行**:`padding:14px 28px 8px 28px; justifyContent:space-between`,三栏:[缩略图] — [快门] — [翻转]。

##### 快门 Shutter
- 外环:`72×72` 圆,`border:3px solid rgba(255,255,255,0.92); background:transparent`。
- 内圈:默认 `58×58` 圆(按下缩到 `50×50`),`transition:all 120ms`。按下时外层 `scale(0.94)`,`transition:transform 100ms`。
- **单拍/连拍**:内圈白色实心圆(`background:white`)。**视觉无差别**——连拍靠缩略图角标区分。
- **视频待录**:内圈 `58×58` 红色实心圆(`#ff3b30`)。
- **视频录制中**:内圈变 `24×24` 红色**圆角方块**(borderRadius 4),`transition:all 180ms`。
- `disabled` = busy(拍照处理中,cursor:wait)。

##### 缩略图 ThumbnailStack(左)
- 空态:`44×44`,borderRadius 8,`border:1.5px solid rgba(255,255,255,0.4); background:rgba(255,255,255,0.05)`(空框)。
- 有照片:`44×44`,`border:2px solid white`,内部 img cover,borderRadius 6。
- **计数角标**(>1 张时):右上 `top:-6; right:-6`,`minWidth:20; height:20; borderRadius:999; background:ORANGE; color:white; fontSize:11; fontWeight:700`。
- 新拍照时 bump 动画:`scale(1.08)` 200ms 回弹。

##### 翻转按钮(右)
- `44×44` 圆,`background:rgba(255,255,255,0.12); backdropFilter:blur(8px)`,IconFlip(20),白色。

---

### S4 视频录制中
- **隐藏**:侧栏、水印、变焦、缩略图、翻转、模式切换器(全部条件渲染 `!recording`)。
- 模式区位置改为**计时器胶囊**(居中):`padding:6px 14px; borderRadius:999; background:rgba(255,59,48,0.18)`,内含:
  - 红点 `8×8` 圆 `#ff3b30`,`animation:recBlink 1s steps(2) infinite`(0/1 切换闪烁)。
  - 计时文字:`color:white; fontSize:13; fontFamily:'SF Mono, Menlo, monospace'; fontVariantNumeric:tabular-nums`,格式 `MM:SS`。
- 快门保留(红色圆角方块,见上)。

---

### S5 拍照闪光 CaptureFlash
- 全屏白:`inset:0; background:white; zIndex:30; pointerEvents:none`。
- `opacity:0.85`(active)→ 0,进 `opacity 60ms ease-out`,出 `opacity 180ms ease-in`。持续 220ms。

### S6 聚焦指示 FocusIndicator
- 定位:点击点为中心,`left:x-44; top:y-44; width:110; height:88; zIndex:6; transformOrigin:44px 44px`。
- 动画:`focusIn 1300ms cubic-bezier(0.2,0.8,0.2,1) forwards`(0→1.35 scale 淡入 → 0.94 回弹 → 1 → 闪烁两下 → 定格 opacity 0.72)。1.3s 后移除。
- SVG 内容(stroke = ORANGE):
  - **四角括号**(strokeWidth 2,round cap):4 个 L 形角(左上/右上/左下/右下),围成约 `64×64` 取景框。
  - **中心点**:`circle r=2.4` 实心橙。
  - **曝光小太阳**(右侧,strokeWidth 1.6):圆 `r=4.5` + 8 道短射线,中心 `rgba(235,110,0,0.2)` 填充,上下各一条半透明引导线(opacity 0.45)。这是"拖动调曝光"的暗示。

---

### S8 预览-确认(单拍非保留)
- 全屏覆盖层:`position:absolute; inset:0; zIndex:50`,从下滑入 `translateY(100%)→0`,`transition 320ms cubic-bezier(0.2,0.8,0.2,1)`。
- 背景:dark `#000` / light `#f5f5f7`。文字:dark `#fff` / light `#1c1c1e`。
- **顶部**(`padding:14px 14px 10px; minHeight:46; 居中`):只显示类型 label(连拍/单拍/视频),`color:previewSubText; fontSize:14; fontWeight:500`。**无任何按钮**。
- **中间**:单张大图,`flex:1; padding:8px 12px`,img `width/height:100%; borderRadius:12; objectFit:cover; boxShadow:0 8px 28px rgba(0,0,0,0.18)`。
- **底部**(`padding:14px 24px 30px; gap:12; 居中`):两个按钮,各 `flex:1; maxWidth:150; padding:13px 0; borderRadius:999; fontSize:15; fontWeight:600`。
  - **重拍**:`background:previewDeleteBg(rgba(255,255,255,0.08)) ; color:#fff` + IconRefresh(18)。
  - **保存**:`background:ORANGE; color:white` + IconCheck(18)。

### S9/S10 预览-回看(gallery)
- 容器/进场同 S8。
- **顶部**(`minHeight:46; 居中`):
  - **单类型(无 tab,S9)**:只显示 `共 N 张`(`color:previewSubText; fontSize:14`)。
  - **多类型(带 tab,S10,仅保留模式)**:居中一组:
    - tab 容器:`flex; gap:4; background:previewStripBg(rgba(255,255,255,0.06)); borderRadius:999; padding:4`。
    - 每个 tab:`padding:7px 16px; borderRadius:999; fontSize:13; fontWeight:600`。选中 `background:ORANGE; color:#fff`;未选 `color:previewSubText`。文字 = `{类型label}{该类张数}`(张数 opacity 0.7,marginLeft 5)。
    - tab 右侧:`共 N 张`(总数,`fontSize:13; color:previewSubText`)。`gap:10`。
- **中间(左右滑大图)**:横向 scroll 容器,`overflowX:auto; scrollSnapType:x mandatory; scrollbarWidth:none`。每页 `flex:0 0 100%; scrollSnapAlign:center; padding:8px 12px`,img 同 S8(cover, r12, shadow)。`onScroll` 计算当前页 index。切类型/打开时跳到该类最新一张。
- **底部**(`padding:4px 12px 26px; flexDirection:column; gap:12`):
  - **说明行**(居中):`第 {selected+1}/{list.length} 张`,`fontSize:15; fontWeight:600`。即"当前类型内 第 X/Y 张"。
  - **按钮行**(`gap:12; 居中; padding:0 16px`),两个按钮(同确认页尺寸):
    - **返回**:`background:previewDeleteBg; color:previewDeleteColor` + IconChevronLeft(18)。
    - **删除**:`background:rgba(255,59,48,0.16); color:#ff453a` + IconTrash(17)。

### S11 二次确认弹窗 Confirm
- 遮罩:`inset:0; zIndex:80; background:rgba(0,0,0,0.5); 居中; animation:fadeIn 180ms`。
- 卡片:`width:270; borderRadius:14; background: #1c1c1e(dark)/#fff(light); textAlign:center; animation:popIn 200ms; boxShadow:0 12px 40px rgba(0,0,0,0.25)`。
- 文案:`padding:20px 16px 18px; fontSize:14; lineHeight:1.45`。
- 按钮行(顶部 0.5px 分隔线):**取消**(`color:confirmCancelColor; fontSize:16`)| **确认**(`color:ORANGE; fontSize:16; fontWeight:600`),中间 0.5px 竖分隔。
- 文案示例:`"切换拍摄模式将清空已拍摄的照片,是否继续?"` / `"图片删除后无法恢复,确认删除?"`

### S12 Toast
- 居中:`top:50%; left:50%; translate(-50%,-50%); zIndex:90`。
- `background: rgba(28,28,30,0.9)(dark)/rgba(255,255,255,0.95)(light); color:#fff/#1c1c1e; padding:12px 22px; borderRadius:12; fontSize:14; backdropFilter:blur(12px); animation:popIn 180ms`。1.6s 自动消失。文案如 "已保存"。

---

## 4. 模式切换器(关键)

**形态:默认是「胶囊滑块(pill)」横排,不是底部横滑 tab(非系统相机那种 PHOTO/VIDEO 横滑手势)。** 也实现了滚轮(wheel)作为备选,但默认 pill。点击切换(非滑动手势),带橙色滑块动画。

### Pill(默认,`ModeSwitcherPill`)
- 横排居中,每个 button `padding:8px 22px; fontSize:15; letterSpacing:1`。
- **橙色滑块**(absolute):`top:4; height:calc(100%-8px); left/width 跟随选中项`,`background:rgba(235,110,0,0.16); borderRadius:999`,`transition:left/width 240ms cubic-bezier(0.2,0.8,0.2,1)`。
- 文字:选中 `color:ORANGE; fontWeight:600`;未选 `color:rgba(255,255,255,0.65); fontWeight:500`。
- 顺序固定:**连拍 / 单拍 / 视频**(注意连拍在最左,单拍是默认选中且居中)。
- modes 只有 1 个时:不显示切换器,只显示居中文字 label(`color:rgba(255,255,255,0.7); fontSize:14; letterSpacing:2`)。

### Wheel(备选,`ModeSwitcherWheel`)
- iOS 风横向滚轮,中心选中。`height:36; overflow:hidden`。
- 每项 `width:90; textAlign:center`,容器 `translateX(-idx*90)` 居中当前项,`transition 280ms`。
- 选中 `color:ORANGE; fontSize:15; fontWeight:700`;周边按距离衰减透明度 `rgba(255,255,255, max(0.3, 0.7 - dist*0.2))`,`fontSize:13`。
- 底部居中一个 `4×4` 橙色指示点。

### 连拍 vs 单拍 的视觉区别
- **快门按钮完全相同**(都是白色实心圆)。**没有视觉区别**。
- 区分靠两点:① 模式切换器选中态(文字+橙滑块);② **左下角缩略图的橙色计数角标**(连拍累积多张 → 显示张数;单拍通常 1 张无角标)。
- 连拍计数 = ThumbnailStack 右上角橙色圆角标(`minWidth:20; height:20; background:ORANGE; fontSize:11; fontWeight:700`)。预览页顶部 tab 也显示 `连拍N`。

---

## 5. 预览界面

### 入口逻辑(取决于"数据模式"参数,代码控制不在 UI 上)
- **非保留(transient)+ 单拍**:拍完立即自动滑入**确认页**(`variant='confirm'`),底部 重拍/保存。重拍 = 丢弃刚拍那张;保存 = 关闭 + Toast"已保存"。
- **非保留 + 连拍/视频**:静默累积,点左下缩略图进**回看页**(`variant='gallery'`)。
- **保留(retain)**:所有类型都静默累积,**一律点左下缩略图进回看页**(单拍也不弹确认页)。

### 单图 vs 多图差异
| | 单图(确认 S8) | 单类型回看(S9) | 多类型回看(S10,仅保留) |
|---|---|---|---|
| 顶部 | 类型 label | `共 N 张` | 类型 tab(连拍N/单拍N/视频N)+ `共 N 张` |
| 中间 | 单张静态大图 | 左右滑翻页 | 左右滑翻页(只看当前 tab 类型) |
| 底部说明 | 无 | `第 X/Y 张` | `第 X/Y 张`(当前类型内) |
| 底部按钮 | 重拍 / 保存 | 返回 / 删除 | 返回 / 删除 |

### 操作按钮
- **重拍**(确认页):丢弃刚拍那张,关闭预览。
- **保存**(确认页):保留,关闭,Toast"已保存"。
- **返回**(回看页):关闭预览回取景。
- **删除**(回看页):弹二次确认 → 确认后删当前图;删空则自动关闭预览。
- **缩略图条(filmstrip)**:**已被用户否决移除**。预览只有左右滑,不显示底部小图条。
- 视频在 photos 里标记 `isVideo:true, mode:'video'`,预览同样按类型 tab 处理(但原型大图仍显示静态缩略图,无播放控件——见歧义)。

---

## 6. 映射到 @unif/react-native-design 的建议

> 当前实现已大量使用设计系统:`Chip / Icon / Button / Segmented / Empty / Spinner / r / rf / useColors / useThemedStyles / ColorTokens / ThemeProvider`(见 `src/camera/setup/SetUp.tsx`、`footer/Footer.tsx`、`preview/*`)。下面区分"可直接用 / 需自定义"。

### 可直接用 design system 组件
| 设计稿元素 | 建议 | 说明 |
|---|---|---|
| 闪光下拉的 3 个选项 | `Icon` + 自定义弹层(或现有 Chip 循环切换) | 当前 `SetUp` 用 Chip 点击循环切 flash;设计稿改成展开下拉。下拉容器需自定义,内部 item 可用 `Icon`+文字 |
| 所有图标 | `Icon`(已有 flash-off/on/auto, aspect-4-3/16-9, lens-flip 等) | **注意图标缺口**:见 `docs/superpowers/research/icon-gaps.md`。设计稿用到:flash×3、aspect×2、volume on/off、grid、flip、chevron-left、refresh、trash、check、location(水印定位)。需确认 design 是否有 volume/grid/refresh/trash/check/location/chevron |
| 重拍/保存/返回/删除 按钮 | `Button`(variant primary/ghost/danger) | 保存=primary(橙);重拍/返回=ghost;删除=danger(红)。当前 `PreviewFooter.tsx` 已用 `Button` |
| 二次确认弹窗 | 现有 `useConfirm` hook(`src/hooks/useConfirm.tsx`) | 已存在,复用 |
| 模式切换器 | `Segmented`(当前 Footer 已用)**或**自定义 pill | **取舍点**:design 的 `Segmented` 是方角/常规分段控件;设计稿要的是**圆角胶囊 + 橙色滑块**的相机风格。若 Segmented 不支持圆角胶囊样式,建议自定义(见下) |
| 空预览态 | `Empty` | 当前 `SinglePre.tsx` 已用 |
| Loading | `Spinner`(已有 `components/Loading.tsx`) | 拍照 busy 态 |

### 必须自定义(无对应组件)
| 元素 | 原因 |
|---|---|
| **圆形快门按钮** | 相机 UX 惯例,无 design 组件。当前 `Footer.tsx` 已自定义(72px 外环 + 内圈,录制态红色)。需扩展:视频待录红圆 / 录制中红圆角方块 / 按下缩放 |
| **模式胶囊切换器(橙滑块)** | 若 `Segmented` 样式不匹配则自定义。需要橙色滑块 240ms 缓动动画 |
| **侧边栏 SideRail**(左下竖排玻璃药丸) | 自定义容器 + 4 个圆形 icon button + 闪光下拉弹层 |
| **变焦芯片 ZoomChips** | 自定义(玻璃底 3 段 .5/1/2x,选中白底橙字) |
| **聚焦指示器**(四角括号 + 曝光小太阳) | 当前已有 `FocusIndicator.tsx`,但设计稿样式更复杂(四角括号 + 中心点 + 曝光太阳 + 复杂动画)。需重做 SVG + Animated |
| **拍照闪光白屏** | 自定义全屏 Animated.View opacity |
| **缩略图角标计数** | 自定义(橙色圆角标 + bump 动画) |
| **预览左右滑翻页** | RN 用 `FlatList horizontal pagingEnabled` 或 `ScrollView pagingEnabled`(替代 web 的 scroll-snap)。当前有 `components/Carousel/`,可复用/改造 |
| **录制计时器胶囊**(红点闪烁 + MM:SS) | 自定义 + Animated 闪烁 |
| **水印**(右上 3 行 + 定位图标) | 当前有 `PreviewThumbnail`?需自定义文字 overlay,内容由 props 传入 |
| **Toast** | design 是否有 Toast 待确认;否则自定义 |

### 颜色:固定深色 vs 主题 token —— 关键决策
设计稿的**明确规则**(来自 chat 第 2 轮):
- **取景器 + 取景态所有控件(侧栏/变焦/快门/水印/底部面板)= 永远固定深色**,不跟随主题。原型这些都是硬编码 `rgba(255,255,255,...)` 白 + `rgba(0,0,0,...)` 黑底 + `#EB6E00` 橙。
- **只有 "chrome" 跟随 light/dark**:预览覆盖层背景/文字、二次确认弹窗、Toast、(网页里的)页面背景与手机壳。
- **品牌橙 `#EB6E00`** 在两个主题下都不变。

**建议**:
1. 取景界面用一套**固定深色常量**(白/黑/橙),不走 `useColors()`。这与当前 `Footer`/`SetUp` 用 `c.surface`/`c.outline`/`c.foreground` 的做法**不同**——当前实现让快门跟随主题(`c.surface`/`c.error`),设计稿要求取景态恒定深色。落地时需要决定是否偏离 design token(相机界面是特例,建议偏离 = 固定深色)。
2. 预览页/弹窗/Toast 走 `useColors()` / `useThemedStyles()` 主题 token(`background`/`foreground`/`surface` 等),与 design system 一致。
3. **品牌橙 `#EB6E00`**:确认 design token 里是否有对应的 primary/accent。若 design 的 primary 不是这个橙,需要决定:用 design primary 还是钉死 `#EB6E00`。设计稿是写死的橙。
4. 删除红用 design 的 `error`/`danger` token(当前 Footer 录制态已用 `c.error`),设计稿是 `#ff3b30`/`#ff453a`(接近 iOS systemRed)。

---

## 附:与当前朴素界面的核心差异(给重写定调)

| 维度 | 当前(朴素) | 设计稿 |
|---|---|---|
| 顶部 | 3 个白底 Chip(闪光/宽高比/镜头),`top:60` 横排 | **无顶部栏**。控件全下沉:右上只有水印 |
| 控件位置 | 顶部 + 底部 | **全部拇指区**:左下竖排侧栏(宽高比/闪光/声音/网格)+ 底部 |
| 镜头切换 | 顶部 Chip | 底部右侧圆形翻转按钮 |
| 变焦 | 无 | 底部居中 .5/1/2x 玻璃芯片 |
| 模式切换 | `Segmented`(方角分段) | **圆角胶囊 + 橙色滑块**(pill,带动画),或滚轮 |
| 快门 | 单一圆形(录制态红) | 多态:白圆/红圆/红圆角方块 + 按下缩放 + 拍照白屏闪 + 缩略图 bump |
| 底部 | 取消 + 快门 + 完成(文字) | 缩略图(带橙角标)+ 快门 + 翻转;无取消/完成文字 |
| 预览 | 单图 SinglePre + filmstrip Carousel | 全屏上滑;左右滑翻页;顶部类型 tab + 共N张;底部 第X/Y张 + 重拍/保存(或返回/删除);**无 filmstrip** |
| 聚焦 | 简单(已有 FocusIndicator) | 四角括号 + 中心点 + 曝光小太阳 + 多段动画 |
| 主题 | 全跟随 token | 取景态固定深色,仅预览/弹窗跟随主题 |
| 水印 | (代码控制) | 右上 3 行 + 定位图标,纯展示 |

---

## 歧义 / chat 提到但设计稿未覆盖的点

1. **视频预览/播放**:photos 里视频标 `isVideo:true`,但预览大图仍渲染**静态缩略图**,无播放按钮、无时长、无进度条。chat 提到视频类型要进预览 tab,但**怎么播放/预览视频原型没做**。落地需自行设计(播放控件、首帧、时长角标)。
2. **连拍的录制交互**:chat 提到连拍,但原型连拍快门 = 单次点击 append 一张(没有"长按连拍""按住连拍"手势)。`Shutter` 组件有 `onLongPressEnd` prop 但**未实现长按逻辑**。真实连拍是长按还是连点?设计稿未明确。
3. **保存的真实语义**:确认页"保存"只是关闭+Toast,**没有定义保存到哪**(相册?回调?)。这是库的入参/回调职责,UI 不体现。
4. **非保留模式的"保存"流向**:非保留单拍拍完进确认页,但若选"重拍"丢弃后,数据流向、与外部回调的衔接未在原型体现(原型只是 setPhotos)。
5. **宽高比 4:3 的取景器尺寸**:原型用 `top:50; bottom:200` 硬编码留黑边,真实相机的 4:3/16:9 取景比例需按设备/相机能力计算,不能照搬这两个魔数。
6. **数字变焦的 scale hack**:原型 `scale = 1 + max(0,zoom-0.5)/1.5` 纯粹是为了网页里"不露黑边"。真实变焦用 vision-camera 的 zoom prop,**不要照搬这个公式**。
7. **安全区**:原型用固定 `paddingBottom:34`(home indicator)和 `top:50`/`top:92` 等魔数。RN 落地必须用 `useSafeAreaInsets()` 替代,不能硬编码。
8. **图标缺口**:设计稿用到 volume on/off、grid、refresh、trash、check、chevron-left、location 等图标,需对照 design system 的 `IconName` 确认是否齐全(已有 `icon-gaps.md` 记录部分缺口,建议交叉核对)。
9. **Tweaks 面板**:是设计工具的旁路控制(模式集合/数据模式/场景/主题/水印/网格),**不是相机 UI**。这些在 RN 里都是库的 props/配置,不要做成界面。
10. **"完成连拍"按钮**:当前 RN 实现有 `onFinishBurst` + "完成(N)"按钮,但**设计稿没有这个按钮**——设计稿连拍直接累积,靠缩略图进预览。需确认连拍何时"结束/确认"(是否还需要"完成"按钮,还是直接退出/切模式即结束)。
