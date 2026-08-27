# 低内存照片文件管线设计

## 问题与证据

iPhone X / iOS 16.7.16 在快门时出现 `IOSurface creation failed: e00002bd`；Apple IOKit
将其定义为 `kIOReturnNoMemory`，同一时刻系统进入
`available_pages_below_critical=1` 并触发 Jetsam。Portal 已安装本库 4.0.3，源码也包含
`6e21755 fix(camera): 改用 CPU surface 处理照片`，因此不是版本未升级。

旧补丁修复的是 GPU offscreen surface 在同步 readback 时的 `EXC_BAD_ACCESS`。它仍然有用，
但本次证据指向内存分配失败。旧照片链在 3024×4032 输入上依次经过编码文件、可能被绘制
触发的解码像素、CPU 8888 Surface、snapshot、JPEG SkData、Base64 JS 字符串和 RNFS Base64
解码写入。不能假定 `MakeImageFromEncoded` 调用时立即展开全部像素，也不能假定 snapshot
必然完整复制；最后一根稻草必须用真机 Instruments 验证。但 CPU Surface 的下界是
`width × height × 4`，Base64/JS/RNFS 中转是确定存在且没有业务价值的额外峰值。

Android 旧实现复用同一套 JS/Skia/Base64 管线，因此也有相同的结构性峰值风险；即使当前
没有同一型号的 OOM 日志，也应同时根治。

## 官方依据

- VisionCamera Performance：按最终用途设置 `targetResolution`，不要捕获 4K 再缩小：
  https://visioncamera.margelo.com/docs/performance
- VisionCamera Photo Output / Photo：`capturePhotoToFile()` 直接返回临时文件；in-memory
  `Photo` 用后必须 `dispose()`：
  https://visioncamera.margelo.com/docs/photo-output
  https://visioncamera.margelo.com/docs/a-photo
- `PhotoOutputOptions`：目标分辨率协商优先保持画幅：
  https://visioncamera.margelo.com/api/react-native-vision-camera/interfaces/PhotoOutputOptions
- VisionCamera Resizer 面向实时 FrameOutput/ML，不是拍照文件处理器：
  https://visioncamera.margelo.com/docs/resizer
- Apple Image and Graphics Best Practices：大图应在建立完整 UIImage/绘制前下采样：
  https://developer.apple.com/videos/play/wwdc2018/416/
- Apple ImageIO thumbnail：
  https://developer.apple.com/documentation/imageio/cgimagesourcecreatethumbnailatindex(_:_:_:)
- Apple Core Image 延迟 recipe 与 CIContext 文件写入：
  https://developer.apple.com/library/archive/documentation/GraphicsImaging/Conceptual/CoreImaging/ci_tasks/ci_tasks.html
  https://developer.apple.com/documentation/coreimage/cicontext/writejpegrepresentation(of:to:colorspace:options:)
- Android 大 Bitmap 官方指南与 `inSampleSize`：
  https://developer.android.com/topic/performance/graphics/load-bitmap
  https://developer.android.com/reference/android/graphics/BitmapFactory.Options
- Android `Bitmap.compress()` 可直接写 OutputStream，Canvas 提供图像/文字绘制：
  https://developer.android.com/reference/android/graphics/Bitmap
  https://developer.android.com/reference/android/graphics/Canvas

## 设计

1. 捕获层按最终画幅请求 JPEG FHD：4:3 为 1440×1920，16:9 为 1080×1920。
   VisionCamera 负责按设备支持的输出尺寸协商；画幅改变会受控重配 session。
2. 使用 `capturePhotoToFile()`，只传递文件 path。原生读取文件头尺寸/EXIF 方向，不创建
   JS 持有的 in-memory `Photo`，不读取照片内容进 JS。
3. 尺寸、画幅已满足且没有可见水印时零重编码，直接交付捕获文件。
4. iOS：`CGImageSourceShouldCache=false`；较大输入先用 ImageIO thumbnail + transform
   下采样。随后由复用的 CPU CIContext（RGBA8、禁中间缓存）延迟串联方向、居中裁切、缩放
   和 CoreText 水印，最后 `writeJPEGRepresentation` 直接写目标文件；不重新引入旧的 GPU
   offscreen readback 路径。
5. Android：先读 bounds/EXIF，按目标尺寸计算官方 power-of-two `inSampleSize`；只保留
   采样源 Bitmap 和一个目标 ARGB_8888 Bitmap，在目标 Canvas 上一次完成方向、裁切、缩放
   与 StaticLayout 水印，`Bitmap.compress()` 直接写 BufferedOutputStream。
6. 两端单线程串行处理；JS 继续用 operation token、不可变配置快照、FileRegistry 和
   frozen preview 提供原有 exactly-once、文件所有权与清理语义。
7. 诊断只记录阶段、输入/输出尺寸、是否采样和耗时，不记录文件 path、照片内容、Base64
   或水印文字。

## 不变契约

- 唯一公开入口仍是 `useCamera()`；`OpenConfig`、`CameraResult` 和 `CustomPhotoFile` 不变。
- 单拍、连拍、六方位水印、首行强调、16:9、EXIF 方向、冻结回看、错误重试、session token
  与临时文件 transfer/drain 语义不变。
- 录像不进入照片 processor，只做回归保护。
- 不新增第三方 runtime dependency，不改版本，不发布 npm，不升级 Portal。

## 验收

- TDD：先证明旧实现固定 UHD、创建 in-memory Photo、调用 Skia/Base64/RNFS 写图，再使测试
  在新文件管线下通过。
- 静态门禁：Jest、typecheck、lint、bob build、website build、iOS Pod target、Android
  example build。
- 真机：iPhone X 连续覆盖 4:3/16:9、无水印/水印、单拍/连拍、前后摄和失败重试；记录
  Allocations/VM Tracker 高水位、处理阶段尺寸/耗时与系统日志，确认没有新的 IOSurface
  `kIOReturnNoMemory`、critical pages 或 Jetsam。没有真机 trace 时不得宣称内存问题已通过。
