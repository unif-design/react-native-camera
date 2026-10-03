---
sidebar_position: 7
title: 版本迁移
description: '已发布版本的接口和依赖调整说明。'
---

# 版本迁移

新公共契约使用 `CameraInput` 和 `CameraOutcome`。迁移时同时更新输入、结果分支与取消信号，保持完整调用链一致。

## 字段对照

| 旧接口                                         | 新接口                                                 |
| ---------------------------------------------- | ------------------------------------------------------ |
| `CameraApi` / `OpenConfig`                     | `CameraController` / `CameraInput`                     |
| `cameraMode`                                   | `modes`，至少一项且模式不重复                          |
| 模式项 `type` / `flashMode`                    | 根级 `initialFacing` / `initialFlash`                  |
| `dataRetainedMode`                             | `retention`                                            |
| 根级 `photoQualityPrioritization` / `photoHDR` | 照片模式项 `qualityPriority` / `hdr`                   |
| `recTime` / 根级 `videoBitRate`                | 录像模式项 `maxDurationSeconds` / `bitRate`            |
| `watermark.content`                            | `watermark.lines`                                      |
| `CameraResult.code` / `data` / `message`       | `CameraOutcome.status`，成功时 `media`，失败时 `error` |
| `CustomPhotoFile`                              | `CameraMedia`                                          |
| `cameraType` / `mime` / `duration`（秒）       | `facing` / `mimeType` / `durationMs`（毫秒）           |
| `path`、`cameraMode`、`isRemake`               | 移除；使用 `uri`、`mode`，库不执行翻拍识别             |
| `api.close()`                                  | 本次 `AbortController.abort()`                         |

初始闪光默认值现在是 `auto`。`quality` 只在照片模式提供；显式值会参与真实编码。设备不支持显式 `speed` 或 `hdr: true` 时，拍照提示局部配置错误并保留此前媒体。缺少宿主会明确返回 `failed / unavailable`，不会保持未完成的后台调用。

## 调用示例

```ts
const controller = new AbortController();
const result = await camera.open(
  {
    modes: [{ mode: 'single', quality: 0.9, qualityPriority: 'quality' }],
    initialFacing: 'back',
    initialFlash: 'auto',
    retention: 'clear',
    watermark: { lines: ['巡检记录'] },
  },
  { signal: controller.signal }
);

switch (result.status) {
  case 'success':
    console.log(result.media.map((media) => media.uri));
    break;
  case 'cancelled':
    break;
  case 'failed':
    console.error(result.error.reason, result.error.message);
    break;
}
```

调用方持有本次 controller，在所属操作取消时调用 `abort()`；不要为不同调用复用已经取消的 controller。新的有效调用接替旧调用，旧信号不能关闭新调用。

`success` 表示用户选用了媒体，消费者负责后续复制、上传和业务保存。公共入口仅导出 `useCamera` 与公共类型，内部文件处理、尺寸和数组辅助不作为应用 API。测试按[官方 mock](/docs/testing)更新，原生依赖变更后重新编译。
