# @unif/react-native-camera

React Native 弹窗式相机，支持单拍、连拍、录像和照片水印。

[文档站](https://unif-design.github.io/react-native-camera/) · [npm](https://www.npmjs.com/package/@unif/react-native-camera) · [示例](example/README.md)

## 安装

```sh
yarn add @unif/react-native-camera
```

安装后按[接入指南](website/docs/getting-started/installation.md)补齐原生依赖、Worklets 配置和权限；完整依赖范围以 [package.json](package.json) 为准。本库使用 Vision Camera 5，需要 React Native 新架构。

## 快速开始

```tsx
import { Button } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

export function CameraEntry() {
  const [camera, holder] = useCamera();

  const takePhoto = async () => {
    const result = await camera.open({
      modes: [{ mode: 'single', quality: 0.9 }],
      retention: 'clear',
    });
    if (result.status === 'success') {
      // result.media 是已选用媒体，在这里预览、保存或上传。
    }
  };

  return (
    <>
      <Button title="拍照" onPress={takePhoto} />
      {holder}
    </>
  );
}
```

`holder` 必须渲染。结果通过 `status` 区分 `success`、`cancelled` 和 `failed`；错误原因见 [API](website/docs/api/camera-api.md)。可通过 `open(input, { signal })` 为本次调用提供取消信号。返回媒体只暴露可读的 `uri`，录像时长为 `durationMs`；临时文件交付后由应用保存、上传或释放。

相机权限用于拍摄，麦克风权限仅用于录像；库不写入系统相册。真实拍摄、录像、水印成片和内存表现需要真机验证。

## 文档与开发

- [参数和类型](website/docs/api/types.md) · [运行示例](example/README.md)
- [开发资料](docs/DEVELOPMENT.md)：新版本目标契约与当前源码入口。
- [AI 文档索引](https://unif-design.github.io/react-native-camera/llms.txt)
- [研发技能](https://github.com/unif-skill/unif-portal-dev-skills) · [MIT 许可](LICENSE)
