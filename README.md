# @unif/react-native-camera

React Native 弹窗式相机，提供单拍、连拍、录像和照片文字水印。应用打开相机，用户拍摄并选用后取得本地临时媒体。

[文档站](https://unif-design.github.io/react-native-camera/) · [npm](https://www.npmjs.com/package/@unif/react-native-camera) · [运行示例](example/README.md)

## 安装

| 项目         | 要求                                   |
| ------------ | -------------------------------------- |
| React Native | `>=0.86.0`，启用新架构                 |
| React        | `>=19.2.3 <20.0.0`                     |
| 拍摄平台     | iOS / Android 真机；Web 不提供拍摄能力 |
| 权限         | 拍摄需要相机权限；录像另需麦克风权限   |

```sh
yarn add @unif/react-native-camera
```

继续按[安装指南](website/docs/getting-started/installation.md)补齐 Vision Camera 5 等 peer 依赖、Worklets 配置和原生权限，再重新构建应用。上表是关键接入条件，完整支持范围见安装指南与 [package.json](package.json)。

## 快速开始

在页面调用 `useCamera()`，并渲染返回的 `holder`：

```tsx
import { Button } from 'react-native';
import { useCamera } from '@unif/react-native-camera';

export function CameraEntry() {
  const [camera, holder] = useCamera();
  const takePhoto = async () => {
    const result = await camera.open({
      modes: [{ mode: 'single' }],
      retention: 'clear',
    });
    if (result.status === 'success') {
      console.log(result.media[0]?.uri);
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

| `status`    | 含义与处理                                       |
| ----------- | ------------------------------------------------ |
| `success`   | 用户选用了媒体，从 `media` 读取文件 URI 和元数据 |
| `cancelled` | 本次交互已取消，结束当前流程                     |
| `failed`    | 读取 `error.reason` 和 `error.message`           |

成功文件仍在临时目录，由应用保存、上传或释放；库不写入系统相册。需要从页面外取消时，使用 `open(input, { signal })`，见[取消与文件归属](website/docs/getting-started/concepts.md)。

## 进一步使用

- [拍照](website/docs/guides/taking-photos.md) · [录像](website/docs/guides/recording-video.md) · [水印](website/docs/guides/watermark.md)
- [调用 API](website/docs/api/camera-api.md) · [参数和结果类型](website/docs/api/types.md)
- [开发资料](docs/DEVELOPMENT.md) · [库能力技能](website/docs/skills.md) · [AI 文档索引](https://unif-design.github.io/react-native-camera/llms.txt)

[MIT 许可](LICENSE)
