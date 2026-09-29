---
sidebar_position: 2
title: CameraController
description: '相机打开、关闭、配置与结果交接。'
---

# CameraController

[`useCamera()`](/docs/api/use-camera) 提供稳定的 `CameraController`。一次 `open()` 对应一次交互，结果是可按 `status` 区分的 `CameraOutcome`。

## open(input, options?) {#open}

```ts
interface CameraController {
  open(
    input: Readonly<CameraInput>,
    options?: CameraCallOptions
  ): Promise<CameraOutcome>;
}
interface CameraCallOptions {
  signal?: AbortSignal;
}
```

```ts
const outcome = await camera.open({
  modes: [{ mode: 'single', quality: 0.9 }, { mode: 'continuous' }],
  initialFacing: 'back',
  initialFlash: 'auto',
  retention: 'retain',
});
if (outcome.status === 'success') {
  const files = outcome.media;
  // 保存或上传 files。
}
```

## 取消与替换 {#open-lifecycle}

每次调用创建自己的 `AbortController`，把它的 `signal` 传给 `open`。调用方持有所属 controller，在路由离开等场景调用 `abort()`。

```ts
const controller = new AbortController();
const pending = camera.open(
  { modes: [{ mode: 'single' }], retention: 'clear' },
  { signal: controller.signal }
);
controller.abort();
const outcome = await pending; // { status: 'cancelled' }
```

- 先校验输入。非法输入返回 `failed / invalid_input`，当前交互保持不变。
- 通过校验后，已经取消的信号返回 `cancelled`，不会打开或接替当前交互。
- 合法且未取消的新调用接替旧调用，旧调用返回 `cancelled`。
- 旧信号和旧回调只能结束其所属调用，不能关闭新调用。
- 用户退出、信号取消与真实宿主卸载只结算一次；成功交付后再取消不会改写结果。
- 未挂载宿主返回 `failed / unavailable`；Web 返回 `failed / unsupported`。

## 拍摄与媒体 {#input-behavior}

模式按 `modes` 顺序显示，首项是初始模式。初始镜头与闪光放在根级 `initialFacing` / `initialFlash`，默认分别为 `back` / `auto`。不可用的请求镜头按实际可用设备接入，返回真实 `facing`。

`retention: 'clear'` 在模式切换且已有媒体时先取得丢弃确认；拒绝时保持原模式与媒体。`retain` 保留已有媒体。单拍 `clear` 拍完直接进入确认预览。

照片质量参数位于照片模式，时长与码率参数位于录像模式。参见[完整类型](/docs/api/types)。麦克风权限只在实际开始录像时请求。

相机内局部操作失败会显示错误并保留此前媒体，用户可以明确重试或取消；无法继续整轮交互时才交付 `failed`。

`success` 表示用户选用媒体。文件仍在临时目录，交付后的保存、上传与释放由消费者负责。库只清理仍属于本轮且未交付的文件。
