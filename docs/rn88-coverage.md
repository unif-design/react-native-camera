# RN 0.88 开发基线与覆盖率

正式开发、example 与网站均使用 React Native 0.88.0、React 19.3.0；发布版本保持 6.0.3。Node engines 对齐 RN 的 `^22.13.0 || ^24.3.0 || >=26.0.0`，example 原生启动、SceneDelegate、Gradle/Kotlin 配置对齐已校验 integrity 的正式 community 模板。

## 实测范围和结果

| 范围 | 实测结果 |
| --- | --- |
| 库与 example JS/TS 全部 106 个文件 | 89 suites / 959 tests；语句2393、分支1548、函数554、行2229，全部100% |
| Android 全部2个生产 Kotlin / 7 classes | JaCoCo：指令1940、分支129、行361、方法48、复杂度117、类7，全部100% |
| iOS 全部1个生产 `.mm` | LLVM：行665、函数24、区域435、分支210，全部100% |
| Android example 原始2个 Kotlin 宿主 | 指令61、行13、方法7、复杂度7、类2，全部100%；无条件分支，分支N/A |
| iOS example 原始2个 Swift 宿主 | DEBUG行36、RELEASE行30，函数5、区域7，全部100%；Swift编译器未生成branch counters，分支N/A |

JS 只排除测试与声明文件，纯类型和导出入口保留在清单。库与 example 的细分计数、全部哈希、10项局部实现调整及分母变化见[JS证明报告](rn88-js-coverage.md)。标准 `yarn test --maxWorkers=2 --coverage` 已按相同范围通过四项100门禁。

原生测试编译仓库内原始生产文件，不复制或替换自有处理器。Android/RN/API边界受控；iOS常规路径使用真实 Foundation、Core Image、Core Text、ImageIO、AVFoundation 和 dispatch，创建并检查真实 JPEG。错误、取消、重复回调、资源释放、EXIF、裁剪、水印、视频旋转/时长和序列化均实际执行。系统 API 可注入其契约允许的错误/边界值；这不代表相机硬件、Android解码器或厂商SDK的真机验收。

## 原生调整及分母

Android 原有 finally 在编译后复制条件，提取为一个私有 `recycleBitmaps(output, source)`，该函数同样纳入完整覆盖率。两 bitmap 只由此次调用创建、独占，解码旋转替换前释放旧对象，输出由独立 allocation 创建，最后释放之前没有其他所有者；重复 `isRecycled` 守卫删除，null/非null、成功/失败及一次释放均测试。水印 parse 要求至少一个非空白行，因此后续 styled 文本不为空，删除重复判断。初始扩展报告分母为指令1954/分支143/行360/方法47；最终1940/129/361/48，新增私有方法和finally编译方式解释了行/方法变化。原始日志保留。辅助 JetBrains 测量也全覆盖，但最终门禁使用 JaCoCo 原报告，不在工具间选择较小分母。

iOS 删除以下严格重复检查，保留所有可达错误路径：

- metadata 返回 NO 的每一个出口都先写入 `EPhotoRead`，消费者无需再次以相同常量兜底。
- 水印 `rawLines` 只来自本方法中的 `NSJSONSerialization`，其封闭 Foundation 值为 NSString/NSNumber/NSNull/NSArray/NSDictionary，非字符串值的 description 返回字符串；不存在外部自定义 description 对象，因此删除 nil 回退。所有 JSON 类型仍有测试。
- 水印的唯一调用参数来自保留的 `MAX(1, llround(...))` 输出宽高，故为正整数。fontSize也是至少1的整数，`round(fontSize*1.45)>=fontSize`；padding是正数乘积的round，至少0。对整数w>=3，`w-2*round(.04*min(w,h)) >= .92*w-1 >=1`，w=1/2时padding=0；`round(.7*w)>=1`。height同理。因此仅删除 lineHeight/padding/paragraphWidth/constraints 的重复下限。1/2/3/4/8/16/1200像素实图与小数extent系统边界覆盖保留的有效下限；CoreText零可布局高度保留至少1像素bitmap。
- catch 内 `failureCode = failureCode ?: EPhotoDecode` 与唯一后续 reject 的相同表达式重复，中间没有 failureCode 消费。删重复赋值，保留原 `@try/@catch` 和公共拒绝行为。

这些调整之前实测行670/函数24/区域458/分支226；之后665/24/435/210。工具报告没有删除文件、排除条件或改写计数。裁剪非有限高度的错误保护保留，并用有限宽/无限高边界证明可达。

Apple日志宏原样编译。正常运行的原始报告为206/210分支；同一二进制再以仅子进程环境 `OS_ACTIVITY_MODE=disable` 执行全部10组测试，自然覆盖系统宏的disabled路径。`llvm-profdata merge` 合并两份真实profile后210/210。`coverage-default.json`、`coverage-logging-disabled.json`、原始profraw与完整 `branch-mapping.json` 均保留，未替换宏或手工修正计数。runner 在编译前后核对完整自有源码 SHA256。

## 工程与重跑

`yarn test:native:android` / `test:native:ios` 执行库插桩，`test:example:native:android` / `test:example:native:ios` 独立执行原始宿主。自有 `.github/ci/android.sh` 与 `ios.sh` 已接入共享workflow的既有扩展点；Android即使命中Turborepo缓存也会解析实际编译器。JaCoCo0.8.13默认下载到项目缓存并强制SHA256，可用 `JACOCO_HOME` 复用已验证缓存，失败不跳过门禁。

正式原生依赖为 Skia2.14.0、VisionCamera及其worklets5.2.3、react-native-video7.0.0-beta.11、nitro-modules0.37.1、nitro-image0.15.2。Android Debug与iOS Debug均构建通过。RN预编译Core与当前Nitro/Video的JSI导入在本工程失败，使用RN官方支持的 `RCT_USE_PREBUILT_RNCORE=0` 源码Core模式后成功；没有保留无效的Swift显式模块覆盖，也没有修改node_modules。最后一次iOS构建有本机Watchman FSEvents警告，但xcodebuild最终BUILD SUCCEEDED；不以此声称Metro或设备业务已验收。

example自己的Gemfile/lock固定Ruby>=3.3、CocoaPods1.17.0、ActiveSupport7.2.4、xcodeproj1.28.1；本库 `bundle check` 与 `pod install --deployment` 通过。网站使用RNW0.21.4、SVG15.16.0、assets-registry0.88.0，只转换registry混合模块；SSG、类型检查、llms检查、真实webpack双向资产注册均通过。lint/typecheck/bob构建/turbo输入校验通过。网站和工程脚本仅记录其检查，不计入库/example100%的运行源码分母。

最终日志在 `coverage/rn88-logs`，源清单及原始覆盖率在 `coverage/native` 与 `coverage/js-final`。发布、远程CI、Portal集成和设备验收由统一交付另行完成。
