# Camera 示例

通过公开的 `useCamera()` 和 `OpenConfig` 展示四种拍摄场景。

## 运行

在仓库根目录安装依赖并启动 Metro：

```sh
yarn install --immutable --mode=skip-build
yarn example start
```

iOS 首次运行或原生依赖变化后，使用示例自己的 Bundler 环境：

```sh
(cd example && bundle install)
(cd example && bundle exec pod install --project-directory=ios)
```

构建及完整测试由 CI 执行。开展真机测试时，从根目录使用 `yarn example android` 或 `yarn example ios`；真实拍摄需要带摄像头的设备。

## 示例内容

| 场景       | 可以验证什么                                    |
| ---------- | ----------------------------------------------- |
| 基础拍摄   | 单拍、连拍、录像，初始镜头与闪光                |
| 多模式     | 模式切换，以及 `clear`／`retain` 的选择保留行为 |
| 水印存证   | 标题、手工地点、备注和当前时间；不请求定位      |
| 质量实验室 | SDK 默认与显式照片质量、HDR、录像时长和码率     |

配置从[同一组类型化工厂](src/domain/scenarioConfigs.ts)产生。完整字段和结果码见[参数类型](../website/docs/api/types.md)与[相机 API](../website/docs/api/camera-api.md)。

## 使用边界

- 返回媒体仍在临时目录，结果历史只保存在当前进程；示例不上传或持久化文件。
- `code === 200` 才处理媒体，`0` 为取消；错误不能转换为空结果或成功。
- 相机内的拍摄、处理或麦克风错误与最终调用结果分开处理，详见 API。
- 模拟器和 mock 可验证普通 UI／调用交接，不能代替真实录像、水印及设备内存验证。

定向验证入口见[开发资料](../docs/DEVELOPMENT.md)，消费者接入见[安装指南](../website/docs/getting-started/installation.md)。
